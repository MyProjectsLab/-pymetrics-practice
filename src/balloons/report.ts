import type { CoreState, Outcome, Profile, RoundResult, VisibleType } from './contracts'
import { BALLOONS_FORM_VERSION, BALLOONS_PAYOUT_CENTS, BALLOONS_ROUND_COUNT, BALLOONS_SCORING_VERSION, BALLOONS_SPEC_VERSION } from './contracts'
import { reconcileCompletedSession } from './integrity'

const profiles: readonly Profile[] = ['A', 'B', 'C']
const LIMITATION = 'These are the choices and outcomes from this Assessment Practice sequence. A different sequence could produce a different amount. This result is not a personality score or a prediction of an employer\'s decision.'
export interface CountSummary {
  readonly rounds: number
  readonly collectedCount: number
  readonly burstCount: number
  readonly voluntaryCount: number
  readonly zeroPumpCount: number
  readonly capCount: number
  readonly bankedCents: number
  readonly lostCents: number
  readonly attemptedPumps: number
  readonly successfulPumps: number
}
export type Evidence<T> = { readonly status: 'supported'; readonly value: T; readonly count: number } | { readonly status: 'insufficient_evidence'; readonly count: number; readonly required: number; readonly message: string }
export type EarlyLateEvidence = { readonly status: 'supported'; readonly earlyCount: number; readonly lateCount: number; readonly earlyMedian: number; readonly lateMedian: number; readonly lateMinusEarly: number } | { readonly status: 'insufficient_evidence'; readonly earlyCount: number; readonly lateCount: number; readonly requiredEach: 3; readonly message: string }
export interface PostBurstWindow {
  readonly observations: readonly { readonly round: number; readonly outcome: Outcome; readonly voluntaryPoint: number | null }[]
  readonly pre: number
  readonly post: number
  readonly rebound: number
}
export interface CategoryReport extends CountSummary {
  readonly visibleType: VisibleType
  readonly voluntaryMedian: Evidence<number>
  readonly earlyLate: EarlyLateEvidence
}
export interface RoundReview {
  readonly round: number
  readonly visibleType: VisibleType
  readonly attemptedPumps: number
  readonly successfulPumps: number
  readonly outcome: Outcome
  readonly voluntaryPoint: number | null
  readonly bankedCents: number
  readonly lostCents: number
  readonly censored: boolean
}
export interface BasicReport {
  readonly status: 'headless_complete'
  readonly formId: string
  readonly formVersion: typeof BALLOONS_FORM_VERSION
  readonly specificationVersion: typeof BALLOONS_SPEC_VERSION
  readonly scoringVersion: typeof BALLOONS_SCORING_VERSION
  readonly total: CountSummary
  readonly categories: readonly CategoryReport[]
  readonly blocks: readonly { readonly label: 'early' | 'middle' | 'late'; readonly summary: CountSummary }[]
  readonly postBurst: Evidence<readonly [PostBurstWindow, PostBurstWindow]>
  readonly supportedObservation: string
  readonly rounds: readonly RoundReview[]
  readonly limitation: typeof LIMITATION
}
export type ReportResult = BasicReport | { readonly status: 'insufficient_evidence'; readonly resolvedRounds: number; readonly requiredRounds: 39; readonly message: string }

function assert(condition: unknown, reason: string): asserts condition {
  if (!condition) throw new Error(`Balloons report integrity: ${reason}`)
}
function summarize(rounds: readonly RoundResult[]): CountSummary {
  return rounds.reduce<CountSummary>((sum, round) => ({
    rounds: sum.rounds + 1,
    collectedCount: sum.collectedCount + Number(round.outcome !== 'burst'),
    burstCount: sum.burstCount + Number(round.outcome === 'burst'),
    voluntaryCount: sum.voluntaryCount + Number(round.outcome === 'voluntary_collect'),
    zeroPumpCount: sum.zeroPumpCount + Number(round.outcome === 'voluntary_collect' && round.successfulPumps === 0),
    capCount: sum.capCount + Number(round.outcome === 'cap_collect'),
    bankedCents: sum.bankedCents + round.bankedCents,
    lostCents: sum.lostCents + round.lostCents,
    attemptedPumps: sum.attemptedPumps + round.attemptedPumps,
    successfulPumps: sum.successfulPumps + round.successfulPumps,
  }), { rounds: 0, collectedCount: 0, burstCount: 0, voluntaryCount: 0, zeroPumpCount: 0, capCount: 0, bankedCents: 0, lostCents: 0, attemptedPumps: 0, successfulPumps: 0 })
}
function checkConservation(summary: CountSummary) {
  assert(summary.voluntaryCount + summary.capCount + summary.burstCount === summary.rounds, 'outcome counts')
  assert(summary.collectedCount === summary.voluntaryCount + summary.capCount, 'collected count')
  assert(summary.zeroPumpCount <= summary.voluntaryCount, 'zero pump count')
  assert(summary.attemptedPumps === summary.successfulPumps + summary.burstCount, 'attempted/successful identity')
  assert(BALLOONS_PAYOUT_CENTS * summary.successfulPumps === summary.bankedCents + summary.lostCents, 'cent conservation')
}
function median(points: readonly number[]): number {
  const sorted = [...points].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}
function voluntaryPoints(rounds: readonly RoundResult[]): number[] {
  return rounds.flatMap(round => round.outcome === 'voluntary_collect' ? [round.voluntaryPoint as number] : [])
}
function fullMedian(rounds: readonly RoundResult[]): Evidence<number> {
  const points = voluntaryPoints(rounds)
  return points.length >= 5
    ? { status: 'supported', value: median(points), count: points.length }
    : { status: 'insufficient_evidence', count: points.length, required: 5, message: `not enough voluntary collections (${points.length}/5)` }
}
function earlyLate(rounds: readonly RoundResult[]): EarlyLateEvidence {
  const early = voluntaryPoints(rounds.filter(round => round.round <= 13))
  const late = voluntaryPoints(rounds.filter(round => round.round >= 27))
  if (early.length < 3 || late.length < 3) return { status: 'insufficient_evidence', earlyCount: early.length, lateCount: late.length, requiredEach: 3, message: `not enough observed voluntary collections (early ${early.length}/3; late ${late.length}/3)` }
  const earlyMedian = median(early)
  const lateMedian = median(late)
  return { status: 'supported', earlyCount: early.length, lateCount: late.length, earlyMedian, lateMedian, lateMinusEarly: lateMedian - earlyMedian }
}
function postBurstWindows(rounds: readonly RoundResult[]): Evidence<readonly [PostBurstWindow, PostBurstWindow]> {
  const candidates: PostBurstWindow[] = []
  for (const profile of profiles) {
    const same = rounds.filter(round => round.profile === profile)
    for (let i = 0; i <= same.length - 4; i++) {
      const [a, b, c, d] = same.slice(i, i + 4)
      if (a.outcome !== 'voluntary_collect' || b.outcome !== 'burst' || c.outcome !== 'voluntary_collect' || d.outcome !== 'voluntary_collect') continue
      const pre = a.voluntaryPoint as number, post = c.voluntaryPoint as number, rebound = d.voluntaryPoint as number
      if (pre - post >= 5 && rebound - post >= 5) candidates.push({ observations: [a, b, c, d].map(round => ({ round: round.round, outcome: round.outcome, voluntaryPoint: round.voluntaryPoint })), pre, post, rebound })
    }
  }
  candidates.sort((a, b) => a.observations[3].round - b.observations[3].round || a.observations[0].round - b.observations[0].round)
  const chosen: PostBurstWindow[] = [], used = new Set<number>()
  for (const window of candidates) {
    if (window.observations.some(observation => used.has(observation.round))) continue
    chosen.push(window)
    window.observations.forEach(observation => used.add(observation.round))
  }
  return chosen.length >= 2
    ? { status: 'supported', count: chosen.length, value: [chosen[0], chosen[1]] }
    : { status: 'insufficient_evidence', count: chosen.length, required: 2, message: 'not enough disjoint observed post-burst windows' }
}
function review(round: RoundResult): RoundReview {
  return { round: round.round, visibleType: round.visibleType, attemptedPumps: round.attemptedPumps, successfulPumps: round.successfulPumps, outcome: round.outcome, voluntaryPoint: round.voluntaryPoint, bankedCents: round.bankedCents, lostCents: round.lostCents, censored: round.censored }
}
/** Calculates only task-descriptive evidence. The caller must separately establish durable validity. */
export function basicReport(state: CoreState): ReportResult {
  if (state.status !== 'completed' || state.results.length !== BALLOONS_ROUND_COUNT) return { status: 'insufficient_evidence', resolvedRounds: state.results.length, requiredRounds: 39, message: `Only ${state.results.length} of 39 rounds are resolved.` }
  assert(state.events.at(-1)?.type === 'session_completed', 'missing completion event')
  state = reconcileCompletedSession(state)
  assert(state.results.every((round, index) => round.round === index + 1 && round.profile === state.manifest.rounds[index].profile), 'round/profile mismatch')
  for (const round of state.results) {
    assert(round.attemptedPumps === round.successfulPumps + Number(round.outcome === 'burst'), 'round pump identity')
    assert(round.bankedCents + round.lostCents === BALLOONS_PAYOUT_CENTS * round.successfulPumps, 'round cent identity')
    assert(round.voluntaryPoint === (round.outcome === 'voluntary_collect' ? round.successfulPumps : null), 'voluntary censoring')
    assert(round.censored === (round.outcome !== 'voluntary_collect'), 'censor flag')
  }
  const total = summarize(state.results)
  checkConservation(total)
  assert(total.bankedCents === state.bankedCents && total.lostCents === state.lostCents, 'state totals')
  const categories = profiles.map(profile => {
    const rounds = state.results.filter(round => round.profile === profile)
    const summary = summarize(rounds)
    checkConservation(summary)
    assert(summary.rounds === 13, 'category denominator')
    return { ...summary, visibleType: rounds[0].visibleType, voluntaryMedian: fullMedian(rounds), earlyLate: earlyLate(rounds) }
  })
  const labels = ['early', 'middle', 'late'] as const
  const blocks = labels.map((label, index) => ({ label, summary: summarize(state.results.slice(index * 13, index * 13 + 13)) }))
  blocks.forEach(block => { checkConservation(block.summary); assert(block.summary.rounds === 13, 'block denominator') })
  const postBurst = postBurstWindows(state.results)
  return {
    status: 'headless_complete', formId: state.manifest.id, formVersion: BALLOONS_FORM_VERSION, specificationVersion: BALLOONS_SPEC_VERSION, scoringVersion: BALLOONS_SCORING_VERSION,
    total, categories, blocks, postBurst,
    supportedObservation: `${total.collectedCount} collected and ${total.burstCount} burst out of 39 balloons.`,
    rounds: state.results.map(review), limitation: LIMITATION,
  }
}
