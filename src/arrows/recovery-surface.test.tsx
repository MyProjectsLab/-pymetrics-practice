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
afterEach(() => { cleanup(); vi.restoreAllMocks(); Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
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
for (const deletion of ['individual', 'all'] as const) for (const readFirst of ['A', 'B'] as const)
  for (const deliveryFirst of ['positive', 'negative'] as const) it(`DOM ${deletion}: ${readFirst} reads first; ${deliveryFirst} delivery first`, async () => {
    const x = await setup(), startA = barrier<void>(), startB = barrier<void>(), deliveryA = barrier<void>(), deliveryB = barrier<void>(), publication = barrier<void>()
    const read = x.store.loadArmed.bind(x.store)
    const start = { A: startA, B: startB }, delivery = { A: deliveryA, B: deliveryB }
    let calls = 0
    const observations: string[] = []
    vi.spyOn(x.store, 'loadArmed').mockImplementation(async id => {
      const n = ++calls
      if (n > 2) { const arm = await read(id); await publication.promise; return arm }
      const name = n === 1 ? 'A' : 'B'; await start[name].promise
      let value: ArmedAttempt | null = null, failure: unknown
      try { value = await read(id) } catch (error) { failure = error }
      observations.push(name)
      await delivery[name].promise
      if (failure) throw failure
      return value
    })
    fireEvent.click(screen.getByRole('button', { name: 'End attempt and review saved trials' }))
    await waitFor(() => expect(calls).toBe(1))
    // The initial request and a queued retry coalesce; deadline permits a new operation.
    fireEvent.click(screen.getByRole('button', { name: 'Verify or retry saved prefix' }))
    expect(calls).toBe(1)
    await waitFor(() => expect(x.runner.recovery()?.pending()).toBe(false), { timeout: 2600 })
    fireEvent.click(screen.getByRole('button', { name: 'Verify or retry saved prefix' }))
    await waitFor(() => expect(calls).toBe(2))
    await act(async () => { start[readFirst].release() })
    await waitFor(() => expect(observations).toHaveLength(1))
    if (deletion === 'all') await x.store.deleteAll(); else await x.store.deleteAttempt('session')
    const negative = readFirst === 'A' ? 'B' : 'A'
    await act(async () => { start[negative].release() }); await waitFor(() => expect(observations).toHaveLength(2))
    if (deliveryFirst === 'positive') await act(async () => { delivery[readFirst].release() })
    await act(async () => { delivery[negative].release() })
    // This assertion happens before releasing any remaining positive/publication callback.
    expect(x.runner.recovery()?.outcome().kind).toBe('retired')
    expect(screen.queryByText(/Presented /)).not.toBeInTheDocument()
    expect(screen.queryByText(/Review recorded events/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Verify or retry saved prefix' })).not.toBeInTheDocument()
    expect(document.querySelector('[data-arrows-published-session]')).toBeNull()
    await act(async () => { delivery[readFirst].release(); publication.release() })
    expect(screen.queryByText(/Presented /)).not.toBeInTheDocument()
    expect(Object.keys(x.backend.root.attempts)).toHaveLength(0); expect(Object.keys(x.backend.root.activity ?? {})).toHaveLength(0)
    expect(x.backend.root.scoredStartCountV11).toBe(deletion === 'all' ? 0 : 1)
    expect(Object.keys(x.backend.root.tombstones)).toHaveLength(deletion === 'all' ? 0 : 1)
  }, 6000)
it('a detached confirmed controller retirement cannot replace a newer preparatory surface or steal focus', async () => {
  const x = await setup()
  fireEvent.click(screen.getByRole('button', { name: 'End attempt and review saved trials' }))
  await waitFor(() => expect(document.querySelector('[data-arrows-published-session]')).not.toBeNull())
  fireEvent.click(screen.getByRole('button', { name: 'Replay from guide' }))
  fireEvent.click(screen.getByRole('button', { name: 'See an example' }))
  const heading = screen.getByRole('heading', { name: 'Worked example 3 of 3' }); heading.focus()
  await act(async () => { x.backend.root.attempts = {}; x.backend.root.tombstones.session = 1001; x.backend.root.revision++; x.store.authority.observe(x.backend.root, x.store.authority.provenance('read')) })
  expect(screen.getByRole('heading', { name: 'Worked example 3 of 3' })).toBe(heading)
  expect(document.activeElement).toBe(heading)
})
it('old retirement cannot erase a replacement controller with a reused session ID', async () => {
  const x = await setup(), held = barrier<ArmedAttempt | null>()
  fireEvent.click(screen.getByRole('button', { name: 'End attempt and review saved trials' }))
  await waitFor(() => expect(document.querySelector('[data-arrows-published-session]')).not.toBeNull())
  const reading = vi.spyOn(x.store, 'loadArmed').mockReturnValue(held.promise)
  const old = x.runner.recovery()!
  fireEvent.click(screen.getByRole('button', { name: 'Replay from guide' }))
  fireEvent.click(await savedResults())
  await screen.findByRole('heading', { name: 'Arrows history' })
  fireEvent.click(screen.getByRole('button', { name: 'Delete all Arrows data' }))
  fireEvent.click(screen.getByRole('button', { name: 'Delete all Arrows data' }))
  await screen.findByText('All local Arrows data were deleted.')
  const replacement = new ArrowsStore(x.backend, x.backend.root.installationId)
  const arm = await replacement.start({ requestId: 'replacement-request', sessionId: x.arm.sessionId,
    clockDomainId: 'replacement-clock', profile: x.arm.profile, atMs: 100, wallMs: 2000 })
  const state = advance(arm.state, { kind: 'invalidate', atMs: 101, reason: 'settings' })
  const snapshot = await replacement.saveSnapshot(arm, state, 0)
  reading.mockReturnValue(held.promise)
  let newer!: ArrowsBrowserRun
  vi.spyOn(ArrowsBrowserRun.prototype, 'begin').mockImplementation(async function (this: ArrowsBrowserRun) {
    // eslint-disable-next-line typescript/no-this-alias
    newer = this
    const internal = this as unknown as { state: State; attempt: ArmedAttempt }
    internal.state = state; internal.attempt = arm
    const terminal = this as unknown as { terminalState: State; captureTerminal: () => void }
    terminal.terminalState = state; terminal.captureTerminal()
    return arm.state
  })
  ready(); fireEvent.click(screen.getByRole('button', { name: 'Start practice' }))
  await waitFor(() => expect(newer).toBeDefined())
  await act(async () => (newer as unknown as { publish: (state: State) => void }).publish(state))
  await waitFor(() => expect(document.querySelector('[data-arrows-published-session]')).not.toBeNull())
  expect(newer.recovery()?.target.sessionId).toBe(old.target.sessionId)
  expect(newer.recovery()?.target.requestId).not.toBe(old.target.requestId)
  const node = document.querySelector('[data-arrows-published-session]')
  await act(async () => { x.store.authority.observe(freshArrowsRoot(), x.store.authority.provenance('read')); held.release(null) })
  expect(newer.recovery()?.outcome().kind).toBe('confirmed')
  expect(document.querySelector('[data-arrows-published-session]')).toBe(node)
  expect(screen.getByText(/Presented 0;/)).toBeInTheDocument()
  expect((await replacement.loadSnapshot(arm.sessionId))).toEqual(snapshot)
})
it('unmount detaches publication while a late negative retires only its original controller', async () => {
  const x = await setup(), held = barrier<ArmedAttempt | null>()
  vi.spyOn(x.store, 'loadArmed').mockReturnValue(held.promise)
  fireEvent.click(screen.getByRole('button', { name: 'End attempt and review saved trials' }))
  const old = x.runner.recovery()!
  x.mounted.unmount()
  await x.store.deleteAttempt('session')
  render(<ArrowsJourney onLibrary={() => {}} exclusive={inertExclusive()} />)
  await screen.findByRole('heading', { name: 'Arrows' })
  const heading = screen.getByRole('heading', { name: 'Arrows' }); heading.focus()
  await act(async () => { held.release(null) })
  expect(old.outcome().kind).toBe('retired')
  expect(screen.getByRole('heading', { name: 'Arrows' })).toBe(heading)
  expect(document.activeElement).toBe(heading)
  expect(document.querySelector('[data-arrows-published-session]')).toBeNull()
})


it('retains an unconfirmed prefix on explicit Back and Replay until its save is verified', async () => {
  const x = await setup(), held = barrier<ArmedAttempt | null>()
  const reading = vi.spyOn(x.store, 'loadArmed').mockReturnValue(held.promise)
  fireEvent.click(screen.getByRole('button', { name: 'End attempt and review saved trials' }))
  const report = await screen.findByRole('heading', { name: 'Arrows report' })
  for (const label of ['Back to library', 'Replay from guide']) {
    fireEvent.click(screen.getAllByRole('button', { name: label }).at(-1)!)
    expect(screen.getByRole('heading', { name: 'Arrows report' })).toBe(report)
    expect(screen.getByText(/Confirm its save before leaving/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Verify or retry saved prefix' })).toBeInTheDocument()
  }
  reading.mockRestore()
  await act(async () => { held.release(await x.store.loadArmed(x.arm.sessionId)) })
  await waitFor(() => expect(document.querySelector('[data-arrows-published-session]')).not.toBeNull())
  fireEvent.click(screen.getByRole('button', { name: 'Replay from guide' }))
  expect(screen.getByRole('heading', { name: 'Arrows' })).toBeInTheDocument()
})

it('retains an unsaved terminal draft on explicit Back and Replay until retry confirms it', async () => {
  const x = await setup()
  const saving = vi.spyOn(x.store, 'saveSnapshot').mockRejectedValue(Error('Injected terminal write failure'))
  vi.spyOn(performance, 'now').mockReturnValue(x.state.commands.at(-1)!.atMs + 1)
  await act(async () => x.runner.settingsChanged())
  const report = await screen.findByRole('heading', { name: 'Arrows report' })
  await screen.findByText(/its save could not be confirmed/)
  const draft = structuredClone(x.runner.snapshot())
  for (const label of ['Back to library', 'Replay from guide']) {
    fireEvent.click(screen.getAllByRole('button', { name: label }).at(-1)!)
    expect(screen.getByRole('heading', { name: 'Arrows report' })).toBe(report)
    expect(screen.getByText(/Confirm its save before leaving/)).toBeInTheDocument()
    expect(x.runner.snapshot()).toEqual(draft)
  }
  saving.mockRestore()
  fireEvent.click(screen.getByRole('button', { name: 'Try confirming save' }))
  await waitFor(() => expect(document.querySelector('[data-arrows-published-session]')).not.toBeNull())
  expect((await x.store.loadSnapshot(x.arm.sessionId))?.state).toEqual(draft)
  fireEvent.click(screen.getByRole('button', { name: 'Replay from guide' }))
  expect(screen.getByRole('heading', { name: 'Arrows' })).toBeInTheDocument()
})
