import { feedbackLines, facesFeedback } from '../reports/feedback'
import { Attempt as UsageAttempt } from '../assessment-usage/client'
import {BANK_HASH,CHECK,CURRENT,EVENT,FEEDBACK,FORM_HASH,FORM_ID,GUIDE,HELP,ITEMS,LABELS,LEGACY,REPORT_PRESENTATION,SCORING,completedGuidePayload,completedGuideSource,currentGuideCompletion,identityForAttempt,invariant,limitUs,management,newId,seal} from './model'
import type {Attempt,Command,Mode,Receipt,Root} from './model'
import {OwnedStage} from './owned'
import {Ownership,wipe} from './ownership'
import {loadPortrait} from './assets'
import type {Loaded} from './assets'
import {Store,takeOwner} from './storage'
import type {OwnerRelease} from './storage'
import type {MockJourneyContext} from '../mock/journey-context'
import {mockReturnUrl} from '../mock/dedicated'
import {withSelectedMockReportPublication} from '../mock/report-route'
import type {ReportTarget} from '../mock/report-route'
import {sourceReference} from '../mock/reference'
const assetUrls=import.meta.glob('./assets/*.png',{eager:true,query:'?url',import:'default'}) as Record<string,string>
const lib=()=>new URL('./index.html',document.baseURI).href
const nowUs=()=>Math.max(0,Math.round(performance.now()*1000))
const seconds=(us:number)=>`${(us/1_000_000).toFixed(2)} s`
const mean=(sum:number,count:number)=>count?seconds(sum/count):null
const text=(tag:string,value:string,cls='')=>{const e=document.createElement(tag);e.textContent=value;if(cls)e.className=cls;return e}
const GUIDE_DISCLOSURE='All 14 answers count. Choose the practice answer that best fits the whole item. When a story is shown, use it together with the picture. Some pictures can be read in more than one way; the review explains the intended answer.'


type Active={attemptId:string;routeId:string;leaseId:string;installationId:string;generation:number;mode:Mode;item:number;onsetUs:number|null;onsetRequestId:string|null;intentRequestId:string|null;deadlineUs:number|null;image:HTMLImageElement|null;context:HTMLElement|null;expired:boolean;onsetCommitted:boolean;expiryRequested:boolean;admitted:boolean;fenced:boolean;pendingResponse:Command|null;claim:number;revealAt:number;loaded:Loaded|null;viewData:object|null;input:{held:boolean;repeated:boolean;lastAt:number}}
type UIAction={kind:'report'|'review'|'help'|'history'|'instructions'|'leave'|'delete'|'reset'|'answer'|'disclosure';id?:string;index?:number|null;choice?:string}
type ExitJob={observedUs:number;reason:'restart'|'close'|'hidden'|'owner-lost'|'display-invalid'|'asset-failed';attempt:Active|null;claim:number;destination:'instructions'|'library';navigate:boolean;retired:boolean;release:OwnerRelease|null;store:Store}
export class FacesApp {
 private usage=new UsageAttempt('faces')
 private mock:MockJourneyContext|null=null
 private mockId:string|null=null
 private mockReturnPending=false
 private reportTarget:ReportTarget|null=null
 setMock(mock:MockJourneyContext,mockId:string){if(this.store)throw Error('Mock route must be set before Faces opens');this.mock=mock;this.mockId=mockId;this.selectedMode=mock.preferences.facesMode;this.stage.mockReturn=()=>this.returnToMock()}
 setReportTarget(target:ReportTarget,mockId:string){if(this.store)throw Error('Saved report route must be set before Faces opens');this.reportTarget=target;this.mockId=mockId;this.stage.mockReturn=()=>this.leave()}
 withdrawMockReport(){if(this.reportTarget)this.error(Error('Saved mock report authority changed'),true)}
 private assertMockReport(root:Root){const target=this.reportTarget;if(!target)return
  const a=root.attempts.find(item=>item.id===target.attemptId)
  invariant(target.game==='faces'&&root.installationId===target.reference.installationId&&root.generation===target.reference.generation&&
    !!a&&(target.classification==='normal_complete'?a.status==='completed'&&!!a.report:a.status!=='completed')&&a.receipts[0]?.command.requestId===target.arm.requestId,'Faces saved report identity changed')
  const reference=sourceReference({game:'faces',arm:target.arm,attemptId:a.id,settingsRevision:target.reference.settingsRevision,
    formId:a.formId,formHash:a.formHash,recorded:{scoring:a.scoringVersion,event:a.receipts[0].command.eventVersion,
      assetBankHash:a.assetBankHash},allowLegacyFaces:true})
  invariant(JSON.stringify(reference)===JSON.stringify(target.reference),'Faces saved report reference changed')
 }
 readonly ownership=new Ownership()
 readonly stage=new OwnedStage(this.ownership)
 private origins=new WeakMap<Active,string>()
 private own<T>(id:string,value:T){return this.ownership.own(id,value)}
 private ownItem<T>(a:Active,value:T){return this.own(this.origins.get(a)!,value)}
 private live(a:Active){return a===this.active&&!a.fenced&&!this.ownership.retired.has(this.origins.get(a)!)}
 private discard(a:Active){if(a.loaded)this.ownership.releaseAsset(this.origins.get(a)!,a.loaded);wipe(a);a.fenced=true}
 private store:Store|null=null
 private releaseOwner:OwnerRelease|null=null
 private ownerDrain:Promise<unknown>=Promise.resolve()
 private releaseAfter(settlement:Promise<unknown>,release:OwnerRelease|null){if(release)this.ownerDrain=Promise.allSettled([this.ownerDrain,settlement]).then(()=>release())}
 private active:Active|null=null
 private clockDocumentId=newId()
 private selectedMode:Mode='standard-v1'
 private screen='loading'
 private viewEpoch=0
 private viewClaim=0
 private identity:null|{installationId:string;generation:number}=null
 private personalOrigin:string|null=null
 private personal:null|{id:string;installationId:string;generation:number}=null
 private reportRevision=-1
 private presentationTimer=0
 private countdownTimer=0
 private exitJob:ExitJob|null=null
 private openingToken:object|null=null
 // This method's closure contains only a value-free descriptor and the app.
 // It must not be defined inside any painter or ordered Root callback.
 private actionHandler(action:UIAction){if(action.id)this.own(action.id,action);return this.stage.action(this.actionCallback(action),action)}
 private actionCallback(action:UIAction){return (event:MouseEvent)=>this.dispatch(action,event)}
 private action(label:string,action:UIAction,secondary=false,disabled=false){return {label,run:this.actionHandler(action),secondary,disabled}}
 private contentAction(label:string,action:UIAction,secondary=false){return this.control(label,this.actionHandler(action),secondary)}
 private control(label:string,run:(event:MouseEvent)=>void,secondary=false){const b=document.createElement('button');b.type='button';b.textContent=label;if(secondary)b.className='secondary';this.stage.on(b,'click',run);return b}
 private dispatch(action:UIAction,event:MouseEvent){
  if(action.kind==='disclosure')event.preventDefault()
  if(!this.stage.intact()){if(this.active)void this.exit('display-invalid','instructions',false);else this.error(Error('Owned Faces display changed'));return}
  switch(action.kind){
   case 'disclosure':void this.disclose(action.id!,action.index!);break
   case 'report':void this.report(action.id!);break
   case 'review':void this.review(action.id!,action.index!);break
   case 'help':void this.help(action.id!,action.index??null);break
   case 'history':void this.history();break
   case 'instructions':if(this.mock){void this.mock.retry().then(()=>this.instructions()).catch(e=>this.error(e,true))}else this.instructions();break
   case 'leave':this.leave();break
   case 'delete':void this.deleteAttempt(action.id!);break
   case 'reset':void this.clearAll();break
   case 'answer':{const a=this.active;if(a&&a.attemptId===action.id&&a.item===action.index)void this.answer(a,action.choice!,event);break}
  }
 }
 private beginView(screen:string){if(screen!=='mock_return_check'&&screen!=='leaving')this.mock?.retireReturnIntent();if(this.exitJob&&screen!=='settling'){const job=this.exitJob;job.retired=true;this.exitJob=null;this.finishExitOwner(job)}this.viewClaim++;this.screen=screen;this.personal=null;this.personalOrigin=null;this.stage.owner=this.active?.attemptId??null;return this.viewClaim}
 private current(claim:number){return claim===this.viewClaim}
 private navigateAway(){this.beginView('leaving');this.mock?.leave();location.assign(this.mockId?mockReturnUrl(this.mockId):lib())}
 private leave(){this.usage.cancel();this.returnToMock()}
 private returnToMock(){
  if(this.mockReturnPending)return
  if(this.active||this.screen==='opening'||this.screen==='opening-cancel'){void this.exit('close','library',true);return}
  if(this.mock){
   const mock=this.mock,signal=mock.beginReturnIntent(),launch=mock.launchId,claim=this.beginView('mock_return_check')
   this.mockReturnPending=true
   try{this.stage.render({title:'Checking this attempt',paragraphs:['Confirming the saved result before returning to the mock.']})}
   catch{mock.finishReturnIntent(signal);this.mockReturnPending=false;this.navigateAway();return}
   void mock.terminal().then(status=>{
    if(signal.aborted||!this.current(claim)||mock.launchId!==launch)return
    if(status==='ready')return mock.continue(signal)
    this.navigateAway()
   }).catch(()=>{
    if(signal.aborted||!this.current(claim)||mock.launchId!==launch)return
    try{this.stage.render({title:'Return could not be confirmed',paragraphs:['The saved status is still unconfirmed. Retry the same check, or leave this result for review in the mock.'],actions:[{label:'Retry Return to mock',run:()=>this.returnToMock()},{label:'Leave with result unconfirmed',secondary:true,run:()=>this.navigateAway()}]})}
    catch{this.navigateAway()}
   }).finally(()=>{mock.finishReturnIntent(signal);this.mockReturnPending=false})
  }
  else this.navigateAway()
 }
 private bindPersonal(root:Root,id:string){this.personalOrigin=id;this.personal=this.own(id,{id,installationId:root.installationId,generation:root.generation});this.stage.owner=id}
 private erase(id?:string){
  const a=this.active,job=this.exitJob
  const matches=!!a&&(!id||this.origins.get(a)===id)
  if(!id){this.openingToken=null;this.openingCancel=null}
  if(job&&(!id||job.attempt&&this.origins.get(job.attempt)===id)){job.retired=true;this.exitJob=null;const release=job.release;job.release=null;this.releaseAfter(job.store.retire(id),release)}
  if(matches){this.active=null;this.cancelTimers()}
  for(const [key,c] of this.pending)if(!id||c.attemptId===id)this.pending.delete(key)
  const release=matches||!id?this.releaseOwner:null;if(release)this.releaseOwner=null
  if(this.store)this.releaseAfter(this.store.retire(id),release);else{if(id)this.ownership.retire(id);else this.ownership.reset();release?.()}
  if(matches&&a)a.fenced=true
 }
 private retireView(id?:string){this.erase(id);this.beginView('retired');try{this.stage.render({title:'This attempt is no longer available',paragraphs:['Its local authority changed. Open history to see current saved records.'],actions:[{label:'History',run:()=>void this.history()},{label:'Instructions',run:()=>this.instructions()}]})}catch{this.stage.quarantine()}}
 private async publishView(claim:number,paint:(root:Root)=>void){
  const publish=(permit=()=>{})=>this.requireStore().publish(root=>{permit();if(!this.current(claim))return;invariant(!this.identity||root.installationId===this.identity.installationId&&root.generation===this.identity.generation,'Local data generation changed');this.assertMockReport(root);paint(root)},this.active?this.origins.get(this.active)??null:this.personalOrigin,this.active?.leaseId??null)
  if(this.reportTarget)await withSelectedMockReportPublication(this.reportTarget,publish)
  else await publish()
 }

 private interval=0
 private deadlineTimer=0
 private refreshBusy=false
 private inputFallback={held:false,repeated:false,lastAt:-1000}
 private get input(){return this.active?.input??this.inputFallback}
 private releasedKey(cell:{held:boolean;repeated:boolean;lastAt:number}){return ()=>{if(this.input===cell)cell.repeated=false}}
 private pending=new Map<string,Command>()
 private retired=false
 private guidePassed=false
 private completedSourceId:string|null=null
 private ownerUnavailable=false
 private openingCancel:null|{destination:'instructions'|'library';navigate:boolean}=null
 private currentOpeningCancel(){return this.openingCancel}
 constructor(){
  this.stage.onNavigate=()=>{this.mock?.retireReturnIntent();this.viewClaim++}
  document.addEventListener('keydown',e=>{if(e.key===' '||e.key==='Enter'){if(e.repeat)this.input.repeated=true;else{this.input.held=true;this.input.repeated=false}if(this.active)this.input.lastAt=performance.now()}},true)
  document.addEventListener('keyup',e=>{if(e.key===' '||e.key==='Enter'){this.input.held=false;if(this.active)this.input.lastAt=performance.now();setTimeout(this.releasedKey(this.input),0)}},true)
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState!=='visible'){this.mock?.retireReturnIntent();this.interrupt('hidden')}else void this.refresh()})
  window.addEventListener('pagehide',()=>{this.mock?.retireReturnIntent();if(this.reportTarget)this.withdrawMockReport();else this.interrupt('hidden')})
  window.addEventListener('focus',()=>void this.refresh())
 }
 async init(){
  const claim=this.beginView('loading')
  this.stage.render({title:'Opening Faces',paragraphs:['Checking local practice history…']})
  try{
   const store=await (this.mock||this.reportTarget?Store.openForMock(this.ownership,undefined,!this.reportTarget):Store.open(this.ownership));if(!this.current(claim)){store.close();return}this.store=store
   await this.reconcilePrior();if(!this.current(claim))return
   const root=await store.read();if(!this.current(claim))return;this.identity={installationId:root.installationId,generation:root.generation};this.guidePassed=currentGuideCompletion(root,this.selectedMode);this.completedSourceId=root.attempts.find(a=>completedGuideSource(root,a.id,this.selectedMode))?.id??null
   if(this.reportTarget){this.beginView('loading');this.stage.render({title:'Saved Faces report',paragraphs:['Checking the exact retained result…']});void (this.reportTarget.classification==='normal_complete'?this.report(this.reportTarget.attemptId):this.review(this.reportTarget.attemptId,0))}
   else this.instructions()
   this.interval=window.setInterval(()=>{if(!this.mock||!this.active)void this.refresh()},1000)
  }catch(e){if(this.current(claim))this.error(e,true)}
 }
 private error(_error:unknown,storage=false){
  this.cancelTimers();clearInterval(this.interval);this.erase();this.release()
  this.beginView('error')
  try{this.stage.render({title:storage?'Local data needs attention':'Faces is paused',paragraphs:['The local operation could not be confirmed.','No timed item will resume after reloading.'],actions:[{label:'Retry reading local data',run:()=>void this.retryInit()},{label:'Back to library',secondary:true,run:()=>this.leave()}]})}catch{this.stage.quarantine()}
 }
 private async retryInit(){this.store?.close();this.store=null;await this.init()}
 private release(){const release=this.releaseOwner;this.releaseOwner=null;if(!release)return;if(this.store)this.releaseAfter(this.store.drain(this.active?.leaseId),release);else release()}
 private cancelTimers(){clearTimeout(this.deadlineTimer);clearTimeout(this.presentationTimer);clearInterval(this.countdownTimer)}
 private async reconcilePrior(){
  const store=this.requireStore(),root=await store.read()
  if(root.route?.state==='opening'&&root.route.lease&&root.route.pendingOpeningId&&!root.route.attemptId){
   let release:OwnerRelease
   try{release=await takeOwner()}catch{this.ownerUnavailable=true;return}
   this.ownerUnavailable=false
   try{await store.abandonOpening(root.route.id,root.route.lease,root.route.pendingOpeningId)}finally{await release()}
   return
  }
  if(root.route?.attemptId){const a=root.attempts.find(x=>x.id===root.route?.attemptId)
   if(a?.status==='active'){
    let release:OwnerRelease
    try{release=await takeOwner()}catch{this.ownerUnavailable=true;return}
    this.ownerUnavailable=false
    try{const c:Command={eventVersion:EVENT,requestId:newId(),installationId:root.installationId,generation:root.generation,routeId:a.routeId,leaseId:a.leaseId,attemptId:a.id,kind:'reconcile',payload:{oldLeaseId:a.leaseId,newLeaseId:newId(),reason:'reload',destination:'instructions'}}
     await this.commit(c)
    }finally{await release()}
   }
  }
  this.ownerUnavailable=false
 }
 private requireStore(){invariant(this.store,'Faces storage unavailable');return this.store}
 private commandPublication(c:Command,a:Active|null){return ()=>!!a&&this.live(a)&&a.attemptId===c.attemptId&&!(c.kind==='expiry'&&a.admitted)&&(typeof c.payload?.item!=='number'||a.item===c.payload.item)}
 private commit(c:Command,dependency:Receipt['dependency']=null,canPublish=this.commandPublication(c,this.active)):Promise<Root>{
  const origin={owner:c.attemptId,claim:c.leaseId,done:false,store:this.requireStore(),publish:canPublish,timer:0,resolve:null! as ()=>void}
  const capped=new Promise<never>((_resolve,reject)=>{origin.resolve=()=>reject(Error('Save status could not be confirmed'))})
  origin.timer=window.setTimeout(this.capCallback(origin),6000)
  return Promise.race([this.commitWork(c,dependency,canPublish),capped]).finally(this.capFinished(origin))
 }
 private capFinished(origin:{done:boolean;timer:number}){return ()=>{origin.done=true;clearTimeout(origin.timer)}}
 private capCallback(origin:{owner:string;claim:string;done:boolean;store:Store;publish:()=>boolean;resolve:()=>void}){return ()=>{
  if(origin.done)return
  if(!this.ownership.retired.has(origin.owner)&&origin.publish()){void origin.store.revoke(origin.claim);this.unresolved(Error('Save status could not be confirmed'))}
  origin.resolve()
 }}
 private async commitWork(c:Command,dependency:Receipt['dependency'],canPublish:()=>boolean):Promise<Root>{
  const store=this.requireStore();this.own(c.attemptId,c);if(dependency)this.own(c.attemptId,dependency);this.pending.set(c.requestId,c)
  try{const root=await store.execute(c,dependency);this.pending.delete(c.requestId);wipe(c.payload);return root}
  catch{
   if(!this.pending.has(c.requestId))throw Error('Request capability retired')
   let lastError:unknown=Error('Save status could not be confirmed')
   for(let n=0;n<2;n++){
    if(!this.pending.has(c.requestId))throw Error('Request capability retired')
    let proof:Awaited<ReturnType<Store['readback']>>
    try{proof=await store.readback(c)}catch{lastError=Error('Save status could not be confirmed');continue}
    if(!this.pending.has(c.requestId))throw Error('Request capability retired')
    if(proof.status==='applied'){this.pending.delete(c.requestId);wipe(c.payload);return proof.root}
    if(proof.status==='retired'){this.pending.delete(c.requestId);throw Error('The old request was retired')}
    if(this.commandLost(c,proof.root)){this.pending.delete(c.requestId);throw Error('The command lost to a committed terminal or response')}
   }
   if(this.pending.has(c.requestId)){if(canPublish()){await store.revoke(c.leaseId);if(canPublish())this.unresolved(lastError)}else this.pending.delete(c.requestId)}throw lastError
  }
 }
 private commandLost(c:Command,root:Root){const a=root.attempts.find(x=>x.id===c.attemptId);return c.kind!=='open'&&(!a||a.status!=='active'||root.route?.attemptId!==c.attemptId)||c.kind==='expiry'&&!!a?.facts.responses.some(x=>x.item===c.payload.item)}
 private unresolved(_error:unknown){
  this.cancelTimers();if(this.active)this.active.fenced=true;this.stage.hideStimulus();this.release();this.beginView('unresolved')
  try{this.stage.render({title:'Save status could not be confirmed',paragraphs:['The local operation could not be confirmed.','Retry checks the same request. Timed play cannot resume.'],actions:[{label:'Retry',run:()=>void this.manualRetry()},{label:'Back to library',secondary:true,run:()=>this.leave()}]})}catch{this.stage.quarantine()}
 }
 private async manualRetry(){
  const store=this.requireStore(),claim=this.viewClaim
  try{
   for(const c of this.pending.values()){
    const proof=await store.readback(c);if(!this.current(claim))return
    if(proof.status==='absent')throw Error('The request has no confirmed result; timed play remains closed')
    if(proof.status==='retired'||proof.status==='applied'){this.pending.delete(c.requestId);wipe(c.payload)}
   }
   if(this.active)this.discard(this.active);this.active=null;this.release();this.instructions()
  }catch(e){if(this.current(claim))this.unresolved(e)}
 }
 private async refresh(){
  if(this.refreshBusy||!this.store||this.screen==='error'||document.visibilityState!=='visible')return
  this.refreshBusy=true;const claim=this.viewClaim
  try{
   if(this.ownerUnavailable){await this.reconcilePrior();if(!this.current(claim))return;if(!this.ownerUnavailable&&this.screen==='instructions')this.instructions()}
   const publish=(permit=()=>{})=>this.store!.publish(root=>{permit();
    if(!this.current(claim))return
    this.assertMockReport(root)
    if(this.identity&&(root.installationId!==this.identity.installationId||root.generation!==this.identity.generation)){this.identity={installationId:root.installationId,generation:root.generation};this.guidePassed=false;this.retireView();return}
    const passed=currentGuideCompletion(root,this.selectedMode),source=root.attempts.find(a=>completedGuideSource(root,a.id,this.selectedMode))?.id??null
    if(passed!==this.guidePassed||source!==this.completedSourceId){this.guidePassed=passed;this.completedSourceId=source;if(this.screen==='instructions')this.instructions();else if(this.screen==='ready'&&!passed)this.guide()}
    for(const c of this.pending.values())if(root.attemptFences.includes(c.attemptId)){this.retireView();return}
    const a=this.active
    if(a){
     const record=root.attempts.find(x=>x.id===this.origins.get(a))
     if(!record){this.retireView(this.origins.get(a));return}
     if(!a.fenced&&(record.status!=='active'||root.route?.id!==a.routeId||root.route.lease!==a.leaseId||root.route.attemptId!==a.attemptId)){
      if(record.status==='completed'){a.fenced=true;this.cancelTimers();this.release();void this.complete(a.attemptId);return}
      this.retireView(this.origins.get(a));return
     }
    }
    if(this.personal&&!root.attempts.some(x=>x.id===this.personalOrigin)){this.retireView(this.personalOrigin??undefined);return}
    if(this.screen==='report'&&this.personalOrigin&&root.revision!==this.reportRevision){const selected=root.attempts.find(x=>x.id===this.personalOrigin);if(selected?.status==='completed'&&selected.report)this.paintReport(selected,root)}
    if(this.screen==='history'&&root.revision!==this.viewEpoch)this.paintHistory(root)
   },this.active?this.origins.get(this.active)??null:this.personalOrigin,this.active?.leaseId??null)
   if(this.reportTarget)await withSelectedMockReportPublication(this.reportTarget,publish)
   else await publish()
  }catch(e){if(this.current(claim)&&(this.reportTarget||this.active||this.personal||this.pending.size||this.screen==='history'))this.error(e,true)}finally{this.refreshBusy=false}
 }
 private interrupt(reason:'hidden'|'owner-lost'|'display-invalid'){
  if(this.screen==='opening'||this.screen==='opening-cancel'){this.requestOpeningExit('library',true);return}
  const a=this.active
  if(!a||a.fenced)return
  a.fenced=true;this.cancelTimers();this.stage.hideStimulus()
  void this.exit(reason,'library',false)
 }
 private instructions(){
  this.beginView('instructions');this.active=null;this.release()
  this.stage.render({title:'Faces · How it works',paragraphs:['Read the story and picture for the first eight items. The last six show only a picture.','Choose one of ten labels. Selecting a label submits your answer.','Standard time: 30 seconds with a story, 7 seconds for a picture only. You can still answer after the picture disappears.','All 14 practice answers count. A face alone cannot prove an emotion; review the story and visible clues.','Results stay in this browser. We collect completion counts and limited totals; see Privacy. Repeated pictures may feel familiar.',...(this.ownerUnavailable?['Another tab is using timed practice. Saved results remain available here.']:[])],content:(mount)=>{
   const field=document.createElement('fieldset');field.append(text('legend','Timing mode'))
   for(const [mode,label] of [['standard-v1','Standard · story 30 seconds; picture only 7 seconds'],['extended-v1','Extended · story 60 seconds; picture only 14 seconds (modified form)']] as const){const line=document.createElement('label'),radio=document.createElement('input');radio.type='radio';radio.name='faces-mode';radio.value=mode;radio.checked=this.selectedMode===mode;this.stage.on(radio,'change',()=>{this.viewClaim++;this.selectedMode=mode;this.completedSourceId=null;void this.refresh()});line.append(radio,document.createTextNode(` ${label}`));field.append(line)}mount.append(field,text('p','Extended timing is recorded separately. The photographic task has no equivalent nonvisual substitute.','muted'))
  },actions:[{label:'Continue',run:()=>this.check()},...(this.completedSourceId&&!this.ownerUnavailable?[{label:'Skip instructions',run:()=>void this.skipGuide()}]:[]),{label:'See an example',secondary:true,run:()=>this.guide()},{label:'Saved results',secondary:true,run:()=>void this.history()},{label:this.mock||this.reportTarget?'Return to mock':'Main menu',secondary:true,run:()=>this.leave()}]})
 }
 private guide(){this.beginView('guide');this.stage.render({title:'How this practice works',paragraphs:['Eight situation-and-photo items come first. Six photo-only items follow. The labels stay in the same order on every item.','Standard: 30 seconds with a story, or 7 seconds for a picture only. Extended: 60 seconds with a story, or 14 seconds for a picture only. After the limit, the stimulus disappears, but a late answer still counts toward matching and advances. There is no correctness feedback during play.',GUIDE_DISCLOSURE,'What this kind of task is generally designed to observe: interpreting picture cues and short situations. A face alone cannot prove an emotion. This original practice does not predict a hiring outcome.'],content:mount=>{const card=document.createElement('section');card.className='card';card.append(text('h2','Untimed example'),text('p','After several failed attempts, Robin checks the instructions and tries again carefully.'),text('p','Practice answer: Determination. Robin keeps working after setbacks and changes the approach. That continuing effort is the clue.'));mount.append(card)},actions:[{label:'Check understanding',run:()=>this.check()},{label:'Instructions',secondary:true,run:()=>this.instructions()}]})}
 private check(){
  this.beginView('check')
  const questions=[
   ['How do I submit, and what happens when time expires?',['Choose one label; after the picture disappears I can still choose','Choose a label and press Next; the game chooses for me when time expires'],'Choose one label; after the picture disappears I can still choose']
  ] as const
  const selected=this.own(this.ownership.generationKey,new Map<number,string>()),feedback=text('p','')
  this.stage.render({title:'Check understanding',paragraphs:['Choose the answer that gets both rules right. A wrong answer can be reviewed and retried.'],content:mount=>{
   for(let i=0;i<questions.length;i++){const [prompt,options]=questions[i],field=document.createElement('fieldset');field.append(text('legend',prompt));for(const option of options){const line=document.createElement('label'),radio=document.createElement('input');radio.type='radio';radio.name=`check-${i}`;radio.value=option;this.stage.on(radio,'change',()=>selected.set(i,option));line.append(radio,document.createTextNode(` ${option}`));field.append(line)}mount.append(field)}mount.append(feedback)
   const go=this.control('Check answers',()=>{const wrong=questions.findIndex((q,i)=>selected.get(i)!==q[2]);if(wrong>=0){this.stage.updateText(feedback,`Review question ${wrong+1}: ${questions[wrong][2]}. Try again.`);return}void this.finishGuide()});mount.append(go)
  },actions:[{label:'Back to guide',secondary:true,run:()=>this.guide()}]})
 }
 private async finishGuide(){
  if(this.screen!=='check'||!this.identity)return
  const claim=++this.viewClaim,c=management(this.identity as Root,'guide',{guideVersion:GUIDE,checkVersion:CHECK})
  try{await this.requireStore().manage(c);await this.publishView(claim,root=>{invariant(root.lastGuideReceipt?.requestId===c.requestId,'Guide completion changed');this.guidePassed=true;this.ready()})}catch(e){if(this.current(claim))this.error(e,true)}
 }
 private async skipGuide(){
  if(this.screen!=='instructions'||!this.identity)return
  const claim=++this.viewClaim
  try{const root=await this.requireStore().read();if(!this.current(claim))return
   const source=root.attempts.find(a=>completedGuideSource(root,a.id,this.selectedMode))
   if(!source){this.completedSourceId=null;this.instructions();return}
   const command=management(root,'guide',completedGuidePayload(source.id))
   await this.requireStore().manage(command)
   await this.publishView(claim,current=>{invariant(current.lastGuideReceipt?.requestId===command.requestId&&currentGuideCompletion(current,this.selectedMode),'Completed Faces source changed');this.guidePassed=true;this.completedSourceId=source.id;this.ready()})
  }catch(e){if(this.current(claim)){
   try{const latest=await this.requireStore().read();if(!this.current(claim))return
    if(!currentGuideCompletion(latest,this.selectedMode)){this.guidePassed=false;this.completedSourceId=latest.attempts.find(a=>completedGuideSource(latest,a.id,this.selectedMode))?.id??null;this.instructions();return}
   }catch{/* An unreadable source needs the existing storage recovery screen. */}
   if(this.current(claim))this.error(e,true)
  }}
 }
 private ready(){if(!this.guidePassed)return this.guide();this.beginView('ready');this.stage.render({title:'Ready',paragraphs:[`Mode: ${this.selectedMode==='standard-v1'?'Standard: story 30 seconds; picture only 7 seconds':'Extended: story 60 seconds; picture only 14 seconds'}. Fourteen items, one choice per item.`,'The next action starts the first timed item. No answer feedback appears during play.','We collect completion counts and a total matched-answer count. Detailed answers stay in this browser. See Privacy at traitgame.com/privacy.html.'],actions:[{label:'Start',run:()=>void this.start()},{label:'Restart Instructions',secondary:true,run:()=>this.instructions()},{label:'Close',secondary:true,run:()=>this.leave()}]})}
 private async start(){
  if(this.screen!=='ready'||this.retired)return
  this.usage.begin(this.mock?'mock':'practice')
  this.openingCancel=null
  const token={};this.openingToken=token;let own:OwnerRelease|null=null
  const releaseOwn=()=>{const release=own;own=null;if(this.releaseOwner===release)this.releaseOwner=null;if(release)this.releaseAfter(this.requireStore().drain(),release)}
  const alive=()=>this.openingToken===token
  const claim=this.beginView('opening');this.stage.render({title:'Starting Faces',paragraphs:['Checking exclusive play and local storage…'],actions:[{label:'Restart',secondary:true,run:()=>void this.exit('restart','instructions',false)},{label:'Close',secondary:true,run:()=>void this.exit('close','library',true)}]})
  try{
   await this.ownerDrain;if(!alive())return
   const owner=await takeOwner();own=owner;if(!alive()||!this.current(claim)&&!this.openingCancel){releaseOwn();return}this.releaseOwner=owner
   if(alive()&&this.openingCancel)return this.finishOpeningCancel()
   const store=this.requireStore(),before=await store.read()
   if(!alive()||!this.current(claim)&&!this.openingCancel){releaseOwn();return}
   if(!currentGuideCompletion(before,this.selectedMode)){this.guidePassed=false;releaseOwn();this.guide();return}
   if(before.route&&['opening','play','settling'].includes(before.route.state))throw Error('An earlier attempt still needs reconciliation')
   const leaseId=newId(),ready=await store.ready(leaseId,before.installationId,before.generation),route=ready.route!
   if(alive()&&this.openingCancel)return this.finishOpeningCancel()
   if(!alive()||!this.current(claim)){releaseOwn();return}
   const attemptId=newId(),requestId=newId()
   const open:Command=this.own(attemptId,{eventVersion:EVENT,requestId,installationId:ready.installationId,generation:ready.generation,routeId:route.id,leaseId,attemptId,kind:'open',payload:{readyEpoch:route.epoch,formId:FORM_ID,formHash:FORM_HASH,assetBankHash:BANK_HASH,modeId:this.selectedMode,scoringVersion:SCORING,startedAtWall:new Date().toISOString(),clockDocumentId:this.clockDocumentId,familiarity:ready.exposure.some(x=>x.assetBankHash===BANK_HASH)?'familiar':'new-local-record'}})
   if(!alive()||!this.current(claim)&&!this.openingCancel){releaseOwn();return}
   await store.opening(route.id,leaseId,requestId)
   if(!alive()||!this.current(claim)&&!this.openingCancel){releaseOwn();return}
   if(alive()&&this.openingCancel){await store.abandonOpening(route.id,leaseId,requestId);if(alive())return this.finishOpeningCancel();releaseOwn();return}
   if(this.mock)await this.mock.beforeArm({requestId,attemptId,originTicketId:null,installationId:ready.installationId,
    generation:ready.generation,requestKind:'open',nativeIdentity:[{key:'routeId',value:route.id},{key:'leaseId',value:leaseId}]})
   if(!alive()||!this.current(claim)&&!this.openingCancel){releaseOwn();return}
   this.own(attemptId,open)
   await this.commit(open,null,()=>alive()&&(this.current(claim)||!!this.openingCancel))
   if(!alive()||!this.current(claim)&&!this.openingCancel){releaseOwn();return}
   this.active=this.own(attemptId,{attemptId,routeId:route.id,leaseId,installationId:ready.installationId,generation:ready.generation,mode:this.selectedMode,item:0,onsetUs:null,onsetRequestId:null,intentRequestId:null,deadlineUs:null,image:null,context:null,expired:false,onsetCommitted:false,expiryRequested:false,admitted:false,fenced:false,pendingResponse:null,claim:0,revealAt:0,loaded:null,viewData:null,input:{held:this.inputFallback.held,repeated:this.inputFallback.repeated,lastAt:-1000}});this.origins.set(this.active,attemptId)
   this.usage.admit(attemptId,this.selectedMode==='standard-v1')
   const cancel=this.currentOpeningCancel()
   if(cancel){this.openingCancel=null;this.screen='opening-settled';await this.exit(cancel.destination==='library'?'close':'restart',cancel.destination,cancel.navigate);return}
   await this.showItem(0)
  }catch(e){if(alive()&&(this.current(claim)||this.openingCancel))this.error(e,true);else releaseOwn()}
 }
 private requestOpeningExit(destination:'instructions'|'library',navigate:boolean){
  this.openingCancel={destination,navigate};this.beginView('opening-cancel')
  this.stage.render({title:'Closing pending start',paragraphs:['Waiting for the exact opening request to settle before another attempt can start.'],actions:[{label:'Close',secondary:true,run:()=>this.requestOpeningExit('library',true)}]})
 }
 private finishOpeningCancel(){const cancel=this.openingCancel;this.openingCancel=null;this.release();if(cancel?.navigate)this.leave();else this.instructions()}
 private showItem(index:number){
  const prior=this.active;invariant(prior&&!prior.fenced,'No active attempt')
  const a=this.own(prior.attemptId,{...prior,item:index,onsetUs:null,onsetRequestId:null,intentRequestId:null,deadlineUs:null,image:null,context:null,expired:false,onsetCommitted:false,expiryRequested:false,admitted:false,fenced:false,pendingResponse:null,claim:0,revealAt:0,loaded:null,viewData:null,input:{held:prior.input.held,repeated:prior.input.repeated,lastAt:-1000}})
  this.origins.set(a,a.attemptId);this.active=a;this.discard(prior)
  a.claim=this.beginView('loading-item')
  this.stage.render({title:`Item ${a.item+1} of 14`,paragraphs:['Preparing the original portrait…'],actions:[{label:'Restart',run:()=>void this.exit('restart','instructions',false)},{label:'Close',secondary:true,run:()=>void this.exit('close','library',true)}]})
  return this.showItemWork(a)
 }
 private async showItemWork(a:Active){
  try{a.loaded=this.ownership.asset(this.origins.get(a)!,await loadPortrait(a.item))}catch{if(this.live(a)&&this.current(a.claim))await this.exit('asset-failed','instructions',false);return}
  if(!this.live(a)||!this.current(a.claim)){if(a.loaded?.url)URL.revokeObjectURL(a.loaded.url);return}
  try{
   const root=await this.requireStore().read(a.attemptId,a.leaseId)
   if(!this.live(a))return
   const intent=this.ownItem(a,seal(root,a.routeId,a.leaseId,a.attemptId,'intent',{item:a.item,assetId:ITEMS[a.item].assetId,assetSha256:ITEMS[a.item].assetSha256,contextSha256:ITEMS[a.item].contextSha256}))
   await this.commit(intent)
   if(!this.live(a)||!this.current(a.claim))return
   a.intentRequestId=intent.requestId
   await this.publishView(a.claim,this.revealFactory(a))
  }catch{if(this.live(a))this.error(Error('Item preparation failed'),true)}
 }
 private revealFactory(a:Active){return (current:Root)=>{
  if(!this.live(a)||!this.current(a.claim)||!a.loaded)return
  invariant(current.route?.id===a.routeId&&current.route.lease===a.leaseId&&current.route.attemptId===a.attemptId&&current.attempts.find(x=>x.id===a.attemptId)?.facts.intents.length===a.item+1,'Reveal authority changed')
  this.paintQuestion(a);this.screen='question';a.revealAt=nowUs()
  this.presentationTimer=window.setTimeout(this.frameFailure(a),500)
  requestAnimationFrame(this.firstFrame(a))
 }}
 private frameFailure(a:Active){return ()=>{if(this.live(a)&&this.current(a.claim))void this.exit('display-invalid','instructions',false)}}
 private firstFrame(a:Active){return ()=>{
  if(!this.live(a)||!this.current(a.claim))return
  if(nowUs()-a.revealAt>=500_000||!a.image||!this.questionValid(a,a.image))return this.frameFailure(a)()
  a.onsetUs=nowUs();a.deadlineUs=a.onsetUs+limitUs(a.mode,a.item);this.scheduleExpiry(a)
  requestAnimationFrame(this.secondFrame(a))
 }}
 private secondFrame(a:Active){return ()=>{
  if(!this.live(a)||!this.current(a.claim))return
  if(nowUs()-a.revealAt>=500_000||!a.image||!this.questionValid(a,a.image))return this.frameFailure(a)()
  clearTimeout(this.presentationTimer);void this.confirmOnset(a)
 }}
 private paintQuestion(a:Active){
  const ui=this.ownItem(a,{index:a.item,time:limitUs(a.mode,a.item)/1_000_000,image:a.loaded!.image,context:null as HTMLElement|null,timer:null as HTMLElement|null,status:null as HTMLElement|null})
  a.viewData=ui
  this.stage.render({privateData:ui,title:'Which emotion fits?',question:true,content:mount=>{
   const top=document.createElement('div');top.className='question-top';top.append(text('span',`Item ${ui.index+1} of 14`));ui.timer=text('span',`${ui.time} seconds`,'timer');top.append(ui.timer);ui.status=text('span','','expiry-status');ui.status.setAttribute('role','status');ui.status.setAttribute('aria-live','polite');top.append(ui.status);mount.append(top)
   const stimulus=document.createElement('section');stimulus.className=ITEMS[ui.index].context===null?'stimulus':'stimulus contextual';stimulus.append(ui.image)
   if(ITEMS[ui.index].context!==null){ui.context=text('p',ITEMS[ui.index].context!,'context');stimulus.append(ui.context)}mount.append(stimulus)
   const choices=document.createElement('div');choices.className='choices';choices.setAttribute('role','group');choices.setAttribute('aria-label',`Emotion choices for item ${ui.index+1}`)
   for(const label of LABELS){const choice=document.createElement('button');choice.type='button';choice.textContent=label;choice.disabled=true;this.stage.on(choice,'click',this.actionHandler({kind:'answer',id:a.attemptId,index:ui.index,choice:label}));choices.append(choice)}mount.append(choices,text('p',`Item ${ui.index+1} of 14`,'counter'))
  },actions:[{label:'Restart',secondary:true,run:()=>void this.exit('restart','instructions',false)},{label:'Close',secondary:true,run:()=>void this.exit('close','library',true)}]})
  this.ownItem(a,ui);a.image=ui.image;a.context=ui.context;this.stage.setQuestionControls(ui.image,ui.context,ui.timer!,ui.status!)
 }
 private questionValid(a:Active,image:HTMLImageElement){return !a.fenced&&a===this.active&&this.stage.imageGeometryGood(image,a.context,true)}
 private async confirmOnset(a:Active){
  if(!this.live(a))return
  try{
   const root=await this.requireStore().read(a.attemptId,a.leaseId)
   if(!this.live(a))return
   const c=this.ownItem(a,seal(root,a.routeId,a.leaseId,a.attemptId,'onset',{item:a.item,intentRequestId:a.intentRequestId,clockDocumentId:this.clockDocumentId,onsetUs:a.onsetUs,receiptVersion:'faces-render-v1'}))
   a.onsetRequestId=c.requestId
   await this.commit(c)
   if(!this.live(a))return
   a.onsetCommitted=true
   if(a.expired)void this.recordExpiry(a)
   await this.publishView(a.claim,this.onsetPublication(a))
  }catch{if(this.live(a))this.error(Error('Onset could not be confirmed'),true)}
 }
 private onsetPublication(a:Active){return (current:Root)=>{
  if(!this.live(a))return
  invariant(current.route?.attemptId===a.attemptId&&current.route.lease===a.leaseId&&current.attempts.find(x=>x.id===a.attemptId)?.facts.onsets.length===a.item+1,'Onset authority changed')
  if(a.deadlineUs!==null&&nowUs()>=a.deadlineUs){a.expired=true;this.stage.hideStimulus(true)}
  invariant(this.stage.admissionGood(a.image,a.context,a.expired),'Onset display changed');this.stage.enableChoices()
 }}
 private deadlineCallback(a:Active){return ()=>{
  if(!this.live(a)||a.deadlineUs===null)return
  if(a.deadlineUs>nowUs()){this.deadlineTimer=window.setTimeout(this.deadlineCallback(a),Math.max(1,Math.ceil((a.deadlineUs-nowUs())/1000)));return}
  if(a.expired)return
  a.expired=true;clearInterval(this.countdownTimer);this.stage.hideStimulus(true)
  if(a.onsetRequestId)void this.recordExpiry(a)
 }}
 private countdownCallback(a:Active){return ()=>{
  if(!this.live(a)||a.deadlineUs===null)return
  if(a.deadlineUs<=nowUs())return this.deadlineCallback(a)()
  try{this.stage.setTimer(`${Math.ceil((a.deadlineUs-nowUs())/1_000_000)} seconds`)}catch{void this.exit('display-invalid','instructions',false)}
 }}
 private scheduleExpiry(a:Active){
  clearTimeout(this.deadlineTimer);clearInterval(this.countdownTimer);if(a.deadlineUs===null)return
  this.countdownTimer=window.setInterval(this.countdownCallback(a),100)
  this.deadlineTimer=window.setTimeout(this.deadlineCallback(a),Math.max(1,Math.ceil((a.deadlineUs-nowUs())/1000)))
 }
 private recordExpiry(a:Active){
  if(!this.live(a)||!a.onsetCommitted||a.expiryRequested||!a.onsetRequestId||a.deadlineUs===null||a.onsetUs===null)return
  a.expiryRequested=true
  const c=this.ownItem(a,{eventVersion:EVENT,requestId:newId(),installationId:a.installationId,generation:a.generation,routeId:a.routeId,leaseId:a.leaseId,attemptId:a.attemptId,kind:'expiry' as const,payload:{item:a.item,onsetRequestId:a.onsetRequestId,observedUs:Math.max(nowUs(),a.deadlineUs),deadlineUs:a.deadlineUs}})
  const dependency=a.pendingResponse?.payload.timely===true?this.ownItem(a,{command:a.pendingResponse}):null
  return this.commit(c,dependency).catch(()=>{/* response or exit may win */})
 }
 private answer(a:Active,choice:string,event:MouseEvent){
  if(a!==this.active||a.fenced||a.admitted||!a.onsetRequestId||a.onsetUs===null||a.deadlineUs===null||this.input.repeated||!LABELS.includes(choice))return
  try{invariant(this.stage.admissionGood(a.image,a.context,a.expired),'Display invalid at admission')}catch{return void this.exit('display-invalid','instructions',false)}
  const admission=nowUs()
  if(admission>=a.deadlineUs&&!a.expired){a.expired=true;this.stage.hideStimulus(true);void this.recordExpiry(a)}
  a.admitted=true;this.cancelTimers()
  const inputClass=(this.input.held||event.detail===0&&performance.now()-this.input.lastAt<100)?'keyboard':event.detail===0?'assistive':event instanceof PointerEvent&&event.pointerType==='touch'?'touch':'pointer'
  const elapsedUs=Math.max(0,admission-a.onsetUs)
  const c:Command={eventVersion:EVENT,requestId:newId(),installationId:a.installationId,generation:a.generation,routeId:a.routeId,leaseId:a.leaseId,attemptId:a.attemptId,kind:'response',payload:{item:a.item,onsetRequestId:a.onsetRequestId,choice,elapsedUs,timely:elapsedUs<limitUs(a.mode,a.item),inputClass}}
  this.ownItem(a,c);a.pendingResponse=c
  this.beginView('response-pending')
  this.stage.render({title:'Saving answer',paragraphs:[`Item ${a.item+1} of 14. Your choice is being confirmed locally.`],actions:[{label:'Restart',run:()=>void this.exit('restart','instructions',false)},{label:'Close',secondary:true,run:()=>void this.exit('close','library',true)}]})
  return this.answerWork(a,c)
 }
 private async answerWork(a:Active,c:Command){
  try{
   const committed=await this.commit(c)
   if(!this.live(a))return
   a.pendingResponse=null
   const attempt=committed.attempts.find(x=>x.id===a.attemptId)
   invariant(attempt,'Saved attempt disappeared')
   if(attempt.status==='completed'){
    this.cancelTimers();a.fenced=true;this.active=null;this.release();await this.complete(a.attemptId);this.discard(a)
   }else await this.showItem(a.item+1)
  }catch{if(this.live(a)&&this.screen!=='unresolved')this.error(Error('Answer could not be confirmed'),true)}
 }
 private exitCurrent(job:ExitJob){return this.exitJob===job&&!job.retired&&this.current(job.claim)&&this.active===job.attempt}
 private finishExitOwner(job:ExitJob){const release=job.release;job.release=null;if(release)this.releaseAfter(job.store.drain(job.attempt?.leaseId),release)}
 private exit(reason:'restart'|'close'|'hidden'|'owner-lost'|'display-invalid'|'asset-failed',destination:'instructions'|'library',navigate:boolean){
  if(this.screen==='opening'||this.screen==='opening-cancel'){this.requestOpeningExit(destination,navigate);return}
  this.usage.cancel()
  const prior=this.exitJob
  if(prior&&this.exitCurrent(prior)){
   prior.destination=destination;prior.navigate=navigate;return
  }
  const a=this.active,job:ExitJob={observedUs:nowUs(),reason,attempt:a,claim:this.beginView('settling'),destination,navigate,retired:false,release:this.releaseOwner,store:this.requireStore()}
  if(a)this.ownItem(a,job);this.releaseOwner=null;this.exitJob=job
  if(a){a.fenced=true;this.cancelTimers();this.stage.hideStimulus()}
  try{this.stage.render({title:'Closing attempt',paragraphs:['Checking the saved result and ending this attempt…'],actions:[{label:'Restart',run:()=>void this.exit('restart','instructions',false)},{label:'Close',run:()=>void this.exit('close','library',true)}]})}catch{this.stage.quarantine()}
  return this.exitWork(job)
 }
 private async exitWork(job:ExitJob){
  const a=job.attempt
  try{
   if(a){
    // Extract authority synchronously; no full private Root crosses this await.
    const c=await job.store.publish(root=>{
     if(!this.exitCurrent(job))return null
     const attempt=root.attempts.find(x=>x.id===a.attemptId)
     if(attempt?.status!=='active')return null
     invariant(root.installationId===a.installationId&&root.generation===a.generation,'Exit generation retired')
     return this.ownItem(a,seal(root,a.routeId,a.leaseId,a.attemptId,'exit',{destination:job.destination,reason:job.reason,observedUs:job.observedUs,clockDocumentId:this.clockDocumentId}))
    })
    if(!this.exitCurrent(job))return
    if(c){const response=a.pendingResponse,dependency=response?.payload.timely===true?{command:response}:null;await this.commit(c,dependency,()=>this.exitCurrent(job));if(!this.exitCurrent(job))return}
   }
   if(!this.exitCurrent(job))return
   this.active=null;this.exitJob=null;this.finishExitOwner(job)
   if(job.navigate||job.destination==='library')this.leave();else {if(this.mock)await this.mock.retry();this.instructions()}
  }catch(e){if(this.exitCurrent(job)&&this.screen!=='unresolved'){this.exitJob=null;this.finishExitOwner(job);this.error(e,true)}}finally{this.finishExitOwner(job);if(this.exitJob===job&&job.retired)this.exitJob=null;if(a)this.discard(a);wipe(job);job.retired=true}
 }
 private async complete(id:string){
  const claim=this.beginView('complete')
  try{await this.publishView(claim,root=>{const a=root.attempts.find(x=>x.id===id);invariant(a?.status==='completed'&&a.report,'Completion is not durably confirmed');this.bindPersonal(root,id);this.active=null;this.stage.render({title:'Test complete',paragraphs:['All fourteen choices were saved. The next screen shows your descriptive report.'],actions:[this.action('Next — see report',{kind:'report',id}),this.action('Close',{kind:'leave'},true)]});this.usage.finish(id,'completed',()=>({correct:a.report!.context.matches+a.report!.photo.matches,trials:a.report!.context.eligibleTotal+a.report!.photo.eligibleTotal}));})}catch(e){if(this.current(claim))this.error(e,true)}
 }
 private async report(id:string){const claim=++this.viewClaim;try{await this.publishView(claim,root=>{const a=root.attempts.find(x=>x.id===id);invariant(a?.status==='completed'&&a.report,'Completed report unavailable');this.bindPersonal(root,id);this.paintReport(a,root)})}catch(e){if(this.current(claim))this.error(e,true)}}
 private paintReport(a:Attempt,root:Root){
  this.screen='report';const id=a.id,r=a.report!,spec=identityForAttempt(a),old=spec===LEGACY
  this.reportRevision=root.revision
  const previous=root.attempts.filter(other=>other.id!==a.id&&other.status==='completed'&&!!other.report&&other.formId===a.formId&&other.formHash===a.formHash&&other.assetBankHash===a.assetBankHash&&other.scoringVersion===a.scoringVersion&&other.modeId===a.modeId&&other.startedAtWall<a.startedAtWall).sort((x,y)=>y.startedAtWall.localeCompare(x.startedAtWall))[0]
  const total=r.context.matches+r.photo.matches,timely=r.context.timelyMatches+r.photo.timelyMatches,late=r.context.lateCount+r.photo.lateCount
  const answered=a.facts.responses
  const incorrect=answered.filter((response,i)=>spec.items[i].matchEligible&&response.choice!==spec.items[i].intended)
  const lateMatched=answered.filter((response,i)=>spec.items[i].matchEligible&&response.choice===spec.items[i].intended&&!response.timely)
  this.stage.render({title:'Your Faces result',paragraphs:[`Completed · ${a.modeId==='standard-v1'?'Standard':'Extended'}`,...feedbackLines(facesFeedback({total,eligible:spec.eligible,timely,late,incorrect:incorrect.length})),...(old?['Earlier scoring: 12 answers counted. Items 2 and 7 were discussion-only and did not affect this score. Timing covers all 14 answers.']:[]),...(r.familiarity==='familiar'?['You may recognise these pictures from earlier practice.']:[])],content:mount=>{
   const numbers=document.createElement('details');numbers.className='result-details';const numbersSummary=text('summary','Detailed numbers');this.stage.on(numbersSummary,'click',this.actionHandler({kind:'disclosure',id,index:0}));numbers.append(numbersSummary);if(previous?.report)numbers.append(text('p',`A previous compatible retained run matched ${previous.report.context.matches+previous.report.photo.matches} of ${spec.eligible}.`))
   const section=document.createElement('section');section.className='result-section';section.append(text('h2','Answers by item type'))
   const table=document.createElement('table'),head=document.createElement('thead'),headRow=document.createElement('tr')
   for(const label of ['Item type','Matched','Within time'])headRow.append(text('th',label));head.append(headRow);table.append(head)
   const body=document.createElement('tbody')
   for(const [label,cat,note] of [['Story + picture',r.context,old?'6 of 8 answers counted':''],['Picture only',r.photo,'']] as const){const row=document.createElement('tr');row.append(text('th',label+(note?` · ${note}`:'')),text('td',`${cat.matches} of ${cat.eligibleTotal}`),text('td',`${cat.timelyMatches} of ${cat.eligibleTotal}`));body.append(row)}table.append(body);section.append(table,text('p','Within time counts answers that matched before the time limit. A matching late answer still counts in Matched.'),text('p',late===0?'All 14 answers were within time.':`${late} of 14 answers were late.`));numbers.append(section);mount.append(numbers)
   const review=document.createElement('section');review.className='result-section';review.append(text('h2','Answers to review'))
   if(!incorrect.length)review.append(text('p',old?'All 12 scored answers matched the practice answers':'All 14 answers matched the practice answers'))
   for(const response of incorrect){const i=response.item as number,item=spec.items[i];review.append(this.contentAction(`Item ${i+1} · Your answer: ${response.choice} · Practice answer: ${item.intended}${response.timely?'':' · Late'}`,{kind:'review',id,index:i}))}
   if(lateMatched.length){const line=document.createElement('p');line.append(document.createTextNode('Matched after time expired: '));for(const [n,response] of lateMatched.entries()){if(n)line.append(document.createTextNode(', '));line.append(this.contentAction(`Item ${(response.item as number)+1}`,{kind:'review',id,index:response.item as number},true))}review.append(line)}
   if(old){review.append(text('h3','Discussion items'));for(const i of [1,6]){const response=answered[i];review.append(this.contentAction(`Item ${i+1} · Your answer: ${response.choice} · Not scored in this saved attempt${response.timely?'':' · Answered after time expired'}`,{kind:'review',id,index:i},true))}}
   mount.append(review)
   const times=document.createElement('details');times.className='result-details';const timeSummary=text('summary','Response times');this.stage.on(timeSummary,'click',this.actionHandler({kind:'disclosure',id,index:1}));times.append(timeSummary,text('p','Average time to choose an answer, including incorrect answers.'))
   for(const [label,cat] of [['Story + picture',r.context],['Picture only',r.photo]] as const){const row=document.createElement('p');row.append(text('strong',label),document.createTextNode(` · ${cat.timelyCount?`Within time: ${mean(cat.timelyLatencySumUs,cat.timelyCount)} (${cat.timelyCount} ${cat.timelyCount===1?'answer':'answers'})`:'No answers within time'} · ${cat.lateCountForMean?`After time expired: ${mean(cat.lateLatencySumUs,cat.lateCountForMean)} (${cat.lateCountForMean} ${cat.lateCountForMean===1?'answer':'answers'})`:'No late answers'}`));times.append(row)}mount.append(times)
   const details=document.createElement('details');details.className='result-details';const detailSummary=text('summary','Result details');this.stage.on(detailSummary,'click',this.actionHandler({kind:'disclosure',id,index:2}));details.append(detailSummary)
   for(const line of [`Form: ${a.formId}`,`Form hash: ${a.formHash}`,`Bank hash: ${a.assetBankHash}`,`Scoring: ${a.scoringVersion}`,`Feedback: ${old?`historical form ${a.formId} / ${a.formHash}`:CURRENT.feedbackVersion}`,`Report presentation: ${REPORT_PRESENTATION}`,`Mode and limits: ${a.modeId} · ${limitUs(a.modeId,0)/1_000_000} s story / ${limitUs(a.modeId,8)/1_000_000} s picture`,`Saved status: ${a.status}`,'Interruption context: Not recorded',`Observed input classes: ${[...new Set(answered.map(x=>x.inputClass))].join(', ')||'Not recorded'}`])details.append(text('p',line))
   if(r.confusionPairs.length){details.append(text('h3','Answer differences'));for(const pair of r.confusionPairs)details.append(text('p',`Practice answer ${pair.intended}; your answer ${pair.selected}; ${pair.count} ${pair.category==='context'?'story-and-picture':'picture-only'} item${pair.count===1?'':'s'}.`))}mount.append(details)
   mount.append(text('p','These are practice answers for fictional items. A face can support more than one reading. This activity does not measure emotional intelligence or predict hiring results.','notice'))
  },actions:[this.action('Review all answers',{kind:'review',id,index:0}),...(this.mock?[{label:'Continue full mock',run:()=>this.returnToMock()},this.action('Try Again',{kind:'instructions'})]:this.reportTarget?[]:[this.action('Practise again',{kind:'instructions'})]),this.action('Label guide',{kind:'help',id},true),...(this.reportTarget?[]:[this.action('History',{kind:'history'},true)]),this.action(this.reportTarget?'Back to mock':'Close',{kind:'leave'},true)]})
 }
 // A disclosure is a new publication of personal data. Its value-free descriptor
 // uses the same ordered authority boundary as report/review navigation.
 private disclose(id:string,index:number){return this.discloseWork(this.own(id,{id,index,claim:++this.viewClaim,epoch:this.stage.viewEpoch}))}
 private async discloseWork(cell:{id:string;index:number;claim:number;epoch:number}){
  const claim=cell.claim
  try{await this.publishView(claim,root=>{
   const a=root.attempts.find(x=>x.id===cell.id)
   invariant(a?.status==='completed'&&a.report,'Completed report unavailable')
   invariant(this.screen==='report'&&this.personalOrigin===cell.id&&this.stage.viewEpoch===cell.epoch,'Report display changed')
   invariant(cell.index===0||cell.index===1||cell.index===2,'Report disclosure unavailable')
   const node=this.stage.mount.querySelectorAll('details')[cell.index]
   invariant(node,'Report disclosure unavailable');this.stage.toggleDetails(node)
  })}catch(e){if(this.current(claim))this.error(e,true)}finally{wipe(cell)}
 }
 private review(id:string,index:number){return this.reviewWork(this.own(id,{id,index,claim:++this.viewClaim}))}
 private async reviewWork(cell:{id:string;index:number;claim:number}){try{await this.publishView(cell.claim,root=>{const a=root.attempts.find(x=>x.id===cell.id);invariant(a,'Review record deleted');this.bindPersonal(root,cell.id);this.paintReview(a,cell.index)})}catch(e){if(this.current(cell.claim))this.error(e,true)}finally{wipe(cell)}}
 private paintReview(a:Attempt,index:number){
  this.screen='review';const id=a.id,spec=identityForAttempt(a),old=spec===LEGACY,item=spec.items[index],r=a.facts.responses[index]
  invariant(index>=0&&index<14&&item,'Review item unavailable')
  const complete=a.status==='completed'
  const status=!a.facts.intents[index]?'Not shown':!a.facts.onsets[index]?'May have been shown; display not confirmed':!r?(a.facts.expired.includes(index)?'Time expired; no answer saved':'Shown; no answer saved'):(r.timely?'Answered within time':'Answered after time expired')
  const selected=r?String(r.choice):'No answer saved'
  const paragraphs=complete?[`Your answer: ${selected}`,`${old&&!item.matchEligible?'Practice interpretation':'Practice answer'}: ${item.intended}`,old&&!item.matchEligible?'Discussion only — not scored in this saved attempt. This answer did not affect your result.':selected===item.intended?'Matched the practice answer.':old?'Did not match the practice answer.':'Incorrect for this practice item.',`Answered in ${seconds(Number(r!.elapsedUs))} · ${r!.timely?'Within time':`Late; limit ${limitUs(a.modeId,index)/1_000_000} s`}`,...(Math.abs(Number(r!.elapsedUs)-limitUs(a.modeId,index))<5000?['Timing is checked before rounding.']:[])]:[`Status: ${status}. Your answer: ${selected}.`,`Practice stopped — ${a.facts.responses.length} of 14 answers saved. There is no final score. Start a new practice; timed items cannot resume.`]
  this.stage.render({title:`Item ${index+1} of 14 · ${item.kind==='context'?'Story + picture':'Picture only'}`,paragraphs,content:mount=>{
   if(!complete)return
   const row=document.createElement('div');row.className='review-row';const url=assetUrls[`./assets/${item.assetId}.png`],image=document.createElement('img');image.src=url;image.alt=`Portrait ${index+1}`;image.className='review-photo';row.append(image)
   const body=document.createElement('section');body.append(text('p',item.context??'No story was provided.'))
   if(old){const ex=LEGACY.items[index].explanation;body.append(text('h2','What the picture shows'),text('p',ex.physical_clues),text('h2','What the story says'),text('p',ex.context_clue),text('h2','Another possible reading'),text('p',`${ex.closest_alternative}. ${ex.why_this_authored_answer}`))}
   else{const ex=FEEDBACK.items[index];body.append(text('h2','Why this answer fits'),text('p',ex.why),text('h2','What the picture shows'),text('p',ex.visible))
    if(selected!==item.intended){const choices=ex.selectedComparisons as Record<string,string|undefined>,conventions=FEEDBACK.practiceConventions as Record<string,string>;const comparison=choices[selected]??(item.context?`${conventions[selected]} ${ex.why} The story is the stronger reason for this practice answer; the face alone does not settle every alternative.`:`${conventions[selected]} No such situation is supplied here. ${ex.why} The picture cannot rule out every alternative, so this marks the practice answer rather than proving an emotion.`);body.append(text('h2',`Why ${selected} is different here`),text('p',comparison))}
    else if(ex.nearestAlternative){const choices=ex.selectedComparisons as Record<string,string|undefined>;const nearest=choices[ex.nearestAlternative];if(nearest)body.append(text('h2',`Compare with ${ex.nearestAlternative}`),text('p',nearest))}
    body.append(text('h2','Next time'),text('p',ex.nextTime))}
   row.append(body);mount.append(row)
  },actions:[this.action('Previous',{kind:'review',id,index:index-1},false,index===0),this.action('Next',{kind:'review',id,index:index+1},false,index===13),this.action(this.reportTarget&&!complete?'Back to mock':'Back to report',{kind:this.reportTarget&&!complete?'leave':complete?'report':'history',id}),this.action('Label guide',{kind:'help',id,index:complete?null:index}),...(this.reportTarget?[]:[this.action('Practise again',{kind:'instructions'})]),this.action(this.reportTarget?'Back to mock':'Close',{kind:'leave'},true)]})
 }
 private help(id:string,index:number|null=null){return this.helpWork(this.own(id,{id,index,claim:++this.viewClaim}))}
 private async helpWork(cell:{id:string;index:number|null;claim:number}){
  const claim=cell.claim
  try{await this.publishView(claim,root=>{
   const a=root.attempts.find(x=>x.id===cell.id);invariant(a,'Help record deleted');this.bindPersonal(root,cell.id);this.screen='help'
   const reviewIndex=a.status==='completed'?null:cell.index??0
   const old=identityForAttempt(a)===LEGACY
   this.stage.render({title:'How these practice labels differ',paragraphs:["Use the whole picture and any story. These descriptions explain this exercise; they are not rules for reading every person's feelings."],content:mount=>{if(old){for(const h of HELP){const block=document.createElement('section');block.className='card';block.append(text('h2',h.label),text('p',h.physical_clue_check),text('p',h.closest_confusion),text('p',h.context_check));mount.append(block)}}else for(const label of LABELS){const block=document.createElement('section');block.className='card';block.append(text('h2',label),text('p',(FEEDBACK.practiceConventions as Record<string,string>)[label]));const retained=HELP.find(h=>h.label===label)!;for(const line of [retained.physical_clue_check,retained.closest_confusion,retained.context_check])block.append(text('p',line.replaceAll('authored','practice')));mount.append(block)}},actions:[this.action(reviewIndex===null?'Back to report':'Back to incomplete review',{kind:reviewIndex===null?'report':'review',id:cell.id,index:reviewIndex}),this.action('Close',{kind:'leave'},true)]})
  })}catch(e){if(this.current(claim))this.error(e,true)}finally{wipe(cell)}
 }
 private async history(){const claim=++this.viewClaim;try{await this.publishView(claim,root=>{this.personal=null;this.personalOrigin=null;this.stage.owner=null;this.paintHistory(root)})}catch(e){if(this.current(claim))this.error(e,true)}}
 private paintHistory(root:Root){
  this.screen='history';this.viewEpoch=root.revision
  const attempts=[...root.attempts].reverse()
  this.stage.render({title:'Local Faces history',paragraphs:['Records live in this browser. Deleting an attempt erases its answers, timing and report. Clearing all Faces data also clears the local familiarity marker.'],content:mount=>{
   if(!attempts.length)mount.append(text('p','No local Faces attempts are saved.'))
   for(const a of attempts){const id=a.id;const row=document.createElement('div');row.className='history-row';row.append(text('p',`${a.startedAtWall} · ${a.modeId==='standard-v1'?'Standard':'Extended'} · ${a.status} · ${a.facts.responses.length}/14 responses · ${identityForAttempt(a)===LEGACY?'Earlier scoring: 12 items':'Current scoring: 14 items'}`));
    if(a.status==='completed')row.append(this.contentAction('Open report',{kind:'report',id}))
    else row.append(this.contentAction('Review incomplete',{kind:'review',id,index:0}))
    row.append(this.contentAction('Delete attempt',{kind:'delete',id},true));this.stage.own(id,row);mount.append(row)}
  },actions:[this.action('Try Again',{kind:'instructions'}),this.action('Delete all Faces data',{kind:'reset'},true),this.action('Close',{kind:'leave'},true)]})
 }
 private async deleteAttempt(id:string){
  if(!this.identity)return
  const c=management(this.identity as Root,'delete',{targetAttemptId:id}),claim=++this.viewClaim
  this.erase(id)
  try{await this.requireStore().manage(c);if(this.current(claim))await this.history()}catch(e){if(this.current(claim))this.error(e,true)}
 }
 private async clearAll(){
  if(!this.identity)return
  const c=management(this.identity as Root,'reset',{proposedNewInstallationId:newId(),proposedNewGeneration:this.identity.generation+1}),claim=++this.viewClaim
  this.erase();this.release()
  try{const root=await this.requireStore().manage(c);if(!this.current(claim))return;this.identity={installationId:root.installationId,generation:root.generation};this.guidePassed=false;await this.history()}catch(e){if(this.current(claim))this.error(e,true)}
 }
}
