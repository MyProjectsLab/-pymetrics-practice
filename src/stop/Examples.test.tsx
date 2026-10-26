import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Examples } from './Examples'
import { createPreparationRecorder, spaceBinding } from './preparation'

afterEach(cleanup)
function key(extra: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true, cancelable: true, ...extra })
  fireEvent(screen.getByRole('button', { name: 'Check example' }), event)
  fireEvent.keyUp(document, { key: ' ', code: 'Space' })
  return event
}
function click(name: string) { fireEvent.click(screen.getByRole('button', { name })) }

describe('M2A-01 untimed examples', () => {
  it('checks all four outcome combinations in fixed GO/NO-GO order with exact feedback', () => {
    const recorder = createPreparationRecorder()
    const complete = vi.fn()
    render(<Examples recorder={recorder} binding={spaceBinding} held={false} onComplete={complete} />)
    key(); key();
    expect(screen.getByText('Response recorded. Select Check example.')).toBeInTheDocument()
    expect(screen.queryByText('Correct. You responded to GO.')).not.toBeInTheDocument()
    expect(recorder.snapshot()).toHaveLength(0)
    click('Check example')
    expect(screen.getByText('Correct. You responded to GO.')).toBeInTheDocument()
    click('Next example'); click('Check example')
    expect(screen.getByText('Correct. You withheld your response.')).toBeInTheDocument()
    click('Next example'); click('Check example')
    expect(screen.getByText('This was GO. Press Space when it appears.')).toBeInTheDocument()
    click('Next example'); key(); click('Check example')
    expect(screen.getByText('This was NO-GO. Do not press when it appears.')).toBeInTheDocument()
    click('Check my understanding')
    expect(complete).toHaveBeenCalledOnce()
    expect(recorder.snapshot().filter(e => e.type === 'example_resolved').map(e => e.payload.observedAction)).toEqual(['press', 'withhold', 'withhold', 'press'])
    expect(screen.queryByRole('button', { name: /undo/i })).not.toBeInTheDocument()
  })
  it.each([{ repeat: true }, { ctrlKey: true }, { altKey: true }, { metaKey: true }, { shiftKey: true }, { isComposing: true }, { key: 'f', code: 'KeyF' }])('ignores ineligible input %j', extra => {
    const recorder = createPreparationRecorder()
    render(<Examples recorder={recorder} binding={spaceBinding} held={false} onComplete={() => {}} />)
    key(extra); click('Check example')
    expect(recorder.snapshot()[0].payload).toEqual({ exampleId: 'example-1', observedAction: 'withhold' })
  })
  it('does not accept a response inherited from a held key', () => {
    const recorder = createPreparationRecorder()
    render(<Examples recorder={recorder} binding={spaceBinding} held onComplete={() => {}} />)
    key(); click('Check example')
    expect(screen.getByText('This was GO. Press Space when it appears.')).toBeInTheDocument()
  })
  it('cancels Space default activation on Check example but leaves Enter available', () => {
    render(<Examples recorder={createPreparationRecorder()} binding={spaceBinding} held={false} onComplete={() => {}} />)
    expect(key().defaultPrevented).toBe(true)
    const enter = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true })
    fireEvent(screen.getByRole('button', { name: 'Check example' }), enter)
    expect(enter.defaultPrevented).toBe(false)
    expect(screen.getByRole('button', { name: 'Check example' })).toBeInTheDocument()
  })
  it('uses the selected key and shape profile when examples are revisited', () => {
    render(<Examples recorder={createPreparationRecorder()} binding={{ code: 'KeyF', label: 'F' }} profile="shape_accommodation_v1" held={false} onComplete={() => {}} />)
    expect(screen.getByText('Press F for GO.')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'GO — vertical marker' })).toHaveAttribute('src', '/stop/stimuli/shape-go.svg')
    expect(key().defaultPrevented).toBe(false)
    expect(screen.queryByText('Response recorded. Select Check example.')).not.toBeInTheDocument()
    key({ key: 'f', code: 'KeyF' }); click('Check example')
    expect(screen.getByText('Correct. You responded to GO.')).toBeInTheDocument()
  })
  it.each([spaceBinding, { code: 'KeyF', label: 'F' }])('scopes defaults to $label with Check example focused', binding => {
    const recorder = createPreparationRecorder()
    render(<Examples recorder={recorder} binding={binding} held={false} onComplete={() => {}} />)
    const button = screen.getByRole('button', { name: 'Check example' })
    button.focus()
    expect(button).toHaveFocus()
    const dispatch = (type: string, code: string, key: string) => {
      const event = new KeyboardEvent(type, { code, key, bubbles: true, cancelable: true })
      fireEvent(document.activeElement!, event)
      return event.defaultPrevented
    }
    for (const type of ['keydown', 'keyup']) {
      expect(dispatch(type, 'Tab', 'Tab')).toBe(false)
      expect(dispatch(type, 'Enter', 'Enter')).toBe(false)
      expect(dispatch(type, 'Space', ' ')).toBe(binding.code === 'Space')
    }
    expect(button).toHaveFocus()
    expect(recorder.snapshot()).toHaveLength(0)
    if (binding.code !== 'Space') {
      expect(screen.queryByText('Response recorded. Select Check example.')).not.toBeInTheDocument()
      expect(dispatch('keydown', 'KeyF', 'f')).toBe(true)
      expect(dispatch('keyup', 'KeyF', 'f')).toBe(true)
    }
    expect(screen.getByText('Response recorded. Select Check example.')).toBeInTheDocument()
    // jsdom does not synthesize native button activation from keyboard events.
    // Real Tab/Space/Enter activation is verified separately in the production browser.
    click('Check example')
    expect(recorder.snapshot()[0].payload).toEqual({ exampleId: 'example-1', observedAction: 'press' })
    expect(screen.getByRole('button', { name: 'Next example' })).toHaveFocus()
    expect(dispatch('keydown', 'Space', ' ')).toBe(false)
    expect(dispatch('keyup', 'Space', ' ')).toBe(false)
    expect(recorder.snapshot()).toHaveLength(1)
  })
})
