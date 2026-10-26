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


it('live terminal failed reset retains a usable original controller for explicit integrity resumption', async()=>{
 const x=await setup();vi.spyOn(performance,'now').mockReturnValue(x.state.commands.at(-1)!.atMs+1);await act(async()=>x.runner.settingsChanged());
 await waitFor(()=>expect(document.querySelector('[data-arrows-published-session]')).not.toBeNull());
 await waitFor(()=>expect(x.backend.root.activity?.session.events).toHaveLength(1));
 const good=structuredClone(x.backend.root), id=good.activity!.session.events[0].viewId;
 x.backend.root.activity!.session={...x.backend.root.activity!.session,events:x.backend.root.activity!.session.events.map(event=>({...event,observedWallMs:2002}))};
 await act(async()=>{await expect(x.store.read()).rejects.toThrow()});
 const handle=x.runner.recovery()!.authority;
 expect(handle.status().kind).toBe('blocked');
 vi.spyOn(x.backend,'change').mockRejectedValueOnce(Error('reset failed'));
 fireEvent.click(screen.getByRole('button',{name:'Delete all Arrows data'}));
 fireEvent.click(screen.getByRole('group',{name:'Confirm Arrows deletion'}).querySelector('button')!);
 await screen.findByText('Delete all could not be confirmed. Local Arrows data may remain.');
 x.backend.root=good;
 fireEvent.click(screen.getByRole('button',{name:'Verify saved data'}));
 await waitFor(()=>expect(handle.status().kind).toBe('current'));
 expect(x.backend.root).toEqual(good);expect(x.backend.root.activity!.session.events[0].viewId).toBe(id);
 await waitFor(()=>expect(document.querySelector('[data-arrows-published-session]')).not.toBeNull());
});

for (const failure of ['live recovery', 'live publication', 'history publication', 'visibility'] as const)
  it(`${failure} failure after integrity resolution exposes session retry without publishing uncertain bytes`, async () => {
    const x = await setup()
    vi.spyOn(performance, 'now').mockReturnValue(x.state.commands.at(-1)!.atMs + 1)
    await act(async () => x.runner.settingsChanged())
    await waitFor(() => expect(x.backend.root.activity?.session.events).toHaveLength(1))
    if (failure === 'history publication') {
      x.mounted.unmount()
      render(<ArrowsJourney onLibrary={() => {}} exclusive={inertExclusive()} />)
      fireEvent.click(await savedResults())
      fireEvent.click(await screen.findByRole('button', { name: 'Open report' }))
      await waitFor(() => expect(x.backend.root.activity?.session.events).toHaveLength(2))
    }
    const node = document.querySelector('[data-arrows-published-session]')!
    const session = node.getAttribute('data-arrows-report-session'), id = node.getAttribute('data-arrows-authority-handle')
    const good = structuredClone(x.backend.root)
    x.backend.root.activity!.session = { ...x.backend.root.activity!.session,
      events: x.backend.root.activity!.session.events.map(event => ({ ...event, observedWallMs: event.observedWallMs + 1 })) }
    await act(async () => { await expect(x.store.read()).rejects.toThrow() })
    vi.spyOn(x.backend, 'change').mockRejectedValueOnce(Error('reset failed'))
    fireEvent.click(screen.getByRole('button', { name: 'Delete all Arrows data' }))
    fireEvent.click(screen.getByRole('group', { name: 'Confirm Arrows deletion' }).querySelector('button')!)
    await screen.findByText('Delete all could not be confirmed. Local Arrows data may remain.')
    x.backend.root = good
    const read = x.store.loadArmed.bind(x.store)
    let ordinal = 0
    vi.spyOn(x.store, 'loadArmed').mockImplementation(async (...args) => {
      if (failure !== 'visibility' && ++ordinal === (failure === 'live publication' ? 2 : 1)) throw Error('operational resumption failure')
      return read(...args)
    })
    if (failure === 'visibility') {
      const verify = x.store.verifyIntegrity.bind(x.store)
      vi.spyOn(x.store, 'verifyIntegrity').mockImplementation(async () => { await verify(); vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden') })
    }
    fireEvent.click(screen.getByRole('button', { name: 'Verify saved data' }))
    if (failure !== 'visibility') await waitFor(() => expect(ordinal).toBeGreaterThanOrEqual(failure === 'live publication' ? 2 : 1))
    if (failure === 'live publication' || failure === 'history publication') await screen.findByText('Saved data could not be verified. No numbers are shown.')
    await act(async () => {})
    const retry = await screen.findByRole('button', { name: failure === 'history publication' ? 'Verify saved report' : 'Try confirming save' })
    expect(document.querySelector('[data-arrows-authority-status]')?.getAttribute('data-arrows-authority-status')).toBe('current')
    expect(document.querySelector('[data-arrows-published-session]')).toBeNull()
    expect(screen.queryByText(/Presented |Saved in this browser/)).not.toBeInTheDocument()
    expect(x.backend.root).toEqual(good)
    expect(document.querySelector('[data-arrows-report-session]')?.getAttribute('data-arrows-report-session')).toBe(session)
    expect(document.querySelector('[data-arrows-authority-handle]')?.getAttribute('data-arrows-authority-handle')).toBe(id)
    if (failure === 'visibility') vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    fireEvent.click(retry)
    await waitFor(() => expect(document.querySelector('[data-arrows-published-session]')).not.toBeNull())
    await act(async () => {})
    expect(x.backend.root).toEqual(good)
    expect(document.querySelector('[data-arrows-report-session]')?.getAttribute('data-arrows-report-session')).toBe(session)
  })
