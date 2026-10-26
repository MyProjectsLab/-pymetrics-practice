import { withNativeObservation } from '../mock/authority'
import type { NativeLossHandler } from '../mock/authority'
import { NativePresenceError, requireObservedNativeVersion } from '../mock/native-presence'
import { openNativeForMock, validateObservedNative } from '../mock/native-presence'
import { arm, verify } from './core'
import type { Event, Setup, State } from './core'
import { report } from './report'
import { openExistingNativeDatabase, readExistingNativeKey } from '../mock/native-presence'

export const DATABASE = 'assessment-practice-keypresses-v1'
export const CHANGE_CHANNEL = `${DATABASE}:changes`
export const KEYPRESSES_DATA_LOCK = 'assessment-practice-keypresses-data-v1'
export async function withKeypressesDataOrder<T>(fn: (signal: AbortSignal) => Promise<T>, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController()
  const abort = () => controller.abort()
  signal?.addEventListener('abort', abort, { once: true })
  const timer = setTimeout(abort, 2000)
  try {
    return await navigator.locks.request(KEYPRESSES_DATA_LOCK, { mode: 'exclusive', signal: controller.signal }, async () => {
      controller.signal.throwIfAborted()
      return Promise.race([fn(controller.signal), new Promise<never>((_, reject) => controller.signal.addEventListener('abort', () => reject(new Error('Keypresses data order expired')), { once: true }))])
    })
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort) }
}
export const STORAGE_VERSION = 'keypresses_storage_v1'
export const JOURNAL_VERSION = 'keypresses_ordered_journal_v1'
export type ReportViewContext = 'live' | 'history'
export interface StoredAttempt {
  readonly sessionId: string
  readonly state: State
  readonly createdAtMs: number
  readonly completedAtMs: number | null
  /** Optional continuation of historical V1 records: timed events followed by report views. */
  readonly journalVersion?: typeof JOURNAL_VERSION
  readonly journal?: readonly Event[]
}
export interface StorageRoot {
  version: typeof STORAGE_VERSION
  installationId: string
  revision: number
  records: Record<string, StoredAttempt>
  tombstones: Record<string, number>
}
export interface Backend {
  read(signal?: AbortSignal): Promise<StorageRoot>
  change<T>(operation: (root: StorageRoot) => T, signal?: AbortSignal): Promise<T>
}

export function freshRoot(): StorageRoot {
  return { version: STORAGE_VERSION, installationId: crypto.randomUUID(), revision: 0,
    records: {}, tombstones: {} }
}

export function orderedJournal(entry: StoredAttempt): readonly Event[] {
  return entry.journal ?? entry.state.events
}

function viewDetail(value: string | null): { context: ReportViewContext; viewId: string } | null {
  try {
    const detail = JSON.parse(value ?? '') as Record<string, unknown>
    if (!detail || typeof detail !== 'object' || Array.isArray(detail) ||
      JSON.stringify(Object.keys(detail).toSorted()) !== JSON.stringify(['context', 'viewId']) ||
      !['live', 'history'].includes(detail.context as string) ||
      typeof detail.viewId !== 'string' || !/^[0-9a-f-]{36}$/i.test(detail.viewId)) return null
    return detail as { context: ReportViewContext; viewId: string }
  } catch { return null }
}

function inspectJournal(entry: StoredAttempt): void {
  if (entry.journal === undefined && entry.journalVersion === undefined) return
  const journal = entry.journal
  if (entry.completedAtMs === null || entry.journalVersion !== JOURNAL_VERSION ||
    !Array.isArray(journal) || journal.length <= entry.state.events.length ||
    JSON.stringify(journal.slice(0, entry.state.events.length)) !== JSON.stringify(entry.state.events))
    throw new Error('Keypresses report-view journal integrity failure')
  const seen = new Set<string>()
  for (let index = entry.state.events.length; index < journal.length; index++) {
    const event = journal[index], detail = viewDetail(event?.detail)
    if (!event || JSON.stringify(Object.keys(event).toSorted()) !==
      JSON.stringify(['detail', 'schemaVersion', 'sequenceNumber', 'sessionId', 'timestampMs', 'type']) ||
      event.schemaVersion !== entry.state.eventVersion || event.sessionId !== entry.sessionId ||
      event.sequenceNumber !== index + 1 || event.type !== 'report_viewed' ||
      !Number.isSafeInteger(event.timestampMs) || event.timestampMs < 0 ||
      !detail || seen.has(detail.viewId)) throw new Error('Keypresses report-view journal integrity failure')
    seen.add(detail.viewId)
  }
}

export function inspectRoot(root: StorageRoot): void {
  if (!root || root.version !== STORAGE_VERSION || typeof root.installationId !== 'string' ||
    !root.installationId || !Number.isSafeInteger(root.revision) || root.revision < 0 ||
    !root.records || typeof root.records !== 'object' || Array.isArray(root.records) ||
    !root.tombstones || typeof root.tombstones !== 'object' || Array.isArray(root.tombstones))
    throw new Error('Unsupported Keypresses storage')
  for (const [id, deletedAtMs] of Object.entries(root.tombstones)) {
    if (!id || !Number.isFinite(deletedAtMs) || root.records[id]) throw new Error('Keypresses deletion integrity failure')
  }
  for (const [id, entry] of Object.entries(root.records)) {
    if (!entry || id !== entry.sessionId || id !== entry.state?.setup?.sessionId ||
      root.tombstones[id] !== undefined || !Number.isFinite(entry.createdAtMs) ||
      (entry.completedAtMs !== null && !Number.isFinite(entry.completedAtMs)) ||
      !verify(entry.state) || (entry.completedAtMs === null ?
        entry.state.phase !== 'waiting' || entry.state.commands.length !== 0 :
        !['completed', 'invalid'].includes(entry.state.phase))) throw new Error('Keypresses record integrity failure')
    inspectJournal(entry)
  }
}

class IndexedBackend implements Backend {
  private db: IDBDatabase
  constructor(db: IDBDatabase) { this.db = db }
  close() { this.db.close() }
  read(signal?: AbortSignal): Promise<StorageRoot> {
    return new Promise((resolve, reject) => {
      signal?.throwIfAborted()
      const transaction = this.db.transaction('installation', 'readonly')
      const request = transaction.objectStore('installation').get('root')
      const abort = () => { try { transaction.abort() } catch { /* settled */ } }
      signal?.addEventListener('abort', abort, { once: true })
      transaction.oncomplete = () => { signal?.removeEventListener('abort', abort); request.result ? resolve(request.result as StorageRoot) : reject(new Error('Missing Keypresses installation')) }
      transaction.onerror = transaction.onabort = () => reject(transaction.error ?? new Error('Keypresses storage read failed'))
    })
  }
  change<T>(operation: (root: StorageRoot) => T, signal?: AbortSignal): Promise<T> {
    return new Promise((resolve, reject) => {
      signal?.throwIfAborted()
      const transaction = this.db.transaction('installation', 'readwrite')
      const objectStore = transaction.objectStore('installation')
      const request = objectStore.get('root')
      let value: T, cause: unknown
      const abort = () => { try { transaction.abort() } catch { /* settled */ } }
      signal?.addEventListener('abort', abort, { once: true })
      request.onsuccess = () => {
        try {
          signal?.throwIfAborted()
          const root = request.result as StorageRoot
          value = operation(root)
          objectStore.put(root, 'root')
        } catch (error) { cause = error; transaction.abort() }
      }
      transaction.oncomplete = () => { signal?.removeEventListener('abort', abort); resolve(value) }
      transaction.onabort = transaction.onerror = () => { signal?.removeEventListener('abort', abort); reject(cause ?? transaction.error ?? new Error('Keypresses write failed')) }
    })
  }
}

function sameState(a: State | undefined, b: State): boolean { return !!a && JSON.stringify(a) === JSON.stringify(b) }
function announceChange(installationId: string, sessionId: string | null) {
  try {
    const channel = new BroadcastChannel(CHANGE_CHANNEL)
    channel.postMessage({ installationId, sessionId })
    channel.close()
  } catch { /* Periodic authority checks remain available. */ }
}

/** Each mutation is one IndexedDB readwrite transaction. Delivery errors may be uncertain. */
export class KeypressesStore {
  readonly backend: Backend
  readonly installationId: string
  constructor(backend: Backend, installationId: string) { this.backend = backend; this.installationId = installationId }
  close() { if (this.backend instanceof IndexedBackend) this.backend.close() }
  private static async openBackend(): Promise<IndexedBackend> {
    if (typeof indexedDB === 'undefined') throw new Error('Local Keypresses storage unavailable')
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DATABASE, 1)
      request.onupgradeneeded = () => request.result.createObjectStore('installation').put(freshRoot(), 'root')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
      request.onblocked = () => reject(new Error('Keypresses storage is busy'))
    })
    return new IndexedBackend(db)
  }
  static async open(): Promise<KeypressesStore> {
    const backend = await this.openBackend()
    try {
      const root = await backend.read()
      inspectRoot(root)
      return new KeypressesStore(backend, root.installationId)
    } catch (error) { backend.close(); throw error }
  }
  /** Retained mock lookup never initializes an absent source database or root. */
  static openForMock(parent?:AbortSignal,allowCreate=true){return openNativeForMock(DATABASE,1,db=>{db.createObjectStore('installation').put(freshRoot(),'root')},signal=>this.openRetained(signal),parent,allowCreate)}
  static async openRetained(signal: AbortSignal): Promise<KeypressesStore> {
    if (typeof indexedDB === 'undefined') throw new Error('Keypresses source unavailable')
    const db = await openExistingNativeDatabase(DATABASE, signal)
    const backend = new IndexedBackend(db)
    try {if(db.version!==1)throw new NativePresenceError('unsupported','Native source database version is unsupported'); const root = await readExistingNativeKey(db, 'installation', 'root', signal) as StorageRoot; signal.throwIfAborted(); requireObservedNativeVersion(root,'version',[STORAGE_VERSION]); validateObservedNative(()=>inspectRoot(root)); return new KeypressesStore(backend, root.installationId) }
    catch (error) { backend.close(); throw error }
  }
  /** Deletion-only recovery when normal open rejects a corrupt retained record. */
  static async openForDeletion(): Promise<{ deleteAll(): Promise<void> }> {
    const backend = await this.openBackend()
    try {
      const root = await backend.read()
      if (!root || typeof root.installationId !== 'string' || !root.installationId)
        throw new Error('Keypresses installation identity unavailable')
      const store = new KeypressesStore(backend, root.installationId)
      return { deleteAll: async () => { try { await store.deleteAll() } finally { backend.close() } } }
    } catch (error) { backend.close(); throw error }
  }
  private checkIdentity(root: StorageRoot) {
    if (!root || root.installationId !== this.installationId) throw new Error('Keypresses installation replaced')
  }
  private check(root: StorageRoot) {
    this.checkIdentity(root)
    inspectRoot(root)
  }
  async read(signal?: AbortSignal): Promise<StorageRoot> {
    const root = await this.backend.read(signal)
    this.check(root)
    return root
  }
  async start(setup: Setup, monotonicMs: number, wallMs: number): Promise<State> {
    const state = arm(setup, monotonicMs)
    if (!Number.isFinite(wallMs)) throw new Error('Invalid wall time')
    await this.backend.change(root => {
      this.check(root)
      if (root.records[setup.sessionId] || root.tombstones[setup.sessionId] !== undefined)
        throw new Error('Keypresses identity already used')
      root.records[setup.sessionId] = { sessionId: setup.sessionId, state, createdAtMs: wallMs, completedAtMs: null }
      root.revision++
    })
    // A delivered callback is not sufficient proof when deletion may have raced it.
    const root = await this.read()
    if (!sameState(root.records[setup.sessionId]?.state, state)) throw new Error('Keypresses start not retained')
    return state
  }
  async saveCompleted(state: State, wallMs: number): Promise<StoredAttempt> {
    if (!verify(state) || !['completed', 'invalid'].includes(state.phase) || !Number.isFinite(wallMs))
      throw new Error('Unreconciled Keypresses completion')
    await this.backend.change(root => {
      this.check(root)
      const prior = root.records[state.setup.sessionId]
      if (!prior || root.tombstones[state.setup.sessionId] !== undefined || prior.completedAtMs !== null ||
        prior.state.commands.length || prior.state.armedAtMs !== state.armedAtMs ||
        JSON.stringify(prior.state.setup) !== JSON.stringify(state.setup)) throw new Error('Keypresses completion authority lost')
      root.records[state.setup.sessionId] = { ...prior, state, completedAtMs: wallMs }
      root.revision++
    })
    const saved = await this.confirmCompleted(state)
    if (!saved) throw new Error('Keypresses completion not confirmed')
    return saved
  }
  async confirmCompleted(state: State): Promise<StoredAttempt | null> {
    const root = await this.read()
    const entry = root.records[state.setup.sessionId]
    return entry && entry.completedAtMs !== null && sameState(entry.state, state) ? entry : null
  }
  /** Appends one idempotent post-completion view to the same ordered record journal. */
  async recordReportView(sessionId: string, context: ReportViewContext, viewId: string, observedWallMs: number): Promise<StoredAttempt> {
    if (!['live', 'history'].includes(context) || !/^[0-9a-f-]{36}$/i.test(viewId) ||
      !Number.isSafeInteger(observedWallMs) || observedWallMs < 0) throw new Error('Invalid Keypresses report view')
    const alreadyRecorded = (entry: StoredAttempt | undefined) =>
      entry && orderedJournal(entry).some(event => event.type === 'report_viewed' && viewDetail(event.detail)?.viewId === viewId)
    try {
      await this.backend.change(root => {
        this.check(root)
        const entry = root.records[sessionId]
        if (!entry || entry.completedAtMs === null || root.tombstones[sessionId] !== undefined)
          throw new Error('Keypresses report authority lost')
        if (alreadyRecorded(entry)) return
        const prior = orderedJournal(entry)
        const event: Event = { schemaVersion: entry.state.eventVersion, sessionId, sequenceNumber: prior.length + 1,
          timestampMs: observedWallMs, type: 'report_viewed', detail: JSON.stringify({ context, viewId }) }
        root.records[sessionId] = { ...entry, journalVersion: JOURNAL_VERSION, journal: [...prior, event] }
        root.revision++
      })
    } catch { /* A lost callback can follow a committed write; the authoritative read decides. */ }
    const root = await this.read()
    const entry = root.records[sessionId]
    if (!alreadyRecorded(entry)) throw new Error('Keypresses report view not confirmed')
    return entry
  }
  async remove(sessionId: string, wallMs: number): Promise<void> {
    return withKeypressesDataOrder(signal => this.removeOrdered(sessionId, wallMs, signal))
  }
  private async removeOrdered(sessionId: string, wallMs: number, signal: AbortSignal): Promise<void> {
    if (!Number.isFinite(wallMs)) throw new Error('Invalid deletion time')
    await this.backend.change(root => {
      this.check(root)
      if (!root.records[sessionId]) throw new Error('Keypresses result missing')
      delete root.records[sessionId]
      root.tombstones[sessionId] = wallMs
      root.revision++
    }, signal)
    const root = await this.read(signal)
    if (root.records[sessionId] || root.tombstones[sessionId] !== wallMs) throw new Error('Keypresses deletion not confirmed')
    announceChange(this.installationId, sessionId)
  }
  async deleteAll(): Promise<KeypressesStore> {
    return withKeypressesDataOrder(signal => this.deleteAllOrdered(signal))
  }
  private async deleteAllOrdered(signal: AbortSignal): Promise<KeypressesStore> {
    const replacement = freshRoot()
    await this.backend.change(root => {
      // Deletion must remain available when a retained record cannot pass integrity checks.
      this.checkIdentity(root)
      Object.assign(root, replacement)
    }, signal)
    const root = await this.backend.read(signal)
    inspectRoot(root)
    if (root.installationId !== replacement.installationId) throw new Error('Keypresses reset not confirmed')
    announceChange(this.installationId, null)
    return new KeypressesStore(this.backend, replacement.installationId)
  }
  async history() {
    const root = await this.read()
    return Object.values(root.records).map(entry => ({ ...entry,
      result: entry.completedAtMs === null ? null : report(entry.state) })).sort((a, b) => b.createdAtMs - a.createdAtMs)
  }
}

/** Mock observation only; ordinary native writers keep their existing order. */
export function withKeypressesMockOrder<T>(work:(signal:AbortSignal)=>Promise<T>,parent:AbortSignal,loss?:NativeLossHandler<T>):Promise<T>{return withNativeObservation(KEYPRESSES_DATA_LOCK,work,parent,loss)}
