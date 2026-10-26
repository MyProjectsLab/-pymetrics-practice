import {describe,it,expect} from 'vitest'
import {append,CHECK,CURRENT,EVENT,FORM_HASH,FORM_ID,GUIDE,LEGACY,SCORING,freshRoot,initialReady,limitUs,manage,management,validateRoot} from './model'
import type {Command,Root} from './model'
import arithmetic from '../../docs/qa/faces-v1/feedback-v3-fixtures/ARITHMETIC-FIXTURES.json'
import legacyFixtures from '../../docs/qa/faces-v1/feedback-v3-fixtures/LEGACY-DISPLAY-FIXTURES.json'
import guideWitness from '../../docs/qa/faces-v1/feedback-v3-fixtures/LEGACY-GUIDE-WITNESS.json'

// Fixed literal packet inputs are independent of the projection under test.
let serial=0
const uid=()=>`fixture-${++serial}`
const guide=(root:Root)=>{const next=structuredClone(root);next.guideCompletion={guideVersion:GUIDE,checkVersion:CHECK};next.lastGuideReceipt={requestId:uid(),guideVersion:GUIDE,checkVersion:CHECK};return next}
function build(root:Root,spec:typeof LEGACY|typeof CURRENT,choices:string[],elapsedUs:number[],mode:'standard-v1'|'extended-v1'='standard-v1',finish=true){
 root=initialReady(root,uid());const route=root.route!,attemptId=uid(),clock=uid(),familiarity=root.exposure.some(x=>x.assetBankHash===spec.bankHash)?'familiar':'new-local-record'
 const command=(kind:Command['kind'],payload:Record<string,unknown>):Command=>({eventVersion:EVENT,requestId:uid(),installationId:root.installationId,generation:root.generation,routeId:route.id,leaseId:route.lease!,attemptId,kind,payload})
 const open=command('open',{readyEpoch:route.epoch,formId:spec.formId,formHash:spec.formHash,assetBankHash:spec.bankHash,scoringVersion:spec.scoringVersion,modeId:mode,startedAtWall:'2026-10-18T12:00:00.000Z',clockDocumentId:clock,familiarity})
 root.route={...route,state:'opening',pendingOpeningId:open.requestId};root=append(root,open)
 for(let i=0;i<(finish?14:13);i++){
  const item=spec.items[i],intent=command('intent',{item:i,assetId:item.assetId,assetSha256:item.assetSha256,contextSha256:item.contextSha256});root=append(root,intent)
  const onset=command('onset',{item:i,intentRequestId:intent.requestId,clockDocumentId:clock,onsetUs:i*100_000_000,receiptVersion:'faces-render-v1'});root=append(root,onset)
  root=append(root,command('response',{item:i,onsetRequestId:onset.requestId,choice:choices[i],elapsedUs:elapsedUs[i],timely:elapsedUs[i]<limitUs(mode,i),inputClass:'keyboard'}))
 }
 if(!finish)root=append(root,command('exit',{destination:'library',reason:'close',observedUs:null,clockDocumentId:null}))
 return root
}
const total=(r:{context:{matches:number;timelyMatches:number;lateCount:number};photo:{matches:number;timelyMatches:number;lateCount:number}})=>({matches:r.context.matches+r.photo.matches,timelyMatches:r.context.timelyMatches+r.photo.timelyMatches,late:r.context.lateCount+r.photo.lateCount})

describe('Faces feedback V3 exact identities and arithmetic',()=>{
 it('binds new installed form and all fourteen marked answers',()=>{
  expect([FORM_ID,FORM_HASH,SCORING]).toEqual(['faces-bank-practice-v2','75ff16a9eaf4f0cff8eda2e80f66b4d886c9fcc5f7eae364b3859ab4cb584e16','faces-descriptive-v3'])
  expect(CURRENT.items.map(i=>i.matchEligible)).toEqual(Array(14).fill(true))
  const f=arithmetic.mixedStandard,root=build(guide(freshRoot()),CURRENT,f.choices,f.elapsedUs),a=root.attempts[0],r=a.report!
  expect(total(r)).toEqual({matches:9,timelyMatches:6,late:4});expect(r.excludedItems).toEqual([])
  expect(r.context).toEqual(f.expected.context);expect(r.photo).toEqual(f.expected.photo);expect(r.confusionPairs).toEqual(f.expected.confusionPairs)
  expect(root.schema).toBe('faces-root-v3');expect(a.report?.scoringVersion).toBe(SCORING);validateRoot(root)
 })
 it('keeps late-at-equality and empty timing groups exact',()=>{
  const key=arithmetic.key
  for(const [fixture,expected] of [[arithmetic.allMatchedTimely,{matches:14,timelyMatches:14,late:0}],[arithmetic.allMatchedAtLimit,{matches:14,timelyMatches:0,late:14}],[arithmetic.allWrongTimely,{matches:0,timelyMatches:0,late:0}],[arithmetic.mixedExtended,{matches:9,timelyMatches:9,late:0}]] as const){
   const r=build(guide(freshRoot()),CURRENT,fixture.choices??key,fixture.elapsedUs,fixture.modeId as 'standard-v1'|'extended-v1').attempts[0].report!
   expect(total(r)).toEqual(expected)
  }
 })
 it('preserves every historical literal report meaning and incomplete null',()=>{
  for(const f of legacyFixtures.cases){const root=build(guide(freshRoot()),LEGACY,f.choices,f.elapsedUs,'standard-v1',f.status==='completed'),a=root.attempts[0]
   if(f.status!=='completed'){expect(a.report).toBeNull();expect(a.facts.responses).toHaveLength(13);continue}
   const r=a.report!;expect(r.excludedItems).toEqual([1,6]);expect(r.context.eligibleTotal).toBe(6);expect(r.photo.eligibleTotal).toBe(6)
   expect(`${r.context.matches+r.photo.matches} of 12 answers matched`).toBe(f.expected.primary)
   expect(r.context.matches+' of 6').toBe(f.expected.contextMatched);expect(r.context.timelyMatches+' of 6').toBe(f.expected.contextWithinTime)
   expect(r.photo.matches+' of 6').toBe(f.expected.photoMatched);expect(r.photo.timelyMatches+' of 6').toBe(f.expected.photoWithinTime)
   const wrong=a.facts.responses.filter((x,i)=>LEGACY.items[i].matchEligible&&x.choice!==LEGACY.items[i].intended).map(x=>(x.item as number)+1)
   const lateMatched=a.facts.responses.filter((x,i)=>LEGACY.items[i].matchEligible&&x.choice===LEGACY.items[i].intended&&!x.timely).map(x=>(x.item as number)+1)
   expect(wrong).toEqual(f.expected.wrongItemNumbers);expect(lateMatched).toEqual(f.expected.lateMatchedItemNumbers)
   expect(r.context.lateCount+r.photo.lateCount===0?'All 14 answers were within time.':`${r.context.lateCount+r.photo.lateCount} of 14 answers were late.`).toBe(f.expected.late)
  }
 })
 it('admits old and new histories only as exact tuple/report pairs',()=>{
  const choices=arithmetic.mixedStandard.choices,times=arithmetic.mixedStandard.elapsedUs
  const old=build(guide(freshRoot()),LEGACY,choices,times),before=JSON.stringify(old.attempts[0])
  const mixed=build(old,CURRENT,choices,times);expect(mixed.attempts).toHaveLength(2);expect(JSON.stringify(mixed.attempts[0])).toBe(before)
  expect(mixed.attempts[1].report?.familiarity).toBe('familiar');expect(total(mixed.attempts[0].report!)).toEqual({matches:8,timelyMatches:5,late:4});expect(total(mixed.attempts[1].report!)).toEqual({matches:9,timelyMatches:6,late:4})
  for(const corrupt of [(x:Root)=>{x.attempts[0].formHash=FORM_HASH},(x:Root)=>{x.attempts[1].scoringVersion=LEGACY.scoringVersion},(x:Root)=>{x.attempts[1].report!.excludedItems=[1,6]},(x:Root)=>{x.exposure.push(x.exposure[0])}]){const x=structuredClone(mixed);corrupt(x);expect(()=>validateRoot(x)).toThrow()}
  const gone=manage(mixed,management(mixed,'delete',{targetAttemptId:mixed.attempts[1].id}));expect(JSON.stringify(gone.attempts[0])).toBe(before)
  const newer=JSON.stringify(mixed.attempts[1]),goneOld=manage(mixed,management(mixed,'delete',{targetAttemptId:mixed.attempts[0].id}));expect(JSON.stringify(goneOld.attempts[0])).toBe(newer)
  const cleared=manage(mixed,management(mixed,'reset',{proposedNewInstallationId:'replacement',proposedNewGeneration:mixed.generation+1}));expect(cleared.schema).toBe('faces-root-v3');expect(cleared.attempts).toEqual([]);expect(cleared.exposure).toEqual([])
 })
 it('reads old guide witness unchanged, migrates only on mutation and retains exact legacy retry',()=>{
  const witness=structuredClone(guideWitness.root) as Root,bytes=JSON.stringify(witness);validateRoot(witness);expect(JSON.stringify(witness)).toBe(bytes)
  const exact={requestId:witness.lastGuideReceipt!.requestId,expectedInstallationId:witness.installationId,expectedGeneration:witness.generation,kind:'guide' as const,payload:{guideVersion:'faces-guide-v1',checkVersion:'faces-check-v1'}}
  expect(manage(witness,exact)).toBe(witness);expect(witness.schema).toBe('faces-root-v2')
  expect(()=>manage(witness,{...exact,payload:{guideVersion:GUIDE,checkVersion:CHECK}})).toThrow()
  for(const pair of [['faces-guide-v1','faces-check-v1'],['faces-guide-v2','faces-check-v2'],[GUIDE,'faces-check-v2'],['unknown','other']])expect(()=>manage(witness,management(witness,'guide',{guideVersion:pair[0],checkVersion:pair[1]}))).toThrow()
  const migrated=initialReady(witness,uid());expect(migrated.schema).toBe('faces-root-v3');expect(migrated.guideCompletion).toEqual(witness.guideCompletion);expect(migrated.lastGuideReceipt).toEqual(witness.lastGuideReceipt)
  const current=manage(migrated,management(migrated,'guide',{guideVersion:GUIDE,checkVersion:CHECK}));expect(current.guideCompletion).toEqual({guideVersion:GUIDE,checkVersion:CHECK});expect(current.requestFences).toContainEqual({requestId:witness.lastGuideReceipt!.requestId,kind:'guide'})
  const other=structuredClone(witness);other.guideCompletion={guideVersion:'legacy-guide-custom',checkVersion:'faces-check-v2'};other.lastGuideReceipt={...other.lastGuideReceipt!,...other.guideCompletion};validateRoot(other);const otherMigrated=initialReady(other,uid());expect(otherMigrated.guideCompletion).toEqual(other.guideCompletion);expect(otherMigrated.lastGuideReceipt).toEqual(other.lastGuideReceipt)
  const mismatch=structuredClone(witness);mismatch.lastGuideReceipt!.guideVersion='faces-guide-v2';expect(()=>validateRoot(mismatch)).toThrow();const mismatchV3=structuredClone(migrated);mismatchV3.lastGuideReceipt!.guideVersion='faces-guide-v2';expect(()=>validateRoot(mismatchV3)).toThrow();expect(JSON.stringify(witness)).toBe(bytes)
 })
})


describe('Faces exposure validation before migration',()=>{
 it('keeps v2 restricted to its original pair and v3 to the two exact pairs',()=>{
  const pair=(spec:typeof LEGACY|typeof CURRENT)=>({formId:spec.formId,assetBankHash:spec.bankHash,familiarity:'familiar' as const})
  for(const schema of ['faces-root-v2','faces-root-v3'] as const){
   for(const exposure of [[],[pair(LEGACY)],[pair(CURRENT)],[pair(LEGACY),pair(CURRENT)],[pair(CURRENT),pair(LEGACY)]]){
    const root={...structuredClone(guideWitness.root),schema,exposure} as Root,bytes=JSON.stringify(root)
    if(schema==='faces-root-v2'&&exposure.some(e=>e.formId===CURRENT.formId)){
     expect(()=>validateRoot(root)).toThrow();expect(()=>initialReady(root,uid())).toThrow()
     expect(()=>manage(root,management(root,'guide',{guideVersion:GUIDE,checkVersion:CHECK}))).toThrow()
    }else{validateRoot(root);expect(initialReady(root,uid()).schema).toBe('faces-root-v3')}
    expect(JSON.stringify(root)).toBe(bytes)
   }
   for(const exposure of [[pair(LEGACY),pair(LEGACY)],[pair(CURRENT),pair(CURRENT)],[pair(LEGACY),pair(CURRENT),pair(LEGACY)],[{...pair(LEGACY),formId:'unknown'}],[{...pair(LEGACY),assetBankHash:'0'.repeat(64)}],[{...pair(CURRENT),assetBankHash:'0'.repeat(64)}]]){
    const root={...structuredClone(guideWitness.root),schema,exposure} as Root
    expect(()=>validateRoot(root)).toThrow();expect(()=>initialReady(root,uid())).toThrow()
   }
  }
 })
})
