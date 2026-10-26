import { describe, expect, it } from 'vitest'
import fixtures from '../../docs/specifications/ASSESSMENT_PRACTICE_LENGTHS_FIXTURES_V1_0.json'
import { advance, armHeadless, verifyHeadless } from './engine'
import type { InputProfile, State } from './engine'
import { loadLengthsForms } from './manifests'
import { reconcileHeadless, summarizeTimes } from './report'
import type { Side } from './contracts'

const forms = await loadLengthsForms()
const standard = forms.get('LS1')!
const keyboard: InputProfile = { kind: 'keyboard', variant: 'standard', deviceClass: 'desktop',
  leftCode: 'ArrowLeft', rightCode: 'ArrowRight', alternative: false,
  contrast: 'dark_on_light', magnification: 'none', reducedMotion: true }
const pointer: InputProfile = { kind: 'pointer', variant: 'standard', deviceClass: 'desktop',
  pointerSource: 'mouse', alternative: false, contrast: 'dark_on_light',
  magnification: 'none', reducedMotion: true }
const identity = { installationId: 'installation-1', sessionId: 'session-1',
  clockDomainId: 'clock-1', route: 'standalone' as const }
const expected = Object.fromEntries(fixtures.cases.map(item => [item.id, item.expected]))
function key(side: Side) { return side === 'left' ? 'ArrowLeft' : 'ArrowRight' }
function fresh(profile = keyboard) { return armHeadless(standard, identity, profile, 100) }
function run(options: {
  wrongFirst?: boolean
  omitSecond?: boolean
  firstRt?: number
  firstOnsetLateness?: number
  firstFrameGap?: number
  firstRejected?: 'modified' | 'composition' | 'repeat'
} = {}): State {
  let state = advance(fresh(), { kind: 'start', atMs: 100, responseHeld: false })
  for (let index = 1; index <= 96; index++) {
    const fixationAt = Math.max(state.fixationDueMs!, state.commands.at(-1)!.atMs)
    state = advance(state, { kind: 'fixation', atMs: fixationAt })
    const onsetAt = state.stimulusDueMs! + (index === 1 ? options.firstOnsetLateness ?? 0 : 0)
    state = advance(state, { kind: 'onset', atMs: onsetAt })
    if (state.phase === 'invalid') return state
    if (index === 1 && options.firstFrameGap !== undefined) {
      state = advance(state, { kind: 'frameGap', atMs: onsetAt + options.firstFrameGap,
        gapMs: options.firstFrameGap })
      if (state.phase === 'invalid') return state
    }
    const trial = standard.trials[index - 1]
    const omit = index === 2 && options.omitSecond
    if (index === 1 && options.firstRejected) {
      const code = key(trial.longerSide)
      state = advance(state, { kind: 'keydown', atMs: onsetAt + 200, code,
        repeat: options.firstRejected === 'repeat',
        modified: options.firstRejected === 'modified',
        composing: options.firstRejected === 'composition' })
      state = advance(state, { kind: 'keydown', atMs: onsetAt + 250, code,
        repeat: false, modified: false, composing: false })
      state = advance(state, { kind: 'keyup', atMs: onsetAt + 251, code })
    } else if (!omit) {
      const side = index === 1 && options.wrongFirst ?
        (trial.longerSide === 'left' ? 'right' : 'left') : trial.longerSide
      const rt = index === 1 ? options.firstRt ?? 200 : 200
      state = advance(state, { kind: 'keydown', atMs: onsetAt + rt,
        code: key(side), repeat: false, modified: false, composing: false })
      if (rt < 1400) state = advance(state, { kind: 'keyup', atMs: onsetAt + rt + 1, code: key(side) })
    }
    state = advance(state, { kind: 'resolve', atMs: state.resolutionDueMs! })
    state = advance(state, { kind: 'offset', atMs: state.resolutionDueMs! })
    if (index === 1 && options.firstRt === 1400) {
      state = advance(state, { kind: 'keyup', atMs: onsetAt + 1401, code: key(trial.longerSide) })
    }
    if (state.phase === 'break')
      state = advance(state, { kind: 'continue', atMs: state.commands.at(-1)!.atMs + 1,
        responseHeld: false })
  }
  return state
}

describe('Lengths headless journal and fixture arithmetic', () => {
  it('retains measured Start and Continue context in replayable block evidence', () => {
    const displayContext = { layoutWidthCssPx: 1512, layoutHeightCssPx: 900,
      visualWidthCssPx: 1512, visualHeightCssPx: 900, taskHostWidthCssPx: 650,
      devicePixelRatio: 2, browserFamily: 'chromium', visibility: 'visible', focused: true } as const
    let state = advance(fresh(), { kind: 'start', atMs: 100, responseHeld: false,
      displayContext })
    expect(state.events.find(event => event.type === 'block_started')?.detail.displayContext)
      .toBe(JSON.stringify(displayContext))
    for (let index = 0; index < 24; index++) {
      state = advance(state, { kind: 'fixation', atMs: state.fixationDueMs! })
      state = advance(state, { kind: 'onset', atMs: state.stimulusDueMs! })
      state = advance(state, { kind: 'resolve', atMs: state.resolutionDueMs! })
      state = advance(state, { kind: 'offset', atMs: state.resolutionDueMs! })
    }
    state = advance(state, { kind: 'continue', atMs: state.commands.at(-1)!.atMs + 1,
      responseHeld: false, displayContext: { ...displayContext, layoutWidthCssPx: 1200 } })
    expect(state.events.find(event => event.type === 'block_continued')?.detail.displayContext)
      .toBe(JSON.stringify({ ...displayContext, layoutWidthCssPx: 1200 }))
    expect(verifyHeadless(state)).toBe(true)
    expect(() => advance(fresh(), { kind: 'start', atMs: 100, responseHeld: false,
      displayContext: { ...displayContext, taskHostWidthCssPx: -1 } })).toThrow('start context evidence')
  })
  it('replays the complete all-correct primitive fixture without a browser or saved claim', () => {
    const state = run()
    const review = reconcileHeadless(state)
    const goal = expected.all_correct_200
    expect(state.phase).toBe('completed')
    expect(verifyHeadless(state)).toBe(true)
    expect(review).toMatchObject({ status: 'complete_headless', validity: 'headless_unconfirmed',
      persistence: 'not_checked', presented: 96, closed: 96,
      unresolvedPresented: 0, unpresented: 0 })
    expect(review.metrics?.overall).toMatchObject({ correct: goal.correct, wrong: goal.wrong,
      omitted: goal.omitted, denominator: 96,
      time: { cleanCount: goal.cleanTimes, medianMs: goal.medianMs, iqrMs: goal.iqrMs } })
    expect(Object.fromEntries(Object.entries(review.metrics!.byCategory)
      .map(([category, value]) => [category, value.correct]))).toEqual(goal.byCategoryCorrect)
    expect(review.metrics?.byBlock.map(block => block.correct)).toEqual(goal.byBlockCorrect)
    expect(review.metrics?.responseTendency).toMatchObject({
      left: goal.selectedLeft, right: goal.selectedRight, responded: 96 })
    expect(state.events.map(event => event.sequenceNumber)).toEqual(
      Array.from({ length: state.events.length }, (_, index) => index + 1))
    expect(state.events.filter(event => event.type === 'stimulus_presented')).toHaveLength(96)
    expect(state.events.filter(event => event.type === 'trial_closed')).toHaveLength(96)
    expect(state.events.filter(event => event.type === 'block_summary').map(event => event.detail))
      .toEqual(Array.from({ length: 3 }, () => ({ correct: 24, wrong: 0, omitted: 0, denominator: 24 })))
  })

  it('derives wrong/omitted/category counts from primitive LS1 actions', () => {
    const state = run({ wrongFirst: true, omitSecond: true })
    const review = reconcileHeadless(state)
    const goal = expected.first_wrong_second_omitted
    expect(review.metrics?.overall).toMatchObject({ correct: goal.correct, wrong: goal.wrong,
      omitted: goal.omitted, time: { cleanCount: goal.cleanTimes,
        medianMs: goal.medianMs, iqrMs: goal.iqrMs } })
    expect(Object.fromEntries(Object.entries(review.metrics!.byCategory)
      .map(([category, value]) => [category, value.correct]))).toEqual(goal.byCategoryCorrect)
    expect(state.events.find(event => event.type === 'block_summary')?.detail)
      .toEqual({ correct: 22, wrong: 1, omitted: 1, denominator: 24 })
  })

  it.each([
    ['early_correct', 80, 0],
    ['last_eligible', 1399, 0],
    ['deadline_boundary', 1400, 0],
    ['quality_50', 200, 50],
    ['quality_51', 200, 51],
    ['quality_250', 200, 250],
  ] as const)('applies %s boundary fixture from observed commands', (name, firstRt, firstOnsetLateness) => {
    const state = run({ firstRt, firstOnsetLateness })
    const review = reconcileHeadless(state)
    const goal = expected[name]
    expect(review.metrics?.overall.correct).toBe(goal.correct)
    if ('omitted' in goal) expect(review.metrics?.overall.omitted).toBe(goal.omitted)
    expect(review.metrics?.overall.time).toMatchObject({ cleanCount: goal.cleanTimes,
      medianMs: goal.medianMs, iqrMs: goal.iqrMs })
    if ('boundaryExtras' in goal && typeof goal.boundaryExtras === 'number')
      expect(state.events.filter(event => event.type === 'boundary_extra')).toHaveLength(goal.boundaryExtras)
  })

  it('retains a 251-ms confirmed onset before invalidation and suppresses aggregates', () => {
    const state = run({ firstOnsetLateness: 251 })
    const review = reconcileHeadless(state)
    expect(state.events.slice(-2).map(event => event.type))
      .toEqual(['stimulus_presented', 'invalidated'])
    expect(review).toMatchObject({ status: 'invalid_headless', presented: 1, closed: 0,
      unresolvedPresented: 1, unpresented: 95, metrics: null })
    expect(expected.severe_251.status).toBe('invalid')
  })

  it.each([
    [50, 96, 'complete_headless'],
    [51, 95, 'complete_headless'],
    [250, 95, 'complete_headless'],
    [251, null, 'invalid_headless'],
  ] as const)('applies a %i-ms foreground frame gap', (gapMs, cleanCount, status) => {
    const state = run({ firstRt: 300, firstFrameGap: gapMs })
    const review = reconcileHeadless(state)
    expect(review.status).toBe(status)
    expect(review.metrics?.overall.time.cleanCount ?? null).toBe(cleanCount)
    expect(state.events.filter(event => event.type === 'frame_gap')).toHaveLength(1)
    if (gapMs === 251) expect(state.invalidReason).toBe('frame_gap')
  })

  it('uses median-of-halves and suppresses small-cell variability', () => {
    expect(summarizeTimes([500, 100, 300, 200, 400])).toMatchObject({
      medianMs: expected.five_times.medianMs, iqrMs: null, reason: 'fewer_than_eight' })
    expect(expected.five_times.iqr).toBe('insufficient_variability')
    expect(summarizeTimes([800, 100, 400, 200, 600, 300, 700, 500])).toMatchObject({
      medianMs: expected.eight_times.medianMs, iqrMs: expected.eight_times.iqrMs })
    expect(summarizeTimes([])).toMatchObject({ medianMs: null, iqrMs: null, reason: 'fewer_than_five' })
  })

  it('keeps early held keys from becoming onset responses and ignores unrelated raw keys', () => {
    let state = advance(fresh(), { kind: 'start', atMs: 100, responseHeld: false })
    state = advance(state, { kind: 'fixation', atMs: 100 })
    const ignored = advance(state, { kind: 'keydown', atMs: 110, code: 'KeyZ',
      repeat: false, modified: false, composing: false })
    expect(ignored).toBe(state)
    state = advance(state, { kind: 'keydown', atMs: 120, code: 'ArrowLeft',
      repeat: false, modified: false, composing: false })
    state = advance(state, { kind: 'onset', atMs: 700 })
    state = advance(state, { kind: 'keydown', atMs: 800, code: 'ArrowLeft',
      repeat: true, modified: false, composing: false })
    expect(state.firstResponse).toBeNull()
    state = advance(state, { kind: 'keyup', atMs: 801, code: 'ArrowLeft' })
    state = advance(state, { kind: 'keydown', atMs: 900, code: 'ArrowLeft',
      repeat: false, modified: false, composing: false })
    expect(state.firstResponse).toMatchObject({ side: 'left', atMs: 900 })
    expect(state.events.filter(event => event.type === 'response')).toHaveLength(1)
  })

  it.each([
    ['modified', { modified: true, composing: false, repeat: false }],
    ['composition', { modified: false, composing: true, repeat: false }],
    ['repeat', { modified: false, composing: false, repeat: true }],
  ] as const)('requires release after a rejected %s selected press', (reason, flags) => {
    let state = advance(fresh(), { kind: 'start', atMs: 100, responseHeld: false })
    state = advance(state, { kind: 'fixation', atMs: 100 })
    state = advance(state, { kind: 'onset', atMs: 700 })
    state = advance(state, { kind: 'keydown', atMs: 800, code: 'ArrowLeft',
      ...flags })
    expect(state.firstResponse).toBeNull()
    expect(state.heldCodes).toEqual(['ArrowLeft'])
    expect(state.events.at(-1)).toMatchObject({ type: 'response_ignored',
      detail: { reason } })
    state = advance(state, { kind: 'keydown', atMs: 900, code: 'ArrowLeft',
      repeat: false, modified: false, composing: false })
    expect(state.firstResponse).toBeNull()
    expect(state.events.at(-1)).toMatchObject({ type: 'response_ignored',
      detail: { reason: 'held' } })
    state = advance(state, { kind: 'keyup', atMs: 901, code: 'ArrowLeft' })
    state = advance(state, { kind: 'keydown', atMs: 1000, code: 'ArrowLeft',
      repeat: false, modified: false, composing: false })
    expect(state.firstResponse).toMatchObject({ side: 'left', atMs: 1000 })
    expect(verifyHeadless(state)).toBe(true)
  })

  it.each(['modified', 'composition', 'repeat'] as const)(
    'reconciles a rejected %s press as one omission across all 96 trials', reason => {
      const state = run({ firstRejected: reason })
      expect(verifyHeadless(state)).toBe(true)
      expect(reconcileHeadless(state).metrics?.overall).toMatchObject({
        correct: 95, wrong: 0, omitted: 1, denominator: 96 })
      expect(state.events.filter(event => event.type === 'response')).toHaveLength(95)
    })

  it('ignores multi-pointer input and invalidates a changed pointer source', () => {
    let state = advance(fresh(pointer), { kind: 'start', atMs: 100, responseHeld: false })
    state = advance(state, { kind: 'fixation', atMs: 100 })
    state = advance(state, { kind: 'onset', atMs: 700 })
    state = advance(state, { kind: 'pointerdown', atMs: 800, side: 'left', pointerId: 1,
      pointerType: 'mouse', button: 0, isPrimary: true })
    state = advance(state, { kind: 'pointerdown', atMs: 801, side: 'right', pointerId: 2,
      pointerType: 'mouse', button: 0, isPrimary: true })
    expect(state.firstResponse?.side).toBe('left')
    expect(state.events.filter(event => event.type === 'response')).toHaveLength(1)
    state = advance(state, { kind: 'pointerup', atMs: 802, pointerId: 1 })
    state = advance(state, { kind: 'pointerdown', atMs: 803, side: 'right', pointerId: 3,
      pointerType: 'touch', button: 0, isPrimary: true })
    expect(state.phase).toBe('invalid')
    expect(state.invalidReason).toBe('settings')
  })

  it('rejects event tampering, changed profile, wrong form and malformed commands', () => {
    const state = run()
    const changed = { ...structuredClone(state), form: state.form }
    ;(changed.events[3] as { sequenceNumber: number }).sequenceNumber = 9
    expect(verifyHeadless(changed)).toBe(false)
    expect(() => reconcileHeadless(changed)).toThrow('unreconciled')
    const added = { ...structuredClone(state), form: state.form }
    ;(added.events[3].detail as Record<string, unknown>).unexpected = undefined
    expect(verifyHeadless(added)).toBe(false)
    expect(() => armHeadless(forms.get('LA1')!, identity, keyboard, 100))
      .toThrow('variant mismatch')
    expect(() => armHeadless(standard, identity,
      { ...keyboard, leftCode: new String('ArrowLeft') } as never, 100))
      .toThrow('invalid key bindings')
    expect(() => advance(fresh(), { kind: 'start', atMs: 100,
      responseHeld: false, extra: 1 } as never)).toThrow('malformed')
  })

  it('invalidates severe frame gaps and watchdogs, while a break hide is untimed', () => {
    let state = advance(fresh(), { kind: 'start', atMs: 100, responseHeld: false })
    state = advance(state, { kind: 'fixation', atMs: 100 })
    state = advance(state, { kind: 'frameGap', atMs: 360, gapMs: 251 })
    expect(state).toMatchObject({ phase: 'invalid', invalidReason: 'frame_gap' })
    let watchdog = advance(fresh(), { kind: 'start', atMs: 100, responseHeld: false })
    watchdog = advance(watchdog, { kind: 'watchdog', atMs: 2100 })
    expect(watchdog).toMatchObject({ phase: 'invalid', invalidReason: 'watchdog' })
    let atBreak = advance(fresh(), { kind: 'start', atMs: 100, responseHeld: false })
    for (let trial = 0; trial < 24; trial++) {
      atBreak = advance(atBreak, { kind: 'fixation', atMs: atBreak.fixationDueMs! })
      atBreak = advance(atBreak, { kind: 'onset', atMs: atBreak.stimulusDueMs! })
      atBreak = advance(atBreak, { kind: 'resolve', atMs: atBreak.resolutionDueMs! })
      atBreak = advance(atBreak, { kind: 'offset', atMs: atBreak.resolutionDueMs! })
    }
    expect(atBreak.phase).toBe('break')
    expect(advance(atBreak, { kind: 'invalidate', atMs: atBreak.commands.at(-1)!.atMs + 1,
      reason: 'hidden' })).toBe(atBreak)
    expect(reconcileHeadless(atBreak)).toMatchObject({ status: 'incomplete_headless',
      presented: 24, closed: 24, unpresented: 72, metrics: null })
  })
})
