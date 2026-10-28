import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CardsJourney } from './Journey'
import { CardsStore, newRoot } from './storage'
import type { Backend, Root } from './storage'

class MemoryBackend implements Backend {
  value: Root = newRoot()
  async read() { return structuredClone(this.value) }
  async change<T>(fn: (root: Root) => T) {
    const copy = structuredClone(this.value)
    const result = fn(copy)
    this.value = copy
    return structuredClone(result)
  }
  close() {}
}
function locks() {
  Object.defineProperty(navigator, 'locks', { configurable: true, value: {
    request: (_name: string, _options: unknown, callback: (lock: object) => Promise<unknown>) => callback({}),
  } })
}
async function openHistory(store: CardsStore, beforeHistoryRead?: () => void) {
  vi.spyOn(CardsStore, 'open').mockResolvedValue(store)
  await act(async () => { render(<CardsJourney onLibrary={() => undefined} />) })
  fireEvent.click(screen.getByText('Examples and saved results'))
  const historyButton = await screen.findByRole('button', { name: 'Saved results' })
  // Bootstrap also reads history for guide shortcuts; inject view faults only after it settles.
  beforeHistoryRead?.()
  fireEvent.click(historyButton)
}
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('Cards recovery claims', () => {
  it('withdraws history on blur without claiming the saved run is absent', async () => {
    locks()
    const store = await CardsStore.open(new MemoryBackend())
    const run = await store.start({ id: 'start', runId: 'run', documentId: 'doc', wallMs: 1 })
    await store.closeRun({ id: 'exit', runId: run.id, documentId: run.documentId,
      epoch: run.epoch, type: 'run_exited', reason: 'candidate_exit' })
    await openHistory(store)
    await screen.findByText(/Form CD1 · Incomplete · 0\/80 draws/)
    act(() => fireEvent.blur(window))
    expect(screen.queryByText('No saved Cards attempts.')).not.toBeInTheDocument()
    expect(screen.getByText('History is hidden until this tab rechecks saved data.')).toBeInTheDocument()
    act(() => fireEvent.focus(window))
    await screen.findByText(/Form CD1 · Incomplete · 0\/80 draws/)
  })
  it('does not claim zero attempts after a failed authoritative history read', async () => {
    locks()
    const store = await CardsStore.open(new MemoryBackend())
    await store.start({ id: 'start', runId: 'run', documentId: 'doc', wallMs: 1 })
    await openHistory(store, () => { vi.spyOn(store, 'list').mockRejectedValueOnce(Error('injected history read failure')) })
    await screen.findByText('injected history read failure')
    expect(store.list).toHaveBeenCalledOnce()
    expect(screen.getByText('History is hidden until this tab rechecks saved data.')).toBeInTheDocument()
    expect(screen.queryByText('No saved Cards attempts.')).not.toBeInTheDocument()
  })
  it('confirms an empty history only after focus rechecks a deletion', async () => {
    locks()
    const store = await CardsStore.open(new MemoryBackend())
    const run = await store.start({ id: 'start', runId: 'run', documentId: 'doc', wallMs: 1 })
    await store.closeRun({ id: 'exit', runId: run.id, documentId: run.documentId,
      epoch: run.epoch, type: 'run_exited', reason: 'candidate_exit' })
    await openHistory(store)
    await screen.findByText(/Form CD1 · Incomplete · 0\/80 draws/)
    act(() => fireEvent.blur(window))
    await store.delete(run.id)
    expect(screen.queryByText('No saved Cards attempts.')).not.toBeInTheDocument()
    act(() => fireEvent.focus(window))
    await screen.findByText('No saved Cards attempts.')
  })
  it('clears a provisional closure failure after same-request recovery commits', async () => {
    locks()
    const store = await CardsStore.open(new MemoryBackend())
    vi.spyOn(CardsStore, 'open').mockResolvedValue(store)
    vi.spyOn(store, 'closeRun').mockRejectedValueOnce(Error('injected close failure'))
    render(<CardsJourney onLibrary={() => undefined} />)
    fireEvent.click(screen.getByText('Examples and saved results'))
    fireEvent.click(await screen.findByRole('button', { name: 'See an example' }))
    fireEvent.click(screen.getByRole('button', { name: 'Check the rules' }))
    fireEvent.click(screen.getByLabelText(/A draw can lose money; the game ends after 80 draws/))
    fireEvent.click(screen.getByRole('button', { name: 'Check answers' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Start' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Exit run' }))
    await screen.findByText(/Exit or interruption save unconfirmed: injected close failure/)
    fireEvent.click(screen.getByRole('button', { name: 'Check closure save' }))
    await waitFor(() => expect(screen.queryByText(/Exit or interruption save unconfirmed/)).not.toBeInTheDocument())
    expect(screen.getByText(/Form CD1 · Incomplete · 0\/80 draws/)).toBeInTheDocument()
    expect((await store.inspect(Object.keys((await store.read()).runs)[0])).run.status).toBe('exited')
  })
  it('clears a lost closure callback after readback proves the run already exited', async () => {
    locks()
    const store = await CardsStore.open(new MemoryBackend())
    const original = store.closeRun.bind(store)
    vi.spyOn(CardsStore, 'open').mockResolvedValue(store)
    vi.spyOn(store, 'closeRun').mockImplementationOnce(async (...args) => {
      await original(...args)
      return new Promise<Awaited<ReturnType<CardsStore['closeRun']>>>(() => {})
    })
    render(<CardsJourney onLibrary={() => undefined} />)
    fireEvent.click(screen.getByText('Examples and saved results'))
    fireEvent.click(await screen.findByRole('button', { name: 'See an example' }))
    fireEvent.click(screen.getByRole('button', { name: 'Check the rules' }))
    fireEvent.click(screen.getByLabelText(/A draw can lose money; the game ends after 80 draws/))
    fireEvent.click(screen.getByRole('button', { name: 'Check answers' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Start' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Exit run' }))
    await screen.findByText(/Exit or interruption save unconfirmed: Save delivery unconfirmed/, {}, { timeout: 4000 })
    const runId = Object.keys((await store.read()).runs)[0]
    const before = (await store.inspect(runId)).run.events.length
    fireEvent.click(screen.getByRole('button', { name: 'Check closure save' }))
    await waitFor(() => expect(screen.queryByText(/Exit or interruption save unconfirmed/)).not.toBeInTheDocument())
    expect((await store.inspect(runId)).run.events).toHaveLength(before)
  })
})
