import { StrictMode } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AnalyticsConsent } from './Consent'
import { useCoarseEvent, useSessionAnalytics } from './observations'
import { stopAnalytics } from './client'
import App from '../App'
const network = vi.hoisted(() => ({ send: vi.fn(async () => new Response(null, { status: 204 })) }))
vi.mock('./client', async original => {
  const actual = await original<typeof import('./client')>()
  return { ...actual, candidateAnalyticsAvailable: true, stopAnalytics: actual.createAnalyticsClient({ available: true, send: network.send }) }
})
beforeEach(() => {
  window.history.replaceState(null, "", "/practice"); vi.useFakeTimers(); stopAnalytics.setConsent(false); network.send.mockClear() })
afterEach(() => { cleanup(); stopAnalytics.setConsent(false); vi.useRealTimers(); vi.unstubAllGlobals() })
async function flush() { await act(() => vi.advanceTimersByTimeAsync(100)) }
const rows = () => network.send.mock.calls.map(call => JSON.parse((call as unknown as [string, RequestInit])[1].body as string))
function Session({ mode = 'baseline', status = null, pending = false }: Parameters<typeof useSessionAnalytics> extends [infer M, infer S, boolean] ? { mode?: M; status?: S; pending?: boolean } : never) {
  useSessionAnalytics(mode, status, pending); return <p>Game remains available</p>
}
it('proposal notice is separate, consent starts off, decline and withdrawal keep the library and guide usable', async () => {
  render(<App storagePolicy="temporary" />)
  expect(screen.getByRole('link', { name: 'Open Stop' })).toBeEnabled()
  expect(screen.getByText('Analytics consent is off.')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Decline analytics' }))
  fireEvent.click(screen.getByRole('link', { name: 'Open Stop' })); await flush()
  expect(screen.getByRole('heading', { name: 'Stop' })).toBeInTheDocument(); expect(network.send).not.toHaveBeenCalled()
})
it('withdrawal updates UI, cancels future transport and remains off after remount', async () => {
  const ui = render(<AnalyticsConsent />)
  fireEvent.click(screen.getByRole('button', { name: 'Allow optional analytics' }))
  expect(screen.getByText('Analytics consent is on for this page.')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Withdraw analytics consent' }))
  stopAnalytics.emit({ event: 'stop_drill_started' }); await flush(); expect(network.send).not.toHaveBeenCalled()
  ui.unmount(); render(<AnalyticsConsent />); expect(screen.getByText('Analytics consent is off.')).toBeInTheDocument()
})
it.each(['baseline', 'replay', 'retest'] as const)('observes %s start/end once in StrictMode with no details or retrospective payload', async mode => {
  stopAnalytics.setConsent(true)
  const ui = render(<StrictMode><Session mode={mode} /></StrictMode>); await flush()
  ui.rerender(<StrictMode><Session mode={mode} status="completed" /></StrictMode>); await flush()
  ui.rerender(<StrictMode><Session mode={mode} status="completed" pending /></StrictMode>); await flush()
  expect(rows().filter(row => row.event === 'stop_session_started')).toHaveLength(1)
  expect(rows().filter(row => row.event === 'stop_session_ended')).toHaveLength(1)
  expect(rows().map(row => row.event)).toEqual(mode === 'retest' ? ['stop_session_started', 'stop_retest_started', 'stop_session_ended', 'stop_retest_completed'] : ['stop_session_started', 'stop_session_ended'])
  expect(Object.keys(rows()[0]).sort()).toEqual(['event', 'mode', 'session_id'])
})
it('leaving an unfinished session records only invalid, no completion', async () => {
  stopAnalytics.setConsent(true); const ui = render(<Session />); await flush(); ui.unmount(); await flush()
  expect(rows().at(-1)).toMatchObject({ event: 'stop_session_ended', status: 'invalid' })
})
it('coarse drill and recommendation observations never send a standard session start or drill identity', async () => {
  function Drill({ complete = false }) { useCoarseEvent({ event: complete ? 'stop_drill_completed' : 'stop_drill_started' }); return null }
  stopAnalytics.setConsent(true); const ui = render(<StrictMode><Drill /></StrictMode>); await flush()
  ui.rerender(<StrictMode><Drill complete /></StrictMode>); await flush()
  expect(rows().map(row => row.event)).toEqual(['stop_drill_started', 'stop_drill_completed'])
  expect(rows().every(row => Object.keys(row).length === 2)).toBe(true)
})
it('failures and decline never prevent committed UI observations or navigation', async () => {
  network.send.mockRejectedValueOnce(new Error('network unavailable'))
  stopAnalytics.setConsent(true); render(<App storagePolicy="temporary" />)
  fireEvent.click(screen.getByRole('link', { name: 'Open Stop' })); await flush()
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
  expect(screen.getByRole('heading', { name: 'What do you do for GO?' })).toBeInTheDocument()
})
