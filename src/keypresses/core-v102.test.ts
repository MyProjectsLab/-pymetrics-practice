import { describe, expect, it } from 'vitest'
import { arm, advance } from './core'
import type { Command, State } from './core'
import { report } from './report'
import { arm as armV101, advance as advanceV101 } from './core-v101'

const setup = { sessionId: 'kp-v102-test', selectedKey: 'Space', hand: 'right', profile: 'standard_physical', delayIndex: 0 } as const
function step(state: State, ...commands: Command[]) { return commands.reduce(advance, state) }
function start() { return step(arm(setup, 0), { kind: 'go', atMs: 1800 }) }
function press(state: State, up: number, down = up - 1) {
  return step(state, { kind: 'keydown', atMs: down, repeat: false, trusted: true },
    { kind: 'keyup', atMs: up, trusted: true })
}
function finish(state: State) {
  if (state.phase === 'active') state = step(state, { kind: 'deadline', atMs: 16800 })
  const end = state.logicalEndMs!
  return step(state, { kind: 'end', atMs: end }, { kind: 'close', atMs: end + 1000 })
}

describe('Keypresses V1.0.2 trusted pairs and validity', () => {
  it('keeps a saved V1.0.1 result under its original down-count rules', () => {
    let historical = advanceV101(armV101(setup, 0), { kind: 'go', atMs: 1800 })
    historical = advanceV101(historical, { kind: 'keydown', atMs: 2000, repeat: false })
    historical = advanceV101(historical, { kind: 'deadline', atMs: 16800 })
    historical = advanceV101(historical, { kind: 'end', atMs: 16800 })
    historical = advanceV101(historical, { kind: 'close', atMs: 17800 })
    expect(report(historical as unknown as State)).toMatchObject({
      specificationVersion: 'keypresses_spec_v1_0_1', acceptedCount: 1, status: 'valid',
    })
  })
  it('counts only a matching trusted up, not a down or repeat', () => {
    let state = step(start(), { kind: 'keydown', atMs: 2000, repeat: false, trusted: true })
    expect(state.accepted).toHaveLength(0)
    state = step(state, { kind: 'keyup', atMs: 2010, trusted: true })
    expect(state.accepted).toEqual([2010])
    state = step(state, { kind: 'keyup', atMs: 2020, trusted: true })
    expect(state.accepted).toEqual([2010])
  })
  it('rejects a held key or observed OS repeat, without counting repeated downs', () => {
    let held = step(start(), { kind: 'keydown', atMs: 2000, repeat: false, trusted: true })
    expect(report(finish(held))).toMatchObject({ status: 'invalid', invalidationReason: 'implausible_input', acceptedCount: 0 })
    held = step(held, { kind: 'keydown', atMs: 2100, repeat: true, trusted: true }, { kind: 'keyup', atMs: 2200, trusted: true })
    expect(report(finish(held))).toMatchObject({ status: 'invalid', invalidationReason: 'implausible_input', acceptedCount: 1 })
  })
  it('ignores untrusted selected-key events without invalidating genuine taps', () => {
    let state = step(start(), { kind: 'keydown', atMs: 1998, repeat: false, trusted: false },
      { kind: 'keyup', atMs: 1999, trusted: false })
    for (let i = 0; i < 40; i++) state = press(state, 2000 + i * 100)
    expect(report(finish(state))).toMatchObject({ status: 'valid', acceptedCount: 40 })
    let interleaved = start()
    interleaved = step(interleaved, { kind: 'keydown', atMs: 1999, repeat: false, trusted: true },
      { kind: 'keyup', atMs: 2000, trusted: false }, { kind: 'keyup', atMs: 2001, trusted: true })
    expect(interleaved.accepted).toEqual([2001])
  })
  it('uses strict 40ms median and counts separated sub20ms intervals', () => {
    let valid = start()
    for (const up of [2000, 2030, 2130, 2230, 2330]) valid = press(valid, up)
    expect(report(finish(valid))).toMatchObject({ status: 'valid', acceptedCount: 5 })
    let fast = start()
    for (const up of [2000, 2002]) fast = press(fast, up)
    expect(report(finish(fast))).toMatchObject({ status: 'invalid', invalidationReason: 'implausible_input', acceptedCount: 2 })
    let boundary = start()
    for (const up of [2000, 2040]) boundary = press(boundary, up)
    expect(report(finish(boundary))).toMatchObject({ status: 'valid' })
    let separated = start()
    for (const up of [2000, 2010, 2110, 2120, 2220, 2230, 2330, 2340, 2440]) separated = press(separated, up)
    expect(report(finish(separated))).toMatchObject({ status: 'invalid', invalidationReason: 'implausible_input' })
    let twenty = start()
    for (const up of [2000, 2020, 2120, 2220]) twenty = press(twenty, up)
    expect(report(finish(twenty))).toMatchObject({ status: 'valid' })
  })
  it('does not count down/up pairs crossing GO or the deadline', () => {
    let state = step(arm(setup, 0), { kind: 'keydown', atMs: 1799, repeat: false, trusted: true },
      { kind: 'go', atMs: 1800 }, { kind: 'keyup', atMs: 1801, trusted: true })
    expect(state.accepted).toHaveLength(0)
    state = step(state, { kind: 'keydown', atMs: 16799, repeat: false, trusted: true },
      { kind: 'keyup', atMs: 16800, trusted: true })
    expect(state.accepted).toHaveLength(0)
    expect(state.phase).toBe('await_end')
  })
  it('retains held-at-deadline invalidity after release, in either callback order', () => {
    const before = step(start(), { kind: 'keydown', atMs: 2000, repeat: false, trusted: true })
    const callbackFirst = step(before, { kind: 'deadline', atMs: 16800 }, { kind: 'end', atMs: 16800 },
      { kind: 'keyup', atMs: 17000, trusted: true }, { kind: 'close', atMs: 17800 })
    expect(report(callbackFirst)).toMatchObject({ status: 'invalid', invalidationReason: 'implausible_input', acceptedCount: 0 })
    const releaseFirst = step(before, { kind: 'keyup', atMs: 16800, trusted: true },
      { kind: 'end', atMs: 16800 }, { kind: 'close', atMs: 17800 })
    expect(report(releaseFirst)).toMatchObject({ status: 'invalid', invalidationReason: 'implausible_input', acceptedCount: 0 })
    const ordinaryLate = step(start(), { kind: 'deadline', atMs: 16800 }, { kind: 'end', atMs: 16800 },
      { kind: 'keydown', atMs: 17000, repeat: false, trusted: true },
      { kind: 'keyup', atMs: 17010, trusted: true }, { kind: 'close', atMs: 17800 })
    expect(report(ordinaryLate)).toMatchObject({ status: 'valid', acceptedCount: 0, lateCount: 1 })
  })
  it('latches a pre-GO hold crossing the logical deadline, but not an early release or new boundary pair', () => {
    const early = step(arm(setup, 0), { kind: 'keydown', atMs: 1000, repeat: false, trusted: true },
      { kind: 'go', atMs: 1800 })
    const releaseFirst = step(early, { kind: 'keyup', atMs: 16800, trusted: true },
      { kind: 'deadline', atMs: 16801 }, { kind: 'end', atMs: 16801 }, { kind: 'close', atMs: 17801 })
    expect(report(releaseFirst)).toMatchObject({ status: 'invalid', invalidationReason: 'implausible_input', acceptedCount: 0 })
    const callbackFirst = step(early, { kind: 'deadline', atMs: 16800 },
      { kind: 'keyup', atMs: 16801, trusted: true }, { kind: 'end', atMs: 16801 }, { kind: 'close', atMs: 17801 })
    expect(report(callbackFirst)).toMatchObject({ status: 'invalid', invalidationReason: 'implausible_input', acceptedCount: 0 })
    const crossedGo = step(early, { kind: 'keyup', atMs: 1801, trusted: true },
      { kind: 'deadline', atMs: 16800 }, { kind: 'end', atMs: 16800 }, { kind: 'close', atMs: 17800 })
    expect(report(crossedGo)).toMatchObject({ status: 'valid', acceptedCount: 0 })
    const boundary = step(start(), { kind: 'keydown', atMs: 16800, repeat: false, trusted: true },
      { kind: 'keyup', atMs: 16810, trusted: true }, { kind: 'end', atMs: 16810 }, { kind: 'close', atMs: 17810 })
    expect(report(boundary)).toMatchObject({ status: 'valid', acceptedCount: 0 })
    const syntheticRelease = step(early, { kind: 'keyup', atMs: 16800, trusted: false },
      { kind: 'keyup', atMs: 16801, trusted: true }, { kind: 'deadline', atMs: 16801 },
      { kind: 'end', atMs: 16801 }, { kind: 'close', atMs: 17801 })
    expect(report(syntheticRelease)).toMatchObject({ status: 'invalid', invalidationReason: 'implausible_input', acceptedCount: 0 })
  })
  it('resolves the target on the fortieth trusted up at normal rapid pace', () => {
    let state = start()
    for (let i = 0; i < 40; i++) state = press(state, 2000 + i * 100)
    expect(state.phase).toBe('await_end')
    expect(state.logicalEndMs).toBe(5900)
    expect(report(finish(state))).toMatchObject({ status: 'valid', acceptedCount: 40, targetTimeMs: 4100 })
  })
})
