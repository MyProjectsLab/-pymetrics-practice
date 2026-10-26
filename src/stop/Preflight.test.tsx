import { useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Preflight } from './Preflight'
import type { StopSetup } from './Preflight'
import { spaceBinding } from './preparation'
import { setStopLocalStore } from './storage'
import type { StopLocalStore } from './storage'

afterEach(cleanup)
function Harness() {
  const [setup, setSetup] = useState<StopSetup>({ binding: spaceBinding, visualProfile: 'standard', physicalKeyboard: true })
  return <Preflight setup={setup} onChange={setSetup} held={false} viewport={{ width: 1024, height: 768 }} onComplete={() => {}} />
}

describe('preflight remapping controls', () => {
  it('focuses key capture and announces the selected key consistently', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Change key' }))
    const capture = screen.getByRole('group', { name: 'Choose a response key' })
    expect(capture).toHaveFocus()
    fireEvent.keyDown(capture, { key: 'f', code: 'KeyF' })
    expect(screen.getByText('Response key: F. Run the input check again.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Run input check' }))
    const check = screen.getByRole('group', { name: 'Response-key input check' })
    expect(check).toHaveFocus()
    fireEvent.keyDown(check, { key: ' ', code: 'Space' })
    expect(screen.getByText('We did not detect F. Press F once, check your keyboard, or choose another key.').closest('[role="status"]')).toHaveTextContent('We did not detect F. Press F once, check your keyboard, or choose another key.')
    fireEvent.keyDown(check, { key: 'f', code: 'KeyF' })
    expect(screen.getByText('F detected.').closest('[role="status"]')).toHaveTextContent('F detected.')
    expect(screen.getByRole('button', { name: 'Continue to readiness' })).toHaveFocus()
  })
  it.each([
    { key: 'Escape', code: 'Escape' }, { key: 'Tab', code: 'Tab' }, { key: 'Shift', code: 'ShiftLeft' },
    { key: 'F5', code: 'F5' }, { key: 'f', code: 'KeyF', ctrlKey: true },
    { key: 'f', code: 'KeyF', metaKey: true }, { key: 'f', code: 'KeyF', repeat: true },
  ])('rejects prohibited input %j without changing the binding', key => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Change key' }))
    fireEvent.keyDown(screen.getByRole('group', { name: 'Choose a response key' }), key)
    expect(screen.getByText(/Choose Space, a letter/)).toBeInTheDocument()
    expect(screen.getByText('Space', { selector: 'kbd' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue to readiness' })).toBeDisabled()
  })
  it('leaves Tab default navigation enabled in the key capture', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Change key' }))
    const tab = new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', bubbles: true, cancelable: true })
    fireEvent(screen.getByRole('group', { name: 'Choose a response key' }), tab)
    expect(tab.defaultPrevented).toBe(false)
  })
})


it('fails closed at persistent retest preflight when cross-tab presentation ordering is unavailable', () => {
  setStopLocalStore({} as StopLocalStore)
  try {
    render(<Preflight lockedProfile setup={{ binding: spaceBinding, visualProfile: 'standard', physicalKeyboard: true }}
      onChange={() => {}} held={false} viewport={{ width: 1024, height: 768 }} onComplete={() => { throw Error('unsupported start') }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Run input check' }))
    fireEvent.keyDown(screen.getByRole('group', { name: 'Response-key input check' }), { key: ' ', code: 'Space' })
    expect(screen.getByRole('alert')).toHaveTextContent('This browser cannot provide the timing or storage checks required for a valid session.')
    expect(screen.getByRole('button', { name: 'Continue to readiness' })).toBeDisabled()
  } finally { setStopLocalStore(null) }
})

it('M6-A discloses assistive-input latency before readiness', () => {
  render(<Harness />)
  expect(screen.getByText(/If your response method adds delay, use untimed practice/)).toBeVisible()
  expect(screen.queryByText(/This response method may add delay/)).not.toBeInTheDocument()
})

it('blocks latency-affected timed access and requires a fresh key check after changing back', () => {
  render(<Harness />)
  const check = () => {
    fireEvent.click(screen.getByRole('button', { name: 'Run input check' }))
    fireEvent.keyDown(screen.getByRole('group', { name: 'Response-key input check' }), { key: ' ', code: 'Space' })
  }
  check()
  expect(screen.getByRole('button', { name: 'Continue to readiness' })).toBeEnabled()
  fireEvent.click(screen.getByRole('checkbox', { name: /My response method adds delay/ }))
  expect(screen.getByRole('button', { name: 'Continue to readiness' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Run input check' })).toBeDisabled()
  expect(screen.getAllByRole('status').some(item => item.textContent?.includes('This response method may add delay'))).toBe(true)
  fireEvent.click(screen.getByRole('checkbox', { name: /My response method adds delay/ }))
  expect(screen.getByRole('button', { name: 'Continue to readiness' })).toBeDisabled()
  check()
  expect(screen.getByRole('button', { name: 'Continue to readiness' })).toBeEnabled()
})
