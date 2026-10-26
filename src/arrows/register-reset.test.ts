import { afterEach, expect, it, vi } from 'vitest'
import { authorityBytes } from './authority'
import { ArrowsStore, freshArrowsRoot, inspectArrowsRoot } from './storage'
import { barrier, installTestLocks, registerFixture, testProfile } from './register-test-support'

const originalLocks = Object.getOwnPropertyDescriptor(navigator, 'locks')
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); if (originalLocks) Object.defineProperty(navigator, 'locks', originalLocks); else Reflect.deleteProperty(navigator, 'locks') })
async function conflicting(kind: 'same revision' | 'higher history') {
  installTestLocks(); const x = await registerFixture()
  await x.store.appendReportView('session', x.snapshot!, 'view', 'live', 2000, x.handle)
  const good = structuredClone(x.backend.root), changed = structuredClone(good)
  if (kind === 'same revision') changed.activity!.session = { ...changed.activity!.session, events: changed.activity!.session.events.map(event => ({ ...event, observedWallMs: 2001 })) }
  else { changed.revision++; delete changed.activity!.session }
  await inspectArrowsRoot(changed)
  x.backend.root = changed
  await expect(x.store.read()).rejects.toThrow()
  expect(x.handle.status().kind).toBe('blocked')
  expect(authorityBytes(x.store.authority.latest())).toBe(authorityBytes(good))
  return { ...x, good, changed }
}
for (const kind of ['same revision', 'higher history'] as const) {
  it(`explicit Delete all replaces durable ${kind} conflict through the existing Store`, async () => {
    const x = await conflicting(kind), before = authorityBytes(x.backend.root)
    await expect(x.store.start({ requestId: 'ordinary', sessionId: 'ordinary', clockDomainId: 'ordinary-clock', atMs: 100, wallMs: 3000, profile: testProfile })).rejects.toThrow()
    expect(authorityBytes(x.backend.root)).toBe(before)
    await expect(x.store.read()).rejects.toThrow(); expect(x.handle.status().kind).toBe('blocked')
    const b = await x.store.deleteAll()
    expect(b.installationId).not.toBe(x.store.installationId)
    expect(await b.read()).toEqual({ ...freshArrowsRoot(), installationId: b.installationId })
    expect(x.handle.status()).toMatchObject({ kind: 'retired', evidence: 'installation_replaced' })
    expect(b.authority.register().integrity).toBe('verified')
    expect(authorityBytes(x.store.authority.latest())).toBe(authorityBytes(x.good))
    const arm = await b.start({ requestId: 'new', sessionId: 'session', clockDomainId: 'new-clock', atMs: 100, wallMs: 3000, profile: testProfile })
    const target = b.authority.handle(arm), bytes = authorityBytes(x.backend.root)
    await expect(x.store.deleteAll()).rejects.toThrow('installation replaced')
    expect(authorityBytes(x.backend.root)).toBe(bytes); expect(target.status().kind).toBe('current')
    x.backend.readNext = async () => x.changed; await x.store.read().catch(() => {})
    expect(target.status().kind).toBe('current'); expect(b.authority.register().integrity).toBe('verified')
  })
  for (const outcome of ['failed', 'aborted'] as const) it(`${outcome} uncommitted reset of ${kind} keeps integrity blocked and does not retire`, async () => {
    const x = await conflicting(kind), bytes = authorityBytes(x.backend.root)
    vi.spyOn(x.backend, 'change').mockImplementation(async work => {
      const candidate = structuredClone(x.backend.root); work(candidate)
      throw Error(`${outcome} before commit`)
    })
    await expect(x.store.deleteAll()).rejects.toThrow(`${outcome} before commit`)
    expect(authorityBytes(x.backend.root)).toBe(bytes)
    expect(x.handle.status().kind).toBe('blocked'); expect(x.store.authority.register().integrity).toBe('blocked')
    expect(authorityBytes(x.store.authority.latest())).toBe(authorityBytes(x.good))
    await expect(x.store.read()).rejects.toThrow(); expect(x.handle.status().kind).toBe('blocked')
  })
}
it('reset successor is confirmed only by durable readback; held or canceled readback cannot adopt a later installation', async () => {
  const x = await conflicting('same revision'), readback = barrier<typeof x.backend.root>()
  vi.useFakeTimers()
  x.backend.readNext = () => readback.promise
  const reset = x.store.deleteAll(); void reset.catch(() => {})
  await vi.waitFor(() => expect(x.backend.readNext).toBeNull())
  const committedB = structuredClone(x.backend.root)
  expect(committedB.installationId).not.toBe(x.store.installationId)
  expect(x.handle.status().kind).toBe('blocked')
  expect(x.store.authority.register().integrity).toBe('blocked')
  // Cancellation releases the ordered action even if committed completion or
  // verification never delivers. A subsequently installed C belongs to C.
  await vi.advanceTimersByTimeAsync(5001)
  await expect(reset).rejects.toThrow('deletion confirmation timed out')
  const c = freshArrowsRoot(); x.backend.root = c
  const current = new ArrowsStore(x.backend, c.installationId)
  const arm = await current.start({ requestId: 'C', sessionId: 'session', clockDomainId: 'C-clock', profile: testProfile, atMs: 100, wallMs: 3000 })
  const child = current.authority.handle(arm), bytes = authorityBytes(x.backend.root)
  readback.release(committedB); await Promise.resolve(); await Promise.resolve()
  expect(authorityBytes(x.backend.root)).toBe(bytes); expect(child.status().kind).toBe('current')
  expect(x.handle.status().kind).not.toBe('current')
  await expect(x.store.deleteAll()).rejects.toThrow('installation replaced')
  expect(authorityBytes(x.backend.root)).toBe(bytes); expect(child.status().kind).toBe('current')
})
