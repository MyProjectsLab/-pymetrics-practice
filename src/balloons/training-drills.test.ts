import { beforeAll, describe, expect, it } from 'vitest'
import { webcrypto } from 'node:crypto'
import committed from '../../docs/specifications/ASSESSMENT_PRACTICE_BALLOONS_FIXED_MANIFESTS_V1_0.json'
import { canonicalJson, loadScoredManifests, sha256 } from './manifests'
import { drillId, loadDrillManifests } from './drill-manifests'
import type { DrillManifest, DrillId } from './drill-manifests'
import { createDrillAttempt, drillDemo, drillFeedback, reconcileDrill, transitionDrill } from './drills'
import type { DrillAttempt, DrillControl } from './drills'
import { command, play, recommendation, step } from './training-test-support'
import { primitiveOutcome } from './training-test-oracle'
import type { FormId, Profile, RoundResult } from './contracts'
import type { DrillKind } from './training-evidence'

let manifests:ReadonlyMap<DrillId,DrillManifest>
const time={wallTimeMs:100000,monotonicMs:0,clockEpochId:'drill'}
const cases:readonly [DrillKind,Profile|null][]=[['outcome',null],['information',null],['updating',null],['consistency','A'],['consistency','B'],['consistency','C'],['maintenance',null]]
beforeAll(async()=>{Object.defineProperty(globalThis,'crypto',{value:webcrypto,configurable:true});await loadScoredManifests();manifests=await loadDrillManifests()})
function start(kind:DrillKind,profile:Profile|null=null,id:FormId='BL1',attemptId='drill',prior:readonly DrillAttempt[]=[]){const {rec}=recommendation(kind,profile,id);return createDrillAttempt(rec,manifests.get(drillId(kind,profile))!,attemptId,prior,time)}
function verifyFeedback(a:DrillAttempt,expected:readonly RoundResult[]) {
  const f=drillFeedback(a)!,n=expected.length,kind=a.header.recommendation.kind
  expect(f).not.toBeNull();expect(f.completed).toBe(n);expect(f.kind).toBe(kind)
  const count=(rs:readonly RoundResult[],outcome:string)=>rs.filter(r=>r.outcome===outcome).length
  if(f.kind==='information'||f.kind==='updating')for(const c of f.categories!){const rows=expected.filter(r=>r.visibleType===c.visibleType);expect(c.denominator).toBe(rows.length);expect(c.burst).toBe(count(rows,'burst'));if(f.kind==='information')expect(c).toEqual({visibleType:c.visibleType,denominator:rows.length,collected:rows.length-count(rows,'burst'),burst:count(rows,'burst')});else expect(c).toEqual({visibleType:c.visibleType,denominator:rows.length,voluntary:count(rows,'voluntary_collect'),cap:count(rows,'cap_collect'),burst:count(rows,'burst')})}
  if(f.kind==='maintenance')expect(f).toEqual({kind,completed:n,bankedCents:expected.reduce((s,r)=>s+r.bankedCents,0),lostCents:expected.reduce((s,r)=>s+r.lostCents,0),collected:n-count(expected,'burst'),burst:count(expected,'burst')})
  if(f.kind==='consistency'){
    const v=expected.filter(r=>r.outcome==='voluntary_collect').map(r=>r.successfulPumps).sort((a,b)=>a-b),h=Math.floor(v.length/2)
    const median=(xs:number[])=>xs.length%2?xs[Math.floor(xs.length/2)]:(xs[xs.length/2-1]+xs[xs.length/2])/2
    expect(f.voluntaryCount).toBe(v.length);expect(f.burst).toBe(count(expected,'burst'));expect(f.cap).toBe(count(expected,'cap_collect'))
    expect(f.range).toEqual(v.length<2?null:{min:v[0],max:v.at(-1),span:v.at(-1)!-v[0]})
    expect(f.iqr).toBe(v.length<2?null:median(v.slice(-h))-median(v.slice(0,h)))
  }
  if(f.kind==='outcome'){
    const pairs=[]
    for(const p of ['A','B','C']){const same=expected.filter(r=>r.profile===p);let last;for(let i=1;i<same.length;i++)if(same[i].outcome==='voluntary_collect')last={visibleType:same[i].visibleType,fromRound:same[i-1].round,fromOutcome:same[i-1].outcome,nextRound:same[i].round,nextVoluntaryPoint:same[i].voluntaryPoint};if(last)pairs.push(last)}
    expect(f.transitions).toEqual(pairs);expect(f.message).toBe(pairs.length?null:'No matched transition yet.')
    expect('counts' in f).toBe(n===18)
    if(n===18)expect(f.counts).toEqual({rounds:18,voluntary:count(expected,'voluntary_collect'),cap:count(expected,'cap_collect'),burst:count(expected,'burst'),collected:18-count(expected,'burst')})
  }
  expect(JSON.stringify(f)).not.toMatch(/threshold|candidateSeed|manifestSha|"profile"|"mapping"/)
}
describe('immutable approved drill inventories',()=>{
  it('loads all seven exact hashes as deeply immutable data',()=>{
    expect(manifests.size).toBe(7)
    for(const m of manifests.values()){expect(m.rounds).toHaveLength(18);expect(Object.isFrozen(m.rounds[0])).toBe(true);expect(()=>{(m.rounds[0] as {threshold:number}).threshold++}).toThrow()}
  })
  it.each(['version','missing','identity','seed','hash','round','rehashed','order'])('rejects %s mutation',async mutation=>{
    const raw=structuredClone(committed)
    if(mutation==='version')raw.schema='other'
    if(mutation==='missing')raw.drills.pop()
    if(mutation==='identity')raw.drills[0].id='D-maintenance'
    if(mutation==='seed')raw.drills[0].candidateSeed++
    if(mutation==='hash')raw.drills[0].sha256='0'.repeat(64)
    if(mutation==='round'||mutation==='rehashed'){raw.drills[0].rounds[0].threshold++;if(mutation==='rehashed'){const {sha256:_h,...body}=raw.drills[0];void _h;raw.drills[0].sha256=await sha256(canonicalJson(body))}}
    if(mutation==='order')raw.drills.reverse()
    await expect(loadDrillManifests(raw)).rejects.toThrow()
  })
  it('snapshots input before async hash checks',async()=>{const raw=structuredClone(committed),loading=loadDrillManifests(raw);raw.drills[6].rounds[0].threshold=99;expect((await loading).get('D-maintenance')!.rounds[0].threshold).toBe(11)})
  it('rejects unverified/copied manifests and recommendations, wrong variant and attempt reuse',()=>{
    const {rec}=recommendation('maintenance'),m=manifests.get('D-maintenance')!
    expect(()=>createDrillAttempt(structuredClone(rec),m,'d',[],time)).toThrow()
    expect(()=>createDrillAttempt(rec,structuredClone(m),'d',[],time)).toThrow()
    expect(()=>createDrillAttempt(rec,manifests.get('D-outcome')!,'d',[],time)).toThrow()
    const prior=createDrillAttempt(rec,m,'d',[],time)
    expect(()=>createDrillAttempt(rec,m,'d',[prior],time)).toThrow()
  })
})
it.each(cases)('%s/%s: 33 policies, all 18 outcomes and 6/12/18 feedback independently reconcile', (kind,profile)=>{
  const {rec}=recommendation(kind,profile),m=manifests.get(drillId(kind,profile))!
  for(let k=0;k<=32;k++){
    let a=createDrillAttempt(rec,m,`d-${k}`,[],time)
    const expected=m.rounds.map(r=>primitiveOutcome({...r,intentPumps:k}))
    for(const boundary of [6,12,18]){a=play(a,()=>k,boundary);expect(a.snapshot.results).toEqual(expected.slice(0,boundary));verifyFeedback(a,expected.slice(0,boundary));expect(a.snapshot.phase).toBe(boundary===18?'completed':'feedback')}
    expect(reconcileDrill(structuredClone(a))).toEqual(a)
    expect(a.journal.filter(e=>e.feedback).map(e=>e.feedback!.completed)).toEqual([6,12,18])
    expect(a.journal.filter(e=>e.type==='drill_completed')).toHaveLength(1)
    expect(a.journal.every(e=>e.validityCode==='headless_unconfirmed')).toBe(true)
  }
},30000)
it.each(cases.flatMap(c=>['BL1','BL2','BL3'].map(id=>[...c,id] as const)))('%s/%s inherits %s mapping', (kind,profile,id)=>{
  const a=play(start(kind,profile,id as FormId),r=>r%5)
  for(const r of a.snapshot.results)expect(a.header.recommendation.mapping[r.visibleType]).toBe(r.profile)
  const expected=a.snapshot.results.map(r=>({...primitiveOutcome({...manifests.get(a.header.manifestId)!.rounds[r.round-1],intentPumps:r.round%5}),visibleType:r.visibleType}))
  expect(a.snapshot.results).toEqual(expected);verifyFeedback(a,expected)
})
it('outcome demos precede start, are unscored, and reveal no hidden threshold',()=>{
  let a=start('outcome');expect(transitionDrill(a,command(a,'start')).accepted).toBe(false)
  expect(drillDemo(a)).toEqual({demoOnly:true,successfulPumps:3,attemptedPumps:4,outcome:'burst',bankedCents:0,lostCents:15})
  a=step(a,'demo_next');expect(drillDemo(a)).toEqual({demoOnly:true,successfulPumps:3,attemptedPumps:3,outcome:'voluntary_collect',bankedCents:15,lostCents:0})
  a=step(a,'demo_next');expect(drillDemo(a)).toBeNull();expect(a.snapshot.results).toEqual([]);expect(a.snapshot.bankedCents).toBe(0);expect(a.snapshot.lostCents).toBe(0)
  a=step(a,'start');expect(a.journal.filter(e=>e.type==='drill_started')).toHaveLength(1)
})
it.each([0,1,2])('consistency feedback suppresses range/IQR below two voluntary points: n=%i',n=>{
  let a=start('consistency','C')
  a=play(a,r=>r<=n?r:32,6)
  expect(drillFeedback(a)!.voluntaryCount).toBe(n)
  verifyFeedback(a,a.snapshot.results)
})
it('outcome feedback never skips a same-category cap/burst or reads a future choice',()=>{
  let a=start('outcome')
  const m=manifests.get('D-outcome')!
  // Early pairs include burst -> voluntary and voluntary -> voluntary; later cap breaks adjacency.
  a=play(a,r=>[3,6,9].includes(r)?32:r%4,6);verifyFeedback(a,a.snapshot.results)
  const first=structuredClone(drillFeedback(a));a=play(a,r=>[9,12].includes(r)?32:r%4,12);verifyFeedback(a,a.snapshot.results)
  expect(first).toEqual(a.journal.find(e=>e.feedback?.completed===6)!.feedback)
  expect(m.rounds[8].threshold).toBe(43)
})
it('actual T=1 / T=32 / T>32 drills preserve burst-before-increment and cap censoring',()=>{
  const results=cases.flatMap(([k,p])=>play(start(k,p),()=>32).snapshot.results)
  expect(results.some(r=>r.outcome==='burst'&&r.attemptedPumps===1&&r.lostCents===0)).toBe(true)
  expect(results.some(r=>r.outcome==='burst'&&r.attemptedPumps===32&&r.lostCents===155&&r.voluntaryPoint===null)).toBe(true)
  expect(results.some(r=>r.outcome==='cap_collect'&&r.successfulPumps===32&&r.bankedCents===160&&r.voluntaryPoint===null)).toBe(true)
})
it('invalid restart uses same inventory at round one with a fresh ID and familiar label',()=>{
  let a=play(start('maintenance'),()=>2,6);a=step(a,'invalidate',{reason:'settings_changed'})
  expect(a.snapshot.phase).toBe('invalid');expect(transitionDrill(a,command(a,'resume')).accepted).toBe(false)
  const b=start('maintenance',null,'BL1','retry',[a]);expect(b.header.manifestSha256).toBe(a.header.manifestSha256);expect(b.header.familiar).toBe(true);expect(b.snapshot.round).toBe(1);expect(b.snapshot.results).toEqual([])
})
it.each(['demo','ready','active','resolved','feedback','completed','invalid','paused'])('transition matrix and pause/resume at %s',phase=>{
  let a=phase==='demo'?start('outcome'):start('maintenance')
  if(['active','resolved','feedback','completed','invalid','paused'].includes(phase))a=step(a,'start')
  if(phase==='resolved')a=step(a,'collect')
  if(phase==='feedback')a=play(a,()=>0,6)
  if(phase==='completed')a=play(a,()=>0)
  if(phase==='invalid')a=step(a,'invalidate',{reason:'storage_uncertain'})
  if(phase==='paused')a=step(a,'pause')
  const allowed:Record<string,string[]>={demo:['demo_next','pause','invalidate'],ready:['start','pause','invalidate'],active:['pump','collect','pause','invalidate'],resolved:['next','pause','invalidate'],feedback:['next','pause','invalidate'],completed:[],invalid:[],paused:['resume','invalidate']}
  for(const control of ['demo_next','start','pump','collect','next','pause','resume','invalidate'] as DrillControl[]){const c=command(a,control,control==='invalidate'?{reason:'authority_changed'}:{});expect(transitionDrill(a,c).accepted).toBe(allowed[phase].includes(control))}
  if(!['invalid','completed','paused'].includes(phase)){
    const paused=step(a,'pause'),resumed=step(paused,'resume',{time:{wallTimeMs:0,monotonicMs:0,clockEpochId:'reload'}})
    expect(resumed.snapshot.results).toEqual(a.snapshot.results);expect(resumed.snapshot.round).toBe(a.snapshot.round);expect(resumed.snapshot.phase).toBe(a.snapshot.phase);expect(reconcileDrill(resumed)).toEqual(resumed)
  }
})
it('duplicate/stale/wrong-phase actions are no-ops; invalid clocks/sources fail closed',()=>{
  const a=step(start('maintenance'),'start'),c=command(a,'pump'),b=transitionDrill(a,c).state
  expect(transitionDrill(b,c)).toEqual({accepted:false,state:b})
  for(const mutation of [{expectedRound:2},{expectedRevision:99},{actionId:99}])expect(transitionDrill(a,{...c,...mutation})).toEqual({accepted:false,state:a})
  expect(()=>transitionDrill(a,{...c,source:'other' as never})).toThrow()
  expect(()=>transitionDrill(a,{...c,time:{...c.time,monotonicMs:-1}})).toThrow()
  expect(()=>transitionDrill(a,{...c,time:{...c.time,monotonicMs:0}})).toThrow()
  expect(()=>transitionDrill(structuredClone(a),c)).toThrow()
})
it.each(['missing','duplicate','action','snapshot','money','point','censor','profile','manifest','mapping','settings','clock','feedback','version','source','completion'])('replay rejects %s corruption',kind=>{
  const a=structuredClone(play(start('maintenance'),()=>2)) as unknown as {header:DrillAttempt['header'];snapshot:Record<string,unknown>;journal:Record<string,unknown>[]}
  if(kind==='missing')a.journal.splice(4,1)
  if(kind==='duplicate')a.journal.splice(4,0,a.journal[4])
  if(kind==='action') (a.journal[4].command as {actionId:number}).actionId++
  if(kind==='snapshot')a.snapshot.round=17
  if(kind==='money')a.snapshot.bankedCents=999
  if(['point','censor','profile'].includes(kind)){const row=(a.snapshot.results as Record<string,unknown>[])[0];row[kind==='point'?'voluntaryPoint':kind==='censor'?'censored':'profile']=kind==='point'?31:kind==='censor'?true:'C'}
  if(kind==='manifest')(a.header as {manifestSha256:string}).manifestSha256='bad'
  if(kind==='mapping')(a.header.recommendation.mapping as Record<string,string>)['Type 1']='C'
  if(kind==='settings')(a.header.recommendation.settings as {verbose:boolean}).verbose=true
  if(kind==='clock')(a.journal[4].time as {monotonicMs:number}).monotonicMs=-1
  if(kind==='feedback')a.journal.find(e=>e.feedback)!.feedback={madeUp:1}
  if(kind==='version')a.journal[4].routerVersion='other'
  if(kind==='source')(a.journal[4].command as {source:string}).source='other'
  if(kind==='completion')a.journal.pop()
  // Settings alone are bound by fresh baseline admission, not by headless round arithmetic.
  if(kind==='settings')expect(reconcileDrill(a as unknown as DrillAttempt)).toBeTruthy()
  else expect(()=>reconcileDrill(a as unknown as DrillAttempt)).toThrow()
})

it.each(cases)('%s/%s has no feedback before resolution or between six-round boundaries', (kind,profile)=>{
  let a=start(kind,profile)
  expect(drillFeedback(a)).toBeNull()
  a=play(a,()=>0,5);expect(drillFeedback(a)).toBeNull()
  a=step(a,'next');expect(drillFeedback(a)).toBeNull()
  a=step(a,'collect');expect(drillFeedback(a)?.completed).toBe(6)
  expect(transitionDrill(a,command(a,'pump')).accepted).toBe(false)
  a=step(a,'next');expect(drillFeedback(a)).toBeNull()
  a=play(a,()=>0,11);expect(drillFeedback(a)).toBeNull()
  a=play(a,()=>0,12);expect(drillFeedback(a)?.completed).toBe(12)
  a=step(a,'next');expect(drillFeedback(a)).toBeNull()
  a=play(a,()=>0,17);expect(drillFeedback(a)).toBeNull()
  a=play(a,()=>0,18);expect(drillFeedback(a)?.completed).toBe(18)
  expect(transitionDrill(a,command(a,'next')).accepted).toBe(false)
})
