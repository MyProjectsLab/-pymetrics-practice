import { NativePresenceError, requireObservedNativeVersion } from '../mock/native-presence'
import { openNativeForMock, validateObservedNative } from '../mock/native-presence'
import type { DevelopmentDraft, StopResult } from './run'
import { verifyCompletedResult } from './run'
import { routeStop, STOP_ROUTER_VERSION, STOP_V13_ROUTER_VERSION } from './training'
import type { DrillAttempt, TrainingChain } from './training'
import type { StopStandardFormFamily, StopVisualProfile } from './contracts'
import { stopFormRegistry, stopV13FormRegistry } from './forms'
import { drillBlockTrials, drillById } from './drills'
import { verifyDrillTiming } from './drill-integrity'
import { RULE } from './engine/rules'
import { inspectTrialEvents } from './engine/integrity'
import { openExistingNativeDatabase, readExistingNativeKey } from '../mock/native-presence'
import { compareStop } from './comparison'
import { orderPresentation, untilPresentationCanceled } from './presentation-order'
import type { UnderstandingEvidence, NewUnderstandingEvidence } from './preparation'
import { verifyUnderstandingEvidence } from './preparation'

export const STOP_LOCAL_SCHEMA = 'stop_local_v1' as const
export const STOP_ACTIVITY_SCHEMA = 'stop_local_activity_v1' as const
export const STOP_CLAIM_LEASE_MS = 30 * 60 * 1000
export class FormClaimExpiredError extends Error {}
const DB_NAME = 'assessment-practice-stop'
const DATA = 'installation'
const ACTIVITY = 'activity'
const RECORD = 'stop'
const DELETION_REVISION = 'deletion_revision'

export interface StoredExposure {
  formId: string
  exposedAtWall: string
  visualProfile: StopVisualProfile
  deleted: boolean
  sessionId?: string
  certainty: 'confirmed' | 'uncertain'
}
export interface StoredReservation {
  sessionId: string
  formId: string
  family: StopStandardFormFamily
  expiresAtMs: number | null
  chainId: string | null
  armed: boolean
  ownerTabId: string
  leaseVersion?: 'stop_unarmed_lease_v1'
}
export interface RetiredChain {
  id: string
  baselineSessionId: string
  retestSessionId: string | null
  drillId: string
  drillAttempts: TrainingChain['drillAttempts']
  retestAttempts: TrainingChain['retestAttempts']
  retiredAtWall: string
  reason: 'individual_delete'
}
let tabIdentity: string | null = null
export const stopTabIdentity = () => {
  try {
    const existing = sessionStorage.getItem('assessment_practice_stop_tab_v1')
    if (existing) return tabIdentity = existing
    const created = crypto.randomUUID()
    sessionStorage.setItem('assessment_practice_stop_tab_v1', created)
    return tabIdentity = created
  } catch { return tabIdentity ??= crypto.randomUUID() }
}
export type ActivityType = 'report_viewed' | 'drill_recommended' | 'drill_started' | 'drill_completed' |
  'retest_reserved' | 'retest_exposed' | 'retest_completed' | 'history_deleted' | 'storage_failure'
export interface LocalActivity {
  schemaVersion: typeof STOP_ACTIVITY_SCHEMA
  key: string
  sessionId: string
  chainId: string | null
  sequenceNumber: number
  recordedAtWall: string
  type: ActivityType
  payload: Record<string, unknown>
}
export interface StopLocalState {
  schemaVersion: typeof STOP_LOCAL_SCHEMA
  installationId: string
  results: Record<string, StopResult>
  drafts: Record<string, DevelopmentDraft>
  chains: Record<string, TrainingChain>
  retiredChains: Record<string, RetiredChain>
  activeChainId: string | null
  exposures: Record<string, StoredExposure>
  reservations: Record<string, StoredReservation>
  deletedSessions?: Record<string, true>
  attemptChains?: Record<string, string>
  preparationEvidence?: UnderstandingEvidence | null
  preparationEvidenceV13?: UnderstandingEvidence | null
  preparationEvidenceExperienceV13?: NewUnderstandingEvidence | null
}
const fresh = (): StopLocalState => ({ schemaVersion: STOP_LOCAL_SCHEMA, installationId: crypto.randomUUID(),
  results: {}, drafts: {}, chains: {}, retiredChains: {}, activeChainId: null, exposures: {}, reservations: {} })
function validate(value: unknown): StopLocalState {
  if (!value || typeof value !== 'object' || (value as StopLocalState).schemaVersion !== STOP_LOCAL_SCHEMA)
    throw new Error('Unsupported local storage version; existing data were preserved')
  const state = value as StopLocalState
  if (typeof state.installationId !== 'string' || !state.results || !state.drafts || !state.chains ||
    !state.exposures || !state.reservations || !Object.hasOwn(state, 'activeChainId'))
    throw new Error('Local storage record is incomplete; existing data were preserved')
  // Additive v1 migration: earlier development records did not have retired-chain history.
  state.retiredChains ??= {}
  state.deletedSessions ??= {}
  state.attemptChains ??= {}
  state.preparationEvidence ??= null
  state.preparationEvidenceV13 ??= null
  state.preparationEvidenceExperienceV13 ??= null
  return state
}
/** Reclamation requires affirmative durable evidence, never absence of a callback. */
function unarmedUnexposed(state: StopLocalState, claim: StoredReservation) {
  return claim.armed === false && !state.exposures[claim.formId] &&
    !Object.values(state.results).some(result => result?.form?.id === claim.formId) &&
    !Object.values(state.drafts).some(draft => draft?.form?.id === claim.formId && !knownUnexposedDraft(draft))
}
function migrateClaimLeases(state: StopLocalState, now: number) {
  for (const claim of Object.values(state.reservations)) {
    if (['baseline', 'replay'].includes(claim.family) && claim.expiresAtMs === null && unarmedUnexposed(state, claim)) {
      // Legacy claims have no creation timestamp. Start their full lease at the
      // first committed observation; read-only inspection never extends it.
      claim.expiresAtMs = now + STOP_CLAIM_LEASE_MS
      claim.leaseVersion = 'stop_unarmed_lease_v1'
    }
  }
}
function request<T>(item: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    item.onsuccess = () => resolve(item.result)
    item.onerror = () => reject(item.error ?? new Error('Local storage request failed'))
  })
}
function completed(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onabort = () => reject(tx.error ?? new Error('Local storage transaction aborted'))
    tx.onerror = () => reject(tx.error ?? new Error('Local storage transaction failed'))
  })
}
export interface CheckedHistory {
  valid: StopResult[]
  invalid: DevelopmentDraft[]
  rejected: { sessionId: string; formId: string | null; reason: string }[]
  chains: TrainingChain[]
  retiredChains: RetiredChain[]
  activeChain: TrainingChain | null
}
export function verifyDrillAttempt(attempt: DrillAttempt, responseKey: string): boolean {
  try {
    const manifest = drillById(attempt.drillId)
    if (typeof attempt.valid !== 'boolean' || !manifest || attempt.manifestChecksum !== manifest.checksum || attempt.version !== manifest.version ||
      !Array.isArray(attempt.events) || attempt.events.some((event, index) => event.sessionId !== attempt.id ||
        event.schemaVersion !== 'stop_engine_event_v1' || event.sequenceNumber !== index + 1 ||
        !Number.isFinite(event.timestampMs) || event.timestampMs < 0 ||
        index > 0 && event.timestampMs < attempt.events[index - 1].timestampMs)) return false
    if (!attempt.valid) return attempt.events.some(event => event.type === 'session_invalidated') &&
      !attempt.events.some(event => event.type === 'session_completed')
    if (attempt.events.filter(e => e.type === 'protection_started').length !== 1 ||
      attempt.events[0]?.type !== 'protection_started' || attempt.events[0].payload.responseKey !== responseKey ||
      attempt.events.filter(e => e.type === 'session_completed').length !== 1 ||
      attempt.events.filter(e => e.type === 'protection_ended').length !== 1) return false
    const anomalies = attempt.events.filter(e => e.type === 'timing_anomaly')
    const extras = attempt.events.filter(e => e.type === 'response_ignored' && e.payload.reason === 'extra')
    if (anomalies.length > 1 || anomalies.some(e => e.payload.severity !== 'non_severe') || extras.length >= 10 ||
      attempt.events.filter(e => e.type === 'response_accepted' && e.payload.anticipatory).length >= 3 ||
      attempt.events.filter(e => e.type === 'response_ignored' && e.payload.reason === 'fixation').length >= 3 ||
      attempt.events.filter(e => e.type === 'response_ignored' && e.payload.reason === 'wrong_key').length >= 5) return false
    const expectedNotes = [...anomalies.map(e => ({ ruleId: RULE.timingNote, triggerSequenceNumber: e.sequenceNumber })),
      ...(extras.length >= 5 ? [{ ruleId: RULE.extraNote, triggerSequenceNumber: extras[4].sequenceNumber }] : [])]
    const notes = attempt.events.filter(e => e.type === 'quality_note')
    if (notes.length !== expectedNotes.length || expectedNotes.some(note => notes.filter(e =>
      e.payload.ruleId === note.ruleId && e.payload.triggerSequenceNumber === note.triggerSequenceNumber &&
      e.sequenceNumber > note.triggerSequenceNumber).length !== 1)) return false
    if (attempt.completedBlocks !== manifest.blocks.length || attempt.events.some(event => event.type === 'session_invalidated' ||
      event.type === 'integrity_checked' && !event.payload.valid ||
      event.type === 'visibility_changed' && !event.payload.visible ||
      event.type === 'focus_changed' && event.payload.durationMs !== null && event.payload.durationMs > 1000 ||
      event.type === 'viewport_changed' && (event.payload.width < 768 || event.payload.height < 600) ||
      ['page_lifecycle_changed', 'setting_changed', 'warmup_restart_required'].includes(event.type))) return false
    let start = 0
    let previousFinish = 0
    for (let block = 0; block < manifest.blocks.length; block++) {
      const end = attempt.events.findIndex((event, index) => index >= start && event.type === 'batch_finished')
      if (end < 0) return false
      const segment = attempt.events.slice(start, end + 1)
      const trials = drillBlockTrials(manifest, block)
      const schedules = segment.filter(event => event.type === 'trial_scheduled')
      if (schedules.length !== trials.length || schedules.some((event, index) => JSON.stringify(event.payload.trial) !== JSON.stringify(trials[index])) ||
        !inspectTrialEvents(segment, trials, responseKey, manifest.blocks[block].deadlineMs).valid) return false
      const finished = attempt.events[end]
      if (finished.type !== 'batch_finished' || finished.payload.phase !== 'drill' || finished.payload.trialCount !== trials.length) return false
      if (!verifyDrillTiming(segment, manifest.blocks[block].fixationMs)) return false
      const initial = segment.find(e => e.type === 'fixation_started' && e.payload.kind === 'initial')!
      if (block > 0 && manifest.id === 'consistency' && initial.timestampMs < previousFinish + 15000) return false
      previousFinish = finished.timestampMs
      start = end + 1
    }
    const tail = attempt.events.slice(start)
    const completions = tail.filter(event => event.type === 'session_completed')
    return !tail.some(event => ['batch_finished', 'timing_anomaly', 'trial_scheduled', 'stimulus_presented', 'trial_resolved'].includes(event.type)) && completions.length === 1 &&
      completions[0].type === 'session_completed' && completions[0].payload.eventCount === completions[0].sequenceNumber &&
      completions[0] === tail.at(-2) &&
      completions[0].payload.validity === (notes.length ? 'valid_with_note' : 'valid') &&
      completions[0].payload.checksum === manifest.checksum && completions[0].payload.scoringVersion === 'stop_drill_scoring_v1' &&
      tail.at(-1)?.type === 'protection_ended'
  } catch { return false }
}
function reviewableDraft(draft: DevelopmentDraft): boolean {
  return !!draft && draft.schemaVersion === 'stop_development_draft_v1' &&
    ['invalid', 'no_unused_form'].includes(draft.status) && typeof draft.retainedAtWall === 'string' &&
    ['baseline', 'replay', 'retest'].includes(draft.mode) &&
    ['standard', 'shape_accommodation_v1'].includes(draft.setup?.visualProfile) &&
    typeof draft.setup?.binding?.code === 'string' && Array.isArray(draft.events) &&
    draft.events.every((event, index) => event && event.sessionId === draft.sessionId &&
      typeof event.type === 'string' && event.sequenceNumber === index + 1 && Number.isFinite(event.timestampMs))
}
/** A retained invalid journal can prove ordinary exit before any scored onset. */
function knownUnexposedDraft(draft: DevelopmentDraft): boolean {
  if (!reviewableDraft(draft) || draft.realizedSequence?.length !== 0 ||
    !draft.events.some(e => e.type === 'session_invalidated')) return false
  let phase: string | null = null
  for (const event of draft.events) {
    if (event.type === 'trial_scheduled') phase = event.payload.trial.phase
    if (event.type === 'stimulus_presented' && phase !== 'warmup') return false
  }
  return true
}

function reviewableRetiredAttempt(attempt: DrillAttempt): boolean {
  return !!attempt && typeof attempt.id === 'string' && typeof attempt.drillId === 'string' &&
    typeof attempt.completedAtWall === 'string' && Number.isInteger(attempt.completedBlocks) &&
    Array.isArray(attempt.events) && attempt.events.every((event, index) => event &&
      event.sessionId === attempt.id && event.sequenceNumber === index + 1 &&
      typeof event.type === 'string' && Number.isFinite(event.timestampMs))
}
/** Read-only eligibility check. Corrupt or future records remain in storage for review/deletion. */
export function inspectLocalState(state: StopLocalState): CheckedHistory {
  const valid: StopResult[] = [], invalid: DevelopmentDraft[] = [], rejected: CheckedHistory['rejected'] = []
  for (const [id, result] of Object.entries(state.results)) {
    const exposure = state.exposures[result?.form?.id]
    if (result?.sessionId === id && exposure?.certainty === 'confirmed' && !exposure.deleted &&
      exposure.sessionId === id && exposure.formId === result.form.id &&
      exposure.visualProfile === result.setup?.visualProfile && verifyCompletedResult(result)) valid.push(result)
    else rejected.push({ sessionId: id, formId: typeof result?.form?.id === 'string' ? result.form.id : null,
      reason: 'Stored result did not pass integrity, version, or exposure checks.' })
  }
  for (const [id, draft] of Object.entries(state.drafts)) {
    if (draft?.sessionId === id && reviewableDraft(draft)) invalid.push(draft)
    else rejected.push({ sessionId: id, formId: typeof draft?.form?.id === 'string' ? draft.form.id : null,
      reason: 'Stored attempt has an unsupported or incomplete record.' })
  }
  const ids = new Set(valid.map(result => result.sessionId))
  const chains: TrainingChain[] = []
  for (const chain of Object.values(state.chains)) {
    try {
    if (chainDeleted(state, chain) || chain?.schemaVersion !== 'stop_training_chain_v1' ||
      (chain.baseline?.specificationVersion === '1.3' ? chain.recommendation?.version !== STOP_V13_ROUTER_VERSION :
        !['stop_drill_router_v1', STOP_ROUTER_VERSION].includes(chain.recommendation?.version)) ||
      !ids.has(chain.baseline?.sessionId) || (chain.retest && !ids.has(chain.retest.sessionId)) ||
      chain.baseline.mode !== 'baseline' || chain.retest && chain.retest.mode !== 'retest') continue
    if (JSON.stringify(chain.baseline) !== JSON.stringify(state.results[chain.baseline.sessionId]) ||
      chain.retest && JSON.stringify(chain.retest) !== JSON.stringify(state.results[chain.retest.sessionId]) ||
      JSON.stringify(chain.recommendation) !== JSON.stringify(routeStop(chain.baseline, chain.recommendation.version)) ||
      chain.retest && !compareStop(chain.baseline, chain.retest)) continue
    if (!Array.isArray(chain.drillAttempts) || !Array.isArray(chain.retestAttempts) ||
      chain.drillAttempts.some(attempt => attempt.drillId !== chain.recommendation.drillId ||
        !verifyDrillAttempt(attempt, chain.baseline.setup.binding.code)) ||
      chain.retestAttempts.some(attempt => attempt.valid ? !ids.has(attempt.sessionId) :
        !state.exposures[attempt.formId] && !(state.drafts[attempt.sessionId]?.form?.id === attempt.formId &&
          knownUnexposedDraft(state.drafts[attempt.sessionId])))) continue
    const completedDrill = chain.drillAttempts.some(attempt => attempt.valid)
    if (new Set(chain.drillAttempts.map(attempt => attempt.id)).size !== chain.drillAttempts.length ||
      new Set(chain.retestAttempts.map(attempt => attempt.sessionId)).size !== chain.retestAttempts.length ||
      !['assigned', 'drilling', 'drill_complete', 'retesting', 'complete'].includes(chain.status) ||
      ['drill_complete', 'retesting', 'complete'].includes(chain.status) && !completedDrill ||
      chain.status === 'complete' && (!chain.retest || !chain.retestAttempts.some(attempt =>
        attempt.sessionId === chain.retest!.sessionId && attempt.formId === chain.retest!.form.id && attempt.valid)) ||
      chain.retest && chain.status !== 'complete') continue
    chains.push(chain)
    } catch { /* Keep an incomplete chain stored, but never make it eligible. */ }
  }
  const retiredChains = Object.values(state.retiredChains).filter(item => item?.reason === 'individual_delete' &&
    Array.isArray(item.drillAttempts) && item.drillAttempts.every(reviewableRetiredAttempt) &&
    Array.isArray(item.retestAttempts))
  return { valid, invalid, rejected, chains, retiredChains, activeChain: chains.find(chain => chain.id === state.activeChainId) ?? null }
}

/** Retirement writes carry review journals and relationship IDs, never deleted result snapshots. */
export interface RetiredChainSource {
  id: string
  status: TrainingChain['status']
  baseline: { sessionId: string }
  retest: { sessionId: string } | null
  recommendation: { drillId: TrainingChain['recommendation']['drillId'] }
  drillAttempts: TrainingChain['drillAttempts']
  retestAttempts: TrainingChain['retestAttempts']
}
function dependencyIds(chain: RetiredChainSource) {
  return [chain.baseline.sessionId, chain.retest?.sessionId,
    ...chain.drillAttempts.map(a => a.id), ...chain.retestAttempts.map(a => a.sessionId)]
}
export function chainDeleted(state: StopLocalState, chain: RetiredChainSource): boolean {
  return !!state.retiredChains[chain.id] || dependencyIds(chain).some(id => !!id && !!state.deletedSessions?.[id])
}
function retireChain(state: StopLocalState, chain: RetiredChainSource) {
  const previous = state.retiredChains[chain.id]
  const deleted = (id: string) => !!state.deletedSessions?.[id]
  for (const attempt of chain.drillAttempts) {
    const saved = previous?.drillAttempts.find(a => a.id === attempt.id)
    if (!deleted(attempt.id) && saved && JSON.stringify(saved) !== JSON.stringify(attempt)) throw new Error('Immutable drill attempt already exists')
  }
  state.retiredChains[chain.id] = {
    id: chain.id, baselineSessionId: deleted(chain.baseline.sessionId) ? '[deleted]' : chain.baseline.sessionId,
    retestSessionId: chain.retest && !deleted(chain.retest.sessionId) ? chain.retest.sessionId : null,
    drillId: chain.recommendation.drillId,
    drillAttempts: [...new Map([...(previous?.drillAttempts ?? []), ...chain.drillAttempts].map(a => [a.id, a])).values()].filter(a => !deleted(a.id)),
    retestAttempts: [...new Map([...(previous?.retestAttempts ?? []), ...chain.retestAttempts].map(a => [a.sessionId, a])).values()].filter(a => !deleted(a.sessionId)),
    retiredAtWall: previous?.retiredAtWall ?? new Date().toISOString(), reason: 'individual_delete',
  }
  delete state.chains[chain.id]
  if (state.activeChainId === chain.id) state.activeChainId = null
  for (const [id, claim] of Object.entries(state.reservations)) if (claim.chainId === chain.id && !claim.armed) delete state.reservations[id]
}
export class DeletedChainError extends Error {
  readonly state?: StopLocalState
  constructor(message: string, state?: StopLocalState) { super(message); this.state = state }
}
export class InstallationClearedError extends DeletedChainError {}


/** A single readwrite installation record serializes form claims across tabs. Schema upgrades are additive only. */
export class StopLocalStore {
  private readonly db: IDBDatabase
  private installationId: string | null = null
  private channel: BroadcastChannel | null = null
  private listeners = new Set<() => void>()
  private deletedSessions = new Set<string>()
  private deletedChains = new Set<string>()
  private cleared = false
  private constructor(db: IDBDatabase) {
    this.db = db; db.onversionchange = () => this.close()
    if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel('assessment-practice-stop-deletions-v1')
      this.channel.onmessage = event => {
        if (event.data.installationId !== this.installationId) return
        if (event.data.all) this.cleared = true
        else {
          for (const id of event.data.sessions) this.deletedSessions.add(id)
          for (const id of event.data.chains) this.deletedChains.add(id)
        }
        for (const listener of this.listeners) listener()
      }
    }
  }
  subscribeDeletion(listener: () => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  installationIdentity() { return this.installationId }
  sameInstallation(state: StopLocalState) { return !this.cleared && state.installationId === this.installationId }
  chainAvailable(chain: TrainingChain) { return !this.cleared && !this.deletedChains.has(chain.id) &&
    !dependencyIds(chain).some(id => !!id && this.deletedSessions.has(id)) }
  private assertInstallation(state: StopLocalState) {
    if (this.cleared || this.installationId !== null && state.installationId !== this.installationId)
      throw new InstallationClearedError('Local installation was cleared')
  }
  async admitPresentation(chain: TrainingChain, sessionId: string, present: () => Promise<void>, signal: AbortSignal): Promise<void> {
    await orderPresentation(() => untilPresentationCanceled((async () => {
      signal.throwIfAborted()
      const state = await this.read()
      signal.throwIfAborted()
      this.assertInstallation(state)
      if (chainDeleted(state, chain)) throw new DeletedChainError('Training dependency was deleted', state)
      const claim = state.reservations[sessionId]
      if (!claim?.armed || claim.chainId !== chain.id || !state.results[chain.baseline.sessionId])
        throw new Error('Retest presentation has no armed chain')
      // The caller keeps this lock through rAF, synchronous confirmation and its
      // exposure write. Deletion cannot commit between this check and the paint.
      if (!signal.aborted) await present()
    })(), signal), signal)
  }
  async checkChain(chain: TrainingChain): Promise<void> {
    const deleted = await this.mutate(state => {
      if (chainDeleted(state, chain)) {
        // Retirement must commit even though the requested active operation is rejected.
        retireChain(state, { ...chain, drillAttempts: state.chains[chain.id]?.drillAttempts ?? [] })
        return state
      }
      if (!state.results[chain.baseline.sessionId]) throw new Error('Training baseline has not been saved')
      return null
    })
    if (deleted) throw new DeletedChainError('Training dependency was deleted', deleted)
  }
  async saveRetiredChain(chain: RetiredChainSource): Promise<void> {
    await this.mutate(state => {
      if (!chainDeleted(state, chain)) throw new Error('Chain has not been retired')
      retireChain(state, chain)
    })
  }
  static async open(): Promise<StopLocalStore> {
    if (!('indexedDB' in globalThis)) throw new Error('IndexedDB unavailable')
    const opening = indexedDB.open(DB_NAME, 1)
    opening.onupgradeneeded = () => {
      if (!opening.result.objectStoreNames.contains(DATA)) opening.result.createObjectStore(DATA)
      if (!opening.result.objectStoreNames.contains(ACTIVITY)) opening.result.createObjectStore(ACTIVITY, { keyPath: 'key' })
    }
    const db = await request(opening)
    const store = new StopLocalStore(db)
    try { await store.mutate(() => undefined) }
    catch (error) { store.close(); throw error }
    return store
  }
  /** Retained mock references never use open()/read(), which initialize a missing or undefined Stop root. */
  private retainedMock=false
  static openForMock(parent?:AbortSignal,allowCreate=true){return openNativeForMock(DB_NAME,1,db=>{db.createObjectStore(DATA).put(fresh(),RECORD);db.createObjectStore(ACTIVITY,{keyPath:'key'})},signal=>this.openRetained(signal),parent,allowCreate)}
  static async openRetained(signal: AbortSignal): Promise<StopLocalStore> {
    const db = await openExistingNativeDatabase(DB_NAME, signal)
    const store = new StopLocalStore(db)
    try {if(db.version!==1)throw new NativePresenceError('unsupported','Native source database version is unsupported');
      const raw = await readExistingNativeKey(db, DATA, RECORD, signal)
      requireObservedNativeVersion(raw,'schemaVersion',[STOP_LOCAL_SCHEMA]); const state = validateObservedNative(()=>validate(raw))
      store.retainedMock=true
      store.installationId = state.installationId
      return store
    } catch (error) { store.close(); throw error }
  }
  async readRetained(signal: AbortSignal): Promise<StopLocalState> {
    const raw = await readExistingNativeKey(this.db, DATA, RECORD, signal)
    const state = validate(raw)
    this.assertInstallation(state)
    return state
  }
  async read(): Promise<StopLocalState> {
    if(this.retainedMock)return this.readRetained(new AbortController().signal)
    const tx = this.db.transaction(DATA, 'readonly')
    const done = completed(tx)
    const value = await request(tx.objectStore(DATA).get(RECORD))
    await done
    return value === undefined ? fresh() : validate(value)
  }
  async deletionRevision(): Promise<string | undefined> {
    const tx = this.db.transaction(DATA, 'readonly'), done = completed(tx)
    const revision = await request(tx.objectStore(DATA).get(DELETION_REVISION)) as string | undefined
    await done
    return revision
  }
  async mutate<T>(change: (state: StopLocalState, activity: IDBObjectStore) => T, signal?: AbortSignal): Promise<T> {
    signal?.throwIfAborted()
    const tx = this.db.transaction([DATA, ACTIVITY], 'readwrite')
    const done = completed(tx)
    // Observe abort even when request/promise delivery is stalled. IDB serializes
    // a following deletion transaction after this transaction aborts or commits.
    void done.catch(() => undefined)
    const abort = () => { try { tx.abort() } catch { /* already committed/aborted */ } }
    signal?.addEventListener('abort', abort, { once: true })
    try {
      const objectStore = tx.objectStore(DATA)
      const current = await request(objectStore.get(RECORD))
      signal?.throwIfAborted()
      const state = current === undefined && !this.retainedMock ? fresh() : validate(current)
      this.assertInstallation(state)
      migrateClaimLeases(state, Date.now())
      const output = change(state, tx.objectStore(ACTIVITY))
      objectStore.put(state, RECORD)
      await done
      this.installationId = state.installationId
      return output
    } catch (error) {
      try { tx.abort() } catch { /* already closed */ }
      await done.catch(() => undefined)
      throw error
    } finally {
      signal?.removeEventListener('abort', abort)
    }
  }
  async activity(event: Omit<LocalActivity, 'schemaVersion' | 'recordedAtWall' | 'sequenceNumber'>) {
    await this.mutate((_state, activity) => appendActivity(activity, event))
  }
  async activities(): Promise<LocalActivity[]> {
    const tx = this.db.transaction(ACTIVITY, 'readonly'), done = completed(tx)
    const entries = await request(tx.objectStore(ACTIVITY).getAll()) as LocalActivity[]
    await done
    return entries.sort((a, b) => a.sessionId.localeCompare(b.sessionId) || a.sequenceNumber - b.sequenceNumber)
  }
  async currentUnderstandingEvidence(specificationVersion: '1.1' | '1.3' = '1.1'): Promise<UnderstandingEvidence | null> {
    const state = await this.read()
    const evidence = specificationVersion === '1.3' ? state.preparationEvidenceV13 : state.preparationEvidence
    return evidence?.specificationVersion === specificationVersion && await verifyUnderstandingEvidence(evidence) ? evidence : null
  }
  async saveUnderstandingEvidence(evidence: UnderstandingEvidence, expectedInstallationId: string | null): Promise<void> {
    if (!await verifyUnderstandingEvidence(evidence)) throw new Error('Understanding evidence failed integrity check')
    await this.mutate(state => {
      if (!expectedInstallationId || state.installationId !== expectedInstallationId ||
        state.deletedSessions?.[evidence.sourceSessionId]) throw new Error('Understanding source was deleted or installation changed')
      if (evidence.specificationVersion === '1.3') state.preparationEvidenceV13 = evidence
      else state.preparationEvidence = evidence
    })
  }
  async saveNewUnderstandingEvidence(evidence: NewUnderstandingEvidence, expectedInstallationId: string | null): Promise<void> {
    if (!await verifyUnderstandingEvidence(evidence)) throw new Error('New understanding evidence failed integrity check')
    await this.mutate(state => {
      if (!expectedInstallationId || state.installationId !== expectedInstallationId ||
        state.deletedSessions?.[evidence.sourceSessionId]) throw new Error('Understanding source was deleted or installation changed')
      state.preparationEvidenceExperienceV13 = evidence
    })
  }
  async deleteUnderstandingEvidence(): Promise<void> {
    await this.mutate(state => { state.preparationEvidence = null; state.preparationEvidenceV13 = null; state.preparationEvidenceExperienceV13 = null })
  }
  async reserve(sessionId: string, family: StopStandardFormFamily, choice = Math.random(), expiresAtMs: number | null = null, chainId: string | null = null, retainedChain?: TrainingChain, specificationVersion: '1.1' | '1.3' = '1.1'): Promise<StoredReservation | null> {
    if (!Number.isFinite(choice) || choice < 0 || choice >= 1) throw new Error('Invalid random choice')
    return this.mutate((state, activity) => {
      if (family === 'retest') {
        const chain = retainedChain ?? (chainId ? state.chains[chainId] : null)
        if (!chain || chain.id !== chainId || chainDeleted(state, chain)) throw new DeletedChainError('Retest chain is unavailable', state)
        if (chain.retest || state.chains[chain.id]?.retest || Object.entries(state.attemptChains ?? {}).some(([id, link]) =>
          link === chain.id && state.results[id]?.mode === 'retest')) throw new Error('This chain already has a completed retest')
        if (!state.results[chain.baseline.sessionId]) throw new Error('Training baseline has not been saved')
      }
      const existing = state.reservations[sessionId]
      if (existing) {
        if (!existing.armed && existing.expiresAtMs !== null && Date.now() >= existing.expiresAtMs) throw new FormClaimExpiredError('Form claim expired; restart this activity')
        return existing
      }
      for (const [id, item] of Object.entries(state.reservations)) {
        if (unarmedUnexposed(state, item) && item.expiresAtMs !== null && Date.now() >= item.expiresAtMs) delete state.reservations[id]
      }
      const blocked = new Set([...Object.keys(state.exposures), ...Object.values(state.reservations).map(item => item.formId),
        ...Object.values(state.results).map(item => item?.form?.id), ...Object.values(state.drafts).filter(item => !knownUnexposedDraft(item)).map(item => item?.form?.id)])
      const inventory = specificationVersion === '1.3' ? stopV13FormRegistry.all : stopFormRegistry.all
      const eligible = inventory.filter(form => form.family === family && !blocked.has(form.id))
      if (!eligible.length) return null
      const baseline = family === 'retest' ? retainedChain?.baseline ?? (chainId ? state.chains[chainId]?.baseline : null) : null
      if (baseline && baseline.specificationVersion !== specificationVersion) throw new Error('Retest form version differs from baseline')
      const baselineGo = baseline?.form.sequence.filter(value => value === 'GO').length
      const matching = specificationVersion === '1.3' && baselineGo !== undefined ?
        eligible.filter(form => form.sequence.filter(value => value === 'GO').length === baselineGo) : []
      const pool = matching.length ? matching : eligible
      const form = pool[Math.floor(choice * pool.length)]
      const reservation = { sessionId, formId: form.id, family, expiresAtMs: family === 'retest' ? expiresAtMs : Date.now() + STOP_CLAIM_LEASE_MS, chainId, armed: false, ownerTabId: stopTabIdentity(),
        ...(family !== 'retest' ? { leaseVersion: 'stop_unarmed_lease_v1' as const } : {}) }
      state.reservations[sessionId] = reservation
      if (family === 'retest' && chainId) appendActivity(activity, { key: `${chainId}:retest_reserved:${sessionId}`, sessionId, chainId,
        type: 'retest_reserved', payload: { formId: form.id, chainId, status: 'reserved' } })
      return reservation
    })
  }
  async arm(sessionId: string, formId: string, visualProfile: StopVisualProfile): Promise<void> {
    await this.mutate(state => {
      const record = state.reservations[sessionId]
      if (!record || record.formId !== formId || state.exposures[formId] ||
        record.expiresAtMs !== null && Date.now() >= record.expiresAtMs) throw new FormClaimExpiredError('Form claim expired or conflicted; restart this activity')
      if (record.chainId && (!state.chains[record.chainId] || chainDeleted(state, state.chains[record.chainId])))
        throw new DeletedChainError('Retest chain was deleted', state)
      record.armed = true
      state.exposures[formId] = { formId, exposedAtWall: new Date().toISOString(), visualProfile,
        deleted: false, sessionId, certainty: 'uncertain' }
    })
  }
  async confirm(sessionId: string, formId: string, exposedAtWall: string, chainId: string | null, signal?: AbortSignal): Promise<void> {
    await this.mutate((state, activity) => {
      const marker = state.exposures[formId]
      if (!marker || marker.sessionId !== sessionId) throw new Error('Exposure claim mismatch')
      marker.certainty = 'confirmed'; marker.exposedAtWall = exposedAtWall
      delete state.reservations[sessionId]
      if (chainId) appendActivity(activity, { key: `${chainId}:retest_exposed:${sessionId}`, sessionId, chainId,
        type: 'retest_exposed', payload: { formId, chainId, status: 'exposed' } })
    }, signal)
  }
  async release(sessionId: string, confirmed: boolean): Promise<void> {
    await this.mutate(state => {
      const claim = state.reservations[sessionId]
      if (!claim) return
      if (!confirmed) delete state.exposures[claim.formId]
      else if (state.exposures[claim.formId]?.sessionId === sessionId) state.exposures[claim.formId].certainty = 'confirmed'
      delete state.reservations[sessionId]
    }).catch(error => { if (!(error instanceof InstallationClearedError)) throw error })
  }
  async saveResult(result: StopResult, chainId?: string, installationId = this.installationId): Promise<void> {
    if (!verifyCompletedResult(result)) throw new Error('Result failed event reconciliation')
    await this.mutate((state, activity) => {
      if (state.installationId !== installationId) throw new InstallationClearedError('Completion belongs to a deleted installation')
      if (chainId && (!state.chains[chainId] || chainDeleted(state, state.chains[chainId])))
        throw new DeletedChainError('Completed retest chain was deleted', state)
      if (state.deletedSessions?.[result.sessionId]) throw new DeletedChainError('Result was deleted', state)
      const prior = state.results[result.sessionId]
      if (prior && JSON.stringify(prior) !== JSON.stringify(result)) throw new Error('Immutable result already exists')
      const marker = state.exposures[result.form.id]
      if (!marker || marker.sessionId !== result.sessionId) throw new Error('Result exposure missing')
      marker.certainty = 'confirmed'
      if (chainId) {
        (state.attemptChains ??= {})[result.sessionId] = chainId
        const chain = state.chains[chainId]
        state.chains[chainId] = { ...chain, retest: chain.retest ?? result, status: 'complete',
          retestAttempts: [...chain.retestAttempts.filter(a => a.sessionId !== result.sessionId),
            { sessionId: result.sessionId, formId: result.form.id, valid: true }] }
        if (!chain.retest) appendActivity(activity, { key: `${chainId}:retest_completed:${result.sessionId}`, sessionId: result.sessionId,
          chainId, type: 'retest_completed', payload: { formId: result.form.id, chainId, status: 'complete' } })
        appendActivity(activity, { key: `${chainId}:retest_exposed:${result.sessionId}`, sessionId: result.sessionId, chainId,
          type: 'retest_exposed', payload: { formId: result.form.id, chainId, status: 'exposed' } })
      }
      state.results[result.sessionId] = result
      delete state.drafts[result.sessionId]
      delete state.reservations[result.sessionId]
    })
  }
  async saveDraft(draft: DevelopmentDraft, chainId?: string): Promise<void> {
    await this.mutate(state => {
      if (state.deletedSessions?.[draft.sessionId]) throw new DeletedChainError('Attempt was deleted', state)
      const relationship = chainId ?? state.reservations[draft.sessionId]?.chainId
      if (relationship) (state.attemptChains ??= {})[draft.sessionId] = relationship
      const prior = state.drafts[draft.sessionId]
      if (prior && JSON.stringify(prior.events) !== JSON.stringify(draft.events)) throw new Error('Immutable invalid-event record already exists')
      state.drafts[draft.sessionId] = draft
      const claim = state.reservations[draft.sessionId]
      if (claim) {
        if (knownUnexposedDraft(draft)) delete state.exposures[claim.formId]
        else if (state.exposures[claim.formId]) state.exposures[claim.formId].certainty = 'confirmed'
        delete state.reservations[draft.sessionId]
      }
    })
  }
  async saveChain(chain: TrainingChain, event?: Omit<LocalActivity, 'schemaVersion' | 'recordedAtWall' | 'sequenceNumber'>): Promise<void> {
    await this.checkChain(chain)
    await this.mutate((state, activity) => {
      if (chainDeleted(state, chain)) throw new DeletedChainError('Training chain was retired by deletion', state)
      if (state.exposures[chain.baseline.form.id]?.deleted ||
        chain.retestAttempts.some(attempt => state.exposures[attempt.formId]?.deleted))
        throw new DeletedChainError('Training chain depends on a deleted result or retest attempt', state)
      if (chain.retestAttempts.some(attempt => !state.results[attempt.sessionId] && !state.drafts[attempt.sessionId]))
        throw new Error('Training chain retest attempt has not been saved')
      if (JSON.stringify(state.results[chain.baseline.sessionId]) !== JSON.stringify(chain.baseline) ||
        chain.retest && JSON.stringify(state.results[chain.retest.sessionId]) !== JSON.stringify(chain.retest))
        throw new Error('Training chain depends on a missing or changed result')
      const prior = state.chains[chain.id]
      // An older queued snapshot cannot erase newer attempts or replace an
      // already completed relationship. Result journals are saved separately.
      const retained = { ...chain,
        drillAttempts: [...new Map([...chain.drillAttempts, ...(prior?.drillAttempts ?? [])].map(a => [a.id, a])).values()],
        retestAttempts: [...new Map([...chain.retestAttempts, ...(prior?.retestAttempts ?? [])].map(a => [a.sessionId, a])).values()],
        ...(prior?.retest ? { retest: prior.retest, status: 'complete' as const } : {}),
      }
      state.chains[chain.id] = retained; state.activeChainId = chain.id
      if (event && (event.type !== 'retest_completed' || event.sessionId === retained.retest?.sessionId)) appendActivity(activity, event)
    })
  }
  /** Admit a saved baseline's first training chain in the same transaction that
   * checks its result, exposure, deletion and existing-chain authority. */
  async createChainFromSavedBaseline(chain: TrainingChain, signal?: AbortSignal): Promise<void> {
    await this.mutate((state, activity) => {
      const baseline = chain.baseline
      const exposure = state.exposures[baseline.form.id]
      if (chain.schemaVersion !== 'stop_training_chain_v1' || chain.status !== 'assigned' || chain.retest !== null ||
        chain.drillAttempts.length !== 0 || chain.retestAttempts.length !== 0 ||
        baseline.mode !== 'baseline' || baseline.storageMode !== 'persistent_local' ||
        !verifyCompletedResult(baseline) || state.deletedSessions?.[baseline.sessionId] ||
        JSON.stringify(state.results[baseline.sessionId]) !== JSON.stringify(baseline) ||
        !exposure || exposure.deleted || exposure.certainty !== 'confirmed' ||
        exposure.sessionId !== baseline.sessionId || exposure.formId !== baseline.form.id ||
        exposure.visualProfile !== baseline.setup.visualProfile ||
        chain.recommendation.version !== (baseline.specificationVersion === '1.3' ? STOP_V13_ROUTER_VERSION : STOP_ROUTER_VERSION) ||
        JSON.stringify(chain.recommendation) !== JSON.stringify(routeStop(baseline)))
        throw new Error('Saved baseline is no longer eligible for training')
      if (state.chains[chain.id] || Object.values(state.chains).some(item => item.baseline.sessionId === baseline.sessionId || item.status !== 'complete') ||
        Object.values(state.retiredChains).some(item => item.baselineSessionId === baseline.sessionId) ||
        state.activeChainId && state.chains[state.activeChainId]?.status !== 'complete')
        throw new Error('This baseline already has a chain or another chain is active')
      state.chains[chain.id] = chain
      state.activeChainId = chain.id
      appendActivity(activity, { key: `${chain.id}:drill_recommended:${baseline.sessionId}`,
        sessionId: baseline.sessionId, chainId: chain.id, type: 'drill_recommended',
        payload: { ruleVersion: chain.recommendation.version, drillId: chain.recommendation.drillId,
          reasonMetrics: chain.recommendation.candidates.find(item => item.id === chain.recommendation.drillId)?.metrics ?? {} } })
    }, signal)
  }
  async deleteResult(sessionId: string, retained: readonly TrainingChain[] = []): Promise<void> {
    await orderPresentation(() => this.deleteResultOrdered(sessionId, retained))
  }
  private async deleteResultOrdered(sessionId: string, retained: readonly TrainingChain[]): Promise<void> {
    const deletedState = await this.mutate((state, activity) => {
      activity.transaction.objectStore(DATA).put(crypto.randomUUID(), DELETION_REVISION);
      (state.deletedSessions ??= {})[sessionId] = true
      const linkedChain = state.attemptChains?.[sessionId] ?? state.reservations[sessionId]?.chainId
      const result = state.results[sessionId], draft = state.drafts[sessionId]
      const exposed = Object.values(state.exposures).find(marker => marker.sessionId === sessionId)
      const formId = result?.form?.id ?? draft?.form?.id ?? exposed?.formId
      if (formId && (result || exposed || !knownUnexposedDraft(draft))) {
        const marker = state.exposures[formId]
        state.exposures[formId] = { formId, exposedAtWall: marker?.exposedAtWall ?? result?.completedAtWall ?? draft?.retainedAtWall ?? new Date().toISOString(),
          visualProfile: marker?.visualProfile ?? result?.setup?.visualProfile ?? draft?.setup?.visualProfile ?? 'standard',
          deleted: true, certainty: marker?.certainty ?? 'uncertain' }
      }
      delete state.results[sessionId]; delete state.drafts[sessionId]
      if (state.preparationEvidence?.sourceSessionId === sessionId) state.preparationEvidence = null
      if (state.preparationEvidenceV13?.sourceSessionId === sessionId) state.preparationEvidenceV13 = null
      if (state.preparationEvidenceExperienceV13?.sourceSessionId === sessionId) state.preparationEvidenceExperienceV13 = null
      delete state.reservations[sessionId]
      // Include same-tab journals not yet saved. Deletion retires their chain too,
      // while preserving other attempts for review in the same atomic transaction.
      const candidates = new Map(Object.values(state.chains).map(chain => [chain.id, chain]))
      for (const chain of retained) {
        if (state.retiredChains[chain.id]) continue
        const previous = candidates.get(chain.id)
        candidates.set(chain.id, { ...chain,
          drillAttempts: [...new Map([...(previous?.drillAttempts ?? []), ...chain.drillAttempts].map(a => [a.id, a])).values()],
          retestAttempts: [...new Map([...(previous?.retestAttempts ?? []), ...chain.retestAttempts].map(a => [a.sessionId, a])).values()] })
      }
      for (const chain of candidates.values()) {
        if (chain.id === linkedChain || chain.baseline.sessionId === sessionId || chain.retest?.sessionId === sessionId ||
          chain.drillAttempts.some(item => item.id === sessionId) || chain.retestAttempts.some(item => item.sessionId === sessionId)) {
          retireChain(state, chain)
        }
      }
      for (const retired of Object.values(state.retiredChains)) {
        if (retired.baselineSessionId === sessionId) retired.baselineSessionId = '[deleted]'
        if (retired.retestSessionId === sessionId) retired.retestSessionId = null
        retired.drillAttempts = retired.drillAttempts.filter(item => item.id !== sessionId)
        retired.retestAttempts = retired.retestAttempts.filter(item => item.sessionId !== sessionId)
      }
      const prior = activity.getAll()
      prior.onsuccess = () => {
        for (const item of prior.result as LocalActivity[]) if (item.sessionId === sessionId) activity.delete(item.key)
        appendActivity(activity, { key: `delete:${sessionId}`, sessionId, chainId: null,
          type: 'history_deleted', payload: { scope: 'individual', formId: formId ?? null } })
      }
      delete state.attemptChains?.[sessionId]
      return state
    })
    const sessions = Object.keys(deletedState.deletedSessions ?? {}), chains = Object.keys(deletedState.retiredChains)
    for (const id of sessions) this.deletedSessions.add(id)
    for (const id of chains) this.deletedChains.add(id)
    // Local notification carries deletion identities only, never task journals.
    this.channel?.postMessage({ installationId: this.installationId, sessions, chains })
  }
  async deleteAll(): Promise<void> {
    await orderPresentation(() => this.deleteAllOrdered())
  }
  private async deleteAllOrdered(): Promise<void> {
    this.assertInstallation(await this.read())
    const tx = this.db.transaction([DATA, ACTIVITY], 'readwrite'), done = completed(tx)
    tx.objectStore(DATA).clear(); tx.objectStore(ACTIVITY).clear()
    tx.objectStore(DATA).put(crypto.randomUUID(), DELETION_REVISION)
    await done
    this.cleared = true
    this.channel?.postMessage({ installationId: this.installationId, all: true })
    temporaryActivity.clear()
    try { sessionStorage.removeItem('assessment_practice_stop_tab_v1') } catch { /* unavailable */ }
    tabIdentity = null
    this.installationId = null; this.cleared = false; this.deletedSessions.clear(); this.deletedChains.clear()
    await this.mutate(() => undefined)
  }
  close() { this.channel?.close(); this.db.close() }
}
function appendActivity(store: IDBObjectStore, event: Omit<LocalActivity, 'schemaVersion' | 'recordedAtWall' | 'sequenceNumber'>) {
  const existing = store.get(event.key)
  existing.onsuccess = () => {
    if (existing.result !== undefined) return
    const all = store.getAll()
    all.onsuccess = () => {
      const sequenceNumber = Math.max(0, ...(all.result as LocalActivity[]).filter(item => item.sessionId === event.sessionId).map(item => item.sequenceNumber || 0)) + 1
      store.add({ ...event, schemaVersion: STOP_ACTIVITY_SCHEMA, sequenceNumber, recordedAtWall: new Date().toISOString() })
    }
  }
}
let current: StopLocalStore | null = null
const temporaryActivity = new Map<string, LocalActivity>()
export function setStopLocalStore(store: StopLocalStore | null) { current = store }
export const stopLocalStore = () => current
export const temporaryLocalActivity = () => [...temporaryActivity.values()]
export async function recordLocalActivity(event: Omit<LocalActivity, 'schemaVersion' | 'recordedAtWall' | 'sequenceNumber'>) {
  try { if (current) { await current.activity(event); return } } catch { /* retain in tab below */ }
  if (!temporaryActivity.has(event.key)) temporaryActivity.set(event.key,
    { ...event, schemaVersion: STOP_ACTIVITY_SCHEMA, sequenceNumber: [...temporaryActivity.values()].filter(item => item.sessionId === event.sessionId).length + 1,
      recordedAtWall: new Date().toISOString() })
}
