import { withNativeObservation } from '../mock/authority'
import type { NativeLossHandler } from '../mock/authority'
import { NativePresenceError, requireObservedNativeVersion } from '../mock/native-presence'
import { openNativeForMock, validateObservedNative } from '../mock/native-presence'
import { FORM_PAYLOAD_HASH, formForOrdinal, loadForms, outcome, reportRun, STORAGE_VERSION } from './core'
import { openExistingNativeDatabase, readExistingNativeKey } from '../mock/native-presence'
import type { Event, Exposure, Form, PlayContext, Run } from './core'

const DB_NAME = 'assessment-practice-money-exchange-1-v1'
const DATA_LOCK = 'assessment-practice-money-exchange-1-data-v1'
const PLAY_LOCK = 'assessment-practice-money-exchange-1-play-v1'
const CHANNEL = 'assessment-practice-money-exchange-1-authority-v1'
const DELIVERY_MS = 2500
const RANK: Record<Exposure, number> = { not_revealed: 0, possibly_revealed: 1, captured_visible: 2 }
export interface Root {
  version: typeof STORAGE_VERSION; installationId: string; revision: number; nextOrdinal: number
  runs: Record<string, Run>; tombstones: Record<string, true>
  requests: Record<string, { kind: string; payload: string; runId: string }>
  activity: Record<string, { id: string; at: number; kind: 'report' | 'history' }[]>
}
export interface Backend {
  read(signal?: AbortSignal): Promise<Root>
  change<T>(fn: (root: Root) => T, signal?: AbortSignal): Promise<T>
  close(): void
}
export type Notice = { type: 'deleted' | 'replaced' | 'changed'; installationId: string; runId?: string }
export function newRoot(): Root { return { version: STORAGE_VERSION, installationId: crypto.randomUUID(), revision: 0,
  nextOrdinal: 1, runs: {}, tombstones: {}, requests: {}, activity: {} } }
function assert(ok: unknown, why: string): asserts ok { if (!ok) throw Error(`Money Exchange 1 storage: ${why}`) }
function validId(value: unknown): value is string { return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value) && !['__proto__','prototype','constructor'].includes(value) }
function exposed(a: Exposure, b: Exposure): Exposure { return RANK[a] >= RANK[b] ? a : b }
function checkSignal(signal?: AbortSignal) { assert(!signal?.aborted, 'canceled') }
export async function withMoneyDataOrder<T>(fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  assert(typeof navigator !== 'undefined' && 'locks' in navigator, 'exclusive data order unavailable')
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), DELIVERY_MS)
  try {
    return await navigator.locks.request(DATA_LOCK, { mode: 'exclusive', signal: controller.signal }, () =>
      Promise.race([fn(controller.signal), new Promise<never>((_, reject) =>
        controller.signal.addEventListener('abort', () => reject(Error('Local authority delivery unconfirmed')), { once: true }))]))
  } finally { clearTimeout(timeout) }
}
export async function acquireMoneyOwner(onLost: () => void, signal?: AbortSignal): Promise<() => void> {
  assert(typeof navigator !== 'undefined' && 'locks' in navigator, 'exclusive play unavailable')
  let resolveOpen!: (release: () => void) => void, rejectOpen!: (reason: unknown) => void
  const opened = new Promise<() => void>((resolve, reject) => { resolveOpen = resolve; rejectOpen = reject })
  let granted = false, released = false
  void navigator.locks.request(PLAY_LOCK, { mode: 'exclusive', ifAvailable: true }, async lock => {
    if (!lock || signal?.aborted) { rejectOpen(Error('Another Money Exchange tab owns play')); return }
    granted = true
    await new Promise<void>(resolve => {
      const leave = () => { signal?.removeEventListener('abort', leave); resolve() }
      signal?.addEventListener('abort', leave, { once: true })
      resolveOpen(() => { if (!released) { released = true; leave() } })
      if (signal?.aborted || released) leave()
    })
  }).then(() => { if (granted && !released && !signal?.aborted) onLost() }, reason => {
    if (granted && !released && !signal?.aborted) onLost(); else rejectOpen(reason)
  })
  return opened
}
export function validateRoot(root: Root, forms: readonly Form[]) {
  assert(root && root.version === STORAGE_VERSION && validId(root.installationId) &&
    Number.isSafeInteger(root.revision) && root.revision >= 0 &&
    Number.isSafeInteger(root.nextOrdinal) && root.nextOrdinal >= 1 &&
    root.runs && typeof root.runs === 'object' && !Array.isArray(root.runs) &&
    root.tombstones && typeof root.tombstones === 'object' && !Array.isArray(root.tombstones) &&
    root.requests && typeof root.requests === 'object' && !Array.isArray(root.requests) &&
    root.activity && typeof root.activity === 'object' && !Array.isArray(root.activity), 'root shape')
  const ordinals = new Set<number>()
  for (const [id, run] of Object.entries(root.runs)) {
    assert(validId(id) && run?.id === id && run.installationId === root.installationId &&
      validId(run.documentId) && validId(run.armRequestId) && run.context &&
      ['standalone','mock_game_10'].includes(run.context.route) &&
      (run.context.route==='standalone' || validId(run.context.mockRunId)) &&
      ['desktop_class','touch_capable','unknown'].includes(run.context.device) &&
      ['fine_pointer_capable','coarse_pointer_capable','unknown'].includes(run.context.input) &&
      typeof run.context.reducedMotion==='boolean' && typeof run.context.highContrast==='boolean' &&
      !root.tombstones[id] && Number.isSafeInteger(run.ordinal) &&
      run.ordinal > 0 && run.ordinal < root.nextOrdinal && !ordinals.has(run.ordinal) &&
      run.formPayloadHash === FORM_PAYLOAD_HASH && run.formId === formForOrdinal(forms,run.ordinal).id &&
      Number.isSafeInteger(run.revision) && run.revision >= 1 && run.revision <= root.revision &&
      Number.isFinite(run.createdAt) && run.createdAt >= 0 && ['active','incomplete','complete'].includes(run.status) &&
      RANK[run.exposure] !== undefined && Array.isArray(run.events), 'run identity')
    ordinals.add(run.ordinal)
    const expected = reportRun(run, formForOrdinal(forms,run.ordinal))
    if (run.status === 'active') assert(run.report === undefined, 'active snapshot')
    if (run.status !== 'active') assert(run.report && JSON.stringify(run.report) === JSON.stringify(expected), 'terminal report bytes')
    assert(Array.isArray(root.activity[id] ?? []), 'activity')
  }
  for (const [id, flag] of Object.entries(root.tombstones)) assert(validId(id) && flag === true && !root.runs[id], 'tombstone')
  for (const [id, request] of Object.entries(root.requests)) assert(validId(id) && request &&
    ['arm','transfer','possible','capture','return','terminal','interrupt','activity'].includes(request.kind) &&
    typeof request.payload === 'string' && validId(request.runId) &&
    !!root.runs[request.runId], 'request record')
  const activityIds=new Set<string>()
  for(const [id,entries] of Object.entries(root.activity)){
    assert(!!root.runs[id] && Array.isArray(entries),'activity target')
    for(const entry of entries){assert(validId(entry.id) && !activityIds.has(entry.id) &&
      Number.isFinite(entry.at) && entry.at>=0 && ['report','history'].includes(entry.kind), 'activity record')
      activityIds.add(entry.id)}
  }
}
class IndexedBackend implements Backend {
  private db: IDBDatabase
  constructor(db: IDBDatabase) { this.db = db }
  close() { this.db.close() }
  private tx<T>(mode: IDBTransactionMode, fn: (root: Root) => T, signal?: AbortSignal): Promise<T> {
    checkSignal(signal)
    return new Promise((resolve,reject) => {
      const tx = this.db.transaction('installation', mode)
      let value: T, finished = false
      const fail = (reason: unknown) => { if (!finished) { finished = true; reject(reason) } }
      const abort = () => { try { tx.abort() } catch { /* settled */ } }
      signal?.addEventListener('abort', abort, { once: true })
      const get = tx.objectStore('installation').get('root')
      get.onsuccess = () => {
        try { assert(get.result !== undefined, 'root missing'); value = fn(get.result as Root)
          if (mode === 'readwrite') tx.objectStore('installation').put(get.result, 'root') }
        catch (reason) { fail(reason); abort() }
      }
      get.onerror = () => fail(get.error ?? Error('Local read failed'))
      tx.oncomplete = () => { signal?.removeEventListener('abort', abort); if (!finished) { finished = true; resolve(structuredClone(value)) } }
      tx.onerror = () => fail(tx.error ?? Error('Local transaction failed'))
      tx.onabort = () => fail(tx.error ?? Error('Local transaction aborted'))
    })
  }
  read(signal?: AbortSignal) { return this.tx('readonly', root => root, signal) }
  change<T>(fn: (root: Root) => T, signal?: AbortSignal) { return this.tx('readwrite', fn, signal) }
}
async function openBackend(): Promise<Backend> {
  return new Promise((resolve,reject) => {
    let settled=false, created=false, db:IDBDatabase|null=null, tx:IDBTransaction|null=null
    const finish=(backend?:Backend, reason?:unknown)=>{
      if(settled) { backend?.close();return }
      settled=true;clearTimeout(timer)
      if(backend) resolve(backend)
      else { try { tx?.abort() } catch { /* already settled */ } db?.close();reject(reason) }
    }
    const timer=setTimeout(()=>finish(undefined,Error('Local database opening was not confirmed')),DELIVERY_MS)
    const request = indexedDB.open(DB_NAME,1)
    request.onupgradeneeded = () => { created=true;request.result.createObjectStore('installation') }
    request.onerror = () => finish(undefined,request.error ?? Error('Local database unavailable'))
    request.onsuccess = () => {
      db = request.result
      if(settled) { db.close();return }
      try {
        tx = db.transaction('installation','readwrite');const store = tx.objectStore('installation')
        const key = store.getKey('root')
        key.onsuccess = () => { if (key.result === undefined) {
          if(!created) {finish(undefined,Error('Existing Money Exchange 1 database has no root'));return}
          store.put(newRoot(),'root')
        } }
        tx.oncomplete = () => finish(new IndexedBackend(db!))
        tx.onerror = () => finish(undefined,tx?.error ?? Error('Local initialization failed'))
      } catch(reason) { finish(undefined,reason) }
    }
  })
}
async function boundedBackendRead(backend:Backend, signal?:AbortSignal) {
  const controller=new AbortController()
  const aborted=new Promise<never>((_,reject)=>controller.signal.addEventListener('abort',
    ()=>reject(Error('Local read was not confirmed')),{once:true}))
  const abort=()=>controller.abort()
  signal?.addEventListener('abort',abort,{once:true})
  if(signal?.aborted)abort()
  const timer=setTimeout(abort,DELIVERY_MS)
  try { return await Promise.race([backend.read(controller.signal),aborted]) }
  finally {clearTimeout(timer);signal?.removeEventListener('abort',abort)}
}
export class MoneyStore {
  readonly installationId: string
  readonly backend: Backend
  readonly forms: readonly Form[]
  private channel: BroadcastChannel | null = null
  private listeners = new Set<(notice: Notice) => void>()
  private onStorage = (event: StorageEvent) => {
    if (event.key !== CHANNEL || !event.newValue) return
    try { const notice = JSON.parse(event.newValue) as Notice
      if (notice?.type && notice?.installationId) [...this.listeners].forEach(fn => fn(notice)) }
    catch { /* malformed optional signal */ }
  }
  private constructor(backend: Backend, root: Root, forms: readonly Form[]) {
    this.backend=backend; this.installationId=root.installationId; this.forms=forms
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(CHANNEL)
      this.channel.onmessage = e => { const notice=e.data as Notice; [...this.listeners].forEach(fn => fn(notice)) }
    }
    if (typeof window !== 'undefined') window.addEventListener('storage', this.onStorage)
  }
  static async open(backend?: Backend) {
    const forms=await loadForms(), chosen=backend ?? await openBackend()
    try {const root=await boundedBackendRead(chosen); validateRoot(root,forms)
      return new MoneyStore(chosen,root,forms)}
    catch(reason){chosen.close();throw reason}
  }
  static openForMock(parent?:AbortSignal,allowCreate=true){return openNativeForMock(DB_NAME,1,db=>{db.createObjectStore('installation').put(newRoot(),'root')},signal=>this.openRetained(signal),parent,allowCreate)}
  static async openRetained(signal: AbortSignal): Promise<MoneyStore> {
    const db = await openExistingNativeDatabase(DB_NAME, signal)
    const backend = new IndexedBackend(db)
    try {if(db.version!==1)throw new NativePresenceError('unsupported','Native source database version is unsupported');
      const raw = await readExistingNativeKey(db, 'installation', 'root', signal) as Root
      const forms = await loadForms()
      signal.throwIfAborted(); requireObservedNativeVersion(raw,'version',[STORAGE_VERSION]); validateObservedNative(()=>validateRoot(raw, forms))
      return new MoneyStore(backend, raw, forms)
    } catch (error) { backend.close(); throw error }
  }
  close() { this.channel?.close(); if (typeof window !== 'undefined') window.removeEventListener('storage', this.onStorage)
    this.listeners.clear(); this.backend.close() }
  subscribe(fn:(notice:Notice)=>void) { this.listeners.add(fn); return () => { this.listeners.delete(fn) } }
  private notify(notice: Notice) { this.channel?.postMessage(notice)
    try { localStorage.setItem(CHANNEL, JSON.stringify({ ...notice, nonce:crypto.randomUUID() })) } catch { /* optional */ }
    ;[...this.listeners].forEach(fn => fn(notice)) }
  async read(signal?: AbortSignal) {
    const root=await boundedBackendRead(this.backend,signal)
    validateRoot(root,this.forms)
    assert(root.installationId===this.installationId,'installation replaced'); return root }
  async inspect(id:string, signal?:AbortSignal) { const root=await this.read(signal); return root.runs[id] ?? null }
  private async change<T>(fn:(root:Root)=>T) {
    return withMoneyDataOrder(signal => this.backend.change(root => {
      validateRoot(root,this.forms); assert(root.installationId===this.installationId,'installation replaced')
      const result=fn(root); validateRoot(root,this.forms); return result
    },signal))
  }
  async publishChecked(id:string|null, fn:(root:Root)=>void) { return withMoneyDataOrder(async signal => {
    const root=await this.read(signal)
    if (id) assert(!!root.runs[id] && !root.tombstones[id], 'result deleted')
    fn(root)
  }) }
  private request<T>(root:Root, kind:string, id:string, payload:unknown, runId:string, fn:()=>T):T {
    assert(validId(id),'request id')
    const bytes=JSON.stringify(payload), prior=root.requests[id]
    if (prior) { assert(prior.kind===kind && prior.payload===bytes && prior.runId===runId && !!root.runs[runId], 'request conflict')
      return root.runs[runId] as T }
    const result=fn(); root.requests[id]={kind,payload:bytes,runId}; return result
  }
  async arm(input:{ id:string; runId:string; documentId:string; at:number; context:PlayContext }) {
    return this.change(root => this.request(root,'arm',input.id,input,input.runId,() => {
      assert(validId(input.runId) && validId(input.documentId) && Number.isFinite(input.at) && !root.runs[input.runId] && !root.tombstones[input.runId], 'arm identity')
      assert(!Object.values(root.runs).some(r => r.status==='active'), 'unresolved previous attempt')
      const ordinal=root.nextOrdinal++, form=formForOrdinal(this.forms,ordinal)
      const run:Run={id:input.runId, installationId:root.installationId, documentId:input.documentId,
        armRequestId:input.id,context:input.context,
        ordinal,formId:form.id,formPayloadHash:FORM_PAYLOAD_HASH,createdAt:input.at,revision:++root.revision,
        status:'active',exposure:'not_revealed',events:[{kind:'form_armed',id:input.id,at:input.at}]}
      root.runs[run.id]=run;root.activity[run.id]=[];return run
    }))
  }
  private active(root:Root,id:string,documentId:string) {
    const run=root.runs[id];assert(run && run.status==='active' && run.documentId===documentId && !root.tombstones[id], 'active authority')
    return run
  }
  private append(root:Root,run:Run,event:Event) { run.events.push(event);run.revision=++root.revision;return run }
  async transfer(input:{ id:string; runId:string; documentId:string; expectedRevision:number; sentCents:number; at:number }) {
    return this.change(root => this.request(root,'transfer',input.id,input,input.runId,() => {
      const run=this.active(root,input.runId,input.documentId)
      assert(run.revision===input.expectedRevision,'stale transfer revision')
      assert(run.events.length===1 && Number.isInteger(input.sentCents) && input.sentCents>=0 && input.sentCents<=1000,'transfer stage')
      return this.append(root,run,{kind:'transfer_committed',id:input.id,sentCents:input.sentCents,at:input.at})
    }))
  }
  async markPossible(input:{ id:string; runId:string; documentId:string; expectedRevision:number; at:number }) {
    return this.change(root => this.request(root,'possible',input.id,input,input.runId,() => {
      const run=this.active(root,input.runId,input.documentId)
      assert(run.revision===input.expectedRevision,'stale possible revision')
      assert(run.events.at(-1)?.kind==='transfer_committed','possible stage')
      run.exposure=exposed(run.exposure,'possibly_revealed');run.revision=++root.revision;return run
    }))
  }
  async capture(input:{ id:string; runId:string; documentId:string; expectedRevision:number; at:number }) {
    return this.change(root => this.request(root,'capture',input.id,input,input.runId,() => {
      const run=this.active(root,input.runId,input.documentId)
      assert(run.revision===input.expectedRevision,'stale capture revision')
      assert(run.events.at(-1)?.kind==='transfer_committed' && run.exposure==='possibly_revealed','capture stage')
      run.exposure='captured_visible';run.revision=++root.revision;return run
    }))
  }
  async saveReturn(input:{ id:string; runId:string; documentId:string; expectedRevision:number; at:number }) {
    return this.change(root => this.request(root,'return',input.id,input,input.runId,() => {
      const run=this.active(root,input.runId,input.documentId)
      assert(run.revision===input.expectedRevision,'stale return revision')
      const transfer=run.events.at(-1)
      assert(transfer?.kind==='transfer_committed' && run.exposure==='captured_visible','return stage')
      const amount=outcome(transfer.sentCents,formForOrdinal(this.forms,run.ordinal).returnBps)
      return this.append(root,run,{kind:'return_presented',id:input.id,at:input.at,returnedCents:amount.returnedCents,selfCents:amount.selfCents,partnerCents:amount.partnerCents})
    }))
  }
  async complete(input:{ id:string; runId:string; documentId:string; expectedRevision:number; at:number; rating:number|null }) {
    return this.change(root => this.request(root,'terminal',input.id,input,input.runId,() => {
      const run=this.active(root,input.runId,input.documentId)
      assert(run.revision===input.expectedRevision,'stale terminal revision')
      const transfer=run.events.find(e=>e.kind==='transfer_committed')
      assert(run.events.at(-1)?.kind==='return_presented' && transfer?.kind==='transfer_committed','terminal stage')
      if (transfer.sentCents>0) {
        assert(Number.isInteger(input.rating) && input.rating!==null && input.rating>=0 && input.rating<=10,'rating')
        run.events.push({kind:'fairness_committed',id:`${input.id}_rating`,rating:input.rating,at:input.at})
      } else { assert(input.rating===null,'zero rating');run.events.push({kind:'fairness_not_applicable',id:`${input.id}_na`,at:input.at}) }
      run.events.push({kind:'completed',id:input.id,at:input.at});run.status='complete';run.revision=++root.revision
      run.report=reportRun(run,formForOrdinal(this.forms,run.ordinal));return run
    }))
  }
  async interrupt(input:{ id:string; runId:string; documentId:string; at:number; reason:string; exposure:Exposure }) {
    const result=await this.change(root => this.request(root,'interrupt',input.id,input,input.runId,() => {
      const run=root.runs[input.runId]
      assert(run && run.documentId===input.documentId,'interruption target')
      if (run.status==='complete') return run
      const next=exposed(run.exposure,input.exposure)
      if (run.status==='incomplete') {
        if (next!==run.exposure) { run.exposure=next;run.revision=++root.revision;run.report=reportRun(run,formForOrdinal(this.forms,run.ordinal)) }
        return run
      }
      run.exposure=next
      run.status='incomplete';run.events.push({kind:'ended_incomplete',id:input.id,at:input.at,reason:input.reason})
      run.revision=++root.revision;run.report=reportRun(run,formForOrdinal(this.forms,run.ordinal));return run
    }))
    this.notify({type:'changed',installationId:this.installationId,runId:input.runId})
    return result
  }
  async activity(input:{id:string;runId:string;at:number;kind:'report'|'history'}, guard?:(root:Root)=>void) {
    return this.change(root => this.request(root,'activity',input.id,input,input.runId,() => {
      const run=root.runs[input.runId];assert(run && run.status!=='active','saved report unavailable')
      guard?.(root)
      root.activity[input.runId].push({id:input.id,at:input.at,kind:input.kind});root.revision++
      return run
    }))
  }
  async deleteOne(id:string) {
    try { await this.change(root => {if(root.tombstones[id])return
      assert(root.runs[id],'delete target')
      delete root.runs[id]; delete root.activity[id]; root.tombstones[id]=true
      for (const [key,request] of Object.entries(root.requests)) if (request.runId===id) delete root.requests[key]
      root.revision++ }) }
    catch(reason) {const root=await this.read();if(!root.tombstones[id])throw reason}
    this.notify({type:'deleted',installationId:this.installationId,runId:id})
  }
  async deleteAll() {
    try { await withMoneyDataOrder(signal => this.backend.change(root => {
      validateRoot(root,this.forms);assert(root.installationId===this.installationId,'installation replaced')
      Object.assign(root,newRoot());return root
    },signal)) }
    catch(reason) {const root=await boundedBackendRead(this.backend);validateRoot(root,this.forms)
      if(root.installationId===this.installationId)throw reason}
    this.notify({type:'replaced',installationId:this.installationId})
  }
}

/** Mock observation only; ordinary native writers keep their existing order. */
export function withMoney1MockOrder<T>(work:(signal:AbortSignal)=>Promise<T>,parent:AbortSignal,loss?:NativeLossHandler<T>):Promise<T>{return withNativeObservation(DATA_LOCK,work,parent,loss)}
