import { verifyBank } from './bank'
import { scopedDigest, validateRoot } from './model'
import type { TrainingRoot } from './model'
import { exactJson, ownJson } from './domain'
import { FragmentTree } from './fragments'
import { liveCandidate } from './live'
import type { LiveCommand } from './live'
import { isLiveEnvelope, liveCapture } from './live-envelope'
import { validatePart } from './schema'
import type { OperationScope } from './authority'
import { compareRaw, inspectRaw, rawBlobSize, RawUnavailable } from './raw'
import type { RawIndex, RawMatch } from './raw'
import {PARTITION_STORES,readLogical,readPhysical,logical,comparePhysical,
  putLive,putChanged,putFull} from './partition'
import type {PhysicalImage} from './partition'
import {intentCandidate} from './intent'
import type {IntentCommand} from './intent'

export const TRAINING_DB = 'assessment-practice-towers-training-v1'
const STORE = 'installation', KEY = 'root'
const DATA_LOCK = 'assessment-practice-towers-training-data-v1'
const REVIEW_LOCK = 'assessment-practice-towers-training-review-v1'
export type ReadResult = { status: 'absent'; observationId:string } | { status: 'present'; root: TrainingRoot } |
  { status: 'corrupt'; token: string; recovery:'exact'|'current' } |
  { status:'recovery-unavailable' }
export class Unconfirmed extends Error { constructor(message = 'Previous browser operation is unconfirmed') { super(message) } }
export class Changed extends Error { constructor(message = 'Saved training data changed') { super(message) } }
export class Aborted extends Error { constructor(message = 'Training transaction aborted before commit') { super(message) } }
export class RetiredBeforePut extends Error { constructor() { super('Retired training command submitted no write') } }

interface NativeCell {
  id: string; kind:string; scope: OperationScope; retired: boolean; workSettled:boolean; tx?: IDBTransaction; db?: IDBDatabase
  upgradeOutcome?:'pending'|'complete'|'abort'
  outcome: 'pending' | 'complete' | 'abort' | 'error' | 'barrier_complete'; rawPending?: boolean
  submitted?:boolean; barrierAttempts?:number; onComplete?:()=>void
  settleRegistered?: (outcome:'complete'|'abort'|'barrier_complete',reason?:unknown)=>void
  done: Promise<void>; finish: () => void
  workDone: Promise<void>; finishWork: () => void
}
const now = () => performance.now()
let nativeIncarnation=0
type Witness={path:string[];kind:'native'|'unknown-key'|'missing-key'|
  'count'|'string-length'|'number-domain'|'version'|'physical-envelope';key?:string;limit?:number}
type RawObservation={kind:'pending'|'exact'|'current';owner:string;token:string;
  incarnation:number;version:1|2;installationId:string|null;revision:number;index?:RawIndex;
  oldBytes?:Uint8Array;witness?:Witness}
let rawObservation:RawObservation|null=null
let rawByteJob:Promise<unknown>|null=null
const rootKeys=new Set(['version','installationId','revision','nextOrdinal',
  'attempts','chains','comparisons','requests','activity','tombstones'])
function ownKeysBounded(value:object,limit:number):string[]|null{
  const keys:string[]=[]
  for(const key in value){if(!Object.hasOwn(value,key))continue
    if(keys.length>=limit)return null
    keys.push(key)}
  return keys
}
const stableId=(value:unknown):string|null=>{
  if(!value||typeof value!=='object'||Array.isArray(value)||
    Object.getPrototypeOf(value)!==Object.prototype&&Object.getPrototypeOf(value)!==null)
    return null
  const descriptor=Object.getOwnPropertyDescriptor(value,'installationId')
  const id=descriptor&&'value' in descriptor?descriptor.value:null
  return typeof id==='string'&&id.length>=1&&id.length<=64&&
    /^(?!__proto__$|prototype$|constructor$)[A-Za-z0-9_-]+$/.test(id)?id:null
}
function physicalMeta(image:PhysicalImage):unknown{
  return image.meta.length===1&&image.meta[0][0]===KEY?image.meta[0][1]:null
}
function specificWitness(value:unknown):Witness|null {
  if(!value||typeof value!=='object'||Array.isArray(value))return {path:[],kind:'native'}
  let visited=0
  const visit=(part:unknown,path:string[],depth:number):Witness|null=>{
    if(!part||typeof part!=='object')return null
    if(depth>96||++visited>4096)return null
    const proto=Object.getPrototypeOf(part)
    if(!Array.isArray(part)&&proto!==Object.prototype&&proto!==null)
      return {path,kind:'native'}
    const arrayLimit=path.length===1&&path[0]==='activity'?128:1024
    if(Array.isArray(part)&&part.length>arrayLimit)
      return {path,kind:'count',limit:arrayLimit}
    const keys=ownKeysBounded(part,4096)
    if(!keys)return {path,kind:'count',limit:4096}
    if(path.length===0){
      for(const key of rootKeys)if(!Object.hasOwn(part,key))
        return {path,kind:'missing-key',key}
      for(const key of keys)if(!rootKeys.has(key))
        return {path,kind:'unknown-key',key}
      if(Object.getOwnPropertyDescriptor(part,'version')?.value!==
        'towers-training-root/1')
        return {path,kind:'version'}
    }
    const familyLimit=path.length===1?({attempts:64,chains:6,comparisons:6,
      requests:128,tombstones:256} as Record<string,number>)[path[0]]:undefined
    if(familyLimit!==undefined&&keys.length>familyLimit)
      return {path,kind:'count',limit:familyLimit}
    for(const key of keys){
      const descriptor=Object.getOwnPropertyDescriptor(part,key)
      if(!descriptor||!('value' in descriptor))return {path:[...path,key],kind:'native'}
      const child=descriptor.value
      if(child&&typeof child==='object'){
        const witness=visit(child,[...path,key],depth+1)
        if(witness)return witness
      }else if(typeof child==='string'&&child.length>64)
        return {path:[...path,key],kind:'string-length',limit:64}
      else if(typeof child==='number'&&(!Number.isFinite(child)||Object.is(child,-0)))
        return {path:[...path,key],kind:'number-domain'}
      else if(typeof child==='undefined'||typeof child==='bigint'||
        typeof child==='symbol'||typeof child==='function')
        return {path:[...path,key],kind:'native'}
    }
    return null
  }
  return visit(value,[],0)
}
function stillWitness(value:unknown,witness:Witness):boolean {
  let part=value
  for(const key of witness.path){if(!part||typeof part!=='object')return false
    const descriptor=Object.getOwnPropertyDescriptor(part,key)
    if(!descriptor||!('value' in descriptor))return false
    part=descriptor.value}
  if(witness.kind==='unknown-key')return !!part&&typeof part==='object'&&
    Object.hasOwn(part,witness.key!)
  if(witness.kind==='missing-key')return !!part&&typeof part==='object'&&
    !Object.hasOwn(part,witness.key!)
  if(witness.kind==='version')return !!part&&typeof part==='object'&&
    Object.getOwnPropertyDescriptor(part,'version')?.value!==
      'towers-training-root/1'
  if(witness.kind==='count')return !!part&&typeof part==='object'&&
    (Array.isArray(part)&&part.length>witness.limit!||
      ownKeysBounded(part,witness.limit!)===null)
  if(witness.kind==='string-length')return typeof part==='string'&&part.length>witness.limit!
  if(witness.kind==='number-domain')return typeof part==='number'&&
    (!Number.isFinite(part)||Object.is(part,-0))
  return !part||typeof part!=='object'?part===null||typeof part==='undefined'||
    typeof part==='bigint'||typeof part==='symbol'||typeof part==='function':
    Array.isArray(part)?witness.path.length===0:
      Object.getPrototypeOf(part)!==Object.prototype&&Object.getPrototypeOf(part)!==null
}
const freshCell = (scope:OperationScope,kind:string): NativeCell => {
  let finish!: () => void
  const done = new Promise<void>(resolve => { finish = resolve })
  let finishWork!: () => void
  const workDone = new Promise<void>(resolve => { finishWork = resolve })
  scope.check()
  return { id:crypto.randomUUID(),kind,scope,retired:false,workSettled:false,
    outcome:'pending',done,finish,workDone,finishWork }
}
function register(tx: IDBTransaction, cell: NativeCell): Promise<void> {
  cell.tx = tx
  const completed=new Promise<void>((resolve,reject) => {
    let settled=false
    cell.settleRegistered=(outcome,reason)=>{
      if(settled)return
      settled=true;cell.outcome=outcome;cell.finish()
      if(outcome==='abort')reject(reason instanceof Error?reason:new Aborted(tx.error?.message))
      else resolve()
    }
    tx.oncomplete = () => {
      if(!settled){cell.onComplete?.();cell.settleRegistered?.('complete')}}
    tx.onabort = () => cell.settleRegistered?.('abort',new Aborted(tx.error?.message))
    // `error` can fire on a request while the transaction is still live. Only
    // complete/abort are terminal evidence and may release the resource slot.
  })
  void completed.catch(()=>undefined)
  return completed
}
function check(cell: NativeCell) {
  if (cell.retired) throw new Unconfirmed('Training operation retired')
  try { cell.scope.check() } catch { throw new Unconfirmed('Training operation delivery timed out') }
}
async function deadline<T>(cell: NativeCell, promise: Promise<T>): Promise<T> {
  check(cell)
  const time = Math.max(1,cell.scope.deadline-now())
  let timer!: ReturnType<typeof setTimeout>
  try { return await Promise.race([promise,new Promise<never>((_,reject) => {
    timer = setTimeout(() => { cell.retired = true;cell.scope.retire()
      try { cell.tx?.abort() } catch { /* a completed transaction stays committed */ }
      reject(new Unconfirmed()) },time)
  })]) } finally { clearTimeout(timer) }
}
function openNative(cell: NativeCell, create: boolean): Promise<IDBDatabase | null> {
  return new Promise((resolve,reject) => {
    let upgradeAborted = false
    cell.rawPending = true
    const request = create?indexedDB.open(TRAINING_DB,2):indexedDB.open(TRAINING_DB)
    request.onupgradeneeded = () => {
      const upgrade=request.transaction
      if(upgrade){cell.tx=upgrade;cell.upgradeOutcome='pending'
        upgrade.addEventListener('complete',()=>{cell.upgradeOutcome='complete';if(cell.tx===upgrade)cell.tx=undefined})
        upgrade.addEventListener('abort',()=>{cell.upgradeOutcome='abort';if(cell.tx===upgrade)cell.tx=undefined})}
      try { check(cell) } catch { upgradeAborted=true;request.transaction?.abort();return }
      if (!create || request.transaction?.db.objectStoreNames.contains(STORE)) {
        upgradeAborted = true; request.transaction?.abort(); return }
      for(const name of PARTITION_STORES)request.result.createObjectStore(name)
    }
    request.onsuccess = () => {
      cell.rawPending = false
      const db = request.result
      if (cell.retired || cell.scope.signal.aborted) { db.close(); cell.outcome = 'complete'; cell.finish()
        reject(new Unconfirmed('Late browser open was retired')); return }
      db.onversionchange=()=>{nativeIncarnation++;db.close();
        if(rawObservation)rawObservation=null}
      db.onclose=()=>{nativeIncarnation++;if(rawObservation)rawObservation=null}
      cell.db = db
      resolve(db)
    }
    request.onerror = () => {
      cell.rawPending = false
      cell.outcome = 'error';cell.finish()
      if (upgradeAborted && !cell.retired) resolve(null)
      else reject(cell.retired ? new Unconfirmed('Late browser open was retired') :
        request.error ?? Error('Training storage unavailable'))
    }
    request.onblocked = () => { /* absolute deadline remains authoritative */ }
  })
}
async function observed(db: IDBDatabase,cell:NativeCell): Promise<{
  present:boolean;value:unknown;physical:PhysicalImage;malformed:boolean}> {
  check(cell)
  const tx = db.transaction([...PARTITION_STORES],'readonly')
  const completed = register(tx,cell)
  const current=new Promise<PhysicalImage>((resolve,reject)=>{
    try{readPhysical(tx,resolve,reject)}catch(reason){reject(reason);try{tx.abort()}catch{}}
  })
  const physical=await current
  await completed
  check(cell)
  try{const value=logical(physical)
    return {present:value!==null,value,physical,malformed:false}}
  catch{return {present:false,value:null,physical,malformed:true}}
}
async function legacyObserved(db:IDBDatabase,cell:NativeCell):Promise<{
  singleton:boolean;value:unknown}> {
  check(cell)
  if(db.objectStoreNames.length!==1||!db.objectStoreNames.contains(STORE))
    return {singleton:false,value:null}
  const tx=db.transaction(STORE,'readonly')
  cell.tx=tx
  const completed=new Promise<void>((resolve,reject)=>{
    tx.oncomplete=()=>resolve()
    tx.onabort=()=>reject(new Aborted(tx.error?.message))
  })
  void completed.catch(()=>undefined)
  const store=tx.objectStore(STORE)
  if(store.keyPath!==null||store.autoIncrement||store.indexNames.length!==0){
    try{tx.abort()}catch{}
    await completed.catch(()=>undefined)
    if(cell.tx===tx)cell.tx=undefined
    return {singleton:false,value:null}
  }
  const result=new Promise<{singleton:boolean;value:unknown}>((resolve,reject)=>{
    let count=0,value:unknown=null,valid=true
    const request=store.openCursor()
    request.onerror=()=>reject(request.error??Error('Legacy cursor failed'))
    request.onsuccess=()=>{try{check(cell)
      const cursor=request.result
      if(!cursor){resolve({singleton:valid&&count===1,value});return}
      count++
      if(count!==1||cursor.key!==KEY)valid=false
      if(count===1)value=cursor.value
      if(count>2){resolve({singleton:false,value});return}
      cursor.continue()
    }catch(error){try{tx.abort()}catch{};reject(error)}}
  })
  try{const observed=await result;await completed;check(cell);return observed}
  catch(error){await completed.catch(()=>undefined);throw error}
  finally{if(cell.tx===tx)cell.tx=undefined}
}

/** One registered versionchange W compares the exact v1 physical singleton. */
function migrateLegacy(cell:NativeCell,expected:TrainingRoot):Promise<IDBDatabase>{
  return new Promise((resolve,reject)=>{
    cell.rawPending=true
    const request=indexedDB.open(TRAINING_DB,2)
    let completed:Promise<void>|null=null,failed:unknown=null
    request.onupgradeneeded=()=>{
      const tx=request.transaction
      if(!tx){failed=Error('Legacy upgrade transaction absent');return}
      completed=register(tx,cell)
      try{check(cell)
        if(request.result.objectStoreNames.length!==1||
          !request.result.objectStoreNames.contains(STORE))
          throw new Changed('Legacy store disappeared')
        const legacyStore=tx.objectStore(STORE)
        if(legacyStore.keyPath!==null||legacyStore.autoIncrement||
          legacyStore.indexNames.length!==0)
          throw new Changed('Legacy store schema changed')
        for(const name of PARTITION_STORES){
          if(request.result.objectStoreNames.contains(name))
            throw new Changed('Unexpected legacy partition')
          request.result.createObjectStore(name)
        }
        let count=0
        const cursor=tx.objectStore(STORE).openCursor()
        cursor.onerror=()=>{failed=cursor.error??Error('Legacy upgrade cursor failed')
          try{tx.abort()}catch{}}
        cursor.onsuccess=()=>{try{check(cell)
          const row=cursor.result
          if(row){
            count++
            if(count!==1||row.key!==KEY||!exactJson(row.value,expected,cell.scope))
              throw new Changed('Legacy physical source changed')
            row.continue();return
          }
          if(count!==1)throw new Changed('Legacy source disappeared')
          request.result.deleteObjectStore(STORE)
          putFull(tx,expected,()=>{cell.submitted=true})
        }catch(error){failed=error;try{tx.abort()}catch{}}}
      }catch(error){failed=error;try{tx.abort()}catch{}}
    }
    request.onerror=()=>{cell.rawPending=false
      if(!completed){cell.outcome='error';cell.finish()}
      reject(failed??request.error??Error('Legacy cutover failed'))}
    request.onsuccess=()=>{cell.rawPending=false
      const db=request.result
      if(cell.retired||cell.scope.signal.aborted){db.close();reject(new Unconfirmed('Legacy cutover delivery retired'));return}
      if(!completed){db.close();reject(new Changed('Legacy cutover had no upgrade'));return}
      db.onversionchange=()=>{nativeIncarnation++;db.close();rawObservation=null}
      db.onclose=()=>{nativeIncarnation++;rawObservation=null}
      cell.db=db
      void completed.then(()=>resolve(db),error=>{db.close();reject(error)})
    }
    request.onblocked=()=>{/* deadline and registered outcome retain the slot */}
  })
}
function emptyRoot(): TrainingRoot {
  return {version:'towers-training-root/1',installationId:crypto.randomUUID().replaceAll('-','_'),
    revision:1,nextOrdinal:1,attempts:{},chains:{},comparisons:{},requests:{},activity:[],tombstones:{}}
}
async function exclusive<T>(name:string, cell:NativeCell, body:()=>Promise<T>):Promise<T> {
  if (!navigator.locks) throw Error('Exclusive browser locks unavailable')
  check(cell)
  const work = navigator.locks.request(name,{mode:'exclusive',signal:cell.scope.signal},async()=>{
    check(cell)
    return body()
  })
  return deadline(cell,work)
}

/** One document-scoped training store. Unknown native resources retain their slot until terminal callbacks. */
export class TrainingStore {
  private static documentBusy: NativeCell | null = null
  private static documentOpen: NativeCell | null = null
  private static documentBarrier: NativeCell | null = null
  private get busy(){return TrainingStore.documentBusy}
  private set busy(value:NativeCell|null){TrainingStore.documentBusy=value}
  private get openPending(){return TrainingStore.documentOpen}
  private set openPending(value:NativeCell|null){TrainingStore.documentOpen=value}
  private scopes = new Set<OperationScope>()
  #validatedRoot:TrainingRoot|null=null
  #validatedFragments:FragmentTree|null=null
  #observedOperationId:string|null=null
  // Only an unforgeable, frozen, zero-field handle names a private semantic
  // proof. UI/action roots are separate immutable display projections.
  #proofs=new WeakMap<object,TrainingRoot>()
  #projectionHandles=new WeakMap<object,object>()
  #projectedSource:TrainingRoot|null=null
  #projectedRoot:TrainingRoot|null=null
  private absences = new Map<string,{scopeId:string;incarnation:number}>()
  private readonly recoveryOwner=crypto.randomUUID()
  private listeners = new Set<(reason:'deleted'|'replaced'|'unknown',id?:string)=>void>()
  private channel: BroadcastChannel | null = null
  constructor() {
    try { this.channel = new BroadcastChannel('assessment-practice-towers-training-notice-v1')
      this.channel.onmessage = event => { const message = event.data
        if (message?.type === 'deleted' || message?.type === 'replaced')
          for (const listener of this.listeners) listener(message.type,message.id)
      } } catch { /* notices are advisory */ }
  }
  subscribe(listener:(reason:'deleted'|'replaced'|'unknown',id?:string)=>void) {
    this.listeners.add(listener);return()=>this.listeners.delete(listener)
  }
  close() { for(const scope of this.scopes)if(scope.kind==='ordinary')scope.retire();
    if(rawObservation?.owner===this.recoveryOwner)rawObservation=null
    this.channel?.close() }
  private notice(type:'deleted'|'replaced',id?:string) {
    try { this.channel?.postMessage({type,id}) } catch { /* no authority from notices */ }
    for (const listener of this.listeners) listener(type,id)
  }
  private project(root:TrainingRoot):TrainingRoot {
    if(this.#projectedSource===root&&this.#projectedRoot)return this.#projectedRoot
    const handle=Object.freeze(Object.create(null)) as object
    const display=Object.freeze({...root,
      attempts:Object.freeze({...root.attempts}),chains:Object.freeze({...root.chains}),
      comparisons:Object.freeze({...root.comparisons}),requests:Object.freeze({...root.requests}),
      activity:Object.freeze([...root.activity]),tombstones:Object.freeze({...root.tombstones})}) as TrainingRoot
    this.#proofs.set(handle,root);this.#projectionHandles.set(display,handle)
    this.#projectedSource=root;this.#projectedRoot=display
    return display
  }
  private recognized(display:TrainingRoot):TrainingRoot {
    const handle=this.#projectionHandles.get(display)
    const proof=handle&&this.#proofs.get(handle)
    if(!proof||proof!==this.#validatedRoot)
      throw new Changed('Current private training proof unavailable')
    return proof
  }
  /** Synchronous custody check before omitting the ordinary intent display clone. */
  recognizeIntentSource(display:TrainingRoot):void { this.recognized(display) }
  private async validObserved(value:unknown,scope:OperationScope):Promise<TrainingRoot> {
    scope.check()
    if(this.#validatedRoot&&exactJson(value,this.#validatedRoot,scope)){
      this.#observedOperationId=scope.id
      return this.project(this.#validatedRoot)
    }
    const root=await validateRoot(value,scope)
    const fragments=new FragmentTree()
    await fragments.cold(root,scope)
    scope.check();this.#validatedRoot=root;this.#validatedFragments=fragments
    this.#observedOperationId=scope.id
    return this.project(root)
  }
  private async classifyCorrupt(value:unknown,scope:OperationScope,version:1|2=1,
    physicalInstallationId?:string|null):Promise<ReadResult>{
    scope.check()
    const token=crypto.randomUUID(),installationId=physicalInstallationId===undefined?
      stableId(value):physicalInstallationId
    const revisionSource=version===2?physicalMeta(value as PhysicalImage):value
    const candidateRevision=revisionSource&&typeof revisionSource==='object'?
      Object.getOwnPropertyDescriptor(revisionSource,'revision')?.value:undefined
    const revision=Number.isSafeInteger(candidateRevision)&&
      (candidateRevision as number)>=0&&(candidateRevision as number)<=1000000?
      candidateRevision as number:0
    let index:RawIndex|null=null
    try {index=await inspectRaw(value,scope)}
    catch(reason){if(!(reason instanceof RawUnavailable))throw reason}
    scope.check()
    if(index){
      let oldBytes:Uint8Array|undefined
      if(index.blobs.length){
        const expected=index.blobs.reduce((sum,part)=>sum+rawBlobSize(part),0)
        if(expected>4194304)index=null
        else {const result=await new Blob([...index.blobs]).arrayBuffer()
          scope.check()
          if(result.byteLength!==expected)index=null
          else oldBytes=new Uint8Array(result)}
      }
      if(index){rawObservation={kind:'exact',owner:this.recoveryOwner,token,
          incarnation:nativeIncarnation,version,installationId,revision,index,oldBytes}
        return {status:'corrupt',token,recovery:'exact'}}
    }
    let witness:Witness|null=null
    if(installationId){
      if(version===1)witness=specificWitness(value)
      else {
        try{witness=specificWitness(logical(value as PhysicalImage))}
        catch{witness={path:[],kind:'physical-envelope'}}
      }
    }
    if(witness){rawObservation={kind:'current',owner:this.recoveryOwner,token,
      incarnation:nativeIncarnation,version,installationId,revision,witness}
      return {status:'corrupt',token,recovery:'current'}}
    rawObservation=null
    return {status:'recovery-unavailable'}
  }
  private async operate<T>(kind:string,scope:OperationScope,body:(cell:NativeCell)=>Promise<T>):Promise<T> {
    scope.check()
    if (this.busy && (this.busy.outcome === 'pending'||!this.busy.workSettled))
      throw new Unconfirmed('Still waiting for the previous browser operation')
    this.scopes.add(scope)
    const cell = freshCell(scope,kind);this.busy = cell
    const cancel=()=>{cell.retired=true;try{cell.tx?.abort()}catch{/* native outcome remains separate */}
      cell.db?.close();cell.db=undefined}
    scope.signal.addEventListener('abort',cancel,{once:true})
    const finishWork=()=>{
      cell.workSettled=true
      if(cell.outcome==='pending'&&!cell.rawPending&&!cell.tx){cell.outcome='complete';cell.finish()}
      if(this.busy===cell&&cell.outcome!=='pending')this.busy=null
      cell.finishWork()
    }
    const work=body(cell)
    void work.then(finishWork,finishWork)
    try { const result=await deadline(cell,work)
      // Successful delivery includes release of this operation's own Web Lock
      // callback and registry slot. A successor may run in the same turn.
      await deadline(cell,cell.workDone)
      return result }
    finally {
      scope.signal.removeEventListener('abort',cancel)
      this.scopes.delete(scope)
      if (cell.workSettled && this.busy === cell && cell.outcome !== 'pending') this.busy = null
      // A late native terminal callback frees only its own occupied slot.
      void cell.done.then(()=>{ if (cell.workSettled&&this.busy === cell) this.busy = null })
      void kind
    }
  }
  private async db(cell:NativeCell,create=false) {
    if (this.openPending && this.openPending.outcome === 'pending')
      throw new Unconfirmed('Still waiting for the previous browser open')
    this.openPending = cell
    const opening = openNative(cell,create)
    void opening.then(()=>{ if (this.openPending === cell) this.openPending = null },
      ()=>{ if (this.openPending === cell) this.openPending = null })
    try { return await deadline(cell,opening) }
    finally { if (this.openPending === cell && !cell.rawPending) this.openPending = null }
  }
  async read(scope:OperationScope):Promise<ReadResult> {
    if(rawByteJob)throw new Unconfirmed('A prior raw byte or locator job is still pending')
    scope.check();await verifyBank();scope.check()
    let waiting=this.busy
    if(waiting&&waiting.outcome==='pending'&&!waiting.submitted&&
      (waiting.retired||!waiting.scope.valid())){
      let timer:ReturnType<typeof setTimeout>|null=null
      let abort:(()=>void)|null=null
      try{await Promise.race([waiting.done,new Promise<never>((_,reject)=>{
        abort=()=>reject(new Unconfirmed('Confirmation was retired'))
        scope.signal.addEventListener('abort',abort,{once:true})
        if(scope.signal.aborted)abort()
        timer=setTimeout(()=>reject(new Unconfirmed('Previous native work is still pending')),
          Math.max(1,scope.deadline-now()))
      })])}finally{if(timer)clearTimeout(timer)
        if(abort)scope.signal.removeEventListener('abort',abort)}
      scope.check();waiting=this.busy
    }
    if(waiting && waiting.outcome==='pending' && waiting.submitted &&
      (waiting.retired||!waiting.scope.valid())){
      return this.barrierRead(waiting,scope)
    }
    return this.operate('read',scope,async cell=>{
      rawObservation={kind:'pending',owner:this.recoveryOwner,token:crypto.randomUUID(),
        incarnation:nativeIncarnation,version:2,installationId:null,revision:0}
      let db:IDBDatabase|null
      try{db=await this.db(cell)}catch(error){
        if(rawObservation?.kind==='pending'&&
          rawObservation.owner===this.recoveryOwner)rawObservation=null
        throw error
      }
      if (!db) {const observationId=crypto.randomUUID().replaceAll('-','_')
        this.absences.set(observationId,{scopeId:scope.id,incarnation:nativeIncarnation});rawObservation=null
        return {status:'absent',observationId}}
      try {
        if(db.version===1)return await exclusive(DATA_LOCK,cell,async()=>{
          const legacy=await legacyObserved(db,cell)
          if(!legacy.singleton){rawObservation=null
            return {status:'recovery-unavailable' as const}}
          let root:TrainingRoot
          try{root=await this.validObserved(legacy.value,cell.scope)}
          catch(reason){if(cell.retired||cell.scope.signal.aborted||now()>=cell.scope.deadline)
              throw reason
            return this.classifyCorrupt(legacy.value,cell.scope)}
          // The preflight semantic proof is not authority until versionchange
          // rechecks the exact physical v1 key and value in its own W.
          db.close();cell.db=undefined
          const migrated=await migrateLegacy(cell,this.recognized(root))
          migrated.close();cell.db=undefined
          rawObservation=null
          return {status:'present' as const,root}
        })
        if(db.version!==2)throw new Changed('Unsupported training schema version')
        const found = await observed(db,cell)
        if(found.malformed)return this.classifyCorrupt(found.physical,cell.scope,2,
          stableId(physicalMeta(found.physical)))
        if (!found.present) {const observationId=crypto.randomUUID().replaceAll('-','_')
          rawObservation=null
          this.absences.set(observationId,{scopeId:scope.id,incarnation:nativeIncarnation});return {status:'absent',observationId}}
        try { const root=await this.validObserved(found.value,cell.scope)
          rawObservation=null;return {status:'present',root} }
        catch (reason) { if (cell.retired || cell.scope.signal.aborted || now()>=cell.scope.deadline) throw reason
          return this.classifyCorrupt(found.physical,cell.scope,2,stableId(found.value)) }
      } finally { db.close();if(rawObservation?.kind==='pending'&&
        rawObservation.owner===this.recoveryOwner)rawObservation=null }
    })
  }

  /** A completed same-store read registered after a submitted write is a native barrier. */
  private async barrierRead(write:NativeCell,scope:OperationScope):Promise<ReadResult>{
    if(TrainingStore.documentBarrier?.outcome==='pending')
      throw new Unconfirmed('A confirmation read is still pending')
    if((write.barrierAttempts??0)>=2)
      throw new Unconfirmed('The previous write still needs a native outcome')
    if(!write.submitted||this.busy!==write)
      throw new Unconfirmed('The previous write is not ready for confirmation')
    // A new Check supersedes any older corrupt confirmation, even when the
    // barrier itself later remains unknown.
    rawObservation=null
    write.barrierAttempts=(write.barrierAttempts??0)+1
    const cell=freshCell(scope,'barrier')
    cell.onComplete=()=>{if(this.busy===write && write.outcome==='pending')
      write.settleRegistered?.('barrier_complete')}
    TrainingStore.documentBarrier=cell
    const cancel=()=>{cell.retired=true;try{cell.tx?.abort()}catch{/* terminal callback owns the slot */}}
    scope.signal.addEventListener('abort',cancel,{once:true})
    const work=(async():Promise<ReadResult>=>{
      const ownHandle=!write.db
      const db=write.db??await this.db(cell)
      if(!db)throw new Changed('Training installation absent before barrier')
      try{
      const found=await observed(db,cell)
      if(found.malformed)return this.classifyCorrupt(found.physical,scope,2,
        stableId(physicalMeta(found.physical)))
      // B establishes W's native outcome. W must also leave its Web Lock
      // callback before this confirmation can authorize a successor.
      if(write.outcome==='barrier_complete')await deadline(cell,write.workDone)
      // B.oncomplete independently resolves W even if application delivery is late.
      if(!found.present){const observationId=crypto.randomUUID().replaceAll('-','_')
        rawObservation=null
        this.absences.set(observationId,{scopeId:scope.id,incarnation:nativeIncarnation});return {status:'absent',observationId}}
      try{const root=await this.validObserved(found.value,scope)
        rawObservation=null;return {status:'present',root}}
      catch(reason){
        if(cell.retired||scope.signal.aborted||now()>=scope.deadline)throw reason
        return this.classifyCorrupt(found.physical,scope,2,stableId(found.value))
      }
      }finally{if(ownHandle){db.close();cell.db=undefined}}
    })()
    void work.then(()=>{
      if(cell.outcome==='pending'&&!cell.rawPending&&!cell.tx){cell.outcome='error';cell.finish()}
    },()=>{
      if(cell.outcome==='pending'&&!cell.rawPending&&!cell.tx){cell.outcome='error';cell.finish()}
    })
    try{return await deadline(cell,work)}
    finally{
      scope.signal.removeEventListener('abort',cancel)
      if(TrainingStore.documentBarrier===cell&&cell.outcome!=='pending')
        TrainingStore.documentBarrier=null
      void cell.done.then(()=>{if(TrainingStore.documentBarrier===cell)
        TrainingStore.documentBarrier=null})
    }
  }

  /** Synchronous first-paint callback runs while deletion is ordered behind this data lock. */
  async admit<T>(scope:OperationScope,publish:(root:TrainingRoot)=>T):Promise<T> {
    if(scope.kind!=='ordinary')throw Error('Settlement cannot publish training controls')
    scope.check();await verifyBank();scope.check()
    return this.operate('admit',scope,cell=>exclusive(DATA_LOCK,cell,async()=>{
      const db=await this.db(cell)
      if(!db)throw new Changed('Training installation absent')
      try {
        const found=await observed(db,cell)
        if(!found.present)throw new Changed('Training root absent')
        const root=await this.validObserved(found.value,cell.scope)
        check(cell)
        const publication=publish(root)
        check(cell)
        return publication
      } finally {db.close()}
    }))
  }
  /** One continuous DATA generation carries exact source, W terminal truth and new Q2 paint. */
  async commitLive<T>(expected:TrainingRoot,command:LiveCommand,scope:OperationScope,
    publish:(root:TrainingRoot)=>T):Promise<{root:TrainingRoot;publication:T}>{
    if(scope.kind!=='ordinary')throw Error('Settlement cannot use live publication')
    // A hand-built object has no command custody, even if its fields happen
    // to resemble a legal command. The recognized envelope is immutable.
    if(!isLiveEnvelope(command))throw new Changed('Unrecognized live command')
    scope.check();await verifyBank();scope.check()
    return this.operate('live',scope,cell=>exclusive(DATA_LOCK,cell,async()=>{
      check(cell)
      const proof=this.recognized(expected)
      if(!this.#validatedFragments)throw new Changed('Live fragments unavailable')
      const body=(await ownJson(command.body,cell.scope)).value as Record<string,unknown>
      const fields=(value:unknown,expectedKeys:string[])=>!!value&&
        typeof value==='object'&&!Array.isArray(value)&&
        Reflect.ownKeys(value).length===expectedKeys.length&&
        expectedKeys.every(key=>Object.hasOwn(value,key))
      if(!fields(command,['kind','attemptId','roundIndex','record','body','requestId',
        'payloadDigest','expectedRootRevision'])||
        !fields(body,['attemptId','attemptRevision','roundId','chainRevision','record',
          'captureTicket']))throw new Changed('Live command fields changed')
      await validatePart(command.requestId,'id',cell.scope)
      await validatePart(command.attemptId,'id',cell.scope)
      await validatePart(body.roundId,'id',cell.scope)
      await validatePart(command.payloadDigest,'hash',cell.scope)
      await validatePart(command.record,'record',cell.scope)
      const attempt=proof.attempts[command.attemptId]
      const round=attempt?.rounds[command.roundIndex]
      const linked=attempt?.attachment.chainId as string|undefined
      const expectedChain=linked?proof.chains[linked]?.revision:null
      if(!attempt||!round||!Number.isSafeInteger(command.roundIndex)||
        command.roundIndex<0||command.roundIndex>1||
        command.expectedRootRevision!==proof.revision||
        body.attemptRevision!==attempt.revision||
        expectedChain===undefined||body.chainRevision!==expectedChain||
        body.roundId!==round.id||
        !fields(body.captureTicket,['ownerGeneration','captureOrder','offsetUs','withdrawal']))
        throw new Changed('Live source or capture linkage changed')
      const ticket=body.captureTicket as Record<string,unknown>
      const original=liveCapture(command)
      if(!Number.isSafeInteger(ticket.ownerGeneration)||
        (ticket.ownerGeneration as number)<1||(ticket.ownerGeneration as number)>1000000||
        !Number.isSafeInteger(ticket.captureOrder)||
        (ticket.captureOrder as number)<1||(ticket.captureOrder as number)>1000000||
        !Number.isSafeInteger(ticket.offsetUs)||(ticket.offsetUs as number)<0||
        ticket.withdrawal!==null||!original||
        !Number.isFinite(original.atPerformanceMs)||
        !original.isCurrent()||
        original.requestId!==command.requestId||
        original.digest!==command.payloadDigest||
        !exactJson(ticket,original.ticket,cell.scope)||
        Math.floor((ticket.offsetUs as number)/1000)!==command.record.elapsedMs)
        throw new Changed('Live capture ticket changed')
      const legalKind=command.record.kind==='board_onset'?'onset':
        ['move','undo','reset'].includes(command.record.kind)?'append':
        ['plan_step','plan_undo','plan_clear','plan_confirm','planning_release',
          'checkpoint_ack','tracking_answer','tracking_continue'].includes(command.record.kind)?
          'coach_live':null
      if(!legalKind||command.kind!==legalKind||
        command.record.kind==='board_onset'&&command.record.elapsedMs!==0||
        Object.hasOwn(proof.requests,command.requestId))
        throw new Changed('Live kind or request changed')
      if(body.attemptId!==command.attemptId||
        body.roundId!==command.record.roundId||
        !exactJson(body.record,command.record,cell.scope))
        throw new Changed('Live command body changed')
      const digest=await scopedDigest({kind:command.kind==='onset'?'append':command.kind,
        installationId:proof.installationId,expectedRootRevision:proof.revision,body},cell.scope)
      if(digest!==command.payloadDigest)throw new Changed('Live command digest changed')
      const fragments=this.#validatedFragments
      const next=await liveCandidate(proof,command,fragments,cell.scope)
      check(cell)
      const db=await this.db(cell)
      if(!db)throw new Changed('Training installation absent')
      try{
        const tx=db.transaction([...PARTITION_STORES],'readwrite')
        const completed=register(tx,cell)
        const submitted=new Promise<void>((resolve,reject)=>{
          comparePhysical(tx,proof,cell.scope,()=>{
            try{
              check(cell)
              if(!original.isCurrent())throw new Changed('Captured owner withdrew before put')
              putLive(tx,next,command.attemptId,command.requestId,()=>{cell.submitted=true})
              resolve()
            }catch(error){try{tx.abort()}catch{/* native outcome owns truth */}reject(error)}
          },reject)
        })
        try{await submitted}catch(error){await completed.catch(()=>undefined);throw error}
        await completed
        check(cell)
        this.#validatedRoot=next;this.#validatedFragments=fragments
        this.#observedOperationId=null
        const display=this.project(next)
        if(!original.isCurrent())throw new Changed('Captured owner withdrew before publication')
        const publication=publish(display)
        check(cell)
        return {root:display,publication}
      }finally{db.close();cell.db=undefined}
    }))
  }
  /** Fixed intent path; the caller cannot pass a mutable transform across P. */
  async commitIntent(expected:TrainingRoot,command:IntentCommand,
    scope:OperationScope):Promise<TrainingRoot>{
    if(scope.kind!=='ordinary')throw Error('Settlement cannot start a training board')
    if(!command||typeof command!=='object'||
      Reflect.ownKeys(command).length!==4||
      !['requestId','body','payloadDigest','expectedRootRevision']
        .every(key=>Object.hasOwn(command,key)))throw new Changed('Intent command fields changed')
    const owned=Object.freeze(structuredClone(command))
    scope.check();await verifyBank();scope.check()
    return this.operate('intent',scope,cell=>exclusive(DATA_LOCK,cell,async()=>{
      const proof=this.recognized(expected)
      if(this.#observedOperationId!==scope.id||!this.#validatedFragments)
        throw new Changed('Completed current intent proof unavailable')
      const body=(await ownJson(owned.body,cell.scope)).value
      const digest=await scopedDigest({kind:'intent',installationId:proof.installationId,
        expectedRootRevision:proof.revision,body},cell.scope)
      if(digest!==owned.payloadDigest)throw new Changed('Intent command digest changed')
      const fragments=this.#validatedFragments
      const next=await intentCandidate(proof,{...owned,body},fragments,cell.scope)
      check(cell)
      const db=await this.db(cell)
      if(!db)throw new Changed('Training installation absent')
      try{
        const tx=db.transaction([...PARTITION_STORES],'readwrite')
        const completed=register(tx,cell)
        const prepared=new Promise<void>((resolve,reject)=>{
          comparePhysical(tx,proof,cell.scope,()=>{
            try{
              check(cell)
              putLive(tx,next,(body as {attemptId:string}).attemptId,
                owned.requestId,()=>{cell.submitted=true})
              resolve()
            }catch(reason){try{tx.abort()}catch{};reject(reason)}
          },reject)
        })
        try{await prepared}catch(reason){await completed.catch(()=>undefined);throw reason}
        await completed
        check(cell)
        this.#validatedRoot=next;this.#validatedFragments=fragments
        this.#observedOperationId=null
        return this.project(next)
      }finally{db.close();cell.db=undefined}
    }))
  }
  /** Explicit fresh entry only. The creating transaction itself rechecks absence. */
  async initialize(observationId:string,scope:OperationScope):Promise<TrainingRoot> {
    if(scope.kind!=='ordinary')throw Error('Settlement cannot initialize training')
    scope.check();await verifyBank();scope.check()
    const absence=this.absences.get(observationId)
    if(!absence||absence.scopeId!==scope.id||absence.incarnation!==nativeIncarnation)
      throw new Changed('A completed absence observation in this operation is required')
    this.absences.delete(observationId)
    return this.operate('initialize',scope,cell=>exclusive(DATA_LOCK,cell,async()=>{
      const db = await this.db(cell,true)
      if (!db) throw Error('Training storage unavailable')
      try {
        const root = emptyRoot()
        const requestId=crypto.randomUUID().replaceAll('-','_')
        root.requests[requestId]={kind:'initialize',
          payloadDigest:await scopedDigest({kind:'initialize',installationId:null,
            expectedRootRevision:0,body:{absenceObservationId:observationId}},cell.scope),
          expectedRootRevision:0,outcome:{rootRevision:1,installationId:root.installationId,
            attemptId:null,chainId:null,status:'applied'}}
        const owned=await validateRoot(root,cell.scope)
        const fragments=new FragmentTree()
        await fragments.cold(owned,cell.scope)
        check(cell)
        const tx = db.transaction([...PARTITION_STORES],'readwrite')
        const completed = register(tx,cell)
        const prepared=new Promise<void>((resolve,reject)=>{
          readLogical(tx,current=>{
            try{check(cell)
              if(absence.incarnation!==nativeIncarnation)
                throw new Changed('Training storage incarnation changed')
              if(current!==null)throw new Changed('Training data already exists')
              putFull(tx,owned,()=>{cell.submitted=true})
              resolve()
            }catch(error){try{tx.abort()}catch{};reject(error)}
          },reject)
        })
        try{await prepared}catch(error){await completed.catch(()=>undefined);throw error}
        await completed;check(cell)
        this.#validatedRoot=owned
        this.#validatedFragments=fragments
        this.#observedOperationId=null
        return this.project(owned)
      } finally { db.close();cell.db=undefined }
    }))
  }
  /** Explicit corrupt-family reset, bound to an actual completed raw observation. */
  async resetCorrupt(token:string,scope:OperationScope):Promise<TrainingRoot> {
    if(scope.kind!=='ordinary')throw Error('Settlement cannot reset training')
    scope.check()
    const observation=rawObservation
    if(!observation||observation.kind==='pending'||
      observation.owner!==this.recoveryOwner||observation.token!==token)
      throw new Changed('A completed corrupt-root observation is required')
    if(observation.incarnation!==nativeIncarnation)
      throw new Changed('Training storage incarnation changed')
    if(rawByteJob)throw new Unconfirmed('Previous raw byte job is still pending')
    // Confirmation is one-use. A failed confirmation requires a new Check.
    rawObservation=null
    return this.operate('resetCorrupt',scope,cell=>exclusive(DATA_LOCK,cell,async()=>{
      const fresh=emptyRoot(),requestId=crypto.randomUUID().replaceAll('-','_')
      fresh.requests[requestId]={kind:'delete_all',payloadDigest:await scopedDigest({kind:'delete_all',
        installationId:observation.installationId,expectedRootRevision:observation.revision,
        body:{observedRootToken:token,
          recovery:observation.kind==='exact'?'exact':'current_corrupt'}},cell.scope),
        expectedRootRevision:observation.revision,
        outcome:{rootRevision:1,installationId:fresh.installationId,
          attemptId:null,chainId:null,status:'applied'}}
      const owned=await validateRoot(fresh,cell.scope)
      const fragments=new FragmentTree()
      await fragments.cold(owned,cell.scope)
      check(cell)
      const db=await this.db(cell)
      if(!db)throw new Changed('Training root disappeared')
      try{
        if(db.version!==observation.version)
          throw new Changed('Training storage version changed')
        const tx=db.transaction(observation.version===1?STORE:[...PARTITION_STORES],
          'readwrite'),completed=register(tx,cell)
        const nativeStore=tx.objectStore(observation.version===1?STORE:'meta')
        let requestCount=0
        let byteReady:false|{equal:boolean}=false
        let byteFailure:unknown=null
        let currentMatch:RawMatch|null=null
        const submitted=new Promise<void>((resolve,reject)=>{
          const refuse=(error:unknown)=>{try{tx.abort()}catch{/* native outcome owns truth */}
            reject(error)}
          const put=()=>{try{
            // No awaited work, caller hook or source getter may intervene here.
            check(cell)
            if(observation.incarnation!==nativeIncarnation)
              throw new Changed('Training storage incarnation changed')
            if(observation.version===1){nativeStore.put(owned,KEY);cell.submitted=true}
            else {
              // The first clear is the first submitted write. All seven
              // clears and the replacement image share this one W.
              for(const name of PARTITION_STORES){
                tx.objectStore(name).clear()
                cell.submitted=true
              }
              putFull(tx,owned,()=>{cell.submitted=true})
            }
            resolve()
          }catch(error){refuse(error)}}
          const tick=()=>{try{
            check(cell)
            if(byteFailure)throw byteFailure
            if(byteReady){if(!byteReady.equal)throw new Changed('Raw bytes or locator changed')
              put();return}
            if(++requestCount>256)throw new RawUnavailable('Raw recovery request capacity')
            const request=nativeStore.getKey(KEY)
            request.onerror=()=>refuse(request.error??Error('Raw keepalive request failed'))
            request.onsuccess=tick
          }catch(error){refuse(error)}}
          const inspect=(current:unknown)=>{try{
            check(cell)
            if(observation.incarnation!==nativeIncarnation)
              throw new Changed('Training storage incarnation changed')
            if(observation.version===1&&current===null)
              throw new Changed('Training root disappeared')
            if(observation.installationId!==null&&
              stableId(observation.version===1?current:
                physicalMeta(current as PhysicalImage))!==observation.installationId)
              throw new Changed('Training installation changed')
            if(observation.kind==='current'){
              let witnessed=false
              if(observation.witness?.kind==='physical-envelope'&&observation.version===2){
                try{logical(current as PhysicalImage)}catch{witnessed=true}
              }else if(observation.witness){
                try{witnessed=stillWitness(observation.version===1?current:
                  logical(current as PhysicalImage),observation.witness)}catch{/* current image changed */}
              }
              if(!witnessed)
                throw new Changed('Current training source is not proven corrupt')
              put();return
            }
            if(!observation.index)throw new Changed('Raw observation unavailable')
            currentMatch=compareRaw(observation.index,current,cell.scope)
            if(!currentMatch.equal)throw new Changed('Raw training source changed')
            if(!currentMatch.blobs.length&&!currentMatch.handles.length){put();return}
            // One main-loop W owns both the fixed-key keepalive and the only
            // current byte/locator job. Its promise never invokes put.
            const match=currentMatch
            tick()
            const job=(async()=>{
              for(const [oldHandle,newHandle] of match.handles){
                check(cell)
                if(!await oldHandle.isSameEntry(newHandle))return false
                check(cell)
              }
              if(match.blobs.length){
                const expected=observation.oldBytes
                if(!expected)return false
                const data=await new Blob(match.blobs).arrayBuffer()
                check(cell)
                if(data.byteLength!==expected.byteLength)return false
                const bytes=new Uint8Array(data)
                for(let i=0;i<bytes.length;i++){if(i%64===0)check(cell)
                  if(bytes[i]!==expected[i])return false}
              }
              return true
            })()
            rawByteJob=job
            void job.then(equal=>{byteReady={equal}},error=>{byteFailure=error})
            void job.finally(()=>{if(rawByteJob===job)rawByteJob=null}).catch(()=>undefined)
          }catch(error){refuse(error)}}
          if(observation.version===1){
            const cursor=nativeStore.openCursor()
            let count=0,first:unknown=null
            cursor.onerror=()=>refuse(cursor.error??Error('Raw reset read failed'))
            cursor.onsuccess=()=>{try{check(cell)
              const row=cursor.result
              if(row){count++;if(count!==1||row.key!==KEY)
                throw new Changed('Legacy physical locator changed')
                first=row.value;row.continue();return}
              if(count!==1)throw new Changed('Legacy physical source disappeared')
              inspect(first)
            }catch(error){refuse(error)}}
          }else readPhysical(tx,inspect,refuse)
        })
        try{await submitted}catch(error){await completed.catch(()=>undefined);throw error}
        await completed;check(cell)
        this.#validatedRoot=owned
        this.#validatedFragments=fragments
        this.#observedOperationId=null
        this.notice('replaced')
        return this.project(owned)
      }finally{db.close()}
    }))
  }
  /** Validated, exact-byte CAS. The transform is pure and runs before the final transaction. */
  async update(expected:TrainingRoot,transform:(root:TrainingRoot)=>Promise<TrainingRoot>,
    scope:OperationScope,
    kind:'source'|'delete'='source',deletedId?:string):Promise<TrainingRoot> {
    if(scope.kind==='settlement'&&kind==='delete')throw Error('Settlement cannot delete training')
    scope.check();await verifyBank();scope.check()
    let submitted=false
    try { return await this.operate(kind,scope,cell=>exclusive(DATA_LOCK,cell,async()=>{
      const proof=this.recognized(expected)
      if(this.#observedOperationId!==scope.id)
        throw new Changed('A completed current read in this operation is required')
      // The private read claim is scoped to this operation; the final native
      // cursor proves exact current equality before the one put.
      const source = proof
      const proposed = await transform(structuredClone(source))
      const next=await validateRoot(proposed,cell.scope)
      if (next.installationId === source.installationId && next.revision !== source.revision+1)
        throw Error('Training revision must advance once')
      check(cell)
      const db = await this.db(cell)
      if (!db) throw new Changed('Training installation absent')
      try {
        const tx = db.transaction([...PARTITION_STORES],'readwrite')
        const completed = register(tx,cell)
        const prepared=new Promise<void>((resolve,reject)=>readLogical(tx,current=>{
          try{check(cell)
            if(!current||!exactJson(current,proof,scope))throw new Changed()
            check(cell);putChanged(tx,source,next,()=>{submitted=true;cell.submitted=true})
            resolve()
          }catch(error){try{tx.abort()}catch{}reject(error)}
        },reject))
        try{await prepared}catch(error){await completed.catch(()=>undefined);throw error}
        await completed;check(cell)
        const fragments=new FragmentTree()
        await fragments.cold(next,cell.scope)
        this.#validatedRoot=next;this.#validatedFragments=fragments
        this.#observedOperationId=null
        if (kind === 'delete') this.notice(next.installationId !== source.installationId ? 'replaced':'deleted',deletedId)
        return this.project(next)
      } finally { db.close();cell.db=undefined }
    })) } catch(error) {
      if(!submitted && scope.signal.aborted)throw new RetiredBeforePut()
      throw error
    }
  }
  async claimReview(scope:OperationScope,onLost:()=>void):Promise<()=>void> {
    if (!navigator.locks) throw Error('Exclusive browser locks unavailable')
    scope.check()
    let resolve!: (release:()=>void)=>void, reject!: (reason:unknown)=>void
    const ready = new Promise<()=>void>((a,b)=>{resolve=a;reject=b})
    let released = false
    void navigator.locks.request(REVIEW_LOCK,{mode:'exclusive',ifAvailable:true},async lock=>{
      if (!lock || !scope.valid()) {reject(Error('Another training tab owns review'));return}
      await new Promise<void>(finish=>{
        const release=()=>{if(!released){released=true;scope.signal.removeEventListener('abort',release);finish()}}
        scope.signal.addEventListener('abort',release,{once:true})
        resolve(release)
        if(!scope.valid())release()
      })
    }).then(()=>{if(!released)onLost()},reject)
    return ready
  }
}
