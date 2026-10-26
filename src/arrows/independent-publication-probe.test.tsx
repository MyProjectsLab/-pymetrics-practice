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



for (const surface of ['live', 'history'] as const) it(`${surface} post-flush publication rejection clears numbers and keeps session retry`, async () => {
 const x=await setup();vi.spyOn(performance,'now').mockReturnValue(x.state.commands.at(-1)!.atMs+1);await act(async()=>x.runner.settingsChanged());
 await waitFor(()=>expect(x.backend.root.activity?.session.events).toHaveLength(1));
 if(surface==='history') {x.mounted.unmount();render(<ArrowsJourney onLibrary={() => {}} exclusive={inertExclusive()} />);fireEvent.click(await savedResults());fireEvent.click(await screen.findByRole('button',{name:'Open report'}));await waitFor(()=>expect(x.backend.root.activity?.session.events).toHaveLength(2));}
 const good=structuredClone(x.backend.root);x.backend.root.activity!.session={...x.backend.root.activity!.session,events:x.backend.root.activity!.session.events.map(e=>({...e,observedWallMs:e.observedWallMs+1}))};
 await act(async()=>{await expect(x.store.read()).rejects.toThrow()});x.backend.root=good;
 const journey = document.querySelector('.arrows-journey')!; const query=journey.querySelector.bind(journey);let injected=0;
 vi.spyOn(journey,'querySelector').mockImplementation(selector=>{const value=query(selector);if(selector==='[data-arrows-published-session]'&&value&&!injected){injected++;return null}return value});
 fireEvent.click(screen.getByRole('button',{name:'Verify saved data'}));
 await waitFor(()=>expect(injected).toBe(1));await act(async()=>{});
 expect(injected).toBeGreaterThan(0);
 expect(screen.queryByText(/Presented /)).not.toBeInTheDocument();
 const retry=screen.getByRole('button',{name:surface==='history'?'Verify saved report':'Try confirming save'});
 vi.mocked(journey.querySelector).mockRestore();fireEvent.click(retry);
 await waitFor(()=>expect(document.querySelector('[data-arrows-published-session]')).not.toBeNull());
 expect(x.backend.root).toEqual(good);
});

it('initial history publication failure withdraws its report and can retry the same opening', async () => {
 const x = await setup(); vi.spyOn(performance, 'now').mockReturnValue(x.state.commands.at(-1)!.atMs + 1)
 await act(async () => x.runner.settingsChanged())
 await waitFor(() => expect(x.backend.root.activity?.session.events).toHaveLength(1))
 x.mounted.unmount(); render(<ArrowsJourney onLibrary={() => {}} exclusive={inertExclusive()} />)
 fireEvent.click(await savedResults())
 const journey = document.querySelector('.arrows-journey')!
 const query = journey.querySelector.bind(journey); let injected = 0
 vi.spyOn(journey, 'querySelector').mockImplementation(selector => {
   const value = query(selector)
   if (selector === '[data-arrows-published-session]' && value && !injected) { injected++; return null }
   return value
 })
 fireEvent.click(await screen.findByRole('button', { name: 'Open report' }))
 await waitFor(() => expect(injected).toBe(1)); await act(async () => {})
 expect(screen.queryByText(/Presented /)).not.toBeInTheDocument()
 const retry = screen.getByRole('button', { name: 'Verify saved report' })
 vi.mocked(journey.querySelector).mockRestore(); fireEvent.click(retry)
 await waitFor(() => expect(document.querySelector('[data-arrows-published-session]')).not.toBeNull())
 await waitFor(() => expect(x.backend.root.activity?.session.events).toHaveLength(2))
})
