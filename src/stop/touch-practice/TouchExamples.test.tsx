import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TouchExamples } from './TouchExamples'

afterEach(cleanup)
describe('Stop screen-tap examples', () => {
  it('counts a primary touch on the example area while keeping Check and Next as controls', () => {
    const complete = vi.fn()
    render(<TouchExamples onComplete={complete} />)
    const example = screen.getByRole('region', { name: 'Touch example 1 of 4' })
    fireEvent.pointerDown(example, { pointerType: 'touch', isPrimary: true })
    expect(screen.getByRole('status')).toHaveTextContent('Response recorded.')
    fireEvent.click(screen.getByRole('button', { name: 'Check example' }))
    expect(screen.getByRole('status')).toHaveTextContent('Correct.')
    fireEvent.click(screen.getByRole('button', { name: 'Next example' }))
    expect(screen.getByRole('region', { name: 'Touch example 2 of 4' })).toBeInTheDocument()
    expect(screen.getByRole('status')).not.toHaveTextContent('Response recorded.')
    fireEvent.click(screen.getByRole('button', { name: 'Check example' }))
    expect(screen.getByRole('status')).toHaveTextContent('Correct.')
    expect(complete).not.toHaveBeenCalled()
  })
})
