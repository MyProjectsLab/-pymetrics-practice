import { isVerifiedScoredManifest } from './manifests'
import {
  BALLOONS_CAP, BALLOONS_EVENT_VERSION, BALLOONS_FORM_VERSION, BALLOONS_PAYOUT_CENTS,
  BALLOONS_ROUND_COUNT, BALLOONS_ROUTER_VERSION, BALLOONS_SCORING_VERSION, BALLOONS_SPEC_VERSION,
} from './contracts'
import type {
  ActionSource, ActionTotals, CoreAction, CoreEvent, CoreState, EventTime, Mapping,
  Outcome, Profile, RoundResult, ScoredManifest, SessionIdentity, VisibleType,
} from './contracts'

const visibleTypes: readonly VisibleType[] = ['Type 1', 'Type 2', 'Type 3']
const sources: readonly ActionSource[] = ['keyboard', 'mouse', 'touch_or_pen', 'unknown_or_assistive']
function requireValid(condition: unknown, reason: string): asserts condition {
  if (!condition) throw new Error(`Balloons core: ${reason}`)
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value
}
function validateTime(time: EventTime, prior?: CoreEvent) {
  requireValid(Number.isFinite(time.wallTimeMs) && Number.isFinite(time.monotonicMs) && time.monotonicMs >= 0 && !!time.clockEpochId, 'invalid event time')
  if (prior && time.clockEpochId === prior.clockEpochId) requireValid(time.monotonicMs >= prior.monotonicMs, 'regressing monotonic clock')
}
function visibleType(mapping: Mapping, profile: Profile): VisibleType {
  const found = visibleTypes.find(type => mapping[type] === profile)
  requireValid(found, 'profile missing from visible mapping')
  return found
}
function totals(state: CoreState): ActionTotals {
  return {
    attemptedPumps: state.current.attemptedPumps,
    successfulPumps: state.current.successfulPumps,
    currentCents: state.current.currentCents,
    bankedCents: state.bankedCents,
    lostCents: state.lostCents,
  }
}
function append(state: CoreState, type: CoreEvent['type'], time: EventTime, actionId: number | null, source: ActionSource | null, pre: ActionTotals, post: ActionTotals, outcome: CoreEvent['outcome']): CoreEvent {
  return freeze({
    schemaVersion: BALLOONS_EVENT_VERSION,
    specificationVersion: BALLOONS_SPEC_VERSION,
    formVersion: BALLOONS_FORM_VERSION,
    scoringVersion: BALLOONS_SCORING_VERSION,
    routerVersion: BALLOONS_ROUTER_VERSION,
    installationId: state.identity.installationId,
    sessionId: state.identity.sessionId,
    chainId: state.identity.chainId,
    stage: state.identity.stage,
    manifestId: state.manifest.id,
    manifestSha256: state.manifest.sha256,
    mapping: state.identity.mapping,
    round: state.round,
    sequenceNumber: state.events.length + 1,
    actionId, source, wallTimeMs: time.wallTimeMs, clockEpochId: time.clockEpochId,
    monotonicMs: time.monotonicMs,
    exposureGeneration: state.identity.exposureGeneration,
    ownershipGeneration: state.identity.ownershipGeneration,
    pre, post, type, outcome,
    validityCode: 'headless_unconfirmed',
  } satisfies CoreEvent)
}
function withEvents(state: CoreState, events: readonly CoreEvent[]): CoreState {
  return freeze({ ...state, events: [...state.events, ...events] })
}

/** Initial round presentation is a headless event, not proof of DOM exposure or durability. */
export function startScoredSession(manifest: ScoredManifest, identity: SessionIdentity, time: EventTime): CoreState {
  requireValid(isVerifiedScoredManifest(manifest), 'form must come from verified committed loader')
  requireValid(identity.installationId && identity.sessionId && time.clockEpochId, 'missing identity')
  requireValid(Number.isSafeInteger(identity.exposureGeneration) && identity.exposureGeneration >= 0 && Number.isSafeInteger(identity.ownershipGeneration) && identity.ownershipGeneration >= 0, 'invalid generation')
  requireValid(Object.keys(identity.mapping).length === 3 && visibleTypes.every(type => ['A', 'B', 'C'].includes(identity.mapping[type])) && new Set(Object.values(identity.mapping)).size === 3, 'mapping must be a permutation')
  if (manifest.family !== 'retest') {
    const rotation = Number(manifest.id.at(-1)) - 1
    const expected: readonly Profile[] = ['A', 'B', 'C']
    requireValid(visibleTypes.every((type, index) => identity.mapping[type] === expected[(index + rotation) % 3]), 'BL/RP mapping must follow form number')
  }
  requireValid(identity.stage === (manifest.family === 'baseline' ? 'baseline' : manifest.family === 'retest' ? 'retest' : identity.stage) && (manifest.family !== 'replay' || ['replay', 'mock'].includes(identity.stage)), 'stage/form family mismatch')
  validateTime(time)
  const frozenIdentity = freeze({ ...identity, mapping: { ...identity.mapping } })
  const initial: CoreState = freeze({
    identity: frozenIdentity, manifest, status: 'active', round: 1, revision: 0, nextActionId: 1,
    current: { attemptedPumps: 0, successfulPumps: 0, currentCents: 0 },
    bankedCents: 0, lostCents: 0, results: [], events: [],
  })
  return withEvents(initial, [append(initial, 'round_presented', time, null, null, totals(initial), totals(initial), null)])
}

export type TransitionResult = { readonly accepted: true; readonly state: CoreState } | { readonly accepted: false; readonly reason: 'duplicate_or_out_of_order_action' | 'stale_round_or_revision' | 'wrong_control_or_finished'; readonly state: CoreState }
/** Pure transition. The adapter allocates action IDs and commits the returned journal/state atomically before showing it. */
export function transition(state: CoreState, action: CoreAction): TransitionResult {
  if (!Number.isSafeInteger(action.actionId) || action.actionId !== state.nextActionId) return { accepted: false, reason: 'duplicate_or_out_of_order_action', state }
  if (action.expectedRound !== state.round || action.expectedRevision !== state.revision) return { accepted: false, reason: 'stale_round_or_revision', state }
  if (state.status === 'completed' || (state.status === 'resolved') !== (action.kind === 'next')) return { accepted: false, reason: 'wrong_control_or_finished', state }
  requireValid(sources.includes(action.source), 'invalid action source')
  validateTime(action.time, state.events.at(-1))
  const pre = totals(state)
  const base: CoreState = { ...state, revision: state.revision + 1, nextActionId: state.nextActionId + 1 }
  if (action.kind === 'next') {
    requireValid(state.round < BALLOONS_ROUND_COUNT, 'no next round after final resolution')
    const next: CoreState = { ...base, round: state.round + 1, status: 'active', current: { attemptedPumps: 0, successfulPumps: 0, currentCents: 0 } }
    return { accepted: true, state: withEvents(next, [append(next, 'round_presented', action.time, action.actionId, action.source, pre, totals(next), null)]) }
  }
  const threshold = state.manifest.rounds[state.round - 1].threshold
  if (action.kind === 'pump') {
    const attempt = state.current.attemptedPumps + 1
    requireValid(attempt <= BALLOONS_CAP, 'pump attempted past cap')
    if (attempt === threshold) {
      const result = resolvedRound(state, 'burst', attempt, state.current.successfulPumps)
      const next: CoreState = { ...base, status: finalStatus(state), current: { ...state.current, attemptedPumps: attempt, currentCents: 0 }, lostCents: state.lostCents + state.current.currentCents, results: [...state.results, result] }
      return finishAction(next, 'pump_attempted', action, pre, 'burst')
    }
    const successes = state.current.successfulPumps + 1
    const cents = successes * BALLOONS_PAYOUT_CENTS
    if (successes === BALLOONS_CAP) {
      const result = resolvedRound(state, 'cap_collect', attempt, successes)
      const next: CoreState = { ...base, status: finalStatus(state), current: { attemptedPumps: attempt, successfulPumps: successes, currentCents: 0 }, bankedCents: state.bankedCents + cents, results: [...state.results, result] }
      return finishAction(next, 'pump_attempted', action, pre, 'pump_success', 'cap_collected')
    }
    const next: CoreState = { ...base, current: { attemptedPumps: attempt, successfulPumps: successes, currentCents: cents } }
    return { accepted: true, state: withEvents(next, [append(next, 'pump_attempted', action.time, action.actionId, action.source, pre, totals(next), 'pump_success')]) }
  }
  const result = resolvedRound(state, 'voluntary_collect', state.current.attemptedPumps, state.current.successfulPumps)
  const next: CoreState = { ...base, status: finalStatus(state), current: { ...state.current, currentCents: 0 }, bankedCents: state.bankedCents + state.current.currentCents, results: [...state.results, result] }
  return finishAction(next, 'voluntary_collected', action, pre, 'voluntary_collect')
}
function finalStatus(state: CoreState): CoreState['status'] {
  return state.round === BALLOONS_ROUND_COUNT ? 'completed' : 'resolved'
}
function resolvedRound(state: CoreState, outcome: Outcome, attempted: number, successful: number): RoundResult {
  const profile = state.manifest.rounds[state.round - 1].profile
  return freeze({
    round: state.round, profile, visibleType: visibleType(state.identity.mapping, profile),
    attemptedPumps: attempted, successfulPumps: successful,
    voluntaryPoint: outcome === 'voluntary_collect' ? successful : null,
    bankedCents: outcome === 'burst' ? 0 : successful * BALLOONS_PAYOUT_CENTS,
    lostCents: outcome === 'burst' ? successful * BALLOONS_PAYOUT_CENTS : 0,
    outcome, censored: outcome !== 'voluntary_collect',
  })
}
function finishAction(state: CoreState, firstType: CoreEvent['type'], action: CoreAction, pre: ActionTotals, firstOutcome: CoreEvent['outcome'], secondType?: CoreEvent['type']): TransitionResult {
  const post = totals(state)
  let working = state
  const events: CoreEvent[] = []
  const emit = (type: CoreEvent['type'], outcome: CoreEvent['outcome']) => {
    const event = append(working, type, action.time, action.actionId, action.source, pre, post, outcome)
    events.push(event)
    working = { ...working, events: [...state.events, ...events] }
  }
  emit(firstType, firstOutcome)
  if (secondType) emit(secondType, 'cap_collect')
  const outcome = state.results.at(-1)?.outcome ?? null
  emit('round_resolved', outcome)
  if (state.status === 'completed') emit('session_completed', outcome)
  return { accepted: true, state: freeze(working) }
}
