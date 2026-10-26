import { ARROWS_FORM_VERSION, ARROWS_SCORING_VERSION, ARROWS_SPEC_VERSION } from './contracts'
import type { Condition, Rule, Color } from './contracts'
import { verifyHeadless } from './engine'
import type { Event, State } from './engine'

/** A headless calculation is not a browser-valid or saved candidate report. */
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
export interface HeadlessMetrics {
  readonly overall: Cohort
  readonly byColor: Readonly<Record<Color, Cohort>>
  readonly byRule: Readonly<Record<Rule, Cohort>>
  readonly byCondition: Readonly<Record<Condition, Cohort>>
  readonly byCell: Readonly<Record<Rule, Readonly<Record<Condition, Cohort>>>>
  readonly switch: Cohort
  readonly stay: Cohort
  readonly switchMinusStayMs: number | null
  readonly opposedMinusAlignedMs: number | null
  readonly tooEarlyForTiming: number
}
export interface HeadlessReview {
  readonly status: HeadlessStatus
  readonly validity: 'headless_unconfirmed'
  readonly persistence: 'not_checked'
  readonly specificationVersion: typeof ARROWS_SPEC_VERSION
  readonly formVersion: typeof ARROWS_FORM_VERSION
  readonly scoringVersion: typeof ARROWS_SCORING_VERSION
  readonly formId: State['form']['id']
  readonly profile: State['profile']
  readonly presented: number
  readonly closed: number
  readonly unresolvedPresented: number
  readonly unpresented: number
  readonly invalidReason: State['invalidReason']
  readonly metrics: HeadlessMetrics | null
}

interface TrialEvidence {
  readonly index: number
  readonly color: Color
  readonly rule: Rule
  readonly condition: Condition
  readonly outcome: 'correct' | 'wrong' | 'omitted'
  readonly cleanMs: number | null
  readonly tooEarly: boolean
  readonly switched: boolean | null
}

function requireReview(condition: unknown): asserts condition {
  if (!condition) throw Error('Arrows report: unreconciled headless journal')
}

function freezeDeep<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freezeDeep)
    Object.freeze(value)
  }
  return value
}

export function roundHalfAway(value: number): number {
  requireReview(Number.isFinite(value))
  const rounded = Math.sign(value) * Math.floor(Math.abs(value) + 0.5)
  return rounded === 0 ? 0 : rounded
}

function median(sorted: readonly number[]): number {
  requireReview(sorted.length > 0)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

export function summarizeTimes(values: readonly number[]): TimeSummary {
  requireReview(values.every(value => Number.isFinite(value) && value >= 100 && value < 1_500))
  const sorted = [...values].sort((a, b) => a - b)
  if (sorted.length < 5) return { cleanCount: sorted.length, medianMs: null,
    medianDisplayMs: null, iqrMs: null, iqrDisplayMs: null, reason: 'fewer_than_five' }
  const rawMedian = median(sorted)
  if (sorted.length < 8) return { cleanCount: sorted.length, medianMs: rawMedian,
    medianDisplayMs: roundHalfAway(rawMedian), iqrMs: null, iqrDisplayMs: null,
    reason: 'fewer_than_eight' }
  const half = Math.floor(sorted.length / 2)
  const lower = sorted.slice(0, half)
  const upper = sorted.slice(sorted.length - half)
  const iqr = median(upper) - median(lower)
  return { cleanCount: sorted.length, medianMs: rawMedian,
    medianDisplayMs: roundHalfAway(rawMedian), iqrMs: iqr,
    iqrDisplayMs: roundHalfAway(iqr), reason: null }
}

function cohort(rows: readonly TrialEvidence[]): Cohort {
  const correct = rows.filter(row => row.outcome === 'correct').length
  const wrong = rows.filter(row => row.outcome === 'wrong').length
  const omitted = rows.filter(row => row.outcome === 'omitted').length
  const denominator = rows.length
  return { correct, wrong, omitted, denominator,
    correctPercent: denominator ? Math.round(correct * 1_000 / denominator) / 10 : null,
    time: summarizeTimes(rows.flatMap(row => row.cleanMs === null ? [] : [row.cleanMs])) }
}

export function contrastTimes(first: TimeSummary, second: TimeSummary): number | null {
  return first.cleanCount >= 10 && second.cleanCount >= 10 &&
    first.medianMs !== null && second.medianMs !== null ?
      roundHalfAway(first.medianMs - second.medianMs) : null
}

function findOne(events: readonly Event[], type: Event['type']): Event | null {
  const matching = events.filter(event => event.type === type)
  requireReview(matching.length <= 1)
  return matching[0] ?? null
}

/** Replays the complete command journal before deriving any outcome or timing. */
export function reconcileHeadless(state: State): HeadlessReview {
  requireReview(verifyHeadless(state))
  const events = state.events
  const presentedEvents = events.filter(event => event.type === 'stimulus_presented')
  const closedEvents = events.filter(event => event.type === 'trial_closed')
  const presented = presentedEvents.length
  const closed = closedEvents.length
  requireReview(presented <= 135 && closed <= presented)
  requireReview(presentedEvents.every((event, index) => event.trialIndex === index + 1))
  requireReview(closedEvents.every((event, index) => event.trialIndex === index + 1))
  const status: HeadlessStatus = state.phase === 'invalid' ? 'invalid_headless' :
    state.phase === 'completed' ? 'complete_headless' : 'incomplete_headless'
  const base = { status, validity: 'headless_unconfirmed' as const, persistence: 'not_checked' as const,
    specificationVersion: ARROWS_SPEC_VERSION, formVersion: ARROWS_FORM_VERSION,
    scoringVersion: ARROWS_SCORING_VERSION, formId: state.form.id, profile: state.profile,
    presented, closed, unresolvedPresented: presented - closed,
    unpresented: 135 - presented, invalidReason: state.invalidReason }
  if (status !== 'complete_headless') return freezeDeep({ ...base, metrics: null })
  requireReview(presented === 135 && closed === 135 && state.invalidReason === null &&
    findOne(events, 'session_completed') !== null && !events.some(event => event.type === 'invalidated'))
  const rows: TrialEvidence[] = state.form.trials.map((trial, offset) => {
    const index = offset + 1
    const trialEvents = events.filter(event => event.trialIndex === index)
    const onset = findOne(trialEvents, 'stimulus_presented')
    const response = findOne(trialEvents, 'response')
    const omission = findOne(trialEvents, 'omitted')
    requireReview(onset !== null && findOne(trialEvents, 'trial_closed') !== null &&
      Number(response !== null) + Number(omission !== null) === 1)
    const direction = response?.detail.direction
    requireReview(response === null || direction === 'left' || direction === 'right')
    const outcome = response === null ? 'omitted' : direction === trial.direction ? 'correct' : 'wrong'
    const elapsed = response === null ? null : response.atMs - onset.atMs
    requireReview(elapsed === null || elapsed >= 0 && elapsed < 1_500)
    const timingNote = trialEvents.some(event => event.type === 'timing_note')
    const cleanMs = outcome === 'correct' && elapsed !== null && elapsed >= 100 &&
      !timingNote ? elapsed : null
    const prior = offset % 27 === 0 ? null : state.form.trials[offset - 1]
    return { index, color: trial.color, rule: trial.rule, condition: trial.condition, outcome, cleanMs,
      tooEarly: elapsed !== null && elapsed < 100,
      switched: prior === null ? null : prior.rule !== trial.rule }
  })
  const byRule = { middle: cohort(rows.filter(row => row.rule === 'middle')),
    sides: cohort(rows.filter(row => row.rule === 'sides')) }
  const byCondition = { aligned: cohort(rows.filter(row => row.condition === 'aligned')),
    opposed: cohort(rows.filter(row => row.condition === 'opposed')),
    neutral: cohort(rows.filter(row => row.condition === 'neutral')) }
  const byCell = { middle: { aligned: cohort(rows.filter(row => row.rule === 'middle' && row.condition === 'aligned')),
    opposed: cohort(rows.filter(row => row.rule === 'middle' && row.condition === 'opposed')),
    neutral: cohort(rows.filter(row => row.rule === 'middle' && row.condition === 'neutral')) },
  sides: { aligned: cohort(rows.filter(row => row.rule === 'sides' && row.condition === 'aligned')),
    opposed: cohort(rows.filter(row => row.rule === 'sides' && row.condition === 'opposed')),
    neutral: cohort(rows.filter(row => row.rule === 'sides' && row.condition === 'neutral')) } }
  const switched = cohort(rows.filter(row => row.switched === true))
  const stayed = cohort(rows.filter(row => row.switched === false))
  const metrics: HeadlessMetrics = { overall: cohort(rows), byColor: { red: cohort(rows.filter(row => row.color === 'red')), blue: cohort(rows.filter(row => row.color === 'blue')), black: cohort(rows.filter(row => row.color === 'black')) }, byRule, byCondition, byCell,
    switch: switched, stay: stayed,
    switchMinusStayMs: contrastTimes(switched.time, stayed.time),
    opposedMinusAlignedMs: contrastTimes(byCondition.opposed.time, byCondition.aligned.time),
    tooEarlyForTiming: rows.filter(row => row.tooEarly).length }
  requireReview(metrics.overall.correct + metrics.overall.wrong + metrics.overall.omitted === 135 &&
    byRule.middle.denominator === 77 && byRule.sides.denominator === 58 &&
    byCondition.aligned.denominator === 62 && byCondition.opposed.denominator === 54 &&
    byCondition.neutral.denominator === 19 &&
    byCell.sides.aligned.denominator === 31 && byCell.sides.opposed.denominator === 27 && byCell.sides.neutral.denominator === 0 && byCell.middle.aligned.denominator === 31 && byCell.middle.opposed.denominator === 27 && byCell.middle.neutral.denominator === 19 &&
    switched.denominator + stayed.denominator === 130)
  return freezeDeep({ ...base, metrics })
}
