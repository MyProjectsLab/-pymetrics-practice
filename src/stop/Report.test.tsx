import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { StopReport, InvalidReport } from './Report'
import { scoreStop } from './scoring'
import { stopFormRegistry, stopV13FormRegistry } from './forms'
import type { EngineEvent } from './engine/contracts'
import type { StopResult, DevelopmentDraft } from './run'
import { ReportBoundary } from './LiveRun'

afterEach(cleanup)
const form = stopFormRegistry.all.find(f => f.family === 'baseline')!
function result(hitTimes: number[] = []): StopResult {
  let go = 0
  const events = form.sequence.flatMap((stimulus, index) => {
    const rt = stimulus === 'GO' ? hitTimes[go++] : undefined
    const outcome = stimulus === 'GO' ? rt === undefined
      ? { stimulus, kind: 'miss', responseTimeMs: null } : { stimulus, kind: 'hit', responseTimeMs: rt }
      : { stimulus, kind: 'correct_withhold', responseTimeMs: null }
    return [
      { type: 'trial_scheduled', payload: { trial: { phase: 'scored', index, stimulus } } },
      { type: 'trial_resolved', payload: { trialIndex: index, outcome, source: outcome.kind === 'hit' ? 'response' : 'timeout' } },
    ] as EngineEvent[]
  })
  const summary = scoreStop(events, form)
  return { schemaVersion: 'stop_session_result_v1', sessionId: 'report-fixture', mode: 'baseline', form,
    setup: { binding: { code: 'Space', label: 'Space' }, visualProfile: 'shape_accommodation_v1', physicalKeyboard: true },
    environment: { userAgent: 'test', width: 1024, height: 768 },
    validity: 'valid', scoringVersion: 'stop_scoring_v1', specificationVersion: '1.1', storageMode: 'temporary_memory',
    startedAtWall: '2026-09-28T00:00:00Z', completedAtWall: '2026-09-28T00:04:00Z', events, summarySnapshot: summary }
}

describe('M3 report copy, sparse data and navigation', () => {
  it('shows the standard profile plainly and keeps the internal form ID in closed details', () => {
    const r = result(Array(60).fill(438))
    const view = render(<StopReport result={{ ...r, setup: { ...r.setup, visualProfile: 'standard' } }} onReplay={() => {}} onLibrary={() => {}} />)
    const opening = view.container.querySelector('article > p')
    expect(opening?.textContent).toBe('Valid · Standard colors and markers')
    expect(opening?.textContent).not.toContain(r.form.id)
    const details = view.container.querySelector('details')
    expect(details?.open).toBe(false)
    expect(details?.textContent).toContain(`Form ${r.form.id}.`)
  })
  it('renders the full ordered report with profile and table semantics (S44, S62, S64)', () => {
    const replay = vi.fn(), library = vi.fn()
    const view = render(<StopReport result={result(Array(60).fill(438))} onReplay={replay} onLibrary={library} />)
    expect(screen.getByRole('heading', { name: 'Your Stop practice result' })).toBeInTheDocument()
    expect(screen.getByText(/High-distinction shape accommodation/)).toBeInTheDocument()
    expect(screen.getByText('You responded to 60 of 60 GO symbols (100%). You missed 0.')).toBeInTheDocument()
    expect(screen.getByText('Overall, 80 of 80 trials were correct (100%).')).toBeInTheDocument()
    expect(screen.getByText(/median response time on correct GO trials was 438 ms/)).toBeInTheDocument()
    const table = screen.getByRole('table', { name: 'Four hidden 20-trial blocks' })
    expect(within(table).getAllByRole('row')).toHaveLength(5)
    expect(within(table).getAllByRole('columnheader')).toHaveLength(5)
    expect(screen.queryByRole('button', { name: /training|retest/i })).not.toBeInTheDocument()
    expect(view.container.textContent).not.toMatch(/development milestone|employer fit score|personality diagnosis/i)
    fireEvent.click(screen.getByRole('button', { name: 'Practise another sequence' }))
    expect(replay).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: 'Back to library' }))
    expect(library).toHaveBeenCalledOnce()
  })
  it.each([
    [[], 'There were no eligible correct GO responses for a response-time summary.'],
    [[438], 'Your one eligible correct GO response took 438 ms. One response is not enough to describe response-time variability.'],
  ])('does not manufacture timing variability from sparse data (S44)', (times, copy) => {
    render(<StopReport result={result(times)} onReplay={() => {}} onLibrary={() => {}} />)
    expect(screen.getByText(copy)).toBeInTheDocument()
    expect(screen.queryByText(/middle half of those responses spanned/)).not.toBeInTheDocument()
    expect(screen.getByText('There was not enough clean data for a reliable block comparison.')).toBeInTheDocument()
  })
  it('states the exact timing note and retains accuracy outcomes (S39, S44)', () => {
    render(<StopReport result={{ ...result(Array(60).fill(438)), validity: 'valid_with_note' }} onReplay={() => {}} onLibrary={() => {}} />)
    expect(screen.getByText('This session was complete. One timing anomaly was excluded from response-time analysis; accuracy outcomes remain available.')).toBeInTheDocument()
    expect(screen.getByText('Overall, 80 of 80 trials were correct (100%).')).toBeInTheDocument()
  })
  it('labels a partial invalid attempt and never uses 60/20/80 completion denominators (S44)', () => {
    const draft = { invalidRule: 'stop_validity_v1.hidden', events: [
      { type: 'trial_scheduled', payload: { trial: { phase: 'scored', index: 0, stimulus: 'GO' } } },
      { type: 'stimulus_presented', payload: { trialIndex: 0, stimulus: 'GO' } },
      { type: 'trial_resolved', payload: { trialIndex: 0, outcome: { kind: 'hit', stimulus: 'GO', responseTimeMs: 438 } } },
      { type: 'session_invalidated', timestampMs: 2000, payload: { ruleId: 'stop_validity_v1.hidden' } },
    ] } as unknown as DevelopmentDraft
    render(<InvalidReport draft={draft} onRestart={() => {}} onGuide={() => {}} />)
    expect(screen.getByText('1 scored stimuli were presented; 1 scored trials resolved.')).toBeInTheDocument()
    expect(screen.getByText(/The attempt is retained in this tab for review/)).toBeInTheDocument()
    expect(screen.getByText('Not eligible for comparison')).toBeInTheDocument()
    expect(screen.queryByText(/of 60|of 20|of 80/)).not.toBeInTheDocument()
    expect(screen.queryByText(/median response time/)).not.toBeInTheDocument()
  })
  it('offers same-tab retry after a report render error without assigning a form (S68 partial)', () => {
    let fail = true
    const retry = vi.fn(() => { fail = false })
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    function Fragile() { if (fail) throw new Error('render failed'); return <h1>Recovered result</h1> }
    try {
      render(<ReportBoundary onRetry={retry}><Fragile /></ReportBoundary>)
      expect(screen.getByRole('alert')).toHaveTextContent('Your recorded result is retained in this tab.')
      fireEvent.click(screen.getByRole('button', { name: 'Try showing the result again' }))
      expect(retry).toHaveBeenCalledOnce()
      expect(screen.getByRole('heading', { name: 'Recovered result' })).toBeInTheDocument()
    } finally { error.mockRestore() }
  })
})


describe('B3 recorded extra-input disclosure', () => {
  it.each(['valid', 'valid_with_note'] as const)('shows the exact note alongside %s without changing status', validity => {
    const r = result(Array(60).fill(438))
    const note = { type: 'quality_note', payload: { ruleId: 'stop_validity_v1.five_extra_inputs', triggerSequenceNumber: 1 } } as EngineEvent
    render(<StopReport result={{ ...r, validity, events: [...r.events, note] }} onReplay={() => {}} onLibrary={() => {}} />)
    expect(screen.getByText('Five or more extra response-key presses were recorded after trials had resolved. They did not change the recorded trial outcomes.')).toBeInTheDocument()
    expect(screen.getByText(validity === 'valid' ? /^Valid ·/ : /^Valid with timing note ·/)).toBeInTheDocument()
    expect(Boolean(screen.queryByText(/One timing anomaly was excluded/))).toBe(validity === 'valid_with_note')
    expect(screen.getByText('Overall, 80 of 80 trials were correct (100%).')).toBeInTheDocument()
  })
  it('omits the note when none was recorded', () => {
    render(<StopReport result={result()} onReplay={() => {}} onLibrary={() => {}} />)
    expect(screen.queryByText(/Five or more extra response-key presses/)).not.toBeInTheDocument()
  })
})

it('renders actual V1.3 category and block denominators without a mixed block-accuracy comparison', () => {
  const variable = stopV13FormRegistry.get('stop-v13-baseline-01')!
  const events = variable.sequence.flatMap((stimulus, index) => [
    { type: 'trial_scheduled', payload: { trial: { phase: 'scored', index, stimulus } } },
    { type: 'trial_resolved', payload: { trialIndex: index, outcome: stimulus === 'GO' ?
      { stimulus, kind: 'hit', responseTimeMs: 400 } : { stimulus, kind: 'correct_withhold', responseTimeMs: null },
    source: stimulus === 'GO' ? 'response' : 'timeout' } },
  ]) as EngineEvent[]
  const variableResult: StopResult = { ...result(), form: variable, events,
    specificationVersion: '1.3', scoringVersion: 'stop_scoring_v13', summarySnapshot: scoreStop(events, variable) }
  const view = render(<StopReport result={variableResult} onReplay={() => {}} onLibrary={() => {}} />)
  expect(view.container.querySelector('article')).toHaveAttribute('data-report-version', 'stop_report_v13')
  expect(screen.getByText('GO: you responded to 28 of 28 (100%); 0 misses.')).toBeInTheDocument()
  expect(screen.getByText('NO-GO: you withheld on 52 of 52 (100%); 0 false alarms.')).toBeInTheDocument()
  expect(screen.getByText('Correct on 80 of 80 trials (100%).')).toBeInTheDocument()
  expect(screen.queryByText(/From Block 1 to Block 4, overall accuracy/)).not.toBeInTheDocument()
  expect(within(screen.getByRole('table')).getAllByText('7 of 7 (100%)')).toHaveLength(4)
})

it.each(['completed', 'invalid'] as const)('defines miss and false alarm alongside the %s detailed counts', kind => {
  const r = result()
  render(kind === 'completed' ? <StopReport result={r} onReplay={() => {}} onLibrary={() => {}} /> :
    <InvalidReport draft={{ invalidRule: 'stop_validity_v1.hidden', events: r.events } as DevelopmentDraft} onRestart={() => {}} onGuide={() => {}} />)
  fireEvent.click(screen.getByText('Detailed numbers'))
  const definition = screen.getByText('A miss means not responding to GO; a false alarm means responding to NO-GO.')
  expect(definition).toBeVisible()
  expect(definition.closest('details')).toHaveAttribute('open')
})
