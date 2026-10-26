import type { StopResult } from './run'
import { round } from './scoring'
import { COMPARISON_EXPOSURE } from './training'

export interface StopComparison {
  readonly baseline: StopResult
  readonly retest: StopResult
  readonly heading: 'Baseline and retest'
  readonly exposure: typeof COMPARISON_EXPOSURE
  readonly lines: readonly string[]
  readonly details: readonly string[]
  readonly narrative: string | null
  readonly categoryDisclosure: string | null
  readonly limitation: string
  readonly formWarning: string
  readonly accommodation: string | null
}
const percent = (value: number) => round(value * 100)
const signed = (value: number) => `${value >= 0 ? '+' : ''}${round(value)}`
const accuracy = (result: StopResult) => result.summarySnapshot.rates.overall

/** §20.4 uses overall accuracy first; the M3 within-session classifier is never called. */
export function comparisonNarrative(baseAccuracy: number, retestAccuracy: number, baseMedian: number | null, retestMedian: number | null): string | null {
  const deltaPoints = (retestAccuracy - baseAccuracy) * 100
  if (baseMedian === null || retestMedian === null) return null
  const deltaMs = retestMedian - baseMedian
  if (deltaPoints >= 10 - 1e-9 && deltaMs >= 50) return 'The retest was more accurate and slower.'
  if (deltaPoints <= -10 + 1e-9 && deltaMs <= -50) return 'The retest was faster and less accurate.'
  if (Math.abs(deltaPoints) >= 5 - 1e-9 && Math.abs(deltaPoints) < 10 - 1e-9) return null
  // §20.4 specifies no other combined directional phrase.
  return null
}

/** All currently supported completed forms use standard timing. Labels are presentation only. */
export const compatibilityKey = (result: StopResult) => JSON.stringify([
  result.specificationVersion, result.scoringVersion, result.setup.visualProfile,
  result.setup.binding.code, result.setup.physicalKeyboard, 'standard',
])

export function compareStop(baseline: StopResult, retest: StopResult): StopComparison | null {
  if (baseline.mode !== 'baseline' || retest.mode !== 'retest' ||
    !['valid', 'valid_with_note'].includes(baseline.validity) || !['valid', 'valid_with_note'].includes(retest.validity) ||
    compatibilityKey(baseline) !== compatibilityKey(retest) || baseline.form.id === retest.form.id) return null
  if (baseline.specificationVersion === '1.3') return compareStopV13(baseline, retest)
  const b = baseline.summarySnapshot, r = retest.summarySnapshot
  const lines = [
    `Overall accuracy changed from ${percent(b.rates.overall)}% to ${percent(r.rates.overall)}% (${signed((r.rates.overall - b.rates.overall) * 100)} percentage points).`,
    `GO hit rate changed from ${percent(b.rates.hit)}% to ${percent(r.rates.hit)}%.`,
    `NO-GO correct-withhold rate changed from ${percent(b.rates.withhold)}% to ${percent(r.rates.withhold)}%.`,
  ]
  const details = [
    `Hits changed from ${b.counts.hits} to ${r.counts.hits}; misses from ${b.counts.misses} to ${r.counts.misses}.`,
    `Correct withholds changed from ${b.counts.withholds} to ${r.counts.withholds}; false alarms from ${b.counts.falseAlarms} to ${r.counts.falseAlarms}.`,
    `GO miss rate changed from ${percent(b.rates.miss)}% to ${percent(r.rates.miss)}%; NO-GO false-alarm rate changed from ${percent(b.rates.falseAlarm)}% to ${percent(r.rates.falseAlarm)}%.`,
  ]
  if (b.timing.median !== null && r.timing.median !== null) lines.push(`Median correct-GO response time changed from ${round(b.timing.median)} ms to ${round(r.timing.median)} ms (${signed(r.timing.median - b.timing.median)} ms).`)
  if (b.timing.count > 1 && r.timing.count > 1 && b.timing.iqr !== null && r.timing.iqr !== null) lines.push(`Response-time variability changed from an IQR of ${round(b.timing.iqr)} ms to ${round(r.timing.iqr)} ms.`)
  const first = b.blocks[0], last = b.blocks[3], nextFirst = r.blocks[0], nextLast = r.blocks[3]
  if ([first, last, nextFirst, nextLast].every(block => block.eligibleOutcomes >= 16)) {
    details.push(`First-to-last-block overall accuracy changed by ${signed((last.accuracy - first.accuracy) * 100)} points in the baseline and ${signed((nextLast.accuracy - nextFirst.accuracy) * 100)} points in the retest.`)
  }
  if ([first, last, nextFirst, nextLast].every(block => block.counts.hits + block.counts.misses >= 12))
    details.push(`First-to-last-block GO hit rate changed by ${signed((last.hitRate - first.hitRate) * 100)} points in the baseline and ${signed((nextLast.hitRate - nextFirst.hitRate) * 100)} points in the retest.`)
  if ([first, last, nextFirst, nextLast].every(block => block.counts.withholds + block.counts.falseAlarms >= 4))
    details.push(`First-to-last-block false-alarm rate changed by ${signed((last.falseAlarmRate - first.falseAlarmRate) * 100)} points in the baseline and ${signed((nextLast.falseAlarmRate - nextFirst.falseAlarmRate) * 100)} points in the retest.`)
  if ([first, last, nextFirst, nextLast].every(block => block.timing.count >= 10 && block.timing.median !== null))
    details.push(`First-to-last-block median correct-GO response time changed by ${signed(last.timing.median! - first.timing.median!)} ms in the baseline and ${signed(nextLast.timing.median! - nextFirst.timing.median!)} ms in the retest.`)
  if ([first, last, nextFirst, nextLast].every(block => block.timing.count >= 12 && block.timing.iqr !== null))
    details.push(`First-to-last-block correct-GO IQR changed by ${signed(last.timing.iqr! - first.timing.iqr!)} ms in the baseline and ${signed(nextLast.timing.iqr! - nextFirst.timing.iqr!)} ms in the retest.`)
  if (b.postError.selected >= 4 && b.postError.comparison >= 12 && r.postError.selected >= 4 && r.postError.comparison >= 12 &&
    b.postError.deltaMs !== null && r.postError.deltaMs !== null) details.push(`Post-error response-time difference was ${signed(b.postError.deltaMs)} ms in the baseline and ${signed(r.postError.deltaMs)} ms in the retest.`)
  const goDelta = r.rates.hit - b.rates.hit, noGoDelta = r.rates.withhold - b.rates.withhold
  const opposite = goDelta * noGoDelta < 0
  const categoryDisclosure = opposite ? `GO hit rate ${goDelta > 0 ? 'increased' : 'decreased'}, while NO-GO correct-withhold rate ${noGoDelta > 0 ? 'increased' : 'decreased'}.` : null
  return Object.freeze({ baseline, retest, heading: 'Baseline and retest', exposure: COMPARISON_EXPOSURE,
    lines: Object.freeze(lines), details: Object.freeze(details), narrative: comparisonNarrative(accuracy(baseline), accuracy(retest), b.timing.median, r.timing.median),
    categoryDisclosure,
    limitation: 'This is a descriptive difference between two Assessment Practice sequences. It does not prove that the drill caused the change, that a stable trait changed, or that workplace performance will change.',
    formWarning: 'Assessment Practice forms share the same design rules but have not yet been calibrated as equivalent. Some change may reflect sequence difficulty or ordinary variation.',
    accommodation: baseline.setup.visualProfile === 'shape_accommodation_v1' ? 'Within this accommodation: High-distinction shape accommodation.' : null })
}

function compareStopV13(baseline: StopResult, retest: StopResult): StopComparison {
  const b = baseline.summarySnapshot, r = retest.summarySnapshot
  const bGo = b.counts.hits + b.counts.misses, rGo = r.counts.hits + r.counts.misses
  const bNoGo = b.counts.withholds + b.counts.falseAlarms, rNoGo = r.counts.withholds + r.counts.falseAlarms
  const sameMix = bGo === rGo && bNoGo === rNoGo
  const lines = [
    `GO hit rate changed from ${percent(b.rates.hit)}% (${b.counts.hits} of ${bGo}) to ${percent(r.rates.hit)}% (${r.counts.hits} of ${rGo}).`,
    `NO-GO correct-withhold rate changed from ${percent(b.rates.withhold)}% (${b.counts.withholds} of ${bNoGo}) to ${percent(r.rates.withhold)}% (${r.counts.withholds} of ${rNoGo}).`,
  ]
  if (sameMix) lines.unshift(`Overall accuracy changed from ${percent(b.rates.overall)}% to ${percent(r.rates.overall)}% (${signed((r.rates.overall - b.rates.overall) * 100)} percentage points).`)
  else lines.unshift('These sequences had different GO/NO-GO mixes, so compare the GO and NO-GO results separately.')
  const details = [
    `Baseline: ${b.counts.hits} hits and ${b.counts.misses} misses of ${bGo} GO; ${b.counts.withholds} correct withholds and ${b.counts.falseAlarms} false alarms of ${bNoGo} NO-GO.`,
    `Retest: ${r.counts.hits} hits and ${r.counts.misses} misses of ${rGo} GO; ${r.counts.withholds} correct withholds and ${r.counts.falseAlarms} false alarms of ${rNoGo} NO-GO.`,
  ]
  if (b.timing.count >= 5 && r.timing.count >= 5 && b.timing.median !== null && r.timing.median !== null)
    lines.push(`Median correct-GO response time changed from ${round(b.timing.median)} ms to ${round(r.timing.median)} ms (${signed(r.timing.median - b.timing.median)} ms).`)
  if (b.timing.count >= 7 && r.timing.count >= 7 && b.timing.iqr !== null && r.timing.iqr !== null)
    details.push(`Response-time variability changed from an IQR of ${round(b.timing.iqr)} ms to ${round(r.timing.iqr)} ms.`)
  const goDelta = r.rates.hit - b.rates.hit, noGoDelta = r.rates.withhold - b.rates.withhold
  return Object.freeze({ baseline, retest, heading: 'Baseline and retest', exposure: COMPARISON_EXPOSURE,
    lines: Object.freeze(lines), details: Object.freeze(details),
    narrative: sameMix ? comparisonNarrative(b.rates.overall, r.rates.overall,
      b.timing.count >= 5 ? b.timing.median : null, r.timing.count >= 5 ? r.timing.median : null) : null,
    categoryDisclosure: goDelta * noGoDelta < 0 ? `GO hit rate ${goDelta > 0 ? 'increased' : 'decreased'}, while NO-GO correct-withhold rate ${noGoDelta > 0 ? 'increased' : 'decreased'}.` : null,
    limitation: 'This is a descriptive difference between two Assessment Practice sequences. It does not prove that the drill caused the change, that a stable trait changed, or that workplace performance will change.',
    formWarning: 'Assessment Practice forms share the same design rules but have not yet been calibrated as equivalent. Some change may reflect sequence difficulty or ordinary variation.',
    accommodation: baseline.setup.visualProfile === 'shape_accommodation_v1' ? 'Within this accommodation: High-distinction shape accommodation.' : null })
}
