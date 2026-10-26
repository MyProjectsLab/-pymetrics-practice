import { SCORING_VERSION, SPEC_VERSION, TARGET, WINDOW_MS, verify } from './core'
import type { InvalidReason, State } from './core'
import { report as reportV101 } from './report-v101'

export interface Report {
  readonly specificationVersion: string
  readonly scoringVersion: string
  readonly sessionId: string
  readonly status: 'valid' | 'invalid' | 'incomplete'
  readonly invalidationReason: InvalidReason | null
  readonly selectedKey: string
  readonly hand: State['setup']['hand']
  readonly inputProfile: State['setup']['profile']
  readonly acceptedCount: number
  readonly targetCount: typeof TARGET
  readonly targetReached: boolean
  readonly firstPressMs: number | null
  readonly targetTimeMs: number | null
  readonly intervalCount: number
  readonly responseDurationMs: number | null
  readonly ratePerSecond: number | null
  readonly medianIntervalMs: number | null
  readonly iqrIntervalMs: number | null
  readonly earlyCount: number
  readonly boundaryCount: number
  readonly lateCount: number
  readonly limitation: string
}

function median(sorted: readonly number[]): number {
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

/** Report only values that can be independently reconstructed from a verified journal. */
export function report(state: State): Report | null {
  if (!verify(state)) return null
  if (state.specificationVersion === 'keypresses_spec_v1_0_1')
    return reportV101(state as unknown as Parameters<typeof reportV101>[0]) as Report | null
  const accepted = state.events.filter(e => e.type === 'press_accepted').map(e => e.timestampMs)
  const intervals = accepted.slice(1).map((t, i) => t - accepted[i]).toSorted((a, b) => a - b)
  const middle = Math.floor(intervals.length / 2)
  const lower = intervals.slice(0, middle)
  const upper = intervals.slice(intervals.length % 2 ? middle + 1 : middle)
  const duration = accepted.length >= 2 ? accepted.at(-1)! - accepted[0] : 0
  return Object.freeze({
    specificationVersion: SPEC_VERSION, scoringVersion: SCORING_VERSION,
    sessionId: state.setup.sessionId, status: state.phase === 'completed' ? 'valid' : state.phase === 'invalid' ? 'invalid' : 'incomplete',
    invalidationReason: state.phase === 'invalid' ? state.events.findLast(e => e.type === 'invalidated')?.detail as InvalidReason ?? null : null,
    selectedKey: state.setup.selectedKey, hand: state.setup.hand, inputProfile: state.setup.profile,
    acceptedCount: accepted.length, targetCount: TARGET,
    targetReached: accepted.length === TARGET && state.endReason === 'target',
    firstPressMs: accepted.length && state.goOnsetMs !== null ? accepted[0] - state.goOnsetMs : null,
    targetTimeMs: accepted.length === TARGET && state.goOnsetMs !== null ? accepted.at(-1)! - state.goOnsetMs : null,
    intervalCount: intervals.length,
    responseDurationMs: accepted.length >= 2 ? duration : null,
    ratePerSecond: duration > 0 ? (accepted.length - 1) * 1_000 / duration : null,
    medianIntervalMs: intervals.length >= 5 ? median(intervals) : null,
    iqrIntervalMs: intervals.length >= 8 ? median(upper) - median(lower) : null,
    earlyCount: state.events.filter(e => e.type === 'press_early').length,
    boundaryCount: state.events.filter(e => e.type === 'press_boundary').length,
    lateCount: state.events.filter(e => e.type === 'press_late').length,
    limitation: `Browser-recorded presses within a ${WINDOW_MS / 1_000}-second window; input and display behavior can affect timing. This is not a stable-trait or hiring prediction.`,
  })
}
