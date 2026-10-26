import type { EventTime, FormId } from './contracts'
import { advance, createRecord, DURABLE_VERSION, reconcileDurable, requireIntegrity, RETEST_RESERVATION_MS } from './durable'
import type { DurableRecord } from './durable'
import { canonicalJson } from './manifests'
import type { OwnerToken, Root } from './storage'
import { completedDrillEligibility } from './training-eligibility'

/** Re-derive admission from the current durable BL and first assigned completion.
 * This runs inside the same transaction as every RT mutation. */
export function retestChain(root: Root, chainId: string, completedSessionId?: string) {
  const saved = root.training, chain = saved?.chains[chainId]
  requireIntegrity(saved?.version === 'balloons-training-storage-v1' && chain?.firstCompletedDrillId, 'saved first drill completion required')
  requireIntegrity(!chain.completedRetestSessionId || chain.completedRetestSessionId === completedSessionId, 'retest chain closed')
  // For review of the one closed endpoint, check the original dependencies using
  // the same admission function, without reopening or mutating the saved chain.
  const open = { ...chain }; delete open.completedRetestSessionId
  const eligible = completedDrillEligibility(open, chain.firstCompletedDrillId, {
    root, chains: { ...saved.chains, [chainId]: open }, savedDrills: saved.attempts,
    deletedDrillIds: saved.deletedAttemptIds, completedChainIds: [],
  })
  requireIntegrity(eligible.status === 'eligible' && !eligible.firstGrant, 'baseline or first drill is no longer eligible')
  return chain
}

export function admitRetest(root: Root, record: DurableRecord) {
  const rt = record.header.retest
  if (!rt) return
  const id = record.header.identity.sessionId, chain = retestChain(root, record.header.identity.chainId!, id)
  const rec = chain.recommendation
  requireIntegrity(chain.retestSessionId === id && rt.baselineSessionId === rec.baseline.sessionId && rt.baselineFormId === rec.baselineFormId &&
    rt.drillAttemptId === chain.firstCompletedDrillId && canonicalJson(record.header.settings) === canonicalJson(rec.settings) &&
    canonicalJson(record.header.identity.mapping) === canonicalJson(rec.mapping), 'retest binding or current attempt changed')
}

export function closeRetest(root: Root, record: DurableRecord) {
  if (!record.header.retest || record.snapshot.phase !== 'completed' || !record.snapshot.comparisonEligible) return
  admitRetest(root, record)
  requireIntegrity(!record.header.repeat && record.snapshot.exposure === 'form_exposed' && record.snapshot.confirmedRounds.length === 39, 'invalid retest completion')
  const id = record.header.identity.chainId!, chain = root.training!.chains[id]
  root.training!.chains[id] = { ...chain, completedRetestSessionId: record.header.identity.sessionId }
}

/** Caller holds the installation browser owner lock. Durable CAS uses the root
 * generation; all old continuations are canceled before that lock is released. */
export function reserveRetest(root: Root, ownerId: string, baselineSessionId: string, time: EventTime, device: string, freshAttempt = false): { record: DurableRecord; token: OwnerToken } {
  const baseline = root.records[baselineSessionId], chainId = baseline?.header.identity.chainId
  requireIntegrity(chainId, 'baseline unavailable')
  const chain = retestChain(root, chainId)
  // A new owner can reclaim only journals proving no presentation was ever armed.
  // The global browser lock excludes the old presenter; its durable CAS is revoked.
  for (const r of Object.values(root.records)) {
    if (!r.header.retest || r.snapshot.exposure !== 'pending_exposure') continue
    reconcileDurable(r)
    root.records[r.header.identity.sessionId] = advance(r, { kind: 'release', reason: 'explanation_reopened' }, time)
  }
  const current = chain.retestSessionId && root.records[chain.retestSessionId]
  if (current && current.snapshot.exposure !== 'released_unseen') {
    admitRetest(root, current)
    requireIntegrity(freshAttempt && !current.snapshot.comparisonEligible, 'Resume the existing retest session before requesting another sequence')
  }
  const retained = [...Object.values(root.records).map(r => ({ formId: r.header.formId, exposure: r.snapshot.exposure })), ...Object.values(root.tombstones)]
  const formId = (['RT1', 'RT2', 'RT3'] as FormId[]).find(id => !retained.some(r => r.formId === id && r.exposure !== 'released_unseen'))
  requireIntegrity(formId, 'No unseen retest sequence remains. A previously used sequence cannot complete this chain.')
  const sessionId = crypto.randomUUID(), generation = ++root.generation, token = { id: ownerId, sessionId, generation }
  const rec = chain.recommendation
  const record = createRecord({ version: DURABLE_VERSION, formId, repeat: false, settings: structuredClone(rec.settings), device, created: time,
    retest: { baselineSessionId, baselineFormId: rec.baselineFormId, drillAttemptId: chain.firstCompletedDrillId!, issuedAtMs: time.wallTimeMs, expiresAtMs: time.wallTimeMs + RETEST_RESERVATION_MS },
    identity: { installationId: root.installationId, sessionId, chainId, stage: 'retest', mapping: rec.mapping, ownershipGeneration: generation, exposureGeneration: generation } })
  root.records[sessionId] = record; root.owner = token
  root.training!.chains[chainId] = { ...chain, retestSessionId: sessionId }
  return { record, token }
}
