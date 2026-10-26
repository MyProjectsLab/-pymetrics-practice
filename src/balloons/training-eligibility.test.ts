import { beforeAll, expect, it } from 'vitest'
import { webcrypto } from 'node:crypto'
import { loadScoredManifests } from './manifests'
import { drillId, loadDrillManifests } from './drill-manifests'
import type { DrillId, DrillManifest } from './drill-manifests'
import { createDrillAttempt, reconcileDrill } from './drills'
import type { DrillAttempt } from './drills'
import { createTrainingChain, completedDrillEligibility } from './training-eligibility'
import type { TrainingAuthority, TrainingChain } from './training-eligibility'
import { baseline, play, recommendation, step } from './training-test-support'
import { routeBaseline } from './router'
import type { Recommendation } from './router'
import type { DrillKind } from './training-evidence'
import type { Profile } from './contracts'

let manifests:ReadonlyMap<DrillId,DrillManifest>
const time={wallTimeMs:100000,monotonicMs:0,clockEpochId:'drill'}
beforeAll(async()=>{Object.defineProperty(globalThis,'crypto',{value:webcrypto,configurable:true});await loadScoredManifests();manifests=await loadDrillManifests()})
function setup(kind:DrillKind='maintenance',profile:Profile|null=null,k=0){
  const {root,rec}=recommendation(kind,profile),chain=createTrainingChain(rec),m=manifests.get(drillId(kind,profile))!
  const prepared=createDrillAttempt(rec,m,'d',[],time),done=play(prepared,()=>k)
  const authority:TrainingAuthority={root,chains:{chain},savedDrills:{d:done},deletedDrillIds:[],completedChainIds:[]}
  return {rec,root,chain,m,prepared,done,authority}
}
it.each([['outcome',null],['information',null],['updating',null],['consistency','A'],['consistency','B'],['consistency','C'],['maintenance',null]] as [DrillKind,Profile|null][])('%s/%s completion eligibility is independent of behavior and money', (kind,profile)=>{
  for(const k of [0,32]){const {chain,authority,done}=setup(kind,profile,k),before=JSON.stringify(authority),result=completedDrillEligibility(chain,'d',authority);expect(result.status).toBe('eligible');if(result.status!=='eligible')throw Error();expect(result.firstGrant).toBe(true);expect(result.chain.firstCompletedDrillId).toBe('d');expect(result.chain.recommendation).toEqual(chain.recommendation);expect(JSON.stringify(authority)).toBe(before);expect(done.journal.at(-1)!.type).toBe('drill_completed')}
})
it('headless completion is insufficient without saved authoritative bytes',()=>{
  const {chain,done,authority}=setup()
  expect(done.snapshot.phase).toBe('completed')
  expect(completedDrillEligibility(chain,'d',{...authority,savedDrills:{}})).toEqual({status:'ineligible',reason:'drill_missing_or_unsaved'})
  expect(completedDrillEligibility(chain,'d',{...authority,root:null}).status).toBe('ineligible')
})
it('first completion locks the baseline/router, is idempotent, and a familiar repeat cannot grant again',()=>{
  const {rec,chain,m,done,authority}=setup(),grant=completedDrillEligibility(chain,'d',authority)
  if(grant.status!=='eligible')throw Error()
  const lockedAuthority={...authority,chains:{chain:grant.chain}}
  expect(completedDrillEligibility(grant.chain,'d',lockedAuthority)).toEqual({...grant,firstGrant:false})
  expect(completedDrillEligibility(chain,'d',lockedAuthority)).toEqual({status:'ineligible',reason:'chain_missing_or_stale'})
  const again=play(createDrillAttempt(rec,m,'second',[done],time),()=>0)
  expect(again.header.familiar).toBe(true)
  const current={...lockedAuthority,savedDrills:{d:done,second:again}}
  expect(completedDrillEligibility(chain,'second',current).status).toBe('ineligible')
  expect(completedDrillEligibility(grant.chain,'second',current)).toEqual({status:'ineligible',reason:'first_completion_already_locked'})
  expect(completedDrillEligibility(grant.chain,'d',{...current,deletedDrillIds:['d']}).status).toBe('ineligible')
  expect(completedDrillEligibility(grant.chain,'second',{...current,deletedDrillIds:['d']}).status).toBe('ineligible')
})
it.each(['baseline_missing','baseline_deleted','chain_deleted','replacement','baseline_invalid','baseline_unsaved','closed','drill_missing','drill_deleted','drill_invalid','drill_incomplete','wrong_id','wrong_chain','wrong_mapping','wrong_settings','wrong_route','wrong_version','corrupt_snapshot','corrupt_journal','changed_baseline','coherent_settings_forgery'])('completion fails closed with %s authority',kind=>{
  const setupResult=setup(),authority=structuredClone(setupResult.authority) as {root:NonNullable<TrainingAuthority['root']>|null;chains:Record<string,TrainingChain>;savedDrills:Record<string,DrillAttempt>;deletedDrillIds:string[];completedChainIds:string[]}
  const chain=structuredClone(setupResult.chain) as {version:TrainingChain['version'];recommendation:Recommendation;firstCompletedDrillId:string|null}
  const root=authority.root!,saved=authority.savedDrills.d
  if(kind==='baseline_missing')delete root.records.base
  if(kind==='baseline_deleted'||kind==='chain_deleted')root.tombstones[kind==='baseline_deleted'?'base':'other']={sessionId:kind==='baseline_deleted'?'base':'other',chainId:'chain',formId:'BL1',exposure:'form_exposed',deletedAtMs:1}
  if(kind==='replacement')root.installationId='replacement'
  if(kind==='baseline_invalid')root.records.base.snapshot.comparisonEligible=false
  if(kind==='baseline_unsaved')authority.root=null
  if(kind==='closed')authority.completedChainIds=['chain']
  if(kind==='drill_missing')delete authority.savedDrills.d
  if(kind==='drill_deleted')authority.deletedDrillIds=['d']
  if(kind==='drill_invalid')authority.savedDrills.d=step(play(setupResult.prepared,()=>0,6),'invalidate',{reason:'settings_changed'})
  if(kind==='drill_incomplete')authority.savedDrills.d=play(setupResult.prepared,()=>0,17)
  if(kind==='wrong_id')(saved.header as {attemptId:string}).attemptId='other'
  if(kind==='wrong_chain')(saved.header.recommendation as {chainId:string}).chainId='other'
  if(kind==='wrong_mapping')(saved.header.recommendation.mapping as Record<string,string>)['Type 1']='B'
  if(kind==='wrong_settings')(saved.header.recommendation.settings as {verbose:boolean}).verbose=true
  if(kind==='wrong_route')(chain.recommendation as {kind:string}).kind='outcome'
  if(kind==='wrong_version')chain.version='other' as never
  if(kind==='corrupt_snapshot')(saved.snapshot as {bankedCents:number}).bankedCents=5
  if(kind==='corrupt_journal')(saved.journal as unknown[]).pop()
  if(kind==='changed_baseline')authority.root=baseline('BL1',()=>1)
  if(kind==='coherent_settings_forgery'){
    (saved.header.recommendation.settings as {verbose:boolean}).verbose=true
    // Even a fully replayable journal cannot invent a different baseline setting.
    expect(reconcileDrill(saved)).toBeTruthy()
  }
  authority.chains.chain=structuredClone(chain)
  const before=JSON.stringify(authority)
  expect(completedDrillEligibility(chain,'d',authority).status).toBe('ineligible')
  expect(JSON.stringify(authority)).toBe(before)
})
it('invalid attempt restarts on fixed inventory, then a complete saved retry may grant once',()=>{
  const {rec,m,chain,prepared,authority}=setup()
  const invalid=step(play(prepared,()=>2,6),'invalidate',{reason:'storage_uncertain'})
  const retry=play(createDrillAttempt(rec,m,'retry',[invalid],time),()=>0)
  expect(retry.header.familiar).toBe(true)
  expect(completedDrillEligibility(chain,'retry',{...authority,savedDrills:{d:invalid,retry}}).status).toBe('eligible')
})
it('chain creation rejects a forged recommendation and malformed root returns ordinary replay',()=>{
  const {rec}=setup()
  expect(()=>createTrainingChain(structuredClone(rec))).toThrow()
  expect(routeBaseline({installationId:'install'} as never,rec.baseline,[]).status).toBe('ordinary_replay')
})

it('mixed supported action sources do not invalidate an untimed completed drill',()=>{
  const {prepared,chain,authority}=setup()
  let a=step(prepared,'start')
  const sources=['keyboard','mouse','touch_or_pen','unknown_or_assistive'] as const
  while(a.snapshot.phase!=='completed')a=step(a,a.snapshot.phase==='active'?'collect':'next',{source:sources[a.snapshot.nextActionId%4]})
  expect(new Set(a.journal.flatMap(e=>e.command?[e.command.source]:[])).size).toBe(4)
  expect(completedDrillEligibility(chain,'d',{...authority,savedDrills:{d:a}}).status).toBe('eligible')
})
