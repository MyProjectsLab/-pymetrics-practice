import type { TimingIssue } from './contracts'

/** Stable repository rule identifiers: mapped to frozen Stop V1.1 §14, not product copy. */
export const RULE = Object.freeze({
  hidden: 'stop_validity_v1.hidden',
  lifecycle: 'stop_validity_v1.lifecycle',
  blur: 'stop_validity_v1.blur_over_1000ms',
  viewport: 'stop_validity_v1.viewport_below_768x600',
  settings: 'stop_validity_v1.settings_changed',
  severeTiming: 'stop_validity_v1.severe_timing',
  repeatedTiming: 'stop_validity_v1.two_timing_anomalies',
  timingNote: 'stop_validity_v1.one_timing_anomaly',
  warmupTiming: 'stop_validity_v1.second_warmup_anomaly',
  anticipatory: 'stop_validity_v1.three_anticipatory',
  premature: 'stop_validity_v1.three_premature',
  wrong: 'stop_validity_v1.five_wrong_keys',
  extraNote: 'stop_validity_v1.five_extra_inputs',
  extra: 'stop_validity_v1.ten_extra_inputs',
  integrity: 'stop_validity_v1.integrity',
})

export type Severity = 'clean' | 'non_severe' | 'severe'
export function timingSeverity(issue: TimingIssue, actual: number, fixationMs = 1200): Severity {
  if (!Number.isFinite(actual) || actual < 0 || issue === 'timestamp' || issue === 'integrity') return 'severe'
  if (issue === 'visibility') {
    if (actual < 100 || actual > 500) return 'severe'
    return actual < 150 || actual > 250 ? 'non_severe' : 'clean'
  }
  if (issue === 'post_resolution') {
    if (actual > fixationMs + 500) return 'severe'
    return actual < fixationMs - 100 || actual > fixationMs + 100 ? 'non_severe' : 'clean'
  }
  if (actual > 500) return 'severe'
  return issue !== 'transition' && actual > 100 ? 'non_severe' : 'clean'
}
