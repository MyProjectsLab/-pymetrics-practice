import { describe, expect, it, vi } from 'vitest'
import fixtures from '../../docs/specifications/ASSESSMENT_PRACTICE_EASY_HARD_FIXTURES_V1_0_DRAFT.json'
import { EasyHardStore, newRoot } from './storage'
import type { Backend, Root } from './storage'
import type { JournalEvent } from './report'
import { loadForms } from './forms'
import { onset } from './engine'

class MemoryBackend implements Backend {
  value: Root = newRoot()
  close() {}
  async read() { return structuredClone(this.value) }
  async change<T>(fn: (root: Root) => T) {
    const copy = structuredClone(this.value)
    const result = fn(copy)
    this.value = copy
    return structuredClone(result)
  }
}
function draft(event: JournalEvent) {
  const { eventVersion: _v, attemptId: _a, formId: _f, formHash: _h,
    ownershipGeneration: _o, sequence: _s, wallTimestampMs: _w, ...rest } = event
  void [_v, _a, _f, _h, _o, _s, _w]
  return rest
}

describe('Easy or Hard durable journal', () => {
  it('does not call a retained replay new after its original was deleted', async () => {
    const backend = new MemoryBackend()
    const store = await EasyHardStore.open(backend)
    const forms = await loadForms()
    const runs = []
    for (let ordinal = 1; ordinal <= 5; ordinal++) {
      const run = await store.start({ id: `start-${ordinal}`, runId: `run-${ordinal}`,
        documentId: `doc-${ordinal}`, wallMs: ordinal, wallAnchorMs: ordinal })
      runs.push(run)
      await store.append({ id: `onset-${ordinal}`, runId: run.id,
        documentId: run.documentId, epoch: run.epoch, revision: run.revision,
        event: onset(forms.get(run.formId)!.form, [], 0) })
    }
    expect(runs.map(run => run.formId)).toEqual(['EH1', 'EH2', 'EH3', 'EH4', 'EH1'])
    vi.stubGlobal('navigator', { locks: { request: async (_name: string, _options: unknown,
      action: () => Promise<unknown>) => action() } })
    await store.delete(runs[0].id)
    const next = await store.start({ id: 'start-after-original-delete', runId: 'next-run',
      documentId: 'next-doc', wallMs: 6, wallAnchorMs: 6 })
    expect(next.ordinal).toBeGreaterThan(4)
    expect((await store.read()).runs[runs[4].id].formId).toBe('EH1')
    store.close(); vi.unstubAllGlobals()
  })
  it('binds the first visible offer to its confirmed wall anchor', async () => {
    const backend = new MemoryBackend()
    const store = await EasyHardStore.open(backend)
    const event = fixtures.replayableSessions[0].expectedJournal[0] as JournalEvent
    const run = await store.start({ id: 'start-anchor', runId: 'anchor-run',
      documentId: 'anchor-doc', wallMs: 10, wallAnchorMs: 10,
      soundCues: true, reducedMotion: true })
    expect((await store.inspect(run.id)).run).toMatchObject({ soundCues: true, reducedMotion: true })
    const saved = await store.append({ id: 'first-onset', runId: run.id,
      documentId: run.documentId, epoch: run.epoch, revision: run.revision,
      onsetWallMs: 50, event: draft(event) })
    expect(saved.wallAnchorMs).toBe(50)
    expect(saved.events[0].wallTimestampMs).toBe(50)
    backend.value.runs[run.id].status = 'interrupted'
    await expect(store.read()).rejects.toThrow('terminal status')
    store.close()
  })

  it('replays one entire fixed session and preserves exact terminal bytes', async () => {
    const backend = new MemoryBackend()
    const store = await EasyHardStore.open(backend)
    const fixture = fixtures.replayableSessions[0]
    const journal = fixture.expectedJournal as JournalEvent[]
    const runId = journal[0].attemptId
    let run = await store.start({ id: 'start-1', runId, documentId: 'doc-1',
      wallMs: journal[0].wallTimestampMs, wallAnchorMs: journal[0].wallTimestampMs - journal[0].elapsedMs })
    for (const event of journal) run = await store.append({ id: `event-${event.sequence}`, runId,
      documentId: 'doc-1', epoch: run.epoch, revision: run.revision, event: draft(event) })
    const result = await store.inspect(runId)
    expect(result.run.status).toBe('complete')
    expect(result.report?.earnedCents).toBe(1378)
    expect(result.run.snapshot?.events).toEqual(journal)
    expect(result.run.snapshot?.report).toEqual(result.report)
    store.close()
  })

  it('rejects a reused action and leaves the durable root intact', async () => {
    const backend = new MemoryBackend()
    const store = await EasyHardStore.open(backend)
    const events = fixtures.replayableSessions[0].expectedJournal as JournalEvent[]
    const runId = events[0].attemptId
    let run = await store.start({ id: 'start-1', runId, documentId: 'doc-1',
      wallMs: events[0].wallTimestampMs, wallAnchorMs: events[0].wallTimestampMs })
    for (const event of events.slice(0, 5)) run = await store.append({ id: `event-${event.sequence}`,
      runId, documentId: 'doc-1', epoch: run.epoch, revision: run.revision, event: draft(event) })
    const before = await store.read()
    const duplicate = { ...draft(events[5]), actionId: (events[1] as JournalEvent).actionId }
    await expect(store.append({ id: 'different-command', runId, documentId: 'doc-1',
      epoch: run.epoch, revision: run.revision, event: duplicate })).rejects.toThrow()
    expect(await store.read()).toEqual(before)
    store.close()
  })

  it('deletion removes journal, report and activity and blocks late writes', async () => {
    vi.stubGlobal('navigator', { locks: { request: async (_name: string, _options: unknown,
      action: () => Promise<unknown>) => action() } })
    const backend = new MemoryBackend()
    const store = await EasyHardStore.open(backend)
    const event = fixtures.replayableSessions[0].expectedJournal[0] as JournalEvent
    const runId = event.attemptId
    const run = await store.start({ id: 'start-1', runId, documentId: 'doc-1',
      wallMs: event.wallTimestampMs, wallAnchorMs: event.wallTimestampMs })
    await store.append({ id: 'event-1', runId, documentId: 'doc-1', epoch: run.epoch,
      revision: run.revision, event: draft(event) })
    await store.view(runId, 'view-1', 'report_viewed')
    await store.delete(runId)
    const root = await store.read()
    expect(root.runs[runId]).toBeUndefined()
    expect(root.activity[runId]).toBeUndefined()
    expect(root.tombstones[runId]).toBe(true)
    const replacement = await store.start({ id: 'start-after-delete', runId: 'replacement-run',
      documentId: 'replacement-doc', wallMs: event.wallTimestampMs + 1,
      wallAnchorMs: event.wallTimestampMs + 1 })
    expect(replacement.ordinal).toBe(1)
    expect(replacement.formId).toBe(run.formId)
    await expect(store.append({ id: 'late', runId, documentId: 'doc-1', epoch: run.epoch,
      revision: run.revision, event: draft(event) })).rejects.toThrow()
    store.close()
    vi.unstubAllGlobals()
  })

  it('Delete all replaces installation authority and rejects an old late write', async () => {
    vi.stubGlobal('navigator', { locks: { request: async (_name: string, _options: unknown,
      action: () => Promise<unknown>) => action() } })
    const backend = new MemoryBackend()
    const old = await EasyHardStore.open(backend)
    const event = fixtures.replayableSessions[0].expectedJournal[0] as JournalEvent
    const run = await old.start({ id: 'start-old', runId: 'old-run', documentId: 'old-doc',
      wallMs: 0, wallAnchorMs: 0 })
    await old.deleteAll()
    await expect(old.append({ id: 'late-old', runId: run.id, documentId: run.documentId,
      epoch: run.epoch, revision: run.revision, event: draft(event) })).rejects.toThrow('installation replaced')
    const replacement = await EasyHardStore.open(backend)
    expect((await replacement.read()).runs).toEqual({})
    const next = await replacement.start({ id: 'start-new', runId: 'new-run',
      documentId: 'new-doc', wallMs: 1, wallAnchorMs: 1 })
    expect(next.ordinal).toBe(1)
    old.close(); replacement.close(); vi.unstubAllGlobals()
  })
})
