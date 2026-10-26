import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ArrowsJourney } from './Journey'
import { ArrowsBrowserRun } from './browser'
import { advance } from './versions'
import type { State } from './versions'
import { ArrowsStore, freshArrowsRoot } from './storage'
import type { ArrowsBackend, ArrowsRoot, ArmedAttempt } from './storage'
async function savedResults(ui: Pick<typeof screen, 'queryByText' | 'getByRole'> = screen) {
  await act(async () => {})
  const details = ui.queryByText('Examples and saved results')?.closest('details')
  if (details && !details.open) fireEvent.click(details.querySelector('summary')!)
  return ui.getByRole('button', { name: 'Saved results' })
}
beforeEach(() => vi.spyOn(document, 'hasFocus').mockReturnValue(true))
function inertExclusive() { return { presentationHost: document.createElement('div'), enter: () => {}, leave: () => {} } as unknown as import('./exclusive-document').ExclusiveArrowsDocument }
const originalLocks = Object.getOwnPropertyDescriptor(navigator, 'locks')
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
  if (originalLocks) Object.defineProperty(navigator, 'locks', originalLocks); else Reflect.deleteProperty(navigator, 'locks') })
function barrier<T>() { let release!: (value: T) => void; const promise = new Promise<T>(done => { release = done }); return { release, promise } }
function ready() {
  const options=screen.getByText('Examples and saved results').closest('details')!
  if(!options.open)fireEvent.click(options.querySelector('summary')!)
  for (const name of ['See an example', 'Next example', 'Next example', 'Check understanding']) { const button=screen.queryByRole('button', { name }); if(button)fireEvent.click(button) }
  fireEvent.click(screen.getByLabelText('Follow the four side arrows and use my first eligible response before the deadline'))
  fireEvent.click(screen.getByRole('button', { name: 'Check answers' }))
  const capture = screen.getByRole('group', { name: 'Arrows physical key capture' })
  for (const dir of ['Left', 'Right']) {
    fireEvent.keyDown(capture, { code: 'Arrow' + dir }); fireEvent.keyUp(capture, { code: 'Arrow' + dir })
  }
}

async function setup() {
  Object.defineProperty(navigator, 'locks', { configurable: true, value: { request: (_name: string, _options: object, work: () => Promise<unknown>) => Promise.resolve().then(work) } })
  Object.defineProperty(Element.prototype, 'scrollIntoView', { configurable: true, value: () => {} })
  class Backend implements ArrowsBackend { root = freshArrowsRoot()
    async read() { return structuredClone(this.root) }
    async change<T>(fn: (root: ArrowsRoot) => T) { const next = structuredClone(this.root); const result = fn(next); this.root = next; return result } }
  const backend = new Backend(), store = new ArrowsStore(backend, backend.root.installationId)
  const arm = await store.start({ requestId: 'request', sessionId: 'session', clockDomainId: 'clock', atMs: 100, wallMs: 1000,
    profile: { kind: 'keyboard', leftCode: 'ArrowLeft', rightCode: 'ArrowRight', alternative: false, accommodation: 'default', reducedMotion: false } })
  let state = advance(arm.state, { kind: 'start', atMs: 200, responseHeld: false })
  for (let i = 0; i < 27; i++) { state = advance(state, { kind: 'fixation', atMs: state.fixationDueMs! }); state = advance(state, { kind: 'onset', atMs: state.stimulusDueMs! })
    state = advance(state, { kind: 'resolve', atMs: state.resolutionDueMs! }); state = advance(state, { kind: 'offset', atMs: state.resolutionDueMs! }) }
  const snapshot = await store.saveSnapshot(arm, state, 0)
  vi.spyOn(ArrowsStore, 'open').mockResolvedValue(store)
  let runner!: ArrowsBrowserRun
  vi.spyOn(ArrowsBrowserRun.prototype, 'begin').mockImplementation(async function (this: ArrowsBrowserRun) {
    // Capture the actual browser instance for direct DOM/authority assertions.
    // eslint-disable-next-line typescript/no-this-alias
    runner = this
    const internal = this as unknown as { state: State; attempt: ArmedAttempt; checkpointRevision: number }
    internal.state = state; internal.attempt = arm; internal.checkpointRevision = snapshot.revision
    return arm.state
  })
  const mounted = render(<ArrowsJourney onLibrary={() => {}} exclusive={inertExclusive()} />); await act(async () => {}); ready()
  fireEvent.click(screen.getByRole('button', { name: 'Start practice' })); await waitFor(() => expect(runner).toBeDefined())
  await act(async () => (runner as unknown as { publish: (state: State) => void }).publish(state))
  await screen.findByRole('heading', { name: 'Block complete' })
  return { store, backend, arm, state, runner, mounted }
}

for (const surface of ['live', 'history'] as const) for (const deletion of ['individual', 'all'] as const)
  it(`${surface} prefix: first negative activity transaction withdraws DOM before held fallback/polls`, async () => {
    vi.stubGlobal('BroadcastChannel', undefined)
    const x = await setup(), delivery = barrier<void>(), fallback = barrier<ArrowsRoot>(), poll = barrier<ArmedAttempt | null>()
    const append = x.store.appendReportView.bind(x.store)
    vi.spyOn(x.store, 'appendReportView').mockImplementation(async (...args) => { await delivery.promise; return append(...args) })
    if (surface === 'live') fireEvent.click(screen.getByRole('button', { name: 'End attempt and review saved trials' }))
    else { fireEvent.click(screen.getByRole('button', { name: 'Main menu' })); x.mounted.unmount()
      render(<ArrowsJourney onLibrary={() => {}} exclusive={inertExclusive()} />); fireEvent.click(await savedResults())
      fireEvent.click(await screen.findByRole('button', { name: 'Review saved trials' })) }
    await waitFor(() => expect(document.querySelector('[data-arrows-published-session]')).not.toBeNull())
    await waitFor(() => expect(x.store.appendReportView).toHaveBeenCalled())
    const handle = x.store.authority.handle(x.arm, x.state), node = document.querySelector('[data-arrows-authority-handle]')!
    const id = node.getAttribute('data-arrows-authority-handle'), generation = node.getAttribute('data-arrows-authority-generation')
    expect(id).toBe(handle.id)
    vi.spyOn(x.store, 'loadArmed').mockReturnValue(poll.promise)
    const remote = new ArrowsStore({ read: () => x.backend.read(), change: work => x.backend.change(work) }, x.backend.root.installationId)
    if (deletion === 'all') await remote.deleteAll(); else await remote.deleteAttempt('session')
    vi.spyOn(x.backend, 'read').mockReturnValue(fallback.promise)
    await act(async () => { delivery.release() })
    await waitFor(() => expect(handle.status().kind).toBe('retired'))
    expect(document.querySelector('[data-arrows-authority-handle]')?.getAttribute('data-arrows-authority-handle')).toBe(id)
    expect(document.querySelector('[data-arrows-authority-generation]')?.getAttribute('data-arrows-authority-generation')).toBe(generation)
    expect(document.querySelector('[data-arrows-published-session]')).toBeNull()
    expect(screen.queryByText(/Presented |Review recorded events/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Retry report-view record' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Verify or retry saved prefix' })).not.toBeInTheDocument()
    expect(Object.keys(x.backend.root.attempts)).toHaveLength(0); expect(Object.keys(x.backend.root.activity ?? {})).toHaveLength(0)
    expect(x.backend.root.scoredStartCountV11).toBe(deletion === 'all' ? 0 : 1)
    expect(Object.keys(x.backend.root.tombstones)).toHaveLength(deletion === 'all' ? 0 : 1)
    await act(async () => { fallback.release(structuredClone(x.backend.root)); poll.release({ ...x.arm, snapshot: x.backend.root.attempts.session?.snapshot }) })
    expect(document.querySelector('[data-arrows-published-session]')).toBeNull()
  })

it('operational activity failure keeps saved result and retries exactly one opening', async () => {
  vi.stubGlobal('BroadcastChannel', undefined)
  const x = await setup(), append = x.store.appendReportView.bind(x.store)
  const appending = vi.spyOn(x.store, 'appendReportView').mockRejectedValueOnce(Error('temporary delivery failure')).mockImplementation(append)
  fireEvent.click(screen.getByRole('button', { name: 'End attempt and review saved trials' }))
  await screen.findByRole('button', { name: 'Retry report-view record' })
  expect(x.runner.recovery()?.outcome().kind).toBe('confirmed')
  expect(document.querySelector('[data-arrows-published-session]')).not.toBeNull()
  const bytes = JSON.stringify(x.backend.root.attempts.session.snapshot), original = appending.mock.calls[0]
  fireEvent.click(screen.getByRole('button', { name: 'Retry report-view record' }))
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Retry report-view record' })).not.toBeInTheDocument())
  expect(appending.mock.calls[1]).toEqual(original)
  expect(x.backend.root.activity!.session.events).toHaveLength(1)
  expect(JSON.stringify(x.backend.root.attempts.session.snapshot)).toBe(bytes)
})
for (const outcome of ['success', 'operational', 'negative'] as const)
  it(`detached old activity ${outcome} cannot change preparatory DOM or focus`, async () => {
    const x = await setup(), held = barrier<void>(), append = x.store.appendReportView.bind(x.store)
    vi.spyOn(x.store, 'appendReportView').mockImplementation(async (...args) => {
      await held.promise; if (outcome === 'operational') throw Error('temporary unavailable'); return append(...args)
    })
    fireEvent.click(screen.getByRole('button', { name: 'End attempt and review saved trials' }))
    await waitFor(() => expect(document.querySelector('[data-arrows-published-session]')).not.toBeNull())
    const handle = x.runner.recovery()!.authority!
    fireEvent.click(screen.getByRole('button', { name: 'Replay from guide' }))
    fireEvent.click(screen.getByRole('button', { name: 'See an example' }))
    const heading = screen.getByRole('heading', { name: 'Worked example 3 of 3' }); heading.focus()
    if (outcome === 'negative') { const remote = new ArrowsStore({ read: () => x.backend.read(), change: work => x.backend.change(work) }, x.backend.root.installationId); await remote.deleteAttempt('session') }
    await act(async () => { held.release() })
    if (outcome === 'negative') await waitFor(() => expect(handle.status().kind).toBe('retired'))
    else await act(async () => {})
    expect(screen.getByRole('heading', { name: 'Worked example 3 of 3' })).toBe(heading)
    expect(document.activeElement).toBe(heading)
    expect(screen.queryByRole('button', { name: 'Retry report-view record' })).not.toBeInTheDocument()
    expect(handle.status().kind).toBe(outcome === 'negative' ? 'retired' : 'current')
  })
it('history reattachment receives previously recorded retirement before publication and never saves', async () => {
  const x = await setup(), retained = await x.store.loadArmed('session')
  x.mounted.unmount()
  const handle = x.store.authority.handle(x.arm, x.state)
  await x.store.deleteAttempt('session')
  vi.spyOn(x.store, 'listAttempts').mockResolvedValue([retained!])
  const reading = vi.spyOn(x.store, 'loadArmed'), writing = vi.spyOn(x.store, 'saveSnapshot')
  render(<ArrowsJourney onLibrary={() => {}} exclusive={inertExclusive()} />)
  fireEvent.click(await savedResults())
  fireEvent.click(await screen.findByRole('button', { name: 'Review saved trials' }))
  await screen.findByText('This attempt is no longer available. No numbers are shown.')
  expect(document.querySelector('[data-arrows-authority-handle]')?.getAttribute('data-arrows-authority-handle')).toBe(handle.id)
  expect(reading).not.toHaveBeenCalled(); expect(writing).not.toHaveBeenCalled()
})
it('a negative poll dominates a late successful activity delivery for the same report', async () => {
  const x = await setup(), held = barrier<void>(), append = x.store.appendReportView.bind(x.store)
  vi.spyOn(x.store, 'appendReportView').mockImplementation(async (...args) => { const event = await append(...args); await held.promise; return event })
  fireEvent.click(screen.getByRole('button', { name: 'End attempt and review saved trials' }))
  await waitFor(() => expect(x.backend.root.activity?.session.events).toHaveLength(1))
  const handle = x.runner.recovery()!.authority!, remote = new ArrowsStore({ read: () => x.backend.read(), change: work => x.backend.change(work) }, x.backend.root.installationId)
  await remote.deleteAttempt('session')
  await act(async () => { await x.store.loadArmed('session') })
  expect(handle.status().kind).toBe('retired'); expect(document.querySelector('[data-arrows-published-session]')).toBeNull()
  await act(async () => { held.release() }); expect(document.querySelector('[data-arrows-published-session]')).toBeNull()
  expect(x.backend.root.activity?.session).toBeUndefined()
})
for (const outcome of ['success', 'operational', 'negative'] as const)
  it(`old activity ${outcome} preserves another report's DOM, focus and retry`, async () => {
    vi.stubGlobal('BroadcastChannel', undefined)
    const x = await setup(), held = barrier<void>(), append = x.store.appendReportView.bind(x.store)
    const arm = await x.store.start({ requestId: 'second-request', sessionId: 'second', clockDomainId: 'second-clock',
      profile: x.arm.profile, atMs: 100, wallMs: 2000 })
    const state = advance(arm.state, { kind: 'invalidate', atMs: 101, reason: 'settings' })
    await x.store.saveSnapshot(arm, state, 0)
    let calls = 0
    vi.spyOn(x.store, 'appendReportView').mockImplementation(async (...args) => {
      if (++calls > 1) throw Error('new opening delivery unavailable')
      await held.promise
      if (outcome === 'operational') throw Error('old opening delivery unavailable')
      return append(...args)
    })
    fireEvent.click(screen.getByRole('button', { name: 'End attempt and review saved trials' }))
    await waitFor(() => expect(calls).toBe(1))
    const oldHandle = x.runner.recovery()!.authority
    fireEvent.click(screen.getByRole('button', { name: 'View history' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Open report' }))
    const retry = await screen.findByRole('button', { name: 'Retry report-view record' })
    const node = document.querySelector('[data-arrows-published-session]')!, id = node.getAttribute('data-arrows-authority-handle')
    const handle = x.store.authority.handle(arm, state)
    expect(node.getAttribute('data-arrows-published-session')).toBe('second'); expect(id).toBe(handle.id)
    retry.focus()
    if (outcome === 'negative') {
      const remote = new ArrowsStore({ read: () => x.backend.read(), change: work => x.backend.change(work) }, x.backend.root.installationId); await remote.deleteAttempt('session')
    }
    await act(async () => { held.release() })
    if (outcome === 'negative') await waitFor(() => expect(oldHandle.status().kind).toBe('retired'))
    else await act(async () => {})
    expect(document.querySelector('[data-arrows-published-session]')).toBe(node)
    expect(node.getAttribute('data-arrows-authority-handle')).toBe(id)
    expect(handle.status().kind).toBe('current')
    expect(screen.getByRole('button', { name: 'Retry report-view record' })).toBe(retry)
    expect(document.activeElement).toBe(retry)
    expect(x.backend.root.scoredStartCountV11).toBe(2)
    expect(x.backend.root.attempts.second.snapshot?.state).toEqual(state)
  })
it('late original-Store activity negative reaches the identical report attached after remount', async () => {
  vi.stubGlobal('BroadcastChannel', undefined)
  const x = await setup(), held = barrier<void>(), fallback = barrier<ArrowsRoot>(), append = x.store.appendReportView.bind(x.store)
  vi.spyOn(x.store, 'appendReportView').mockImplementation(async (...args) => { await held.promise; return append(...args) })
  fireEvent.click(screen.getByRole('button', { name: 'End attempt and review saved trials' }))
  await waitFor(() => expect(document.querySelector('[data-arrows-published-session]')).not.toBeNull())
  const handle = x.runner.recovery()!.authority
  x.mounted.unmount()
  const reopened = new ArrowsStore(x.backend, x.backend.root.installationId)
  vi.spyOn(ArrowsStore, 'open').mockResolvedValue(reopened)
  vi.spyOn(reopened, 'appendReportView').mockReturnValue(new Promise(() => {}))
  render(<ArrowsJourney onLibrary={() => {}} exclusive={inertExclusive()} />)
  fireEvent.click(await savedResults())
  fireEvent.click(await screen.findByRole('button', { name: 'Review saved trials' }))
  await waitFor(() => expect(document.querySelector('[data-arrows-published-session]')).not.toBeNull())
  expect(document.querySelector('[data-arrows-authority-handle]')?.getAttribute('data-arrows-authority-handle')).toBe(handle.id)
  expect(reopened.authority.generation).not.toBe(x.store.authority.generation)
  vi.spyOn(reopened, 'loadArmed').mockReturnValue(new Promise(() => {}))
  const remote = new ArrowsStore({ read: () => x.backend.read(), change: work => x.backend.change(work) }, x.backend.root.installationId)
  await remote.deleteAttempt('session'); expect(handle.status().kind).toBe('current')
  vi.spyOn(x.backend, 'read').mockReturnValue(fallback.promise)
  await act(async () => { held.release() })
  await waitFor(() => expect(handle.status().kind).toBe('retired'))
  expect(document.querySelector('[data-arrows-published-session]')).toBeNull()
  expect(screen.queryByText(/Presented |Review recorded events/)).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Retry report-view record' })).not.toBeInTheDocument()
  await act(async () => { fallback.release(structuredClone(x.backend.root)) })
})

for (const retained of ['checkpoint', 'different-terminal'] as const)
  it(`canceled initial terminal recovery ${retained}: underlying observation controls draft DOM before retry`, async () => {
    vi.stubGlobal('BroadcastChannel', undefined)
    const x = await setup(), held = barrier<ArrowsRoot>(), atMs = x.state.commands.at(-1)!.atMs + 1
    const target = advance(x.state, { kind: 'invalidate', atMs, reason: 'settings' })
    const other = advance(x.state, { kind: 'invalidate', atMs, reason: 'technical' })
    if (retained === 'different-terminal') { const remote = new ArrowsStore({ read: () => x.backend.read(), change: work => x.backend.change(work) }, x.store.installationId); await remote.saveSnapshot(x.arm, other, 1) }
    const otherHandle = x.store.authority.handle(x.arm, other), armHandle = x.store.authority.handle(x.arm)
    const bytes = JSON.stringify(x.backend.root), reading = vi.spyOn(x.backend, 'read').mockReturnValue(held.promise)
    const internal = x.runner as unknown as { state: State; terminalState: State; captureTerminal: () => void; publish: (state: State) => void }
    internal.state = target; internal.terminalState = target; internal.captureTerminal()
    const controller = x.runner.recovery()!, handle = controller.authority
    expect(handle.snapshot()).toBeNull()
    await act(async () => internal.publish(target))
    await screen.findByRole('heading', { name: 'Arrows report' })
    await waitFor(() => expect(reading).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(controller.pending()).toBe(false), { timeout: 2600 })
    expect(controller.outcome().kind).toBe('uncertain'); expect(handle.status().kind).toBe('current')
    expect(screen.getByText(/Presented 27;/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try confirming save' })).toBeInTheDocument()
    await act(async () => held.release(structuredClone(x.backend.root)))
    if (retained === 'different-terminal') await waitFor(() => expect(controller.outcome().kind).toBe('retired'))
    expect(reading).toHaveBeenCalledTimes(1)
    expect(otherHandle.status().kind).toBe('current'); expect(armHandle.status().kind).toBe('current')
    expect(JSON.stringify(x.backend.root)).toBe(bytes)
    expect(document.querySelector('[data-arrows-published-session]')).toBeNull()
    if (retained === 'different-terminal') {
      expect(controller.outcome()).toMatchObject({ kind: 'retired', evidence: 'incompatible_result' })
      expect(screen.queryByText(/Presented |Review recorded events/)).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Try confirming save' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Retry report-view record' })).not.toBeInTheDocument()
      expect(await controller.recover()).toMatchObject({ kind: 'retired' }); expect(reading).toHaveBeenCalledTimes(1)
    } else {
      expect(controller.outcome().kind).toBe('uncertain'); expect(handle.status().kind).toBe('current')
      expect(screen.getByText(/Presented 27;/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Try confirming save' })).toBeInTheDocument()
    }
  }, 6000)

it('same-revision activity conflict withdraws an already published report; explicit fresh verification restores the same opening', async () => {
  vi.stubGlobal('BroadcastChannel', undefined)
  const x = await setup()
  fireEvent.click(screen.getByRole('button', { name: 'End attempt and review saved trials' }))
  await waitFor(() => expect(x.backend.root.activity?.session.events).toHaveLength(1))
  const handle = x.runner.recovery()!.authority, bytes = JSON.stringify(x.backend.root), viewId = x.backend.root.activity!.session.events[0].viewId
  const conflicting = structuredClone(x.backend.root)
  conflicting.activity!.session = { ...conflicting.activity!.session, events: conflicting.activity!.session.events.map(event => ({ ...event, observedWallMs: event.observedWallMs + 1 })) }
  vi.spyOn(x.backend, 'read').mockResolvedValueOnce(conflicting)
  await act(async () => { await expect(x.store.read()).rejects.toThrow('conflicting content') })
  expect(handle.status().kind).toBe('blocked'); expect(document.querySelector('[data-arrows-register-integrity]')?.getAttribute('data-arrows-register-integrity')).toBe('blocked')
  expect(document.querySelector('[data-arrows-published-session]')).toBeNull()
  expect(screen.queryByText(/Presented |Review recorded events|Only this known prefix is saved/)).not.toBeInTheDocument()
  await act(async () => { await expect(x.store.read()).rejects.toThrow('integrity blocked') })
  expect(handle.status().kind).toBe('blocked'); expect(JSON.stringify(x.backend.root)).toBe(bytes)
  fireEvent.click(screen.getByRole('button', { name: 'Verify saved data' }))
  await waitFor(() => expect(document.querySelector('[data-arrows-published-session]')).not.toBeNull())
  expect(handle.status().kind).toBe('current'); expect(screen.getByText(/Presented 27;/)).toBeInTheDocument()
  await act(async () => {})
  expect(x.backend.root.activity!.session.events).toHaveLength(1)
  expect(x.backend.root.activity!.session.events[0].viewId).toBe(viewId)
  expect(JSON.stringify(x.backend.root)).toBe(bytes)
})

for (const kind of ['same revision', 'higher history'] as const) it(`blocked report explicitly resets durable ${kind} conflict without reload, only after readback`, async () => {
  vi.stubGlobal('BroadcastChannel', undefined)
  const x = await setup()
  fireEvent.click(screen.getByRole('button', { name: 'End attempt and review saved trials' }))
  await waitFor(() => expect(x.backend.root.activity?.session.events).toHaveLength(1))
  const handle = x.runner.recovery()!.authority, original = x.store.installationId
  const conflicting = structuredClone(x.backend.root)
  if (kind === 'same revision') conflicting.activity!.session = { ...conflicting.activity!.session, events: conflicting.activity!.session.events.map(event => ({ ...event, observedWallMs: event.observedWallMs + 1 })) }
  else { conflicting.revision++; delete conflicting.activity!.session }
  x.backend.root = conflicting
  await act(async () => { await expect(x.store.read()).rejects.toThrow() })
  expect(handle.status().kind).toBe('blocked')
  expect(document.querySelector('[data-arrows-published-session]')).toBeNull()
  expect(screen.queryByText(/Presented |Only this known prefix is saved/)).not.toBeInTheDocument()
  const resetRead = barrier<ArrowsRoot>(), read = x.backend.read.bind(x.backend)
  vi.spyOn(x.backend, 'read').mockImplementation(() => x.backend.root.installationId === original ? read() : resetRead.promise)
  fireEvent.click(screen.getByRole('button', { name: 'Delete all Arrows data' }))
  const confirmation = screen.getByRole('group', { name: 'Confirm Arrows deletion' })
  fireEvent.click(confirmation.querySelector('button')!)
  await waitFor(() => expect(x.backend.root.installationId).not.toBe(original))
  expect(screen.queryByText('All local Arrows data were deleted.')).not.toBeInTheDocument()
  expect(handle.status().kind).toBe('blocked')
  expect(document.querySelector('[data-arrows-published-session]')).toBeNull()
  const replacement = structuredClone(x.backend.root)
  await act(async () => { resetRead.release(replacement) })
  expect(await screen.findByText('All local Arrows data were deleted.')).toBeInTheDocument()
  expect(handle.status()).toMatchObject({ kind: 'retired', evidence: 'installation_replaced' })
  expect(x.backend.root).toEqual({ ...freshArrowsRoot(), installationId: replacement.installationId })
  expect(screen.getByRole('button', { name: 'See an example' })).toBeInTheDocument()
  await expect(x.store.deleteAll()).rejects.toThrow('installation replaced')
  expect(x.backend.root).toEqual(replacement)
})

for (const kind of ['same revision', 'higher history'] as const) it(`failed reset of ${kind} retains blocked report and its explicit retry without saved claims`, async () => {
  const x = await setup()
  fireEvent.click(screen.getByRole('button', { name: 'End attempt and review saved trials' }))
  await waitFor(() => expect(x.backend.root.activity?.session.events).toHaveLength(1))
  const handle = x.runner.recovery()!.authority, changed = structuredClone(x.backend.root)
  if (kind === 'same revision') changed.activity!.session = { ...changed.activity!.session, events: changed.activity!.session.events.map(event => ({ ...event, observedWallMs: event.observedWallMs + 1 })) }
  else { changed.revision++; delete changed.activity!.session }
  x.backend.root = changed
  await act(async () => { await expect(x.store.read()).rejects.toThrow() })
  const change = x.backend.change.bind(x.backend)
  vi.spyOn(x.backend, 'change').mockImplementation(async work => { work(structuredClone(x.backend.root)); throw Error('reset failed before commit') })
  const reset = () => {
    fireEvent.click(screen.getByRole('button', { name: 'Delete all Arrows data' }))
    fireEvent.click(screen.getByRole('group', { name: 'Confirm Arrows deletion' }).querySelector('button')!)
  }
  reset()
  expect(await screen.findByText('Delete all could not be confirmed. Local Arrows data may remain.')).toBeInTheDocument()
  expect(x.backend.root).toEqual(changed); expect(handle.status().kind).toBe('blocked')
  expect(document.querySelector('[data-arrows-authority-handle]')?.getAttribute('data-arrows-authority-handle')).toBe(handle.id)
  expect(document.querySelector('[data-arrows-published-session]')).toBeNull()
  expect(screen.queryByText(/Presented |Only this known prefix is saved/)).not.toBeInTheDocument()
  vi.spyOn(x.backend, 'change').mockImplementation(change)
  reset()
  expect(await screen.findByText('All local Arrows data were deleted.')).toBeInTheDocument()
  expect(handle.status().kind).toBe('retired'); expect(x.backend.root.installationId).not.toBe(x.store.installationId)
})

it('failed reset and fresh integrity resumption reuse the genuine report-view ID', async () => {
  const x = await setup()
  fireEvent.click(screen.getByRole('button', { name: 'End attempt and review saved trials' }))
  await waitFor(() => expect(x.backend.root.activity?.session.events).toHaveLength(1))
  const good = structuredClone(x.backend.root), viewId = good.activity!.session.events[0].viewId
  x.backend.root.activity!.session = { ...x.backend.root.activity!.session, events: good.activity!.session.events.map(event => ({ ...event, observedWallMs: event.observedWallMs + 1 })) }
  await act(async () => { await expect(x.store.read()).rejects.toThrow() })
  const change = x.backend.change.bind(x.backend)
  vi.spyOn(x.backend, 'change').mockRejectedValueOnce(Error('reset failed'))
  fireEvent.click(screen.getByRole('button', { name: 'Delete all Arrows data' }))
  fireEvent.click(screen.getByRole('group', { name: 'Confirm Arrows deletion' }).querySelector('button')!)
  await screen.findByText('Delete all could not be confirmed. Local Arrows data may remain.')
  x.backend.root = good
  vi.spyOn(x.backend, 'change').mockImplementation(change)
  fireEvent.click(screen.getByRole('button', { name: 'Verify saved data' }))
  await waitFor(() => expect(document.querySelector('[data-arrows-published-session]')).not.toBeNull())
  await act(async () => {})
  expect(x.backend.root.activity!.session.events).toHaveLength(1)
  expect(x.backend.root.activity!.session.events[0].viewId).toBe(viewId)
  expect(x.backend.root).toEqual(good)
})

for (const phase of ['released prefix', 'live break', 'protected'] as const)
  it(`${phase} withdrawal keeps a visible exact-session retry after an operational resumption failure`, async () => {
    const x = await setup()
    vi.spyOn(performance, 'now').mockReturnValue(x.state.commands.at(-1)!.atMs + 2)
    if (phase === 'released prefix') {
      fireEvent.click(screen.getByRole('button', { name: 'End attempt and review saved trials' }))
      await waitFor(() => expect(x.backend.root.activity?.session.events).toHaveLength(1))
    } else {
      const internal = x.runner as unknown as { watchArm: () => void; state: State; protectedBlock: boolean }
      if (phase === 'protected') {
        internal.state = advance(x.state, { kind: 'continue', atMs: x.state.commands.at(-1)!.atMs + 1, responseHeld: false })
        internal.protectedBlock = true
      }
      internal.watchArm()
    }
    const good = structuredClone(x.backend.root)
    x.backend.root.attempts.session = { ...x.backend.root.attempts.session, createdAtWallMs: 1001 }
    await act(async () => { await expect(x.store.read()).rejects.toThrow() })
    const controller = x.runner.recovery()!, session = document.querySelector('[data-arrows-report-session]')!.getAttribute('data-arrows-report-session')
    x.backend.root = good
    vi.spyOn(x.store, 'loadArmed').mockRejectedValueOnce(Error('temporary recovery read failure'))
    fireEvent.click(screen.getByRole('button', { name: 'Verify saved data' }))
    const retry = await screen.findByRole('button', { name: phase === 'protected' ? 'Try confirming save' : 'Verify or retry saved prefix' })
    expect(controller.authority.status().kind).toBe('current')
    expect(document.querySelector('[data-arrows-published-session]')).toBeNull()
    expect(screen.queryByText(/Presented |Only this known prefix is saved/)).not.toBeInTheDocument()
    expect(x.backend.root).toEqual(good)
    fireEvent.click(retry)
    await waitFor(() => expect(document.querySelector('[data-arrows-published-session]')).not.toBeNull())
    await waitFor(() => expect(x.backend.root.activity?.session.events).toHaveLength(1))
    expect(x.backend.root.attempts.session.snapshot!.state).toEqual(controller.target.state)
    expect(document.querySelector('[data-arrows-report-session]')?.getAttribute('data-arrows-report-session')).toBe(session)
    expect(x.runner.protectedNow()).toBe(false)
  })
