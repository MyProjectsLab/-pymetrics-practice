import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it } from 'vitest'
import App from './App'
import { createPreparationRecorder } from './stop/preparation'
import { restoreStopRecords } from './stop/run'
import { restoreTrainingChain } from './stop/training'
import { setStopLocalStore } from './stop/storage'
const makeRecorder = () => createPreparationRecorder()
const click = (name: string) => fireEvent.click(screen.getByRole(name.startsWith('Open ') ? 'link' : 'button', { name }))
beforeEach(() => { window.history.replaceState(null, '', '/practice'); restoreStopRecords([], []); restoreTrainingChain(null, true); setStopLocalStore(null) })
afterEach(() => { cleanup(); restoreStopRecords([], []); restoreTrainingChain(null, true); setStopLocalStore(null) })
it('keeps the current twelve assessments and full mock reachable from the actual library', () => {
  render(<App storagePolicy="temporary" />)
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
})
  it('does not intercept ordinary page Space and clears session navigation when returning to the library (S08)', () => {
    const sessions: ReturnType<typeof makeRecorder>[] = []
    render(<App storagePolicy="temporary" createSession={() => { const session = makeRecorder(); sessions.push(session); return session }} />)
    const event = new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true, cancelable: true })
    document.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
    click('Open Stop'); click('Main menu'); click('Open Stop')
    expect(sessions).toHaveLength(2)
    expect(sessions[0].sessionId).not.toBe(sessions[1].sessionId)
    expect(sessions.map(session => session.snapshot().map(event => event.type))).toEqual([
      ['guide_opened', 'onboarding_v13_opened'], ['guide_opened', 'onboarding_v13_opened'],
    ])
  })
