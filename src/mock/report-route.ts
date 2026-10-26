import { assertAuthority } from './authority'
import type { Classification, Game, NativeArm, NativeReference } from './contract'
import { MockStore, withMockDataOrder } from './storage'
import { withSourceProjection } from './sources'

const opaque=/^[A-Za-z0-9._-]{1,180}$/
let reportDocumentRetired=false
if(typeof window!=='undefined'){
 window.addEventListener('pagehide',()=>{reportDocumentRetired=true})
 window.addEventListener('pageshow',event=>{if(event.persisted&&new URLSearchParams(location.search).has('mockReport'))location.reload()})
}
export function reportDocumentCurrent(){return !reportDocumentRetired}
function requireReportDocument(){if(reportDocumentRetired)throw Error('Report document was retired')}
export function reportHint():{mockId:string;slot:number}|null{
 const q=new URLSearchParams(location.search),mockId=q.get('mockReport'),value=q.get('slot')
 if(!mockId&&!value)return null
 if(!mockId||!opaque.test(mockId)||!value||!/^(?:[1-9]|1[0-2])$/.test(value))throw Error('Invalid saved report link')
 return {mockId,slot:Number(value)}
}
export function reportUrl(mockId:string,slot:number,game:Game){
 const path:Partial<Record<Game,string>>={arrows:'/arrows.html',lengths:'/mouth-v13.html',money_1:'/money.html',money_2:'/money2.html',faces:'/faces.html'}
 return `${path[game]??'/mock/report'}?mockReport=${encodeURIComponent(mockId)}&slot=${slot}`
}
export type ReportTarget={mockId:string;slot:number;game:Game;launchId:string;attemptId:string;arm:NativeArm;classification:Classification;reference:NativeReference}
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b)
async function assertSelected(store:MockStore,signal:AbortSignal,target:ReportTarget){
 const root=await store.readWithinOrder(signal),mock=root.mocks.find(item=>item.id===target.mockId)
 const slot=mock?.slots[target.slot-1],attempt=slot?.attempts.find(item=>item.launchId===slot.acceptedLaunchId)??slot?.attempts.findLast(item=>item.reference!==null)
 if(!slot||slot.game!==target.game||!attempt||attempt.launchId!==target.launchId||!same(attempt.reference,target.reference)||
   !same(attempt.nativeArm,target.arm)||attempt.classification!==target.classification)
  throw Error('Mock report reference changed')
}
export async function verifiedReportTarget(hint:{mockId:string;slot:number}):Promise<ReportTarget>{
 const store=await MockStore.openRetained()
 try{
  return await withMockDataOrder(async signal=>{
   const root=await store.readWithinOrder(signal),mock=root.mocks.find(item=>item.id===hint.mockId),slot=mock?.slots[hint.slot-1]
   if(!mock||!slot||slot.index!==hint.slot)throw Error('Mock history is unavailable')
   const attempt=slot.attempts.find(item=>item.launchId===slot.acceptedLaunchId)??slot.attempts.findLast(item=>item.reference!==null)
   if(!attempt?.nativeArm||!attempt.reference)throw Error('This game has no saved report reference')
   return withSourceProjection(slot.game,attempt.nativeArm,attempt.settingsRevision,async source=>{
    if(JSON.stringify(source.reference)!==JSON.stringify(attempt.reference)||source.classification!==attempt.classification)
     throw Error('The saved game result changed or is unavailable')
    const latest=await store.readWithinOrder(signal),current=latest.mocks.find(item=>item.id===hint.mockId)?.slots[hint.slot-1]
    const selected=current?.attempts.find(item=>item.launchId===current.acceptedLaunchId)??current?.attempts.findLast(item=>item.reference!==null)
    if(!current||selected?.launchId!==attempt.launchId||!same(selected.reference,attempt.reference))
     throw Error('Mock history changed while opening this report')
    return {mockId:hint.mockId,slot:hint.slot,game:slot.game,launchId:attempt.launchId,attemptId:attempt.reference!.attemptId,
      arm:structuredClone(attempt.nativeArm!),classification:attempt.classification,reference:structuredClone(attempt.reference!)}
   },signal)
  })
 }finally{store.close()}
}
/** Report bytes are published inside the mock→native source order for the exact
 * admitted public identity. Native views retain their own payload and renderer. */
export async function withVerifiedReportPublication<T>(target:ReportTarget,publish:(permit:()=>void)=>Promise<T>|T):Promise<T>{
 const store=await MockStore.openRetained()
 try{return await withMockDataOrder(async signal=>{
  requireReportDocument()
  await assertSelected(store,signal,target)
  return withSourceProjection(target.game,target.arm,target.reference.settingsRevision,async(source,sourceSignal)=>{
   if(!same(source.reference,target.reference)||source.classification!==target.classification)
    throw Error('Native report reference changed')
   await assertSelected(store,signal,target);requireReportDocument();assertAuthority(signal);assertAuthority(sourceSignal)
   let current=true
   const permit=()=>{if(!current)throw Error('Report publication retired');requireReportDocument();assertAuthority(signal);assertAuthority(sourceSignal)}
   let result:T
   try{result=await publish(permit)}finally{current=false}
   await assertSelected(store,signal,target);requireReportDocument();assertAuthority(signal);assertAuthority(sourceSignal)
   return result
  },signal)
 })}finally{store.close()}
}
/** For a native view whose own publication already holds and validates its
 * native gate. This holds the outer mock order through that publication. */
export async function withSelectedMockReportPublication<T>(target:ReportTarget,publish:(permit:()=>void)=>Promise<T>):Promise<T>{
 const store=await MockStore.openRetained()
 try{return await withMockDataOrder(async signal=>{
  requireReportDocument()
  await assertSelected(store,signal,target);assertAuthority(signal)
  let current=true
  const permit=()=>{if(!current)throw Error('Report publication retired');requireReportDocument();assertAuthority(signal)}
  let result:T
  try{result=await publish(permit)}finally{current=false}
  await assertSelected(store,signal,target);requireReportDocument();assertAuthority(signal)
  return result
 })}finally{store.close()}
}
/** Mounted report authority check. It never runs in protected play and starts
 * no queued check while one source-ordered observation is in flight. */
export function monitorReportTarget(target:ReportTarget,withdraw:()=>void):()=>void{
 let live=true,inFlight=false
 const check=async()=>{if(!live||inFlight||document.visibilityState!=='visible'||!document.hasFocus())return
  inFlight=true
  try{await withVerifiedReportPublication(target,()=>{})}
  catch{if(live){live=false;withdraw()}}
  finally{inFlight=false}
 }
 const timer=window.setInterval(()=>void check(),250),focus=()=>void check()
 window.addEventListener('focus',focus);window.addEventListener('pageshow',focus)
 document.addEventListener('visibilitychange',focus)
 return()=>{live=false;window.clearInterval(timer);window.removeEventListener('focus',focus);window.removeEventListener('pageshow',focus);document.removeEventListener('visibilitychange',focus)}
}
