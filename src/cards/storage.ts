import { withNativeObservation } from '../mock/authority'
import type { NativeLossHandler } from '../mock/authority'
import { NativePresenceError, requireObservedNativeVersion } from '../mock/native-presence'
import { openNativeForMock, validateObservedNative } from '../mock/native-presence'
import { DECKS, EVENT_VERSION, RULE_VERSION, formForOrdinal, loadCardsForms, reportRun, START_BALANCE } from './core'
import { openExistingNativeDatabase, readExistingNativeKey } from '../mock/native-presence'
import type { CardEvent, Deck, Form, Report, Run } from './core'

const DB_NAME = 'assessment-practice-cards-v11'
const ROOT_VERSION = 'cards-storage/1.1.0'
const DATA_LOCK = 'assessment-practice-cards-data-v11'
const LIVE_LOCK = 'assessment-practice-cards-live-v11'
const CHANNEL = 'assessment-practice-cards-v11-authority'
interface MetadataEvent {
  type: 'report_viewed' | 'history_viewed'; id: string; runId: string; atWallMs: number
  seq: number; revision: number; version: typeof EVENT_VERSION; ruleVersion: typeof RULE_VERSION
  installationId: string; formSha256: string
}
export interface Root {
  version: typeof ROOT_VERSION; installationId: string; revision: number; nextExposureOrdinal: number
  runs: Record<string, Run>; tombstones: Record<string, true>
  requests: Record<string, { kind: string; payload: string; runId: string }>
  activity: Record<string, MetadataEvent[]>
  historyViews?: MetadataEvent[]
}
export type Notice = { type: 'deleted' | 'replaced'; installationId: string; runId?: string }
export interface Backend {
  read(signal?: AbortSignal): Promise<Root>
  change<T>(fn: (root: Root) => T, signal?: AbortSignal): Promise<T>
  close(): void
}
export function newRoot(): Root { return { version: ROOT_VERSION, installationId: crypto.randomUUID(),
  revision: 0, nextExposureOrdinal: 1, runs: {}, tombstones: {}, requests: {}, activity: {}, historyViews: [] } }
function assert(ok: unknown, message: string): asserts ok { if (!ok) throw Error(`Cards storage: ${message}`) }
function validId(value: unknown): value is string { return typeof value === 'string' &&
  /^[a-zA-Z0-9_-]{1,128}$/.test(value) && !['__proto__', 'constructor', 'prototype'].includes(value) }
function checkAbort(signal?: AbortSignal) { assert(!signal?.aborted, 'canceled') }
export async function withCardsDataOrder<T>(fn: () => Promise<T>): Promise<T> {
  assert(typeof navigator !== 'undefined' && 'locks' in navigator, 'exclusive data order unavailable')
  return navigator.locks.request(DATA_LOCK, { mode: 'exclusive' }, fn)
}
export async function acquireCardsOwner(onLost: () => void, signal?: AbortSignal): Promise<() => void> {
  assert(typeof navigator !== 'undefined' && 'locks' in navigator, 'exclusive owner unavailable')
  let acquired!: (value: () => void) => void
  let rejected!: (error: unknown) => void
  const opened = new Promise<() => void>((resolve, reject) => { acquired = resolve; rejected = reject })
  let released = false, granted = false
  void navigator.locks.request(LIVE_LOCK, { mode: 'exclusive', ifAvailable: true }, async lock => {
    if (!lock || signal?.aborted) { rejected(Error('Another Cards tab owns play')); return }
    granted = true
    await new Promise<void>(resolve => {
      const leave = () => { signal?.removeEventListener('abort', leave); resolve() }
      signal?.addEventListener('abort', leave, { once: true })
      acquired(() => { if (!released) { released = true; leave() } })
      if (signal?.aborted || released) leave()
    })
  }).then(() => { if (granted && !released && !signal?.aborted) onLost() }, reason => {
    if (granted && !released && !signal?.aborted) onLost()
    else rejected(reason)
  })
  return opened
}
export function validateRoot(root: Root, forms: ReadonlyMap<string, Form>): void {
  assert(root && root.version === ROOT_VERSION && validId(root.installationId) &&
    Number.isSafeInteger(root.revision) && root.revision >= 0 &&
    Number.isSafeInteger(root.nextExposureOrdinal) && root.nextExposureOrdinal >= 1 &&
    root.runs && typeof root.runs === 'object' && !Array.isArray(root.runs) &&
    root.tombstones && typeof root.tombstones === 'object' && !Array.isArray(root.tombstones) &&
    root.requests && typeof root.requests === 'object' && !Array.isArray(root.requests) &&
    root.activity && typeof root.activity === 'object' && !Array.isArray(root.activity) &&
    (root.historyViews === undefined || Array.isArray(root.historyViews)), 'root shape')
  const ordinals = new Set<number>()
  for (const [id, run] of Object.entries(root.runs)) {
    assert(validId(id) && run.id === id && run.installationId === root.installationId &&
      validId(run.documentId) && !root.tombstones[id] && Number.isSafeInteger(run.ordinal) &&
      Number.isFinite(run.createdAtWallMs) && run.createdAtWallMs >= 0 &&
      run.ordinal > 0 && run.ordinal < root.nextExposureOrdinal && !ordinals.has(run.ordinal) &&
      Number.isSafeInteger(run.epoch) && run.epoch > 0 && Number.isSafeInteger(run.revision) &&
      run.revision > 0 && run.revision <= root.revision, 'run identity')
    ordinals.add(run.ordinal)
    const form = formForOrdinal(forms, run.ordinal)
    assert(run.formId === form.id && run.formSha256 === form.formSha256, 'assigned form')
    reportRun(run, form)
    const activity = root.activity[id] ?? []
    assert(Array.isArray(activity), 'activity shape')
    const seen = new Set<string>()
    let priorActivityRevision = 0
    for (const [index, item] of activity.entries()) {
      assert(item && validId(item.id) && !seen.has(item.id) && item.runId === id &&
        (item.type === 'report_viewed' || item.type === 'history_viewed') &&
        Number.isFinite(item.atWallMs) && item.atWallMs >= 0 && item.seq === index + 1 &&
        Number.isSafeInteger(item.revision) && item.revision > priorActivityRevision && item.revision <= root.revision &&
        item.version === EVENT_VERSION && item.ruleVersion === RULE_VERSION &&
        item.installationId === root.installationId && item.formSha256 === run.formSha256, 'activity')
      priorActivityRevision = item.revision
      seen.add(item.id)
    }
  }
  for (const [id, tombstone] of Object.entries(root.tombstones))
    assert(validId(id) && tombstone === true && !root.runs[id], 'tombstone')
  for (const [id, request] of Object.entries(root.requests)) {
    assert(validId(id) && request && typeof request.kind === 'string' && typeof request.payload === 'string' &&
      validId(request.runId) && !!root.runs[request.runId] && !root.tombstones[request.runId], 'request')
  }
  assert(Object.keys(root.activity).every(id => !!root.runs[id]), 'activity target')
  const historyIds = new Set<string>()
  for (const [index, item] of (root.historyViews ?? []).entries()) {
    assert(item && validId(item.id) && !historyIds.has(item.id) &&
      Number.isFinite(item.atWallMs) && item.atWallMs >= 0 && item.type === 'history_viewed' &&
      item.runId === 'installation' && item.formSha256 === 'installation' &&
      item.seq === index + 1 && Number.isSafeInteger(item.revision) &&
      item.revision > 0 && item.revision <= root.revision && item.version === EVENT_VERSION &&
      item.ruleVersion === RULE_VERSION && item.installationId === root.installationId, 'history activity')
    historyIds.add(item.id)
  }
}
class IndexedBackend implements Backend {
  private database: IDBDatabase
  constructor(database: IDBDatabase) { this.database = database }
  close() { this.database.close() }
  private transaction<T>(mode: IDBTransactionMode, fn: (root: Root) => T, signal?: AbortSignal): Promise<T> {
    checkAbort(signal)
    return new Promise((resolve, reject) => {
      const transaction = this.database.transaction('installation', mode)
      let value: T, settled = false
      const fail = (error: unknown) => { if (!settled) { settled = true; reject(error) } }
      const abort = () => { try { transaction.abort() } catch { /* already settled */ } }
      signal?.addEventListener('abort', abort, { once: true })
      const get = transaction.objectStore('installation').get('root')
      get.onsuccess = () => {
        try { assert(get.result, 'root unavailable'); value = fn(get.result as Root)
          if (mode === 'readwrite') transaction.objectStore('installation').put(get.result, 'root')
        } catch (error) { fail(error); abort() }
      }
      get.onerror = () => fail(get.error ?? Error('Cards read failed'))
      transaction.oncomplete = () => { signal?.removeEventListener('abort', abort)
        if (!settled) { settled = true; resolve(structuredClone(value)) } }
      transaction.onerror = () => fail(transaction.error ?? Error('Cards transaction failed'))
      transaction.onabort = () => fail(transaction.error ?? Error('Cards transaction aborted'))
    })
  }
  read(signal?: AbortSignal) { return this.transaction('readonly', root => root, signal) }
  change<T>(fn: (root: Root) => T, signal?: AbortSignal) { return this.transaction('readwrite', fn, signal) }
}
async function openBackend(): Promise<Backend> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore('installation')
    request.onerror = () => reject(request.error ?? Error('Cards database unavailable'))
    request.onsuccess = async () => {
      const database = request.result
      try {
        const transaction = database.transaction('installation', 'readwrite')
        const store = transaction.objectStore('installation')
        const get = store.get('root')
        get.onsuccess = () => { if (!get.result) store.put(newRoot(), 'root') }
        transaction.oncomplete = () => resolve(new IndexedBackend(database))
        transaction.onerror = () => { database.close(); reject(transaction.error ?? Error('Cards initialization failed')) }
      } catch (error) { database.close(); reject(error) }
    }
  })
}
export class CardsStore {
  private channel: BroadcastChannel | null = null
  private listeners = new Set<(notice: Notice) => void>()
  readonly installationId: string
  readonly backend: Backend
  private forms: ReadonlyMap<string, Form>
  private constructor(backend: Backend, root: Root, forms: ReadonlyMap<string, Form>) {
    this.backend = backend; this.installationId = root.installationId; this.forms = forms
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(CHANNEL)
      this.channel.onmessage = event => { const notice = event.data as Notice
        if (notice?.installationId === this.installationId) this.listeners.forEach(listener => listener(notice)) }
    }
  }
  static async open(backend?: Backend) {
    const forms = await loadCardsForms()
    const selected = backend ?? await openBackend()
    const root = await selected.read(); validateRoot(root, forms)
    return new CardsStore(selected, root, forms)
  }
  /** Mock retained lookup has no absent/falsey-root initializer. */
  static openForMock(parent?:AbortSignal,allowCreate=true){return openNativeForMock(DB_NAME,1,db=>{db.createObjectStore('installation').put(newRoot(),'root')},signal=>this.openRetained(signal),parent,allowCreate)}
  static async openRetained(signal: AbortSignal) {
    const database = await openExistingNativeDatabase(DB_NAME, signal)
    const backend = new IndexedBackend(database)
    try {if(database.version!==1)throw new NativePresenceError('unsupported','Native source database version is unsupported');
      const raw = await readExistingNativeKey(database, 'installation', 'root', signal)
      const forms = await loadCardsForms()
      signal.throwIfAborted()
      requireObservedNativeVersion(raw,'version',[ROOT_VERSION]); validateObservedNative(()=>validateRoot(raw as Root, forms))
      return new CardsStore(backend, raw as Root, forms)
    } catch (error) { backend.close(); throw error }
  }
  close() { this.channel?.close(); this.listeners.clear(); this.backend.close() }
  subscribe(listener: (notice: Notice) => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  private notice(value: Notice) { this.channel?.postMessage(value) }
  async read(signal?: AbortSignal) {
    const root = await this.backend.read(signal); validateRoot(root, this.forms)
    assert(root.installationId === this.installationId, 'installation replaced')
    return root
  }
  private async write<T>(fn: (root: Root) => T, signal?: AbortSignal): Promise<T> {
    const result = await this.backend.change(root => {
      validateRoot(root, this.forms)
      assert(root.installationId === this.installationId, 'installation replaced')
      const value = fn(root)
      validateRoot(root, this.forms)
      return value
    }, signal)
    return result
  }
  private request<T>(root: Root, kind: string, id: string, payload: unknown, runId: string, fn: () => T): T {
    assert(validId(id), 'request identity')
    const serialized = JSON.stringify(payload)
    const prior = root.requests[id]
    if (prior) {
      assert(prior.kind === kind && prior.payload === serialized && prior.runId === runId &&
        !!root.runs[runId], 'request conflict or deletion')
      return root.runs[runId] as T
    }
    const value = fn()
    root.requests[id] = { kind, payload: serialized, runId }
    return value
  }
  async start(request: { id: string; runId: string; documentId: string; wallMs: number }, signal?: AbortSignal) {
    checkAbort(signal)
    return this.write(root => this.request(root, 'start', request.id, request, request.runId, () => {
      assert(validId(request.runId) && validId(request.documentId) &&
        Number.isFinite(request.wallMs) && request.wallMs >= 0 && !root.runs[request.runId] &&
        !root.tombstones[request.runId], 'start request')
      const ordinal = root.nextExposureOrdinal++
      const form = formForOrdinal(this.forms, ordinal)
      const run: Run = { id: request.runId, documentId: request.documentId,
        installationId: root.installationId, ordinal, createdAtWallMs: request.wallMs,
        formId: form.id, formSha256: form.formSha256,
        epoch: 1, revision: ++root.revision, status: 'active', requests: {},
        events: [{ type: 'run_started', seq: 1, revision: root.revision, version: EVENT_VERSION,
          ruleVersion: RULE_VERSION, installationId: root.installationId, runId: request.runId,
          formSha256: form.formSha256, formId: form.id, balance: START_BALANCE }] }
      root.runs[run.id] = run
      return run
    }), signal)
  }
  private guarded(root: Root, runId: string, documentId: string, epoch: number, revision: number) {
    const run = root.runs[runId]
    assert(run && run.status === 'active' && run.documentId === documentId &&
      run.epoch === epoch && run.revision === revision && !root.tombstones[runId], 'play authority changed')
    return run
  }
  private append(run: Run, root: Root, event: Omit<CardEvent, 'seq'>) {
    run.revision = ++root.revision
    run.events.push({ ...event, seq: run.events.length + 1, revision: run.revision,
      version: EVENT_VERSION, ruleVersion: RULE_VERSION, installationId: run.installationId,
      runId: run.id, formSha256: run.formSha256 } as CardEvent)
    return run
  }
  async ready(input: { id: string; runId: string; documentId: string; epoch: number; revision: number; turn: number; atMs: number }, signal?: AbortSignal) {
    return this.write(root => this.request(root, 'ready', input.id, input, input.runId, () => {
      const run = this.guarded(root, input.runId, input.documentId, input.epoch, input.revision)
      assert(Number.isFinite(input.atMs), 'readiness time')
      return this.append(run, root, { type: 'draw_ready', turn: input.turn, atMs: input.atMs } as CardEvent)
    }), signal)
  }
  async choice(input: { id: string; runId: string; documentId: string; epoch: number; revision: number; turn: number;
    deck: Deck; deckDraw: number; source: string; atMs: number }, signal?: AbortSignal) {
    return this.write(root => this.request(root, 'choice', input.id, input, input.runId, () => {
      const run = this.guarded(root, input.runId, input.documentId, input.epoch, input.revision)
      const form = this.forms.get(run.formId)!
      const report = reportRun(run, form)
      assert(DECKS.includes(input.deck) && input.turn === report.committedDrawCount + 1 &&
        Number.isFinite(input.atMs), 'choice')
      const deckDraw = report.byDeck[input.deck].count + 1
      assert(input.deckDraw === deckDraw, 'deck-local index')
      const readiness = run.events.at(-1)
      assert(readiness?.type === 'draw_ready', 'choice without readiness')
      const value = form.decks[input.deck][deckDraw - 1]
      return this.append(run, root, { type: 'choice_committed', turn: input.turn, deck: input.deck,
        deckDraw, value, priorBalance: report.endingBalance, balance: report.endingBalance + value,
        commandId: input.id, source: input.source, atMs: input.atMs,
        latencyMs: input.atMs - readiness.atMs } as CardEvent)
    }), signal)
  }
  async feedback(input: { id: string; runId: string; documentId: string; epoch: number; revision: number;
    turn: number; commandId: string; atMs: number }, signal?: AbortSignal) {
    return this.write(root => this.request(root, 'feedback', input.id, input, input.runId, () => {
      const run = this.guarded(root, input.runId, input.documentId, input.epoch, input.revision)
      return this.append(run, root, { type: 'feedback_shown', turn: input.turn,
        commandId: input.commandId, atMs: input.atMs } as CardEvent)
    }), signal)
  }
  async complete(input: { id: string; runId: string; documentId: string; epoch: number; revision: number }, signal?: AbortSignal) {
    return this.write(root => this.request(root, 'complete', input.id, input, input.runId, () => {
      const run = this.guarded(root, input.runId, input.documentId, input.epoch, input.revision)
      const form = this.forms.get(run.formId)!
      const report = reportRun(run, form)
      assert(report.committedDrawCount === 80 && report.feedbackSeenCount === 80, 'incomplete terminal')
      run.status = 'complete'
      this.append(run, root, { type: 'run_completed', balance: report.endingBalance } as CardEvent)
      const final: Report = { ...report, status: 'complete_valid' }
      run.snapshot = { events: structuredClone(run.events), report: final, revision: run.revision }
      return run
    }), signal)
  }
  async closeRun(input: { id: string; runId: string; documentId: string; epoch: number;
    type: 'run_interrupted' | 'run_exited' | 'run_invalid'; reason: string }, signal?: AbortSignal) {
    return this.write(root => this.request(root, input.type, input.id, input, input.runId, () => {
      const run = root.runs[input.runId]
      assert(run && run.status === 'active' && run.documentId === input.documentId && run.epoch === input.epoch,
        'closure authority changed')
      run.status = input.type.slice(4) as Run['status']
      this.append(run, root, { type: 'lifecycle_changed', reason: input.reason,
        atMs: performance.now() } as CardEvent)
      return this.append(run, root, { type: input.type, reason: input.reason } as CardEvent)
    }), signal)
  }
  async revokeOwner(input: { id: string; runId: string; documentId: string; epoch: number; reason: string }) {
    return this.write(root => this.request(root, 'revoke_owner', input.id, input, input.runId, () => {
      const run = root.runs[input.runId]
      assert(run && run.status === 'active' && run.documentId === input.documentId &&
        run.epoch === input.epoch, 'owner revocation authority changed')
      run.epoch++; run.status = 'invalid'
      this.append(run, root, { type: 'lifecycle_changed', reason: input.reason,
        atMs: performance.now() } as CardEvent)
      return this.append(run, root, { type: 'run_invalid', reason: input.reason } as CardEvent)
    }))
  }
  async list() { return Object.values((await this.read()).runs).toSorted((a, b) => b.ordinal - a.ordinal)
    .map(run => ({ run, report: reportRun(run, this.forms.get(run.formId)!) })) }
  async view(runId: string, id: string, type: 'report_viewed' | 'history_viewed') {
    await this.write(root => {
      assert(validId(id) && !!root.runs[runId], 'view target')
      const list = root.activity[runId] ?? []
      if (!list.some(item => item.id === id)) { const run = root.runs[runId]
        list.push({ type, id, runId, atWallMs: Date.now(), seq: list.length + 1,
          revision: ++root.revision, version: EVENT_VERSION, ruleVersion: RULE_VERSION,
          installationId: root.installationId, formSha256: run.formSha256 })
        root.activity[runId] = list }
    })
  }
  async viewHistory(id: string) {
    await this.write(root => {
      assert(validId(id), 'history view identity')
      root.historyViews ??= []
      if (!root.historyViews.some(item => item.id === id)) {
        root.historyViews.push({ type: 'history_viewed', id, runId: 'installation',
          atWallMs: Date.now(), seq: root.historyViews.length + 1, revision: ++root.revision,
          version: EVENT_VERSION, ruleVersion: RULE_VERSION, installationId: root.installationId,
          formSha256: 'installation' })
      }
    })
  }
  async delete(runId: string) {
    await withCardsDataOrder(async () => this.write(root => {
      assert(!!root.runs[runId], 'delete target')
      delete root.runs[runId]; delete root.activity[runId]
      Object.keys(root.requests).forEach(id => { if (root.requests[id].runId === runId) delete root.requests[id] })
      root.tombstones[runId] = true; root.revision++
    }))
    this.notice({ type: 'deleted', installationId: this.installationId, runId })
  }
  async deleteAll() {
    await withCardsDataOrder(async () => this.backend.change(root => {
      validateRoot(root, this.forms); assert(root.installationId === this.installationId, 'installation replaced')
      Object.assign(root, newRoot())
    }))
    this.notice({ type: 'replaced', installationId: this.installationId })
  }
  async inspect(runId: string, signal?: AbortSignal) {
    const root = await this.read(signal)
    const run = root.runs[runId]
    assert(run, 'run deleted')
    return { root, run, report: reportRun(run, this.forms.get(run.formId)!) }
  }
}
export const CARDS_EVENT_VERSION = EVENT_VERSION

/** Mock observation only; ordinary native writers keep their existing order. */
export function withCardsMockOrder<T>(work:(signal:AbortSignal)=>Promise<T>,parent:AbortSignal,loss?:NativeLossHandler<T>):Promise<T>{return withNativeObservation(DATA_LOCK,work,parent,loss)}
