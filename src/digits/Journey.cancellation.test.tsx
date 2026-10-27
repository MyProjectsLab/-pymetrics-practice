import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { DigitsJourney } from './Journey'
import { loadDigitsForms } from './forms'
import { DigitsStore, freshDigitsRoot } from './storage'
import type { DigitsBackend, DigitsRoot } from './storage'

class HeldBackend implements DigitsBackend {
  root: DigitsRoot = freshDigitsRoot()
  failNextCancellationSave = false
  cancellationSaveAttempts = 0
  close = vi.fn()
  private releaseArm!: () => void
  readonly armDelivery = new Promise<void>(resolve => { this.releaseArm = resolve })
  private confirmArm!: () => void
  readonly armCommitted = new Promise<void>(resolve => { this.confirmArm = resolve })
  deliverArm() { this.releaseArm() }
  async read() { return structuredClone(this.root) }
  async change<T>(operation: (root: DigitsRoot) => T, signal?: AbortSignal): Promise<T> {
    if (signal?.aborted) throw Error('operation canceled')
    const next = structuredClone(this.root)
    const value = operation(next)
    const firstArm = this.root.counters.visual === 0 && next.counters.visual === 1
    const cancellationSave = Object.values(next.attempts).some(item => item.snapshot?.state.invalidReason === 'setup_changed')
    if (cancellationSave) {
      this.cancellationSaveAttempts++
      if (this.failNextCancellationSave) { this.failNextCancellationSave = false; throw Error('controlled save failure') }
    }
    this.root = next
    if (firstArm) { this.confirmArm(); await this.armDelivery }
    return structuredClone(value)
  }
}

afterEach(() => { cleanup(); vi.restoreAllMocks() })

it('retains Journey cancellation custody through a failed save and one same-request Retry', async () => {
  const backend = new HeldBackend()
  const store = new DigitsStore(backend, backend.root.installationId, await loadDigitsForms())
  vi.spyOn(DigitsStore, 'open').mockResolvedValue(store)
  Object.defineProperty(navigator, 'locks', { configurable: true, value: {
    request: (_name: string, _options: unknown, work: (lock: object) => unknown) => work({}),
  } })
  const view = render(<DigitsJourney onLibrary={vi.fn()} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Continue' }))
  fireEvent.click(screen.getByLabelText(/The exact digits in order/))
  fireEvent.click(screen.getByRole('button', { name: 'Check answer' }))
  fireEvent.change(screen.getByLabelText(/Try entering 4270/), { target: { value: '4270' } })
  fireEvent.click(screen.getByRole('button', { name: 'Start' }))
  await backend.armCommitted
  expect(backend.root.counters.visual).toBe(1)
  expect(Object.values(backend.root.attempts)[0].snapshot).toBeUndefined()
  backend.failNextCancellationSave = true
  fireEvent.click(screen.getByText('Presentation and accessibility options'))
  fireEvent.click(screen.getByLabelText('High contrast'))
  await act(async () => backend.deliverArm())
  const retry = await screen.findByRole('button', { name: 'Retry saving' })
  expect(retry).toBeEnabled()
  expect(backend.root.counters.visual).toBe(1)
  expect(Object.values(backend.root.attempts)[0].snapshot).toBeUndefined()
  fireEvent.click(retry)
  fireEvent.click(retry)
  await waitFor(() => expect(Object.values(backend.root.attempts)[0].snapshot?.state.invalidReason).toBe('setup_changed'))
  expect(backend.root.counters.visual).toBe(1)
  expect(Object.values(backend.root.attempts)).toHaveLength(1)
  expect(Object.values(backend.root.attempts)[0].snapshot?.state.events.filter(event => event.type === 'invalidated')).toHaveLength(1)
  expect(backend.cancellationSaveAttempts).toBeGreaterThanOrEqual(2)
  view.unmount()
  await waitFor(() => expect(backend.close).toHaveBeenCalled())
})
