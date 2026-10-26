import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Guide, Rule } from './Guide'
import { Stimulus } from './Stimulus'

afterEach(cleanup)
describe('Stop guide and original stimuli', () => {
  it('shows the approved introduction and invitation-first limitation', () => {
    const next = vi.fn()
    render(<Guide onNext={next} />)
    expect(screen.getByRole('heading', { name: 'Learn the Stop task' })).toBeInTheDocument()
    expect(screen.getByText(/This is an original TraitGame exercise/)).toHaveTextContent('Follow the instructions in your invitation.')
    fireEvent.click(screen.getByRole('button', { name: 'See the rule' }))
    expect(next).toHaveBeenCalledOnce()
  })
  it('teaches both actions with redundant non-color labels and provides rule review', () => {
    render(<Rule review onNext={() => {}} />)
    expect(screen.getByRole('img', { name: 'GO — vertical marker' })).toHaveAttribute('src', '/stop/stimuli/standard-go.svg')
    expect(screen.getByRole('img', { name: 'NO-GO — horizontal marker' })).toHaveAttribute('src', '/stop/stimuli/standard-no-go.svg')
    expect(screen.getByText(/These names describe what happened in the task/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try the check again' })).toBeInTheDocument()
  })
  it('uses the original shape accommodation asset without a color-only label', () => {
    render(<Stimulus profile="shape_accommodation_v1" kind="GO" />)
    expect(screen.getByRole('img', { name: 'GO — vertical marker' })).toHaveAttribute('src', '/stop/stimuli/shape-go.svg')
  })
})
