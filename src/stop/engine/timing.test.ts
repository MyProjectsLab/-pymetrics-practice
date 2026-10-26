// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { fixture } from './fixture'
import { timingSeverity, RULE } from './rules'

const cases = [
  ['visibility', 99, 'severe'], ['visibility', 100, 'non_severe'],
  ['visibility', 149, 'non_severe'], ['visibility', 150, 'clean'],
  ['visibility', 250, 'clean'], ['visibility', 251, 'non_severe'],
  ['visibility', 500, 'non_severe'], ['visibility', 501, 'severe'],
  ['deadline', 100, 'clean'], ['deadline', 101, 'non_severe'],
  ['deadline', 500, 'non_severe'], ['deadline', 501, 'severe'],
  ['onset', 100, 'clean'], ['onset', 101, 'non_severe'],
  ['onset', 500, 'non_severe'], ['onset', 501, 'severe'],
  ['post_resolution', 1099, 'non_severe'], ['post_resolution', 1100, 'clean'],
  ['post_resolution', 1300, 'clean'], ['post_resolution', 1301, 'non_severe'],
  ['post_resolution', 1700, 'non_severe'], ['post_resolution', 1701, 'severe'],
  ['transition', 500, 'clean'], ['transition', 501, 'severe'],
] as const

describe('Stop §7–9 timing boundaries (synthetic frames)', () => {
  it.each([0, 99, 100, 199, 200, 201, 999, 1000])('accepts response at %i ms from confirmed onset', rt => {
    const f = fixture()
    f.press(1000 + rt)
    const response = f.ofType('response_accepted')[0]
    expect(response.payload.responseTimeMs).toBe(rt)
    expect(response.payload.anticipatory).toBe(rt < 100)
    expect(f.engine.snapshot().results[0].outcome.kind).toBe('hit')
    expect(f.engine.snapshot().results[0].timingExcluded).toBe(rt < 100)
    f.advance(1000 + Math.max(rt, 200) + 1200)
    expect(f.engine.snapshot().state).toBe('waiting')
    expect(f.ofType('trial_resolved')).toHaveLength(1)
    expect(f.ofType('stimulus_removed')[0].payload.visibleDurationMs).toBe(200)
  })
  it('treats 1,001 ms as late and preserves the timeout', () => {
    const f = fixture()
    f.press(2001)
    expect(f.ofType('response_accepted')).toHaveLength(0)
    expect(f.ofType('response_ignored').at(-1)?.payload.reason).toBe('late')
    expect(f.engine.snapshot().results[0].outcome.kind).toBe('miss')
    expect(f.engine.snapshot().results[0].resolvedAtMs).toBe(2000)
  })
  it('also closes an expired window when the timer has not been dispatched', () => {
    const f = fixture()
    f.advance(1200)
    f.setTime(2001)
    f.engine.keyDown(' ')
    expect(f.engine.snapshot().results[0].outcome.kind).toBe('miss')
    expect(f.ofType('response_ignored').at(-1)?.payload.reason).toBe('late')
  })
  it('keeps the exact 1,000 ms tie open before timeout dispatch', () => {
    const f = fixture()
    f.advance(2000)
    expect(f.ofType('trial_timed_out')).toHaveLength(0)
    f.engine.keyDown(' ')
    f.advance(2001)
    expect(f.ofType('trial_timed_out')).toHaveLength(0)
    expect(f.ofType('response_accepted')).toHaveLength(1)
  })
  it.each([['GO', 'miss'], ['NO_GO', 'correct_withhold']] as const)('resolves %s timeout as %s', (stimulus, kind) => {
    const f = fixture({ stimuli: [stimulus] })
    f.advance(3200)
    expect(f.engine.snapshot().results[0].outcome.kind).toBe(kind)
    expect(f.ofType('batch_finished')[0].timestampMs).toBe(3200)
  })
  it('resolves a NO-GO response as a false alarm', () => {
    const f = fixture({ stimuli: ['NO_GO'] })
    f.press(1350)
    expect(f.engine.snapshot().results[0].outcome.kind).toBe('false_alarm')
  })
  it.each(['warmup', 'scored'] as const)('waits 1,000 ms before the first %s frame', phase => {
    const f = fixture({ phase })
    f.advance(999)
    expect(f.ofType('stimulus_presented')).toHaveLength(0)
    f.advance(1000)
    expect(f.ofType('stimulus_presented')[0].timestampMs).toBe(1000)
  })
  it.each([99, 100, 199, 200, 350, 1000])('next onset follows the transition anchor for response at %i ms', rt => {
    const f = fixture({ stimuli: ['GO', 'NO_GO'] })
    f.press(1000 + rt)
    f.release(1001 + rt)
    f.advance(1000 + Math.max(rt, 200) + 1199)
    expect(f.ofType('stimulus_presented')).toHaveLength(1)
    f.advance(1000 + Math.max(rt, 200) + 1200)
    expect(f.ofType('stimulus_presented')[1].timestampMs).toBe(1000 + Math.max(rt, 200) + 1200)
  })
  it('next timeout-path onset follows 1,000 + 1,200 ms, ignoring timer dispatch lateness', () => {
    const f = fixture({ stimuli: ['GO', 'NO_GO'] })
    f.advance(3200)
    expect(f.ofType('stimulus_presented')[1].timestampMs).toBe(3200)
  })
  it('anchors to the confirmed frame, including delayed first and later frames', () => {
    const f = fixture({ stimuli: ['GO', 'GO'], frameDelay: r => r.kind === 'onset' ? 16 : 0 })
    f.press(1366)
    f.release(1367)
    f.advance(2582)
    expect(f.ofType('stimulus_presented').map(e => e.timestampMs)).toEqual([1016, 2582])
    expect(f.ofType('response_accepted')[0].payload.responseTimeMs).toBe(350)
    expect(f.ofType('stimulus_removed')[0].timestampMs).toBe(1216)
  })
  it('keeps the original eligible initial onset when its scheduler is late', () => {
    const f = fixture()
    f.setTime(1150)
    f.advance(1150)
    expect(f.ofType('stimulus_presented')[0].payload.eligibleAtMs).toBe(1000)
    expect(f.engine.snapshot().quality).toBe('with_note')
  })
})

describe('Stop §14 timing anomalies', () => {
  it('flags a delayed initial warm-up transition for the single restart', () => {
    const f = fixture({ phase: 'warmup' })
    f.setTime(1501)
    f.advance(1501)
    expect(f.engine.snapshot().state).toBe('warmup_restart_required')
    expect(f.ofType('stimulus_presented')).toHaveLength(0)
  })
  it('detects a severe missing offset even after an early outcome resolved', () => {
    const f = fixture({ frameDelay: r => r.kind === 'offset' ? 9999 : 0 })
    f.press(1100)
    f.advance(1501)
    expect(f.engine.snapshot().invalidRule).toBe(RULE.severeTiming)
    expect(f.engine.snapshot().results).toHaveLength(1)
    expect(f.engine.snapshot().results[0].timingExcluded).toBe(true)
    expect(f.ofType('batch_finished')).toHaveLength(0)
  })

  it.each(cases)('%s at %i is %s', (issue, value, severity) => expect(timingSeverity(issue, value)).toBe(severity))
  it.each([Number.NaN, Infinity, -1])('rejects incompatible timestamp %s', value => expect(timingSeverity('deadline', value)).toBe('severe'))
  it.each([99, 100, 149, 150, 250, 251, 500, 501])('evaluates confirmed visibility %i', visibility => {
    const f = fixture({ frameDelay: r => r.kind === 'offset' ? visibility - 200 : 0 })
    f.advance(1000 + visibility)
    const expected = timingSeverity('visibility', visibility)
    expect(f.engine.snapshot().quality).toBe(expected === 'clean' ? 'clean' : expected === 'severe' ? 'invalid' : 'with_note')
  })
  it('preserves accuracy but excludes the affected timing trial for one anomaly', () => {
    const f = fixture({ frameDelay: r => r.kind === 'offset' ? 51 : 0 })
    f.press(1350)
    f.advance(2550)
    expect(f.engine.snapshot()).toMatchObject({ state: 'waiting', quality: 'with_note' })
    expect(f.engine.snapshot().results[0]).toMatchObject({ outcome: { kind: 'hit' }, timingExcluded: true })
  })
  it('counts two separate timing observations, including on one trial', () => {
    const f = fixture({ frameDelay: r => r.kind === 'offset' ? 51 : 0 })
    f.advance(1251)
    f.setTime(2101)
    f.advance(2101)
    expect(f.engine.snapshot().invalidRule).toBe(RULE.repeatedTiming)
  })
  it.each([100, 101, 500, 501])('checks deadline callback lateness %i', delay => {
    const f = fixture()
    f.advance(1200)
    f.setTime(2000 + delay)
    f.advance(2000 + delay)
    expect(f.engine.snapshot().quality).toBe(delay <= 100 ? 'clean' : delay <= 500 ? 'with_note' : 'invalid')
  })
  it.each([100, 101, 500, 501])('checks onset confirmation lateness %i', delay => {
    const f = fixture({ frameDelay: r => r.kind === 'onset' ? delay : 0 })
    f.advance(1000 + delay)
    expect(f.engine.snapshot().quality).toBe(delay <= 100 ? 'clean' : delay <= 500 ? 'with_note' : 'invalid')
  })
  it('records a delayed post-resolution/onset transition as one observation with both bands', () => {
    const f = fixture({ stimuli: ['GO', 'GO'], frameDelay: r => r.kind === 'onset' && r.trial.index === 1 ? 101 : 0 })
    f.press(1350)
    f.advance(2651)
    expect(f.ofType('timing_anomaly')[0].payload.issues).toEqual(['onset', 'post_resolution'])
    expect(f.ofType('timing_anomaly')).toHaveLength(1)
    expect(f.engine.snapshot().quality).toBe('with_note')
  })
  it('checks the last post-resolution interval as well', () => {
    const f = fixture()
    f.press(1350)
    f.setTime(2651)
    f.advance(2651)
    expect(f.ofType('timing_anomaly')[0].payload.issues).toEqual(['post_resolution'])
    expect(f.engine.snapshot().results[0].timingExcluded).toBe(true)
  })
  it('stops on a missing frame instead of hanging', () => {
    const f = fixture({ frameDelay: () => 9999 })
    f.advance(1501)
    expect(f.engine.snapshot().invalidRule).toBe(RULE.severeTiming)
    expect(f.ofType('stimulus_presented')).toHaveLength(0)
  })
  it('allows one caller-controlled warm-up restart, then invalidates the next timing anomaly', () => {
    const f = fixture({ phase: 'warmup', frameDelay: r => r.kind === 'offset' ? 51 : 0 })
    f.advance(1251)
    expect(f.engine.snapshot().state).toBe('warmup_restart_required')
    expect(() => f.engine.start([{ phase: 'scored', index: 0, stimulus: 'GO' }])).toThrow()
    f.engine.start(f.definitions)
    f.advance(2502)
    expect(f.engine.snapshot().invalidRule).toBe(RULE.warmupTiming)
    expect(f.ofType('warmup_restart_required')).toHaveLength(1)
  })
})

describe('Founder clarification M2B-02 — confirmed transition anchor', () => {
  it.each(['GO', 'NO_GO'] as const)('records an early %s outcome immediately and leaves visibility intact', stimulus => {
    const f = fixture({ stimuli: [stimulus] })
    f.press(1099)
    expect(f.engine.snapshot().results[0]).toMatchObject({
      resolvedAtMs: 1099,
      outcome: { kind: stimulus === 'GO' ? 'hit' : 'false_alarm', responseTimeMs: 99 },
    })
    expect(f.ofType('trial_resolved')[0].timestampMs).toBe(1099)
    expect(f.ofType('stimulus_removed')).toHaveLength(0)
    expect(f.ofType('fixation_started').filter(e => e.payload.kind === 'post_resolution')).toHaveLength(0)
    expect(f.confirmations.find(c => c.request.kind === 'offset')?.request.notBeforeMs).toBe(1200)
    f.release(1100)
    f.press(1150)
    expect(f.ofType('response_ignored').at(-1)?.payload.reason).toBe('extra')
    f.advance(1199)
    expect(f.ofType('stimulus_removed')).toHaveLength(0)
    f.advance(1200)
    expect(f.ofType('stimulus_removed')[0].payload.visibleDurationMs).toBe(200)
    const fixation = f.ofType('fixation_started').filter(e => e.payload.kind === 'post_resolution')
    expect(fixation).toHaveLength(1)
    expect(fixation[0]).toMatchObject({ timestampMs: 1200, payload: { expectedAtMs: 1200 } })
    expect(fixation[0].sequenceNumber).toBeGreaterThan(f.ofType('stimulus_removed')[0].sequenceNumber)
    f.advance(2400)
    expect(f.ofType('trial_resolved')).toHaveLength(1)
    expect(f.ofType('timing_anomaly')).toHaveLength(0)
    expect(f.engine.snapshot().quality).toBe('clean')
  })

  it.each([
    [99, 201], [99, 216], [99, 250], [100, 250], [199, 250],
    [200, 250], [225, 250], [249, 250], [250, 250], [350, 250],
  ])('response at %i ms with valid offset at %i ms uses the later timestamp', (responseMs, offsetMs) => {
    const f = fixture({ stimuli: ['GO', 'NO_GO'], frameDelay: r => r.kind === 'offset' ? offsetMs - 200 : 0 })
    f.press(1000 + responseMs)
    expect(f.ofType('trial_resolved')[0].payload.resolvedAtMs).toBe(1000 + responseMs)
    if (responseMs < offsetMs) {
      expect(f.ofType('stimulus_removed')).toHaveLength(0)
      expect(f.ofType('fixation_started').filter(e => e.payload.kind === 'post_resolution')).toHaveLength(0)
    }
    f.release(1001 + responseMs)
    const anchor = 1000 + Math.max(responseMs, offsetMs)
    f.advance(anchor + 1199)
    expect(f.ofType('trial_scheduled')).toHaveLength(1)
    expect(f.ofType('stimulus_presented')).toHaveLength(1)
    expect(f.ofType('stimulus_removed')[0].payload.confirmedOffsetMs).toBe(1000 + offsetMs)
    expect(f.ofType('fixation_started').at(-1)?.payload.expectedAtMs).toBe(anchor)
    f.advance(anchor + 1200)
    expect(f.ofType('trial_scheduled')[1].payload.eligibleAtMs).toBe(anchor + 1200)
    expect(f.ofType('stimulus_presented')[1].timestampMs).toBe(anchor + 1200)
    expect(f.ofType('fixation_ended').at(-1)?.payload.expectedAtMs).toBe(anchor + 1200)
    expect(f.ofType('timing_anomaly')).toHaveLength(0)
    expect(f.engine.snapshot().quality).toBe('clean')
  })

  it.each([
    [99, 200, 1400], [100, 200, 1400], [199, 200, 1400], [200, 200, 1400],
    [350, 200, 1550], [null, 200, 2200], [99, 250, 1450], [225, 250, 1450],
    [250, 250, 1450], [350, 250, 1550], [null, 250, 2200],
  ])('final response %s / offset %i finishes at onset + %i ms', (responseMs, offsetMs, finishMs) => {
    const f = fixture({ frameDelay: r => r.kind === 'offset' ? offsetMs - 200 : 0 })
    if (responseMs !== null) f.press(1000 + responseMs)
    f.advance(1000 + finishMs - 1)
    expect(f.engine.snapshot().state).toBe('post_resolution')
    expect(f.ofType('batch_finished')).toHaveLength(0)
    f.advance(1000 + finishMs)
    expect(f.ofType('batch_finished')).toHaveLength(1)
    expect(f.ofType('batch_finished')[0].timestampMs).toBe(1000 + finishMs)
    expect(f.ofType('fixation_ended').at(-1)?.payload.expectedAtMs).toBe(1000 + finishMs)
    expect(f.engine.snapshot()).toMatchObject({ state: 'waiting', quality: 'clean' })
    expect(f.ofType('trial_scheduled')).toHaveLength(1)
    expect(f.ofType('trial_resolved')).toHaveLength(1)
    expect(f.ofType('timing_anomaly')).toHaveLength(0)
  })

  it('also handles a response delivered before offset confirmation at the same timestamp', () => {
    const f = fixture()
    f.advance(1199)
    f.setTime(1200)
    f.engine.keyDown(' ')
    expect(f.ofType('trial_resolved')[0].payload.resolvedAtMs).toBe(1200)
    expect(f.ofType('stimulus_removed')).toHaveLength(0)
    f.advance(1200)
    const fixation = f.ofType('fixation_started').filter(e => e.payload.kind === 'post_resolution')
    expect(fixation).toHaveLength(1)
    expect(fixation[0].payload.expectedAtMs).toBe(1200)
    f.advance(2400)
    expect(f.ofType('batch_finished')[0].timestampMs).toBe(2400)
    expect(f.engine.snapshot().quality).toBe('clean')
  })

  it('uses the first confirmed next frame after the corrected eligibility time', () => {
    const f = fixture({ stimuli: ['GO', 'NO_GO'], frameDelay: r => r.kind === 'onset' ? 16 : 50 })
    f.press(1115) // Confirmed onset 1,016; response time 99; confirmed offset 1,266.
    f.advance(2466)
    expect(f.ofType('trial_scheduled')[1].payload.eligibleAtMs).toBe(2466)
    expect(f.ofType('stimulus_presented')).toHaveLength(1)
    f.advance(2482)
    expect(f.ofType('stimulus_presented')[1].timestampMs).toBe(2482)
    expect(f.ofType('timing_anomaly')).toHaveLength(0)
  })

  it.each([false, true])('an anomalous offset produces only its real visibility anomaly (final=%s)', final => {
    const f = fixture({ stimuli: final ? ['GO'] : ['GO', 'NO_GO'], frameDelay: r => r.kind === 'offset' ? 51 : 0 })
    f.press(1099)
    f.advance(2451)
    expect(f.ofType('timing_anomaly').map(e => e.payload.issues)).toEqual([['visibility']])
    expect(f.engine.snapshot().quality).toBe('with_note')
    expect(final ? f.ofType('batch_finished')[0].timestampMs : f.ofType('stimulus_presented')[1].timestampMs).toBe(2451)
  })

  it.each([false, true])('measures real transition lateness from the corrected anchor (final=%s)', final => {
    const f = fixture({ stimuli: final ? ['GO'] : ['GO', 'NO_GO'], frameDelay: r => r.kind === 'offset' ? 50 : 0 })
    f.press(1099)
    f.advance(1250)
    f.setTime(2551) // Transition due 2,450; actual dispatch is 101 ms late.
    f.advance(2551)
    const anomalies = f.ofType('timing_anomaly')
    expect(anomalies).toHaveLength(1)
    expect(anomalies[0].payload).toMatchObject({ expectedMs: 2450, observedMs: 2551, severity: 'non_severe' })
    expect(anomalies[0].payload.issues).toEqual(final ? ['post_resolution'] : ['onset', 'post_resolution'])
    expect(f.engine.snapshot().quality).toBe('with_note')
  })

  it('does not start an interval after invalidation while waiting for offset', () => {
    const f = fixture()
    f.press(1099)
    f.engine.visibility(false)
    f.advance(5000)
    expect(f.ofType('fixation_started').filter(e => e.payload.kind === 'post_resolution')).toHaveLength(0)
    expect(f.ofType('batch_finished')).toHaveLength(0)
    expect(f.engine.snapshot().invalidRule).toBe(RULE.hidden)
  })

  it('does not start an interval when a warm-up offset requests a restart', () => {
    const f = fixture({ phase: 'warmup', frameDelay: r => r.kind === 'offset' ? 51 : 0 })
    f.press(1099)
    f.advance(1251)
    expect(f.engine.snapshot().state).toBe('warmup_restart_required')
    expect(f.ofType('fixation_started').filter(e => e.payload.kind === 'post_resolution')).toHaveLength(0)
    f.advance(5000)
    expect(f.ofType('batch_finished')).toHaveLength(0)
  })
})
