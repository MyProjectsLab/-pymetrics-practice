// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { fixture } from './fixture'
import { RULE } from './rules'

describe('Stop input resolution', () => {
  it('waits for an observed keyup before initial fixation when the key was held at entry', () => {
    const f = fixture({ held: true })
    f.press(2000, ' ', true)
    expect(f.engine.snapshot().state).toBe('arming')
    f.release(2001, 'x')
    expect(f.engine.snapshot().held).toBe(true)
    f.release(2002)
    f.advance(3001)
    expect(f.ofType('stimulus_presented')).toHaveLength(0)
    f.advance(3002)
    expect(f.ofType('stimulus_presented')[0].timestampMs).toBe(3002)
    expect(f.ofType('response_accepted')).toHaveLength(0)
  })
  it('requires keyup even if subsequent held keydowns omit the repeat flag', () => {
    const f = fixture()
    f.press(999)
    f.press(1100)
    expect(f.ofType('response_ignored').map(e => e.payload.reason)).toEqual(['fixation', 'held'])
    expect(f.ofType('response_accepted')).toHaveLength(0)
    f.release(1150)
    f.press(1200)
    expect(f.ofType('response_accepted')[0].payload.responseTimeMs).toBe(200)
  })
  it('ignores a repeated keydown even without a prior observed keydown, and waits for release', () => {
    const f = fixture()
    f.press(1100, ' ', true)
    f.press(1101)
    expect(f.ofType('response_ignored').map(e => e.payload.reason)).toEqual(['repeat', 'held'])
    f.release(1102)
    f.press(1103)
    expect(f.ofType('response_accepted')).toHaveLength(1)
  })
  it.each([' ', 'x'])('does not invalidate for 20 repeated %j events alone', key => {
    const f = fixture()
    for (let i = 0; i < 20; i++) f.press(1100 + i, key, true)
    expect(f.ofType('response_ignored').filter(e => e.payload.reason === 'repeat')).toHaveLength(20)
    expect(f.engine.snapshot().quality).toBe('clean')
    expect(f.engine.snapshot().counts.wrong).toBe(0)
    expect(f.ofType('response_accepted')).toHaveLength(0)
  })
  it('accepts only the first keydown and logs repeats and a second eligible press', () => {
    const f = fixture()
    f.press(1100)
    f.press(1101, ' ', true)
    f.release(1102)
    f.press(1103)
    expect(f.ofType('trial_resolved')).toHaveLength(1)
    expect(f.ofType('response_ignored').map(e => e.payload.reason)).toEqual(['repeat', 'extra'])
  })
  it('logs a wrong key without closing the response window', () => {
    const f = fixture()
    f.press(1100, 'x')
    expect(f.engine.snapshot().state).toBe('response')
    f.press(1350)
    expect(f.ofType('response_accepted')[0].payload.responseTimeMs).toBe(350)
  })
  it('uses the supplied preflight binding', () => {
    const f = fixture({ key: 'f' })
    f.press(1100, ' ')
    f.press(1200, 'f')
    expect(f.ofType('response_ignored')[0].payload.reason).toBe('wrong_key')
    expect(f.ofType('response_accepted')[0].payload.responseTimeMs).toBe(200)
  })
  it('does not carry an extra key or a late key into the next trial', () => {
    const f = fixture({ stimuli: ['GO', 'GO'] })
    f.press(1350)
    f.release(1400)
    f.press(2001)
    f.press(2600)
    expect(f.ofType('response_ignored').map(e => e.payload.reason)).toEqual(['extra', 'late', 'held'])
    expect(f.ofType('response_accepted')).toHaveLength(1)
    f.release(2601)
    f.press(2650)
    expect(f.ofType('response_accepted')[1].payload.responseTimeMs).toBe(100)
  })
  it('logs fixation input while waiting for a next rendered frame and keeps it disarmed', () => {
    const f = fixture({ stimuli: ['GO', 'GO'], frameDelay: r => r.kind === 'onset' && r.trial.index === 1 ? 50 : 0 })
    f.press(1350)
    f.release(1400)
    f.press(2551)
    f.press(2650)
    expect(f.ofType('response_ignored').map(e => e.payload.reason)).toEqual(['fixation', 'held'])
    expect(f.ofType('response_accepted')).toHaveLength(1)
  })
  it('does not infer release when focus changes', () => {
    const f = fixture()
    f.press(999)
    f.engine.focus(false)
    f.advance(1000)
    f.engine.focus(true)
    f.press(1100)
    expect(f.ofType('response_ignored').at(-1)?.payload.reason).toBe('held')
  })
  it('does not score input reported while unfocused', () => {
    const f = fixture()
    f.advance(1100)
    f.engine.focus(false)
    f.press(1101)
    expect(f.ofType('response_ignored').at(-1)?.payload.reason).toBe('unfocused')
    expect(f.ofType('response_accepted')).toHaveLength(0)
  })
})

describe('Stop §14.4 thresholds', () => {
  it('invalidates on the third anticipatory outcome, while retaining all three outcomes', () => {
    const f = fixture({ stimuli: ['GO', 'NO_GO', 'GO'] })
    // M2B-02 onsets are 1,000, 2,400, and 3,800 ms.
    for (const at of [1099, 2499]) {
      f.press(at); f.release(at + 1)
      expect(f.engine.snapshot().invalidRule).toBeNull()
    }
    f.press(3899)
    expect(f.engine.snapshot().invalidRule).toBe(RULE.anticipatory)
    expect(f.engine.snapshot().results.map(r => r.outcome.kind)).toEqual(['hit', 'false_alarm', 'hit'])
    expect(f.engine.snapshot().results.every(r => r.timingExcluded)).toBe(true)
  })
  it('100 ms responses never increment the anticipatory count', () => {
    const f = fixture({ stimuli: ['GO', 'GO', 'GO'] })
    for (const at of [1100, 2500, 3900]) { f.press(at); f.release(at + 1) }
    expect(f.engine.snapshot().counts.anticipatory).toBe(0)
    expect(f.engine.snapshot().quality).toBe('clean')
  })
  it('invalidates on the third distinct scored fixation press', () => {
    const f = fixture()
    for (const at of [10, 20]) { f.press(at); f.release(at + 1) }
    expect(f.engine.snapshot().quality).toBe('clean')
    f.press(30)
    expect(f.engine.snapshot().invalidRule).toBe(RULE.premature)
    f.advance(10000)
    expect(f.ofType('stimulus_presented')).toHaveLength(0)
  })
  it('invalidates at five wrong inputs, not four', () => {
    const f = fixture()
    for (const at of [1100, 1101, 1102, 1103]) f.press(at, 'x')
    expect(f.engine.snapshot().quality).toBe('clean')
    f.press(1104, 'x')
    expect(f.engine.snapshot().invalidRule).toBe(RULE.wrong)
  })
  it('makes an extra-input note at five and invalidates at ten', () => {
    const f = fixture()
    f.press(1100)
    for (let i = 1; i <= 10; i++) {
      f.release(1100 + 2 * i)
      f.press(1101 + 2 * i)
      if (i === 4) expect(f.engine.snapshot().quality).toBe('clean')
      if (i >= 5 && i < 10) expect(f.engine.snapshot()).toMatchObject({ quality: 'with_note', invalidRule: null })
    }
    expect(f.engine.snapshot().notes).toContain(RULE.extraNote)
    expect(f.engine.snapshot().invalidRule).toBe(RULE.extra)
    expect(f.ofType('trial_resolved')).toHaveLength(1)
  })
  it('does not count warm-up wrong/fixation inputs toward scored-only thresholds', () => {
    const f = fixture({ phase: 'warmup' })
    for (let i = 0; i < 5; i++) {
      f.press(i * 3, 'x'); f.press(i * 3 + 1); f.release(i * 3 + 2)
    }
    expect(f.engine.snapshot().counts).toEqual({ anticipatory: 0, premature: 0, wrong: 0, extra: 0 })
    expect(f.engine.snapshot().quality).toBe('clean')
  })
})
