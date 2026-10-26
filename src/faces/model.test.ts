import {describe,it,expect} from 'vitest'
import {append,manage,management,LEGACY,LABELS,EVENT,GUIDE,CHECK,initialReady,limitUs,project,reportFor,validateRoot} from './model'
import type {Command,Root} from './model'
import samples from '../../docs/qa/faces-v1/serialized-examples-v2.json'
// Exact synthetic packet witnesses are test-only; no author evidence enters the playable bundle.
const id=(n:number)=>`id-${n}`
const FORM_ID=LEGACY.formId,FORM_HASH=LEGACY.formHash,BANK_HASH=LEGACY.bankHash,SCORING=LEGACY.scoringVersion,ITEMS=LEGACY.items
function base():Root{return {schema:'faces-root-v2',installationId:'test-install',generation:0,revision:0,nextSequence:1,route:null,attempts:[],requestFences:[],attemptFences:[],exposure:[],guideCompletion:{guideVersion:'faces-guide-v2',checkVersion:'faces-check-v2'},lastGuideReceipt:{requestId:'guide',guideVersion:'faces-guide-v2',checkVersion:'faces-check-v2'},deletionReceipts:[],lastReset:null}}
function complete(mode:'standard-v1'|'extended-v1'='standard-v1',choices=ITEMS.map(i=>i.intended),elapsed=ITEMS.map(()=>1_000_000)){
 let root=base(),n=0;root=initialReady(root,'lease');const route=root.route!;const attempt='run'
 const cmd=(kind:Command['kind'],payload:Record<string,unknown>):Command=>({eventVersion:EVENT,requestId:id(++n),installationId:root.installationId,generation:root.generation,routeId:route.id,leaseId:'lease',attemptId:attempt,kind,payload})
 const open=cmd('open',{readyEpoch:route.epoch,formId:FORM_ID,formHash:FORM_HASH,assetBankHash:BANK_HASH,modeId:mode,scoringVersion:SCORING,startedAtWall:'2026-10-16T12:00:00Z',clockDocumentId:'clock',familiarity:'new-local-record'})
 root.route={...route,state:'opening',pendingOpeningId:open.requestId};root=append(root,open)
 for(let i=0;i<14;i++){
  const item=ITEMS[i],intent=cmd('intent',{item:i,assetId:item.assetId,assetSha256:item.assetSha256,contextSha256:item.contextSha256});root=append(root,intent)
  const onset=cmd('onset',{item:i,intentRequestId:intent.requestId,clockDocumentId:'clock',onsetUs:i*100_000_000,receiptVersion:'faces-render-v1'});root=append(root,onset)
  const response=cmd('response',{item:i,onsetRequestId:onset.requestId,choice:choices[i],elapsedUs:elapsed[i],timely:elapsed[i]<limitUs(mode,i),inputClass:'keyboard'});root=append(root,response)
 }
 return root
}
describe('Faces frozen contract projection',()=>{
 it('accepts the frozen fresh and opened-intent witnesses',()=>{validateRoot(samples.freshRoot);validateRoot(samples.openedIntentRoot)})
 it('retains fourteen timing facts but excludes only discussion slots from matching',()=>{
  const root=complete(),a=root.attempts[0],r=a.report!
  expect(a.status).toBe('completed');expect(a.facts.responses).toHaveLength(14)
  expect(r.context).toMatchObject({total:8,eligibleTotal:6,excludedTotal:2,matches:6,timelyCount:8})
  expect(r.photo).toMatchObject({total:6,eligibleTotal:6,excludedTotal:0,matches:6,timelyCount:6})
  const variant=complete('standard-v1',ITEMS.map((i,n)=>n===1||n===6?LABELS.find(x=>x!==i.intended)!:i.intended)).attempts[0].report!
  expect(variant).toEqual(r)
 })
 it('classifies equality late before rounding, with distinct extended limits',()=>{
  const standard=complete('standard-v1',ITEMS.map(i=>i.intended),ITEMS.map((_,i)=>limitUs('standard-v1',i))).attempts[0].report!
  const extended=complete('extended-v1',ITEMS.map(i=>i.intended),ITEMS.map((_,i)=>limitUs('standard-v1',i))).attempts[0].report!
  expect(standard.context.lateCount).toBe(8);expect(standard.photo.lateCount).toBe(6)
  expect(extended.context.lateCount).toBe(0);expect(extended.photo.lateCount).toBe(0)
  expect(standard.context.timelyCount).toBe(0);expect(standard.photo.timelyCount).toBe(0)
 })
 it('rejects unsupported identities and fact/report contradiction',()=>{
  const valid=complete();const bad=structuredClone(valid);bad.attempts[0].report!.context.matches=0;expect(()=>validateRoot(bad)).toThrow()
  const unsupported=structuredClone(valid);unsupported.attempts[0].formHash='0'.repeat(64);expect(()=>validateRoot(unsupported)).toThrow()
  const omitted=structuredClone(valid);omitted.attempts[0].receipts.pop();expect(()=>validateRoot(omitted)).toThrow()
  const extra=structuredClone(valid) as unknown as Record<string,unknown>;extra.unexpected=1;expect(()=>validateRoot(extra)).toThrow()
 })
 it('does not give incomplete attempts a completed score',()=>{
  const full=complete(),a=full.attempts[0],prefix=a.receipts.slice(0,-1)
  const partial=project(prefix);expect(partial.status).toBe('active');expect(partial.report).toBeNull();expect(partial.facts.responses).toHaveLength(13)
  expect(()=>reportFor(partial)).toThrow()
 })
 it('keeps terminal ordering decisive for the final answer and exit',()=>{
  const full=complete(),last=full.attempts[0].receipts.at(-1)!,before=structuredClone(full)
  before.attempts[0]=project(before.attempts[0].receipts.slice(0,-1));before.nextSequence=last.sequence;before.route={...before.route!,state:'play',lease:'lease',attemptId:'run'}
  const terminal:Command={...last.command,requestId:'exit-final',kind:'exit',payload:{destination:'library',reason:'close',observedUs:1_300_000_099,clockDocumentId:'clock'}}
  const exitFirst=append(before,terminal)
  expect(exitFirst.attempts[0]).toMatchObject({status:'incomplete',report:null})
  expect(exitFirst.attempts[0].facts.responses).toHaveLength(13)
  expect(()=>append(exitFirst,last.command)).toThrow()
  expect(full.attempts[0].status).toBe('completed')
  expect(()=>append(full,terminal)).toThrow()
 })
 it('rejects a false present root and a forged discussion match',()=>{
  expect(()=>validateRoot(false)).toThrow()
  const root=complete(),receipt=root.attempts[0].receipts.find(r=>r.command.kind==='response'&&r.command.payload.item===1)!
  receipt.command.payload.choice='Sadness'
  expect(()=>validateRoot(root)).toThrow()
 })
})


describe('Grouped authority regressions',()=>{
 const clone=<T>(v:T):T=>structuredClone(v)
 function first(){const r=complete();r.attempts[0]=project(r.attempts[0].receipts.slice(0,3));r.nextSequence=4;r.route={...r.route!,state:'play',lease:'lease',attemptId:'run'};return r}
 function expiry(root:Root){const response=complete().attempts[0].receipts[3].command;return {...response,routeId:root.route!.id,requestId:'expiry',kind:'expiry' as const,payload:{item:0,onsetRequestId:root.attempts[0].facts.onsets[0].requestId,deadlineUs:30_000_000,observedUs:30_000_000}}}
 function response(root:Root){return {...expiry(root),kind:'response' as const,requestId:'response',payload:{item:0,onsetRequestId:root.attempts[0].facts.onsets[0].requestId,choice:'Anger',elapsedUs:29_999_999,timely:true,inputClass:'assistive'}}}
 it('rejects transplanted roots and missing bank exposure',()=>{for(const change of [(r:Root)=>{r.generation++},(r:Root)=>{r.installationId='foreign'},(r:Root)=>{r.exposure=[]}]){const r=complete();change(r);expect(()=>validateRoot(r)).toThrow()}})
 it('rejects timely response after unsuppressed expiry; late response preserves one expiry',()=>{let r=first();r=append(r,expiry(r));expect(()=>append(r,response(r))).toThrow();const c=response(r);c.payload.elapsedUs=30_000_000;c.payload.timely=false;r=append(r,c);expect(r.attempts[0].facts.expired).toEqual([0])})
 it('binds suppression to full command and retained response',()=>{const base=first(),answer=response(base);const r=append(base,expiry(base),{command:answer});expect(r.attempts[0].facts.expired).toEqual([]);expect(append(r,answer).attempts[0].facts.responses).toHaveLength(1);for(const field of ['installationId','routeId','leaseId','attemptId','generation','eventVersion']){const d=clone(answer);(d as unknown as Record<string,unknown>)[field]='foreign';expect(()=>append(base,expiry(base),{command:d})).toThrow()}const changed=clone(answer);changed.payload.choice='Fear';expect(()=>append(r,changed)).toThrow();expect(()=>append(r,{...expiry(r),requestId:'expiry2'},{command:answer})).toThrow()})
 it.each([29_999_999,30_000_000,30_000_001])('derives exit expiry at %i without relying on a timer',observedUs=>{const r=first(),c={...expiry(r),requestId:'exit',kind:'exit' as const,payload:{destination:'instructions',reason:'restart',observedUs,clockDocumentId:'clock'}};expect(append(r,c).attempts[0].facts.expired).toEqual(observedUs>=30_000_000?[0]:[]);expect(append(r,c,{command:response(r)}).attempts[0].facts.expired).toEqual([])})
 it('keeps dead-clock exit unknown and rejects mismatched clocks',()=>{const r=first(),c={...expiry(r),requestId:'exit',kind:'exit' as const,payload:{destination:'instructions',reason:'reload',observedUs:null,clockDocumentId:null}};expect(append(r,c).attempts[0].facts.expired).toEqual([]);expect(()=>append(r,{...c,payload:{...c.payload,observedUs:30_000_000,clockDocumentId:'foreign'}})).toThrow()})
 it('permits the same timely witness if its response wins before exit',()=>{const r=first(),answer=response(r),next=append(r,answer),c={...expiry(r),requestId:'exit',kind:'exit' as const,payload:{destination:'library',reason:'close',observedUs:30_000_001,clockDocumentId:'clock'}};expect(append(next,c,{command:answer}).attempts[0].status).toBe('incomplete')})
 it('seals reset to the old and proposed new identities and rejects historical replay',()=>{const r=base(),a=management(r,'reset',{proposedNewInstallationId:'new-a',proposedNewGeneration:1}),ra=manage(r,a);expect(manage(ra,a)).toBe(ra);expect(()=>manage(ra,{...a,payload:{...a.payload,proposedNewInstallationId:'wrong'}})).toThrow();const b=management(ra,'reset',{proposedNewInstallationId:'new-b',proposedNewGeneration:2}),rb=manage(ra,b),g=management(rb,'guide',{guideVersion:GUIDE,checkVersion:CHECK}),saved=manage(rb,g);const bytes=JSON.stringify(saved);expect(()=>manage(saved,a)).toThrow();expect(JSON.stringify(saved)).toBe(bytes);expect(()=>manage(saved,{...g,unexpected:true} as typeof g)).toThrow()})
 it('rejects stale guide/delete and conflicting same-ID targets in both orders',()=>{const r=complete(),g=management(r,'guide',{guideVersion:GUIDE,checkVersion:CHECK}),d=management(r,'delete',{targetAttemptId:'run'}),reset=management(r,'reset',{proposedNewInstallationId:'next',proposedNewGeneration:1});for(const command of [g,d]){const newer=manage(r,reset);expect(()=>manage(newer,command)).toThrow();const prior=manage(r,command);expect(manage(prior,reset).attempts).toEqual([])}const gone=manage(r,d);expect(manage(gone,d)).toBe(gone);expect(()=>manage(gone,{...d,payload:{targetAttemptId:'other'}})).toThrow();const guided=manage(r,g);expect(manage(guided,g)).toBe(guided);expect(()=>manage(guided,{...g,payload:{guideVersion:'changed',checkVersion:CHECK}})).toThrow()})
 it('retires older guide receipts without retaining answers and preserves unrelated attempts',()=>{const r=complete(),g=management(r,'guide',{guideVersion:GUIDE,checkVersion:CHECK}),a=manage(r,g),b=manage(a,management(a,'guide',{guideVersion:GUIDE,checkVersion:CHECK}));expect(()=>manage(b,g)).toThrow();const before=JSON.stringify(b.attempts[0]),deleted=manage(b,management(b,'delete',{targetAttemptId:'absent'}));expect(JSON.stringify(deleted.attempts[0])).toBe(before)})
 it.each(['fence','guide','deletion','reset'])('rejects %s identity used as expiry or exit dependency without mutation',kind=>{
  for(const terminal of ['expiry','exit'] as const){
   let root=first();const answer=response(root),old=answer.requestId
   if(kind==='fence')root.requestFences.push({requestId:old,kind:'response'})
   if(kind==='guide')answer.requestId=root.lastGuideReceipt!.requestId
   if(kind==='deletion'){root=manage(root,{...management(root,'delete',{targetAttemptId:'unrelated'}),requestId:old})}
   if(kind==='reset'){root.lastReset={requestId:old,oldInstallationId:'older',oldGeneration:-1,newInstallationId:root.installationId,newGeneration:0};root.generation=1;root.lastReset.oldGeneration=0;root.lastReset.newGeneration=1;for(const r of root.attempts[0].receipts)r.command.generation=1;root.attempts[0]=project(root.attempts[0].receipts);answer.generation=1}
   const e=expiry(root);e.generation=root.generation
   const command=terminal==='expiry'?e:{...e,requestId:'exit',kind:'exit' as const,payload:{destination:'instructions',reason:'restart',observedUs:30_000_001,clockDocumentId:'clock'}}
   const before=JSON.stringify(root);expect(()=>append(root,command,{command:answer})).toThrow();expect(JSON.stringify(root)).toBe(before)
  }
 })
 it('permits exact dependency and response reuse but rejects conflicting primary, proof and management identities',()=>{
  const root=first(),answer=response(root),e=expiry(root),held=append(root,e,{command:answer})
  expect(append(held,e,{command:answer})).toBe(held)
  const applied=append(held,answer),exit={...e,requestId:'exit',kind:'exit' as const,payload:{destination:'instructions',reason:'restart',observedUs:30_000_001,clockDocumentId:'clock'}}
  expect(append(applied,exit,{command:answer}).attempts[0].status).toBe('incomplete')
  expect(()=>append(held,{...answer,payload:{...answer.payload,choice:'Fear'}})).toThrow()
  expect(()=>manage(held,{...management(held,'guide',{guideVersion:GUIDE,checkVersion:CHECK}),requestId:answer.requestId})).toThrow()
  const deleted=manage(held,management(held,'delete',{targetAttemptId:'run'}));expect(deleted.requestFences.some(f=>f.requestId===answer.requestId)).toBe(true)
  expect(()=>append(deleted,answer)).toThrow();expect(()=>append(manage(root,management(root,'reset',{proposedNewInstallationId:'new',proposedNewGeneration:1})),e,{command:answer})).toThrow()
 })

})
