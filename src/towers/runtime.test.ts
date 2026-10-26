import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TowersRuntime } from './runtime'
import { TowersAttempt } from './controller'
import { newRoot, TowersStore } from './storage'
import type { Backend, Root } from './storage'
import { loadTowersForms } from './forms'

class MemoryBackend implements Backend {
  root: Root = newRoot()
  holdNextRead: Promise<void> | null = null
  closeCount = 0
  readCount = 0
  failReadAt = 0
  changeCount = 0
  failBeforeChangeAt = 0
  failAfterChangeAt = 0
  async read() {
    this.readCount++
    if (this.readCount === this.failReadAt) throw Error('injected authority read failure')
    const held = this.holdNextRead
    this.holdNextRead = null
    if (held) await held
    return structuredClone(this.root)
  }
  async change<T>(fn: (root: Root) => T) {
    this.changeCount++
    if (this.changeCount === this.failBeforeChangeAt) throw Error('injected write rejection')
    const draft = structuredClone(this.root)
    const result = fn(draft)
    this.root = draft
    if (this.changeCount === this.failAfterChangeAt) throw Error('injected committed delivery rejection')
    return structuredClone(result)
  }
  close() { this.closeCount++ }
}
beforeEach(() => {
  Object.defineProperty(navigator, 'locks', { configurable: true, value: {
    request: async (_name: string, _options: unknown, callback: () => Promise<unknown>) => callback(),
  } })
})

describe('Towers document settlement', () => {
  it('reconciles an unseen cancellation committed before delivery failed', async () => {
    const backend = new MemoryBackend(), store = await TowersStore.open(backend)
    const runtime = new TowersRuntime()
    const attempt = new TowersAttempt('cancel-run', 'cancel-document', 1, () => undefined)
    const start = { id: 'cancel-start', runId: 'cancel-run',
      documentId: 'cancel-document', wallMs: 1000 }
    runtime.begin(attempt, store, start)
    runtime.recordRun(await store.start(start))
    backend.failAfterChangeAt = backend.changeCount + 1
    const states: string[] = []
    const retired = new Promise<void>(resolve => runtime.subscribe(value => {
      states.push(value.state)
      if (value.state === 'retired') resolve()
    }))
    runtime.withdraw('left before board', 'exited')
    await retired
    expect(states).toContain('pending')
    expect(backend.root.runs['cancel-run']).toBeUndefined()
    expect(backend.root.tombstones['cancel-run']).toBe(true)
    store.close()
  }, 6000)
  it.each(['before', 'after', 'lock', 'deadline', 'late-deadline'])
    ('reconciles terminal delivery failure %s commit', async phase => {
    const backend = new MemoryBackend(), store = await TowersStore.open(backend)
    const runtime = new TowersRuntime()
    const attempt = new TowersAttempt('write-run', 'write-document', 1, () => undefined)
    const start = { id: 'write-start', runId: 'write-run', documentId: 'write-document', wallMs: 1000 }
    runtime.begin(attempt, store, start)
    const reserved = await store.start(start)
    const intent = await store.intent({ id: 'write-intent', runId: reserved.id,
      documentId: reserved.documentId, generation: reserved.generation, revision: reserved.revision })
    const onset = await store.append({ id: 'write-onset', runId: intent.id,
      documentId: intent.documentId, generation: intent.generation, revision: intent.revision,
      event: { kind: 'board_onset', sequence: 1, elapsedMs: 0,
        actionId: 'write-onset-action', wallTimestampMs: 1100 } })
    runtime.recordRun(onset, (await loadTowersForms())[0].form)
    attempt.setAnchor(performance.now() - (phase === 'deadline' ? 120000 :
      phase === 'late-deadline' ? 120001 : 2000))
    if (phase === 'before') backend.failBeforeChangeAt = backend.changeCount + 1
    else if (phase === 'after') backend.failAfterChangeAt = backend.changeCount + 1
    else if (phase === 'deadline' || phase === 'late-deadline')
      backend.failReadAt = backend.readCount + 3
    else {
      const original = navigator.locks.request.bind(navigator.locks)
      let failed = false
      vi.spyOn(navigator.locks, 'request').mockImplementation((...args: Parameters<typeof navigator.locks.request>) => {
        if (!failed && args[0] === 'assessment-practice-towers-data-v1') {
          failed = true; return Promise.reject(Error('injected lock acquisition failure'))
        }
        return original(...args)
      })
    }
    const states: string[] = []
    const settled = new Promise<void>(resolve => runtime.subscribe(value => {
      states.push(value.state)
      if (value.state === 'settled') resolve()
    }))
    runtime.subscribe(value => {
      if (value.state === 'pending' && value.retryable)
        queueMicrotask(() => { runtime.retry(); runtime.nudge('write-run') })
    })
    runtime.withdraw('left game', 'exited')
    runtime.retry()
    runtime.nudge('write-run')
    runtime.nudge('unrelated-run')
    await settled
    expect(states).toContain('pending')
    const expired = phase === 'deadline' || phase === 'late-deadline'
    expect(backend.root.runs['write-run'].events.map(event => event.kind))
      .toEqual(['board_onset', expired ? 'expired' : 'exited'])
    expect(backend.root.runs['write-run'].snapshot?.report.status)
      .toBe(expired ? 'incomplete timeout' : 'exited')
    vi.restoreAllMocks()
    store.close()
  }, 6000)
  it.each([1, 2, 3])('retries authority read stage %i without duplicating the terminal', async offset => {
    const backend = new MemoryBackend(), store = await TowersStore.open(backend)
    const runtime = new TowersRuntime()
    const attempt = new TowersAttempt('final-read-run', 'final-read-document', 1, () => undefined)
    const start = { id: 'final-read-start', runId: 'final-read-run',
      documentId: 'final-read-document', wallMs: 1000 }
    runtime.begin(attempt, store, start)
    const reserved = await store.start(start)
    const intent = await store.intent({ id: 'final-read-intent', runId: reserved.id,
      documentId: reserved.documentId, generation: reserved.generation, revision: reserved.revision })
    const onset = await store.append({ id: 'final-read-onset', runId: intent.id,
      documentId: intent.documentId, generation: intent.generation, revision: intent.revision,
      event: { kind: 'board_onset', sequence: 1, elapsedMs: 0,
        actionId: 'final-read-onset-action', wallTimestampMs: 1100 } })
    runtime.recordRun(onset, (await loadTowersForms())[0].form)
    attempt.setAnchor(performance.now() - 2000)
    backend.failReadAt = backend.readCount + offset
    const states: string[] = []
    const settled = new Promise<void>(resolve => runtime.subscribe(value => {
      states.push(value.state)
      if (value.state === 'settled') resolve()
    }))
    runtime.withdraw('left game', 'exited')
    await settled
    expect(states).toContain('pending')
    expect(backend.root.runs['final-read-run'].events.map(event => event.kind))
      .toEqual(['board_onset', 'exited'])
    expect(backend.root.runs['final-read-run'].snapshot?.report.status).toBe('exited')
    store.close()
  }, 6000)
  it('does not let an old cancellation settle a replacement attempt', async () => {
    const store = await TowersStore.open(new MemoryBackend())
    const runtime = new TowersRuntime()
    const first = new TowersAttempt('old-run', 'old-document', 1, () => undefined)
    runtime.begin(first, store, { id: 'old-start', runId: 'old-run',
      documentId: 'old-document', wallMs: 1000 })
    runtime.markSettled('old-run')
    const next = new TowersAttempt('new-run', 'new-document', 1, () => undefined)
    runtime.begin(next, store, { id: 'new-start', runId: 'new-run',
      documentId: 'new-document', wallMs: 2000 })
    runtime.markSettled('old-run')
    expect(runtime.unsettled).toBe(true)
    expect(next.active).toBe(true)
    runtime.markSettled('new-run')
    store.close()
  })
  it('retains a committed onset after route withdrawal and writes one terminal', async () => {
    const backend = new MemoryBackend(), store = await TowersStore.open(backend)
    const runtime = new TowersRuntime()
    const attempt = new TowersAttempt('run1', 'doc1', 1, () => undefined)
    const start = { id: 'start1', runId: 'run1', documentId: 'doc1', wallMs: 1000 }
    runtime.begin(attempt, store, start)
    const reserved = await store.start(start)
    runtime.recordRun(reserved)
    const intentInput = { id: 'intent1', runId: reserved.id, documentId: reserved.documentId,
      generation: reserved.generation, revision: reserved.revision }
    runtime.recordIntent(intentInput)
    const intent = await store.intent(intentInput)
    runtime.recordRun(intent)
    const onsetInput = { id: 'onset1', runId: intent.id, documentId: intent.documentId,
      generation: intent.generation, revision: intent.revision,
      event: { kind: 'board_onset' as const, sequence: 1, elapsedMs: 0,
        actionId: 'onsetAction1', wallTimestampMs: 1100 } }
    runtime.recordOnset(onsetInput)
    attempt.setAnchor(performance.now() - 2000)
    await store.append(onsetInput)
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    runtime.subscribe(() => { throw Error('injected observer failure') })
    const settled = new Promise<void>(resolve => runtime.subscribe(value => {
      if (value.state === 'settled') resolve()
    }))
    runtime.withdraw('left game', 'exited')
    await settled
    expect(errorLog).toHaveBeenCalled()
    errorLog.mockRestore()
    expect(backend.root.runs.run1.events.map(event => event.kind)).toEqual(['board_onset', 'exited'])
    expect(backend.root.runs.run1.snapshot?.report.status).toBe('exited')
    expect(runtime.unsettled).toBe(false)
    store.close()
  })
  it('settles an admitted move before a captured interruption', async () => {
    const backend = new MemoryBackend(), store = await TowersStore.open(backend)
    const runtime = new TowersRuntime(), attempt = new TowersAttempt('run2', 'doc2', 1, () => undefined)
    const start = { id: 'start2', runId: 'run2', documentId: 'doc2', wallMs: 1000 }
    runtime.begin(attempt, store, start)
    const reserved = await store.start(start)
    const intent = await store.intent({ id: 'intent2', runId: reserved.id,
      documentId: reserved.documentId, generation: reserved.generation, revision: reserved.revision })
    const onset = await store.append({ id: 'onset2', runId: intent.id, documentId: intent.documentId,
      generation: intent.generation, revision: intent.revision,
      event: { kind: 'board_onset', sequence: 1, elapsedMs: 0,
        actionId: 'onsetAction2', wallTimestampMs: 1100 } })
    const form = (await loadTowersForms())[0].form
    runtime.recordRun(onset, form)
    const action = { id: 'move2', runId: onset.id, documentId: onset.documentId,
      generation: onset.generation, revision: onset.revision,
      event: { kind: 'move' as const, sequence: 2, elapsedMs: 1000,
        actionId: 'moveAction2', wallTimestampMs: 2100,
        from: 0, to: 1, diskId: form.start[0].at(-1)!, inputSource: 'keyboard' as const } }
    runtime.recordAction(action)
    attempt.setAnchor(performance.now() - 2000)
    backend.failAfterChangeAt = backend.changeCount + 1
    const states: string[] = []
    const settled = new Promise<void>(resolve => runtime.subscribe(value => {
      states.push(value.state)
      if (value.state === 'settled') resolve()
    }))
    runtime.withdraw('read failed')
    await settled
    expect(states).toContain('pending')
    expect(backend.root.runs.run2.events.map(event => event.kind))
      .toEqual(['board_onset', 'move', 'interrupted'])
    expect(backend.root.runs.run2.snapshot?.report.movesMade).toBe(1)
    store.close()
  })
  it('keeps the withdrawal after a held authority read and settles on bounded retry', async () => {
    const backend = new MemoryBackend(), store = await TowersStore.open(backend)
    const runtime = new TowersRuntime(), attempt = new TowersAttempt('run3', 'doc3', 1, () => undefined)
    const start = { id: 'start3', runId: 'run3', documentId: 'doc3', wallMs: 1000 }
    runtime.begin(attempt, store, start)
    const reserved = await store.start(start)
    const intent = await store.intent({ id: 'intent3', runId: reserved.id,
      documentId: reserved.documentId, generation: reserved.generation, revision: reserved.revision })
    const onset = await store.append({ id: 'onset3', runId: intent.id, documentId: intent.documentId,
      generation: intent.generation, revision: intent.revision,
      event: { kind: 'board_onset', sequence: 1, elapsedMs: 0,
        actionId: 'onsetAction3', wallTimestampMs: 1100 } })
    runtime.recordRun(onset, (await loadTowersForms())[0].form)
    attempt.setAnchor(performance.now() - 2000)
    let release!: () => void
    backend.holdNextRead = new Promise(resolve => { release = resolve })
    const settled = new Promise<void>(resolve => runtime.subscribe(value => {
      if (value.state === 'settled') resolve()
    }))
    runtime.withdraw('left game', 'exited')
    await settled
    expect(backend.root.runs.run3.events.map(event => event.kind)).toEqual(['board_onset', 'exited'])
    const next = new TowersAttempt('run3-next', 'doc3-next', 1, () => undefined)
    runtime.begin(next, store, { id: 'start3-next', runId: 'run3-next',
      documentId: 'doc3-next', wallMs: 3000 })
    release()
    await Promise.resolve()
    expect(backend.root.runs.run3.events).toHaveLength(2)
    expect(runtime.unsettled).toBe(true)
    expect(next.active).toBe(true)
    runtime.markSettled('run3-next')
    store.close()
  }, 6000)
  it('does not count held delivery after allocation as an unresolved raw open', async () => {
    const backend = new MemoryBackend()
    let deliverFirst!: () => void
    backend.holdNextRead = new Promise(resolve => { deliverFirst = resolve })
    const open = TowersStore.open
    const spy = vi.spyOn(TowersStore, 'open')
      .mockImplementation((_ignored, options) => open.call(TowersStore, backend, options))
    vi.useFakeTimers()
    try {
      const runtime = new TowersRuntime()
      const opening = runtime.openStore()
      await vi.advanceTimersByTimeAsync(2500)
      await vi.advanceTimersByTimeAsync(900)
      const recovered = await opening
      expect(runtime.currentStore).toBe(recovered)
      expect(backend.closeCount).toBe(1)
      deliverFirst()
      await Promise.resolve()
      expect(runtime.currentStore).toBe(recovered)
      recovered.close()
    } finally {
      vi.useRealTimers()
      spy.mockRestore()
    }
  })
  it('permits initialization only on cold acquisition, never on replacement reopen', async () => {
    const backend = new MemoryBackend()
    const open = TowersStore.open
    const optionsSeen: boolean[] = []
    const spy = vi.spyOn(TowersStore, 'open').mockImplementation((_ignored, options) => {
      optionsSeen.push(options?.initializeIfAbsent ?? true)
      return open.call(TowersStore, backend, options)
    })
    try {
      const runtime = new TowersRuntime()
      const first = await runtime.openStore()
      const replacement = await runtime.reopenAfterReplacement(first)
      expect(replacement).not.toBe(first)
      expect(optionsSeen).toEqual([true, false])
      replacement.close()
    } finally { spy.mockRestore() }
  })
  it('settles a timely final move before a later exit or expiry decision', async () => {
    const backend = new MemoryBackend(), store = await TowersStore.open(backend)
    const runtime = new TowersRuntime(), attempt = new TowersAttempt('run4', 'doc4', 1, () => undefined)
    const start = { id: 'start4', runId: 'run4', documentId: 'doc4', wallMs: 1000 }
    runtime.begin(attempt, store, start)
    const reserved = await store.start(start)
    const intent = await store.intent({ id: 'intent4', runId: reserved.id,
      documentId: reserved.documentId, generation: reserved.generation, revision: reserved.revision })
    let run = await store.append({ id: 'onset4', runId: intent.id, documentId: intent.documentId,
      generation: intent.generation, revision: intent.revision,
      event: { kind: 'board_onset', sequence: 1, elapsedMs: 0,
        actionId: 'onsetAction4', wallTimestampMs: 1100 } })
    const form = (await loadTowersForms())[0].form
    const fixture = (await import('../../docs/specifications/ASSESSMENT_PRACTICE_TOWERS_FIXTURES_V1_0_DRAFT.json')).default
    const board = form.start.map(stack => [...stack])
    let final: Parameters<TowersStore['append']>[0] | null = null
    for (const [i, move] of fixture.scenarios[0].oneShortestPath.entries()) {
      const [from, to] = move, diskId = board[from].at(-1)!
      const input: Parameters<TowersStore['append']>[0] = {
        id: `request4_${i}`, runId: run.id, documentId: run.documentId,
        generation: run.generation, revision: run.revision,
        event: { kind: 'move', sequence: i + 2,
          elapsedMs: i === 8 ? 119999 : 3000 + i * 1000,
          actionId: `action4_${i}`, wallTimestampMs: 4000 + i * 1000,
          from, to, diskId, inputSource: 'keyboard' } }
      if (i === 8) final = input
      else run = await store.append(input)
      board[to].push(board[from].pop()!)
    }
    runtime.recordRun(run, form)
    runtime.recordAction(final!)
    attempt.setAnchor(performance.now() - 120001)
    backend.failReadAt = backend.readCount + 3
    const states: string[] = []
    const settled = new Promise<void>(resolve => runtime.subscribe(value => {
      states.push(value.state)
      if (value.state === 'settled') resolve()
    }))
    runtime.withdraw('left game', 'exited')
    await settled
    expect(states).toContain('pending')
    expect(backend.root.runs.run4.status).toBe('complete')
    expect(backend.root.runs.run4.events.at(-1)?.kind).toBe('solved')
    expect(backend.root.runs.run4.snapshot?.report.status).toBe('solved')
    store.close()
  })
})
