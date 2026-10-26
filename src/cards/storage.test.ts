import { beforeEach, describe, expect, it } from 'vitest'
import { acquireCardsOwner, CardsStore, newRoot } from './storage'
import type { Backend, Root } from './storage'

class MemoryBackend implements Backend {
  value: Root = newRoot()
  async read() { return structuredClone(this.value) }
  async change<T>(fn: (root: Root) => T) {
    const copy = structuredClone(this.value)
    const result = fn(copy)
    this.value = copy
    return structuredClone(result)
  }
  close() {}
}
beforeEach(() => {
  Object.defineProperty(navigator, 'locks', { configurable: true, value: { request: async (_name: string, _options: unknown, callback: () => Promise<unknown>) => callback() } })
})
describe('Cards durable journal', () => {
  it('saves a complete 80-draw run, preserves idempotency and rejects tampering', async () => {
    const backend = new MemoryBackend(), store = await CardsStore.open(backend)
    const start = { id: 'start', runId: 'run', documentId: 'document', wallMs: 1 }
    let run = await store.start(start)
    expect((await store.start(start)).ordinal).toBe(1)
    expect((await store.read()).nextExposureOrdinal).toBe(2)
    await expect(store.start({ ...start, wallMs: 2 })).rejects.toThrow()
    let time = 1
    for (let turn = 1; turn <= 80; turn++) {
      run = await store.ready({ id: `ready-${turn}`, runId: run.id, documentId: run.documentId,
        epoch: run.epoch, revision: run.revision, turn, atMs: time++ })
      run = await store.choice({ id: `choice-${turn}`, runId: run.id, documentId: run.documentId,
        epoch: run.epoch, revision: run.revision, turn, deck: turn % 2 ? 'B' : 'C', deckDraw: Math.ceil(turn / 2),
        source: 'keyboard', atMs: time++ })
      run = await store.feedback({ id: `feedback-${turn}`, runId: run.id, documentId: run.documentId,
        epoch: run.epoch, revision: run.revision, turn, commandId: `choice-${turn}`, atMs: time++ })
    }
    const completed = await store.complete({ id: 'terminal', runId: run.id, documentId: run.documentId,
      epoch: run.epoch, revision: run.revision })
    expect(completed.status).toBe('complete')
    expect((await store.inspect(run.id)).report.status).toBe('complete_valid')
    expect((await store.inspect(run.id)).report.committedDrawCount).toBe(80)
    await store.view(run.id, 'report-view', 'report_viewed')
    await store.viewHistory('history-view')
    const withViews = await store.read()
    expect(withViews.activity[run.id][0]).toMatchObject({ type: 'report_viewed', seq: 1,
      version: 'cards-events/1.1.0', formSha256: run.formSha256 })
    expect(withViews.historyViews?.[0]).toMatchObject({ type: 'history_viewed', seq: 1,
      runId: 'installation' })
    const before = await store.read()
    await store.complete({ id: 'terminal', runId: run.id, documentId: run.documentId,
      epoch: run.epoch, revision: run.revision })
    expect(await store.read()).toEqual(before)
    backend.value.runs[run.id].events[3] = { ...backend.value.runs[run.id].events[3], seq: 99 }
    await expect(store.read()).rejects.toThrow()
    store.close()
  })
  it('keeps a committed choice review-only when feedback or terminal is absent', async () => {
    const store = await CardsStore.open(new MemoryBackend())
    let run = await store.start({ id: 'start', runId: 'run', documentId: 'document', wallMs: 1 })
    run = await store.ready({ id: 'ready', runId: run.id, documentId: run.documentId, epoch: run.epoch,
      revision: run.revision, turn: 1, atMs: 1 })
    run = await store.choice({ id: 'choice', runId: run.id, documentId: run.documentId,
      epoch: run.epoch, revision: run.revision, turn: 1, deck: 'A', deckDraw: 1, source: 'pointer', atMs: 2 })
    const prefix = await store.inspect(run.id)
    expect(prefix.report.committedDrawCount).toBe(1)
    expect(prefix.report.feedbackSeenCount).toBe(0)
    expect(prefix.report.status).toBe('incomplete_review')
    await expect(store.complete({ id: 'end', runId: run.id, documentId: run.documentId,
      epoch: run.epoch, revision: run.revision })).rejects.toThrow()
    store.close()
  })
  it('tombstones deleted runs and rejects late writes', async () => {
    const backend = new MemoryBackend(), store = await CardsStore.open(backend)
    const run = await store.start({ id: 'start', runId: 'run', documentId: 'document', wallMs: 1 })
    await store.delete(run.id)
    await expect(store.ready({ id: 'late', runId: run.id, documentId: run.documentId, epoch: run.epoch,
      revision: run.revision, turn: 1, atMs: 1 })).rejects.toThrow()
    expect(backend.value.runs[run.id]).toBeUndefined()
    expect(backend.value.tombstones[run.id]).toBe(true)
    store.close()
  })
  it('replaces the installation and rejects old writers while allowing a fresh first form', async () => {
    const backend = new MemoryBackend(), oldStore = await CardsStore.open(backend)
    const oldRun = await oldStore.start({ id: 'old-start', runId: 'old-run', documentId: 'old-doc', wallMs: 1 })
    const oldInstallation = oldStore.installationId
    await oldStore.deleteAll()
    expect(backend.value.installationId).not.toBe(oldInstallation)
    expect(Object.keys(backend.value.runs)).toHaveLength(0)
    expect(Object.keys(backend.value.requests)).toHaveLength(0)
    expect(backend.value.nextExposureOrdinal).toBe(1)
    await expect(oldStore.ready({ id: 'late-ready', runId: oldRun.id, documentId: oldRun.documentId,
      epoch: oldRun.epoch, revision: oldRun.revision, turn: 1, atMs: 1 })).rejects.toThrow('installation replaced')
    await expect(oldStore.start({ id: 'late-start', runId: 'late-run', documentId: 'old-doc', wallMs: 2 }))
      .rejects.toThrow('installation replaced')
    const replacement = await CardsStore.open(backend)
    const fresh = await replacement.start({ id: 'fresh-start', runId: 'fresh-run', documentId: 'fresh-doc', wallMs: 3 })
    expect(fresh.ordinal).toBe(1)
    expect(fresh.formId).toBe('CD1')
    oldStore.close(); replacement.close()
  })
  it('does not commit a failed transaction or accept a changed duplicate action', async () => {
    const backend = new MemoryBackend(), store = await CardsStore.open(backend)
    let run = await store.start({ id: 'start', runId: 'run', documentId: 'doc', wallMs: 1 })
    const before = structuredClone(backend.value)
    await expect(store.choice({ id: 'choice', runId: run.id, documentId: run.documentId,
      epoch: run.epoch, revision: run.revision, turn: 1, deck: 'A', deckDraw: 1, source: 'keyboard', atMs: 1 }))
      .rejects.toThrow()
    expect(backend.value).toEqual(before)
    run = await store.ready({ id: 'ready', runId: run.id, documentId: run.documentId,
      epoch: run.epoch, revision: run.revision, turn: 1, atMs: 1 })
    const choice = { id: 'choice', runId: run.id, documentId: run.documentId,
      epoch: run.epoch, revision: run.revision, turn: 1, deck: 'A' as const, deckDraw: 1, source: 'keyboard', atMs: 2 }
    await store.choice(choice)
    const after = structuredClone(backend.value)
    await expect(store.choice({ ...choice, deck: 'B' })).rejects.toThrow('request conflict')
    expect(backend.value).toEqual(after)
    store.close()
  })
  it('records a lifecycle boundary and keeps an exited prefix incomplete', async () => {
    const store = await CardsStore.open(new MemoryBackend())
    let run = await store.start({ id: 'start', runId: 'run', documentId: 'doc', wallMs: 1 })
    run = await store.ready({ id: 'ready', runId: run.id, documentId: run.documentId,
      epoch: run.epoch, revision: run.revision, turn: 1, atMs: 1 })
    const closed = await store.closeRun({ id: 'exit', runId: run.id, documentId: run.documentId,
      epoch: run.epoch, type: 'run_exited', reason: 'candidate_exit' })
    expect(closed.events.at(-2)?.type).toBe('lifecycle_changed')
    expect(closed.events.at(-1)?.type).toBe('run_exited')
    expect((await store.inspect(run.id)).report.status).toBe('incomplete_review')
    await expect(store.choice({ id: 'late', runId: run.id, documentId: run.documentId,
      epoch: run.epoch, revision: run.revision, turn: 1, deck: 'A', deckDraw: 1, source: 'keyboard', atMs: 2 }))
      .rejects.toThrow()
    store.close()
  })
  it('continues a live run after a second tab views its report metadata', async () => {
    const store = await CardsStore.open(new MemoryBackend())
    let run = await store.start({ id: 'start', runId: 'run', documentId: 'doc', wallMs: 1 })
    run = await store.ready({ id: 'ready', runId: run.id, documentId: run.documentId,
      epoch: run.epoch, revision: run.revision, turn: 1, atMs: 1 })
    await store.view(run.id, 'view', 'report_viewed')
    run = await store.choice({ id: 'choice', runId: run.id, documentId: run.documentId,
      epoch: run.epoch, revision: run.revision, turn: 1, deck: 'A', deckDraw: 1,
      source: 'keyboard', atMs: 2 })
    expect((await store.inspect(run.id)).report.committedDrawCount).toBe(1)
    store.close()
  })
  it('rejects negative readiness and a closure without its lifecycle event', async () => {
    const backend = new MemoryBackend(), store = await CardsStore.open(backend)
    const run = await store.start({ id: 'start', runId: 'run', documentId: 'doc', wallMs: 1 })
    await expect(store.ready({ id: 'bad-ready', runId: run.id, documentId: run.documentId,
      epoch: run.epoch, revision: run.revision, turn: 1, atMs: -0.5 })).rejects.toThrow()
    const saved = backend.value.runs[run.id]
    saved.status = 'interrupted'; saved.revision = ++backend.value.revision
    saved.events.push({ type: 'run_interrupted', seq: 2, revision: saved.revision,
      version: 'cards-events/1.1.0', ruleVersion: 'cards-rules/1.1.0',
      installationId: saved.installationId, runId: saved.id, formSha256: saved.formSha256,
      reason: 'tampered' })
    await expect(store.read()).rejects.toThrow()
    store.close()
  })
  it('atomically revokes a lost owner epoch and rejects its later draw', async () => {
    const store = await CardsStore.open(new MemoryBackend())
    let run = await store.start({ id: 'start', runId: 'run', documentId: 'doc', wallMs: 1 })
    run = await store.ready({ id: 'ready', runId: run.id, documentId: run.documentId,
      epoch: run.epoch, revision: run.revision, turn: 1, atMs: 1 })
    const invalid = await store.revokeOwner({ id: 'lost', runId: run.id, documentId: run.documentId,
      epoch: run.epoch, reason: 'owner_lost' })
    expect(invalid).toMatchObject({ status: 'invalid', epoch: 2 })
    expect(invalid.events.at(-1)?.type).toBe('run_invalid')
    await expect(store.choice({ id: 'late', runId: run.id, documentId: run.documentId,
      epoch: run.epoch, revision: run.revision, turn: 1, deck: 'A', deckDraw: 1,
      source: 'keyboard', atMs: 2 })).rejects.toThrow()
    expect((await store.inspect(run.id)).report.status).toBe('incomplete_review')
    store.close()
  })
  it('notifies when a browser owner request is stolen after acquisition', async () => {
    let lose!: (error: Error) => void, losses = 0
    Object.defineProperty(navigator, 'locks', { configurable: true, value: {
      request: (_name: string, _options: unknown, callback: (lock: object) => Promise<void>) => {
        void callback({})
        return new Promise<void>((_resolve, reject) => { lose = reject })
      },
    } })
    const release = await acquireCardsOwner(() => { losses++ })
    lose(Error('stolen'))
    await Promise.resolve(); await Promise.resolve()
    expect(losses).toBe(1)
    release()
  })
})
