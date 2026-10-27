import { StrictMode } from 'react'
import { act, cleanup, render, fireEvent, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { createEventRecorder } from './core/events'
import type { PreparationEventPayloads } from './stop/preparation'
import { STOP_EVENT_SCHEMA_VERSION } from './stop/versions'

let time = 0
function makeRecorder() {
  return createEventRecorder<PreparationEventPayloads, typeof STOP_EVENT_SCHEMA_VERSION>({
    sessionId: `test-${++time}`, schemaVersion: STOP_EVENT_SCHEMA_VERSION, clock: () => ++time,
  })
}
function click(name: string) { fireEvent.click(screen.getByRole(name.startsWith('Open ') ? 'link' : 'button', { name })) }
function press(code = 'Space', key = ' ', target: Element | Document | Window = window, extra: KeyboardEventInit = {}) {
  fireEvent.keyDown(target, { key, code, ...extra })
  fireEvent.keyUp(document, { key, code })
}
function toExamples() { click('Open Stop'); click('See the rule'); click('Try examples') }
function finishExamples() {
  for (let i = 0; i < 4; i++) {
    if (i % 2 === 0) press('Space', ' ', document)
    click('Check example')
    click(i === 3 ? 'Check my understanding' : 'Next example')
  }
}
function answer(correct = true) {
  const choices = [
    ['What should you do when GO appears?', correct ? 'Press Space once.' : 'Press Space repeatedly.'],
    ['What should you do when NO-GO appears?', 'Do nothing.'],
    ['Can you respond after the symbol disappears?', 'Yes, until the response window closes.'],
  ]
  for (const [question, label] of choices) fireEvent.click(within(screen.getByRole('group', { name: question })).getByLabelText(label))
}
function toPreflight() { toExamples(); finishExamples(); answer(); click('Check answers'); click('Check your setup') }
function physical() { fireEvent.click(screen.getByRole('checkbox', { name: 'I’m using a laptop or desktop with a physical keyboard.' })) }
function inputCheck(code = 'Space', key = ' ') {
  click('Run input check')
  press(code, key, screen.getByLabelText('Response-key input check'))
}
function toReady() { toPreflight(); physical(); inputCheck(); click('Continue to readiness') }

beforeEach(() => {
  window.history.replaceState(null, "", "/practice")
  window.innerWidth = 1024
  window.innerHeight = 768
  vi.spyOn(document, 'hasFocus').mockReturnValue(true)
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('Preparation regression and M2B-2 handoff (S01 partial, no report)', () => {
  it('completes library through readiness in StrictMode with exactly ordered preparation events', () => {
    const recorder = makeRecorder()
    render(<StrictMode><App storagePolicy="temporary" createSession={() => recorder} /></StrictMode>)
    expect(screen.getAllByRole('article')).toHaveLength(13)
    expect(screen.getByRole('link', { name: 'Open full mock' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Open Balloons' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open Keypresses' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open Faces' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open Arrows' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open Lengths' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open Digits' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open Cards' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open Easy or Hard' })).toBeInTheDocument()
    expect(screen.queryByText('Advanced training available')).not.toBeInTheDocument()
    toReady()
    expect(screen.getByRole('heading', { name: 'Ready to begin?' })).toHaveFocus()
    click('I’m ready')
    expect(screen.getByLabelText('Timed Stop task')).toBeInTheDocument()
    const events = recorder.snapshot()
    expect(events.map(event => event.type)).toEqual([
      'guide_opened', 'example_presented', 'example_resolved', 'example_presented', 'example_resolved',
      'example_presented', 'example_resolved', 'example_presented', 'example_resolved',
      'comprehension_answered', 'comprehension_answered', 'comprehension_answered',
      'device_check_completed', 'readiness_confirmed',
    ])
    expect(events.map(event => event.sequenceNumber)).toEqual(Array.from({ length: 14 }, (_, i) => i + 1))
    expect(new Set(events.map(event => event.sessionId)).size).toBe(1)
    expect(events.every(event => event.schemaVersion === STOP_EVENT_SCHEMA_VERSION && Object.isFrozen(event))).toBe(true)
    expect(events.at(-1)?.payload).toEqual({ focused: true, visible: true })
    expect(events.filter(event => event.type === 'example_presented').map(event => event.payload.expectedAction)).toEqual(['press', 'withhold', 'press', 'withhold'])
  })

  it('blocks incomplete and failed comprehension passes, requires rule review, and resets every answer on retry (S03–S04)', () => {
    const recorder = makeRecorder()
    render(<App storagePolicy="temporary" createSession={() => recorder} />)
    toExamples(); finishExamples()
    expect(screen.getByRole('button', { name: 'Check answers' })).toBeDisabled()
    fireEvent.click(within(screen.getByRole('group', { name: 'What should you do when GO appears?' })).getByLabelText('Press Space once.'))
    expect(screen.getByRole('button', { name: 'Check answers' })).toBeDisabled()
    expect(recorder.snapshot().filter(event => event.type === 'comprehension_answered')).toHaveLength(0)
    answer(false); click('Check answers')
    expect(screen.getByText('Review the rule and try again. This check is not scored.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Check your setup' })).not.toBeInTheDocument()
    click('Review the rule')
    expect(screen.getByRole('heading', { name: 'One rule, two actions' })).toHaveFocus()
    click('Try the check again')
    expect(screen.getAllByRole('radio').every(input => !(input as HTMLInputElement).checked)).toBe(true)
    answer(); click('Check answers')
    expect(screen.getByText('You have the rule. Next, check your device and begin the warm-up.')).toBeInTheDocument()
    expect(recorder.snapshot().filter(event => event.type === 'comprehension_answered').map(event => event.payload.attempt)).toEqual([1, 1, 1, 2, 2, 2])
  })

  it('uses the founder-approved per-question choices in stable answer order', () => {
    render(<App storagePolicy="temporary" />); toExamples(); finishExamples()
    expect(within(screen.getByRole('group', { name: 'What should you do when GO appears?' })).getAllByRole('radio').map(radio => radio.parentElement?.textContent)).toEqual(['Press Space once.', 'Do nothing.', 'Press Space repeatedly.'])
    expect(within(screen.getByRole('group', { name: 'What should you do when NO-GO appears?' })).getAllByRole('radio').map(radio => radio.parentElement?.textContent)).toEqual(['Do nothing.', 'Press Space once.', 'Wait for it to disappear, then press.'])
    expect(within(screen.getByRole('group', { name: 'Can you respond after the symbol disappears?' })).getAllByRole('radio').map(radio => radio.parentElement?.textContent)).toEqual(['Yes, until the response window closes.', 'No, the symbol must still be visible.', 'Only during the warm-up.'])
  })

  it('requires self-confirmation and a fresh key input, then stores the selected profile and binding (S05 partial)', () => {
    const recorder = makeRecorder()
    render(<App storagePolicy="temporary" createSession={() => recorder} />); toPreflight()
    expect(screen.getByRole('button', { name: 'Run input check' })).toBeDisabled()
    physical(); click('Change key')
    const remap = screen.getByLabelText('Choose a response key')
    expect(remap).toHaveFocus()
    press('KeyF', 'f', remap)
    expect(screen.getByRole('button', { name: 'Run input check' })).toHaveFocus()
    fireEvent.click(screen.getByRole('radio', { name: 'High-distinction shape form' }))
    expect(screen.getByText(/This version uses more distinct shapes/)).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'GO — vertical marker' })).toHaveAttribute('src', '/stop/stimuli/shape-go.svg')
    inputCheck('Space', ' ')
    expect(screen.getByText('We did not detect F. Press F once, check your keyboard, or choose another key.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue to readiness' })).toBeDisabled()
    press('KeyF', 'f', screen.getByLabelText('Response-key input check'))
    expect(screen.getByRole('button', { name: 'Continue to readiness' })).toHaveFocus()
    click('Continue to readiness')
    expect(recorder.snapshot().find(event => event.type === 'device_check_completed')?.payload).toEqual({
      inputBinding: 'KeyF', inputDeviceClass: 'physical_keyboard', visualProfile: 'shape_accommodation_v1', timingProfile: 'standard',
    })
    expect(screen.queryByRole('radio', { name: /extended/i })).not.toBeInTheDocument()
  })

  it('invalidates a previous key check when settings change or readiness returns to preflight', () => {
    render(<App storagePolicy="temporary" />); toPreflight(); physical(); inputCheck()
    fireEvent.click(screen.getByRole('radio', { name: 'High-distinction shape form' }))
    expect(screen.getByRole('button', { name: 'Continue to readiness' })).toBeDisabled()
    inputCheck(); click('Continue to readiness'); click('Change setup')
    expect(screen.getByRole('button', { name: 'Continue to readiness' })).toBeDisabled()
  })

  it('blocks held response keys and repeat events until keyup, including across blur (S09 readiness passed)', () => {
    const recorder = makeRecorder()
    render(<App storagePolicy="temporary" createSession={() => recorder} />); toReady()
    fireEvent.keyDown(document, { code: 'Space', key: ' ' })
    expect(screen.getByRole('button', { name: 'I’m ready' })).toBeDisabled()
    fireEvent.keyDown(document, { code: 'Space', key: ' ', repeat: true })
    fireEvent.blur(window); fireEvent.focus(window)
    expect(screen.getByRole('button', { name: 'I’m ready' })).toBeDisabled()
    fireEvent.keyUp(document, { code: 'Space', key: ' ' })
    expect(screen.getByRole('button', { name: 'I’m ready' })).toBeEnabled()
    expect(recorder.snapshot().some(event => event.type === 'readiness_confirmed')).toBe(false)
    click('I’m ready')
    expect(recorder.snapshot().filter(event => event.type === 'readiness_confirmed')).toHaveLength(1)
  })

  it('carries a held key from the input check into readiness without confirming', () => {
    const recorder = makeRecorder()
    render(<App storagePolicy="temporary" createSession={() => recorder} />); toPreflight(); physical(); click('Run input check')
    fireEvent.keyDown(screen.getByLabelText('Response-key input check'), { code: 'Space', key: ' ' })
    click('Continue to readiness')
    expect(screen.getByRole('button', { name: 'I’m ready' })).toBeDisabled()
    click('I’m ready')
    expect(recorder.snapshot().some(event => event.type === 'readiness_confirmed')).toBe(false)
    fireEvent.keyUp(document, { code: 'Space', key: ' ' })
    expect(screen.getByRole('button', { name: 'I’m ready' })).toBeEnabled()
  })

  it('cannot confirm readiness while the page is hidden or the window is blurred', () => {
    const recorder = makeRecorder()
    render(<App storagePolicy="temporary" createSession={() => recorder} />); toReady()
    fireEvent.blur(window)
    expect(screen.getByRole('button', { name: 'I’m ready' })).toBeDisabled()
    fireEvent.focus(window)
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    fireEvent(document, new Event('visibilitychange'))
    expect(screen.getByRole('button', { name: 'I’m ready' })).toBeDisabled()
    click('I’m ready')
    expect(recorder.snapshot().some(event => event.type === 'readiness_confirmed')).toBe(false)
    visibility.mockReturnValue('visible')
    fireEvent(document, new Event('visibilitychange'))
    expect(screen.getByRole('button', { name: 'I’m ready' })).toBeEnabled()
  })

  it.each([[767, 600], [768, 599], [320, 740]])('blocks preflight below minimum at %s × %s (S06/S65 partial)', (width, height) => {
    window.innerWidth = width; window.innerHeight = height
    render(<App storagePolicy="temporary" />); toPreflight(); physical()
    expect(screen.getByRole('button', { name: 'Run input check' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Continue to readiness' })).toBeDisabled()
    expect(screen.getByText(/The timed game needs a larger visible area/)).toBeInTheDocument()
  })

  it('accepts 768 × 600 and rechecks size when readiness is displayed', () => {
    window.innerWidth = 768; window.innerHeight = 600
    render(<App storagePolicy="temporary" />); toReady()
    expect(screen.getByRole('button', { name: 'I’m ready' })).toBeEnabled()
    act(() => { window.innerWidth = 767; window.dispatchEvent(new Event('resize')) })
    expect(screen.getByRole('button', { name: 'I’m ready' })).toBeDisabled()
  })

  it('does not intercept ordinary page Space and clears session navigation when returning to the library (S08)', () => {
    const sessions: ReturnType<typeof makeRecorder>[] = []
    render(<App storagePolicy="temporary" createSession={() => { const session = makeRecorder(); sessions.push(session); return session }} />)
    const event = new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true, cancelable: true })
    document.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
    click('Open Stop'); click('Back'); click('Open Stop')
    expect(sessions).toHaveLength(2)
    expect(sessions[0].sessionId).not.toBe(sessions[1].sessionId)
    expect(sessions.every(session => session.snapshot().length === 1)).toBe(true)
  })
})
