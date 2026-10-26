import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { BalloonsJourney } from './Journey'
import { BalloonsStore, freshRoot } from './storage'
const assign = vi.fn()
beforeEach(() => { vi.spyOn(BalloonsStore, 'open').mockResolvedValue({ read: async () => freshRoot(), assign } as unknown as BalloonsStore) })
afterEach(() => { cleanup(); vi.restoreAllMocks(); assign.mockClear() })
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }))
async function quiz() {
  await act(async () => { render(<BalloonsJourney onLibrary={() => {}} />) })
  expect(screen.getByText(/Pump to increase the amount you could collect/)).toBeInTheDocument()
  click('Try the worked example'); expect(screen.getByText('Current: 0 cents. Banked: 0 cents.')).toBeInTheDocument()
  click('Pump example'); click('Pump example'); expect(screen.getByText('Current: 10 cents. Banked: 0 cents.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Pump example' })).toBeDisabled(); click('Collect example')
  expect(screen.getByText('Current: 0 cents. Banked: 10 cents.')).toBeInTheDocument(); click('Check my understanding')
}
it('compound rule choice retries a wrong answer without assigning a scored form', async () => {
  await quiz()
  expect(screen.getAllByRole('radio')).toHaveLength(2)
  expect(screen.getByRole('button', { name: 'Check answer' })).toBeDisabled()
  fireEvent.click(screen.getByLabelText(/All 25 cents is lost/)); click('Check answer')
  expect(screen.queryByRole('heading', { name: 'Ready · check your controls' })).not.toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('The earlier 15 cents stays banked')
  click('Try again'); expect(screen.getAllByRole('radio').every(e => !(e as HTMLInputElement).checked)).toBe(true)
  fireEvent.click(screen.getByLabelText(/Only this balloon’s 10 cents/)); click('Check answer')
  expect(screen.getByRole('heading', { name: 'Ready · check your controls' })).toHaveFocus()
  expect(assign).not.toHaveBeenCalled()
})
it('both native checks and stable settings precede readiness; pattern/type and secrecy preserved', async () => {
  await quiz(); fireEvent.click(screen.getByLabelText(/Only this balloon’s 10 cents/)); click('Check answer')
  expect(screen.getByRole('button', { name: 'Start' })).toBeDisabled()
  click('Test Pump'); click('Test Collect'); expect(screen.getByRole('button', { name: 'Start' })).toBeEnabled()
  fireEvent.click(screen.getByLabelText('Reduced motion')); expect(screen.getByRole('button', { name: 'Start' })).toBeDisabled()
  for (const text of ['Type 1', 'Type 2', 'Type 3', 'Stripes', 'Dots', 'Grid']) expect(screen.getByText(text)).toBeInTheDocument()
  click('Test Pump'); click('Test Collect')
  expect(screen.getByRole('button', { name: 'Start' })).toBeEnabled()
  expect(assign).not.toHaveBeenCalled(); expect(document.body.textContent).not.toMatch(/threshold|T=6|profile [ABC]/)
})
