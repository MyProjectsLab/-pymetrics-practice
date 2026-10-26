import { afterEach, expect, it, vi } from 'vitest'
import { advance } from './versions'
import { freshArrowsRoot } from './storage'
import { authorityBytes } from './authority'
import { registerFixture, barrier, installTestLocks, testProfile } from './register-test-support'
const locks = Object.getOwnPropertyDescriptor(navigator, 'locks')
afterEach(() => { vi.restoreAllMocks(); if (locks) Object.defineProperty(navigator, 'locks', locks); else Reflect.deleteProperty(navigator, 'locks') })
for (const deletion of ['individual', 'all'] as const) it(`verified ${deletion} retirement is absorbing across late older roots`, async () => {
  installTestLocks(); const x = await registerFixture(), old = structuredClone(x.backend.root)
  if (deletion === 'individual') await x.remote.deleteAttempt('session'); else await x.remote.deleteAll()
  await x.store.loadArmed('session').catch(() => {})
  expect(x.handle.status().kind).toBe('retired')
  x.backend.readNext = async () => old
  await x.store.loadArmed('session').catch(() => {})
  expect(x.handle.status().kind).toBe('retired')
})
for (const readFirst of ['positive', 'negative'] as const) for (const deliveryFirst of ['positive', 'negative'] as const)
  it(`${readFirst} read starts first; ${deliveryFirst} validated root arrives first`, async () => {
    installTestLocks(); const x = await registerFixture(), positive = structuredClone(x.backend.root)
    await x.remote.deleteAttempt('session'); const negative = structuredClone(x.backend.root)
    const gates = { positive: barrier<typeof positive>(), negative: barrier<typeof positive>() }
    const invoke = (name: 'positive' | 'negative') => { x.backend.readNext = () => gates[name].promise; return x.store.loadArmed('session') }
    const first = invoke(readFirst); await vi.waitFor(() => expect(x.backend.readNext).toBeNull())
    const other = readFirst === 'positive' ? 'negative' : 'positive', second = invoke(other)
    await vi.waitFor(() => expect(x.backend.readNext).toBeNull())
    const tasks = { [readFirst]: first, [other]: second }
    gates[deliveryFirst].release(deliveryFirst === 'positive' ? positive : negative); await tasks[deliveryFirst]
    expect(x.handle.status().kind).toBe(deliveryFirst === 'negative' ? 'retired' : 'current')
    const remaining = deliveryFirst === 'positive' ? 'negative' : 'positive'
    gates[remaining].release(remaining === 'positive' ? positive : negative); await tasks[remaining]
    expect(x.handle.status().kind).toBe('retired'); expect(x.store.authority.register().revision).toBe(negative.revision)
  })
it('equal-revision full activity conflicts block all saved children; cached good cannot clear; a fresh ordered verification can', async () => {
  installTestLocks(); const x = await registerFixture()
  await x.store.appendReportView('session', x.snapshot!, 'view', 'live', 2000, x.handle)
  const good = structuredClone(x.backend.root), conflicting = structuredClone(good)
  conflicting.activity!.session = { ...conflicting.activity!.session, events: conflicting.activity!.session.events.map(event => ({ ...event, observedWallMs: 2001 })) }
  x.backend.readNext = async () => conflicting
  await expect(x.store.read()).rejects.toThrow('conflicting content')
  expect(x.handle.status().kind).toBe('blocked'); expect(x.store.authority.handle(x.arm).status().kind).toBe('blocked')
  await expect(x.store.read()).rejects.toThrow('integrity blocked'); expect(x.handle.status().kind).toBe('blocked')
  const bytes = authorityBytes(x.backend.root)
  await expect(x.store.appendReportView('session', x.snapshot!, 'view2', 'live', 2002, x.handle)).rejects.toThrow()
  expect(authorityBytes(x.backend.root)).toBe(bytes)
  await x.store.verifyIntegrity(); expect(x.handle.status().kind).toBe('current')
})
for (const conflict of ['counter', 'tombstone', 'snapshot', 'arm', 'activity'] as const)
  it(`contradictory individually valid higher-revision ${conflict} history blocks without inventing retirement`, async () => {
    installTestLocks(); const x = await registerFixture()
    const arm2 = await x.store.start({ requestId: 'second', sessionId: 'second', clockDomainId: 'second-clock', profile: testProfile, atMs: 100, wallMs: 2000 })
    if (conflict === 'activity') await x.store.appendReportView('session', x.snapshot!, 'view', 'live', 2000, x.handle)
    if (conflict === 'tombstone') await x.store.deleteAttempt(arm2.sessionId)
    const changed = structuredClone(x.backend.root); changed.revision++
    if (conflict === 'counter') { delete changed.attempts.second; changed.scoredStartCountV11!-- }
    if (conflict === 'tombstone') { delete changed.tombstones.second; changed.attempts.second = arm2 }
    if (conflict === 'snapshot') changed.attempts.session = x.arm
    if (conflict === 'arm') changed.attempts.session = { ...changed.attempts.session, requestId: 'other-request' }
    if (conflict === 'activity') delete changed.activity!.session
    x.backend.readNext = async () => changed
    await expect(x.store.read()).rejects.toThrow(/regressed|history|original arm/)
    expect(x.handle.status().kind).toBe('blocked')
    expect(x.store.authority.handle(x.arm).status().kind).toBe('blocked')
  })
it('a legal checkpoint to different terminal retires only challenged prefix/terminal children and preserves U and arm', async () => {
  installTestLocks(); const x = await registerFixture()
  const t = x.prefix.commands.at(-1)!.atMs + 1
  const challenged = x.store.authority.handle(x.arm, advance(x.prefix, { kind: 'invalidate', atMs: t, reason: 'settings' }))
  const u = advance(x.prefix, { kind: 'invalidate', atMs: t, reason: 'technical' })
  await x.remote.saveSnapshot(x.arm, u, 1); await x.store.read()
  expect(x.handle.status().kind).toBe('retired'); expect(challenged.status().kind).toBe('retired')
  expect(x.store.authority.handle(x.arm, u).resultStatus().kind).toBe('confirmed')
  expect(x.store.authority.handle(x.arm).status().kind).toBe('current')
})
it('committed preimage observes retirement before a failed activity fallback; an uncommitted candidate never becomes evidence', async () => {
  installTestLocks(); const x = await registerFixture(), write = barrier<void>(), fallback = barrier<typeof x.backend.root>()
  x.backend.changeNext = () => write.promise
  const activity = x.store.appendReportView('session', x.snapshot!, 'view', 'live', 2000, x.handle); void activity.catch(() => {})
  await vi.waitFor(() => expect(x.backend.changeNext).toBeNull()); await x.remote.deleteAttempt('session')
  x.backend.readNext = () => fallback.promise; write.release()
  await vi.waitFor(() => expect(x.handle.status().kind).toBe('retired'))
  fallback.release(structuredClone(x.backend.root)); await expect(activity).rejects.toThrow()
  const y = await registerFixture(1, false), before = authorityBytes(y.backend.root)
  const change = y.backend.change.bind(y.backend)
  vi.spyOn(y.backend, 'change').mockImplementation(async work => {
    const root = structuredClone(y.backend.root); work(root); throw Error('uncommitted write failure')
  })
  await expect(y.store.saveSnapshot(y.arm, y.prefix, 0)).rejects.toThrow('uncommitted')
  expect(authorityBytes(y.backend.root)).toBe(before); expect(y.handle.resultStatus().kind).toBe('recoverable')
  vi.spyOn(y.backend, 'change').mockImplementation(change)
  await y.store.saveSnapshot(y.arm, y.prefix, 0); expect(y.handle.resultStatus().kind).toBe('confirmed')
})
it('A-to-B observations never route a delayed A root into B, including reused session IDs', async () => {
  installTestLocks(); const x = await registerFixture(), old = structuredClone(x.backend.root)
  const b = await x.store.deleteAll()
  const arm = await b.start({ requestId: 'B-request', sessionId: 'session', clockDomainId: 'B-clock', profile: testProfile, atMs: 100, wallMs: 2000 })
  const child = b.authority.handle(arm)
  x.backend.readNext = async () => old; await x.store.read().catch(() => {})
  expect(x.handle.status().kind).toBe('retired'); expect(child.status().kind).toBe('current')
  expect(b.authority.register().revision).toBe(1)
})
it('pre-witness lower revision roots cannot retire a newly admitted arm or bind an unwitnessed snapshot', async () => {
  installTestLocks(); const x = await registerFixture(), old = { ...freshArrowsRoot(), installationId: x.store.installationId }
  x.backend.readNext = async () => old; await x.store.read()
  expect(x.handle.status().kind).toBe('current')
  expect(() => x.store.authority.handle(x.arm, x.prefix, { ...x.snapshot!, revision: 2 })).toThrow('no verified witness')
  expect(x.handle.status().kind).toBe('current')
})
it('operational and malformed reads do not invent authority loss; ordinary reads cannot resolve a conflict', async () => {
  installTestLocks(); const x = await registerFixture()
  x.backend.readNext = async () => { throw Error('temporarily unavailable') }; await expect(x.store.read()).rejects.toThrow('temporarily')
  const malformed = structuredClone(x.backend.root); malformed.version = 'unsupported' as never
  x.backend.readNext = async () => malformed; await expect(x.store.read()).rejects.toThrow('unsupported')
  expect(x.handle.status().kind).toBe('current')
})
it('wrong-origin provenance is rejected without poisoning another store/register', async () => {
  installTestLocks(); const x = await registerFixture()
  expect(() => x.store.authority.observe(x.backend.root, x.remote.authority.provenance('read'))).toThrow('provenance')
  expect(x.handle.status().kind).toBe('current')
})

it('activity-only r5, r7, r6 delivery is monotone and identical canonical same-revision content is a no-op', async () => {
  installTestLocks(); const x = await registerFixture(); await x.remote.read()
  const target = x.remote.authority.handle(x.arm, x.prefix, x.snapshot!)
  const roots: typeof x.backend.root[] = []
  for (let index = 0; index < 5; index++) { await x.remote.appendReportView('session', x.snapshot!, `view-${index}`, 'history', 2000 + index, target); roots.push(structuredClone(x.backend.root)) }
  const r5 = roots[2], r7 = roots[4], r6 = roots[3]
  for (const root of [r5, r7, r6]) { x.backend.readNext = async () => root; await x.store.read() }
  expect(x.store.authority.register()).toMatchObject({ revision: 7, integrity: 'verified' })
  expect(x.store.authority.latest()!.activity!.session.events).toHaveLength(5)
  const reordered = Object.fromEntries(Object.entries(r7).reverse()) as typeof r7
  x.backend.readNext = async () => reordered; await x.store.read()
  expect(x.handle.status().kind).toBe('current'); expect(x.store.authority.register().integrity).toBe('verified')
})

it('a newly retained arm cannot reuse a previously consumed ordinal under a newer valid root', async () => {
  installTestLocks(); const x = await registerFixture()
  await x.store.start({ requestId: 'second', sessionId: 'second', clockDomainId: 'second-clock', profile: testProfile, atMs: 100, wallMs: 2000 })
  await x.store.deleteAttempt('session')
  const before = structuredClone(x.backend.root)
  const third = await x.remote.start({ requestId: 'third', sessionId: 'third', clockDomainId: 'third-clock', profile: testProfile, atMs: 100, wallMs: 3000 })
  const { armHeadless } = await import('./v11/engine'), { loadArrowsForms } = await import('./v11/manifests')
  const reused = structuredClone(x.backend.root)
  reused.attempts.third = { ...third, ordinal: 1, state: armHeadless((await loadArrowsForms()).get('AR11-1')!, third.state.identity, third.profile, third.state.armedAtMs) }
  x.backend.readNext = async () => reused
  await expect(x.store.read()).rejects.toThrow('invalid arm identity')
  expect(x.store.authority.register().integrity).toBe('verified')
  expect(x.store.authority.latest()!.revision).toBe(before.revision)
})

it('an explicit verification dispatched before a later conflict cannot clear that conflict on late good delivery', async () => {
  installTestLocks(); const x = await registerFixture(), held = barrier<typeof x.backend.root>(), good = structuredClone(x.backend.root)
  x.backend.readNext = () => held.promise
  const verification = x.store.verifyIntegrity(); void verification.catch(() => {})
  await vi.waitFor(() => expect(x.backend.readNext).toBeNull())
  const conflict = structuredClone(good); conflict.attempts.session = { ...conflict.attempts.session, requestId: 'conflicting-request' }
  x.backend.readNext = async () => conflict; await expect(x.store.read()).rejects.toThrow('same revision')
  held.release(good); await expect(verification).rejects.toThrow('integrity blocked')
  expect(x.handle.status().kind).toBe('blocked')
  await x.store.verifyIntegrity(); expect(x.handle.status().kind).toBe('current')
})

it('an unwitnessed future arm remains unknown despite an equal or higher counter, then acquires its actual admission witness', async () => {
  installTestLocks(); const x = await registerFixture(), { armHeadless } = await import('./v11/engine'), { loadArrowsForms } = await import('./v11/manifests')
  const forms = await loadArrowsForms()
  const future = { requestId: 'future', sessionId: 'future', clockDomainId: 'future-clock', profile: testProfile, ordinal: 3, createdAtWallMs: 3000,
    state: armHeadless(forms.get('AR11-3')!, { installationId: x.store.installationId, sessionId: 'future', clockDomainId: 'future-clock' }, testProfile, 100) }
  const handle = x.store.authority.handle(future)
  await x.store.start({ requestId: 'second', sessionId: 'second', clockDomainId: 'second-clock', profile: testProfile, atMs: 100, wallMs: 2000 })
  expect(handle.status().kind).toBe('unknown')
  await x.store.start({ requestId: 'future', sessionId: 'future', clockDomainId: 'future-clock', profile: testProfile, atMs: 100, wallMs: 3000 })
  expect(handle.status().kind).toBe('current'); expect(handle.witnessRevision).toBe(x.backend.root.revision)
  const unwitnessed = x.store.authority.handle({ ...future, requestId: 'not-admitted', sessionId: 'not-admitted', state: armHeadless(forms.get('AR11-3')!, { ...future.state.identity, sessionId: 'not-admitted' }, testProfile, 100) })
  expect(unwitnessed.status().kind).toBe('unknown')
})
