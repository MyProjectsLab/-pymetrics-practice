import { afterEach, expect, it, vi } from 'vitest'
import { advance } from './versions'
import { ArrowsEntry } from './entry'
import { ArrowsRecovery, ARROWS_RECOVERY_TIMEOUT_MS } from './recovery'
import { registerFixture, barrier, installTestLocks } from './register-test-support'
const locks = Object.getOwnPropertyDescriptor(navigator, 'locks')
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); if (locks) Object.defineProperty(navigator, 'locks', locks); else Reflect.deleteProperty(navigator, 'locks') })
for (const kind of ['checkpoint', 'terminal'] as const) for (const deletion of ['individual', 'all'] as const)
  it(`${kind} canceled real Entry/Store read forwards committed ${deletion} root and cannot revive`, async () => {
    installTestLocks(); const x = await registerFixture(), entry = new ArrowsEntry(x.store)
    const state = kind === 'checkpoint' ? x.prefix : advance(x.prefix, { kind: 'invalidate', atMs: x.prefix.commands.at(-1)!.atMs + 1, reason: 'settings' })
    const recovery = new ArrowsRecovery(entry, x.arm, state, kind === 'checkpoint' ? 1 : 0), held = barrier<typeof x.backend.root>(), abort = new AbortController()
    x.backend.readNext = () => held.promise
    const task = kind === 'checkpoint' ? entry.currentBreakExit(x.arm, recovery.authority, abort.signal) : entry.currentTerminal(x.arm, state, abort.signal)
    void task.catch(() => {}); await vi.waitFor(() => expect(x.backend.readNext).toBeNull())
    abort.abort(); await expect(task).rejects.toThrow('canceled'); expect(recovery.outcome().kind).not.toBe('retired')
    if (deletion === 'individual') await x.remote.deleteAttempt('session'); else await x.remote.deleteAll()
    held.release(structuredClone(x.backend.root)); await vi.waitFor(() => expect(recovery.outcome().kind).toBe('retired'))
    const writes = vi.spyOn(x.backend, 'change'); await recovery.recover(); expect(writes).not.toHaveBeenCalled()
  })
it('canceled initial terminal read observes different U without retiring U or arm', async () => {
  installTestLocks(); const x = await registerFixture(), entry = new ArrowsEntry(x.store), atMs = x.prefix.commands.at(-1)!.atMs + 1
  const target = advance(x.prefix, { kind: 'invalidate', atMs, reason: 'settings' }), u = advance(x.prefix, { kind: 'invalidate', atMs, reason: 'technical' })
  const recovery = new ArrowsRecovery(entry, x.arm, target), held = barrier<typeof x.backend.root>(), abort = new AbortController()
  x.backend.readNext = () => held.promise; const task = entry.currentTerminal(x.arm, target, abort.signal); void task.catch(() => {})
  await vi.waitFor(() => expect(x.backend.readNext).toBeNull()); abort.abort(); await expect(task).rejects.toThrow('canceled')
  await x.remote.saveSnapshot(x.arm, u, 1); const bytes = JSON.stringify(x.backend.root.attempts.session)
  held.release(structuredClone(x.backend.root)); await vi.waitFor(() => expect(recovery.outcome().kind).toBe('retired'))
  expect(x.store.authority.handle(x.arm, u).resultStatus().kind).toBe('confirmed'); expect(x.store.authority.handle(x.arm).status().kind).toBe('current')
  await recovery.recover(); expect(JSON.stringify(x.backend.root.attempts.session)).toBe(bytes)
})
for (const snapshot of ['absent', 'checkpoint'] as const) it(`terminal ${snapshot} is ordinary recovery, including a canceled delivery`, async () => {
  installTestLocks(); const x = await registerFixture(1, snapshot === 'checkpoint'), entry = new ArrowsEntry(x.store)
  const state = advance(x.prefix, { kind: 'invalidate', atMs: x.prefix.commands.at(-1)!.atMs + 1, reason: 'settings' })
  const recovery = new ArrowsRecovery(entry, x.arm, state), held = barrier<typeof x.backend.root>(), abort = new AbortController()
  x.backend.readNext = () => held.promise; const task = entry.currentTerminal(x.arm, state, abort.signal); void task.catch(() => {})
  await vi.waitFor(() => expect(x.backend.readNext).toBeNull()); abort.abort(); held.release(structuredClone(x.backend.root)); await expect(task).rejects.toThrow('canceled')
  await vi.waitFor(() => expect(recovery.authority.status().kind).toBe('current'))
  expect((await recovery.recover()).kind).toBe('confirmed'); expect(x.backend.root.attempts.session.snapshot!.kind).toBe('terminal')
})
it('a never-delivered read coalesces until its deadline and a fresh retry is independent', async () => {
  installTestLocks(); const x = await registerFixture(1, false), held = barrier<typeof x.backend.root>()
  const recovery = new ArrowsRecovery(new ArrowsEntry(x.store), x.arm, x.prefix)
  x.backend.readNext = () => held.promise; const a = recovery.recover(), b = recovery.recover(); expect(a).toBe(b)
  await vi.waitFor(() => expect(x.backend.readNext).toBeNull()); vi.useFakeTimers()
  await vi.advanceTimersByTimeAsync(ARROWS_RECOVERY_TIMEOUT_MS); expect((await a).kind).toBe('uncertain'); expect(recovery.pending()).toBe(false)
  vi.useRealTimers(); expect((await recovery.recover()).kind).toBe('confirmed')
  held.release(structuredClone(x.backend.root)); await Promise.resolve(); expect(recovery.outcome().kind).toBe('confirmed')
})
it('immutable target and proven retirement are supplied immediately to later subscribers', async () => {
  installTestLocks(); const x = await registerFixture(), recovery = new ArrowsRecovery(new ArrowsEntry(x.store), x.arm, x.prefix, 1)
  expect(Object.isFrozen(recovery.target.state.events)).toBe(true)
  await x.store.deleteAttempt('session'); const listener = vi.fn(); recovery.subscribe(listener)
  expect(listener.mock.calls[0][0].kind).toBe('retired'); recovery.uncertain('operational'); expect(recovery.outcome().kind).toBe('retired')
})
it('operational failure keeps an absent prefix recoverable and retry saves exact bytes', async () => {
  installTestLocks(); const x = await registerFixture(1, false), recovery = new ArrowsRecovery(new ArrowsEntry(x.store), x.arm, x.prefix)
  x.backend.changeNext = async () => { throw Error('temporary write failure') }
  expect((await recovery.recover(true)).kind).toBe('uncertain'); expect(recovery.authority.status().kind).toBe('current')
  expect((await recovery.recover()).kind).toBe('confirmed'); expect(x.backend.root.attempts.session.snapshot!.state).toEqual(x.prefix)
})
