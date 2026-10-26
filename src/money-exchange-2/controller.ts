import { Attempt as UsageAttempt } from '../assessment-usage/client'
import { currentAuthority, receiptIdentity, decisionResult, forms, assert, readback, validCompleted } from './core'
import type { Command, Root, Attempt } from './core'
import { Store, ownerLock } from './storage'
import type { MockJourneyContext } from '../mock/journey-context'
import { withSelectedMockReportPublication } from '../mock/report-route'
import type { ReportTarget } from '../mock/report-route'
import { sourceReference } from '../mock/reference'
export interface View {stage:string;epoch:number;root:Root|null;attempt:Attempt|null;busy:boolean;uncertain:boolean;error:string|null;pendingExit:string|null;authorityPending:boolean}
interface Pending {command:Command;epoch:number;writes:number;reads:number;follow?:Command}
export class Controller {
 private usage=new UsageAttempt('money_2');
 private checking=false;private authorityPending=false;private refreshFailures=0;private known:Root|null=null;private stage='loading';private epoch=0;private token=Object.freeze({});private serial=0;
 private owner=crypto.randomUUID();private documentId=crypto.randomUUID();private leaseEpoch=0;private generation=0;
 private ticketId:string|null=null;private attemptId:string|null=null;private busy:string|null=null;private pendingExit:Command|null=null;
 private requests=new Map<string,Pending>();private prepared:Command|null=null;private store:Store|null=null;private release:(()=>void)|null=null;
 private error:string|null=null;private uncertain=false;private opening=false;private inFlight=new Set<string>();private alive=true;
 private openStore:()=>Promise<Store>;private takeOwner:typeof ownerLock;
 constructor(dependencies:{openStore?:()=>Promise<Store>;takeOwner?:typeof ownerLock}={}){this.openStore=dependencies.openStore??(()=>this.mock||this.reportTarget?Store.openForMock(undefined,!this.reportTarget):Store.open());this.takeOwner=dependencies.takeOwner??ownerLock}
 private reviewSerial=0;private reviewPending=false;
 private listener:()=>void=()=>undefined;
 private stageWaiters=new Set<()=>void>()
 private skipSourceId:string|null=null
 private mock:MockJourneyContext|null=null;
 private reportTarget:ReportTarget|null=null
 setMock(mock:MockJourneyContext){if(this.opening||this.store)throw Error('Mock route must be selected before opening');this.mock=mock}
 setReportTarget(target:ReportTarget){if(this.opening||this.store)throw Error('Saved report route must be selected before opening');this.reportTarget=target}
 withdrawMockReport(){if(this.reportTarget){if(this.known)this.revoked(this.known);else{this.stage='unavailable';this.error='Saved mock report authority changed.';this.emit()}}}
 private reportMatches(root:Root){const target=this.reportTarget;if(!target)return true
  const outcome=root.outcomes[target.arm.requestId],attempt=outcome?.result.attemptId?root.attempts[outcome.result.attemptId]:null
  if(target.game!=='money_2'||root.installationId!==target.reference.installationId||root.generation!==target.reference.generation||
    !attempt||attempt.id!==target.attemptId||attempt.originTicketId!==target.arm.originTicketId||root.tombstones[attempt.id])return false
  try{const reference=sourceReference({game:'money_2',arm:target.arm,attemptId:attempt.id,
    settingsRevision:target.reference.settingsRevision,formId:attempt.formId,formHash:attempt.formDigest,
    recorded:{event:attempt.events[0]?.version}})
    return JSON.stringify(reference)===JSON.stringify(target.reference)}catch{return false}
 }
 private publishNative(fn:(root:Root)=>void){const publish=(permit=()=>{})=>this.store!.publish(root=>{permit();fn(root)})
  return this.reportTarget?withSelectedMockReportPublication(this.reportTarget,publish):publish()}
 get mockContext(){return this.mock}
 subscribe(fn:()=>void){this.listener=fn}
 inputToken(){return this.token}
 view():View{return {stage:this.stage,epoch:this.epoch,root:this.known,attempt:this.attemptId?this.known?.attempts[this.attemptId]??null:null,busy:!!this.busy,uncertain:this.uncertain,error:this.error,pendingExit:this.pendingExit?.destination??null,authorityPending:this.authorityPending}}
 private emit(){this.listener();for(const wake of this.stageWaiters)wake()}
 private waitForStage(stage:string):Promise<void>{
  if(this.stage===stage)return Promise.resolve()
  return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{this.stageWaiters.delete(check);reject(Error(`Money Exchange 2 ${stage} view was not confirmed`))},5000)
   const check=()=>{if(this.stage===stage){clearTimeout(timer);this.stageWaiters.delete(check);resolve()}else if(this.stage==='unavailable'){clearTimeout(timer);this.stageWaiters.delete(check);reject(Error('Money Exchange 2 saved authority is unavailable'))}}
   this.stageWaiters.add(check)
  })
 }
 async skipGuideWithCompleted(isCurrent:()=>boolean=()=>true):Promise<boolean>{
  if(this.stage!=='library'||this.busy||this.pendingExit||this.authorityPending||this.uncertain||!this.store)return false
  const openingToken=this.token,openingEpoch=this.epoch
  let sourceId:string|null=null
  await this.publishNative(root=>{sourceId=currentAuthority(root,this.owner,this.leaseEpoch,this.generation)?Object.values(root.attempts).find(attempt=>!root.tombstones[attempt.id]&&validCompleted(attempt))?.id??null:null})
  if(!sourceId||!isCurrent()||!this.alive||this.token!==openingToken||this.epoch!==openingEpoch||this.stage!=='library'||!this.admit(openingToken,'enter'))return false
  await this.waitForStage('instructions')
  if(!isCurrent()||!this.alive||this.view().stage!=='instructions'||this.busy||this.pendingExit)return false
  const instructionsToken=this.token,instructionsEpoch=this.epoch
  let qualifies=false
  await this.publishNative(root=>{qualifies=currentAuthority(root,this.owner,this.leaseEpoch,this.generation)&&!!sourceId&&!!root.attempts[sourceId]&&!root.tombstones[sourceId]&&validCompleted(root.attempts[sourceId])})
  if(!qualifies||!isCurrent()||!this.alive||this.token!==instructionsToken||this.epoch!==instructionsEpoch||this.view().stage!=='instructions')return false
  const started=this.admit(instructionsToken,'ready')
  if(started)this.skipSourceId=sourceId
  return started
 }
 async startWithGuideProof(token:object,input:string,isCurrent:()=>boolean=()=>true):Promise<'started'|'missing'|'stale'>{
  if(!isCurrent()||token!==this.token||this.stage!=='ready'||this.busy||this.pendingExit||this.uncertain)return 'stale'
  const sourceId=this.skipSourceId
  if(sourceId){const epoch=this.epoch;let qualifies=false
   try{await this.publishNative(root=>{qualifies=currentAuthority(root,this.owner,this.leaseEpoch,this.generation)&&!!root.attempts[sourceId]&&!root.tombstones[sourceId]&&validCompleted(root.attempts[sourceId])})}
   catch{if(isCurrent()&&this.alive&&token===this.token&&epoch===this.epoch&&this.stage==='ready'){this.error='The completed run used to skip the guide could not be checked. Retry Start or Close and check the rule.';this.emit()}return 'stale'}
   if(!isCurrent()||!this.alive||token!==this.token||epoch!==this.epoch||this.stage!=='ready'||this.busy||this.pendingExit)return 'stale'
   if(!qualifies){this.skipSourceId=null;this.admit(token,'Close',{reason:'completed guide source removed'});return 'missing'}
   this.skipSourceId=null
  }
  return this.admit(token,'arm',{input})?'started':'stale'
 }
 async openExactReport(attemptId:string){
  if(this.stage!=='library'||!this.known?.attempts[attemptId])throw Error('Exact Money Exchange 2 report unavailable')
  if(!this.admit(this.token,'history'))throw Error('Money Exchange 2 history could not open')
  await this.waitForStage('history')
  if(!this.admit(this.token,'historyReport',{attemptId}))throw Error('Exact Money Exchange 2 report could not open')
  await this.waitForStage('review')
 }
 private rotate(){this.epoch++;this.token=Object.freeze({});this.prepared=null}
 private base(kind:string):Command{return {kind,requestId:this.mock?`${this.owner}.${this.documentId}.${++this.serial}`:`${this.owner}/${this.documentId}/${++this.serial}`,installationId:this.known!.installationId,generation:this.generation,ownerId:this.owner,leaseEpoch:this.leaseEpoch,at:performance.now(),routeEpoch:this.known!.route.epoch,ticketId:this.ticketId??undefined}}
 async open(){if(this.opening||!this.alive)return;this.opening=true;this.error=null;
  try{this.release??=await this.takeOwner(()=>this.lifecycle('owner-lost'));this.store??=await this.openStore();let root!:Root;await this.publishNative(value=>{root=value});
   if(root.lease.live){const loss:Command={kind:'loseLease',requestId:`recovery/${this.documentId}`,installationId:root.installationId,generation:root.generation,ownerId:root.lease.ownerId!,leaseEpoch:root.lease.epoch,at:performance.now()};await this.store.execute(loss);await this.publishNative(v=>{root=v})}
   this.known=root;this.generation=root.generation;
   const claim=this.base('claimLease');await this.store.execute(claim);await this.publishNative(value=>{assert(value.lease.ownerId===this.owner,'Owner changed');this.known=value;this.leaseEpoch=value.lease.epoch;this.stage='library';this.rotate()});
  }catch(e){this.stage='unavailable';this.error=String(e)}finally{this.opening=false;this.emit()}
 }
 admit(token:object,action:string,data:{cents?:number;rating?:number;attemptId?:string;destination?:string;input?:string;reason?:string}={}):boolean{
  if(token!==this.token||!this.known||!this.store||!this.alive)return false;
  if(['enter','ready','Close','Restart'].includes(action))this.skipSourceId=null
  const exit=action==='Close'||action==='Restart';let command:Command;
  if(exit){
   if(['library','history','review','loading','unavailable'].includes(this.stage)||this.pendingExit&&!(this.pendingExit.destination==='Restart'&&action==='Close'))return false;
   if(action==='Restart'&&['instructions','test_complete','report','tips'].includes(this.stage))return false;
   command={...this.base('exit'),destination:action,...(data.reason?{reason:data.reason}:{})};
   if(this.pendingExit)command.afterRestartRequestId=this.pendingExit.requestId;
   else if(this.busy&&['ready','tryAgain','reviewReplay'].includes(this.requests.get(this.busy)?.command.kind??'')){command.afterReadyRequestId=this.busy;command.routeEpoch=this.requests.get(this.busy)!.command.routeEpoch;}
   this.rotate();this.stage='checking';this.pendingExit=command;
  }else{
   if(this.busy||this.pendingExit)return false;
   const allowed:Record<string,string[]>={enter:['library'],ready:['instructions'],arm:['ready'],terminal:['fairness_2'],report:['test_complete'],tryAgain:['report'],history:['library'],historyReport:['history'],historyBack:['history','review'],reviewReplay:['review'],deleteAttempt:['history'],deleteAll:['history'],step:['award_1','connecting_1','connected_1','partner_rules_1','bonus_1','choice_1','partner_choice_1','result_1','fairness_1','new_partner','award_2','connecting_2','connected_2','partner_rules_2','bonus_2','choice_2','partner_choice_2','result_2']};
   if(!allowed[action]?.includes(this.stage)||this.stage.startsWith('connecting_'))return false;
   const attempt=this.view().attempt;
   if(this.stage.startsWith('result_')&&attempt?.rounds[this.stage.endsWith('_2')?1:0].exposure!=='render_receipt')return false;
   command={...this.base(action),...data,stage:this.stage,expectedRevision:attempt?.revision};
   if(action==='arm')command.context={input:data.input??'unknown',reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,highContrast:matchMedia('(forced-colors: active)').matches,device:matchMedia('(pointer: coarse)').matches?'touch-capable':'desktop-class',spec:'money_exchange_2_spec_v1_0',scoring:'money_exchange_2_scoring_v1_0',...(this.mock?{route:'mock_game_11',mockRunId:this.mock.launchId}:{})};
  }
  if(action==='arm')this.usage.begin(this.mock?'mock':'practice');
  if(exit)this.usage.cancel();
  if(action==='deleteAttempt'||action==='deleteAll'){this.rotate();this.authorityPending=true;this.attemptId=null;}
  this.busy=command.requestId;this.error=null;this.uncertain=false;
  const entry:Pending={command:Object.freeze(structuredClone(command)),epoch:this.epoch,writes:0,reads:0};
  if(command.kind==='step'&&this.view().attempt){const attempt=this.view().attempt!;const index=this.stage.endsWith('_2')?1:0;
   if(this.stage.startsWith('award_'))entry.follow={...this.base('step'),stage:`connecting_${index+1}`,expectedRevision:attempt.revision+1,operation:'animation'};
   if(this.stage.startsWith('choice_')||this.stage.startsWith('partner_choice_')){const proposed=structuredClone(attempt);proposed.rounds[index].decision=decisionResult(forms.find(f=>f.id===attempt.formId)!,index,command.cents!);
    entry.follow={...this.base('step'),stage:`result_${index+1}`,expectedRevision:attempt.revision+1,operation:'receipt',receipt:receiptIdentity(proposed,index)};}
  }
  this.requests.set(command.requestId,entry);this.emit();void this.execute(entry);return true;
 }
 private currentOutcome(entry:Pending,root:Root){const result=readback(root,entry.command),outcome=result.status==='confirmed'?result.outcome:null;return !!outcome&&outcome.route.epoch===root.route.epoch&&outcome.route.stage===root.route.stage&&outcome.route.ownerId===this.owner}
 private deliver(entry:Pending,root:Root){
  if(!this.alive||entry.epoch!==this.epoch||this.busy!==entry.command.requestId||!currentAuthority(root,this.owner,this.leaseEpoch,this.generation)||!this.currentOutcome(entry,root))return false;
  if(!this.reportMatches(root)){this.revoked(root);return false}
  const result=root.outcomes[entry.command.requestId].result;
  this.requests.delete(entry.command.requestId);if(entry.command.kind==='deleteAttempt')for(const [id,p] of this.requests)if(readback(root,p.command).status==='retired/deleted')this.requests.delete(id);this.known=root;this.ticketId=root.currentTicketId;this.attemptId=result.attemptId??(this.ticketId?root.tickets[this.ticketId]?.attemptId:null);
  if(entry.command.kind==='exit'){this.stage=result.destination==='Restart'?'ready':'library';this.pendingExit=null;this.attemptId=null;}
  else if(['deleteAttempt','deleteAll'].includes(entry.command.kind))this.stage='history';
  else this.stage=result.stage??root.route.stage;
  if(this.stage==='report_1')this.stage='report';
  const retryMock=!!this.mock&&(entry.command.kind==='tryAgain'||entry.command.kind==='exit'&&result.destination==='Restart')
  const nextStage=this.stage
  const usageAttempt=this.attemptId?root.attempts[this.attemptId]:null
  if(entry.command.kind==='arm'&&usageAttempt)this.usage.admit(usageAttempt.id)
  if(entry.command.kind==='terminal'&&usageAttempt&&validCompleted(usageAttempt))this.usage.finish(usageAttempt.id,'completed',()=>({exchanges:2}))
  if(retryMock)this.stage='checking'
  this.busy=null;this.error=null;this.uncertain=false;this.authorityPending=false;this.refreshFailures=0;this.rotate();this.prepared=entry.follow??null;this.emit();
  if(retryMock){const epoch=this.epoch;void this.mock!.retry().then(()=>{if(this.alive&&this.epoch===epoch){this.stage=nextStage;this.emit()}})
    .catch(cause=>{if(this.alive&&this.epoch===epoch){this.stage='unavailable';this.error=String(cause);this.emit()}})}
  return true;
 }
 async reviewPublication(token:object,publish:()=>void){
  if(token!==this.token||this.busy||!this.store||!['report','review'].includes(this.stage))return;
  const epoch=this.epoch,id=this.attemptId,serial=++this.reviewSerial;this.reviewPending=true;this.authorityPending=true;this.emit();
  try{await this.publishNative(root=>{if(serial!==this.reviewSerial||epoch!==this.epoch)return;if(!id||!root.attempts[id]||!currentAuthority(root,this.owner,this.leaseEpoch,this.generation)||!this.reportMatches(root)){this.revoked(root);return;}this.known=root;this.reviewPending=false;this.authorityPending=false;publish()})}catch{if(serial===this.reviewSerial&&epoch===this.epoch){this.reviewPending=false;this.error='Local report authority is unavailable. Retry to check again.';this.emit()}}
 }
 private async execute(entry:Pending){if(this.inFlight.has(entry.command.requestId)||!this.store)return;
  this.inFlight.add(entry.command.requestId);
  try{if(entry.command.kind==='arm'&&this.mock){const root=this.known!,ticketId=entry.command.ticketId;
    if(!ticketId)throw Error('Money Exchange 2 opening ticket missing');
    await this.mock.beforeArm({requestId:entry.command.requestId,attemptId:null,
      originTicketId:ticketId,installationId:root.installationId,generation:root.generation,requestKind:'arm',
      nativeIdentity:[{key:'ownerId',value:entry.command.ownerId!}]})}
   if(entry.epoch!==this.epoch||this.busy!==entry.command.requestId||!this.store)throw Error('Opening retired')
   if(entry.writes<2){entry.writes++;try{await this.store.execute(entry.command)}catch{/* outcome must be read */}}
   await this.reconcile(entry);
  }catch(e){if(this.busy===entry.command.requestId){this.uncertain=true;this.error=String(e);this.emit()}}
   finally{this.inFlight.delete(entry.command.requestId)}
 }
 private async reconcile(entry:Pending){if(!this.store)return;entry.reads++;
  try{let delivered=false,absent=false,changed=false;
   await this.publishNative(root=>{if(entry.epoch!==this.epoch||this.busy!==entry.command.requestId)return;
    const status=readback(root,entry.command);
    if(status.status==='retired/deleted'||status.status==='fenced/unavailable'||status.status==='rejection'){this.revoked(root);changed=true;return}
    if(entry.command.kind==='deleteAll'&&status.status==='confirmed'){this.revoked(root);this.error='All Money Exchange 2 data was deleted. Reload to continue.';this.emit();changed=true;return}
    if(!currentAuthority(root,this.owner,this.leaseEpoch,this.generation)){this.revoked(root);changed=true;return}
    delivered=this.deliver(entry,root);absent=status.status==='absent';
    if(!delivered&&!absent){this.revoked(root);changed=true;}
   });
   if(delivered||changed||entry.epoch!==this.epoch||this.busy!==entry.command.requestId)return;
   if(absent&&entry.writes<2){entry.writes++;try{await this.store.execute(entry.command)}catch{/* bounded same request */}if(entry.reads<2){await this.reconcile(entry);return}}
   this.uncertain=true;this.error='Save status needs checking. Retry checks the same request.';this.emit();
  }catch(e){if(entry.epoch===this.epoch&&this.busy===entry.command.requestId){if(entry.reads<2){await this.reconcile(entry);return}this.uncertain=true;this.error=String(e);this.emit()}}
 }
 retry(token:object){if(token!==this.token)return;if(this.stage==='unavailable'){void this.open();return}const entry=this.busy?this.requests.get(this.busy):null;if(entry){entry.reads=0;this.uncertain=false;this.error=null;this.emit();void this.execute(entry)}else{this.refreshFailures=0;void this.refresh()}}
 /** Callback receives only this already admitted follow-up, never input admission. */
 completePrepared(epoch:number,operation:'animation'|'receipt'){
  if(epoch!==this.epoch||this.busy||this.pendingExit||this.prepared?.operation!==operation)return;
  const command={...this.prepared,at:performance.now()};this.prepared=null;const entry={command:Object.freeze(command),epoch:this.epoch,writes:0,reads:0};this.requests.set(command.requestId,entry);this.busy=command.requestId;void this.execute(entry);
 }
 lifecycle(reason:string){this.usage.cancel();if(reason==='pagehide'&&this.reportTarget){this.alive=false;this.reviewSerial++;this.requests.clear();this.rotate();this.busy=null;this.stage='unavailable';this.error='Saved mock report document was retired.';this.release?.();this.release=null;this.emit();return}
  if(!this.known||!this.store)return;
  if(this.stage==='library'||this.stage==='history'||this.stage==='review'||this.stage==='unavailable')return;
  this.admit(this.token,'Close',{reason});
 }
 private revoked(root:Root){this.usage.cancel();this.requests.clear();this.reviewSerial++;this.reviewPending=false;this.authorityPending=false;this.known=root;this.rotate();this.busy=null;this.pendingExit=null;this.ticketId=null;this.attemptId=null;this.stage='unavailable';this.error='Local ownership or saved data changed. Reload to continue.';this.uncertain=false;this.emit()}
 async refresh(){if(!this.store||this.opening||this.stage==='unavailable'||this.checking||this.refreshFailures>=2)return;
  const epoch=this.epoch;this.checking=true;let settled=false;
  if(['report','review','history'].includes(this.stage))requestAnimationFrame(()=>requestAnimationFrame(()=>{if(!settled&&epoch===this.epoch){this.authorityPending=true;this.emit()}}));
  try{await this.publishNative(root=>{if(epoch!==this.epoch)return;
   if(!currentAuthority(root,this.owner,this.leaseEpoch,this.generation)){this.revoked(root);return}
   const pending=this.busy?this.requests.get(this.busy):null;
   const ownPending=pending&&(this.currentOutcome(pending,root)||[pending.command.afterReadyRequestId,pending.command.afterRestartRequestId].some(id=>id&&this.requests.get(id)&&this.currentOutcome(this.requests.get(id)!,root)));
   if((this.attemptId&&!root.attempts[this.attemptId]&&!ownPending)||!this.reportMatches(root)){this.revoked(root);return}
   if(root.currentTicketId!==this.ticketId&&!ownPending){this.revoked(root);return}
   const viewChanged=['history','report','review','library'].includes(this.stage)&&this.known?.revision!==root.revision;
   this.known=root;this.refreshFailures=0;if(this.authorityPending&&!this.reviewPending){this.authorityPending=false;this.error=null;this.emit()}else if(viewChanged)this.emit()
  })}catch{if(epoch===this.epoch){this.refreshFailures++;this.uncertain=true;this.error='Local authority is unavailable. Retry before continuing.';this.emit();if(!['report','review','history'].includes(this.stage))this.lifecycle('authority-unavailable')}}finally{settled=true;this.checking=false}
 }
}
