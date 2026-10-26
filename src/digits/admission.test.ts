import { beforeAll, describe, expect, it } from 'vitest'
import { DigitsAdmission } from './admission'
import { loadDigitsForms } from './forms'
import { DigitsStore, freshDigitsRoot } from './storage'
import type { ArmRequest, DigitsBackend, DigitsRoot } from './storage'
import { visual } from './test-support'

class Backend implements DigitsBackend {
  root: DigitsRoot = freshDigitsRoot()
  hold: 'before' | 'after' | null = null
  release: (() => void) | null = null
  rejectRead = false
  rejectWrite = false
  async read() { if (this.rejectRead) throw Error('read unavailable'); return structuredClone(this.root) }
  async change<T>(operation: (root: DigitsRoot) => T, signal?: AbortSignal) {
    if (signal?.aborted) throw Error('operation canceled')
    if (this.rejectWrite) throw Error('write failed')
    const held = this.hold; this.hold = null
    const wait = () => new Promise<void>((resolve, reject) => {
      const abort = () => reject(Error('operation canceled'))
      signal?.addEventListener('abort', abort, { once: true })
      this.release = () => { signal?.removeEventListener('abort', abort); resolve() }
    })
    if (held === 'before') await wait()
    if (signal?.aborted) throw Error('operation canceled')
    const draft = structuredClone(this.root), result = operation(draft); this.root = draft
    if (held === 'after') await wait()
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
  return { backend, store, admission: new DigitsAdmission(store, request) }
}
const turn = () => new Promise(resolve => setTimeout(resolve, 0))
describe('Digits pending Start lifecycle reconciliation', () => {
  it.each(['blur', 'hidden', 'freeze', 'page_exit', 'setup_changed'])('saves committed-undelivered arm as zero-onset Invalid after %s, then consumes a fresh position', async reason => {
    const { backend, store, admission } = await setup()
    backend.hold = 'after'; const pending = admission.arm().catch(error => error); await turn()
    const original = structuredClone(backend.root.attempts.session.arm)
    admission.cancel(reason, 10)
    const known = (await admission.reconcileCancellation())!
    expect(known.state.phase).toBe('invalid'); expect(known.state.invalidReason).toBe(reason)
    expect(known.state.events.slice(0, original.events.length)).toEqual(original.events)
    expect(known.state.presentedTrials).toBe(0)
    expect(known.state.events.filter(event => event.type === 'invalidated')).toHaveLength(1)
    const saved = await store.save(known.attempt, known.state)
    expect(saved.kind).toBe('terminal')
    await expect(admission.arm()).rejects.toThrow('cannot be resumed')
    backend.release!(); await pending
    expect(backend.root.attempts.session.snapshot?.state).toEqual(known.state)
    const fresh = await store.arm({ ...request, sessionId: 'new_session', requestId: 'new_request' })
    expect(fresh.ordinal).toBe(2); expect(fresh.arm.form.id).toBe('DV2')
  })
  it.each(['blur', 'setup_changed'])('cancels before commit without inventing a scored arm or journal after %s', async reason => {
    const { backend, admission } = await setup()
    backend.hold = 'before'; const pending = admission.arm().catch(error => error); await turn()
    admission.cancel(reason, 10)
    expect(await admission.reconcileCancellation()).toBeNull()
    backend.release!(); await pending
    expect(backend.root.counters.visual).toBe(0)
    expect(backend.root.attempts).toEqual({})
  })
  it('timeout alone can retry identical arm, while a subsequent observation permanently cancels it', async () => {
    const { backend, store, admission } = await setup()
    backend.hold = 'after'; const pending = admission.arm().catch(error => error); await turn()
    const retried = await admission.arm()
    expect(retried.ordinal).toBe(1); expect(backend.root.counters.visual).toBe(1)
    admission.cancel('hidden', 50); admission.cancel('blur', 60)
    const known = (await admission.reconcileCancellation())!
    expect(known.state.invalidReason).toBe('hidden')
    expect(known.state.commands.at(-1)?.atMs).toBe(50)
    await store.save(known.attempt, known.state)
    backend.release!(); await pending
    expect(backend.root.counters.visual).toBe(1)
    await expect(admission.arm()).rejects.toThrow('cannot be resumed')
  })
  it('failed authority read retains cancellation, and failed save retries exact terminal bytes', async () => {
    const { backend, store, admission } = await setup()
    await admission.arm(); admission.cancel('blur', 10)
    backend.rejectRead = true
    await expect(admission.reconcileCancellation()).rejects.toThrow('read unavailable')
    await expect(admission.arm()).rejects.toThrow('cannot be resumed')
    backend.rejectRead = false
    const known = (await admission.reconcileCancellation())!
    backend.rejectWrite = true
    await expect(store.save(known.attempt, known.state)).rejects.toThrow('write failed')
    backend.rejectWrite = false
    admission.cancel('hidden', 20)
    expect((await admission.reconcileCancellation())?.state).toBe(known.state)
    expect((await store.save(known.attempt, known.state)).state).toEqual(known.state)
  })
  it.each(['one', 'all'])('deletion/replacement %s cannot reconstruct canceled arm authority', async type => {
    const { backend, store, admission } = await setup()
    await admission.arm(); admission.cancel('blur', 10)
    if (type === 'one') { await store.deleteAttempt(request.sessionId)
      expect(await admission.reconcileCancellation()).toBeNull() }
    else { await store.deleteAll()
      await expect(admission.reconcileCancellation()).rejects.toThrow('installation replaced') }
    expect(backend.root.attempts).toEqual({})
    await expect(admission.arm()).rejects.toThrow('cannot be resumed')
  })
})
