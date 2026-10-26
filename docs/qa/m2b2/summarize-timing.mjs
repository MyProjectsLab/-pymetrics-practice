import { readFile, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
const evidence = JSON.parse(await readFile(new URL('full-run.json', import.meta.url), 'utf8'))
const events = evidence.draft.events
let phase, current
const trials = []
const initial = []
const endings = []
for (const event of events) {
  const p = event.payload
  if (event.type === 'fixation_started' && p.kind === 'initial') initial.push({ startedAtMs: event.timestampMs })
  if (event.type === 'trial_scheduled') {
    phase = p.trial.phase
    current = { phase, index: p.trial.index, stimulus: p.trial.stimulus, eligibleAtMs: p.eligibleAtMs }
    trials.push(current)
  }
  if (event.type === 'stimulus_presented') {
    current.onsetMs = p.confirmedOnsetMs
    if (current.index === 0) Object.assign(initial.at(-1), { phase, durationMs: current.onsetMs - initial.at(-1).startedAtMs })
  }
  if (event.type === 'stimulus_removed') { current.offsetMs = p.confirmedOffsetMs; current.visibilityMs = p.visibleDurationMs }
  if (event.type === 'response_accepted') current.responseTimeMs = p.responseTimeMs
  if (event.type === 'trial_resolved') { current.resolvedMs = p.resolvedAtMs; current.resolutionSource = p.source }
  if (event.type === 'batch_finished') endings.push({ phase: p.phase, finishedMs: event.timestampMs })
}
const transitions = []
for (let i = 0; i < trials.length; i++) {
  const t = trials[i], next = trials[i + 1]
  const anchor = Math.max(t.resolvedMs, t.offsetMs)
  const end = next?.phase === t.phase ? next.onsetMs : endings.find(e => e.phase === t.phase).finishedMs
  assert(end - anchor >= 1200 - .001)
  transitions.push({ phase: t.phase, index: t.index, responseTimeMs: t.responseTimeMs ?? null,
    anchorMs: anchor, intervalMs: end - anchor, final: next?.phase !== t.phase })
}
function range(values) { return { min: Math.min(...values), max: Math.max(...values), mean: values.reduce((a,b) => a+b,0) / values.length } }
const summary = {
  browserVersion: evidence.browserVersion, userAgent: evidence.userAgent,
  sessionId: evidence.draft.sessionId, formId: evidence.draft.form.id,
  eventCount: events.length, trials: trials.length, warmupTrials: trials.filter(t => t.phase === 'warmup').length,
  scoredTrials: trials.filter(t => t.phase === 'scored').length,
  visibilityMs: range(trials.map(t => t.visibilityMs)), onsetDelayMs: range(trials.map(t => t.onsetMs - t.eligibleAtMs)),
  transitionIntervalMs: range(transitions.map(t => t.intervalMs)), initial,
  finalIntervals: transitions.filter(t => t.final),
  earlyExample: transitions.find(t => t.phase === 'scored' && t.responseTimeMs < 200 && t.responseTimeMs !== null),
  postOffsetExample: transitions.find(t => t.phase === 'scored' && t.responseTimeMs > 200),
  timeoutExample: transitions.find(t => t.phase === 'scored' && t.responseTimeMs === null),
  anomalies: events.filter(e => e.type === 'timing_anomaly'),
  ignoredInputReasons: [...new Set(events.filter(e => e.type === 'response_ignored').map(e => e.payload.reason))],
  defaultPreventionFailures: evidence.observations.inputs.filter(e => e.code === 'Space' && !e.prevented).length,
  scrollPositions: [...new Set(evidence.observations.scroll.map(s => JSON.stringify(s)))],
  trialsDetail: trials, transitions,
}
assert.equal(summary.warmupTrials, 8); assert.equal(summary.scoredTrials, 80)
assert.equal(summary.anomalies.length, 0); assert.equal(summary.defaultPreventionFailures, 0)
assert(summary.earlyExample); assert(summary.postOffsetExample); assert(summary.timeoutExample)
await writeFile(new URL('timing-summary.json', import.meta.url), JSON.stringify(summary, null, 2))
console.log(JSON.stringify({ ...summary, trialsDetail: undefined, transitions: undefined }, null, 2))
