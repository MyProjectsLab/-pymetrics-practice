import { NativePresenceError, requireObservedNativeVersion } from '../mock/native-presence'
import { openNativeForMock, validateObservedNative } from '../mock/native-presence'
import { ArrowsAuthority, ArrowsIntegrityError, authorityEqual, createArrowsAuthorityState } from './authority'
import type { ArrowsAuthorityState, ArrowsAuthorityHandle } from './authority'
import { ARROWS_ACTIVITY_VERSION, ARROWS_STORAGE_VERSION } from './contracts'
import type { Form, FormId } from './versions'
import { canonicalState, isV11 } from './versions'
import { armHeadless } from './v11/engine'
import type { Form as V11Form } from './v11/contracts'
import { FORM_IDS as V11_FORM_IDS } from './v11/manifests'
import { verifyHeadless } from './versions'
import type { InputProfile, State } from './versions'
import { loadArrowsForms } from './versions'
import { openExistingNativeDatabase, readExistingNativeKey } from '../mock/native-presence'
import { reconcileHeadless } from './versions'
import type { HeadlessReview } from './versions'
import { orderArrowsDeletion, orderArrowsSnapshot } from './presentation-order'

export const ARROWS_DATABASE = 'assessment-practice-arrows-v1'
const ARROWS_DELETION_CHANNEL = 'assessment-practice-arrows-v1-deletion'
const FORM_IDS: readonly FormId[] = ['AR1', 'AR2', 'AR3', 'AR4', 'AR5', 'AR6']

export interface ArmedAttempt {
  readonly requestId: string
  readonly sessionId: string
  readonly clockDomainId: string
  readonly profile: InputProfile
  readonly ordinal: number
  readonly createdAtWallMs: number
  readonly state: State
  readonly snapshot?: PersistedSnapshot
}
export interface PersistedSnapshot {
  readonly revision: number
  readonly kind: 'checkpoint' | 'terminal'
  readonly closedTrials: number
  readonly state: State
  readonly review: HeadlessReview
}
export interface ArrowsRoot {
  version: typeof ARROWS_STORAGE_VERSION | 'arrows_storage_v2'
  installationId: string
  revision: number
  scoredStartCount: number
  scoredStartCountV11?: number
  attempts: Record<string, ArmedAttempt>
  tombstones: Record<string, number | { readonly version: 'arrows_spec_v1_1'; readonly ordinal: number; readonly requestId: string; readonly deletedAtWallMs: number }>
  /** Optional for roots written before local report-view recording existed. */
  activity?: Record<string, ArrowsActivityJournal>
}
export type ArrowsReportSurface = 'live' | 'history'
export interface ArrowsReportViewEvent {
  readonly version: typeof ARROWS_ACTIVITY_VERSION
  readonly type: 'report_viewed'
  readonly sequenceNumber: number
  readonly installationId: string
  readonly sessionId: string
  readonly viewId: string
  readonly sourceSurface: ArrowsReportSurface
  readonly observedWallMs: number
}
export interface ArrowsActivityJournal {
  readonly version: typeof ARROWS_ACTIVITY_VERSION
  readonly installationId: string
  readonly sessionId: string
  readonly resultRevision: number
  readonly events: readonly ArrowsReportViewEvent[]
}
export type ArrowsDeletionNotice =
  | { readonly type: 'attempt_deleted'; readonly installationId: string; readonly sessionId: string }
  | { readonly type: 'installation_replaced'; readonly installationId: string;
      readonly replacementInstallationId: string }
export interface ArrowsBackend {
  read(signal?: AbortSignal): Promise<ArrowsRoot>
  change<T>(operation: (root: ArrowsRoot) => T, signal?: AbortSignal): Promise<T>
}
export interface StartRequest {
  readonly requestId: string
  readonly sessionId: string
  readonly clockDomainId: string
  readonly profile: InputProfile
  readonly atMs: number
  readonly wallMs: number
}

export function freshArrowsRoot(): ArrowsRoot {
  return { version: 'arrows_storage_v2', installationId: crypto.randomUUID(),
    revision: 0, scoredStartCount: 0, scoredStartCountV11: 0, attempts: {}, tombstones: {}, activity: {} }
}
function assert(condition: unknown, reason: string): asserts condition {
  if (!condition) throw Error(`Arrows storage: ${reason}`)
}
/** A stored arm or installation that no longer belongs to this attempt cannot
 * be rescued by an older successful read or write delivery. */

function exact(a: unknown, b: unknown) { return JSON.stringify(a) === JSON.stringify(b) }
function freezeDeep<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freezeDeep)
    Object.freeze(value)
  }
  return value
}
function nonempty(value: unknown) { return typeof value === 'string' && value.trim().length > 0 }
function plainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}
function safeId(value: unknown) { return typeof value === 'string' &&
  /^[A-Za-z0-9_-]{1,128}$/.test(value) && value !== 'prototype' &&
  !Object.hasOwn(Object.prototype, value) }
function nonnegativeInteger(value: unknown) { return Number.isSafeInteger(value) && (value as number) >= 0 }
function aborted(signal?: AbortSignal) {
  if (signal?.aborted) throw Error('Arrows start canceled')
}
function withAbort<T>(pending: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return pending
  if (signal.aborted) {
    // The caller may have constructed work just before noticing cancellation.
    // Observe its eventual rejection even though its result is no longer usable.
    void pending.catch(() => {})
    return Promise.reject(Error('Arrows start canceled'))
  }
  return new Promise((resolve, reject) => {
    const cancel = () => reject(Error('Arrows start canceled'))
    signal.addEventListener('abort', cancel, { once: true })
    pending.then(value => { signal.removeEventListener('abort', cancel); resolve(value) },
      error => { signal.removeEventListener('abort', cancel); reject(error) })
  })
}

/** Rejects unsupported/corrupt roots without modifying their retained bytes. */
function inspectWithForms(root: ArrowsRoot, forms: ReadonlyMap<FormId, Form>): void {
  assert(plainRecord(root) &&
    (root.version === ARROWS_STORAGE_VERSION && root.scoredStartCountV11 === undefined || root.version === 'arrows_storage_v2' && nonnegativeInteger(root.scoredStartCountV11)) && nonempty(root.installationId) &&
    nonnegativeInteger(root.revision) && nonnegativeInteger(root.scoredStartCount) &&
    root.revision >= root.scoredStartCount + (root.scoredStartCountV11 ?? 0) &&
    plainRecord(root.attempts) && plainRecord(root.tombstones) &&
    (root.activity === undefined || plainRecord(root.activity)), 'unsupported root')
  const seenRequests = new Set<string>()
  const seenOrdinals = new Set<string>()
  const v11Ordinals = new Set<number>()
  for (const [sessionId, deletedAt] of Object.entries(root.tombstones)) {
    assert(safeId(sessionId) && !root.attempts[sessionId], 'invalid tombstone')
    if (typeof deletedAt === 'number') assert(Number.isFinite(deletedAt) && deletedAt >= 0, 'invalid V1 tombstone')
    else {
      assert(root.version === 'arrows_storage_v2' && plainRecord(deletedAt) && Object.keys(deletedAt).sort().join('|') === 'deletedAtWallMs|ordinal|requestId|version' && deletedAt.version === 'arrows_spec_v1_1' && nonnegativeInteger(deletedAt.ordinal) && deletedAt.ordinal > 0 && deletedAt.ordinal <= root.scoredStartCountV11! && !v11Ordinals.has(deletedAt.ordinal) && safeId(deletedAt.requestId) && !seenRequests.has(deletedAt.requestId) && Number.isFinite(deletedAt.deletedAtWallMs) && deletedAt.deletedAtWallMs >= 0, 'invalid V1.1 tombstone')
      v11Ordinals.add(deletedAt.ordinal); seenRequests.add(deletedAt.requestId)
    }
  }
  for (const [sessionId, attempt] of Object.entries(root.attempts)) {
    const v11 = attempt?.state?.specificationVersion === 'arrows_spec_v1_1'
    const ids = v11 ? V11_FORM_IDS : FORM_IDS
    const count = v11 ? root.scoredStartCountV11 ?? 0 : root.scoredStartCount
    const ordinalKey = `${v11 ? 'v11' : 'v1'}:${attempt?.ordinal}`
    assert(!v11 || root.version === 'arrows_storage_v2', 'V1.1 requires V2')
    assert(attempt && attempt.sessionId === sessionId && safeId(sessionId) &&
      safeId(attempt.requestId) && safeId(attempt.clockDomainId) &&
      !seenRequests.has(attempt.requestId) &&
      nonnegativeInteger(attempt.ordinal) && attempt.ordinal > 0 &&
      attempt.ordinal <= count && !seenOrdinals.has(ordinalKey) && (!v11 || !v11Ordinals.has(attempt.ordinal)) &&
      Number.isFinite(attempt.createdAtWallMs) && attempt.createdAtWallMs >= 0 &&
      root.tombstones[sessionId] === undefined &&
      attempt.state?.identity?.installationId === root.installationId &&
      attempt.state.identity.sessionId === sessionId &&
      attempt.state.identity.clockDomainId === attempt.clockDomainId &&
      exact(attempt.state.profile, attempt.profile) &&
      attempt.state.form?.id === ids[(attempt.ordinal - 1) % 6], 'invalid arm identity')
    seenRequests.add(attempt.requestId)
    seenOrdinals.add(ordinalKey)
    if (v11) v11Ordinals.add(attempt.ordinal)
    const form = forms.get(attempt.state.form.id)
    assert(form && exact(form, attempt.state.form) &&
      verifyHeadless(canonicalState(attempt.state, form)) &&
      attempt.state.phase === 'armed' && attempt.state.commands.length === 0 &&
      attempt.state.events.length === 3 &&
      attempt.state.eventVersion === (v11 ? 'arrows_event_v1_1' : 'arrows_event_v1') &&
      attempt.state.form.id === ids[(attempt.ordinal - 1) % 6], 'unreconciled arm')
    if (attempt.snapshot !== undefined) {
      const snapshot = attempt.snapshot
      const saved = snapshot.state
      assert(nonnegativeInteger(snapshot.revision) && snapshot.revision > 0 &&
        snapshot.revision <= root.revision &&
        (snapshot.kind === 'checkpoint' && saved.phase === 'break' ||
          snapshot.kind === 'terminal' && (saved.phase === 'invalid' || saved.phase === 'completed')) &&
        exact(saved.identity, attempt.state.identity) && exact(saved.profile, attempt.profile) &&
        exact(saved.form, form) && verifyHeadless(canonicalState(saved, form)) &&
        exact(saved.commands.slice(0, attempt.state.commands.length), attempt.state.commands) &&
        exact(saved.events.slice(0, attempt.state.events.length), attempt.state.events) &&
        snapshot.closedTrials === saved.events.filter(event => event.type === 'trial_closed').length &&
        exact(snapshot.review, reconcileHeadless(canonicalState(saved, form))), 'unreconciled snapshot')
    }
  }
  for (const [sessionId, journal] of Object.entries(root.activity ?? {})) {
    const attempt = root.attempts[sessionId]
    assert(safeId(sessionId) && plainRecord(journal) &&
      journal.version === ARROWS_ACTIVITY_VERSION &&
      journal.installationId === root.installationId && journal.sessionId === sessionId &&
      attempt?.snapshot !== undefined &&
      journal.resultRevision === attempt.snapshot.revision &&
      Array.isArray(journal.events) && journal.events.length > 0, 'invalid activity journal')
    const views = new Set<string>()
    for (let index = 0; index < journal.events.length; index++) {
      const event = journal.events[index]
      assert(plainRecord(event), 'invalid activity event')
      const view = event as unknown as ArrowsReportViewEvent
      assert(view.version === ARROWS_ACTIVITY_VERSION &&
        view.type === 'report_viewed' && view.sequenceNumber === index + 1 &&
        view.installationId === root.installationId && view.sessionId === sessionId &&
        safeId(view.viewId) && !views.has(view.viewId) &&
        (view.sourceSurface === 'live' || view.sourceSurface === 'history') &&
        Number.isFinite(view.observedWallMs) && view.observedWallMs >= 0,
      'invalid activity event')
      views.add(view.viewId)
    }
  }
  // Every committed arm remains represented by exactly one live attempt or
  // one deletion tombstone until Delete all creates a new installation.
  // Without this check a missing record can silently reuse a form position.
  assert(root.scoredStartCount === Object.values(root.attempts).filter(a => !isV11(a.state)).length + Object.values(root.tombstones).filter(t => typeof t === 'number').length && (root.scoredStartCountV11 ?? 0) === v11Ordinals.size,
    'arm counter and retained history disagree')
}
export async function inspectArrowsRoot(root: ArrowsRoot): Promise<void> {
  inspectWithForms(root, await loadArrowsForms())
}

class IndexedArrowsBackend implements ArrowsBackend {
  private readonly db: IDBDatabase
  constructor(db: IDBDatabase) { this.db = db }
  close() { this.db.close() }
  /** One contained native lifecycle for both modes. Cancellation may happen
   * synchronously while operation(preimage) notifies authority subscribers. */
  private transaction<T>(mode: IDBTransactionMode, operation: (root: ArrowsRoot) => T, signal?: AbortSignal): Promise<T> {
    aborted(signal)
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('installation', mode)
      const store = tx.objectStore('installation'), request = store.get('root')
      let phase: 'active' | 'abort_requested' | 'settled' | 'committed' = 'active'
      let value!: T, delivered = false, cause: unknown
      const settle = (committed: boolean, error?: unknown) => {
        if (phase === 'settled' || phase === 'committed') return
        phase = committed ? 'committed' : 'settled'
        signal?.removeEventListener('abort', cancel)
        if (committed && delivered) resolve(value)
        else reject(cause ?? error ?? Error('Arrows transaction failed'))
      }
      const requestAbort = (error: unknown) => {
        cause ??= error
        if (phase !== 'active') return
        phase = 'abort_requested'
        // A transaction may have finished before its completion callback is
        // delivered. Abort mechanics never replace the initiating failure or
        // escape into another execution owner's global-error listener.
        try { tx.abort() } catch { /* Already aborted/committed natively. */ }
      }
      const cancel = () => requestAbort(signal?.reason ?? Error('Arrows transaction canceled'))
      request.onsuccess = () => {
        if (phase !== 'active') return
        try {
          aborted(signal)
          if (!request.result) throw Error('Missing Arrows installation')
          value = operation(request.result as ArrowsRoot)
          aborted(signal)
          if (phase !== 'active') throw cause ?? Error('Arrows transaction canceled')
          if (mode === 'readwrite') store.put(request.result, 'root')
          delivered = true
        } catch (error) { requestAbort(error) }
      }
      request.onerror = () => {
        try { requestAbort(request.error ?? Error('Arrows request failed')) }
        catch (error) { requestAbort(error) }
      }
      tx.oncomplete = () => { try { settle(true) } catch (error) { settle(false, error) } }
      tx.onerror = tx.onabort = () => { try { settle(false, tx.error ?? Error('Arrows transaction failed')) } catch (error) { settle(false, error) } }
      signal?.addEventListener('abort', cancel, { once: true })
      if (signal?.aborted) cancel()
    })
  }
  read(signal?: AbortSignal): Promise<ArrowsRoot> {
    // Store observation sits below its public cancellation boundary. Preserve
    // an already completed readonly root even when its delivery is delayed.
    return this.transaction('readonly', root => root, signal)
  }
  change<T>(operation: (root: ArrowsRoot) => T, signal?: AbortSignal): Promise<T> {
    return withAbort(this.transaction('readwrite', operation, signal), signal)
  }

}

/** Durable arm and verified between-block/terminal snapshots. */
// Connections in one realm share durable target authority, but each Store
// retains its own operation identity. Independent tabs acquire facts locally.
const nativeAuthorityStates = new Map<string, ArrowsAuthorityState>()
const backendAuthorityStates = new WeakMap<ArrowsBackend, Map<string, ArrowsAuthorityState>>()
function authorityState(backend: ArrowsBackend, installationId: string): ArrowsAuthorityState {
  let installations = backend instanceof IndexedArrowsBackend ? nativeAuthorityStates : backendAuthorityStates.get(backend)
  if (!installations) { installations = new Map(); backendAuthorityStates.set(backend, installations) }
  let state = installations.get(installationId)
  if (!state) { state = createArrowsAuthorityState(); installations.set(installationId, state) }
  return state
}

export class ArrowsStore {
  close() { this.deletionChannel?.close(); this.deletionChannel = null; if (this.backend instanceof IndexedArrowsBackend) this.backend.close() }
  readonly backend: ArrowsBackend
  readonly installationId: string
  readonly authority: ArrowsAuthority
  private readonly deletionOnly: boolean
  private readonly deletionListeners = new Set<(notice: ArrowsDeletionNotice) => void>()
  private deletionChannel: BroadcastChannel | null = null
  private readonly noticeSender = crypto.randomUUID()
  constructor(backend: ArrowsBackend, installationId: string, deletionOnly = false) {
    this.backend = backend
    this.installationId = installationId
    this.authority = new ArrowsAuthority(installationId, authorityState(backend, installationId))
    this.deletionOnly = deletionOnly
  }
  /** Notifications improve promptness only. Subscribers must reread storage
   * before treating a report as saved or displayable. */
  subscribeDeletion(listener: (notice: ArrowsDeletionNotice) => void): () => void {
    this.deletionListeners.add(listener)
    if (!this.deletionChannel && typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.deletionChannel = new BroadcastChannel(ARROWS_DELETION_CHANNEL)
        this.deletionChannel.onmessage = event => {
          const data = event.data as { sender?: unknown; notice?: unknown } | null
          if (!data || data.sender === this.noticeSender) return
          const notice = data.notice
          if (!plainRecord(notice) || notice.installationId !== this.installationId ||
            (notice.type !== 'attempt_deleted' || !safeId(notice.sessionId)) &&
            (notice.type !== 'installation_replaced' || !nonempty(notice.replacementInstallationId))) return
          for (const subscribed of this.deletionListeners) {
            try { subscribed(notice as ArrowsDeletionNotice) }
            catch { /* Observers cannot change storage authority. */ }
          }
        }
      } catch { /* Authoritative rereads remain required without notifications. */ }
    }
    return () => {
      this.deletionListeners.delete(listener)
      if (this.deletionListeners.size === 0) {
        this.deletionChannel?.close()
        this.deletionChannel = null
      }
    }
  }
  private notifyDeletion(notice: ArrowsDeletionNotice) {
    for (const listener of this.deletionListeners) {
      try { listener(notice) } catch { /* Observers cannot reverse retirement. */ }
    }
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const channel = new BroadcastChannel(ARROWS_DELETION_CHANNEL)
        channel.postMessage({ sender: this.noticeSender, notice })
        channel.close()
      } catch { /* Notification failure cannot reverse a committed deletion. */ }
    }
  }
  private static async openBackend(): Promise<IndexedArrowsBackend> {
    assert(typeof indexedDB !== 'undefined', 'local storage unavailable')
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(ARROWS_DATABASE, 1)
      request.onupgradeneeded = event => {
        if (event.oldVersion !== 0) { request.transaction?.abort(); return }
        request.result.createObjectStore('installation').put(freshArrowsRoot(), 'root')
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? Error('Arrows database unavailable'))
      request.onblocked = () => reject(Error('Arrows database blocked'))
    })
    return new IndexedArrowsBackend(db)
  }
  static async open(): Promise<ArrowsStore> {
    const backend = await ArrowsStore.openBackend()
    try {
      const root = await backend.read()
      await inspectArrowsRoot(root)
      const store = new ArrowsStore(backend, root.installationId)
      store.authority.observe(root, store.authority.provenance('open'))
      return store
    } catch (error) { backend.close(); throw error }
  }
  static openForMock(parent?:AbortSignal,allowCreate=true){return openNativeForMock(ARROWS_DATABASE,1,db=>{db.createObjectStore('installation').put(freshArrowsRoot(),'root')},signal=>this.openRetained(signal),parent,allowCreate)}
  static async openRetained(signal: AbortSignal): Promise<ArrowsStore> {
    const db = await openExistingNativeDatabase(ARROWS_DATABASE, signal)
    const backend = new IndexedArrowsBackend(db)
    try {if(db.version!==1)throw new NativePresenceError('unsupported','Native source database version is unsupported');
      const root = await readExistingNativeKey(db, 'installation', 'root', signal) as ArrowsRoot
      signal.throwIfAborted(); requireObservedNativeVersion(root,'version',[ARROWS_STORAGE_VERSION,'arrows_storage_v2']); const forms=await loadArrowsForms(); signal.throwIfAborted(); validateObservedNative(()=>inspectWithForms(root,forms))
      const store = new ArrowsStore(backend, root.installationId)
      store.authority.observe(root, store.authority.provenance('open'))
      return store
    } catch (error) { backend.close(); throw error }
  }
  /** For an explicit Delete all action after ordinary open rejects a retained
   * root. This only identifies the Arrows installation; no result is trusted. */
  static async openForDeletion(): Promise<ArrowsStore> {
    const backend = await ArrowsStore.openBackend()
    try {
      const root = await backend.read()
      assert(plainRecord(root) && nonempty(root.installationId),
        'installation identity unavailable for deletion')
      return new ArrowsStore(backend, root.installationId, true)
    } catch (error) { backend.close(); throw error }
  }
  /** Unverified labels only. This path never hydrates, scores or trusts a retained result. */
  static async unverifiedHistory(): Promise<readonly { sessionId: string; specificationVersion: string; formId: string }[]> {
    const backend = await ArrowsStore.openBackend()
    try {
      const root = await backend.read()
      if (!plainRecord(root) || !plainRecord(root.attempts)) return []
      return Object.entries(root.attempts).flatMap(([sessionId, attempt]) => {
        if (!safeId(sessionId) || !plainRecord(attempt) || !plainRecord(attempt.state)) return []
        const state = attempt.state, form = plainRecord(state.form) ? state.form : null
        return [{ sessionId, specificationVersion: typeof state.specificationVersion === 'string' ? state.specificationVersion.slice(0, 100) : 'Unknown version', formId: typeof form?.id === 'string' ? form.id.slice(0, 100) : 'Unknown form' }]
      })
    } finally { backend.close() }
  }
  private async checkedRoot(signal?: AbortSignal, resolution = false) {
    const provenance = this.authority.provenance('read', resolution)
    const observed = this.backend.read(signal).then(async root => {
      await inspectArrowsRoot(root)
      this.authority.observe(root, provenance)
      assert(root.installationId === this.installationId, 'installation replaced')
      const register = this.authority.register()
      assert(register.integrity === 'verified', 'root integrity blocked')
      return this.authority.latest()!
    })
    const root = await withAbort(observed, signal)
    aborted(signal)
    return root
  }
  async read(signal?: AbortSignal) { return this.checkedRoot(signal) }
  /** Only an explicit fresh read under the publication/deletion order may
   * resolve a register conflict. Cached/old reads never carry this permission. */
  async verifyIntegrity(signal?: AbortSignal): Promise<void> {
    const { orderArrowsPublication } = await import('./presentation-order')
    const controller = new AbortController(), cancel = () => controller.abort()
    signal?.addEventListener('abort', cancel, { once: true }); if (signal?.aborted) cancel()
    const timer = setTimeout(cancel, 2_000)
    try { await orderArrowsPublication(s => this.checkedRoot(s, true), controller.signal) }
    finally { clearTimeout(timer); signal?.removeEventListener('abort', cancel) }
  }
  private transactionRoot(root: ArrowsRoot, forms: ReadonlyMap<FormId, Form>) {
    inspectWithForms(root, forms)
    this.authority.observe(root, this.authority.provenance('preimage'))
    assert(root.installationId === this.installationId, 'installation replaced')
    assert(this.authority.register().integrity === 'verified', 'root integrity blocked')
    assert(authorityEqual(root, this.authority.latest()), 'stale transaction preimage')
  }
  /** Converts a verified IndexedDB clone back to the canonical form authority. */
  private hydrate(attempt: ArmedAttempt, forms: ReadonlyMap<FormId, Form>): ArmedAttempt {
    const canonical = forms.get(attempt.state.form.id)
    assert(canonical && exact(canonical, attempt.state.form), 'arm form changed')
    const state = canonicalState(attempt.state, canonical)
    assert(verifyHeadless(state), 'arm journal changed')
    const snapshot = attempt.snapshot && { ...attempt.snapshot,
      state: canonicalState(attempt.snapshot.state, canonical) }
    if (snapshot) assert(verifyHeadless(snapshot.state) &&
      exact(snapshot.review, reconcileHeadless(snapshot.state)), 'snapshot journal changed')
    return freezeDeep({ ...attempt, profile: state.profile, state, ...(snapshot ? { snapshot } : {}) })
  }
  async loadArmed(sessionId: string, signal?: AbortSignal): Promise<ArmedAttempt | null> {
    assert(safeId(sessionId), 'invalid session ID')
    const forms = await loadArrowsForms()
    const root = await this.checkedRoot(signal)
    const attempt = root.attempts[sessionId]
    return attempt ? this.hydrate(attempt, forms) : null
  }
  async loadSnapshot(sessionId: string, signal?: AbortSignal): Promise<PersistedSnapshot | null> {
    const attempt = await this.loadArmed(sessionId, signal)
    return attempt?.snapshot ?? null
  }
  /** An absent continuation is explicit: older roots are retained without
   * inventing report views or migrating their result bytes. */
  async loadReportViews(sessionId: string, target: ArrowsAuthorityHandle): Promise<{
    readonly status: 'present' | 'legacy_absent'
    readonly events: readonly ArrowsReportViewEvent[]
  }> {
    this.authority.assertHandle(target); target.assertCurrent()
    assert(target.snapshot() && target.arm.sessionId === sessionId, 'activity authority scope unavailable')
    assert(safeId(sessionId), 'invalid session ID')
    const root = await this.checkedRoot()
    assert(root.attempts[sessionId]?.snapshot !== undefined &&
      root.tombstones[sessionId] === undefined, 'report view authority changed')
    target.assertCurrent()
    const journal = root.activity?.[sessionId]
    return freezeDeep(journal
      ? { status: 'present' as const, events: structuredClone(journal.events) }
      : { status: 'legacy_absent' as const, events: [] as ArrowsReportViewEvent[] })
  }
  /** One committed event per genuine opening. The caller owns a random view
   * ID and reuses it for delivery retries; the verified snapshot becomes
   * immutable once its report has been opened. */
  async appendReportView(sessionId: string, expectedSnapshot: PersistedSnapshot,
    viewId: string, sourceSurface: ArrowsReportSurface,
    observedWallMs: number, target: ArrowsAuthorityHandle): Promise<ArrowsReportViewEvent> {
    assert(safeId(sessionId) && safeId(viewId) &&
      (sourceSurface === 'live' || sourceSurface === 'history') &&
      Number.isFinite(observedWallMs) && observedWallMs >= 0 &&
      (expectedSnapshot?.kind === 'terminal' || expectedSnapshot?.kind === 'checkpoint'),
    'invalid report view request')
    this.authority.assertHandle(target)
    assert(target.arm.sessionId === sessionId && exact(target.snapshot(), expectedSnapshot), 'activity authority scope unavailable')
    expectedSnapshot = structuredClone(expectedSnapshot)
    const forms = await loadArrowsForms()
    const matching = (root: ArrowsRoot) => {
      const attempt = root.attempts[sessionId]
      assert(attempt?.snapshot !== undefined && target.matches(attempt) &&
        root.tombstones[sessionId] === undefined &&
        exact(attempt.snapshot, expectedSnapshot), 'report view authority changed')
      return root.activity?.[sessionId]?.events.find(event => event.viewId === viewId)
    }
    try {
      await this.backend.change(root => {
        this.transactionRoot(root, forms)
        target.assertCurrent()
        if (matching(root)) return
        assert(root.revision < Number.MAX_SAFE_INTEGER, 'revision exhausted')
        const prior = root.activity?.[sessionId]
        const sequenceNumber = (prior?.events.length ?? 0) + 1
        assert(Number.isSafeInteger(sequenceNumber), 'activity sequence exhausted')
        const event: ArrowsReportViewEvent = { version: ARROWS_ACTIVITY_VERSION,
          type: 'report_viewed', sequenceNumber, installationId: this.installationId,
          sessionId, viewId, sourceSurface, observedWallMs }
        root.activity ??= {}
        root.activity[sessionId] = { version: ARROWS_ACTIVITY_VERSION,
          installationId: this.installationId, sessionId,
          resultRevision: expectedSnapshot.revision,
          events: [...(prior?.events ?? []), event] }
        root.revision++
        inspectWithForms(root, forms)
      })
    } catch (error) {
      try {
        const root = await this.checkedRoot()
        const event = matching(root)
        if (event) { target.assertCurrent(); return freezeDeep(structuredClone(event)) }
      } catch (readError) {
        if (this.authority.register().integrity !== 'verified' || target.status().kind === 'retired') throw readError
      }
      throw error
    }
    const root = await this.checkedRoot()
    const event = matching(root)
    target.assertCurrent()
    assert(event, 'report view not confirmed')
    return freezeDeep(structuredClone(event))
  }
  /** History is read from one verified installation snapshot. An armed or
   * checkpoint-only attempt is review-only after reload, never resumable. */
  async listAttempts(signal?: AbortSignal): Promise<readonly ArmedAttempt[]> {
    const forms = await loadArrowsForms()
    const root = await this.checkedRoot(signal)
    return freezeDeep(Object.values(root.attempts)
      .sort((a, b) => a.state.specificationVersion.localeCompare(b.state.specificationVersion) || b.ordinal - a.ordinal)
      .map(attempt => this.hydrate(attempt, forms)))
  }
  /** Retirement and its tombstone commit together, so an older completion
   * callback cannot restore this session even if notification delivery fails. */
  async deleteAttempt(sessionId: string): Promise<void> {
    assert(safeId(sessionId), 'invalid deletion target')
    return orderArrowsDeletion(signal => this.deleteAttemptOrdered(sessionId, signal))
  }
  private async deleteAttemptOrdered(sessionId: string, signal: AbortSignal | undefined): Promise<void> {
    const forms = await loadArrowsForms()
    aborted(signal)
    try {
      await this.backend.change(root => {
        this.transactionRoot(root, forms)
        assert(root.revision < Number.MAX_SAFE_INTEGER, 'revision exhausted')
        if (root.tombstones[sessionId] !== undefined) return
        assert(root.attempts[sessionId], 'deletion target unavailable')
        const deleted = root.attempts[sessionId]
        delete root.attempts[sessionId]
        if (root.activity) delete root.activity[sessionId]
        root.tombstones[sessionId] = isV11(deleted.state) ? { version: 'arrows_spec_v1_1', ordinal: deleted.ordinal, requestId: deleted.requestId, deletedAtWallMs: Date.now() } : Date.now()
        root.revision++
        inspectWithForms(root, forms)
      }, signal)
    } catch (error) {
      aborted(signal)
      // A transaction may commit while its completion callback is lost.
      // Only authoritative readback may turn that uncertainty into success.
      try {
        const root = await this.checkedRoot(signal)
        if (root.tombstones[sessionId] !== undefined && !root.attempts[sessionId]) {
          aborted(signal)
          this.notifyDeletion({ type: 'attempt_deleted', installationId: this.installationId, sessionId })
          return
        }
      } catch { /* Preserve the uncertain write failure. */ }
      throw error
    }
    const root = await this.checkedRoot(signal)
    assert(root.tombstones[sessionId] !== undefined && !root.attempts[sessionId], 'deletion not confirmed')
    aborted(signal)
    this.notifyDeletion({ type: 'attempt_deleted', installationId: this.installationId, sessionId })
  }
  private observeReplacementRead(signal: AbortSignal | undefined): Promise<ArrowsRoot> {
    const provenance = this.authority.provenance('replacement')
    return withAbort(this.backend.read(signal).then(async root => {
      await inspectArrowsRoot(root)
      this.authority.observe(root, provenance)
      return root
    }), signal)
  }
  /** Delete all creates a new installation. The returned store alone may
   * address it; callbacks holding this store retain the retired identity. */
  async deleteAll(): Promise<ArrowsStore> {
    return orderArrowsDeletion(signal => this.deleteAllOrdered(signal))
  }
  private async deleteAllOrdered(signal: AbortSignal | undefined): Promise<ArrowsStore> {
    const replacement = freshArrowsRoot()
    const forms = this.deletionOnly ? null : await loadArrowsForms()
    aborted(signal)
    try {
      await this.backend.change(root => {
        assert(plainRecord(root) && nonempty(root.installationId),
          'installation identity unavailable for deletion')
        // An explicit reset may recover blocked integrity, but an old Store
        // must never reset a replacement installation discovered in this tx.
        assert(root.installationId === this.installationId, 'installation replaced')
        if (forms) inspectWithForms(root, forms)
        if (forms) {
          try { this.authority.observe(root, this.authority.provenance('preimage')) }
          catch (error) {
            // Preserve the conflict and its notifications. Only this explicit
            // whole-installation reset can proceed without trusting that root;
            // ordinary writes still require the verified transaction preimage.
            if (!(error instanceof ArrowsIntegrityError) || this.authority.register().integrity !== 'blocked') throw error
          }
        }
        for (const key of Object.keys(root)) delete (root as unknown as Record<string, unknown>)[key]
        Object.assign(root, replacement)
      }, signal)
    } catch (error) {
      aborted(signal)
      try {
        const root = await this.observeReplacementRead(signal)
        if (root.installationId === replacement.installationId) {
          aborted(signal)
          this.notifyDeletion({ type: 'installation_replaced', installationId: this.installationId,
            replacementInstallationId: replacement.installationId })
          return this.adoptReplacement(root)
        }
      } catch { /* Preserve the uncertain write failure. */ }
      throw error
    }
    const root = await this.observeReplacementRead(signal)
    assert(root.installationId === replacement.installationId, 'replacement not confirmed')
    aborted(signal)
    this.notifyDeletion({ type: 'installation_replaced', installationId: this.installationId,
      replacementInstallationId: replacement.installationId })
    return this.adoptReplacement(root)
  }
  private adoptReplacement(root: ArrowsRoot): ArrowsStore {
    const replacement = new ArrowsStore(this.backend, root.installationId)
    replacement.authority.observe(root, replacement.authority.provenance('open'))
    return replacement
  }
  /** Only an untimed break or terminal state may be persisted. The full journal
   * remains an immutable prefix; timed input never waits for this method. */
  async saveSnapshot(arm: ArmedAttempt, state: State, expectedRevision: number,
    signal?: AbortSignal): Promise<PersistedSnapshot> {
    arm = structuredClone(arm)
    state = structuredClone(state)
    const target = this.authority.handle(arm, state)
    return orderArrowsSnapshot(orderedSignal =>
      this.saveSnapshotOrdered(arm, state, expectedRevision, orderedSignal, target), signal)
  }
  private async saveSnapshotOrdered(arm: ArmedAttempt, state: State, expectedRevision: number,
    signal: AbortSignal, target: ArrowsAuthorityHandle): Promise<PersistedSnapshot> {
    assert(safeId(arm.sessionId) && nonnegativeInteger(expectedRevision) &&
      expectedRevision < Number.MAX_SAFE_INTEGER, 'invalid snapshot request')
    arm = structuredClone(arm)
    state = structuredClone(state)
    const forms = await loadArrowsForms()
    aborted(signal)
    const form = forms.get(state.form.id)
    assert(form && exact(form, state.form) && verifyHeadless(canonicalState(state, form)) &&
      (state.phase === 'break' || state.phase === 'invalid' || state.phase === 'completed') &&
      exact(state.identity, arm.state.identity) && exact(state.profile, arm.profile), 'invalid snapshot state')
    const review = reconcileHeadless(canonicalState(state, form))
    const desired: PersistedSnapshot = { revision: expectedRevision + 1,
      kind: state.phase === 'break' ? 'checkpoint' : 'terminal',
      closedTrials: state.events.filter(event => event.type === 'trial_closed').length,
      state, review }
    aborted(signal)
    const matches = (root: ArrowsRoot) => {
      const retained = root.attempts[arm.sessionId]
      assert(retained && target.matches(retained) && exact(retained.state, arm.state) &&
        retained.requestId === arm.requestId && retained.ordinal === arm.ordinal &&
        root.tombstones[arm.sessionId] === undefined, 'snapshot authority changed')
      // The first checkpoint has no earlier snapshot to compare. Bind it to
      // the actual durable arm before mutation, not just to the caller's
      // session/profile or to a separately replay-valid journal.
      const compatible = exact(desired.state.form, retained.state.form) &&
        desired.state.armedAtMs === retained.state.armedAtMs &&
        exact(desired.state.events.slice(0, retained.state.events.length), retained.state.events) &&
        exact(desired.state.commands.slice(0, retained.state.commands.length), retained.state.commands)
      assert(compatible, 'snapshot arm prefix changed')
      return retained
    }
    try {
      await withAbort(this.backend.change(root => {
        this.transactionRoot(root, forms)
        const retained = matches(root)
        const prior = retained.snapshot
        if (prior && exact(prior, desired)) return
        if (root.activity?.[arm.sessionId] !== undefined) {
          // A forbidden advance is a failed operation, not loss of the
          // currently immutable result (or of its original arm).
          throw Error('Arrows storage: snapshot authority changed')
        }
        assert(root.revision < Number.MAX_SAFE_INTEGER &&
          (prior?.revision ?? 0) === expectedRevision && prior?.kind !== 'terminal' &&
          (!prior || prior.closedTrials <= desired.closedTrials &&
            exact(desired.state.commands.slice(0, prior.state.commands.length), prior.state.commands) &&
            exact(desired.state.events.slice(0, prior.state.events.length), prior.state.events)) &&
          (desired.kind !== 'checkpoint' || !prior ||
            desired.closedTrials > prior.closedTrials ||
            desired.closedTrials === prior.closedTrials &&
              desired.state.events.length > prior.state.events.length),
        'snapshot revision or prefix changed')
        target.assertCurrent()
        root.attempts[arm.sessionId] = { ...retained, snapshot: desired }
        root.revision++
        // Reject a malformed candidate in the transaction, before store.put.
        inspectWithForms(root, forms)
      }, signal), signal)
    } catch (error) {
      aborted(signal)
      try {
        const root = await this.checkedRoot(signal)
        if (exact(matches(root).snapshot, desired)) { target.assertCurrent(); this.authority.confirm(target, desired); return this.hydrate(matches(root), forms).snapshot! }
      } catch (readError) {
        // The write error may be operational, but this later read can prove
        // that the original arm or installation has been retired. Preserve
        // that stronger evidence for callers that hold older positive reads.
        if (this.authority.register().integrity !== 'verified' || target.status().kind === 'retired') throw readError
      }
      throw error
    }
    const root = await this.checkedRoot(signal)
    const retained = matches(root)
    assert(exact(retained.snapshot, desired), 'snapshot not confirmed')
    target.assertCurrent()
    this.authority.confirm(target, desired)
    return this.hydrate(retained, forms).snapshot!
  }
  private matching(root: ArrowsRoot, request: StartRequest) {
    const attempt = Object.values(root.attempts).find(item => item.requestId === request.requestId)
    if (!attempt) return null
    assert(isV11(attempt.state) && attempt.sessionId === request.sessionId &&
      attempt.state.identity.clockDomainId === request.clockDomainId &&
      exact(attempt.state.profile, request.profile) &&
      attempt.state.armedAtMs === request.atMs &&
      attempt.createdAtWallMs === request.wallMs, 'start request identity changed')
    return attempt
  }
  /** Called only by Entry after the common live ownership lock is acquired.
   * Native transaction preimage is inspected synchronously; historical values are never rebuilt. */
  private async migrateV11(forms: ReadonlyMap<FormId, Form>, signal?: AbortSignal): Promise<void> {
    let desired: ArrowsRoot | null = null
    try {
      await withAbort(this.backend.change(root => {
        this.transactionRoot(root, forms)
        if (root.version === 'arrows_storage_v2') { desired = structuredClone(root); return }
        assert(root.revision < Number.MAX_SAFE_INTEGER, 'migration revision exhausted')
        root.version = 'arrows_storage_v2'; root.scoredStartCountV11 = 0; root.revision++
        inspectWithForms(root, forms)
        desired = structuredClone(root)
      }, signal), signal)
    } catch (error) {
      aborted(signal)
      const readback = await this.checkedRoot(signal)
      if (!desired || !authorityEqual(readback, desired)) throw error
      return
    }
    const readback = await this.checkedRoot(signal)
    assert(desired && authorityEqual(readback, desired), 'migration not confirmed')
  }
  async start(request: StartRequest, signal?: AbortSignal): Promise<ArmedAttempt> {
    assert(safeId(request.requestId) && safeId(request.sessionId) &&
      safeId(request.clockDomainId) && Number.isFinite(request.atMs) && request.atMs >= 0 &&
      Number.isFinite(request.wallMs) && request.wallMs >= 0, 'invalid start request')
    // A caller cannot change the admitted profile or request identity while storage is pending.
    request = structuredClone(request)
    aborted(signal)
    const forms = await loadArrowsForms()
    aborted(signal)
    if ((await this.checkedRoot(signal)).version === 'arrows_storage_v1')
      await orderArrowsSnapshot(orderedSignal => this.migrateV11(forms, orderedSignal), signal)
    aborted(signal)
    try {
      await withAbort(this.backend.change(root => {
        this.transactionRoot(root, forms)
        // The transaction reads the authoritative root, not a prior tab snapshot.
        const prior = Object.values(root.attempts).find(item => item.requestId === request.requestId)
        if (prior) { this.matching(root, request); return }
        assert(root.version === 'arrows_storage_v2' &&
          nonnegativeInteger(root.scoredStartCountV11!) && root.scoredStartCountV11! < Number.MAX_SAFE_INTEGER &&
          root.revision < Number.MAX_SAFE_INTEGER && !root.attempts[request.sessionId] &&
          Object.values(root.tombstones).every(t => typeof t === 'number' || t.requestId !== request.requestId) &&
          root.tombstones[request.sessionId] === undefined, 'start authority lost')
        const form = forms.get(V11_FORM_IDS[root.scoredStartCountV11! % 6])
        assert(form, 'form inventory unavailable')
        const state = armHeadless(form as V11Form, { installationId: this.installationId,
          sessionId: request.sessionId, clockDomainId: request.clockDomainId }, request.profile, request.atMs)
        const ordinal = root.scoredStartCountV11! + 1
        root.attempts[request.sessionId] = { requestId: request.requestId, sessionId: request.sessionId,
          clockDomainId: request.clockDomainId, profile: request.profile,
          ordinal, createdAtWallMs: request.wallMs, state }
        root.scoredStartCountV11 = ordinal
        root.revision++
        inspectWithForms(root, forms)
      }, signal), signal)
    } catch (error) {
      aborted(signal)
      // Delivery can fail after commit. Only an authoritative read may recover it.
      try {
        const root = await this.checkedRoot(signal)
        const retained = this.matching(root, request)
        if (retained) { this.authority.handle(retained); return this.hydrate(retained, forms) }
      } catch { /* Preserve the original uncertain failure. */ }
      throw error
    }
    const root = await this.checkedRoot(signal)
    const retained = this.matching(root, request)
    assert(retained && root.scoredStartCountV11! >= retained.ordinal, 'start not confirmed')
    this.authority.handle(retained)
    return this.hydrate(retained, forms)
  }
}
