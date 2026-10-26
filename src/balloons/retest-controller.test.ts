import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { webcrypto } from 'node:crypto'
import { BalloonsController } from './controller'
import { acquireOwner, BalloonsStore, WriteFailure } from './storage'
import type { Backend, Root } from './storage'
import { loadScoredManifests } from './manifests'
import { loadDrillManifests } from './drill-manifests'
import { eligibleRoot } from './retest-test-support'
import { RETEST_RESERVATION_MS } from './durable'
let frames: FrameRequestCallback[], root: Root, store: BalloonsStore, controller: BalloonsController, mounts: number, wall: number
beforeAll(async () => { Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true }); await loadScoredManifests(); await loadDrillManifests() })
beforeEach(() => {
  root = eligibleRoot(); frames = []; mounts = 0; wall = 2000000
  vi.spyOn(Date, 'now').mockImplementation(() => wall)
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { frames.push(cb); return frames.length })
  vi.stubGlobal('cancelAnimationFrame', () => {})
  Object.defineProperty(navigator, 'locks', { configurable: true, value: { request: (_n: string, _o: unknown, cb: (l: object) => unknown) => Promise.resolve(cb({})) } })
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
  const backend: Backend = { read: async () => structuredClone(root), change: async (fn, signal) => {
    if (signal?.aborted) throw new DOMException('Canceled', 'AbortError')
    const next = structuredClone(root), result = fn(next); next.revision++; root = structuredClone(next); return structuredClone(result)
  } }
  store = new BalloonsStore(backend, 'install')
  controller = new BalloonsController(store, () => {}, () => {
    mounts++; const element = document.createElement('div'); element.innerHTML = '<b data-balloon-type>Type 1</b><button data-control="pump">Pump</button><button data-control="collect">Collect</button>'; document.body.append(element)
    element.getBoundingClientRect = () => ({ width: 10, height: 10 }) as DOMRect
    return element
  })
})
afterEach(async () => { await controller.pause('navigation', true); controller.dispose(); vi.restoreAllMocks(); vi.unstubAllGlobals(); document.body.innerHTML = '' })
const current = () => Object.values(root.records).at(-1)!
async function framesReady() { await vi.waitFor(() => expect(mounts).toBe(1)); frames.shift()!(1); frames.shift()!(2) }
it('explanation reserves without mount; first click durably arms then requires both frames', async () => {
  await controller.explainRetest('base'); expect(mounts).toBe(0); expect(controller.view.mode).toBe('explanation')
  const start = controller.startRetest(); await vi.waitFor(() => expect(mounts).toBe(1))
  expect(current().snapshot.exposure).toBe('exposure_uncertain')
  frames.shift()!(1); expect(controller.view.mode).toBe('mounting')
  frames.shift()!(2); await start; expect(controller.view.mode).toBe('playing')
  expect(current().snapshot.confirmedRounds).toEqual([1])
})
it('pre-arm exit releases and every late frame is fenced', async () => {
  await controller.explainRetest('base'); await controller.pause('hidden', true)
  await controller.startRetest(); expect(mounts).toBe(0); expect(current().snapshot.exposure).toBe('released_unseen')
})
it('expiry on Start releases without scheduling any frame', async () => {
  await controller.explainRetest('base'); wall += RETEST_RESERVATION_MS
  await controller.startRetest(); expect(mounts).toBe(0); expect(current().snapshot.exposure).toBe('released_unseen')
  expect(controller.view.message).toContain('Reopen')
})
it('expiry between frame one and two consumes RT and withholds action controls', async () => {
  await controller.explainRetest('base'); const start = controller.startRetest()
  await vi.waitFor(() => expect(mounts).toBe(1)); frames.shift()!(1); wall += RETEST_RESERVATION_MS; frames.shift()!(2); await start
  expect(current().snapshot.exposure).toBe('form_exposed'); expect(current().snapshot.comparisonEligible).toBe(false)
  expect(controller.view.mode).toBe('paused')
  await controller.action('pump', 'mouse', 1, 0); expect(current().snapshot.core.nextActionId).toBe(1)
})
it('post-arm interruption keeps uncertainty; late frames never consume a replacement or make old form unseen', async () => {
  await controller.explainRetest('base'); const start = controller.startRetest()
  await vi.waitFor(() => expect(mounts).toBe(1)); await controller.pause('hidden'); await start
  frames.splice(0).forEach(f => f(2))
  expect(current().snapshot.exposure).toBe('exposure_uncertain'); expect(current().snapshot.comparisonEligible).toBe(false)
  expect(current().snapshot.confirmedRounds).toEqual([])
})
it('positively confirmed onset survives immediate interruption before exposure commit', async () => {
  await controller.explainRetest('base')
  const commit = store.commit.bind(store); let once = true, paused: Promise<void> | undefined
  vi.spyOn(store, 'commit').mockImplementation((...args) => {
    if (args[2].kind === 'confirm' && once) { once = false; paused = controller.pause('hidden'); return Promise.reject(new DOMException('Canceled', 'AbortError')) }
    return commit(...args)
  })
  const start = controller.startRetest(); await framesReady(); await start; await paused
  expect(current().snapshot.exposure).toBe('form_exposed'); expect(current().snapshot.confirmedRounds).toEqual([1])
  expect(controller.view.mode).toBe('paused')
})
it('failed exposure write retains consumed/uncertain evidence and no new-sequence eligibility', async () => {
  await controller.explainRetest('base'); const commit = store.commit.bind(store)
  vi.spyOn(store, 'commit').mockImplementation((...args) => args[2].kind === 'confirm' ? Promise.reject(new WriteFailure('abort')) : commit(...args))
  vi.spyOn(store, 'retainRetestOnset').mockRejectedValue(new WriteFailure('abort'))
  const start = controller.startRetest(); await framesReady(); await start
  expect(current().snapshot.exposure).toBe('exposure_uncertain'); expect(controller.view.mode).not.toBe('playing')
  vi.restoreAllMocks()
  store.bindOwner('new', await acquireOwner(new AbortController().signal))
  const recovered = await store.recover('new', current().header.identity.sessionId, { wallTimeMs: wall + 10, monotonicMs: 1, clockEpochId: 'new' })
  expect(recovered.record.snapshot.comparisonEligible).toBe(false)
})
it('deletion during held arming delivery prevents mount and late eligibility', async () => {
  await controller.explainRetest('base'); const commit = store.commit.bind(store); let deliver!: () => void
  vi.spyOn(store, 'commit').mockImplementation(async (...args) => { const value = await commit(...args); if (args[2].kind === 'arm') await new Promise<void>(r => { deliver = r }); return value })
  const start = controller.startRetest(); await vi.waitFor(() => expect(deliver).toBeDefined())
  await store.delete('base', wall); const before = structuredClone(root); deliver(); await start
  expect(mounts).toBe(0); expect(controller.view.mode).not.toBe('playing')
  expect(current().snapshot.exposure).toBe('exposure_uncertain')
  expect(root.records.base).toBeUndefined(); expect(root.training).toEqual(before.training)
})

async function confirmMount(count: number) {
  await vi.waitFor(() => expect(mounts).toBe(count), { interval: 1 })
  frames.shift()!(1); frames.shift()!(2)
}
async function action(kind: 'collect' | 'next') {
  const core = controller.view.record!.snapshot.core
  return controller.action(kind, 'keyboard', core.round, core.revision)
}
async function reachUnconfirmedRound(round: number) {
  await controller.explainRetest('base')
  let pending = controller.startRetest()
  for (let n = 1; n < round; n++) {
    await confirmMount(n); await pending; await action('collect'); pending = action('next')
  }
  await vi.waitFor(() => expect(mounts).toBe(round), { interval: 1 })
  return { pending }
}
for (const round of [1, 2, 39]) for (const boundary of ['before_frames', 'one_frame', 'confirmed_before_write', 'confirmed_saved'] as const) {
  it(`round ${round}: interruption ${boundary} preserves only actual presentation evidence and resumes same RT`, async () => {
    const { pending } = await reachUnconfirmedRound(round)
    const prefix = structuredClone(current()), id = prefix.header.identity.sessionId
    let paused: Promise<void> | undefined
    if (boundary === 'confirmed_before_write') {
      const commit = store.commit.bind(store); let once = true
      vi.spyOn(store, 'commit').mockImplementation((...args) => {
        if (args[2].kind === 'confirm' && once) { once = false; paused = controller.pause('hidden'); return Promise.reject(new DOMException('Canceled', 'AbortError')) }
        return commit(...args)
      })
      frames.shift()!(1); frames.shift()!(2); await pending; await paused
    } else {
      if (boundary !== 'before_frames') frames.shift()!(1)
      if (boundary === 'confirmed_saved') { frames.shift()!(2); await pending }
      await controller.pause('hidden'); await pending
    }
    const confirmed = boundary.startsWith('confirmed'), saved = structuredClone(current())
    expect(saved.snapshot.phase).toBe('paused')
    expect(saved.snapshot.confirmedRounds.includes(round)).toBe(confirmed)
    expect(saved.snapshot.comparisonEligible).toBe(round > 1 || confirmed)
    expect(saved.journal.slice(0, prefix.journal.length)).toEqual(prefix.journal)
    expect(saved.snapshot.core).toEqual(prefix.snapshot.core)
    frames.splice(0).forEach(f => f(3))
    expect(current()).toEqual(saved)
    const resume = controller.resume(id); await confirmMount(round + 1); await resume
    expect(current().header).toEqual(saved.header)
    expect(current().snapshot.comparisonEligible).toBe(round > 1 || confirmed)
    expect(current().snapshot.core).toEqual(saved.snapshot.core)
    expect(current().journal.slice(0, saved.journal.length)).toEqual(saved.journal)
    expect(current().snapshot.confirmedRounds).toEqual(Array.from({ length: round }, (_, n) => n + 1))
    if (round === 39 && confirmed) {
      await action('collect')
      expect(current().snapshot.phase).toBe('completed')
      expect(root.training!.chains.chain.completedRetestSessionId).toBe(id)
      expect(current().journal.filter(e => e.type === 'retest_completed')).toHaveLength(1)
    }
  }, 30000)
}
for (const round of [1, 2, 39]) for (const confirmed of [false, true]) {
  it(`round ${round}: failed pause write after confirmed=${confirmed} cannot grant recovery eligibility`, async () => {
    const { pending } = await reachUnconfirmedRound(round)
    if (confirmed) { frames.shift()!(1); frames.shift()!(2); await pending }
    const before = structuredClone(current()), commit = store.commit.bind(store)
    vi.spyOn(store, 'commit').mockImplementation((...args) => args[2].kind === 'pause' ? Promise.reject(new WriteFailure('pause aborted')) : commit(...args))
    await controller.pause('hidden'); await pending
    frames.splice(0).forEach(f => f(3)); expect(current()).toEqual(before)
    expect(controller.view.mode).toBe('write_failed')
    vi.mocked(store.commit).mockRestore()
    // Journey replacement disposes the old controller, attempting another pause.
    await controller.pause('navigation', true)
    expect(current().snapshot.comparisonEligible).toBe(false)
    expect(current().journal.at(-1)!.command).toEqual({ kind: 'pause', reason: 'write_failed' })
    const resumed = controller.resume(before.header.identity.sessionId)
    await confirmMount(round + 1); await resumed
    expect(current().snapshot.comparisonEligible).toBe(false)
    expect(current().header).toEqual(before.header)
    expect(current().snapshot.core).toEqual(before.snapshot.core)
  }, 30000)
}

for (const mode of ['practice', 'retest'] as const) for (const boundary of ['before_acquisition', 'after_acquisition', 'after_reservation', 'after_arming'] as const) {
  it(`${mode}: exit ${boundary} releases browser ownership and fences late work`, async () => {
    let locked = false, deliver: (() => void) | undefined
    Object.defineProperty(navigator, 'locks', { configurable: true, value: { request: (name: string, _options: unknown, cb: (lock: object) => unknown) => {
      const owner = name.endsWith(':owner')
      const run = async () => { if (owner) locked = true; try { return await cb({}) } finally { if (owner) locked = false } }
      if ((owner && boundary === 'before_acquisition') || (!owner && boundary === 'after_acquisition' && !deliver)) {
        return new Promise((resolve, reject) => { deliver = () => { void run().then(resolve, reject) } })
      }
      return run()
    } } })
    if (boundary === 'after_reservation') {
      const change = store.backend.change.bind(store.backend); let once = true
      vi.spyOn(store.backend, 'change').mockImplementation(async (...args) => {
        const value = await change(...args)
        if (once) { once = false; await new Promise<void>(r => { deliver = r }) }
        return value
      })
    }
    const settings = root.records.base.header.settings
    const start = mode === 'retest' ? controller.explainRetest('base') : controller.start('replay', settings)
    if (boundary === 'after_arming') {
      if (mode === 'retest') { await start; void controller.startRetest() }
      await vi.waitFor(() => expect(mounts).toBe(1), { interval: 1 })
    } else await vi.waitFor(() => expect(deliver).toBeDefined(), { interval: 1 })
    await controller.dispose()
    deliver?.(); await start
    await vi.waitFor(() => expect(locked).toBe(false), { interval: 1 })
    // A reservation delivery may start bounded cleanup; wait for its durable release.
    if (boundary === 'after_reservation') await vi.waitFor(() => expect(current().snapshot.exposure).toBe('released_unseen'), { interval: 1 })
    if (boundary === 'after_arming') expect(current().snapshot.exposure).toBe('exposure_uncertain')
    if (boundary === 'before_acquisition' || boundary === 'after_acquisition') expect(Object.keys(root.records)).toEqual(['base'])
    const saved = structuredClone(root)
    frames.splice(0).forEach(f => f(3))
    await controller.action('pump', 'keyboard', 1, 0)
    expect(root).toEqual(saved)
    expect(mounts).toBe(boundary === 'after_arming' ? 1 : 0)
  })
}

for (const stalled of [false, true]) it(`positive onset cleanup retains ownership only until ${stalled ? 'deadline' : 'commit'}`, async () => {
  let locked = false
  Object.defineProperty(navigator, 'locks', { configurable: true, value: { request: async (name: string, _options: unknown, cb: (lock: object) => unknown) => {
    if (name.endsWith(':owner')) { locked = true; try { return await cb({}) } finally { locked = false } }
    return cb({})
  } } })
  await controller.explainRetest('base')
  const commit = store.commit.bind(store), read = store.read.bind(store)
  let paused: Promise<void> | undefined, deliver!: () => void, once = true
  vi.spyOn(store, 'commit').mockImplementation((...args) => {
    if (args[2].kind === 'confirm' && once) {
      once = false
      vi.spyOn(store, 'read').mockImplementation(async () => { const value = await read(); await new Promise<void>(r => { deliver = r }); return value })
      paused = controller.pause('hidden')
      return Promise.reject(new DOMException('Canceled', 'AbortError'))
    }
    return commit(...args)
  })
  const start = controller.startRetest(); await framesReady(); await start
  await vi.waitFor(() => expect(deliver).toBeDefined())
  expect(locked).toBe(true)
  if (!stalled) deliver()
  await paused
  await vi.waitFor(() => expect(locked).toBe(false))
  const saved = structuredClone(root)
  if (stalled) { deliver(); await new Promise(r => setTimeout(r, 10)); expect(root).toEqual(saved); expect(current().snapshot.exposure).toBe('exposure_uncertain') }
  else { expect(current().snapshot.exposure).toBe('form_exposed'); expect(current().snapshot.phase).toBe('paused') }
})
