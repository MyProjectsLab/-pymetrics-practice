import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LiveRun } from './LiveRun'
import { StopJourney } from './Journey'
import { TEMPORARY_DISCLOSURE } from './training'
import { setStopLocalStore } from './storage'
import { createStopRun } from './run'
import { createPreparationRecorder, spaceBinding } from './preparation'
import { createMemoryExposureRepository } from './exposure'
import { bindBrowserEvents } from './browser'
import type { RunScreen, StopRun } from './run'
import { RULE } from './engine/rules'

afterEach(cleanup)
function show(state: RunScreen, rule: string | null = null) {
  const startScored = vi.fn(), restartWarmup = vi.fn(), onRestart = vi.fn(), onGuide = vi.fn(), onLibrary = vi.fn()
  const run = { snapshot: () => ({ screen: state, setup: { binding: { label: 'F' } }, engine: { invalidRule: rule } }), startScored } as unknown as StopRun
  render(<LiveRun run={run} attach={() => {}} restartWarmup={restartWarmup} onRestart={onRestart} onGuide={onGuide} onLibrary={onLibrary} onReplay={() => {}} />)
  return { startScored, restartWarmup, onRestart, onGuide, onLibrary }
}
describe('M2B-2 live and recovery screens', () => {
  it('has only the persistent rule and the visual host in the live canvas', () => {
    show('live')
    expect(screen.getByLabelText('Timed Stop task')).toHaveFocus()
    expect(screen.getByText('GO: press F · NO-GO: do nothing')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
  it('uses exact warm-up transition copy and action', () => {
    const callbacks = show('warmup_complete')
    expect(screen.getByRole('heading', { name: 'Warm-up complete' })).toHaveFocus()
    expect(screen.getByText('You can pause here. When you select ‘Start scored task,’ keep this tab active until Stop ends. Switching away during the scored task makes the attempt invalid.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Start scored task' }))
    expect(callbacks.startScored).toHaveBeenCalledOnce()
  })
  it('uses M2B-03 restart copy without a score or progress display', () => {
    const callbacks = show('warmup_restart')
    expect(screen.getByRole('heading', { name: 'Warm-up needs to restart' })).toHaveFocus()
    expect(screen.getByText('Browser timing moved outside the allowed range. Keep this tab visible, close other demanding applications, and restart the warm-up.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Restart warm-up' }))
    expect(callbacks.restartWarmup).toHaveBeenCalledOnce()
  })
  it.each([
    [RULE.hidden, 'This page became hidden during the timed task.'],
    [RULE.blur, 'The game window was out of focus for more than one second.'],
    [RULE.settings, 'An input or accessibility setting changed during the timed task.'],
    [RULE.viewport, 'The timed task did not run in the supported physical-keyboard setup.'],
    [RULE.wrong, 'The input record did not meet the session-quality rules.'],
  ])('shows the approved reason for %s and active-tab limitation', (rule, sentence) => {
    setStopLocalStore(null)
    const preparation = render(<StopJourney recorder={createPreparationRecorder()} specificationVersion="1.3"
      onLibrary={vi.fn()} onRestart={vi.fn()} onReplay={vi.fn()} />)
    const warning = screen.getByText(TEMPORARY_DISCLOSURE)
    expect(warning).toBeVisible()
    expect(warning.closest('details')).toBeNull()
    preparation.unmount()
    const callbacks = show('invalid', rule)
    expect(screen.getByRole('heading', { name: 'This run cannot continue as a valid session' })).toHaveFocus()
    expect(screen.getByText(`${sentence} Your completed events are preserved locally for review. Restarting will use another available form.`)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Restart with a new form' })); expect(callbacks.onRestart).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: 'Return to the guide' })); expect(callbacks.onGuide).toHaveBeenCalledOnce()
  })
  it('explains a second warm-up timing failure without claiming scored exposure', () => {
    show('invalid', RULE.warmupTiming)
    expect(screen.getByRole('heading', { name: 'Warm-up could not finish' })).toBeInTheDocument()
    expect(screen.getByText(/No scored task began and no scored form was consumed/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start a new attempt' })).toBeInTheDocument()
  })
  it('shows the technical recovery screen for integrity failures', () => {
    show('invalid', RULE.integrity)
    expect(screen.getByRole('heading', { name: 'Stop could not finish this session' })).toBeInTheDocument()
    expect(screen.getByText('A technical problem interrupted the task. This attempt will not be used as a baseline or retest. You can restart with a new form.')).toBeInTheDocument()
    expect(screen.queryByText('The recorded trials did not match the assigned form.')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Return to library' })).toBeInTheDocument()
  })
  it('routes a browser error through the adapter, run draft, and exact technical recovery UI', async () => {
    const recorder = createPreparationRecorder()
    recorder.record('readiness_confirmed', { focused: true, visible: true })
    const run = createStopRun({ preparation: recorder,
      setup: { binding: spaceBinding, visualProfile: 'standard', physicalKeyboard: true },
      exposure: createMemoryExposureRepository(), clock: () => performance.now(),
      scheduler: { at: () => () => {}, after: () => () => {} }, frames: { request: () => () => {} },
      clear() {}, changed: () => view.rerender(ui()),
      environment: { userAgent: 'jsdom integration fixture', width: 1024, height: 768 },
    })
    const ui = () => <LiveRun run={run} attach={() => {}} restartWarmup={() => {}}
      onRestart={() => {}} onGuide={() => {}} onLibrary={() => {}} onReplay={() => {}} />
    const view = render(ui())
    const listeners = bindBrowserEvents(run.engine, 'Space', run.activeNow)
    try {
      run.begin(false); run.startWarmup()
      fireEvent(window, new Event('error'))
      expect(await screen.findByRole('heading', { name: 'Stop could not finish this session' })).toHaveFocus()
      expect(screen.getByText('A technical problem interrupted the task. This attempt will not be used as a baseline or retest. You can restart with a new form.')).toBeInTheDocument()
      expect(screen.queryByText('The recorded trials did not match the assigned form.')).not.toBeInTheDocument()
      expect(run.snapshot().draft).toMatchObject({ status: 'invalid', invalidRule: RULE.integrity,
        realizedSequence: [], scoringVersion: null, summarySnapshot: null })
      expect(run.snapshot().draft?.events).toContainEqual(expect.objectContaining({
        type: 'integrity_checked', payload: { valid: false, detail: 'Unhandled browser error during protected interval' },
      }))
    } finally { listeners.dispose() }
  })
  it.each(['pending', 'saved', 'failed'])('C1 completion discloses %s saving and permits recovery', saveStatus => {
    const viewReport = vi.fn(), leave = vi.fn()
    const run = { snapshot: () => ({ screen: 'complete', saveStatus, storageFailure: saveStatus === 'failed',
      setup: { binding: { label: 'Space' } }, engine: {} }), viewReport, leave } as unknown as StopRun
    render(<LiveRun run={run} attach={() => {}} restartWarmup={() => {}} onRestart={() => {}}
      onGuide={() => {}} onLibrary={() => {}} onReplay={() => {}} />)
    expect(screen.getByRole('heading', { name: 'Stop complete' })).toHaveFocus()
    expect(screen.queryByLabelText('Timed Stop task')).not.toBeVisible()
    if (saveStatus === 'pending') {
      expect(screen.getByRole('status')).toHaveTextContent('Saving this result. It is not yet confirmed saved. Keep this tab open to review it.')
      expect(screen.queryByText(/could not be saved/)).not.toBeInTheDocument()
      expect(screen.queryByText(/This result is saved/)).not.toBeInTheDocument()
    } else if (saveStatus === 'saved') expect(screen.getByRole('status')).toHaveTextContent('This result is saved in this browser.')
    else expect(screen.getByRole('alert')).toHaveTextContent('Your task data were recorded in this tab but could not be saved in this browser. Keep this tab open to review the result or continue the current training chain.')
    fireEvent.click(screen.getByRole('button', { name: 'View my result' }))
    expect(viewReport).toHaveBeenCalledOnce()
  })
  it('offers the completed result', () => {
    show('complete')
    expect(screen.getByRole('heading', { name: 'Stop complete' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'View my result' })).toBeInTheDocument()
  })
  it('uses the exact no-unused-form error', () => {
    show('exhausted')
    expect(screen.getByRole('heading', { name: 'No unused form is available for this activity in the current beta.' })).toBeInTheDocument()
  })
})
