import { beforeAll, describe, expect, it } from 'vitest'
import { advanceDigits } from './engine'
import { loadDigitsForms } from './forms'
import { DigitsPersistence } from './persistence'
import { DigitsStore, freshDigitsRoot } from './storage'
import type { DigitsBackend, DigitsRoot, ArmRequest } from './storage'
import { closeTrial, visual } from './test-support'
class Backend implements DigitsBackend {
  root: DigitsRoot = freshDigitsRoot()
  rejectWrite = false
  rejectRead = false
  holdDelivery = false
  release: (() => void) | null = null
  async read() { if (this.rejectRead) throw Error('read unavailable'); return structuredClone(this.root) }
  async change<T>(operation: (root: DigitsRoot) => T) {
    if (this.rejectWrite) throw Error('write failed')
    const draft = structuredClone(this.root); const result = operation(draft); this.root = draft
    if (this.holdDelivery) { this.holdDelivery = false
      await new Promise<void>(resolve => { this.release = resolve }) }
    return structuredClone(result)
  }
}
const request: ArmRequest = { requestId: 'request', sessionId: 'session', clockDomainId: 'clock',
  profile: visual, route: 'standalone', atMs: 0, wallMs: 1 }
beforeAll(() => Object.defineProperty(navigator, 'locks', { configurable: true,
  value: { request: (_name: string, _options: unknown, work: () => unknown) => work() } }))
async function setup() {
  const backend = new Backend()
  const store = new DigitsStore(backend, backend.root.installationId, await loadDigitsForms())
  const arm = await store.arm(request)
  const checkpoint = closeTrial(advanceDigits(arm.arm, { kind: 'start', atMs: 0 }), true)
  return { backend, store, arm, checkpoint, persistence: new DigitsPersistence(store, arm) }
}
describe('Digits checkpoint/lifecycle delivery coordination', () => {
  it('retries exact checkpoint bytes after genuine failure and verifies the readback', async () => {
    const { backend, store, arm, checkpoint, persistence } = await setup()
    backend.rejectWrite = true
    await expect(persistence.save(checkpoint)).rejects.toThrow('write failed')
    expect((await store.load(arm.sessionId))?.snapshot).toBeUndefined()
    backend.rejectWrite = false
    const saved = await persistence.save(checkpoint)
    expect(saved.state).toEqual(checkpoint)
    expect(saved.kind).toBe('checkpoint')
  })
  it('reconciles a committed held checkpoint before extending to a lifecycle terminal', async () => {
    const { backend, store, arm, checkpoint, persistence } = await setup()
    backend.holdDelivery = true
    const pending = persistence.save(checkpoint)
    await new Promise(resolve => setTimeout(resolve, 0))
    const invalid = advanceDigits(checkpoint, { kind: 'invalidate', atMs: checkpoint.events.at(-1)!.atMs + 1, reason: 'blur' })
    const terminal = await persistence.save(invalid)
    expect(terminal.kind).toBe('terminal')
    expect(terminal.state.events.slice(0, checkpoint.events.length)).toEqual(checkpoint.events)
    backend.release!()
    await expect(pending).rejects.toThrow('snapshot prefix changed')
    expect((await store.load(arm.sessionId))?.snapshot?.state).toEqual(invalid)
  })
  it('same-byte readback/retry succeeds despite held callback; deletion still retires terminal', async () => {
    const { backend, store, arm, checkpoint, persistence } = await setup()
    backend.holdDelivery = true
    const pending = persistence.save(checkpoint)
    await new Promise(resolve => setTimeout(resolve, 0))
    expect((await persistence.save(checkpoint)).state).toEqual(checkpoint)
    await store.deleteAttempt(arm.sessionId)
    const invalid = advanceDigits(checkpoint, { kind: 'invalidate', atMs: checkpoint.events.at(-1)!.atMs + 1, reason: 'hidden' })
    await expect(persistence.save(invalid)).rejects.toThrow()
    backend.release!(); await expect(pending).rejects.toThrow()
    expect(await store.load(arm.sessionId)).toBeNull()
  })
  it('does not turn failed readback into saved output', async () => {
    const { backend, checkpoint, persistence } = await setup()
    backend.rejectRead = true
    await expect(persistence.save(checkpoint)).rejects.toThrow('read unavailable')
    expect(backend.root.attempts.session.snapshot?.state).toEqual(checkpoint)
    backend.rejectRead = false
    expect((await persistence.save(checkpoint)).state).toEqual(checkpoint)
  })
})
