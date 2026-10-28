import { describe, expect, it } from 'vitest'
import fixtures from '../../docs/specifications/ASSESSMENT_PRACTICE_DIGITS_FIXTURES_V1_1.json'
import { advanceDigits, verifyDigitsRun } from './engine'
import { scoreDigits } from './scoring'
import { closeTrial, initialRun, nextTrial, openEntry } from './test-support'

describe('Digits adaptive ordered run', () => {
  it.each(fixtures.cases)('reconciles whole path $name against frozen arithmetic', async fixture => {
    let state = await initialRun()
    const lengths: number[] = []
    for (const answer of fixture.answers) {
      lengths.push(state.length)
      state = closeTrial(state, answer === 'correct')
      if (state.phase === 'feedback') state = nextTrial(state)
    }
    expect(lengths).toEqual(fixture.presentedLengths)
    expect(state.phase).toBe('completed')
    expect(state.wrongCount).toBe(fixture.finalWrongCount)
    expect(state.completionReason).toBe(fixture.ending)
    expect(verifyDigitsRun(state)).toBe(true)
    const report = scoreDigits(state)
    expect(report.status).toBe('valid')
    if (report.status === 'valid') {
      expect(report.maximumRecalledLength).toBe(fixture.maxCorrectLength)
      const expected = [...new Set(lengths)].sort((a, b) => a - b).map(length => ({
        length, correct: fixture.answers.filter((a, i) => a === 'correct' && lengths[i] === length).length,
        opportunities: lengths.filter(l => l === length).length,
      }))
      expect(report.byLength.map(({ length, exact, of }) => ({ length, correct: exact, opportunities: of })))
        .toEqual(expected)
      expect(report.serialPositionErrors.map(item => item.opportunities)).toEqual(
        Array.from({ length: Math.max(...lengths) }, (_, i) => lengths.filter(l => l > i).length))
    }
    expect(state.events.every(e => e.block === 0)).toBe(true)
    expect(state.events.some(e => /block_/.test(e.type))).toBe(false)
  })
  it('counts confirmed partial exposure and suppresses aggregates', async () => {
    const state = await initialRun()
    const first = advanceDigits(state, { kind: 'visual_onset', dueMs: state.nextDueMs!, atMs: state.nextDueMs! })
    const invalid = advanceDigits(first, { kind: 'invalidate', atMs: state.nextDueMs! + 1, reason: 'blur' })
    expect(scoreDigits(invalid)).toEqual({ status: 'invalid', reason: 'blur', presented: 1, closed: 0, unresolved: 1 })
    expect(verifyDigitsRun(invalid)).toBe(true)
  })
  it('preserves legacy exact-deadline closure and rejects duplicate closure', async () => {
    let state = openEntry(await initialRun(true))
    const deadline = state.entryDeadlineMs!
    state = advanceDigits(state, { kind: 'edit', atMs: deadline - 1,
      value: state.target!, assisted: false, source: 'keyboard' })
    state = advanceDigits(state, { kind: 'submit', atMs: deadline })
    expect(state.closed[0]).toMatchObject({ timedOut: true, exactCorrect: false })
    expect(state.length).toBe(3)
    expect(state.wrongCount).toBe(1)
    expect(() => advanceDigits(state, { kind: 'submit', atMs: deadline + 1 })).toThrow()
  })
  it.each(['skip', 'timeout'] as const)('legacy %s descends and contributes one cumulative mistake', async kind => {
    const state = closeTrial(await initialRun(true), true, kind)
    expect(state.wrongCount).toBe(1)
    expect(state.length).toBe(3)
    expect(state.phase).toBe('feedback')
  })
  it.each([50, 50.001, 250, 250.001])('preserves exposure and timing boundary at %s', async lateness => {
    const armed = await initialRun()
    const state = advanceDigits(armed, { kind: 'visual_onset', dueMs: armed.nextDueMs!, atMs: armed.nextDueMs! + lateness })
    expect(state.presentedTrials).toBe(1)
    expect(state.phase).toBe(lateness > 250 ? 'invalid' : 'presentation')
    expect(state.events.filter(e => e.type === 'quality_note')).toHaveLength(lateness > 50 && lateness <= 250 ? 1 : 0)
  })
  it('orders closure then lifecycle loss at feedback; invalidation first rejects closure', async () => {
    const closed = closeTrial(await initialRun(), true)
    const invalid = advanceDigits(closed, { kind: 'invalidate', atMs: closed.events.at(-1)!.atMs, reason: 'blur' })
    expect(invalid.closed).toHaveLength(1)
    expect(invalid.events.at(-1)?.type).toBe('invalidated')
    const first = advanceDigits(await initialRun(), { kind: 'invalidate', atMs: 0, reason: 'hidden' })
    expect(() => advanceDigits(first, { kind: 'submit', atMs: 1 })).toThrow()
    expect(first.presentedTrials).toBe(0)
  })
  it('rejects mutated targets, adaptive fields, event versions, reason and closed answers', async () => {
    let state = await initialRun()
    for (let i = 0; i < 3; i++) { state = closeTrial(state, false); if (state.phase === 'feedback') state = nextTrial(state) }
    const mutated = [ { ...state, target: '00' }, { ...state, wrongCount: 2 },
      { ...state, length: 16 }, { ...state, completionReason: 'practice_limit_reached' as const },
      { ...state, closed: [{ ...state.closed[0], answer: '1234' }, ...state.closed.slice(1)] },
      { ...state, events: state.events.map((e, i) => i === 4 ? { ...e, detail: { ...e.detail, value: '9' } } : e) } ]
    for (const candidate of mutated) {
      expect(verifyDigitsRun(candidate)).toBe(false)
      expect(() => scoreDigits(candidate)).toThrow()
    }
  })
})
