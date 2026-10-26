import schema from './schema.json'
import legacySchema from './legacy-schema-v2.json'
import legacyForm from './form.json'
import form from './form-v2.json'
import feedback from './feedback-v3.json'

export const FORM_ID = form.formId
export const FORM_HASH = form.formHash
export const BANK_HASH = form.bankHash
export const SCORING = 'faces-descriptive-v3' as const
export const EVENT = 'faces-event-v2' as const
export const GUIDE = 'faces-guide-v4' as const
export const CHECK = 'faces-check-v4' as const
export const SKIP_CHECK = 'faces-completed-source-v1' as const
const SKIP_GUIDE = 'faces-skip-v1:'
export const LABELS = form.labels as readonly string[]
export const ITEMS = form.items
export const HELP = legacyForm.help
export const FEEDBACK = feedback
export const LEGACY_ITEMS = legacyForm.items
export const REPORT_PRESENTATION = 'faces-report-presentation-v3' as const
export const LEGACY = {formId:legacyForm.formId,formHash:legacyForm.formHash,bankHash:legacyForm.bankHash,scoringVersion:'faces-descriptive-v2',items:legacyForm.items,help:legacyForm.help,feedbackVersion:null,eligible:12} as const
export const CURRENT = {formId:form.formId,formHash:form.formHash,bankHash:form.bankHash,scoringVersion:SCORING,items:form.items,feedbackVersion:'faces-feedback-v3',eligible:14} as const
export const REGISTRY = [LEGACY,CURRENT] as const
export function identity(formId:string,formHash:string,bankHash:string,scoringVersion:string){const match=REGISTRY.find(x=>x.formId===formId&&x.formHash===formHash&&x.bankHash===bankHash&&x.scoringVersion===scoringVersion);invariant(match,'Unsupported Faces identity');return match}
export function identityForAttempt(a:Attempt){return identity(a.formId,a.formHash,a.assetBankHash,a.scoringVersion)}
export type Mode = 'standard-v1'|'extended-v1'
export type Kind = 'open'|'intent'|'onset'|'expiry'|'response'|'exit'|'reconcile'
export type Command = {eventVersion:typeof EVENT;requestId:string;installationId:string;generation:number;routeId:string;leaseId:string;attemptId:string;kind:Kind;payload:Record<string,unknown>}
export type Receipt = {sequence:number;outcome:'applied';command:Command;dependency:null|{command:Command}}
export type Facts={intents:Record<string,unknown>[];onsets:Record<string,unknown>[];responses:Record<string,unknown>[];expired:number[]}
export type Report={excludedItems:number[];formHash:string;modeId:Mode;scoringVersion:string;context:Category;photo:Category;confusionPairs:{category:'context'|'photo';intended:string;selected:string;count:number}[];familiarity:string}
export type Category={total:number;eligibleTotal:number;excludedTotal:number;matches:number;timelyMatches:number;lateCount:number;timelyLatencySumUs:number;timelyCount:number;lateLatencySumUs:number;lateCountForMean:number}
export type Attempt={id:string;routeId:string;leaseId:string;formId:string;formHash:string;assetBankHash:string;modeId:Mode;scoringVersion:string;startedAtWall:string;clockDocumentId:string;status:'active'|'incomplete'|'completed';facts:Facts;report:Report|null;receipts:Receipt[]}
export type Route={id:string;lease:string|null;epoch:number;state:'ready'|'opening'|'play'|'settling'|'idle';attemptId:string|null;pendingOpeningId:string|null;navigation:null|{requestId:string;destination:'instructions'|'library';originAttemptId:string|null;pendingOpeningId:string|null;successorRouteId:string|null}}
export type Root={schema:'faces-root-v2'|'faces-root-v3';installationId:string;generation:number;revision:number;nextSequence:number;route:Route|null;attempts:Attempt[];requestFences:{requestId:string;kind:string}[];attemptFences:string[];exposure:{formId:string;assetBankHash:string;familiarity:'familiar'}[];guideCompletion:null|{guideVersion:string;checkVersion:string};lastGuideReceipt:null|{requestId:string;guideVersion:string;checkVersion:string};deletionReceipts:{requestId:string;installationId:string;generation:number;targetAttemptId:string}[];lastReset:null|{requestId:string;oldInstallationId:string;oldGeneration:number;newInstallationId:string;newGeneration:number}}
export const newId=()=>crypto.randomUUID()
export function freshRoot():Root{return {schema:'faces-root-v3',installationId:newId(),generation:0,revision:0,nextSequence:1,route:null,attempts:[],requestFences:[],attemptFences:[],exposure:[],guideCompletion:null,lastGuideReceipt:null,deletionReceipts:[],lastReset:null}}
export function invariant(condition:unknown,message:string):asserts condition {if(!condition)throw Error(message)}
const canonical=(value:unknown):unknown=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,canonical(v)])):value
const same=(a:unknown,b:unknown)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b))
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value)
export function shape(value:unknown,rule:Record<string,unknown>,defs:Record<string,unknown>=schema.$defs as Record<string,unknown>):boolean {
 if(typeof rule.$ref==='string')return shape(value,defs[rule.$ref.split('/').at(-1)!] as Record<string,unknown>,defs)
 if(Array.isArray(rule.oneOf))return rule.oneOf.filter(x=>shape(value,x as Record<string,unknown>,defs)).length===1
 if(Array.isArray(rule.anyOf))return rule.anyOf.some(x=>shape(value,x as Record<string,unknown>,defs))
 if(Array.isArray(rule.enum))return rule.enum.some(x=>same(x,value))
 if(rule.type==='null')return value===null
 if(rule.type==='string')return typeof value==='string'&&(rule.minLength===undefined||value.length>=(rule.minLength as number))&&(rule.pattern===undefined||new RegExp(rule.pattern as string).test(value))
 if(rule.type==='integer')return Number.isSafeInteger(value)&&Number(value)>=Number(rule.minimum??Number.MIN_SAFE_INTEGER)&&Number(value)<=Number(rule.maximum??Number.MAX_SAFE_INTEGER)
 if(rule.type==='boolean')return typeof value==='boolean'
 if(rule.type==='array')return Array.isArray(value)&&value.every(x=>shape(x,rule.items as Record<string,unknown>,defs))
 if(rule.type==='object'){
  if(!object(value))return false
  const props=rule.properties as Record<string,Record<string,unknown>>,required=rule.required as string[]
  if(required.some(k=>!(k in value)))return false
  if(rule.additionalProperties===false&&Object.keys(value).some(k=>!(k in props)))return false
  return Object.entries(value).every(([k,v])=>!props[k]||shape(v,props[k],defs))
 }
 return true
}
export function limitUs(mode:Mode,item:number):number {return (mode==='standard-v1'?(item<8?30:7):(item<8?60:14))*1_000_000}
const blank=(category:'context'|'photo',current:boolean):Category=>({total:category==='context'?8:6,eligibleTotal:category==='context'&&current?8:6,excludedTotal:category==='context'&&!current?2:0,matches:0,timelyMatches:0,lateCount:0,timelyLatencySumUs:0,timelyCount:0,lateLatencySumUs:0,lateCountForMean:0})
export function reportFor(a:Attempt):Report {
 invariant(a.facts.responses.length===14,'All fourteen responses are required')
 const spec=identityForAttempt(a),context=blank('context',spec===CURRENT),photo=blank('photo',spec===CURRENT),confusions=new Map<string,number>()
 for(let i=0;i<14;i++){
  const r=a.facts.responses[i],item=spec.items[i],cat=i<8?context:photo,kind=i<8?'context':'photo'
  invariant(r&&r.item===i&&LABELS.includes(r.choice as string),'Response sequence is invalid')
  const elapsed=r.elapsedUs as number,timely=elapsed<limitUs(a.modeId,i)
  invariant(r.timely===timely,'Response timing differs from the deadline')
  if(timely){cat.timelyCount++;cat.timelyLatencySumUs+=elapsed}else{cat.lateCount++;cat.lateCountForMean++;cat.lateLatencySumUs+=elapsed}
  if(item.matchEligible){if(r.choice===item.intended){cat.matches++;if(timely)cat.timelyMatches++}else{const key=[kind,item.intended,r.choice].join('|');confusions.set(key,(confusions.get(key)??0)+1)}}
 }
 const confusionPairs=[...confusions].map(([key,count])=>{const [category,intended,selected]=key.split('|');return {category:category as 'context'|'photo',intended,selected,count}}).sort((x,y)=>x.category===y.category?(LABELS.indexOf(x.intended)-LABELS.indexOf(y.intended)||LABELS.indexOf(x.selected)-LABELS.indexOf(y.selected)):x.category==='context'?-1:1)
 const opening=a.receipts[0]?.command
 return {excludedItems:spec===CURRENT?[]:[1,6],formHash:spec.formHash,modeId:a.modeId,scoringVersion:spec.scoringVersion,context,photo,confusionPairs,familiarity:String(opening?.payload.familiarity)}
}
export function project(receipts:Receipt[]):Attempt {
 invariant(receipts.length>0&&receipts[0].command.kind==='open','Missing opening')
 const open=receipts[0].command,p=open.payload
 invariant(open.eventVersion===EVENT,'Unsupported event version')
 const spec=identity(String(p.formId),String(p.formHash),String(p.assetBankHash),String(p.scoringVersion))
 invariant(p.modeId==='standard-v1'||p.modeId==='extended-v1','Unsupported mode')
 let status:Attempt['status']='active'
 const facts:Facts={intents:[],onsets:[],responses:[],expired:[]}
 const a:Attempt={id:open.attemptId,routeId:open.routeId,leaseId:open.leaseId,formId:spec.formId,formHash:spec.formHash,assetBankHash:spec.bankHash,modeId:p.modeId,scoringVersion:spec.scoringVersion,startedAtWall:String(p.startedAtWall),clockDocumentId:String(p.clockDocumentId),status:'active',facts,report:null,receipts}
 const requestIds=new Set<string>(), expiryItems=new Set<number>()
 const witnesses=new Map<number,Command>()
 const witness=(r:Receipt,item:number)=>{
  if(!r.dependency)return false
  const d=r.dependency.command,onset=facts.onsets[item]
  invariant(shape(d,schema.$defs.responseCommand)&&onset&&d.eventVersion===EVENT&&d.installationId===open.installationId&&d.generation===open.generation&&d.routeId===open.routeId&&d.leaseId===open.leaseId&&d.attemptId===open.attemptId&&d.payload.item===item&&d.payload.onsetRequestId===onset.requestId&&d.payload.timely===true&&(d.payload.elapsedUs as number)<limitUs(a.modeId,item),'Invalid timely suppression witness')
  const retained=receipts.find(x=>x.command.requestId===d.requestId)
  invariant(!retained||same(retained.command,d),'Witness conflicts with retained command')
  const ownResponse=receipts.find(x=>x.command.kind==='response'&&x.command.payload.item===item)
  invariant(!ownResponse||same(ownResponse.command,d),'Witness conflicts with retained response')
  invariant(!witnesses.has(item)||same(witnesses.get(item),d),'Conflicting witnesses')
  invariant(!facts.expired.includes(item),'Witness contradicts expiry')
  witnesses.set(item,d);return true
 }
 let previous=0
 for(let n=0;n<receipts.length;n++){
  const r=receipts[n],c=r.command,q=c.payload
  invariant(shape(r,schema.$defs.receipt),'Invalid receipt schema')
  invariant(r.sequence>previous&&r.outcome==='applied'&&!requestIds.has(c.requestId),'Receipt order/identity invalid');previous=r.sequence;requestIds.add(c.requestId)
  invariant(c.eventVersion===EVENT&&c.installationId===open.installationId&&c.generation===open.generation&&c.routeId===open.routeId&&c.leaseId===open.leaseId&&c.attemptId===open.attemptId,'Cross-attempt receipt')
  if(n===0){invariant(c.kind==='open'&&r.dependency===null,'Invalid opening receipt');continue}
  invariant(status==='active','Event follows a terminal receipt')
  if(c.kind==='intent'){
   const i=q.item as number,item=spec.items[i]
   invariant(i===facts.responses.length&&facts.intents.length===facts.responses.length&&!!item,'Intent order invalid')
   invariant(q.assetId===item.assetId&&q.assetSha256===item.assetSha256&&q.contextSha256===item.contextSha256&&r.dependency===null,'Intent asset mismatch')
   facts.intents.push({item:i,requestId:c.requestId,assetId:q.assetId,assetSha256:q.assetSha256,contextSha256:q.contextSha256})
  }else if(c.kind==='onset'){
   const i=q.item as number,intent=facts.intents[i]
   invariant(i===facts.responses.length&&facts.onsets.length===i&&intent&&q.intentRequestId===intent.requestId&&q.clockDocumentId===a.clockDocumentId&&r.dependency===null,'Onset does not follow intent')
   const priorResponse=facts.responses[i-1],priorOnset=facts.onsets[i-1]
   invariant(!priorResponse||(q.onsetUs as number)>=(priorOnset.onsetUs as number)+(priorResponse.elapsedUs as number),'Onset clock regressed')
   facts.onsets.push({item:i,requestId:c.requestId,intentRequestId:q.intentRequestId,clockDocumentId:q.clockDocumentId,onsetUs:q.onsetUs})
  }else if(c.kind==='expiry'){
   const i=q.item as number,onset=facts.onsets[i]
   invariant(i===facts.responses.length&&onset&&q.onsetRequestId===onset.requestId&&!expiryItems.has(i)&&!facts.expired.includes(i)&&q.deadlineUs===(onset.onsetUs as number)+limitUs(a.modeId,i)&&(q.observedUs as number)>=(q.deadlineUs as number),'Invalid expiry')
   expiryItems.add(i)
   if(!witness(r,i))facts.expired.push(i)
  }else if(c.kind==='response'){
   const i=q.item as number,onset=facts.onsets[i],timely=(q.elapsedUs as number)<limitUs(a.modeId,i)
   invariant(i===facts.responses.length&&onset&&q.onsetRequestId===onset.requestId&&q.timely===timely&&LABELS.includes(q.choice as string)&&r.dependency===null,'Invalid response')
   invariant(!timely||!facts.expired.includes(i),'Timely response contradicts expiry')
   invariant(!witnesses.has(i)||same(witnesses.get(i),c),'Response conflicts with timely witness')
   if(!timely&&!facts.expired.includes(i))facts.expired.push(i)
   facts.responses.push({item:i,requestId:c.requestId,onsetRequestId:q.onsetRequestId,choice:q.choice,elapsedUs:q.elapsedUs,timely,inputClass:q.inputClass})
   if(facts.responses.length===14)status='completed'
  }else if(c.kind==='exit'||c.kind==='reconcile'){
   if(c.kind==='reconcile'){
    invariant(r.dependency===null&&q.oldLeaseId===a.leaseId&&q.newLeaseId!==a.leaseId,'Invalid owner reconciliation')
   }else{
    invariant((q.observedUs===null)===(q.clockDocumentId===null),'Incomplete exit clock')
    invariant(q.clockDocumentId===null||q.clockDocumentId===a.clockDocumentId,'Foreign exit clock')
    const i=facts.responses.length,onset=facts.onsets[i],prior=facts.responses[i-1]
    invariant(q.observedUs===null||!prior||(q.observedUs as number)>=(facts.onsets[i-1].onsetUs as number)+(prior.elapsedUs as number),'Exit clock precedes retained response')
    if(onset&&q.observedUs!==null){
     invariant((q.observedUs as number)>=(onset.onsetUs as number),'Exit precedes onset')
     const witnessItem=r.dependency?Number(r.dependency.command.payload.item):i
     invariant(witnessItem<=i,'Terminal witness is ahead of the current item')
     const hasWitness=r.dependency?witness(r,witnessItem):false
     const suppressed=hasWitness&&witnessItem===i
     if((q.observedUs as number)>=(onset.onsetUs as number)+limitUs(a.modeId,i)&&!suppressed&&!facts.expired.includes(i))facts.expired.push(i)
    }else if(r.dependency){const witnessItem=Number(r.dependency.command.payload.item);invariant(witnessItem<i&&!!facts.responses[witnessItem],'No timed item for terminal witness');witness(r,witnessItem)}
   }
   status='incomplete'
  }else throw Error('Unexpected repeated opening')
 }
 a.status=status
 if(status==='completed')a.report=reportFor(a)
 return a
}
export function validateRoot(value:unknown):asserts value is Root {
 invariant(object(value),'Faces root is not an object')
 const version=value.schema
 const source=version==='faces-root-v2'?legacySchema:version==='faces-root-v3'?schema:null
 invariant(!!source&&shape(value,source as Record<string,unknown>,source.$defs as Record<string,unknown>),'Faces root has invalid closed schema')
 const root=value as Root
 invariant(root.nextSequence>=1,'Unsupported Faces root')
 const seen=new Set<number>(),req=new Set<string>(),ids=new Set<string>()
 for(const a of root.attempts){
  invariant(!ids.has(a.id)&&!root.attemptFences.includes(a.id),'Duplicate/retired attempt');ids.add(a.id)
  invariant(a.receipts[0]?.command.installationId===root.installationId&&a.receipts[0]?.command.generation===root.generation,'Attempt belongs to another root')
  const projected=project(a.receipts)
  invariant(same({...projected,receipts:[]},{...a,receipts:[]}), 'Faces materialized facts/report disagree with receipts')
  for(const r of a.receipts){invariant(r.sequence<root.nextSequence&&!seen.has(r.sequence)&&!req.has(r.command.requestId),'Duplicate receipt/sequence');seen.add(r.sequence);req.add(r.command.requestId)}
 }
 const exposureIdentities=root.schema==='faces-root-v2'?[LEGACY]:REGISTRY
 invariant(root.exposure.length<=(root.schema==='faces-root-v2'?1:2)&&new Set(root.exposure.map(e=>`${e.formId}|${e.assetBankHash}`)).size===root.exposure.length&&root.exposure.every(e=>exposureIdentities.some(spec=>spec.formId===e.formId&&spec.bankHash===e.assetBankHash)),'Invalid exposure identity')
 invariant(root.attempts.every(a=>root.exposure.some(e=>e.formId===a.formId&&e.assetBankHash===a.assetBankHash)),'Attempt lacks exposure marker')
 invariant(root.deletionReceipts.every(d=>d.installationId===root.installationId&&d.generation===root.generation&&root.attemptFences.includes(d.targetAttemptId)),'Foreign deletion receipt')
 const namespace=new Map<string,Command>()
 for(const a of root.attempts)for(const r of a.receipts)for(const c of [r.command,...(r.dependency?[r.dependency.command]:[])]){
  const prior=namespace.get(c.requestId)
  invariant(!prior||c.kind==='response'&&prior.kind==='response'&&same(prior,c),'Request identity conflicts with command or dependency')
  namespace.set(c.requestId,c)
 }
 const managementIds=[...root.deletionReceipts.map(d=>d.requestId),...(root.lastGuideReceipt?[root.lastGuideReceipt.requestId]:[]),...(root.lastReset?[root.lastReset.requestId]:[])]
 invariant(new Set(managementIds).size===managementIds.length&&managementIds.every(id=>!namespace.has(id)&&!root.requestFences.some(f=>f.requestId===id)),'Management request identity collision')
 invariant(root.requestFences.every(f=>!namespace.has(f.requestId)),'Request fence conflicts with command or dependency')
 invariant(new Set(root.requestFences.map(f=>f.requestId)).size===root.requestFences.length,'Duplicate request fence')
 invariant(new Set(root.attemptFences).size===root.attemptFences.length,'Duplicate attempt fence')
 invariant(new Set(root.deletionReceipts.map(d=>d.requestId)).size===root.deletionReceipts.length,'Duplicate deletion receipt')
 invariant(root.deletionReceipts.every(d=>!ids.has(d.targetAttemptId)),'Deleted attempt retained')
 invariant(same(root.guideCompletion,root.lastGuideReceipt?{guideVersion:root.lastGuideReceipt.guideVersion,checkVersion:root.lastGuideReceipt.checkVersion}:null),'Guide receipt differs from completion')
 if(root.lastReset)invariant(root.lastReset.newInstallationId===root.installationId&&root.lastReset.newGeneration===root.generation&&root.lastReset.oldGeneration+1===root.generation&&root.lastReset.oldInstallationId!==root.installationId,'Reset identity mismatch')
 if(root.route){
  const route=root.route
  if(route.state==='play'||route.state==='settling')invariant(!!route.lease&&!!route.attemptId&&!route.pendingOpeningId&&root.attempts.some(a=>a.id===route.attemptId&&a.routeId===route.id&&a.leaseId===route.lease&&a.status==='active'),'Active route disagrees with attempt')
  if(route.state==='opening')invariant(!!route.lease&&!route.attemptId&&!!route.pendingOpeningId,'Opening route lacks exact pending request')
  if(route.state==='ready')invariant(!!route.lease&&!route.attemptId&&!route.pendingOpeningId,'Ready route is not idle of play')
  if(route.state==='idle')invariant(!route.lease&&!route.attemptId&&!route.pendingOpeningId,'Idle route still owns play')
 }
 for(const a of root.attempts)if(a.status==='active')invariant(root.route?.attemptId===a.id,'Active attempt has no route')
}
export function seal(root:Root,routeId:string,leaseId:string,attemptId:string,kind:Kind,payload:Record<string,unknown>):Command{return {eventVersion:EVENT,requestId:newId(),installationId:root.installationId,generation:root.generation,routeId,leaseId,attemptId,kind,payload:structuredClone(payload)}}
/** A request has one identity across primary commands, dependencies and management. */
export function assertRequestIdentity(root:Root,c:Command){
 invariant(!root.requestFences.some(f=>f.requestId===c.requestId),'Retired request identity')
 invariant(!root.deletionReceipts.some(d=>d.requestId===c.requestId)&&root.lastGuideReceipt?.requestId!==c.requestId&&root.lastReset?.requestId!==c.requestId,'Management request identity reused')
 for(const a of root.attempts)for(const r of a.receipts)for(const prior of [r.command,...(r.dependency?[r.dependency.command]:[])])if(prior.requestId===c.requestId)invariant(same(prior,c),'Conflicting request identity')
}
export function migrated(root:Root):Root {const next=structuredClone(root);next.schema='faces-root-v3';return next}
export function append(root:Root,c:Command,dependency:Receipt['dependency']=null):Root {
 validateRoot(root);assertRequestIdentity(root,c);if(dependency)assertRequestIdentity(root,dependency.command)
 invariant(c.installationId===root.installationId&&c.generation===root.generation&&!root.requestFences.some(f=>f.requestId===c.requestId),'Retired/stale command')
 const existing=root.attempts.flatMap(a=>a.receipts).find(r=>r.command.requestId===c.requestId)
 if(existing){invariant(same(existing.command,c)&&same(existing.dependency,dependency),'Conflicting replay');return root}
 const next=migrated(root),r:Receipt={sequence:next.nextSequence++,outcome:'applied',command:structuredClone(c),dependency:structuredClone(dependency)}
 if(c.kind==='open'){
  invariant(!next.attempts.some(a=>a.id===c.attemptId)&&!next.attemptFences.includes(c.attemptId),'Attempt reused')
  const p=c.payload
  invariant(next.route?.id===c.routeId&&next.route.lease===c.leaseId&&next.route.state==='opening'&&next.route.pendingOpeningId===c.requestId&&next.route.attemptId===null&&p.readyEpoch===next.route.epoch,'Opening authority absent')
  const a=project([r]);next.attempts.push(a);next.route={...next.route,state:'play',attemptId:a.id,pendingOpeningId:null}
  if(!next.exposure.some(e=>e.formId===a.formId&&e.assetBankHash===a.assetBankHash))next.exposure.push({formId:a.formId,assetBankHash:a.assetBankHash,familiarity:'familiar'})
 }else{
  const index=next.attempts.findIndex(a=>a.id===c.attemptId)
  invariant(index>=0&&next.route?.id===c.routeId&&next.route.lease===c.leaseId&&next.route.attemptId===c.attemptId,'Attempt authority absent')
  const a=next.attempts[index];a.receipts.push(r);next.attempts[index]=project(a.receipts)
  if(next.attempts[index].status!=='active')next.route={...next.route,state:'idle',lease:null,attemptId:null,pendingOpeningId:null,navigation:null}
 }
 next.revision++
 validateRoot(next)
 return next
}
export function initialReady(root:Root,leaseId:string):Root {
 validateRoot(root);invariant(!root.route||root.route.state==='idle'||root.route.state==='ready','Active Faces route')
 const next=migrated(root),epoch=(next.route?.epoch??0)+1
 next.route={id:newId(),lease:leaseId,epoch,state:'ready',attemptId:null,pendingOpeningId:null,navigation:null};next.revision++;validateRoot(next);return next
}

export type Management={requestId:string;expectedInstallationId:string;expectedGeneration:number;kind:'delete'|'reset'|'guide';payload:Record<string,unknown>}
export function management(root:Root,kind:Management['kind'],payload:Management['payload']):Management {
 return {requestId:newId(),expectedInstallationId:root.installationId,expectedGeneration:root.generation,kind,payload:structuredClone(payload)}
}
export function completedGuideSource(root:Root,id:string,mode?:Mode):boolean {
 const source=root.attempts.find(a=>a.id===id)
 if(!source||source.status!=='completed'||!source.report||source.facts.responses.length!==14||mode&&source.modeId!==mode)return false
 try{return identityForAttempt(source)===CURRENT}catch{return false}
}
export function currentGuideCompletion(root:Root,mode?:Mode):boolean {
 const completion=root.guideCompletion
 if(!completion)return false
 if(completion.guideVersion===GUIDE&&completion.checkVersion===CHECK)return true
 return completion.checkVersion===SKIP_CHECK&&completion.guideVersion.startsWith(SKIP_GUIDE)&&
  completedGuideSource(root,completion.guideVersion.slice(SKIP_GUIDE.length),mode)
}
export function completedGuidePayload(id:string){return {guideVersion:`${SKIP_GUIDE}${id}`,checkVersion:SKIP_CHECK}}
export function manage(root:Root,c:Management):Root {
 validateRoot(root);invariant(shape(c,schema.$defs.managementCommand),'Invalid management command')
 const p=c.payload
 if(c.kind==='reset'&&root.lastReset?.requestId===c.requestId){
  invariant(same(root.lastReset,{requestId:c.requestId,oldInstallationId:c.expectedInstallationId,oldGeneration:c.expectedGeneration,newInstallationId:p.proposedNewInstallationId,newGeneration:p.proposedNewGeneration}),'Conflicting reset replay');return root
 }
 invariant(c.expectedInstallationId===root.installationId&&c.expectedGeneration===root.generation,'Stale management authority')
 const deletion=root.deletionReceipts.find(d=>d.requestId===c.requestId)
 if(deletion){invariant(c.kind==='delete'&&deletion.targetAttemptId===p.targetAttemptId,'Conflicting deletion replay');return root}
 if(root.lastGuideReceipt?.requestId===c.requestId){invariant(c.kind==='guide'&&same(p,{guideVersion:root.lastGuideReceipt.guideVersion,checkVersion:root.lastGuideReceipt.checkVersion}),'Conflicting guide replay');return root}
 invariant(!root.requestFences.some(f=>f.requestId===c.requestId)&&!root.attempts.some(a=>a.receipts.some(r=>r.command.requestId===c.requestId||r.dependency?.command.requestId===c.requestId))&&root.lastReset?.requestId!==c.requestId,'Management request reused')
 if(c.kind==='guide')invariant(p.guideVersion===GUIDE&&p.checkVersion===CHECK||
  p.checkVersion===SKIP_CHECK&&typeof p.guideVersion==='string'&&p.guideVersion.startsWith(SKIP_GUIDE)&&completedGuideSource(root,p.guideVersion.slice(SKIP_GUIDE.length)),'Fresh guide completion needs the current check or an exact retained completed source')
 let next=migrated(root)
 if(c.kind==='guide'){
  if(next.lastGuideReceipt)next.requestFences.push({requestId:next.lastGuideReceipt.requestId,kind:'guide'})
  next.guideCompletion={guideVersion:String(p.guideVersion),checkVersion:String(p.checkVersion)};next.lastGuideReceipt={requestId:c.requestId,...next.guideCompletion}
 }else if(c.kind==='delete'){
  const id=String(p.targetAttemptId),target=next.attempts.find(a=>a.id===id)
  if(target)for(const r of target.receipts){
   if(!next.requestFences.some(f=>f.requestId===r.command.requestId))next.requestFences.push({requestId:r.command.requestId,kind:r.command.kind})
   const d=r.dependency?.command;if(d&&!next.requestFences.some(f=>f.requestId===d.requestId))next.requestFences.push({requestId:d.requestId,kind:d.kind})
  }
  next.attempts=next.attempts.filter(a=>a.id!==id)
  if(!next.attemptFences.includes(id))next.attemptFences.push(id)
  if(next.route?.attemptId===id)next.route=null
  next.deletionReceipts.push({requestId:c.requestId,installationId:root.installationId,generation:root.generation,targetAttemptId:id})
 }else{
  invariant(p.proposedNewGeneration===root.generation+1&&p.proposedNewInstallationId!==root.installationId,'Invalid replacement identity')
  next=freshRoot();next.installationId=String(p.proposedNewInstallationId);next.generation=Number(p.proposedNewGeneration)
  next.lastReset={requestId:c.requestId,oldInstallationId:root.installationId,oldGeneration:root.generation,newInstallationId:next.installationId,newGeneration:next.generation}
 }
 next.revision=root.revision+1;validateRoot(next);return next
}
