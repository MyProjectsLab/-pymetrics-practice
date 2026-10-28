import { describe, expect, it } from 'vitest'
import { advanceDigits, armDigits, verifyDigitsRun } from './engine'
import { loadDigitsForms } from './forms'
import { scoreDigits } from './scoring'
import { identity, visual, openEntry } from './test-support'
import legacyFixture from './legacy-timed.fixture.json'
import type { RunState } from './contracts'

describe('founder-approved reference Digits', () => {
  async function start(legacy = false) {
    const arm = armDigits((await loadDigitsForms()).get('DV1')!, identity, visual, 0, !legacy)
    return advanceDigits(arm, { kind: 'start', atMs: 0 })
  }
  it('uses a versioned reference revision and 500 ms first-blank/on/blank/last-blank stages', async () => {
    let state = await start()
    expect(state.events[0].detail.referenceRules).toBe('digits_reference_2026_10_28')
    expect(state.nextDueMs).toBe(500)
    for (let index = 0; index < 4; index++) {
      const onset = state.nextDueMs!
      state = advanceDigits(state, { kind: 'visual_onset', dueMs: onset, atMs: onset })
      expect(state.nextDueMs).toBe(onset + 500)
      const offset = state.nextDueMs!
      state = advanceDigits(state, { kind: 'visual_offset', dueMs: offset, atMs: offset })
      expect(state.nextDueMs).toBe(offset + 500)
    }
    const due = state.nextDueMs!
    state = advanceDigits(state, { kind: 'entry_opened', dueMs: due, atMs: due })
    expect(state.entryOpenedMs).toBe(4500)
    expect(state.entryDeadlineMs).toBeNull()
    expect(verifyDigitsRun(state)).toBe(true)
  })
  it('accepts a correct response after both old limits without a timeout or Skip closure', async () => {
    let state = openEntry(await start())
    const atMs = state.entryOpenedMs! + 120_000
    expect(() => advanceDigits(state, { kind: 'skip', atMs })).toThrow()
    expect(() => advanceDigits(state, { kind: 'timeout', atMs })).toThrow()
    state = advanceDigits(state, { kind: 'edit', atMs, value: state.target!, assisted: false, source: 'keyboard' })
    state = advanceDigits(state, { kind: 'submit', atMs: atMs + 1 })
    expect(state.closed[0]).toMatchObject({ exactCorrect: true, skipped: false, timedOut: false })
    expect(verifyDigitsRun(state)).toBe(true)
  })
  it('does not reveal the expected length by truncating a longer numeric answer', async () => {
    let state = openEntry(await start())
    const answer = state.target! + '9'
    state = advanceDigits(state, { kind: 'edit', atMs: state.entryOpenedMs! + 1, value: answer, assisted: false, source: 'keyboard' })
    state = advanceDigits(state, { kind: 'submit', atMs: state.entryOpenedMs! + 2 })
    expect(state.closed[0]).toMatchObject({ answer, exactCorrect: false, timedOut: false, skipped: false })
    expect(state.wrongCount).toBe(1)
    expect(verifyDigitsRun(state)).toBe(true)
    state = advanceDigits(state, { kind: 'next', atMs: state.events.at(-1)!.atMs + 1 })
    for (let n = 0; n < 2; n++) {
      state = openEntry(state)
      state = advanceDigits(state, { kind: 'submit', atMs: state.entryOpenedMs! + 1 })
      if (state.phase === 'feedback') state = advanceDigits(state, { kind: 'next', atMs: state.events.at(-1)!.atMs + 1 })
    }
    expect(scoreDigits(state)).toMatchObject({ status: 'valid', exactCorrect: 0, wrong: 3, timedOut: 0, skipped: 0 })
  })
  it('replays and scores the exact pre-change timed witness without rewriting it', async () => {
    const state = { ...legacyFixture.state, form: (await loadDigitsForms()).get('DV1')! } as unknown as RunState
    expect(JSON.stringify(state)).toBe(JSON.stringify(legacyFixture.state))
    const before = JSON.stringify(state)
    expect(verifyDigitsRun(state)).toBe(true)
    expect(scoreDigits(state)).toEqual(legacyFixture.review)
    expect(JSON.stringify(state)).toBe(before)
  })
  it('keeps legacy timed events byte-for-byte replayable and rejects unknown revisions', async () => {
    let old = await start(true)
    expect(old.events[0].detail.referenceRules).toBeUndefined()
    expect(old.nextDueMs).toBe(0)
    old = openEntry(old)
    expect(old.entryDeadlineMs).toBe(old.entryOpenedMs! + 20000)
    old = advanceDigits(old, { kind: 'timeout', atMs: old.entryDeadlineMs! })
    expect(old.closed[0].timedOut).toBe(true)
    expect(verifyDigitsRun(old)).toBe(true)
    const changed = structuredClone(old)
    Object.assign(changed.events[0].detail, { referenceRules: 'unknown_revision' })
    expect(verifyDigitsRun(changed)).toBe(false)
  })
})
