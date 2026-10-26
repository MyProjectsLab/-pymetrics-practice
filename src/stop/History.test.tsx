import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { StopHistory } from './History'
import type { CheckedHistory, StopLocalStore } from './storage'
import type { StopResult, DevelopmentDraft } from './run'

import * as training from './training'

afterEach(() => { cleanup(); vi.restoreAllMocks() })
function result(id: string, visualProfile: 'standard' | 'shape_accommodation_v1', overall: number): StopResult {
  return { sessionId: id, mode: 'baseline', validity: 'valid', form: { id: `form-${id}` },
    setup: { binding: { code: 'Space', label: 'Space' }, visualProfile, physicalKeyboard: true },
    storageMode: 'persistent_local', specificationVersion: '1.1', scoringVersion: 'stop_scoring_v1',
    completedAtWall: `2026-09-${id === 'first' ? '27' : id === 'second' ? '28' : '29'}T00:00:00Z`,
    summarySnapshot: { rates: { overall, hit: overall, withhold: overall }, timing: { median: 400 } },
  } as unknown as StopResult
}

describe('M5 compatible-profile history (S73)', () => {
  it('moves focus with history screens and permits keyboard cancellation without deleting data', () => {
    const onDeleteAll = vi.fn()
    render(<StopHistory history={{ valid: [], invalid: [], rejected: [], chains: [], retiredChains: [], activeChain: null }}
      store={{} as StopLocalStore} onRefresh={vi.fn()} onLibrary={vi.fn()} onPractice={vi.fn()} onDeleteAll={onDeleteAll} />)
    expect(screen.getByRole('heading', { name: 'Stop history' })).toHaveFocus()
    fireEvent.click(screen.getByRole('button', { name: 'Delete all Stop data' }))
    const confirmation = screen.getByRole('alertdialog')
    expect(within(confirmation).getByRole('heading')).toHaveFocus()
    expect(confirmation).not.toHaveAttribute('aria-modal', 'true')
    fireEvent.keyDown(confirmation, { key: 'Escape' })
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Stop history' })).toHaveFocus()
    expect(onDeleteAll).not.toHaveBeenCalled()
  })

  it('plots only valid persistent results within each visual and input profile and lists invalid attempts separately', () => {
    const draft = { sessionId: 'invalid', mode: 'baseline', retainedAtWall: '2026-09-29T01:00:00Z',
      form: null, setup: { visualProfile: 'standard' }, events: [] } as unknown as DevelopmentDraft
    const history: CheckedHistory = { valid: [result('first', 'standard', .75), result('second', 'standard', .8),
      result('third', 'shape_accommodation_v1', .7)], invalid: [draft], rejected: [], chains: [], retiredChains: [], activeChain: null }
    const view = render(<StopHistory history={history} store={{} as StopLocalStore} onRefresh={vi.fn()}
      onLibrary={vi.fn()} onPractice={vi.fn()} onDeleteAll={vi.fn()} />)
    expect(screen.getAllByRole('img', { name: /Overall accuracy across .* compatible Stop session/ })).toHaveLength(2)
    expect(screen.getByRole('img', { name: 'Overall accuracy across 2 compatible Stop sessions in this profile' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Overall accuracy across 1 compatible Stop session in this profile' })).toBeInTheDocument()
    expect(view.container.querySelectorAll('ol li')).toHaveLength(3)
    expect(screen.getByText(/Invalid attempt/)).toBeInTheDocument()
    expect(screen.getByText(/Not included in progress or training routing/)).toBeInTheDocument()
  })
})

it('groups by binding code while ignoring presentation labels, using the comparison compatibility key', () => {
  const records = ['first', 'second', 'third'].map(id => result(id, 'standard', .8))
  Object.assign(records[0].setup, { binding: { code: 'KeyA', label: 'A' } })
  Object.assign(records[1].setup, { binding: { code: 'KeyQ', label: 'A' } })
  Object.assign(records[2].setup, { binding: { code: 'KeyA', label: 'Different label' } })
  render(<StopHistory history={{ valid: records, invalid: [], rejected: [], chains: [], retiredChains: [], activeChain: null }}
    store={{} as StopLocalStore} onRefresh={vi.fn()} onLibrary={vi.fn()} onPractice={vi.fn()} onDeleteAll={vi.fn()} />)
  expect(screen.getAllByRole('img')).toHaveLength(2)
  expect(screen.getByRole('img', { name: 'Overall accuracy across 2 compatible Stop sessions in this profile' })).toBeInTheDocument()
  expect(screen.getByRole('img', { name: 'Overall accuracy across 1 compatible Stop session in this profile' })).toBeInTheDocument()
})


it('labels each retained journal by its own durable evidence, including review after a failed retirement save', () => {
  const attempt = (id: string): training.DrillAttempt => ({ id, drillId: 'detection', manifestChecksum: 'fixture', version: '1',
    startedAtWall: '2026-09-30T00:00:00Z', completedAtWall: '2026-09-30T00:00:01Z', valid: false, completedBlocks: 0, events: [] })
  const saved = attempt('saved'), buffered = attempt('buffered')
  vi.spyOn(training, 'retainedTrainingAttempts').mockReturnValue([structuredClone(saved), buffered])
  const history = { valid: [], invalid: [], rejected: [], chains: [], activeChain: null,
    retiredChains: [{ id: 'retired', drillAttempts: [saved], retestAttempts: [] }] } as unknown as CheckedHistory
  const view = render(<StopHistory history={history} store={{} as StopLocalStore} onRefresh={vi.fn()}
    onLibrary={vi.fn()} onPractice={vi.fn()} onDeleteAll={vi.fn()} />)
  const rows = view.container.querySelectorAll('article')
  expect(rows).toHaveLength(2)
  expect(within(rows[0]).queryByText(/Not yet saved/)).not.toBeInTheDocument()
  expect(within(rows[1]).getByText(/Not yet saved/)).toBeInTheDocument()
  fireEvent.click(within(rows[0]).getByRole('button', { name: 'Review drill attempt' }))
  expect(screen.queryByText(/retained only in this tab/)).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Back to history' }))
  fireEvent.click(screen.getAllByRole('button', { name: 'Review drill attempt' })[1])
  expect(screen.getByText(/retained only in this tab/)).toBeInTheDocument()
})

it.each(['1.1', '1.3'] as const)('offers training from a saved %s baseline without a chain', async version => {
  const go = version === '1.1' ? 60 : 40
  const noGo = 80 - go
  const saved = { ...result('first', 'standard', .8), specificationVersion: version,
    events: [], summarySnapshot: { counts: { hits: go, misses: 0, withholds: noGo, falseAlarms: 0 },
      rates: { overall: 1, hit: 1, withhold: 1 }, timing: { count: 0, median: null, iqr: null },
      blocks: Array.from({ length: 4 }, (_, index) => ({ number: index + 1,
        counts: { hits: go / 4, misses: 0, withholds: noGo / 4, falseAlarms: 0 },
        hitRate: 1, withholdRate: 1, timing: { count: 0 } })), speedAccuracy: '',
      postError: { narrative: '' }, sequence: { narrative: '' } } } as unknown as StopResult
  const onTraining = vi.fn().mockResolvedValue(undefined)
  render(<StopHistory history={{ valid: [saved], invalid: [], rejected: [], chains: [], retiredChains: [], activeChain: null }}
    store={{} as StopLocalStore} onRefresh={vi.fn()} onLibrary={vi.fn()} onPractice={vi.fn()}
    onDeleteAll={vi.fn()} onTraining={onTraining} />)
  fireEvent.click(screen.getByRole('button', { name: 'Open original report' }))
  fireEvent.click(screen.getByRole('button', { name: 'Start recommended training' }))
  expect(onTraining).toHaveBeenCalledWith(saved, expect.any(AbortSignal))
})
