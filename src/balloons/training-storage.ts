import type { ActionSource, EventTime } from './contracts'
import { canonicalJson } from './manifests'
import { drillId, loadDrillManifests } from './drill-manifests'
import type { DrillId, DrillManifest } from './drill-manifests'
import { createDrillAttempt, reconcileDrill, transitionDrill } from './drills'
import type { DrillAttempt, DrillControl } from './drills'
import { routeBaseline } from './router'
import type { Recommendation } from './router'
import { completedDrillEligibility, createTrainingChain } from './training-eligibility'
import type { TrainingChain } from './training-eligibility'
import type { BalloonsStore, Root, OwnerToken } from './storage'
import { acquireOwner } from './storage'

/** A capability held only while the installation's browser owner lock is held.
 * Reads never create or replace its durable token. */
export interface TrainingOwner { id: string; token: OwnerToken | null; live: boolean; release: () => void | Promise<void> }
export async function acquireTrainingOwner(signal: AbortSignal): Promise<TrainingOwner> {
  const release = await acquireOwner(signal)
  const owner: TrainingOwner = { id: crypto.randomUUID(), token: null, live: !signal.aborted,
    release: () => { owner.live = false; return release() } }
  signal.addEventListener('abort', owner.release, { once: true })
  return owner
}
function owned(root: Root, owner: TrainingOwner, attemptId?: string) {
  const token = owner.token
  if (!owner.live || !token || root.owner?.id !== token.id || root.owner.sessionId !== token.sessionId ||
    root.owner.generation !== token.generation || root.generation !== token.generation || (attemptId && token.sessionId !== attemptId)) throw new Error('Drill ownership lost')
}
function claim(root: Root, owner: TrainingOwner, attemptId: string) {
  if (!owner.live) throw new Error('Drill ownership released')
  if (owner.token) { owned(root, owner, attemptId); return owner.token }
  const token = { id: owner.id, sessionId: attemptId, generation: ++root.generation }
  root.owner = token
  return token
}
function pause(root: Root, attemptId: string, time: EventTime) {
  const saved = data(root), attempt = reconcileDrill(saved.attempts[attemptId])
  if (['paused', 'completed', 'invalid'].includes(attempt.snapshot.phase)) return
  const s = attempt.snapshot
  saved.attempts[attemptId] = transitionDrill(attempt, { kind: 'pause', source: 'unknown_or_assistive', time,
    ownershipGeneration: root.generation, actionId: s.nextActionId, expectedRevision: s.revision, expectedRound: s.round }).state
}
export async function pauseTraining(store: BalloonsStore, owner: TrainingOwner, time: EventTime, signal?: AbortSignal) {
  await store.backend.change(root => {
    assertInstallation(store, root); owned(root, owner)
    const id = owner.token!.sessionId, attempt = data(root).attempts[id]
    if (!attempt) throw new Error('Drill unavailable')
    view(root, attempt.header.recommendation.chainId, id)
    pause(root, id, time)
  }, signal)
  const root = await store.read(); owned(root, owner)
  const id = owner.token!.sessionId
  return view(root, data(root).attempts[id].header.recommendation.chainId, id)
}

export interface TrainingData {
  version: 'balloons-training-storage-v1'
  chains: Record<string, TrainingChain>
  attempts: Record<string, DrillAttempt>
  deletedAttemptIds: string[]
}
const empty = (): TrainingData => ({ version: 'balloons-training-storage-v1', chains: {}, attempts: {}, deletedAttemptIds: [] })
function data(root: Root): TrainingData {
  const value = root.training ?? empty()
  if (value.version !== 'balloons-training-storage-v1' || !value.chains || !value.attempts || !Array.isArray(value.deletedAttemptIds)) throw new Error('Training storage needs review')
  return value
}
function admitted(root: Root, chain: TrainingChain): Recommendation {
  const result = routeBaseline(root, chain.recommendation.baseline, [])
  if (result.status !== 'recommended' || canonicalJson(result) !== canonicalJson(chain.recommendation)) throw new Error('The original baseline or training assignment is unavailable')
  return result
}
function assertInstallation(store: BalloonsStore, root: Root) {
  if (root.installationId !== store.installationId) throw new Error('Balloons installation was replaced')
}
function view(root: Root, chainId: string, attemptId: string) {
  const saved = data(root), chain = saved.chains[chainId], attempt = saved.attempts[attemptId]
  if (!chain || !attempt || saved.deletedAttemptIds.includes(attemptId)) throw new Error('Saved drill is unavailable')
  admitted(root, chain)
  const checked = reconcileDrill(attempt)
  if (checked.header.recommendation.chainId !== chainId || canonicalJson(checked.header.recommendation) !== canonicalJson(chain.recommendation)) throw new Error('Drill assignment changed')
  const eligibility = chain.firstCompletedDrillId === attemptId
    ? completedDrillEligibility(chain, attemptId, { root, chains: saved.chains, savedDrills: saved.attempts, deletedDrillIds: saved.deletedAttemptIds, completedChainIds: [] })
    : null
  return { chain, retest: chain.retestSessionId ? root.records[chain.retestSessionId] ?? null : null, attempt: checked, eligible: eligibility?.status === 'eligible', firstCompleted: chain.firstCompletedDrillId === attemptId }
}
export type SavedTrainingView = ReturnType<typeof view>

/** Assignment reads the baseline, chain and prior attempts in the same transaction that saves the new attempt. */
export async function assignTraining(store: BalloonsStore, owner: TrainingOwner, sessionId: string, time: EventTime, signal?: AbortSignal): Promise<SavedTrainingView> {
  await prepareTrainingInventory()
  let claimed: OwnerToken | null = null
  const assigned = await store.backend.change(root => {
    assertInstallation(store, root)
    const saved = data(root)
    const routed = routeBaseline(root, { installationId: root.installationId, sessionId }, [])
    if (routed.status !== 'recommended') throw new Error(`A saved standalone baseline is required: ${routed.reason}`)
    const chainId = routed.chainId
    const existing = saved.chains[chainId]
    if (existing && canonicalJson(existing.recommendation) !== canonicalJson(routed)) throw new Error('Training assignment changed')
    if (existing) admitted(root, existing)
    const chain = existing ?? createTrainingChain(routed)
    const prior = Object.values(saved.attempts).filter(a => a.header.recommendation.chainId === chainId)
    prior.forEach(reconcileDrill)
    const current = prior.at(-1)
    const retained = chain.firstCompletedDrillId ?? (current && current.snapshot.phase !== 'invalid' ? current.header.attemptId : null)
    if (retained) {
      const recovering = !owner.token
      claimed = claim(root, owner, retained)
      if (recovering) pause(root, retained, time)
      return view(root, chainId, retained)
    }
    const manifest = (awaitedManifests.get(drillId(routed.kind, routed.consistencyProfile)))!
    if (!manifest) throw new Error('Assigned drill inventory unavailable')
    const attempt = createDrillAttempt(routed, manifest, crypto.randomUUID(), Object.values(saved.attempts), time)
    saved.chains[chainId] = chain
    saved.attempts[attempt.header.attemptId] = attempt
    claimed = claim(root, owner, attempt.header.attemptId)
    root.training = saved
    return view(root, chainId, attempt.header.attemptId)
  }, signal)
  owner.token = claimed
  return readTraining(store, assigned.chain.recommendation.chainId, assigned.attempt.header.attemptId, owner)
}

// Populated only after the approved inventory has been hash checked. IndexedDB callbacks remain synchronous.
const awaitedManifests = new Map<DrillId, DrillManifest>()
export async function prepareTrainingInventory() {
  const manifests = await loadDrillManifests()
  for (const [id, manifest] of manifests) awaitedManifests.set(id, manifest)
}

export async function readTraining(store: BalloonsStore, chainId: string, attemptId: string, owner?: TrainingOwner): Promise<SavedTrainingView> {
  const root = await store.read()
  if (owner) owned(root, owner, attemptId)
  return view(root, chainId, attemptId)
}

export async function commitTrainingAction(store: BalloonsStore, owner: TrainingOwner, chainId: string, attemptId: string, expected: DrillAttempt,
  kind: DrillControl, source: ActionSource, time: EventTime, reason?: 'settings_changed' | 'storage_uncertain' | 'integrity_failed' | 'authority_changed', signal?: AbortSignal): Promise<SavedTrainingView> {
  await store.backend.change(root => {
    assertInstallation(store, root)
    owned(root, owner, attemptId)
    const saved = data(root), chain = saved.chains[chainId]
    if (!chain) throw new Error('Training chain unavailable')
    admitted(root, chain)
    const current = saved.attempts[attemptId]
    if (!current || saved.deletedAttemptIds.includes(attemptId)) throw new Error('Drill unavailable or deleted')
    const verified = reconcileDrill(current)
    if (canonicalJson(verified) !== canonicalJson(expected)) throw new Error('Drill changed in another tab')
    const result = transitionDrill(verified, { kind, source, time, reason, ownershipGeneration: owner.token!.generation, actionId: verified.snapshot.nextActionId,
      expectedRevision: verified.snapshot.revision, expectedRound: verified.snapshot.round })
    if (!result.accepted) throw new Error('Drill action is stale')
    saved.attempts[attemptId] = result.state
    root.training = saved
    if (result.state.snapshot.phase === 'completed') {
      const eligibility = completedDrillEligibility(chain, attemptId, { root, chains: saved.chains, savedDrills: saved.attempts,
        deletedDrillIds: saved.deletedAttemptIds, completedChainIds: [] })
      if (eligibility.status === 'eligible' && eligibility.firstGrant) saved.chains[chainId] = eligibility.chain
    }
    return view(root, chainId, attemptId)
  }, signal)
  return readTraining(store, chainId, attemptId, owner)
}

export async function restartInvalidTraining(store: BalloonsStore, owner: TrainingOwner, chainId: string, attemptId: string, time: EventTime, signal?: AbortSignal): Promise<SavedTrainingView> {
  await prepareTrainingInventory()
  let claimed = owner.token
  const restarted = await store.backend.change(root => {
    assertInstallation(store, root)
    const saved = data(root), chain = saved.chains[chainId], old = saved.attempts[attemptId]
    if (!chain || !old || old.snapshot.phase !== 'invalid' || old.header.recommendation.chainId !== chainId) throw new Error('Only an invalid saved drill can restart')
    owned(root, owner)
    const recommendation = admitted(root, chain)
    const prior = Object.values(saved.attempts).filter(a => a.header.recommendation.chainId === chainId)
    prior.forEach(reconcileDrill)
    const retained = chain.firstCompletedDrillId ?? prior.find(a => !['completed', 'invalid'].includes(a.snapshot.phase))?.header.attemptId
    if (retained) { owned(root, owner, retained); return view(root, chainId, retained) }
    owned(root, owner, attemptId)
    const manifest = awaitedManifests.get(drillId(recommendation.kind, recommendation.consistencyProfile))!
    const next = createDrillAttempt(recommendation, manifest, crypto.randomUUID(), Object.values(saved.attempts), time)
    saved.attempts[next.header.attemptId] = next
    claimed = { id: owner.id, sessionId: next.header.attemptId, generation: ++root.generation }
    root.owner = claimed
    root.training = saved
    return view(root, chainId, next.header.attemptId)
  }, signal)
  owner.token = claimed
  return readTraining(store, chainId, restarted.attempt.header.attemptId, owner)
}
