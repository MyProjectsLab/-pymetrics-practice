import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { DigitsJourney } from './Journey'
import { DigitsBrowserRun } from './browser'
import { advanceDigits } from './engine'
import { closeTrial, nextTrial } from './test-support'
import { loadDigitsForms } from './forms'
import { DigitsStore, freshDigitsRoot } from './storage'
import type { DigitsBackend, DigitsRoot } from './storage'
import { initialPreferences } from '../mock/contract'
import type { MockJourneyContext } from '../mock/journey-context'

class Backend implements DigitsBackend {
  root: DigitsRoot = freshDigitsRoot()
  close() {}
  async read() { return structuredClone(this.root) }
  async change<T>(operation: (root: DigitsRoot) => T): Promise<T> {
    const next = structuredClone(this.root), result = operation(next)
    this.root = next
    return structuredClone(result)
  }
}
afterEach(() => { cleanup(); vi.restoreAllMocks() })

for (const inMock of [false, true]) for (const failure of ['terminal save', 'report publication']) {
  it(`${inMock ? 'mock' : 'practice'} retries ${failure} without premature report receipt or lost acknowledgement`, async () => {
    const backend = new Backend()
    const store = new DigitsStore(backend, backend.root.installationId, await loadDigitsForms())
    vi.spyOn(DigitsStore, inMock ? 'openForMock' : 'open').mockResolvedValue(store)
    Object.defineProperty(navigator, 'locks', { configurable: true, value: {
      request: (_name: string, _options: unknown, work: (lock: object) => unknown) => work({}),
    } })
    // This is a mounted coordinator test. The native browser suite exercises actual presentation/input.
    vi.spyOn(DigitsBrowserRun.prototype, 'runTrial').mockImplementation(async function () {
      let state = advanceDigits(this.arm.arm, { kind: 'start', atMs: this.arm.arm.events[0].atMs })
      for (let index = 0; index < 3; index++) {
        state = closeTrial(state, false)
        if (index < 2) state = nextTrial(state)
      }
      Object.defineProperty(this, 'state', { get: () => state })
      this.hooks.onState(state)
      return state
    })
    vi.spyOn(DigitsBrowserRun.prototype, 'protected', 'get').mockReturnValue(false)
    const append = vi.spyOn(store, 'appendReportView')
    if (failure === 'report publication') append.mockRejectedValueOnce(Error('controlled report publication failure'))
    else vi.spyOn(store, 'save').mockRejectedValueOnce(Error('controlled terminal save failure'))
    const terminal = vi.fn(async () => 'ready' as const), continueMock = vi.fn(async () => {})
    const mock: MockJourneyContext | undefined = inMock ? {
      launchId: 'retry_test', preferences: initialPreferences(), beforeArm: vi.fn(async () => {}), terminal,
      beginReturnIntent: () => new AbortController().signal, retireReturnIntent() {}, finishReturnIntent() {},
      continue: continueMock, retry: async () => {}, leave() {},
    } : undefined
    render(<DigitsJourney onLibrary={vi.fn()} mock={mock} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Continue', exact: true }))
    fireEvent.click(screen.getByLabelText('Same digits, same order'))
    fireEvent.click(screen.getByRole('button', { name: 'Check answer' }))
    fireEvent.change(screen.getByLabelText(/Try entering 4270/), { target: { value: '4270' } })
    fireEvent.click(screen.getByRole('button', { name: 'Start', exact: true }))
    const next = await screen.findByRole('button', { name: 'Next', exact: true })
    if (failure === 'terminal save') {
      expect(next).toBeDisabled()
      fireEvent.click(await screen.findByRole('button', { name: 'Retry saving', exact: true }))
    }
    await waitFor(() => expect(next).toBeEnabled())
    expect(append).not.toHaveBeenCalled()
    expect(terminal).not.toHaveBeenCalled()
    expect(Object.values(backend.root.activity).flat()).toHaveLength(0)
    fireEvent.click(next)
    if (failure === 'report publication') {
      fireEvent.click(await screen.findByRole('button', { name: 'Retry saving or verifying this result' }))
    }
    await waitFor(() => expect(Object.values(backend.root.activity).flat()).toHaveLength(1))
    expect(Object.values(backend.root.activity).flat()[0].sourceSurface).toBe('live')
    expect(Object.values(backend.root.attempts)[0].snapshot?.state.closed).toHaveLength(3)
    expect(await screen.findByRole('heading', { name: 'No sequence recalled exactly' })).toBeVisible()
    if (inMock) {
      await waitFor(() => expect(terminal).toHaveBeenCalledOnce())
      fireEvent.click(await screen.findByRole('button', { name: 'Continue mock' }))
      expect(continueMock).toHaveBeenCalledOnce()
    } else expect(terminal).not.toHaveBeenCalled()
  })
}
