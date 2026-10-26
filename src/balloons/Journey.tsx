import { QuickRules } from '../onboarding/QuickRules'
import { AssessmentUsageNotice } from '../assessment-usage/Notice'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { Shell } from '../core/Shell'
import { BalloonsController, CHANGE_CHANNEL, announceChange } from './controller'
import type { RunView } from './controller'
import { BalloonsStore, withMutationGate } from './storage'
import type { Root } from './storage'
import type { DurableRecord, Settings } from './durable'
import { durableBaseline } from './durable'
import { installButtonInput } from './input'
import type { CoreAction, VisibleType } from './contracts'
import { BalloonsReport } from './PracticeReport'
import { BalloonsComparison } from './ComparisonView'
import { compareSaved } from './comparison'
import type { ComparisonResult } from './comparison'
import { TrainingJourney } from './TrainingJourney'
import { money } from './format'
import { basicReport } from './report'
import type { MockJourneyContext } from '../mock/journey-context'
import type { ReportTarget } from '../mock/report-route'
import { reportDocumentCurrent, withVerifiedReportPublication } from '../mock/report-route'
import { BalloonIdentity } from './BalloonVisual'
export { BalloonIdentity } from './BalloonVisual'
import './balloons.css'

const GUIDE = "Pump to increase the amount you could collect. Each pump might burst this balloon. If it bursts, you lose only this balloon's uncollected amount; money collected earlier stays yours. Balloon types may behave differently, but earlier outcomes cannot tell you exactly when the next balloon will burst."
const EMPLOYER = 'Some employers use game-based assessments that combine information from several games. We do not know what a particular employer sees or how it weighs Balloons. Detailed results stay in this browser. We collect limited task totals to improve TraitGame; we do not send results to employers.'
// The separate unscored worked balloon has hidden T=6; its script permits only two successful pumps, then collection.
const initialView: RunView = { mode: 'idle', record: null, message: '' }
type Step = 'guide' | 'demo' | 'quiz' | 'setup' | 'ready' | 'run' | 'history' | 'training' | 'comparison'
export function BalloonsJourney({ onLibrary, mock, reportTarget, separateBaseline = false }: { onLibrary: () => void; mock?: MockJourneyContext; reportTarget?: ReportTarget; separateBaseline?: boolean }) {
  const [step, setStep] = useState<Step>('guide'), [store, setStore] = useState<BalloonsStore | null>(null)
  const [error, setError] = useState(''), [view, setView] = useState<RunView>(initialView)
  const [mockReady, setMockReady] = useState(false), [mockError, setMockError] = useState('')
  const mockTerminalSeen = useRef<string | null>(null)
  const [notificationController, setNotificationController] = useState<BalloonsController | null>(null)
  const [deletionStatus, setDeletionStatus] = useState('')
  const [history, setHistory] = useState<Root | null>(null), [selected, setSelected] = useState<DurableRecord | null>(null)
  const [skipAvailable,setSkipAvailable]=useState(false)
  const skipSource=useRef<string|null>(null)
  const skipChecking=useRef(false)
  const startInFlight=useRef(false)
  const startNavigation=useRef(0)
  const [reportComparisonText,setReportComparisonText]=useState('No comparable earlier run is currently verified.')
  const stepRef=useRef(step)
  stepRef.current=step
  function moveIntroStep(next:Step){startNavigation.current++;stepRef.current=next;setStep(next)}
  const [comparison, setComparison] = useState<ComparisonResult | null>(null), [comparisonId, setComparisonId] = useState('')
  const visibleReportId=view.mode==='report'?view.record?.header.identity.sessionId:step==='history'?selected?.header.identity.sessionId:null
  useEffect(()=>{
    if(!store||!visibleReportId){setReportComparisonText('No comparable earlier run is currently verified.');return}
    let active=true
    const check=()=>{void withMutationGate(async signal=>{
      const root=await store.read()
      signal.throwIfAborted()
      const current=root.records[visibleReportId]
      if(!current||root.tombstones[visibleReportId])throw Error('Current saved report is unavailable')
      const result=current.header.retest?compareSaved(root,visibleReportId):null
      if(active)setReportComparisonText(result?.status==='ready'?`Previous compatible saved run collected ${money(result.rows[0].bankedCents.baseline)}; this retest collected ${money(result.rows[0].bankedCents.retest)}. Open the saved comparison for the full chain check.`:'No comparable earlier run is currently verified.')
    }).catch(()=>{if(active)setReportComparisonText('An earlier saved run could not be verified for this view.')})}
    check();const timer=window.setInterval(check,1000)
    return()=>{active=false;window.clearInterval(timer)}
  },[store,visibleReportId])
  const [trainingBaseline, setTrainingBaseline] = useState('')
  const [demo, setDemo] = useState(0), [answers, setAnswers] = useState([-1, -1]), [submitted, setSubmitted] = useState(false)
  const [tested, setTested] = useState<string[]>([]), [mode, setMode] = useState<'auto' | 'replay' | 'new_baseline'>(separateBaseline ? 'new_baseline' : 'auto')
  const [settings, setSettings] = useState<Settings>({ verbose: false, reducedMotion: mock?.preferences.reducedMotion ?? (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false), informationProfile: 'type-pattern-v1', controls: 'native-buttons-v1' })
  const openedReportTarget=useRef<string|null>(null)
  useEffect(()=>{if(!store||!reportTarget||openedReportTarget.current===reportTarget.attemptId)return;openedReportTarget.current=reportTarget.attemptId;
    void store.read().then(root=>{const record=root.records[reportTarget.attemptId];if(!record)throw Error('The exact Balloons result is unavailable');setStep('history');return openSavedReport(record)}).catch(cause=>setError(String(cause)))
  },[store,reportTarget])
  const controller = useRef<BalloonsController | null>(null), root = useRef<HTMLDivElement>(null), display = useRef<HTMLDivElement>(null)
  const input = useRef<ReturnType<typeof installButtonInput> | null>(null), alive = useRef(true), historyRequest = useRef(0)
  const lastAnnounced = useRef(''), historyBusy = useRef<number | null>(null), comparisonRequest = useRef(0), comparisonBusy = useRef(false)
  const liveRegion = useRef<HTMLDivElement>(null), deletionPending = useRef(new Set<string>())
  const historyHeading = useRef<HTMLHeadingElement>(null), restoreHistoryFocus = useRef<HTMLElement | null>(null)
  const announce = (text: string) => { if (liveRegion.current) liveRegion.current.textContent = text }
  const trainingActive = step === 'training'
  const leaveMountedJourney = useEffectEvent(() => { controller.current?.dispose(); historyRequest.current++ })
  const refreshCurrentComparison = useEffectEvent((background = false) => { void refreshComparison(background) })
  useEffect(() => {
    alive.current = true
    void (mock||reportTarget?BalloonsStore.openForMock(undefined,!reportTarget):BalloonsStore.open()).then(s => { if (alive.current) setStore(s) }).catch(e => { if (alive.current) setError(`Saving is unavailable. Scored practice cannot start. ${e.message}`) })
    return () => { alive.current = false; leaveMountedJourney() }
  }, [])
  useEffect(() => {
    if (trainingActive) { input.current = null; return }
    const installed = installButtonInput(root.current!, () => controller.current?.view.mode === 'saving' || controller.current?.view.mode === 'mounting')
    input.current = installed
    return () => installed.dispose()
  }, [trainingActive])
  const refreshCurrentHistory = useEffectEvent((background = false) => { void refreshHistory(background) })
  useEffect(() => {
    let active = true
    const registeredController = controller.current
    // Pending notices belong to this subscription, just like its controller and
    // installation. A held application callback can outlive channel.close().
    const pending = new Set<string>()
    deletionPending.current = pending
    const pause = () => { input.current?.cancel(); if (controller.current && ['explanation', 'playing', 'saving', 'mounting', 'checking'].includes(controller.current.view.mode)) void controller.current.pause('browser_interruption') }
    const hidden = () => { if (document.visibilityState !== 'visible') pause() }
    const change = (event: MessageEvent) => {
      if (!active || !alive.current || controller.current !== registeredController) return
      const data = event.data
      if (data?.phase === 'begin' && typeof data.id === 'string') { pending.add(data.id); registeredController?.authorityChanged(); setSelected(null); setHistory(null); setComparison(null); comparisonRequest.current++; historyRequest.current++ }
      if (data?.phase === 'end' && typeof data.id === 'string') { pending.delete(data.id); if (step === 'history') refreshCurrentHistory(); if (step === 'comparison') refreshCurrentComparison() }
    }
    const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANGE_CHANNEL) : null
    if (channel) channel.onmessage = change
    window.addEventListener('blur', pause); window.addEventListener('pagehide', pause); document.addEventListener('visibilitychange', hidden)
    const recheck = () => { if (step === 'comparison') { setComparison(null); comparisonRequest.current++; refreshCurrentComparison() } }
    window.addEventListener('focus', recheck); document.addEventListener('visibilitychange', recheck)
    const timer = window.setInterval(() => { if (!mock || step !== 'run') void controller.current?.checkAuthority(); if (step === 'history' && deletionPending.current.size === 0) refreshCurrentHistory(true); if (step === 'comparison' && deletionPending.current.size === 0) refreshCurrentComparison(true) }, 1000)
    return () => { active = false; window.removeEventListener('blur', pause); window.removeEventListener('pagehide', pause); window.removeEventListener('focus', recheck); document.removeEventListener('visibilitychange', hidden); document.removeEventListener('visibilitychange', recheck); channel?.close(); clearInterval(timer) }
  }, [step, store, comparisonId, notificationController])
  useEffect(() => { root.current?.querySelector<HTMLElement>('h1')?.focus() }, [step, selected?.header.identity.sessionId, comparison?.status])
  useEffect(() => {
    const target = restoreHistoryFocus.current
    if (!target) return
    if (!target.isConnected || target !== historyHeading.current) { restoreHistoryFocus.current = null; return }
    if (history) { restoreHistoryFocus.current = null; target.focus() }
  }, [history, deletionStatus])
  useEffect(() => {
    if (view.mode !== 'playing' || !view.record) return
    const c = view.record.snapshot.core
    const key = `${view.record.header.identity.sessionId}:${c.revision}:${view.record.journal.at(-1)?.sequenceNumber}`
    if (key === lastAnnounced.current) return
    lastAnnounced.current = key
    if (c.status !== 'active') {
      root.current?.querySelector<HTMLButtonElement>('[data-next]')?.focus()
      const r = c.results.at(-1)!
      announce(`${r.outcome === 'burst' ? 'Balloon burst' : r.outcome === 'cap_collect' ? 'Automatic cap collection' : 'Collected'}. ${r.bankedCents} cents banked; ${r.lostCents} cents lost on this balloon. Banked total ${c.bankedCents} cents.`)
    } else {
      const latest = view.record.journal.at(-1)!
      if (latest.command?.kind === 'confirm') { root.current?.querySelector<HTMLButtonElement>('[data-control="pump"]')?.focus(); announce(`Round ${c.round}. ${typeFor(view.record)}. Current ${c.current.currentCents} cents. Banked ${c.bankedCents} cents.`) }
      else if (view.record.header.settings.verbose) announce(`Current ${c.current.currentCents} cents. Banked ${c.bankedCents} cents.`)
    }
  }, [view])
  async function refreshComparison(background = false, id = comparisonId) {
    if (!store || !id || (background && comparisonBusy.current)) return
    const request = ++comparisonRequest.current
    comparisonBusy.current = true
    let finished = false, frame = 0
    if (background) frame = requestAnimationFrame(() => { frame = requestAnimationFrame(() => {
      if (!finished && request === comparisonRequest.current) flushSync(() => setComparison(null))
    }) })
    else setComparison(null)
    try {
      await withMutationGate(async signal => {
        const current = await store.read()
        if (signal.aborted) throw new Error('Comparison check canceled')
        const result = compareSaved(current, id)
        if (alive.current && request === comparisonRequest.current && deletionPending.current.size === 0)
          flushSync(() => setComparison(result))
      })
    } catch (e) {
      if (alive.current && request === comparisonRequest.current) setComparison({ status: 'unavailable', reason: e instanceof Error ? e.message : 'Saved comparison authority is unavailable.' })
    } finally { finished = true; cancelAnimationFrame(frame); if (request === comparisonRequest.current) comparisonBusy.current = false }
  }
  async function refreshHistory(background = false) {
    if (!store || (background && historyBusy.current !== null)) return
    const request = ++historyRequest.current
    historyBusy.current = request
    let finished = false, frame = 0
    if (background) frame = requestAnimationFrame(() => { frame = requestAnimationFrame(() => { if (!finished && request === historyRequest.current) { flushSync(() => setHistory(null)) } }) })
    else { setSelected(null); setHistory(null) }
    try {
      // Admission and publication share deletion's bounded gate. A delayed old
      // read cannot restore numbers after deletion commits, even without messages.
      const load = async (signal?: AbortSignal,permit:()=>void=()=>{}) => {
        const data = await store.read()
        if (!signal?.aborted && alive.current && request === historyRequest.current) {permit();flushSync(() => {
          setHistory(data); setSelected(old => old ? data.records[old.header.identity.sessionId] ?? null : null); setError('')
        })}
      }
      if (reportTarget) await withVerifiedReportPublication(reportTarget,permit=>load(undefined,permit))
      else if (selected) await withMutationGate(load)
      else await load()
    } catch (e) { if (alive.current && request === historyRequest.current) { setHistory(null); setError(e instanceof Error ? e.message : 'History could not be verified') } }
    finally { finished = true; cancelAnimationFrame(frame); if (historyBusy.current === request) historyBusy.current = null }
  }
  useEffect(()=>{
    if(!store||step!=='guide')return
    let active=true,pending=false
    const check=()=>{if(pending||document.hidden||!document.hasFocus())return;pending=true;void store.read().then(data=>{
      if(active)setSkipAvailable(Object.values(data.records).some(record=>record.snapshot.phase==='completed'&&
        record.snapshot.confirmedRounds.length===39&&basicReport(record.snapshot.core).status==='headless_complete'))
    }).catch(()=>{if(active)setSkipAvailable(false)}).finally(()=>{pending=false})}
    check();const timer=window.setInterval(check,1000)
    return()=>{active=false;window.clearInterval(timer)}
  },[store,step])
  async function skipTutorial(){
    if(!store)return
    const ticket=historyRequest.current,nav=startNavigation.current
    try{
      const data=await store.read()
      if(!alive.current||stepRef.current!=='guide'||ticket!==historyRequest.current||nav!==startNavigation.current)return
      const source=Object.values(data.records).find(record=>record.snapshot.phase==='completed'&&
        record.snapshot.confirmedRounds.length===39&&basicReport(record.snapshot.core).status==='headless_complete')
      if(!source){
        setSkipAvailable(false);setError('A current completed Balloons run is no longer saved. Check the rules instead.');return
      }
      skipSource.current=source.header.identity.sessionId
      moveIntroStep('ready')
    }catch{if(alive.current&&ticket===historyRequest.current&&nav===startNavigation.current){setSkipAvailable(false);setError('Saved Balloons history could not be checked. Use the rule check instead.')}}
  }
  async function makeController() {
    await controller.current?.dispose()
    const next = new BalloonsController(store!, v => { if (alive.current) setView(v) }, record => {
      flushSync(() => setView({ mode: 'mounting', record, message: 'Confirming balloon display…' }))
      return display.current!
    })
    controller.current = next; setNotificationController(next); return next
  }
  async function start() { if (!store||startInFlight.current||skipChecking.current) return
    const startTicket=startNavigation.current
    startInFlight.current=true
    try{
    if(skipSource.current){const sourceId=skipSource.current,nav=startNavigation.current;skipChecking.current=true
      try{const data=await store.read();if(!alive.current||stepRef.current!=='ready'||nav!==startNavigation.current)return
        const source=data.records[sourceId]
        if(!source||source.snapshot.phase!=='completed'||source.snapshot.confirmedRounds.length!==39||basicReport(source.snapshot.core).status!=='headless_complete'){
          skipSource.current=null;setSkipAvailable(false);setAnswers([-1,-1]);setSubmitted(false);setError('The completed run used to skip the guide was deleted or changed. Check the rules to continue.');moveIntroStep('quiz');return
        }
        skipSource.current=null
      }catch{if(alive.current&&stepRef.current==='ready'&&nav===startNavigation.current){setAnswers([-1,-1]);setSubmitted(false);setError('The completed run used to skip the guide could not be checked. Check the rules to continue.');moveIntroStep('quiz')}return}
      finally{skipChecking.current=false}
    }
    if(!alive.current||stepRef.current!=='ready'||startTicket!==startNavigation.current)return
    setError(''); stepRef.current='run';setStep('run'); const next = await makeController()
    if(!alive.current||startTicket!==startNavigation.current||controller.current!==next){next.dispose();return}
    await next.start(mock ? 'replay' : mode, settings,
    mock ? {context:mock,sessionId:crypto.randomUUID()} : undefined)
    }finally{startInFlight.current=false} }
  useEffect(() => {
    if (!mock || view.mode !== 'report' || !view.record || mockTerminalSeen.current === view.record.header.identity.sessionId) return
    mockTerminalSeen.current = view.record.header.identity.sessionId
    void mock.terminal().then(status => { if (alive.current) { setMockReady(status === 'ready'); if (status === 'review_only') setMockError('This attempt needs review. Return to mock to try again or skip this game.') } })
      .catch(cause => { if (alive.current) { mockTerminalSeen.current = null; setMockError(cause instanceof Error ? cause.message : 'Mock result acknowledgement could not be confirmed.') } })
  }, [mock, view])
  async function retest(baselineId: string, recordId?: string, freshAttempt = false) {
    setSelected(null); setError(''); setStep('run')
    const next = await makeController()
    if (recordId) await next.resume(recordId)
    else await next.explainRetest(baselineId, freshAttempt)
  }
  async function resume(record: DurableRecord) {
    if (record.header.retest && record.snapshot.exposure === 'pending_exposure') { await retest(record.header.retest.baselineSessionId); return }
    setSelected(null); setStep('run'); setError(''); const next = await makeController(); await next.resume(record.header.identity.sessionId) }
  function historyView() { mock?.retireReturnIntent();controller.current?.dispose(); controller.current = null; comparisonRequest.current++; setComparison(null); setComparisonId(''); setView(initialView); setStep('history'); void refreshHistory() }
  function openComparison(record: DurableRecord) {
    mock?.retireReturnIntent()
    controller.current?.dispose(); controller.current = null; historyRequest.current++; setSelected(null); setHistory(null)
    const id = record.header.identity.sessionId
    setComparisonId(id); setComparison(null); setStep('comparison'); void refreshComparison(false, id)
  }
  function trainingView(record: DurableRecord) { mock?.retireReturnIntent();controller.current?.dispose(); controller.current = null; setTrainingBaseline(record.header.identity.sessionId); setStep('training') }
  function replay(nextMode: typeof mode = 'replay') { mock?.retireReturnIntent();controller.current?.dispose(); controller.current = null; comparisonRequest.current++; setComparison(null); setSelected(null); setView(initialView); setMode(nextMode); setDemo(0); setAnswers([-1, -1]); setSubmitted(false); setTested([]); moveIntroStep('guide') }
  function click(kind: CoreAction['kind'], e: ReactMouseEvent<HTMLButtonElement>) {
    const c = view.record?.snapshot.core, source = input.current?.source(e.nativeEvent)
    if (!c || !source) return
    void controller.current?.action(kind, source, c.round, c.revision)
  }
  async function openSavedReport(record: DurableRecord) {
    mock?.retireReturnIntent()
    const request = ++historyRequest.current
    try {
      const write=(signal?:AbortSignal)=>store!.viewReport(record.header.identity.sessionId, { wallTimeMs: Date.now(), monotonicMs: performance.now(), clockEpochId: crypto.randomUUID() }, signal)
      const publish=async(signal?:AbortSignal,permit=()=>{})=>{const next=await write(signal)
        permit()
        if(alive.current&&request===historyRequest.current&&(!reportTarget||reportDocumentCurrent()))flushSync(()=>setSelected(next));return next}
      if(reportTarget)await withVerifiedReportPublication(reportTarget,permit=>publish(undefined,permit))
      else await withMutationGate(publish)
    } catch (e) { if (request === historyRequest.current) { setSelected(null); setError(e instanceof Error ? e.message : 'Report could not be verified') } }
  }
  async function remove(record: DurableRecord) {
    mock?.retireReturnIntent()
    const target = historyHeading.current
    setDeletionStatus(''); restoreHistoryFocus.current = null
    const completeChange = announceChange(); historyRequest.current++; comparisonRequest.current++; setComparison(null); setSelected(null); setHistory(null)
    try { await withMutationGate(signal => store!.delete(record.header.identity.sessionId, Date.now(), signal)); await refreshHistory(); restoreHistoryFocus.current = target; setDeletionStatus('Result deleted. A small record of the sequence used is kept, so it is not offered as unseen.') }
    catch (e) { await refreshHistory(); setError(e instanceof Error ? e.message : 'Deletion failed'); restoreHistoryFocus.current = target; setDeletionStatus('Deletion could not be confirmed. Check the saved history before trying again.') }
    finally { completeChange() }
  }
  async function deleteAll() {
    mock?.retireReturnIntent()
    const target = historyHeading.current
    setDeletionStatus(''); restoreHistoryFocus.current = null
    const completeChange = announceChange(); historyRequest.current++; comparisonRequest.current++; setComparison(null); setSelected(null); setHistory(null)
    try { await withMutationGate(signal => store!.deleteAll(signal)); const replacement = await (mock||reportTarget?BalloonsStore.openForMock(undefined,!reportTarget):BalloonsStore.open()); setStore(replacement); setHistory(await replacement.read()); setError(''); restoreHistoryFocus.current = target; setDeletionStatus('All Balloons data deleted. Local sequence exposure has been cleared; earlier use can no longer be known.') }
    catch (e) { await refreshHistory(); setError(e instanceof Error ? e.message : 'Deletion failed'); restoreHistoryFocus.current = target; setDeletionStatus('Deletion could not be confirmed. Check the saved history before trying again.') }
    finally { completeChange() }
  }
  const c = view.record?.snapshot.core, interactive = view.mode === 'playing'
  if(reportTarget&&(step!=='history'||!selected))return <Shell onLibrary={onLibrary}><div ref={root} className="journey balloons-journey"><section className="panel"><h1>Saved Balloons report</h1><p role={error?'alert':'status'}>{error||'Checking the exact retained result…'}</p><button onClick={onLibrary}>Return to mock</button></section></div></Shell>
  return <Shell onLibrary={() => {startNavigation.current++;controller.current?.dispose(); onLibrary() }}><div ref={root} className="journey balloons-journey">
    {error && <p role="alert">{error}</p>}
    {step === 'guide' && <AssessmentUsageNotice />}
    {step === 'guide' && <section className="panel"><p className="eyebrow">Balloons · Practice</p><h1 tabIndex={-1}>Balloons</h1><QuickRules rules={['Pump to add 5 cents, or Collect to keep this balloon’s amount.', 'If it bursts, you lose only this balloon’s uncollected amount. Earlier collections stay yours.', 'Complete 39 untimed balloons. The three colours behave differently; earlier bursts cannot tell you the next exact burst point.']} note={'All money is simulated. At 32 successful pumps, collection is automatic.'}/><div className="actions"><button onClick={() => moveIntroStep('quiz')}>Continue</button></div><details className="start-options"><summary>Examples and saved results</summary><div className="actions"><button className="secondary" onClick={() => moveIntroStep('demo')}>See an example</button><button className="secondary" onClick={historyView}>Saved results</button>{skipAvailable&&<button className="secondary" onClick={()=>{void skipTutorial()}}>Skip instructions</button>}<p>{GUIDE}</p><p>{EMPLOYER}</p></div></details></section>}
    {step === 'demo' && <section className="panel"><h1 tabIndex={-1}>Worked balloon example</h1><p>This separate example is unscored and uses no scored sequence. Pump twice, then collect.</p>
      <BalloonIdentity type="Type 1" successfulPumps={Math.min(demo, 2)} outcome={demo === 3 ? 'voluntary_collect' : null} reducedMotion={settings.reducedMotion} showIdentity={false} /><p>Current: {demo < 3 ? demo * 5 : 0} cents. Banked: {demo === 3 ? 10 : 0} cents.</p><p role="status">{demo === 3 ? 'Two successful pumps made 10 cents. Collect banked those 10 cents.' : `${demo} successful pumps.`}</p>
      <button disabled={demo >= 2} onClick={() => setDemo(n => n + 1)}>Pump example</button><button disabled={demo !== 2} onClick={() => setDemo(3)}>Collect example</button>
      {demo === 3 && <button onClick={() => moveIntroStep('quiz')}>Check my understanding</button>}</section>}
    {step === 'quiz' && <section className="panel"><h1 tabIndex={-1}>Check your understanding</h1><form onSubmit={e => { e.preventDefault(); if(answers[0]===0&&answers[1]===1){skipSource.current=null;setSubmitted(false);moveIntroStep('ready')}else setSubmitted(true) }}>
      <fieldset disabled={submitted}><legend>Two successful pumps build 10 cents. The next pump bursts the balloon. You banked 15 cents earlier. What is lost?</legend>
        <label><input type="radio" name="balloons-rule" checked={answers[0]===0} onChange={()=>setAnswers([0,1])}/> Only this balloon’s 10 cents. The earlier 15 cents stays banked. Earlier bursts do not reveal the next exact burst point.</label>
        <label><input type="radio" name="balloons-rule" checked={answers[0]===1} onChange={()=>setAnswers([1,0])}/> All 25 cents is lost; the last burst fixes the next burst pump.</label></fieldset>
      <button disabled={answers.includes(-1) || submitted}>Check answer</button></form>
      {submitted && <><div role="status"><p>The earlier 15 cents stays banked; earlier bursts cannot reveal the next exact burst pump.</p><p>{answers[0] === 0 && answers[1] === 1 ? 'Correct. Continue to your input check.' : 'Choose the statement that gets both rules right. This check is unscored.'}</p></div>
        {answers[0] === 0 && answers[1] === 1 ? <button onClick={() => {skipSource.current=null;moveIntroStep('ready')}}>Check input and accessibility</button> : <button onClick={() => { setAnswers([-1, -1]); setSubmitted(false) }}>Try again</button>}</>}</section>}
    {step === 'ready' && <section className="panel"><h1 tabIndex={-1}>Try both buttons</h1><p>Select Pump, then Collect to test the controls. This does not count toward your result.</p>
      <div className="balloons-types">{(['Type 1', 'Type 2', 'Type 3'] as const).map(type => <BalloonIdentity key={type} type={type} compact reducedMotion={settings.reducedMotion} />)}</div>
      {['Pump', 'Collect'].map(name => <button key={name} onClick={() => {startNavigation.current++;setTested(old => [...new Set([...old, name])])}}>{name}</button>)}<p role="status">Ready: {tested.join(' and ') || 'try both buttons above'}.</p>
      <details className="start-options"><summary>Accessibility settings</summary><label><input type="checkbox" checked={settings.verbose} onChange={e => { startNavigation.current++;setSettings({ ...settings, verbose: e.target.checked }); setTested([]) }} /> Announce each successful pump, as well as round starts and outcomes</label>
      <label><input type="checkbox" checked={settings.reducedMotion} onChange={e => { startNavigation.current++;setSettings({ ...settings, reducedMotion: e.target.checked }); setTested([]) }} /> Reduced motion</label>
      <p>Text and patterns identify the colours. Settings stay fixed during this attempt.</p></details>
      <p>{mock?'Keep this tab open. Leaving ends this mock attempt.':'If interrupted, reopen this page to check your saved progress.'}</p>
      <p>Start opens the first balloon. Wait for each choice to save.</p><button disabled={tested.length !== 2 || !store} onClick={() => void start()}>Start</button></section>}
    {step === 'run' && <>
      {view.mode === 'report' && view.record ? <><BalloonsReport record={view.record} comparisonText={reportComparisonText} onReplay={() => { void (mock?mock.retry():Promise.resolve()).then(()=>replay()).catch(cause=>setMockError(cause instanceof Error?cause.message:'The old Balloons attempt needs checking.')) }} onHistory={historyView} onTraining={() => trainingView(view.record!)} onComparison={() => openComparison(view.record!)} readOnly={!!reportTarget} onBack={onLibrary} />
        {mockError && <p role="alert">{mockError}</p>}{mockReady && mock && <button data-mock-return-intent onClick={() => void mock.continue().catch(cause => setMockError(cause instanceof Error ? cause.message : 'Continue could not be confirmed.'))}>Continue mock</button>}</> : <section className="panel">
        <h1 tabIndex={-1}>{view.mode === 'explanation' ? 'Your Balloons retest' : view.record?.header.retest ? 'Balloons retest' : 'Balloons practice'}</h1>
        {view.record && <p>Form {view.record.header.formId} · {mock?`Full mock RP attempt${view.record.header.repeat?' · Previously used form':''}`:view.record.header.repeat ? 'Previously used sequence' : view.record.header.retest ? `Retest for baseline ${view.record.header.retest.baselineFormId}` : 'Standalone practice'}{!['uncertain', 'write_failed'].includes(view.mode) && !view.record.snapshot.comparisonEligible ? mock ? ' · Interrupted mock attempt, review only' : view.record.header.retest ? ' · Review only; not eligible to complete a training chain' : ' · Review only; not eligible as a baseline' : ''}</p>}
        <p role={['unsaved', 'write_failed', 'uncertain', 'error'].includes(view.mode) ? 'alert' : 'status'}>{view.message}</p>
        {view.mode === 'explanation' && view.record?.header.retest && <>
          <p>This is a new 39-round TraitGame sequence with the same rules, Type mapping and settings as your baseline. Each successful pump adds five simulated cents. Collect secures this balloon’s amount; a burst loses only its uncollected amount. After 32 successful pumps, collection is automatic.</p>
          <p>Form {view.record.header.formId} is reserved for 30 minutes from opening this explanation, until {new Date(view.record.header.retest.expiresAtMs).toLocaleTimeString()}. Leaving before display is armed releases it. Once display may have occurred, it cannot be treated as unseen.</p>
          <p>Sequence difficulty and ordinary variation may affect the outcome. This is not evidence that the exercise caused improvement. A saved comparison is available after a valid completion and fresh chain check.</p>
          <button onClick={() => void controller.current?.startRetest()}>Start 39-round retest</button>
        </>}
        {['uncertain', 'write_failed'].includes(view.mode) && <button onClick={() => void controller.current?.checkSaveStatus()}>Check save status</button>}
        {view.mode === 'verified_completion' && <button onClick={historyView}>Review saved completion in history</button>}
        {c && ['playing', 'mounting', 'saving'].includes(view.mode) && view.record && ['presentation_armed', 'active', 'resolved', 'completed', 'committing_action'].includes(view.record.snapshot.phase) && <div ref={display} className="balloons-play" aria-busy={!interactive}>
          <p className="balloons-round">Round {c.round} of 39</p><BalloonIdentity key={`${view.record.header.identity.sessionId}:${c.round}`} type={typeFor(view.record!)} successfulPumps={c.current.successfulPumps} outcome={c.status === 'active' ? null : c.results.at(-1)!.outcome} reducedMotion={view.record.header.settings.reducedMotion} /><div className="balloons-balances"><p className="lead">Current: <strong>{money(c.current.currentCents)}</strong></p><p>Previously banked: <strong>{money(c.bankedCents)}</strong></p></div>
          <div className="balloons-actions"><button data-control="pump" disabled={!interactive || c.status !== 'active'} onClick={e => click('pump', e)}>Pump</button><button data-control="collect" disabled={!interactive || c.status !== 'active'} onClick={e => click('collect', e)}>Collect</button></div>
          {c.status !== 'active' && <><p>{outcomeText(view.record!)}</p>{c.status === 'completed' ? <button data-next disabled={!interactive} onClick={() => void controller.current?.report()}>View report</button> : <button data-next disabled={!interactive} onClick={e => click('next', e)}>Next balloon</button>}</>}
        </div>}
        {['paused', 'unsaved'].includes(view.mode) && view.record && <><p>Last visible committed state: round {view.record.snapshot.core.round}, {view.record.snapshot.core.current.successfulPumps} successful pumps, {money(view.record.snapshot.core.bankedCents)} banked. {view.record.header.retest ? 'Unconfirmed or unsaved work cannot complete this training chain.' : 'Unconfirmed or unsaved work cannot establish a baseline.'}</p>{mock ? <button data-mock-return-intent onClick={onLibrary}>Return to mock</button> : view.record.snapshot.phase === 'released' && view.record.header.retest ? <button onClick={() => retest(view.record!.header.retest!.baselineSessionId)}>Reopen retest explanation</button> : view.record.snapshot.core.status === 'completed' ? <button onClick={historyView}>Review saved completion in history</button> : <button onClick={() => resume(view.record!)}>Check and resume saved session</button>}</>}
        {['paused', 'unsaved'].includes(view.mode) && view.record?.header.retest && !view.record.snapshot.comparisonEligible && view.record.snapshot.exposure !== 'released_unseen' && <button onClick={() => retest(view.record!.header.retest!.baselineSessionId, undefined, true)}>Open explanation for a fresh retest attempt</button>}
        <div ref={liveRegion} aria-live="polite" aria-atomic="true" className="sr-only" />
        <button className="secondary" onClick={historyView}>Pause and open history</button>
      </section>}
    </>}
    {step === 'training' && store && <TrainingJourney store={store} baselineSessionId={trainingBaseline} onHistory={historyView} onRetest={(recordId, fresh) => retest(trainingBaseline, recordId, fresh)} />}
    {step === 'comparison' && (comparison?.status === 'ready' ? <BalloonsComparison comparison={comparison} onHistory={historyView} onCheck={() => void refreshComparison()} /> : <section className="panel"><h1 tabIndex={-1}>Baseline and retest</h1><p role={comparison?.status === 'unavailable' ? 'alert' : 'status'}>{comparison?.status === 'unavailable' ? comparison.reason : 'Checking current saved baseline, drill, retest and chain…'}</p><button onClick={() => void refreshComparison()}>Recheck saved comparison</button><button className="secondary" onClick={historyView}>Balloons history</button></section>)}
    {step === 'history' && <>{history && selected ? <BalloonsReport record={selected} comparisonText={reportComparisonText} onReplay={() => replay()} onHistory={() => {mock?.retireReturnIntent();setSelected(null)}} onTraining={() => trainingView(selected)} onComparison={() => openComparison(selected)} readOnly={!!reportTarget} onBack={onLibrary} /> : <section className="panel"><h1 ref={historyHeading} tabIndex={-1}>Balloons history</h1><p>Saved only in this browser. Deleting a result keeps a small record that the sequence was used, so it is not offered as unseen.</p>
      <p role="status" aria-atomic="true">{deletionStatus}</p>
      {!history ? <p role="status">Checking saved history…</p> : <><p>{Object.keys(history.records).length} saved attempts.</p>
        {Object.values(history.records).toSorted((a, b) => b.header.created.wallTimeMs - a.header.created.wallTimeMs).map(r => <article className="balloons-history-item" key={r.header.identity.sessionId}><h2>{r.header.formId} · {r.header.repeat ? 'Previously used sequence' : r.header.retest ? `Retest for ${r.header.retest.baselineFormId}` : 'Standalone practice'}</h2><p>{historyLabel(r)}</p>
          {r.snapshot.phase === 'completed' ? <button onClick={() => void openSavedReport(r)}>Open saved report</button> : r.snapshot.phase !== 'released' && <button onClick={() => resume(r)}>Resume saved session</button>}
          {r.header.retest && r.snapshot.phase === 'completed' && <button onClick={() => openComparison(r)}>Open saved comparison</button>}
          <button className="secondary" onClick={() => void remove(r)}>Delete this result</button></article>)}
        <p>Delete all Balloons data clears results, chains and local sequence exposure. Earlier use can no longer be known; a future sequence may be one you have already seen.</p><button className="secondary" onClick={() => void deleteAll()}>Delete all Balloons data</button></>}
      <button onClick={() => replay()}>Practise again</button><button className="secondary" onClick={() => replay('new_baseline')}>Start a new training baseline</button><p>Uses a sequence not yet recorded as started in this browser.</p>
    </section>}</>}
  </div></Shell>
}
function typeFor(record: DurableRecord): VisibleType { const c = record.snapshot.core; return (Object.keys(c.identity.mapping) as VisibleType[]).find(t => c.identity.mapping[t] === c.manifest.rounds[c.round - 1].profile)! }
function outcomeText(record: DurableRecord) { const r = record.snapshot.core.results.at(-1)!; return r.outcome === 'burst' ? `Burst. ${r.lostCents} cents lost on this balloon; earlier banked money remains.` : `${r.outcome === 'cap_collect' ? 'Automatic cap collection' : 'Collected'}: ${r.bankedCents} cents.` }
function historyLabel(r: DurableRecord) { if (r.snapshot.phase === 'completed') return `Saved · 39/39 rounds · ${durableBaseline(r) ? 'valid standalone baseline' : r.snapshot.comparisonEligible ? 'intact practice result' : 'review only'}`; return `${r.snapshot.core.results.length}/39 resolved · ${r.snapshot.exposure === 'pending_exposure' || r.snapshot.exposure === 'released_unseen' ? 'No scored display armed' : r.snapshot.exposure === 'exposure_uncertain' ? 'Exposure uncertain; never treated as unseen' : 'Sequence exposed'} · ${r.snapshot.phase}` }
