// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { fixture } from './fixture'
import { createStopEngine } from './engine'
import { RULE } from './rules'
import type { Setting } from './contracts'

describe('Stop protected interval interruptions', () => {
  it.each([999, 1000, 1001])('handles visible blur lasting %i ms', duration => {
    const f = fixture({ autoStart: false })
    f.engine.focus(false)
    f.advance(duration)
    f.engine.focus(true)
    expect(f.engine.snapshot().invalidRule).toBe(duration > 1000 ? RULE.blur : null)
    if (duration <= 1000) expect(f.ofType('focus_changed').at(-1)?.payload.durationMs).toBe(duration)
  })
  it('invalidates a long blur without waiting for focus to return or another input', () => {
    const f = fixture({ autoStart: false })
    f.engine.focus(false)
    f.advance(1000)
    expect(f.engine.snapshot().invalidRule).toBeNull()
    f.advance(1000.001)
    expect(f.engine.snapshot().invalidRule).toBe(RULE.blur)
  })
  it('repeated exact 1,000 ms blurs never invalidate by count alone', () => {
    const f = fixture({ autoStart: false })
    for (let i = 0; i < 10; i++) {
      f.engine.focus(false)
      f.advance((i + 1) * 1000)
      f.engine.focus(true)
    }
    expect(f.ofType('focus_changed')).toHaveLength(20)
    expect(f.engine.snapshot().quality).toBe('clean')
  })
  it('does not restart the blur timer on duplicate blur notifications', () => {
    const f = fixture({ autoStart: false })
    f.engine.focus(false)
    f.advance(999)
    f.engine.focus(false)
    f.advance(1001)
    expect(f.engine.snapshot().invalidRule).toBe(RULE.blur)
  })
  it('continues protecting focus while a batch is awaiting arming', () => {
    const f = fixture({ autoStart: false })
    f.engine.focus(false)
    f.advance(100)
    f.engine.start(f.definitions)
    f.advance(1001)
    expect(f.engine.snapshot().invalidRule).toBe(RULE.blur)
  })
  it('requires focus before beginning initial fixation', () => {
    const f = fixture({ autoStart: false })
    f.engine.focus(false)
    f.engine.start(f.definitions)
    f.advance(999)
    expect(f.ofType('fixation_started')).toHaveLength(0)
    f.engine.focus(true)
    f.advance(1999)
    expect(f.ofType('stimulus_presented')[0].timestampMs).toBe(1999)
  })
  it.each([0, 999, 1100, 1500, 3200])('hidden document invalidates immediately at %i', at => {
    const f = fixture()
    f.advance(at)
    f.engine.visibility(false)
    expect(f.engine.snapshot().invalidRule).toBe(RULE.hidden)
    expect(f.ofType('session_invalidated')[0].timestampMs).toBe(at)
    f.engine.visibility(true)
    expect(f.engine.snapshot().state).toBe('invalid')
  })
  it.each(['pagehide', 'freeze', 'resume', 'pageshow'] as const)('%s invalidates, never restoring an interrupted run', lifecycle => {
    const f = fixture()
    f.advance(1100)
    f.engine.lifecycle(lifecycle)
    expect(f.engine.snapshot().invalidRule).toBe(RULE.lifecycle)
    f.engine.lifecycle('resume')
    f.engine.lifecycle('pageshow')
    expect(f.ofType('session_invalidated')).toHaveLength(1)
  })
  it.each([[768, 600, false], [767, 600, true], [768, 599, true], [320, 600, true], [NaN, 600, true]] as const)('checks viewport %s × %s', (width, height, invalid) => {
    const f = fixture()
    f.engine.resize(width, height)
    expect(f.engine.snapshot().invalidRule).toBe(invalid ? RULE.viewport : null)
  })
  it.each<Setting>(['response_key', 'visual_profile', 'timing_profile', 'input_device_class', 'accessibility'])('invalidates %s changes', setting => {
    const f = fixture()
    f.engine.settingChanged(setting)
    expect(f.engine.snapshot().invalidRule).toBe(RULE.settings)
  })
  it('stops all score-affecting callbacks and input after invalidation', () => {
    const f = fixture({ stimuli: ['GO', 'NO_GO'] })
    f.advance(1100)
    const savedFrameCallback = f.confirmations[0].confirm
    f.engine.visibility(false)
    const snapshot = f.engine.snapshot()
    f.engine.keyDown(' ')
    f.engine.keyUp(' ')
    savedFrameCallback()
    f.advance(20000)
    expect(f.engine.snapshot()).toEqual(snapshot)
    expect(() => f.engine.start(f.definitions)).toThrow()
  })
  it('preserves an already resolved outcome, but cancels advancement after invalidation', () => {
    const f = fixture({ stimuli: ['GO', 'NO_GO'] })
    f.press(1350)
    f.engine.lifecycle('freeze')
    f.advance(20000)
    expect(f.engine.snapshot().results).toHaveLength(1)
    expect(f.ofType('stimulus_presented')).toHaveLength(1)
  })
  it('uses the causal event sequence for each invalidation', () => {
    const f = fixture()
    f.advance(1100)
    f.engine.visibility(false)
    const invalidation = f.ofType('session_invalidated')[0]
    expect(f.events.find(e => e.sequenceNumber === invalidation.payload.triggerSequenceNumber)?.type).toBe('visibility_changed')
    expect(invalidation.payload.triggerSequenceNumber).toBeLessThan(invalidation.sequenceNumber)
  })
  it('keeps protection after the final interval until the caller completion boundary', () => {
    const f = fixture()
    f.advance(3200)
    expect(f.engine.snapshot().state).toBe('waiting')
    f.engine.endProtection()
    f.engine.visibility(false)
    expect(f.engine.snapshot().state).toBe('closed')
    expect(f.engine.snapshot().invalidRule).toBeNull()
  })
})

it('restarts on the first bad warm-up clock sample and ends preparation on the second', () => {
  let time = 0
  const engine = createStopEngine({ sessionId: 'warmup-clock', responseKey: 'Space', deferProtection: true,
    clock: () => time, scheduler: { at: () => () => {}, after: () => () => {} },
    frames: { request: () => () => {} }, sink: () => {},
  })
  const warmup = [{ phase: 'warmup' as const, index: 0, stimulus: 'GO' as const }]
  engine.begin(); engine.armWarmup(); engine.start(warmup)
  time = -1; engine.visibility(true)
  expect(engine.snapshot().state).toBe('warmup_restart_required')
  expect(engine.snapshot().events.some(event => event.type === 'session_invalidated')).toBe(false)
  time = 0; engine.armWarmup(); engine.start(warmup)
  time = -1; engine.visibility(true)
  expect(engine.snapshot().invalidRule).toBe(RULE.warmupTiming)
  expect(engine.snapshot().events.filter(event => event.type === 'timing_anomaly')).toHaveLength(2)
  expect(engine.snapshot().events.every((event, index, all) => !index || event.timestampMs >= all[index - 1].timestampMs)).toBe(true)
})
