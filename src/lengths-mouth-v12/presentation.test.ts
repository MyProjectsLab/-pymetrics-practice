import { beforeEach, describe, expect, it } from 'vitest'
import { faceSvg, fixationSvg } from './browser'
import { MOUTH_PRESENTATION_VERSION, advance, armHeadless, requiredDue, verifyHeadless } from './engine'
import { loadMouthForms } from './manifests'
import { MOUTH_DATABASE, MouthStore, freshMouthRoot, inspectMouthRoot } from './storage'
import type { MouthBackend, MouthRoot, StartRequest } from './storage'
import { MOUTH_DATABASE as LEGACY_DATABASE, MouthStore as LegacyStore, freshMouthRoot as freshLegacyRoot } from '../lengths-mouth/storage'
import type { MouthBackend as LegacyBackend, MouthRoot as LegacyRoot, StartRequest as LegacyRequest } from '../lengths-mouth/storage'

const profile = { kind:'keyboard', variant:'standard', deviceClass:'test', leftCode:'ArrowLeft', rightCode:'ArrowRight', alternative:false, contrast:'dark_on_light', magnification:'none', reducedMotion:false, presentationVersion:MOUTH_PRESENTATION_VERSION } as const
const context = { layoutWidthCssPx:1200, layoutHeightCssPx:900, visualWidthCssPx:1200, visualHeightCssPx:900, taskHostWidthCssPx:500, devicePixelRatio:1, browserFamily:'chromium', visibility:'visible', focused:true } as const
const request = (id:string):StartRequest => ({ requestId:id, sessionId:id, clockDomainId:id, profile, variant:'standard', route:'standalone', atMs:0, wallMs:1, displayContext:context })
const legacyRequest = (id:string):LegacyRequest => ({ ...request(id), profile:{kind:'keyboard',variant:'standard',deviceClass:'test',leftCode:'ArrowLeft',rightCode:'ArrowRight',alternative:false,contrast:'dark_on_light',magnification:'none',reducedMotion:false} })
class Backend implements MouthBackend {
 root=freshMouthRoot(); fail=false; lose=false
 async read(){return structuredClone(this.root)}
 async change<T>(op:(root:MouthRoot)=>T){if(this.fail)throw Error('write failed');const next=structuredClone(this.root),value=op(next);this.root=next;if(this.lose)throw Error('delivery lost');return value}
}
class LegacyMemory implements LegacyBackend {
 root=freshLegacyRoot()
 async read(){return structuredClone(this.root)}
 async change<T>(op:(root:LegacyRoot)=>T){const next=structuredClone(this.root),value=op(next);this.root=next;return value}
}
class Locks { request<T>(_name:string,_options:object,fn:(lock:object)=>Promise<T>){return fn({})} }
beforeEach(()=>Object.defineProperty(navigator,'locks',{configurable:true,value:new Locks()}))

describe('V1.2 presentation and separated saves',()=>{
 it('renders original complete face and fixation geometry with explicit palettes',()=>{
  const short=faceSvg('short',profile),long=faceSvg('long',profile),cross=fixationSvg(profile)
  expect(short).toContain('fill="#006153"')
  expect(short).toContain('r="11.5"')
  expect(short).toContain('x1="41" x2="79" y1="84"')
  expect(long).toContain('x1="38.5" x2="81.5" y1="84"')
  expect(cross).toContain('width="80" height="6"')
  expect(cross).toContain('width="6" height="80"')
  const inverse={...profile,contrast:'light_on_dark'} as const
  expect(faceSvg('short',inverse)).toContain('fill="#FFFFFF"')
  expect(faceSvg('short',inverse)).toContain('stroke="#111111"')
  expect(fixationSvg(inverse)).toContain('fill="#FFFFFF"')
 })
 it('rejects missing, unknown and extra presentation fields at new arm',async()=>{
  const form=(await loadMouthForms()).get('LM1')!
  const identity={installationId:'i',sessionId:'s',clockDomainId:'c',route:'standalone'} as const
  const state=armHeadless(form,identity,profile,0)
  expect(verifyHeadless(state)).toBe(true)
  for(const altered of [{...profile,presentationVersion:'future'},{...profile,presentationVersion:undefined},{...profile,unexpected:true}]){
   expect(()=>armHeadless(form,identity,altered as typeof profile,0)).toThrow()
  }
  const backend=new Backend(),store=new MouthStore(backend,backend.root.installationId)
  const before=JSON.stringify(backend.root)
  await expect(store.start({...request('unsupported'),profile:{...profile,presentationVersion:'future'} as unknown as typeof profile})).rejects.toThrow()
  expect(JSON.stringify(backend.root)).toBe(before)
 })
 it('uses independent roots, idempotent retry and legacy deletion without changing V1.2 bytes',async()=>{
  const newer=new Backend(),older=new LegacyMemory()
  const current=new MouthStore(newer,newer.root.installationId)
  const legacy=new LegacyStore(older,older.root.installationId)
  const old=await legacy.start(legacyRequest('same'))
  const fresh=await current.start(request('same'))
  expect(MOUTH_DATABASE).not.toBe(LEGACY_DATABASE)
  expect(fresh.profile.presentationVersion).toBe(MOUTH_PRESENTATION_VERSION)
  expect(newer.root.version).toBe('lengths_mouth_storage_v1_2')
  expect(older.root.version).toBe('lengths_mouth_storage_v1')
  expect(await current.start(request('same'))).toEqual(fresh)
  expect(newer.root.counters.standard).toBe(1)
  const newBytes=JSON.stringify(newer.root)
  await legacy.deleteAttempt(old.sessionId)
  expect(JSON.stringify(newer.root)).toBe(newBytes)
  expect(older.root.counters.standard).toBe(1)
  await legacy.deleteAll()
  expect(JSON.stringify(newer.root)).toBe(newBytes)
  await inspectMouthRoot(newer.root)
 })
 it('isolates new-first arms and failed/undelivered V1.2 writes from legacy bytes',async()=>{
  const newer=new Backend(),older=new LegacyMemory()
  const current=new MouthStore(newer,newer.root.installationId)
  const legacy=new LegacyStore(older,older.root.installationId)
  newer.fail=true
  await expect(current.start(request('first'))).rejects.toThrow()
  expect(newer.root.counters.standard).toBe(0)
  newer.fail=false;newer.lose=true
  const fresh=await current.start(request('first'))
  expect(fresh.ordinal).toBe(1)
  expect(newer.root.counters.standard).toBe(1)
  const newBytes=JSON.stringify(newer.root)
  const old=await legacy.start(legacyRequest('first'))
  expect(old.ordinal).toBe(1)
  expect(JSON.stringify(newer.root)).toBe(newBytes)
  const oldBytes=JSON.stringify(older.root)
  newer.lose=false
  await current.deleteAttempt(fresh.sessionId)
  expect(JSON.stringify(older.root)).toBe(oldBytes)
  await current.deleteAll()
  expect(JSON.stringify(older.root)).toBe(oldBytes)
 })
 it('preserves the frozen 90-trial report arithmetic under new profile',async()=>{
  const form=(await loadMouthForms()).get('LM1')!
  let state=armHeadless(form,{installationId:'i',sessionId:'s',clockDomainId:'c',route:'standalone'},profile,0)
  state=advance(state,{kind:'start',atMs:0,responseHeld:false})
  for(let index=0;index<90;index++){
   if(state.phase==='break')state=advance(state,{kind:'continue',atMs:state.commands.at(-1)!.atMs,responseHeld:false})
   for(const kind of ['fixation','onset','remove','resolve','feedback','offset'] as const)state=advance(state,{kind,atMs:requiredDue(state)!})
  }
  expect(state.phase).toBe('completed')
  expect(state.bankedCents).toBe(0)
  expect(verifyHeadless(state)).toBe(true)
  expect(state.events.filter(event=>event.type==='trial_closed')).toHaveLength(90)
 })
})
