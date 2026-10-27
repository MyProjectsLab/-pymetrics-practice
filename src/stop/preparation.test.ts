import { describe, expect, it } from 'vitest'
import { bindingFromKey, createPreparationRecorder, createUnderstandingEvidence, createNewUnderstandingEvidence, currentNewPreparationBranch, isPlainResponse, questions, questionsForKey, shuffle, spaceBinding, verifyUnderstandingEvidence } from './preparation'

function key(key: string, code: string, extra: KeyboardEventInit = {}) {
  return new KeyboardEvent('keydown', { key, code, ...extra })
}

describe('preparation input and comprehension foundations', () => {
  it('keeps wrong radio attempts in the new evidence and requires a final correct answer', async () => {
    const recorder = createPreparationRecorder('new-experience-fixture')
    recorder.record('guide_opened', { source: 'library' })
    recorder.record('onboarding_v13_opened', { ruleVersion: 'stop_rule_v1', visualProfile: 'standard' })
    recorder.record('onboarding_v13_answered', { questionId: 'go', answerId: 'wait', correct: false, attempt: 1 })
    expect(await verifyUnderstandingEvidence(await createNewUnderstandingEvidence(recorder))).toBe(false)
    recorder.record('onboarding_v13_answered', { questionId: 'go', answerId: 'press', correct: true, attempt: 2 })
    const valid = await createNewUnderstandingEvidence(recorder)
    expect(await verifyUnderstandingEvidence(valid)).toBe(true)
    expect(await verifyUnderstandingEvidence({ ...valid, checksum: 'altered' })).toBe(false)
  })
  it('keeps every observed route while only the latest verified answer or Skip authorizes preparation', async () => {
    const recorder = createPreparationRecorder('new-branch-reentry')
    const source = { installationId: 'local', sourceSessionId: 'saved', formId: 'supported-form', formChecksum: 'checksum',
      specificationVersion: '1.3' as const, scoringVersion: 'stop_scoring_v13', ruleVersion: 'stop_rule_v1' as const,
      visualProfile: 'standard' as const, sourceReadOutcome: 'verified_complete' as const }
    const verified = async () => verifyUnderstandingEvidence(await createNewUnderstandingEvidence(recorder))
    recorder.record('guide_opened', { source: 'library' })
    recorder.record('onboarding_v13_opened', { ruleVersion: 'stop_rule_v1', visualProfile: 'standard' })
    recorder.record('onboarding_v13_answered', { questionId: 'go', answerId: 'wait', correct: false, attempt: 1 })
    expect(await verified()).toBe(false)
    recorder.record('onboarding_v13_skip_verified', source)
    expect(currentNewPreparationBranch(recorder.snapshot())?.kind).toBe('skip')
    expect(await verified()).toBe(true)
    recorder.record('onboarding_v13_skip_verified', source)
    expect(await verified()).toBe(true)
    recorder.record('onboarding_v13_answered', { questionId: 'go', answerId: 'press', correct: true, attempt: 2 })
    expect(currentNewPreparationBranch(recorder.snapshot())?.kind).toBe('answer')
    expect(await verified()).toBe(true)
    recorder.record('onboarding_v13_answered', { questionId: 'go', answerId: 'repeat', correct: false, attempt: 3 })
    expect(currentNewPreparationBranch(recorder.snapshot())).toBeNull()
    expect(await verified()).toBe(false)
  })
  it.each([[' ', 'Space', 'Space'], ['f', 'KeyF', 'F'], ['1', 'Digit1', '1']])('accepts standalone %s', (value, code, label) => {
    expect(bindingFromKey(key(value, code))).toEqual({ code, label })
  })
  it.each([['Tab', 'Tab'], ['Escape', 'Escape'], ['Shift', 'ShiftLeft'], ['Control', 'ControlLeft'],
    ['Alt', 'AltLeft'], ['Meta', 'MetaLeft'], ['F5', 'F5'], ['Dead', 'Quote'], ['Unidentified', '']])('rejects prohibited %s', (value, code) => {
    expect(bindingFromKey(key(value, code))).toBeNull()
  })
  it.each(['ctrlKey', 'altKey', 'metaKey', 'shiftKey', 'repeat', 'isComposing'])('rejects %s during remapping and response checks', flag => {
    const event = key(' ', 'Space', { [flag]: true })
    expect(bindingFromKey(event)).toBeNull()
    expect(isPlainResponse(event, spaceBinding)).toBe(false)
  })
  it('shuffles all three items without mutating the source or losing identity', () => {
    expect(shuffle(questions, () => 0).map(q => q.id)).toEqual(['no-go', 'window', 'go'])
    expect(shuffle(questions, () => 0.99).map(q => q.id)).toEqual(['go', 'no-go', 'window'])
    expect(questions.map(q => q.id)).toEqual(['go', 'no-go', 'window'])
  })
  it('uses the selected physical key in every comprehension answer', () => {
    const changed = questionsForKey('F')
    expect(changed.find(item => item.id === 'go')?.choices.map(item => item.label)).toEqual(['Press F once.', 'Do nothing.', 'Press F repeatedly.'])
    expect(changed.find(item => item.id === 'no-go')?.choices[1].label).toBe('Press F once.')
    expect(questions[0].choices[0].label).toBe('Press Space once.')
  })
  it('accepts only intact current-version prior understanding evidence', async () => {
    const recorder = createPreparationRecorder('prior-pass')
    recorder.record('guide_opened', { source: 'library' })
    for (const item of questions) recorder.record('comprehension_answered', {
      itemId: item.id, answerId: item.answer, correct: true, attempt: 1,
    })
    const valid = await createUnderstandingEvidence(recorder)
    expect(await verifyUnderstandingEvidence(valid)).toBe(true)
    expect(await verifyUnderstandingEvidence(null)).toBe(false)
    expect(await verifyUnderstandingEvidence({ ...valid, experienceVersion: '1.1' })).toBe(false)
    expect(await verifyUnderstandingEvidence({ ...valid, ruleVersion: 'old-rule' })).toBe(false)
    expect(await verifyUnderstandingEvidence({ ...valid, checksum: 'corrupt' })).toBe(false)
    const changed = structuredClone(valid)
    ;(changed.events[1] as { payload: { answerId: string } }).payload.answerId = 'withhold'
    expect(await verifyUnderstandingEvidence(changed)).toBe(false)
    const failed = createPreparationRecorder('prior-fail')
    failed.record('guide_opened', { source: 'library' })
    for (const item of questions) failed.record('comprehension_answered', {
      itemId: item.id, answerId: item.id === 'go' ? 'withhold' : item.answer,
      correct: item.id !== 'go', attempt: 1,
    })
    expect(await verifyUnderstandingEvidence(await createUnderstandingEvidence(failed))).toBe(false)
  })
})

it('requires both observed answers for a two-question opening while preserving historical one-question evidence', async () => {
  const recorder = createPreparationRecorder('two-question-evidence')
  recorder.record('guide_opened', { source: 'library' })
  recorder.record('onboarding_v13_opened', { ruleVersion: 'stop_rule_v1', visualProfile: 'standard', questionCount: 2 })
  recorder.record('onboarding_v13_answered', { questionId: 'go', answerId: 'press', correct: true, attempt: 1 })
  expect(currentNewPreparationBranch(recorder.snapshot())).toBeNull()
  expect(await verifyUnderstandingEvidence(await createNewUnderstandingEvidence(recorder))).toBe(false)
  recorder.record('onboarding_v13_answered', { questionId: 'no-go', answerId: 'press', correct: false, attempt: 2 })
  expect(currentNewPreparationBranch(recorder.snapshot())).toBeNull()
  recorder.record('onboarding_v13_answered', { questionId: 'no-go', answerId: 'wait', correct: true, attempt: 3 })
  expect(await verifyUnderstandingEvidence(await createNewUnderstandingEvidence(recorder))).toBe(true)
  recorder.record('onboarding_v13_answered', { questionId: 'go', answerId: 'wait', correct: false, attempt: 4 })
  expect(currentNewPreparationBranch(recorder.snapshot())).toBeNull()
})
it('rejects NO-GO evidence before a correct GO answer and mismatched correctness flags', () => {
  const recorder = createPreparationRecorder('two-question-order')
  recorder.record('onboarding_v13_opened', { ruleVersion: 'stop_rule_v1', visualProfile: 'standard', questionCount: 2 })
  recorder.record('onboarding_v13_answered', { questionId: 'no-go', answerId: 'wait', correct: true, attempt: 1 })
  expect(currentNewPreparationBranch(recorder.snapshot())).toBeNull()
  const events = recorder.snapshot()
  expect(currentNewPreparationBranch([events[0], { ...events[1], payload: { questionId: 'go', answerId: 'wait', correct: true, attempt: 1 } }])).toBeNull()
})
