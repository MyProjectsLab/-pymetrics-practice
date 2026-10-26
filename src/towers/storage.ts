import { withNativeObservation } from '../mock/authority'
import type { NativeLossHandler } from '../mock/authority'
import { NativePresenceError, requireObservedNativeVersion } from '../mock/native-presence'
import { openNativeForMock, validateObservedNative } from '../mock/native-presence'
import { loadTowersForms } from './forms'
import { openExistingNativeDatabase, readExistingNativeKey } from '../mock/native-presence'
import type { CheckedForm } from './forms'
import { EVENT_VERSION, replay, report } from './engine'
import type { Event, PendingEvent, Report } from './engine'

const DB = 'assessment-practice-towers-v1'
const VERSION = 'towers-root-v1.1'
const LEGACY_VERSION = 'towers-root-v1.0'
const DATA_LOCK = 'assessment-practice-towers-data-v1'
const OWNER_LOCK = 'assessment-practice-towers-owner-v1'
const CHANNEL = 'assessment-practice-towers-notice-v1'
type Status = 'reserved' | 'active' | 'complete' | 'interrupted'
export interface Run {
  id: string; documentId: string; installationId: string; ordinal: number
  formId: string; formHash: string; wallMs: number; revision: number; generation: number
  familiar?: boolean
  presentation: 'unseen' | 'intent' | 'onset'
  exposureReview?: { reason: string; timingAvailable: false }
  status: Status; events: Event[]; snapshot?: { report: Report; events: Event[]; revision: number }
}
export interface Root {
  version: typeof VERSION; installationId: string; revision: number; nextOrdinal: number
  runs: Record<string, Run>; tombstones: Record<string, true>
  requests: Record<string, { kind: string; runId: string; payload: string }>
  activity: Record<string, { id: string; kind: 'report_viewed' | 'history_viewed'; wallMs: number }[]>
}
export interface Backend {
  read(signal?: AbortSignal): Promise<Root>
  change<T>(fn: (root: Root) => T, signal?: AbortSignal): Promise<T>
  close(): void
}
export type Notice = { type: 'deleted' | 'replaced'; installationId: string; runId?: string }
export class TowersAuthorityError extends Error {
  readonly kind: 'deleted' | 'replaced'
  constructor(kind: 'deleted' | 'replaced') {
    super(`Towers storage: ${kind === 'deleted' ? 'run deleted' : 'installation replaced'}`)
    this.kind = kind
  }
}
function assert(ok: unknown, reason: string): asserts ok {
  if (!ok) throw Error(`Towers storage: ${reason}`)
}
const validId = (value: unknown): value is string => typeof value === 'string' &&
  /^[a-zA-Z0-9_-]{1,128}$/.test(value) && !['__proto__', 'prototype', 'constructor'].includes(value)
const canceled = (signal?: AbortSignal) => assert(!signal?.aborted, 'canceled')
const aborted = () => new DOMException('Towers operation canceled', 'AbortError')
/** Retire the logical delivery promptly even when an already committed browser
 * transaction withholds its completion callback. The underlying promise stays
 * observed; the caller has no authority to resume after the signal fires. */
export function awaitTowersDelivery<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => { signal.removeEventListener('abort', onAbort); reject(aborted()) }
    signal.addEventListener('abort', onAbort, { once: true })
    if (signal.aborted) onAbort()
    void promise.then(value => { signal.removeEventListener('abort', onAbort)
      if (signal.aborted) reject(aborted()); else resolve(value)
    }, reason => { signal.removeEventListener('abort', onAbort); reject(reason) })
  })
}
export function newRoot(): Root {
  return { version: VERSION, installationId: crypto.randomUUID(), revision: 0, nextOrdinal: 1,
    runs: {}, tombstones: {}, requests: {}, activity: {} }
}
/** Bound the lock and its IDB transaction together: timeout aborts an active
 * transaction, while a transaction already committed remains readback-safe. */
export async function withTowersDataOrderBounded<T>(
  fn: (signal: AbortSignal) => Promise<T>, source?: AbortSignal,
): Promise<T> {
  assert(typeof navigator !== 'undefined' && !!navigator.locks, 'ordering unavailable')
  const controller = new AbortController()
  const abort = () => controller.abort()
  source?.addEventListener('abort', abort, { once: true })
  if (source?.aborted) controller.abort()
  const canceledDelivery = new Promise<never>((_, reject) => {
    const fail = () => reject(Error('Towers ordered transaction delivery unconfirmed'))
    controller.signal.addEventListener('abort', fail, { once: true })
    if (controller.signal.aborted) fail()
  })
  const timer = setTimeout(abort, 2500)
  try {
    const request = navigator.locks.request(DATA_LOCK,
      { mode: 'exclusive', signal: controller.signal },
      () => Promise.race([fn(controller.signal), canceledDelivery]))
    return await Promise.race([request, canceledDelivery])
  } finally {
    clearTimeout(timer)
    source?.removeEventListener('abort', abort)
  }
}
export async function acquireTowersOwner(onLost: () => void, signal?: AbortSignal): Promise<() => void> {
  assert(typeof navigator !== 'undefined' && !!navigator.locks, 'exclusive owner unavailable')
  let resolveOpen!: (release: () => void) => void
  let rejectOpen!: (reason: unknown) => void
  const open = new Promise<() => void>((resolve, reject) => { resolveOpen = resolve; rejectOpen = reject })
  let granted = false, released = false
  void navigator.locks.request(OWNER_LOCK, { mode: 'exclusive', ifAvailable: true }, async lock => {
    if (!lock || signal?.aborted) { rejectOpen(Error('Another Towers tab owns play')); return }
    granted = true
    await new Promise<void>(resolve => {
      const leave = () => { signal?.removeEventListener('abort', leave); resolve() }
      signal?.addEventListener('abort', leave, { once: true })
      resolveOpen(() => { if (!released) { released = true; leave() } })
      if (signal?.aborted || released) leave()
    })
  }).then(() => { if (granted && !released && !signal?.aborted) onLost() }, reason => {
    if (granted && !released && !signal?.aborted) onLost()
    else rejectOpen(reason)
  })
  return open
}
function validateRoot(root: Root, forms: readonly CheckedForm[], allowLegacy = false) {
  const legacy = !!root && typeof root === 'object' &&
    (root as unknown as { version?: unknown }).version === LEGACY_VERSION
  assert(root && (root.version === VERSION || (allowLegacy && legacy)) && validId(root.installationId) &&
    Number.isSafeInteger(root.revision) && root.revision >= 0 &&
    Number.isSafeInteger(root.nextOrdinal) && root.nextOrdinal >= 1 &&
    root.runs && typeof root.runs === 'object' && !Array.isArray(root.runs) &&
    root.tombstones && typeof root.tombstones === 'object' && !Array.isArray(root.tombstones) &&
    root.requests && typeof root.requests === 'object' && !Array.isArray(root.requests) &&
    root.activity && typeof root.activity === 'object' && !Array.isArray(root.activity), 'root shape')
  const ordinals = new Set<number>()
  for (const [id, run] of Object.entries(root.runs)) {
    assert(validId(id) && run.id === id && !root.tombstones[id] &&
      run.installationId === root.installationId && validId(run.documentId) &&
      Number.isSafeInteger(run.ordinal) && run.ordinal > 0 && run.ordinal < root.nextOrdinal &&
      !ordinals.has(run.ordinal) &&
      forms.some(item => item.form.formId === run.formId && item.hash === run.formHash) &&
      Number.isSafeInteger(run.generation) && run.generation > 0 &&
      Number.isSafeInteger(run.revision) && run.revision > 0 && run.revision <= root.revision &&
      Number.isFinite(run.wallMs) && (run.familiar === undefined || typeof run.familiar === 'boolean') &&
      ['reserved', 'active', 'complete', 'interrupted'].includes(run.status) &&
      Array.isArray(run.events), 'run shape')
    ordinals.add(run.ordinal)
    if (!legacy) {
      assert(['unseen', 'intent', 'onset'].includes(run.presentation) &&
        (run.presentation === 'intent' ?
          run.exposureReview?.timingAvailable === false &&
          typeof run.exposureReview.reason === 'string' && !!run.exposureReview.reason :
          run.exposureReview === undefined), 'presentation')
    }
    if (run.events.length === 0) assert(run.status === 'reserved' && !run.snapshot &&
      (legacy || run.presentation !== 'onset'), 'reserved journal')
    else {
      if (!legacy) assert(run.presentation === 'onset', 'onset presentation')
      const form = forms.find(item => item.form.formId === run.formId)!.form
      assert(run.events.every(event => event.eventVersion === EVENT_VERSION &&
        event.attemptId === run.id && event.formId === run.formId &&
        event.formHash === run.formHash && event.ownershipGeneration === run.generation),
      'event identity')
      const state = replay(form, run.events)
      assert(run.events[0].kind === 'board_onset' &&
        (state.terminal === 'solved' ? run.status === 'complete' :
          state.terminal ? run.status === 'interrupted' : run.status === 'active'), 'run status')
      if (state.terminal) assert(run.snapshot &&
        JSON.stringify(run.snapshot.report) === JSON.stringify(report(form, run.events)) &&
        JSON.stringify(run.snapshot.events) === JSON.stringify(run.events) &&
        run.snapshot.revision === run.revision, 'snapshot')
      else assert(!run.snapshot, 'unexpected snapshot')
    }
  }
  for (const [id, value] of Object.entries(root.tombstones))
    assert(validId(id) && value === true && !root.runs[id], 'tombstone')
  for (const [id, request] of Object.entries(root.requests))
    assert(validId(id) && !!root.runs[request.runId] && validId(request.runId) &&
      typeof request.kind === 'string' && typeof request.payload === 'string', 'request')
  for (const [id, items] of Object.entries(root.activity))
    assert((id === 'installation' || !!root.runs[id]) && Array.isArray(items) &&
      items.every(item => validId(item.id) && Number.isFinite(item.wallMs) &&
        ['report_viewed', 'history_viewed'].includes(item.kind)), 'activity')
}
function migrateRoot(root: Root, forms: readonly CheckedForm[]) {
  if (root.version === VERSION) { validateRoot(root, forms); return }
  validateRoot(root, forms, true)
  assert((root as { version: string }).version === LEGACY_VERSION, 'legacy version')
  for (const run of Object.values(root.runs)) {
    run.presentation = run.events.length ? 'onset' : 'intent'
    if (!run.events.length) run.exposureReview = {
      reason: 'This earlier board may have been shown before its start was confirmed.',
      timingAvailable: false }
  }
  root.version = VERSION
  root.revision++
  validateRoot(root, forms)
}
class IndexedBackend implements Backend {
  private db: IDBDatabase
  constructor(db: IDBDatabase) { this.db = db }
  close() { this.db.close() }
  private transact<T>(mode: IDBTransactionMode, fn: (root: Root) => T, signal?: AbortSignal): Promise<T> {
    canceled(signal)
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('installation', mode)
      let value: T, settled = false
      const cleanup = () => signal?.removeEventListener('abort', abort)
      const fail = (reason: unknown) => { if (!settled) { settled = true; cleanup(); reject(reason) } }
      const abort = () => { try { tx.abort() } catch { /* finished */ }; fail(aborted()) }
      signal?.addEventListener('abort', abort, { once: true })
      const get = tx.objectStore('installation').get('root')
      get.onsuccess = () => {
        if (settled || signal?.aborted) return
        try { assert(get.result !== undefined, 'root unavailable'); value = fn(get.result as Root)
          if (mode === 'readwrite') tx.objectStore('installation').put(get.result, 'root') }
        catch (reason) { fail(reason); abort() }
      }
      get.onerror = () => fail(get.error ?? Error('read failed'))
      tx.oncomplete = () => { cleanup()
        // The transaction may have committed while delivery was held. Never
        // resume a caller that has already relinquished the data lock.
        if (signal?.aborted) { fail(Error('Towers transaction delivery unconfirmed')); return }
        if (!settled) { settled = true; resolve(structuredClone(value)) } }
      tx.onerror = () => fail(tx.error ?? Error('transaction failed'))
      tx.onabort = () => fail(tx.error ?? Error('transaction aborted'))
    })
  }
  read(signal?: AbortSignal) { return this.transact('readonly', root => root, signal) }
  change<T>(fn: (root: Root) => T, signal?: AbortSignal) { return this.transact('readwrite', fn, signal) }
}
export interface TowersOpenOptions {
  signal?: AbortSignal
  acquireRawOpen?: () => () => void
  initializeIfAbsent?: boolean
}
async function openBackend(options: TowersOpenOptions = {}): Promise<Backend> {
  return new Promise((resolve, reject) => {
    const { signal } = options
    let db: IDBDatabase | undefined, tx: IDBTransaction | undefined, settled = false
    let releaseRaw: (() => void) | undefined
    try { releaseRaw = options.acquireRawOpen?.() } catch (reason) { reject(reason); return }
    const rawDone = () => { releaseRaw?.(); releaseRaw = undefined }
    const fail = (reason: unknown) => { if (settled) return
      settled = true; signal?.removeEventListener('abort', onAbort)
      db?.close(); reject(reason)
    }
    const onAbort = () => { try { tx?.abort() } catch { /* already committed */ }
      fail(aborted()) }
    signal?.addEventListener('abort', onAbort, { once: true })
    if (signal?.aborted) { onAbort(); rawDone(); return }
    let request: IDBOpenDBRequest
    try { request = indexedDB.open(DB, 1) }
    catch (reason) { rawDone(); fail(reason); return }
    request.onupgradeneeded = () => {
      if (settled) { try { request.transaction?.abort() } catch { /* already committed */ }; return }
      request.result.createObjectStore('installation')
    }
    request.onerror = () => { rawDone(); fail(request.error ?? Error('database unavailable')) }
    request.onsuccess = () => {
      rawDone(); db = request.result
      if (settled || signal?.aborted) { db.close(); return }
      try {
        tx = db.transaction('installation', 'readwrite')
        const store = tx.objectStore('installation')
        // Cursor presence, unlike get().result, distinguishes an absent key
        // from an existing key whose invalid value is falsey or undefined.
        const cursor = store.openCursor('root')
        cursor.onsuccess = () => {
          if (!settled && !signal?.aborted && !cursor.result && options.initializeIfAbsent !== false)
            store.add(newRoot(), 'root')
        }
        tx.oncomplete = () => { if (settled || signal?.aborted) return
          settled = true; signal?.removeEventListener('abort', onAbort)
          resolve(new IndexedBackend(db!)) }
        tx.onerror = () => fail(tx?.error ?? Error('initialization failed'))
        tx.onabort = () => fail(tx?.error ?? aborted())
      } catch (reason) { fail(reason) }
    }
  })
}
export class TowersStore {
  readonly installationId: string
  readonly backend: Backend
  readonly forms: readonly CheckedForm[]
  private channel: BroadcastChannel | null = null
  private listeners = new Set<(notice: Notice) => void>()
  private constructor(backend: Backend, root: Root, forms: readonly CheckedForm[]) {
    this.backend = backend; this.installationId = root.installationId; this.forms = forms
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(CHANNEL)
      this.channel.onmessage = event => this.notify(event.data as Notice)
    }
  }
  static async open(backend?: Backend, options: TowersOpenOptions = {}) {
    const { signal } = options
    const forms = await awaitTowersDelivery(loadTowersForms(), signal)
    const source = backend ?? await awaitTowersDelivery(openBackend(options), signal)
    try {
      const first = await awaitTowersDelivery(source.read(signal), signal)
      if (first && typeof first === 'object' &&
        (first as unknown as { version?: unknown }).version === LEGACY_VERSION) {
        const migrate = (signal?: AbortSignal) => source.change(root => migrateRoot(root, forms), signal)
        if (typeof navigator !== 'undefined' && navigator.locks)
          await awaitTowersDelivery(withTowersDataOrderBounded(migrate, signal), signal)
        else await awaitTowersDelivery(migrate(signal), signal)
      }
      const root = await awaitTowersDelivery(source.read(signal), signal)
      canceled(signal)
      validateRoot(root, forms)
      return new TowersStore(source, root, forms)
    } catch (reason) {
      source.close()
      throw reason
    }
  }
  /** Retained mock lookup never runs native first-visit initialization or legacy migration. */
  static openForMock(parent?:AbortSignal,allowCreate=true){return openNativeForMock(DB,1,db=>{db.createObjectStore('installation').put(newRoot(),'root')},signal=>this.openRetained(signal),parent,allowCreate)}
  static async openRetained(signal: AbortSignal): Promise<TowersStore> {
    const db = await openExistingNativeDatabase(DB, signal)
    const backend = new IndexedBackend(db)
    try {if(db.version!==1)throw new NativePresenceError('unsupported','Native source database version is unsupported');
      const raw = await readExistingNativeKey(db, 'installation', 'root', signal) as Root
      const forms = await awaitTowersDelivery(loadTowersForms(), signal)
      canceled(signal); requireObservedNativeVersion(raw,'version',[VERSION]); validateObservedNative(()=>validateRoot(raw, forms))
      return new TowersStore(backend, raw, forms)
    } catch (error) { backend.close(); throw error }
  }
  close() { this.channel?.close(); this.backend.close() }
  subscribe(fn: (notice: Notice) => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn) } }
  private notify(notice: Notice) { this.listeners.forEach(fn => fn(notice)) }
  private broadcast(notice: Notice) { this.channel?.postMessage(notice); this.notify(notice) }
  async read(signal?: AbortSignal) {
    const root = await this.backend.read(signal)
    validateRoot(root, this.forms)
    if (root.installationId !== this.installationId) throw new TowersAuthorityError('replaced')
    return root
  }
  private change<T>(fn: (root: Root) => T, signal?: AbortSignal) {
    return this.backend.change(root => {
      validateRoot(root, this.forms)
      if (root.installationId !== this.installationId) throw new TowersAuthorityError('replaced')
      const value = fn(root)
      validateRoot(root, this.forms)
      return value
    }, signal)
  }
  private request<T>(root: Root, id: string, kind: string, runId: string, payload: unknown,
    retry: () => T, fresh: () => T): T {
    assert(validId(id), 'request id')
    const previous = root.requests[id]
    const bytes = JSON.stringify(payload)
    if (previous) { assert(previous.kind === kind && previous.runId === runId &&
      previous.payload === bytes && !!root.runs[runId], 'request conflict or retired')
      return retry() }
    const result = fresh()
    root.requests[id] = { kind, runId, payload: bytes }
    return result
  }
  start(input: { id: string; runId: string; documentId: string; wallMs: number;
    preferredFormId?: string }, signal?: AbortSignal) {
    return this.change(root => this.request(root, input.id, 'start', input.runId, input,
      () => root.runs[input.runId], () => {
        assert(validId(input.runId) && validId(input.documentId) &&
          !root.runs[input.runId] && !root.tombstones[input.runId] &&
          Number.isFinite(input.wallMs), 'start')
        const retainedForms = new Set(Object.values(root.runs).filter(run => run.presentation !== 'unseen')
          .map(run => run.formId))
        const reservedForms = new Set(Object.values(root.runs).filter(run => run.status === 'reserved')
          .map(run => run.formId))
        const chosen = input.preferredFormId ? this.forms.find(item =>
          item.form.formId === input.preferredFormId) : this.forms.find(item =>
          !retainedForms.has(item.form.formId) && !reservedForms.has(item.form.formId)) ?? this.forms[0]
        assert(chosen, 'preferred form')
        const ordinal = root.nextOrdinal++
        const run: Run = { id: input.runId, documentId: input.documentId,
          installationId: root.installationId, ordinal, formId: chosen.form.formId,
          formHash: chosen.hash, wallMs: input.wallMs, revision: ++root.revision,
          generation: 1, familiar: retainedForms.has(chosen.form.formId),
          status: 'reserved', presentation: 'unseen', events: [] }
        root.runs[run.id] = run
        return run
      }), signal)
  }
  intent(input: { id: string; runId: string; documentId: string; generation: number;
    revision: number }, signal?: AbortSignal) {
    return this.change(root => this.request(root, input.id, 'presentation_intent', input.runId, input,
      () => root.runs[input.runId], () => {
        const run = root.runs[input.runId]
        assert(run && !root.tombstones[input.runId] && run.status === 'reserved' &&
          run.presentation === 'unseen' && run.documentId === input.documentId &&
          run.generation === input.generation && run.revision === input.revision, 'intent authority')
        run.presentation = 'intent'
        run.exposureReview = { reason: 'The board display could not be confirmed.',
          timingAvailable: false }
        run.revision = ++root.revision
        return run
      }), signal)
  }
  resolveOnsetFailure(input: { id: string; runId: string; documentId: string;
    generation: number; revision: number; onsetActionId: string;
    terminal?: { elapsedMs: number; reason: string; wallTimestampMs: number;
      kind?: 'exited' | 'interrupted' } }, signal?: AbortSignal) {
    return this.change(root => this.request(root, input.id, 'resolve_onset_failure', input.runId,
      input, () => root.runs[input.runId], () => {
        const run = root.runs[input.runId]
        assert(run && !root.tombstones[input.runId] &&
          run.documentId === input.documentId && run.generation === input.generation,
        'onset resolution authority')
        if (run.status === 'reserved' && run.presentation === 'intent' &&
          run.revision === input.revision) {
          run.exposureReview = { reason: 'The visible board could not be confirmed as a timed attempt.',
            timingAvailable: false }
          // Fence a delayed first onset transaction using the run revision.
          run.revision = ++root.revision
          return run
        }
        assert(run.presentation === 'onset' && run.events[0]?.kind === 'board_onset' &&
          run.events[0].actionId === input.onsetActionId, 'onset resolution state')
        if (input.terminal && run.status === 'active') {
          const form = this.forms.find(item => item.form.formId === run.formId)!.form
          assert(Number.isFinite(input.terminal.elapsedMs) && input.terminal.elapsedMs >= 0 &&
            Number.isFinite(input.terminal.wallTimestampMs) && !!input.terminal.reason,
          'terminal resolution shape')
          const expired = input.terminal.elapsedMs >= form.limitMs
          const terminal: Event = {
            kind: expired ? 'expired' : input.terminal.kind ?? 'interrupted', sequence: run.events.length + 1,
            elapsedMs: expired ? form.limitMs : input.terminal.elapsedMs,
            wallTimestampMs: input.terminal.wallTimestampMs,
            actionId: `${input.id}_terminal`,
            ...(expired ? {} : { reason: input.terminal.reason }),
            eventVersion: EVENT_VERSION, attemptId: run.id,
            formId: run.formId, formHash: run.formHash,
            ownershipGeneration: run.generation,
          }
          const events = [...run.events, terminal]
          replay(form, events)
          run.events = events; run.revision = ++root.revision
          run.status = 'interrupted'
          run.snapshot = { report: report(form, events)!, events: structuredClone(events),
            revision: run.revision }
        }
        return run
      }), signal)
  }
  append(input: { id: string; runId: string; documentId: string; generation: number;
    revision: number; event: PendingEvent }, signal?: AbortSignal) {
    return this.change(root => this.request(root, input.id, 'append', input.runId, input,
      () => root.runs[input.runId], () => {
        const run = root.runs[input.runId]
        assert(run && run.documentId === input.documentId &&
          run.generation === input.generation && run.revision === input.revision &&
          !root.tombstones[input.runId] && ['reserved', 'active'].includes(run.status), 'run authority')
        const form = this.forms.find(item => item.form.formId === run.formId)!.form
        const event: Event = { ...input.event, eventVersion: EVENT_VERSION, attemptId: run.id,
          formId: run.formId, formHash: run.formHash, ownershipGeneration: run.generation }
        const events = [...run.events, event]
        let state = replay(form, events)
        assert(run.status !== 'reserved' || (run.presentation === 'intent' &&
          input.event.kind === 'board_onset'), 'first onset')
        if (input.event.kind === 'board_onset') {
          run.presentation = 'onset'; delete run.exposureReview
        }
        if (input.event.kind === 'move' && !state.terminal &&
          state.board.every((stack, index) => stack.join() === form.target[index].join())) {
          const solved: Event = { ...event, kind: 'solved', sequence: event.sequence + 1,
            actionId: `${event.actionId}_solved`, inputSource: undefined,
            diskId: undefined, from: undefined, to: undefined }
          events.push(solved)
          state = replay(form, events)
        }
        run.events = events; run.revision = ++root.revision
        run.status = state.terminal === 'solved' ? 'complete' : state.terminal ? 'interrupted' : 'active'
        if (state.terminal) run.snapshot = { report: report(form, events)!,
          events: structuredClone(events), revision: run.revision }
        return run
      }), signal)
  }
  async inspect(runId: string, signal?: AbortSignal) {
    const root = await this.read(signal)
    const run = root.runs[runId]
    if (!run) throw new TowersAuthorityError('deleted')
    const form = this.forms.find(item => item.form.formId === run.formId)!.form
    return { root, run, form, report: report(form, run.events) }
  }
  async list(signal?: AbortSignal) {
    const root = await this.read(signal)
    return Object.values(root.runs).toSorted((a, b) => b.wallMs - a.wallMs || b.revision - a.revision)
      .map(run => ({ run, report: report(this.forms.find(item => item.form.formId === run.formId)!.form,
        run.events) }))
  }
  view(runId: string, id: string, kind: 'report_viewed' | 'history_viewed', signal?: AbortSignal) {
    return this.change(root => {
      assert(validId(id) && !!root.runs[runId], 'view target')
      const items = root.activity[runId] ?? []
      if (!items.some(item => item.id === id)) {
        items.push({ id, kind, wallMs: Date.now() }); root.activity[runId] = items; root.revision++
      }
    }, signal)
  }
  async cancelUnseen(input: { runId: string; documentId: string; generation: number;
    startRequestId?: string }, signal?: AbortSignal) {
    await withTowersDataOrderBounded(async orderedSignal => this.change(root => {
      const { runId } = input
      assert(validId(runId) && validId(input.documentId) &&
        Number.isSafeInteger(input.generation) && input.generation > 0 &&
        (input.startRequestId === undefined || validId(input.startRequestId)), 'cancellation identity')
      const run = root.runs[runId]
      if (run) assert(run.documentId === input.documentId &&
        run.generation === input.generation, 'cancellation authority')
      if (run && (run.status !== 'reserved' || run.presentation !== 'unseen')) return
      if (!run && !input.startRequestId) return
      if (run) delete root.runs[runId]
      if (root.tombstones[runId]) return
      root.tombstones[runId] = true
      for (const key of Object.keys(root.requests)) if (root.requests[key].runId === runId)
        delete root.requests[key]
      root.revision++
    }, orderedSignal), signal)
  }
  async delete(runId: string, signal?: AbortSignal) {
    await withTowersDataOrderBounded(async orderedSignal => this.change(root => {
      assert(!!root.runs[runId], 'delete target')
      delete root.runs[runId]; delete root.activity[runId]
      for (const key of Object.keys(root.requests)) if (root.requests[key].runId === runId)
        delete root.requests[key]
      root.tombstones[runId] = true; root.revision++
    }, orderedSignal), signal)
    this.broadcast({ type: 'deleted', installationId: this.installationId, runId })
  }
  async deleteAll(signal?: AbortSignal) {
    await withTowersDataOrderBounded(async orderedSignal => this.backend.change(root => {
      validateRoot(root, this.forms)
      if (root.installationId !== this.installationId) throw new TowersAuthorityError('replaced')
      Object.assign(root, newRoot())
    }, orderedSignal), signal)
    this.broadcast({ type: 'replaced', installationId: this.installationId })
  }
}

/** Mock observation only; ordinary native writers keep their existing order. */
export function withTowersMockOrder<T>(work:(signal:AbortSignal)=>Promise<T>,parent:AbortSignal,loss?:NativeLossHandler<T>):Promise<T>{return withNativeObservation(DATA_LOCK,work,parent,loss)}
