import type { ActionSource, EventTime, RoundResult } from './contracts'
import { BALLOONS_CAP, BALLOONS_PAYOUT_CENTS } from './contracts'
import { canonicalJson } from './manifests'
import { DRILL_VERSION, drillId, isDrillManifest, verifiedDrillManifest } from './drill-manifests'
import type { DrillManifest, DrillId } from './drill-manifests'
import { isRecommendation, typeFor } from './router'
import type { Recommendation } from './router'
import { immutable, PROFILES, quartiles, voluntaryPoints } from './training-evidence'

export const DRILL_EVENT_VERSION = 'balloons-drill-event-v1' as const
export type DrillPhase = 'demo' | 'ready' | 'active' | 'resolved' | 'feedback' | 'completed' | 'paused' | 'invalid'
export interface DrillHeader {
  readonly attemptId: string
  readonly recommendation: Recommendation
  readonly manifestId: DrillId
  readonly manifestSha256: string
  readonly familiar: boolean
  readonly priorAttemptIds: readonly string[]
  readonly created: EventTime
}
export interface DrillSnapshot {
  readonly phase: DrillPhase
  readonly resumePhase: DrillPhase | null
  readonly invalidReason: string | null
  readonly demoIndex: number
  readonly round: number
  readonly revision: number
  readonly nextActionId: number
  readonly successfulPumps: number
  readonly attemptedPumps: number
  readonly currentCents: number
  readonly bankedCents: number
  readonly lostCents: number
  readonly results: readonly RoundResult[]
}
export type DrillControl = 'demo_next' | 'start' | 'pump' | 'collect' | 'next' | 'pause' | 'resume' | 'invalidate'
export interface DrillCommand {
  readonly ownershipGeneration?: number
  readonly kind: DrillControl
  readonly actionId: number
  readonly expectedRevision: number
  readonly expectedRound: number
  readonly source: ActionSource
  readonly time: EventTime
  readonly reason?: 'settings_changed' | 'storage_uncertain' | 'integrity_failed' | 'authority_changed'
}
export interface DrillEvent {
  readonly schemaVersion: typeof DRILL_EVENT_VERSION
  readonly formVersion: typeof DRILL_VERSION
  readonly specificationVersion: Recommendation['specificationVersion']
  readonly scoringVersion: Recommendation['scoringVersion']
  readonly routerVersion: Recommendation['routerVersion']
  readonly installationId: string
  readonly sessionId: string
  readonly chainId: string
  readonly stage: 'drill'
  readonly manifestId: DrillId
  readonly manifestSha256: string
  readonly mapping: Recommendation['mapping']
  readonly sequenceNumber: number
  readonly type: 'drill_prepared' | 'drill_started' | 'drill_completed' | 'drill_transition'
  readonly validityCode: 'headless_unconfirmed'
  readonly command: DrillCommand | null
  readonly time: EventTime
  readonly pre: Omit<DrillSnapshot,'results'>
  readonly post: Omit<DrillSnapshot,'results'>
  readonly outcome: RoundResult['outcome'] | 'pump_success' | null
  readonly feedback: DrillFeedback | null
}
export interface DrillAttempt { readonly header: DrillHeader; readonly snapshot: DrillSnapshot; readonly journal: readonly DrillEvent[] }
const trusted = new WeakSet<DrillAttempt>()
function assert(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(`Balloons drill: ${message}`) }
function validTime(time: EventTime, prior?: EventTime) {
  assert(Number.isFinite(time.wallTimeMs) && Number.isFinite(time.monotonicMs) && time.monotonicMs >= 0 && typeof time.clockEpochId === 'string' && time.clockEpochId.length > 0, 'invalid clock')
  assert(!prior || time.clockEpochId !== prior.clockEpochId || time.monotonicMs >= prior.monotonicMs, 'regressing clock')
}
function snapshotFields(s: DrillSnapshot) { const { results: _r, ...fields } = s; void _r; return fields }
function counts(rows: readonly RoundResult[]) {
  return { rounds: rows.length, voluntary: rows.filter(r => r.outcome === 'voluntary_collect').length,
    cap: rows.filter(r => r.outcome === 'cap_collect').length, burst: rows.filter(r => r.outcome === 'burst').length,
    collected: rows.filter(r => r.outcome !== 'burst').length }
}
/** Threshold-free, completed-prefix-only feedback, called solely at 6/12/18. */
function feedback(header: DrillHeader, snapshot: DrillSnapshot) {
  const rows = snapshot.results, completed = rows.length, kind = header.recommendation.kind
  if (![6,12,18].includes(completed)) return null
  const mapping = header.recommendation.mapping
  const byType = PROFILES.map(p => ({ visibleType: typeFor(mapping,p), rows: rows.filter(r => r.profile === p) }))
  if (kind === 'outcome') {
    const transitions = byType.flatMap(({visibleType,rows: same}) => {
      const pairs = same.slice(1).flatMap((r,i) => r.outcome === 'voluntary_collect' ? [{ visibleType, fromRound: same[i].round, fromOutcome: same[i].outcome, nextRound: r.round, nextVoluntaryPoint: r.voluntaryPoint! }] : [])
      return pairs.length ? [pairs.at(-1)!] : []
    })
    return { kind, completed, transitions, message: transitions.length ? null : 'No matched transition yet.', ...(completed === 18 ? { counts: counts(rows) } : {}) }
  }
  if (kind === 'information') return { kind, completed, categories: byType.map(({visibleType,rows: same}) => ({ visibleType, denominator: same.length, collected: counts(same).collected, burst: counts(same).burst })) }
  if (kind === 'updating') return { kind, completed, categories: byType.map(({visibleType,rows: same}) => ({ visibleType, denominator: same.length, voluntary: counts(same).voluntary, cap: counts(same).cap, burst: counts(same).burst })) }
  if (kind === 'consistency') {
    const points = voluntaryPoints(rows), observed = counts(rows)
    return { kind, completed, visibleType: typeFor(mapping,header.recommendation.consistencyProfile!), voluntaryCount: points.length,
      range: points.length >= 2 ? { min: Math.min(...points), max: Math.max(...points), span: Math.max(...points)-Math.min(...points) } : null,
      iqr: points.length >= 2 ? quartiles(points).iqr : null,
      message: points.length < 2 ? `Not enough voluntary collections (${points.length}/2).` : null, burst: observed.burst, cap: observed.cap }
  }
  const observed = counts(rows)
  return { kind, completed, bankedCents: snapshot.bankedCents, lostCents: snapshot.lostCents, collected: observed.collected, burst: observed.burst }
}
export type DrillFeedback = NonNullable<ReturnType<typeof feedback>>
function append(before: DrillAttempt, after: DrillSnapshot, command: DrillCommand | null, time: EventTime, outcome: DrillEvent['outcome'] = null): DrillAttempt {
  const h = before.header, r = h.recommendation
  const e: DrillEvent = { schemaVersion: DRILL_EVENT_VERSION, formVersion: DRILL_VERSION, specificationVersion: r.specificationVersion,
    scoringVersion: r.scoringVersion, routerVersion: r.routerVersion, installationId: r.baseline.installationId, sessionId: h.attemptId,
    chainId: r.chainId, stage: 'drill', manifestId: h.manifestId, manifestSha256: h.manifestSha256, mapping: r.mapping,
    sequenceNumber: before.journal.length+1, type: !command ? 'drill_prepared' : command.kind === 'start' ? 'drill_started' : after.phase === 'completed' ? 'drill_completed' : 'drill_transition',
    validityCode: 'headless_unconfirmed', command, time, pre: snapshotFields(before.snapshot), post: snapshotFields(after), outcome,
    feedback: after.results.length > before.snapshot.results.length ? feedback(h,after) : null }
  const result = immutable({ header: h, snapshot: after, journal: [...before.journal,e] }); trusted.add(result); return result
}
function initial(header: DrillHeader): DrillAttempt {
  const r = header.recommendation, manifest = verifiedDrillManifest(header.manifestId)
  assert(manifest && header.manifestId === drillId(r.kind,r.consistencyProfile) && manifest.sha256 === header.manifestSha256, 'assignment mismatch')
  assert(typeof header.attemptId === 'string' && !!header.attemptId && header.attemptId !== r.baseline.sessionId && !header.priorAttemptIds.includes(header.attemptId) && new Set(header.priorAttemptIds).size === header.priorAttemptIds.length, 'attempt identity')
  assert(header.familiar === (header.priorAttemptIds.length > 0), 'familiarity mismatch')
  validTime(header.created)
  const snapshot: DrillSnapshot = { phase: r.kind === 'outcome' ? 'demo' : 'ready', resumePhase: null, invalidReason: null, demoIndex: 0,
    round: 1, revision: 0, nextActionId: 1, successfulPumps: 0, attemptedPumps: 0, currentCents: 0, bankedCents: 0, lostCents: 0, results: [] }
  return append({ header: immutable(structuredClone(header)), snapshot, journal: [] },snapshot,null,header.created)
}
export function createDrillAttempt(recommendation: Recommendation, manifest: DrillManifest, attemptId: string, priorAttempts: readonly DrillAttempt[], time: EventTime): DrillAttempt {
  assert(isRecommendation(recommendation) && isDrillManifest(manifest), 'verified recommendation and manifest required')
  priorAttempts.forEach(reconcileDrill)
  assert(!priorAttempts.some(a => a.header.attemptId === attemptId), 'attempt ID reused')
  const priorAttemptIds = priorAttempts.filter(a => a.header.recommendation.baseline.installationId === recommendation.baseline.installationId && a.header.manifestId === manifest.id && a.journal.some(e => e.type === 'drill_started')).map(a => a.header.attemptId)
  return initial({ attemptId, recommendation, manifestId: manifest.id, manifestSha256: manifest.sha256, familiar: priorAttemptIds.length > 0, priorAttemptIds, created: time })
}
export function transitionDrill(state: DrillAttempt, command: DrillCommand): { accepted: boolean; state: DrillAttempt } {
  assert(trusted.has(state), 'reconcile imported state before transitions')
  const s = state.snapshot, kind = command.kind
  if (command.actionId !== s.nextActionId || !Number.isSafeInteger(command.actionId) || command.expectedRevision !== s.revision || command.expectedRound !== s.round || ['completed','invalid'].includes(s.phase)) return { accepted:false,state }
  assert(['keyboard','mouse','touch_or_pen','unknown_or_assistive'].includes(command.source), 'source')
  validTime(command.time,state.journal.at(-1)!.time)
  assert(command.ownershipGeneration === undefined || (Number.isSafeInteger(command.ownershipGeneration) && command.ownershipGeneration > 0), 'ownership generation')
  const allowed = kind === 'invalidate' || (kind === 'pause' && s.phase !== 'paused') || (kind === 'resume' && s.phase === 'paused') ||
    (kind === 'demo_next' && s.phase === 'demo') || (kind === 'start' && s.phase === 'ready') ||
    (['pump','collect'].includes(kind) && s.phase === 'active') || (kind === 'next' && ['resolved','feedback'].includes(s.phase))
  if (!allowed) return { accepted:false,state }
  assert(kind === 'invalidate' ? ['settings_changed','storage_uncertain','integrity_failed','authority_changed'].includes(command.reason ?? '') : command.reason === undefined, 'invalidation reason')
  let next: DrillSnapshot = { ...s, revision:s.revision+1, nextActionId:s.nextActionId+1 }
  let outcome: DrillEvent['outcome'] = null
  if (kind === 'pause') next = { ...next, phase:'paused',resumePhase:s.phase }
  else if (kind === 'resume') next = { ...next,phase:s.resumePhase!,resumePhase:null }
  else if (kind === 'invalidate') next = { ...next,phase:'invalid',resumePhase:null,invalidReason:command.reason! }
  else if (kind === 'demo_next') next = { ...next,demoIndex:s.demoIndex+1,phase:s.demoIndex === 1 ? 'ready' : 'demo' }
  else if (kind === 'start') next = { ...next,phase:'active' }
  else if (kind === 'next') next = { ...next,phase:'active',round:s.round+1,successfulPumps:0,attemptedPumps:0,currentCents:0 }
  else {
    const row = verifiedDrillManifest(state.header.manifestId)!.rounds[s.round-1]
    const attempts = s.attemptedPumps + Number(kind === 'pump'), burst = kind === 'pump' && attempts === row.threshold
    const successes = s.successfulPumps + Number(kind === 'pump' && !burst)
    outcome = burst ? 'burst' : kind === 'collect' ? 'voluntary_collect' : successes === BALLOONS_CAP ? 'cap_collect' : 'pump_success'
    next = { ...next,attemptedPumps:attempts,successfulPumps:successes,currentCents:successes*BALLOONS_PAYOUT_CENTS }
    if (outcome !== 'pump_success') {
      const result: RoundResult = { round:s.round,profile:row.profile,visibleType:typeFor(state.header.recommendation.mapping,row.profile), attemptedPumps:attempts,successfulPumps:successes,
        voluntaryPoint:outcome === 'voluntary_collect' ? successes : null, bankedCents:burst ? 0 : successes*5,lostCents:burst ? successes*5 : 0,outcome,censored:outcome !== 'voluntary_collect' }
      next = { ...next,phase:s.round === 18 ? 'completed' : s.round%6 === 0 ? 'feedback' : 'resolved',currentCents:0,
        bankedCents:s.bankedCents+result.bankedCents,lostCents:s.lostCents+result.lostCents,results:[...s.results,result] }
    }
  }
  return { accepted:true,state:append(state,next,command,command.time,outcome) }
}
/** Replay against the verified immutable inventory. This proves internal headless
 * consistency only; no event here asserts browser presentation or a durable save. */
export function reconcileDrill(record: DrillAttempt): DrillAttempt {
  let replay = initial(record.header)
  assert(canonicalJson(record.journal[0]) === canonicalJson(replay.journal[0]), 'preparation mismatch')
  for (const e of record.journal.slice(1)) {
    assert(e.command, 'missing command')
    const result = transitionDrill(replay,e.command)
    assert(result.accepted, 'illegal command sequence'); replay = result.state
    assert(canonicalJson(e) === canonicalJson(replay.journal.at(-1)), 'journal mismatch')
  }
  assert(canonicalJson(record) === canonicalJson(replay), 'snapshot mismatch')
  return replay
}
export function drillFeedback(record: DrillAttempt): DrillFeedback | null {
  const state = reconcileDrill(record)
  return ['feedback','completed'].includes(state.snapshot.phase) ? immutable(feedback(state.header,state.snapshot)) : null
}
/** Demo histories are unscored and contain no hidden thresholds. */
export function drillDemo(record: DrillAttempt) {
  const state = reconcileDrill(record)
  if (state.snapshot.phase !== 'demo') return null
  return immutable(state.snapshot.demoIndex === 0
    ? { demoOnly:true,successfulPumps:3,attemptedPumps:4,outcome:'burst',bankedCents:0,lostCents:15 }
    : { demoOnly:true,successfulPumps:3,attemptedPumps:3,outcome:'voluntary_collect',bankedCents:15,lostCents:0 })
}
