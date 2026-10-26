/** Controlled DOM and clock fixture. Native input qualification is separate. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MouthBrowserRun } from './browser'
import { advance, MOUTH_PRESENTATION_VERSION, requiredDue, verifyHeadless } from './engine'
import type { InputProfile, State } from './engine'
import { MouthRecovery } from './recovery'
import type { MouthEntry } from './entry'
import { MouthStore, freshMouthRoot } from './storage'
import type { ArmedAttempt, MouthBackend, MouthRoot, StartRequest } from './storage'

const profile: InputProfile = { kind: 'keyboard', variant: 'standard', deviceClass: 'controlled-diagnostic',
  leftCode: 'ArrowLeft', rightCode: 'ArrowRight', alternative: false, contrast: 'dark_on_light',
  magnification: 'none', reducedMotion: false, presentationVersion: MOUTH_PRESENTATION_VERSION }
const display = { layoutWidthCssPx: 1200, layoutHeightCssPx: 900, visualWidthCssPx: 1200,
  visualHeightCssPx: 900, taskHostWidthCssPx: 512, devicePixelRatio: 1, browserFamily: 'webkit',
  visibility: 'visible', focused: true } as const

class Backend implements MouthBackend {
  root = freshMouthRoot()
  gate: Promise<void> | null = null
  entered: (() => void) | null = null
  async read() { const gate = this.gate; if (gate) { this.gate = null; this.entered?.(); await gate } return structuredClone(this.root) }
  async change<T>(op: (root: MouthRoot) => T) { const next = structuredClone(this.root), result = op(next); this.root = next; return result }
}
class Boundary {
  active = false
  readonly host: HTMLElement
  constructor(host: HTMLElement) { this.host = host }
  setBank() {}
  bankValid() { return this.active }
  check() { return this.active && !this.host.hidden }
  enter() { this.active = true; this.host.hidden = false }
  leave() { this.active = false; this.host.hidden = true }
}
type ExposedRun = { host: HTMLElement; entry: { reclaim: (arm: ArmedAttempt) => Promise<unknown>; admission: unknown };
  continue: () => Promise<void>; dispose: () => void; prepare: (profile: InputProfile, preview?: boolean) => void;
  layoutReady: () => boolean; state: State; arm: ArmedAttempt; profile: InputProfile;
  recovery: MouthRecovery | null; checkpointStatus: 'none' | 'pending' | 'uncertain' | 'confirmed';
  protected: boolean; firstToken: unknown; now: () => number; schedule: () => void; canceled: boolean;
}

function rect(x: number, y: number, width: number, height: number): DOMRect {
  return { x, y, width, height, left: x, top: y, right: x + width, bottom: y + height,
    toJSON() { return { x, y, width, height } } } as DOMRect
}
beforeEach(() => {
  const paint = document.createElement('style')
  paint.dataset.diagnosticPaint = ''
  paint.textContent = '* { opacity: 1; }'
  document.head.append(paint)
  Object.defineProperty(navigator, 'locks', { configurable: true, value: { request: async (_name: string, _options: unknown, fn: (lock: object) => Promise<unknown>) => fn({}) } })
  Object.defineProperty(document, 'hasFocus', { configurable: true, value: () => true })
  Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, value: 1200 })
  Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, value: 900 })
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: { width: 1200, height: 900, offsetLeft: 0, offsetTop: 0 } })
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const host = this.closest?.('[data-diagnostic-host]') as HTMLElement | null
    if (host?.hidden) return rect(0, 0, 0, 0)
    if (this.matches('[data-diagnostic-host]')) return rect(80, 80, 512, 420)
    if (this.matches('.mouth-stage')) return rect(100, 100, 240, 240)
    if (this.matches('button[data-mouth-side="short"]')) return rect(100, 360, 112, 48)
    if (this.matches('button[data-mouth-side="long"]')) return rect(228, 360, 112, 48)
    return rect(0, 0, 1200, 900)
  })
  Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: (x: number, y: number) => {
    const host = document.querySelector<HTMLElement>('[data-diagnostic-host]')
    if (!host || host.hidden) return null
    if (y >= 100 && y <= 340) return host.querySelector('.mouth-stage')
    if (y >= 360 && y <= 408) return host.querySelector(x < 220 ? '[data-mouth-side="short"]' : '[data-mouth-side="long"]')
    return host
  } })
})
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); document.body.replaceChildren(); document.querySelector('[data-diagnostic-paint]')?.remove() })

async function fixture() {
  const backend = new Backend(), store = new MouthStore(backend, backend.root.installationId)
  const request: StartRequest = { requestId: crypto.randomUUID(), sessionId: crypto.randomUUID(),
    clockDomainId: crypto.randomUUID(), profile, variant: 'standard', route: 'standalone',
    atMs: 0, wallMs: 1, displayContext: display }
  const arm = await store.start(request)
  let state = advance(arm.state, { kind: 'start', atMs: 0, responseHeld: false, displayContext: display })
  for (let trial = 0; trial < 30; trial++) {
    for (const kind of ['fixation', 'onset', 'remove', 'resolve', 'feedback', 'offset'] as const)
      state = advance(state, { kind, atMs: requiredDue(state)! })
  }
  expect(state.phase).toBe('break')
  expect(verifyHeadless(state)).toBe(true)
  const saved = await store.saveSnapshot(arm, state, 0)
  expect(saved.closedTrials).toBe(30)
  const host = document.createElement('fieldset')
  host.dataset.diagnosticHost = ''
  host.hidden = true
  document.body.append(host)
  const boundary = new Boundary(host)
  const updates: Array<{ phase: string | null; checkpoint: string; message: string }> = []
  const run = new MouthBrowserRun(store, host, value => {
    updates.push({ phase: value.state?.phase ?? null, checkpoint: value.checkpoint, message: value.message })
    if (value.state?.phase === 'break') boundary.leave()
  }, boundary as never) as unknown as ExposedRun
  await run.entry.reclaim(arm)
  const recovery = new MouthRecovery(run.entry as unknown as MouthEntry, arm, state)
  expect((await recovery.recover()).kind).toBe('confirmed')
  run.state = state; run.arm = arm; run.profile = profile; run.recovery = recovery
  run.checkpointStatus = 'confirmed'
  run.prepare(profile, false); boundary.enter()
  expect(run.layoutReady()).toBe(true)
  boundary.leave()
  // Controlled fixture clock stays after the genuine 30-trial prefix. It does not alter product clocks.
  run.now = () => state.commands.at(-1)!.atMs + 1000
  return { backend, store, state, run, boundary, updates }
}
function holdNextRead(backend: Backend) {
  let release!: () => void, entered!: () => void
  backend.gate = new Promise<void>(resolve => { release = resolve })
  const waited = new Promise<void>(resolve => { entered = resolve })
  backend.entered = entered
  return { waited, release: () => { backend.gate = null; release() } }
}
const continues = (state: State) => state.commands.filter(command => command.kind === 'continue').length

describe('MouthBrowserRun continuation under competing actions', () => {
  it('no-key control admits the same checkpoint and appends Continue', async () => {
    const f = await fixture()
    try {
      const gate = holdNextRead(f.backend)
      const work = f.run.continue()
      await gate.waited
      expect(f.boundary.active).toBe(false)
      gate.release()
      await work
      console.log('NO_KEY ' + JSON.stringify({ phase: f.run.state.phase,
        continueCommands: f.run.state.commands.filter(command => command.kind === 'continue').length,
        hasRecovery: !!f.run.recovery, protected: f.run.protected }))
      expect(f.run.state.phase).toBe('fixation_pending')
      expect(f.run.state.commands.filter(command => command.kind === 'continue')).toHaveLength(1)
      expect(f.run.firstToken).toMatchObject({ requestId: f.run.arm.requestId, trialIndex: 31 })
    } finally { f.run.dispose(); f.store.close() }
  })
  it('controlled programmatic break key during held admission retains the exact source and continues', async () => {
    const f = await fixture()
    try {
      const gate = holdNextRead(f.backend)
      const work = f.run.continue()
      await gate.waited
      expect(f.boundary.active).toBe(false)
      // Programmatic events are UNTRUSTED, not a native input qualification. The
      // current MouthBrowserRun.key has no isTrusted branch, so this tests its control flow.
      window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, code: 'ArrowLeft', key: 'ArrowLeft' }))
      window.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, code: 'ArrowLeft', key: 'ArrowLeft' }))
      expect(f.boundary.active).toBe(false)
      gate.release()
      await work
      const result = { phase: f.run.state.phase,
        continueCommands: f.run.state.commands.filter(command => command.kind === 'continue').length,
        checkpoint: f.run.checkpointStatus, hasRecovery: !!f.run.recovery,
        protected: f.run.protected, hasFirstToken: !!f.run.firstToken,
        boundaryActive: f.boundary.active, hostWidth: f.run.host.getBoundingClientRect().width,
        lastCommands: f.run.state.commands.slice(-2).map(command => command.kind) }
      console.log('HELD_KEY ' + JSON.stringify(result))
      expect(result.phase).toBe('fixation_pending')
      expect(result.continueCommands).toBe(1)
      expect(result.checkpoint).toBe('none')
      expect(result.hasRecovery).toBe(false)
      expect(result.protected).toBe(true)
      expect(result.hasFirstToken).toBe(true)
      expect(result.boundaryActive).toBe(true)
      expect(result.hostWidth).toBe(512)
    } finally { f.run.dispose(); f.store.close() }
  })
  it('hidden display context fails before commit, then the same confirmed checkpoint retries', async () => {
    const f = await fixture()
    try {
      Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, value: 0 })
      await expect(f.run.continue()).rejects.toThrow('Mouth display context unavailable')
      expect(f.run.state.phase).toBe('break')
      expect(continues(f.run.state)).toBe(0)
      expect(f.run.recovery).not.toBeNull()
      expect(f.run.checkpointStatus).toBe('confirmed')
      expect(f.run.protected).toBe(false)
      expect(f.run.firstToken).toBeNull()
      expect(f.boundary.active).toBe(false)
      Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, value: 1200 })
      await f.run.continue()
      expect(f.run.state.phase).toBe('fixation_pending')
      expect(continues(f.run.state)).toBe(1)
      console.log('PRECOMMIT_CAPTURE '+JSON.stringify({ sameSession: f.run.arm.sessionId,
        continueCommands: continues(f.run.state), phase: f.run.state.phase }))
    } finally { f.run.dispose(); f.store.close() }
  })
  it('pure engine clock rejection retains checkpoint and permits same-source retry', async () => {
    const f = await fixture()
    try {
      const validNow = f.run.now
      f.run.now = () => 0
      await expect(f.run.continue()).rejects.toThrow('regressing clock')
      expect(f.run.state.phase).toBe('break')
      expect(continues(f.run.state)).toBe(0)
      expect(f.run.recovery).not.toBeNull()
      expect(f.run.checkpointStatus).toBe('confirmed')
      expect(f.run.protected).toBe(false)
      f.run.now = validNow
      await f.run.continue()
      expect(continues(f.run.state)).toBe(1)
    } finally { f.run.dispose(); f.store.close() }
  })
  it('held key blocks the late callback until real release is represented', async () => {
    const f = await fixture()
    try {
      const gate = holdNextRead(f.backend), work = f.run.continue()
      await gate.waited
      window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, code: 'ArrowLeft', key: 'ArrowLeft' }))
      gate.release()
      await expect(work).rejects.toThrow('Release controls')
      expect(f.run.checkpointStatus).toBe('confirmed')
      expect(f.run.recovery).not.toBeNull()
      expect(continues(f.run.state)).toBe(0)
      window.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, code: 'ArrowLeft', key: 'ArrowLeft' }))
      await f.run.continue()
      expect(continues(f.run.state)).toBe(1)
      expect(f.run.state.events.some(event => event.type === 'input_released')).toBe(true)
    } finally { f.run.dispose(); f.store.close() }
  })
  it('duplicate activation while the source read is held commits once', async () => {
    const f = await fixture()
    try {
      const gate = holdNextRead(f.backend), first = f.run.continue()
      await gate.waited
      await f.run.continue()
      gate.release()
      await first
      expect(continues(f.run.state)).toBe(1)
    } finally { f.run.dispose(); f.store.close() }
  })
  it('navigation disposal rejects a late admission callback without a token or Continue', async () => {
    const f = await fixture()
    const gate = holdNextRead(f.backend), work = f.run.continue()
    await gate.waited
    f.run.dispose()
    gate.release()
    await expect(work).rejects.toThrow()
    expect(f.run.canceled).toBe(true)
    expect(f.run.firstToken).toBeNull()
    expect(continues(f.run.state)).toBe(0)
    expect(f.boundary.active).toBe(false)
    expect(f.run.entry.admission).toBeNull()
    f.store.close()
  })
  it('timed-out read cannot later commit a stale presentation', async () => {
    const f = await fixture()
    try {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      const gate = holdNextRead(f.backend), work = f.run.continue()
      const outcome = work.then(() => ({ ok: true, error: '' }), error => ({ ok: false, error: String(error) }))
      await gate.waited
      await vi.advanceTimersByTimeAsync(5001)
      expect(await outcome).toMatchObject({ ok: false, error: expect.stringContaining('timed out') })
      gate.release()
      await Promise.resolve()
      expect(continues(f.run.state)).toBe(0)
      expect(f.run.firstToken).toBeNull()
      expect(f.run.protected).toBe(false)
      expect(f.boundary.active).toBe(false)
    } finally { f.run.dispose(); f.store.close() }
  })
  it('deleted source during the held read cannot be resumed', async () => {
    const f = await fixture()
    try {
      const gate = holdNextRead(f.backend), work = f.run.continue()
      await gate.waited
      await f.store.deleteAttempt(f.run.arm.sessionId)
      gate.release()
      await expect(work).rejects.toThrow()
      expect(continues(f.run.state)).toBe(0)
      expect(f.run.protected).toBe(false)
      expect(f.run.firstToken).toBeNull()
      expect(f.backend.root.attempts[f.run.arm.sessionId]).toBeUndefined()
    } finally { f.run.dispose(); f.store.close() }
  })
  it('installation replacement during the held read cannot be resumed', async () => {
    const f = await fixture()
    try {
      const gate = holdNextRead(f.backend), work = f.run.continue()
      await gate.waited
      const old = f.backend.root.installationId
      await f.store.deleteAll()
      gate.release()
      await expect(work).rejects.toThrow()
      expect(f.backend.root.installationId).not.toBe(old)
      expect(continues(f.run.state)).toBe(0)
      expect(f.run.firstToken).toBeNull()
    } finally { f.run.dispose(); f.store.close() }
  })
  it('postcommit scheduling failure records an existing technical invalidation, not a rollback', async () => {
    const f = await fixture()
    try {
      f.run.schedule = () => { throw Error('controlled scheduling failure') }
      await expect(f.run.continue()).rejects.toThrow('controlled scheduling failure')
      expect(continues(f.run.state)).toBe(1)
      expect(f.run.state.phase).toBe('invalid')
      expect(f.run.state.invalidReason).toBe('technical')
      expect(f.run.state.events.some(event => event.type === 'invalidated')).toBe(true)
      await vi.waitFor(async () => {
        const retained = await f.store.loadArmed(f.run.arm.sessionId)
        expect(retained?.snapshot?.kind).toBe('terminal')
        expect(retained?.snapshot?.review.invalidReason).toBe('technical')
      })
      console.log('POSTCOMMIT_TECHNICAL '+JSON.stringify({ phase: f.run.state.phase,
        reason: f.run.state.invalidReason, continueCommands: continues(f.run.state) }))
    } finally { f.run.dispose(); f.store.close() }
  })
})
