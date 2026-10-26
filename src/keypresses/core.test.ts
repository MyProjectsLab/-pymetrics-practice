import { describe, expect, it } from 'vitest'
import { arm, advance, DELAYS_MS, TARGET, verify } from './core-v101'
import type { Command, Setup, State } from './core-v101'
import { report } from './report-v101'

const setup: Setup = { sessionId: 'kp-test-1', selectedKey: 'Space', hand: 'right', profile: 'standard_physical', delayIndex: 0 }
function step(state: State, ...commands: Command[]) { return commands.reduce(advance, state) }
function complete() {
  let state = step(arm(setup, 100), { kind: 'go', atMs: 1_900 })
  for (let i = 0; i < TARGET; i++) {
    const atMs = 2_000 + i * 100
    state = step(state, { kind: 'keydown', atMs, repeat: false }, { kind: 'keyup', atMs: atMs + 1 })
  }
  return step(state, { kind: 'end', atMs: 5_910 }, { kind: 'keydown', atMs: 6_000, repeat: false },
    { kind: 'keyup', atMs: 6_001 }, { kind: 'close', atMs: 6_910 })
}

describe('Keypresses headless core', () => {
  it('accepts every proposed delay and rejects an early GO frame', () => {
    DELAYS_MS.forEach((delay, index) => {
      const initial = arm({ ...setup, delayIndex: index }, 10)
      expect(() => advance(initial, { kind: 'go', atMs: delay + 9 })).toThrow()
      expect(advance(initial, { kind: 'go', atMs: delay + 10 }).goOnsetMs).toBe(delay + 10)
    })
  })

  it('reconciles a 40-press completion, timing, and distinct late input', () => {
    const state = complete()
    expect(state.phase).toBe('completed')
    expect(state.events.map(e => e.sequenceNumber)).toEqual(state.events.map((_, i) => i + 1))
    expect(verify(state)).toBe(true)
    expect(report(state)).toMatchObject({ status: 'valid', invalidationReason: null, acceptedCount: 40, firstPressMs: 100,
      targetTimeMs: 4_000, ratePerSecond: 10, medianIntervalMs: 100, iqrIntervalMs: 0, lateCount: 1 })
  })

  it('counts an early press once, suppresses held/repeat input, and needs a release after GO', () => {
    const waiting = step(arm(setup, 0), { kind: 'keydown', atMs: 100, repeat: false },
      { kind: 'keydown', atMs: 101, repeat: true }, { kind: 'go', atMs: 1_800 },
      { kind: 'keydown', atMs: 1_801, repeat: false }, { kind: 'keyup', atMs: 1_802 },
      { kind: 'keydown', atMs: 1_803, repeat: false })
    expect(report(waiting)).toMatchObject({ earlyCount: 1, acceptedCount: 1 })
  })

  it('keeps the exact deadline out of accepted input and distinguishes boundary presses', () => {
    const state = step(arm(setup, 0), { kind: 'go', atMs: 1_800 },
      { kind: 'keydown', atMs: 16_800, repeat: false }, { kind: 'keyup', atMs: 16_801 },
      { kind: 'end', atMs: 16_810 }, { kind: 'keydown', atMs: 16_820, repeat: false },
      { kind: 'keyup', atMs: 16_821 }, { kind: 'close', atMs: 17_810 })
    expect(report(state)).toMatchObject({ status: 'valid', acceptedCount: 0, targetTimeMs: null,
      boundaryCount: 1, lateCount: 1 })
    expect(state.events.find(e => e.type === 'logical_end')?.timestampMs).toBe(16_800)
  })

  it('retains monotonic ordering when a release arrives after the logical deadline', () => {
    const state = step(arm(setup, 0), { kind: 'go', atMs: 1_800 },
      { kind: 'keyup', atMs: 16_850 }, { kind: 'deadline', atMs: 16_900 })
    expect(verify(state)).toBe(true)
    expect(state.events.map(e => e.timestampMs)).toEqual([0, 1_800, 16_850, 16_900])
    expect(state.logicalEndMs).toBe(16_800)
  })

  it('invalidates late presentation and deadline callbacks without a valid report', () => {
    const lateGo = advance(arm(setup, 0), { kind: 'go', atMs: 3_801 })
    expect(report(lateGo)).toMatchObject({ status: 'invalid', invalidationReason: 'go_timeout' })
    const live = step(arm(setup, 0), { kind: 'go', atMs: 1_800 })
    expect(report(advance(live, { kind: 'deadline', atMs: 17_051 }))).toMatchObject({ status: 'invalid', invalidationReason: 'deadline_delay' })
    const ended = advance(live, { kind: 'deadline', atMs: 16_800 })
    expect(report(advance(ended, { kind: 'end', atMs: 17_051 }))).toMatchObject({ status: 'invalid', invalidationReason: 'end_timeout' })
  })

  it('rejects altered journals, settings, commands and summaries', () => {
    const good = complete()
    expect(report({ ...good, accepted: [123] })).toBeNull()
    expect(report({ ...good, setup: { ...good.setup, selectedKey: 'F' } })).toBeNull()
    expect(report({ ...good, setup: { ...good.setup, selectedKey: ['Space'] as unknown as string } })).toBeNull()
    expect(report({ ...good, events: good.events.slice(1) })).toBeNull()
    expect(report({ ...good, events: good.events.map((e, i) => i === 5 ? { ...e, type: 'keydown_late' as const } : e) })).toBeNull()
    expect(report({ ...good, commands: [...good.commands.slice(0, 1),
      { kind: 'unsupported', atMs: 999_999 } as unknown as Command, ...good.commands.slice(1)] })).toBeNull()
    expect(report({ ...good, commands: good.commands.map((command, i) => i === 1 ?
      { kind: 'keydown', atMs: command.atMs } as Command : command) })).toBeNull()
    expect(report({ ...good, specificationVersion: 'unsupported' as typeof good.specificationVersion })).toBeNull()
    expect(report({ ...good, inputProfileVersion: 'unsupported' as typeof good.inputProfileVersion })).toBeNull()
  })

  it('rejects modifier bindings and preserves achieved target separately from validity', () => {
    expect(() => arm({ ...setup, selectedKey: 'ShiftLeft' }, 0)).toThrow()
    expect(() => arm({ ...setup, selectedKey: 'F1' }, 0)).toThrow()
    expect(() => arm({ ...setup, selectedKey: ['Space'] as unknown as string }, 0)).toThrow()
    let state = step(arm(setup, 0), { kind: 'go', atMs: 1_800 })
    for (let i = 0; i < TARGET; i++) {
      const atMs = 1_800 + i * 100
      state = step(state, { kind: 'keydown', atMs, repeat: false }, { kind: 'keyup', atMs })
    }
    state = advance(state, { kind: 'invalidate', atMs: 5_701, reason: 'blur' })
    expect(report(state)).toMatchObject({ status: 'invalid', invalidationReason: 'blur', acceptedCount: 40,
      targetReached: true, targetTimeMs: 3_900 })
  })
})
