import { withNativeObservation } from '../mock/authority'
import type { NativeLossHandler } from '../mock/authority'
import { NativePresenceError, requireObservedNativeVersion } from '../mock/native-presence'
import { openNativeForMock, validateObservedNative } from '../mock/native-presence'
import { admitRetest, closeRetest, reserveRetest } from './retest'
import type { EventTime, FormId } from './contracts'
import { advance, createRecord, DURABLE_VERSION, mappingFor, reconcileDurable, recordFingerprint, requireIntegrity } from './durable'
import type { Command, DurableRecord, Exposure, Settings } from './durable'
import type { TrainingData } from './training-storage'
import { loadDrillManifests } from './drill-manifests'
import { loadScoredManifests } from './manifests'
import { openExistingNativeDatabase, readExistingNativeKey } from '../mock/native-presence'

export const DATABASE = 'assessment-practice-balloons-v1'
const GATE = `${DATABASE}:mutation`
const OWNER = `${DATABASE}:owner`
export interface Tombstone { sessionId: string; chainId: string | null; formId: FormId; exposure: Exposure; deletedAtMs: number }
export interface Root {
  version: typeof DURABLE_VERSION
  installationId: string
  revision: number
  generation: number
  owner: { id: string; sessionId: string; generation: number } | null
  records: Record<string, DurableRecord>
  tombstones: Record<string, Tombstone>
  training?: TrainingData
}
export interface Backend {
  read(): Promise<Root>
  change<T>(operation: (root: Root) => T, signal?: AbortSignal): Promise<T>
}
/** Only a delivered transaction abort proves that this write did not commit. */
export class WriteFailure extends Error {}
/** The operation may have committed; callers must reconcile durable authority. */
export class DeliveryUncertain extends Error {}
export function freshRoot(): Root { return { version: DURABLE_VERSION, installationId: crypto.randomUUID(), revision: 0, generation: 0, owner: null, records: {}, tombstones: {} } }
export function inspectRoot(root: Root) {
  requireIntegrity(root.version === DURABLE_VERSION && !!root.installationId && Number.isSafeInteger(root.revision) && Number.isSafeInteger(root.generation), 'unsupported installation')
  for (const [id, record] of Object.entries(root.records)) {
    requireIntegrity(id === record.header.identity.sessionId && record.header.identity.installationId === root.installationId && !root.tombstones[id], 'record installation/deletion mismatch')
    reconcileDurable(record)
  }
  for (const [id, t] of Object.entries(root.tombstones)) requireIntegrity(id === t.sessionId && /^(BL|RP|RT)[123]$/.test(t.formId) && ['pending_exposure', 'exposure_uncertain', 'form_exposed', 'released_unseen'].includes(t.exposure), 'invalid exposure tombstone')
}
class IndexedBackend implements Backend {
  private db: IDBDatabase
  constructor(db: IDBDatabase) { this.db = db }
  close() { this.db.close() }
  read(): Promise<Root> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('installation', 'readonly'), request = tx.objectStore('installation').get('root')
      tx.oncomplete = () => { if (request.result) resolve(request.result as Root); else reject(new Error('Missing Balloons installation')) }
      tx.onerror = tx.onabort = () => reject(tx.error ?? new Error('Balloons read failed'))
    })
  }
  change<T>(operation: (root: Root) => T, signal?: AbortSignal): Promise<T> {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) { reject(new DOMException('Canceled', 'AbortError')); return }
      const tx = this.db.transaction('installation', 'readwrite'), store = tx.objectStore('installation')
      let output: T, error: unknown
      const abort = () => { try { tx.abort() } catch { /* Already committed; caller still fences delivery. */ } }
      signal?.addEventListener('abort', abort, { once: true })
      const request = store.get('root')
      request.onsuccess = () => {
        try {
          const root = request.result as Root
          requireIntegrity(root, 'missing installation')
          output = operation(root)
          root.revision++
          store.put(root, 'root')
        } catch (e) { error = e; abort() }
      }
      tx.oncomplete = () => { signal?.removeEventListener('abort', abort); resolve(output) }
      tx.onabort = () => { signal?.removeEventListener('abort', abort); reject(new WriteFailure(error instanceof Error ? error.message : tx.error?.message ?? 'Balloons write failed')) }
    })
  }
}
export interface OwnerToken { id: string; sessionId: string; generation: number }
export type OwnerRelease = () => Promise<void>
const liveOwnerProofs = new WeakSet<OwnerRelease>()
export class BalloonsStore {
  readonly backend: Backend
  readonly installationId: string
  private ownerScopes = new Map<string, OwnerRelease>()
  /** Bind only while the caller holds the installation browser owner lock. */
  bindOwner(id: string, release: OwnerRelease): () => void {
    requireIntegrity(liveOwnerProofs.has(release), 'browser ownership proof required')
    this.ownerScopes.set(id, release)
    return () => { if (this.ownerScopes.get(id) === release) this.ownerScopes.delete(id) }
  }
  private liveOwner(id: string) { const release = this.ownerScopes.get(id); requireIntegrity(release && liveOwnerProofs.has(release), 'retest browser ownership released') }
  constructor(backend: Backend, installationId: string) { this.backend = backend; this.installationId = installationId }
  static async open(): Promise<BalloonsStore> {
    requireIntegrity(typeof indexedDB !== 'undefined' && !!navigator.locks, 'local storage and ownership support required')
    await loadScoredManifests()
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DATABASE, 1)
      request.onupgradeneeded = () => request.result.createObjectStore('installation').put(freshRoot(), 'root')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
      request.onblocked = () => reject(new Error('Storage is busy in another tab'))
    })
    const backend = new IndexedBackend(db), root = await backend.read()
    if (root.training) await loadDrillManifests()
    inspectRoot(root)
    return new BalloonsStore(backend, root.installationId)
  }
  static openForMock(parent?:AbortSignal,allowCreate=true){return openNativeForMock(DATABASE,1,db=>{db.createObjectStore('installation').put(freshRoot(),'root')},signal=>this.openRetained(signal),parent,allowCreate)}
  static async openRetained(signal: AbortSignal): Promise<BalloonsStore> {
    const db = await openExistingNativeDatabase(DATABASE, signal)
    const backend = new IndexedBackend(db)
    try {if(db.version!==1)throw new NativePresenceError('unsupported','Native source database version is unsupported');
      const root = await readExistingNativeKey(db, 'installation', 'root', signal) as Root
      signal.throwIfAborted()
      await loadScoredManifests()
      requireObservedNativeVersion(root,'version',[DURABLE_VERSION]); validateObservedNative(()=>requireIntegrity(!!root && typeof root === 'object', 'unsupported installation'))
      if (root.training) await loadDrillManifests()
      validateObservedNative(()=>inspectRoot(root))
      return new BalloonsStore(backend, root.installationId)
    } catch (error) { backend.close(); throw error }
  }
  close() { if (this.backend instanceof IndexedBackend) this.backend.close() }
  async read(): Promise<Root> {
    const root = await this.backend.read()
    this.authority(root); inspectRoot(root)
    return root
  }
  private authority(root: Root) { requireIntegrity(root.version === DURABLE_VERSION && root.installationId === this.installationId, 'installation replaced') }
  private owned(root: Root, token: OwnerToken, expected?: DurableRecord, cleanup = false, live = true): DurableRecord {
    this.authority(root)
    requireIntegrity(root.owner?.id === token.id && root.owner.sessionId === token.sessionId && root.owner.generation === token.generation && root.generation === token.generation, 'ownership lost')
    const record = root.records[token.sessionId]
    requireIntegrity(record && !root.tombstones[token.sessionId], 'session deleted')
    reconcileDurable(record)
    if (record.header.retest && !cleanup && live) this.liveOwner(token.id)
    // Cleanup may stop play, but deletion and a replaced chain remain authoritative.
    admitRetest(root, record)
    if (expected) requireIntegrity(recordFingerprint(record) === recordFingerprint(expected), 'stale record revision')
    return record
  }
  async assign(ownerId: string, mode: 'auto' | 'replay' | 'new_baseline', settings: Settings, device: string, time: EventTime, signal?: AbortSignal, mockSessionId?: string): Promise<{ record: DurableRecord; token: OwnerToken }> {
    return this.backend.change(root => {
      this.authority(root); inspectRoot(root)
      if (mockSessionId) {
        requireIntegrity(mode === 'replay' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(mockSessionId), 'invalid mock assignment identity')
        const existing = root.records[mockSessionId]
        requireIntegrity(!root.tombstones[mockSessionId], 'mock assignment deleted')
        if (existing) {
          requireIntegrity(existing.header.identity.stage === 'mock' && existing.header.settings.reducedMotion === settings.reducedMotion &&
            existing.header.settings.verbose === settings.verbose && existing.header.device === device,
          'conflicting mock assignment replay')
          return { record: existing, token: { id: ownerId, sessionId: mockSessionId, generation: existing.snapshot.ownershipGeneration } }
        }
      }
      const retained = [...Object.values(root.records).map(r => ({ formId: r.header.formId, exposure: r.snapshot.exposure })), ...Object.values(root.tombstones)]
      const anyBL = retained.some(r => r.formId.startsWith('BL') && r.exposure !== 'released_unseen')
      const family = mode === 'new_baseline' || (mode === 'auto' && !anyBL) ? 'BL' : 'RP'
      const ids = [1, 2, 3].map(n => `${family}${n}` as FormId)
      const unused = ids.find(id => !retained.some(r => r.formId === id && r.exposure !== 'released_unseen'))
      const repeat = !unused
      requireIntegrity(unused || family === 'RP', 'no unseen baseline remains')
      // Only consumed forms can be repeats; pending reservations are not repeat inventory.
      const formId = unused ?? ids.find(id => retained.some(r => r.formId === id && ['exposure_uncertain', 'form_exposed'].includes(r.exposure)) && !Object.values(root.records).some(r => r.header.formId === id && !['completed', 'released', 'paused'].includes(r.snapshot.phase)))
      requireIntegrity(formId, 'no replay form is available')
      const sessionId = mockSessionId ?? crypto.randomUUID(), generation = ++root.generation
      const token = { id: ownerId, sessionId, generation }
      const record = createRecord({ version: DURABLE_VERSION, formId, repeat, settings: structuredClone(settings), device,
        created: time, identity: { installationId: root.installationId, sessionId, chainId: family === 'BL' ? crypto.randomUUID() : null,
          stage: mockSessionId ? 'mock' : family === 'BL' ? 'baseline' : 'replay', mapping: mappingFor(formId), ownershipGeneration: generation, exposureGeneration: generation } })
      root.owner = token; root.records[sessionId] = record
      return { token, record }
    }, signal)
  }
  async reserveRetest(ownerId: string, baselineSessionId: string, time: EventTime, device: string, freshAttempt = false, signal?: AbortSignal) {
    return this.backend.change(root => {
      this.authority(root); inspectRoot(root)
      this.liveOwner(ownerId)
      return reserveRetest(root, ownerId, baselineSessionId, time, device, freshAttempt)
    }, signal)
  }
  async recover(ownerId: string, sessionId: string, time: EventTime, signal?: AbortSignal) {
    return this.backend.change(root => {
      this.authority(root); inspectRoot(root)
      const existing = root.records[sessionId]
      requireIntegrity(existing && !root.tombstones[sessionId], 'session missing or deleted')
      requireIntegrity(existing.header.identity.stage !== 'mock', 'mock play cannot resume')
      if (existing.header.retest) this.liveOwner(ownerId)
      admitRetest(root, existing)
      requireIntegrity(!existing.header.retest || existing.snapshot.exposure !== 'pending_exposure', 'Reopen the retest explanation to reserve this sequence')
      const generation = ++root.generation, token = { id: ownerId, sessionId, generation }
      const record = advance(existing, { kind: 'recover', reason: 'checkpoint_required_v1' }, time, generation)
      root.owner = token; root.records[sessionId] = record
      return { token, record }
    }, signal)
  }
  /** Retire an orphaned mock without restarting play or changing its core record. */
  async settleMock(sessionId: string, time: EventTime, signal?: AbortSignal) {
    return this.backend.change(root => {
      this.authority(root); inspectRoot(root)
      const record = root.records[sessionId]
      requireIntegrity(record && !root.tombstones[sessionId] && record.header.identity.stage === 'mock', 'mock session missing')
      if (['completed', 'paused', 'released'].includes(record.snapshot.phase)) return record
      const next = advance(record, { kind: 'pause', reason: 'interrupted' }, time, record.snapshot.ownershipGeneration)
      root.records[sessionId] = next
      if (root.owner?.sessionId === sessionId) { root.owner = null; root.generation++ }
      return next
    }, signal)
  }
  async commit(token: OwnerToken, expected: DurableRecord, command: Command, time: EventTime, signal?: AbortSignal) {
    return this.backend.change(root => {
      const current = this.owned(root, token, expected, command.kind === 'pause' || command.kind === 'release')
      const next = advance(current, command, time, token.generation)
      root.records[token.sessionId] = next
      closeRetest(root, next)
      return next
    }, signal)
  }
  /** Cleanup may retain positive onset evidence after the browser capability was
   * revoked. It cannot enable play, close a chain, or mutate a successor owner. */
  async retainRetestOnset(token: OwnerToken, expected: DurableRecord, time: EventTime, signal?: AbortSignal) {
    return this.backend.change(root => {
      const current = this.owned(root, token, expected, false, false)
      requireIntegrity(current.header.retest && current.snapshot.phase === 'presentation_armed', 'no retest onset to retain')
      const next = advance(current, { kind: 'confirm' }, time, token.generation)
      root.records[token.sessionId] = next
      return next
    }, signal)
  }
  async verify(token: OwnerToken, expected: DurableRecord) { const root = await this.backend.read(); this.owned(root, token, expected, false, expected.snapshot.phase !== 'completed'); return root }
  reconcileCurrent(root: Root, token: OwnerToken, prior: DurableRecord): DurableRecord {
    const record = this.owned(root, token, undefined, false, false)
    requireIntegrity(JSON.stringify(record.header) === JSON.stringify(prior.header) &&
      JSON.stringify(record.journal.slice(0, prior.journal.length)) === JSON.stringify(prior.journal), 'saved journal prefix changed')
    return record
  }
  async viewReport(sessionId: string, time: EventTime, signal?: AbortSignal) {
    return this.backend.change(root => {
      this.authority(root)
      const record = root.records[sessionId]
      requireIntegrity(record && !root.tombstones[sessionId], 'report deleted')
      reconcileDurable(record)
      const next = advance(record, { kind: 'report' }, time)
      root.records[sessionId] = next
      return next
    }, signal)
  }
  async delete(sessionId: string, wallTimeMs: number, signal?: AbortSignal) {
    return this.backend.change(root => {
      this.authority(root)
      const r = root.records[sessionId]
      if (!r) return
      root.tombstones[sessionId] = { sessionId, chainId: r.header.identity.chainId, formId: r.header.formId, exposure: r.header.retest && r.snapshot.exposure === 'pending_exposure' ? 'released_unseen' : r.snapshot.exposure, deletedAtMs: wallTimeMs }
      delete root.records[sessionId]
      if (root.owner?.sessionId === sessionId) { root.owner = null; root.generation++ }
    }, signal)
  }
  async deleteAll(signal?: AbortSignal) {
    return this.backend.change(root => { this.authority(root); for (const key of Object.keys(root)) delete (root as unknown as Record<string, unknown>)[key]; Object.assign(root, freshRoot()) }, signal)
  }
}
/** Delivery watchdog, not a gameplay timer or form-expiry rule. */
export const MUTATION_DELIVERY_LIMIT_MS = 2000
/** Keep mount/confirmation ordered against deletion, but bound every acquired gate.
 * Abort the transaction AND fence continuations before releasing the lock. A commit
 * may already have happened: callers must recover durable bytes, never retry it. */
export function withMutationGate<T>(work: (signal: AbortSignal) => Promise<T>, signal?: AbortSignal): Promise<T> {
  return navigator.locks.request(GATE, { signal }, () => {
    const scope = new AbortController()
    return new Promise<T>((resolve, reject) => {
      const abort = () => { scope.abort(); reject(new DOMException('Canceled', 'AbortError')) }
      const timer = window.setTimeout(() => {
        scope.abort()
        reject(new DeliveryUncertain('Local save delivery could not be confirmed. Check the saved session before continuing.'))
      }, MUTATION_DELIVERY_LIMIT_MS)
      const clear = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort) }
      signal?.addEventListener('abort', abort, { once: true })
      if (signal?.aborted) { abort(); clear(); return }
      scope.signal.addEventListener('abort', clear, { once: true })
      void work(scope.signal).then(resolve, reject).finally(clear)
    })
  })
}
export async function acquireOwner(signal: AbortSignal): Promise<OwnerRelease> {
  let settled!: () => void
  const unlocked = new Promise<void>(resolve => { settled = resolve })
  return new Promise((resolve, reject) => {
    void navigator.locks.request(OWNER, { ifAvailable: true }, async lock => {
      if (!lock) { reject(new Error('Balloons is active in another tab. Pause or leave that session first.')); return }
      await new Promise<void>(release => {
        const stop: OwnerRelease = () => { signal.removeEventListener('abort', stop); liveOwnerProofs.delete(stop); release(); return unlocked }
        liveOwnerProofs.add(stop)
        signal.addEventListener('abort', stop, { once: true }); resolve(stop)
        if (signal.aborted) stop()
      })
    }).then(settled, error => { settled(); reject(error) })
  })
}

/** Mock observation only; ordinary native writers keep their existing order. */
export function withBalloonsMockOrder<T>(work:(signal:AbortSignal)=>Promise<T>,parent:AbortSignal,loss?:NativeLossHandler<T>):Promise<T>{return withNativeObservation(GATE,work,parent,loss)}
