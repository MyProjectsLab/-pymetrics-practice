import { MOUTH_FORM_VERSION, MOUTH_SCORING_VERSION, MOUTH_SPEC_VERSION } from './contracts'
import type { Side } from './contracts'
import { verifyHeadless } from './engine'
import type { Event, State } from './engine'

/** Pure report arithmetic; status is not a browser or persistence claim. */
export type HeadlessStatus = 'complete_headless' | 'invalid_headless' | 'incomplete_headless'
export interface Counts {
  readonly correct: number
  readonly wrong: number
  readonly omitted: number
  readonly denominator: number
  readonly correctPercent: number | null
}
export interface TimeSummary {
  readonly cleanCount: number
  readonly medianMs: number | null
  readonly medianDisplayMs: number | null
  readonly iqrMs: number | null
  readonly iqrDisplayMs: number | null
  readonly reason: 'fewer_than_five' | 'fewer_than_eight' | null
}
export interface Cohort extends Counts { readonly time: TimeSummary }
export interface ResponseTendency {
  readonly left: number
  readonly right: number
  readonly responded: number
  readonly leftPercent: number | null
  readonly rightPercent: number | null
  readonly correctSideLeft: 45
  readonly correctSideRight: 45
}
export interface HeadlessMetrics {
  readonly overall: Cohort
  readonly byCategory: Readonly<Record<Side, Cohort>>
  readonly byBlock: readonly Cohort[]
  readonly responseTendency: ResponseTendency
  readonly tooEarlyForTiming: number
}
export interface HeadlessReview {
  readonly status: HeadlessStatus
  readonly validity: 'headless_unconfirmed'
  readonly persistence: 'not_checked'
  readonly specificationVersion: typeof MOUTH_SPEC_VERSION
  readonly formVersion: typeof MOUTH_FORM_VERSION
  readonly scoringVersion: typeof MOUTH_SCORING_VERSION
  readonly formId: State['form']['id']
  readonly variant: State['profile']['variant']
  readonly profile: State['profile']
  readonly route: State['identity']['route']
  readonly presented: number
  readonly closed: number
  readonly unresolvedPresented: number
  readonly unpresented: number
  readonly invalidReason: State['invalidReason']
  readonly metrics: HeadlessMetrics | null
  readonly bankedCents: number
  readonly rewardsBySet: readonly number[]
  readonly observation: string | null
}
interface Row {
  readonly index: number
  readonly category: Side
  readonly block: number
  readonly outcome: 'correct' | 'wrong' | 'omitted'
  readonly selected: Side | null
  readonly cleanMs: number | null
  readonly tooEarly: boolean
}
function assert(condition: unknown): asserts condition {
  if (!condition) throw Error('Mouth report: unreconciled headless journal')
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value
}
export function roundHalfAway(value: number): number {
  assert(Number.isFinite(value))
  const rounded = Math.sign(value) * Math.floor(Math.abs(value) + 0.5)
  return rounded === 0 ? 0 : rounded
}
function median(sorted: readonly number[]): number {
  assert(sorted.length > 0)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}
export function summarizeTimes(values: readonly number[]): TimeSummary {
  assert(values.every(value => Number.isFinite(value) && value >= 100 && value < 1300))
  const sorted = [...values].sort((a, b) => a - b)
  if (sorted.length < 5) return { cleanCount: sorted.length, medianMs: null,
    medianDisplayMs: null, iqrMs: null, iqrDisplayMs: null, reason: 'fewer_than_five' }
  const rawMedian = median(sorted)
  if (sorted.length < 8) return { cleanCount: sorted.length, medianMs: rawMedian,
    medianDisplayMs: roundHalfAway(rawMedian), iqrMs: null, iqrDisplayMs: null,
    reason: 'fewer_than_eight' }
  const half = Math.floor(sorted.length / 2)
  const iqr = median(sorted.slice(sorted.length - half)) - median(sorted.slice(0, half))
  return { cleanCount: sorted.length, medianMs: rawMedian,
    medianDisplayMs: roundHalfAway(rawMedian), iqrMs: iqr,
    iqrDisplayMs: roundHalfAway(iqr), reason: null }
}
function cohort(rows: readonly Row[]): Cohort {
  const correct = rows.filter(row => row.outcome === 'correct').length
  const wrong = rows.filter(row => row.outcome === 'wrong').length
  const omitted = rows.filter(row => row.outcome === 'omitted').length
  const denominator = rows.length
  return { correct, wrong, omitted, denominator,
    correctPercent: denominator ? Math.round(correct * 1000 / denominator) / 10 : null,
    time: summarizeTimes(rows.flatMap(row => row.cleanMs === null ? [] : [row.cleanMs])) }
}
function one(events: readonly Event[], type: Event['type']): Event | null {
  const found = events.filter(event => event.type === type)
  assert(found.length <= 1)
  return found[0] ?? null
}

/** Reconciles only the known immutable journal prefix. No saved claim is made. */
export function reconcileHeadless(state: State): HeadlessReview {
  assert(verifyHeadless(state))
  const presentedEvents = state.events.filter(event => event.type === 'face_presented')
  const closedEvents = state.events.filter(event => event.type === 'trial_closed')
  const presented = presentedEvents.length
  const closed = closedEvents.length
  assert(presented <= 90 && closed <= presented)
  assert(presentedEvents.every((event, index) => event.trialIndex === index + 1) &&
    closedEvents.every((event, index) => event.trialIndex === index + 1))
  const status: HeadlessStatus = state.phase === 'invalid' ? 'invalid_headless' :
    state.phase === 'completed' ? 'complete_headless' : 'incomplete_headless'
  const partial = { status, validity: 'headless_unconfirmed' as const,
    persistence: 'not_checked' as const, specificationVersion: MOUTH_SPEC_VERSION,
    formVersion: MOUTH_FORM_VERSION, scoringVersion: MOUTH_SCORING_VERSION,
    formId: state.form.id, variant: state.profile.variant, profile: state.profile,
    route: state.identity.route, presented, closed,
    unresolvedPresented: presented - closed, unpresented: 90 - presented,
    invalidReason: state.invalidReason, bankedCents: state.bankedCents, rewardsBySet: [1,2,3].map(block => state.events.filter(e => e.type === 'reward_earned' && e.block === block).length) }
  if (status !== 'complete_headless') return freeze({ ...partial, metrics: null, observation: null })
  assert(presented === 90 && closed === 90 &&
    state.events.filter(event => event.type === 'set_checkpoint').length === 2 &&
    state.events.filter(event => event.type === 'session_completed').length === 1 &&
    state.events.every(event => event.type !== 'invalidated'))
  const rows: Row[] = state.form.trials.map(trial => {
    const events = state.events.filter(event => event.trialIndex === trial.index)
    const onset = one(events, 'face_presented')
    const response = one(events, 'response')
    const omission = one(events, 'omission')
    const offset = one(events, 'feedback_offset')
    const closure = one(events, 'trial_closed')
    assert(onset && offset && closure && (response === null) !== (omission === null))
    const selected = response?.detail.side ?? null
    assert(selected === null || selected === 'short' || selected === 'long')
    const outcome = response === null ? 'omitted' :
      selected === trial.mouth ? 'correct' : 'wrong'
    const rt = response ? response.atMs - onset.atMs : null
    const tooEarly = outcome === 'correct' && rt !== null && rt < 100
    const cleanMs = outcome === 'correct' && rt !== null &&
      rt >= 100 && rt < 1300 && closure.detail.timingNoted === false ? rt : null
    return { index: trial.index, category: trial.mouth, block: trial.block,
      outcome, selected, cleanMs, tooEarly }
  })
  const overall = cohort(rows)
  assert(overall.denominator === 90 && overall.correct + overall.wrong + overall.omitted === 90)
  const byCategory = Object.fromEntries((['short', 'long'] as const)
    .map(category => [category, cohort(rows.filter(row => row.category === category))])) as Record<Side, Cohort>
  const byBlock = [1, 2, 3].map(block => cohort(rows.filter(row => row.block === block)))
  assert(Object.values(byCategory).every(value => value.denominator === 45) &&
    byBlock.every(value => value.denominator === 30))
  const left = rows.filter(row => row.selected === 'short').length
  const right = rows.filter(row => row.selected === 'long').length
  const responded = left + right
  assert(responded === overall.correct + overall.wrong)
  const responseTendency: ResponseTendency = { left, right, responded,
    leftPercent: responded ? Math.round(left * 1000 / responded) / 10 : null,
    rightPercent: responded ? Math.round(right * 1000 / responded) / 10 : null,
    correctSideLeft: 45, correctSideRight: 45 }
  assert(state.events.filter(e => e.type === 'reward_earned').length * 50 === state.bankedCents && state.bankedCents <= 800)
  const metrics: HeadlessMetrics = { overall, byCategory, byBlock, responseTendency,
    tooEarlyForTiming: rows.filter(row => row.tooEarly).length }
  const observation = overall.omitted >= 9 ? `In this run, ${overall.omitted} of 90 trials were omitted.` : overall.wrong >= 9 ? `In this run, ${overall.wrong} of 90 choices were wrong.` : `In this run, ${overall.correct} of 90 choices were correct.`
  return freeze({ ...partial, metrics, observation })
}
