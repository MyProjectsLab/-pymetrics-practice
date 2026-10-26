import { ArrowsAuthority } from './authority'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ArrowsJourney } from './Journey'
import type { ExclusiveArrowsDocument } from './exclusive-document'
import { ArrowsBrowserRun } from './browser'
import { advance, armHeadless } from './versions'
import type { State } from './versions'
import { loadArrowsForms } from './versions'
import { reconcileHeadless } from './versions'
import { ArrowsStore, freshArrowsRoot } from './storage'
import type { ArrowsBackend, ArmedAttempt, ArrowsRoot, StartRequest } from './storage'

async function savedResults(ui: Pick<typeof screen, 'queryByText' | 'getByRole'> = screen) {
  await act(async () => {})
  const details = ui.queryByText('Examples and saved results')?.closest('details')
  if (details && !details.open) fireEvent.click(details.querySelector('summary')!)
  return ui.getByRole('button', { name: 'Saved results' })
}
const originalLocks = Object.getOwnPropertyDescriptor(navigator, 'locks')
beforeEach(() => { vi.spyOn(document, 'hasFocus').mockReturnValue(true); Object.defineProperty(navigator, 'locks', {
  configurable: true,
  value: { request: <T,>(_name: string, _options: object, callback: (lock: object) => Promise<T>) =>
    Promise.resolve().then(() => callback({})) },
}) })
afterEach(() => { cleanup(); vi.restoreAllMocks(); Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
  if (originalLocks) Object.defineProperty(navigator, 'locks', originalLocks)
  else Reflect.deleteProperty(navigator, 'locks') })

function toStartableSetup() {
  const options=screen.getByText('Examples and saved results').closest('details')!
  if(!options.open)fireEvent.click(options.querySelector('summary')!)
  fireEvent.click(screen.getByRole('button', { name: 'See an example' }))
  fireEvent.click(screen.getByRole('button', { name: 'Next example' }))
  fireEvent.click(screen.getByRole('button', { name: 'Next example' }))
  fireEvent.click(screen.getByRole('button', { name: 'Check understanding' }))
  fireEvent.click(screen.getByLabelText('Follow the four side arrows and use my first eligible response before the deadline'))
  fireEvent.click(screen.getByRole('button', { name: 'Check answers' }))
  const capture = screen.getByRole('group', { name: 'Arrows physical key capture' })
  for (const [direction, code] of [['Left', 'ArrowLeft'], ['Right', 'ArrowRight']] as const) {
    fireEvent.keyDown(capture, { code, key: direction })
    fireEvent.keyUp(capture, { code, key: direction })
  }
  expect(screen.getByRole('button', { name: 'Start Block 1' })).toBeEnabled()
}
function inertExclusive() {
  return { presentationHost: document.createElement('fieldset'), enter: () => {}, leave: () => {} } as unknown as ExclusiveArrowsDocument
}

it('keeps the newer example screen when a held history read finishes late', async () => {
  let deliver!: (attempts: readonly ArmedAttempt[]) => void
  const store = Object.assign(Object.create(ArrowsStore.prototype), { installationId: 'installation', authority: new ArrowsAuthority('installation') }) as ArrowsStore
  vi.spyOn(ArrowsStore, 'open').mockResolvedValue(store)
  const listing = vi.spyOn(store, 'listAttempts').mockReturnValue(
    new Promise(resolve => { deliver = resolve }))
  render(<ArrowsJourney onLibrary={() => {}} exclusive={inertExclusive()} />)
  fireEvent.click(await savedResults())
  await waitFor(() => expect(listing).toHaveBeenCalledOnce())
  fireEvent.click(screen.getByRole('button', { name: 'See an example' }))
  await act(async () => { deliver([]) })
  expect(screen.getByRole('heading', { name: 'Worked example 1 of 3' })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Arrows history' })).not.toBeInTheDocument()
})

it('does not open a report from a read delivered after page exit', async () => {
  const form = (await loadArrowsForms()).get('AR1')!
  const profile = { kind: 'keyboard', leftCode: 'ArrowLeft', rightCode: 'ArrowRight',
    alternative: false, accommodation: 'default', reducedMotion: false } as const
  const state = armHeadless(form, { installationId: 'installation', sessionId: 'session',
    clockDomainId: 'clock' }, profile, 100)
  const arm: ArmedAttempt = { requestId: 'request', sessionId: 'session', clockDomainId: 'clock',
    profile, ordinal: 1, createdAtWallMs: 1000, state,
    snapshot: { revision: 1, kind: 'checkpoint', closedTrials: 0, state,
      review: reconcileHeadless(state) } }
  let deliver!: (attempt: ArmedAttempt | null) => void
  const store = Object.assign(Object.create(ArrowsStore.prototype), { installationId: 'installation', authority: new ArrowsAuthority('installation') }) as ArrowsStore
  vi.spyOn(ArrowsStore, 'open').mockResolvedValue(store)
  const retained = { ...freshArrowsRoot(), installationId: 'installation', revision: Math.max(1, arm.snapshot?.revision ?? 0), scoredStartCount: 1, attempts: { session: arm } }
  store.authority.observe(retained, store.authority.provenance('read'))
  vi.spyOn(store, 'read').mockResolvedValue(retained)
  vi.spyOn(store, 'listAttempts').mockResolvedValue([arm])
  const reading = vi.spyOn(store, 'loadArmed').mockReturnValue(new Promise(resolve => { deliver = resolve }))
  vi.spyOn(store, 'appendReportView').mockResolvedValue({} as never)
  vi.spyOn(store, 'subscribeDeletion').mockReturnValue(() => {})
  render(<ArrowsJourney onLibrary={() => {}} exclusive={inertExclusive()} />)
  fireEvent.click(await savedResults())
  fireEvent.click(await screen.findByRole('button', { name: 'Review saved trials' }))
  await waitFor(() => expect(reading).toHaveBeenCalledOnce())
  fireEvent(window, new Event('pagehide'))
  await act(async () => { deliver(arm) })
  expect(screen.getByRole('heading', { name: 'Arrows history' })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Arrows report' })).not.toBeInTheDocument()
})

it('fails closed for saved history when browser lock support is unavailable', async () => {
  Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined })
  vi.spyOn(ArrowsStore, 'open').mockResolvedValue(Object.assign(Object.create(ArrowsStore.prototype), { installationId: 'installation', authority: new ArrowsAuthority('installation') }) as ArrowsStore)
  render(<ArrowsJourney onLibrary={() => {}} exclusive={inertExclusive()} />)
  const history = await savedResults()
  expect(history).toBeDisabled()
  expect(screen.getByText(/cannot verify saved Arrows reports/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Delete all Arrows data' })).toBeInTheDocument()
})

it('reuses an uncertain committed Start request instead of consuming the next form', async () => {
  class ReadbackFaultBackend implements ArrowsBackend {
    root = freshArrowsRoot()
    failFirstReadback = true
    failNextRead = false
    async read() {
      if (this.failNextRead) { this.failNextRead = false; throw Error('Injected arm readback failure') }
      return structuredClone(this.root)
    }
    async change<T>(operation: (root: ArrowsRoot) => T) {
      const next = structuredClone(this.root)
      const result = operation(next)
      this.root = next
      if (this.failFirstReadback) { this.failFirstReadback = false; this.failNextRead = true }
      return result
    }
  }
  const backend = new ReadbackFaultBackend()
  const store = new ArrowsStore(backend, backend.root.installationId)
  const requests: StartRequest[] = []
  vi.spyOn(ArrowsStore, 'open').mockResolvedValue(store)
  Object.defineProperty(Element.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  vi.spyOn(ArrowsBrowserRun.prototype, 'begin').mockImplementation(async request => {
    requests.push(structuredClone(request))
    return (await store.start(request)).state
  })

  render(<ArrowsJourney onLibrary={() => {}} exclusive={inertExclusive()} />)
  await savedResults()
  toStartableSetup()
  fireEvent.click(screen.getByRole('button', { name: 'Start Block 1' }))
  await screen.findByText('Start could not be confirmed. Injected arm readback failure')
  expect(screen.getByText(/A form may already be reserved/)).toBeInTheDocument()
  expect(backend.root.scoredStartCountV11).toBe(1)
  expect(Object.values(backend.root.attempts)[0].state.form.id).toBe('AR11-1')

  fireEvent.click(screen.getByRole('button', { name: 'Verify or retry same Start' }))
  await waitFor(() => expect(requests).toHaveLength(2))
  await waitFor(() => expect(screen.getByText(/Block 1 of 5/)).toBeInTheDocument())
  expect(requests[1]).toEqual(requests[0])
  expect(backend.root.scoredStartCountV11).toBe(1)
})

it('does not carry an uncertain Start request into a changed input profile', async () => {
  const store = Object.assign(Object.create(ArrowsStore.prototype), { installationId: 'installation', authority: new ArrowsAuthority('installation') }) as ArrowsStore
  const requests: StartRequest[] = []
  vi.spyOn(ArrowsStore, 'open').mockResolvedValue(store)
  Object.defineProperty(Element.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  vi.spyOn(ArrowsBrowserRun.prototype, 'begin').mockImplementation(async request => {
    requests.push(structuredClone(request))
    throw Error('Injected readback failure')
  })
  render(<ArrowsJourney onLibrary={() => {}} exclusive={inertExclusive()} />)
  await savedResults()
  toStartableSetup()
  fireEvent.click(screen.getByRole('button', { name: 'Start Block 1' }))
  await screen.findByText('Start could not be confirmed. Injected readback failure')

  fireEvent.click(screen.getByRole('button', { name: 'Review setup' }))
  fireEvent.click(screen.getByRole('button', { name: 'Accessibility' }))
  fireEvent.click(screen.getByRole('checkbox', { name: /alternative or assistive input method/ }))
  const capture = screen.getByRole('group', { name: 'Arrows physical key capture' })
  for (const [direction, code] of [['Left', 'ArrowLeft'], ['Right', 'ArrowRight']] as const) {
    fireEvent.keyDown(capture, { code, key: direction })
    fireEvent.keyUp(capture, { code, key: direction })
  }
  expect(screen.getByRole('button', { name: 'Start with changed setup' })).toBeEnabled()
  expect(screen.getByText(/Changing input settings requires a new Start request/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Start with changed setup' }))
  await waitFor(() => expect(requests).toHaveLength(2))
  expect(requests[1].requestId).not.toBe(requests[0].requestId)
  expect(requests[0].profile.alternative).toBe(false)
  expect(requests[1].profile.alternative).toBe(true)
})

it('shows the observed direction in an invalid attempt event review', async () => {
  const form = (await loadArrowsForms()).get('AR1')!
  const profile = { kind: 'keyboard', leftCode: 'ArrowLeft', rightCode: 'ArrowRight',
    alternative: false, accommodation: 'default', reducedMotion: false } as const
  let state = armHeadless(form, { installationId: 'installation', sessionId: 'session',
    clockDomainId: 'clock' }, profile, 100)
  state = advance(state, { kind: 'start', atMs: 200, responseHeld: false })
  state = advance(state, { kind: 'fixation', atMs: 200 })
  state = advance(state, { kind: 'onset', atMs: 1000 })
  state = advance(state, { kind: 'keydown', atMs: 1100, code: 'ArrowLeft', repeat: false, modified: false })
  state = advance(state, { kind: 'invalidate', atMs: 1150, reason: 'blur' })
  const arm: ArmedAttempt = { requestId: 'request', sessionId: 'session', clockDomainId: 'clock',
    profile, ordinal: 1, createdAtWallMs: 1000, state: armHeadless(form,
      { installationId: 'installation', sessionId: 'session', clockDomainId: 'clock' }, profile, 100),
    snapshot: { revision: 1, kind: 'terminal', closedTrials: 0, state, review: reconcileHeadless(state) } }
  const store = Object.assign(Object.create(ArrowsStore.prototype), { installationId: 'installation', authority: new ArrowsAuthority('installation') }) as ArrowsStore
  vi.spyOn(ArrowsStore, 'open').mockResolvedValue(store)
  const retained = { ...freshArrowsRoot(), installationId: 'installation', revision: Math.max(1, arm.snapshot?.revision ?? 0), scoredStartCount: 1, attempts: { session: arm } }
  store.authority.observe(retained, store.authority.provenance('read'))
  vi.spyOn(store, 'read').mockResolvedValue(retained)
  vi.spyOn(store, 'listAttempts').mockResolvedValue([arm])
  vi.spyOn(store, 'loadArmed').mockResolvedValue(arm)
  vi.spyOn(store, 'appendReportView').mockResolvedValue({} as never)
  vi.spyOn(store, 'subscribeDeletion').mockReturnValue(() => {})

  render(<ArrowsJourney onLibrary={() => {}} exclusive={inertExclusive()} />)
  fireEvent.click(await savedResults())
  fireEvent.click(await screen.findByRole('button', { name: 'Open report' }))
  await screen.findByRole('heading', { name: 'Arrows report' })
  fireEvent.click(await screen.findByText('Detailed numbers'))
  fireEvent.click(screen.getByText('Review recorded events'))
  const response = screen.getByText(/response · trial 1/)
  expect(response).toHaveTextContent('Left')
})

it('shows the form version, one-decimal percentages and a positive signed contrast', async () => {
  const form = (await loadArrowsForms()).get('AR1')!
  const profile = { kind: 'keyboard', leftCode: 'ArrowLeft', rightCode: 'ArrowRight',
    alternative: false, accommodation: 'default', reducedMotion: false } as const
  const identity = { installationId: 'installation', sessionId: 'session', clockDomainId: 'clock' }
  const armed = armHeadless(form, identity, profile, 100)
  let state = armed, next = 100
  for (let index = 1; index <= 120; index++) {
    if (index % 24 === 1) state = advance(state, { kind: index === 1 ? 'start' : 'continue',
      atMs: next, responseHeld: false })
    state = advance(state, { kind: 'fixation', atMs: state.fixationDueMs! + 16 })
    state = advance(state, { kind: 'onset', atMs: state.stimulusDueMs! + 16 })
    const trial = form.trials[index - 1]
    const code = trial.direction === 'left' ? 'ArrowLeft' : 'ArrowRight'
    const atMs = state.onsetMs! + (trial.condition === 'opposed' ? 400 : 300)
    state = advance(state, { kind: 'keydown', atMs, code, repeat: false, modified: false })
    state = advance(state, { kind: 'keyup', atMs: atMs + 1, code })
    state = advance(state, { kind: 'resolve', atMs: state.resolutionDueMs! + 8 })
    state = advance(state, { kind: 'offset', atMs: state.resolutionDueMs! + 16 })
    next = state.events.at(-1)!.atMs + (index % 24 === 0 ? 1000 : 0)
  }
  const arm: ArmedAttempt = { requestId: 'request', sessionId: 'session', clockDomainId: 'clock',
    profile, ordinal: 1, createdAtWallMs: 1000, state: armed,
    snapshot: { revision: 5, kind: 'terminal', closedTrials: 120, state, review: reconcileHeadless(state) } }
  const store = Object.assign(Object.create(ArrowsStore.prototype), { installationId: 'installation', authority: new ArrowsAuthority('installation') }) as ArrowsStore
  vi.spyOn(ArrowsStore, 'open').mockResolvedValue(store)
  const retained = { ...freshArrowsRoot(), installationId: 'installation', revision: Math.max(1, arm.snapshot?.revision ?? 0), scoredStartCount: 1, attempts: { session: arm } }
  store.authority.observe(retained, store.authority.provenance('read'))
  vi.spyOn(store, 'read').mockResolvedValue(retained)
  vi.spyOn(store, 'listAttempts').mockResolvedValue([arm])
  vi.spyOn(store, 'loadArmed').mockResolvedValue(arm)
  vi.spyOn(store, 'appendReportView').mockResolvedValue({} as never)
  vi.spyOn(store, 'subscribeDeletion').mockReturnValue(() => {})

  render(<ArrowsJourney onLibrary={() => {}} exclusive={inertExclusive()} />)
  fireEvent.click(await savedResults())
  fireEvent.click(await screen.findByRole('button', { name: 'Open report' }))
  await screen.findByRole('heading', { name: 'Arrows report' })
  fireEvent.click(await screen.findByText('Detailed numbers'))
  expect(screen.getByText(/arrows_forms_v1/)).toBeInTheDocument()
  expect(screen.getByRole('row', { name: /Overall/ })).toHaveTextContent('100.0%')
  expect(screen.getByText(/Opposed minus aligned median:/)).toHaveTextContent('Opposed minus aligned median: +100 ms')
})

it('does not adopt an obsolete Delete all completion after navigation changes', async () => {
  let finishDeletion!: (store: ArrowsStore) => void
  const first = Object.assign(Object.create(ArrowsStore.prototype), { installationId: 'installation', authority: new ArrowsAuthority('installation') }) as ArrowsStore
  const replacement = Object.assign(Object.create(ArrowsStore.prototype), { installationId: 'installation', authority: new ArrowsAuthority('installation') }) as ArrowsStore
  vi.spyOn(ArrowsStore, 'open').mockResolvedValue(first)
  vi.spyOn(first, 'listAttempts').mockResolvedValue([])
  const replacementHistory = vi.spyOn(replacement, 'listAttempts').mockResolvedValue([])
  vi.spyOn(first, 'deleteAll').mockReturnValue(new Promise(resolve => { finishDeletion = resolve }))

  render(<ArrowsJourney onLibrary={() => {}} exclusive={inertExclusive()} />)
  fireEvent.click(await savedResults())
  await screen.findByRole('heading', { name: 'Arrows history' })
  fireEvent.click(screen.getByRole('button', { name: 'Delete all Arrows data' }))
  fireEvent.click(screen.getByRole('button', { name: 'Delete all Arrows data' }))
  fireEvent.click(screen.getByRole('button', { name: 'Start a new practice' }))
  await act(async () => { finishDeletion(replacement) })

  expect(screen.getByRole('heading', { name: 'Arrows' })).toBeInTheDocument()
  expect(screen.queryByText('All local Arrows data were deleted.')).not.toBeInTheDocument()
  fireEvent.click(await savedResults())
  await screen.findByRole('heading', { name: 'Arrows history' })
  expect(replacementHistory).not.toHaveBeenCalled()
})


it('cancels held entry preparation in place and restores the same checked React journey', async () => {
  const store = Object.assign(Object.create(ArrowsStore.prototype), { installationId: 'installation', authority: new ArrowsAuthority('installation') }) as ArrowsStore
  vi.spyOn(ArrowsStore, 'open').mockResolvedValue(store)
  let exit!: () => void, rejectPreparation!: (error: Error) => void
  const begin = vi.spyOn(ArrowsBrowserRun.prototype, 'begin').mockReturnValue(new Promise((_resolve, reject) => { rejectPreparation = reject }))
  const onLibrary = vi.fn()
  const container = document.createElement('div')
  document.body.append(container)
  const exclusive = {
    presentationHost: document.createElement('fieldset'),
    enter: (onExit: () => void) => { exit = onExit; container.remove() },
    leave: () => { if (!container.isConnected) document.body.append(container) },
  } as unknown as ExclusiveArrowsDocument
  render(<ArrowsJourney onLibrary={onLibrary} exclusive={exclusive} />, { container })
  await savedResults()
  toStartableSetup()
  fireEvent.click(screen.getByRole('button', { name: 'Start Block 1' }))
  await waitFor(() => expect(begin).toHaveBeenCalledOnce())
  expect(container.isConnected).toBe(false)
  act(() => exit())
  expect(container.isConnected).toBe(true)
  expect(screen.getByRole('heading', { name: 'Ready for Block 1?' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Verify or retry same Start' })).toBeEnabled()
  await act(async () => { rejectPreparation(Error('Late preparation cancellation')) })
  expect(onLibrary).not.toHaveBeenCalled()
  expect(screen.getByRole('heading', { name: 'Ready for Block 1?' })).toBeInTheDocument()
  expect(screen.queryByText(/Late preparation cancellation/)).not.toBeInTheDocument()
})

it('requires fresh input checks when readiness returns from the browser page cache', async () => {
  const store = Object.assign(Object.create(ArrowsStore.prototype), { installationId: 'installation', authority: new ArrowsAuthority('installation') }) as ArrowsStore
  vi.spyOn(ArrowsStore, 'open').mockResolvedValue(store)
  render(<ArrowsJourney onLibrary={() => {}} exclusive={inertExclusive()} />)
  await savedResults()
  toStartableSetup()
  fireEvent(window, new PageTransitionEvent('pageshow', { persisted: true }))
  expect(screen.getByRole('heading', { name: 'Press ← then → on your keyboard.' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Start' })).toBeDisabled()
  expect(screen.getByRole('group', { name: 'Arrows physical key capture' })).toHaveTextContent('Left: waiting · Right: waiting')
})

it('confirms history publication inside the retained closed-root journey', async () => {
  const store = Object.assign(Object.create(ArrowsStore.prototype), { installationId: 'installation', authority: new ArrowsAuthority('installation') }) as ArrowsStore
  vi.spyOn(ArrowsStore, 'open').mockResolvedValue(store)
  vi.spyOn(store, 'listAttempts').mockResolvedValue([])
  const host = document.createElement('div')
  document.body.append(host)
  const shadow = host.attachShadow({ mode: 'closed' })
  const container = document.createElement('div')
  shadow.append(container)
  render(<ArrowsJourney onLibrary={() => {}} exclusive={inertExclusive()} />, { container })
  const ui = within(container)
  fireEvent.click(await savedResults(ui))
  await ui.findByRole('heading', { name: 'Arrows history' })
  expect(document.querySelector('[data-arrows-history-installation]')).toBeNull()
  expect(ui.getByText('No retained Arrows attempts in this browser.')).toBeInTheDocument()
  expect(ui.queryByText(/Arrows history could not be verified/)).not.toBeInTheDocument()
  host.remove()
})


it('keeps the exclusive document protected when Continue republishes a break after key release', async () => {
  class Backend implements ArrowsBackend {
    root = freshArrowsRoot()
    async read() { return structuredClone(this.root) }
    async change<T>(operation: (root: ArrowsRoot) => T) {
      const next = structuredClone(this.root), result = operation(next)
      this.root = next; return result
    }
  }
  const backend = new Backend(), store = new ArrowsStore(backend, backend.root.installationId)
  vi.spyOn(ArrowsStore, 'open').mockResolvedValue(store)
  let runner!: ArrowsBrowserRun, state!: State, resolveContinue!: () => void
  const heldContinue = new Promise<void>(resolve => { resolveContinue = resolve })
  let checkpointSaved = true
  vi.spyOn(ArrowsBrowserRun.prototype, 'checkpointStatus').mockImplementation(() => checkpointSaved ? 'saved' : 'pending')
  vi.spyOn(ArrowsBrowserRun.prototype, 'begin').mockImplementation(async function (this: ArrowsBrowserRun, request) {
    // Test-only retained controller reference; production exposes no handle.
    // eslint-disable-next-line typescript/no-this-alias
    runner = this
    state = advance((await store.start(request)).state, { kind: 'start', atMs: request.atMs + 1, responseHeld: false })
    return state
  })
  const publish = () => (runner as unknown as { publish: (state: State) => void }).publish(state)
  const continuation = vi.spyOn(ArrowsBrowserRun.prototype, 'continue').mockImplementation(async () => {
    state = advance(state, { kind: 'keyup', atMs: state.commands.at(-1)!.atMs + 1, code: 'ArrowLeft' })
    publish() // Same break, extended prefix while asynchronous Continue work is held.
    await heldContinue
    state = advance(state, { kind: 'continue', atMs: state.commands.at(-1)!.atMs + 1, responseHeld: false })
    publish()
    return state
  })
  const container = document.createElement('div'); document.body.append(container)
  let active = false
  const leave = vi.fn(() => { active = false; if (!container.isConnected) document.body.append(container) })
  const exclusive = {
    presentationHost: document.createElement('fieldset'),
    enter: () => { active = true; container.remove() }, leave,
  } as unknown as ExclusiveArrowsDocument
  render(<ArrowsJourney onLibrary={() => {}} exclusive={exclusive} />, { container })
  await savedResults(); toStartableSetup()
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start Block 1' })) })
  await waitFor(() => expect(state).toBeDefined())
  const finishBlock = () => {
    for (let index = 0; index < 27; index++) {
      state = advance(state, { kind: 'fixation', atMs: state.fixationDueMs! })
      state = advance(state, { kind: 'onset', atMs: state.stimulusDueMs! })
      state = advance(state, { kind: 'resolve', atMs: state.resolutionDueMs! })
      state = advance(state, { kind: 'offset', atMs: state.resolutionDueMs! })
    }
  }
  finishBlock()
  state = advance(state, { kind: 'keydown', atMs: state.commands.at(-1)!.atMs + 1, code: 'ArrowLeft', repeat: false, modified: false })
  act(publish)
  expect(leave).toHaveBeenCalledOnce()
  fireEvent.click(screen.getByRole('button', { name: 'Continue next block' }))
  await waitFor(() => expect(continuation).toHaveBeenCalledOnce())
  expect(active).toBe(true)
  expect(container.isConnected).toBe(false)
  expect(leave).toHaveBeenCalledOnce()
  await act(async () => resolveContinue())
  expect(active).toBe(true)
  expect(container.isConnected).toBe(false)
  finishBlock(); checkpointSaved = false; act(publish)
  expect(leave).toHaveBeenCalledTimes(2)
  expect(container.isConnected).toBe(true)
  expect(screen.getByRole('heading', { name: 'Block complete' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Continue next block' })).toBeDisabled()
})
