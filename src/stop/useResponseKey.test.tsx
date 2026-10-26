import { act, fireEvent, render, screen, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { spaceBinding } from './preparation'
import { useResponseKey } from './useResponseKey'

afterEach(cleanup)

function Probe() {
  const input = useResponseKey(spaceBinding)
  return <><output aria-label="Held">{String(input.held)}</output>
    <output aria-label="Focus">{String(input.focused)}</output>
    <output aria-label="Width">{input.viewport.width}</output></>
}

describe('pre-readiness held-key state', () => {
  it('requires keyup, survives blur, and ignores releases of other keys', () => {
    render(<Probe />)
    fireEvent.keyDown(window, { key: ' ', code: 'Space' })
    expect(screen.getByLabelText('Held')).toHaveTextContent('true')
    fireEvent.blur(window)
    fireEvent.focus(window)
    expect(screen.getByLabelText('Held')).toHaveTextContent('true')
    fireEvent.keyUp(window, { key: 'f', code: 'KeyF' })
    expect(screen.getByLabelText('Held')).toHaveTextContent('true')
    fireEvent.keyUp(window, { key: ' ', code: 'Space' })
    expect(screen.getByLabelText('Held')).toHaveTextContent('false')
  })
  it('updates viewport requirements after resize', () => {
    const original = window.innerWidth
    render(<Probe />)
    act(() => { window.innerWidth = 320; window.dispatchEvent(new Event('resize')) })
    expect(screen.getByLabelText('Width')).toHaveTextContent('320')
    window.innerWidth = original
  })
})
