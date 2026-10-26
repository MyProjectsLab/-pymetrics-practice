import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ReactGameActionBoundary } from './ReactGameActionBoundary'

afterEach(cleanup)

it('retires before an enabled choice callback, including a changed form choice', () => {
  const order: string[] = []
  render(<ReactGameActionBoundary onCompetingAction={() => order.push('retire')}>
    <button onClick={() => order.push('example')}>See an example</button>
    <label>Hand <select onChange={() => order.push('hand')}><option value="">Choose</option><option value="left">Left</option></select></label>
    <form onSubmit={event => { event.preventDefault(); order.push('submit') }}><button type="submit">Submit choices</button></form>
  </ReactGameActionBoundary>)
  fireEvent.click(screen.getByRole('button', { name: 'See an example' }))
  fireEvent.change(screen.getByRole('combobox', { name: 'Hand' }), { target: { value: 'left' } })
  fireEvent.submit(screen.getByRole('button', { name: 'Submit choices' }).closest('form')!)
  expect(order).toEqual(['retire', 'example', 'retire', 'hand', 'retire', 'submit'])
})

it('preserves marked Return and Continue and ignores disabled controls', () => {
  const retire = vi.fn(), returnClick = vi.fn(), continueClick = vi.fn()
  render(<ReactGameActionBoundary onCompetingAction={retire}>
    <button data-mock-return-intent onClick={returnClick}>Return</button>
    <button data-mock-return-intent onClick={continueClick}>Continue</button>
    <button disabled onClick={vi.fn()}>Disabled button</button>
    <label htmlFor="disabled-choice">Disabled choice</label><input id="disabled-choice" disabled type="checkbox" />
  </ReactGameActionBoundary>)
  fireEvent.click(screen.getByRole('button', { name: 'Return' }))
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
  fireEvent.click(screen.getByRole('button', { name: 'Disabled button' }))
  fireEvent.click(screen.getByText('Disabled choice'))
  fireEvent.keyDown(window, { key: 'Space', code: 'Space' })
  expect(returnClick).toHaveBeenCalledOnce()
  expect(continueClick).toHaveBeenCalledOnce()
  expect(retire).not.toHaveBeenCalled()
})
