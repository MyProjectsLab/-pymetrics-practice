import { withNativeObservation } from '../mock/authority'
import type { NativeLossHandler } from '../mock/authority'
import { NativePresenceError, requireObservedNativeVersion } from '../mock/native-presence'
import { openNativeForMock, validateObservedNative } from '../mock/native-presence'
import { DIGITS_EVENT_VERSION, DIGITS_STORAGE_VERSION } from './contracts'
import type { Form, FormId, Identity, Mode, Profile, RunState } from './contracts'
import { armDigits, verifyDigitsRun } from './engine'
import { loadDigitsForms } from './forms'
import { openExistingNativeDatabase, readExistingNativeKey } from '../mock/native-presence'
import { scoreDigits } from './scoring'
import type { DigitsReview } from './scoring'

export const DIGITS_DATABASE = 'assessment-practice-digits-v11'
export const DIGITS_LIVE_LOCK = 'assessment-practice-digits-live-v1'
export const DIGITS_DATA_LOCK = 'assessment-practice-digits-data-v1'
const DIGITS_DELETION_CHANNEL = 'assessment-practice-digits-v11-deletion'
const FORM_IDS: Record<Mode, readonly FormId[]> = {
  visual: ['DV1', 'DV2', 'DV3', 'DV4', 'DV5', 'DV6'],
  auditory: ['DA1', 'DA2', 'DA3', 'DA4', 'DA5', 'DA6'],
}
export interface DigitsSnapshot {
  readonly revision: number
  readonly kind: 'checkpoint' | 'terminal'
  readonly state: RunState
  readonly review: DigitsReview
}
export interface DigitsAttempt {
  readonly requestId: string
  readonly sessionId: string
  readonly mode: Mode
  readonly ordinal: number
  readonly createdAtWallMs: number
  readonly arm: RunState
  readonly snapshot?: DigitsSnapshot
}
export interface DigitsActivity {
  readonly version: typeof DIGITS_EVENT_VERSION
  readonly type: 'report_viewed'
  readonly installationId: string
  readonly sessionId: string
  readonly viewId: string
  readonly sequenceNumber: number
  readonly sourceSurface: 'live' | 'history'
  readonly observedWallMs: number
  readonly resultRevision: number
}
export interface DigitsRoot {
  version: typeof DIGITS_STORAGE_VERSION
  installationId: string
  revision: number
  counters: Record<Mode, number>
  attempts: Record<string, DigitsAttempt>
  tombstones: Record<string, { requestId: string; mode: Mode; ordinal: number; deletedAtWallMs: number }>
  activity: Record<string, readonly DigitsActivity[]>
}
export type DeletionNotice = { type: 'attempt_deleted'; installationId: string; sessionId: string } |
  { type: 'installation_replaced'; installationId: string; replacementInstallationId: string }
export interface DigitsBackend {
  read(signal?: AbortSignal): Promise<DigitsRoot>
  change<T>(operation: (root: DigitsRoot) => T, signal?: AbortSignal): Promise<T>
  close?(): void
}
export interface ArmRequest {
  readonly requestId: string
  readonly sessionId: string
  readonly clockDomainId: string
  readonly profile: Profile
  readonly route: Identity['route']
  readonly atMs: number
  readonly wallMs: number
}
function assert(condition: unknown, reason: string): asserts condition {
  if (!condition) throw Error(`Digits storage: ${reason}`)
}
function exact(a: unknown, b: unknown) { return JSON.stringify(a) === JSON.stringify(b) }
function safeId(value: unknown): value is string { return typeof value === 'string' &&
  /^[A-Za-z0-9_-]{1,128}$/.test(value) && !Object.hasOwn(Object.prototype, value) }
function integer(value: unknown) { return Number.isSafeInteger(value) && (value as number) >= 0 }
function plain(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}
function notAborted(signal?: AbortSignal) { assert(!signal?.aborted, 'operation canceled') }
function abortable<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise
  if (signal.aborted) { void promise.catch(() => {}); return Promise.reject(Error('Digits operation canceled')) }
  return new Promise((resolve, reject) => {
    const abort = () => reject(Error('Digits operation canceled'))
    signal.addEventListener('abort', abort, { once: true })
    promise.then(value => { signal.removeEventListener('abort', abort); resolve(value) },
      error => { signal.removeEventListener('abort', abort); reject(error) })
  })
}
/** Shared with first-display admission, deletion, and saved-report publication. */
export async function withDigitsDataOrder<T>(work: () => Promise<T>): Promise<T> {
  assert(typeof navigator !== 'undefined' && 'locks' in navigator,
    'browser ownership unavailable')
  return navigator.locks.request(DIGITS_DATA_LOCK, { mode: 'exclusive' }, work)
}
export function freshDigitsRoot(): DigitsRoot {
  return { version: DIGITS_STORAGE_VERSION, installationId: crypto.randomUUID(),
    revision: 0, counters: { visual: 0, auditory: 0 },
    attempts: {}, tombstones: {}, activity: {} }
}
function canonicalState(raw: RunState, forms: ReadonlyMap<FormId, Form>): RunState {
  assert(raw && plain(raw) && raw.form && plain(raw.form), 'malformed state')
  const form = forms.get(raw.form.id)
  assert(form && exact(form, raw.form), 'manifest changed')
  const state = { ...raw, form }
  assert(verifyDigitsRun(state), 'journal changed')
  return state
}
function inspectRoot(root: DigitsRoot, forms: ReadonlyMap<FormId, Form>): void {
  assert(plain(root) && root.version === DIGITS_STORAGE_VERSION && safeId(root.installationId) &&
    integer(root.revision) && plain(root.counters) &&
    Object.keys(root.counters).toSorted().join('|') === 'auditory|visual' &&
    integer(root.counters.visual) && integer(root.counters.auditory) &&
    root.revision >= root.counters.visual + root.counters.auditory &&
    plain(root.attempts) && plain(root.tombstones) && plain(root.activity), 'unsupported root')
  const ordinals = new Set<string>(), requests = new Set<string>()
  for (const [sessionId, tombstone] of Object.entries(root.tombstones)) {
    assert(safeId(sessionId) && plain(tombstone) && safeId(tombstone.requestId) &&
      (tombstone.mode === 'visual' || tombstone.mode === 'auditory') &&
      integer(tombstone.ordinal) && tombstone.ordinal > 0 &&
      tombstone.ordinal <= root.counters[tombstone.mode] &&
      Number.isFinite(tombstone.deletedAtWallMs) && tombstone.deletedAtWallMs >= 0 &&
      !root.attempts[sessionId] && !root.activity[sessionId], 'bad tombstone')
    const key = `${tombstone.mode}:${tombstone.ordinal}`
    assert(!ordinals.has(key) && !requests.has(tombstone.requestId), 'duplicate retirement')
    ordinals.add(key); requests.add(tombstone.requestId)
  }
  for (const [sessionId, attempt] of Object.entries(root.attempts)) {
    assert(safeId(sessionId) && plain(attempt) && attempt.sessionId === sessionId &&
      safeId(attempt.requestId) &&
      (attempt.mode === 'visual' || attempt.mode === 'auditory') &&
      integer(attempt.ordinal) && attempt.ordinal > 0 &&
      attempt.ordinal <= root.counters[attempt.mode] &&
      Number.isFinite(attempt.createdAtWallMs) && attempt.createdAtWallMs >= 0 &&
      !root.tombstones[sessionId], 'bad attempt')
    const key = `${attempt.mode}:${attempt.ordinal}`
    assert(!ordinals.has(key) && !requests.has(attempt.requestId), 'duplicate arm')
    ordinals.add(key); requests.add(attempt.requestId)
    const arm = canonicalState(attempt.arm, forms)
    assert(arm.phase === 'armed' && arm.commands.length === 0 && arm.events.length === 3 &&
      arm.identity.installationId === root.installationId &&
      arm.identity.sessionId === sessionId && arm.identity.requestId === attempt.requestId &&
      arm.profile.mode === attempt.mode &&
      arm.form.id === FORM_IDS[attempt.mode][(attempt.ordinal - 1) % 6], 'arm identity')
    if (attempt.snapshot) {
      const snapshot = attempt.snapshot
      const state = canonicalState(snapshot.state, forms)
      assert(integer(snapshot.revision) && snapshot.revision > 0 && snapshot.revision <= root.revision &&
        (snapshot.kind === 'checkpoint' && state.phase === 'feedback' ||
          snapshot.kind === 'terminal' && (state.phase === 'completed' || state.phase === 'invalid')) &&
        exact(state.identity, arm.identity) && exact(state.profile, arm.profile) &&
        exact(state.events.slice(0, arm.events.length), arm.events) &&
        exact(scoreDigits(state), snapshot.review), 'snapshot mismatch')
    }
    const activity = root.activity[sessionId]
    if (activity !== undefined) {
      assert(Array.isArray(activity) && !!attempt.snapshot, 'activity target')
      const seen = new Set<string>()
      activity.forEach((entry, index) => {
        assert(plain(entry) && entry.version === DIGITS_EVENT_VERSION &&
          entry.type === 'report_viewed' && entry.installationId === root.installationId &&
          entry.sessionId === sessionId && safeId(entry.viewId) && !seen.has(entry.viewId) &&
          entry.sequenceNumber === index + 1 &&
          (entry.sourceSurface === 'live' || entry.sourceSurface === 'history') &&
          typeof entry.observedWallMs === 'number' &&
          Number.isFinite(entry.observedWallMs) && entry.observedWallMs >= 0 &&
          typeof entry.resultRevision === 'number' && integer(entry.resultRevision) && entry.resultRevision > 0 &&
          entry.resultRevision <= attempt.snapshot!.revision, 'activity integrity')
        seen.add(entry.viewId)
      })
    }
  }
  assert(Object.keys(root.activity).every(sessionId => !!root.attempts[sessionId]), 'orphan activity')
}

class IndexedDigitsBackend implements DigitsBackend {
  private readonly database: IDBDatabase
  constructor(database: IDBDatabase) { this.database = database }
  close() { this.database.close() }
  private transaction<T>(mode: IDBTransactionMode, operation: (root: DigitsRoot) => T,
    signal?: AbortSignal): Promise<T> {
    notAborted(signal)
    return new Promise((resolve, reject) => {
      const transaction = this.database.transaction('installation', mode)
      let result: T, settled = false
      const fail = (error: unknown) => { if (!settled) { settled = true; reject(error) } }
      const abort = () => { try { transaction.abort() } catch { /* settled */ } }
      signal?.addEventListener('abort', abort, { once: true })
      const get = transaction.objectStore('installation').get('root')
      get.onsuccess = () => {
        try {
          assert(get.result, 'root unavailable')
          const root = get.result as DigitsRoot
          result = operation(root)
          if (mode === 'readwrite') transaction.objectStore('installation').put(root, 'root')
        } catch (error) { fail(error); abort() }
      }
      get.onerror = () => fail(get.error ?? Error('Digits read failed'))
      transaction.oncomplete = () => {
        signal?.removeEventListener('abort', abort)
        if (!settled) { settled = true; resolve(structuredClone(result)) }
      }
      transaction.onerror = () => fail(transaction.error ?? Error('Digits transaction failed'))
      transaction.onabort = () => fail(transaction.error ?? Error('Digits transaction aborted'))
    })
  }
  read(signal?: AbortSignal) { return this.transaction('readonly', root => root, signal) }
  change<T>(operation: (root: DigitsRoot) => T, signal?: AbortSignal) {
    return abortable(this.transaction('readwrite', operation, signal), signal)
  }
}

export class DigitsStore {
  private readonly listeners = new Set<(notice: DeletionNotice) => void>()
  private channel: BroadcastChannel | null = null
  private readonly sender = crypto.randomUUID()
  private latestRoot: DigitsRoot | null = null
  private retired = false
  readonly backend: DigitsBackend
  readonly installationId: string
  private readonly forms: ReadonlyMap<FormId, Form>
  constructor(backend: DigitsBackend, installationId: string,
    forms: ReadonlyMap<FormId, Form>) {
    this.backend = backend; this.installationId = installationId; this.forms = forms
  }
  static async open(): Promise<DigitsStore> {
    const forms = await loadDigitsForms()
    assert(typeof indexedDB !== 'undefined', 'IndexedDB unavailable')
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DIGITS_DATABASE, 1)
      request.onupgradeneeded = event => {
        if (event.oldVersion !== 0) { request.transaction?.abort(); return }
        request.result.createObjectStore('installation').put(freshDigitsRoot(), 'root')
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? Error('Digits database unavailable'))
      request.onblocked = () => reject(Error('Digits database blocked'))
    })
    const backend = new IndexedDigitsBackend(database)
    try {
      const root = await backend.read()
      inspectRoot(root, forms)
      return new DigitsStore(backend, root.installationId, forms)
    } catch (error) { backend.close(); throw error }
  }
  static openForMock(parent?:AbortSignal,allowCreate=true){return openNativeForMock(DIGITS_DATABASE,1,db=>{db.createObjectStore('installation').put(freshDigitsRoot(),'root')},signal=>this.openRetained(signal),parent,allowCreate)}
  static async openRetained(signal: AbortSignal): Promise<DigitsStore> {
    const database = await openExistingNativeDatabase(DIGITS_DATABASE, signal)
    const backend = new IndexedDigitsBackend(database)
    try {if(database.version!==1)throw new NativePresenceError('unsupported','Native source database version is unsupported');
      const forms = await loadDigitsForms()
      const root = await readExistingNativeKey(database, 'installation', 'root', signal) as DigitsRoot
      signal.throwIfAborted(); requireObservedNativeVersion(root,'version',[DIGITS_STORAGE_VERSION]); validateObservedNative(()=>inspectRoot(root, forms))
      return new DigitsStore(backend, root.installationId, forms)
    } catch (error) { backend.close(); throw error }
  }
  close() { this.channel?.close(); this.backend.close?.() }
  subscribeDeletion(listener: (notice: DeletionNotice) => void): () => void {
    this.listeners.add(listener)
    if (!this.channel && typeof BroadcastChannel !== 'undefined') {
      try {
        this.channel = new BroadcastChannel(DIGITS_DELETION_CHANNEL)
        this.channel.onmessage = event => {
          const data = event.data as { sender?: string; notice?: DeletionNotice } | null
          if (!data || data.sender === this.sender || !data.notice ||
            data.notice.installationId !== this.installationId) return
          for (const callback of this.listeners) callback(data.notice)
        }
      } catch { /* Current storage still determines authority. */ }
    }
    return () => { this.listeners.delete(listener); if (!this.listeners.size) {
      this.channel?.close(); this.channel = null
    } }
  }
  private notify(notice: DeletionNotice) {
    for (const callback of this.listeners) { try { callback(notice) } catch { /* observer */ } }
    try { const channel = new BroadcastChannel(DIGITS_DELETION_CHANNEL)
      channel.postMessage({ sender: this.sender, notice }); channel.close() }
    catch { /* Notification is advisory. */ }
  }
  private checked(root: DigitsRoot) {
    inspectRoot(root, this.forms)
    if (root.installationId !== this.installationId) this.retired = true
    assert(!this.retired, 'installation replaced')
    const prior = this.latestRoot
    if (prior) {
      if (root.revision < prior.revision) return structuredClone(prior)
      if (root.revision === prior.revision) {
        assert(exact(root, prior), 'conflicting root at one revision')
        return root
      }
      assert(root.counters.visual >= prior.counters.visual &&
        root.counters.auditory >= prior.counters.auditory, 'counter rewound')
      for (const [id, marker] of Object.entries(prior.tombstones))
        assert(exact(root.tombstones[id], marker), 'tombstone removed')
      for (const [id, attempt] of Object.entries(prior.attempts)) {
        const current = root.attempts[id]
        if (!current) { assert(root.tombstones[id]?.requestId === attempt.requestId,
          'attempt removed without tombstone'); continue }
        assert(exact(current.arm, attempt.arm) &&
          (!attempt.snapshot || current.snapshot &&
            current.snapshot.revision >= attempt.snapshot.revision &&
            exact(current.snapshot.state.events.slice(0, attempt.snapshot.state.events.length),
              attempt.snapshot.state.events) &&
            exact(current.snapshot.state.commands.slice(0, attempt.snapshot.state.commands.length),
              attempt.snapshot.state.commands)), 'attempt rewound')
        const oldEvents = prior.activity[id] ?? [], newEvents = root.activity[id] ?? []
        assert(exact(newEvents.slice(0, oldEvents.length), oldEvents), 'activity rewound')
      }
    }
    this.latestRoot = structuredClone(root)
    return root
  }
  async read(signal?: AbortSignal): Promise<DigitsRoot> {
    const root = this.checked(await this.backend.read(signal))
    notAborted(signal)
    return root
  }
  private async change<T>(operation: (root: DigitsRoot) => T, signal?: AbortSignal): Promise<T> {
    notAborted(signal)
    return this.backend.change(root => {
      assert(this.checked(root) === root, 'stale write root')
      const value = operation(root)
      inspectRoot(root, this.forms)
      return value
    }, signal)
  }
  private hydrate(attempt: DigitsAttempt): DigitsAttempt {
    return { ...attempt, arm: canonicalState(attempt.arm, this.forms),
      ...(attempt.snapshot ? { snapshot: { ...attempt.snapshot,
        state: canonicalState(attempt.snapshot.state, this.forms) } } : {}) }
  }
  async list(): Promise<readonly DigitsAttempt[]> {
    const root = await this.read()
    return Object.values(root.attempts)
      .sort((a, b) => b.createdAtWallMs - a.createdAtWallMs || b.ordinal - a.ordinal)
      .map(attempt => this.hydrate(attempt))
  }
  async load(sessionId: string, signal?: AbortSignal): Promise<DigitsAttempt | null> {
    assert(safeId(sessionId), 'bad session ID')
    const attempt = (await this.read(signal)).attempts[sessionId]
    return attempt ? this.hydrate(attempt) : null
  }
  /** A retried request ID returns the original arm; the counter is never advanced twice. */
  async arm(request: ArmRequest, signal?: AbortSignal): Promise<DigitsAttempt> {
    assert(safeId(request.requestId) && safeId(request.sessionId) &&
      safeId(request.clockDomainId) && Number.isFinite(request.atMs) && request.atMs >= 0 &&
      Number.isFinite(request.wallMs) && request.wallMs >= 0, 'bad arm request')
    const wanted = structuredClone(request)
    const matching = (root: DigitsRoot) => {
      const retained = Object.values(root.attempts).find(item => item.requestId === wanted.requestId)
      if (!retained) return null
      assert(retained.sessionId === wanted.sessionId && retained.mode === wanted.profile.mode &&
        exact(retained.arm.profile, wanted.profile) &&
        retained.arm.identity.clockDomainId === wanted.clockDomainId &&
        exact(retained.arm.identity.route, wanted.route), 'request ID conflict')
      return retained
    }
    try {
      await this.change(root => {
        if (matching(root)) return
        assert(!root.attempts[wanted.sessionId] && !root.tombstones[wanted.sessionId],
          'session ID reused')
        const mode = wanted.profile.mode
        const ordinal = root.counters[mode] + 1
        assert(Number.isSafeInteger(ordinal) && root.revision < Number.MAX_SAFE_INTEGER,
          'counter exhausted')
        const formId = FORM_IDS[mode][(ordinal - 1) % 6]
        const form = this.forms.get(formId)!
        const identity: Identity = { installationId: this.installationId,
          sessionId: wanted.sessionId, requestId: wanted.requestId,
          clockDomainId: wanted.clockDomainId, route: wanted.route }
        const arm = armDigits(form, identity, wanted.profile, wanted.atMs)
        root.attempts[wanted.sessionId] = { requestId: wanted.requestId,
          sessionId: wanted.sessionId, mode, ordinal,
          createdAtWallMs: wanted.wallMs, arm }
        root.counters[mode] = ordinal; root.revision++
      }, signal)
    } catch (error) {
      notAborted(signal)
      try { if (!matching(await this.read(signal))) throw error }
      catch { throw error }
    }
    const root = await this.read(signal)
    const attempt = matching(root)
    assert(attempt, 'arm not confirmed')
    return this.hydrate(attempt)
  }
  /** The first verified snapshot wins its revision; retrying identical bytes is idempotent. */
  async save(arm: DigitsAttempt, state: RunState, signal?: AbortSignal): Promise<DigitsSnapshot> {
    const frozenArm = structuredClone(arm), frozenState = structuredClone(state)
    const candidate = canonicalState(frozenState, this.forms)
    assert(candidate.phase === 'feedback' || candidate.phase === 'invalid' || candidate.phase === 'completed',
      'save phase')
    const kind = candidate.phase === 'feedback' ? 'checkpoint' : 'terminal'
    const review = scoreDigits(candidate)
    const matching = (root: DigitsRoot) => {
      const retained = root.attempts[frozenArm.sessionId]
      assert(retained && !root.tombstones[frozenArm.sessionId] &&
        retained.requestId === frozenArm.requestId && retained.ordinal === frozenArm.ordinal &&
        exact(retained.arm, frozenArm.arm) &&
        exact(candidate.identity, retained.arm.identity) &&
        exact(candidate.profile, retained.arm.profile) &&
        exact(candidate.events.slice(0, retained.arm.events.length), retained.arm.events),
      'save authority changed')
      if (retained.snapshot) {
        if (exact(retained.snapshot.state, frozenState) &&
          exact(retained.snapshot.review, review) && retained.snapshot.kind === kind)
          return retained.snapshot
        const prior = retained.snapshot.state
        assert(retained.snapshot.kind === 'checkpoint' &&
          candidate.commands.length > prior.commands.length &&
          exact(candidate.commands.slice(0, prior.commands.length), prior.commands) &&
          exact(candidate.events.slice(0, prior.events.length), prior.events) &&
          candidate.closed.length >= prior.closed.length &&
          exact(candidate.closed.slice(0, prior.closed.length), prior.closed),
        'snapshot prefix changed')
      }
      return null
    }
    try {
      await this.change(root => {
        if (matching(root)) return
        assert(root.revision < Number.MAX_SAFE_INTEGER, 'revision exhausted')
        root.attempts[frozenArm.sessionId] = { ...root.attempts[frozenArm.sessionId],
          snapshot: { revision: root.revision + 1, kind, state: frozenState, review } }
        root.revision++
      }, signal)
    } catch (error) {
      notAborted(signal)
      try { if (!matching(await this.read(signal))) throw error }
      catch { throw error }
    }
    const snapshot = matching(await this.read(signal))
    assert(snapshot, 'save not confirmed')
    return { ...snapshot, state: canonicalState(snapshot.state, this.forms) }
  }
  async appendReportView(sessionId: string, viewId: string,
    sourceSurface: 'live' | 'history', observedWallMs: number): Promise<DigitsActivity> {
    assert(safeId(sessionId) && safeId(viewId) && Number.isFinite(observedWallMs) &&
      observedWallMs >= 0, 'bad report view')
    const matching = (root: DigitsRoot) => {
      const attempt = root.attempts[sessionId]
      assert(attempt?.snapshot && !root.tombstones[sessionId],
        'result deleted or unavailable')
      return root.activity[sessionId]?.find(item => item.viewId === viewId)
    }
    try {
      await this.change(root => {
        if (matching(root)) return
        const snapshot = root.attempts[sessionId].snapshot!
        const prior = root.activity[sessionId] ?? []
        assert(root.revision < Number.MAX_SAFE_INTEGER, 'revision exhausted')
        root.activity[sessionId] = [...prior, { version: DIGITS_EVENT_VERSION,
          type: 'report_viewed', installationId: this.installationId, sessionId,
          viewId, sequenceNumber: prior.length + 1, sourceSurface,
          observedWallMs, resultRevision: snapshot.revision }]
        root.revision++
      })
    } catch (error) { try { if (!matching(await this.read())) throw error } catch { throw error } }
    const event = matching(await this.read())
    assert(event, 'report view not confirmed')
    return event
  }
  async deleteAttempt(sessionId: string): Promise<void> {
    assert(safeId(sessionId), 'bad deletion ID')
    return withDigitsDataOrder(() => this.deleteAttemptOrdered(sessionId))
  }
  private async deleteAttemptOrdered(sessionId: string): Promise<void> {
    try {
      await this.change(root => {
        if (root.tombstones[sessionId]) return
        const attempt = root.attempts[sessionId]
        assert(attempt, 'result unavailable')
        delete root.attempts[sessionId]; delete root.activity[sessionId]
        root.tombstones[sessionId] = { requestId: attempt.requestId,
          mode: attempt.mode, ordinal: attempt.ordinal, deletedAtWallMs: Date.now() }
        root.revision++
      })
    } catch (error) {
      try { if (!(await this.read()).tombstones[sessionId]) throw error }
      catch { throw error }
    }
    const root = await this.read()
    assert(root.tombstones[sessionId] && !root.attempts[sessionId], 'deletion unconfirmed')
    this.notify({ type: 'attempt_deleted', installationId: this.installationId, sessionId })
  }
  /** A replacement store is the only handle permitted to write into the new installation. */
  async deleteAll(): Promise<DigitsStore> {
    return withDigitsDataOrder(() => this.deleteAllOrdered())
  }
  private async deleteAllOrdered(): Promise<DigitsStore> {
    const replacement = freshDigitsRoot()
    try {
      await this.backend.change(root => {
        assert(root.installationId === this.installationId, 'installation replaced')
        Object.assign(root, replacement)
      })
    } catch (error) {
      const root = await this.backend.read()
      if (root.installationId !== replacement.installationId) throw error
    }
    const root = await this.backend.read()
    inspectRoot(root, this.forms)
    assert(root.installationId === replacement.installationId, 'replacement unconfirmed')
    this.notify({ type: 'installation_replaced', installationId: this.installationId,
      replacementInstallationId: replacement.installationId })
    this.retired = true
    return new DigitsStore(this.backend, replacement.installationId, this.forms)
  }
}

/** Mock observation only; ordinary native writers keep their existing order. */
export function withDigitsMockOrder<T>(work:(signal:AbortSignal)=>Promise<T>,parent:AbortSignal,loss?:NativeLossHandler<T>):Promise<T>{return withNativeObservation(DIGITS_DATA_LOCK,work,parent,loss)}
