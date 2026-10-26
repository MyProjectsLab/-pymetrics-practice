import type { StopLocalStore, StopLocalState, RetiredChainSource } from './storage'
import type { StopResult } from './run'
import type { Counts } from './scoring'
import { round } from './scoring'
import type { DrillId } from './drills'
import { DeletedChainError, InstallationClearedError, chainDeleted, recordLocalActivity, stopLocalStore } from './storage'

export const STOP_ROUTER_VERSION = 'stop_drill_router_v2' as const
export const STOP_V13_ROUTER_VERSION = 'stop_drill_router_v3' as const
export type StopRouterVersion = 'stop_drill_router_v1' | typeof STOP_ROUTER_VERSION | typeof STOP_V13_ROUTER_VERSION
export const STOP_CHAIN_VERSION = 'stop_training_chain_v1' as const
export const TEMPORARY_DISCLOSURE = 'This practice is temporary in this tab. Refreshing, closing, or leaving clears these results. Earlier practice in another tab or visit may not be known here.'
export const RETEST_EXPLANATION = 'This retest uses the same rules and timing. No earlier scored start of the selected sequence is recorded in this tab since this page loaded. We cannot check earlier visits or other tabs. Sequence differences and ordinary variation can affect the result, so the comparison does not prove that the drill caused a change.'
export const COMPARISON_EXPOSURE = 'Before this retest began, the records retained in this tab contained no earlier scored start of its sequence. These records do not cover earlier visits or other tabs.'
export const RETEST_EXHAUSTION = 'No eligible retest sequence remains in the records retained by this tab. You can still practise another sequence, but it cannot be labeled a retest from this chain.'
export const PERSISTENT_DISCLOSURE = 'Practice results are saved in this browser. Clearing site data can remove them. This browser cannot know about earlier practice on other devices or after data was cleared.'
export const CHAIN_SAVE_FAILURE = 'Your task data were recorded in this tab but could not be saved in this browser. Keep this tab open to review the result or continue the current training chain.'
export const storageDisclosure = () => chainSaveStatus === 'failed' ? CHAIN_SAVE_FAILURE : chainSaveStatus === 'pending' ?
  'Training changes are retained in this tab while saving. Keep this tab open until saving finishes.' : stopLocalStore() ? PERSISTENT_DISCLOSURE : TEMPORARY_DISCLOSURE
export const retestExplanation = () => stopLocalStore() ?
  'This retest uses the same rules and timing. No earlier scored start of the selected sequence is recorded in this browser’s saved TraitGame data. Cleared data or other browsers cannot be checked. Sequence differences and ordinary variation can affect the result, so the comparison does not prove that the drill caused a change.' : RETEST_EXPLANATION
export const comparisonExposure = () => stopLocalStore() ?
  'Before this retest began, the TraitGame records saved in this browser contained no earlier scored start of its sequence. Cleared data and other browsers are outside these records.' : COMPARISON_EXPOSURE
export const retestExhaustion = () => stopLocalStore() ?
  'No eligible retest sequence remains in the TraitGame records saved in this browser. You can still practise, but another result cannot be labeled a retest from this chain.' : RETEST_EXHAUSTION

export interface RouteCandidate {
  readonly id: DrillId
  readonly eligible: boolean
  readonly triggered: boolean
  readonly severity: number | null
  readonly metrics: Readonly<Record<string, number>>
  readonly exclusion: string | null
}
export interface Recommendation {
  readonly version: StopRouterVersion
  readonly drillId: DrillId
  readonly severity: number
  readonly candidates: readonly RouteCandidate[]
  readonly tieBreak: boolean
  readonly observed: string
  readonly possibleAdvantage: string
  readonly possibleTradeoff: string
  readonly exclusionDisclosure: string | null
}
const priority: readonly DrillId[] = ['withholding', 'detection', 'consistency', 'stability', 'maintenance']
const pct = (value: number) => round(value * 100)
const rate = (c: Counts, kind: 'hit' | 'falseAlarm' | 'overall') => kind === 'hit'
  ? c.hits / (c.hits + c.misses) : kind === 'falseAlarm'
    ? c.falseAlarms / (c.falseAlarms + c.withholds) : (c.hits + c.withholds) / (c.hits + c.misses + c.withholds + c.falseAlarms)
const candidate = (id: DrillId, eligible: boolean, triggered: boolean, severity: number | null, metrics: Record<string, number>, exclusion: string | null = null): RouteCandidate =>
  Object.freeze({ id, eligible, triggered, severity, metrics: Object.freeze(metrics), exclusion })

export function routeStop(baseline: StopResult, version: StopRouterVersion = baseline.specificationVersion === '1.3' ? STOP_V13_ROUTER_VERSION : STOP_ROUTER_VERSION): Recommendation {
  if (version === STOP_V13_ROUTER_VERSION) return routeStopV13(baseline)
  if (version !== 'stop_drill_router_v1' && version !== STOP_ROUTER_VERSION) throw new Error('Unsupported router version')
  if (baseline.specificationVersion === '1.3') throw new Error('Router and baseline versions differ')
  if (baseline.mode !== 'baseline' || !['valid', 'valid_with_note'].includes(baseline.validity) ||
    baseline.summarySnapshot.counts.hits + baseline.summarySnapshot.counts.misses !== 60 ||
    baseline.summarySnapshot.counts.withholds + baseline.summarySnapshot.counts.falseAlarms !== 20) throw new Error('A valid baseline-family result is required')
  const s = baseline.summarySnapshot, [first, second] = s.halves
  const falseRate = s.rates.falseAlarm, missRate = s.rates.miss
  const accuracyDrop = rate(first, 'overall') - rate(second, 'overall')
  const hitDrop = rate(first, 'hit') - rate(second, 'hit')
  const falseRise = rate(second, 'falseAlarm') - rate(first, 'falseAlarm')
  const falseCountRise = second.falseAlarms - first.falseAlarms
  const overallEnough = [first, second].every(c => c.hits + c.misses + c.withholds + c.falseAlarms >= 32 && c.hits + c.misses > 0 && c.withholds + c.falseAlarms > 0)
  const hitEnough = [first, second].every(c => c.hits + c.misses >= 24)
  const falseEnough = [first, second].every(c => c.falseAlarms + c.withholds >= 8)
  const consistencySeverities = [overallEnough ? Math.max(0, accuracyDrop) / .1 : 0,
    hitEnough ? Math.max(0, hitDrop) / .1 : 0,
    falseEnough && falseCountRise >= 2 ? Math.max(0, falseRise) / .2 : 0]
  const consistencySeverity = Math.max(...consistencySeverities)
  const timingNote = baseline.validity === 'valid_with_note' || baseline.events.some(e => e.type === 'quality_note' && e.payload.ruleId === 'stop_validity_v1.one_timing_anomaly')
  const timingExclusion = timingNote ? 'Response-stability routing was excluded because this baseline has a timing note. Its timing evidence did not support the selected exercise.' : null
  const stabilityEligible = !timingNote && s.timing.count >= 40 && s.timing.iqr !== null && s.rates.hit >= .9 && falseRate < .2
  const targeted: RouteCandidate[] = [
    candidate('withholding', true, falseRate >= .2, falseRate / .2, { falseAlarmRate: falseRate, falseAlarms: s.counts.falseAlarms }),
    candidate('detection', falseRate < .2, missRate >= .1 && falseRate < .2, falseRate < .2 ? missRate / .1 : null, { missRate, misses: s.counts.misses, falseAlarmRate: falseRate }, falseRate >= .2 ? 'False-alarm rate is at least 20%.' : null),
    candidate('consistency', overallEnough || hitEnough || falseEnough, consistencySeverity >= 1 - 1e-9, consistencySeverity || 0,
      { accuracyDrop, hitDrop, falseAlarmRise: falseRise, falseAlarmCountRise: falseCountRise, firstHits: first.hits, secondHits: second.hits, firstFalseAlarms: first.falseAlarms, secondFalseAlarms: second.falseAlarms },
      overallEnough || hitEnough || falseEnough ? null : 'Half-session denominators were insufficient.'),
    candidate('stability', stabilityEligible, stabilityEligible && s.timing.iqr! >= 150,
      stabilityEligible ? s.timing.iqr! / 150 : null, { timingCleanHits: s.timing.count, iqrMs: s.timing.iqr ?? 0, hitRate: s.rates.hit, falseAlarmRate: falseRate },
      timingExclusion ?? (!stabilityEligible ? 'Timing or accuracy eligibility was insufficient.' : null)),
  ]
  const available = targeted.filter(value => value.eligible && value.triggered && value.severity !== null)
  const maximum = Math.max(0, ...available.map(value => value.severity!))
  // Preserve v1 only for reproducing historical snapshots. New decisions compare
  // the actual recorded severities directly, including adjacent IEEE-754 values.
  const ties = available.filter(value => (version === 'stop_drill_router_v1'
    ? Number((maximum - value.severity!).toFixed(15)) : maximum - value.severity!) < .001)
  const selected = ties.length ? priority.find(id => ties.some(value => value.id === id))! : 'maintenance'
  const severity = selected === 'maintenance' ? 1 : targeted.find(value => value.id === selected)!.severity!
  const candidates = Object.freeze([...targeted, candidate('maintenance', true, selected === 'maintenance', 1, {})])
  const observed = selected === 'withholding' ? `${s.counts.falseAlarms} of 20 NO-GO trials were false alarms (${pct(falseRate)}%).` :
    selected === 'detection' ? `${s.counts.misses} of 60 GO trials were missed (${pct(missRate)}%); ${s.counts.falseAlarms} of 20 NO-GO trials were false alarms (${pct(falseRate)}%).` :
      selected === 'consistency' ? `From trials 1–40 to trials 41–80, GO hits changed from ${first.hits} to ${second.hits} of 30, and false alarms from ${first.falseAlarms} to ${second.falseAlarms} of 10. Overall accuracy changed from ${pct(rate(first, 'overall'))}% to ${pct(rate(second, 'overall'))}%.` :
        selected === 'stability' ? `The correct-GO response-time IQR was ${round(s.timing.iqr!)} ms across ${s.timing.count} timing-clean hits; GO hit rate was ${pct(s.rates.hit)}% and false-alarm rate ${pct(falseRate)}%.` :
          'No targeted threshold was reached. Use a mixed exercise to maintain the rule under a new sequence.'
  const descriptions: Record<DrillId, readonly [string, string]> = {
    withholding: ['GO responses were frequent on this task.', 'Some NO-GO responses were not withheld.'],
    detection: ['Withholding on NO-GO was maintained on this task.', 'Some GO responses were missed.'],
    consistency: ['Some responses followed the rule in both halves.', 'Accuracy was lower in the second half on at least one supported measure.'],
    stability: ['GO accuracy was high on this task.', 'Correct-GO response timing varied.'],
    maintenance: ['No targeted threshold was reached on this task.', 'A new sequence can still expose ordinary variation.'],
  }
  return Object.freeze({ version, drillId: selected, severity, candidates,
    tieBreak: ties.length > 1, observed, possibleAdvantage: descriptions[selected][0], possibleTradeoff: descriptions[selected][1],
    exclusionDisclosure: timingExclusion })
}

function routeStopV13(baseline: StopResult): Recommendation {
  if (baseline.specificationVersion !== '1.3' || baseline.mode !== 'baseline' ||
    !['valid', 'valid_with_note'].includes(baseline.validity)) throw new Error('A valid V1.3 baseline is required')
  const s = baseline.summarySnapshot, [first, second] = s.halves
  const go = s.counts.hits + s.counts.misses, noGo = s.counts.withholds + s.counts.falseAlarms
  if (go + noGo !== 80 || go !== baseline.form.sequence.filter(value => value === 'GO').length || noGo !== 80 - go)
    throw new Error('Baseline outcomes do not reconcile')
  const falseRate = s.rates.falseAlarm, missRate = s.rates.miss
  const halfGo = [first, second].every(c => c.hits + c.misses >= 12)
  const halfNoGo = [first, second].every(c => c.withholds + c.falseAlarms >= 14)
  const hitDrop = halfGo ? rate(first, 'hit') - rate(second, 'hit') : 0
  const falseRise = halfNoGo ? rate(second, 'falseAlarm') - rate(first, 'falseAlarm') : 0
  const falseCountRise = second.falseAlarms - first.falseAlarms
  const consistencySeverity = Math.max(halfGo ? Math.max(0, hitDrop) / .1 : 0,
    halfNoGo && falseCountRise >= 2 ? Math.max(0, falseRise) / .2 : 0)
  const timingNote = baseline.validity === 'valid_with_note' || baseline.events.some(e => e.type === 'quality_note' && e.payload.ruleId === 'stop_validity_v1.one_timing_anomaly')
  const timingExclusion = timingNote ? 'Response-stability routing was excluded because this baseline has a timing note. Its timing evidence did not support the selected exercise.' : null
  const categoryEvidence = go >= 24 && noGo >= 28
  const stabilityEligible = !timingNote && categoryEvidence && s.timing.count >= 20 && s.timing.iqr !== null && s.rates.hit >= .9 && falseRate < .2
  const targeted: RouteCandidate[] = [
    candidate('withholding', noGo >= 28, noGo >= 28 && falseRate >= .2, noGo >= 28 ? falseRate / .2 : null,
      { noGo, falseAlarms: s.counts.falseAlarms, falseAlarmRate: falseRate }, noGo >= 28 ? null : 'Too few NO-GO outcomes.'),
    candidate('detection', categoryEvidence && falseRate < .2, categoryEvidence && missRate >= .1 && falseRate < .2,
      categoryEvidence && falseRate < .2 ? missRate / .1 : null, { go, noGo, misses: s.counts.misses, missRate, falseAlarmRate: falseRate },
      !categoryEvidence ? 'Too few category outcomes.' : falseRate >= .2 ? 'False-alarm rate is at least 20%.' : null),
    candidate('consistency', halfGo || halfNoGo, consistencySeverity >= 1 - 1e-9, consistencySeverity,
      { hitDrop, falseAlarmRise: falseRise, falseAlarmCountRise: falseCountRise, firstHits: first.hits, secondHits: second.hits,
        firstFalseAlarms: first.falseAlarms, secondFalseAlarms: second.falseAlarms },
      halfGo || halfNoGo ? null : 'Half-session category evidence was insufficient.'),
    candidate('stability', stabilityEligible, stabilityEligible && s.timing.iqr! >= 150,
      stabilityEligible ? s.timing.iqr! / 150 : null,
      { timingCleanHits: s.timing.count, iqrMs: s.timing.iqr ?? 0, hitRate: s.rates.hit, falseAlarmRate: falseRate },
      timingExclusion ?? (stabilityEligible ? null : 'Timing or accuracy eligibility was insufficient.')),
  ]
  if (!targeted.some(value => value.eligible)) throw new Error('Insufficient evidence for targeted routing; offer ordinary replay')
  const available = targeted.filter(value => value.eligible && value.triggered && value.severity !== null)
  const maximum = Math.max(0, ...available.map(value => value.severity!))
  const ties = available.filter(value => maximum - value.severity! < .001)
  const selected = ties.length ? priority.find(id => ties.some(value => value.id === id))! : 'maintenance'
  const descriptions: Record<DrillId, readonly [string, string]> = {
    withholding: ['GO responses were frequent on this task.', 'Some NO-GO responses were not withheld.'],
    detection: ['Withholding on NO-GO was maintained on this task.', 'Some GO responses were missed.'],
    consistency: ['Some responses followed the rule in both halves.', 'A supported category rate was lower in the second half.'],
    stability: ['GO accuracy was high on this task.', 'Correct-GO response timing varied.'],
    maintenance: ['No targeted threshold was reached on this task.', 'A new sequence can still expose ordinary variation.'],
  }
  const supportedHalfTiming = s.halfTiming && s.halfTiming.every(value => value.count >= 8 && value.median !== null)
  const observed = selected === 'withholding' ? `${s.counts.falseAlarms} of ${noGo} NO-GO trials were false alarms (${pct(falseRate)}%).` :
    selected === 'detection' ? `${s.counts.misses} of ${go} GO trials were missed (${pct(missRate)}%); ${s.counts.falseAlarms} of ${noGo} NO-GO trials were false alarms (${pct(falseRate)}%).` :
      selected === 'consistency' ? `GO hits were ${first.hits} of ${first.hits + first.misses} then ${second.hits} of ${second.hits + second.misses}; false alarms were ${first.falseAlarms} of ${first.falseAlarms + first.withholds} then ${second.falseAlarms} of ${second.falseAlarms + second.withholds}.${supportedHalfTiming ? ` Median timing-clean correct-GO response time was ${round(s.halfTiming![0].median!)} ms then ${round(s.halfTiming![1].median!)} ms.` : ''}` :
        selected === 'stability' ? `Correct-GO response-time IQR was ${round(s.timing.iqr!)} ms across ${s.timing.count} timing-clean hits.` :
          'No targeted threshold was reached. Use a mixed exercise to maintain the rule under a new sequence.'
  return Object.freeze({ version: STOP_V13_ROUTER_VERSION, drillId: selected,
    severity: selected === 'maintenance' ? 1 : targeted.find(value => value.id === selected)!.severity!,
    candidates: Object.freeze([...targeted, candidate('maintenance', true, selected === 'maintenance', 1, {})]),
    tieBreak: ties.length > 1, observed, possibleAdvantage: descriptions[selected][0], possibleTradeoff: descriptions[selected][1],
    exclusionDisclosure: timingExclusion })
}

export interface TrainingChain {
  readonly schemaVersion: typeof STOP_CHAIN_VERSION
  readonly id: string
  readonly baseline: StopResult
  readonly recommendation: Recommendation
  readonly drillAttempts: readonly DrillAttempt[]
  readonly retestAttempts: readonly { readonly sessionId: string; readonly formId: string; readonly valid: boolean }[]
  readonly retest: StopResult | null
  readonly status: 'assigned' | 'drilling' | 'drill_complete' | 'retesting' | 'complete'
}
export interface DrillAttempt {
  readonly id: string
  readonly drillId: DrillId
  readonly manifestChecksum: string
  readonly version: '1'
  readonly startedAtWall: string
  readonly completedAtWall: string
  readonly valid: boolean
  readonly completedBlocks: number
  readonly events: readonly import('./engine/contracts').EngineEvent[]
}
let activeChain: TrainingChain | null = null
// Write fallback must not turn a previously persisted chain into an independent
// temporary chain. Keep its original authority even after the writer is removed.
type ChainAuthority = { store: StopLocalStore; installationId: string | null; drills: Map<string, DrillAttempt> }
let chainAuthority: ChainAuthority | null = null
function captureAuthority(chain: TrainingChain, restored = false) {
  const store = stopLocalStore()
  chainAuthority = store ? { store, installationId: store.installationIdentity?.() ?? null,
    drills: new Map(restored ? chain.drillAttempts.map(a => [a.id, a]) : []) } : null
}
// Completion ownership is independent of the asynchronous save queue. A valid
// journal consumes this chain's retest slot before any storage delivery arrives.
type RetestCompletion = Readonly<{ chainId: string; sessionId: string; generation: number }>
let completionGeneration = 0
let completionOwner: RetestCompletion | null = null
let completionPending = false
export const pendingRetestCompletion = (chainId?: string) => completionPending && completionOwner?.chainId === (chainId ?? activeChain?.id)
export function beginRetestCompletion(chainId: string, sessionId: string): RetestCompletion {
  const owner = Object.freeze({ chainId, sessionId, generation: ++completionGeneration })
  completionOwner = owner; completionPending = false
  return owner
}
export function ownsRetestCompletion(owner: RetestCompletion) {
  return completionOwner === owner && owner.generation === completionGeneration && activeChain?.id === owner.chainId &&
    (!activeChain.retest || activeChain.retest.sessionId === owner.sessionId)
}
export function retainRetestCompletion(owner: RetestCompletion, result: StopResult) {
  if (!ownsRetestCompletion(owner)) return
  completionPending = true
  activeChain = Object.freeze({ ...activeChain!, retestAttempts: Object.freeze([
    ...activeChain!.retestAttempts.filter(a => a.sessionId !== result.sessionId),
    { sessionId: result.sessionId, formId: result.form.id, valid: true },
  ]) })
  for (const listener of saveListeners) listener()
}
export function finishRetestCompletion(owner: RetestCompletion) {
  if (completionOwner !== owner) return
  completionPending = false
  for (const listener of saveListeners) listener()
}
export function reconcileStoredCompletion(stored: TrainingChain, preserveCurrent = false) {
  if (!activeChain || activeChain.id !== stored.id || !stored.retest) return
  activeChain = Object.freeze({ ...activeChain, retest: preserveCurrent && activeChain.retest ? activeChain.retest : stored.retest, status: 'complete',
    drillAttempts: Object.freeze([...new Map([...stored.drillAttempts, ...activeChain.drillAttempts].map(a => [a.id, a])).values()]),
    retestAttempts: Object.freeze([...new Map([...stored.retestAttempts, ...activeChain.retestAttempts].map(a => [a.sessionId, a])).values()]),
  })
  for (const listener of saveListeners) listener()
}
const retiredInTab = new Map<string, RetiredChainSource>()
export const currentTrainingChain = () => activeChain
export const canRetainTrainingAttempt = (id: string) => activeChain?.id === id || retiredInTab.has(id)
type ChainActivity = Parameters<typeof recordLocalActivity>[0]
type PendingChain = { chain: TrainingChain; event?: ChainActivity; retired?: false } | { chain: RetiredChainSource; retired: true; event?: undefined }
let pendingChains: PendingChain[] = []
let saving = false
let generation = 0
let chainSaveStatus: 'saved' | 'pending' | 'failed' | 'temporary' = 'saved'
const saveListeners = new Set<() => void>()
export const trainingSaveStatus = () => chainSaveStatus
export const subscribeTrainingSave = (listener: () => void) => { saveListeners.add(listener); return () => { saveListeners.delete(listener) } }
function saveStatus(status: typeof chainSaveStatus) { chainSaveStatus = status; for (const listener of saveListeners) listener() }
export function restoreTrainingChain(chain: TrainingChain | null, deletedAll = false) {
  if (!deletedAll && pendingRetestCompletion(chain?.id) && chain?.id === activeChain?.id) return
  if (deletedAll || chain?.id !== activeChain?.id) { completionOwner = null; completionPending = false; completionGeneration++ }
  if (deletedAll) retiredInTab.clear()
  if (!chain) chainAuthority = null
  else if (deletedAll || chain.id !== activeChain?.id) captureAuthority(chain, true)
  activeChain = chain; pendingChains = []; generation++; saving = false; saveStatus('saved')
}
function references(chain: RetiredChainSource, sessionId: string) {
  return chain.baseline.sessionId === sessionId || chain.retest?.sessionId === sessionId ||
    chain.drillAttempts.some(a => a.id === sessionId) || chain.retestAttempts.some(a => a.sessionId === sessionId)
}
function reviewOnly(chain: RetiredChainSource): RetiredChainSource {
  return { id: chain.id, status: chain.status, baseline: { sessionId: chain.baseline.sessionId },
    retest: chain.retest ? { sessionId: chain.retest.sessionId } : null,
    recommendation: { drillId: chain.recommendation.drillId }, drillAttempts: chain.drillAttempts, retestAttempts: chain.retestAttempts }
}
/** Retired work remains reviewable until its separate history write commits. */
export const retainedTrainingAttempts = () => [...new Map(pendingChains.filter(p => p.retired)
  .flatMap(p => p.chain.drillAttempts).map(a => [a.id, a])).values()]
export function reconcileTrainingDeletion(state: StopLocalState, sessionId?: string) {
  const retired = (chain: RetiredChainSource) => chainDeleted(state, chain) || !!sessionId && references(chain, sessionId)
  if (!pendingChains.some(item => retired(item.chain)) && !(activeChain && retired(activeChain))) return
  for (const chain of [...pendingChains.map(p => p.chain), ...(activeChain ? [activeChain] : [])]) {
    if (retired(chain)) retiredInTab.set(chain.id, { ...reviewOnly(chain), drillAttempts: [] })
  }
  pendingChains = pendingChains.flatMap((item): PendingChain[] => {
    if (!retired(item.chain)) return [item]
    const attempts = item.chain.drillAttempts.filter(a => a.id !== sessionId && !state.deletedSessions?.[a.id])
    const durable = state.retiredChains[item.chain.id]?.drillAttempts ?? []
    if (attempts.every(a => durable.some(saved => saved.id === a.id && JSON.stringify(saved) === JSON.stringify(a)))) return []
    return [{ chain: { ...reviewOnly(item.chain), drillAttempts: attempts }, retired: true }]
  })
  if (activeChain && retired(activeChain)) {
    activeChain = null; chainAuthority = null; completionOwner = null; completionPending = false; completionGeneration++
  }
  generation++; saving = false
  const wasFailed = chainSaveStatus === 'failed'
  saveStatus(pendingChains.length ? wasFailed ? 'failed' : 'pending' : 'saved')
  if (pendingChains.length && !wasFailed) void retryTrainingSave()
}
export async function checkTrainingChain(chain: TrainingChain): Promise<boolean> {
  if (activeChain !== chain) return false
  const authority = chainAuthority
  if (!authority) return chain.baseline.storageMode !== 'persistent_local'
  const { store, installationId } = authority
  if (!installationId) return false
  try {
    // Read only: eligibility must still work when writes fail. The revision
    // fences a deletion committed while an older read's delivery was delayed.
    const revision = await store.deletionRevision()
    const state = await store.read()
    const latestRevision = await store.deletionRevision()
    if (activeChain !== chain || chainAuthority !== authority) return false
    if (state.installationId !== installationId || !store.sameInstallation(state)) {
      restoreTrainingChain(null, true); return false
    }
    if (revision !== latestRevision) return false
    if (chainDeleted(state, chain)) { reconcileTrainingDeletion(state); return false }
    if (!store.chainAvailable(chain) || JSON.stringify(state.results[chain.baseline.sessionId]) !==
      JSON.stringify({ ...chain.baseline, storageMode: 'persistent_local' })) return false
    const savedDrills = state.chains[chain.id]?.drillAttempts ?? []
    for (const [id, attempt] of authority.drills) {
      if (!savedDrills.some(saved => saved.id === id && JSON.stringify(saved) === JSON.stringify(attempt))) return false
    }
    for (const attempt of chain.drillAttempts) {
      if (savedDrills.some(saved => saved.id === attempt.id && JSON.stringify(saved) === JSON.stringify(attempt))) authority.drills.set(attempt.id, attempt)
    }
    return true
  } catch { return false }
}
export async function deleteTrainingResult(store: StopLocalStore, sessionId: string) {
  await store.deleteResult(sessionId, [...pendingChains.filter((item): item is Extract<PendingChain, { retired?: false }> => !item.retired).map(item => item.chain), ...(activeChain ? [activeChain] : [])])
  reconcileTrainingDeletion(await store.read(), sessionId)
}
/** Serial writes preserve transition order; never awaited by trial resolution. */
export async function retryTrainingSave() {
  const store = stopLocalStore()
  if (saving || !pendingChains.length || !store) return
  saving = true
  const currentGeneration = generation
  saveStatus('pending')
  try {
    while (pendingChains.length && currentGeneration === generation) {
      const item = pendingChains[0]
      let saved = false
      for (let attempt = 0; attempt < 2; attempt++) {
        if (currentGeneration !== generation) return
        try {
          if (item.retired) await store.saveRetiredChain(item.chain)
          else await store.saveChain(item.chain, item.event)
          saved = true; break
        }
        catch (error) {
          if (currentGeneration !== generation) return
          if (error instanceof InstallationClearedError) { restoreTrainingChain(null, true); return }
          if (error instanceof DeletedChainError) {
            // Convert the entire affected queue, not just the rejected snapshot.
            // Missing error state is supported for typed adapters with no journals.
            const state = error.state ?? { retiredChains: { [item.chain.id]: { drillAttempts: [] } } } as unknown as StopLocalState
            reconcileTrainingDeletion(state)
            if (pendingChains.length) void retryTrainingSave()
            return
          }
          // One automatic retry for a transient failure, never for a deletion.
        }
      }
      if (currentGeneration !== generation) return
      if (!pendingChains.includes(item)) continue
      if (!saved) {
        saveStatus('failed')
        for (const pending of pendingChains) if (pending.event) void recordLocalActivity(pending.event)
        void recordLocalActivity({ key: `${item.chain.id}:storage_failure:${item.event?.key ?? item.chain.status}:${item.chain.drillAttempts.length}`,
          sessionId: item.event?.sessionId ?? item.chain.baseline.sessionId, chainId: item.chain.id,
          type: 'storage_failure', payload: { errorClass: 'training_chain_write', storageMode: 'temporary_memory' } })
        return
      }
      pendingChains.shift()
    }
    if (currentGeneration === generation) saveStatus('saved')
  } finally { if (currentGeneration === generation) saving = false }
}
function persistChain(chain: TrainingChain, type?: 'drill_recommended' | 'drill_started' | 'drill_completed' | 'retest_completed', sessionId?: string) {
  const event = type ? { key: `${chain.id}:${type}:${sessionId ?? chain.baseline.sessionId}`, sessionId: sessionId ?? chain.baseline.sessionId,
    chainId: chain.id, type, payload: type.startsWith('drill') ?
      { ruleVersion: chain.recommendation.version, drillId: chain.recommendation.drillId,
        reasonMetrics: chain.recommendation.candidates.find(item => item.id === chain.recommendation.drillId)?.metrics ?? {} } :
      { formId: chain.retest?.form.id ?? '', chainId: chain.id, status: chain.status } } : undefined
  if (stopLocalStore()) {
    pendingChains.push({ chain, event })
    // A failed queue remains available for explicit retry, including later transitions.
    if (chainSaveStatus !== 'failed') void retryTrainingSave()
    else if (event) void recordLocalActivity(event)
  } else {
    saveStatus('temporary')
    if (event) void recordLocalActivity(event)
  }
}
export function recordDrillStarted(chainId: string, attemptId: string) {
  if (!activeChain || activeChain.id !== chainId) throw new Error('Drill start belongs to another chain')
  persistChain(activeChain, 'drill_started', attemptId)
}
export function beginTrainingChain(baseline: StopResult): TrainingChain {
  if (activeChain && activeChain.status !== 'complete') throw new Error('Only one active training chain is permitted')
  if (activeChain?.baseline.sessionId === baseline.sessionId) throw new Error('A completed chain requires a new valid baseline')
  activeChain = newTrainingChain(baseline)
  captureAuthority(activeChain)
  persistChain(activeChain, 'drill_recommended')
  return activeChain
}
function newTrainingChain(baseline: StopResult): TrainingChain {
  return Object.freeze({ schemaVersion: STOP_CHAIN_VERSION, id: crypto.randomUUID(), baseline,
    recommendation: routeStop(baseline), drillAttempts: Object.freeze([]), retestAttempts: Object.freeze([]), retest: null, status: 'assigned' })
}
/** Saved-result continuation publishes a chain only after its first durable
 * write has checked the baseline and competing chains atomically. */
export async function beginSavedTrainingChain(baseline: StopResult, store: StopLocalStore, signal?: AbortSignal): Promise<TrainingChain> {
  if (activeChain && activeChain.status !== 'complete' || pendingChains.length)
    throw new Error('Another training change is still active')
  const prior = activeChain
  const chain = newTrainingChain(baseline)
  await store.createChainFromSavedBaseline(chain, signal)
  signal?.throwIfAborted()
  if (activeChain !== prior) throw new Error('Training state changed while starting')
  restoreTrainingChain(chain)
  return chain
}
export function updateTrainingChain(change: Partial<Pick<TrainingChain, 'status' | 'drillAttempts' | 'retestAttempts' | 'retest'>>): TrainingChain {
  if (!activeChain) throw new Error('No active training chain')
  const previous = activeChain
  activeChain = Object.freeze({ ...activeChain, ...change })
  persistChain(activeChain, change.retest && previous.retest?.sessionId !== change.retest.sessionId ? 'retest_completed' : undefined,
    change.retest?.sessionId)
  return activeChain
}
export function retainDrillAttempt(chainId: string, attempt: DrillAttempt): RetiredChainSource {
  if (!activeChain || activeChain.id !== chainId) {
    const retired = retiredInTab.get(chainId)
    if (!retired) throw new Error('Drill attempt belongs to another chain')
    const updated = { ...retired, drillAttempts: [...retired.drillAttempts.filter(a => a.id !== attempt.id), attempt] }
    pendingChains.push({ chain: updated, retired: true })
    saveStatus('pending'); void retryTrainingSave()
    return updated
  }
  if (activeChain.drillAttempts.some(item => item.id === attempt.id)) return activeChain
  const updated = updateTrainingChain({ drillAttempts: Object.freeze([...activeChain.drillAttempts, attempt]),
    status: attempt.valid ? 'drill_complete' : 'assigned' })
  if (attempt.valid) persistChain(updated, 'drill_completed', attempt.id)
  return updated
}
