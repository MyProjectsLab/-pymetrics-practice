import { mockMenuButtons } from '../onboarding/mockMenuButtons'
import { QuickRules } from '../onboarding/QuickRules'
import { feedbackLines, moneyOneFeedback } from '../reports/feedback'
import { AssessmentUsageNotice } from '../assessment-usage/Notice'
/* oxlint-disable react-hooks/exhaustive-deps */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { Shell } from '../core/Shell'
import { EVENT_VERSION, FORM_PAYLOAD_HASH, SPEC_VERSION, money, outcome, parseCents, reportRun } from './core'
import type { Form, Report, Run } from './core'
import { MoneyRuntime } from './runtime'
import type { ExclusiveMoneyDocument } from './exclusive-document'
import type { ProtectedView } from './exclusive-document'
import { moneyPairArt, moneyResultArt } from './result-art'
import type { MockJourneyContext } from '../mock/journey-context'
import { withSelectedMockReportPublication } from '../mock/report-route'
import type { ReportTarget } from '../mock/report-route'
import { sourceReference } from '../mock/reference'
import type { Root as MoneyRoot } from './storage'
import './money-exchange-1.css'

type Screen = 'guide' | 'example' | 'quiz' | 'instructions' | 'ready' | 'award' | 'connecting' |
  'connected' | 'partner_rules' | 'return_explanation' | 'transfer' | 'transfer_busy' |
  'response_ready' | 'final_allocation' | 'fairness' | 'test_complete' | 'report' | 'help' | 'history' | 'review'
const LIMIT = 'This is an original practice exercise. The partner response is scripted, not another person. This report does not reproduce a provider score or predict a hiring outcome.'
function nextPaint() { return new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))) }
async function confirmDisplayWithin<T>(work:Promise<T>):Promise<T> {
  let timer:ReturnType<typeof setTimeout>|undefined
  try { return await Promise.race([work,new Promise<never>((_,reject)=>{
    timer=setTimeout(()=>reject(Error('Result display confirmation timed out')),2500)
  })]) }
  finally {if(timer)clearTimeout(timer)}
}
function stepTitle(screen:Screen) { return ({guide:'Money Exchange 1',example:'See one example',quiz:'Check the arithmetic',
  instructions:'Instructions',ready:'Ready?',award:'You receive $10',connecting:'Connecting',connected:'Partner connected',
  partner_rules:'The exchange',return_explanation:'Choose an amount to send',transfer:'Send an amount',
  transfer_busy:'Sending',response_ready:'Your partner has received the money',final_allocation:'The partner returned an amount',
  fairness:'How fair was the return?',test_complete:'Test Complete',report:'Your Money Exchange 1 result',
  help:'How the amounts were calculated',history:'Local Money Exchange 1 history',review:'Checking your exchange'})[screen] }
function resultLayout(): 'wide'|'narrow'|'compact' {
  const viewport=window.visualViewport
  const width=viewport?.width??innerWidth, height=viewport?.height??innerHeight
  return height<500 && width>=320 ? 'compact' : width<500 ? 'narrow' : 'wide'
}
function reportLines(report:Report):string[] {
  const lines=[report.status==='complete_valid'?'Completed and saved in this browser':'Incomplete review saved in this browser',
    `Form ${report.formId}${report.ordinal>6?' · familiar form':''} · Money Exchange 1 V1.0`]
  if(report.sentCents===null) lines.push('No transfer was saved.')
  else {
    lines.push(`You sent ${money(report.sentCents)}. Partner pot ${money(report.potCents!)}.`)
    lines.push(`Returned to you ${report.returnedCents===null?'Not confirmed':money(report.returnedCents)}.`)
    lines.push(`Your final amount ${report.selfCents===null?'Not confirmed':money(report.selfCents)}. Partner final amount ${report.partnerCents===null?'Not confirmed':money(report.partnerCents)}.`)
    if(report.returnedCents!==null) lines.push(`Amounts: $10.00 − ${money(report.sentCents)} + ${money(report.returnedCents)} = ${money(report.selfCents!)} for you; ${money(report.potCents!)} − ${money(report.returnedCents)} = ${money(report.partnerCents!)} for the partner.`)
    if(report.status==='complete_valid') lines.push(`Fairness rating: ${report.rating===null?'Not applicable (no transfer)':`${report.rating} of 10`}.`)
  }
  if(report.status==='incomplete_review') lines.push(`The exchange ended before a confirmed completion. Exposure: ${report.exposure.replaceAll('_',' ')}.`)
  lines.push(`Session context: ${report.context.route==='standalone'?'standalone practice':'full mock'}; ${report.context.device.replaceAll('_',' ')}; ${report.context.input.replaceAll('_',' ')}; reduced motion ${report.context.reducedMotion?'on':'off'}; high contrast ${report.context.highContrast?'on':'off'}.`)
  lines.push(LIMIT)
  return lines
}
function compareMoney(root:MoneyRoot,selected:Run):string {
  const previous=Object.values(root.runs).filter(item=>item.id!==selected.id&&item.createdAt<selected.createdAt&&item.status==='complete'&&item.report?.status==='complete_valid'&&item.formPayloadHash===selected.formPayloadHash).sort((a,b)=>b.createdAt-a.createdAt)[0]
  return previous?.report&&selected.report?.status==='complete_valid'&&previous.report.sentCents!==null&&previous.report.returnedCents!==null&&selected.report.sentCents!==null&&selected.report.returnedCents!==null?
    `Previous compatible saved run: sent ${money(previous.report.sentCents)} and received ${money(previous.report.returnedCents)} back. This run: sent ${money(selected.report.sentCents)} and received ${money(selected.report.returnedCents)} back.`:
    'No comparable earlier run is currently verified.'
}
function reportSummary(report:Report,comparison:string):string[]{return report.status==='complete_valid' ? [
  'Completed and saved in this browser',...feedbackLines(moneyOneFeedback(report)),
  ...(comparison==='No comparable earlier run is currently verified.'?[]:[comparison]),
] : ['Incomplete exchange saved for review',report.sentCents===null?'No transfer was confirmed.':`You sent ${money(report.sentCents)}. A complete result was not confirmed.`]}
function ReportView({ report, comparison, onHelp, onAgain, onHistory, onLibrary, readOnly }: {
  report:Report;comparison:string;onHelp:()=>void;onAgain:()=>void;onHistory:()=>void;onLibrary:()=>void;readOnly?:boolean
}) {
  return <div className="money-report">
    {reportSummary(report,comparison).map((line,index)=><p key={index} role={index===0?'status':undefined}>{line}</p>)}
    <details><summary>Detailed numbers</summary>{reportLines(report).slice(1,-1).map((line,index)=><p key={index}>{line}</p>)}</details><p>{LIMIT}</p>
    <div className="money-actions">{!readOnly&&<button onClick={onAgain}>Try Again</button>}<button className="secondary" onClick={onHelp}>How the amounts were calculated</button>
      {!readOnly&&<button className="secondary" onClick={onHistory}>Local history</button>}<button className="secondary" onClick={onLibrary}>{readOnly?'Back to mock':'Library'}</button></div>
  </div>
}
export function MoneyExchangeJourney({ runtime, boundary, onLibrary, mock, reportTarget }: { runtime:MoneyRuntime;boundary:ExclusiveMoneyDocument;onLibrary:()=>void;mock?:MockJourneyContext;reportTarget?:ReportTarget }) {
  const [screen,setScreen]=useState<Screen>('guide')
  const [ready,setReady]=useState(false), [busy,setBusy]=useState(false), [error,setError]=useState<string|null>(null)
  const [returnFailed,setReturnFailed]=useState(false), [returnBusy,setReturnBusy]=useState(false)
  const openedReportTarget=useRef<string|null>(null)
  useEffect(()=>{if(!ready||!reportTarget||openedReportTarget.current===reportTarget.attemptId)return;openedReportTarget.current=reportTarget.attemptId;void openReport(reportTarget.attemptId)},[ready,reportTarget])
  const [amount,setAmount]=useState(''), [rating,setRating]=useState<number|null>(null)
  const [quiz,setQuiz]=useState(''), [report,setReport]=useState<Report|null>(null)
  const [comparison,setComparison]=useState('No comparable earlier run is currently verified.')
  const [detailsOpen,setDetailsOpen]=useState(false)
  const [canSkip,setCanSkip]=useState(false)
  const skipSource=useRef<string|null>(null)
  const [history,setHistory]=useState<Run[]>([])
  const [hasUnresolvedActive,setHasUnresolvedActive]=useState(false)
  const [forms,setForms]=useState<readonly Form[]>([])
  function validSkipRun(item:Run|undefined){return !!item&&item.status==='complete'&&item.report?.status==='complete_valid'&&item.report.version===SPEC_VERSION&&forms.some(form=>form.id===item.formId)&&item.formPayloadHash===FORM_PAYLOAD_HASH}
  function completedForSkip(root:MoneyRoot){return Object.values(root.runs).find(validSkipRun)}
  async function skipGuide(){const epoch=navigationEpochRef.current;try{let source:Run|undefined;await runtime.publish(null,root=>{source=completedForSkip(root)});if(epoch!==navigationEpochRef.current||screenRef.current!=='guide')return;if(source){skipSource.current=source.id;change('ready')}else setCanSkip(false)}catch{if(epoch===navigationEpochRef.current&&screenRef.current==='guide'){setCanSkip(false);setError('A completed saved exchange could not be confirmed. Check the rule to continue.')}}}
  useEffect(()=>{if(screen!=='guide'||!ready||!forms.length){setCanSkip(false);return}let active=true,pending=false;const check=()=>{if(pending||document.hidden||!document.hasFocus())return;pending=true;void runtime.publish(null,root=>{if(active)setCanSkip(!!completedForSkip(root))}).catch(()=>{if(active)setCanSkip(false)}).finally(()=>{pending=false})};check();const timer=setInterval(check,1000);return()=>{active=false;clearInterval(timer)}},[screen,ready,forms,runtime])
  const [run,setRun]=useState<Run|null>(runtime.state.run)
  const resultRef=useRef<HTMLDivElement>(null), mounted=useRef(true), screenRef=useRef<Screen>('guide')
  const returnPendingRef=useRef(false)
  const amountRef=useRef(''), ratingRef=useRef<number|null>(null)
  const surfaceFaultRef=useRef(false)
  const navigationEpochRef=useRef(0)
  const busyTokenRef=useRef(0), busyNowRef=useRef(false)
  const selectedIdRef=useRef<string|null>(null)
  const headingRef=useRef<HTMLHeadingElement>(null)
  useLayoutEffect(() => {
    if (!boundary.active) { boundary.captureUi(); return }
    if (surfaceFaultRef.current) return
    try { boundary.showProtected(protectedView()) }
    catch {
      surfaceFaultRef.current=true
      boundary.recover()
      void runtime.withdraw('technical','protected_display_changed',runtime.state.exposure).catch(()=>undefined)
    }
  })
  const chosen=run && runtime.state.run?.id===run.id ? run : runtime.state.run
  const transfer=chosen?.events.find(e=>e.kind==='transfer_committed')
  const result=transfer?.kind==='transfer_committed' && chosen && forms.length ? outcome(transfer.sentCents,
    runtimeForm(chosen.formId,forms).returnBps) : null
  function protectedView(): ProtectedView {
    const lines:string[]=error?[error]:[]
    const buttons:ProtectedView['buttons'][number][]=[]
    let detailLines:readonly string[]|undefined
    const add=(label:string,act:()=>void,disabled=false,sameReturnIntent=false,expanded?:boolean)=>buttons.push({label,act:()=>{if(!sameReturnIntent)competingChoice();act()},disabled,expanded})
    let amountField:ProtectedView['amount'],ratingField:ProtectedView['rating'],comprehensionField:ProtectedView['comprehension'],art:ProtectedView['result'],pair:ProtectedView['pair']
    switch(screen) {
      case 'guide':
        lines.push('Choose how much of your simulated $10 to send.','The partner receives three times that amount and returns a scripted share.','Rate how fair the return feels. There is no correct amount or fairness rating.','Untimed practice. All money and partners are simulated. Results stay in this browser; see Privacy.')
        add('Continue',()=>change('quiz'));add('See an example',()=>change('example'));if(canSkip)add('Skip instructions',()=>void skipGuide());add('Saved results',()=>void showHistory(),!ready);add(mock||reportTarget?'Return to mock':'Main menu',onLibrary);break
      case 'example':
        lines.push('Send $5. The partner receives $15 and returns $6.15. You finish with $11.15; the partner keeps $8.85.')
        add('Next',()=>change('quiz'));break
      case 'quiz':
        comprehensionField={value:quiz,current:()=>quiz,changed:value=>{competingChoice();setQuiz(value)}}
        if(quiz&&quiz!=='6')lines.push('The partner receives three times what you send. Try again.')
        add('Check answer',()=>{if(quiz==='6'){skipSource.current=null;change('ready')}},!quiz);break
      case 'instructions':
        lines.push('You begin with $10. Send one amount, see what comes back and give one fairness rating. There is no scored countdown.')
        add('Continue',()=>change('ready'),!ready||busy);add('Close',close);break
      case 'ready':
        lines.push('When you are ready, select Start to see your starting amount.','We collect completion counts, not your amounts or ratings. See Privacy at traitgame.com/privacy.html.')
        add('Start',()=>change('award'),busy);add('Restart',()=>void restart());add('Close',close);break
      case 'award':
        lines.push('You have $10.00.')
        add('Next',()=>{change('connecting');window.setTimeout(()=>{if(mounted.current&&screenRef.current==='connecting')change('connected')},300)})
        add('Restart',()=>void restart());add('Close',close);break
      case 'connecting':
        lines.push('You have $10.00. Partner has $0.00. Connecting to the scripted partner…')
        add('Restart',()=>void restart());add('Close',close);break
      case 'connected':
        lines.push('You have $10.00. Partner has $0.00. Your practice partner is ready.')
        add('Next',()=>change('partner_rules'));add('Restart',()=>void restart());add('Close',close);break
      case 'partner_rules':
        lines.push('Any amount you send is tripled for the partner. You will see how much the partner returns.')
        add('Next',()=>change('return_explanation'));add('Restart',()=>void restart());add('Close',close);break
      case 'return_explanation':
        lines.push('Choose a transfer from your $10. The partner response in this practice exercise is scripted.')
        add('Next',()=>void start(),busy);add('Restart',()=>void restart());add('Close',close);break
      case 'transfer':
        lines.push('You have $10.00. Partner has $0.00. Enter an amount from $0.00 to $10.00.')
        pair=moneyPairArt(1000,0,resultLayout())
        amountField={value:amountRef.current,current:()=>amountRef.current,changed:value=>{amountRef.current=value}}
        add('Next',()=>void send(),busy);add('Restart',()=>void restart());add('Close',close);break
      case 'transfer_busy':
        lines.push('Sending your chosen amount…');pair=moneyPairArt(1000,0,resultLayout())
        add('Restart',()=>void restart());add('Close',close);break
      case 'response_ready':
        if(result) lines.push(`You kept ${money(1000-result.sentCents)}. The partner received ${money(result.potCents)}. Select Next to see the return.`)
        if(result) pair=moneyPairArt(1000-result.sentCents,result.potCents,resultLayout(),true)
        add('Next',()=>void reveal(),busy||!result);add('Restart',()=>void restart());add('Close',close);break
      case 'final_allocation':
        if(result) art=moneyResultArt(result,resultLayout())
        add('Next',()=>change('fairness'),busy||!chosen?.events.some(e=>e.kind==='return_presented'))
        add('Restart',()=>void restart());add('Close',close);break
      case 'fairness':
        if(transfer?.kind==='transfer_committed' && transfer.sentCents>0) {
          lines.push('How fair do you feel the partner return was? Choose 0 to 10.')
          ratingField={value:ratingRef.current,current:()=>ratingRef.current,changed:value=>{ratingRef.current=value}}
        } else lines.push('You sent nothing, so there was no partner return to rate.')
        add('Next',()=>void finish(),busy);add('Restart',()=>void restart());add('Close',close);break
      case 'test_complete':
        lines.push('Your exchange is saved in this browser.')
        add('Next',()=>{if(chosen)void openReport(chosen.id)},busy||!chosen||chosen.status!=='complete')
        add('Close',close);break
      case 'report':
        if(report) {
          lines.push(...reportSummary(report,comparison),LIMIT)
          if(detailsOpen)detailLines=reportLines(report).slice(1,-1)
          add('Detailed numbers',()=>setDetailsOpen(value=>!value),false,false,detailsOpen)
          if(reportTarget)add('Back to mock',onLibrary)
          else if(mock){add('Continue full mock',()=>void returnToMock(),false,true);add('Try Again',()=>void again())}
          else add('Try Again',again)
          add('How the amounts were calculated',()=>void showHelp());if(!reportTarget){add('Local history',()=>void showHistory());add('Library',onLibrary)}
        } break
      case 'help':
        lines.push('Your remaining amount is $10 minus what you sent. The partner pot is three times what you sent.')
        lines.push('Your final amount adds the return. The partner final amount is the pot minus the return.')
        lines.push('This explains arithmetic only; it does not advise which amount or rating to choose.')
        if(report)add('Back to result',()=>void openReport(report.runId))
        add('Close',close);break
      case 'history':
        lines.push('Saved in this browser only. Removing a result cannot be undone.')
        if(hasUnresolvedActive)lines.push('An exchange is active or unresolved. Resolve it before another.')
        if(!history.length)lines.push('No saved exchanges yet.')
        for(const item of history) {
          lines.push(`${new Date(item.createdAt).toLocaleString()} · ${item.formId} · ${item.status}`)
          add(`Open ${item.formId} result`,()=>void openReport(item.id))
          add(`Delete ${item.formId} result`,()=>void remove(item.id))
        }
        add('Practice again',()=>{try{runtime.resetForReplay();change('instructions')}catch(e){problem(e)}},hasUnresolvedActive)
        add('Delete all Money Exchange 1 data',()=>void removeAll(),!history.length&&!hasUnresolvedActive)
        add('Library',close);break
      case 'review':
        lines.push('The previous exchange has not been confirmed complete. It cannot resume midway.')
        add('Check saved outcome',()=>void checkOutcome(),busy||runtime.state.settling)
        add('Local history',()=>void showHistory());add('Library',close);break
    }
    if(mock||reportTarget){
      buttons.splice(0,buttons.length,...mockMenuButtons(buttons,{label:'Return to mock',act:()=>void returnToMock()}))
      if(mock&&returnFailed&&!returnBusy)add('Leave with result unconfirmed',leaveMockUnconfirmed)
    }
    return {stage:screen,title:stepTitle(screen),lines,detailLines,buttons,amount:amountField,rating:ratingField,comprehension:comprehensionField,pair,result:art,
      onNavigate:(href:string,event:MouseEvent)=>{event.preventDefault();void close(undefined,href)},
      onViolation:()=>{
        surfaceFaultRef.current=true
        void runtime.withdraw('technical','protected_display_changed',runtime.state.exposure).catch(()=>undefined)
      }}
  }
  function change(next:Screen) {navigationEpochRef.current++;screenRef.current=next;setScreen(next);if(next==='report')setDetailsOpen(false);setError(null);setReturnFailed(false) }
  function competingChoice(){mock?.retireReturnIntent()}
  function problem(reason:unknown) { setError(reason instanceof Error?reason.message:'Local state could not be verified.') }
  function beginBusy() { const token=++busyTokenRef.current;busyNowRef.current=true;setBusy(true);return token }
  function endBusy(token:number) {if(token===busyTokenRef.current){busyNowRef.current=false;if(mounted.current)setBusy(false)}}
  function cancelBusy() {busyTokenRef.current++;busyNowRef.current=false;setBusy(false)}
  useEffect(()=>{ mounted.current=true;let live=true
    let stopStore=()=>{}
    void runtime.open(!!mock||!!reportTarget,!!reportTarget).then(async store=>{
      if(live) stopStore=store.subscribe(notice=>{
        if(notice.installationId!==store.installationId)return
        if (!live || notice.type!=='replaced' &&
          !(selectedIdRef.current && notice.type==='deleted' && notice.runId===selectedIdRef.current)) return
        selectedIdRef.current=null
        cancelBusy()
        flushSync(()=>{setReport(null);change('review')})
        void runtime.publish(null,root=>{if(live && screenRef.current==='review')
          flushSync(()=>{setHistory(Object.values(root.runs).filter(r=>r.status!=='active'))
            setHasUnresolvedActive(Object.values(root.runs).some(r=>r.status==='active'));change('history')})})
          .catch(()=>{if(live && screenRef.current==='review')setError('Saved results could not be checked. Try again.')})
      })
      await runtime.publish(null,root=>{if(!live)return
        flushSync(()=>{setReady(true);setForms(store.forms)
          setHistory(Object.values(root.runs).filter(r=>r.status!=='active').sort((a,b)=>b.createdAt-a.createdAt))
          setHasUnresolvedActive(Object.values(root.runs).some(r=>r.status==='active'))
          if(runtime.state.error || Object.values(root.runs).some(r=>r.status==='active'))change('review')})
      })
    }).catch(problem)
    const stop=runtime.subscribe(()=>{ if (!live) return
      const state=runtime.state
      setRun(state.run)
      if (!state.capable && ['transfer','transfer_busy','response_ready','final_allocation','fairness'].includes(screenRef.current)) {
        cancelBusy()
        if(state.run?.status==='complete'){selectedIdRef.current=state.run.id;change('test_complete')}
        else if(!state.run){change('history');setError('That exchange is no longer available in this browser.')}
        else {change('review');setError('This exchange needs its saved outcome checked before continuing.')}
      }
    })
    let polling=false
    const poll=window.setInterval(()=>{
      if (!live || polling || !['report','help','history','test_complete'].includes(screenRef.current)) return
      polling=true
      const pollEpoch=navigationEpochRef.current
      void runtime.publish(null,root=>{
        if (!live || pollEpoch!==navigationEpochRef.current) return
        if (['report','help','test_complete'].includes(screenRef.current) && selectedIdRef.current && !root.runs[selectedIdRef.current]) {
          flushSync(()=>{setReport(null);change('history');setHistory(Object.values(root.runs).filter(r=>r.status!=='active'))
            setHasUnresolvedActive(Object.values(root.runs).some(r=>r.status==='active'))})
        } else if(screenRef.current==='history') flushSync(()=>{setHistory(Object.values(root.runs).filter(r=>r.status!=='active').sort((a,b)=>b.createdAt-a.createdAt))
          setHasUnresolvedActive(Object.values(root.runs).some(r=>r.status==='active'))})
        else if(['report','help'].includes(screenRef.current)&&selectedIdRef.current&&root.runs[selectedIdRef.current])setComparison(compareMoney(root,root.runs[selectedIdRef.current]))
      }).catch(()=>{ if(live && !busyNowRef.current && pollEpoch===navigationEpochRef.current &&
        ['report','help','history','test_complete'].includes(screenRef.current)){
        setReport(null);setHistory([]);change('review');setError('Saved results could not be checked. Try again.')}
      }).finally(()=>{polling=false})
    },400)
    const pagehide=()=>{ competingChoice();if(returnPendingRef.current)navigationEpochRef.current++
      if(reportTarget){navigationEpochRef.current++;setReport(null)}
      if(runtime.state.run?.status==='active' || runtime.state.pendingArm || runtime.state.settling)
      void runtime.withdraw('technical','page_lifecycle_changed').catch(()=>undefined) }
    window.addEventListener('pagehide',pagehide)
    return()=>{competingChoice();live=false;mounted.current=false;stop();stopStore();window.clearInterval(poll);window.removeEventListener('pagehide',pagehide)}
  },[runtime])
  useEffect(()=>{headingRef.current?.focus()},[screen])
  async function perform(work:()=>Promise<unknown>, next?:Screen) { if(busyNowRef.current)return
    const navigationEpoch=navigationEpochRef.current
    const token=beginBusy();setError(null)
    try {const result=await work();if(result!==false && mounted.current && next && navigationEpoch===navigationEpochRef.current)change(next)}
    catch(e){if(mounted.current && navigationEpoch===navigationEpochRef.current)problem(e)}
    finally{endBusy(token)} }
  async function start() { await perform(async()=>{
    const entryEpoch=navigationEpochRef.current
    if(skipSource.current){const sourceId=skipSource.current;let qualifies=false
      await runtime.publish(null,root=>{qualifies=validSkipRun(root.runs[sourceId])})
      if(!mounted.current||entryEpoch!==navigationEpochRef.current||screenRef.current!=='return_explanation')return false
      if(!qualifies){skipSource.current=null;setCanSkip(false);setQuiz('');change('quiz');setError('The completed run used to skip the guide was deleted or changed. Check the rule to continue.');return false}
      skipSource.current=null
    }
    if(!mounted.current||entryEpoch!==navigationEpochRef.current||screenRef.current!=='return_explanation')return false
    if (!boundary.active) boundary.enterProtected()
    else if (!boundary.checkProtected()) throw Error('The game display changed. Reload this page before starting.')
    const next=await runtime.start(mock);setRun(next);setAmount('');amountRef.current='';setRating(null);ratingRef.current=null
    return true
  },'transfer') }
  async function send() { const cents=parseCents(boundary.active?amountRef.current:amount);if(cents===null){setError('Enter an amount from $0.00 to $10.00, with no more than two decimals.');return}
    await perform(async()=>{await runtime.transfer(cents)},'transfer_busy')
    if(mounted.current && screenRef.current==='transfer_busy') window.setTimeout(()=>{
      if(mounted.current && screenRef.current==='transfer_busy' && runtime.state.capable) change('response_ready')
    },window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:350)
  }
  async function reveal() { if(busyNowRef.current)return
    const token=beginBusy();setError(null)
    const epoch=runtime.state.viewEpoch
    try {
      await runtime.markPossible()
      if(epoch!==runtime.state.viewEpoch || !runtime.state.capable) throw Error('Exchange withdrawn')
      flushSync(()=>change('final_allocation'))
      const art=result?moneyResultArt(result,resultLayout()):null
      let presentationReady=false
      if(art) try { await confirmDisplayWithin((async()=>{await boundary.prepareResult();await nextPaint()})());presentationReady=true }
        catch { /* Preserve the strongest possible exposure and withdraw below. */ }
      if(epoch!==runtime.state.viewEpoch || !runtime.state.capable) throw Error('Exchange withdrawn')
      if(!art || !presentationReady || !boundary.resultReady(art)) { await runtime.withdraw('technical','result_display_unconfirmed','possibly_revealed')
        change('review');setError('The result was not confirmed visible. This attempt is incomplete.');return }
      runtime.noteFrameConfirmed()
      await runtime.capture()
      await runtime.returnShown()
      if(epoch!==runtime.state.viewEpoch || !runtime.state.capable) throw Error('Exchange withdrawn')
      setRun(runtime.state.run)
    } catch(e) { if(epoch===runtime.state.viewEpoch){if(runtime.state.error)change('review');problem(e)} }
    finally {endBusy(token)}
  }
  async function finish() { if(busyNowRef.current)return
    if(transfer?.kind==='transfer_committed' && transfer.sentCents>0 && (boundary.active?ratingRef.current:rating)===null) {
      setError('Choose a fairness rating from 0 to 10.');return
    }
    await perform(async()=>{const saved=await runtime.complete(transfer?.kind==='transfer_committed' && transfer.sentCents===0?null:(boundary.active?ratingRef.current:rating))
      selectedIdRef.current=saved.id},'test_complete') }
  async function restart() {
    competingChoice()
    navigationEpochRef.current++
    if(!runtime.state.pendingArm && (!runtime.state.run || !runtime.state.capable)) {
      try{if(mock)await mock.retry();runtime.resetForReplay()}catch(e){problem(e);return}change('ready');return}
    const token=beginBusy()
    change('review')
    const settling=runtime.withdraw('restart','candidate_restart',runtime.state.exposure)
    try {await settling;if(mock)await mock.retry();if(mounted.current && token===busyTokenRef.current){runtime.resetForReplay();setRun(null);setAmount('');amountRef.current='';setRating(null);ratingRef.current=null;change('ready')}}
    catch(e){if(mounted.current && token===busyTokenRef.current)problem(e)}finally{endBusy(token)}
  }
  async function close(signal?:AbortSignal,destination?:string):Promise<boolean> {
    if(!signal)competingChoice()
    navigationEpochRef.current++
    if(runtime.state.run?.status==='active' || runtime.state.pendingArm || runtime.state.settling) {
      const token=beginBusy()
      change('review')
      try {
        await runtime.withdraw('close','candidate_close',runtime.state.exposure)
        if(mounted.current && token===busyTokenRef.current && !signal?.aborted){if(destination)window.location.assign(destination);else onLibrary()}
        return true
      } catch(e) { if(mounted.current && token===busyTokenRef.current && !signal?.aborted)problem(e);return false }
      finally {endBusy(token)}
    }
    cancelBusy()
    if(!signal?.aborted){if(destination)window.location.assign(destination);else onLibrary()}
    return true
  }
  function leaveMockUnconfirmed(){
    if(!mock||!returnFailed||returnPendingRef.current)return
    competingChoice()
    navigationEpochRef.current++
    setReturnFailed(false)
    onLibrary()
  }
  async function returnToMock(){
    if(returnPendingRef.current)return
    const signal=mock?.beginReturnIntent(),launch=mock?.launchId,epoch=navigationEpochRef.current
    returnPendingRef.current=true
    setReturnFailed(false);setReturnBusy(true)
    try{
      if(runtime.state.run?.status==='active'||runtime.state.pendingArm||runtime.state.settling){
        const closed=await close(signal)
        if(!closed&&mounted.current&&!signal?.aborted&&mock?.launchId===launch)setReturnFailed(true)
        return
      }
      if(mock){
        try{
          if(await mock.terminal()==='ready'){
            if(!mounted.current||signal?.aborted||navigationEpochRef.current!==epoch||mock.launchId!==launch)return
            await mock.continue(signal);return
          }
        }catch(cause){if(mounted.current&&!signal?.aborted&&navigationEpochRef.current===epoch){problem(cause);setReturnFailed(true)}return}
        if(!mounted.current||signal?.aborted||navigationEpochRef.current!==epoch||mock.launchId!==launch)return
      }
      onLibrary()
    }finally{if(signal)mock?.finishReturnIntent(signal);returnPendingRef.current=false;setReturnBusy(false)}
  }
  async function openReport(id:string) { competingChoice();navigationEpochRef.current++;await perform(async()=>{
    const navigationEpoch=navigationEpochRef.current
    const store=await runtime.open(!!mock||!!reportTarget,!!reportTarget)
    const assertSavedAuthority=(root:MoneyRoot)=>{const selected=root.runs[id];if(!selected || selected.status==='active')throw Error('Saved result unavailable')
      if(reportTarget){const reference=sourceReference({game:'money_1',arm:reportTarget.arm,attemptId:selected.id,
        settingsRevision:reportTarget.reference.settingsRevision,formId:selected.formId,formHash:selected.formPayloadHash,
        recorded:{specification:selected.report?.version??SPEC_VERSION,scoring:null,event:EVENT_VERSION}})
        if(root.installationId!==reportTarget.reference.installationId||selected.armRequestId!==reportTarget.arm.requestId||
          JSON.stringify(reference)!==JSON.stringify(reportTarget.reference))throw Error('Money Exchange 1 mock report authority changed')}
      return selected}
    const publish=async(permit=()=>{})=>{await store.activity({id:crypto.randomUUID(),runId:id,at:Date.now(),kind:'report'},reportTarget?assertSavedAuthority:undefined)
    await runtime.publish(id,root=>{permit();const selected=assertSavedAuthority(root)
      if(navigationEpoch!==navigationEpochRef.current)return
      const form=runtimeForm(selected.formId,store.forms), value=reportRun(selected,form)
      flushSync(()=>{selectedIdRef.current=id;setRun(selected);setReport(value);setComparison(compareMoney(root,selected));change('report')})
    })}
    if(reportTarget)await withSelectedMockReportPublication(reportTarget,publish)
    else await publish()
  }) }
  async function showHelp() { if (!report) return
    competingChoice()
    navigationEpochRef.current++
    const navigationEpoch=navigationEpochRef.current
    const publish=(permit=()=>{})=>runtime.publish(report.runId,root=>{permit();
      if (!root.runs[report.runId] || root.runs[report.runId].status==='active') throw Error('Saved result unavailable')
      if(navigationEpoch===navigationEpochRef.current)flushSync(()=>change('help'))
    })
    await perform(async()=>{if(reportTarget)await withSelectedMockReportPublication(reportTarget,publish);else await publish()}) }
  async function publishHistory() { const navigationEpoch=navigationEpochRef.current
    await runtime.publish(null,root=>{
      if(navigationEpoch===navigationEpochRef.current)
        flushSync(()=>{setHistory(Object.values(root.runs).filter(r=>r.status!=='active').sort((a,b)=>b.createdAt-a.createdAt))
          setHasUnresolvedActive(Object.values(root.runs).some(r=>r.status==='active'));change('history')})
    }) }
  async function showHistory() { if(!ready)return;competingChoice();navigationEpochRef.current++;await perform(publishHistory) }
  async function remove(id:string) { competingChoice();navigationEpochRef.current++;const navigationEpoch=navigationEpochRef.current
    await perform(async()=>{await runtime.deleteOne(id);await runtime.publish(null,root=>{
    if(navigationEpoch===navigationEpochRef.current)
      flushSync(()=>{setHistory(Object.values(root.runs).filter(r=>r.status!=='active').sort((a,b)=>b.createdAt-a.createdAt));if(report?.runId===id)setReport(null)})
  })}) }
  async function removeAll() { competingChoice();navigationEpochRef.current++;const navigationEpoch=navigationEpochRef.current
    await perform(async()=>{await runtime.deleteAll();await runtime.publish(null,root=>{
    if(navigationEpoch===navigationEpochRef.current)
      flushSync(()=>{setHistory(Object.values(root.runs));setHasUnresolvedActive(false);setReport(null);change('history')})
  })}) }
  async function again() {competingChoice();navigationEpochRef.current++;try{if(mock)await mock.retry();runtime.resetForReplay();setRun(null);setReport(null);change('instructions')}catch(e){problem(e)} }
  async function checkOutcome() {competingChoice();await perform(async()=>{if(!runtime.state.run && !runtime.state.pendingArm) {await runtime.recoverExisting();await publishHistory();return}
    const checked=await runtime.checkSaved();if(!checked) {change('history');return}
    if(checked.status==='complete') {selectedIdRef.current=checked.id;change('test_complete')}
    else if(checked.status==='incomplete') await publishHistory()
    else {await runtime.withdraw('technical','unconfirmed_save_recovered');await publishHistory()}
  })}
  const control=screen==='instructions' || screen==='ready' || ['award','connecting','connected','partner_rules','return_explanation','transfer','transfer_busy','response_ready','final_allocation','fairness'].includes(screen)
  if(reportTarget&&!['report','help'].includes(screen))return <Shell onLibrary={returnToMock}><section className="journey panel"><h1>Saved Money Exchange 1 report</h1><p role={error?'alert':'status'}>{error||'Checking the exact retained result…'}</p><button onClick={()=>void returnToMock()}>Return to mock</button></section></Shell>
  return <Shell onLibrary={returnToMock}><div className="journey-top"><button className="secondary" onClick={()=>void returnToMock()}><span aria-hidden="true">← </span>{mock||reportTarget?'Return to mock':'Main menu'}</button><p>Money Exchange 1 · Practice</p></div><section className="panel money-journey" aria-labelledby="money-title">
    <div className="money-header"><div><h1 id="money-title" tabIndex={-1} ref={headingRef}>{stepTitle(screen)}</h1></div>
      {control && <div className="money-header-actions">{screen!=='instructions' && <button className="secondary" onClick={()=>void restart()}>Restart</button>}
        <button className="secondary" onClick={()=>void returnToMock()}>{mock||reportTarget?'Return to mock':'Close'}</button></div>}
      {screen==='test_complete' && <button className="secondary" onClick={()=>void returnToMock()}>{mock||reportTarget?'Return to mock':'Close'}</button>}</div>
    {!ready && <p role="status">Checking local storage…</p>}
    {error && <p role="alert" className="money-error">{error}</p>}
    {mock && returnFailed && !returnBusy && <button className="secondary" onClick={leaveMockUnconfirmed}>Leave with result unconfirmed</button>}
    {screen==='guide' && <><QuickRules rules={['Choose how much of your simulated $10 to send.','The partner receives three times that amount and returns a scripted share.','Rate how fair the return feels. There is no correct amount or fairness rating.']} note="Untimed practice. All money and partners are simulated."/>
      <button onClick={()=>change('quiz')}>Continue</button><details className="start-options"><summary>Examples and saved results</summary><div className="money-actions"><button className="secondary" onClick={()=>change('example')}>See an example</button>{canSkip&&<button className="secondary" onClick={()=>void skipGuide()}>Skip instructions</button>}<button className="secondary" disabled={!ready} onClick={()=>void showHistory()}>Saved results</button></div></details></>}
    {screen==='example' && <><p>In this example, you send $5 from your $10. The partner receives $15 and returns $6.15. You have $10 − $5 + $6.15 = $11.15. The partner keeps $15 − $6.15 = $8.85. Practice returns can vary.</p><button onClick={()=>change('quiz')}>Next</button></>}
    {screen==='quiz' && <><fieldset><legend>If you send $2, how much does the partner receive before returning anything?</legend>
      {(['2','6','20'] as const).map(value=><label key={value}><input type="radio" name="money-comprehension" value={value} checked={quiz===value} onChange={()=>setQuiz(value)} />${value}</label>)}
      </fieldset><button disabled={!quiz} onClick={()=>{if(quiz==='6'){skipSource.current=null;change('ready')}}}>Check answer</button>{quiz && quiz!=='6' && <p>Multiply the sent amount by three. Try again.</p>}</>}
    {screen==='instructions' && <><p>You begin with $10. Choose one amount to send. You will see what comes back, then give one fairness rating. There is no scored countdown.</p>
      <p>You can stop or restart before completion. An already started exchange will remain in local history as incomplete.</p><button disabled={!ready||busy} onClick={()=>change('ready')}>Continue</button></>}
    {screen==='ready' && <><p>When you are ready, select Start to see your starting amount.</p><button disabled={busy} onClick={()=>change('award')}>Start</button></>}
    {screen==='award' && <><div className="money-single"><span className="money-person">You</span><strong>$10.00</strong></div><button onClick={()=>{change('connecting');window.setTimeout(()=>{if(mounted.current&&screenRef.current==='connecting')change('connected')},300)}}>Next</button></>}
    {screen==='connecting' && <><div className="money-pair"><p>You <strong>$10.00</strong></p><p>Partner <strong>$0.00</strong></p></div><p>Connecting to the scripted partner…</p><button disabled>Next</button></>}
    {screen==='connected' && <><div className="money-pair"><p>You <strong>$10.00</strong></p><p>Partner <strong>$0.00</strong></p></div><p>Your practice partner is ready.</p><button onClick={()=>change('partner_rules')}>Next</button></>}
    {screen==='partner_rules' && <><div className="money-pair"><p>You <strong>$10.00</strong></p><p>Partner <strong>$0.00</strong></p></div>
      <p>Any amount you send is tripled for the partner. You will see how much the partner returns.</p><button onClick={()=>change('return_explanation')}>Next</button></>}
    {screen==='return_explanation' && <><div className="money-pair"><p>You <strong>$10.00</strong></p><p>Partner <strong>$0.00</strong></p></div>
      <p>Choose a transfer from your $10. The partner response in this practice exercise is scripted.</p><button disabled={busy} onClick={()=>void start()}>Next</button></>}
    {screen==='transfer' && <><div className="money-pair"><p>You <strong>$10.00</strong></p><p>Partner <strong>$0.00</strong></p></div>
      <label htmlFor="money-amount">Amount to send in dollars</label><input id="money-amount" inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0.00" />
      <p>From $0.00 to $10.00. Your choice is saved after Next.</p><button disabled={busy||parseCents(amount)===null} onClick={()=>void send()}>Next</button></>}
    {screen==='transfer_busy' && <><p>Sending your chosen amount…</p><button disabled>Next</button></>}
    {screen==='response_ready' && result && <><div className="money-pair"><p>You kept <strong>{money(1000-result.sentCents)}</strong></p><p>Partner pot <strong>{money(result.potCents)}</strong></p></div>
      <p>The partner response is ready. Select Next to see the return and final amounts.</p><button disabled={busy} onClick={()=>void reveal()}>Next</button></>}
    {screen==='final_allocation' && result && <><div ref={resultRef} className="money-allocation"><div className="money-pair"><p>You <strong>{money(result.selfCents)}</strong></p><p>Partner <strong>{money(result.partnerCents)}</strong></p></div>
      <p>The partner received {money(result.potCents)} and returned <strong>{money(result.returnedCents)}</strong> to you.</p></div>
      <button disabled={busy||!chosen?.events.some(e=>e.kind==='return_presented')} onClick={()=>change('fairness')}>Next</button></>}
    {screen==='fairness' && <><p>{transfer?.kind==='transfer_committed' && transfer.sentCents===0?'You sent nothing, so there was no partner return to rate.':'How fair do you feel the partner return was?'}</p>
      {transfer?.kind==='transfer_committed' && transfer.sentCents>0 && <fieldset className="money-rating"><legend>Fairness from 0 (not fair) to 10 (very fair)</legend>
        {Array.from({length:11},(_,i)=><label key={i}><input type="radio" name="fairness" value={i} checked={rating===i} onChange={()=>setRating(i)} />{i}</label>)}</fieldset>}
      <button disabled={busy||transfer?.kind==='transfer_committed'&&transfer.sentCents>0&&rating===null} onClick={()=>void finish()}>Next</button></>}
    {screen==='test_complete' && <><p>Your exchange is saved in this browser.</p><button disabled={busy||!chosen||chosen.status!=='complete'} onClick={()=>{if(chosen)void openReport(chosen.id)}}>Next</button></>}
    {screen==='report' && report && (mock?<><div className="money-report">{reportSummary(report,comparison).map((line,index)=><p key={index}>{line}</p>)}<details><summary>Detailed numbers</summary>{reportLines(report).slice(1,-1).map((line,index)=><p key={index}>{line}</p>)}</details><p>{LIMIT}</p><button onClick={()=>void returnToMock()}>Return to mock</button>{!reportTarget&&<button onClick={()=>void again()}>Try Again</button>}</div></>:<ReportView report={report} comparison={comparison} onHelp={()=>void showHelp()} onAgain={()=>void again()} onHistory={()=>void showHistory()} onLibrary={onLibrary} readOnly={!!reportTarget} />)}
    {screen==='help' && report && <><p>Your remaining amount is $10 minus what you sent. The partner's pot is three times what you sent.</p>
      <p>Your final amount adds the return to your remainder. The partner's final amount is the pot minus the return.</p>
      <p>This explains arithmetic only; it is not advice about which amount or rating to choose.</p>
      <div className="money-actions"><button onClick={()=>{if(report)void openReport(report.runId)}}>Back to result</button><button className="secondary" onClick={()=>void close()}>Close</button></div></>}
    {screen==='history' && <><p>Saved in this browser only. Removing a result cannot be undone.</p>
      {hasUnresolvedActive && <p role="status">An exchange is still active or unresolved. Resolve it or delete this game's data before starting another.</p>}
      {history.length===0?<p>No saved exchanges yet.</p>:
      <ul className="money-history">{history.map(item=><li key={item.id}><span>{new Date(item.createdAt).toLocaleString()} · {item.formId} · {item.status}</span>
        <button onClick={()=>void openReport(item.id)}>Open</button><button className="secondary" onClick={()=>void remove(item.id)}>Delete</button></li>)}</ul>}
      <div className="money-actions"><button disabled={hasUnresolvedActive} onClick={()=>{competingChoice();try{runtime.resetForReplay();change('instructions')}catch(e){problem(e)}}}>Practice again</button>
        <button className="secondary" disabled={!history.length&&!hasUnresolvedActive} onClick={()=>void removeAll()}>Delete all Money Exchange 1 data</button><button className="secondary" onClick={()=>void close()}>Library</button></div></>}
    {screen==='review' && <><p>The previous exchange has not been confirmed as complete. It cannot resume midway.</p>
      <button disabled={busy||runtime.state.settling} onClick={()=>void checkOutcome()}>Check saved outcome</button><button className="secondary" onClick={()=>void showHistory()}>Local history</button><button className="secondary" onClick={()=>void close()}>Library</button></>}
    {(screen === 'guide' || screen === 'ready') && <AssessmentUsageNotice />}
  </section></Shell>
}
function runtimeForm(id:string,forms:readonly {id:string;returnBps:number}[]) { const form=forms.find(item=>item.id===id);if(!form)throw Error('Saved form unavailable');return form }
