import type { StopTrialDefinition } from '../contracts'
import { ENGINE_EVENT_VERSION } from './contracts'
import type { EngineEvent } from './contracts'

/** Batch integrity only. Does not certify 80/60/20, a manifest checksum, or a product result. */
export function inspectTrialEvents(events: readonly EngineEvent[], trials: readonly StopTrialDefinition[], responseKey: string, deadlineMs = 1000) {
  const fail = (detail: string) => ({ valid: false, detail })
  if (!events.length) return fail('Missing batch events')
  for (let i = 0; i < events.length; i++) {
    const event = events[i]
    if (event.schemaVersion !== ENGINE_EVENT_VERSION || event.sessionId !== events[0].sessionId || !Number.isFinite(event.timestampMs) || event.timestampMs < 0) return fail('Incompatible event envelope')
    if (i && (event.sequenceNumber !== events[i - 1].sequenceNumber + 1 || event.timestampMs < events[i - 1].timestampMs)) return fail('Non-monotonic or missing event')
  }
  const known = new Set(trials.map(t => t.index))
  for (const event of events) {
    if ('trialIndex' in event.payload && event.payload.trialIndex !== null && !known.has(event.payload.trialIndex)) return fail('Unknown trial event')
  }
  for (const trial of trials) {
    const presented = events.filter(e => e.type === 'stimulus_presented' && e.payload.trialIndex === trial.index)
    const removed = events.filter(e => e.type === 'stimulus_removed' && e.payload.trialIndex === trial.index)
    const resolved = events.filter(e => e.type === 'trial_resolved' && e.payload.trialIndex === trial.index)
    const accepted = events.filter(e => e.type === 'response_accepted' && e.payload.trialIndex === trial.index)
    const timeouts = events.filter(e => e.type === 'trial_timed_out' && e.payload.trialIndex === trial.index)
    if (presented.length !== 1 || removed.length !== 1 || resolved.length !== 1) return fail('Missing or duplicate required trial event')
    const start = presented[0]
    const end = removed[0]
    const result = resolved[0]
    // Explicit narrowing keeps runtime discrimination visible to callers and TypeScript.
    if (start.type !== 'stimulus_presented' || end.type !== 'stimulus_removed' || result.type !== 'trial_resolved') return fail('Wrong event type')
    const onset = start.payload.confirmedOnsetMs
    if (start.payload.stimulus !== trial.stimulus || onset !== start.timestampMs || end.payload.confirmedOffsetMs !== end.timestampMs || end.payload.visibleDurationMs !== end.timestampMs - onset || end.sequenceNumber < start.sequenceNumber || result.sequenceNumber < start.sequenceNumber || result.payload.resolvedAtMs < onset || result.payload.resolvedAtMs > result.timestampMs) return fail('Incompatible trial timing or order')
    const outcome = result.payload.outcome
    if (outcome.stimulus !== trial.stimulus) return fail('Outcome stimulus mismatch')
    if (result.payload.source === 'response') {
      if (accepted.length !== 1 || timeouts.length) return fail('Missing or duplicate response')
      const response = accepted[0]
      if (response.type !== 'response_accepted') return fail('Wrong response type')
      const input = events.find(e => e.sequenceNumber === response.payload.inputSequenceNumber)
      const rt = response.timestampMs - onset
      if (!input || input.type !== 'input_received' || input.payload.key !== responseKey || input.payload.repeated || input.payload.held || !input.payload.focused || input.timestampMs !== response.timestampMs || input.sequenceNumber >= response.sequenceNumber || response.sequenceNumber >= result.sequenceNumber || result.payload.triggerSequenceNumber !== response.sequenceNumber || response.payload.responseTimeMs !== rt || response.payload.anticipatory !== (rt < 100) || rt < 0 || rt > deadlineMs || result.payload.resolvedAtMs !== response.timestampMs || outcome.responseTimeMs !== rt || outcome.kind !== (trial.stimulus === 'GO' ? 'hit' : 'false_alarm')) return fail('Ineligible response or outcome mismatch')
    } else {
      if (accepted.length || timeouts.length !== 1) return fail('Missing or duplicate timeout')
      const timeout = timeouts[0]
      if (timeout.type !== 'trial_timed_out' || timeout.payload.deadlineMs !== onset + deadlineMs || timeout.timestampMs <= onset + deadlineMs || timeout.payload.latenessMs !== timeout.timestampMs - (onset + deadlineMs) || timeout.sequenceNumber >= result.sequenceNumber || result.payload.triggerSequenceNumber !== timeout.sequenceNumber || result.payload.resolvedAtMs !== onset + deadlineMs || outcome.responseTimeMs !== null || outcome.kind !== (trial.stimulus === 'GO' ? 'miss' : 'correct_withhold')) return fail('Timeout or outcome mismatch')
    }
  }
  return { valid: true, detail: 'Required batch events reconcile' }
}
