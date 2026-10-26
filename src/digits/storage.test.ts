import { beforeAll, describe, expect, it } from 'vitest'
import { closeTrial, nextTrial } from './test-support'
import { advanceDigits } from './engine'
import { loadDigitsForms } from './forms'
import { DigitsStore, freshDigitsRoot } from './storage'
import type { DigitsBackend, DigitsRoot, ArmRequest } from './storage'

class MemoryBackend implements DigitsBackend {
  root: DigitsRoot = freshDigitsRoot()
  loseNextDelivery = false
  async read() { return structuredClone(this.root) }
  async change<T>(operation: (root: DigitsRoot) => T): Promise<T> {
    const draft = structuredClone(this.root)
    const result = operation(draft)
    this.root = draft
    if (this.loseNextDelivery) { this.loseNextDelivery = false; throw Error('completion callback lost') }
    return structuredClone(result)
  }
}
const profile: ArmRequest['profile'] = { mode: 'visual', entryWindow: 20000,
  highContrast: false, reducedMotion: true, entryMethod: 'keyboard',
  assistedEntryDeclared: false, voice: null,
  browserContext: { userAgent: 'test', viewportWidth: 1280, viewportHeight: 720,
    devicePixelRatio: 1 } }
const request: ArmRequest = { requestId: 'request_1', sessionId: 'session_1',
  clockDomainId: 'clock_1', route: 'standalone', profile, atMs: 0, wallMs: 100 }
beforeAll(() => Object.defineProperty(navigator, 'locks', { configurable: true,
  value: { request: (_name: string, _options: unknown, work: () => unknown) => work() } }))
async function setup() {
  const backend = new MemoryBackend()
  const store = new DigitsStore(backend, backend.root.installationId, await loadDigitsForms())
  return { backend, store }
}
describe('Digits durable authority', () => {
  it('rotates visual ordinal seven to a previously used form and saves a normal 40-trial limit', async () => {
    const { store } = await setup()
    const arms = []
    for (let ordinal = 1; ordinal <= 7; ordinal++) {
      arms.push(await store.arm({ ...request, requestId: `request_${ordinal}`,
        sessionId: `session_${ordinal}`, clockDomainId: `clock_${ordinal}` }))
    }
    expect(arms.map(item => item.arm.form.id)).toEqual(['DV1','DV2','DV3','DV4','DV5','DV6','DV1'])
    expect(arms[6].ordinal).toBe(7)
    let state = advanceDigits(arms[6].arm, { kind: 'start', atMs: 0 })
    for (let trial = 1; trial <= 40; trial++) {
      state = closeTrial(state, true)
      if (trial < 40) state = nextTrial(state)
    }
    expect(state.phase).toBe('completed')
    expect(state.completionReason).toBe('practice_limit_reached')
    const terminal = await store.save(arms[6], state)
    expect(terminal.review.status).toBe('valid')
    if (terminal.review.status !== 'valid') throw Error('Expected valid Digits practice-cap review')
    expect(terminal.review.completionReason).toBe('practice_limit_reached')
  })
  it('arms exactly once per request and rotates modes independently', async () => {
    const { store, backend } = await setup()
    const first = await store.arm(request)
    expect(first.arm.form.id).toBe('DV1')
    expect((await store.arm(request)).ordinal).toBe(1)
    expect(backend.root.counters).toEqual({ visual: 1, auditory: 0 })
    await expect(store.arm({ ...request, sessionId: 'different' })).rejects.toThrow()
    const next = await store.arm({ ...request, requestId: 'request_2', sessionId: 'session_2' })
    expect(next.arm.form.id).toBe('DV2')
    const auditory: ArmRequest = { ...request, requestId: 'request_3',
      sessionId: 'session_3', profile: { ...profile, mode: 'auditory',
        voice: { voiceURI: 'local', lang: 'en-US', localService: true } } }
    expect((await store.arm(auditory)).arm.form.id).toBe('DA1')
    expect((await store.read()).counters).toEqual({ visual: 2, auditory: 1 })
  })
  it('keeps immutable checkpoint prefixes and verifies terminal bytes', async () => {
    const { store, backend } = await setup()
    const arm = await store.arm(request)
    let state = advanceDigits(arm.arm, { kind: 'start', atMs: 0 })
    for (let i = 0; i < 6; i++) {
      state = closeTrial(state, i % 2 === 0)
      if (state.phase === 'feedback') {
        const checkpoint = await store.save(arm, state)
        expect(checkpoint.review.status).toBe('incomplete')
        expect((await store.save(arm, state)).revision).toBe(checkpoint.revision)
        state = nextTrial(state)
      }
    }
    const terminal = await store.save(arm, state)
    expect(terminal.review.status).toBe('valid')
    expect((await store.load(arm.sessionId))?.snapshot?.review).toEqual(terminal.review)
    expect(backend.root.attempts[arm.sessionId].snapshot?.state.events).toEqual(state.events)
    const event = await store.appendReportView(arm.sessionId, 'view_1', 'live', 101)
    expect(event.sequenceNumber).toBe(1)
    expect((await store.appendReportView(arm.sessionId, 'view_1', 'live', 101)).sequenceNumber).toBe(1)
    await expect(store.save(arm, { ...state, closed: [{ ...state.closed[0], answer: '123' }, ...state.closed.slice(1)] }))
      .rejects.toThrow()
  })
  it('tombstones one attempt and replaces the whole installation without resurrection', async () => {
    const { store, backend } = await setup()
    const arm = await store.arm(request)
    const invalid = advanceDigits(arm.arm, { kind: 'invalidate', atMs: 1, reason: 'blur' })
    await store.deleteAttempt(arm.sessionId)
    expect((await store.read()).counters.visual).toBe(1)
    await expect(store.save(arm, invalid)).rejects.toThrow()
    await expect(store.arm(request)).rejects.toThrow()
    const replacement = await store.deleteAll()
    expect(backend.root.counters).toEqual({ visual: 0, auditory: 0 })
    expect(await replacement.list()).toEqual([])
    await expect(store.arm({ ...request, requestId: 'old_reuse', sessionId: 'new_session' }))
      .rejects.toThrow('installation replaced')
    expect((await replacement.arm(request)).arm.form.id).toBe('DV1')
  })
  it('recovers an arm, terminal save, and deletion only from durable readback', async () => {
    const { store, backend } = await setup()
    backend.loseNextDelivery = true
    const arm = await store.arm(request)
    expect(arm.ordinal).toBe(1)
    expect(backend.root.counters.visual).toBe(1)
    const invalid = advanceDigits(arm.arm, { kind: 'invalidate', atMs: 1, reason: 'blur' })
    backend.loseNextDelivery = true
    const snapshot = await store.save(arm, invalid)
    expect(snapshot.review.status).toBe('invalid')
    backend.loseNextDelivery = true
    await store.deleteAttempt(arm.sessionId)
    expect(await store.load(arm.sessionId)).toBeNull()
    await expect(store.save(arm, invalid)).rejects.toThrow()
  })
  it('does not let a delayed older root roll back an observed tombstone', async () => {
    const { store, backend } = await setup()
    const arm = await store.arm(request)
    const older = structuredClone(backend.root)
    await store.deleteAttempt(arm.sessionId)
    const current = structuredClone(backend.root)
    const original = backend.read.bind(backend)
    backend.read = async () => older
    expect((await store.read()).tombstones[arm.sessionId]).toEqual(current.tombstones[arm.sessionId])
    backend.read = original
  })
  it('rejects a write based on a root older than the observed deletion', async () => {
    const { store, backend } = await setup()
    const arm = await store.arm(request)
    const older = structuredClone(backend.root)
    await store.deleteAttempt(arm.sessionId)
    const current = structuredClone(backend.root)
    backend.root = older
    await expect(store.arm({ ...request, requestId: 'request_2', sessionId: 'session_2' }))
      .rejects.toThrow('stale write root')
    expect(backend.root).toEqual(older)
    backend.root = current
    expect((await store.read()).tombstones[arm.sessionId]).toBeDefined()
  })
  it.each(['individual', 'delete-all'] as const)(
    'does not confirm a late terminal save after %s deletion', async deletion => {
      const { store, backend } = await setup()
      const arm = await store.arm(request)
      const terminal = advanceDigits(arm.arm, { kind: 'invalidate', atMs: 1, reason: 'blur' })
      const original = backend.change.bind(backend)
      let release!: () => void, committed!: () => void
      const reachedCommit = new Promise<void>(resolve => { committed = resolve })
      backend.change = async operation => {
        const result = await original(operation)
        backend.change = original
        committed()
        await new Promise<void>(resolve => { release = resolve })
        return result
      }
      const pending = store.save(arm, terminal)
      await reachedCommit
      if (deletion === 'individual') await store.deleteAttempt(arm.sessionId)
      else await store.deleteAll()
      release()
      await expect(pending).rejects.toThrow()
      if (deletion === 'individual') {
        expect((await store.read()).attempts[arm.sessionId]).toBeUndefined()
        expect((await store.read()).tombstones[arm.sessionId]).toBeDefined()
      } else await expect(store.read()).rejects.toThrow('installation replaced')
    })
})

it('retains historical report activity when a live checkpoint later extends', async () => {
  const { store } = await setup()
  const arm = await store.arm(request)
  let state = closeTrial(advanceDigits(arm.arm, { kind: 'start', atMs: 0 }), false)
  const checkpoint = await store.save(arm, state)
  const view = await store.appendReportView(arm.sessionId, 'checkpoint_view', 'history', 101)
  expect(view.resultRevision).toBe(checkpoint.revision)
  state = advanceDigits(state, { kind: 'invalidate', atMs: state.events.at(-1)!.atMs + 1, reason: 'blur' })
  const terminal = await store.save(arm, state)
  expect(terminal.revision).toBeGreaterThan(checkpoint.revision)
  expect((await store.read()).activity[arm.sessionId][0]).toEqual(view)
})

it('rejects unsupported V1.0 root and mixed form/scoring identities without reinterpretation', async () => {
  const { store, backend } = await setup()
  const arm = await store.arm(request)
  const original = structuredClone(backend.root)
  Object.assign(backend.root, { version: 'digits_storage_v1_0' })
  await expect(store.read()).rejects.toThrow('unsupported root')
  backend.root = original
  Object.assign(backend.root.attempts[arm.sessionId].arm, { scoringVersion: 'digits_scoring_v1_0' })
  await expect(store.read()).rejects.toThrow('journal changed')
})
