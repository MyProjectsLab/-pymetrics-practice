import { beforeEach, describe, expect, it } from 'vitest'
import { loadTowersForms } from './forms'
import { newRoot, TowersStore } from './storage'
import type { Backend, Root } from './storage'
import type { PendingEvent } from './engine'

class MemoryBackend implements Backend {
  root: Root = newRoot()
  loseNextDelivery = false
  failNextWrite = false
  async read() { return structuredClone(this.root) }
  async change<T>(fn: (root: Root) => T) {
    if (this.failNextWrite) { this.failNextWrite = false; throw Error('write failed before commit') }
    const draft = structuredClone(this.root)
    const value = fn(draft)
    this.root = draft
    if (this.loseNextDelivery) { this.loseNextDelivery = false; throw Error('delivery lost after commit') }
    return structuredClone(value)
  }
  close() {}
}
beforeEach(() => {
  Object.defineProperty(navigator, 'locks', { configurable: true, value: {
    request: async (_name: string, _options: unknown, callback: () => Promise<unknown>) => callback(),
  } })
})

describe('Towers durable authority', () => {
  it.each([null, false, 0, '', {}, []])('refuses a present invalid root without replacing it: %j', async value => {
    const backend = new MemoryBackend()
    backend.root = value as Root
    await expect(TowersStore.open(backend)).rejects.toThrow()
    expect(backend.root).toEqual(value)
  })

  it('assigns next unseen form after a retained solved report and withdraws deleted bytes', async () => {
    const backend = new MemoryBackend(), store = await TowersStore.open(backend)
    const first = await store.start({ id: 'start1', runId: 'run1', documentId: 'doc1', wallMs: 1 })
    expect(first.formId).toBe('TW1')
    const intent = await store.intent({ id: 'intent1', runId: first.id, documentId: 'doc1',
      generation: first.generation, revision: first.revision })
    const onset: PendingEvent = { kind: 'board_onset', sequence: 1, elapsedMs: 0,
      actionId: 'onset1', wallTimestampMs: 1000 }
    const armed = await store.append({ id: 'onsetRequest', runId: first.id, documentId: 'doc1',
      generation: 1, revision: intent.revision, event: onset })
    const forms = await loadTowersForms()
    const form = forms[0].form
    let revision = armed.revision
    let board = form.start.map(stack => [...stack])
    let complete = armed
    const fixture = (await import('../../docs/specifications/ASSESSMENT_PRACTICE_TOWERS_FIXTURES_V1_0_DRAFT.json')).default
    for (const [i, move] of fixture.scenarios[0].oneShortestPath.entries()) {
      const [from, to] = move
      const diskId = board[from].at(-1)!
      const event: PendingEvent = { kind: 'move', sequence: i + 2, elapsedMs: 3000 + i * 1000,
        wallTimestampMs: 4000 + i * 1000,
        actionId: `move${i}`, from, to, diskId, inputSource: 'keyboard' }
      if (i === 8) {
        backend.failNextWrite = true
        await expect(store.append({ id: `request${i}`, runId: first.id,
          documentId: 'doc1', generation: 1, revision, event })).rejects.toThrow('write failed')
        expect(backend.root.runs.run1.status).toBe('active')
        expect(backend.root.runs.run1.snapshot).toBeUndefined()
        expect(backend.root.runs.run1.events).toHaveLength(9)
      }
      const saved = await store.append({ id: `request${i}`, runId: first.id, documentId: 'doc1',
        generation: 1, revision, event })
      revision = saved.revision
      complete = saved
      board[to].push(board[from].pop()!)
    }
    expect(complete.snapshot?.report.movesMade).toBe(9)
    expect(complete.events.at(-1)?.kind).toBe('solved')
    // Product builds before this disclosure did not store a familiarity flag.
    delete backend.root.runs.run1.familiar
    await expect(store.read()).resolves.toMatchObject({ runs: { run1: { status: 'complete' } } })
    const second = await store.start({ id: 'start2', runId: 'run2', documentId: 'doc1', wallMs: 2 })
    expect(second.formId).toBe('TW2')
    const familiar = await store.start({ id: 'start3', runId: 'run3', documentId: 'doc1',
      wallMs: 3, preferredFormId: 'TW1' })
    expect(familiar.familiar).toBe(true)
    await store.delete('run1')
    expect(backend.root.runs.run1).toBeUndefined()
    expect(backend.root.activity.run1).toBeUndefined()
    expect(backend.root.tombstones.run1).toBe(true)
    await expect(store.append({ id: 'late', runId: 'run1', documentId: 'doc1',
      generation: 1, revision: complete.revision,
      event: { kind: 'reset', sequence: 12, elapsedMs: 12000, actionId: 'late',
        wallTimestampMs: 13000 } })).rejects.toThrow()
    store.close()
  })

  it('cancels an unseen reservation and rejects an old installation after Delete all', async () => {
    const backend = new MemoryBackend(), store = await TowersStore.open(backend)
    const first = await store.start({ id: 'start', runId: 'first', documentId: 'doc', wallMs: 1 })
    await store.cancelUnseen({ runId: first.id, documentId: first.documentId,
      generation: first.generation })
    expect((await store.list())).toHaveLength(0)
    const second = await store.start({ id: 'start2', runId: 'second', documentId: 'doc', wallMs: 2 })
    expect(second.formId).toBe('TW1')
    await store.deleteAll()
    await expect(store.read()).rejects.toThrow('installation replaced')
    await expect(store.append({ id: 'late', runId: second.id, documentId: 'doc',
      generation: 1, revision: second.revision,
      event: { kind: 'board_onset', sequence: 1, elapsedMs: 0, actionId: 'late',
        wallTimestampMs: 1000 } })).rejects.toThrow()
    expect(Object.keys(backend.root.runs)).toHaveLength(0)
    const reopened = await TowersStore.open(backend)
    expect((await reopened.list())).toHaveLength(0)
    reopened.close(); store.close()
  })

  it('retries the same request after a committed but undelivered start and onset', async () => {
    const backend = new MemoryBackend(), store = await TowersStore.open(backend)
    const input = { id: 'start-lost', runId: 'run-lost', documentId: 'doc', wallMs: 1 }
    backend.loseNextDelivery = true
    await expect(store.start(input)).rejects.toThrow('delivery lost')
    const reserved = await store.start(input)
    expect(reserved.formId).toBe('TW1')
    expect(backend.root.nextOrdinal).toBe(2)
    const intentInput = { id: 'intent-lost', runId: reserved.id, documentId: 'doc',
      generation: 1, revision: reserved.revision }
    backend.loseNextDelivery = true
    await expect(store.intent(intentInput)).rejects.toThrow('delivery lost')
    const intended = await store.intent(intentInput)
    const onset = { id: 'onset-lost', runId: reserved.id, documentId: 'doc',
      generation: 1, revision: intended.revision,
      event: { kind: 'board_onset' as const, sequence: 1, elapsedMs: 0,
        wallTimestampMs: 1000, actionId: 'onset-lost' } }
    backend.loseNextDelivery = true
    await expect(store.append(onset)).rejects.toThrow('delivery lost')
    const active = await store.append(onset)
    expect(active.events).toHaveLength(1)
    expect(active.events[0]).toMatchObject({ attemptId: 'run-lost', formId: 'TW1',
      formHash: reserved.formHash, ownershipGeneration: 1 })
    store.close()
  })

  it('migrates a legacy empty reservation as uncertain exposure', async () => {
    const backend = new MemoryBackend(), store = await TowersStore.open(backend)
    const first = await store.start({ id: 'legacy-start', runId: 'legacy-run', documentId: 'doc', wallMs: 1 })
    store.close()
    ;(backend.root as { version: string }).version = 'towers-root-v1.0'
    delete (backend.root.runs[first.id] as { presentation?: string }).presentation
    const reopened = await TowersStore.open(backend)
    const legacy = (await reopened.inspect(first.id)).run
    expect(legacy.presentation).toBe('intent')
    expect(legacy.exposureReview?.timingAvailable).toBe(false)
    expect(legacy.events).toHaveLength(0)
    await reopened.cancelUnseen({ runId: first.id, documentId: first.documentId,
      generation: first.generation })
    expect((await reopened.inspect(first.id)).run.presentation).toBe('intent')
    const next = await reopened.start({ id: 'new-start', runId: 'new-run', documentId: 'doc', wallMs: 2 })
    expect(next.formId).toBe('TW2')
    reopened.close()
  })

  it('retains committed intent after attempted unseen cancellation and allocates the next form', async () => {
    const backend = new MemoryBackend(), store = await TowersStore.open(backend)
    const first = await store.start({ id: 'start-intent', runId: 'run-intent',
      documentId: 'doc', wallMs: 1 })
    const input = { id: 'intent-request', runId: first.id, documentId: 'doc',
      generation: first.generation, revision: first.revision }
    backend.loseNextDelivery = true
    await expect(store.intent(input)).rejects.toThrow('delivery lost')
    await store.cancelUnseen({ runId: first.id, documentId: first.documentId,
      generation: first.generation })
    expect((await store.inspect(first.id)).run).toMatchObject({
      presentation: 'intent', status: 'reserved', exposureReview: { timingAvailable: false },
    })
    expect((await store.list())).toHaveLength(1)
    const next = await store.start({ id: 'next-start', runId: 'next-run',
      documentId: 'doc', wallMs: 2 })
    expect(next.formId).toBe('TW2')
    expect(next.familiar).toBe(false)
    store.close()
  })

  it('tombstones an unseen pending Start so its late write cannot recreate a run', async () => {
    const backend = new MemoryBackend(), store = await TowersStore.open(backend)
    await store.cancelUnseen({ runId: 'pending-run', documentId: 'doc',
      generation: 1, startRequestId: 'pending-start' })
    await expect(store.start({ id: 'late-start', runId: 'pending-run',
      documentId: 'doc', wallMs: 1 })).rejects.toThrow('start')
    expect(backend.root.runs['pending-run']).toBeUndefined()
    expect(backend.root.tombstones['pending-run']).toBe(true)
    store.close()
  })

  it('does not cancel another document’s unseen reservation', async () => {
    const backend = new MemoryBackend(), store = await TowersStore.open(backend)
    const reserved = await store.start({ id: 'owner-start', runId: 'owner-run',
      documentId: 'owner-doc', wallMs: 1 })
    await expect(store.cancelUnseen({ runId: reserved.id, documentId: 'other-doc',
      generation: reserved.generation, startRequestId: 'other-start' }))
      .rejects.toThrow('cancellation authority')
    expect((await store.inspect(reserved.id)).run.presentation).toBe('unseen')
    store.close()
  })

  it('migrates old terminal journals and reports without changing their bytes', async () => {
    const backend = new MemoryBackend(), store = await TowersStore.open(backend)
    const reserved = await store.start({ id: 'old-start', runId: 'old-run',
      documentId: 'doc', wallMs: 1 })
    const intended = await store.intent({ id: 'old-intent', runId: reserved.id,
      documentId: 'doc', generation: 1, revision: reserved.revision })
    const active = await store.append({ id: 'old-onset', runId: reserved.id,
      documentId: 'doc', generation: 1, revision: intended.revision,
      event: { kind: 'board_onset', sequence: 1, elapsedMs: 0,
        actionId: 'old-onset-event', wallTimestampMs: 1000 } })
    await store.append({ id: 'old-exit', runId: reserved.id,
      documentId: 'doc', generation: 1, revision: active.revision,
      event: { kind: 'exited', sequence: 2, elapsedMs: 100,
        actionId: 'old-exit-event', wallTimestampMs: 1100, reason: 'left game' } })
    const before = structuredClone(backend.root.runs[reserved.id])
    store.close()
    ;(backend.root as { version: string }).version = 'towers-root-v1.0'
    delete (backend.root.runs[reserved.id] as { presentation?: string }).presentation
    const reopened = await TowersStore.open(backend)
    const after = (await reopened.inspect(reserved.id)).run
    expect(after.presentation).toBe('onset')
    expect(after.events).toEqual(before.events)
    expect(after.snapshot).toEqual(before.snapshot)
    expect(after.revision).toBe(before.revision)
    reopened.close()
  })

  it('fences a delayed onset when failed presentation is resolved first', async () => {
    const backend = new MemoryBackend(), store = await TowersStore.open(backend)
    const reserved = await store.start({ id: 'start', runId: 'run',
      documentId: 'doc', wallMs: 1 })
    const intended = await store.intent({ id: 'intent', runId: 'run',
      documentId: 'doc', generation: 1, revision: reserved.revision })
    const onset = { id: 'late-onset', runId: 'run', documentId: 'doc',
      generation: 1, revision: intended.revision,
      event: { kind: 'board_onset' as const, sequence: 1, elapsedMs: 0,
        actionId: 'onset-event', wallTimestampMs: 1000 } }
    const resolution = { id: 'resolve', runId: 'run', documentId: 'doc',
      generation: 1, revision: intended.revision, onsetActionId: 'onset-event' }
    const reviewed = await store.resolveOnsetFailure(resolution)
    expect(reviewed.presentation).toBe('intent')
    expect(reviewed.revision).toBeGreaterThan(intended.revision)
    await expect(store.append(onset)).rejects.toThrow('run authority')
    expect((await store.resolveOnsetFailure(resolution)).events).toHaveLength(0)
    store.close()
  })

  it('preserves a committed onset when it wins the resolution order', async () => {
    const backend = new MemoryBackend(), store = await TowersStore.open(backend)
    const reserved = await store.start({ id: 'start', runId: 'run',
      documentId: 'doc', wallMs: 1 })
    const intended = await store.intent({ id: 'intent', runId: 'run',
      documentId: 'doc', generation: 1, revision: reserved.revision })
    const active = await store.append({ id: 'onset', runId: 'run', documentId: 'doc',
      generation: 1, revision: intended.revision,
      event: { kind: 'board_onset', sequence: 1, elapsedMs: 0,
        actionId: 'onset-event', wallTimestampMs: 1000 } })
    const resolved = await store.resolveOnsetFailure({ id: 'resolve', runId: 'run',
      documentId: 'doc', generation: 1, revision: intended.revision,
      onsetActionId: 'onset-event' })
    expect(resolved).toEqual(active)
    expect(resolved.events).toHaveLength(1)
    store.close()
  })

  it('keeps a form familiar until its last retained exposure is deleted', async () => {
    const backend = new MemoryBackend(), store = await TowersStore.open(backend)
    const retained: string[] = []
    for (let i = 1; i <= 6; i++) {
      const run = await store.start({ id: `start-${i}`, runId: `run-${i}`,
        documentId: 'doc', wallMs: i })
      expect(run.formId).toBe(`TW${i}`)
      await store.intent({ id: `intent-${i}`, runId: run.id, documentId: 'doc',
        generation: run.generation, revision: run.revision })
      retained.push(run.id)
    }
    const fallback = await store.start({ id: 'fallback-start', runId: 'fallback',
      documentId: 'doc', wallMs: 7 })
    expect(fallback.familiar).toBe(true)
    expect(fallback.formId).toBe('TW1')
    await store.intent({ id: 'fallback-intent', runId: fallback.id, documentId: 'doc',
      generation: fallback.generation, revision: fallback.revision })
    await store.delete(retained[0])
    const stillFamiliar = await store.start({ id: 'second-fallback-start', runId: 'second-fallback',
      documentId: 'doc', wallMs: 8, preferredFormId: 'TW1' })
    expect(stillFamiliar.familiar).toBe(true)
    await store.delete(fallback.id)
    await store.cancelUnseen({ runId: stillFamiliar.id, documentId: 'doc',
      generation: stillFamiliar.generation })
    const fresh = await store.start({ id: 'fresh-start', runId: 'fresh',
      documentId: 'doc', wallMs: 9, preferredFormId: 'TW1' })
    expect(fresh.formId).toBe('TW1')
    expect(fresh.familiar).toBe(false)
    store.close()
  })

  it('atomically settles a committed but undelivered onset at its captured deadline', async () => {
    for (const elapsedMs of [2000, 120000, 120001]) {
      const backend = new MemoryBackend(), store = await TowersStore.open(backend)
      const reserved = await store.start({ id: 'start', runId: 'run', documentId: 'doc', wallMs: 1 })
      const intended = await store.intent({ id: 'intent', runId: 'run', documentId: 'doc',
        generation: 1, revision: reserved.revision })
      const onset = await store.append({ id: 'onset', runId: 'run', documentId: 'doc',
        generation: 1, revision: intended.revision,
        event: { kind: 'board_onset', sequence: 1, elapsedMs: 0,
          actionId: 'onset-event', wallTimestampMs: 1000 } })
      const input = { id: 'resolve', runId: 'run', documentId: 'doc', generation: 1,
        revision: intended.revision, onsetActionId: 'onset-event',
        terminal: { elapsedMs, reason: 'display lost', wallTimestampMs: 1000 + elapsedMs } }
      const settled = await store.resolveOnsetFailure(input)
      expect(settled.events.map(event => event.kind)).toEqual(['board_onset',
        elapsedMs >= 120000 ? 'expired' : 'interrupted'])
      expect(settled.events.at(-1)?.elapsedMs).toBe(Math.min(elapsedMs, 120000))
      expect(settled.snapshot?.events).toEqual(settled.events)
      expect(await store.resolveOnsetFailure(input)).toEqual(settled)
      expect((await store.inspect('run')).run.revision).toBe(settled.revision)
      expect(onset.events).toHaveLength(1)
      store.close()
    }
  })
})
