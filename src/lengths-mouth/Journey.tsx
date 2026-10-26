import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { Shell } from '../core/Shell'
import { LengthsJourney } from '../lengths/Journey'
import { MouthStore } from './storage'
import type { ArmedAttempt, PersistedSnapshot, StartRequest } from './storage'
import { MouthBrowserRun, faceSvg } from './browser'
import type { RunUpdate } from './browser'
import { safeCode } from './engine'
import type { InputProfile, PointerSource, State } from './engine'
import { reconcileHeadless } from './report'
import type { Cohort, HeadlessReview } from './report'
import { MouthReportPublication } from './report-publication'
import type { MouthRecovery } from './recovery'
import type { MouthAuthorityHandle } from './authority'
import type { MouthDisplayContext } from './display-context'
import { captureMouthDisplayContext } from './display-context'
import './mouth.css'

type ReportTarget={handle:MouthAuthorityHandle;state:State;recovery:MouthRecovery|null;viewId:string;source:'live'|'history';activity:boolean;activityPending?:Promise<void>;observedWallMs?:number;activitySnapshot?:PersistedSnapshot|null}
type Step='guide'|'examples'|'quiz'|'setup'|'ready'|'play'|'report'|'history'|'legacy'
const defaultProfile:InputProfile={kind:'keyboard',variant:'standard',deviceClass:'browser-observed',leftCode:'ArrowLeft',rightCode:'ArrowRight',alternative:false,contrast:'dark_on_light',magnification:'none',reducedMotion:false}
function Counts({label,cell}:{label:string;cell:Cohort}){
 const pct=(n:number)=>Math.round(n*1000/cell.denominator)/10
 return <tr><th scope="row">{label}</th><td>{cell.correct}/{cell.denominator} ({pct(cell.correct)}%)</td><td>{cell.wrong}/{cell.denominator} ({pct(cell.wrong)}%)</td><td>{cell.omitted}/{cell.denominator} ({pct(cell.omitted)}%)</td><td>{cell.time.medianDisplayMs===null?'Not enough clean responses for a time summary':`${cell.time.medianDisplayMs} ms median · ${cell.time.iqrDisplayMs===null?'Not enough clean responses for variability':`${cell.time.iqrDisplayMs} ms IQR`}`} · {cell.time.cleanCount} clean</td></tr>
}
function Report({review,save,context,ordinal}:{review:HeadlessReview;save:string;context:MouthDisplayContext;ordinal:number}){
 const m=review.metrics,t=m?.responseTendency
 return <div data-mouth-report-numbers="true"><p><strong>{review.status==='complete_headless'?'Valid':review.status==='invalid_headless'?'Invalid':'Incomplete, review-only, later exposure unknown'}</strong> · {save}</p>
 <p>{review.presented} presented · {review.closed} closed · {review.unresolvedPresented} unresolved presented · {review.unpresented} unpresented of 90.</p>
 <p>{review.formId} · {review.variant==='standard'?'Standard mouth':'Visual accommodation mouth'} · {review.specificationVersion} · {review.formVersion} · {review.scoringVersion}{ordinal>6?' · Repeated form':''}</p>
 <p>{review.profile.kind==='keyboard'?`Keyboard: ${review.profile.leftCode} / ${review.profile.rightCode}${review.profile.leftCode!=='ArrowLeft'||review.profile.rightCode!=='ArrowRight'?' · Modified keys':''}`:`${review.profile.pointerSource} pointer`}{review.profile.alternative?' · Alternative input':''} · {review.profile.contrast.replaceAll('_',' ')} · Magnification: {review.profile.magnification.replaceAll('_',' ')}</p>
 <p>{context.browserFamily} browser observed · Layout {context.layoutWidthCssPx} × {context.layoutHeightCssPx} CSS pixels · Visual viewport {context.visualWidthCssPx} × {context.visualHeightCssPx} · Reduced motion declaration: {review.profile.reducedMotion?'yes':'no'}.</p>
 {review.invalidReason&&<p>Stopped because: {review.invalidReason.replaceAll('_',' ')}.</p>}
 {m&&<><div className="mouth-table"><table><caption>Counts and clean correct response times in this run</caption><thead><tr><th>Cell</th><th>Correct</th><th>Wrong</th><th>Omitted</th><th>Time summary</th></tr></thead><tbody><Counts label="Overall" cell={m.overall}/><Counts label="Short mouth" cell={m.byCategory.short}/><Counts label="Long mouth" cell={m.byCategory.long}/>{m.byBlock.map((cell,i)=><Counts key={i} label={`Set ${i+1}`} cell={cell}/>)}</tbody></table></div>
 <p>{t?.responded?`Selected Short ${t.left}/${t.responded} (${t.leftPercent}%) · Long ${t.right}/${t.responded} (${t.rightPercent}%) among responded trials.`:'No response-side distribution'}</p>
 <p>{review.observation}</p></>}
 <p>{review.bankedCents/50} observed rewards · ${(review.bankedCents/100).toFixed(2)} simulated banked.</p>
 {m&&<p>{review.rewardsBySet.map((n,i)=>`Set ${i+1}: ${n} rewards, ${(n/2).toFixed(2)} simulated dollars`).join(' · ')}</p>}
 {!m&&<p>Review the recorded prefix. Aggregate accuracy and response-time interpretation are unavailable.</p>}
 </div>
}
export function MouthJourney({onLibrary,reviewOnly=false}:{onLibrary:()=>void;reviewOnly?:boolean}){
 const [step,setStep]=useState<Step>(reviewOnly?'history':'guide'),[store,setStore]=useState<MouthStore|null>(null),[error,setError]=useState(''),[profile,setProfile]=useState<InputProfile>(defaultProfile)
 const [quiz,setQuiz]=useState({mapping:'',silent:''}),[checked,setChecked]=useState<readonly string[]>([]),[held,setHeld]=useState(''),[spoken,setSpoken]=useState(false)
 const [layout,setLayout]=useState(false),[update,setUpdate]=useState<RunUpdate|null>(null),[history,setHistory]=useState<readonly ArmedAttempt[]>([])
 const [report,setReport]=useState<{review:HeadlessReview;save:string;context:MouthDisplayContext;ordinal:number}|null>(null),[factual,setFactual]=useState<HeadlessReview|null>(null),[confirmDelete,setConfirmDelete]=useState(false),[viewStatus,setViewStatus]=useState('')
 const heading=useRef<HTMLHeadingElement>(null),host=useRef<HTMLDivElement>(null),run=useRef<MouthBrowserRun|null>(null),navigation=useRef(0),gate=useRef(new MouthReportPublication())
 const target=useRef<ReportTarget|null>(null)
 const pendingRequest=useRef<StartRequest|null>(null)
 const setupHeld=useRef(new Set<string>()),setupPointer=useRef<number|null>(null)
 const changeStep=(next:Step)=>{navigation.current++;gate.current.cancel();target.current=null;setReport(null);setFactual(null);setError('');setStep(next)}
 const disposeLatest=useEffectEvent(()=>{gate.current.cancel();run.current?.dispose()})
 useEffect(()=>{void MouthStore.open().then(setStore).catch(e=>setError(`Local V1.1 data unavailable: ${e.message}. Timed play needs working local storage.`));return()=>disposeLatest()},[])
 useLayoutEffect(()=>{if(step!=='play')heading.current?.focus()},[step])
 useEffect(()=>{
  if(step!=='setup')return
  const heldControls=setupHeld.current
  const resetCheck=()=>{heldControls.clear();setupPointer.current=null}
  const down=(e:KeyboardEvent)=>{if(profile.kind!=='keyboard'||![profile.leftCode,profile.rightCode].includes(e.code))return;e.preventDefault();if(!e.repeat&&!e.altKey&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&!e.isComposing&&!setupHeld.current.has(e.code)){setupHeld.current.add(e.code);setHeld(e.code)}}
  const up=(e:KeyboardEvent)=>{if(!setupHeld.current.delete(e.code))return;setHeld('');setChecked(old=>[...new Set([...old,e.code])])}
  const release=(e:PointerEvent)=>{if(setupPointer.current===e.pointerId){setupPointer.current=null;setHeld('');setChecked(old=>[...new Set([...old,'pointer'])])}}
  window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('pointerup',release);window.addEventListener('pointercancel',release)
  return()=>{window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('pointerup',release);window.removeEventListener('pointercancel',release);resetCheck()}
 },[step,profile])
 useEffect(()=>{
  if(step!=='ready'||!store||!host.current)return
  const previous=run.current;previous?.dispose()
  const runner=new MouthBrowserRun(store,host.current,value=>{
   setUpdate(value)
   if(value.state?.phase==='invalid'||value.state?.phase==='completed'){
    const handle=value.recovery!.authority
    if(!target.current){target.current={handle,state:value.state,recovery:value.recovery,viewId:crypto.randomUUID(),source:'live',activity:false};setStep('report')}
   }
  });runner.inheritControls(previous);runner.prepare(profile);run.current=runner
  const frame=requestAnimationFrame(()=>setLayout(runner.layoutReady()))
  return()=>cancelAnimationFrame(frame)
 },[step,store,profile])
 async function publishReport(){
  if(!store||!target.current)return
  const selected=target.current,nav=navigation.current
  let resolved=false
  // Two frames encompass one complete rendered cycle. Pending authority hides all numbers.
  requestAnimationFrame(()=>requestAnimationFrame(()=>{if(!resolved&&nav===navigation.current&&target.current===selected)flushSync(()=>setReport(null))}))
  const published=await gate.current.run(selected.viewId,async signal=>{
   const retained=await store.loadArmed(selected.handle.arm.sessionId,signal)
   selected.handle.assertCurrent();if(!retained||!selected.handle.matches(retained))throw Error('Attempt no longer available')
   const status=selected.handle.resultStatus()
   if(status.kind==='retired'||status.kind==='blocked'||status.kind==='unknown')throw Error('Current report authority unavailable')
   const review=reconcileHeadless(selected.state)
   const saved=status.kind==='confirmed'||selected.handle.armedOnly;return {review,save:saved?(selected.handle.armedOnly?'Incomplete review saved in this browser':'Saved in this browser'):selected.recovery?.pending()?'Save pending':'Save uncertain — retained in this tab',context:selected.handle.arm.armDisplayContext,ordinal:selected.handle.arm.ordinal}
  },async(value,signal)=>{
   if(nav!==navigation.current||target.current!==selected)return
   flushSync(()=>setReport(value));if(!document.querySelector('[data-mouth-report-numbers]'))throw Error('Report DOM was not published')
   resolved=true;setFactual(null);setError('')
   const status=selected.handle.resultStatus()
   if(status.kind==='confirmed'||selected.handle.armedOnly&&status.kind==='recoverable'){
    if(selected.activitySnapshot===undefined){selected.activitySnapshot=status.kind==='confirmed'?status.snapshot:null;selected.observedWallMs=Date.now()}
    if(!reviewOnly)await recordView(selected,signal)
   }
  },()=>{if(nav===navigation.current&&target.current===selected){flushSync(()=>{setReport(null);setFactual(selected.handle.status().kind==='retired'?reconcileHeadless(selected.state):null)});setError('Current local authority could not be confirmed. Numbers are hidden; retry remains available.')}} ,true)
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
  if(!reviewOnly&&target.current===selected&&selected.handle.status().kind==='retired')await recordView(selected).catch(()=>{})
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
  run.current?.dispose();run.current=null;changeStep('history');setHistory([])
  if(!store)return;const nav=navigation.current
  await gate.current.run('history',signal=>store.listAttempts(signal),attempts=>{
   if(nav!==navigation.current)return;flushSync(()=>setHistory(attempts))
  },()=>{if(nav===navigation.current){setHistory([]);setError('History authority unavailable. Try again.')}})
 }
 async function openHistory(attempt:ArmedAttempt){
  if(!store)return
  changeStep('report');const handle=store.authority.published(attempt),state=attempt.snapshot?.state??attempt.state
  target.current={handle,state,recovery:null,viewId:crypto.randomUUID(),source:'history',activity:false};setViewStatus('');void publishReport()
 }
 async function remove(id:string){
  if(!store)return
  try{await store.deleteAttempt(id);await loadHistory()}catch(e){setError(`Deletion unconfirmed: ${String(e)}`)}
 }
 async function deleteAll(){
  run.current?.dispose();run.current=null;gate.current.cancel();setReport(null);setHistory([])
  try{const deletionStore=store??await MouthStore.openForDeletion();const next=await deletionStore.deleteAll();setStore(next);setConfirmDelete(false);changeStep('history')}catch(e){setError(`V1.1 deletion unconfirmed: ${String(e)}`)}
 }
 function replay(){pendingRequest.current=null;run.current?.dispose();run.current=null;setUpdate(null);setChecked([]);setViewStatus('');if(reviewOnly){onLibrary();return}changeStep('guide')}
 function leave(){navigation.current++;gate.current.cancel();run.current?.dispose();onLibrary()}
 function setting(next:InputProfile){setProfile(next);setChecked([]);setHeld('')}
 async function start(){
  const runner=run.current;if(!runner||!store||!host.current)return
  setError('');setStep('play');host.current.focus()
  if(!pendingRequest.current)pendingRequest.current={requestId:crypto.randomUUID(),sessionId:crypto.randomUUID(),clockDomainId:crypto.randomUUID(),profile,variant:profile.variant,route:'standalone',atMs:performance.now(),wallMs:Date.now(),displayContext:captureMouthDisplayContext(host.current)}
  try{await runner.start(pendingRequest.current)}catch(e){setError(String(e));setStep('ready')}
 }
 if(step==='legacy')return <div><p className="note">Legacy bar practice V1.0 · separate history and data</p><LengthsJourney onLibrary={()=>changeStep(reviewOnly?'history':'guide')}/></div>
 return <Shell onLibrary={leave}><div className="journey mouth-journey"><h1 ref={heading} tabIndex={-1}>{step==='history'?'Lengths mouth V1.1 history':step==='report'?'Lengths mouth V1.1 report':'Lengths mouth practice'}</h1>
 {error&&<p role="alert">{error}</p>}
 {step==='guide'&&<section className="panel"><p>A face flashes briefly. Decide whether its mouth is short or long. Choose Short with Left and Long with Right. There are 90 trials.</p><p>Some correct answers earn 50 simulated cents. Others earn nothing. A silent trial does not tell you whether your answer was correct. The money is simulated.</p><p>This original TraitGame task is independent preparation. It does not reproduce a provider score or predict hiring decisions. Allow about 3 minutes plus setup.</p><div className="actions"><button onClick={()=>changeStep('examples')}>See the examples</button><button className="secondary" onClick={()=>void loadHistory()}>V1.1 history</button><button className="secondary" onClick={()=>changeStep('legacy')}>Legacy bar history and practice</button></div></section>}
 {step==='examples'&&<section className="panel"><div className="mouth-examples">{(['short','long'] as const).map(side=><figure key={side}><div dangerouslySetInnerHTML={{__html:faceSvg(side,profile)}}/><figcaption>{side==='short'?'Short → Left':'Long → Right'}</figcaption></figure>)}</div><p>Respond after the flash, even when the face has disappeared. Each response window lasts 1.3 seconds from the flash.</p><button onClick={()=>changeStep('quiz')}>Check understanding</button></section>}
 {step==='quiz'&&<section className="panel"><fieldset><legend>Which direction chooses a short mouth?</legend><label><input type="radio" name="mapping" checked={quiz.mapping==='left'} onChange={()=>setQuiz({...quiz,mapping:'left'})}/>Left</label><label><input type="radio" name="mapping" checked={quiz.mapping==='right'} onChange={()=>setQuiz({...quiz,mapping:'right'})}/>Right</label></fieldset><fieldset><legend>What does no reward message mean?</legend><label><input type="radio" name="silent" checked={quiz.silent==='unknown'} onChange={()=>setQuiz({...quiz,silent:'unknown'})}/>It does not tell me whether the answer was correct.</label><label><input type="radio" name="silent" checked={quiz.silent==='wrong'} onChange={()=>setQuiz({...quiz,silent:'wrong'})}/>My answer was wrong.</label></fieldset><button onClick={()=>{if(quiz.mapping==='left'&&quiz.silent==='unknown')changeStep('setup');else setError('Short is Left. Some correct answers have no reward message. Try again.')}}>Check answers</button></section>}
 {step==='setup'&&<section className="panel"><p>Choose your input and visual setup. The face must fit with both response controls; timed play cannot scroll. Tab changes or interruption during a trial stop the run.</p>
 <label>Input<select value={profile.kind} onChange={e=>setting(e.target.value==='keyboard'?{...defaultProfile,variant:profile.variant,contrast:profile.contrast}:{kind:'pointer',pointerSource:'mouse',variant:profile.variant,deviceClass:'browser-observed',alternative:profile.alternative,contrast:profile.contrast,magnification:profile.magnification,reducedMotion:profile.reducedMotion})}><option value="keyboard">Keyboard</option><option value="pointer">Pointer</option></select></label>
 {profile.kind==='keyboard'?<><label>Short physical key code<input value={profile.leftCode} onChange={e=>setting({...profile,leftCode:e.target.value})}/></label><label>Long physical key code<input value={profile.rightCode} onChange={e=>setting({...profile,rightCode:e.target.value})}/></label><p>Press and release each chosen key now: {checked.join(', ')||'not checked'}{held&&` · held ${held}`}</p></>:<><label>Pointer source<select value={profile.pointerSource} onChange={e=>setting({...profile,pointerSource:e.target.value as PointerSource})}><option>mouse</option><option>touch</option><option>pen</option></select></label><button onPointerDown={e=>{if(e.isPrimary&&e.button===0&&e.pointerType===profile.pointerSource&&setupPointer.current===null){setupPointer.current=e.pointerId;setHeld('pointer')}}}>Press and release to check pointer</button><p>{checked.includes('pointer')?'Pointer checked':'Pointer needs a fresh press and release'}</p></>}
 <label>Visual family<select value={profile.variant} onChange={e=>setting({...profile,variant:e.target.value as InputProfile['variant']})}><option value="standard">Standard</option><option value="visual_accommodation">Visual accommodation — larger mouth difference</option></select></label><label>Contrast<select value={profile.contrast} onChange={e=>setting({...profile,contrast:e.target.value as InputProfile['contrast']})}><option value="dark_on_light">Dark on light</option><option value="light_on_dark">Light on dark</option></select></label>
 <label><input type="checkbox" checked={profile.alternative} onChange={e=>setting({...profile,alternative:e.target.checked})}/>Alternative input declaration</label><label><input type="checkbox" checked={profile.magnification==='browser_zoom'} onChange={e=>setting({...profile,magnification:e.target.checked?'browser_zoom':'none'})}/>Using browser magnification</label><label><input type="checkbox" checked={profile.reducedMotion} onChange={e=>setting({...profile,reducedMotion:e.target.checked})}/>Reduced motion declaration</label><label><input type="checkbox" checked={spoken} onChange={e=>setSpoken(e.target.checked)}/>I need a spoken short/long distinction</label>
 <p>Modified and visual accommodation results are labeled separately. Nonvisual timed mouth discrimination is not supported.</p><button disabled={!store||spoken||!!held||(profile.kind==='keyboard'?!(safeCode(profile.leftCode)&&safeCode(profile.rightCode)&&profile.leftCode!==profile.rightCode&&checked.includes(profile.leftCode)&&checked.includes(profile.rightCode)):!checked.includes('pointer'))} onClick={()=>changeStep('ready')}>Review readiness</button></section>}
 {(step==='ready'||step==='play')&&<section className="mouth-run"><p aria-live="polite">{update?.state?`Trial ${Math.min(update.state.trialIndex,90)} of 90 · $${(update.state.bankedCents/100).toFixed(2)} simulated`:'Ready for 90 trials'}</p><div className="mouth-host" ref={host} tabIndex={-1}/>{step==='ready'&&<><p>{layout?'The face and both controls fit. Keep this tab visible and focused.':'Timed play unavailable: the face must be at least 240 CSS pixels and fit fully with both response controls. Adjust your window or zoom; guide/history remain available.'}</p><button disabled={!layout||!store} onClick={()=>void start()}>Start 90 trials</button><button className="secondary" onClick={replay}>Back to guide</button></>}
 {step==='play'&&update?.state?.phase==='break'&&<><p role="status">{update.message||'Local progress checkpoint'}</p>{update.checkpoint!=='confirmed'?<button onClick={()=>void run.current?.retryCheckpoint()}>Verify or retry checkpoint</button>:<button onClick={()=>void run.current?.continue().catch(e=>setError(String(e)))}>Continue</button>}</>}
 {step==='play'&&<button className="secondary" onClick={()=>run.current?.interrupt('page_exit')}>End this attempt</button>}</section>}
 {step==='report'&&<section className="panel">{report?<Report review={report.review} save={report.save} context={report.context} ordinal={report.ordinal}/>:<><p role="status">Report numbers await current local verification.</p>{factual&&<p>This attempt is no longer retained in the current installation. In-tab factual review: {factual.presented} presented, {factual.closed} closed, ${(factual.bankedCents/100).toFixed(2)} simulated reward observed. Aggregate interpretation is withdrawn.</p>}</>}<p>{viewStatus}</p><p>These are descriptive results on this run. Forms offer variety, not calibrated equivalence. Standard/accommodation and legacy bar versions are not compared.</p><div className="actions"><button onClick={()=>{const current=target.current;if(current?.recovery)void current.recovery.recover().then(()=>publishReport());else void publishReport()}}>Verify or retry save/report</button>{!reviewOnly&&<button className="secondary" onClick={()=>void retryView()}>Retry report opening record</button>}<button onClick={replay}>{reviewOnly?'Back to current Lengths guide':'Replay from guide'}</button><button className="secondary" onClick={()=>void loadHistory()}>V1.1 history</button></div></section>}
 {step==='history'&&<section className="panel" data-mouth-history-installation={store?.installationId}><p>{reviewOnly?'This V1.1 history is available for review and deletion. New mouth practice uses V1.2; a form may repeat across versions.':'Arm/checkpoint records are incomplete review-only after reload. New play starts at trial 1 on the next form.'}</p>{history.length?<ul>{history.map(a=><li key={a.sessionId}>{a.state.form.id} · {a.variant==='standard'?'Standard':'Visual accommodation'} · {a.snapshot?.kind==='terminal'?a.snapshot.review.status.replace('_headless',''):'Incomplete, later exposure unknown'} · {a.ordinal>6?'Repeated form · ':''}{new Date(a.createdAtWallMs).toLocaleString()}<div className="actions"><button onClick={()=>void openHistory(a)}>Open recorded review</button><button className="secondary" onClick={()=>void remove(a.sessionId)}>Delete this V1.1 attempt</button></div></li>)}</ul>:<p>No retained V1.1 attempts.</p>}<button onClick={()=>void loadHistory()}>Refresh history</button><button onClick={replay}>New mouth practice</button><button className="secondary" onClick={()=>changeStep('legacy')}>Legacy bar history and practice</button></section>}
 {(step==='history'||!!error)&&<div className="actions">{confirmDelete?<><p>Delete all mouth V1.1 attempts, events, reports and form counters in this browser? Legacy bar and other games are separate.</p><button onClick={()=>void deleteAll()}>Confirm delete all mouth V1.1 data</button><button onClick={()=>setConfirmDelete(false)}>Cancel</button></>:<button className="secondary" onClick={()=>setConfirmDelete(true)}>Delete all mouth V1.1 data</button>}</div>}
 </div></Shell>
}
