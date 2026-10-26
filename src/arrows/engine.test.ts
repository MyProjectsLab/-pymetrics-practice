import { beforeAll, describe, expect, it } from 'vitest'
import type { Form } from './contracts'
import { advance, armHeadless, verifyHeadless } from './engine'
import type { State } from './engine'
import { loadArrowsForms } from './manifests'

let form: Form
const identity = { installationId: 'installation-1', sessionId: 'session-1', clockDomainId: 'clock-1' }
const keyboard = { kind: 'keyboard', leftCode: 'ArrowLeft', rightCode: 'ArrowRight',
  alternative: false, accommodation: 'default', reducedMotion: false } as const
beforeAll(async () => { form = (await loadArrowsForms()).get('AR1')! })
const fresh = () => armHeadless(form, identity, keyboard, 100)
const send = (state: State, kind: 'start' | 'continue' | 'fixation' | 'onset' | 'resolve' | 'offset', atMs: number) =>
  kind === 'start' || kind === 'continue' ? advance(state, { kind, atMs, responseHeld: false }) : advance(state, { kind, atMs })

function firstOnset() {
  let state = fresh()
  state = send(state, 'start', 100)
  state = send(state, 'fixation', 116)
  state = send(state, 'onset', 932) // 116 + 800 + one frame
  return state
}

describe('headless Arrows timing engine', () => {
  it('reconciles a full 5-block, 120-trial command/event journey', () => {
    let state = fresh(), next = 100
    for (let trial = 1; trial <= 120; trial++) {
      if (trial === 1 || trial % 24 === 1) {
        state = send(state, trial === 1 ? 'start' : 'continue', next)
        state = send(state, 'fixation', next + 16)
      } else state = send(state, 'fixation', next + 16)
      const due = state.stimulusDueMs!
      state = send(state, 'onset', due + 16)
      const code = form.trials[trial - 1].direction === 'left' ? 'ArrowLeft' : 'ArrowRight'
      state = advance(state, { kind: 'keydown', atMs: state.onsetMs! + 300, code, repeat: false, modified: false })
      state = advance(state, { kind: 'keyup', atMs: state.onsetMs! + 301, code })
      state = send(state, 'resolve', state.resolutionDueMs! + 8)
      state = send(state, 'offset', state.resolutionDueMs! + 16)
      next = state.events.at(-1)!.atMs + (trial % 24 === 0 ? 1_000 : 0)
    }
    expect(state.phase).toBe('completed')
    expect(state.events.filter(event => event.type === 'stimulus_presented')).toHaveLength(120)
    expect(state.events.filter(event => event.type === 'trial_closed')).toHaveLength(120)
    expect(state.events.filter(event => event.type === 'response')).toHaveLength(120)
    expect(state.events.filter(event => event.type === 'block_started')).toHaveLength(5)
    expect(state.events.filter(event => event.type === 'block_summary_ready')).toHaveLength(4)
    expect(state.events.at(-1)?.type).toBe('session_completed')
    expect(state.events.every((event, index) => event.sequenceNumber === index + 1 && event.validity === 'headless_unconfirmed')).toBe(true)
    expect(verifyHeadless(state)).toBe(true)
    const forged = { ...state, events: state.events.map((event, index) =>
      index === 20 ? { ...event, trialIndex: 120 } : event) }
    expect(verifyHeadless(forged)).toBe(false)
  })

  it('retains confirmed onset before immediate severe invalidation, never fabricating a closure', () => {
    let state = fresh()
    state = send(state, 'start', 100)
    state = send(state, 'fixation', 116)
    state = send(state, 'onset', 1_167.001) // due 916, more than 250 ms late
    expect(state.phase).toBe('invalid')
    expect(state.events.filter(event => event.type === 'stimulus_presented')).toHaveLength(1)
    expect(state.events.filter(event => event.type === 'trial_closed')).toHaveLength(0)
    expect(state.invalidReason).toBe('timing')
    expect(verifyHeadless(state)).toBe(true)
  })

  it('treats exact 250-ms lateness as a note and 250.001 as severe', () => {
    let state = fresh()
    state = send(state, 'start', 100)
    state = send(state, 'fixation', 116)
    state = send(state, 'onset', 1_166) // due 916 + 250
    expect(state.phase).toBe('stimulus')
    expect(state.timingNoted).toBe(true)
    expect(state.events.find(event => event.type === 'timing_note')?.detail.latenessMs).toBe(250)
    state = send(state, 'resolve', state.resolutionDueMs!)
    state = send(state, 'offset', state.resolutionDueMs!)
    expect(state.phase).toBe('fixation_pending')
  })

  it('anchors offset lateness to the original deadline, not the late removal request', () => {
    let state = firstOnset() // onset 932, deadline 2432
    const deadline = state.resolutionDueMs!
    state = send(state, 'resolve', deadline + 240)
    state = send(state, 'offset', deadline + 260)
    expect(state.phase).toBe('invalid')
    expect(state.events.filter(event => event.type === 'stimulus_offset')).toHaveLength(1)
    expect(state.events.filter(event => event.type === 'trial_closed')).toHaveLength(0)
  })

  it('records the observed severe resolution before invalidation without an omission or close', () => {
    let state = firstOnset()
    const due = state.resolutionDueMs!
    state = send(state, 'resolve', due + 250.001)
    expect(state.phase).toBe('invalid')
    expect(state.resolutionMs).toBe(due + 250.001)
    const tail = state.events.slice(-2)
    expect(tail.map(event => event.type)).toEqual(['deadline_resolved', 'invalidated'])
    expect(tail[0].detail).toMatchObject({ stage: 'resolution', dueMs: due, actualMs: due + 250.001 })
    expect(state.events.filter(event => event.type === 'omitted' || event.type === 'trial_closed')).toHaveLength(0)
    expect(verifyHeadless(state)).toBe(true)
  })

  it('rejects malformed primitive bindings, identities and duplicate object bindings before arming', () => {
    expect(() => armHeadless(form, identity, { ...keyboard, leftCode: ['ArrowLeft'] } as unknown as typeof keyboard, 100)).toThrow('invalid key bindings')
    expect(() => armHeadless(form, identity, { ...keyboard, leftCode: ['ArrowLeft'], rightCode: ['ArrowLeft'] } as unknown as typeof keyboard, 100)).toThrow('invalid key bindings')
    expect(() => armHeadless(form, { ...identity, sessionId: 42 } as unknown as typeof identity, keyboard, 100)).toThrow('invalid identity')
    expect(() => armHeadless(form, { ...identity, clockDomainId: [] } as unknown as typeof identity, keyboard, 100)).toThrow('invalid identity')
    expect(() => armHeadless(form, { ...identity, installationId: '  ' }, keyboard, 100)).toThrow('invalid identity')
  })

  it('rejects unsupported or malformed commands even after the response deadline', () => {
    let state = firstOnset()
    const due = state.resolutionDueMs!
    state = send(state, 'resolve', due + 250.001)
    const forged = { ...state, commands: [...state.commands.slice(0, -1),
      { kind: 'nonsense', atMs: due + 250.001 } as unknown as State['commands'][number]] }
    expect(verifyHeadless(forged)).toBe(false)
    const before = firstOnset()
    expect(() => advance(before, { kind: 'nonsense', atMs: due + 250.001 } as unknown as State['commands'][number])).toThrow('unsupported command')
    expect(() => advance(before, { kind: 'keydown', atMs: due + 250.001, code: 'ArrowLeft', repeat: false, modified: false, extra: true } as unknown as State['commands'][number])).toThrow('malformed fields')
    expect(() => advance(before, { kind: 'offset', atMs: due + 250.001 })).toThrow('offset out of order')
  })

  it('excludes mild lateness without invalidation and gates watchdog at due plus 2 seconds', () => {
    let state = fresh()
    state = send(state, 'start', 100)
    expect(() => advance(state, { kind: 'watchdog', atMs: 2_099 })).toThrow('watchdog before')
    state = send(state, 'fixation', 151) // due 100 + 51
    expect(state.timingNoted).toBe(true)
    expect(state.phase).toBe('fixation')
    expect(() => advance(state, { kind: 'watchdog', atMs: state.stimulusDueMs! + 1_999 })).toThrow('watchdog before')
    state = advance(state, { kind: 'watchdog', atMs: state.stimulusDueMs! + 2_000 })
    expect(state.phase).toBe('invalid')
    expect(state.invalidReason).toBe('watchdog')
    expect(state.events.filter(event => event.type === 'stimulus_presented')).toHaveLength(0)
  })

  it('uses first fresh response, rearming after an early held key and excluding the exact deadline', () => {
    let state = fresh()
    state = send(state, 'start', 100)
    state = send(state, 'fixation', 116)
    state = advance(state, { kind: 'keydown', atMs: 200, code: 'ArrowLeft', repeat: false, modified: false })
    state = send(state, 'onset', 932)
    state = advance(state, { kind: 'keydown', atMs: 1_000, code: 'ArrowLeft', repeat: true, modified: false })
    expect(state.firstResponse).toBeNull()
    state = advance(state, { kind: 'keyup', atMs: 1_100, code: 'ArrowLeft' })
    state = advance(state, { kind: 'keydown', atMs: 1_200, code: 'ArrowRight', repeat: false, modified: false })
    state = advance(state, { kind: 'keydown', atMs: 1_400, code: 'ArrowLeft', repeat: false, modified: false })
    expect(state.firstResponse?.direction).toBe('right')
    expect(state.events.filter(event => event.type === 'response_extra')).toHaveLength(1)
    state = send(state, 'resolve', state.resolutionDueMs!)
    expect(state.events.filter(event => event.type === 'omitted')).toHaveLength(0)
    expect(verifyHeadless(state)).toBe(true)
  })

  it('records exact-deadline action as boundary extra and closes an omission', () => {
    let state = firstOnset()
    state = advance(state, { kind: 'keydown', atMs: state.resolutionDueMs!, code: 'ArrowLeft', repeat: false, modified: false })
    expect(state.firstResponse).toBeNull()
    expect(state.events.filter(event => event.type === 'boundary_extra')).toHaveLength(1)
    state = send(state, 'resolve', state.resolutionDueMs!)
    state = send(state, 'offset', state.resolutionDueMs! + 16)
    expect(state.events.filter(event => event.type === 'omitted')).toHaveLength(1)
    expect(state.events.filter(event => event.type === 'trial_closed')).toHaveLength(1)
  })

  it('ignores unrelated raw keys and invalidates on a protected profile change', () => {
    let state = firstOnset()
    expect(advance(state, { kind: 'keydown', atMs: 940, code: 'KeyZ', repeat: false, modified: false })).toBe(state)
    state = advance(state, { kind: 'invalidate', atMs: 941, reason: 'settings' })
    expect(state.phase).toBe('invalid')
    expect(state.events.at(-1)?.detail.reason).toBe('settings')
  })

  it('does not invalidate for a hidden untimed break and requires unheld controls at Continue', () => {
    let state = fresh()
    expect(() => advance(state, { kind: 'start', atMs: 100, responseHeld: true })).toThrow('held at start')
    state = send(state, 'start', 100)
    for (let trial = 1; trial <= 24; trial++) {
      state = send(state, 'fixation', (state.fixationDueMs ?? 100) + 16)
      state = send(state, 'onset', state.stimulusDueMs! + 16)
      state = send(state, 'resolve', state.resolutionDueMs!)
      state = send(state, 'offset', state.resolutionDueMs! + 16)
    }
    expect(state.phase).toBe('break')
    expect(advance(state, { kind: 'invalidate', atMs: state.events.at(-1)!.atMs + 10, reason: 'hidden' })).toBe(state)
    expect(() => advance(state, { kind: 'continue', atMs: state.events.at(-1)!.atMs + 20, responseHeld: true })).toThrow('held at start')
    state = send(state, 'continue', state.events.at(-1)!.atMs + 30)
    expect(state.phase).toBe('fixation_pending')
  })

  it('admits one primary pointer and requires release/new press', async () => {
    const pointer = { kind: 'pointer', pointerSource: 'touch', alternative: false,
      accommodation: 'default', reducedMotion: false } as const
    let state = armHeadless(form, identity, pointer, 100)
    state = send(state, 'start', 100)
    state = send(state, 'fixation', 116)
    state = send(state, 'onset', 932)
    state = advance(state, { kind: 'pointerdown', atMs: 1_100, direction: 'left', pointerId: 1, pointerType: 'touch', button: 0, isPrimary: true })
    state = advance(state, { kind: 'pointerdown', atMs: 1_200, direction: 'right', pointerId: 2, pointerType: 'touch', button: 0, isPrimary: true })
    expect(state.firstResponse?.direction).toBe('left')
    expect(state.events.filter(event => event.type === 'response_ignored')).toHaveLength(1)
    state = advance(state, { kind: 'pointerup', atMs: 1_250, pointerId: 1 })
    state = advance(state, { kind: 'pointerdown', atMs: 1_300, direction: 'right', pointerId: 2, pointerType: 'touch', button: 0, isPrimary: true })
    expect(state.events.filter(event => event.type === 'response_extra')).toHaveLength(1)
    expect(verifyHeadless(state)).toBe(true)
  })
})
