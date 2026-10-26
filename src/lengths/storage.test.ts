import { beforeEach, describe, expect, it } from 'vitest'
import { advance, verifyHeadless } from './engine'
import type { State } from './engine'
import { LengthsStore, freshLengthsRoot, inspectLengthsRoot } from './storage'
import type { LengthsBackend, LengthsRoot, StartRequest } from './storage'

const copy = <T,>(value: T): T => structuredClone(value)
const standard = { kind: 'keyboard', variant: 'standard', deviceClass: 'desktop',
  leftCode: 'ArrowLeft', rightCode: 'ArrowRight', alternative: false,
  contrast: 'dark_on_light', magnification: 'none', reducedMotion: false } as const
const accommodation = { ...standard, variant: 'visual_accommodation' } as const
const displayContext = { layoutWidthCssPx: 1512, layoutHeightCssPx: 900,
  visualWidthCssPx: 1512, visualHeightCssPx: 900, taskHostWidthCssPx: 650,
  devicePixelRatio: 2, browserFamily: 'chromium', visibility: 'visible', focused: true } as const
const request = (number: number, variant: 'standard' | 'visual_accommodation' = 'standard'): StartRequest => ({
  requestId: `request-${number}`, sessionId: `session-${number}`,
  clockDomainId: `clock-${number}`, atMs: 100 + number,
  wallMs: 1_000 + number, variant, profile: variant === 'standard' ? standard : accommodation,
  route: 'standalone', displayContext,
})
class MemoryBackend implements LengthsBackend {
  root = freshLengthsRoot()
  queue: Promise<unknown> = Promise.resolve()
  loseDelivery = false
  async read() { await this.queue; return copy(this.root) }
  change<T>(operation: (root: LengthsRoot) => T): Promise<T> {
    const pending = this.queue.then(() => {
      const candidate = copy(this.root)
      const value = operation(candidate)
      this.root = candidate
      if (this.loseDelivery) throw Error('Lost delivery after commit')
      return value
    })
    this.queue = pending.catch(() => undefined)
    return pending
  }
}
class SerialLocks {
  private queue = new Map<string, Promise<unknown>>()
  request<T>(name: string, _options: object, callback: (lock: object) => Promise<T>): Promise<T> {
    const prior = this.queue.get(name) ?? Promise.resolve()
    const next = prior.then(() => callback({}))
    this.queue.set(name, next.catch(() => undefined))
    return next
  }
}
beforeEach(() => Object.defineProperty(navigator, 'locks', {
  configurable: true, value: new SerialLocks(),
}))
function firstBreak(armed: State): State {
  let state = advance(armed, { kind: 'start', atMs: armed.armedAtMs + 100, responseHeld: false })
  for (let index = 0; index < 24; index++) {
    state = advance(state, { kind: 'fixation', atMs: state.fixationDueMs! })
    state = advance(state, { kind: 'onset', atMs: state.stimulusDueMs! })
    state = advance(state, { kind: 'resolve', atMs: state.resolutionDueMs! })
    state = advance(state, { kind: 'offset', atMs: state.resolutionDueMs! })
  }
  return state
}

describe('Lengths durable root foundation', () => {
  it('rotates family counters independently and keeps deleted ordinals consumed', async () => {
    const backend = new MemoryBackend(), store = new LengthsStore(backend, backend.root.installationId)
    const first = await store.start(request(1))
    expect(first.armDisplayContext).toEqual(displayContext)
    const visual = await store.start(request(2, 'visual_accommodation'))
    const second = await store.start(request(3))
    expect([first.state.form.id, visual.state.form.id, second.state.form.id]).toEqual(['LS1', 'LA1', 'LS2'])
    expect(backend.root.counters).toEqual({ standard: 2, visual_accommodation: 1 })
    await store.deleteAttempt(first.sessionId)
    expect(backend.root.tombstones[first.sessionId]).toMatchObject({ requestId: first.requestId,
      variant: 'standard', ordinal: 1 })
    await expect(store.start({ ...request(1), sessionId: 'replacement-session' }))
      .rejects.toThrow('start request was deleted')
    expect((await store.start(request(4))).state.form.id).toBe('LS3')
    await inspectLengthsRoot(await backend.read())
  })

  it('settles lost arm delivery by exact same-request readback', async () => {
    const backend = new MemoryBackend(), store = new LengthsStore(backend, backend.root.installationId)
    backend.loseDelivery = true
    const first = await store.start(request(1))
    backend.loseDelivery = false
    expect(await store.start(request(1))).toEqual(first)
    await expect(store.start({ ...request(1), displayContext: { ...displayContext,
      visualWidthCssPx: 1100 } })).rejects.toThrow('start display context changed')
    expect(backend.root.counters.standard).toBe(1)
    expect(verifyHeadless(first.state)).toBe(true)
  })

  it('persists a reconciled checkpoint and rejects a deleted late snapshot', async () => {
    const backend = new MemoryBackend(), store = new LengthsStore(backend, backend.root.installationId)
    const arm = await store.start(request(1))
    const state = firstBreak(arm.state)
    expect(state.phase).toBe('break')
    const snapshot = await store.saveSnapshot(arm, state, 0)
    expect(snapshot.closedTrials).toBe(24)
    expect(snapshot.review.status).toBe('incomplete_headless')
    await store.deleteAttempt(arm.sessionId)
    await expect(store.saveSnapshot(arm, state, snapshot.revision)).rejects.toThrow()
    expect(backend.root.attempts[arm.sessionId]).toBeUndefined()
    await inspectLengthsRoot(await backend.read())
  })

  it('confirms a committed terminal despite lost delivery and preserves timed bytes through view retry', async () => {
    const backend = new MemoryBackend(), store = new LengthsStore(backend, backend.root.installationId)
    const arm = await store.start(request(1))
    const breakState = firstBreak(arm.state)
    const terminal = advance(breakState, { kind: 'invalidate',
      atMs: breakState.commands.at(-1)!.atMs + 1, reason: 'settings' })
    expect(terminal.phase).toBe('invalid')
    backend.loseDelivery = true
    const snapshot = await store.saveSnapshot(arm, terminal, 0)
    backend.loseDelivery = false
    expect(snapshot.kind).toBe('terminal')
    const timedBytes = JSON.stringify(snapshot.state.events)
    const handle = store.authority.handle(arm, terminal)
    expect(await store.appendReportView(arm.sessionId, snapshot, 'view-1', 'live', 2_000, handle))
      .toMatchObject({ sequenceNumber: 1, viewId: 'view-1' })
    expect(await store.appendReportView(arm.sessionId, snapshot, 'view-1', 'live', 2_000, handle))
      .toMatchObject({ sequenceNumber: 1, viewId: 'view-1' })
    expect((await store.loadReportViews(arm.sessionId, handle)).events).toHaveLength(1)
    expect(JSON.stringify((await store.loadSnapshot(arm.sessionId))!.state.events)).toBe(timedBytes)
    await inspectLengthsRoot(await backend.read())
  })

  it('replaces the installation and fences old results and activity after Delete all', async () => {
    const backend = new MemoryBackend(), oldStore = new LengthsStore(backend, backend.root.installationId)
    const arm = await oldStore.start(request(1))
    const terminal = advance(firstBreak(arm.state), { kind: 'invalidate',
      atMs: firstBreak(arm.state).commands.at(-1)!.atMs + 1, reason: 'settings' })
    const snapshot = await oldStore.saveSnapshot(arm, terminal, 0)
    const handle = oldStore.authority.handle(arm, terminal)
    await oldStore.appendReportView(arm.sessionId, snapshot, 'view-1', 'live', 2_000, handle)
    const replacement = await oldStore.deleteAll()
    expect(replacement.installationId).not.toBe(oldStore.installationId)
    expect(backend.root).toMatchObject({ counters: { standard: 0, visual_accommodation: 0 },
      attempts: {}, tombstones: {}, activity: {} })
    await expect(oldStore.appendReportView(arm.sessionId, snapshot,
      'view-2', 'history', 2_001, handle)).rejects.toThrow()
    await expect(oldStore.saveSnapshot(arm, terminal, snapshot.revision)).rejects.toThrow()
    expect((await replacement.start(request(2))).state.form.id).toBe('LS1')
    await inspectLengthsRoot(await backend.read())
  })
})
