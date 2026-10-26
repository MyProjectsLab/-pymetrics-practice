import { withNativeObservation } from '../mock/authority'
import type { NativeLossHandler } from '../mock/authority'
import { NativePresenceError, requireObservedNativeVersion } from '../mock/native-presence'
import { openNativeForMock, validateObservedNative } from '../mock/native-presence'
import { formForOrdinal, loadForms } from './forms'
import { openExistingNativeDatabase, readExistingNativeKey } from '../mock/native-presence'
import type { Form } from './forms'
import { EVENT_VERSION, reportFromJournal } from './report'
import type { JournalEvent, Report } from './report'

const DB_NAME = 'assessment-practice-easy-hard-v1'
const ROOT_VERSION = 'easy-hard-storage-v1.0'
const DATA_LOCK = 'assessment-practice-easy-hard-data-v1'
const LIVE_LOCK = 'assessment-practice-easy-hard-live-v1'
const CHANNEL = 'assessment-practice-easy-hard-authority-v1'

export interface Run {
  id: string; documentId: string; installationId: string; ordinal: number
  formId: string; formHash: string; createdAtWallMs: number; wallAnchorMs: number
  soundCues: boolean; reducedMotion: boolean
  epoch: number; revision: number; status: 'reserved' | 'active' | 'complete' | 'interrupted' | 'invalid'
  events: JournalEvent[]; snapshot?: { report: Report; events: JournalEvent[]; revision: number }
}
export interface Root {
  version: typeof ROOT_VERSION; installationId: string; revision: number
  nextExposureOrdinal: number; runs: Record<string, Run>; tombstones: Record<string, true>
  requests: Record<string, { kind: string; payload: string; runId: string }>
  activity: Record<string, { id: string; kind: 'report_viewed' | 'history_viewed'; atWallMs: number }[]>
}
export interface Backend {
  read(signal?: AbortSignal): Promise<Root>
  change<T>(fn: (root: Root) => T, signal?: AbortSignal): Promise<T>
  close(): void
}
export type Notice = { type: 'deleted' | 'replaced'; installationId: string; runId?: string }
export function newRoot(): Root { return { version: ROOT_VERSION, installationId: crypto.randomUUID(),
  revision: 0, nextExposureOrdinal: 1, runs: {}, tombstones: {}, requests: {}, activity: {} } }
function assert(ok: unknown, reason: string): asserts ok {
  if (!ok) throw Error(`Easy or Hard storage: ${reason}`)
}
function validId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value) &&
    !['__proto__', 'prototype', 'constructor'].includes(value)
}
function checkAbort(signal?: AbortSignal) { assert(!signal?.aborted, 'canceled') }

/** Start, deletion and visible publication all use this one cross-tab order. */
export async function withEasyHardDataOrder<T>(fn: () => Promise<T>): Promise<T> {
  assert(typeof navigator !== 'undefined' && 'locks' in navigator, 'data ordering unavailable')
  const abort = new AbortController()
  const timer = setTimeout(() => abort.abort(), 4000)
  try { return await navigator.locks.request(DATA_LOCK, { mode: 'exclusive', signal: abort.signal },
    async () => { clearTimeout(timer); return fn() }) }
  finally { clearTimeout(timer) }
}
export async function acquireEasyHardOwner(onLost: () => void, signal?: AbortSignal): Promise<() => void> {
  assert(typeof navigator !== 'undefined' && 'locks' in navigator, 'exclusive owner unavailable')
  let resolveOpen!: (release: () => void) => void
  let rejectOpen!: (reason: unknown) => void
  const opened = new Promise<() => void>((resolve, reject) => { resolveOpen = resolve; rejectOpen = reject })
  let granted = false, released = false
  void navigator.locks.request(LIVE_LOCK, { mode: 'exclusive', ifAvailable: true }, async lock => {
    if (!lock || signal?.aborted) { rejectOpen(Error('Another Easy or Hard tab owns play')); return }
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
  return opened
}

export function validateRoot(root: Root, forms: ReadonlyMap<string, { form: Form; hash: string }>) {
  assert(root && root.version === ROOT_VERSION && validId(root.installationId) &&
    Number.isSafeInteger(root.revision) && root.revision >= 0 &&
    Number.isSafeInteger(root.nextExposureOrdinal) && root.nextExposureOrdinal >= 1 &&
    root.runs && typeof root.runs === 'object' && !Array.isArray(root.runs) &&
    root.tombstones && typeof root.tombstones === 'object' && !Array.isArray(root.tombstones) &&
    root.requests && typeof root.requests === 'object' && !Array.isArray(root.requests) &&
    root.activity && typeof root.activity === 'object' && !Array.isArray(root.activity), 'root shape')
  const ordinals = new Set<number>()
  for (const [id, run] of Object.entries(root.runs)) {
    assert(validId(id) && run.id === id && !root.tombstones[id] &&
      run.installationId === root.installationId && validId(run.documentId) &&
      Number.isSafeInteger(run.ordinal) && run.ordinal > 0 && run.ordinal < root.nextExposureOrdinal &&
      !ordinals.has(run.ordinal) && Number.isSafeInteger(run.revision) && run.revision > 0 &&
      run.revision <= root.revision && Number.isSafeInteger(run.epoch) && run.epoch > 0 &&
      Number.isFinite(run.createdAtWallMs) && Number.isFinite(run.wallAnchorMs) &&
      typeof run.soundCues === 'boolean' && typeof run.reducedMotion === 'boolean' &&
      ['reserved', 'active', 'complete', 'interrupted', 'invalid'].includes(run.status) &&
      Array.isArray(run.events), 'run shape')
    ordinals.add(run.ordinal)
    const assigned = formForOrdinal(forms, run.ordinal)
    assert(run.formId === assigned.form.formId && run.formHash === assigned.hash, 'assigned form')
    if (run.events.length > 0) {
      const report = reportFromJournal(assigned.form, assigned.hash, run.events)
      const lastKind = run.events.at(-1)!.kind
      assert(run.events[0].attemptId === run.id &&
        run.events[0].ownershipGeneration === run.epoch &&
        report.status === (run.status === 'complete' ? 'complete' : 'incomplete_review'), 'journal status')
      assert((run.status === 'complete' && report.status === 'complete') ||
        (run.status === 'interrupted' && ['run_interrupted', 'run_exited'].includes(lastKind)) ||
        (run.status === 'invalid' && lastKind === 'run_invalid') ||
        (run.status === 'active' && !['run_interrupted', 'run_exited', 'run_invalid',
          'global_expired', 'global_expired_in_choice', 'global_expired_after_choice'].includes(lastKind)),
      'terminal status')
      if (run.status === 'complete') assert(run.snapshot &&
        JSON.stringify(run.snapshot.events) === JSON.stringify(run.events) &&
        JSON.stringify(run.snapshot.report) === JSON.stringify(report) &&
        run.snapshot.revision === run.revision, 'terminal snapshot')
      else assert(!run.snapshot, 'nonterminal snapshot')
    } else assert(run.status === 'reserved' && !run.snapshot, 'empty run status')
  }
  for (const [id, value] of Object.entries(root.tombstones))
    assert(validId(id) && value === true && !root.runs[id], 'tombstone')
  for (const [id, request] of Object.entries(root.requests))
    assert(validId(id) && !!root.runs[request.runId] && !root.tombstones[request.runId] &&
      typeof request.kind === 'string' && typeof request.payload === 'string', 'request')
  for (const [id, items] of Object.entries(root.activity))
    assert(validId(id) && (id === 'installation' || !!root.runs[id]) && Array.isArray(items) &&
      items.every(item => validId(item.id) && Number.isFinite(item.atWallMs) &&
        ['report_viewed', 'history_viewed'].includes(item.kind)), 'activity')
}

class IndexedBackend implements Backend {
  private database: IDBDatabase
  constructor(database: IDBDatabase) { this.database = database }
  close() { this.database.close() }
  private transact<T>(mode: IDBTransactionMode, fn: (root: Root) => T, signal?: AbortSignal): Promise<T> {
    checkAbort(signal)
    return new Promise((resolve, reject) => {
      const tx = this.database.transaction('installation', mode)
      let value: T, settled = false
      const fail = (reason: unknown) => { if (!settled) { settled = true; reject(reason) } }
      const abort = () => { try { tx.abort() } catch { /* settled */ } }
      signal?.addEventListener('abort', abort, { once: true })
      const get = tx.objectStore('installation').get('root')
      get.onsuccess = () => {
        try { assert(get.result, 'root unavailable'); value = fn(get.result as Root)
          if (mode === 'readwrite') tx.objectStore('installation').put(get.result, 'root')
        } catch (reason) { fail(reason); abort() }
      }
      get.onerror = () => fail(get.error ?? Error('read failed'))
      tx.oncomplete = () => { signal?.removeEventListener('abort', abort)
        if (!settled) { settled = true; resolve(structuredClone(value)) } }
      tx.onerror = () => fail(tx.error ?? Error('transaction failed'))
      tx.onabort = () => fail(tx.error ?? Error('transaction aborted'))
    })
  }
  read(signal?: AbortSignal) { return this.transact('readonly', root => root, signal) }
  change<T>(fn: (root: Root) => T, signal?: AbortSignal) { return this.transact('readwrite', fn, signal) }
}
async function openBackend(): Promise<Backend> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore('installation')
    request.onerror = () => reject(request.error ?? Error('database unavailable'))
    request.onsuccess = () => {
      const database = request.result
      try {
        const tx = database.transaction('installation', 'readwrite')
        const store = tx.objectStore('installation')
        const get = store.get('root')
        get.onsuccess = () => { if (!get.result) store.put(newRoot(), 'root') }
        tx.oncomplete = () => resolve(new IndexedBackend(database))
        tx.onerror = () => { database.close(); reject(tx.error ?? Error('initialization failed')) }
      } catch (reason) { database.close(); reject(reason) }
    }
  })
}

export class EasyHardStore {
  private forms: ReadonlyMap<string, { form: Form; hash: string }>
  readonly backend: Backend
  readonly installationId: string
  private channel: BroadcastChannel | null = null
  private listeners = new Set<(notice: Notice) => void>()
  private constructor(backend: Backend, root: Root, forms: ReadonlyMap<string, { form: Form; hash: string }>) {
    this.backend = backend; this.installationId = root.installationId; this.forms = forms
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(CHANNEL)
      this.channel.onmessage = event => this.notify(event.data as Notice)
    }
  }
  static async open(backend?: Backend) {
    const forms = await loadForms()
    const source = backend ?? await openBackend()
    const root = await source.read()
    validateRoot(root, forms)
    return new EasyHardStore(source, root, forms)
  }
  /** Mock retained lookup preserves an absent or falsey root rather than initializing it. */
  static openForMock(parent?:AbortSignal,allowCreate=true){return openNativeForMock(DB_NAME,1,db=>{db.createObjectStore('installation').put(newRoot(),'root')},signal=>this.openRetained(signal),parent,allowCreate)}
  static async openRetained(signal: AbortSignal) {
    const database = await openExistingNativeDatabase(DB_NAME, signal)
    const backend = new IndexedBackend(database)
    try {if(database.version!==1)throw new NativePresenceError('unsupported','Native source database version is unsupported');
      const raw = await readExistingNativeKey(database, 'installation', 'root', signal)
      const forms = await loadForms()
      signal.throwIfAborted()
      requireObservedNativeVersion(raw,'version',[ROOT_VERSION]); validateObservedNative(()=>validateRoot(raw as Root, forms))
      return new EasyHardStore(backend, raw as Root, forms)
    } catch (error) { backend.close(); throw error }
  }
  close() { this.channel?.close(); this.backend.close() }
  subscribe(fn: (notice: Notice) => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn) } }
  private notify(notice: Notice) { this.listeners.forEach(fn => fn(notice)) }
  private broadcast(notice: Notice) { this.channel?.postMessage(notice); this.notify(notice) }
  async read(signal?: AbortSignal) {
    const root = await this.backend.read(signal)
    validateRoot(root, this.forms)
    assert(root.installationId === this.installationId, 'installation replaced')
    return root
  }
  private async change<T>(fn: (root: Root) => T, signal?: AbortSignal) {
    return this.backend.change(root => {
      validateRoot(root, this.forms)
      assert(root.installationId === this.installationId, 'installation replaced')
      const value = fn(root)
      validateRoot(root, this.forms)
      return value
    }, signal)
  }
  private request<T>(root: Root, kind: string, id: string, payload: unknown, runId: string, fn: () => T): T {
    assert(validId(id), 'request id')
    const serialized = JSON.stringify(payload)
    const previous = root.requests[id]
    if (previous) {
      assert(previous.kind === kind && previous.payload === serialized && previous.runId === runId &&
        !!root.runs[runId], 'request conflict or deleted target')
      return root.runs[runId] as T
    }
    const value = fn()
    root.requests[id] = { kind, payload: serialized, runId }
    return value
  }
  async start(input: { id: string; runId: string; documentId: string; wallMs: number; wallAnchorMs: number;
    soundCues?: boolean; reducedMotion?: boolean }, signal?: AbortSignal) {
    return this.change(root => this.request(root, 'start', input.id, input, input.runId, () => {
      assert(validId(input.runId) && validId(input.documentId) && !root.runs[input.runId] &&
        !root.tombstones[input.runId] && Number.isFinite(input.wallMs) &&
        Number.isFinite(input.wallAnchorMs) &&
        (input.soundCues === undefined || typeof input.soundCues === 'boolean') &&
        (input.reducedMotion === undefined || typeof input.reducedMotion === 'boolean'), 'start')
      const retained = Object.values(root.runs)
      const used = new Set(retained.map(run => run.ordinal))
      const retainedForms = new Set(retained.map(run => run.formId))
      let ordinal = 1
      while (ordinal <= this.forms.size &&
        (used.has(ordinal) || retainedForms.has(formForOrdinal(this.forms, ordinal).form.formId)))
        ordinal++
      if (ordinal > this.forms.size) {
        // All original forms are still represented; replay never becomes a "new" form
        // merely because an earlier ordinal was deleted.
        while (used.has(ordinal)) ordinal++
      }
      root.nextExposureOrdinal = Math.max(root.nextExposureOrdinal, ordinal + 1)
      const selected = formForOrdinal(this.forms, ordinal)
      const run: Run = { id: input.runId, documentId: input.documentId,
        installationId: root.installationId, ordinal, formId: selected.form.formId,
        formHash: selected.hash, createdAtWallMs: input.wallMs,
        wallAnchorMs: input.wallAnchorMs, soundCues: input.soundCues ?? false,
        reducedMotion: input.reducedMotion ?? false, epoch: 1, revision: ++root.revision,
        status: 'reserved', events: [] }
      root.runs[run.id] = run
      return run
    }), signal)
  }
  async append(input: { id: string; runId: string; documentId: string; epoch: number; revision: number;
    onsetWallMs?: number;
    event: Omit<JournalEvent, 'eventVersion' | 'attemptId' | 'formId' | 'formHash' |
      'ownershipGeneration' | 'sequence' | 'wallTimestampMs'> }, signal?: AbortSignal) {
    return this.change(root => this.request(root, 'append', input.id, input, input.runId, () => {
      const run = root.runs[input.runId]
      assert(run && (run.status === 'reserved' || run.status === 'active') &&
        run.documentId === input.documentId && run.epoch === input.epoch &&
        run.revision === input.revision && !root.tombstones[input.runId], 'run authority changed')
      if (run.status === 'reserved') {
        assert(input.event.kind === 'offer_onset' && input.event.elapsedMs === 0 &&
          (input.onsetWallMs === undefined || Number.isFinite(input.onsetWallMs)), 'first scored onset')
        if (input.onsetWallMs !== undefined) run.wallAnchorMs = input.onsetWallMs
      } else assert(input.onsetWallMs === undefined, 'late onset anchor')
      const event: JournalEvent = { ...input.event, eventVersion: EVENT_VERSION,
        attemptId: run.id, formId: run.formId, formHash: run.formHash,
        ownershipGeneration: run.epoch, sequence: run.events.length + 1,
        wallTimestampMs: run.wallAnchorMs + input.event.elapsedMs }
      const selected = this.forms.get(run.formId)!
      const events = [...run.events, event]
      const report = reportFromJournal(selected.form, selected.hash, events)
      if (run.status === 'reserved') assert(event.kind === 'offer_onset', 'first scored display')
      run.events = events; run.revision = ++root.revision
      if (report.status === 'complete') {
        run.status = 'complete'
        run.snapshot = { report, events: structuredClone(events), revision: run.revision }
      } else if (event.kind === 'run_interrupted' || event.kind === 'run_exited') run.status = 'interrupted'
      else if (event.kind === 'run_invalid') run.status = 'invalid'
      else run.status = 'active'
      return run
    }), signal)
  }
  async inspect(runId: string, signal?: AbortSignal) {
    const root = await this.read(signal)
    const run = root.runs[runId]
    assert(run, 'run deleted')
    const selected = this.forms.get(run.formId)!
    return { root, run, form: selected.form, report: run.events.length ?
      reportFromJournal(selected.form, selected.hash, run.events) : null }
  }
  async list(signal?: AbortSignal) {
    const root = await this.read(signal)
    return Object.values(root.runs).toSorted((a, b) =>
      b.createdAtWallMs - a.createdAtWallMs || b.revision - a.revision)
      .map(run => { const selected = this.forms.get(run.formId)!
        return { run, report: run.events.length ? reportFromJournal(selected.form, selected.hash, run.events) : null } })
  }
  async view(runId: string, id: string, kind: 'report_viewed' | 'history_viewed', signal?: AbortSignal) {
    return this.change(root => {
      assert(validId(id) && !!root.runs[runId], 'view target')
      const list = root.activity[runId] ?? []
      if (!list.some(item => item.id === id)) {
        list.push({ id, kind, atWallMs: Date.now() })
        root.activity[runId] = list; root.revision++
      }
    }, signal)
  }
  async viewHistory(id: string, signal?: AbortSignal) {
    return this.change(root => {
      assert(validId(id), 'history event id')
      const list = root.activity.installation ?? []
      if (!list.some(item => item.id === id)) {
        list.push({ id, kind: 'history_viewed', atWallMs: Date.now() })
        root.activity.installation = list; root.revision++
      }
    }, signal)
  }
  async delete(runId: string, signal?: AbortSignal) {
    await withEasyHardDataOrder(async () => this.change(root => {
      assert(!!root.runs[runId], 'delete target')
      delete root.runs[runId]; delete root.activity[runId]
      for (const id of Object.keys(root.requests)) if (root.requests[id].runId === runId) delete root.requests[id]
      root.tombstones[runId] = true; root.revision++
    }, signal))
    this.broadcast({ type: 'deleted', installationId: this.installationId, runId })
  }
  async deleteAll(signal?: AbortSignal) {
    await withEasyHardDataOrder(async () => this.backend.change(root => {
      validateRoot(root, this.forms)
      assert(root.installationId === this.installationId, 'installation replaced')
      Object.assign(root, newRoot())
    }, signal))
    this.broadcast({ type: 'replaced', installationId: this.installationId })
  }
}

/** Mock observation only; ordinary native writers keep their existing order. */
export function withEasyHardMockOrder<T>(work:(signal:AbortSignal)=>Promise<T>,parent:AbortSignal,loss?:NativeLossHandler<T>):Promise<T>{return withNativeObservation(DATA_LOCK,work,parent,loss)}
