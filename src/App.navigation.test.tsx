import { useState } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import App from './App'
import { restoreStopRecords } from './stop/run'
import type { StopResult } from './stop/run'
import { restoreTrainingChain } from './stop/training'

// Isolate navigation; the real production-build check covers actual Stop completion.
vi.mock('./stop/Journey', () => ({ StopJourney: ({ recorder }: { recorder: { sessionId: string } }) => {
  const [result, setResult] = useState(false)
  return result ? <h1>Retained Stop result</h1> : <button onClick={() => {
    restoreStopRecords([{ sessionId: recorder.sessionId } as StopResult], [])
    setResult(true)
  }}>Complete controlled Stop</button>
} }))
beforeEach(() => { window.history.replaceState(null, '', '/practice'); restoreStopRecords([], []); restoreTrainingChain(null, true) })
afterEach(() => { cleanup(); restoreStopRecords([], []); restoreTrainingChain(null, true); vi.restoreAllMocks() })
it('uses production pushState and restores the same completed Stop view on Back without remounting', async () => {
  const createSession = vi.fn(() => ({ sessionId: 'navigation-result', record: vi.fn() }))
  render(<App storagePolicy="temporary" createSession={createSession as never} />)
  const push = vi.spyOn(window.history, 'pushState')
  fireEvent.click(screen.getByRole('link', { name: 'Open Stop' }))
  expect(window.location.pathname).toBe('/practice/stop')
  fireEvent.click(screen.getByRole('button', { name: 'Complete controlled Stop' }))
  const result = screen.getByRole('heading', { name: 'Retained Stop result' })
  fireEvent.click(screen.getByRole('link', { name: 'Assessments' }))
  expect(window.location.pathname).toBe('/practice')
  expect(screen.getByRole('heading', { name: 'Choose an assessment' })).toBeVisible()
  expect(result).not.toBeVisible()
  await act(async () => { window.history.back(); await new Promise(resolve => setTimeout(resolve, 50)) })
  expect(window.location.pathname).toBe('/practice/stop')
  expect(screen.getByRole('heading', { name: 'Retained Stop result' })).toBe(result)
  expect(result).toBeVisible()
  expect(createSession).toHaveBeenCalledOnce()
  expect(push.mock.calls.map(call => call[2])).toEqual(['/practice/stop', '/practice'])
})
it('leaves modified clicks, downloads, other targets and owned HTML document links to the browser', () => {
  render(<App storagePolicy="temporary" />)
  const push = vi.spyOn(window.history, 'pushState')
  const link = screen.getByRole('link', { name: 'Open Stop' })
  // Prevent jsdom attempting document navigation after checking the app did not consume it.
  const outcomes: boolean[] = []
  const inspect = (event: MouseEvent) => { outcomes.push(event.defaultPrevented); event.preventDefault() }
  document.addEventListener('click', inspect)
  try {
    fireEvent.click(link, { ctrlKey: true })
    link.setAttribute('download', ''); fireEvent.click(link); link.removeAttribute('download')
    link.setAttribute('target', '_blank'); fireEvent.click(link); link.removeAttribute('target')
    fireEvent.click(screen.getByRole('link', { name: 'Open Arrows' }))
    expect(outcomes).toEqual([false, false, false, false])
    expect(push).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { name: 'Choose an assessment' })).toBeVisible()
  } finally { document.removeEventListener('click', inspect) }
})
