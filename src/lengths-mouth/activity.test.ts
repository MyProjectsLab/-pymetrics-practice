import { beforeEach, describe, expect, it } from 'vitest'
import { advance, requiredDue } from './engine'
import type { State } from './engine'
import { MouthStore, freshMouthRoot, inspectMouthRoot } from './storage'
import type { MouthBackend, MouthRoot, StartRequest } from './storage'
const request: StartRequest = {
 requestId:'activity',sessionId:'activity',clockDomainId:'activity',variant:'standard',route:'standalone',atMs:0,wallMs:1,
 profile:{kind:'keyboard',variant:'standard',deviceClass:'test',leftCode:'ArrowLeft',rightCode:'ArrowRight',alternative:false,contrast:'dark_on_light',magnification:'none',reducedMotion:false},
 displayContext:{layoutWidthCssPx:1280,layoutHeightCssPx:900,visualWidthCssPx:1280,visualHeightCssPx:900,taskHostWidthCssPx:450,devicePixelRatio:1,browserFamily:'chromium',visibility:'visible',focused:true},
}
class Backend implements MouthBackend {
 root=freshMouthRoot();fail=false;lose=false
 async read(){return structuredClone(this.root)}
 async change<T>(op:(root:MouthRoot)=>T){if(this.fail)throw Error('failed write');const next=structuredClone(this.root),value=op(next);this.root=next;if(this.lose)throw Error('undelivered commit');return value}
}
class Locks { request<T>(_name:string,_options:object,fn:(lock:object)=>Promise<T>){return fn({})} }
beforeEach(()=>Object.defineProperty(navigator,'locks',{configurable:true,value:new Locks()}))
function extend(state:State,count:number){let s=state;for(let n=0;n<count;n++){if(s.phase==='armed')s=advance(s,{kind:'start',atMs:0,responseHeld:false});if(s.phase==='break')s=advance(s,{kind:'continue',atMs:s.events.at(-1)!.atMs,responseHeld:false});for(const kind of ['fixation','onset','remove','resolve','feedback','offset'] as const)s=advance(s,{kind,atMs:requiredDue(s)!})}return s}
async function setup(){const backend=new Backend(),store=new MouthStore(backend,backend.root.installationId),arm=await store.start(request);return {backend,store,arm}}
describe('verified report activity bindings and historical acknowledgement',()=>{
 it('records arm-only revision zero exactly once without changing timed bytes or counters',async()=>{
  const {backend,store,arm}=await setup(),target=store.authority.published(arm),before=structuredClone(backend.root)
  expect((await store.loadReportViews(arm.sessionId,target)).status).toBe('legacy_absent')
  const event=await store.appendReportView(arm.sessionId,null,'armview','history',10,target)
  expect(event.resultRevision).toBe(0);expect(backend.root.attempts).toEqual(before.attempts);expect(backend.root.counters).toEqual(before.counters)
  expect(backend.root.revision).toBe(before.revision+1);const committed=JSON.stringify(backend.root)
  expect(await store.appendReportView(arm.sessionId,null,'armview','history',10,target)).toEqual(event)
  expect(JSON.stringify(backend.root)).toBe(committed);expect((await store.loadReportViews(arm.sessionId,target)).events).toEqual([event]);await inspectMouthRoot(backend.root)
 })
 it('acknowledges committed arm view after extension but rejects a new view of the stale arm',async()=>{
  const {backend,store,arm}=await setup(),old=store.authority.published(arm)
  const event=await store.appendReportView(arm.sessionId,null,'armview','history',10,old)
  await store.saveSnapshot(arm,extend(arm.state,30),0);const bytes=JSON.stringify(backend.root)
  expect(old.status().kind).toBe('retired');expect(await store.appendReportView(arm.sessionId,null,'armview','history',10,old)).toEqual(event)
  await expect(store.appendReportView(arm.sessionId,null,'newview','history',10,old)).rejects.toThrow()
  expect(JSON.stringify(backend.root)).toBe(bytes);await inspectMouthRoot(backend.root)
 })
 it('reconciles a checkpoint view through checkpoint and terminal extension, preserving old events and display retirement',async()=>{
  const {backend,store,arm}=await setup(),first=await store.saveSnapshot(arm,extend(arm.state,30),0),old=store.authority.published({...arm,snapshot:first})
  const event=await store.appendReportView(arm.sessionId,first,'oldview','history',10,old)
  const second=await store.saveSnapshot(arm,extend(first.state,30),first.revision);let bytes=JSON.stringify(backend.root)
  expect(await store.appendReportView(arm.sessionId,first,'oldview','history',10,old)).toEqual(event)
  expect(JSON.stringify(backend.root)).toBe(bytes);expect(()=>old.assertCurrent()).toThrow()
  await expect(store.appendReportView(arm.sessionId,first,'newstale','history',10,old)).rejects.toThrow()
  const current=store.authority.published({...arm,snapshot:second});await store.appendReportView(arm.sessionId,second,'secondview','history',20,current)
  const terminal=await store.saveSnapshot(arm,extend(second.state,30),second.revision),target=store.authority.published({...arm,snapshot:terminal}),timed=JSON.stringify(backend.root.attempts)
  bytes=JSON.stringify(backend.root);expect(await store.appendReportView(arm.sessionId,first,'oldview','history',10,old)).toEqual(event);expect(JSON.stringify(backend.root)).toBe(bytes)
  await store.appendReportView(arm.sessionId,terminal,'terminalview','live',30,target);expect(JSON.stringify(backend.root.attempts)).toBe(timed)
  expect(backend.root.activity?.activity.events.map(e=>e.resultRevision)).toEqual([1,2,3]);await inspectMouthRoot(backend.root)
 })
 it.each(['source','time'] as const)('rejects same view ID with changed %s before and after extension',async field=>{
  const {backend,store,arm}=await setup(),target=store.authority.published(arm)
  await store.appendReportView(arm.sessionId,null,'view','history',10,target)
  for(const extended of [false,true]){if(extended)await store.saveSnapshot(arm,extend(arm.state,30),0);const bytes=JSON.stringify(backend.root)
   await expect(store.appendReportView(arm.sessionId,null,'view',field==='source'?'live':'history',field==='time'?11:10,target)).rejects.toThrow('binding changed');expect(JSON.stringify(backend.root)).toBe(bytes)}
 })
 it('does not reuse an arm view ID for a later snapshot opening',async()=>{
  const {backend,store,arm}=await setup(),target=store.authority.published(arm);await store.appendReportView(arm.sessionId,null,'view','history',10,target)
  const snapshot=await store.saveSnapshot(arm,extend(arm.state,30),0),later=store.authority.published({...arm,snapshot}),bytes=JSON.stringify(backend.root)
  await expect(store.appendReportView(arm.sessionId,snapshot,'view','history',10,later)).rejects.toThrow('binding changed');expect(JSON.stringify(backend.root)).toBe(bytes)
 })
 it('recovers committed-undelivered activity, fails a new aborted write and retries the same binding',async()=>{
  const {backend,store,arm}=await setup(),target=store.authority.published(arm);backend.lose=true
  await store.appendReportView(arm.sessionId,null,'lost','history',10,target);expect(backend.root.activity?.activity.events).toHaveLength(1)
  backend.lose=false;backend.fail=true;const bytes=JSON.stringify(backend.root)
  await expect(store.appendReportView(arm.sessionId,null,'failed','history',20,target)).rejects.toThrow();expect(JSON.stringify(backend.root)).toBe(bytes)
  backend.fail=false;await store.appendReportView(arm.sessionId,null,'failed','history',20,target);expect(backend.root.activity?.activity.events).toHaveLength(2)
 })
 it.each(['individual','replacement'] as const)('%s retirement rejects both matching committed retries and new events without root changes',async mode=>{
  const {backend,store,arm}=await setup(),target=store.authority.published(arm);await store.appendReportView(arm.sessionId,null,'view','history',10,target)
  if(mode==='individual')await store.deleteAttempt(arm.sessionId);else await store.deleteAll();const bytes=JSON.stringify(backend.root)
  for(const id of ['view','newview'])await expect(store.appendReportView(arm.sessionId,null,id,'history',10,target)).rejects.toThrow()
  expect(JSON.stringify(backend.root)).toBe(bytes)
 })
 it('validates arm revision zero, rejects negative or inconsistent journal binding and retains positive legacy events',async()=>{
  const {backend,store,arm}=await setup(),target=store.authority.published(arm);await store.appendReportView(arm.sessionId,null,'view','history',10,target)
  const negative=structuredClone(backend.root);(negative.activity!.activity.events[0] as {resultRevision:number}).resultRevision=-1;await expect(inspectMouthRoot(negative)).rejects.toThrow()
  const inconsistent=structuredClone(backend.root);(inconsistent.activity!.activity as {resultRevision:number}).resultRevision=1;await expect(inspectMouthRoot(inconsistent)).rejects.toThrow()
 })
})
