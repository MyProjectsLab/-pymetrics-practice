// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { compareStop, comparisonNarrative } from './comparison'
import type { StopResult } from './run'

function result(mode: 'baseline' | 'retest', hits: number, withholds: number, median: number | null, iqr: number | null,
  options: { profile?: 'standard' | 'shape_accommodation_v1'; binding?: string; scoring?: string } = {}): StopResult {
  const counts = { hits, misses: 60 - hits, withholds, falseAlarms: 20 - withholds }
  const block = { eligibleOutcomes: 20, accuracy: (hits + withholds) / 80,
    counts: { hits: 12, misses: 3, withholds: 4, falseAlarms: 1 }, hitRate: .8, falseAlarmRate: .2,
    timing: { count: median === null ? 0 : 12, median, iqr } }
  return { mode, validity: 'valid', sessionId: crypto.randomUUID(), form: { id: `stop-${mode}-01` },
    specificationVersion: '1.1', scoringVersion: options.scoring ?? 'stop_scoring_v1',
    setup: { visualProfile: options.profile ?? 'standard', binding: { code: options.binding ?? 'Space' }, physicalKeyboard: true },
    summarySnapshot: { counts, rates: { overall: (hits + withholds) / 80, hit: hits / 60, miss: (60 - hits) / 60,
      withhold: withholds / 20, falseAlarm: (20 - withholds) / 20 },
      timing: { count: median === null ? 0 : hits, median, iqr }, blocks: [block, block, block, block],
      postError: { selected: 0, comparison: 0, deltaMs: null } },
  } as unknown as StopResult
}

describe('S53–S54 separate overall-first §20.4 comparison', () => {
  it('matches the founder worked example, including exact trade-off and opposite GO/NO-GO disclosure', () => {
    const comparison = compareStop(result('baseline', 42, 18, 400, 100), result('retest', 54, 14, 450, 90))!
    expect(comparison.heading).toBe('Baseline and retest')
    expect(comparison.lines).toEqual([
      'Overall accuracy changed from 75% to 85% (+10 percentage points).',
      'GO hit rate changed from 70% to 90%.',
      'NO-GO correct-withhold rate changed from 90% to 70%.',
      'Median correct-GO response time changed from 400 ms to 450 ms (+50 ms).',
      'Response-time variability changed from an IQR of 100 ms to 90 ms.',
    ])
    expect(comparison.narrative).toBe('The retest was more accurate and slower.')
    expect(comparison.categoryDisclosure).toBe('GO hit rate increased, while NO-GO correct-withhold rate decreased.')
    expect(comparison.exposure).toContain('records retained in this tab')
    expect(comparison.formWarning).toContain('not yet been calibrated as equivalent')
  })
  it('uses 10-point/50-ms boundaries and numbers only for 5–<10 points', () => {
    expect(comparisonNarrative(.75, .85, 400, 450)).toBe('The retest was more accurate and slower.')
    expect(comparisonNarrative(.85, .75, 450, 400)).toBe('The retest was faster and less accurate.')
    expect(comparisonNarrative(.75, .85, 400, 449)).toBeNull()
    expect(comparisonNarrative(.75, .8375, 400, 450)).toBeNull()
  })
  it('suppresses only unsupported timing, and rejects incompatible profile, binding, and scoring', () => {
    const base = result('baseline', 42, 18, null, null)
    const clean = result('retest', 54, 14, 450, 90)
    expect(compareStop(base, clean)?.lines).toEqual([
      'Overall accuracy changed from 75% to 85% (+10 percentage points).',
      'GO hit rate changed from 70% to 90%.',
      'NO-GO correct-withhold rate changed from 90% to 70%.',
    ])
    expect(compareStop(base, clean)?.narrative).toBeNull()
    expect(compareStop(base, result('retest', 54, 14, 450, 90, { profile: 'shape_accommodation_v1' }))).toBeNull()
    expect(compareStop(base, result('retest', 54, 14, 450, 90, { binding: 'KeyF' }))).toBeNull()
    expect(compareStop(base, result('retest', 54, 14, 450, 90, { scoring: 'other' }))).toBeNull()
    expect(compareStop(result('baseline', 42, 18, 400, 100, { profile: 'shape_accommodation_v1' }),
      result('retest', 54, 14, 450, 90, { profile: 'shape_accommodation_v1' }))?.accommodation).toContain('Within this accommodation')
  })
})
