import { MouthAuthority, MouthIntegrityError, authorityEqual, createMouthAuthorityState } from './authority'
import type { MouthAuthorityState, MouthAuthorityHandle } from './authority'
import { MOUTH_ACTIVITY_VERSION, MOUTH_STORAGE_VERSION } from './contracts'
import type { Form, FormId, Variant } from './contracts'
import { armHeadless, verifyHeadless } from './engine'
import type { InputProfile, Route, State } from './engine'
import { loadMouthForms } from './manifests'
import { reconcileHeadless } from './report'
import type { HeadlessReview } from './report'
import { orderMouthDeletion, orderMouthSnapshot } from './order'
import { validMouthDisplayContext } from './display-context'
import type { MouthDisplayContext } from './display-context'

export const MOUTH_DATABASE = 'assessment-practice-lengths-mouth-v1-2'
const MOUTH_DELETION_CHANNEL = 'assessment-practice-lengths-mouth-v1-2-deletion'
const FORM_IDS: Readonly<Record<Variant, readonly FormId[]>> = {
  standard: ['LM1', 'LM2', 'LM3', 'LM4', 'LM5', 'LM6'],
  visual_accommodation: ['LM1', 'LM2', 'LM3', 'LM4', 'LM5', 'LM6'],
}

export interface ArmedAttempt {
  readonly requestId: string
  readonly sessionId: string
  readonly clockDomainId: string
  readonly profile: InputProfile
  readonly variant: Variant
  readonly route: Route
  readonly ordinal: number
  readonly createdAtWallMs: number
  readonly armDisplayContext: MouthDisplayContext
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
export interface MouthRoot {
  version: typeof MOUTH_STORAGE_VERSION
  installationId: string
  revision: number
  counters: Record<Variant, number>
  attempts: Record<string, ArmedAttempt>
  tombstones: Record<string, { readonly requestId: string; readonly variant: Variant; readonly ordinal: number; readonly deletedAtWallMs: number }>
  /** Optional for roots written before local report-view recording existed. */
  activity?: Record<string, MouthActivityJournal>
}
export type MouthReportSurface = 'live' | 'history'
export interface MouthReportViewEvent {
  readonly version: typeof MOUTH_ACTIVITY_VERSION
  readonly type: 'report_viewed'
  readonly sequenceNumber: number
  readonly installationId: string
  readonly sessionId: string
  readonly viewId: string
  readonly sourceSurface: MouthReportSurface
  readonly observedWallMs: number
  /** Zero binds the immutable three-event arm prefix; positive values bind a snapshot. */
  readonly resultRevision: number
}
export interface MouthActivityJournal {
  readonly version: typeof MOUTH_ACTIVITY_VERSION
  readonly installationId: string
  readonly sessionId: string
  readonly resultRevision: number
  readonly events: readonly MouthReportViewEvent[]
}
export type MouthDeletionNotice =
  | { readonly type: 'attempt_deleted'; readonly installationId: string; readonly sessionId: string }
  | { readonly type: 'installation_replaced'; readonly installationId: string;
      readonly replacementInstallationId: string }
export interface MouthBackend {
  read(signal?: AbortSignal): Promise<MouthRoot>
  change<T>(operation: (root: MouthRoot) => T, signal?: AbortSignal): Promise<T>
}
export interface StartRequest {
  readonly requestId: string
  readonly sessionId: string
  readonly clockDomainId: string
  readonly profile: InputProfile
  readonly variant: Variant
  readonly route: Route
  readonly atMs: number
  readonly wallMs: number
  readonly displayContext: MouthDisplayContext
}

export function freshMouthRoot(): MouthRoot {
  return { version: MOUTH_STORAGE_VERSION, installationId: crypto.randomUUID(),
    revision: 0, counters: { standard: 0, visual_accommodation: 0 }, attempts: {}, tombstones: {}, activity: {} }
}
function assert(condition: unknown, reason: string): asserts condition {
  if (!condition) throw Error(`Mouth storage: ${reason}`)
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
  if (signal?.aborted) throw Error('Mouth start canceled')
}
function withAbort<T>(pending: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return pending
  if (signal.aborted) {
    // The caller may have constructed work just before noticing cancellation.
    // Observe its eventual rejection even though its result is no longer usable.
    void pending.catch(() => {})
    return Promise.reject(Error('Mouth start canceled'))
  }
  return new Promise((resolve, reject) => {
    const cancel = () => reject(Error('Mouth start canceled'))
    signal.addEventListener('abort', cancel, { once: true })
    pending.then(value => { signal.removeEventListener('abort', cancel); resolve(value) },
      error => { signal.removeEventListener('abort', cancel); reject(error) })
  })
}

/** Rejects unsupported/corrupt roots without modifying their retained bytes. */
function inspectWithForms(root: MouthRoot, forms: ReadonlyMap<FormId, Form>): void {
  assert(plainRecord(root) &&
    root.version === MOUTH_STORAGE_VERSION && nonempty(root.installationId) &&
    nonnegativeInteger(root.revision) && plainRecord(root.counters) &&
    Object.keys(root.counters).toSorted().join('|') === 'standard|visual_accommodation' &&
    nonnegativeInteger(root.counters.standard) && nonnegativeInteger(root.counters.visual_accommodation) &&
    root.revision >= root.counters.standard + root.counters.visual_accommodation &&
    plainRecord(root.attempts) && plainRecord(root.tombstones) &&
    (root.activity === undefined || plainRecord(root.activity)), 'unsupported root')
  const seenRequests = new Set<string>()
  const seenOrdinals = new Set<string>()
  for (const [sessionId, tombstone] of Object.entries(root.tombstones)) {
    assert(safeId(sessionId) && plainRecord(tombstone) && safeId(tombstone.requestId) &&
      !seenRequests.has(tombstone.requestId) &&
      (tombstone.variant === 'standard' || tombstone.variant === 'visual_accommodation') &&
      nonnegativeInteger(tombstone.ordinal) && tombstone.ordinal > 0 &&
      tombstone.ordinal <= root.counters[tombstone.variant] &&
      Number.isFinite(tombstone.deletedAtWallMs) && tombstone.deletedAtWallMs >= 0 &&
      !seenOrdinals.has(`${tombstone.variant}:${tombstone.ordinal}`) &&
      !root.attempts[sessionId], 'invalid tombstone')
    seenOrdinals.add(`${tombstone.variant}:${tombstone.ordinal}`)
    seenRequests.add(tombstone.requestId)
  }
  for (const [sessionId, attempt] of Object.entries(root.attempts)) {
    assert(attempt && attempt.sessionId === sessionId && safeId(sessionId) &&
      safeId(attempt.requestId) && safeId(attempt.clockDomainId) &&
      !seenRequests.has(attempt.requestId) &&
      nonnegativeInteger(attempt.ordinal) && attempt.ordinal > 0 &&
      (attempt.variant === 'standard' || attempt.variant === 'visual_accommodation') &&
      attempt.ordinal <= root.counters[attempt.variant] &&
      !seenOrdinals.has(`${attempt.variant}:${attempt.ordinal}`) &&
      Number.isFinite(attempt.createdAtWallMs) && attempt.createdAtWallMs >= 0 &&
      validMouthDisplayContext(attempt.armDisplayContext) &&
      root.tombstones[sessionId] === undefined &&
      attempt.state?.identity?.installationId === root.installationId &&
      attempt.state.identity.sessionId === sessionId &&
      attempt.state.identity.clockDomainId === attempt.clockDomainId &&
      exact(attempt.state.identity.route, attempt.route) &&
      exact(attempt.state.profile, attempt.profile) &&
      attempt.state.profile?.variant === attempt.variant &&
      attempt.state.form?.id === FORM_IDS[attempt.variant][(attempt.ordinal - 1) % 6], 'invalid arm identity')
    seenRequests.add(attempt.requestId)
    seenOrdinals.add(`${attempt.variant}:${attempt.ordinal}`)
    const form = forms.get(attempt.state.form.id)
    assert(form && exact(form, attempt.state.form) &&
      verifyHeadless({ ...attempt.state, form }) &&
      attempt.state.phase === 'armed' && attempt.state.commands.length === 0 &&
      attempt.state.events.length === 3 &&
      attempt.state.eventVersion === 'lengths_mouth_event_v1' &&
      attempt.state.form.id === FORM_IDS[attempt.variant][(attempt.ordinal - 1) % 6], 'unreconciled arm')
    if (attempt.snapshot !== undefined) {
      const snapshot = attempt.snapshot
      const saved = snapshot.state
      assert(nonnegativeInteger(snapshot.revision) && snapshot.revision > 0 &&
        snapshot.revision <= root.revision &&
        (snapshot.kind === 'checkpoint' && saved.phase === 'break' ||
          snapshot.kind === 'terminal' && (saved.phase === 'invalid' || saved.phase === 'completed')) &&
        exact(saved.identity, attempt.state.identity) && exact(saved.profile, attempt.profile) &&
        exact(saved.form, form) && verifyHeadless({ ...saved, form }) &&
        exact(saved.commands.slice(0, attempt.state.commands.length), attempt.state.commands) &&
        exact(saved.events.slice(0, attempt.state.events.length), attempt.state.events) &&
        snapshot.closedTrials === saved.events.filter(event => event.type === 'trial_closed').length &&
        exact(snapshot.review, reconcileHeadless({ ...saved, form })), 'unreconciled snapshot')
    }
  }
  for (const [sessionId, journal] of Object.entries(root.activity ?? {})) {
    const attempt = root.attempts[sessionId]
    assert(safeId(sessionId) && plainRecord(journal) &&
      journal.version === MOUTH_ACTIVITY_VERSION &&
      journal.installationId === root.installationId && journal.sessionId === sessionId &&
      attempt !== undefined && nonnegativeInteger(journal.resultRevision) &&
      journal.resultRevision === journal.events?.[0]?.resultRevision &&
      journal.resultRevision <= (attempt.snapshot?.revision ?? 0) &&
      Array.isArray(journal.events) && journal.events.length > 0, 'invalid activity journal')
    const views = new Set<string>()
    for (let index = 0; index < journal.events.length; index++) {
      const event = journal.events[index]
      assert(plainRecord(event), 'invalid activity event')
      const view = event as unknown as MouthReportViewEvent
      assert(view.version === MOUTH_ACTIVITY_VERSION &&
        view.type === 'report_viewed' && nonnegativeInteger(view.resultRevision) && view.resultRevision <= (attempt.snapshot?.revision ?? 0) && view.sequenceNumber === index + 1 &&
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
  assert(root.counters.standard + root.counters.visual_accommodation ===
    Object.keys(root.attempts).length + Object.keys(root.tombstones).length,
    'arm counter and retained history disagree')
  for (const variant of ['standard', 'visual_accommodation'] as const)
    for (let ordinal = 1; ordinal <= root.counters[variant]; ordinal++)
      assert(seenOrdinals.has(`${variant}:${ordinal}`), 'arm ordinal history has a gap')
}
export async function inspectMouthRoot(root: MouthRoot): Promise<void> {
  inspectWithForms(root, await loadMouthForms())
}

class IndexedMouthBackend implements MouthBackend {
  private readonly db: IDBDatabase
  constructor(db: IDBDatabase) { this.db = db }
  close() { this.db.close() }
  /** One contained native lifecycle for both modes. Cancellation may happen
   * synchronously while operation(preimage) notifies authority subscribers. */
  private transaction<T>(mode: IDBTransactionMode, operation: (root: MouthRoot) => T, signal?: AbortSignal): Promise<T> {
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
        else reject(cause ?? error ?? Error('Mouth transaction failed'))
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
      const cancel = () => requestAbort(signal?.reason ?? Error('Mouth transaction canceled'))
      request.onsuccess = () => {
        if (phase !== 'active') return
        try {
          aborted(signal)
          if (!request.result) throw Error('Missing Mouth installation')
          value = operation(request.result as MouthRoot)
          aborted(signal)
          if (phase !== 'active') throw cause ?? Error('Mouth transaction canceled')
          if (mode === 'readwrite') store.put(request.result, 'root')
          delivered = true
        } catch (error) { requestAbort(error) }
      }
      request.onerror = () => {
        try { requestAbort(request.error ?? Error('Mouth request failed')) }
        catch (error) { requestAbort(error) }
      }
      tx.oncomplete = () => { try { settle(true) } catch (error) { settle(false, error) } }
      tx.onerror = tx.onabort = () => { try { settle(false, tx.error ?? Error('Mouth transaction failed')) } catch (error) { settle(false, error) } }
      signal?.addEventListener('abort', cancel, { once: true })
      if (signal?.aborted) cancel()
    })
  }
  read(signal?: AbortSignal): Promise<MouthRoot> {
    // Store observation sits below its public cancellation boundary. Preserve
    // an already completed readonly root even when its delivery is delayed.
    return this.transaction('readonly', root => root, signal)
  }
  change<T>(operation: (root: MouthRoot) => T, signal?: AbortSignal): Promise<T> {
    return withAbort(this.transaction('readwrite', operation, signal), signal)
  }

}

/** Durable arm and verified between-block/terminal snapshots. */
// Connections in one realm share durable target authority, but each Store
// retains its own operation identity. Independent tabs acquire facts locally.
const nativeAuthorityStates = new Map<string, MouthAuthorityState>()
const backendAuthorityStates = new WeakMap<MouthBackend, Map<string, MouthAuthorityState>>()
function authorityState(backend: MouthBackend, installationId: string): MouthAuthorityState {
  let installations = backend instanceof IndexedMouthBackend ? nativeAuthorityStates : backendAuthorityStates.get(backend)
  if (!installations) { installations = new Map(); backendAuthorityStates.set(backend, installations) }
  let state = installations.get(installationId)
  if (!state) { state = createMouthAuthorityState(); installations.set(installationId, state) }
  return state
}

export class MouthStore {
  readonly backend: MouthBackend
  readonly installationId: string
  readonly authority: MouthAuthority
  private readonly deletionOnly: boolean
  private readonly deletionListeners = new Set<(notice: MouthDeletionNotice) => void>()
  private deletionChannel: BroadcastChannel | null = null
  private readonly noticeSender = crypto.randomUUID()
  constructor(backend: MouthBackend, installationId: string, deletionOnly = false) {
    this.backend = backend
    this.installationId = installationId
    this.authority = new MouthAuthority(installationId, authorityState(backend, installationId))
    this.deletionOnly = deletionOnly
  }
  /** Notifications improve promptness only. Subscribers must reread storage
   * before treating a report as saved or displayable. */
  subscribeDeletion(listener: (notice: MouthDeletionNotice) => void): () => void {
    this.deletionListeners.add(listener)
    if (!this.deletionChannel && typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.deletionChannel = new BroadcastChannel(MOUTH_DELETION_CHANNEL)
        this.deletionChannel.onmessage = event => {
          const data = event.data as { sender?: unknown; notice?: unknown } | null
          if (!data || data.sender === this.noticeSender) return
          const notice = data.notice
          if (!plainRecord(notice) || notice.installationId !== this.installationId ||
            (notice.type !== 'attempt_deleted' || !safeId(notice.sessionId)) &&
            (notice.type !== 'installation_replaced' || !nonempty(notice.replacementInstallationId))) return
          for (const subscribed of this.deletionListeners) {
            try { subscribed(notice as MouthDeletionNotice) }
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
  private notifyDeletion(notice: MouthDeletionNotice) {
    for (const listener of this.deletionListeners) {
      try { listener(notice) } catch { /* Observers cannot reverse retirement. */ }
    }
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const channel = new BroadcastChannel(MOUTH_DELETION_CHANNEL)
        channel.postMessage({ sender: this.noticeSender, notice })
        channel.close()
      } catch { /* Notification failure cannot reverse a committed deletion. */ }
    }
  }
  private static async openBackend(): Promise<IndexedMouthBackend> {
    assert(typeof indexedDB !== 'undefined', 'local storage unavailable')
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(MOUTH_DATABASE, 1)
      request.onupgradeneeded = event => {
        if (event.oldVersion !== 0) { request.transaction?.abort(); return }
        request.result.createObjectStore('installation').put(freshMouthRoot(), 'root')
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? Error('Mouth database unavailable'))
      request.onblocked = () => reject(Error('Mouth database blocked'))
    })
    return new IndexedMouthBackend(db)
  }
  static async open(): Promise<MouthStore> {
    const backend = await MouthStore.openBackend()
    try {
      const root = await backend.read()
      await inspectMouthRoot(root)
      const store = new MouthStore(backend, root.installationId)
      store.authority.observe(root, store.authority.provenance('open'))
      return store
    } catch (error) { backend.close(); throw error }
  }
  /** For an explicit Delete all action after ordinary open rejects a retained
   * root. This only identifies the Mouth installation; no result is trusted. */
  static async openForDeletion(): Promise<MouthStore> {
    const backend = await MouthStore.openBackend()
    try {
      const root = await backend.read()
      assert(plainRecord(root) && nonempty(root.installationId),
        'installation identity unavailable for deletion')
      return new MouthStore(backend, root.installationId, true)
    } catch (error) { backend.close(); throw error }
  }
  private async checkedRoot(signal?: AbortSignal, resolution = false) {
    const provenance = this.authority.provenance('read', resolution)
    const observed = this.backend.read(signal).then(async root => {
      await inspectMouthRoot(root)
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
    const { orderMouthPublication } = await import('./order')
    const controller = new AbortController(), cancel = () => controller.abort()
    signal?.addEventListener('abort', cancel, { once: true }); if (signal?.aborted) cancel()
    const timer = setTimeout(cancel, 2_000)
    try { await orderMouthPublication(s => this.checkedRoot(s, true), controller.signal) }
    finally { clearTimeout(timer); signal?.removeEventListener('abort', cancel) }
  }
  private transactionRoot(root: MouthRoot, forms: ReadonlyMap<FormId, Form>) {
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
    const state = { ...attempt.state, form: canonical }
    assert(verifyHeadless(state), 'arm journal changed')
    const snapshot = attempt.snapshot && { ...attempt.snapshot,
      state: { ...attempt.snapshot.state, form: canonical } }
    if (snapshot) assert(verifyHeadless(snapshot.state) &&
      exact(snapshot.review, reconcileHeadless(snapshot.state)), 'snapshot journal changed')
    return freezeDeep({ ...attempt, profile: state.profile, state, ...(snapshot ? { snapshot } : {}) })
  }
  async loadArmed(sessionId: string, signal?: AbortSignal): Promise<ArmedAttempt | null> {
    assert(safeId(sessionId), 'invalid session ID')
    const forms = await loadMouthForms()
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
  async loadReportViews(sessionId: string, target: MouthAuthorityHandle): Promise<{
    readonly status: 'present' | 'legacy_absent'
    readonly events: readonly MouthReportViewEvent[]
  }> {
    this.authority.assertHandle(target); target.assertCurrent()
    assert((target.snapshot() || target.armedOnly) && target.arm.sessionId === sessionId, 'activity authority scope unavailable')
    assert(safeId(sessionId), 'invalid session ID')
    const root = await this.checkedRoot()
    assert(root.attempts[sessionId] && target.matches(root.attempts[sessionId]) &&
      root.tombstones[sessionId] === undefined, 'report view authority changed')
    target.assertCurrent()
    const journal = root.activity?.[sessionId]
    return freezeDeep(journal
      ? { status: 'present' as const, events: structuredClone(journal.events) }
      : { status: 'legacy_absent' as const, events: [] as MouthReportViewEvent[] })
  }
  /** A view binds revision zero (arm prefix) or an exact snapshot. A matching
   * committed retry can outlive legitimate extension; it grants no display authority. */
  async appendReportView(sessionId: string, expectedSnapshot: PersistedSnapshot | null,
    viewId: string, sourceSurface: MouthReportSurface,
    observedWallMs: number, target: MouthAuthorityHandle, signal?: AbortSignal): Promise<MouthReportViewEvent> {
    assert(safeId(sessionId) && safeId(viewId) &&
      (sourceSurface === 'live' || sourceSurface === 'history') &&
      Number.isFinite(observedWallMs) && observedWallMs >= 0 &&
      (expectedSnapshot === null || expectedSnapshot?.kind === 'terminal' || expectedSnapshot?.kind === 'checkpoint'),
    'invalid report view request')
    this.authority.assertHandle(target)
    assert(target.arm.sessionId === sessionId &&
      (expectedSnapshot === null ? target.armedOnly : exact(target.snapshot(), expectedSnapshot)),
    'activity authority scope unavailable')
    expectedSnapshot = structuredClone(expectedSnapshot)
    aborted(signal)
    const resultRevision = expectedSnapshot?.revision ?? 0
    const forms = await loadMouthForms()
    const committed = (root: MouthRoot) => {
      const attempt = root.attempts[sessionId]
      assert(attempt && target.matches(attempt) && root.installationId === this.installationId &&
        root.tombstones[sessionId] === undefined, 'report view authority changed')
      const event = root.activity?.[sessionId]?.events.find(event => event.viewId === viewId)
      if (event) {
        assert(event.resultRevision === resultRevision && event.sourceSurface === sourceSurface &&
          event.observedWallMs === observedWallMs, 'report view ID binding changed')
        const status = target.status()
        assert(status.kind !== 'retired' || status.evidence === 'incompatible_result', 'report view authority changed')
      }
      return event
    }
    try {
      await this.backend.change(root => {
        aborted(signal)
        this.transactionRoot(root, forms)
        // Acknowledging an existing bound event cannot authorize a stale report.
        if (committed(root)) return
        target.assertCurrent()
        assert(expectedSnapshot === null ? root.attempts[sessionId].snapshot === undefined :
          exact(root.attempts[sessionId].snapshot, expectedSnapshot), 'report view authority changed')
        assert(root.revision < Number.MAX_SAFE_INTEGER, 'revision exhausted')
        const prior = root.activity?.[sessionId]
        const sequenceNumber = (prior?.events.length ?? 0) + 1
        assert(Number.isSafeInteger(sequenceNumber), 'activity sequence exhausted')
        const event: MouthReportViewEvent = { version: MOUTH_ACTIVITY_VERSION,
          type: 'report_viewed', sequenceNumber, installationId: this.installationId,
          sessionId, viewId, sourceSurface, observedWallMs, resultRevision }
        root.activity ??= {}
        root.activity[sessionId] = { version: MOUTH_ACTIVITY_VERSION,
          installationId: this.installationId, sessionId,
          resultRevision: prior?.resultRevision ?? resultRevision,
          events: [...(prior?.events ?? []), event] }
        root.revision++
        inspectWithForms(root, forms)
      }, signal)
    } catch (error) {
      aborted(signal)
      const event = committed(await this.checkedRoot(signal))
      if (event) return freezeDeep(structuredClone(event))
      throw error
    }
    const event = committed(await this.checkedRoot(signal))
    assert(event, 'report view not confirmed')
    return freezeDeep(structuredClone(event))
  }
  /** History is read from one verified installation snapshot. An armed or
   * checkpoint-only attempt is review-only after reload, never resumable. */
  async listAttempts(signal?: AbortSignal): Promise<readonly ArmedAttempt[]> {
    const forms = await loadMouthForms()
    const root = await this.checkedRoot(signal)
    return freezeDeep(Object.values(root.attempts)
      .sort((a, b) => b.createdAtWallMs - a.createdAtWallMs || b.ordinal - a.ordinal)
      .map(attempt => this.hydrate(attempt, forms)))
  }
  /** Retirement and its tombstone commit together, so an older completion
   * callback cannot restore this session even if notification delivery fails. */
  async deleteAttempt(sessionId: string): Promise<void> {
    assert(safeId(sessionId), 'invalid deletion target')
    return orderMouthDeletion(signal => this.deleteAttemptOrdered(sessionId, signal))
  }
  private async deleteAttemptOrdered(sessionId: string, signal: AbortSignal | undefined): Promise<void> {
    const forms = await loadMouthForms()
    aborted(signal)
    try {
      await this.backend.change(root => {
        this.transactionRoot(root, forms)
        assert(root.revision < Number.MAX_SAFE_INTEGER, 'revision exhausted')
        if (root.tombstones[sessionId] !== undefined) return
        const attempt = root.attempts[sessionId]
        assert(attempt, 'deletion target unavailable')
        delete root.attempts[sessionId]
        if (root.activity) delete root.activity[sessionId]
        root.tombstones[sessionId] = { requestId: attempt.requestId, variant: attempt.variant,
          ordinal: attempt.ordinal, deletedAtWallMs: Date.now() }
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
  private observeReplacementRead(signal: AbortSignal | undefined): Promise<MouthRoot> {
    const provenance = this.authority.provenance('replacement')
    return withAbort(this.backend.read(signal).then(async root => {
      await inspectMouthRoot(root)
      this.authority.observe(root, provenance)
      return root
    }), signal)
  }
  /** Delete all creates a new installation. The returned store alone may
   * address it; callbacks holding this store retain the retired identity. */
  async deleteAll(): Promise<MouthStore> {
    return orderMouthDeletion(signal => this.deleteAllOrdered(signal))
  }
  private async deleteAllOrdered(signal: AbortSignal | undefined): Promise<MouthStore> {
    const replacement = freshMouthRoot()
    const forms = this.deletionOnly ? null : await loadMouthForms()
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
            if (!(error instanceof MouthIntegrityError) || this.authority.register().integrity !== 'blocked') throw error
          }
        }
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
  private adoptReplacement(root: MouthRoot): MouthStore {
    const replacement = new MouthStore(this.backend, root.installationId)
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
    return orderMouthSnapshot(orderedSignal =>
      this.saveSnapshotOrdered(arm, state, expectedRevision, orderedSignal, target), signal)
  }
  private async saveSnapshotOrdered(arm: ArmedAttempt, state: State, expectedRevision: number,
    signal: AbortSignal, target: MouthAuthorityHandle): Promise<PersistedSnapshot> {
    assert(safeId(arm.sessionId) && nonnegativeInteger(expectedRevision) &&
      expectedRevision < Number.MAX_SAFE_INTEGER, 'invalid snapshot request')
    arm = structuredClone(arm)
    state = structuredClone(state)
    const forms = await loadMouthForms()
    aborted(signal)
    const form = forms.get(state.form.id)
    assert(form && exact(form, state.form) && verifyHeadless({ ...state, form }) &&
      (state.phase === 'break' || state.phase === 'invalid' || state.phase === 'completed') &&
      exact(state.identity, arm.state.identity) && exact(state.profile, arm.profile), 'invalid snapshot state')
    const review = reconcileHeadless({ ...state, form })
    const desired: PersistedSnapshot = { revision: expectedRevision + 1,
      kind: state.phase === 'break' ? 'checkpoint' : 'terminal',
      closedTrials: state.events.filter(event => event.type === 'trial_closed').length,
      state, review }
    aborted(signal)
    const matches = (root: MouthRoot) => {
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
  private matching(root: MouthRoot, request: StartRequest) {
    const attempt = Object.values(root.attempts).find(item => item.requestId === request.requestId)
    if (!attempt) return null
    assert(attempt.sessionId === request.sessionId &&
      attempt.state.identity.clockDomainId === request.clockDomainId &&
      exact(attempt.state.profile, request.profile) &&
      attempt.variant === request.variant && exact(attempt.route, request.route) &&
      attempt.state.armedAtMs === request.atMs &&
      attempt.createdAtWallMs === request.wallMs, 'start request identity changed')
    assert(exact(attempt.armDisplayContext, request.displayContext), 'start display context changed')
    return attempt
  }
  async start(request: StartRequest, signal?: AbortSignal): Promise<ArmedAttempt> {
    assert(safeId(request.requestId) && safeId(request.sessionId) &&
      safeId(request.clockDomainId) && Number.isFinite(request.atMs) && request.atMs >= 0 &&
      (request.variant === 'standard' || request.variant === 'visual_accommodation') &&
      request.profile.variant === request.variant &&
      Number.isFinite(request.wallMs) && request.wallMs >= 0 &&
      validMouthDisplayContext(request.displayContext), 'invalid start request')
    // A caller cannot change the admitted profile or request identity while storage is pending.
    request = structuredClone(request)
    aborted(signal)
    const forms = await loadMouthForms()
    aborted(signal)
    try {
      await withAbort(this.backend.change(root => {
        this.transactionRoot(root, forms)
        // The transaction reads the authoritative root, not a prior tab snapshot.
        const prior = Object.values(root.attempts).find(item => item.requestId === request.requestId)
        if (prior) { this.matching(root, request); return }
        assert(!Object.values(root.tombstones).some(item => item.requestId === request.requestId),
          'start request was deleted')
        assert(root.version === MOUTH_STORAGE_VERSION &&
          nonnegativeInteger(root.counters[request.variant]) && root.counters[request.variant] < Number.MAX_SAFE_INTEGER &&
          root.revision < Number.MAX_SAFE_INTEGER && !root.attempts[request.sessionId] &&
          root.tombstones[request.sessionId] === undefined, 'start authority lost')
        const form = forms.get(FORM_IDS[request.variant][root.counters[request.variant] % 6])
        assert(form, 'form inventory unavailable')
        const state = armHeadless(form, { installationId: this.installationId,
          sessionId: request.sessionId, clockDomainId: request.clockDomainId,
          route: request.route }, request.profile, request.atMs)
        const ordinal = root.counters[request.variant] + 1
        root.attempts[request.sessionId] = { requestId: request.requestId, sessionId: request.sessionId,
          clockDomainId: request.clockDomainId, profile: request.profile,
          variant: request.variant, route: request.route, ordinal, createdAtWallMs: request.wallMs,
          armDisplayContext: request.displayContext, state }
        root.counters[request.variant] = ordinal
        root.revision++
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
    assert(retained && root.counters[retained.variant] >= retained.ordinal, 'start not confirmed')
    this.authority.handle(retained)
    return this.hydrate(retained, forms)
  }
}
