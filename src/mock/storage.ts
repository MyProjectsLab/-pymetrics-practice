import { assertAuthority, onAuthorityClose, withAuthority, withinAuthority } from './authority'
import { NativePresenceError } from './native-presence'
import { freshRoot, initialPreferences, migrateLegacyRoot, validateRoot } from './contract'
import type { Root } from './contract'
import { applyMockCommand, claimLaunch, createMock, deleteAllMocks, deleteMock } from './state'
import type { MockCommand } from './state'
import { openExistingNativeDatabase, requireExistingNativeKey } from './native-presence'

const DB = 'assessment-practice-full-mock-v1'
const STORE = 'installation'
const KEY = 'root'
export const MOCK_DATA_LOCK = 'assessment-practice-full-mock-data-v1'
export const MOCK_OWNER_LOCK = 'assessment-practice-full-mock-owner-v1'
export type MockStoreErrorKind = 'unsupported' | 'unavailable' | 'corrupt' | 'stale' | 'unknown'
export class MockStoreError extends Error { readonly kind: MockStoreErrorKind; constructor(kind: MockStoreErrorKind, message: string) { super(message); this.kind = kind } }
function requireSupport() {
  if (typeof indexedDB === 'undefined' || !navigator.locks?.request) throw new MockStoreError('unsupported', 'Full mock needs IndexedDB and Web Locks in this browser.')
}
function canceled(signal: AbortSignal) { assertAuthority(signal); if (signal.aborted) throw new MockStoreError('unknown', 'Save status could not be confirmed. Check again or leave.') }

/** M owns its actual callback and closes children before releasing it. */
export async function withMockDataOrder<T>(fn: (signal: AbortSignal) => Promise<T>, parent?: AbortSignal): Promise<T> {
  requireSupport()
  return withAuthority(MOCK_DATA_LOCK, 5000, fn, parent)
}

/** The owner is acquired without waiting and is released only after local native settlement. */
export async function acquireMockOwner(signal?: AbortSignal): Promise<() => void> {
  requireSupport()
  if(signal?.aborted) throw new MockStoreError('stale','Mock owner canceled.')
  let release!: () => void, acquired!: (value: boolean) => void
  const released = new Promise<void>(resolve => { release = resolve })
  const ready = new Promise<boolean>(resolve => { acquired = resolve })
  const controller = new AbortController()
  const cancel = () => { controller.abort(); release() }
  signal?.addEventListener('abort', cancel, { once: true })
  const holding = navigator.locks.request(MOCK_OWNER_LOCK, { mode: 'exclusive', ifAvailable: true }, async lock => {
    acquired(!!lock)
    if (lock) await released
  })
  const timer = setTimeout(() => { acquired(false); cancel() }, 2000)
  const available = await ready
  clearTimeout(timer)
  if (!available) { signal?.removeEventListener('abort', cancel); throw new MockStoreError('stale', 'Another mock is active in this browser or ownership was not confirmed.') }
  if (controller.signal.aborted) { release(); await holding; throw new MockStoreError('stale', 'Mock owner canceled.') }
  return () => { release(); signal?.removeEventListener('abort', cancel) }
}

function wrapRead(value: unknown): Root {
  try { validateRoot(value) } catch (error) { throw new MockStoreError('corrupt', `Mock storage needs recovery: ${error instanceof Error ? error.message : 'invalid root'}`) }
  return value
}

let pendingOpens = 0
function openDatabase(signal: AbortSignal): Promise<IDBDatabase> {
  canceled(signal)
  if (pendingOpens >= 2) throw new MockStoreError('unknown', 'Mock opening remains unresolved. Close this page before trying again.')
  pendingOpens++
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 2)
    let done = false
    const deadline = performance.now() + 2000
    const checkOpen = () => { canceled(signal); if (done || performance.now() >= deadline) throw new MockStoreError('unknown', 'Mock opening authority expired.') }
    const fail = (error: Error) => { if (done) return; done = true; clearTimeout(timer); reject(error) }
    const cancel = () => { try { request.transaction?.abort() } catch { /* An issued upgrade may still settle. */ }; fail(new MockStoreError('unknown', 'Mock database open was not confirmed.')) }
    const timer = setTimeout(cancel, 2000)
    const remove = onAuthorityClose(signal, cancel)
    request.onupgradeneeded = event => {
      try {
        checkOpen()
        if (done) { request.transaction!.abort(); return }
        if (event.oldVersion === 0) { request.result.createObjectStore(STORE).put(freshRoot(), KEY); return }
        if (event.oldVersion !== 1 || !request.result.objectStoreNames.contains(STORE)) throw new MockStoreError('corrupt', 'Existing mock history cannot be upgraded automatically.')
        const store = request.transaction!.objectStore(STORE), read = store.openCursor(IDBKeyRange.only(KEY))
        read.onsuccess = () => {
          try {
            checkOpen()
            if (done || !read.result) throw new MockStoreError('corrupt', 'Existing mock history has no root.')
            const next = migrateLegacyRoot(read.result.value)
            checkOpen()
            if (done) throw new MockStoreError('unknown', 'Mock upgrade retired.')
            store.put(next, KEY)
          } catch (error) { try { request.transaction?.abort() } catch { /* terminal */ }; fail(error instanceof MockStoreError ? error : new MockStoreError('corrupt', String(error))) }
        }
      } catch (error) { try { request.transaction?.abort() } catch { /* terminal */ }; fail(error instanceof MockStoreError ? error : new MockStoreError('unknown', String(error))) }
    }
    request.onblocked = () => fail(new MockStoreError('unavailable', 'Close other tabs using mock history and check again.'))
    request.onerror = () => { pendingOpens--; remove(); fail(new MockStoreError('unavailable', 'Mock database could not be opened.')) }
    request.onsuccess = () => {
      pendingOpens--; remove(); clearTimeout(timer)
      if (done || signal.aborted) { request.result.close(); return }
      try { checkOpen() } catch (error) { request.result.close(); fail(error as Error); return }
      done = true
      if (!request.result.objectStoreNames.contains(STORE)) { request.result.close(); reject(new MockStoreError('corrupt', 'Mock root store is missing.')); return }
      resolve(request.result)
    }
  })
}

type Cell = { tx: IDBTransaction; terminal: boolean; authorized: boolean }
// A document may retain one unknown write and one overlapping recovery read.
let writeCell: Cell | null = null, readCell: Cell | null = null
function finishCell(cell: Cell) {
  cell.terminal = true
  if (writeCell === cell) writeCell = null
  if (readCell === cell) readCell = null
}
function abortCell(cell: Cell) {
  try { cell.tx.abort(); finishCell(cell) } catch { /* Committing or finished: neither proves which outcome won. */ }
}
function plainMetadata(value: unknown): void {
  if (value === null || typeof value !== 'object') { if (!['string','number','boolean'].includes(typeof value) && value !== null) throw Error('Non-metadata root value'); return }
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) throw Error('Non-plain metadata')
  for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
    if (Array.isArray(value) && key === 'length') continue
    if (!('value' in descriptor)) throw Error('Metadata accessor rejected')
    plainMetadata(descriptor.value)
  }
}

export class MockStore {
  private unavailable = false
  private readonly life = new AbortController()
  private rootOperation: { token: object; kind: string; intent: unknown; running: boolean } | null = null
  get hasUnresolved() { return this.rootOperation !== null }
  async checkUnresolvedRoot(): Promise<Root> {
    const op = this.rootOperation
    if (op?.running) throw new MockStoreError('unknown', 'The previous history save is still being checked.')
    return withMockDataOrder(async signal => {
      const root = await this.readWithinOrder(signal); this.check(signal)
      if (this.rootOperation !== op) throw new MockStoreError('stale', 'The checked history action changed.')
      this.rootOperation = null
      return root
    }, this.life.signal)
  }
  private readonly db: IDBDatabase
  private constructor(db: IDBDatabase) { this.db = db; db.onversionchange = () => { this.unavailable = true; this.life.abort(); db.close() } }
  static async open(parent?: AbortSignal): Promise<MockStore> {
    // Inspect without creating or upgrading. Only an absent DB or healthy v1 enters
    // owner -> M -> versionchange. Retained report opens never enter this path.
    const existing = await withMockDataOrder(outer => withinAuthority(2000, async signal => {
      let db: IDBDatabase
      try { db = await openExistingNativeDatabase(DB, signal) }
      catch (error) { if (error instanceof NativePresenceError && error.kind === 'missing_database') return null; throw error }
      if (db.version === 1) { db.close(); return null }
      if (db.version !== 2) { db.close(); throw new MockStoreError('unavailable', 'Unsupported mock database version.') }
      const store = new MockStore(db)
      try { await store.readWithinOrder(signal); return store } catch (error) { store.close(); throw error }
    }, outer), parent)
    if (existing) return existing
    const release = await acquireMockOwner(parent)
    try {
      try { return await withMockDataOrder(async signal => {
        const db = await openDatabase(signal), store = new MockStore(db)
        try { await store.readWithinOrder(signal); return store } catch (error) { store.close(); throw error }
      }, parent) } catch (error) {
        // One fresh bounded completed observation reconciles an upgrade whose
        // acknowledgement was lost. No initializer or migration replay here.
        try { return await MockStore.openRetained(parent) } catch { throw error }
      }
    } finally { release() }
  }
  static async openRetained(parent?: AbortSignal): Promise<MockStore> {
    return withMockDataOrder(outer=>withinAuthority(2000,async signal=>{
      const db=await openExistingNativeDatabase(DB,signal)
      try { if(db.version!==2)throw new MockStoreError('unavailable','Mock history needs the current protocol. Open full mock history to upgrade.') }catch(error){db.close();throw error}
      try { await requireExistingNativeKey(db,STORE,KEY,signal);const selected=new MockStore(db);await selected.readWithinOrder(signal);return selected }
      catch(error){db.close();throw error}
    },outer), parent)
  }
  /** Explicit user recovery for a malformed mock-only database. Native game stores are untouched. */
  static async deleteCorruptHistory(): Promise<void> {
    const release = await acquireMockOwner()
    try {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase(DB)
        let done = false
        const timer = setTimeout(() => { if (!done) { done = true; reject(new MockStoreError('unknown', 'Mock history deletion was not confirmed. Close other tabs and check again.')) } }, 5000)
        request.onsuccess = () => { if (!done) { done = true; clearTimeout(timer); resolve() } }
        request.onerror = () => { if (!done) { done = true; clearTimeout(timer); reject(new MockStoreError('unknown', 'Mock history deletion was not confirmed.')) } }
        request.onblocked = () => { if (!done) { done = true; clearTimeout(timer); reject(new MockStoreError('stale', 'Close other mock tabs before deleting mock history.')) } }
      })
    } finally { release() }
  }
  close() { this.unavailable = true; this.life.abort(); this.db.close() }
  private check(signal: AbortSignal) { canceled(signal); if (this.unavailable) throw new MockStoreError('unavailable', 'Mock database changed. Reload and check again.') }

  /** Registered before its first request. Only completed overlapping reads are barriers. */
  readWithinOrder(signal: AbortSignal): Promise<Root> { return this.transaction(false, null, signal) }
  changeWithinOrder(fn: (root: Root) => Root, signal: AbortSignal, guard: () => void = () => {}): Promise<Root> {
    return this.transaction(true, fn, signal, guard)
  }
  private transaction(write: boolean, fn: ((root: Root) => Root) | null, signal: AbortSignal, guard: () => void = () => {}): Promise<Root> {
    this.check(signal); guard()
    if (write ? writeCell !== null : readCell !== null) throw new MockStoreError('unknown', 'A previous storage transaction remains unresolved. Check again or leave.')
    const predecessor = writeCell
    const tx = this.db.transaction(STORE, write ? 'readwrite' : 'readonly')
    const cell: Cell = { tx, terminal: false, authorized: false }
    // Registration is synchronous; every later callback only owns this cell.
    if (write) writeCell = cell; else readCell = cell
    tx.addEventListener('complete', () => finishCell(cell))
    tx.addEventListener('abort', () => finishCell(cell))
    return new Promise((resolve, reject) => {
      let result: Root | null = null, delivered = false
      const deadline = performance.now() + 2000
      const fail = (error: unknown) => { if (delivered) return; delivered = true; clearTimeout(timer); remove(); reject(error) }
      const retire = () => { abortCell(cell); fail(new MockStoreError('unknown', 'The previous save could not be confirmed. Check it before another change.')) }
      const timer = setTimeout(retire, 2000)
      let remove = () => {}
      const check = () => { this.check(signal); guard(); if (performance.now() >= deadline) throw new MockStoreError('unknown', 'Storage authority expired.') }
      try {
        remove = onAuthorityClose(signal, retire)
        tx.addEventListener('complete', () => {
          // A completed same-store read proves the earlier transaction terminal,
          // even if its application complete handler was withheld.
          if (!write && predecessor) finishCell(predecessor)
          if (delivered) return
          try { check(); if (!result) throw Error('Mock root delivery was not observed'); delivered = true; clearTimeout(timer); remove(); resolve(result) }
          catch (error) { fail(error) }
        })
        tx.addEventListener('abort', () => fail(new MockStoreError('unknown', 'Mock transaction was interrupted.')))
        tx.addEventListener('error', () => { abortCell(cell); fail(new MockStoreError('unavailable', 'Mock transaction failed.')) })
        const store = tx.objectStore(STORE), cursor = store.openCursor(IDBKeyRange.only(KEY))
        cursor.onsuccess = () => {
          if (delivered) return
          try {
            check()
            if (!cursor.result) throw new MockStoreError('corrupt', 'Existing mock database has no root key.')
            const root = wrapRead(cursor.result.value)
            result = fn ? fn(root) : root
            if (write) {
              plainMetadata(result); validateRoot(result)
              // A: no yield, user callback, or later root mutation follows this
              // post-validation lifetime/token/deadline check and final put.
              check()
              store.put(result, KEY)
              cell.authorized = true
            }
          } catch (error) { abortCell(cell); fail(error) }
        }
      } catch (error) { abortCell(cell); fail(error) }
    })
  }
  async read(): Promise<Root> { return withMockDataOrder(signal => this.readWithinOrder(signal), this.life.signal) }
  async change(fn: (root: Root) => Root): Promise<Root> {
    return withMockDataOrder(async signal => { const next = await this.changeWithinOrder(fn, signal); const observed = await this.readWithinOrder(signal); if (observed.revision !== next.revision || observed.installationId !== next.installationId) throw new MockStoreError('unknown', 'Mock write readback differed.'); return observed }, this.life.signal)
  }
  private async rootCommand<T extends {requestId:string;expectedRevision:number}>(kind:'create'|'delete_one'|'delete_all',args:T,
    change:(root:Root)=>Root,identity:(root:Root)=>boolean):Promise<Root>{
    this.life.signal.throwIfAborted()
    if (this.rootOperation) throw new MockStoreError('unknown', 'Check the previous history save before another change.')
    const op = { token: {}, kind, intent: structuredClone(args), running: true }
    this.rootOperation = op
    try {
      return await withMockDataOrder(async signal => {
        const guard = () => { this.check(signal); if (this.rootOperation !== op || !op.running) throw new MockStoreError('unknown', 'History operation retired.') }
        const remove = onAuthorityClose(signal, () => { op.running = false })
        try {
          await this.changeWithinOrder(change, signal, guard)
          const checked = await this.readWithinOrder(signal), receipt = checked.lastRootCommand
          guard()
          if (!receipt || receipt.requestId !== args.requestId || receipt.kind !== kind || receipt.expectedRevision !== args.expectedRevision || receipt.resultRevision < checked.protocolStartRevision || !identity(checked)) throw new MockStoreError('unknown', 'History receipt needs checking.')
          this.rootOperation = null; op.running = false
          return checked
        } finally { remove() }
      }, this.life.signal)
    } catch (error) {
      op.running = false
      try { await this.read() } catch { /* One bounded barrier; no retired success. */ }
      throw error
    } finally { op.running = false }
  }

  create(args: Parameters<typeof createMock>[1]) { const intent=structuredClone(args);return this.rootCommand('create',intent,root=>createMock(root,intent),root=>{
    const receipt=root.lastRootCommand
    return !!receipt?.targetMockId&&root.mocks.some(mock=>mock.id===receipt.targetMockId)&&
      JSON.stringify(receipt.creationMetadata)===JSON.stringify({goal:intent.goal,invitation:intent.invitation,preferences:intent.preferences??initialPreferences(),createdWallMs:intent.createdWallMs})
  }) }
  command(mockId: string, command: MockCommand) { return this.change(root => applyMockCommand(root, mockId, command)) }
  claim(args: Parameters<typeof claimLaunch>[1]) { return this.change(root => claimLaunch(root, args)) }
  deleteOne(args: Parameters<typeof deleteMock>[1]) { const intent=structuredClone(args);return this.rootCommand('delete_one',intent,root=>deleteMock(root,intent),root=>
    root.lastRootCommand?.targetMockId===intent.targetMockId&&!root.mocks.some(mock=>mock.id===intent.targetMockId)) }
  deleteAll(args: Parameters<typeof deleteAllMocks>[1]) { const intent=structuredClone(args);return this.rootCommand('delete_all',intent,root=>deleteAllMocks(root,intent),root=>
    root.installationId===intent.newInstallationId&&root.mocks.length===0) }
}
