/** Storage V2: sanitized deletion checkpoints plus ordered replay. V1 is kept
 * byte-for-byte in legacy-core for historical validation and game semantics. */
import * as v1 from './legacy-core'
import type {Command,Attempt,Root as LegacyRoot} from './legacy-core'
export {forms,decisionResult,receiptIdentity,validCompleted,money,action,assert,currentAuthority} from './legacy-core'
export type {Command,Attempt,Round,Decision,JournalEvent,Ticket,Route,ResultData} from './legacy-core'
import {assert} from './legacy-core'
const copy=<T>(v:T):T=>structuredClone(v)
const json=(v:unknown)=>JSON.stringify(v)
const equal=(a:unknown,b:unknown)=>json(a)===json(b)
export const VERSION='money_exchange_2_storage_v2_0'
type Outcome=LegacyRoot['outcomes'][string]
interface Retirement {requestId:string;deletionId:string;attemptId:string|null;generation:number}
// Private, value-free lineage only for a withdrawal resolved through an opening.
// This is never an outcome/readback receipt and carries no old play payload.
interface Proof {commands:Command[];lineage?:Record<string,{opening:Command;ticketId:string}>}
interface State extends LegacyRoot {proofs:Record<string,Proof>;retired:Record<string,Retirement>;resetReceipt:Outcome|null}
export interface Root extends State {checkpoint:{version:'storage_v2_0';revision:number;state:State};tail:Command[]}
const navigation=new Set(['enter','ready','tryAgain','reviewReplay','exit'])
const deletion=new Set(['deleteAttempt','deleteAll'])
const opaque=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9./_-]{0,179}$/.test(v)
const integer=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0
function keys(value:unknown,allowed:string[]){assert(!!value&&typeof value==='object'&&!Array.isArray(value),'invalid record');assert(Object.keys(value).every(k=>allowed.includes(k)),'unknown field')}
const rootKeys=['version','activity','installationId','generation','revision','lease','route','ticketSerial','currentTicketId','tickets','activeAttemptId','formCounter','exposureHistory','attempts','tombstones','outcomes','navigation','proofs','retired','resetReceipt']
const commandKeys=['kind','requestId','installationId','generation','ownerId','leaseEpoch','at','context','routeEpoch','ticketId','stage','expectedRevision','destination','afterReadyRequestId','afterRestartRequestId','attemptId','rating','cents','operation','receipt','reason','input']
function identityFields(kind:string){
 const base=['kind','requestId','installationId','generation']
 if(deletion.has(kind))return [...base,...(kind==='deleteAttempt'?['attemptId']:[])]
 const common=[...base,'ownerId','leaseEpoch','routeEpoch','ticketId']
 return [...common,...(['tryAgain','reviewReplay'].includes(kind)?['attemptId']:[]),...(kind==='exit'?['destination','afterReadyRequestId','afterRestartRequestId']:[])]
}
export function canonical(command:Command):Command {
 if(!navigation.has(command.kind)&&!deletion.has(command.kind))return copy(command)
 return Object.fromEntries(identityFields(command.kind).filter(k=>command[k as keyof Command]!==undefined).map(k=>[k,command[k as keyof Command]])) as unknown as Command
}
function checkCommand(c:Command,projected=false){
 keys(c,projected?identityFields(c.kind):commandKeys)
 assert(['claimLease','loseLease','enter','ready','arm','step','terminal','exit','history','historyReport','historyBack','reviewReplay','report','tryAgain','deleteAttempt','deleteAll'].includes(c.kind),'command kind')
 if(c.context!==undefined)assert(c.kind==='arm','context outside arm');if(c.cents!==undefined)assert(c.kind==='step','choice outside step');if(c.rating!==undefined)assert(['step','terminal'].includes(c.kind),'rating outside play');if(c.receipt!==undefined||c.operation!==undefined)assert(c.kind==='step','receipt outside play');if(c.reason!==undefined)assert(c.kind==='exit','reason outside exit')
 assert(opaque(c.requestId)&&opaque(c.installationId)&&integer(c.generation)&&c.generation>0,'command identity')
 if(!deletion.has(c.kind))assert(opaque(c.ownerId)&&integer(c.leaseEpoch),'command owner')
 for(const k of ['ticketId','attemptId','afterReadyRequestId','afterRestartRequestId'] as const)if(c[k]!==undefined)assert(opaque(c[k]),'command lineage')
 for(const k of ['routeEpoch','expectedRevision'] as const)if(c[k]!==undefined)assert(integer(c[k]),'command revision')
 if(!projected)assert(Number.isFinite(c.at)&&c.at>=0,'command time')
 if(projected)assert(equal(c,canonical(c)),'noncanonical identity')
}
function state(root:Root):State {return Object.fromEntries(rootKeys.map(k=>[k,copy(root[k as keyof Root])])) as unknown as State}
function checkpoint(s:State):Root {return {...copy(s),checkpoint:{version:'storage_v2_0',revision:s.revision,state:copy(s)},tail:[]}}
export function initialRoot(ownerId:string|null=null):Root {return checkpoint({...v1.initialRoot(ownerId),version:VERSION,proofs:{},retired:{},resetReceipt:null})}
function attemptFor(s:LegacyRoot,c:Command):string|null {return c.attemptId??(c.ticketId?s.tickets[c.ticketId]?.attemptId:null)??(c.kind==='loseLease'?s.activeAttemptId:null)??null}
function seedProof(installationId:string,attempt:Attempt):LegacyRoot {
 const r=v1.initialRoot(attempt.ownerId);r.installationId=installationId;r.generation=attempt.generation;r.formCounter=attempt.ordinal-1;
 r.lease={ownerId:attempt.ownerId,epoch:attempt.leaseEpoch,live:true};r.route={stage:'ready',epoch:1,ownerId:attempt.ownerId};
 r.ticketSerial=Number(attempt.originTicketId.split('.')[1]);r.currentTicketId=attempt.originTicketId;
 r.tickets[attempt.originTicketId]={id:attempt.originTicketId,generation:r.generation,ownerId:attempt.ownerId,leaseEpoch:attempt.leaseEpoch,state:'open',attemptId:null};return r
}
function appendProof(s:State,before:LegacyRoot,a:Attempt,c:Command){
 const proof=s.proofs[a.id]??={commands:[]};proof.commands.push(copy(c))
 const chain=c.afterReadyRequestId??c.afterRestartRequestId,opening=chain?before.outcomes[chain]:null
 if(c.kind==='exit'&&opening){
  const ticketId=opening.result.successorTicketId??opening.result.ticketId
  assert(ticketId===a.originTicketId,'captured proof lineage')
  ;(proof.lineage??={})[c.requestId]={opening:canonical(opening.command),ticketId}
 }
}
function validateProof(s:State,a:Attempt,proof:Proof){
 keys(proof,['commands','lineage']);assert(Array.isArray(proof.commands)&&proof.commands.length>0,'missing retained proof')
 if(proof.lineage)keys(proof.lineage,Object.keys(proof.lineage))
 const usedLineage=new Set<string>();let replay=seedProof(s.installationId,a)
 const authority=(c:Command)=>assert(c.installationId===s.installationId&&c.generation===a.generation&&c.ownerId===a.ownerId&&c.leaseEpoch===a.leaseEpoch,'proof owner')
 for(const [i,c] of proof.commands.entries()){
  checkCommand(c);assert(i===0?c.kind==='arm':['step','terminal','exit','loseLease'].includes(c.kind),'proof kind');authority(c)
  assert(c.attemptId===undefined||c.attemptId===a.id,'proof attempt binding')
  const binding=proof.lineage?.[c.requestId]
  if(binding){
   usedLineage.add(c.requestId);keys(binding,['opening','ticketId']);const o=binding.opening;checkCommand(o,true);authority(o)
   assert(c.kind==='exit'&&c.destination==='Close'&&binding.ticketId===a.originTicketId,'proof lineage target')
   assert(o.ticketId===c.ticketId&&o.requestId===(c.afterReadyRequestId??c.afterRestartRequestId)&&o.requestId!==c.requestId,'proof lineage identity')
   if(c.afterRestartRequestId)assert(!c.afterReadyRequestId&&o.kind==='exit'&&o.destination==='Restart','proof restart lineage')
   else assert(['ready','tryAgain','reviewReplay'].includes(o.kind)&&o.routeEpoch===c.routeEpoch,'proof ready lineage')
   const target=s.tickets[binding.ticketId],origin=o.ticketId?s.tickets[o.ticketId]:null
   assert(target&&target.ownerId===a.ownerId&&target.leaseEpoch===a.leaseEpoch,'proof lineage authority')
   if(o.ticketId)assert(origin&&origin.ownerId===a.ownerId&&origin.leaseEpoch===a.leaseEpoch&&Number(binding.ticketId.split('.')[1])===Number(o.ticketId.split('.')[1])+1,'proof lineage inventory')
   else assert(o.kind==='ready'||o.kind==='reviewReplay','proof lineage origin')
   // Recreate only the independently bound value-free predecessor needed by
   // the original command. Keep the command's original ticket and chain IDs.
   replay.outcomes[o.requestId]={command:copy(o),payloadHash:json(o),result:{...(o.kind==='exit'?{successorTicketId:binding.ticketId}:{ticketId:binding.ticketId})},route:copy(replay.route),revision:0}
  }else if(c.kind==='loseLease')assert(c.ticketId===undefined||c.ticketId===a.originTicketId,'withdrawal ticket binding')
  else assert(c.ticketId===a.originTicketId,'proof ticket binding')
  const before=replay.attempts[a.id]
  // Route epochs are root history, not attempt history; ticket/chain authority
  // above is established independently before the semantic proof is replayed.
  const next=v1.transition(replay,{...c,routeEpoch:binding?c.routeEpoch:replay.route.epoch})
  assert(next.outcome.accepted&&!('replay' in next.outcome&&next.outcome.replay)&&!equal(before,next.root.attempts[a.id]),'unnecessary or invalid retained proof');replay=next.root
  const retired=s.retired[c.requestId]
  if(retired){
   assert(['exit','loseLease'].includes(c.kind)&&before?.status==='Armed'&&replay.attempts[a.id]?.status==='Incomplete','retired proof is not necessary withdrawal')
   assert(retired.attemptId===a.id&&!s.tombstones[a.id]&&!s.outcomes[c.requestId],'retired proof survivor binding')
   assert(a.events.some(e=>e.requestId===c.requestId&&e.kind==='ended_incomplete'),'retired proof event binding')
  }
 }
 assert(equal([...usedLineage].sort(),Object.keys(proof.lineage??{}).sort()),'extraneous proof lineage')
 assert(equal(replay.attempts[a.id],a),'retained attempt differs from proof')
}
function validateState(s:State){
 keys(s,rootKeys);assert(s.version===VERSION&&opaque(s.installationId)&&integer(s.generation)&&s.generation>0&&integer(s.revision),'checkpoint header')
 keys(s.lease,['ownerId','epoch','live']);keys(s.route,['stage','epoch','ownerId']);assert(integer(s.lease.epoch)&&integer(s.route.epoch)&&typeof s.lease.live==='boolean','lease/route')
 assert(s.lease.ownerId===null||opaque(s.lease.ownerId),'owner identity');assert(s.route.ownerId===s.lease.ownerId,'route owner');assert(!s.lease.live||s.lease.ownerId!==null,'live owner')
 assert(['library','instructions','ready','active','test_complete','report','history','review'].includes(s.route.stage),'route stage')
 for(const n of [s.ticketSerial,s.formCounter])assert(integer(n),'counter')
 for(const k of ['tickets','attempts','proofs','tombstones','outcomes','retired','activity'] as const)keys(s[k],Object.keys(s[k]))
 assert(Array.isArray(s.exposureHistory)&&s.exposureHistory.length===s.formCounter,'exposure count')
 const exposed=new Set<string>()
 for(const [i,e] of s.exposureHistory.entries()){
  keys(e,['attemptId','formId','formDigest']);const id=`A${s.generation}.${i+1}`,form=v1.forms[i%v1.forms.length];
  assert(e.attemptId===id&&!exposed.has(id)&&e.formId===form.id,'exposure identity');exposed.add(id)
  const sample=seedProof(s.installationId,{ownerId:s.lease.ownerId??'validation',generation:s.generation,ordinal:i+1,leaseEpoch:1,originTicketId:'T'+s.generation+'.1'} as Attempt)
  const arm:Command={kind:'arm',requestId:'validate',installationId:s.installationId,generation:s.generation,ownerId:sample.lease.ownerId!,leaseEpoch:1,ticketId:sample.currentTicketId!,at:0}
  assert(v1.transition(sample,arm).root.attempts[id]?.formDigest===e.formDigest,'form digest')
  assert(Boolean(s.attempts[id])!==Boolean(s.tombstones[id]),'exposure must be retained or deleted')
 }
 for(const [id,t] of Object.entries(s.tickets)){
  keys(t,['id','generation','ownerId','leaseEpoch','state','attemptId']);assert(id===t.id&&new RegExp(`^T${s.generation}\\.[1-9][0-9]*$`).test(id)&&Number(id.split('.')[1])<=s.ticketSerial,'ticket identity');assert(t.generation===s.generation&&opaque(t.ownerId)&&integer(t.leaseEpoch)&&t.leaseEpoch<=s.lease.epoch&&['open','consumed','canceled'].includes(t.state),'ticket authority');
  assert(t.attemptId===null||exposed.has(t.attemptId),'ticket attempt');if(t.state==='open')assert(t.attemptId===null,'open ticket')
 }
 assert(Object.keys(s.tickets).length===s.ticketSerial,'ticket inventory');
 const proofRequests=new Map<string,Command>()
 for(const [id,a] of Object.entries(s.attempts)){
  assert(id===a.id&&exposed.has(id)&&!s.tombstones[id]&&a.ordinal===Number(id.split('.')[1])&&a.generation===s.generation,'attempt identity');assert(s.tickets[a.originTicketId]?.attemptId===id,'attempt ticket');validateProof(s,a,s.proofs[id]);
  for(const c of s.proofs[id].commands){assert(!proofRequests.has(c.requestId),'proof request conflict');proofRequests.set(c.requestId,c)}
 }
 assert(equal(Object.keys(s.proofs).sort(),Object.keys(s.attempts).sort()),'proof inventory')
 const lineageTargets=new Map<string,string>()
 for(const p of Object.values(s.proofs))for(const b of Object.values(p.lineage??{})){
  const old=proofRequests.get(b.opening.requestId)??s.outcomes[b.opening.requestId]?.command
  assert(old||s.retired[b.opening.requestId],'unrecorded lineage request')
  if(old)assert(equal(canonical(old),b.opening),'conflicting lineage request')
  else assert(s.retired[b.opening.requestId].attemptId===attemptFor(s,b.opening),'retired lineage origin')
  assert(!lineageTargets.has(b.opening.requestId)||lineageTargets.get(b.opening.requestId)===b.ticketId,'conflicting lineage target');lineageTargets.set(b.opening.requestId,b.ticketId)
 }

 for(const [id,value] of Object.entries(s.tombstones))assert(value===true&&exposed.has(id)&&!s.attempts[id],'tombstone')
 const current=s.currentTicketId?s.tickets[s.currentTicketId]:null
 assert(s.currentTicketId===null||!!current&&current.state!=='canceled'&&current.ownerId===s.lease.ownerId&&current.leaseEpoch===s.lease.epoch&&s.lease.live,'current ticket')
 assert(s.activeAttemptId===null||s.attempts[s.activeAttemptId]?.status==='Armed'&&current?.attemptId===s.activeAttemptId,'active attempt')
 for(const a of Object.values(s.attempts))if(a.status==='Armed')assert(s.activeAttemptId===a.id&&a.playCapability,'armed topology')
 if(s.route.stage==='active')assert(!!s.activeAttemptId,'active route');if(s.route.stage==='ready')assert(current?.state==='open','ready route')
 if(['library','instructions','history','review'].includes(s.route.stage))assert(!current&&!s.activeAttemptId,'inactive route')
 if(['test_complete','report'].includes(s.route.stage))assert(current?.attemptId&&v1.validCompleted(s.attempts[current.attemptId]),'completed route')
 for(const [id,r] of Object.entries(s.retired)){keys(r,['requestId','deletionId','attemptId','generation']);assert(id===r.requestId&&opaque(id)&&opaque(r.deletionId)&&r.generation===s.generation&&(r.attemptId===null||exposed.has(r.attemptId))&&!s.outcomes[id],'retirement')}
 for(const [id,o] of Object.entries(s.outcomes)){
  keys(o,['command','payloadHash','result','route','revision']);const c=o.command;assert(c.requestId===id&&!s.retired[id]&&integer(o.revision)&&o.revision<=s.revision,'outcome identity');checkCommand(c,navigation.has(c.kind)||deletion.has(c.kind));if(proofRequests.has(id))assert(equal(c,canonical(proofRequests.get(id)!)),'mixed proof receipt identity');assert(o.payloadHash===json(c),'outcome comparison');assert(c.installationId===s.installationId&&(c.generation===s.generation||c.kind==='deleteAll'&&c.generation===s.generation-1),'outcome boundary');keys(o.result,['stage','ticketId','attemptId','destination','successorTicketId','generation','deleted','leaseEpoch','ownerLost']);keys(o.route,['stage','epoch','ownerId']);assert(integer(o.route.epoch)&&o.route.epoch<=s.route.epoch&&opaque(o.route.ownerId??'none'),'outcome route')
  const z=o.result;for(const k of ['ticketId','successorTicketId'] as const)if(z[k]!=null)assert(!!s.tickets[z[k]!],'outcome ticket');if(z.attemptId!=null)assert(exposed.has(z.attemptId),'outcome attempt');if(z.deleted!==undefined)assert(s.tombstones[z.deleted]===true&&c.kind==='deleteAttempt'&&c.attemptId===z.deleted,'deletion receipt');if(z.destination!==undefined)assert(['Close','Restart'].includes(z.destination),'outcome destination');if(z.generation!==undefined)assert(integer(z.generation),'outcome generation');if(z.stage!==undefined)assert(['instructions','ready','library','history','review','report_1','test_complete','new_partner',...['award','connecting','connected','partner_rules','bonus','choice','partner_choice','result','fairness'].flatMap(x=>[x+'_1',x+'_2'])].includes(z.stage),'outcome stage');
  const a=attemptFor(s,c);if(!navigation.has(c.kind)&&!deletion.has(c.kind)&&a)assert(!!s.attempts[a],'deleted outcome payload')
  if(['arm','step','terminal'].includes(c.kind))assert(a&&s.proofs[a]?.commands.some(x=>equal(x,c)),'outcome lacks proof')
 }
 for(const [id,items] of Object.entries(s.activity)){assert(!!s.attempts[id]&&Array.isArray(items),'activity inventory');for(const x of items){keys(x,['id','kind','at']);const o=s.outcomes[x.id];assert(o&&['report','historyReport'].includes(o.command.kind)&&attemptFor(s,o.command)===id&&x.kind==='report_opened'&&x.at===o.command.at,'activity proof')}}
 if(s.navigation){keys(s.navigation,['destination','requestId']);assert(['Close','Restart'].includes(s.navigation.destination)&&s.outcomes[s.navigation.requestId]?.command.kind==='exit','navigation')}
 if(s.resetReceipt){keys(s.resetReceipt,['command','payloadHash','result','route','revision']);checkCommand(s.resetReceipt.command,true);assert(s.resetReceipt.command.kind==='deleteAll'&&s.resetReceipt.command.generation===s.generation-1&&s.resetReceipt.result.generation===s.generation&&s.resetReceipt.command.installationId===s.installationId&&equal(s.outcomes[s.resetReceipt.command.requestId],s.resetReceipt),'reset boundary')}
}
export type Readback={status:'retired/deleted'|'fenced/unavailable'|'absent'|'rejection'}|{status:'confirmed';outcome:Outcome}
export function readback(s:State,c:Command):Readback {
 const identity=canonical(c),reset=s.resetReceipt
 if(reset?.command.requestId===c.requestId)return equal(reset.command,identity)?{status:'confirmed',outcome:copy(reset)}:{status:'rejection'}
 if(c.installationId!==s.installationId||c.generation!==s.generation)return{status:'fenced/unavailable'}
 if(s.retired[c.requestId])return{status:'retired/deleted'}
 const old=s.outcomes[c.requestId];if(old)return equal(old.command,identity)?{status:'confirmed',outcome:copy(old)}:{status:'rejection'}
 const origin=attemptFor(s,c),chain=c.afterReadyRequestId??c.afterRestartRequestId;const receipt=chain?s.outcomes[chain]:null;
 if(origin&&s.tombstones[origin]&&!deletion.has(c.kind)&&!(c.kind==='exit'&&receipt))return{status:'retired/deleted'};
 return{status:'absent'}
}
function compact(s:State,deletionId:string){
 for(const [id,o] of Object.entries(s.outcomes)){
  const c=o.command,owners=Object.entries(s.proofs).filter(([id,p])=>s.attempts[id]&&p.commands.some(x=>x.requestId===c.requestId)),successor=o.result.successorTicketId??o.result.ticketId
  const a=owners[0]?.[0]??attemptFor(s,c)
  const nav=navigation.has(c.kind)||c.kind==='loseLease'
  const keepNav=nav&&(successor&&successor===s.currentTicketId||id===s.navigation?.requestId||c.kind==='enter'&&s.route.stage==='instructions')
  if(deletion.has(c.kind))continue
  if(keepNav){o.command=canonical(c);o.payloadHash=json(o.command);continue}
  if(!nav&&a&&s.attempts[a])continue
  s.retired[id]={requestId:id,deletionId,attemptId:a,generation:s.generation};delete s.outcomes[id]
 }
 for(const id of Object.keys(s.proofs))if(!s.attempts[id])delete s.proofs[id]
 return checkpoint(s)
}
function apply(previous:Root,c:Command):{root:Root;outcome:{accepted:boolean;reason?:string;replay?:boolean}&v1.ResultData}{
 const r=copy(previous),status=readback(r,c)
 if(status.status==='confirmed')return{root:r,outcome:{accepted:true,...status.outcome.result,replay:true}}
 if(status.status!=='absent')return{root:r,outcome:{accepted:false,reason:status.status==='rejection'?'request-conflict':status.status}}
 try{checkCommand(c)}catch{return{root:r,outcome:{accepted:false,reason:'invalid-command'}}}
 const origin=attemptFor(r,c)
 // Chained exit is resolved against retained value-free receipt before origin
 // deletion. The V1 engine then verifies owner, lineage and current successor.
 if(origin&&r.tombstones[origin]&&!deletion.has(c.kind)&&!(c.kind==='exit'&&(c.afterReadyRequestId||c.afterRestartRequestId)))return{root:r,outcome:{accepted:false,reason:'retired/deleted'}}
 const next=v1.transition(state(r),c);if(!next.outcome.accepted)return{root:r,outcome:next.outcome}
 const s={...next.root,version:VERSION,proofs:copy(r.proofs),retired:copy(r.retired),resetReceipt:copy(r.resetReceipt)} as State
 // Save precisely those commands which change a retained attempt, independently
 // of root history and navigation receipt projection.
 for(const [id,a] of Object.entries(s.attempts))if(!equal(a,r.attempts[id]))appendProof(s,r,a,c)
 const saved=s.outcomes[c.requestId];saved.command=canonical(c);saved.payloadHash=json(saved.command)
 if(c.kind==='deleteAll'){s.proofs={};s.retired={};s.resetReceipt=copy(saved);return{root:checkpoint(s),outcome:next.outcome}}
 if(c.kind==='deleteAttempt')return{root:compact(s,c.requestId),outcome:next.outcome}
 return{root:{...s,checkpoint:copy(r.checkpoint),tail:[...copy(r.tail),copy(c)]},outcome:next.outcome}
}
export function transition(previous:Root,command:Command){return apply(previous,command)}
export function validateRoot(root:Root){
 keys(root,[...rootKeys,'checkpoint','tail']);keys(root.checkpoint,['version','revision','state']);assert(root.checkpoint.version==='storage_v2_0'&&root.checkpoint.revision===root.checkpoint.state.revision&&Array.isArray(root.tail),'checkpoint identity');validateState(root.checkpoint.state)
 let replay=checkpoint(root.checkpoint.state)
 for(const c of root.tail){const next=apply(replay,c);assert(next.outcome.accepted&&!('replay' in next.outcome&&next.outcome.replay),'invalid tail');replay=next.root}
 assert(equal(replay,root),'root disagrees with checkpoint replay');validateState(state(root))
}
export function migrate(old:LegacyRoot|Root):Root {
 if(old.version===VERSION){validateRoot(old as Root);return copy(old as Root)}
 v1.validateRoot(old)
 const s={...copy(old),version:VERSION,proofs:{},retired:{},resetReceipt:null} as State
 // Derive each proof by replaying the already validated historical full ledger.
 let replay=v1.initialRoot(null);replay.installationId=old.installationId
 const values=Object.values(old.outcomes).sort((a,b)=>a.revision-b.revision)
 if(values[0]?.command.kind==='deleteAll'){
  const reset=values[0];replay.generation=reset.command.generation;replay.revision=reset.revision-1;const claim=values.find(v=>v.command.kind==='claimLease');replay.lease.epoch=claim?Number(claim.result.leaseEpoch)-2:old.lease.epoch-1;replay.route.epoch=reset.route.epoch-1
 }
 for(const o of values){const next=v1.transition(replay,o.command);assert(next.outcome.accepted,'migration replay');for(const [id,a] of Object.entries(next.root.attempts))if(old.attempts[id]&&!equal(a,replay.attempts[id]))appendProof(s,replay,a,o.command);replay=next.root}
 for(const o of Object.values(s.outcomes)){o.command=canonical(o.command);o.payloadHash=json(o.command);if(o.command.kind==='deleteAll')s.resetReceipt=copy(o)}
 const result=compact(s,'migration/'+s.generation);validateRoot(result);return result
}
