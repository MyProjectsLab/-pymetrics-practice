import { describe, expect, it, vi } from 'vitest'
import { advance, MOUTH_PRESENTATION_VERSION, requiredDue } from './engine'
import type { State } from './engine'
import { freshMouthRoot, MouthStore } from './storage'
import type { MouthBackend, MouthRoot, StartRequest } from './storage'
import { reconcileHeadless } from './report'

const profile = { kind: 'keyboard', variant: 'standard', deviceClass: 'test', leftCode: 'ArrowLeft', rightCode: 'ArrowRight', alternative: false, contrast: 'dark_on_light', magnification: 'none', reducedMotion: false, presentationVersion: MOUTH_PRESENTATION_VERSION } as const
const displayContext = { layoutWidthCssPx: 1200, layoutHeightCssPx: 900, visualWidthCssPx: 1200, visualHeightCssPx: 900, taskHostWidthCssPx: 500, devicePixelRatio: 1, browserFamily: 'chromium', visibility: 'visible', focused: true } as const
const request = (id: string): StartRequest => ({ requestId: id, sessionId: id, clockDomainId: id, profile, variant: 'standard', route: 'standalone', atMs: 0, wallMs: 1, displayContext })
class Backend implements MouthBackend {
  root = freshMouthRoot()
  failAfterCommit = false
  mutateNextPreimage: ((root: MouthRoot) => void) | null = null
  async read() { return structuredClone(this.root) }
  async change<T>(op: (root: MouthRoot) => T) {
    const next = structuredClone(this.root)
    const mutate = this.mutateNextPreimage; this.mutateNextPreimage = null; mutate?.(next)
    const result = op(next)
    this.root = next
    if (this.failAfterCommit) { this.failAfterCommit = false; throw Error('delivery lost after commit') }
    return result
  }
}
class Locks { request<T>(_name: string, _options: object, fn: (lock: object) => Promise<T>) { return fn({}) } }
Object.defineProperty(navigator, 'locks', { configurable: true, value: new Locks() })
function thirty(prior: State): State {
  let state = advance(prior, { kind: prior.phase === 'armed' ? 'start' : 'continue', atMs: prior.commands.at(-1)?.atMs ?? 0, responseHeld: false })
  for (let trial = 0; trial < 30; trial++)
    for (const kind of ['fixation', 'onset', 'remove', 'resolve', 'feedback', 'offset'] as const)
      state = advance(state, { kind, atMs: requiredDue(state)! })
  return state
}
async function twoCheckpoints() {
  const backend = new Backend(), store = new MouthStore(backend, backend.root.installationId)
  const arm = await store.start(request(crypto.randomUUID()))
  const thirtyState = thirty(arm.state)
  const first = await store.saveSnapshot(arm, thirtyState, 0)
  const sixtyState = thirty(thirtyState)
  const second = await store.saveSnapshot(arm, sixtyState, 1)
  return { backend, store, arm, first, second, state: thirty(sixtyState) }
}

describe('terminal save retains native source authority', () => {
  it('confirms a 90-trial terminal after two checkpoints, saves a report view once, and reopens history', async () => {
    const { backend, store, arm, state } = await twoCheckpoints()
    expect(state.phase).toBe('completed')
    const terminal = await store.saveSnapshot(arm, state, 2)
    expect(terminal.kind).toBe('terminal')
    expect(terminal.closedTrials).toBe(90)
    expect(terminal.review.status).toBe('complete_headless')
    const handle = store.authority.handle(arm, state)
    const first = await store.appendReportView(arm.sessionId, terminal, 'view-one', 'live', 100, handle)
    const revision = backend.root.revision
    const retry = await store.appendReportView(arm.sessionId, terminal, 'view-one', 'live', 100, handle)
    expect(retry).toEqual(first)
    expect(backend.root.revision).toBe(revision)
    const reopened = new MouthStore(backend, backend.root.installationId)
    const history = await reopened.listAttempts()
    expect(history.find(item => item.sessionId === arm.sessionId)?.snapshot?.closedTrials).toBe(90)
    expect(history.find(item => item.sessionId === arm.sessionId)?.snapshot?.review.status).toBe('complete_headless')
  })
  it('confirms the exact terminal after a committed write whose delivery fails', async () => {
    const { backend, store, arm, state } = await twoCheckpoints()
    backend.failAfterCommit = true
    const terminal = await store.saveSnapshot(arm, state, 2)
    expect(terminal.kind).toBe('terminal')
    expect(terminal.closedTrials).toBe(90)
    const revision = backend.root.revision
    expect((await store.saveSnapshot(arm, state, 2)).revision).toBe(3)
    expect(backend.root.revision).toBe(revision)
  })
  it('does not grant authority from an uncommitted or corrupt historical journal', async () => {
    const { backend, store, arm, state } = await twoCheckpoints()
    const original = structuredClone(backend.root)
    backend.root = structuredClone(backend.root)
    ;(backend.root.attempts[arm.sessionId].snapshot!.review as unknown as { status: string }).status = 'tampered'
    await expect(store.saveSnapshot(arm, state, 2)).rejects.toThrow()
    expect(backend.root.revision).toBe(original.revision)
    backend.root = original
    const terminal = await store.saveSnapshot(arm, state, 2)
    expect(terminal.closedTrials).toBe(90)
  })
  it('rejects a precommit abort and an altered incoming journal without changing the checkpoint', async () => {
    const { backend, store, arm, state } = await twoCheckpoints()
    const revision = backend.root.revision
    const controller = new AbortController()
    controller.abort()
    await expect(store.saveSnapshot(arm, state, 2, controller.signal)).rejects.toThrow()
    expect(backend.root.revision).toBe(revision)
    const changed = structuredClone(state)
    ;(changed.commands[0] as { atMs: number }).atMs = 1
    await expect(store.saveSnapshot(arm, changed, 2)).rejects.toThrow()
    expect(backend.root.revision).toBe(revision)
    expect((await store.loadArmed(arm.sessionId))?.snapshot?.closedTrials).toBe(60)
  })
  it('ignores a forged old preimage helper and rejects corrupt history before snapshot put', async () => {
    const { backend, store, arm: historical } = await twoCheckpoints()
    const current = await store.start(request(crypto.randomUUID()))
    const first = thirty(current.state)
    await store.saveSnapshot(current, first, 0)
    const next = thirty(first)
    const before = structuredClone(backend.root)
    const forged = structuredClone(before)
    const corrupt = (root: MouthRoot) => {
      ;(root.attempts[historical.sessionId].snapshot!.review as unknown as { status: string }).status = 'tampered'
    }
    corrupt(forged)
    ;(store as unknown as { transactionRoot: () => MouthRoot }).transactionRoot = () => forged
    backend.mutateNextPreimage = corrupt
    await expect(store.saveSnapshot(current, next, 1)).rejects.toThrow('unreconciled snapshot')
    expect(backend.root.revision).toBe(before.revision)
    expect(backend.root).toEqual(before)
    const saved = await store.saveSnapshot(current, next, 1)
    expect(saved.kind).toBe('checkpoint')
    expect(saved.closedTrials).toBe(60)
  })
  it('ignores the same forged helper during report activity and preserves its valid neighbor', async () => {
    const { backend, store, arm: historical } = await twoCheckpoints()
    const current = await store.start(request(crypto.randomUUID()))
    const first = thirty(current.state)
    await store.saveSnapshot(current, first, 0)
    const second = thirty(first)
    await store.saveSnapshot(current, second, 1)
    const state = thirty(second)
    const terminal = await store.saveSnapshot(current, state, 2)
    const handle = store.authority.handle(current, state)
    const before = structuredClone(backend.root)
    const forged = structuredClone(before)
    const corrupt = (root: MouthRoot) => {
      ;(root.attempts[historical.sessionId].snapshot!.review as unknown as { status: string }).status = 'tampered'
    }
    corrupt(forged)
    ;(store as unknown as { transactionRoot: () => MouthRoot }).transactionRoot = () => forged
    backend.mutateNextPreimage = corrupt
    await expect(store.appendReportView(current.sessionId, terminal, 'view-forgery', 'live', 100, handle))
      .rejects.toThrow('unreconciled snapshot')
    expect(backend.root.revision).toBe(before.revision)
    expect(backend.root).toEqual(before)
    const event = await store.appendReportView(current.sessionId, terminal, 'view-forgery', 'live', 100, handle)
    expect(event.viewId).toBe('view-forgery')
    expect(backend.root.revision).toBe(before.revision + 1)
  })
  it('reconciles a genuine verified form before memoizing a detached copy', async () => {
    const { store, arm, state } = await twoCheckpoints()
    const trusted = (await store.loadArmed(arm.sessionId))!.state.form
    const live = { ...state, form: trusted }
    const review = reconcileHeadless(live)
    expect(review.status).toBe('complete_headless')
    expect(() => reconcileHeadless(structuredClone(live))).toThrow()
    expect(vi.isMockFunction(reconcileHeadless)).toBe(false)
  })
})
