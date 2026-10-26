import { beforeAll, describe, expect, it } from 'vitest'
import { webcrypto, createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import fixtures from '../../docs/specifications/ASSESSMENT_PRACTICE_BALLOONS_ROUTER_FIXTURES_V1_0.json'
import { deriveRouterEvidence, quartiles } from './training-evidence'
import { legalFixture, oracle, primitiveOutcome } from './training-test-oracle'
import { loadScoredManifests } from './manifests'
import { routeBaseline } from './router'
import { baseline, ref } from './training-test-support'
import { advance } from './durable'

beforeAll(async()=>{Object.defineProperty(globalThis,'crypto',{value:webcrypto,configurable:true});await loadScoredManifests()})
describe('25 frozen fixtures independently derived from primitive actions',()=>{
  it('binds the exact frozen 975-round packet',()=>{
    expect(createHash('sha256').update(readFileSync('docs/specifications/ASSESSMENT_PRACTICE_BALLOONS_ROUTER_FIXTURES_V1_0.json')).digest('hex')).toBe('fbd1727798831af0e761dd38edffb40fc27610622a2bede3b221e2806b136d30')
    expect(fixtures.fixtures).toHaveLength(25);expect(fixtures.fixtures.flatMap(f=>f.rounds)).toHaveLength(975)
  })
  it.each(fixtures.fixtures)('$id: every outcome, denominator, trigger, priority and evidence tie',fixture=>{
    legalFixture(fixture.rounds)
    const rows=fixture.rounds.map(primitiveOutcome), independent=oracle(rows), actual=deriveRouterEvidence(rows)
    rows.forEach((r,i)=>{const {visibleType: _v,censored: _c,...outcome}=r;void _v;void _c;expect(fixture.rounds[i]).toMatchObject({...outcome,outcome:r.outcome==='voluntary_collect'?'voluntary':r.outcome==='cap_collect'?'cap':'burst'})})
    const map=(key:'earlyBursts'|'lateVoluntaryN'|'lateMedian'|'voluntaryN')=>Object.fromEntries(actual.categories.map(c=>[c.profile,c[key]]))
    const p=actual.informationPair,c=actual.consistencyCategory
    expect({primary:actual.primary,flags:actual.flags,earlyBursts:map('earlyBursts'),last13VoluntaryN:map('lateVoluntaryN'),last13Medians:map('lateMedian'),allVoluntaryN:map('voluntaryN'),outcomeMatches:actual.outcomeSelected.map(w=>({profile:w.profile,rounds:w.rounds})),informationPair:p?{high:p.high,low:p.low,earlyDiff:p.earlyDifference,medianDiff:p.lateDifference}:null,updatingPair:actual.updatingPair?[actual.updatingPair.high,actual.updatingPair.low]:null,consistencyCategory:c?{profile:c.profile,n:c.voluntaryN,iqr:c.quartiles!.iqr}:null}).toEqual(independent)
    // Stored expectations are checked only AFTER the separate oracle and production results agree.
    expect(independent).toEqual(fixture.expected)
    for(const group of [rows,...['A','B','C'].map(p=>rows.filter(r=>r.profile===p))]){
      expect(group.reduce((s,r)=>s+r.attemptedPumps,0)).toBe(group.reduce((s,r)=>s+r.successfulPumps,0)+group.filter(r=>r.outcome==='burst').length)
      expect(group.reduce((s,r)=>s+r.successfulPumps*5,0)).toBe(group.reduce((s,r)=>s+r.bankedCents+r.lostCents,0))
    }
    expect(actual.outcomeWindows).toHaveLength(30)
    for(const cat of actual.categories){expect(cat.voluntaryN+cat.excludedBursts+cat.excludedCaps).toBe(13);expect(cat.earlyRounds+cat.lateRounds).toBe(13);expect(cat.quartiles===null).toBe(cat.voluntaryN<8)}
    expect(actual.pairs).toHaveLength(6)
    expect(JSON.stringify(actual)).not.toContain('threshold')
    expect(Object.isFrozen(actual.categories[0])).toBe(true)
  })
})
it('quartiles discard an odd center and preserve exact halves',()=>{
  expect(quartiles([0,0,1,1,7,7,7,7])).toEqual({q1:.5,q3:7,iqr:6.5})
  expect(quartiles([0,2,100,104,106])).toEqual({q1:1,q3:105,iqr:104})
  expect(()=>quartiles([1])).toThrow()
})
it.each(['missing','unsaved','deleted','replacement','incomplete','invalid','replay','corrupt','closed','chain_deleted'])('router fails closed: %s',kind=>{
  let root=baseline(kind==='replay'?'RP1':'BL1',()=>0)
  if(kind==='missing')delete root.records.base
  if(kind==='deleted')root.tombstones.base={sessionId:'base',chainId:'chain',formId:'BL1',exposure:'form_exposed',deletedAtMs:1}
  if(kind==='replacement')root.installationId='other'
  if(kind==='incomplete')root=baseline('BL1',()=>0,5)
  if(kind==='invalid')root.records.base.snapshot.comparisonEligible=false
  if(kind==='corrupt')root.records.base.snapshot.core={...root.records.base.snapshot.core,bankedCents:123}
  if(kind==='chain_deleted')root.tombstones.old={sessionId:'old',chainId:'chain',formId:'BL1',exposure:'form_exposed',deletedAtMs:1}
  expect(routeBaseline(kind==='unsaved'?null:root,ref,kind==='closed'?['chain']:[]).status).toBe('ordinary_replay')
})
it.each(['BL1','BL2','BL3'] as const)('%s admits zero voluntary and all-zero voluntary; mappings are form-based',id=>{
  for(const k of [0,32]){const root=baseline(id,()=>k),r=routeBaseline(root,ref,[]);expect(r.status).toBe('recommended');if(r.status!=='recommended')throw Error();expect(r.kind).toBe('maintenance');expect(r.mapping).toEqual(root.records.base.header.identity.mapping);expect(r.card.observation).toContain('No targeted threshold was reached in this session.');expect(r.evidence.categories.reduce((s,c)=>s+c.voluntaryN,0)).toBe(k===0?39:0)}
})
it('report-view events do not change the baseline/router binding',()=>{
  const root=baseline('BL1',()=>0),one=routeBaseline(root,ref,[])
  root.records.base=advance(root.records.base,{kind:'report'},{wallTimeMs:999999,monotonicMs:999999,clockEpochId:'t'})
  expect(routeBaseline(root,ref,[])).toEqual(one)
})

it('consistency tie uses voluntary count before alphabetical profile',()=>{
  const f=structuredClone(fixtures.fixtures.find(f=>f.id==='consistency_category_tie')!)
  f.rounds[0].intentPumps=1
  const rows=f.rounds.map(primitiveOutcome),e=deriveRouterEvidence(rows),o=oracle(rows)
  expect(o.consistencyCategory).toEqual({profile:'B',n:13,iqr:6})
  expect(e.consistencyCategory).toMatchObject({profile:'B',voluntaryN:13,quartiles:{iqr:6}})
})
it('information evidence breaks early-count ties by late median difference before alphabet',()=>{
  const f=structuredClone(fixtures.fixtures.find(f=>f.id==='information_pair_tie')!)
  f.rounds.filter(r=>r.round>=27&&r.profile==='B').forEach(r=>r.intentPumps=4)
  const rows=f.rounds.map(primitiveOutcome),e=deriveRouterEvidence(rows)
  expect(oracle(rows).informationPair).toEqual({high:'B',low:'C',earlyDiff:3,medianDiff:4})
  expect(e.informationPair).toMatchObject({high:'B',low:'C',earlyDifference:3,lateDifference:4})
})
it.each(['short','round','cap_as_voluntary','burst_as_voluntary','cent','attempt','profile'])('raw evidence cannot admit illegal %s observations',mutation=>{
  const rows=fixtures.fixtures.find(f=>f.id==='pump32_burst_cap_and_loss')!.rounds.map(primitiveOutcome)
  if(mutation==='short')rows.pop()
  if(mutation==='round')rows[0]={...rows[0],round:2}
  if(mutation==='cap_as_voluntary'){const i=rows.findIndex(r=>r.outcome==='cap_collect');rows[i]={...rows[i],outcome:'voluntary_collect',voluntaryPoint:32,censored:false}}
  if(mutation==='burst_as_voluntary'){const i=rows.findIndex(r=>r.outcome==='burst');rows[i]={...rows[i],voluntaryPoint:rows[i].successfulPumps}}
  if(mutation==='cent')rows[0]={...rows[0],bankedCents:5}
  if(mutation==='attempt')rows[0]={...rows[0],attemptedPumps:1}
  if(mutation==='profile')rows[0]={...rows[0],profile:'C'}
  expect(()=>deriveRouterEvidence(rows)).toThrow()
})

it('exploratory ordering probe: 100 block-preserving interleavings per fixture',()=>{
  let seed=20261004,changed=0,total=0
  const random=(n:number)=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n}
  for(const fixture of fixtures.fixtures){
    const original=oracle(fixture.rounds.map(primitiveOutcome)).primary
    for(let repeat=0;repeat<100;repeat++){
      const permuted=[]
      for(let b=0;b<3;b++){
        const block=fixture.rounds.slice(b*13,b*13+13),order=block.map(r=>r.profile)
        for(let i=12;i>0;i--){const j=random(i+1);[order[i],order[j]]=[order[j],order[i]]}
        const queues=new Map(['A','B','C'].map(p=>[p,block.filter(r=>r.profile===p)]))
        for(const p of order)permuted.push({...queues.get(p)!.shift()!,round:permuted.length+1})
      }
      const rows=permuted.map(primitiveOutcome),expected=oracle(rows),actual=deriveRouterEvidence(rows)
      expect(actual.flags).toEqual(expected.flags);expect(actual.primary).toBe(expected.primary)
      if(expected.primary!==original)changed++
      total++
    }
  }
  // Observation only: no invented stability cutoff or statistical inference.
  console.info(`Exploratory ordering: ${changed}/${total} primary routes changed; same-profile chronology and block counts preserved.`)
})
