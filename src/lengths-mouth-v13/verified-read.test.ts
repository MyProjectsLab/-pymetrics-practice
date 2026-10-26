import { describe, expect, it, vi } from 'vitest'
import { advance, requiredDue } from './engine'
import { MOUTH_PRESENTATION_VERSION } from './engine'
import { MouthEntry } from './entry'
import { isVerifiedMouthForm, loadMouthForms, MOUTH_CANONICAL_SHA256 } from './manifests'
import { MOUTH_ACTIVITY_VERSION, MOUTH_FORM_VERSION, MOUTH_STORAGE_VERSION } from './contracts'
import { freshMouthRoot, inspectMouthRoot, MouthStore } from './storage'
import type { MouthBackend, MouthRoot, StartRequest } from './storage'
import * as report from './report'

const profile = { kind: 'keyboard', variant: 'standard', deviceClass: 'test', leftCode: 'ArrowLeft', rightCode: 'ArrowRight', alternative: false, contrast: 'dark_on_light', magnification: 'none', reducedMotion: false, presentationVersion: MOUTH_PRESENTATION_VERSION } as const
const displayContext = { layoutWidthCssPx: 1200, layoutHeightCssPx: 900, visualWidthCssPx: 1200, visualHeightCssPx: 900, taskHostWidthCssPx: 500, devicePixelRatio: 1, browserFamily: 'chromium', visibility: 'visible', focused: true } as const
const request = (id: string): StartRequest => ({ requestId: id, sessionId: id, clockDomainId: id, profile, variant: 'standard', route: 'standalone', atMs: 0, wallMs: 1, displayContext })
class Backend implements MouthBackend {
  root = freshMouthRoot()
  override: MouthRoot | null = null
  async read() { return structuredClone(this.override ?? this.root) }
  async change<T>(op: (root: MouthRoot) => T) { const next = structuredClone(this.root), result = op(next); this.root = next; return result }
}
class Locks { request<T>(_name: string, _options: object, fn: (lock: object) => Promise<T>) { return fn({}) } }
Object.defineProperty(navigator, 'locks', { configurable: true, value: new Locks() })

async function checkpoint() {
  const backend = new Backend(), store = new MouthStore(backend, backend.root.installationId)
  const arm = await store.start(request(crypto.randomUUID()))
  let state = advance(arm.state, { kind: 'start', atMs: 0, responseHeld: false })
  for (let trial = 0; trial < 30; trial++)
    for (const kind of ['fixation', 'onset', 'remove', 'resolve', 'feedback', 'offset'] as const)
      state = advance(state, { kind, atMs: requiredDue(state)! })
  expect(state.phase).toBe('break')
  await store.saveSnapshot(arm, state, 0)
  return { backend, store, arm, state }
}

describe('private fully verified Lengths read', () => {
  it('returns the exact saved review with trusted canonical forms and immutable bytes', async () => {
    const { backend, store, arm } = await checkpoint()
    const loaded = await store.loadArmed(arm.sessionId)
    expect(loaded?.snapshot).toEqual(backend.root.attempts[arm.sessionId].snapshot)
    expect(isVerifiedMouthForm(loaded!.state.form)).toBe(true)
    expect(isVerifiedMouthForm(loaded!.snapshot!.state.form)).toBe(true)
    expect(Object.isFrozen(loaded?.snapshot?.state.events)).toBe(true)
  })
  it('rejects corrupt arm, command, event, report, and unsupported form on every fresh read', async () => {
    const { backend, store, arm } = await checkpoint()
    const mutations = [
      (root: MouthRoot) => { (root.attempts[arm.sessionId].state.events[0] as { atMs: number }).atMs = 1 },
      (root: MouthRoot) => { (root.attempts[arm.sessionId].snapshot!.state.commands[0] as { atMs: number }).atMs = 1 },
      (root: MouthRoot) => { (root.attempts[arm.sessionId].snapshot!.state.events[0] as { atMs: number }).atMs = 1 },
      (root: MouthRoot) => { (root.attempts[arm.sessionId].snapshot!.review as unknown as { status: string }).status = 'tampered' },
      (root: MouthRoot) => { (root.attempts[arm.sessionId].state.form as { id: string }).id = 'unsupported' }
    ]
    for (const mutate of mutations) {
      backend.override = structuredClone(backend.root); mutate(backend.override)
      await expect(store.loadArmed(arm.sessionId)).rejects.toThrow()
    }
    backend.override = null
    expect(await store.loadArmed(arm.sessionId)).not.toBeNull()
  })
  it('does not trust a newer bad authority value selected over the fresh native root', async () => {
    const backend = new Backend(), store = new MouthStore(backend, backend.root.installationId)
    const arm = await store.start(request('newer'))
    const newer = structuredClone(backend.root)
    newer.revision++
    ;(newer.attempts[arm.sessionId] as { snapshot?: unknown }).snapshot = { revision: 1, kind: 'checkpoint', closedTrials: 0,
      state: arm.state, review: {} as never }
    store.authority.observe(newer, store.authority.provenance('read'))
    await expect(store.loadArmed(arm.sessionId)).rejects.toThrow()
  })
  it('rejects an authority value whose extra undefined field is hidden by JSON equality', async () => {
    const backend = new Backend(), store = new MouthStore(backend, backend.root.installationId)
    const arm = await store.start(request('alias'))
    const ambiguous = structuredClone(backend.root)
    ;(ambiguous.attempts[arm.sessionId] as { extra?: undefined }).extra = undefined
    const observe = store.authority.observe.bind(store.authority)
    const spy = vi.spyOn(store.authority, 'observe').mockImplementation((root, provenance) => {
      observe(root, provenance)
      observe(ambiguous, store.authority.provenance('read'))
    })
    await expect(store.loadArmed(arm.sessionId)).rejects.toThrow('invalid arm identity')
    expect(Object.hasOwn(store.authority.latest()!.attempts[arm.sessionId], 'extra')).toBe(true)
    spy.mockRestore()
  })
  it('keeps deletion and replacement authoritative', async () => {
    const backend = new Backend(), store = new MouthStore(backend, backend.root.installationId)
    const arm = await store.start(request('deleted'))
    await store.deleteAttempt(arm.sessionId)
    expect(await store.loadArmed(arm.sessionId)).toBeNull()
    const replacement = freshMouthRoot()
    backend.override = replacement
    await expect(store.loadArmed(arm.sessionId)).rejects.toThrow()
  })
  it('fully checks newer harmless activity while preserving the arm', async () => {
    const backend = new Backend(), store = new MouthStore(backend, backend.root.installationId)
    const arm = await store.start(request('activity'))
    const newer = structuredClone(backend.root)
    newer.revision++
    newer.activity![arm.sessionId] = { version: MOUTH_ACTIVITY_VERSION,
      installationId: newer.installationId, sessionId: arm.sessionId, resultRevision: 0,
      events: [{ version: MOUTH_ACTIVITY_VERSION, type: 'report_viewed', sequenceNumber: 1,
        installationId: newer.installationId, sessionId: arm.sessionId, viewId: 'one',
        sourceSurface: 'live', observedWallMs: 1, resultRevision: 0 }] }
    store.authority.observe(newer, store.authority.provenance('read'))
    const loaded = await store.loadArmed(arm.sessionId)
    expect(loaded?.requestId).toBe(arm.requestId)
    expect(isVerifiedMouthForm(loaded!.state.form)).toBe(true)
    expect(store.authority.latest()?.revision).toBe(newer.revision)
  })
  it('does not publish from a blocked same-revision conflict', async () => {
    const backend = new Backend(), store = new MouthStore(backend, backend.root.installationId)
    const arm = await store.start(request('conflict'))
    const conflicting = structuredClone(backend.root)
    ;(conflicting.attempts[arm.sessionId] as { createdAtWallMs: number }).createdAtWallMs++
    expect(() => store.authority.observe(conflicting, store.authority.provenance('read'))).toThrow()
    await expect(store.loadArmed(arm.sessionId)).rejects.toThrow()
  })
  it('cancels a held native read without returning its stale result', async () => {
    const backend = new Backend(), store = new MouthStore(backend, backend.root.installationId)
    const arm = await store.start(request('held'))
    let release!: () => void
    const held = new Promise<void>(resolve => { release = resolve })
    const original = backend.read.bind(backend)
    backend.read = async () => { await held; return original() }
    const controller = new AbortController(), pending = store.loadArmed(arm.sessionId, controller.signal)
    controller.abort(); release()
    await expect(pending).rejects.toThrow()
  })
  it('keeps original owner reclaim, checkpoint Continue, and history source reads', async () => {
    vi.spyOn(document, 'hasFocus').mockReturnValue(true)
    const { store, arm, state } = await checkpoint()
    const entry = new MouthEntry(store)
    await entry.reclaim(arm)
    await entry.checkCurrentArm(arm)
    const target = entry.authority(arm, state, 1)
    const snapshot = await entry.currentCheckpoint(arm, target)
    expect(snapshot?.kind).toBe('checkpoint')
    let presented = false
    await entry.admitContinue(arm, target, token => {
      presented = true
      entry.confirmFirstPresentation(arm, token, state.trialIndex)
    })
    expect(presented).toBe(true)
    const history = await store.listAttempts()
    expect(history.some(item => item.sessionId === arm.sessionId)).toBe(true)
    entry.release()
    vi.restoreAllMocks()
  })
  it('keeps original begin and first presentation admission', async () => {
    vi.spyOn(document, 'hasFocus').mockReturnValue(true)
    const backend = new Backend(), store = new MouthStore(backend, backend.root.installationId)
    const entry = new MouthEntry(store), arm = await entry.begin(request('begin'))
    let presented = false
    await entry.admitStart(arm, token => {
      presented = true
      entry.confirmFirstPresentation(arm, token, 1)
    })
    expect(presented).toBe(true)
    expect((await store.loadArmed(arm.sessionId))?.requestId).toBe(arm.requestId)
    entry.release()
    vi.restoreAllMocks()
  })
  it('warms one private proof through existing Start and checkpoint readbacks', async () => {
    const replay = vi.spyOn(report, 'reconcileHeadless')
    const backend = new Backend(), store = new MouthStore(backend, backend.root.installationId)
    const arm = await store.start(request('warm'))
    expect(replay).not.toHaveBeenCalled()
    let state = advance(arm.state, { kind: 'start', atMs: 0, responseHeld: false })
    for (let trial = 0; trial < 30; trial++)
      for (const kind of ['fixation', 'onset', 'remove', 'resolve', 'feedback', 'offset'] as const)
        state = advance(state, { kind, atMs: requiredDue(state)! })
    await store.saveSnapshot(arm, state, 0)
    const afterSave = replay.mock.calls.length
    expect(afterSave).toBeGreaterThan(0)
    expect((await store.loadArmed(arm.sessionId))?.snapshot?.kind).toBe('checkpoint')
    expect(replay.mock.calls.length).toBe(afterSave)
    store.close()
    expect((await store.loadArmed(arm.sessionId))?.snapshot?.kind).toBe('checkpoint')
    expect(replay.mock.calls.length).toBeGreaterThan(afterSave)
    replay.mockRestore()
  })
  it('fully checks a changed current snapshot despite an unchanged historical snapshot', async () => {
    const { backend, store, arm: historical } = await checkpoint()
    const current = await store.start(request('current-checkpoint'))
    let state = advance(current.state, { kind: 'start', atMs: 0, responseHeld: false })
    for (let trial = 0; trial < 30; trial++)
      for (const kind of ['fixation', 'onset', 'remove', 'resolve', 'feedback', 'offset'] as const)
        state = advance(state, { kind, atMs: requiredDue(state)! })
    await store.saveSnapshot(current, state, 0)
    expect((await store.loadArmed(historical.sessionId))?.snapshot?.kind).toBe('checkpoint')
    backend.override = structuredClone(backend.root)
    ;(backend.override.attempts[current.sessionId].snapshot!.review as unknown as { status: string }).status = 'tampered'
    await expect(store.loadArmed(historical.sessionId)).rejects.toThrow('unreconciled snapshot')
  })
  it('does not let a public canonical Map change the private form context', async () => {
    const { store, arm } = await checkpoint()
    const publicForms = await loadMouthForms() as Map<string, typeof arm.state.form>
    const original = publicForms.get(arm.state.form.id)!
    const other = [...publicForms.values()].find(form => form.id !== original.id)!
    try {
      publicForms.set(original.id, other)
      await expect(store.loadArmed(arm.sessionId)).rejects.toThrow()
    } finally {
      publicForms.set(original.id, original)
    }
    expect((await store.loadArmed(arm.sessionId))?.requestId).toBe(arm.requestId)
  })
  it('rejects same/new revision corrupt reports despite an assigned lookalike proof field', async () => {
    for (const newer of [false, true]) {
      const { backend, store, arm } = await checkpoint()
      const forged = structuredClone(backend.root)
      if (newer) {
        forged.revision++
        ;(forged.attempts[arm.sessionId].snapshot as { revision: number }).revision++
      }
      ;(forged.attempts[arm.sessionId].snapshot!.review as unknown as { status: string }).status = 'tampered'
      await expect(inspectMouthRoot(forged)).rejects.toThrow('unreconciled snapshot')
      const forms = await loadMouthForms()
      ;(store as unknown as { priorVerified: unknown }).priorVerified = {
        root: forged, entries: [...forms.entries()], installationId: backend.root.installationId,
        verifier: 'lengths-mouth-v13-exact-content-1', storageVersion: MOUTH_STORAGE_VERSION,
        formVersion: MOUTH_FORM_VERSION, packetSha: MOUTH_CANONICAL_SHA256
      }
      backend.override = forged
      await expect(store.loadArmed(arm.sessionId)).rejects.toThrow('unreconciled snapshot')
    }
  })
  it('ignores assigned lookalike trusted-read helpers', async () => {
    const { backend, store, arm } = await checkpoint()
    const forged = structuredClone(backend.root)
    forged.revision++
    ;(forged.attempts[arm.sessionId].snapshot as { revision: number }).revision++
    ;(forged.attempts[arm.sessionId].snapshot!.review as unknown as { status: string }).status = 'tampered'
    const forms = await loadMouthForms()
    const assignable = store as unknown as {
      checkedRead: () => Promise<{ root: MouthRoot; forms: typeof forms }>
      checkedRoot: () => Promise<MouthRoot>
    }
    assignable.checkedRead = async () => ({ root: forged, forms })
    assignable.checkedRoot = async () => forged
    backend.override = forged
    await expect(store.loadArmed(arm.sessionId)).rejects.toThrow('unreconciled snapshot')
    await expect(store.read()).rejects.toThrow('unreconciled snapshot')
  })
  it('misses the proof on key order, enumerability, array holes, and cycles', async () => {
    const { backend, store, arm } = await checkpoint()
    const change = [
      (root: MouthRoot) => {
        const snap = root.attempts[arm.sessionId].snapshot!
        ;(snap as { review: unknown }).review = Object.fromEntries(Object.entries(snap.review).reverse())
      },
      (root: MouthRoot) => {
        const review = root.attempts[arm.sessionId].snapshot!.review as unknown as Record<string, unknown>
        Object.defineProperty(review, Object.keys(review)[0], { enumerable: false })
      },
      (root: MouthRoot) => { delete (root.attempts[arm.sessionId].snapshot!.state.commands as unknown[])[1] },
      (root: MouthRoot) => { (root.attempts[arm.sessionId] as { cycle?: unknown }).cycle = root.attempts[arm.sessionId] }
    ]
    for (const mutate of change) {
      backend.override = structuredClone(backend.root); mutate(backend.override)
      await expect(store.loadArmed(arm.sessionId)).rejects.toThrow()
    }
    backend.override = null
    expect(await store.loadArmed(arm.sessionId)).not.toBeNull()
  })
  it('accepts repeated aliases by value without treating alias identity as proof', async () => {
    const { backend, store, arm } = await checkpoint()
    backend.override = structuredClone(backend.root)
    ;(backend.override.attempts[arm.sessionId] as { profile: unknown }).profile =
      backend.override.attempts[arm.sessionId].snapshot!.state.profile
    expect((await store.loadArmed(arm.sessionId))?.snapshot?.kind).toBe('checkpoint')
  })
  it('does not repopulate a closed store proof after a held read finishes', async () => {
    const { backend, store, arm } = await checkpoint()
    const replay = vi.spyOn(report, 'reconcileHeadless')
    let release!: () => void
    const held = new Promise<void>(resolve => { release = resolve })
    const original = backend.read.bind(backend)
    backend.read = async () => { await held; return original() }
    const pending = store.loadArmed(arm.sessionId)
    store.close()
    ;(store as unknown as { closed: boolean }).closed = false
    release()
    await pending
    const afterHeld = replay.mock.calls.length
    expect(afterHeld).toBeGreaterThan(0)
    expect((await store.loadArmed(arm.sessionId))?.snapshot?.kind).toBe('checkpoint')
    expect(replay.mock.calls.length).toBeGreaterThan(afterHeld)
    replay.mockRestore()
  })
})
