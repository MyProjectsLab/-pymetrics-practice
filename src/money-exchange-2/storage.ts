import { assertAuthority, onAuthorityClose, withNativeObservation } from '../mock/authority'
import type { NativeLossHandler } from '../mock/authority'
import { NativePresenceError, requireObservedNativeVersion } from '../mock/native-presence'
import { openNativeForMock, validateObservedNative } from '../mock/native-presence'
import { assert, initialRoot, transition, validateRoot, migrate, VERSION, readback } from './core'
import { openExistingNativeDatabase, readExistingNativeKey } from '../mock/native-presence'
import type { Command, Root, Readback } from './core'
import { validCompleted } from './core'
import { sourceReference } from '../mock/reference'
import type { NativeArm, NativeReference } from '../mock/contract'
export const DB_NAME='assessment-practice-money-exchange-2-v1'
export const DATA_LOCK='assessment-practice-money-exchange-2-data-v1'
export const OWNER_LOCK='assessment-practice-money-exchange-2-owner-v1'
export const DELIVERY_MS=2000
export interface Backend { read(signal:AbortSignal):Promise<Root>;change(fn:(root:Root)=>Root,signal:AbortSignal):Promise<void>;close():void }
export async function ordered<T>(work:(signal:AbortSignal)=>Promise<T>):Promise<T> {
 assert(!!navigator.locks,'Local storage ordering is unavailable')
 const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),DELIVERY_MS)
 const aborted=new Promise<never>((_,reject)=>controller.signal.addEventListener('abort',()=>reject(Error('Local save status needs checking')),{once:true}))
 try {return await Promise.race([navigator.locks.request(DATA_LOCK,{signal:controller.signal},()=>Promise.race([work(controller.signal),aborted])),aborted])}
 finally{clearTimeout(timeout)}
}
class NativeBackend implements Backend {
 private db:IDBDatabase;private recovery:boolean;constructor(db:IDBDatabase,recovery=false){this.db=db;this.recovery=recovery}
 close(){this.db.close()}
 tx(write:boolean,fn:(root:Root)=>Root,signal:AbortSignal):Promise<Root>{
  assert(!signal.aborted,'Canceled transaction')
  return new Promise((resolve,reject)=>{
   const tx=this.db.transaction('installation',write?'readwrite':'readonly');let result:Root;
   const abort=()=>{try{tx.abort()}catch{/* already committed */}}
   signal.addEventListener('abort',abort,{once:true})
   const store=tx.objectStore('installation'),key=store.getKey('root');
   key.onsuccess=()=>{if(signal.aborted){abort();return}if(key.result===undefined){if(write&&this.recovery){try{result=fn(undefined as unknown as Root);store.put(result,'root')}catch(e){reject(e);abort()}return}reject(Error('Local root is missing'));abort();return}
    const get=store.get('root');get.onsuccess=()=>{try{assert(!signal.aborted,'Canceled read');result=fn(get.result as Root);if(write&&result!==get.result)store.put(result,'root')}catch(e){reject(e);abort()}}
   }
   tx.oncomplete=()=>{signal.removeEventListener('abort',abort);if(signal.aborted)reject(Error('Transaction delivery unconfirmed'));else resolve(structuredClone(result))}
   tx.onerror=tx.onabort=()=>{signal.removeEventListener('abort',abort);reject(tx.error??Error('Local transaction not confirmed'))}
  })
 }
 read(signal:AbortSignal){return this.tx(false,x=>x,signal)}
 async change(fn:(root:Root)=>Root,signal:AbortSignal){await this.tx(true,fn,signal)}
}
let pendingOpens=0
async function nativeOpen(recovery=false):Promise<Backend>{
 assert(pendingOpens<2,'Database opening remains unresolved. Reload before retrying.');pendingOpens++
 return new Promise((resolve,reject)=>{
  let ended=false,created=false,db:IDBDatabase|null=null,tx:IDBTransaction|null=null;
  const finish=(value?:Backend,error?:unknown)=>{if(ended){value?.close();return}ended=true;clearTimeout(timer);if(value)resolve(value);else{try{tx?.abort()}catch{/* committed */}db?.close();reject(error)}}
  const timer=setTimeout(()=>finish(undefined,Error('Database opening was not confirmed')),DELIVERY_MS)
  const request=indexedDB.open(DB_NAME,2)
  request.onupgradeneeded=event=>{created=event.oldVersion===0;if(created)request.result.createObjectStore('installation')}
  request.onerror=()=>{pendingOpens--;finish(undefined,request.error)}
  request.onsuccess=()=>{pendingOpens--;db=request.result;db.onversionchange=()=>db?.close();if(ended){db.close();return}
   try{tx=db.transaction('installation','readwrite');const store=tx.objectStore('installation'),key=store.getKey('root');
    key.onsuccess=()=>{if(ended)return;if(key.result===undefined){if(created)store.put(initialRoot(),'root');else if(!recovery)finish(undefined,Error('Existing database has no root'))}}
    tx.oncomplete=()=>finish(new NativeBackend(db!,recovery));tx.onerror=tx.onabort=()=>finish(undefined,tx?.error??Error('Initialization failed'))
   }catch(e){finish(undefined,e)}
  }
 })
}
export class Store {
 readonly backend:Backend;readonly installationId:string;private constructor(backend:Backend,installationId:string){this.backend=backend;this.installationId=installationId}
 static async open(backend?:Backend){const chosen=backend??await nativeOpen();try{
  let root=await ordered(signal=>chosen.read(signal));if(root.version!==VERSION){await ordered(signal=>chosen.change(value=>migrate(value),signal));root=await ordered(signal=>chosen.read(signal))}validateRoot(root);return new Store(chosen,root.installationId)
 }catch(e){chosen.close();throw e}}
  static openForMock(parent?:AbortSignal,allowCreate=true){return openNativeForMock(DB_NAME,2,db=>{db.createObjectStore('installation').put(initialRoot(),'root')},signal=>this.openRetained(signal),parent,allowCreate)}
 static async openRetained(signal:AbortSignal):Promise<Store>{
  const db=await openExistingNativeDatabase(DB_NAME,signal),backend=new NativeBackend(db,false)
  try{if(db.version!==2)throw new NativePresenceError('unsupported','Native source database version is unsupported');const raw=await readExistingNativeKey(db,'installation','root',signal) as Root
   signal.throwIfAborted();requireObservedNativeVersion(raw,'version',[VERSION]); validateObservedNative(()=>validateRoot(raw))
   return new Store(backend,raw.installationId)
  }catch(e){backend.close();throw e}
 }
 async execute(command:Command):Promise<Readback>{const immutable=structuredClone(command);let result:Readback={status:'absent'};await ordered(signal=>this.backend.change(root=>{
  validateRoot(root);assert(root.installationId===this.installationId,'Installation changed');result=readback(root,immutable);if(result.status!=='absent')return root;
  const next=transition(root,immutable);if(!next.outcome.accepted){result={status:'rejection'};return root}validateRoot(next.root);result=readback(next.root,immutable);return next.root
 },signal));return result}

 async publish(fn:(root:Root)=>void){await ordered(async signal=>{const root=await this.backend.read(signal);assert(!signal.aborted,'Read expired');validateRoot(root);assert(root.installationId===this.installationId,'Installation changed');fn(root)})}
 /** Source-owned public projection under the existing data order. */
 async withMockBridge<T>(arm:NativeArm,settingsRevision:number,commit:(source:{classification:'normal_complete'|'invalid'|'incomplete'|'no_arm';reference:NativeReference|null},signal:AbortSignal)=>Promise<T>,parent:AbortSignal):Promise<T>{
  return Store.observeForMock(arm,settingsRevision,commit,parent)
 }

 static async observeForMock<T>(arm:NativeArm,settingsRevision:number,commit:(source:{classification:'normal_complete'|'invalid'|'incomplete'|'no_arm';reference:NativeReference|null},signal:AbortSignal)=>Promise<T>,parent:AbortSignal,loss?:NativeLossHandler<T>):Promise<T>{
  return withNativeObservation(DATA_LOCK,async signal=>{
   const store=await Store.openRetained(signal);let remove=()=>{}
   try{remove=onAuthorityClose(signal,()=>store.close());return await store.projectForMock(arm,settingsRevision,commit,signal)}finally{remove();store.close()}
  },parent,loss)
 }
 private async projectForMock<T>(arm:NativeArm,settingsRevision:number,commit:(source:{classification:'normal_complete'|'invalid'|'incomplete'|'no_arm';reference:NativeReference|null},signal:AbortSignal)=>Promise<T>,signal:AbortSignal):Promise<T>{
   const inspect=async()=>{
    const root=await this.backend.read(signal);assert(!signal.aborted,'Mock observation retired');validateObservedNative(()=>validateRoot(root))
    if(root.installationId!==this.installationId||root.installationId!==arm.installationId||root.generation!==arm.generation)throw new NativePresenceError('replaced','Money Exchange 2 native generation changed')
    assert(arm.attemptId===null&&!!arm.originTicketId,'Money Exchange 2 native arm identity invalid')
    const outcome=root.outcomes[arm.requestId],allocatedId=outcome?.result.attemptId
    if(!outcome){
     const retired=root.retired[arm.requestId]
     if(retired?.attemptId&&root.tombstones[retired.attemptId])throw new NativePresenceError('deleted','Money Exchange 2 result deleted')
     return {classification:'no_arm' as const,reference:null}
    }
    if(allocatedId&&root.tombstones[allocatedId])throw new NativePresenceError('deleted','Money Exchange 2 result deleted')
    const attempt=allocatedId?root.attempts[allocatedId]:undefined
    assert(attempt&&!root.tombstones[attempt.id]&&outcome?.command.kind==='arm'&&outcome.result.attemptId===attempt.id&&attempt.originTicketId===arm.originTicketId&&outcome.command.ticketId===arm.originTicketId,'Money Exchange 2 arm proof missing')
    const reference=sourceReference({game:'money_2',arm,attemptId:attempt.id,settingsRevision,formId:attempt.formId,formHash:attempt.formDigest,
     recorded:{event:attempt.events[0]?.version}})
    const classification:'normal_complete'|'invalid'|'incomplete'=validCompleted(attempt)?'normal_complete':attempt.status==='Incomplete'?'invalid':'incomplete'
    return {classification,reference}
   }
   const before=await inspect();assertAuthority(signal);return commit(before,signal)
 }
 close(){this.backend.close()}
}
export async function ownerLock(onLoss:()=>void):Promise<()=>void>{
 assert(!!navigator.locks,'Exclusive play is unavailable');let release:(()=>void)|undefined,done=false;
 let rejectOpen!:(e:unknown)=>void;
 const opened=new Promise<()=>void>((resolve,reject)=>{rejectOpen=reject;
  void navigator.locks.request(OWNER_LOCK,{ifAvailable:true},async lock=>{
   if(!lock||done){reject(Error('Another Money Exchange 2 tab owns play'));return}
   await new Promise<void>(end=>{release=end;resolve(()=>{done=true;end()})})
  }).catch(e=>{reject(e);if(!done)onLoss()})
 });
 const timeout=setTimeout(()=>{done=true;release?.();rejectOpen(Error('Play ownership was not confirmed'))},DELIVERY_MS)
 try{return await opened}finally{clearTimeout(timeout)}
}
/** Explicit recovery deletion is usable even for present falsey/corrupt values.
 * It replaces the installation atomically and never silently initializes it. */
export async function clearDamaged(){const backend=await nativeOpen(true);try{await ordered(signal=>backend.change(()=>initialRoot(),signal))}finally{backend.close()}}
