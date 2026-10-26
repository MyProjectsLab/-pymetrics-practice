import { eligibleRoot } from './retest-test-support'
import { beforeAll, expect, it } from 'vitest'
import { webcrypto } from 'node:crypto'
import { loadScoredManifests } from './manifests'
import { loadDrillManifests } from './drill-manifests'
import { acquireOwner, BalloonsStore, WriteFailure } from './storage'
import type { Backend, Root, OwnerToken } from './storage'
import { advance, reconcileDurable, RETEST_RESERVATION_MS } from './durable'
import type { DurableRecord } from './durable'
import type { FormId } from './contracts'

beforeAll(async () => {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true })
  Object.defineProperty(navigator, 'locks', { configurable: true, value: { request: (_name: string, _options: unknown, callback: (lock: object) => unknown) => Promise.resolve(callback({})) } })
  await loadScoredManifests(); await loadDrillManifests()
})
const time = (n = 0) => ({ wallTimeMs: 1000000 + n, monotonicMs: Math.max(0, n), clockEpochId: `rt-${n}` })

class Memory implements Backend {
  root: Root; fail = false; lost = false
  constructor(root: Root) { this.root = structuredClone(root) }
  async read() { return structuredClone(this.root) }
  async change<T>(fn: (r: Root) => T, signal?: AbortSignal) {
    if (signal?.aborted) throw Error('aborted')
    const copy = structuredClone(this.root), value = fn(copy)
    if (this.fail) { this.fail = false; throw new WriteFailure('abort') }
    copy.revision++; this.root = copy
    if (this.lost) { this.lost = false; throw Error('delivery lost') }
    return structuredClone(value)
  }
}
function setup(id: FormId = 'BL1') { const backend = new Memory(eligibleRoot(id)); return { backend, store: new BalloonsStore(backend, 'install') } }
async function reserve(store: BalloonsStore, n = 0, fresh = false) { store.bindOwner(`owner-${n}`, await acquireOwner(new AbortController().signal)); return store.reserveRetest(`owner-${n}`, 'base', time(n), 'test', fresh) }
async function recover(store: BalloonsStore, owner: string, id: string, t: ReturnType<typeof time>) { store.bindOwner(owner, await acquireOwner(new AbortController().signal)); return store.recover(owner, id, t) }
async function confirm(store: BalloonsStore, token: OwnerToken, r: DurableRecord, n = 1) {
  r = await store.commit(token, r, { kind: 'arm' }, time(n))
  return store.commit(token, r, { kind: 'confirm' }, time(n + 1))
}
async function complete(store: BalloonsStore, token: OwnerToken, r: DurableRecord) {
  let n = 10
  while (r.snapshot.phase !== 'completed') {
    const c = r.snapshot.core, t = time(n++)
    const action = { kind: c.status === 'resolved' ? 'next' as const : c.current.successfulPumps < 3 ? 'pump' as const : 'collect' as const, source: 'mouse' as const, actionId: c.nextActionId, expectedRevision: c.revision, expectedRound: c.round, time: t }
    r = await store.commit(token, r, { kind: 'action_pending', action }, t)
    r = await store.commit(token, r, { kind: 'action', action }, t)
    if (action.kind === 'next') r = await confirm(store, token, r, n += 2)
  }
  return r
}
it('reserves on explanation, releases only unarmed, and reopening has a new session and full lease', async () => {
  const { store } = setup(); const a = await reserve(store)
  expect(a.record.header.formId).toBe('RT1'); expect(a.record.header.retest?.expiresAtMs).toBe(time().wallTimeMs + RETEST_RESERVATION_MS)
  expect(a.record.snapshot.confirmedRounds).toEqual([]); expect(a.record.journal[0].type).toBe('retest_reserved')
  await store.commit(a.token, a.record, { kind: 'release' }, time(1))
  const b = await reserve(store, 2)
  expect(b.record.header.formId).toBe('RT1'); expect(b.token.sessionId).not.toBe(a.token.sessionId)
  await expect(store.commit(a.token, a.record, { kind: 'arm' }, time(3))).rejects.toThrow()
})
it.each([RETEST_RESERVATION_MS, RETEST_RESERVATION_MS + 1, -1])('pre-arm expiry/rollback %s releases durably without exposure', async n => {
  const { store } = setup(), { record, token } = await reserve(store)
  const released = await store.commit(token, record, { kind: 'arm' }, time(n))
  expect(released.snapshot.exposure).toBe('released_unseen'); expect(released.journal.at(-1)?.type).toBe('retest_released')
  await expect(store.commit(token, released, { kind: 'confirm' }, time(n + 1))).rejects.toThrow()
  expect((await reserve(store, n + 2)).record.header.formId).toBe('RT1')
})
it.each([RETEST_RESERVATION_MS, RETEST_RESERVATION_MS + 1, -1])('confirmed display after arming at expiry/rollback %s consumes and invalidates exact RT', async n => {
  const { store } = setup(), { record, token } = await reserve(store)
  const armed = await store.commit(token, record, { kind: 'arm' }, time(1))
  const exposed = await store.commit(token, armed, { kind: 'confirm' }, time(n))
  expect(exposed.snapshot.exposure).toBe('form_exposed'); expect(exposed.snapshot.confirmedRounds).toEqual([1])
  expect(exposed.snapshot.phase).toBe('paused'); expect(exposed.snapshot.comparisonEligible).toBe(false)
  expect((await reserve(store, n + 5, true)).record.header.formId).toBe('RT2')
})
it('confirmed onset before expiry remains valid after expiry; later rounds are not reservations', async () => {
  const { store } = setup(), { record, token } = await reserve(store)
  let r = await confirm(store, token, record, RETEST_RESERVATION_MS - 2)
  r = await store.commit(token, r, { kind: 'pause' }, time(RETEST_RESERVATION_MS + 1))
  const recovered = await recover(store, 'new', token.sessionId, time(RETEST_RESERVATION_MS + 2))
  r = await confirm(store, recovered.token, recovered.record, RETEST_RESERVATION_MS + 3)
  expect(r.snapshot.comparisonEligible).toBe(true); expect(r.snapshot.exposure).toBe('form_exposed')
})
it.each(['BL1', 'BL2', 'BL3'] as FormId[])('all three RT forms retain %s chain mapping/settings; one durable valid RT closes chain', async bl => {
  for (let rt = 1; rt <= 3; rt++) {
    const { store, backend } = setup(bl)
    for (let prior = 1; prior < rt; prior++) {
      const a = await reserve(store, prior * -100, true)
      const armed = await store.commit(a.token, a.record, { kind: 'arm' }, time(prior * -100 + 1))
      await store.commit(a.token, armed, { kind: 'pause' }, time(prior * -100 + 2))
    }
    const a = await reserve(store, 0, rt > 1)
    expect(a.record.header.formId).toBe(`RT${rt}`)
    expect(a.record.header.identity.mapping).toEqual(backend.root.records.base.header.identity.mapping)
    expect(a.record.header.settings).toEqual(backend.root.records.base.header.settings)
    const done = await complete(store, a.token, await confirm(store, a.token, a.record))
    expect(done.snapshot.core.results).toHaveLength(39); expect(done.snapshot.confirmedRounds).toHaveLength(39)
    expect(done.snapshot.comparisonEligible).toBe(true); expect(backend.root.training!.chains.chain.completedRetestSessionId).toBe(a.token.sessionId)
    const expected = done.snapshot.core.manifest.rounds.reduce((sum, row) => sum + (row.threshold > 3 ? 15 : 0), 0)
    expect(done.snapshot.core.bankedCents).toBe(expected)
    expect(reconcileDurable(done)).toEqual(done)
    expect((await new BalloonsStore(backend, 'install').read()).records[a.token.sessionId]).toEqual(done)
    await expect(reserve(store, 10000, true)).rejects.toThrow('closed')
    await store.delete(a.token.sessionId, time(10001).wallTimeMs)
    await expect(reserve(store, 10002, true)).rejects.toThrow('closed')
    expect(backend.root.tombstones[a.token.sessionId].exposure).toBe('form_exposed')
  }
}, 60000)
it('uncertain exposed attempts stay consumed through reload; invalid retries exhaust RT without repeats', async () => {
  const { store, backend } = setup()
  for (let n = 0; n < 3; n++) {
    const a = await reserve(store, n * 10, n > 0)
    await store.commit(a.token, a.record, { kind: 'arm' }, time(n * 10 + 1))
    const resumed = await recover(store, 'reload', a.token.sessionId, time(n * 10 + 2))
    expect(resumed.record.header).toEqual(a.record.header)
    expect(resumed.record.snapshot.comparisonEligible).toBe(false)
    await expect(store.commit(resumed.token, resumed.record, { kind: 'release' }, time(n * 10 + 3))).rejects.toThrow()
  }
  await expect(reserve(store, 100, true)).rejects.toThrow('No unseen retest')
  expect(backend.root.training!.chains.chain.completedRetestSessionId).toBeUndefined()
  expect(Object.values(backend.root.records).filter(r => r.header.retest).map(r => r.header.repeat)).toEqual([false, false, false])
})
it.each(['baseline-delete', 'drill-delete', 'drill-corrupt', 'lock-substitute', 'baseline-settings'])('%s revokes reservation/action admission', async fault => {
  const { store, backend } = setup(), a = await reserve(store)
  if (fault === 'baseline-delete') await store.delete('base', time(1).wallTimeMs)
  if (fault === 'drill-delete') backend.root.training!.deletedAttemptIds.push('drill')
  if (fault === 'drill-corrupt') (backend.root.training!.attempts.drill.snapshot.results as unknown[]).pop()
  if (fault === 'lock-substitute') backend.root.training!.chains.chain = { ...backend.root.training!.chains.chain, firstCompletedDrillId: 'other' }
  if (fault === 'baseline-settings') backend.root.records.base.header.settings.verbose = true
  const before = structuredClone(backend.root)
  await expect(store.commit(a.token, a.record, { kind: 'arm' }, time(2))).rejects.toThrow()
  expect(backend.root).toEqual(before)
})
it('one current reservation; old owner cannot arm, confirm, act or restore replacement installation', async () => {
  const { store, backend } = setup(), a = await reserve(store), b = await reserve(store, 2)
  expect(b.record.header.formId).toBe('RT1')
  expect(Object.values(backend.root.records).filter(r => r.header.retest && r.snapshot.exposure === 'pending_exposure')).toHaveLength(1)
  await expect(store.commit(a.token, a.record, { kind: 'arm' }, time(3))).rejects.toThrow('ownership')
  await store.deleteAll(); const replacement = structuredClone(backend.root)
  await expect(store.commit(b.token, b.record, { kind: 'arm' }, time(4))).rejects.toThrow('replaced')
  await expect(reserve(store, 5)).rejects.toThrow('replaced')
  expect(backend.root).toEqual(replacement)
})
it('possibly displayed form survives aborted confirm and failed pause writes', async () => {
  const { store, backend } = setup(), a = await reserve(store)
  const armed = await store.commit(a.token, a.record, { kind: 'arm' }, time(1))
  backend.fail = true
  await expect(store.commit(a.token, armed, { kind: 'confirm' }, time(2))).rejects.toThrow('abort')
  backend.fail = true
  await expect(store.commit(a.token, armed, { kind: 'pause' }, time(3))).rejects.toThrow('abort')
  const resumed = await recover(store, 'reload', a.token.sessionId, time(4))
  expect(resumed.record.snapshot.exposure).toBe('exposure_uncertain'); expect(resumed.record.snapshot.comparisonEligible).toBe(false)
})
it('failed final transaction closes nothing; committed final with lost delivery retains immutable result and one lock', async () => {
  const { store, backend } = setup(), a = await reserve(store)
  let r = await confirm(store, a.token, a.record), n = 10
  while (r.snapshot.core.results.length < 38 || r.snapshot.core.status === 'resolved') {
    const c = r.snapshot.core, t = time(n++), action = { kind: c.status === 'resolved' ? 'next' as const : 'collect' as const, source: 'mouse' as const, actionId: c.nextActionId, expectedRevision: c.revision, expectedRound: c.round, time: t }
    r = await store.commit(a.token, r, { kind: 'action_pending', action }, t); r = await store.commit(a.token, r, { kind: 'action', action }, t)
    if (action.kind === 'next') r = await confirm(store, a.token, r, n += 2)
  }
  const c = r.snapshot.core, t = time(n++), action = { kind: 'collect' as const, source: 'mouse' as const, actionId: c.nextActionId, expectedRevision: c.revision, expectedRound: c.round, time: t }
  r = await store.commit(a.token, r, { kind: 'action_pending', action }, t)
  backend.fail = true; const before = structuredClone(backend.root)
  await expect(store.commit(a.token, r, { kind: 'action', action }, t)).rejects.toThrow()
  expect(backend.root).toEqual(before)
  backend.lost = true
  await expect(store.commit(a.token, r, { kind: 'action', action }, t)).rejects.toThrow('delivery lost')
  const saved = store.reconcileCurrent(await store.read(), a.token, r)
  expect(saved.snapshot.phase).toBe('completed'); expect(backend.root.training!.chains.chain.completedRetestSessionId).toBe(a.token.sessionId)
  await expect(store.commit(a.token, r, { kind: 'action', action }, t)).rejects.toThrow()
})
it('binding mutations and exhausted-family repeats are rejected even with otherwise valid headers', async () => {
  const { store } = setup(), a = await reserve(store)
  for (const change of [(r: DurableRecord) => { r.header.repeat = true }, (r: DurableRecord) => { r.header.retest!.expiresAtMs++ }, (r: DurableRecord) => { (r.header.identity as { mapping: unknown }).mapping = { 'Type 1': 'B', 'Type 2': 'C', 'Type 3': 'A' } }]) {
    const r = structuredClone(a.record); change(r); expect(() => reconcileDurable(r)).toThrow()
  }
  const armed = advance(a.record, { kind: 'arm' }, time(1))
  expect(() => advance(armed, { kind: 'release' }, time(2))).toThrow()
})

it('released browser capability cannot reserve, recover, verify or act even before durable owner replacement', async () => {
  const { store } = setup(), a = await reserve(store)
  const scope = new AbortController(); store.bindOwner(a.token.id, await acquireOwner(scope.signal)); scope.abort()
  await expect(store.verify(a.token, a.record)).rejects.toThrow('ownership released')
  await expect(store.commit(a.token, a.record, { kind: 'arm' }, time(1))).rejects.toThrow('ownership released')
  await expect(store.reserveRetest(a.token.id, 'base', time(2), 'test')).rejects.toThrow('ownership released')
  await expect(store.recover(a.token.id, a.token.sessionId, time(3))).rejects.toThrow('ownership released')
})

it('deleting an unarmed RT retains a released tombstone and permits the same unseen form', async () => {
  const { store, backend } = setup(), a = await reserve(store)
  await store.delete(a.token.sessionId, time(1).wallTimeMs)
  expect(backend.root.tombstones[a.token.sessionId].exposure).toBe('released_unseen')
  const b = await reserve(store, 2)
  expect(b.record.header.formId).toBe('RT1')
  await expect(store.commit(a.token, a.record, { kind: 'arm' }, time(3))).rejects.toThrow()
})

it('an arbitrary owner callback cannot be bound as browser ownership', () => {
  const { store } = setup()
  expect(() => store.bindOwner('forged', async () => {})).toThrow('browser ownership proof required')
})
