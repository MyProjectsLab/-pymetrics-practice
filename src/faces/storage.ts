import { assertAuthority, onAuthorityClose, withNativeObservation } from '../mock/authority'
import type { NativeLossHandler } from '../mock/authority'
import { requireObservedNativeVersion } from '../mock/native-presence'
import { NativePresenceError, openNativeForMock, validateObservedNative } from '../mock/native-presence'
import {append,assertRequestIdentity,freshRoot,initialReady,invariant,manage,validateRoot} from './model'
import type {Command,Management,Receipt,Root} from './model'
import {Ownership,wipe} from './ownership'
import {openExistingNativeDatabase,requireExistingNativeKey} from '../mock/native-presence'
import type {NativeCarrier} from './ownership'
import {sourceReference} from '../mock/reference'
import type {NativeArm,NativeReference} from '../mock/contract'

const DB='assessment-practice-faces-v1',DATA='assessment-practice-faces-data-v1',OWNER='assessment-practice-faces-owner-v1'
const BUDGET=2000
let pendingOpens=0
const timeoutError=()=>Error('Save status could not be confirmed')
const normalized=(x:unknown):unknown=>Array.isArray(x)?x.map(normalized):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,normalized(v)])):x
const identical=(a:unknown,b:unknown)=>JSON.stringify(normalized(a))===JSON.stringify(normalized(b))

async function openDatabase():Promise<IDBDatabase>{
 invariant(pendingOpens<2,'Database opening remains unresolved');pendingOpens++
 return new Promise((resolve,reject)=>{
  let finished=false
  const request=indexedDB.open(DB,1)
  const timer=window.setTimeout(()=>{if(!finished){finished=true;reject(timeoutError())}},BUDGET)
  request.onupgradeneeded=(event)=>{if(event.oldVersion===0){const store=request.result.createObjectStore('installation');store.put(freshRoot(),'root')}}
  request.onsuccess=()=>{pendingOpens--;if(finished){request.result.close();return}finished=true;clearTimeout(timer);resolve(request.result)}
  request.onerror=()=>{pendingOpens--;if(finished)return;finished=true;clearTimeout(timer);reject(Error('Database opening failed'))}
 })
}
async function ordered<T>(operation:(signal:AbortSignal)=>Promise<T>,external?:AbortSignal):Promise<T>{
 invariant(!!navigator.locks,'Ordered local storage unavailable')
 const controller=new AbortController()
 const abort=()=>controller.abort();external?.addEventListener('abort',abort,{once:true});if(external?.aborted)controller.abort()
 const timer=window.setTimeout(()=>controller.abort(),BUDGET)
 const cancelled=new Promise<never>((_,reject)=>controller.signal.addEventListener('abort',()=>reject(timeoutError()),{once:true}))
 try{return await Promise.race([navigator.locks.request(DATA,{signal:controller.signal},()=>{invariant(!controller.signal.aborted,'Operation retired');return Promise.race([operation(controller.signal),cancelled])}),cancelled])}
 finally{clearTimeout(timer);external?.removeEventListener('abort',abort)}
}
export class Store {
 readonly ownership:Ownership
 private remember(root:Root){return this.ownership.importRoot(root)}
 private copy(root:Root){return this.remember(structuredClone(root))}
 private operations=new Map<Promise<unknown>,{owner:string|null;claim:string|null}>()
 private observe<T>(promise:Promise<T>,owner:string|null=null,claim:string|null=null):Promise<T>{this.operations.set(promise,{owner,claim});void promise.then(()=>this.operations.delete(promise),()=>this.operations.delete(promise));return promise}
 async drain(claim?:string){await this.ownership.drain(undefined,claim);await Promise.allSettled([...this.operations].filter(([,v])=>claim===undefined||v.claim===claim).map(([p])=>p))}
 async retire(id?:string){if(id)this.ownership.retire(id);else this.ownership.reset();await this.ownership.drain(id);await Promise.allSettled([...this.operations].filter(([,v])=>id===undefined||v.owner===id||v.owner===null).map(([p])=>p))}
 async revoke(claim:string){await this.ownership.revoke(claim);await Promise.allSettled([...this.operations].filter(([,v])=>v.claim===claim).map(([p])=>p))}
 own<T>(id:string,value:T){return this.ownership.own(id,value)}
 private tracked<T>(command:Command,dependency:Receipt['dependency'],run:(command:Command,proof:Receipt['dependency'],signal:AbortSignal)=>Promise<T>,readOnly=false):Promise<T>{
  const origin={owner:command.attemptId,claim:command.leaseId}
  this.own(origin.owner,command);if(dependency)this.own(origin.owner,dependency)
  const cell=this.own(origin.owner,{command:structuredClone(command),dependency:structuredClone(dependency)})
  if(this.ownership.retired.has(origin.owner)||!readOnly&&!this.ownership.allowed(origin.owner,origin.claim))return Promise.reject(timeoutError())
  return this.observe(ordered(signal=>{if(!cell.command||!readOnly&&!this.ownership.allowed(origin.owner,origin.claim))throw timeoutError();return run(cell.command,cell.dependency,signal)}).finally(clearTrackedFactory(cell)),origin.owner,origin.claim)
 }
 readonly db:IDBDatabase
 private constructor(db:IDBDatabase,ownership:Ownership){this.db=db;this.ownership=ownership;this.db.onversionchange=()=>this.db.close()}
 static async open(ownership=new Ownership()){const db=await openDatabase();const store=new Store(db,ownership);try{await store.read();return store}catch(e){db.close();throw e}}
 static openForMock(ownership=new Ownership(),parent?:AbortSignal,allowCreate=true){return openNativeForMock(DB,1,db=>{db.createObjectStore('installation').put(freshRoot(),'root')},signal=>this.openRetained(signal,ownership),parent,allowCreate)}
 static async openRetained(signal:AbortSignal,ownership=new Ownership()):Promise<Store>{
  const db=await openExistingNativeDatabase(DB,signal),store=new Store(db,ownership)
  try{if(db.version!==1)throw new NativePresenceError('unsupported','Native source database version is unsupported');await requireExistingNativeKey(db,'installation','root',signal);signal.throwIfAborted();
   // Validation occurs only in the existing registered source ingress.
   await store.publish(()=>null);signal.throwIfAborted();return store
  }catch(e){db.close();throw e}
 }
 close(){this.db.close()}
 private beginNative(write:boolean,owner:string|null,claim:string|null):NativeCarrier{
  invariant(!write||this.ownership.allowed(owner,claim),'Operation retired')
  const tx=this.db.transaction('installation',write?'readwrite':'readonly')
  const carrier:NativeCarrier={tx,requests:new Set(),owner,claim,epoch:this.ownership.epoch,write,settled:false,imported:new Set(),done:null!,finish:null!,cancel:null!}
  carrier.done=new Promise(done=>{carrier.finish=done});carrier.cancel=abortFactory(tx);this.ownership.native.add(carrier)
  tx.addEventListener('complete',nativeDoneFactory(this.ownership,carrier));tx.addEventListener('abort',nativeDoneFactory(this.ownership,carrier))
  return carrier
 }
 private putNative(carrier:NativeCarrier,root:Root){
  invariant(!carrier.settled&&this.ownership.allowed(carrier.owner,carrier.claim),'Operation retired')
  this.remember(root);const request=carrier.tx.objectStore('installation').put(root,'root');carrier.requests.add(request);return request
 }
 private transaction<T>(write:boolean,fn:(root:Root)=>{root?:Root;result:T},signal:AbortSignal,owner:string|null=null,claim:string|null=null,management=false):Promise<T>{
  invariant(!signal.aborted&&(!write||management||this.ownership.allowed(owner,claim)),'Operation retired')
  return new Promise((resolve,reject)=>{
   const carrier=this.beginNative(write,owner,claim),tx=carrier.tx
   const state:TransactionState<T>={store:this,carrier,signal,fn,management,result:undefined,committed:null,settled:false,resolve,reject}
   tx.addEventListener('abort',failureFactory(state))
   signal.addEventListener('abort',carrier.cancel,{once:true})
   const key=tx.objectStore('installation').getKey('root');carrier.requests.add(key)
   key.onsuccess=keyFactory(state,key)
   key.onerror=failureFactory(state)
   tx.oncomplete=completeFactory(state)
   tx.onabort=tx.onerror=failureFactory(state)
  })
 }
 // Called only synchronously by the native ingress factory. Private roots never
 // cross an unregistered validation/projection callback boundary.
 ingress<T>(state:TransactionState<T>,request:IDBRequest){
  if(state.settled||state.carrier.settled||state.carrier.imported.has(request)){this.ownership.importRoot(request.result,state.carrier.epoch);return}
  try{
   state.carrier.epoch=this.ownership.enter(request.result,state.carrier.epoch,state.carrier)
   const root=this.ownership.importRoot(request.result,state.carrier.epoch,state.management)
   state.carrier.imported.add(request)
   invariant(!state.signal.aborted,'Operation retired')
   requireObservedNativeVersion(root,'schema',['faces-root-v2','faces-root-v3']);validateObservedNative(()=>validateRoot(root));this.ownership.reconcile(root)
   invariant(state.carrier.epoch.live&&(!state.carrier.write||state.management||this.ownership.allowed(state.carrier.owner,state.carrier.claim)),'Operation retired')
   const output=state.fn(root)
   if(output.root&&(output.root.installationId!==root.installationId||output.root.generation!==root.generation))state.carrier.epoch=this.ownership.enter(output.root,state.carrier.epoch,state.carrier)
   if(output.root)this.remember(output.root)
   this.ownership.result(output.result,state.carrier.owner)
   if(state.carrier.write&&output.root&&output.root!==root){validateRoot(output.root);this.putNative(state.carrier,output.root)}
   state.committed=output.root??null;state.result=output.result
  }catch(error){state.reject(error instanceof NativePresenceError?error:timeoutError());state.settled=true;state.carrier.cancel()}
  finally{if(!state.carrier.epoch.live)this.ownership.importRoot(request.result,state.carrier.epoch);this.ownership.scrubRetired()}
 }
 read(owner:string|null=null,claim:string|null=null):Promise<Root>{return this.observe(ordered(signal=>this.transaction(false,root=>({result:this.copy(root)}),signal,owner,claim)),owner,claim)}
 /** The callback is synchronous while the shared data lock is held. It may update the owned DOM. */
 publish<T extends object|null|void>(fn:(root:Root)=>T,owner:string|null=null,claim:string|null=null):Promise<T>{return this.observe(ordered(signal=>this.transaction(false,root=>({result:fn(root)}),signal,owner,claim)),owner,claim)}
 /** Only public identity and terminal classification leave the registered ingress. */
 withMockBridge<T>(arm:NativeArm,settingsRevision:number,commit:(source:{classification:'normal_complete'|'invalid'|'incomplete'|'no_arm';reference:NativeReference|null},signal:AbortSignal)=>Promise<T>,parent:AbortSignal):Promise<T>{
  return Store.observeForMock(arm,settingsRevision,commit,parent)
 }

 static async observeForMock<T>(arm:NativeArm,settingsRevision:number,commit:(source:{classification:'normal_complete'|'invalid'|'incomplete'|'no_arm';reference:NativeReference|null},signal:AbortSignal)=>Promise<T>,parent:AbortSignal,loss?:NativeLossHandler<T>):Promise<T>{
  return withNativeObservation(DATA,async signal=>{
   const ownership=new Ownership(),db=await openExistingNativeDatabase(DB,signal),store=new Store(db,ownership)
   const cleanup=()=>{ownership.reset();store.close()};let remove=()=>{}
   try{
    remove=onAuthorityClose(signal,cleanup)
    if(db.version!==1)throw new NativePresenceError('unsupported','Native source database version is unsupported')
    await requireExistingNativeKey(db,'installation','root',signal)
    assertAuthority(signal)
    return await store.projectForMock(arm,settingsRevision,commit,signal)
   }finally{remove();cleanup()}
  },parent,loss)
 }
 private async projectForMock<T>(arm:NativeArm,settingsRevision:number,commit:(source:{classification:'normal_complete'|'invalid'|'incomplete'|'no_arm';reference:NativeReference|null},signal:AbortSignal)=>Promise<T>,signal:AbortSignal):Promise<T>{
   const project=()=>this.transaction<{attemptId:string;classification:'normal_complete'|'invalid'|'incomplete'|'no_arm';reference:NativeReference|null}>(false,root=>{
    if(root.installationId!==arm.installationId||root.generation!==arm.generation)throw new NativePresenceError('replaced','Faces generation changed')
    invariant(!!arm.attemptId,'Faces arm identity missing')
    const attempt=root.attempts.find(a=>a.id===arm.attemptId)
    if(!attempt){if(root.attemptFences.includes(arm.attemptId!))throw new NativePresenceError('deleted','Faces result deleted');return {result:{attemptId:arm.attemptId!,classification:'no_arm' as const,reference:null}}}
    invariant(attempt&&!root.attemptFences.includes(attempt.id)&&attempt.receipts[0]?.command.kind==='open'&&
      attempt.receipts[0].command.requestId===arm.requestId&&attempt.receipts[0].command.attemptId===arm.attemptId,
    'Faces opening receipt missing')
    const reference=sourceReference({game:'faces',arm,attemptId:attempt.id,settingsRevision,formId:attempt.formId,formHash:attempt.formHash,
     recorded:{scoring:attempt.scoringVersion,event:attempt.receipts[0].command.eventVersion,assetBankHash:attempt.assetBankHash},
     allowLegacyFaces:true})
    const classification:'normal_complete'|'invalid'|'incomplete'=attempt.status==='completed'&&attempt.facts.responses.length===14&&!!attempt.report?'normal_complete':
      attempt.status==='incomplete'?'invalid':'incomplete'
    return {result:{attemptId:attempt.id,classification,reference}}
   },signal)
   const before=await project();assertAuthority(signal);return commit({classification:before.classification,reference:structuredClone(before.reference)},signal)
 }
 change<T>(fn:(root:Root)=>{root:Root;result:T},management=false):Promise<T>{return this.observe(ordered(signal=>this.transaction(true,fn,signal,null,null,management)))}
 execute(command:Command,dependency:Receipt['dependency']=null):Promise<Root>{
  return this.tracked(command,dependency,(sealed,proof,signal)=>this.transaction(true,root=>{const next=append(root,sealed,proof);return {root:this.remember(next),result:next}},signal,sealed.attemptId,sealed.leaseId))
 }
 readback(command:Command):Promise<{status:'applied'|'absent'|'retired';root:Root}>{
  return this.tracked(command,null,(command,_proof,signal)=>this.transaction(false,root=>({result:(()=>{
   if(root.requestFences.some(x=>x.requestId===command.requestId)||root.attemptFences.includes(command.attemptId)||root.installationId!==command.installationId||root.generation!==command.generation)return {status:'retired' as const,root:this.copy(root)}
   assertRequestIdentity(root,command)
   const receipt=root.attempts.flatMap(a=>a.receipts).find(r=>r.command.requestId===command.requestId)
   if(!receipt){
    const attempt=root.attempts.find(a=>a.id===command.attemptId)
    if(command.kind!=='open'&&(!attempt||attempt.status!=='active'||root.route?.attemptId!==command.attemptId||root.route.lease!==command.leaseId||command.kind==='expiry'&&attempt.facts.responses.some(r=>r.item===command.payload.item)))return {status:'retired' as const,root:this.copy(root)}
    return {status:'absent' as const,root:this.copy(root)}
   }
   invariant(identical(receipt.command,command),'Conflicting command readback')
   return {status:'applied' as const,root:this.copy(root)}
  })()}),signal,command.attemptId,command.leaseId),true)
 }
 ready(leaseId:string,expectedInstallationId:string,expectedGeneration:number):Promise<Root>{return this.change(root=>{invariant(root.installationId===expectedInstallationId&&root.generation===expectedGeneration,'Ready generation changed');const next=initialReady(root,leaseId);return {root:next,result:next}})}
 opening(routeId:string,leaseId:string,requestId:string):Promise<Root>{return this.change(root=>{
  invariant(root.route?.id===routeId&&root.route.lease===leaseId&&root.route.state==='ready','Ready route unavailable')
  const next=this.copy(root);next.schema='faces-root-v3';next.route={...next.route!,state:'opening',pendingOpeningId:requestId};next.revision++
  return {root:next,result:next}
 })}
 abandonOpening(routeId:string,leaseId:string,requestId:string):Promise<Root>{return this.change(root=>{
  invariant(root.route?.id===routeId&&root.route.lease===leaseId&&root.route.state==='opening'&&root.route.pendingOpeningId===requestId&&root.route.attemptId===null,'Pending opening changed')
  const next=this.copy(root);next.schema='faces-root-v3';next.requestFences.push({requestId,kind:'open'});next.route={...next.route!,state:'idle',lease:null,pendingOpeningId:null};next.revision++
  return {root:next,result:next}
 })}
 manage(command:Management):Promise<Root>{
  const sealed=structuredClone(command)
  return this.change(root=>{const next=manage(root,sealed);return {root:next,result:next}},true)
 }

}
function clearTrackedFactory(cell:object){return ()=>wipe(cell)}
type TransactionState<T>={store:Store;carrier:NativeCarrier;signal:AbortSignal;fn:(root:Root)=>{root?:Root;result:T};management:boolean;result:T|undefined;committed:Root|null;settled:boolean;resolve:(value:T)=>void;reject:(error:Error)=>void}
function abortFactory(tx:IDBTransaction){return ()=>{try{tx.abort()}catch{/* finished native transaction */}}}
function nativeDoneFactory(ownership:Ownership,carrier:NativeCarrier){return ()=>{carrier.settled=true;carrier.finish();if([...carrier.requests].every(r=>r.readyState==='done'&&(carrier.imported.has(r)||r.error||typeof r.result!=='object')))ownership.native.delete(carrier)}}
function keyFactory<T>(state:TransactionState<T>,key:IDBRequest){return ()=>{
 if(state.settled||state.carrier.settled||state.carrier.imported.has(key))return
 state.carrier.imported.add(key)
 if(state.signal.aborted||key.result===undefined){failureFactory(state)();state.carrier.cancel();return}
 const get=state.carrier.tx.objectStore('installation').get('root');state.carrier.requests.add(get)
 get.onsuccess=ingressFactory(state,get);get.onerror=failureFactory(state)
}}
function ingressFactory<T>(state:TransactionState<T>,request:IDBRequest){return ()=>state.store.ingress(state,request)}
function failureFactory<T>(state:TransactionState<T>){return ()=>{state.signal.removeEventListener('abort',state.carrier.cancel);if(!state.settled){state.settled=true;state.reject(timeoutError())}}}
function completeFactory<T>(state:TransactionState<T>){return ()=>{state.signal.removeEventListener('abort',state.carrier.cancel);if(state.committed)state.store.ownership.reconcile(state.committed);if(!state.settled){state.settled=true;if(state.signal.aborted)state.reject(timeoutError());else state.resolve(state.result as T)}}}
export type OwnerRelease=()=>Promise<void>
export async function takeOwner():Promise<OwnerRelease>{
 invariant(!!navigator.locks,'Exclusive play unavailable')
 let release:(()=>void)|undefined,closed=false
 let rejectOpen!:(error:unknown)=>void,settledResolve!:()=>void
 const settled=new Promise<void>(resolve=>{settledResolve=resolve})
 const opened=new Promise<OwnerRelease>((resolve,reject)=>{
  rejectOpen=reject
  void navigator.locks.request(OWNER,{ifAvailable:true},async lock=>{
   if(!lock||closed){reject(Error('Another Faces tab owns play'));return}
   await new Promise<void>(done=>{release=done;resolve(()=>{closed=true;done();return settled})})
  }).then(settledResolve,error=>{settledResolve();reject(error)})
 })
 const timer=window.setTimeout(()=>{closed=true;release?.();rejectOpen(Error('Play ownership was not confirmed'))},BUDGET)
 try{return await opened}finally{clearTimeout(timer)}
}
