import { beforeAll, describe, expect, it } from 'vitest'
import { advance } from './core'
import type { Setup, State } from './core'
import { freshRoot, KeypressesStore, orderedJournal } from './storage'
import type { Backend, StorageRoot } from './storage'

class MemoryBackend implements Backend {
  root = freshRoot()
  failDelivery = false
  failWrite = false
  async read() { return structuredClone(this.root) }
  async change<T>(operation: (root: StorageRoot) => T): Promise<T> {
    const next = structuredClone(this.root)
    const output = operation(next)
    if (this.failWrite) { this.failWrite = false; throw new Error('Write rejected before commit') }
    this.root = next
    if (this.failDelivery) { this.failDelivery = false; throw new Error('Callback lost after commit') }
    return output
  }
}
const setup: Setup = { sessionId: 'kp-durable-1', selectedKey: 'Space', hand: 'right', profile: 'standard_physical', delayIndex: 0 }
function completed(initial: State): State {
  let state = advance(initial, { kind: 'go', atMs: 1_800 })
  state = advance(state, { kind: 'deadline', atMs: 16_800 })
  state = advance(state, { kind: 'end', atMs: 16_800 })
  return advance(state, { kind: 'close', atMs: 17_800 })
}

describe('Keypresses versioned local storage contract', () => {
  beforeAll(() => { Object.defineProperty(navigator, 'locks', { configurable: true, value: {
    request: async (_name: string, _options: unknown, callback: (lock: object) => Promise<unknown>) => callback({}),
  } }) })
  it('saves an armed identity then verifies immutable completion and history', async () => {
    const backend = new MemoryBackend(), store = new KeypressesStore(backend, backend.root.installationId)
    const armed = await store.start(setup, 0, 100)
    expect((await store.history())[0].result).toBeNull()
    const state = completed(armed)
    await store.saveCompleted(state, 200)
    expect((await store.history())[0]).toMatchObject({ sessionId: setup.sessionId, result: { status: 'valid', acceptedCount: 0 } })
    expect(await store.confirmCompleted(state)).not.toBeNull()
    expect(await store.confirmCompleted({ ...state, accepted: [10] })).toBeNull()
    await expect(store.saveCompleted(state, 201)).rejects.toThrow()
  })

  it('reconciles a committed write after callback delivery fails', async () => {
    const backend = new MemoryBackend(), store = new KeypressesStore(backend, backend.root.installationId)
    const state = completed(await store.start(setup, 0, 100))
    backend.failDelivery = true
    await expect(store.saveCompleted(state, 200)).rejects.toThrow('Callback lost')
    expect(await store.confirmCompleted(state)).not.toBeNull()
  })

  it('retains the original arm when its terminal transaction aborts before commit', async () => {
    const backend = new MemoryBackend(), store = new KeypressesStore(backend, backend.root.installationId)
    const state = completed(await store.start(setup, 0, 100))
    const before = JSON.stringify(backend.root)
    backend.failWrite = true
    await expect(store.saveCompleted(state, 200)).rejects.toThrow('Write rejected before commit')
    expect(JSON.stringify(backend.root)).toBe(before)
    expect((await store.history())[0]).toMatchObject({ sessionId: setup.sessionId, result: null })
    expect(await store.confirmCompleted(state)).toBeNull()
  })

  it('fences individual deletion and replacement installation against late writes', async () => {
    const backend = new MemoryBackend(), store = new KeypressesStore(backend, backend.root.installationId)
    const state = completed(await store.start(setup, 0, 100))
    await store.remove(setup.sessionId, 150)
    await expect(store.saveCompleted(state, 200)).rejects.toThrow()
    expect((await store.history())).toHaveLength(0)
    const replacement = await store.deleteAll()
    await expect(store.read()).rejects.toThrow('installation replaced')
    await expect(store.saveCompleted(state, 200)).rejects.toThrow()
    expect((await replacement.history())).toHaveLength(0)
  })

  it('does not admit a corrupted completed journal as a saved report', async () => {
    const backend = new MemoryBackend(), store = new KeypressesStore(backend, backend.root.installationId)
    const state = completed(await store.start(setup, 0, 100))
    await store.saveCompleted(state, 200)
    backend.root.records[setup.sessionId] = { ...backend.root.records[setup.sessionId], state: { ...state, accepted: [100] } }
    await expect(store.history()).rejects.toThrow('integrity')
    const replacement = await store.deleteAll()
    expect(await replacement.history()).toEqual([])
  })

  it('retains report views in one ordered continuation without changing the timed result', async () => {
    const backend = new MemoryBackend(), store = new KeypressesStore(backend, backend.root.installationId)
    const state = completed(await store.start(setup, 0, 100))
    await store.saveCompleted(state, 200)
    const original = JSON.stringify(backend.root.records[setup.sessionId].state)
    const liveId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    const historyId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    await store.recordReportView(setup.sessionId, 'live', liveId, 300)
    await store.recordReportView(setup.sessionId, 'live', liveId, 300)
    await store.recordReportView(setup.sessionId, 'history', historyId, 400)
    const entry = (await store.history())[0]
    const journal = orderedJournal(entry)
    expect(journal.slice(0, state.events.length)).toEqual(state.events)
    expect(journal.slice(state.events.length).map(event => event.type)).toEqual(['report_viewed', 'report_viewed'])
    expect(journal.map(event => event.sequenceNumber)).toEqual(Array.from({ length: journal.length }, (_, i) => i + 1))
    expect(journal.slice(-2).map(event => JSON.parse(event.detail ?? '')?.context)).toEqual(['live', 'history'])
    expect(JSON.stringify(entry.state)).toBe(original)
    expect(await store.confirmCompleted(state)).not.toBeNull()
  })

  it('keeps factual wall times when append order and observation order differ', async () => {
    const backend = new MemoryBackend(), store = new KeypressesStore(backend, backend.root.installationId)
    await store.saveCompleted(completed(await store.start(setup, 0, 100)), 200)
    await store.recordReportView(setup.sessionId, 'history', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 1_700_000_010_000)
    await store.recordReportView(setup.sessionId, 'history', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 1_700_000_009_000)
    const views = orderedJournal((await store.history())[0]).filter(event => event.type === 'report_viewed')
    expect(views.map(event => event.timestampMs)).toEqual([1_700_000_010_000, 1_700_000_009_000])
    expect(views.map(event => event.sequenceNumber)).toEqual([views[0].sequenceNumber, views[0].sequenceNumber + 1])
  })

  it('reconciles lost view-write delivery and rejects missing, deleted and replaced authority', async () => {
    const backend = new MemoryBackend(), store = new KeypressesStore(backend, backend.root.installationId)
    const id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
    await store.start(setup, 0, 100)
    await expect(store.recordReportView(setup.sessionId, 'live', id, 200)).rejects.toThrow('not confirmed')
    await store.saveCompleted(completed(backend.root.records[setup.sessionId].state), 200)
    backend.failDelivery = true
    await store.recordReportView(setup.sessionId, 'live', id, 300)
    expect(orderedJournal((await store.history())[0]).filter(event => event.type === 'report_viewed')).toHaveLength(1)
    backend.failWrite = true
    await expect(store.recordReportView(setup.sessionId, 'history', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 350)).rejects.toThrow('not confirmed')
    expect(orderedJournal((await store.history())[0]).filter(event => event.type === 'report_viewed')).toHaveLength(1)
    await store.remove(setup.sessionId, 400)
    await expect(store.recordReportView(setup.sessionId, 'history', id, 500)).rejects.toThrow('not confirmed')
    await store.deleteAll()
    await expect(store.recordReportView(setup.sessionId, 'history', id, 500)).rejects.toThrow('installation replaced')
  })

  it('rejects forged view tails while accepting historical records without a continuation', async () => {
    const backend = new MemoryBackend(), store = new KeypressesStore(backend, backend.root.installationId)
    await store.saveCompleted(completed(await store.start(setup, 0, 100)), 200)
    expect((await store.history())[0].journal).toBeUndefined()
    await store.recordReportView(setup.sessionId, 'live', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 300)
    const intact = structuredClone(backend.root)
    const entry = intact.records[setup.sessionId]
    const tampered = [
      { ...entry, journal: [...entry.journal!.slice(0, -1), { ...entry.journal!.at(-1)!, sequenceNumber: 500 }] },
      { ...entry, journal: [...entry.journal!.slice(0, -1), { ...entry.journal!.at(-1)!, detail: '{"context":"history","viewId":"bad"}' }] },
      { ...entry, journal: [...entry.journal!.slice(1)] },
    ]
    for (const value of tampered) {
      backend.root.records[setup.sessionId] = value
      await expect(store.history()).rejects.toThrow('journal integrity')
    }
    backend.root = intact
    expect((await store.history())[0].journal).toHaveLength(entry.state.events.length + 1)
  })
})
