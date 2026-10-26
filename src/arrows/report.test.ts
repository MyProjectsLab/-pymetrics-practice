import { beforeAll, describe, expect, it } from 'vitest'
import type { Form } from './contracts'
import { advance, armHeadless } from './engine'
import type { State } from './engine'
import { loadArrowsForms } from './manifests'
import { contrastTimes, reconcileHeadless, roundHalfAway, summarizeTimes } from './report'

let form: Form
beforeAll(async () => { form = (await loadArrowsForms()).get('AR1')! })
const profile = { kind: 'keyboard', leftCode: 'ArrowLeft', rightCode: 'ArrowRight',
  alternative: false, accommodation: 'default', reducedMotion: false } as const
const identity = { installationId: 'headless-report-installation', sessionId: 'headless-report-session', clockDomainId: 'clock-one' }
function arm() { return armHeadless(form, identity, profile, 100) }
function begin(state: State, atMs: number, firstBlock: boolean) {
  return advance(state, { kind: firstBlock ? 'start' : 'continue', atMs, responseHeld: false })
}

function complete(choice: (index: number) => 'correct' | 'wrong' | 'omitted' | 'early' = () => 'correct') {
  let state = arm(), next = 100
  for (let index = 1; index <= 120; index++) {
    if (index % 24 === 1) state = begin(state, next, index === 1)
    state = advance(state, { kind: 'fixation', atMs: state.fixationDueMs! + 16 })
    state = advance(state, { kind: 'onset', atMs: state.stimulusDueMs! + 16 })
    const action = choice(index)
    if (action !== 'omitted') {
      const direction = action === 'wrong' ?
        (form.trials[index - 1].direction === 'left' ? 'right' : 'left') : form.trials[index - 1].direction
      const code = direction === 'left' ? 'ArrowLeft' : 'ArrowRight'
      const atMs = state.onsetMs! + (action === 'early' ? 99 : 300)
      state = advance(state, { kind: 'keydown', atMs, code, repeat: false, modified: false })
      state = advance(state, { kind: 'keyup', atMs: atMs + 1, code })
    }
    state = advance(state, { kind: 'resolve', atMs: state.resolutionDueMs! + 8 })
    state = advance(state, { kind: 'offset', atMs: state.resolutionDueMs! + 16 })
    next = state.events.at(-1)!.atMs + (index % 24 === 0 ? 1_000 : 0)
  }
  return state
}

describe('headless Arrows report reconciliation', () => {
  it('derives all denominators and timing cohorts from a complete ordered journal', () => {
    const review = reconcileHeadless(complete())
    expect(review.status).toBe('complete_headless')
    expect(review.validity).toBe('headless_unconfirmed')
    expect(review.persistence).toBe('not_checked')
    expect(review.profile).toEqual(profile)
    expect([review.presented, review.closed, review.unresolvedPresented, review.unpresented]).toEqual([120, 120, 0, 0])
    const metrics = review.metrics!
    expect(metrics.overall).toMatchObject({ correct: 120, wrong: 0, omitted: 0, denominator: 120, correctPercent: 100 })
    expect(metrics.overall.time).toMatchObject({ cleanCount: 120, medianDisplayMs: 300, iqrDisplayMs: 0 })
    expect([metrics.byRule.center.denominator, metrics.byRule.outer.denominator]).toEqual([60, 60])
    expect(Object.values(metrics.byCondition).map(group => group.denominator)).toEqual([40, 40, 40])
    expect(Object.values(metrics.byCell).flatMap(group => Object.values(group).map(cell => cell.denominator))).toEqual([20, 20, 20, 20, 20, 20])
    expect(metrics.switch.denominator + metrics.stay.denominator).toBe(115)
    expect(metrics.switchMinusStayMs).toBe(0)
    expect(metrics.opposedMinusAlignedMs).toBe(0)
    expect(Object.isFrozen(review) && Object.isFrozen(metrics.byCell.center.aligned.time)).toBe(true)
  })

  it('keeps wrong, omitted and too-fast correct actions in separate evidence sets', () => {
    const metrics = reconcileHeadless(complete(index => index === 1 ? 'wrong' :
      index === 2 ? 'omitted' : index === 3 ? 'early' : 'correct')).metrics!
    expect(metrics.overall).toMatchObject({ correct: 118, wrong: 1, omitted: 1, denominator: 120, correctPercent: 98.3 })
    expect(metrics.tooEarlyForTiming).toBe(1)
    expect(metrics.overall.time.cleanCount).toBe(117)
  })

  it('suppresses all aggregate scoring after invalidation, preserving only the known prefix', () => {
    let state = arm()
    expect(reconcileHeadless(state)).toMatchObject({ status: 'incomplete_headless', presented: 0,
      closed: 0, unresolvedPresented: 0, unpresented: 120, metrics: null })
    state = begin(state, 100, true)
    state = advance(state, { kind: 'fixation', atMs: 116 })
    state = advance(state, { kind: 'onset', atMs: 932 })
    state = advance(state, { kind: 'keydown', atMs: 1_132, code: 'ArrowLeft', repeat: false, modified: false })
    state = advance(state, { kind: 'invalidate', atMs: 1_133, reason: 'blur' })
    expect(reconcileHeadless(state)).toMatchObject({ status: 'invalid_headless', presented: 1,
      closed: 0, unresolvedPresented: 1, unpresented: 119, invalidReason: 'blur', metrics: null })
  })

  it('rejects modified events, completion, profile and scoring versions before any report', () => {
    const state = complete()
    expect(() => reconcileHeadless({ ...state, scoringVersion: 'arrows_scoring_v2' } as unknown as State)).toThrow()
    expect(() => reconcileHeadless({ ...state, events: state.events.slice(0, -1) })).toThrow()
    expect(() => reconcileHeadless({ ...state, events: state.events.map((event, index) =>
      index === 20 ? { ...event, trialIndex: 120 } : event) })).toThrow()
    expect(() => reconcileHeadless({ ...state, profile: { ...profile, rightCode: 'KeyF' } })).toThrow()
  })

  it('uses median-of-halves, minimum samples and one final half-away rounding', () => {
    expect(summarizeTimes([100, 200, 300, 400])).toMatchObject({ cleanCount: 4, medianMs: null, reason: 'fewer_than_five' })
    expect(summarizeTimes([100, 200, 300, 400, 500])).toMatchObject({ medianMs: 300, iqrMs: null, reason: 'fewer_than_eight' })
    expect(summarizeTimes([100, 200, 300, 400, 500, 600, 700, 800])).toMatchObject({ medianMs: 450, iqrMs: 400 })
    expect(summarizeTimes([100, 200, 300, 400, 500, 600, 700, 800, 900])).toMatchObject({ medianMs: 500, iqrMs: 500 })
    expect(contrastTimes(summarizeTimes(Array(9).fill(300.49)), summarizeTimes(Array(10).fill(299.51)))).toBeNull()
    expect(contrastTimes(summarizeTimes(Array(10).fill(300.49)), summarizeTimes(Array(10).fill(299.51)))).toBe(1)
    expect(contrastTimes(summarizeTimes(Array(10).fill(300)), summarizeTimes(Array(10).fill(300.5)))).toBe(-1)
    expect(roundHalfAway(0.5)).toBe(1)
    expect(roundHalfAway(-0.5)).toBe(-1)
    expect(Object.is(roundHalfAway(-0.1), -0)).toBe(false)
  })
})
