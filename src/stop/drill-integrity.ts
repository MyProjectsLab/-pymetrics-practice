import type { EngineEvent, TimingIssue } from './engine/contracts'
import { timingSeverity } from './engine/rules'

/** Reconcile recorded drill intervals and their quality evidence without changing engine timing. */
export function verifyDrillTiming(events: readonly EngineEvent[], fixationMs: number): boolean {
  const initial = events.filter(e => e.type === 'fixation_started' && e.payload.kind === 'initial')
  if (initial.length !== 1 || initial[0].type !== 'fixation_started' || initial[0].payload.expectedAtMs !== initial[0].timestampMs) return false
  const initialEnd = events.filter(e => e.type === 'fixation_ended' && e.payload.kind === 'initial')
  if (initialEnd.length !== 1 || initialEnd[0].type !== 'fixation_ended' ||
    initialEnd[0].payload.expectedAtMs !== initial[0].timestampMs + 1000) return false
  const schedules = events.filter(e => e.type === 'trial_scheduled')
  const expected: { trialIndex: number; issues: TimingIssue[]; expectedMs: number; observedMs: number }[] = []
  let anchor = initial[0].timestampMs
  let duration = 1000
  for (const schedule of schedules) {
    const index = schedule.payload.trial.index
    const onset = events.find(e => e.type === 'stimulus_presented' && e.payload.trialIndex === index)
    const offset = events.find(e => e.type === 'stimulus_removed' && e.payload.trialIndex === index)
    const resolution = events.find(e => e.type === 'trial_resolved' && e.payload.trialIndex === index)
    if (onset?.type !== 'stimulus_presented' || offset?.type !== 'stimulus_removed' || resolution?.type !== 'trial_resolved') return false
    if (schedule === schedules[0] && initialEnd[0].timestampMs !== onset.timestampMs) return false
    const eligible = anchor + duration
    if (schedule.payload.eligibleAtMs !== eligible || onset.payload.eligibleAtMs !== eligible || onset.timestampMs < eligible) return false
    if (timingSeverity('onset', onset.timestampMs - eligible) === 'severe' ||
      timingSeverity('visibility', offset.payload.visibleDurationMs) === 'severe') return false
    const issues: TimingIssue[] = []
    if (timingSeverity('onset', onset.timestampMs - eligible) !== 'clean') issues.push('onset')
    if (schedule !== schedules[0]) {
      if (timingSeverity('post_resolution', onset.timestampMs - anchor, fixationMs) !== 'clean') issues.push('post_resolution')
    }
    if (issues.length) expected.push({ trialIndex: index, issues, expectedMs: eligible, observedMs: onset.timestampMs })
    if (timingSeverity('visibility', offset.payload.visibleDurationMs) !== 'clean')
      expected.push({ trialIndex: index, issues: ['visibility'], expectedMs: onset.timestampMs + 200, observedMs: offset.timestampMs })
    const timeout = events.find(e => e.type === 'trial_timed_out' && e.payload.trialIndex === index)
    if (timeout?.type === 'trial_timed_out' && timingSeverity('deadline', timeout.payload.latenessMs) === 'severe') return false
    if (timeout?.type === 'trial_timed_out' && timingSeverity('deadline', timeout.payload.latenessMs) !== 'clean')
      expected.push({ trialIndex: index, issues: ['deadline'], expectedMs: timeout.payload.deadlineMs, observedMs: timeout.timestampMs })
    anchor = Math.max(offset.timestampMs, resolution.payload.resolvedAtMs)
    duration = fixationMs
    const starts = events.filter(e => e.type === 'fixation_started' && e.payload.kind === 'post_resolution' && e.payload.trialIndex === index)
    const ends = events.filter(e => e.type === 'fixation_ended' && e.payload.kind === 'post_resolution' && e.payload.trialIndex === index)
    if (starts.length !== 1 || ends.length !== 1 || starts[0].type !== 'fixation_started' || ends[0].type !== 'fixation_ended' || starts[0].payload.expectedAtMs !== anchor ||
      ends[0].payload.expectedAtMs !== anchor + fixationMs || ends[0].timestampMs < anchor + fixationMs) return false
  }
  const finished = events.at(-1)!
  if (finished.type !== 'batch_finished' || finished.timestampMs < anchor + fixationMs) return false
  const finalEnd = events.filter(e => e.type === 'fixation_ended').at(-1)
  if (finalEnd?.timestampMs !== finished.timestampMs || timingSeverity('post_resolution', finished.timestampMs - anchor, fixationMs) === 'severe') return false
  if (timingSeverity('post_resolution', finished.timestampMs - anchor, fixationMs) !== 'clean')
    expected.push({ trialIndex: schedules.at(-1)!.payload.trial.index, issues: ['post_resolution'],
      expectedMs: anchor + fixationMs, observedMs: finished.timestampMs })
  const actual = events.filter(e => e.type === 'timing_anomaly')
  return actual.length === expected.length && expected.every(item => actual.some(e =>
    e.payload.trialIndex === item.trialIndex && e.payload.expectedMs === item.expectedMs &&
    e.payload.observedMs === item.observedMs && e.timestampMs === item.observedMs &&
    JSON.stringify(e.payload.issues) === JSON.stringify(item.issues)))
}
