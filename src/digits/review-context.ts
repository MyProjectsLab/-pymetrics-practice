import type { RunState } from './contracts'
import type { DigitsReview } from './scoring'

/** Actual accepted assistance is independent of the setup declaration. */
export function actualDigitsAssistance(state: RunState) {
  return state.draftAssisted || state.closed.some(trial => trial.assistedEntry)
}
export function removedDigitsReview(state: RunState): DigitsReview {
  return { status: 'incomplete', reason: 'saved_attempt_removed',
    presented: state.presentedTrials, closed: state.closed.length,
    unresolved: state.presentedTrials - state.closed.length }
}
export function observedDigitsOnsets(state: RunState) {
  const counts = new Map<number, number>()
  for (const event of state.events) if (event.type === 'digit_presented' || event.type === 'speech_started')
    counts.set(event.trialIndex, (counts.get(event.trialIndex) ?? 0) + 1)
  return [...counts].map(([trial, digits]) => ({ trial, digits }))
}
