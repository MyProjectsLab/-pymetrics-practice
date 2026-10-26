import { KeypressesLiveDisplay } from './LiveDisplay'
import { KeypressesActionCue } from './ActionCue'
import { QuickRules } from '../onboarding/QuickRules'
import { ReportSummary } from '../reports/Summary'
import { keypressFeedback } from '../reports/feedback'
import { AssessmentUsageNotice } from '../assessment-usage/Notice'
import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { Shell } from '../core/Shell'
import { KeypressesBrowserRun } from './browser-run'
import type { RunSnapshot } from './browser-run'
import { SPEC_VERSION, validSelectedCode } from './core'
import type { Hand, Profile, Setup, State } from './core'
import { report } from './report'
import { CHANGE_CHANNEL, KeypressesStore } from './storage'
import type { StoredAttempt } from './storage'
import './keypresses.css'
import type { MockJourneyContext } from '../mock/journey-context'
import type { ReportTarget } from '../mock/report-route'
import { reportDocumentCurrent, withVerifiedReportPublication } from '../mock/report-route'
import { readInputReceipt, storeNativeKeyProof } from '../core/inputCheckReceipt'

type Step = 'guide' | 'example' | 'quiz' | 'setup' | 'ready' | 'run' | 'history' | 'saved_report'
type HistoryEntry = StoredAttempt & { result: ReturnType<typeof report> }
const initialSnapshot: RunSnapshot = { state: null, saveStatus: 'idle', message: '' }
const LIMITATION = 'These are key presses recorded by this browser during this TraitGame task. Keyboard, device and display behavior can affect timing. This result does not measure a stable trait or predict a hiring outcome.'
const INVALIDATION_COPY: Record<NonNullable<ReturnType<typeof report>>['invalidationReason'] & string, string> = {
  go_timeout: 'GO was not confirmed within the timing limit.',
  end_timeout: 'END was not confirmed within the timing limit.',
  deadline_delay: 'The scored window ended after a timing delay.',
  frame_gap: 'The game display was interrupted by a timing gap.',
  hidden: 'The game window became hidden.',
  blur: 'The game window lost focus.',
  freeze: 'The page was suspended during play.',
  resize: 'The game window changed size during play.',
  settings_changed: 'The input or accessibility settings changed during play.',
  ownership_lost: 'Another tab took control of the game.',
  reload: 'The page reloaded during play.',
  navigation: 'The page was left during play.',
  technical_failure: 'A technical problem interrupted the task.',
  implausible_input: 'Not a valid attempt — presses were faster than a person can tap. Try again without holding the key.',
}
function wallTime() { return Date.now() }
function ms(value: number | null) { return value === null ? 'Not available' : `${Math.round(value)} ms` }
function results(state: State, comparison = 'No comparable earlier run is currently verified.') {
  const value = report(state)
  if (!value) return <p role="alert">This attempt could not be reconciled. No result is available.</p>
  return <div className="panel">
    <h2>Your Keypresses result</h2>
    <p><strong>{value.status === 'valid' ? 'Valid practice attempt' : 'Invalid practice attempt'}</strong></p>
    {value.status === 'valid' ? <ReportSummary feedback={keypressFeedback(value)} /> : <p>This attempt is for review only. It is not a valid result or progress record.</p>}
    <p>Interruption: {value.invalidationReason ? INVALIDATION_COPY[value.invalidationReason] : 'No interruption was recorded.'}</p>
    <details><summary>Detailed numbers</summary>
    <p>{comparison}</p>
    <dl className="keypresses-metrics">
      <div><dt>First accepted press after GO</dt><dd>{ms(value.firstPressMs)}</dd></div>
      <div><dt>Time to 40 presses</dt><dd>{value.targetReached ? ms(value.targetTimeMs) : 'Target not reached within 15 seconds'}</dd></div>
      <div><dt>Rate after first response</dt><dd>{value.ratePerSecond === null ? 'Insufficient presses' : `${(Math.round(value.ratePerSecond * 10) / 10).toFixed(1)} presses per second across ${value.intervalCount} intervals over ${ms(value.responseDurationMs)}`}</dd></div>
      <div><dt>Median press interval</dt><dd>{ms(value.medianIntervalMs)}</dd></div>
      <div><dt>Interval IQR</dt><dd>{ms(value.iqrIntervalMs)}</dd></div>
      <div><dt>Before GO</dt><dd>{value.earlyCount}</dd></div>
      <div><dt>After the scored window ended, before END appeared</dt><dd>{value.boundaryCount}</dd></div>
      <div><dt>After END, within one second</dt><dd>{value.lateCount}</dd></div>
    </dl>
    <p>Response key: {value.selectedKey === 'Space' ? 'Space' : `${value.selectedKey} (modified key)`}. Declared hand: {value.hand}. Input method: {value.inputProfile.replaceAll('_', ' ')}.</p>
    {value.specificationVersion==='keypresses_spec_v1_0_1'&&<p>This is an earlier Keypresses result. That version counted keydowns; it stays under its original rules and is not compared with current runs.</p>}
    {value.inputProfile !== 'standard_physical' && <p>Timing may include delay from the input method used.</p>}
    </details>
    <p className="note">{LIMITATION}</p>
  </div>
}

export function KeypressesJourney({ onLibrary, mock, reportTarget }: { onLibrary: () => void; mock?: MockJourneyContext; reportTarget?: ReportTarget }) {
  const [step, setStep] = useState<Step>('guide')
  const [store, setStore] = useState<KeypressesStore | null>(null)
  const [storageError, setStorageError] = useState('')
  const [error, setError] = useState('')
  const [exampleCount, setExampleCount] = useState(0)
  const [quizChoice, setQuizChoice] = useState('')
  const quizChoiceRef=useRef(quizChoice)
  quizChoiceRef.current=quizChoice
  const [quizSubmitted, setQuizSubmitted] = useState(false)
  const [skipAvailable, setSkipAvailable] = useState(false)
  const skipSource = useRef<{ sessionId: string; key: string; profile: Profile; hand: Hand } | null>(null)
  const beginPending = useRef(false)
  const [hand, setHand] = useState<Hand>('either')
  const [profile, setProfile] = useState<Profile>('standard_physical')
  const [selectedKey, setSelectedKey] = useState('Space')
  const [inputChecked, setInputChecked] = useState(false)
  const [inputOrigin, setInputOrigin] = useState<'fresh'|'reused'|null>(null)
  const [capturing, setCapturing] = useState<'change' | 'check' | null>(null)
  const [inputMessage, setInputMessage] = useState('')
  const [pendingSetup, setPendingSetup] = useState<Setup | null>(null)
  const [snapshot, setSnapshot] = useState<RunSnapshot>(initialSnapshot)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [comparison, setComparison] = useState('No comparable earlier run is currently verified.')
  const [selected, setSelected] = useState<HistoryEntry | null>(null)
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false)
  const [reportUnavailable, setReportUnavailable] = useState(false)
  const [mockReady, setMockReady] = useState(false)
  const [mockChecking, setMockChecking] = useState(false)
  const [mockError, setMockError] = useState('')
  const mockTerminalSeen = useRef<string | null>(null)
  const run = useRef<KeypressesBrowserRun | null>(null)
  const presentation = useRef<HTMLDivElement>(null)
  const capture = useRef<HTMLDivElement>(null)
  const captureOrigin = useRef<HTMLButtonElement | null>(null)
  const captureDown = useRef<KeyboardEvent | null>(null)
  const preparation = useRef<{epoch:number;step:Step;key:string;profile:Profile;hand:Hand;capture:'change'|'check'|null}>({epoch:0,step:'guide',key:'Space',profile:'standard_physical',hand:'either',capture:null})
  function retirePreparation(){preparation.current.epoch++;captureDown.current=null}
  function moveStep(next:Step){retirePreparation();preparation.current.step=next;setStep(next)}
  const heldSelected = useRef(false)
  const completedHeading = useRef<HTMLHeadingElement>(null)
  const root = useRef<HTMLDivElement>(null)
  const alive = useRef(true)
  const armEpoch = useRef(0)
  const authorityRequest = useRef(0)
  const liveView = useRef<{ sessionId: string; viewId: string; wallMs: number } | null>(null)
  const liveViewRecorded = useRef<string | null>(null)
  const liveViewPending = useRef<string | null>(null)
  const historyView = useRef<{ sessionId: string; viewId: string; wallMs: number | null } | null>(null)
  const historyViewRecorded = useRef<string | null>(null)
  const historyViewPending = useRef<string | null>(null)
  useEffect(() => {
    alive.current = true
    const pageExit=()=>{retirePreparation();mock?.retireReturnIntent();armEpoch.current++;void run.current?.dispose()}
    window.addEventListener('pagehide',pageExit)
    void (mock||reportTarget?KeypressesStore.openForMock(undefined,!reportTarget):KeypressesStore.open()).then(value => { if (alive.current) setStore(value) })
      .catch(() => { if (alive.current) setStorageError('Saved Keypresses data could not be opened or verified in this browser.') })
    return () => { retirePreparation();mock?.retireReturnIntent();alive.current = false;armEpoch.current++;window.removeEventListener('pagehide',pageExit);void run.current?.dispose() }
  }, [])
  useEffect(()=>{
    if(!reportTarget||!store)return
    let live=true
    void withVerifiedReportPublication(reportTarget,async permit=>{const entries=await store.history()
      const selected=entries.find(item=>item.sessionId===reportTarget.attemptId)
      if(!selected?.result||store.installationId!==reportTarget.reference.installationId)throw Error('The exact saved result is unavailable.')
      permit()
      if(live&&reportDocumentCurrent())flushSync(()=>{historyView.current={sessionId:selected.sessionId,viewId:crypto.randomUUID(),wallMs:null}
        setReportUnavailable(true);setSelected(selected);moveStep('saved_report')})
    }).catch(()=>{if(live){setSelected(null);setError('The exact saved result could not be checked.')}})
    return()=>{live=false}
  },[store,reportTarget])
  useEffect(() => { if (capturing) capture.current?.focus() }, [capturing])
  useEffect(() => {
    if (!store || step!=='guide') return
    let active=true,pending=false
    const check=()=>{if(pending||document.hidden||!document.hasFocus())return;pending=true;void store.history().then(entries=>{
      if(active)setSkipAvailable(entries.some(entry=>entry.completedAtMs!==null && entry.result?.status==='valid' &&
        entry.state.specificationVersion===SPEC_VERSION&&entry.state.setup.selectedKey===selectedKey&&
        entry.state.setup.profile===profile&&entry.state.setup.hand===hand))
    }).catch(()=>{if(active)setSkipAvailable(false)}).finally(()=>{pending=false})}
    check();const timer=window.setInterval(check,1000)
    return ()=>{active=false;window.clearInterval(timer)}
  },[store,step,selectedKey,profile,hand])
  useEffect(() => {
    if (step !== 'setup' || profile !== 'standard_physical') return
    let active=true
    void readInputReceipt([selectedKey], 'standard').then(receipt=>{
      if (!active || !receipt || captureDown.current) return
      setInputChecked(true);setInputOrigin('reused');setInputMessage(`Your earlier press and release of ${selectedKey} in this tab is available.`)
    })
    return ()=>{active=false}
  },[step,profile,selectedKey])
  useEffect(() => {
    heldSelected.current = false
    const down = (event: KeyboardEvent) => { if (event.code === selectedKey) heldSelected.current = true }
    const up = (event: KeyboardEvent) => {
      if (event.code !== selectedKey) return
      heldSelected.current = false
      setError(previous => previous.startsWith('Release the selected key') ? '' : previous)
    }
    window.addEventListener('keydown', down, true)
    window.addEventListener('keyup', up, true)
    return () => { window.removeEventListener('keydown', down, true); window.removeEventListener('keyup', up, true) }
  }, [selectedKey])
  useEffect(() => { if (step !== 'run') root.current?.querySelector<HTMLElement>('h1')?.focus() }, [step])
  useEffect(() => {
    if (step !== 'run' || !pendingSetup || !store || !presentation.current || run.current) return
    const controller = new KeypressesBrowserRun(store, presentation.current, value => { if (alive.current) {
      if (value.state && ['completed', 'invalid'].includes(value.state.phase)) setReportUnavailable(true)
      setSnapshot(value)
    } })
    controller.usageContext = mock ? 'mock' : 'practice'
    run.current = controller
    void controller.start(pendingSetup).catch(cause => {
      if (!alive.current || run.current !== controller) return
      setError(cause instanceof Error ? cause.message : 'Keypresses could not start')
      run.current = null; setPendingSetup(null); moveStep('ready')
    })
  }, [step, pendingSetup, store, mock])
  function leave() { retirePreparation();armEpoch.current++;void run.current?.dispose(); run.current = null; onLibrary() }
  async function restart() {
    mock?.retireReturnIntent()
    try { armEpoch.current++;await run.current?.dispose();run.current=null;if(mock)await mock.retry()
      setSnapshot(initialSnapshot);setPendingSetup(null);setMockReady(false);setMockError('');setError('');moveStep('ready')
    }catch(cause){setMockError(cause instanceof Error?cause.message:'The old attempt needs checking before retry.')}
  }
  function captureKey(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Tab') return
    event.preventDefault(); event.stopPropagation()
    if (event.key === 'Escape') {
      retirePreparation();preparation.current.capture=null
      setCapturing(null); setInputMessage('Key capture canceled.')
      queueMicrotask(() => captureOrigin.current?.focus())
      return
    }
    if (!event.nativeEvent.isTrusted) { setInputMessage('Press the selected key on your keyboard.'); return }
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.nativeEvent.isComposing) {
      setInputMessage('Release modifier keys, then press one response key.'); return
    }
    if (capturing === 'change') {
      if (!validSelectedCode(event.code)) { setInputMessage('Choose an unmodified letter, digit, punctuation key, or Space.'); return }
      retirePreparation();preparation.current.key=event.code;preparation.current.capture=null;setSelectedKey(event.code); setInputChecked(false);setInputOrigin(null); setInputMessage(`Selected ${event.code}. Run the input check next.`); setCapturing(null)
      queueMicrotask(() => captureOrigin.current?.focus())
    } else if (capturing === 'check') {
      captureDown.current=event.code===selectedKey && !event.repeat && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey ? event.nativeEvent : null
      if (!captureDown.current) setInputMessage(`Press and release ${selectedKey} without holding a modifier key.`)
    }
  }
  async function releaseCaptureKey(event: React.KeyboardEvent<HTMLDivElement>) {
    if (capturing!=='check') return
    const down=captureDown.current;captureDown.current=null
    if (!down || event.code!==selectedKey || !event.nativeEvent.isTrusted || event.nativeEvent.repeat) return
    const ticket=preparation.current.epoch,key=preparation.current.key,profileAtRelease=preparation.current.profile
    if (profile==='standard_physical') {
      const observed=await storeNativeKeyProof('keypresses',down,event.nativeEvent,'standard')
      if (!alive.current || !observed || preparation.current.epoch!==ticket || preparation.current.capture!=='check' || preparation.current.step!=='setup' || preparation.current.key!==key || preparation.current.profile!==profileAtRelease || key!==event.code) return
    }
    if(preparation.current.epoch!==ticket || preparation.current.capture!=='check' || preparation.current.step!=='setup' || preparation.current.key!==key || preparation.current.profile!==profileAtRelease)return
    preparation.current.capture=null;setInputChecked(true);setInputOrigin('fresh');setInputMessage(`Press and release of ${key} confirmed.`);setCapturing(null)
    queueMicrotask(() => captureOrigin.current?.focus())
  }
  async function begin() {
    if (!store || !inputChecked || beginPending.current) return
    beginPending.current=true
    try {
    const skip = skipSource.current, entryStep = preparation.current.step, entryKey=selectedKey, entryProfile=profile, entryHand=hand, ticket=preparation.current.epoch
    const current=()=>alive.current&&preparation.current.epoch===ticket&&preparation.current.step===entryStep&&preparation.current.key===entryKey&&preparation.current.profile===entryProfile&&preparation.current.hand===entryHand
    if (skip) {
      try {
        const entries = await store.history()
        if (!current()) return
        if (skip.key !== selectedKey || skip.profile !== profile || skip.hand !== hand ||
          !entries.some(entry => entry.sessionId === skip.sessionId && entry.completedAtMs !== null &&
            entry.result?.status === 'valid' && entry.state.specificationVersion === SPEC_VERSION &&
            entry.state.setup.selectedKey===entryKey&&entry.state.setup.profile===entryProfile&&entry.state.setup.hand===entryHand)) {
          skipSource.current = null; setSkipAvailable(false); setInputChecked(false); setInputOrigin(null);setQuizChoice('')
          setError('The completed run used to skip the guide is no longer compatible or saved. Check the rule to continue.')
          moveStep('quiz'); return
        }
      } catch {
        if (current()) {
          setQuizChoice('');setError('The completed run used to skip the guide could not be verified. Check the rule to continue.')
          moveStep('quiz')
        }
        return
      }
    }
    if (inputOrigin==='reused' && !(await readInputReceipt([selectedKey], 'standard'))) {
      if(!current())return
      setInputChecked(false);setInputOrigin(null);moveStep('setup');setInputMessage('Check this response key again before starting.');return
    }
    if(!current())return
    if (heldSelected.current) { setError('Release the selected key before starting.'); return }
    const random = crypto.getRandomValues(new Uint8Array(1))[0]
    const setup = { sessionId: crypto.randomUUID(), selectedKey, hand, profile, delayIndex: random & 7 }
    const epoch=armEpoch.current
    if (mock) {
      setMockChecking(true)
      try { await mock.beforeArm({requestId:setup.sessionId,attemptId:setup.sessionId,originTicketId:null,
        installationId:store.installationId,generation:null,requestKind:'start',nativeIdentity:[]}) }
      catch (cause) { setMockError(cause instanceof Error ? cause.message : 'Mock arm could not be confirmed.'); setMockChecking(false); return }
      if(!current()||epoch!==armEpoch.current)return
      setMockChecking(false)
    }
    skipSource.current=null
    setPendingSetup(setup)
    setError(''); setSnapshot(initialSnapshot); moveStep('run')
    } finally { beginPending.current=false }
  }
  async function afterRuleCheck() {
    const choice=quizChoice,ticket=preparation.current.epoch,key=preparation.current.key,profileAtCheck=preparation.current.profile
    setQuizSubmitted(true)
    if (choice!=='between') return
    skipSource.current = null
    const receipt=profile==='standard_physical' ? await readInputReceipt([selectedKey],'standard') : null
    if(!alive.current||preparation.current.epoch!==ticket||preparation.current.step!=='quiz'||preparation.current.key!==key||preparation.current.profile!==profileAtCheck||quizChoiceRef.current!==choice)return
    if (receipt) {setInputChecked(true);setInputOrigin('reused');setInputMessage(`Earlier ${selectedKey} check confirmed in this tab.`);moveStep('ready')}
    else {setInputChecked(false);setInputOrigin(null);moveStep('setup')}
  }
  async function skipTutorial() {
    if (!store) return
    const ticket=preparation.current.epoch,key=preparation.current.key,profileAtSkip=preparation.current.profile,handAtSkip=preparation.current.hand
    const current=()=>alive.current&&preparation.current.epoch===ticket&&preparation.current.step==='guide'&&preparation.current.key===key&&preparation.current.profile===profileAtSkip&&preparation.current.hand===handAtSkip
    try {
      const entries=await store.history()
      if(!current())return
      const source = entries.find(entry=>entry.completedAtMs!==null && entry.result?.status==='valid' &&
        entry.state.specificationVersion===SPEC_VERSION&&entry.state.setup.selectedKey===key&&entry.state.setup.profile===profileAtSkip&&entry.state.setup.hand===handAtSkip)
      if (!source) {setSkipAvailable(false);setError('A current completed Keypresses result is no longer available. Check the rule to continue.');return}
      const receipt=profileAtSkip==='standard_physical' ? await readInputReceipt([key],'standard') : null
      if(!current())return
      skipSource.current = { sessionId: source.sessionId, key, profile:profileAtSkip, hand:handAtSkip }
      if (receipt) {setInputChecked(true);setInputOrigin('reused');moveStep('ready')}
      else {setInputChecked(false);setInputOrigin(null);moveStep('setup')}
    } catch {if(current()){setSkipAvailable(false);setError('Saved Keypresses history could not be checked. Use the rule check instead.')}}
  }
  useEffect(() => {
    if (!mock || !snapshot.state || snapshot.saveStatus !== 'saved' || !['completed','invalid'].includes(snapshot.state.phase) || mockReady || mockChecking || mockTerminalSeen.current === snapshot.state.setup.sessionId) return
    mockTerminalSeen.current = snapshot.state.setup.sessionId
    setMockChecking(true)
    void mock.terminal().then(status => { if (alive.current) { setMockReady(status === 'ready'); setMockError(status === 'review_only' ? 'This attempt needs review. Return to mock to try again or skip this game.' : '') } })
      .catch(cause => { if (alive.current) { mockTerminalSeen.current = null; setMockError(cause instanceof Error ? cause.message : 'Mock result acknowledgement could not be confirmed.') } })
      .finally(() => { if (alive.current) setMockChecking(false) })
  }, [mock, snapshot.state, snapshot.saveStatus, mockReady, mockChecking])
  async function loadHistory() {
    mock?.retireReturnIntent()
    if (!store) return
    try { setHistory(await store.history()); setError(''); moveStep('history') }
    catch { setError('Saved Keypresses history could not be verified. You can still delete all local Keypresses data.') }
  }
  async function remove(id: string) {
    mock?.retireReturnIntent()
    if (!store) return
    try { await store.remove(id, wallTime()); setHistory(await store.history()); setSelected(null); moveStep('history'); setError('Result deleted.') }
    catch { setError('Deletion could not be confirmed. Check history before trying again.') }
  }
  async function deleteAll() {
    mock?.retireReturnIntent()
    setConfirmDeleteAll(false)
    try {
      const deletion = store ?? await KeypressesStore.openForDeletion()
      await deletion.deleteAll()
      const reopened = await (mock||reportTarget?KeypressesStore.openForMock(undefined,!reportTarget):KeypressesStore.open())
      setStore(reopened); setStorageError(''); setHistory([]); setSelected(null); setError('All local Keypresses data were deleted.')
      moveStep('guide')
    } catch { setError('Delete all could not be confirmed. Local data may remain.') }
  }
  const finalState = snapshot.state && ['completed', 'invalid'].includes(snapshot.state.phase)
  useEffect(() => { if (step === 'run' && finalState) completedHeading.current?.focus() }, [step, finalState])
  const displayedState = step === 'saved_report' ? selected?.state : step === 'run' && finalState ? snapshot.state : null
  const displayedId = displayedState?.setup.sessionId
  const requiresSaved = step === 'saved_report' || snapshot.saveStatus === 'saved'
  useEffect(() => {
    if (!store || !displayedState || !displayedId) return
    let active = true, knownDeleted = false
    let channel: BroadcastChannel | null = null
    const check = async () => {
      const request = ++authorityRequest.current
      let settled = false, first = 0, second = 0
      first = requestAnimationFrame(() => { second = requestAnimationFrame(() => {
        if (active && !settled && request === authorityRequest.current) setReportUnavailable(true)
      }) })
      try {
        const publish=async(permit:()=>void=()=>{})=>{
          const root = await store.read()
          const entry = root.records[displayedId]
          const present = !!entry && (JSON.stringify(entry.state) === JSON.stringify(displayedState) ||
            (!requiresSaved && entry.completedAtMs === null && entry.state.setup.sessionId === displayedId))
          if (!active || request !== authorityRequest.current) return
          permit()
          if (!present) { knownDeleted = true; flushSync(()=>{setReportUnavailable(true);setComparison('No comparable earlier run is currently verified.')}) }
          else if (!knownDeleted) {
            const current=entry && report(entry.state)
            const previous=Object.values(root.records).filter(candidate=>candidate.sessionId!==displayedId && candidate.completedAtMs!==null &&
              candidate.createdAtMs<entry.createdAtMs && candidate.state.specificationVersion===entry.state.specificationVersion &&
              candidate.state.scoringVersion===entry.state.scoringVersion && candidate.state.setup.selectedKey===entry.state.setup.selectedKey &&
              candidate.state.setup.profile===entry.state.setup.profile && candidate.state.setup.hand===entry.state.setup.hand &&
              report(candidate.state)?.status==='valid').sort((a,b)=>b.createdAtMs-a.createdAtMs)[0]
            const prior=previous&&report(previous.state)
            const next=current?.status==='valid'&&prior?.status==='valid' ?
              `Your previous comparable run accepted ${prior.acceptedCount} presses; this run accepted ${current.acceptedCount}.` :
              'No comparable earlier run is currently verified.'
            flushSync(()=>{setReportUnavailable(false);setComparison(next)})
          }
        }
        if(reportTarget)await withVerifiedReportPublication(reportTarget,publish)
        else await publish()
      } catch { if (active && request === authorityRequest.current) setReportUnavailable(true) }
      finally { settled = true; cancelAnimationFrame(first); cancelAnimationFrame(second) }
    }
    try { channel = new BroadcastChannel(CHANGE_CHANNEL); channel.onmessage = () => { setReportUnavailable(true); void check() } }
    catch { /* Focus and periodic reads still check authority. */ }
    const timer = window.setInterval(() => { void check() }, 1_000)
    const recheck = () => { void check() }
    window.addEventListener('focus', recheck)
    document.addEventListener('visibilitychange', recheck)
    void check()
    return () => { active = false; clearInterval(timer); channel?.close();
      window.removeEventListener('focus', recheck); document.removeEventListener('visibilitychange', recheck) }
  }, [store, displayedId, displayedState, requiresSaved, reportTarget])
  useEffect(() => {
    if (step !== 'run' || !finalState || reportUnavailable || !displayedId || !store) return
    if (liveView.current?.sessionId !== displayedId)
      liveView.current = { sessionId: displayedId, viewId: crypto.randomUUID(), wallMs: Date.now() }
    const view = liveView.current
    if (snapshot.saveStatus !== 'saved' || liveViewRecorded.current === view.viewId ||
      liveViewPending.current === view.viewId) return
    liveViewPending.current = view.viewId
    void store.recordReportView(view.sessionId, 'live', view.viewId, view.wallMs)
      .then(() => { liveViewRecorded.current = view.viewId })
      .catch(() => { /* The result stays reviewable; this view is never fabricated on reload. */ })
      .finally(() => { if (liveViewPending.current === view.viewId) liveViewPending.current = null })
  }, [step, finalState, reportUnavailable, displayedId, snapshot.saveStatus, store])
  useEffect(() => {
    if (step !== 'saved_report' || reportUnavailable || !selected || !store) return
    const view = historyView.current
    if (!view || view.sessionId !== selected.sessionId || historyViewRecorded.current === view.viewId ||
      historyViewPending.current === view.viewId) return
    // Wait for a verified report render; the Review click can precede authority by seconds.
    const frame = requestAnimationFrame(() => {
      if (historyView.current !== view || !root.current?.querySelector('.keypresses-metrics')) return
      if (view.wallMs === null) view.wallMs = Date.now()
      historyViewPending.current = view.viewId
      void store.recordReportView(view.sessionId, 'history', view.viewId, view.wallMs)
        .then(() => { historyViewRecorded.current = view.viewId })
        .catch(() => { /* A failed local view write does not change the verified result. */ })
        .finally(() => { if (historyViewPending.current === view.viewId) historyViewPending.current = null })
    })
    return () => cancelAnimationFrame(frame)
  }, [step, reportUnavailable, selected, store])
  if(reportTarget&&(step!=='saved_report'||!selected))return <Shell onLibrary={onLibrary}><section className="journey panel"><h1>Saved Keypresses report</h1><p role={storageError||error?'alert':'status'}>{storageError||error||'Checking the exact retained result…'}</p><button onClick={onLibrary}>Return to mock</button></section></Shell>
  return <Shell onLibrary={leave}><div className="journey" ref={root}>
    {step === 'guide' && <div className="journey-top"><button className="secondary" onClick={leave}><span aria-hidden="true">← </span>{mock?'Return to mock':'Main menu'}</button><p>Keypresses · Practice</p></div>}
    {storageError && <div className="panel" role="alert"><p>{storageError}</p><p>Past records are not shown. You may remove all local Keypresses data if you choose.</p>
      <button onClick={() => setConfirmDeleteAll(true)}>Delete all Keypresses data</button>
      <button className="secondary" onClick={() => { setStorageError(''); void (mock||reportTarget?KeypressesStore.openForMock(undefined,!reportTarget):KeypressesStore.open()).then(setStore).catch(() => setStorageError('Storage is still unavailable.')) }}>Try storage again</button></div>}
    {error && <p role="alert">{error}</p>}
    {mockError && !finalState && <p role="alert">{mockError}</p>}
    {confirmDeleteAll && <div className="panel" role="alertdialog" aria-label="Confirm Delete all"><p>Delete all local Keypresses attempts and reports in this browser? This cannot be undone.</p>
      <button onClick={() => void deleteAll()}>Confirm Delete all</button><button className="secondary" onClick={() => setConfirmDeleteAll(false)}>Cancel</button></div>}
    {step === 'guide' && <section className="panel"><p className="eyebrow">How it works</p><h1 tabIndex={-1}>Keypresses</h1><QuickRules rules={['Wait for GO.', 'Press and release your keyboard button repeatedly. Holding it down does not count.', 'Stop at END. The target is 40 presses within 15 seconds.']} note={'Use a physical keyboard for timed practice. Keep this tab open and focused until the result appears.'}/><div className="actions"><button onClick={() => moveStep('quiz')}>Continue</button></div><details className="start-options"><summary>Examples and saved results</summary><div className="actions"><button className="secondary" onClick={() => moveStep('example')}>See an example</button><button className="secondary" disabled={!store} onClick={() => void loadHistory()}>Saved results</button>{skipAvailable&&<button className="secondary" onClick={()=>{void skipTutorial()}}>Skip instructions</button>}</div></details><AssessmentUsageNotice /></section>}
    {step === 'example' && <section className="panel"><h1 tabIndex={-1}>Untimed example</h1><p>Imagine GO is visible. Activate this button three times to practise the repeated action. This example has no timer and does not count toward a result.</p>
      <button onClick={() => setExampleCount(n => Math.min(3, n + 1))}>Press example key</button><p role="status">Example presses: {exampleCount} of 3.</p>
      {exampleCount >= 3 && <button onClick={() => moveStep('quiz')}>Continue</button>}</section>}
    {step === 'quiz' && <section className="panel"><h1 tabIndex={-1}>Check the rule</h1><fieldset><legend>When should you press the chosen key?</legend>
      <label className="choice"><input type="radio" name="kp-quiz" checked={quizChoice === 'between'} onChange={() => {retirePreparation();setQuizChoice('between')}} />Only after GO and before END</label>
      <label className="choice"><input type="radio" name="kp-quiz" checked={quizChoice === 'before'} onChange={() => {retirePreparation();setQuizChoice('before')}} />Before GO and after END</label></fieldset>
      {quizSubmitted && quizChoice !== 'between' && <p role="alert">Wait for GO before pressing, and stop when END appears. Try again.</p>}
      <button onClick={() => { void afterRuleCheck() }} disabled={!quizChoice}>Check answer</button></section>}
    {step === 'setup' && <section className="panel"><h1 tabIndex={-1}>Test your keyboard button</h1><p>Use <kbd>{selectedKey}</kbd> for this assessment. Test it once, then select Start.</p>
      <details className="start-options"><summary>Controls and accessibility</summary>
      <fieldset><legend>Which hand will you use?</legend>{(['left', 'right', 'either'] as const).map(value => <label className="choice" key={value}><input type="radio" name="kp-hand" checked={hand === value} onChange={() => {retirePreparation();preparation.current.hand=value;setHand(value)}} />{value === 'either' ? 'Either or not specified' : value}</label>)}</fieldset>
      <fieldset><legend>Input method</legend><label className="choice"><input type="radio" name="kp-profile" checked={profile === 'standard_physical'} onChange={() => {retirePreparation();preparation.current.profile='standard_physical';setProfile('standard_physical');setInputChecked(false);setInputOrigin(null)}} />Standard physical keyboard</label>
        <label className="choice"><input type="radio" name="kp-profile" checked={profile === 'alternative'} onChange={() => {retirePreparation();preparation.current.profile='alternative';setProfile('alternative');setInputChecked(false);setInputOrigin(null)}} />Alternative or assistive input</label>
        <label className="choice"><input type="radio" name="kp-profile" checked={profile === 'unknown'} onChange={() => {retirePreparation();preparation.current.profile='unknown';setProfile('unknown');setInputChecked(false);setInputOrigin(null)}} />I am not sure</label></fieldset>
      {profile !== 'standard_physical' && <p className="note">You can try this task. The timing report may include delay from your input method and will be labeled separately.</p>}
      <div className="actions"><button className="secondary" onClick={event => { retirePreparation();preparation.current.capture='change';captureOrigin.current = event.currentTarget; setCapturing('change'); setInputMessage('Press the new key once.'); }}>Use a different keyboard button</button></div></details><p className="current-controls">Using {selectedKey}{profile!=='standard_physical'?' · Alternative input':''}{hand!=='either'?` · ${hand} hand`:''}</p><div className="actions"><button onClick={event => { retirePreparation();preparation.current.capture='check';captureOrigin.current = event.currentTarget; setCapturing('check'); setInputMessage(`Press ${selectedKey} once to confirm the browser receives it.`) }}>Test button</button></div>
      {capturing && <div className="key-capture" ref={capture} tabIndex={0} role="group" aria-label="Test keyboard button" onKeyDown={captureKey} onKeyUp={event=>{void releaseCaptureKey(event)}} onBlur={() => {retirePreparation();preparation.current.capture=null;setCapturing(null)}}><p>{capturing === 'change' ? 'Press the new key now.' : `Press and release ${selectedKey} now.`}</p></div>}
      <p role="status">{inputMessage}</p><button onClick={() => void begin()} disabled={!store||!inputChecked||mockChecking}>Start</button>
      {!inputChecked && <p>Test {selectedKey} to enable Start.</p>}</section>}
    {step === 'ready' && <section className="panel"><h1 tabIndex={-1}>Ready for Keypresses?</h1><p>After Start, wait for GO. Press and release <kbd>{selectedKey}</kbd> repeatedly until END; holding it down does not count. The target is 40 accepted presses within 15 seconds.</p>
      <p>Keep this page visible and focused until END and the one-second observation period finish. Presses before GO and after END are reported separately.</p>
      <p className="note">{LIMITATION}</p><div className="actions"><button onClick={() => void begin()} disabled={!store || !inputChecked || mockChecking}>Start</button>
        <button className="secondary" onClick={() => moveStep('setup')}>Review setup</button></div></section>}
    {step === 'run' && <><div className="keypresses-live" hidden={!!finalState} aria-label="Timed Keypresses task"><KeypressesLiveDisplay run={run}><div className="keypresses-signal" ref={presentation} aria-live="assertive" aria-atomic="true" tabIndex={-1}>Preparing…</div><KeypressesActionCue selectedKey={pendingSetup?.selectedKey??selectedKey}/></KeypressesLiveDisplay>
      {!snapshot.state && <button className="secondary" onClick={() => void restart()}>Cancel preparation</button>}</div>
      {finalState && <section><h1 ref={completedHeading} tabIndex={-1}>Keypresses attempt ended</h1><p role="status">{reportUnavailable ? 'Saved status cannot be confirmed because local data may have changed.' : snapshot.message}</p>{reportUnavailable ? <p role="alert">This result is not currently available for review. Its saved authority may have changed.</p> : results(snapshot.state!,comparison)}
        {mockError && <p role="alert">{mockError}</p>}{mock && mockReady && !reportUnavailable && <button data-mock-return-intent disabled={mockChecking} onClick={() => { setMockChecking(true); void mock.continue().catch(cause => { setMockError(cause instanceof Error ? cause.message : 'Continue could not be confirmed.'); setMockChecking(false) }) }}>Continue mock</button>}
        <div className="actions">{snapshot.saveStatus === 'unsaved' && <button onClick={() => void run.current?.retrySave()}>Try saving once more</button>}
          <button onClick={() => void restart()}>Try Keypresses again</button><button className="secondary" data-mock-return-intent={mock ? "" : undefined} onClick={leave}>{mock?'Return to mock':'Back to library'}</button></div></section>}</>}
    {step === 'history' && <section><h1 tabIndex={-1}>Keypresses history</h1><p>Incomplete attempts are review-only. Only saved, reconciled results show report numbers.</p>
      {history.length ? <ul>{history.map(entry => <li key={entry.sessionId}><p>{entry.completedAtMs === null ? 'Incomplete attempt — review only' : entry.result?.status === 'valid' ? 'Saved valid attempt' : 'Saved invalid attempt'}{entry.state.setup.selectedKey !== 'Space' ? ` · Modified key: ${entry.state.setup.selectedKey}` : ''} · {new Date(entry.createdAtMs).toLocaleString()}</p>
        {entry.result && <button onClick={() => { historyView.current = { sessionId: entry.sessionId, viewId: crypto.randomUUID(), wallMs: null }; setReportUnavailable(true); setSelected(entry); moveStep('saved_report') }}>Review result</button>} <button className="secondary" onClick={() => void remove(entry.sessionId)}>Delete this attempt</button></li>)}</ul> : <p>No saved Keypresses attempts in this browser.</p>}
      <div className="actions"><button className="secondary" onClick={() => moveStep('guide')}>Back to Keypresses</button><button className="secondary" onClick={() => setConfirmDeleteAll(true)}>Delete all Keypresses data</button></div></section>}
    {step === 'saved_report' && selected && <section><h1 tabIndex={-1}>{reportUnavailable ? 'Keypresses result unavailable' : 'Saved Keypresses result'}</h1>{reportUnavailable ? <p role="alert">This saved result is no longer available or cannot be verified.</p> : results(selected.state,comparison)}
      <div className="actions">{reportTarget?<button onClick={onLibrary}>Return to mock</button>:<><button onClick={() => { setSelected(null); void loadHistory() }}>Back to history</button><button className="secondary" onClick={() => void remove(selected.sessionId)}>Delete this attempt</button></>}</div></section>}
  </div></Shell>
}
