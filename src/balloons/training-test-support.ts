import type { FormId, ManifestRound, Profile } from './contracts'
import { advance, createRecord, DURABLE_VERSION, mappingFor } from './durable'
import type { DurableRecord } from './durable'
import { verifiedScoredManifest } from './manifests'
import type { Root } from './storage'
import { routeBaseline } from './router'
import type { Recommendation } from './router'
import type { DrillKind } from './training-evidence'
import { oracle, primitiveOutcome } from './training-test-oracle'
import { transitionDrill } from './drills'
import type { DrillAttempt, DrillCommand, DrillControl } from './drills'

export const ref={installationId:'install',sessionId:'base'}
export function baseline(id:FormId,policy:(r:ManifestRound)=>number,limit=39): Root {
  let tick=0
  const time=()=>({wallTimeMs:1000+ ++tick,monotonicMs:tick,clockEpochId:'t'})
  let r=createRecord({version:DURABLE_VERSION,formId:id,repeat:false,settings:{verbose:false,reducedMotion:true,informationProfile:'type-pattern-v1',controls:'native-buttons-v1'},device:'test',created:time(),identity:{...ref,chainId:id.startsWith('BL')?'chain':null,stage:id.startsWith('BL')?'baseline':'replay',mapping:mappingFor(id),exposureGeneration:1,ownershipGeneration:1}})
  const confirm=(r:DurableRecord)=>advance(advance(r,{kind:'arm'},time()),{kind:'confirm'},time())
  r=confirm(r)
  while(r.snapshot.core.results.length<limit){
    const c=r.snapshot.core,t=time(),row=c.manifest.rounds[c.round-1]
    const action={kind:c.status==='resolved'?'next' as const:c.current.successfulPumps<policy(row)?'pump' as const:'collect' as const,actionId:c.nextActionId,expectedRound:c.round,expectedRevision:c.revision,source:'unknown_or_assistive' as const,time:t}
    r=advance(advance(r,{kind:'action_pending',action},t),{kind:'action',action},t)
    if(action.kind==='next')r=confirm(r)
  }
  return {version:DURABLE_VERSION,installationId:'install',revision:1,generation:1,owner:null,records:{base:r},tombstones:{}}
}
export function recommendation(kind:DrillKind,profile:Profile|null=null,id:FormId='BL1'): {root:Root;rec:Recommendation} {
  const manifest=verifiedScoredManifest(id)!,plan=Array(39).fill(0) as number[]
  if(kind==='updating'||kind==='information'){
    const p=kind==='information'?'B':'A',early=manifest.rounds.filter(r=>r.profile===p&&r.round<27).slice(0,kind==='information'?3:2)
    early.forEach(r=>plan[r.round-1]=r.threshold)
    if(kind==='information')manifest.rounds.filter(r=>r.profile===p&&r.round>26).forEach(r=>plan[r.round-1]=3)
  }
  if(kind==='outcome'){
    const windows:ManifestRound[][]=[]
    for(const p of ['A','B','C']){const same=manifest.rounds.filter(r=>r.profile===p);for(let i=0;i<10;i++){const w=same.slice(i,i+4);if(w[0].threshold>5&&w[1].threshold<=32&&w[3].threshold>5)windows.push(w)}}
    const pair=windows.flatMap((w,i)=>windows.slice(i+1).filter(v=>v.every(r=>!w.includes(r))).map(v=>[w,v])).find(([a,b])=>{const intents=Array(39).fill(0);for(const w of [a,b]){intents[w[0].round-1]=5;intents[w[1].round-1]=w[1].threshold;intents[w[2].round-1]=0;intents[w[3].round-1]=5}return oracle(manifest.rounds.map(r=>primitiveOutcome({...r,intentPumps:intents[r.round-1]}))).primary==='outcome'})
    if(!pair)throw Error('No two outcome windows for test form')
    for(const w of pair){plan[w[0].round-1]=5;plan[w[1].round-1]=w[1].threshold;plan[w[3].round-1]=5}
  }
  if(kind==='consistency'){
    const same=manifest.rounds.filter(r=>r.profile===profile)
    let found=false
    for(let mask=0;mask<8192&&!found;mask++){
      same.forEach((r,i)=>plan[r.round-1]=(mask&(1<<i))?Math.min(r.threshold-1,31):0)
      const result=oracle(manifest.rounds.map(r=>primitiveOutcome({...r,intentPumps:plan[r.round-1]})))
      found=result.primary==='consistency'&&result.consistencyCategory?.profile===profile
    }
    if(!found)throw Error('No consistency test plan')
  }
  const root=baseline(id,r=>plan[r.round-1]),rec=routeBaseline(root,ref,[])
  if(rec.status!=='recommended'||rec.kind!==kind||rec.consistencyProfile!==profile)throw Error(`Recipe missed ${kind}/${profile}: ${JSON.stringify(rec.status==='recommended'?rec.evidence:rec)}`)
  return {root,rec}
}
export function command(a:DrillAttempt,kind:DrillControl,extra:Partial<DrillCommand>={}):DrillCommand {
  const s=a.snapshot,prior=a.journal.at(-1)!.time
  return {kind,actionId:s.nextActionId,expectedRevision:s.revision,expectedRound:s.round,source:'mouse',time:{...prior,monotonicMs:prior.monotonicMs+1,wallTimeMs:prior.wallTimeMs+1},...extra}
}
export function step(a:DrillAttempt,kind:DrillControl,extra:Partial<DrillCommand>={}) {
  const next=transitionDrill(a,command(a,kind,extra));if(!next.accepted)throw Error(`Rejected ${kind} in ${a.snapshot.phase}`);return next.state
}
export function play(a:DrillAttempt,policy:(round:number)=>number,limit=18) {
  if(a.snapshot.phase==='demo'){a=step(step(a,'demo_next'),'demo_next')}
  if(a.snapshot.phase==='ready')a=step(a,'start')
  while(a.snapshot.results.length<limit){if(['resolved','feedback'].includes(a.snapshot.phase))a=step(a,'next');else a=step(a,a.snapshot.successfulPumps<policy(a.snapshot.round)?'pump':'collect')}
  return a
}
