import { ControlPrompt, keyboardButtonLabel } from './ControlPrompt'
import { QuickRules } from '../onboarding/QuickRules'
import { ReportSummary } from '../reports/Summary'
import { choiceFeedback } from '../reports/feedback'
import { AssessmentUsageNotice } from '../assessment-usage/Notice'
import { confirmedLengthsMetrics } from '../assessment-usage/boundaries'
import { Attempt } from '../assessment-usage/client'
import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { Shell } from '../core/Shell'
import { LegacyHistory } from './legacy'
import { ReactGameActionBoundary } from '../mock/ReactGameActionBoundary'
import type { LegacyFamily } from './legacy-access'
import { MouthStore } from './storage'
import type { ArmedAttempt, PersistedSnapshot, StartRequest } from './storage'
import { MouthBrowserRun, faceSvg } from './browser'
import type { RunUpdate } from './browser'
import { MOUTH_PRESENTATION_VERSION, safeCode } from './engine'
import type { InputProfile, PointerSource, State } from './engine'
import { reconcileHeadless } from './report'
import type { Cohort, HeadlessReview } from './report'
import { MouthReportPublication } from './report-publication'
import type { MouthRecovery } from './recovery'
import type { MouthAuthorityHandle } from './authority'
import type { MouthDisplayContext } from './display-context'
import { captureMouthDisplayContext } from './display-context'
import type { ExclusiveMouthDocument } from './exclusive-document'
import type { MockJourneyContext } from '../mock/journey-context'
import { withSelectedMockReportPublication } from '../mock/report-route'
import type { ReportTarget as MockReportTarget } from '../mock/report-route'
import { assertMouthMockReport } from './mock-bridge'
import { MOCK_VERSION } from '../mock/contract'
import { readInputReceipt, storeNativeKeyProof } from '../core/inputCheckReceipt'
import { exactSupportedContent } from './exact-content'
import './mouth.css'

type ReportTarget={handle:MouthAuthorityHandle;state:State;recovery:MouthRecovery|null;viewId:string;source:'live'|'history';activity:boolean;activityPending?:Promise<void>;observedWallMs?:number;activitySnapshot?:PersistedSnapshot|null;reviewMemo?:Readonly<{state:State;review:HeadlessReview}>}
type Step='guide'|'examples'|'quiz'|'setup'|'ready'|'play'|'report'|'history'|'legacy'
function freezeReviewValue<T>(value:T):T {
 if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freezeReviewValue);Object.freeze(value)}
 return value
}
const defaultProfile:InputProfile={kind:'keyboard',variant:'standard',deviceClass:'browser-observed',leftCode:'ArrowLeft',rightCode:'ArrowRight',alternative:false,contrast:'dark_on_light',magnification:'none',reducedMotion:false,presentationVersion:MOUTH_PRESENTATION_VERSION}
function Counts({label,cell}:{label:string;cell:Cohort}){
 const pct=(n:number)=>Math.round(n*1000/cell.denominator)/10
 return <tr><th scope="row">{label}</th><td>{cell.correct}/{cell.denominator} ({pct(cell.correct)}%)</td><td>{cell.wrong}/{cell.denominator} ({pct(cell.wrong)}%)</td><td>{cell.omitted}/{cell.denominator} ({pct(cell.omitted)}%)</td><td>{cell.time.medianDisplayMs===null?'Not enough clean responses for a time summary':`${cell.time.medianDisplayMs} ms median · ${cell.time.iqrDisplayMs===null?'Not enough clean responses for variability':`${cell.time.iqrDisplayMs} ms IQR`}`} · {cell.time.cleanCount} clean</td></tr>
}
function Report({review,save,context,ordinal,comparison}:{review:HeadlessReview;save:string;context:MouthDisplayContext;ordinal:number;comparison:string}){
 const m=review.metrics,t=m?.responseTendency
 return <div data-mouth-report-numbers="true"><p><strong>{review.status==='complete_headless'?'Valid attempt':review.status==='invalid_headless'?'Invalid attempt':'Incomplete attempt, review-only, later exposure unknown'}</strong> · {save}</p>
 {review.status==='complete_headless'&&m&&<ReportSummary feedback={choiceFeedback('lengths',m.overall)}/>}
 {review.invalidReason&&<p>Stopped because: {review.invalidReason.replaceAll('_',' ')}.</p>}
 <details><summary>Detailed numbers</summary>
 <p>{comparison}</p>
 <p>{review.presented} presented · {review.closed} closed · {review.unresolvedPresented} unresolved presented · {review.unpresented} unpresented of 90.</p>
 <p>{review.formId} · {review.variant==='standard'?'Standard mouth':'Visual accommodation mouth'} · {review.specificationVersion} · {review.formVersion} · {review.scoringVersion} · {review.reportVersion}{' · '+review.profile.presentationVersion}{ordinal>6?' · Repeated form in V1.3':''}</p>
 <p>{review.profile.kind==='keyboard'?`Keyboard: ${review.profile.leftCode} / ${review.profile.rightCode}${review.profile.leftCode!=='ArrowLeft'||review.profile.rightCode!=='ArrowRight'?' · Modified keys':''}`:`${review.profile.pointerSource} pointer`}{review.profile.alternative?' · Alternative input':''} · {review.profile.contrast.replaceAll('_',' ')} · Magnification: {review.profile.magnification.replaceAll('_',' ')}</p>
 <p>{context.browserFamily} browser observed · Layout {context.layoutWidthCssPx} × {context.layoutHeightCssPx} CSS pixels · Visual viewport {context.visualWidthCssPx} × {context.visualHeightCssPx} · Reduced motion declaration: {review.profile.reducedMotion?'yes':'no'}.</p>
 {m&&<><div className="mouth-table"><table><caption>Counts and clean correct response times in this run</caption><thead><tr><th>Cell</th><th>Correct</th><th>Wrong</th><th>Omitted</th><th>Time summary</th></tr></thead><tbody><Counts label="Overall" cell={m.overall}/><Counts label="Short mouth" cell={m.byCategory.short}/><Counts label="Long mouth" cell={m.byCategory.long}/>{m.byBlock.map((cell,i)=><Counts key={i} label={`Set ${i+1}`} cell={cell}/>)}</tbody></table></div>
 <p>{t?.responded?`Selected Short ${t.left}/${t.responded} (${t.leftPercent}%) · Long ${t.right}/${t.responded} (${t.rightPercent}%) among responded trials.`:'No response-side distribution'}</p>
 <p>{review.observation}</p></>}
 <h2>Simulated rewards</h2><p>{review.rewardBreakdown.overall.count} rewards received: {review.rewardBreakdown.overall.tenCentCount} at 10¢ and {review.rewardBreakdown.overall.fiftyCentCount} at 50¢. Total: ${(review.bankedCents/100).toFixed(2)}.</p><p>Short: {review.rewardBreakdown.byCategory.short.count} rewards, ${(review.rewardBreakdown.byCategory.short.bankedCents/100).toFixed(2)} · Long: {review.rewardBreakdown.byCategory.long.count} rewards, ${(review.rewardBreakdown.byCategory.long.bankedCents/100).toFixed(2)}.</p>
 <p>{review.rewardBreakdown.bySet.map((cell,i)=>`Set ${i+1}: ${cell.count} rewards, $${(cell.bankedCents/100).toFixed(2)}`).join(' · ')}</p>
 {m&&<><h2>Correct on the next trial after a reward</h2><p>Short: {m.postReward.byCategory.short.correct} of 46 trials. Long: {m.postReward.byCategory.long.correct} of 44 trials.</p><p>These count correct answers immediately following a rewarded trial, shown out of all trials in each category. They describe this practice run; they are not a reward-learning score.</p></>}
 {!m&&<p>Review the recorded prefix. Accuracy, time summaries and the post-reward summary are unavailable for this attempt.</p>}
 </details></div>
}
export function MouthV13Journey({onLibrary,exclusive,mock,reportTarget}:{onLibrary:()=>void;exclusive?:ExclusiveMouthDocument;mock?:MockJourneyContext;reportTarget?:MockReportTarget}){
  const usage = useRef(new Attempt('lengths'))
  useEffect(() => { const current=usage.current; return () => current.cancel() }, [])
 const [legacyFamily,setLegacyFamily]=useState<LegacyFamily>('v12')
 const [step,setStep]=useState<Step>('guide'),[store,setStore]=useState<MouthStore|null>(null),[error,setError]=useState(''),[profile,setProfile]=useState<InputProfile>(mock?.preferences.controls==='alternative'?{kind:'pointer',pointerSource:'mouse',variant:mock.preferences.lengthsVariant,deviceClass:'browser-observed',alternative:true,contrast:'dark_on_light',magnification:'none',reducedMotion:mock.preferences.reducedMotion,presentationVersion:MOUTH_PRESENTATION_VERSION}:{...defaultProfile,variant:mock?.preferences.lengthsVariant??'standard',reducedMotion:mock?.preferences.reducedMotion??false})
 const [quiz,setQuiz]=useState({mapping:'',silent:''}),[checked,setChecked]=useState<readonly string[]>([]),[held,setHeld]=useState(''),[spoken,setSpoken]=useState(false)
 const [canSkip,setCanSkip]=useState(false)
 const skipSource=useRef<{sessionId:string;profile:string}|null>(null)
 const skipChecking=useRef(false)
 const [layout,setLayout]=useState(false),[update,setUpdate]=useState<RunUpdate|null>(null),[history,setHistory]=useState<readonly ArmedAttempt[]>([])
 const [report,setReport]=useState<{review:HeadlessReview;save:string;context:MouthDisplayContext;ordinal:number;comparison:string}|null>(null),[factual,setFactual]=useState<HeadlessReview|null>(null),[confirmDelete,setConfirmDelete]=useState(false),[viewStatus,setViewStatus]=useState('')
 const heading=useRef<HTMLHeadingElement>(null),host=useRef<HTMLDivElement>(null),previewMount=useRef<HTMLDivElement>(null),run=useRef<MouthBrowserRun|null>(null),navigation=useRef(0),gate=useRef(new MouthReportPublication())
 const returnPending=useRef(false)
 const target=useRef<ReportTarget|null>(null)
 const openedReportTarget=useRef<string|null>(null)
 useEffect(()=>{if(!store||!reportTarget||openedReportTarget.current===reportTarget.attemptId)return;openedReportTarget.current=reportTarget.attemptId;
  void store.loadArmed(reportTarget.attemptId).then(attempt=>{if(!attempt)throw Error('Exact Lengths report unavailable');return openHistory(attempt)}).catch(error=>setError(String(error)))
 },[store,reportTarget])
 const pendingRequest=useRef<StartRequest|null>(null)
 const setupHeld=useRef(new Set<string>()),setupPointer=useRef<number|null>(null)
 const observedDown=useRef(new Map<string,KeyboardEvent>())
 const changeStep=(next:Step)=>{mock?.retireReturnIntent();navigation.current++;gate.current.cancel();target.current=null;setReport(null);setFactual(null);setError('');if(next!=='ready')exclusive?.showReady(false);setStep(next)}
 useEffect(()=>{
  if(step!=='guide'||!store){setCanSkip(false);return}
  let active=true,pending=false
  const check=()=>{if(pending||document.hidden||!document.hasFocus())return;pending=true;void store.listAttempts().then(attempts=>{if(active)setCanSkip(attempts.some(a=>a.snapshot?.kind==='terminal'&&a.snapshot.review.status==='complete_headless'&&JSON.stringify(a.profile)===JSON.stringify(profile)&&a.profile.presentationVersion===MOUTH_PRESENTATION_VERSION))}).catch(()=>{if(active)setCanSkip(false)}).finally(()=>{pending=false})}
  check();const timer=setInterval(check,1000)
  return()=>{active=false;clearInterval(timer)}
 },[step,store,profile])
 async function skipGuide(){if(!store)return;const nav=navigation.current;try{const attempts=await store.listAttempts();if(nav!==navigation.current)return
  const source=attempts.find(a=>a.snapshot?.kind==='terminal'&&a.snapshot.review.status==='complete_headless'&&JSON.stringify(a.profile)===JSON.stringify(profile)&&a.profile.presentationVersion===MOUTH_PRESENTATION_VERSION)
  if(source){skipSource.current={sessionId:source.sessionId,profile:JSON.stringify(profile)};changeStep('ready')}else setCanSkip(false)
 }catch{setCanSkip(false);setError('A completed saved run could not be confirmed. Check the rule to continue.')}}
 useEffect(()=>{const retire=()=>{mock?.retireReturnIntent();if(reportTarget){navigation.current++;gate.current.cancel();setReport(null)}};window.addEventListener('pagehide',retire);return()=>window.removeEventListener('pagehide',retire)},[reportTarget,mock])
 const disposeLatest=useEffectEvent(()=>{navigation.current++;mock?.retireReturnIntent();gate.current.cancel();run.current?.dispose()})
 useEffect(()=>{void (mock||reportTarget?MouthStore.openForMock(undefined,!reportTarget):MouthStore.open()).then(setStore).catch(e=>setError(`Current Lengths history is unavailable: ${e.message}. Timed play needs working local storage.`));return()=>disposeLatest()},[])
 useLayoutEffect(()=>{if(step!=='play')heading.current?.focus()},[step])
 useEffect(()=>{
  if(step!=='ready')return
  const heldControls=setupHeld.current
  const resetCheck=()=>{heldControls.clear();setupPointer.current=null}
  const down=(e:KeyboardEvent)=>{
   if(profile.kind!=='keyboard'||![profile.leftCode,profile.rightCode].includes(e.code))return
   // During setup, remapped response keys must still activate native untimed
   // buttons and remain typeable in the key-code fields.
   if(e.target instanceof Element&&e.target.closest('button,input,select,textarea,a,[role="button"],[role="radio"],[role="checkbox"]'))return
   e.preventDefault()
   if(!e.repeat&&!e.altKey&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&!e.isComposing&&!setupHeld.current.has(e.code)){setupHeld.current.add(e.code);observedDown.current.set(e.code,e);setHeld(e.code)}
  }
  const up=(e:KeyboardEvent)=>{if(!setupHeld.current.delete(e.code))return;const down=observedDown.current.get(e.code);observedDown.current.delete(e.code);setHeld('');setChecked(old=>[...new Set([...old,e.code])]);if(down&&!profile.alternative&&profile.variant==='standard')void storeNativeKeyProof('lengths',down,e,'standard').catch(()=>{})}
  const release=(e:PointerEvent)=>{if(setupPointer.current===e.pointerId){setupPointer.current=null;setHeld('');setChecked(old=>[...new Set([...old,'pointer'])])}}
  window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('pointerup',release);window.addEventListener('pointercancel',release)
  return()=>{window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('pointerup',release);window.removeEventListener('pointercancel',release);resetCheck()}
 },[step,profile])
 useEffect(()=>{if(step!=='ready'||profile.kind!=='keyboard'||profile.variant!=='standard'||profile.alternative)return;let active=true;const nav=navigation.current
  void readInputReceipt([profile.leftCode,profile.rightCode],'standard').then(receipt=>{if(active&&nav===navigation.current&&receipt)setChecked([profile.leftCode,profile.rightCode])}).catch(()=>{})
  return()=>{active=false}
 },[step,profile])
 useEffect(()=>{
  const activeHost=exclusive?.presentationHost??host.current
  if(step!=='ready'||!store||!activeHost)return
  const previous=run.current;previous?.dispose()
  exclusive?.showReady(true,previewMount.current)
  const runner=new MouthBrowserRun(store,activeHost,value=>{
   setUpdate(value)
   if(value.state?.phase==='break'||value.state?.phase==='invalid'||value.state?.phase==='completed')exclusive?.leave()
   if(value.state?.phase==='invalid'||value.state?.phase==='completed'){
    const handle=value.recovery!.authority
    if(!target.current){target.current={handle,state:value.state,recovery:value.recovery,viewId:crypto.randomUUID(),source:'live',activity:false};setStep('report')}
   }
  },exclusive??null,mock?leave:null);runner.inheritControls(previous);runner.prepare(profile);run.current=runner
  const checkLayout=()=>setLayout(runner.layoutReady())
  const frame=requestAnimationFrame(checkLayout)
  window.addEventListener('resize',checkLayout)
  window.visualViewport?.addEventListener('resize',checkLayout)
  return()=>{cancelAnimationFrame(frame);window.removeEventListener('resize',checkLayout);window.visualViewport?.removeEventListener('resize',checkLayout)}
 },[step,store,profile,exclusive])
 async function publishReport(){
  if(!store||!target.current)return
  const selected=target.current,nav=navigation.current
  let resolved=false
  // Two frames encompass one complete rendered cycle. Pending authority hides all numbers.
  requestAnimationFrame(()=>requestAnimationFrame(()=>{if(!resolved&&nav===navigation.current&&target.current===selected)flushSync(()=>setReport(null))}))
  const publish=(permit=()=>{})=>gate.current.run(selected.viewId,async signal=>{
   const root=await store.read(signal),retained=root.attempts[selected.handle.arm.sessionId]
   if(retained&&reportTarget)assertMouthMockReport(retained,reportTarget,store.installationId)
   selected.handle.assertCurrent();if(!retained||!selected.handle.matches(retained))throw Error('Attempt no longer available')
   const status=selected.handle.resultStatus()
   if(status.kind==='retired'||status.kind==='blocked'||status.kind==='unknown')throw Error('Current report authority unavailable')
   let memo=selected.reviewMemo
   if(!memo||exactSupportedContent(selected.state,memo.state)!=='equal'){
    const review=reconcileHeadless(selected.state)
    const state=structuredClone(selected.state)
    memo=freezeReviewValue({state:freezeReviewValue(state),review:freezeReviewValue(review)})
    selected.reviewMemo=memo
   }
   const review=memo.review
   const previous=review.status==='complete_headless'?Object.values(root.attempts).filter(a=>a.sessionId!==retained.sessionId&&a.createdAtWallMs<retained.createdAtWallMs&&a.snapshot?.kind==='terminal'&&a.snapshot.review.status==='complete_headless'&&a.variant===retained.variant&&JSON.stringify(a.profile)===JSON.stringify(retained.profile)).sort((a,b)=>b.createdAtWallMs-a.createdAtWallMs)[0]:null
   const comparison=previous?.snapshot?.review.metrics?`Previous compatible saved run: ${previous.snapshot.review.metrics.overall.correct} of 90 choices matched; this run: ${review.metrics?.overall.correct??0} of 90.`:'No comparable earlier run is currently verified.'
   const saved=status.kind==='confirmed'||selected.handle.armedOnly;return {review,comparison,save:saved?(selected.handle.armedOnly?'Incomplete review saved in this browser':'Saved in this browser'):selected.recovery?.pending()?'Save pending':'Save uncertain — retained in this tab',context:selected.handle.arm.armDisplayContext,ordinal:selected.handle.arm.ordinal}
  },async(value,signal)=>{
   if(nav!==navigation.current||target.current!==selected)return
   signal.throwIfAborted();permit()
   flushSync(()=>setReport(value));if(!(exclusive?.uiMount??document).querySelector('[data-mouth-report-numbers]'))throw Error('Report DOM was not published')
   if(selected.source==='live'){
    const authority=selected.handle.resultStatus(),metrics=confirmedLengthsMetrics(authority,selected.handle.armedOnly)
    if(metrics)usage.current.finish(selected.handle.arm.sessionId,'completed',()=>metrics)
    else if(authority.kind==='confirmed' && authority.snapshot.kind==='terminal' && authority.snapshot.review.status==='invalid_headless')usage.current.finish(selected.handle.arm.sessionId,'invalid')
   }
   resolved=true;setFactual(null);setError('')
   const status=selected.handle.resultStatus()
   if(status.kind==='confirmed'||selected.handle.armedOnly&&status.kind==='recoverable'){
    if(selected.activitySnapshot===undefined){selected.activitySnapshot=status.kind==='confirmed'?status.snapshot:null;selected.observedWallMs=Date.now()}
    await recordView(selected,signal)
   }
  },()=>{if(nav===navigation.current&&target.current===selected){flushSync(()=>{setReport(null);setFactual(selected.handle.status().kind==='retired'?reconcileHeadless(selected.state):null)});setError('Current local authority could not be confirmed. Numbers are hidden; retry remains available.')}} ,true)
  const published=reportTarget?await withSelectedMockReportPublication(reportTarget,publish):await publish()
  resolved=true
  if(!published||target.current!==selected||nav!==navigation.current)return
 }
 async function recordView(selected:ReportTarget,signal?:AbortSignal){
  if(!store||selected.activitySnapshot===undefined||selected.activity)return
  if(selected.activityPending)return selected.activityPending
  const nav=navigation.current
  const work=store.appendReportView(selected.handle.arm.sessionId,selected.activitySnapshot,selected.viewId,selected.source,selected.observedWallMs!,selected.handle,signal).then(()=>{
   selected.activity=true
   const status=selected.handle.status()
   if(target.current===selected&&nav===navigation.current&&(status.kind!=='retired'||status.evidence==='incompatible_result'))setViewStatus('Report opening recorded locally.')
  }).catch(error=>{
   selected.activity=false
   if(target.current===selected&&nav===navigation.current)setViewStatus('Report opening not confirmed. You can retry recording it.')
   throw error
  }).finally(()=>{if(selected.activityPending===work)selected.activityPending=undefined})
  selected.activityPending=work
  await work
 }
 async function retryView(){
  const selected=target.current;if(!selected)return
  // Publication stays separately authority gated, even when a historical event is reconciled.
  await publishReport()
  if(target.current===selected&&selected.handle.status().kind==='retired')await recordView(selected).catch(()=>{})
 }
 const pollReport=useEffectEvent(()=>{void publishReport()})
 useEffect(()=>{
  const publication=gate.current
  if(step!=='report')return
  pollReport()
  const timer=window.setInterval(()=>pollReport(),250)
  const off=store?.subscribeDeletion(()=>pollReport())
  return()=>{clearInterval(timer);off?.();publication.cancel()}
 },[step,store])
 async function publishHistory(){
  if(!store)return
  const nav=navigation.current;let resolved=false
  requestAnimationFrame(()=>requestAnimationFrame(()=>{if(!resolved&&nav===navigation.current)flushSync(()=>setHistory([]))}))
  await gate.current.run('history',signal=>store.listAttempts(signal),attempts=>{
   if(nav!==navigation.current)return
   flushSync(()=>setHistory(attempts));resolved=true
  },()=>{if(nav===navigation.current){setHistory([]);setError('History authority unavailable. Try again.')}},true)
  resolved=true
 }
 const pollHistory=useEffectEvent(()=>{void publishHistory()})
 useEffect(()=>{
  const publication=gate.current
  if(step!=='history')return
  pollHistory();const timer=window.setInterval(()=>pollHistory(),250)
  const off=store?.subscribeDeletion(()=>pollHistory())
  return()=>{clearInterval(timer);off?.();publication.cancel()}
 },[step,store])
 async function loadHistory(){
  run.current?.dispose();run.current=null;exclusive?.leave();changeStep('history');setHistory([])
  if(!store)return;const nav=navigation.current
  await gate.current.run('history',signal=>store.listAttempts(signal),attempts=>{
   if(nav!==navigation.current)return;flushSync(()=>setHistory(attempts))
  },()=>{if(nav===navigation.current){setHistory([]);setError('History authority unavailable. Try again.')}})
 }
 async function openHistory(attempt:ArmedAttempt){
  mock?.retireReturnIntent()
  if(!store)return
  changeStep('report');const handle=store.authority.published(attempt),state=attempt.snapshot?.state??attempt.state
  target.current={handle,state,recovery:null,viewId:crypto.randomUUID(),source:'history',activity:false};setViewStatus('');void publishReport()
 }
 async function remove(id:string){
  mock?.retireReturnIntent()
  if(!store)return
  try{await store.deleteAttempt(id);await loadHistory()}catch(e){setError(`Deletion unconfirmed: ${String(e)}`)}
 }
 async function deleteAll(){
  mock?.retireReturnIntent()
  run.current?.dispose();run.current=null;exclusive?.leave();gate.current.cancel();setReport(null);setHistory([])
  try{const deletionStore=store??await MouthStore.openForDeletion();const next=await deletionStore.deleteAll();setStore(next);setConfirmDelete(false);changeStep('history')}catch(e){setError(`V1.3 deletion unconfirmed: ${String(e)}`)}
 }
 async function replay(){mock?.retireReturnIntent();pendingRequest.current=null;run.current?.dispose();run.current=null;exclusive?.leave();
  if(mock){try{await mock.retry()}catch(e){setError(`The old attempt needs checking before retry: ${String(e)}`);return}}
  setUpdate(null);setChecked([]);setViewStatus('');changeStep('guide')}
 function leave(){
  usage.current.cancel()
  if(returnPending.current)return
  navigation.current++
  const signal=mock?.beginReturnIntent()
  returnPending.current=true
  const launch=mock?.launchId,epoch=navigation.current
  const returnWithoutAccept=()=>{navigation.current++;gate.current.cancel();run.current?.dispose();exclusive?.leave();mock?.leave();onLibrary()}
  if(mock&&(step==='report'||step==='history'||step==='legacy'))void mock.terminal().then(status=>{
    if(signal?.aborted||navigation.current!==epoch||mock.launchId!==launch)return
    if(status==='ready')return mock.continue(signal)
    returnWithoutAccept()
   }).catch(error=>{if(!signal?.aborted&&navigation.current===epoch&&mock.launchId===launch)setError(`Return could not be confirmed: ${String(error)}. Try Return again or leave with the result unconfirmed.`)})
   .finally(()=>{if(signal)mock.finishReturnIntent(signal);returnPending.current=false})
  else {returnWithoutAccept();if(signal)mock?.finishReturnIntent(signal);returnPending.current=false}
 }
 function setting(next:InputProfile){navigation.current++;setProfile(next);setChecked([]);setHeld('')}
 async function start(){
  const runner=run.current,activeHost=exclusive?.presentationHost??host.current;if(!runner||!store||!activeHost)return
  if(skipChecking.current)return
  if(skipSource.current){const source=skipSource.current,nav=navigation.current;skipChecking.current=true
   try{const attempts=await store.listAttempts();if(nav!==navigation.current)return
    if(source.profile!==JSON.stringify(profile)||!attempts.some(a=>a.sessionId===source.sessionId&&a.snapshot?.kind==='terminal'&&a.snapshot.review.status==='complete_headless'&&JSON.stringify(a.profile)===source.profile&&a.profile.presentationVersion===MOUTH_PRESENTATION_VERSION)){
     skipSource.current=null;setCanSkip(false);setQuiz({mapping:'',silent:''});changeStep('quiz');setError('The completed run used to skip the guide was deleted or changed. Check the rule to continue.');return
    }
    skipSource.current=null
   }catch{if(nav===navigation.current){setQuiz({mapping:'',silent:''});changeStep('quiz');setError('The completed run used to skip the guide could not be checked. Check the rule to continue.')}return}
   finally{skipChecking.current=false}
  }
  setError('')
  usage.current.begin(mock?'mock':'practice')
  try {
   exclusive?.setBank(0);exclusive?.enter(()=>{runner.interrupt('page_exit');if(mock)leave()},profile.contrast==='light_on_dark')
   runner.prepare(profile,false)
   activeHost.focus();setStep('play')
   if(!pendingRequest.current)pendingRequest.current={requestId:crypto.randomUUID(),sessionId:crypto.randomUUID(),clockDomainId:crypto.randomUUID(),profile,variant:profile.variant,route:mock?{kind:'mock',mockRunId:mock.launchId,mockVersion:MOCK_VERSION,gameIndex:7}:'standalone',atMs:performance.now(),wallMs:Date.now(),displayContext:captureMouthDisplayContext(activeHost)}
   const request=pendingRequest.current
   await runner.start(request,mock?()=>mock.beforeArm({requestId:request.requestId,attemptId:request.sessionId,originTicketId:null,
    installationId:store.installationId,generation:null,requestKind:'start',nativeIdentity:[{key:'sessionId',value:request.sessionId}]}):undefined)
   usage.current.admit(request.sessionId,request.profile.variant==='standard' && request.profile.kind==='keyboard' && !request.profile.alternative)
  }catch(e){exclusive?.leave();setError(String(e));setStep('ready')}
 }
 if(reportTarget&&step!=='report')return <Shell onLibrary={onLibrary}><section className="journey panel"><h1>Saved Lengths report</h1><p role={error?'alert':'status'}>{error||'Checking the exact retained result…'}</p><button onClick={onLibrary}>Return to mock</button></section></Shell>
 if(step==='legacy')return <Shell onLibrary={leave}><div className="journey mouth-journey">{error&&<p role="alert">{error}</p>}{mock&&error&&<button onClick={()=>{navigation.current++;gate.current.cancel();mock.leave();onLibrary()}}>Leave with result unconfirmed</button>}<ReactGameActionBoundary onCompetingAction={()=>mock?.retireReturnIntent()}><LegacyHistory key={legacyFamily} family={legacyFamily} mount={exclusive?.uiMount??document} onBack={()=>void loadHistory()}/></ReactGameActionBoundary></div></Shell>
 return <Shell onLibrary={leave}><div className="journey mouth-journey"><div className="journey-top"><button className="secondary" onClick={leave}><span aria-hidden="true">← </span>{mock?'Return to mock':'Main menu'}</button><p>Lengths · Practice</p></div>{step!=='guide'&&<h1 ref={heading} tabIndex={-1}>{step==='history'?'Lengths history':step==='report'?'Lengths report':'Lengths'}</h1>}
 {error&&<p role="alert">{error}</p>}
 {mock&&error&&<button className="secondary" onClick={()=>{navigation.current++;gate.current.cancel();run.current?.dispose();exclusive?.leave();mock.leave();onLibrary()}}>Leave with result unconfirmed</button>}
    {step==='guide'&&<section className="panel"><p className="eyebrow">How it works</p><h1 ref={heading} tabIndex={-1}>Lengths</h1><QuickRules rules={['A face flashes briefly. Decide whether its mouth is short or long.', 'Short: choose Left. Long: choose Right. Release before the next face.', 'Complete 90 trials. Some correct answers earn simulated rewards; others earn nothing. No reward does not mean you were wrong.']} note={'Allow about three minutes plus setup. Keep this tab open and focused.'}/><div className="actions"><button onClick={()=>changeStep('quiz')}>Continue</button></div><details className="start-options"><summary>Examples and saved results</summary><div className="actions"><button className="secondary" onClick={()=>changeStep('examples')}>See an example</button><button className="secondary" onClick={()=>void loadHistory()}>Saved results</button>{canSkip&&<button className="secondary" onClick={()=>void skipGuide()}>Skip instructions</button>}</div></details><AssessmentUsageNotice /></section>}
 {step==='examples'&&<section className="panel"><div className="mouth-examples">{(['short','long'] as const).map(side=><figure key={side}><div dangerouslySetInnerHTML={{__html:faceSvg(side,profile)}}/><figcaption>{side==='short'?'Short → Left':'Long → Right'}</figcaption></figure>)}</div><p>Respond after the flash, even when the face has disappeared. Each response window lasts 1.3 seconds from the flash.</p><button onClick={()=>changeStep('quiz')}>Check understanding</button></section>}
 {step==='quiz'&&<section className="panel"><fieldset><legend>Which statement gets both Lengths rules right?</legend><label><input type="radio" name="mouth-rule" checked={quiz.mapping==='left'} onChange={()=>setQuiz({mapping:'left',silent:'unknown'})}/>Short uses Left; no reward message does not tell me whether I was correct.</label><label><input type="radio" name="mouth-rule" checked={quiz.mapping==='right'} onChange={()=>setQuiz({mapping:'right',silent:'wrong'})}/>Short uses Right; no reward message means I was wrong.</label></fieldset><button onClick={()=>{if(quiz.mapping==='left'&&quiz.silent==='unknown'){skipSource.current=null;changeStep('ready')}else setError('Short is Left. Some correct answers have no reward message. Try again.')}}>Check answers</button></section>}

 {(step==='ready'||step==='play')&&<section className="mouth-run"><p aria-live="polite">{update?.state?`Trial ${Math.min(update.state.trialIndex,90)} of 90 · $${(update.state.bankedCents/100).toFixed(2)} simulated`:'Ready for 90 trials'}</p>{exclusive?<div ref={previewMount}/>:<div className="mouth-host" ref={host} tabIndex={-1}/>} {step==='ready'&&<><p>{layout?'The face and both controls fit. Keep this tab visible and focused.':'Make the window larger or zoom out so the face and both buttons fit. Examples and saved results remain available.'}</p><button disabled={!layout||!store||spoken||!!held||(profile.kind==='keyboard'?!(safeCode(profile.leftCode)&&safeCode(profile.rightCode)&&profile.leftCode!==profile.rightCode&&checked.includes(profile.leftCode)&&checked.includes(profile.rightCode)):!checked.includes('pointer'))} onClick={()=>void start()}>Start</button><button className="secondary" onClick={replay}>Back to guide</button></>}
 {step==='play'&&update?.state?.phase==='break'&&<><p role="status">{update.message||'Local progress checkpoint'}</p>{update.checkpoint!=='confirmed'?<button onClick={()=>void run.current?.retryCheckpoint()}>Verify or retry checkpoint</button>:<button onClick={()=>void run.current?.continue().catch(e=>setError(String(e)))}>Continue</button>}</>}
 {step==='play'&&<button className="secondary" onClick={()=>run.current?.interrupt('page_exit')}>End this attempt</button>}</section>} {step==='ready'&&<section className="panel"><h2>Check your controls</h2><ControlPrompt profile={profile}/><p className="current-controls">{profile.kind==='keyboard'?`Using ${keyboardButtonLabel(profile.leftCode)} and ${keyboardButtonLabel(profile.rightCode)}`:`Using ${profile.pointerSource} buttons`}{profile.variant!=='standard'?' · Larger mouth difference':''}</p>{profile.kind==='pointer'&&<><button onPointerDown={e=>{if(e.isPrimary&&e.button===0&&e.pointerType===profile.pointerSource&&setupPointer.current===null){setupPointer.current=e.pointerId;setHeld('pointer')}}}>Press and release to check pointer</button><p>{checked.includes('pointer')?'Button working':'Test the button to enable Start.'}</p></>}{profile.kind==='keyboard'&&<p>Tested: {checked.join(', ')||`press and release ${keyboardButtonLabel(profile.leftCode)} and ${keyboardButtonLabel(profile.rightCode)}`}{held&&` · release ${held}`}</p>}<details className="start-options"><summary>Controls and accessibility</summary>
 <label>Input<select value={profile.kind} onChange={e=>setting(e.target.value==='keyboard'?{...defaultProfile,variant:profile.variant,contrast:profile.contrast}:{kind:'pointer',pointerSource:'mouse',variant:profile.variant,deviceClass:'browser-observed',alternative:profile.alternative,contrast:profile.contrast,magnification:profile.magnification,reducedMotion:profile.reducedMotion,presentationVersion:MOUTH_PRESENTATION_VERSION})}><option value="keyboard">Keyboard</option><option value="pointer">Pointer</option></select></label>
 {profile.kind==='keyboard'?<><label>Short response key code<input value={profile.leftCode} onChange={e=>setting({...profile,leftCode:e.target.value})}/></label><label>Long response key code<input value={profile.rightCode} onChange={e=>setting({...profile,rightCode:e.target.value})}/></label><p>Defaults: Short = Left arrow; Long = Right arrow. To change a key, use a code such as ArrowLeft or KeyA.</p><p>Press and release each chosen key now: {checked.join(', ')||'not checked'}{held&&` · held ${held}`}</p></>:<><label>Pointer source<select value={profile.pointerSource} onChange={e=>setting({...profile,pointerSource:e.target.value as PointerSource})}><option>mouse</option><option>touch</option><option>pen</option></select></label><p>{checked.includes('pointer')?'Pointer checked':'Pointer needs a fresh press and release'}</p></>}
 <label>Visual family<select value={profile.variant} onChange={e=>setting({...profile,variant:e.target.value as InputProfile['variant']})}><option value="standard">Standard</option><option value="visual_accommodation">Visual accommodation — larger mouth difference</option></select></label><label>Contrast<select value={profile.contrast} onChange={e=>setting({...profile,contrast:e.target.value as InputProfile['contrast']})}><option value="dark_on_light">Dark on light</option><option value="light_on_dark">Light on dark</option></select></label>
 <label><input type="checkbox" checked={profile.alternative} onChange={e=>setting({...profile,alternative:e.target.checked})}/>Alternative input declaration</label><label><input type="checkbox" checked={profile.magnification==='browser_zoom'} onChange={e=>setting({...profile,magnification:e.target.checked?'browser_zoom':'none'})}/>Using browser magnification</label><label><input type="checkbox" checked={profile.reducedMotion} onChange={e=>setting({...profile,reducedMotion:e.target.checked})}/>Reduced motion declaration</label><label><input type="checkbox" checked={spoken} onChange={e=>{navigation.current++;setSpoken(e.target.checked)}}/>I need a spoken short/long distinction</label>
 <p>Changed controls and visual settings are reported separately.</p></details>{spoken&&<p role="alert">Spoken mouth identification is unavailable for this timed task.</p>}<AssessmentUsageNotice /></section>}
 {step==='report'&&<section className="panel">{report?<Report review={report.review} save={report.save} context={report.context} ordinal={report.ordinal} comparison={report.comparison}/>:<><p role="status">Report numbers await current local verification.</p>{factual&&<p>This attempt is no longer retained in the current installation. In-tab factual review: {factual.presented} presented, {factual.closed} closed, ${(factual.bankedCents/100).toFixed(2)} simulated reward observed. Aggregate interpretation is withdrawn.</p>}</>}<p>{viewStatus}</p><p>These are descriptive results on this run. Forms offer variety, not calibrated equivalence. Standard, visual accommodation and earlier Lengths results are not compared.</p><div className="actions">{!reportTarget&&<><button onClick={()=>{const current=target.current;if(current?.recovery)void current.recovery.recover().then(()=>publishReport());else void publishReport()}}>Verify or retry save/report</button><button className="secondary" onClick={()=>void retryView()}>Retry report opening record</button>{mock?<button onClick={leave}>Return to mock</button>:<button onClick={replay}>Replay from guide</button>}<button className="secondary" onClick={()=>void loadHistory()}>Saved results</button></>}{reportTarget&&<button onClick={onLibrary}>Return to mock</button>}</div></section>}
 {step==='history'&&<section className="panel" data-mouth-history-installation={store?.installationId}><p>A started or partly saved attempt remains incomplete after reload. New play starts at trial 1 on the next form. A form repeats after six accepted starts in this version and visual variant. Deleting one attempt does not reset that sequence.</p>{history.length?<ul>{history.map(a=><li key={a.sessionId}>{a.state.form.id} · {a.variant==='standard'?'Standard':'Visual accommodation'} · {a.snapshot?.kind==='terminal'?a.snapshot.review.status.replace('_headless',''):'Incomplete, later exposure unknown'} · {a.ordinal>6?'Repeated form · ':''}{new Date(a.createdAtWallMs).toLocaleString()}<div className="actions"><button onClick={()=>void openHistory(a)}>Open recorded review</button><button className="secondary" onClick={()=>void remove(a.sessionId)}>Delete this current Lengths attempt</button></div></li>)}</ul>:<p>No current Lengths attempts are saved.</p>}<button onClick={()=>void loadHistory()}>Refresh history</button><button onClick={replay}>New Lengths practice</button><details><summary>Previous versions</summary><p>Saved results from earlier versions stay separate.</p><button className="secondary" onClick={()=>{setLegacyFamily('v12');changeStep('legacy')}}>Lengths with faces — version 1.2</button><button className="secondary" onClick={()=>{setLegacyFamily('v11');changeStep('legacy')}}>Lengths with faces — version 1.1</button><button className="secondary" onClick={()=>{setLegacyFamily('bar');changeStep('legacy')}}>Lengths with bars — original version</button></details></section>}
 {!reportTarget&&(step==='history'||!!error)&&<div className="actions">{confirmDelete?<><p>Delete all current Lengths results and practice history in this browser? Results from previous versions and other assessments stay separate.</p><button onClick={()=>void deleteAll()}>Confirm delete all current Lengths data</button><button onClick={()=>setConfirmDelete(false)}>Cancel</button></>:<button className="secondary" onClick={()=>setConfirmDelete(true)}>Delete all current Lengths data</button>}</div>}
 </div></Shell>
}
