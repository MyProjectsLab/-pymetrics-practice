// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { percentile, round, scoreStop, speedAccuracy, timing } from './scoring'
import type { Block } from './scoring'
import type { StopFormManifest, StopTrialOutcome } from './contracts'
import type { EngineEvent } from './engine/contracts'
import { stopFormRegistry } from './forms'

// Independent outcome fixtures: expected values below are declared from counts and positions,
// not calculated by the scorer under test.
function journal(form: StopFormManifest, errors = new Set<number>(), times = new Map<number, number>(), anomalies = new Set<number>()) {
  const events: EngineEvent[] = []
  let sequenceNumber = 0
  const append = (type: string, payload: object) => events.push({ type, payload, sessionId: 'fixture', schemaVersion: 'stop_engine_event_v1', sequenceNumber: ++sequenceNumber, timestampMs: sequenceNumber } as EngineEvent)
  for (let index = 0; index < 80; index++) {
    const stimulus = form.sequence[index]
    const isError = errors.has(index + 1)
    const rt = times.get(index + 1) ?? 400
    const outcome: StopTrialOutcome = stimulus === 'GO'
      ? isError ? { stimulus, kind: 'miss', responseTimeMs: null } : { stimulus, kind: 'hit', responseTimeMs: rt }
      : isError ? { stimulus, kind: 'false_alarm', responseTimeMs: rt } : { stimulus, kind: 'correct_withhold', responseTimeMs: null }
    append('trial_scheduled', { trial: { phase: 'scored', index, stimulus }, eligibleAtMs: 0 })
    append('trial_resolved', { trialIndex: index, outcome, source: ['hit', 'false_alarm'].includes(outcome.kind) ? 'response' : 'timeout', resolvedAtMs: 0, triggerSequenceNumber: sequenceNumber })
    if (anomalies.has(index + 1)) append('timing_anomaly', { trialIndex: index, issues: ['visibility'], severity: 'non_severe', expectedMs: 200, observedMs: 251 })
  }
  return events
}
const base = stopFormRegistry.all.find(f => f.family === 'baseline')!

describe('M3 independently calculated scoring fixtures', () => {
  it('reproduces 57/3/17/3 and exact denominator rates (S27, S72)', () => {
    const goErrors = base.sequence.flatMap((s, i) => s === 'GO' ? [i + 1] : []).slice(0, 3)
    const noErrors = base.sequence.flatMap((s, i) => s === 'NO_GO' ? [i + 1] : []).slice(0, 3)
    const summary = scoreStop(journal(base, new Set([...goErrors, ...noErrors])), base)
    expect(summary.counts).toEqual({ hits: 57, misses: 3, withholds: 17, falseAlarms: 3 })
    expect([summary.rates.hit, summary.rates.miss, summary.rates.withhold, summary.rates.falseAlarm, summary.rates.overall].map(x => round(x * 100))).toEqual([95, 5, 85, 15, 93])
    expect(summary.halves.reduce((total, half) => total + half.hits, 0)).toBe(57)
    expect(summary.blocks.map(b => b.counts.hits + b.counts.misses)).toEqual([15, 15, 15, 15])
  })
  it('uses inclusive quartiles with full-precision IQR and sparse values (S29)', () => {
    expect(timing([100, 101, 104, 105])).toEqual({ count: 4, q1: 100.75, median: 102.5, q3: 104.25, iqr: 3.5 })
    expect(round(timing([100, 101, 104, 105]).iqr!)).toBe(4)
    expect(timing([100, 150, 220, 330, 470, 1000]).iqr).toBe(267.5)
    expect(timing([438])).toEqual({ count: 1, q1: 438, median: 438, q3: 438, iqr: 0 })
    expect(percentile([], .5)).toBeNull()
  })
  it('retains anticipatory outcomes but excludes them and anomalous hits from timing (S28, S39)', () => {
    const go = base.sequence.flatMap((s, i) => s === 'GO' ? [i + 1] : []).slice(0, 4)
    const allOtherGo = base.sequence.flatMap((s, i) => s === 'GO' ? [i + 1] : []).slice(4)
    const times = new Map<number, number>([[go[0], 99], [go[1], 100], [go[2], 1000], [go[3], 500], ...allOtherGo.map(i => [i, 400] as [number, number])])
    const summary = scoreStop(journal(base, new Set([go[3]]), times, new Set([go[2]])), base)
    expect(summary.counts.hits).toBe(59)
    expect(summary.counts.misses).toBe(1)
    expect(summary.anticipatoryCount).toBe(1)
    expect(summary.timing.count).toBe(57) // 59 hits less 99 ms and anomalous 1000 ms
    expect(summary.blocks.reduce((n, b) => n + b.timing.count, 0)).toBe(57)
    const inclusive = scoreStop(journal(base, new Set([go[3]]), times), base)
    expect(inclusive.timing.count).toBe(58) // 1000 ms is eligible; 99 ms is not
  })
  it('rejects a missing resolution rather than estimating it (S43)', () => {
    const events = journal(base).filter(e => !(e.type === 'trial_resolved' && e.payload.trialIndex === 20))
    expect(() => scoreStop(events, base)).toThrow('Incomplete scored event record')
  })
  it('uses overlapping windows once and keeps initiating errors in their preceding-context cohort (S33)', () => {
    const noGo = new Set([3, 4, 8, 12, 16, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 68, 72, 76, 80])
    const form: StopFormManifest = { ...base, sequence: Array.from({ length: 80 }, (_, i) => noGo.has(i + 1) ? 'NO_GO' : 'GO') }
    const times = new Map([[5, 450], [23, 450], [43, 450], [63, 450]])
    const summary = scoreStop(journal(form, new Set([2, 4, 22, 42, 62]), times), form)
    expect(summary.counts).toEqual({ hits: 56, misses: 4, withholds: 19, falseAlarms: 1 })
    expect(summary.postError).toMatchObject({ selected: 4, comparison: 47, postAccuracy: 13 / 14, comparisonAccuracy: 62 / 66, deltaMs: 50 })
    expect(summary.postError.narrative).toContain('50 ms slower')
    const fewer = scoreStop(journal(form, new Set([2, 4, 22, 42]), times), form)
    expect(fewer.postError.selected).toBe(3)
    expect(fewer.postError.narrative).toBe('There were not enough qualifying trials to describe your response speed after errors.')
  })
  it('applies the 5–<10 point exception ahead of a 75 ms timing headline (S32)', () => {
    const block = (go: number, noGo: number, median: number): Block => ({ number: 1,
      counts: { hits: go, misses: 15 - go, withholds: noGo, falseAlarms: 5 - noGo },
      timing: { count: 13, q1: median, median, q3: median, iqr: 0 }, eligibleOutcomes: 20,
      accuracy: (go + noGo) / 20, hitRate: go / 15, withholdRate: noGo / 5, falseAlarmRate: (5 - noGo) / 5 })
    expect(speedAccuracy(block(14, 5, 500), block(15, 5, 425))).toContain('GO hit rate changed by 7 percentage points')
    expect(speedAccuracy(block(14, 5, 500), block(15, 5, 425))).not.toContain('faster with')
    expect(speedAccuracy(block(15, 5, 500), block(15, 5, 450))).toBe('faster with similar accuracy.')
    expect(speedAccuracy(block(15, 5, 500), block(15, 5, 451))).toContain('broadly stable')
    expect(speedAccuracy(block(15, 5, 500), block(13, 5, 450))).toBe('faster with lower accuracy (GO hit rate).')
    expect(speedAccuracy(block(14, 5, 500), block(15, 4, 425))).toContain('GO hit rate changed by 7 percentage points')
    const first = block(14, 4, 500)
    const modified = (points: number, lastTime: number): Block => ({ ...first, timing: { ...first.timing, median: lastTime },
      hitRate: first.hitRate + points / 100, withholdRate: first.withholdRate + points / 100,
      accuracy: first.accuracy + points / 100, falseAlarmRate: first.falseAlarmRate - points / 100 })
    expect(speedAccuracy(first, modified(9.999, 425))).toContain('GO hit rate changed by 10 percentage points') // displayed rounding does not affect threshold
    expect(speedAccuracy(first, modified(10, 451))).toBe('From the first to the final block, GO hit rate increased by 10 percentage points.')
  })
})

describe('B2 primary-observation priority', () => {
  const first: Block = { number: 1, counts: { hits: 12, misses: 3, withholds: 4, falseAlarms: 1 },
    timing: timing(Array(12).fill(400)), eligibleOutcomes: 20, accuracy: .8, hitRate: .8, withholdRate: .8, falseAlarmRate: .2 }
  const last = (go: number, noGo: number, delta = 0): Block => ({ ...first,
    hitRate: .8 + go / 100, withholdRate: .8 + noGo / 100, falseAlarmRate: .2 - noGo / 100,
    accuracy: .8 + (go * .75 + noGo * .25) / 100, timing: timing(Array(15).fill(400 + delta)) })
  it('selects false-alarm change in the audit 12/15→15/15 and 4/5→5/5 fixture', () => {
    const go = base.sequence.slice(0, 20).flatMap((s, i) => s === 'GO' ? [i + 1] : []).slice(0, 3)
    const noGo = base.sequence.slice(0, 20).findIndex(s => s === 'NO_GO') + 1
    const s = scoreStop(journal(base, new Set([...go, noGo])), base)
    expect(s.blocks[0].counts).toEqual({ hits: 12, misses: 3, withholds: 4, falseAlarms: 1 })
    expect(s.blocks[3].counts).toEqual({ hits: 15, misses: 0, withholds: 5, falseAlarms: 0 })
    expect(s.speedAccuracy).toBe('From the first to the final block, false-alarm rate decreased by 20 percentage points.')
  })
  it.each([14.999, 15, 15.001])('uses unrounded false-alarm priority at %s pp', change => {
    expect(speedAccuracy(first, last(10, change))).toContain(change < 15 ? 'GO hit rate increased' : 'false-alarm rate decreased')
    expect(speedAccuracy(first, last(-10, -change))).toContain(change < 15 ? 'GO hit rate decreased' : 'false-alarm rate increased')
  })
  it.each([9.999, 10, 10.001])('uses unrounded hit-rate priority at %s pp', change => {
    expect(speedAccuracy(first, last(change, change))).toContain(change < 10 ? 'GO hit rate changed by' : 'GO hit rate increased by')
  })
  it('prioritizes a trade-off over qualifying false-alarm and hit-rate changes', () => {
    expect(speedAccuracy(first, last(20, 20, 50))).toBe('slower and more accurate.')
    expect(speedAccuracy(first, last(-20, -20, -50))).toBe('faster with lower accuracy.')
    expect(speedAccuracy(first, last(20, 20, 49))).toContain('false-alarm rate decreased')
  })
  it('keeps numbers-only and category concentration ahead of priority selection', () => {
    expect(speedAccuracy(first, last(6, 20, -75))).toContain('GO hit rate changed by') // selected overall = 9.5 pp
    expect(speedAccuracy(first, last(10, -5, -75))).toContain('GO hit rate changed by')
    expect(speedAccuracy(first, last(10, -4.999, 50))).toBe('From the first to the final block, GO hit rate changed by 10 percentage points, NO-GO correct-withhold rate by -5 points, and median correct-GO response time by 50 ms.')
  })
  it.each([
    [10, -4.999, 0, '10', '-5'],
    [10, -4.999, 50, '10', '-5'],
    [-10, 4.999, -50, '-10', '5'],
    [10, -5, 0, '10', '-5'],
    [10, -5, 50, '10', '-5'],
    [-10, 5, 0, '-10', '5'],
    [-10, 5, -50, '-10', '5'],
  ])('reports opposite category changes numerically at GO %s / NO-GO %s / timing %s', (go, noGo, delta, displayGo, displayNoGo) => {
    expect(speedAccuracy(first, last(go, noGo, delta))).toBe(`From the first to the final block, GO hit rate changed by ${displayGo} percentage points, NO-GO correct-withhold rate by ${displayNoGo} points, and median correct-GO response time by ${delta} ms.`)
  })
  it.each([49, 50, 74, 75])('retains timing classification at %s ms without a higher-priority change', delta => {
    expect(speedAccuracy(first, last(0, 0, -delta))).toContain(delta < 50 ? 'broadly stable' : 'faster with similar accuracy')
  })
  it('preserves priority for every sufficient complete 15/5 block pair', () => {
    const complete = (go: number, noGo: number, rt: number): Block => ({
      number: 1, counts: { hits: go, misses: 15 - go, withholds: noGo, falseAlarms: 5 - noGo },
      timing: timing(Array(go).fill(rt)), eligibleOutcomes: 20,
      accuracy: (go + noGo) / 20, hitRate: go / 15, withholdRate: noGo / 5, falseAlarmRate: (5 - noGo) / 5,
    })
    const mismatches: string[] = []
    for (let go1 = 10; go1 <= 15; go1++) for (let go4 = 10; go4 <= 15; go4++)
      for (let noGo1 = 0; noGo1 <= 5; noGo1++) for (let noGo4 = 0; noGo4 <= 5; noGo4++)
        for (const delta of [-75, -74, -50, -49, 0, 49, 50, 74, 75]) {
          const goChange = (go4 - go1) * 100 / 15
          const noGoChange = (noGo4 - noGo1) * 20
          const accuracyChange = noGoChange === 0 && goChange !== 0 ? goChange
            : goChange === 0 && noGoChange !== 0 ? noGoChange : (go4 + noGo4 - go1 - noGo1) * 5
          const expected = goChange * noGoChange < 0 || (Math.abs(accuracyChange) >= 5 && Math.abs(accuracyChange) < 10)
            ? 'GO hit rate changed by'
            : delta <= -50 && accuracyChange <= -10 ? 'faster with lower accuracy'
              : delta >= 50 && accuracyChange >= 10 ? 'slower and more accurate'
                : Math.abs(noGoChange) >= 15 ? 'false-alarm rate'
                  : Math.abs(goChange) >= 10 ? 'GO hit rate'
                    : delta <= -50 && Math.abs(accuracyChange) < 5 ? 'faster with similar accuracy'
                      : delta >= 50 && Math.abs(accuracyChange) < 5 ? 'slower with similar accuracy' : 'broadly stable'
          const actual = speedAccuracy(complete(go1, noGo1, 400), complete(go4, noGo4, 400 + delta))
          if (!actual.includes(expected)) mismatches.push(`${go1}/${noGo1} → ${go4}/${noGo4}, ${delta} ms: expected ${expected}; got ${actual}`)
        }
    expect(mismatches).toEqual([])
  })
  it('puts sufficiency before every directional observation', () => {
    expect(speedAccuracy({ ...first, timing: timing(Array(9).fill(400)) }, last(20, 20))).toContain('not enough clean data')
    expect(speedAccuracy({ ...first, counts: { ...first.counts, misses: -1 } }, last(20, 20))).toContain('not enough clean data')
    expect(speedAccuracy({ ...first, counts: { ...first.counts, withholds: 2 } }, last(20, 20))).toContain('not enough clean data')
  })
})
