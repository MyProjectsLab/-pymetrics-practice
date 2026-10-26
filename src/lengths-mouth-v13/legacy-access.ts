import { MouthStore as V12Store, MOUTH_DATABASE as V12_DB, inspectMouthRoot as inspectV12 } from '../lengths-mouth-v12/storage'
import type { MouthRoot as V12Root } from '../lengths-mouth-v12/storage'
import { MouthStore as V11Store, MOUTH_DATABASE as V11_DB, inspectMouthRoot as inspectV11 } from '../lengths-mouth/storage'
import type { MouthRoot as V11Root } from '../lengths-mouth/storage'
import { LengthsStore as BarStore, LENGTHS_DATABASE as BAR_DB, inspectLengthsRoot as inspectBar } from '../lengths/storage'
import type { LengthsRoot as BarRoot } from '../lengths/storage'
import { reconcileHeadless as reportV12 } from '../lengths-mouth-v12/report'
import { reconcileHeadless as reportV11 } from '../lengths-mouth/report'
import { reconcileHeadless as reportBar } from '../lengths/report'
import type { HeadlessReview as V12Review } from '../lengths-mouth-v12/report'
import type { HeadlessReview as V11Review } from '../lengths-mouth/report'
import type { HeadlessReview as BarReview } from '../lengths/report'
import type { MouthDisplayContext } from '../lengths-mouth-v12/display-context'
import { orderMouthPublication as orderV12 } from '../lengths-mouth-v12/order'
import { orderMouthPublication as orderV11 } from '../lengths-mouth/order'
import { orderLengthsPublication as orderBar } from '../lengths/order'
import { untilMouthCanceled } from './order'

export type LegacyFamily = 'v12' | 'v11' | 'bar'
export type RecordAttempt = { sessionId: string; ordinal: number; createdAtWallMs: number; variant: string; armDisplayContext: MouthDisplayContext; state: unknown; snapshot?: { kind: string; state: unknown } }
export type LegacyReview = V12Review | V11Review | BarReview
export type LegacyAccess = {
  readonly deletionOnly: boolean
  readonly problem: string
  list(signal?: AbortSignal): Promise<readonly RecordAttempt[]>
  load(id: string, signal?: AbortSignal): Promise<RecordAttempt | null>
  deleteOne(id: string): Promise<void>
  deleteAll(): Promise<void>
  close(): void
  ordered<T>(work: (signal: AbortSignal) => Promise<T>, signal: AbortSignal): Promise<T>
  review(attempt: RecordAttempt): LegacyReview
}
type RootIdentity = { installationId: string }
function hasIdentity(root: unknown): root is RootIdentity {
  return !!root && typeof root === 'object' && !Array.isArray(root) &&
    Object.hasOwn(root, 'installationId') && typeof (root as RootIdentity).installationId === 'string' &&
    (root as RootIdentity).installationId.trim().length > 0
}
function transaction<Root>(db: IDBDatabase, mode: IDBTransactionMode, operation: (root: Root) => unknown, signal?: AbortSignal): Promise<unknown> {
  if (signal?.aborted) return Promise.reject(signal.reason)
  return new Promise((resolve, reject) => {
    const tx = db.transaction('installation', mode), request = tx.objectStore('installation').get('root')
    let value: unknown, failed: unknown
    const abort = () => { failed = signal?.reason ?? Error('Historical read canceled'); try { tx.abort() } catch { /* Already completed. */ } }
    signal?.addEventListener('abort', abort, { once: true })
    request.onsuccess = () => {
      try {
        if (signal?.aborted) throw signal.reason
        if (!request.result) throw Error('Existing historical root missing; installation identity unavailable for deletion')
        const root = request.result as Root
        value = operation(root)
        if (mode === 'readwrite') tx.objectStore('installation').put(root, 'root')
      } catch (error) { failed = error; try { tx.abort() } catch { /* Already completed. */ } }
    }
    request.onerror = () => { failed = request.error; try { tx.abort() } catch { /* Already completed. */ } }
    tx.oncomplete = () => { signal?.removeEventListener('abort', abort); if (signal?.aborted) reject(signal.reason); else resolve(value) }
    tx.onabort = tx.onerror = () => { signal?.removeEventListener('abort', abort); reject(failed ?? tx.error ?? Error('Historical transaction unavailable')) }
  })
}
class ExistingBackend<Root extends RootIdentity> {
  readonly db: IDBDatabase
  // Receipt for an unconfirmed reset only; retired after authoritative success.
  replacementId: string | null = null
  constructor(db: IDBDatabase) { this.db = db }
  read(signal?: AbortSignal): Promise<Root> { return transaction<Root>(this.db, 'readonly', root => root, signal) as Promise<Root> }
  change<T>(operation: (root: Root) => T, signal?: AbortSignal): Promise<T> {
    return transaction<Root>(this.db, 'readwrite', root => {
      const before = root.installationId, result = operation(root)
      // Original family reset creates these fields. Drop unsupported preimage
      // keys only on that explicit replacement, never during ordinary reads.
      if (root.installationId !== before) {
        for (const key of Object.keys(root)) if (!['version', 'installationId', 'revision', 'counters', 'attempts', 'tombstones', 'activity'].includes(key)) delete (root as Record<string, unknown>)[key]
        this.replacementId = root.installationId
      }
      return result
    }, signal) as Promise<T>
  }
}
async function existing(name: string, signal: AbortSignal): Promise<IDBDatabase | null> {
  if (signal.aborted) throw signal.reason
  let absent = false, settled = false
  return untilMouthCanceled(new Promise<IDBDatabase | null>((resolve, reject) => {
    const request = indexedDB.open(name)
    request.onupgradeneeded = event => { if (event.oldVersion === 0) { absent = true; request.transaction?.abort() } }
    request.onsuccess = () => { if (absent || settled || signal.aborted) { request.result.close(); resolve(null) } else resolve(request.result); settled = true }
    request.onerror = () => { settled = true; if (absent) resolve(null); else reject(request.error ?? Error('Historical database unavailable')) }
    request.onblocked = () => { settled = true; reject(Error('Historical database blocked')) }
  }), signal)
}
type HistoricalStore = V12Store | V11Store | BarStore
async function adapted<Root extends V12Root | V11Root | BarRoot>(db: IDBDatabase, backend: ExistingBackend<Root>, inspect: (root: Root) => Promise<void>, create: (id: string, deletionOnly: boolean) => HistoricalStore, ordered: LegacyAccess['ordered'], review: LegacyAccess['review'], signal: AbortSignal): Promise<LegacyAccess> {
  const root = await untilMouthCanceled(backend.read(signal), signal)
  if (!hasIdentity(root)) throw Error('Historical installation identity unavailable; use browser site-data controls if removal is needed')
  let deletionOnly = false, problem = '', deleting = false
  try { await inspect(root) } catch (error) { deletionOnly = true; problem = `Historical records cannot be reviewed: ${String(error)}` }
  if (signal.aborted) throw signal.reason
  let store = create(root.installationId, deletionOnly)
  if (!deletionOnly) store.authority.observe(root as never, store.authority.provenance('open'))
  const requireReview = () => { if (deletionOnly) throw Error(problem) }
  return {
    get deletionOnly() { return deletionOnly }, get problem() { return problem },
    list: signal => { requireReview(); return store.listAttempts(signal) as Promise<readonly RecordAttempt[]> },
    load: (id, signal) => { requireReview(); return store.loadArmed(id, signal) as Promise<RecordAttempt | null> },
    deleteOne: id => { requireReview(); return store.deleteAttempt(id) },
    deleteAll: async () => {
      if (deleting) throw Error('Historical deletion already pending')
      deleting = true
      try {
        // Retry can verify the exact replacement attempted by this adapter after
        // lost delivery. It cannot adopt an unrelated installation or wipe it.
        if (backend.replacementId) {
          const owner = new AbortController(), timer = setTimeout(() => owner.abort(Error('Historical deletion verification timed out')), 5_000)
          try {
            const replacement = await ordered(async signal => {
              const current = await backend.read(signal)
              if (!hasIdentity(current)) throw Error('Historical installation identity unavailable')
              if (current.installationId === backend.replacementId) {
                await inspect(current)
                if (signal.aborted) throw signal.reason
                return current
              }
              if (current.installationId !== store.installationId) throw Error('Historical installation replaced by another action')
              if (signal.aborted) throw signal.reason
              return null
            }, owner.signal)
            if (replacement) {
              store = create(replacement.installationId, false)
              store.authority.observe(replacement as never, store.authority.provenance('open'))
              deletionOnly = false; problem = ''; backend.replacementId = null; return
            }
          } finally { clearTimeout(timer) }
        }
        store = await store.deleteAll()
        deletionOnly = false; problem = ''; backend.replacementId = null
      } finally { deleting = false }
    },
    close: () => db.close(), ordered, review,
  }
}
export async function openLegacy(family: LegacyFamily, externalSignal?: AbortSignal): Promise<LegacyAccess | null> {
  const owner = new AbortController(), cancel = () => owner.abort(externalSignal?.reason ?? Error('Historical open canceled'))
  externalSignal?.addEventListener('abort', cancel, { once: true }); if (externalSignal?.aborted) cancel()
  const timer = setTimeout(() => owner.abort(Error('Historical open timed out; retry history')), 2_000)
  let db: IDBDatabase | null = null
  try {
    db = await existing(family === 'v12' ? V12_DB : family === 'v11' ? V11_DB : BAR_DB, owner.signal)
    if (!db) return null
    if (family === 'v12') {
      const backend = new ExistingBackend<V12Root>(db)
      return await untilMouthCanceled(adapted(db, backend, inspectV12, (id, only) => new V12Store(backend, id, only), orderV12, a => reportV12((a.snapshot?.state ?? a.state) as Parameters<typeof reportV12>[0]), owner.signal), owner.signal)
    }
    if (family === 'v11') {
      const backend = new ExistingBackend<V11Root>(db)
      return await untilMouthCanceled(adapted(db, backend, inspectV11, (id, only) => new V11Store(backend, id, only), orderV11, a => reportV11((a.snapshot?.state ?? a.state) as Parameters<typeof reportV11>[0]), owner.signal), owner.signal)
    }
    const backend = new ExistingBackend<BarRoot>(db)
    return await untilMouthCanceled(adapted(db, backend, inspectBar, (id, only) => new BarStore(backend, id, only), orderBar, a => reportBar((a.snapshot?.state ?? a.state) as Parameters<typeof reportBar>[0]), owner.signal), owner.signal)
  } catch (error) { db?.close(); throw error }
  finally { clearTimeout(timer); externalSignal?.removeEventListener('abort', cancel) }
}
