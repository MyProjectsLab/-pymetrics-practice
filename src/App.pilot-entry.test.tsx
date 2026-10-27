import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import Landing from './landing/Landing'
import { StopLocalStore, STOP_LOCAL_SCHEMA, setStopLocalStore } from './stop/storage'
import type { StopLocalState } from './stop/storage'
import { restoreTrainingChain } from './stop/training'
import type { TrainingChain } from './stop/training'

vi.mock('./keypresses/Journey', () => ({
  KeypressesJourney: ({ onLibrary }: { onLibrary: () => void }) =>
    <div><h1>Controlled Keypresses guide</h1><button onClick={onLibrary}>Leave Keypresses</button></div>,
}))
vi.mock('./stop/Journey', () => ({
  StopJourney: ({ onLibrary }: { onLibrary: () => void }) =>
    <div><h1>Controlled Stop guide</h1><button>See the rule</button><button onClick={onLibrary}>Back</button></div>,
}))
vi.mock('./balloons/Journey', () => ({
  BalloonsJourney: ({ onLibrary, separateBaseline }: { onLibrary: () => void; separateBaseline: boolean }) =>
    <div><h1>Controlled Balloons guide</h1><p>Separate baseline: {String(separateBaseline)}</p><button onClick={onLibrary}>Leave Balloons</button></div>,
}))
vi.mock('./towers-training/Journey', () => ({
  TowersTrainingJourney: ({ onLibrary }: { onLibrary: () => void }) =>
    <div><h1>Controlled Towers training guide</h1><button onClick={onLibrary}>Leave Towers training</button></div>,
}))

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const emptyState: StopLocalState = {
  schemaVersion: STOP_LOCAL_SCHEMA, installationId: 'synthetic-pilot-installation',
  results: {}, drafts: {}, chains: {}, retiredChains: {}, activeChainId: null,
  exposures: {}, reservations: {},
}
function fakeStore() {
  return {
    read: vi.fn().mockResolvedValue(emptyState),
    sameInstallation: vi.fn().mockReturnValue(true),
    subscribeDeletion: vi.fn().mockReturnValue(() => {}),
  } as unknown as StopLocalStore
}
function library() {
  expect(screen.getAllByRole('article')).toHaveLength(13)
  const training = screen.queryByRole('button', { name: 'Open Towers Advanced Training' })
  expect([...screen.getAllByRole('link', { name: /^Open / }), ...(training ? [training] : [])]).toHaveLength(training ? 14 : 13)
}
const stopQueries = ['?practiceGame=stop', '?mockStopHistory=1']
function headerLibrary() {
  fireEvent.click(screen.getByRole('link', { name: 'Assessments' }))
}

beforeEach(() => { window.history.replaceState(null, '', '/practice') })
afterEach(() => {
  cleanup()
  setStopLocalStore(null)
  restoreTrainingChain(null, true)
  vi.restoreAllMocks(); vi.unstubAllGlobals()
  window.history.replaceState(null, '', '/practice')
})

describe('bounded pilot shared entry', () => {
  it('keeps all game choices during a held Stop check and a late rejection after another game', async () => {
    const opening = deferred<StopLocalStore>()
    const probe = vi.spyOn(StopLocalStore, 'open').mockReturnValue(opening.promise)
    render(<App />)
    await waitFor(() => expect(probe).toHaveBeenCalledTimes(1))
    library()
    fireEvent.click(screen.getByRole('link', { name: 'Open Stop' }))
    expect(screen.getByRole('heading', { name: 'Checking Stop local storage' })).toBeVisible()
    library()
    fireEvent.click(screen.getByRole('link', { name: 'Open Keypresses' }))
    expect(screen.getByRole('heading', { name: 'Controlled Keypresses guide' })).toBeVisible()
    await act(async () => opening.reject(new Error('synthetic Stop open failure')))
    fireEvent.click(screen.getByRole('button', { name: 'Leave Keypresses' }))
    library()
    expect(screen.queryByRole('heading', { name: 'Results cannot be saved in this browser' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'See the rule' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('link', { name: 'Open Stop' }))
    expect(await screen.findByRole('heading', { name: 'Results cannot be saved in this browser' })).toBeVisible()
    library()
  })

  it('preserves the Stop-only rejection, explicit temporary choice and retry gate', async () => {
    const probe = vi.spyOn(StopLocalStore, 'open').mockRejectedValueOnce(new Error('synthetic failure'))
      .mockResolvedValueOnce(fakeStore())
    render(<App />)
    await waitFor(() => expect(probe).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(13))
    fireEvent.click(screen.getByRole('link', { name: 'Open Stop' }))
    expect(await screen.findByRole('heading', { name: 'Results cannot be saved in this browser' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'See the rule' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Try storage check again' }))
    expect(screen.getByRole('heading', { name: 'Checking Stop local storage' })).toBeVisible()
    await screen.findByRole('button', { name: 'See the rule' })
    expect(screen.queryByRole('heading', { name: 'Results cannot be saved in this browser' })).not.toBeInTheDocument()
  })

  it('allows an explicit temporary Stop guide after rejection without claiming saved history', async () => {
    vi.spyOn(StopLocalStore, 'open').mockRejectedValue(new Error('synthetic failure'))
    render(<App />)
    fireEvent.click(screen.getByRole('link', { name: 'Open Stop' }))
    await screen.findByRole('heading', { name: 'Results cannot be saved in this browser' })
    fireEvent.click(screen.getByRole('button', { name: 'Continue without saving' }))
    expect(screen.getByRole('button', { name: 'See the rule' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    library()
    expect(screen.queryByRole('button', { name: 'Stop history' })).not.toBeInTheDocument()
  })

  it('does not replay a pending Stop return link after the candidate selects another game', async () => {
    window.history.replaceState(null, '', '/practice?practiceGame=stop')
    const opening = deferred<StopLocalStore>()
    const probe = vi.spyOn(StopLocalStore, 'open').mockReturnValue(opening.promise)
    render(<App />)
    await waitFor(() => expect(probe).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('heading', { name: 'Checking Stop local storage' })).toBeVisible()
    fireEvent.click(screen.getByRole('link', { name: 'Open Keypresses' }))
    expect(window.location.search).toBe('')
    await act(async () => opening.resolve(fakeStore()))
    fireEvent.click(screen.getByRole('button', { name: 'Leave Keypresses' }))
    library()
    expect(screen.queryByRole('button', { name: 'See the rule' })).not.toBeInTheDocument()
  })

  it('keeps a late Stop storage check from replacing separate Towers training', async () => {
    const opening = deferred<StopLocalStore>()
    const probe = vi.spyOn(StopLocalStore, 'open').mockReturnValue(opening.promise)
    render(<App />)
    await waitFor(() => expect(probe).toHaveBeenCalledTimes(1))
    library()
    fireEvent.click(screen.getByRole('button', { name: 'Open Towers Advanced Training' }))
    expect(screen.getByRole('heading', { name: 'Controlled Towers training guide' })).toBeVisible()
    await act(async () => opening.resolve(fakeStore()))
    fireEvent.click(screen.getByRole('button', { name: 'Leave Towers training' }))
    library()
    expect(screen.queryByRole('button', { name: 'See the rule' })).not.toBeInTheDocument()
  })

  for (const query of stopQueries) {
    for (const outcome of ['success', 'rejection'] as const) {
      it(`retires ${query} on header navigation before late Stop open ${outcome}`, async () => {
        window.history.replaceState(null, '', '/practice' + query)
        const opening = deferred<StopLocalStore>()
        const probe = vi.spyOn(StopLocalStore, 'open').mockReturnValue(opening.promise)
        render(<App />)
        await waitFor(() => expect(probe).toHaveBeenCalledTimes(1))
        expect(screen.getByRole('heading', { name: 'Checking Stop local storage' })).toBeVisible()
        headerLibrary()
        expect(window.location.search).toBe('')
        expect(screen.queryByRole('heading', { name: 'Checking Stop local storage' })).not.toBeInTheDocument()
        library()
        await act(async () => outcome === 'success'
          ? opening.resolve(fakeStore()) : opening.reject(new Error('synthetic failure')))
        library()
        expect(screen.queryByRole('heading', { name: 'Stop history' })).not.toBeInTheDocument()
        expect(screen.queryByRole('heading', { name: 'Controlled Stop guide' })).not.toBeInTheDocument()
        expect(screen.queryByRole('heading', { name: 'Results cannot be saved in this browser' })).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('link', { name: 'Open Stop' }))
        expect(await screen.findByRole('heading', { name: outcome === 'success' ? 'Controlled Stop guide' : 'Results cannot be saved in this browser' })).toBeVisible()
      })
    }
    it(`retires ${query} when another game is selected during a held check`, async () => {
      window.history.replaceState(null, '', '/practice' + query)
      const opening = deferred<StopLocalStore>()
      const probe = vi.spyOn(StopLocalStore, 'open').mockReturnValue(opening.promise)
      render(<App />)
      await waitFor(() => expect(probe).toHaveBeenCalledTimes(1))
      fireEvent.click(screen.getByRole('link', { name: 'Open Keypresses' }))
      expect(window.location.search).toBe('')
      await act(async () => opening.resolve(fakeStore()))
      expect(screen.getByRole('heading', { name: 'Controlled Keypresses guide' })).toBeVisible()
      fireEvent.click(screen.getByRole('button', { name: 'Leave Keypresses' }))
      library()
      expect(screen.queryByRole('heading', { name: 'Stop history' })).not.toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: 'Controlled Stop guide' })).not.toBeInTheDocument()
    })
  }

  it('uses decoded exact first parameters and history precedence for Stop queries', async () => {
    const cases = [
      { query:'?x=practiceGame=stop', expected:'library' },
      { query:'?practiceGameExtra=stop', expected:'library' },
      { query:'?practiceGame=stopping', expected:'library' },
      { query:'?mockStopHistory=10', expected:'library' },
      { query:'?practiceGame=%73top', expected:'stop' },
      { query:'?%70racticeGame=stop', expected:'stop' },
      { query:'?mockStopHistory=%31', expected:'history' },
      { query:'?practiceGame=unknown&practiceGame=stop', expected:'library' },
      { query:'?practiceGame=stop&practiceGame=balloons', expected:'stop' },
      { query:'?mockStopHistory=0&mockStopHistory=1', expected:'library' },
      { query:'?practiceGame=stop&mockStopHistory=1', expected:'history' },
      { query:'?mockStopHistory=1&practiceGame=balloons', expected:'history' },
    ] as const
    vi.spyOn(StopLocalStore, 'open').mockImplementation(async () => fakeStore())
    for (const { query, expected } of cases) {
      window.history.replaceState(null, '', '/practice' + query)
      const view = render(<App />)
      if (expected === 'stop') await screen.findByRole('heading', { name: 'Controlled Stop guide' })
      else if (expected === 'history') await screen.findByRole('heading', { name: 'Stop history' })
      else {
        await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(13))
        expect(screen.queryByRole('heading', { name: 'Checking Stop local storage' })).not.toBeInTheDocument()
        expect(screen.queryByRole('heading', { name: 'Results cannot be saved in this browser' })).not.toBeInTheDocument()
      }
      view.unmount()
      setStopLocalStore(null)
    }
  })

  it('keeps exact Balloons baseline override and ordinary reordered/extra query neighbors', async () => {
    for (const [query, expected] of [
      ['?practiceGame=balloons&balloonsBaseline=1', 'true'],
      ['?balloonsBaseline=1&practiceGame=balloons', 'false'],
      ['?practiceGame=balloons&balloonsBaseline=1&extra=1', 'false'],
    ]) {
      window.history.replaceState(null, '', '/practice' + query)
      const view = render(<App storagePolicy="temporary" />)
      await screen.findByRole('heading', { name: 'Controlled Balloons guide' })
      expect(screen.getByText('Separate baseline: ' + expected)).toBeVisible()
      view.unmount()
    }
  })

  it('keeps the exact Balloons separate-baseline return independent of a blocked Stop check', async () => {
    window.history.replaceState(null, '', '/practice?practiceGame=balloons&balloonsBaseline=1')
    const opening = deferred<StopLocalStore>()
    const probe = vi.spyOn(StopLocalStore, 'open').mockReturnValue(opening.promise)
    render(<App />)
    await screen.findByRole('heading', { name: 'Controlled Balloons guide' })
    expect(screen.getByText('Separate baseline: true')).toBeVisible()
    expect(window.location.search).toBe('')
    await waitFor(() => expect(probe).toHaveBeenCalledTimes(1))
    await act(async () => opening.reject(new Error('synthetic Stop failure')))
    fireEvent.click(screen.getByRole('button', { name: 'Leave Balloons' }))
    library()
  })

  it('cancels a held Stop retry after another selection and return', async () => {
    const retry = deferred<StopLocalStore>()
    vi.spyOn(StopLocalStore, 'open').mockRejectedValueOnce(new Error('synthetic failure'))
      .mockReturnValueOnce(retry.promise)
    render(<App />)
    fireEvent.click(screen.getByRole('link', { name: 'Open Stop' }))
    await screen.findByRole('heading', { name: 'Results cannot be saved in this browser' })
    fireEvent.click(screen.getByRole('button', { name: 'Try storage check again' }))
    fireEvent.click(screen.getByRole('link', { name: 'Open Keypresses' }))
    fireEvent.click(screen.getByRole('button', { name: 'Leave Keypresses' }))
    await act(async () => retry.resolve(fakeStore()))
    library()
    expect(screen.queryByRole('button', { name: 'See the rule' })).not.toBeInTheDocument()
  })

  it('withholds Stop training resume controls until Stop storage has an explicit mode', async () => {
    restoreTrainingChain({ id:'synthetic-chain', baseline:{ storageMode:'temporary_memory' },
      status:'assigned' } as TrainingChain)
    vi.spyOn(StopLocalStore, 'open').mockRejectedValue(new Error('synthetic failure'))
    render(<App />)
    expect(screen.queryByRole('button', { name: 'Resume Stop training' })).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(13))
    expect(screen.queryByRole('button', { name: 'Resume Stop training' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('link', { name: 'Open Stop' }))
    expect(await screen.findByRole('heading', { name: 'Results cannot be saved in this browser' })).toBeVisible()
  })

  it('labels the twelve-game pilot inventory and separate Towers training entry', () => {
    render(<App storagePolicy="temporary" />)
    library()
    const towers = screen.getByRole('heading', { name: 'Towers' }).closest('article')!
    expect(within(towers).getByText(/separate Towers Advanced Training available/)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Open Towers Advanced Training' })).toBeVisible()
    expect(screen.getByText('Practice, local reports and Advanced Training available')).toBeVisible()
    expect(screen.getByText('Practice, local reports and separate-baseline Advanced Training available')).toBeVisible()
    expect(screen.getByText(/An actual assessment may differ/)).toBeVisible()
    expect(screen.getByText(/There is no account or cross-device sync/)).toBeVisible()
  })

  it('keeps twelve landing rows clearly featured and states mock and training availability', () => {
    render(<Landing />)
    expect(document.querySelectorAll('.ap-game-row')).toHaveLength(12)
    expect(screen.getByRole('heading', { name: 'Choose where to start.' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Prepare for your hiring assessment.' })).toBeVisible()
    expect(screen.getByText(/Separate Advanced Training is available for Stop, Balloons and Towers/)).toBeVisible()
    expect(screen.getByText(/Clearing site data removes saved history/)).toBeVisible()
    expect([...document.querySelectorAll('.ap-game-row')].map(link => link.getAttribute('href'))).toEqual([
      '/practice/stop', '/practice/balloons', '/practice/keypresses', '/arrows.html', '/mouth-v13.html',
      '/practice/digits', '/practice/cards', '/practice/easy-or-hard', '/practice/towers', '/money.html', '/money2.html', '/faces.html',
    ])
    expect(within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('link', { name: 'Research' })).toHaveAttribute('href', '/pymetrics-practice.html#research')
    expect(screen.getByRole('link', { name: /Try the full practice assessment/ })).toHaveAttribute('href', '/mock')

  })
})
