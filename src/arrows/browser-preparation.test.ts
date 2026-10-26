import { afterEach, expect, it, vi } from 'vitest'
import { ArrowsBrowserRun } from './browser'
import { ArrowsEntry } from './entry'
import { ArrowsStore } from './storage'
import { RegisterBackend, barrier, installTestLocks, registerFixture, testProfile } from './register-test-support'
import type { State } from './versions'
const preparation = vi.hoisted(() => ({ wait: Promise.resolve(1) }))
vi.mock('./v11/static-surface', async () => {
  const { ArrowsStaticSurface: Port } = await import('./static-surface-test-support')
  return { ArrowsStaticSurface: class extends Port { override prepare() { return preparation.wait } } }
})
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); document.body.replaceChildren(); preparation.wait = Promise.resolve(1) })
function host() { const node = document.createElement('div'); document.body.append(node); return node }
function environment() { vi.spyOn(document, 'hasFocus').mockReturnValue(true); vi.stubGlobal('requestAnimationFrame', () => 1); vi.stubGlobal('cancelAnimationFrame', () => {}); return installTestLocks() }
it('snapshots the complete Start request before the new asynchronous preparation boundary', async () => {
  environment()
  const backend = new RegisterBackend(), store = new ArrowsStore(backend, backend.root.installationId), gate = barrier<number>()
  preparation.wait = gate.promise
  const run = new ArrowsBrowserRun(new ArrowsEntry(store), host(), () => {}, () => 1000, true)
  vi.spyOn(run, 'layoutReady').mockReturnValue(true)
  const request = { requestId: 'prepare-owned', sessionId: 'session-owned', clockDomainId: 'clock-owned', atMs: 100, wallMs: 1000, profile: { ...testProfile, leftCode: String(testProfile.leftCode) } }
  const pending = run.begin(request)
  request.profile.leftCode = 'KeyA'; request.sessionId = 'changed'
  expect(backend.root.scoredStartCountV11).toBe(0)
  gate.release(1); await pending
  expect(run.armedAttempt()?.sessionId).toBe('session-owned')
  expect(run.armedAttempt()?.profile).toEqual(expect.objectContaining({ kind: 'keyboard', leftCode: 'ArrowLeft' }))
  expect(backend.root.scoredStartCountV11).toBe(1); run.dispose()
})
for (const mutation of ['individual', 'all'] as const) it(`holds preparation across ${mutation} deletion of the retried committed arm without resurrection`, async () => {
  environment()
  const backend = new RegisterBackend(), store = new ArrowsStore(backend, backend.root.installationId), gate = barrier<number>()
  const request = { requestId: `prepare-retry-${mutation}`, sessionId: 'session', clockDomainId: 'clock', atMs: 100, wallMs: 1000, profile: testProfile }
  await store.start(request)
  preparation.wait = gate.promise
  const run = new ArrowsBrowserRun(new ArrowsEntry(store), host(), () => {}, () => 1000, true)
  vi.spyOn(run, 'layoutReady').mockReturnValue(true)
  const pending = run.begin(request); void pending.catch(() => {})
  if (mutation === 'individual') await store.deleteAttempt('session'); else await store.deleteAll()
  const deleted = structuredClone(backend.root)
  gate.release(1); await expect(pending).rejects.toThrow()
  expect(run.snapshot()).toBeNull(); expect(backend.root).toEqual(deleted); run.dispose()
})
for (const mutation of ['individual', 'all', 'cancel'] as const) it(`fences Continue ${mutation} while retained-image preparation is pending`, async () => {
  environment()
  const x = await registerFixture(), entry = new ArrowsEntry(x.store), gate = barrier<number>()
  const owner = entry as unknown as { active: boolean; controller: AbortController; currentRequestId: string }
  owner.active = true; owner.controller = new AbortController(); owner.currentRequestId = x.arm.requestId
  const run = new ArrowsBrowserRun(entry, host(), () => {}, () => x.prefix.commands.at(-1)!.atMs + 100)
  const internal = run as unknown as { state: State; attempt: typeof x.arm; checkpointRevision: number }
  internal.state = x.prefix; internal.attempt = x.arm; internal.checkpointRevision = 1
  vi.spyOn(run, 'layoutReady').mockReturnValue(true)
  preparation.wait = gate.promise
  const pending = run.continue(); void pending.catch(() => {})
  if (mutation === 'cancel') run.dispose(); else if (mutation === 'individual') await x.remote.deleteAttempt('session'); else await x.remote.deleteAll()
  const saved = structuredClone(x.backend.root)
  gate.release(1); await expect(pending).rejects.toThrow()
  expect(run.snapshot()?.commands.some(command => command.kind === 'continue')).toBe(false)
  expect(x.backend.root).toEqual(saved); run.dispose()
})
