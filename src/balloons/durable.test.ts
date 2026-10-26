import { beforeAll, describe, expect, it } from 'vitest'
import { webcrypto } from 'node:crypto'
import { loadScoredManifests } from './manifests'
import type { CoreAction, EventTime, FormId } from './contracts'
import { advance, createRecord, DURABLE_VERSION, durableBaseline, mappingFor, reconcileDurable } from './durable'
import type { DurableRecord, Settings } from './durable'
import { BalloonsStore, freshRoot } from './storage'
import type { Backend, Root } from './storage'
import { basicReport } from './report'

const settings: Settings = { verbose: false, reducedMotion: true, informationProfile: 'type-pattern-v1', controls: 'native-buttons-v1' }
let clock = 0
const time = (): EventTime => ({ wallTimeMs: 1000 + ++clock, monotonicMs: clock, clockEpochId: 'test' })
beforeAll(async () => { Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true }); await loadScoredManifests() })
export class MemoryBackend implements Backend {
  root = freshRoot()
  fail = false
  private tail: Promise<unknown> = Promise.resolve()
  async read() { return structuredClone(this.root) }
  change<T>(operation: (root: Root) => T, signal?: AbortSignal): Promise<T> {
    const next = this.tail.then(() => {
      if (this.fail || signal?.aborted) throw new Error('injected transaction abort')
      const copy = structuredClone(this.root), result = operation(copy)
      copy.revision++; this.root = structuredClone(copy)
      return structuredClone(result)
    })
    this.tail = next.catch(() => undefined); return next
  }
}
function create(id: FormId = 'BL1') { return createRecord({ version: DURABLE_VERSION, formId: id, repeat: false, settings, device: 'test browser', created: time(), identity: { installationId: 'install', sessionId: 'session', chainId: id.startsWith('BL') ? 'chain' : null, mapping: mappingFor(id), stage: id.startsWith('BL') ? 'baseline' : 'replay', exposureGeneration: 1, ownershipGeneration: 1 } }) }
function confirm(r: DurableRecord) { return advance(advance(r, { kind: 'arm' }, time()), { kind: 'confirm' }, time()) }
function act(r: DurableRecord, kind: CoreAction['kind'], source: CoreAction['source'] = 'mouse') {
  const c = r.snapshot.core, t = time(), action = { kind, source, actionId: c.nextActionId, expectedRound: c.round, expectedRevision: c.revision, time: t }
  return advance(advance(r, { kind: 'action_pending', action }, t), { kind: 'action', action }, t)
}
function complete(id: FormId, k: number) {
  let r = confirm(create(id))
  while (r.snapshot.core.status !== 'completed') {
    const c = r.snapshot.core
    if (c.status === 'resolved') r = confirm(act(r, 'next'))
    else r = act(r, c.current.successfulPumps < k ? 'pump' : 'collect')
  }
  return r
}
describe('B1-B durable protocol and independent arithmetic', () => {
  it.each(['BL1', 'BL2', 'BL3', 'RP1', 'RP2', 'RP3'] as FormId[])('complete %s retains headless boundary and independently reconciles 39 confirmations', id => {
    const r = complete(id, 6), replay = reconcileDurable(structuredClone(r))
    expect(replay.snapshot.confirmedRounds).toEqual(Array.from({ length: 39 }, (_, i) => i + 1))
    const expected = r.snapshot.core.manifest.rounds.reduce((s, row) => {
      const burst = row.threshold <= 6, successes = burst ? row.threshold - 1 : 6
      return { bank: s.bank + (burst ? 0 : successes * 5), lost: s.lost + (burst ? successes * 5 : 0), attempts: s.attempts + successes + Number(burst) }
    }, { bank: 0, lost: 0, attempts: 0 })
    const report = basicReport(r.snapshot.core)
    expect(report.status).toBe('headless_complete')
    expect(r.snapshot.core.bankedCents).toBe(expected.bank); expect(r.snapshot.core.lostCents).toBe(expected.lost)
    expect(r.snapshot.core.events.every(e => e.validityCode === 'headless_unconfirmed')).toBe(true)
    expect(durableBaseline(r)).toBe(id.startsWith('BL'))
    expect(r.snapshot.core.results.reduce((s, row) => s + row.attemptedPumps, 0)).toBe(expected.attempts)
  })
  it('T=1 and T=33 available BL/RP boundaries resolve after atomic action groups', () => {
    const all = (['BL1', 'BL2', 'BL3', 'RP1', 'RP2', 'RP3'] as FormId[]).map(id => complete(id, 32))
    for (const t of [1, 33]) {
      const r = all.find(r => r.snapshot.core.manifest.rounds.some(x => x.threshold === t))!
      const row = r.snapshot.core.manifest.rounds.find(x => x.threshold === t)!, result = r.snapshot.core.results[row.round - 1]
      expect(result.outcome).toBe(t === 33 ? 'cap_collect' : 'burst')
      expect(result.bankedCents).toBe(t === 33 ? 160 : 0); expect(result.lostCents).toBe(t === 32 ? 155 : 0)
      expect(result.attemptedPumps).toBe(Math.min(t, 32))
    }
  })
  it('pre-arm release permits reuse, post-arm cancellation never does', () => {
    const pending = create(), released = advance(pending, { kind: 'release' }, time())
    expect(released.snapshot.exposure).toBe('released_unseen')
    const armed = advance(pending, { kind: 'arm' }, time())
    expect(() => advance(armed, { kind: 'release' }, time())).toThrow()
    const paused = advance(armed, { kind: 'pause' }, time())
    expect(paused.snapshot.exposure).toBe('exposure_uncertain')
    const recovered = advance(paused, { kind: 'recover' }, time(), 2)
    const confirmed = confirm(recovered)
    expect(confirmed.snapshot.core.manifest.id).toBe('BL1'); expect(confirmed.snapshot.comparisonEligible).toBe(false)
  })
  it('confirmed interruption retains exposure; recovery has new epoch and same committed state', () => {
    let r = act(confirm(create('BL2')), 'pump', 'unknown_or_assistive')
    const before = r.snapshot.core
    r = advance(r, { kind: 'pause' }, time())
    r = advance(r, { kind: 'recover' }, { wallTimeMs: 9999, monotonicMs: 0, clockEpochId: 'reload' }, 2)
    expect(r.snapshot.exposure).toBe('form_exposed'); expect(r.snapshot.core).toEqual(before); expect(r.snapshot.comparisonEligible).toBe(true)
    expect(reconcileDurable(r)).toEqual(r)
  })
  it('pending action crash is review only and cannot replay an uncertain action', () => {
    let r = confirm(create()), t = time()
    r = advance(r, { kind: 'action_pending', action: { kind: 'pump', actionId: 1, expectedRound: 1, expectedRevision: 0, source: 'mouse', time: t } }, t)
    expect(r.snapshot.core.nextActionId).toBe(1)
    r = advance(r, { kind: 'recover' }, time(), 2)
    expect(r.snapshot.pendingAction).toBeNull(); expect(r.snapshot.comparisonEligible).toBe(false); expect(r.snapshot.core.current.attemptedPumps).toBe(0)
    expect(reconcileDurable(r)).toEqual(r)
  })
  it('rejects duplicate actions, stale revisions, stale owner, pre-confirm and post-resolve clicks', () => {
    let r = create()
    expect(() => act(r, 'pump')).toThrow()
    r = confirm(r)
    expect(() => advance(r, { kind: 'pause' }, time(), 2)).toThrow()
    r = act(r, 'collect')
    expect(() => act(r, 'collect')).toThrow()
    const a = { kind: 'next' as const, actionId: 1, expectedRound: 1, expectedRevision: 0, source: 'mouse' as const, time: time() }
    expect(() => advance(r, { kind: 'action_pending', action: a }, a.time)).toThrow()
  })
  it.each(['missing_confirmation', 'exposure', 'settings', 'snapshot', 'mapping', 'command', 'action', 'core_hash', 'generation'])('rejects %s contradiction before recovery/report', kind => {
    const r = structuredClone(complete('BL1', 0))
    if (kind === 'missing_confirmation') r.snapshot.confirmedRounds.pop()
    if (kind === 'exposure') r.snapshot.exposure = 'pending_exposure'
    if (kind === 'settings') r.header.settings.informationProfile = 'other' as never
    if (kind === 'snapshot') r.snapshot.core = { ...r.snapshot.core, bankedCents: 5 }
    if (kind === 'mapping') r.header.identity = { ...r.header.identity, mapping: mappingFor('BL2') }
    if (kind === 'command') r.journal[1].command = { kind: 'confirm' }
    if (kind === 'action') r.journal[4].actionId = 99
    if (kind === 'core_hash') r.snapshot.core = { ...r.snapshot.core, manifest: { ...r.snapshot.core.manifest, sha256: 'bad' } }
    if (kind === 'generation') r.snapshot.ownershipGeneration++
    expect(() => reconcileDurable(r)).toThrow()
  })
})
describe('atomic installation / assignment / deletion authority', () => {
  it('allocates RP mock once, rejects conflicting replay, and retires it without resuming play', async () => {
    const backend = new MemoryBackend(), store = new BalloonsStore(backend, backend.root.installationId)
    const sessionId = '00000000-0000-4000-8000-000000000001', created = time()
    const first = await store.assign('owner', 'replay', settings, 'test', created, undefined, sessionId)
    expect(first.record.header.formId).toBe('RP1')
    expect(first.record.header.identity.stage).toBe('mock')
    const second = await store.assign('owner', 'replay', settings, 'test', created, undefined, sessionId)
    expect(second.record).toEqual(first.record)
    expect(Object.keys((await store.read()).records)).toHaveLength(1)
    await expect(store.assign('owner', 'replay', { ...settings, reducedMotion: false }, 'test', time(), undefined, sessionId)).rejects.toThrow('conflicting mock assignment')
    const armed = await store.commit(first.token, first.record, { kind: 'arm' }, time())
    const retired = await store.settleMock(sessionId, time())
    expect(retired.snapshot.phase).toBe('paused')
    expect(retired.snapshot.core).toEqual(armed.snapshot.core)
    expect(await store.settleMock(sessionId, time())).toEqual(retired)
    await expect(store.recover('owner', sessionId, time())).rejects.toThrow('mock play cannot resume')
  })
  it('labels a new RP mock assignment as familiar after the three exposed forms', async () => {
    const backend = new MemoryBackend(), store = new BalloonsStore(backend, backend.root.installationId)
    for (let ordinal = 1; ordinal <= 3; ordinal++) {
      const sessionId = `00000000-0000-4000-8000-${String(ordinal).padStart(12, '0')}`
      const assigned = await store.assign('owner', 'replay', settings, 'test', time(), undefined, sessionId)
      expect(assigned.record.header.formId).toBe(`RP${ordinal}`)
      const armed = await store.commit(assigned.token, assigned.record, { kind: 'arm' }, time())
      expect(armed.snapshot.exposure).not.toBe('released_unseen')
      await store.settleMock(sessionId, time())
    }
    const next = await store.assign('owner', 'replay', settings, 'test', time(), undefined, '00000000-0000-4000-8000-000000000004')
    expect(next.record.header.formId).toBe('RP1')
    expect(next.record.header.repeat).toBe(true)
    expect(next.record.header.identity.stage).toBe('mock')
  })
  it('rejects BL and RT forms paired with a mock stage before any play', () => {
    const rp = create('RP1')
    for (const formId of ['BL1', 'RT1'] as const) {
      const header = { ...rp.header, formId, identity: { ...rp.header.identity,
        stage: 'mock' as const, chainId: 'chain', mapping: mappingFor(formId) } }
      expect(() => createRecord(header)).toThrow()
    }
  })
  it('retires a resolved round-twenty mock without resuming that native sequence', async () => {
    const backend = new MemoryBackend(), store = new BalloonsStore(backend, backend.root.installationId)
    const sessionId = '00000000-0000-4000-8000-000000000020'
    const assigned = await store.assign('owner', 'replay', settings, 'test', time(), undefined, sessionId)
    let record = await store.commit(assigned.token, assigned.record, { kind: 'arm' }, time())
    record = await store.commit(assigned.token, record, { kind: 'confirm' }, time())
    for (let round = 1; round <= 20; round++) {
      const core = record.snapshot.core, at = time()
      const action = { kind: 'collect' as const, source: 'mouse' as const, actionId: core.nextActionId,
        expectedRound: core.round, expectedRevision: core.revision, time: at }
      record = await store.commit(assigned.token, record, { kind: 'action_pending', action }, at)
      record = await store.commit(assigned.token, record, { kind: 'action', action }, at)
      if (round < 20) {
        const state = record.snapshot.core, nextTime = time()
        const next = { kind: 'next' as const, source: 'mouse' as const, actionId: state.nextActionId,
          expectedRound: state.round, expectedRevision: state.revision, time: nextTime }
        record = await store.commit(assigned.token, record, { kind: 'action_pending', action: next }, nextTime)
        record = await store.commit(assigned.token, record, { kind: 'action', action: next }, nextTime)
        record = await store.commit(assigned.token, record, { kind: 'arm' }, time())
        record = await store.commit(assigned.token, record, { kind: 'confirm' }, time())
      }
    }
    expect(record.snapshot.core).toMatchObject({ round: 20, status: 'resolved' })
    const coreBefore = structuredClone(record.snapshot.core)
    const retired = await store.settleMock(sessionId, time())
    expect(retired.snapshot.phase).toBe('paused')
    expect(retired.snapshot.core).toEqual(coreBefore)
    expect(await store.settleMock(sessionId, time())).toEqual(retired)
    await expect(store.recover('new-owner', sessionId, time())).rejects.toThrow('mock play cannot resume')
    const fresh = await store.assign('new-owner', 'replay', settings, 'test', time(), undefined, '00000000-0000-4000-8000-000000000021')
    expect(fresh.record.header.identity.stage).toBe('mock')
    expect(fresh.record.header.identity.sessionId).not.toBe(sessionId)
    expect(fresh.record.snapshot.core.round).toBe(1)
  })
  async function setup() { const b = new MemoryBackend(), s = new BalloonsStore(b, b.root.installationId); const a = await s.assign('one', 'auto', settings, 'test', time()); return { b, s, ...a } }
  it('releases pending BL1 with a new chain and unchanged mapping; consumed BL advances only explicit new chain', async () => {
    const { s, token, record } = await setup()
    await s.commit(token, record, { kind: 'release' }, time())
    const b = await s.assign('two', 'auto', settings, 'test', time())
    expect(b.record.header.formId).toBe('BL1'); expect(b.record.header.identity.chainId).not.toBe(record.header.identity.chainId)
    const armed = await s.commit(b.token, b.record, { kind: 'arm' }, time())
    await s.commit(b.token, armed, { kind: 'pause' }, time())
    const c = await s.assign('three', 'auto', settings, 'test', time()); expect(c.record.header.formId).toBe('RP1')
    const d = await s.assign('four', 'new_baseline', settings, 'test', time()); expect(d.record.header.formId).toBe('BL2'); expect(d.record.header.identity.mapping).toEqual(mappingFor('BL2'))
  })
  it('serialized assignments never allocate a reserved form twice; stale owner cannot arm', async () => {
    const { s, record, token } = await setup()
    const next = await Promise.all([s.assign('two', 'replay', settings, 'test', time()), s.assign('three', 'replay', settings, 'test', time())])
    expect(next.map(x => x.record.header.formId)).toEqual(['RP1', 'RP2'])
    await expect(s.commit(token, record, { kind: 'arm' }, time())).rejects.toThrow('ownership')
  })
  it('exhausted RP is explicitly repeat; BL exhaustion never repeats', async () => {
    const { s, record, token } = await setup()
    await s.commit(token, await s.commit(token, record, { kind: 'arm' }, time()), { kind: 'pause' }, time())
    for (let i = 0; i < 3; i++) { const a = await s.assign('owner', 'replay', settings, 'test', time()); await s.commit(a.token, await s.commit(a.token, a.record, { kind: 'arm' }, time()), { kind: 'pause' }, time()) }
    const repeat = await s.assign('owner', 'replay', settings, 'test', time()); expect(repeat.record.header.formId).toBe('RP1'); expect(repeat.record.header.repeat).toBe(true)
    for (let i = 0; i < 2; i++) { const a = await s.assign('owner', 'new_baseline', settings, 'test', time()); await s.commit(a.token, a.record, { kind: 'arm' }, time()) }
    await expect(s.assign('owner', 'new_baseline', settings, 'test', time())).rejects.toThrow('no unseen baseline')
  })
  it.each(['arm', 'confirm', 'action'])('failed %s transaction leaves journal and state atomic', async kind => {
    const { s, b, token, record } = await setup()
    let current = record
    if (kind !== 'arm') current = await s.commit(token, current, { kind: 'arm' }, time())
    if (kind === 'action') current = await s.commit(token, current, { kind: 'confirm' }, time())
    const t = time(), action = { kind: 'pump' as const, actionId: 1, expectedRound: 1, expectedRevision: 0, source: 'mouse' as const, time: t }
    if (kind === 'action') current = await s.commit(token, current, { kind: 'action_pending', action }, t)
    const before = await s.read(); b.fail = true
    await expect(s.commit(token, current, kind === 'action' ? { kind: 'action', action } : { kind: kind as 'arm' | 'confirm' }, t)).rejects.toThrow('abort')
    expect(await b.read()).toEqual(before); b.fail = false
    const resumed = await s.recover('new-owner', token.sessionId, time())
    if (kind !== 'arm') expect(resumed.record.snapshot.comparisonEligible).toBe(false)
  })
  it.each(['pending', 'armed', 'action_pending', 'completed'])('delete and replacement defeat delayed %s work', async phase => {
    const { s, b, record, token } = await setup()
    let current = record
    if (phase !== 'pending') current = await s.commit(token, current, { kind: 'arm' }, time())
    if (phase === 'action_pending') {
      current = await s.commit(token, current, { kind: 'confirm' }, time())
      const t = time(); current = await s.commit(token, current, { kind: 'action_pending', action: { kind: 'collect', actionId: 1, expectedRound: 1, expectedRevision: 0, source: 'mouse', time: t } }, t)
    }
    if (phase === 'completed') { /* Separate coherent completed record used only for deletion authority. */ const full = complete('BL1', 0); const h = { ...full.header, identity: record.header.identity }; let r = createRecord(h); for (const e of full.journal.slice(1)) r = advance(r, e.command!, { wallTimeMs: e.wallTimeMs, monotonicMs: e.monotonicMs, clockEpochId: e.clockEpochId }); b.root.records[token.sessionId] = r; current = r }
    if (phase === 'completed') { const opened = await s.viewReport(token.sessionId, time()); expect(opened.snapshot.core).toEqual(current.snapshot.core); expect(opened.journal.at(-1)?.type).toBe('report_viewed'); current = opened }
    await s.delete(token.sessionId, 123)
    expect((await s.read()).tombstones[token.sessionId].exposure).toBe(current.snapshot.exposure)
    await expect(s.commit(token, current, { kind: 'pause' }, time())).rejects.toThrow()
    await expect(s.viewReport(token.sessionId, time())).rejects.toThrow('deleted')
    await s.deleteAll(); const replacement = await b.read()
    await expect(s.commit(token, current, { kind: 'pause' }, time())).rejects.toThrow('replaced')
    await expect(s.deleteAll()).rejects.toThrow('replaced'); expect(await b.read()).toEqual(replacement)
  })
})

it.each(['pending', 'armed', 'active', 'resolved', 'next', 'paused'])('recovery checkpoint boundary: %s preserves the form/core without inventing a saved failure marker', async phase => {
  let r = create()
  if (phase === 'armed') r = advance(r, { kind: 'arm' }, time())
  if (['active', 'resolved', 'next', 'paused'].includes(phase)) r = confirm(r)
  if (['resolved', 'next'].includes(phase)) r = act(r, 'collect')
  if (phase === 'next') r = act(r, 'next')
  if (phase === 'paused') r = advance(r, { kind: 'pause', reason: 'browser_interruption' }, time())
  const backend = new MemoryBackend(); backend.root.installationId = r.header.identity.installationId
  backend.root.records.session = r; backend.root.generation = 1
  const store = new BalloonsStore(backend, backend.root.installationId)
  const { record } = await store.recover('new-owner', 'session', time())
  expect(record.snapshot.comparisonEligible).toBe(phase === 'paused')
  expect(record.header).toEqual(r.header); expect(record.snapshot.core).toEqual(r.snapshot.core)
  expect(record.snapshot.exposure).toBe(r.snapshot.exposure)
  expect(record.snapshot.confirmedRounds).toEqual(r.snapshot.confirmedRounds)
  expect(record.journal.slice(0, -1)).toEqual(r.journal)
  expect(record.journal.at(-1)?.command).toEqual({ kind: 'recover', reason: 'checkpoint_required_v1' })
  expect(reconcileDurable(record)).toEqual(record)
})
it('legacy recovery journals retain their recorded semantics; new recovery uses an explicit checkpoint policy', () => {
  const old = advance(confirm(create()), { kind: 'recover' }, time(), 2)
  expect(old.snapshot.comparisonEligible).toBe(true)
  expect(reconcileDurable(structuredClone(old))).toEqual(old)
  const current = advance(old, { kind: 'recover', reason: 'checkpoint_required_v1' }, time(), 3)
  expect(current.snapshot.comparisonEligible).toBe(false)
  expect(current.journal.slice(0, -1)).toEqual(old.journal)
  expect(reconcileDurable(current)).toEqual(current)
})
