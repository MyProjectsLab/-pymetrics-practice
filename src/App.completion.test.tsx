import { act, cleanup, render, fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { currentTrainingChain, restoreTrainingChain } from './stop/training'
import type { TrainingChain } from './stop/training'
import type { StopResult } from './stop/run'
import { setStopLocalStore } from './stop/storage'

// Isolate the application's async handoff identity, not event validity or timing.
const handoff = vi.hoisted(() => ({ complete: null as null | ((result: StopResult) => void), leave: () => {}, fail: () => {} }))
vi.mock('./stop/run', async original => ({ ...await original<object>(), verifyCompletedResult: () => true }))
vi.mock('./stop/Journey', () => ({ StopJourney: (props: { onRetestComplete: (result: StopResult) => void; onLibrary: () => void; onStorageFailure: () => void }) => {
  handoff.complete = props.onRetestComplete; handoff.leave = props.onLibrary; handoff.fail = props.onStorageFailure
  return <div>Controlled retest handoff</div>
} }))
vi.mock('./stop/TrainingFlow', () => ({ TrainingFlow: (props: { onRetest: (reservation: unknown) => void }) =>
  <button onClick={() => props.onRetest({ formId: 'retest-form', recorder: { sessionId: 'retest-session' } })}>Controlled retest start</button>,
}))
vi.mock('./stop/Report', () => ({ StopReport: () => <h1>Retained immutable report</h1> }))
const baseline = { sessionId: 'baseline', form: { id: 'baseline-form' } } as StopResult
const result = { sessionId: 'retest-session', form: { id: 'retest-form' } } as StopResult
const chain = { id: 'original-chain', baseline, retest: null, retestAttempts: [], drillAttempts: [],
  recommendation: {}, status: 'drill_complete' } as unknown as TrainingChain
beforeEach(() => { window.history.replaceState(null, "", "/practice") })
afterEach(() => { cleanup(); vi.unstubAllGlobals(); restoreTrainingChain(null, true); setStopLocalStore(null) })
async function pendingCompletion() {
  setStopLocalStore(null); restoreTrainingChain(chain)
  render(<App storagePolicy="temporary" />)
  fireEvent.click(screen.getByRole('button', { name: 'Resume Stop training' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Controlled retest start' }))
  const complete = handoff.complete!
  act(() => handoff.leave())
  return complete
}
describe('completed retest callbacks after candidate exit', () => {
  it('cannot attach an old result to a replacement chain', async () => {
    const complete = await pendingCompletion()
    const replacement = { ...chain, id: 'replacement-chain' }
    act(() => restoreTrainingChain(replacement))
    act(() => complete(result))
    expect(currentTrainingChain()).toBe(replacement)
  })
  it('cannot replace a newer completed retest in the same chain', async () => {
    const complete = await pendingCompletion()
    const newer = { ...result, sessionId: 'newer-session' }
    const completed = { ...chain, status: 'complete' as const, retest: newer,
      retestAttempts: [{ sessionId: newer.sessionId, formId: newer.form.id, valid: true }] }
    act(() => restoreTrainingChain(completed))
    act(() => complete(result))
    expect(currentTrainingChain()).toBe(completed)
  })
  it('preserves current attempt history and records completion once on the original chain', async () => {
    const complete = await pendingCompletion()
    const priorAttempt = { sessionId: 'other-attempt', formId: 'other-form', valid: false }
    act(() => restoreTrainingChain({ ...chain, retestAttempts: [priorAttempt] }))
    act(() => { complete(result); complete(result) })
    expect(currentTrainingChain()).toMatchObject({ status: 'complete', retest: result,
      retestAttempts: [priorAttempt, { sessionId: result.sessionId, formId: result.form.id, valid: true }] })
  })
})

it('does not reopen training after the candidate navigates away from a delayed eligibility check', async () => {
  const training = await import('./stop/training')
  setStopLocalStore(null); restoreTrainingChain(chain)
  let deliver!: (ok: boolean) => void
  const check = vi.spyOn(training, 'checkTrainingChain').mockImplementationOnce(() => new Promise(resolve => { deliver = resolve }))
  try {
    render(<App storagePolicy="temporary" />)
    fireEvent.click(screen.getByRole('button', { name: 'Resume Stop training' }))
    fireEvent.click(screen.getByRole('link', { name: /Open Stop/ }))
    await act(async () => deliver(true))
    expect(screen.getByText('Controlled retest handoff')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Controlled retest start' })).not.toBeInTheDocument()
  } finally { check.mockRestore() }
})


it.each([false, true])('labels resumed temporary review without conflating deletion with failed saving: failed=%s', async failed => {
  const { restoreStopRecords } = await import('./stop/run')
  const complete = await pendingCompletion()
  const temporary = { ...result, mode: 'retest' as const, storageMode: 'temporary_memory' as const }
  act(() => {
    restoreStopRecords([temporary], [])
    if (failed) handoff.fail()
    complete(temporary)
  })
  fireEvent.click(screen.getByRole('button', { name: 'Review temporary retest' }))
  expect(screen.getByRole('heading', { name: 'Retained immutable report' })).toBeInTheDocument()
  const status = screen.getByRole('status')
  if (failed) expect(status).toHaveTextContent('Your task data were recorded in this tab but could not be saved in this browser.')
  else { expect(status).toHaveTextContent('This result is retained only in this tab for review.'); expect(status).not.toHaveTextContent('could not be saved') }
  restoreStopRecords([], [])
})
