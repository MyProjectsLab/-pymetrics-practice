import type { StopFormManifest, StopTrialOutcome } from './contracts'
import type { EngineEvent } from './engine/contracts'
import { STOP_SCORING_VERSION, STOP_V13_SCORING_VERSION } from './versions'

export type Counts = Readonly<{ hits: number; misses: number; withholds: number; falseAlarms: number }>
export type Timing = Readonly<{ count: number; q1: number | null; median: number | null; q3: number | null; iqr: number | null }>
export type Block = Readonly<{ number: number; counts: Counts; timing: Timing; accuracy: number; hitRate: number; withholdRate: number; falseAlarmRate: number; eligibleOutcomes: number }>
export type ScoredTrial = Readonly<{ index: number; stimulus: 'GO' | 'NO_GO'; outcome: StopTrialOutcome; timingEligible: boolean; responseTimeMs: number | null }>
export interface StopSummary {
  readonly scoringVersion: typeof STOP_SCORING_VERSION | typeof STOP_V13_SCORING_VERSION
  readonly counts: Counts
  readonly rates: Readonly<{ hit: number; miss: number; withhold: number; falseAlarm: number; overall: number }>
  readonly timing: Timing
  readonly blocks: readonly Block[]
  readonly halves: readonly Counts[]
  readonly halfTiming?: readonly [Timing, Timing]
  readonly speedAccuracy: string
  readonly postError: Readonly<{ selected: number; comparison: number; postAccuracy: number | null; comparisonAccuracy: number | null; differencePoints: number | null; deltaMs: number | null; narrative: string }>
  readonly sequence: Readonly<{ longRunCount: number; otherCount: number; longRunFalseAlarms: number; otherFalseAlarms: number; narrative: string }>
  readonly anticipatoryCount: number
}

export const round = (value: number) => Math.sign(value) * Math.floor(Math.abs(value) + 0.5)
export function percentile(values: readonly number[], p: number): number | null {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const position = (sorted.length - 1) * p
  const lower = Math.floor(position)
  const fraction = position - lower
  return sorted[lower] + ((sorted[Math.min(lower + 1, sorted.length - 1)] - sorted[lower]) * fraction)
}
export function timing(values: readonly number[]): Timing {
  const q1 = percentile(values, .25), median = percentile(values, .5), q3 = percentile(values, .75)
  return Object.freeze({ count: values.length, q1, median, q3, iqr: q1 === null || q3 === null ? null : q3 - q1 })
}
function counts(trials: readonly ScoredTrial[]): Counts {
  return Object.freeze({
    hits: trials.filter(t => t.outcome.kind === 'hit').length,
    misses: trials.filter(t => t.outcome.kind === 'miss').length,
    withholds: trials.filter(t => t.outcome.kind === 'correct_withhold').length,
    falseAlarms: trials.filter(t => t.outcome.kind === 'false_alarm').length,
  })
}
const correct = (trial: ScoredTrial) => trial.outcome.kind === 'hit' || trial.outcome.kind === 'correct_withhold'
const error = (trial: ScoredTrial) => !correct(trial)
const eligibleTimes = (trials: readonly ScoredTrial[]) => trials.flatMap(t => t.timingEligible ? [t.responseTimeMs!] : [])
// Exact rational rates are represented as JS floats; allow only machine-scale noise
// at a declared percentage-point boundary, never display rounding.
const atLeast = (value: number, threshold: number) => value + 1e-9 >= threshold
const below = (value: number, threshold: number) => value < threshold - 1e-9
function block(number: number, trials: readonly ScoredTrial[]): Block {
  const c = counts(trials)
  const go = c.hits + c.misses, noGo = c.withholds + c.falseAlarms
  return Object.freeze({ number, counts: c, timing: timing(eligibleTimes(trials)), eligibleOutcomes: trials.length,
    accuracy: (c.hits + c.withholds) / trials.length,
    hitRate: c.hits / go, withholdRate: c.withholds / noGo, falseAlarmRate: c.falseAlarms / noGo })
}
export function speedAccuracy(first: Block, last: Block): string {
  if (first.eligibleOutcomes < 16 || last.eligibleOutcomes < 16 || first.timing.count < 10 || last.timing.count < 10 ||
    [first, last].some(b => b.counts.hits + b.counts.misses < 12 || b.counts.withholds + b.counts.falseAlarms < 4) ||
    first.timing.median === null || last.timing.median === null) return 'There was not enough clean data for a reliable block comparison.'
  const go = (last.hitRate - first.hitRate) * 100
  const noGo = (last.withholdRate - first.withholdRate) * 100
  const time = round(last.timing.median - first.timing.median)
  const numeric = `From the first to the final block, GO hit rate changed by ${round(go)} percentage points, NO-GO correct-withhold rate by ${round(noGo)} points, and median correct-GO response time by ${time} ms.`
  // The approved M3-03 opposite-sign rule precedes concentration and priority.
  if (go * noGo < 0) return numeric
  const label = atLeast(Math.abs(go), 5) && below(Math.abs(noGo), 5) ? 'GO hit rate' : atLeast(Math.abs(noGo), 5) && below(Math.abs(go), 5) ? 'NO-GO correct-withhold rate' : 'overall accuracy'
  const change = label === 'GO hit rate' ? go : label === 'NO-GO correct-withhold rate' ? noGo : (last.accuracy - first.accuracy) * 100
  if (atLeast(Math.abs(change), 5) && below(Math.abs(change), 10)) return numeric
  const named = label === 'overall accuracy' ? '' : ` (${label})`
  // §13.2 selects the primary observation after the approved numbers-only exceptions.
  if (time <= -50 && atLeast(-change, 10)) return `faster with lower accuracy${named}.`
  if (time >= 50 && atLeast(change, 10)) return `slower and more accurate${named}.`
  const falseAlarmChange = (last.falseAlarmRate - first.falseAlarmRate) * 100
  if (atLeast(Math.abs(falseAlarmChange), 15)) return `From the first to the final block, false-alarm rate ${falseAlarmChange < 0 ? 'decreased' : 'increased'} by ${round(Math.abs(falseAlarmChange))} percentage points.`
  if (atLeast(Math.abs(go), 10)) return `From the first to the final block, GO hit rate ${go < 0 ? 'decreased' : 'increased'} by ${round(Math.abs(go))} percentage points.`
  // With no higher-priority observation, retain the approved §13.1 timing
  // classification, including the founder's explicit 50–74 ms clarification.
  if (time <= -50 && below(Math.abs(change), 5)) return `faster with similar accuracy${named}.`
  if (time >= 50 && below(Math.abs(change), 5)) return `slower with similar accuracy${named}.`
  if (Math.abs(time) < 50 && atLeast(change, 10)) return `more accurate with similar speed${named}.`
  if (time >= 50 && atLeast(-change, 10)) return 'both speed and accuracy were lower in the final block.'
  if (Math.abs(time) < 50 && below(Math.abs(change), 10)) return 'speed and accuracy were broadly stable across the first and final blocks.'
  return numeric
}

function speedAccuracyV13(first: Block, last: Block): string {
  const sentences: string[] = []
  const firstGo = first.counts.hits + first.counts.misses, lastGo = last.counts.hits + last.counts.misses
  const firstNoGo = first.counts.withholds + first.counts.falseAlarms, lastNoGo = last.counts.withholds + last.counts.falseAlarms
  if (firstGo >= 5 && lastGo >= 5) sentences.push(`GO hit rate: ${round(first.hitRate * 100)}% to ${round(last.hitRate * 100)}%.`)
  if (firstNoGo >= 6 && lastNoGo >= 6) sentences.push(`NO-GO correct-withhold rate: ${round(first.withholdRate * 100)}% to ${round(last.withholdRate * 100)}%.`)
  if (first.timing.count >= 5 && last.timing.count >= 5) sentences.push(`Median correct-GO response time: ${round(first.timing.median!)} ms to ${round(last.timing.median!)} ms.`)
  if (first.timing.count >= 7 && last.timing.count >= 7) sentences.push(`Correct-GO response-time IQR: ${round(first.timing.iqr!)} ms to ${round(last.timing.iqr!)} ms.`)
  return sentences.join(' ') || 'There was not enough clean data for a reliable block comparison.'
}

export function scoreStop(events: readonly EngineEvent[], form: StopFormManifest): StopSummary {
  const scheduled = new Map<number, 'GO' | 'NO_GO'>()
  const resolved = new Map<number, StopTrialOutcome>()
  const timingExcluded = new Set<number>()
  let scoredStarted = false
  for (const event of events) {
    if (event.type === 'trial_scheduled' && event.payload.trial.phase === 'scored') {
      scoredStarted = true
      const { index, stimulus } = event.payload.trial
      if (scheduled.has(index) || form.sequence[index] !== stimulus) throw new Error('Scored trial schedule mismatch')
      scheduled.set(index, stimulus)
    }
    if (scoredStarted && event.type === 'trial_resolved') {
      const { trialIndex, outcome, source } = event.payload
      if (!scheduled.has(trialIndex) || resolved.has(trialIndex) || outcome.stimulus !== scheduled.get(trialIndex) ||
        (source === 'response') !== ['hit', 'false_alarm'].includes(outcome.kind) ||
        (source === 'timeout') !== ['miss', 'correct_withhold'].includes(outcome.kind)) throw new Error('Scored trial outcome mismatch')
      resolved.set(trialIndex, outcome)
    }
    if (scoredStarted && event.type === 'timing_anomaly' && event.payload.trialIndex !== null) timingExcluded.add(event.payload.trialIndex)
  }
  if (scheduled.size !== 80 || resolved.size !== 80 || form.sequence.length !== 80) throw new Error('Incomplete scored event record')
  const trials = form.sequence.map((stimulus, index): ScoredTrial => {
    const outcome = resolved.get(index)
    if (!outcome || outcome.stimulus !== stimulus) throw new Error('Missing scored outcome')
    const responseTimeMs = outcome.responseTimeMs
    return Object.freeze({ index, stimulus, outcome, responseTimeMs,
      timingEligible: outcome.kind === 'hit' && responseTimeMs !== null && responseTimeMs >= 100 && responseTimeMs <= 1000 && !timingExcluded.has(index) })
  })
  const c = counts(trials)
  const v13 = form.specificationVersion === '1.3'
  const goTotal = form.sequence.filter(value => value === 'GO').length
  const noGoTotal = 80 - goTotal
  if (c.hits + c.misses !== (v13 ? goTotal : 60) || c.withholds + c.falseAlarms !== (v13 ? noGoTotal : 20)) throw new Error('Outcome identities do not reconcile')
  const blocks = Array.from({ length: 4 }, (_, i) => block(i + 1, trials.slice(i * 20, (i + 1) * 20)))
  if (blocks.some((b, i) => b.counts.hits + b.counts.misses !== (v13 ? form.blockGoCounts[i] : 15) ||
    b.counts.withholds + b.counts.falseAlarms !== (v13 ? 20 - form.blockGoCounts[i] : 5))) throw new Error('Block identities do not reconcile')
  const halves = Object.freeze([counts(trials.slice(0, 40)), counts(trials.slice(40))])
  const isPost = trials.map((_, index) => trials.slice(Math.max(0, index - 3), index).some(error))
  const post = trials.filter((_, i) => isPost[i]), comparison = trials.filter((_, i) => !isPost[i])
  const selected: number[] = []
  for (const trial of trials) {
    if (!error(trial)) continue
    for (let i = trial.index + 1; i < Math.min(trial.index + 4, trials.length); i++) {
      if (error(trials[i])) break
      if (trials[i].timingEligible) { selected.push(trials[i].responseTimeMs!); break }
    }
  }
  const controls = eligibleTimes(comparison)
  const postAccuracy = post.length ? post.filter(correct).length / post.length : null
  const comparisonAccuracy = comparison.length ? comparison.filter(correct).length / comparison.length : null
  const differencePoints = postAccuracy === null || comparisonAccuracy === null ? null : (postAccuracy - comparisonAccuracy) * 100
  const supported = selected.length >= 4 && controls.length >= 12
  const deltaMs = supported ? round(percentile(selected, .5)! - percentile(controls, .5)!) : null
  let postNarrative = 'There were not enough qualifying trials to describe your response speed after errors.'
  if (supported && differencePoints !== null && atLeast(-differencePoints, 10)) postNarrative = `Accuracy on trials within three positions after an error was ${round(Math.abs(differencePoints))} percentage points lower than on other trials (${post.filter(correct).length} of ${post.length} versus ${comparison.filter(correct).length} of ${comparison.length}).`
  else if (supported && deltaMs !== null) postNarrative = deltaMs >= 50
    ? `On qualifying correct GO trials after an error, your median response time was ${deltaMs} ms slower than on comparison trials. This is a task-level pattern from this session.`
    : deltaMs <= -50
      ? `On qualifying correct GO trials after an error, your median response time was ${Math.abs(deltaMs)} ms faster than on comparison trials. This is a task-level pattern from this session.`
      : 'similar response speed after errors.'
  const longRun = trials.filter((t, i) => t.stimulus === 'NO_GO' && i >= 3 && trials.slice(i - 3, i).every(previous => previous.stimulus === 'GO'))
  const other = trials.filter(t => t.stimulus === 'NO_GO' && !longRun.includes(t))
  const longFA = longRun.filter(t => t.outcome.kind === 'false_alarm').length, otherFA = other.filter(t => t.outcome.kind === 'false_alarm').length
  const sequenceNarrative = longRun.length < 4 || other.length < 8 ? 'There were not enough NO-GO trials in both sequence contexts to make this comparison.' :
    `Your false-alarm rate was ${round(100 * longFA / longRun.length)}% when NO-GO followed at least three GO symbols and ${round(100 * otherFA / other.length)}% on other qualifying NO-GO trials (${atLeast((longFA / longRun.length - otherFA / other.length) * 100, 10) ? 'higher' : atLeast((otherFA / other.length - longFA / longRun.length) * 100, 10) ? 'lower' : 'similar'}). This describes your responses in this sequence. It does not mean a NO-GO symbol becomes more likely after a run of GO symbols.`
  return Object.freeze({ scoringVersion: v13 ? STOP_V13_SCORING_VERSION : STOP_SCORING_VERSION, counts: c,
    rates: Object.freeze({ hit: c.hits / (v13 ? goTotal : 60), miss: c.misses / (v13 ? goTotal : 60), withhold: c.withholds / (v13 ? noGoTotal : 20), falseAlarm: c.falseAlarms / (v13 ? noGoTotal : 20), overall: (c.hits + c.withholds) / 80 }),
    timing: timing(eligibleTimes(trials)), blocks: Object.freeze(blocks), halves,
    ...(v13 ? { halfTiming: Object.freeze([timing(eligibleTimes(trials.slice(0, 40))), timing(eligibleTimes(trials.slice(40)))] as const) } : {}),
    speedAccuracy: v13 ? speedAccuracyV13(blocks[0], blocks[3]) : speedAccuracy(blocks[0], blocks[3]),
    postError: Object.freeze({ selected: selected.length, comparison: controls.length, postAccuracy, comparisonAccuracy, differencePoints, deltaMs, narrative: postNarrative }),
    sequence: Object.freeze({ longRunCount: longRun.length, otherCount: other.length, longRunFalseAlarms: longFA, otherFalseAlarms: otherFA, narrative: sequenceNarrative }),
    anticipatoryCount: trials.filter(t => (t.outcome.kind === 'hit' || t.outcome.kind === 'false_alarm') && t.responseTimeMs !== null && t.responseTimeMs < 100).length,
  })
}
