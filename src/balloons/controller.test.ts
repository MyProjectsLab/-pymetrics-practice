import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { webcrypto } from 'node:crypto'
import { BalloonsController } from './controller'
import type { RunView } from './controller'
import { BalloonsStore, freshRoot, WriteFailure } from './storage'
import type { Backend, Root } from './storage'
import { loadScoredManifests } from './manifests'
const settings = { verbose: false, reducedMotion: true, informationProfile: 'type-pattern-v1', controls: 'native-buttons-v1' } as const
beforeAll(async () => { Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true }); await loadScoredManifests() })
let frames: FrameRequestCallback[], store: BalloonsStore, root: Root, controller: BalloonsController, views: RunView[], mounts: number, fail: string | null
beforeEach(() => {
  frames = []; views = []; mounts = 0; fail = null; root = freshRoot()
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { frames.push(cb); return frames.length })
  vi.stubGlobal('cancelAnimationFrame', () => {})
  Object.defineProperty(navigator, 'locks', { configurable: true, value: { request: (_name: string, _options: unknown, callback: (lock: object) => unknown) => Promise.resolve(callback({})) } })
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
  const backend: Backend = { read: async () => structuredClone(root), change: async (operation, signal) => {
    if (signal?.aborted) throw new DOMException('Canceled', 'AbortError')
    const copy = structuredClone(root), result = operation(copy), command = Object.values(copy.records).at(-1)?.journal.at(-1)?.command?.kind
    if (fail && command === fail) { fail = null; throw new WriteFailure('injected write abort') }
    copy.revision++; root = structuredClone(copy); return structuredClone(result)
  } }
  store = new BalloonsStore(backend, root.installationId)
  controller = new BalloonsController(store, v => views.push(v), () => {
    mounts++
    const element = document.createElement('div'); element.innerHTML = '<strong data-balloon-type>Type 1</strong><button data-control="pump">Pump</button><button data-control="collect">Collect</button>'; document.body.append(element)
    element.getBoundingClientRect = () => ({ x: 0, y: 0, width: 100, height: 100, top: 0, left: 0, right: 100, bottom: 100, toJSON: () => '' })
    return element
  })
})
afterEach(() => { controller.dispose(); vi.unstubAllGlobals(); vi.restoreAllMocks(); document.body.innerHTML = '' })
async function confirm() { await vi.waitFor(() => expect(frames.length).toBeGreaterThan(0)); frames.shift()!(performance.now()); frames.shift()!(performance.now()) }
async function start() { const task = controller.start('auto', settings); await confirm(); await task }
it('durably arms before mount and requires two distinct frames before action eligibility', async () => {
  const task = controller.start('auto', settings)
  await vi.waitFor(() => expect(mounts).toBe(1)); expect(controller.view.mode).toBe('mounting')
  expect(Object.values(root.records)[0].snapshot.exposure).toBe('exposure_uncertain')
  frames.shift()!(performance.now()); expect(controller.view.mode).toBe('mounting')
  frames.shift()!(performance.now()); await task
  expect(controller.view.mode).toBe('playing'); expect(Object.values(root.records)[0].snapshot.confirmedRounds).toEqual([1])
})
it.each(['arm', 'confirm', 'action_pending', 'action'])('%s write failure stays visibly unsaved and ineligible', async kind => {
  if (kind === 'arm') { fail = kind; await controller.start('auto', settings) }
  else if (kind === 'confirm') { fail = kind; const task = controller.start('auto', settings); await confirm(); await task }
  else { await start(); fail = kind; await controller.action('pump', 'mouse', 1, 0) }
  expect(controller.view.mode).toBe('unsaved'); expect(controller.view.message).toContain('could not be confirmed')
  const record = Object.values(root.records)[0]; expect(record.snapshot.comparisonEligible).toBe(false); expect(record.snapshot.core.nextActionId).toBe(1)
})
it('late assignment after pre-arm cancellation releases only positively unmounted inventory and cannot publish', async () => {
  const assign = store.assign.bind(store); let deliver: (() => void) | undefined
  vi.spyOn(store, 'assign').mockImplementation(async (...args) => { const result = await assign(...args); await new Promise<void>(r => { deliver = r }); return result })
  const task = controller.start('auto', settings); await vi.waitFor(() => expect(deliver).toBeDefined())
  controller.dispose(); const published = views.length; await task; deliver!()
  await vi.waitFor(() => expect(Object.values(root.records)[0].snapshot.exposure).toBe('released_unseen'))
  expect(mounts).toBe(0); expect(views).toHaveLength(published)
})
it('post-arm cancel and late frames never confirm exposure or enable controls', async () => {
  const task = controller.start('auto', settings); await vi.waitFor(() => expect(mounts).toBe(1))
  await controller.pause('hidden'); await task
  for (const frame of frames.splice(0)) frame(performance.now())
  expect(controller.view.mode).toBe('paused'); const r = Object.values(root.records)[0]
  expect(r.snapshot.exposure).toBe('exposure_uncertain'); expect(r.snapshot.confirmedRounds).toEqual([]); expect(r.snapshot.comparisonEligible).toBe(false)
})
it('delayed action commit delivery suppresses duplicate clicks; next intentional click after commit is new', async () => {
  await start(); const commit = store.commit.bind(store); let deliver: (() => void) | undefined
  vi.spyOn(store, 'commit').mockImplementation(async (...args) => { const r = await commit(...args); if (args[2].kind === 'action') await new Promise<void>(resolve => { deliver = resolve }); return r })
  const action = controller.action('pump', 'mouse', 1, 0); await vi.waitFor(() => expect(deliver).toBeDefined())
  const later = controller.action('pump', 'mouse', 1, 0); expect(controller.view.mode).toBe('saving'); expect(controller.view.record?.snapshot.core.nextActionId).toBe(1)
  expect(Object.values(root.records)[0].snapshot.core.nextActionId).toBe(2)
  deliver!(); await Promise.all([action, later]); expect(controller.view.record?.snapshot.core.nextActionId).toBe(2)
})
it('deletion during delayed commit prevents late delivery from restoring candidate state', async () => {
  await start(); const commit = store.commit.bind(store); let deliver: (() => void) | undefined
  vi.spyOn(store, 'commit').mockImplementation(async (...args) => { const r = await commit(...args); if (args[2].kind === 'action') await new Promise<void>(resolve => { deliver = resolve }); return r })
  const action = controller.action('pump', 'mouse', 1, 0); await vi.waitFor(() => expect(deliver).toBeDefined())
  const id = Object.keys(root.records)[0]; await controller.pause('deletion'); await store.delete(id, Date.now()); deliver!(); await action
  expect(root.records[id]).toBeUndefined(); expect(controller.view.mode).toBe('paused'); expect(controller.view.record?.snapshot.core.nextActionId).toBe(2)
  // The paused snapshot is only review context; it is not playable and cannot recreate the record.
  await expect(store.recover('new', id, controller.time())).rejects.toThrow()
})
it('a held healthy authority read withholds controls then restores the intact session without interruption', async () => {
  await start(); const read = store.read.bind(store); let deliver: (() => void) | undefined
  vi.spyOn(store, 'read').mockImplementation(async () => { const saved = await read(); await new Promise<void>(r => { deliver = r }); return saved })
  const before = controller.view.record, checking = controller.checkAuthority()
  await vi.waitFor(() => expect(deliver).toBeDefined()); frames.shift()!(performance.now()); frames.shift()!(performance.now())
  expect(controller.view.mode).toBe('checking')
  await controller.action('pump', 'mouse', 1, 0); expect(Object.values(root.records)[0].snapshot.core.nextActionId).toBe(1)
  deliver!(); await checking; expect(controller.view.mode).toBe('playing'); expect(controller.view.record).toEqual(before)
  expect(Object.values(root.records)[0].snapshot.interruptions).toBe(0)
})
it('stalled cleanup read releases admission by its deadline and a late read cannot rewrite deletion', async () => {
  await start(); const saved = await store.read(); let deliver: ((root: Root) => void) | undefined
  vi.spyOn(store, 'read').mockImplementationOnce(() => new Promise<Root>(r => { deliver = r }))
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  try {
    const paused = controller.pause('hidden')
    await vi.advanceTimersByTimeAsync(2000); await paused
    const id = Object.keys(root.records)[0]; await store.delete(id, Date.now()); const deleted = structuredClone(root)
    deliver!(saved); await Promise.resolve(); await Promise.resolve()
    expect(root).toEqual(deleted); expect(controller.view.mode).toBe('paused')
  } finally { vi.useRealTimers() }
})

it.each(['action_pending', 'action'])('sustained %s and cleanup failure preserves committed bytes; fresh recovery is review-only', async failedKind => {
  await start()
  await controller.action('collect', 'mouse', 1, 0)
  const next = controller.action('next', 'mouse', 1, 1); await confirm(); await next
  const c = controller.view.record!.snapshot.core
  await controller.action('pump', 'mouse', c.round, c.revision)
  const saved = structuredClone(root), id = Object.keys(root.records)[0]
  const commit = store.commit.bind(store)
  const fault = vi.spyOn(store, 'commit').mockImplementation((...args) => {
    if (args[2].kind === failedKind || args[2].kind === 'pause') return Promise.reject(new WriteFailure('persistent storage failure'))
    return commit(...args)
  })
  const current = controller.view.record!.snapshot.core
  await controller.action('pump', 'mouse', current.round, current.revision)
  expect(controller.view.mode).toBe('write_failed')
  expect(controller.view.message).toContain('Save status needs checking')
  expect(controller.view.message).not.toContain('not eligible')
  expect(root.records[id].snapshot.core).toEqual(saved.records[id].snapshot.core)
  if (failedKind === 'action_pending') expect(root).toEqual(saved)
  fault.mockRestore()
  // Simulate a new document before the old controller can save any cleanup marker.
  const recovered = await store.recover('reload', id, controller.time())
  expect(recovered.record.header).toEqual(saved.records[id].header)
  expect(recovered.record.snapshot.core).toEqual(saved.records[id].snapshot.core)
  expect(recovered.record.snapshot.confirmedRounds).toEqual([1, 2])
  expect(recovered.record.snapshot.exposure).toBe('form_exposed')
  expect(recovered.record.snapshot.comparisonEligible).toBe(false)
})
it('a later navigation cleanup cannot erase an earlier unsaved eligibility warning', async () => {
  await start()
  const fault = vi.spyOn(store, 'commit').mockRejectedValue(new WriteFailure('persistent failure'))
  await controller.action('pump', 'mouse', 1, 0)
  fault.mockRestore()
  await controller.pause('navigation', true)
  const id = Object.keys(root.records)[0]
  expect(root.records[id].snapshot.comparisonEligible).toBe(false)
  expect((await store.recover('reload', id, controller.time())).record.snapshot.comparisonEligible).toBe(false)
})
it('a committed clean pause remains eligible and retains the exact action on resume', async () => {
  await start(); await controller.action('pump', 'mouse', 1, 0)
  await controller.pause('browser_interruption')
  const saved = Object.values(root.records)[0]
  const recovered = await store.recover('reload', saved.header.identity.sessionId, controller.time())
  expect(recovered.record.snapshot.comparisonEligible).toBe(true)
  expect(recovered.record.snapshot.core).toEqual(saved.snapshot.core)
})

it.each(['assignment', 'arm', 'confirm', 'action'].flatMap(phase => ['individual', 'installation'].map(deletion => [phase, deletion])))('bounded %s delivery permits %s deletion without notification; late delivery is fenced', async (phase, deletion) => {
  // Serialize the actual gate callbacks (the owner lock has its own lifetime).
  let tail: Promise<unknown> = Promise.resolve()
  Object.defineProperty(navigator, 'locks', { configurable: true, value: { request: (name: string, _options: unknown, callback: (lock: object) => unknown) => {
    if (name.endsWith(':owner')) return Promise.resolve(callback({}))
    const task = tail.then(() => callback({})); tail = task.catch(() => {}); return task
  } } })
  if (phase === 'action') await start()
  const original = store.backend.change.bind(store.backend)
  let deliver: (() => void) | undefined
  vi.spyOn(store.backend, 'change').mockImplementation(async (op, signal) => {
    const result = await original(op, signal)
    const kind = Object.values(root.records).at(-1)?.journal.at(-1)?.command?.kind ?? 'assignment'
    if (kind === phase && !deliver) await new Promise<void>(r => { deliver = r })
    return result
  })
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  try {
    const operation = phase === 'action' ? controller.action('pump', 'mouse', 1, 0) : controller.start('auto', settings)
    // Flush storage and presentation until the selected response has been held.
    for (let i = 0; i < 100 && !deliver; i++) { await vi.advanceTimersByTimeAsync(1); for (const f of frames.splice(0)) f(performance.now()) }
    expect(deliver).toBeDefined()
    const id = Object.keys(root.records)[0], before = structuredClone(root)
    const { withMutationGate } = await import('./storage')
    const deleted = withMutationGate(signal => deletion === 'individual' ? store.delete(id, Date.now(), signal) : store.deleteAll(signal))
    await vi.advanceTimersByTimeAsync(2000); await deleted; await operation
    expect(Object.keys(root.records)).toHaveLength(0)
    if (deletion === 'individual') expect(root.tombstones[id].exposure).toBe(before.records[id].snapshot.exposure)
    else expect(root.installationId).not.toBe(before.installationId)
    const bytes = JSON.stringify(root), published = views.length
    deliver!(); await vi.advanceTimersByTimeAsync(20)
    expect(JSON.stringify(root)).toBe(bytes)
    expect(views.slice(published).some(v => ['playing', 'mounting', 'report'].includes(v.mode))).toBe(false)
    if (phase === 'assignment' || phase === 'arm') expect(mounts).toBe(0)
  } finally { vi.useRealTimers() }
})

async function finalRound() {
  await start()
  for (let round = 1; round < 39; round++) {
    let c = controller.view.record!.snapshot.core
    await controller.action('collect', 'mouse', c.round, c.revision)
    c = controller.view.record!.snapshot.core
    const task = controller.action('next', 'mouse', c.round, c.revision)
    await confirm(); await task
  }
  const c = controller.view.record!.snapshot.core
  await controller.action('pump', 'mouse', c.round, c.revision)
  expect(controller.view.record!.snapshot.core.current.currentCents).toBe(5)
}
async function holdFinal(kind: string) {
  const commit = store.commit.bind(store)
  let deliver: (() => void) | undefined
  vi.spyOn(store, 'commit').mockImplementation(async (...args) => {
    const record = await commit(...args)
    if (args[2].kind === kind && !deliver) await new Promise<void>(r => { deliver = r })
    return record
  })
  const c = controller.view.record!.snapshot.core
  const task = controller.action('collect', 'mouse', c.round, c.revision)
  await vi.waitFor(() => expect(deliver).toBeDefined())
  return { task, deliver: () => deliver!() }
}
it.each(['action', 'action_pending'])('final %s timeout reconciles before status claims and fences late delivery', async kind => {
  await finalRound()
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  try {
    const held = await holdFinal(kind), committed = structuredClone(root)
    const id = Object.keys(root.records)[0]
    await vi.advanceTimersByTimeAsync(2000); await held.task
    expect(views.some(v => v.mode === 'uncertain' && v.message.includes('Save status needs checking'))).toBe(true)
    if (kind === 'action') {
      expect(controller.view.mode).toBe('verified_completion')
      expect(controller.view.record?.snapshot.core.bankedCents).toBe(5)
      expect(root).toEqual(committed)
      await controller.checkAuthority()
      for (const frame of frames.splice(0)) frame(performance.now())
      expect(controller.view.mode).toBe('verified_completion')
      expect(views.some(v => v.message.includes('not eligible'))).toBe(false)
    } else {
      expect(controller.view.mode).toBe('unsaved')
      expect(root.records[id].snapshot.core.results).toHaveLength(38)
      expect(root.records[id].snapshot.comparisonEligible).toBe(false)
      expect(root.records[id].snapshot.pendingAction).not.toBeNull()
    }
    const bytes = JSON.stringify(root), count = views.length
    held.deliver(); await vi.advanceTimersByTimeAsync(10)
    expect(JSON.stringify(root)).toBe(bytes); expect(views).toHaveLength(count)
  } finally { vi.useRealTimers() }
}, 20000)
it.each(['unavailable', 'held', 'snapshot', 'journal', 'header', 'owner', 'installation'])('final committed result with %s authority makes no saved or eligibility claim', async faultKind => {
  await finalRound()
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  try {
    const held = await holdFinal('action'), completed = structuredClone(root)
    const read = store.read.bind(store)
    let lateRead: (() => void) | undefined
    const fault = vi.spyOn(store, 'read').mockImplementation(async () => {
      if (faultKind === 'unavailable') throw new Error('unavailable')
      const data = await read(), id = Object.keys(data.records)[0]
      if (faultKind === 'held') await new Promise<void>(r => { lateRead = r })
      if (faultKind === 'snapshot') data.records[id].snapshot.core = { ...data.records[id].snapshot.core, bankedCents: 6 }
      if (faultKind === 'header') data.records[id].header.device = 'changed'
      if (faultKind === 'journal') data.records[id].journal[0].wallTimeMs++
      if (faultKind === 'owner') data.owner!.id = 'replacement'
      if (faultKind === 'installation') data.installationId = 'replacement'
      return data
    })
    await vi.advanceTimersByTimeAsync(4000); await held.task
    expect(controller.view.mode).toBe('uncertain')
    expect(controller.view.message).toContain('Save status needs checking')
    expect(views.some(v => v.mode === 'verified_completion' || v.message.includes('not eligible'))).toBe(false)
    expect(root).toEqual(completed)
    fault.mockRestore(); await controller.checkSaveStatus()
    expect(controller.view.mode).toBe('verified_completion')
    const count = views.length
    lateRead?.(); held.deliver(); await vi.advanceTimersByTimeAsync(10)
    expect(root).toEqual(completed); expect(views).toHaveLength(count)
  } finally { vi.useRealTimers() }
}, 20000)

async function highThresholdRound() {
  await start()
  while (true) {
    const c = controller.view.record!.snapshot.core
    if (c.manifest.rounds[c.round - 1].threshold > 10) return c
    await controller.action('collect', 'mouse', c.round, c.revision)
    const next = controller.view.record!.snapshot.core
    const task = controller.action('next', 'mouse', next.round, next.revision)
    await confirm(); await task
  }
}
it('retains ten lawful Pump clicks in under one second while the first save is held', async () => {
  const before = await highThresholdRound(), commit = store.commit.bind(store)
  let release!: () => void, held = false
  vi.spyOn(store, 'commit').mockImplementation(async (...args) => {
    if (args[2].kind === 'action_pending' && !held) { held = true; await new Promise<void>(resolve => { release = resolve }) }
    return commit(...args)
  })
  const begin = performance.now()
  const pending = Array.from({ length: 10 }, () => controller.action('pump', 'mouse', before.round, before.revision))
  expect(performance.now() - begin).toBeLessThan(1000)
  await vi.waitFor(() => expect(release).toBeDefined())
  expect(controller.view.record!.snapshot.core.current.successfulPumps).toBe(0)
  release(); await Promise.all(pending)
  const after = controller.view.record!.snapshot.core
  expect(after.current.successfulPumps).toBe(10)
  expect(after.current.currentCents).toBe(50)
  const pumps = after.events.filter(e => e.round === before.round && e.type === 'pump_attempted' && e.outcome === 'pump_success')
  expect(pumps).toHaveLength(10)
  expect(new Set(pumps.map(e => e.actionId)).size).toBe(10)
  expect(Object.values(root.records)[0].snapshot.core).toEqual(after)
})

it('preserves Pump then Collect order and never applies later queued clicks to another balloon', async () => {
  const before = await highThresholdRound(), commit = store.commit.bind(store)
  let release!: () => void, held = false
  vi.spyOn(store, 'commit').mockImplementation(async (...args) => {
    if (args[2].kind === 'action_pending' && !held) { held = true; await new Promise<void>(r => { release = r }) }
    return commit(...args)
  })
  const pending = ['pump', 'collect', 'pump'].map(kind => controller.action(kind as 'pump' | 'collect', 'mouse', before.round, before.revision))
  await vi.waitFor(() => expect(release).toBeDefined()); release(); await Promise.all(pending)
  const after = controller.view.record!.snapshot.core
  expect(after.round).toBe(before.round)
  expect(after.results.at(-1)?.bankedCents).toBe(5)
  expect(after.results.at(-1)?.successfulPumps).toBe(1)
  expect(after.nextActionId).toBe(before.nextActionId + 2)
  expect(controller.view.message).toContain('Further choices were not applied')
})
it.each(['pause', 'delete', 'failure'])('retires queued choices on %s and fences their late delivery', async reason => {
  const before = await highThresholdRound(), commit = store.commit.bind(store)
  let release!: () => void, held = false
  vi.spyOn(store, 'commit').mockImplementation(async (...args) => {
    if (args[2].kind === 'action_pending' && !held) {
      held = true; await new Promise<void>(r => { release = r })
      if (reason === 'failure') throw new WriteFailure('held first queued write failed')
    }
    return commit(...args)
  })
  const pending = Array.from({ length: 10 }, () => controller.action('pump', 'touch_or_pen', before.round, before.revision))
  await vi.waitFor(() => expect(release).toBeDefined())
  if (reason !== 'failure') await controller.pause('browser_interruption')
  if (reason === 'delete') await store.delete(controller.view.record!.header.identity.sessionId, Date.now())
  release(); await Promise.all(pending)
  expect(controller.acceptsRoundActions()).toBe(false)
  expect(controller.view.mode).not.toBe('playing')
  if (reason === 'delete') expect(Object.keys(root.records)).toHaveLength(0)
  else expect(Object.values(root.records)[0].snapshot.core.current.successfulPumps).toBe(0)
})
it('bounds queued admission explicitly and never carries the backlog beyond a burst', async () => {
  const before = await highThresholdRound(), commit = store.commit.bind(store)
  let release!: () => void, held = false
  vi.spyOn(store, 'commit').mockImplementation(async (...args) => {
    if (args[2].kind === 'action_pending' && !held) { held = true; await new Promise<void>(r => { release = r }) }
    return commit(...args)
  })
  const pending = Array.from({ length: 65 }, () => controller.action('pump', 'mouse', before.round, before.revision))
  await vi.waitFor(() => expect(release).toBeDefined())
  expect(controller.acceptsRoundActions()).toBe(false)
  expect(controller.atActionCapacity).toBe(true)
  expect(controller.view.message).toContain('Please wait')
  await controller.action('pump', 'mouse', before.round, before.revision)
  expect(controller.atActionCapacity).toBe(true)
  expect(controller.view.message).toContain('Please wait')
  release(); await Promise.all(pending)
  const after = controller.view.record!.snapshot.core, row = before.manifest.rounds[before.round - 1]
  expect(after.round).toBe(before.round)
  expect(after.results.at(-1)?.attemptedPumps).toBe(Math.min(row.threshold, 32))
  expect(after.nextActionId).toBe(before.nextActionId + Math.min(row.threshold, 32))
})
