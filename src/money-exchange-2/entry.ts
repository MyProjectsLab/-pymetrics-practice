import { mockMenuButtons } from '../onboarding/mockMenuButtons'
import { moneyTwoFeedback } from '../reports/feedback'
import { Controller } from './controller'
import { OwnedDocument } from './owned-document'
import type { ProtectedView } from './owned-document'
import { action, money, forms, validCompleted } from './core'
import { pairArt } from './art'
import { clearDamaged } from './storage'
import { dedicatedHint, claimDedicated, mockReturnUrl } from '../mock/dedicated'
import {monitorReportTarget,reportHint,verifiedReportTarget} from '../mock/report-route'

const controller=new Controller()
let mockHint:ReturnType<typeof dedicatedHint>=null,report:ReturnType<typeof reportHint>=null,routeInvalid=false
try{mockHint=dedicatedHint();report=reportHint();if(mockHint&&report)throw Error('Conflicting mock routes')}catch{routeInvalid=true}
const boundary=new OwnedDocument();boundary.enterProtected()
let cents=0,rating:number|null=null,lastStage='',page=0,tips=false,guidePart=0,guideAnswer:string|null=null,guideFeedback='',detailedNumbers=false;
let renderedEpoch=-1,quarantined=false,returnPending=false,returnError=false,guideChoiceEpoch=0;
const compact=()=> (window.visualViewport?.width??innerWidth)<600
const back=()=>{guideChoiceEpoch++;controller.mockContext?.retireReturnIntent();window.location.assign(mockHint?mockReturnUrl(mockHint.mockId):report?mockReturnUrl(report.mockId):'/practice')}
function returnFromOwned(stage:string){
 guideChoiceEpoch++
 if(returnPending)return
 const mock=controller.mockContext
 if(!mock||!['library','instructions','ready','test_complete','report','review','history'].includes(stage)){back();return}
 const signal=mock.beginReturnIntent(),epoch=controller.view().epoch,launch=mock.launchId
 returnPending=true
 returnError=false
 void mock.terminal().then(status=>{
  if(signal.aborted||controller.view().epoch!==epoch||mock.launchId!==launch)return
  if(status==='ready')return mock.continue(signal)
  back()
 }).catch(()=>{if(!signal.aborted&&controller.view().epoch===epoch&&mock.launchId===launch){returnError=true;render()}})
  .finally(()=>{mock.finishReturnIntent(signal);returnPending=false})
}
function fault(){if(quarantined)return;quarantined=true;controller.lifecycle('display-changed');boundary.recover()}
function render(){
 if(quarantined)return;
 const view=controller.view(),token=controller.inputToken(),stage=view.stage,attempt=view.attempt;
 if(stage!==lastStage){cents=0;rating=null;lastStage=stage;tips=false;page=0;detailedNumbers=false;if(stage==='instructions')guidePart=2;}
 const title:Record<string,string>={library:'Money Exchange 2',instructions:'Two rounds, two partners',ready:'Ready?',loading:'Opening local practice',unavailable:'Practice is unavailable',checking:'Checking your saved state',new_partner:'Meet a different partner',test_complete:'Test Complete',history:'Local Money Exchange 2 history',review:'Saved exchange review',report:'Your two-round report'};
 const index=stage.endsWith('_2')?1:0,round=attempt?.rounds[index];
 let heading=title[stage]??`Round ${index+1}`;
 const lines:string[]=[],buttons:ProtectedView['buttons'][number][]=[];
 const add=(label:string,act:(event:MouseEvent)=>void,disabled=false,sameReturnIntent=false,expanded?:boolean)=>buttons.push({label,act:event=>{guideChoiceEpoch++;if(!sameReturnIntent){controller.mockContext?.retireReturnIntent();returnError=false}act(event)},disabled,expanded});
 const admit=(kind:string,data={})=>(event:MouseEvent)=>{controller.mockContext?.retireReturnIntent();returnError=false;controller.admit(token,kind,{...data,input:event.detail===0?'keyboard or assistive activation':'pointer activation'})};
 const spec:ProtectedView={stage,title:heading,lines,buttons,onViolation:fault,onNavigate:()=>{guideChoiceEpoch++;controller.mockContext?.retireReturnIntent();controller.lifecycle('pagehide')}};
 if(stage==='loading')lines.push('Checking local storage and play ownership…');
 else if(stage==='unavailable'){
  lines.push(view.error??'Reload before continuing.');add('Reload',()=>window.location.reload());if(!report)add('Delete all Money Exchange 2 data',()=>{if(window.confirm('Delete every Money Exchange 2 result and form-exposure record on this browser?'))void clearDamaged().then(()=>window.location.reload()).catch(()=>window.alert('Deletion was not confirmed. Reload and check again.'))});add(report?'Back to mock':'Practice library',back);
 }else if(stage==='library'&&report){lines.push('Opening the exact saved Money Exchange 2 report…')}
 else if(stage==='library'){
  lines.push('Two untimed rounds, with a different simulated partner in each.','Both people start with $5; one receives an extra $5 and chooses an allocation.','Round 1: Give up to $5. Round 2: Give or Take up to $5, in 50-cent steps. Then rate fairness from 0 to 10.','There is no correct amount or fairness rating. Partner choices are scripted. Results stay in this browser; see Privacy.');
  if(guideFeedback)lines.push(guideFeedback)
  add('Next',event=>{guidePart=2;admit('enter')(event)},view.busy);
  if(view.root&&Object.values(view.root.attempts).some(a=>!view.root!.tombstones[a.id]&&validCompleted(a)))add('Skip guide using a completed saved run',()=>{const choice=guideChoiceEpoch,current=()=>choice===guideChoiceEpoch;void controller.skipGuideWithCompleted(current).then(ok=>{if(!ok&&current()&&controller.view().stage==='library'){guideFeedback='A completed saved run could not be confirmed. Check the rule to continue.';render()}}).catch(()=>{if(current()&&controller.view().stage==='library'){guideFeedback='A completed saved run could not be confirmed. Check the rule to continue.';render()}})},view.busy);
  add('Saved results',admit('history'),view.busy);add('Main menu',back,view.busy);
 }else if(stage==='instructions'){
  if(guidePart===0){lines.push('Each round starts with $5.00 for you and $5.00 for a different simulated partner. One person receives an extra $5.00.','The person who receives the bonus chooses: Give $0.00–$5.00 in round 1; Give or Take up to $5.00 in round 2, in $0.50 steps.','Example: if you have $10.00 and Give $2.00, you keep $8.00 and the partner has $7.00.','After each allocation, choose a fairness rating from 0 (not fair) to 10 (very fair). There is no right fairness answer. Partner choices here are scripted practice choices.');add('See an example',()=>{guidePart=1;render()});}
  if(guidePart===1){lines.push('Example: you receive the bonus, so you have $10.00 and your partner has $5.00. Give $2.00: you keep $8.00, your partner has $7.00.','In round 2, Take $1.50 would instead give you $11.50 and leave the partner $3.50. Each round still totals $15.00.');add('Check understanding',()=>{guidePart=2;render()});}
  if(guidePart===2){lines.push('You have $10.00 after the bonus. Your partner has $5.00. If you Give $2.00, what are the final amounts?');
   spec.comprehension={value:guideAnswer,current:()=>guideAnswer,choices:[{id:'give_correct',label:'You $8.00 · Partner $7.00'},{id:'give_wrong',label:'You $12.00 · Partner $3.00'}],changed:value=>{guideChoiceEpoch++;controller.mockContext?.retireReturnIntent();returnError=false;guideAnswer=value;guideFeedback='';render()}};
   if(guideFeedback)lines.push(guideFeedback);
   add('Check',event=>{if(!guideAnswer)return;if(guideAnswer==='give_correct'){guideFeedback='Correct. Giving moves $2.00 from you to your partner.';admit('ready')(event);return}guideFeedback='Giving subtracts $2.00 from your $10.00 and adds it to your partner’s $5.00. Choose again.';guideAnswer=null;render()},view.busy||!guideAnswer);
   add('Try more examples',()=>{guidePart=1;render()});
   if(guideFeedback.startsWith('Correct'))add('Next',admit('ready'),view.busy)}
 }else if(stage==='ready'){lines.push('We collect completion counts, not your amounts or ratings. See Privacy at traitgame.com/privacy.html.');lines.push('Select Start to begin the first round.','A reload or leaving during play ends this attempt. Saved choices remain reviewable.');add('Start',event=>{const choice=guideChoiceEpoch,current=()=>choice===guideChoiceEpoch;controller.mockContext?.retireReturnIntent();returnError=false;void controller.startWithGuideProof(token,event.detail===0?'keyboard or assistive activation':'pointer activation',current).then(result=>{if(current()&&result==='missing')guideFeedback='The completed run used to skip the guide was deleted. Check the rule to continue.'}).catch(()=>{if(current()){guideFeedback='The completed run used to skip the guide could not be checked. Close and check the rule to continue.';render()}})},view.busy)}
 else if(stage==='checking'){lines.push('Your requested destination is pending. A timeout does not mean the save failed.');}
 else if(view.authorityPending&&['history','report','review'].includes(stage)){heading='Checking saved data';lines.push('Saved amounts are hidden until local authority is confirmed.');if(stage!=='report')add('Back',admit('historyBack'));}
 else if(stage==='history'&&report){lines.push('Checking the exact saved report…')}
 else if(stage==='history'){
  lines.push('Saved on this browser only. Deleting one result retains form familiarity; Delete all also clears that record.');
  const items=Object.values(view.root!.attempts).filter(a=>a.status!=='Armed').reverse();
  if(!items.length)lines.push('No completed or incomplete exchanges are retained.');
  for(const item of items){lines.push(`${item.status} · ${item.formId} · ${item.id} · ${item.rounds.filter(r=>r.terminal).length} confirmed round(s)`);add(`Review ${item.id}`,admit('historyReport',{attemptId:item.id}),view.busy);add(`Delete ${item.id}`,()=>{if(window.confirm('Delete this result and its choices and ratings? Form familiarity and minimal deletion bookkeeping remain.'))controller.admit(token,'deleteAttempt',{attemptId:item.id})},view.busy)}
  add('Delete all Money Exchange 2 data',()=>{if(window.confirm('Delete all Money Exchange 2 results and form familiarity?'))controller.admit(token,'deleteAll')},view.busy);add('Back',admit('historyBack'),view.busy);
 }else if((stage==='report'||stage==='review')&&attempt){
  heading=attempt.status==='Completed'?'Your two-round report':'Incomplete exchange';
  const confirmed=attempt.rounds.filter(r=>r.terminal);const selected=attempt.rounds[Math.min(page,1)];
  lines.push(attempt.status==='Completed'?'Completed and saved in this browser':`Incomplete review: ${confirmed.length} of 2 rounds confirmed.`);
  if(attempt.status==='Completed'){
   const previous=Object.values(view.root?.attempts??{}).filter(other=>other.id!==attempt.id&&!view.root?.tombstones[other.id]&&other.createdAt<attempt.createdAt&&validCompleted(other)&&other.formDigest===attempt.formDigest&&other.context.input===attempt.context.input).sort((a,b)=>b.createdAt-a.createdAt)[0];
   if(!tips)lines.push(...moneyTwoFeedback());
   if(previous)lines.push(previous?`Previous compatible saved run: fairness ratings ${previous.rounds.map(r=>r.fairness).join(' and ')} of 10. This run: ${attempt.rounds.map(r=>r.fairness).join(' and ')} of 10.`:'No comparable earlier run is currently verified.');
  }
  if(detailedNumbers)spec.detailLines=[`${attempt.formId} · ${attempt.ordinal>6?'Familiar form':'First recorded use of this form'} · Scoring v1.0`,`Input: ${String(attempt.context.input)} · Reduced motion: ${attempt.context.reducedMotion?'on':'off'} · Local saved record`];
  if(attempt.endedReason)lines.push(`Ended: ${attempt.endedReason}. No scored continuation after interruption.`);
  if(tips){heading='How the amounts were calculated';lines.push('Each participant starts at $5.00. The bonus adds $5.00 to one person, creating a $15.00 total. Giving moves money from the bonus recipient; taking moves money toward them.','Your fairness answer describes your reaction to this particular allocation. It is not a test of morality, employer fit or personality.');add('Back Report',()=>reviewNavigate(()=>{tips=false}));}
  else if(attempt.status==='Completed'||selected.terminal){lines.push(`Round ${page+1} · ${selected.partner}`,`You: ${money(selected.decision!.candidateFinalCents)}. ${selected.partner}: ${money(selected.decision!.partnerFinalCents)}.`,`You rated this allocation ${selected.fairness} / 10 for fairness.`);
   const arithmetic=[`Both started with $5.00. ${selected.bonusRecipient==='candidate'?'You':selected.partner} received the $5.00 bonus.`,`${selected.decision!.actor==='candidate'?'You':selected.partner}: ${action(selected.decision!.signedGiveCents)}.`,`${selected.bonusRecipient==='candidate'?'You':selected.partner}: $10.00 ${selected.decision!.signedGiveCents<0?'+':'−'} ${money(Math.abs(selected.decision!.signedGiveCents))} = ${money(1000-selected.decision!.signedGiveCents)}. Other participant: $5.00 ${selected.decision!.signedGiveCents<0?'−':'+'} ${money(Math.abs(selected.decision!.signedGiveCents))} = ${money(500+selected.decision!.signedGiveCents)}.`];
   if(attempt.status==='Completed'){if(detailedNumbers)spec.detailLines=[...(spec.detailLines??[]),...arithmetic]}else lines.push(...arithmetic);
   spec.pairFirst=true;spec.cards=[{label:'Transfer',value:action(selected.decision!.signedGiveCents),detail:`${selected.decision!.actor==='candidate'?'You':selected.partner} made this choice.`},{label:'Fairness',value:`${selected.fairness} / 10`,detail:'Your submitted rating of this allocation.'}];
   spec.pair=pairArt(selected.decision!.candidateFinalCents,selected.decision!.partnerFinalCents,selected.partner,compact(),{cents:selected.decision!.signedGiveCents,actor:selected.decision!.actor});
   if(selected.bonusRecipient==='partner')lines.push('This partner decision is fixed original practice data.');
  }else{lines.push(`${confirmed.length} round(s) completed. No complete two-round report.`);for(const [i,r] of attempt.rounds.entries()){if(r.decision)lines.push(`Round ${i+1} committed ${action(r.decision.signedGiveCents)}: you ${money(r.decision.candidateFinalCents)}, ${r.partner} ${money(r.decision.partnerFinalCents)}. ${r.exposure==='render_receipt'?'The allocation display was confirmed.':'The result may have been revealed; no confirmed render receipt.'} ${r.fairness===null?'Fairness not submitted.':`Fairness ${r.fairness}/10.`}`)}}
  if(attempt.status==='Incomplete'&&selected.terminal&&!tips){for(const [i,r] of attempt.rounds.entries()){if(!r.terminal&&r.decision)lines.push(`Round ${i+1} committed ${action(r.decision.signedGiveCents)}: you ${money(r.decision.candidateFinalCents)}, ${r.partner} ${money(r.decision.partnerFinalCents)}. ${r.exposure==='render_receipt'?'The allocation display was confirmed.':'The result may have been revealed; no confirmed render receipt.'} Fairness not submitted.`)}}
   if(attempt.status==='Completed'&&!tips){add('Detailed numbers',()=>reviewNavigate(()=>{detailedNumbers=!detailedNumbers}),view.busy,false,detailedNumbers);add('Previous page',()=>reviewNavigate(()=>{page=0}),page===0);add('Next page',()=>reviewNavigate(()=>{page=1}),page===1);add('Page 1',()=>reviewNavigate(()=>{page=0}));add('Page 2',()=>reviewNavigate(()=>{page=1}));add('How the amounts were calculated',()=>reviewNavigate(()=>{tips=true}));if(report)add('Back to mock',back);else if(controller.mockContext){add('Continue full mock',()=>returnFromOwned(stage),view.busy,true);add('Try Again',admit('tryAgain',{attemptId:attempt.id}),view.busy)}else add('Try Again',admit(stage==='review'?'reviewReplay':'tryAgain',{attemptId:attempt.id}),view.busy)}
  lines.push('These original forms are not calibrated or equivalent to an employer assessment.');
  if(report&&attempt.status!=='Completed')add('Back to mock',back)
  if(stage==='review'&&!report)add('Back to history',admit('historyBack',{destination:'history'}),view.busy);
 }else if(stage==='test_complete'){lines.push('Both rounds and fairness ratings have been saved locally.');add('Next',admit('report'),view.busy)}
 else if(stage==='new_partner'){lines.push('The second round starts fresh with a different partner. You may Give or Take in this round.');add('Next',admit('step'),view.busy)}
 else if(round&&attempt){
  const number=index+1,form=forms.find(f=>f.id===attempt.formId)!;
  let self=500,other:number|null=500;
  if(stage.startsWith('award_')){heading=`Round ${number}: your starting $5.00`;other=null;lines.push('You receive $5.00 to begin this round.');}
  if(stage.startsWith('connecting_')){heading='Connecting';other=0;lines.push('Preparing your simulated partner… The temporary $0.00 is a connection placeholder.');}
  if(stage.startsWith('connected_')){heading='Connected';other=0;lines.push(`${round.partner} is ready. The temporary $0.00 is a connection placeholder.`);}
  if(stage.startsWith('partner_rules_')){heading=`Round ${number}: ${round.partner}`;lines.push(`You and ${round.partner} each start with $5.00. One person receives an extra $5.00.`,index===0?'The bonus recipient may give up to $5.00.':'The bonus recipient may give or take up to $5.00.');}
  if(/^(bonus|choice|partner_choice|result|fairness)_/.test(stage)){self=round.bonusRecipient==='candidate'?1000:500;other=1500-self;}
  if(stage.startsWith('bonus_')){heading='The extra $5.00';lines.push(`${round.bonusRecipient==='candidate'?'You':round.partner} received the bonus.`);}
  if(stage.startsWith('choice_')){heading=index===0?'How much will you give?':'Will you give or take?';lines.push(index===0?'Give $0.00 to $5.00 in $0.50 steps.':'Take $5.00 ← Give $0.00 → Give $5.00, in $0.50 steps.');spec.amount={label:index===0?'Give amount, $0 to $5':'Give or Take amount, Take $5 to Give $5',display:action(cents),min:index===0?0:-500,value:String(cents),current:()=>String(cents),changed:value=>{cents=Number(value);render()}};add('Confirm',admit('step',{cents}),view.busy);}
  else if(stage.startsWith('partner_choice_')){heading=`${round.partner}'s choice`;lines.push(`${action(form.rounds[index].partnerSignedGiveCents!)}. This is a fixed original computer decision.`);add('Next',admit('step',{cents:form.rounds[index].partnerSignedGiveCents}),view.busy);}
  else if(stage.startsWith('result_')){heading='Your allocation';self=round.decision!.candidateFinalCents;other=round.decision!.partnerFinalCents;spec.announceResult=round.exposure==='possibly_revealed';spec.result=pairArt(self,other,round.partner,compact(),{cents:round.decision!.signedGiveCents,actor:round.decision!.actor});add('Next',admit('step'),view.busy||round.exposure!=='render_receipt');}
  else if(stage.startsWith('fairness_')){heading='How fair was this allocation?';self=round.decision!.candidateFinalCents;other=round.decision!.partnerFinalCents;lines.push('0 = not fair · 10 = very fair. Choose one answer, then Next.');spec.rating={value:rating,current:()=>rating,changed:value=>{rating=value;render()}};add('Next',admit(index===0?'step':'terminal',{rating:rating!}),view.busy||rating===null);}
  else add('Next',admit('step'),view.busy||stage.startsWith('connecting_'));
  if(!spec.result)spec.pair=pairArt(self,other,round.partner,compact(),undefined,stage.startsWith('choice_'));
 }
 if(view.busy&&stage!=='checking')lines.push('Checking local save…');
 if(view.error){lines.push(view.error);add('Retry',()=>controller.retry(token));}
 if(returnError){lines.push('Return could not be confirmed. The saved status is still unconfirmed.');add('Leave with result unconfirmed',back)}
 if(!report&&!['loading','unavailable','library','history','review'].includes(stage)){
  if(!['instructions','test_complete','report','checking'].includes(stage))add('Restart',admit('Restart'));
  if(!view.pendingExit||view.pendingExit==='Restart')add('Close',admit('Close'));
 }
 if(mockHint||report){
 buttons.splice(0,buttons.length,...mockMenuButtons(buttons,{label:'Return to mock',act:()=>returnFromOwned(stage)}))}
 spec.title=heading;
 try{boundary.showProtected(spec)}catch{fault();return}
 if(renderedEpoch!==view.epoch){renderedEpoch=view.epoch;
  if(stage.startsWith('connecting_')){const finish=()=>{if(controller.view().epoch!==view.epoch)return;if(!boundary.checkProtected(stage)){fault();return}controller.completePrepared(view.epoch,'animation')};if(matchMedia('(prefers-reduced-motion: reduce)').matches)requestAnimationFrame(()=>requestAnimationFrame(finish));else setTimeout(finish,600);}
  if(spec.result&&round?.exposure==='possibly_revealed'){const art=spec.result;void boundary.prepareResult().then(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())))).then(()=>{if(controller.view().epoch!==view.epoch)return;if(document.visibilityState!=='visible'||!boundary.resultReady(art)){fault();return}controller.completePrepared(view.epoch,'receipt')}).catch(()=>{if(controller.view().epoch===view.epoch)fault()});}
 }
}
function reviewNavigate(change:()=>void){controller.mockContext?.retireReturnIntent();returnError=false;void controller.reviewPublication(controller.inputToken(),()=>{change();render()})}
function deniedMockLink(){quarantined=true;boundary.showProtected({stage:'unavailable',title:'Mock link unavailable',lines:['Return to mock and open the current game again.'],buttons:[{label:'Return to mock',act:()=>window.location.assign(mockHint?mockReturnUrl(mockHint.mockId):report?mockReturnUrl(report.mockId):'/mock')}],onViolation:()=>undefined})}
if(routeInvalid)deniedMockLink()
else{controller.subscribe(render);render();void Promise.all([mockHint?claimDedicated('money_2',mockHint):Promise.resolve(null),report?verifiedReportTarget(report):Promise.resolve(null)])
 .then(async([claim,target])=>{if(target&&target.game!=='money_2')throw Error('Wrong saved report game');if(claim)controller.setMock(claim.context);if(target)controller.setReportTarget(target);await controller.open();if(target){await controller.openExactReport(target.attemptId);const stop=monitorReportTarget(target,()=>controller.withdrawMockReport());window.addEventListener('pagehide',stop,{once:true})}})
 .catch(error=>{if(mockHint||report)deniedMockLink();else window.alert(`Money Exchange 2 route unavailable: ${String(error)}`)})}
setInterval(()=>{if(quarantined)return;if(!boundary.checkProtected()){fault();return}if(controller.mockContext&&!['library','instructions','ready','history','report','review','test_complete'].includes(controller.view().stage))return;void controller.refresh()},750);
window.addEventListener('pagehide',()=>{controller.mockContext?.retireReturnIntent();controller.lifecycle('pagehide')});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState!=='visible')controller.lifecycle('hidden');else void controller.refresh()});
window.addEventListener('blur',()=>controller.lifecycle('blur'));
