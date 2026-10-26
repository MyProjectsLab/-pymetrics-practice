import { QuickRules } from '../onboarding/QuickRules'
import { ReportSummary } from '../reports/Summary'
import { choiceFeedback } from '../reports/feedback'
import { AssessmentUsageNotice } from '../assessment-usage/Notice'
import { Attempt } from '../assessment-usage/client'
import type { ArrowsAuthorityHandle, AuthorityStatus } from './authority'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'
import { flushSync } from 'react-dom'
import { Shell } from '../core/Shell'
import { ArrowsBrowserRun } from './browser'
import type { ArrowsRecovery, RecoveryOutcome } from './recovery'
import { ArrowsEntry } from './entry'
import type { InputProfile, PointerSource, State } from './versions'
import { reconcileHeadless } from './versions'
import type { Cohort, HeadlessMetrics } from './report'
import type { HeadlessMetrics as V11Metrics } from './v11/report'
import { ArrowsStore } from './storage'
import type { ArmedAttempt, PersistedSnapshot, StartRequest } from './storage'
import { ArrowsReportPublication } from './report-publication'
import { ArrowsReportSession } from './report-session'
import type { ExclusiveArrowsDocument } from './exclusive-document'
import type { MockJourneyContext } from '../mock/journey-context'
import { withSelectedMockReportPublication } from '../mock/report-route'
import type { ReportTarget as MockReportTarget } from '../mock/report-route'
import { assertArrowsMockReport } from './mock-bridge'
import { readInputReceipt, storeNativeKeyProof } from '../core/inputCheckReceipt'

type Step = 'guide' | 'examples' | 'quiz' | 'setup' | 'ready' | 'run' | 'break' | 'report' | 'history'
type Capture = 'left' | 'right' | 'check-both' | null
type PreparationStep = 'guide' | 'examples' | 'quiz' | 'setup' | 'ready'
const isPreparationStep = (value:Step):value is PreparationStep => ['guide','examples','quiz','setup','ready'].includes(value)
const allowedCode = /^(ArrowLeft|ArrowRight|Space|Key[A-Z]|Digit[0-9]|Numpad[0-9]|Comma|Period|Slash|Semicolon|Quote|BracketLeft|BracketRight|Backslash|Backquote|Minus|Equal)$/
const disclosure = 'This visual timed task is not currently supported with screen-reader interpretation of the arrows. You can use the untimed guide and examples or choose another game.'
const limitation = 'These are responses observed by this browser in a TraitGame sequence. The six forms are not calibrated equivalents. Keyboard, pointer, device and display behavior can affect timing. This report does not measure a stable trait or predict a hiring outcome.'
function keyLabel(code: string) {
  if (code === 'Space') return 'Space bar'
  if (code === 'ArrowLeft') return 'Left arrow key'
  if (code === 'ArrowRight') return 'Right arrow key'
  if (/^Key[A-Z]$/.test(code)) return `${code.slice(3)} key`
  if (/^Digit[0-9]$/.test(code)) return `${code.slice(5)} key`
  if (/^Numpad[0-9]$/.test(code)) return `Number pad ${code.slice(6)}`
  return `${code} key`
}
function time(value: number | null) { return value === null ? 'Not enough clean responses' : `${value} ms` }
function signedTime(value: number | null) { return value === null ? 'Not enough clean responses' : `${value > 0 ? '+' : ''}${value} ms` }
function eventDetail(event: State['events'][number]) {
  if (!['response', 'response_extra', 'boundary_extra'].includes(event.type)) return ''
  const direction = event.detail.direction
  if (direction !== 'left' && direction !== 'right') return ''
  const source = event.detail.source
  return ` · ${direction === 'left' ? 'Left' : 'Right'}${typeof source === 'string' ? ` (${source})` : ''}`
}
function blockCounts(state: State) {
  const block = state.form.trials[state.trialIndex - 1].block - 1
  const size = state.specificationVersion === 'arrows_spec_v1_1' ? 27 : 24
  const start = (block - 1) * size + 1
  let correct = 0, wrong = 0, omitted = 0
  for (let index = start; index < start + size; index++) {
    const direction = state.events.find(event => event.type === 'response' && event.trialIndex === index)?.detail.direction
    if (!state.events.some(event => event.type === 'trial_closed' && event.trialIndex === index)) continue
    if (!direction) omitted++
    else if (direction === state.form.trials[index - 1].direction) correct++
    else wrong++
  }
  return { block, correct, wrong, omitted }
}
function ResultsTable({ metrics }: { metrics: HeadlessMetrics }) {
  const rows: [string, Cohort][] = [
    ['Overall', metrics.overall], ['CENTER', metrics.byRule.center], ['OUTER', metrics.byRule.outer],
    ['Aligned', metrics.byCondition.aligned], ['Opposed', metrics.byCondition.opposed], ['Neutral', metrics.byCondition.neutral],
    ['CENTER aligned', metrics.byCell.center.aligned], ['CENTER opposed', metrics.byCell.center.opposed],
    ['CENTER neutral', metrics.byCell.center.neutral], ['OUTER aligned', metrics.byCell.outer.aligned],
    ['OUTER opposed', metrics.byCell.outer.opposed], ['OUTER neutral', metrics.byCell.outer.neutral],
    ['Rule switch', metrics.switch], ['Rule stay', metrics.stay],
  ]
  return <><div className="table-scroll"><table><caption>Accuracy and browser-observed time by condition</caption>
    <thead><tr><th scope="col">Condition</th><th scope="col">Correct</th><th scope="col">Wrong</th><th scope="col">Omitted</th><th scope="col">Clean median</th><th scope="col">Clean IQR</th></tr></thead>
    <tbody>{rows.map(([label, row]) => <tr key={label}><th scope="row">{label}</th>
      <td>{row.correct}/{row.denominator}{row.correctPercent === null ? '' : ` (${row.correctPercent.toFixed(1)}%)`}</td>
      <td>{row.wrong}/{row.denominator}</td><td>{row.omitted}/{row.denominator}</td>
      <td>{time(row.time.medianDisplayMs)} (n={row.time.cleanCount})</td>
      <td>{row.time.iqrDisplayMs === null ? row.time.reason === 'fewer_than_eight' ? 'Not enough clean responses for variability' : 'Not enough clean responses' : `${row.time.iqrDisplayMs} ms`}</td>
    </tr>)}</tbody></table></div>
    <p>Rule switch minus stay median: {signedTime(metrics.switchMinusStayMs)}. Opposed minus aligned median: {signedTime(metrics.opposedMinusAlignedMs)}. Each difference needs ten clean responses in both groups.</p>
    <p>{metrics.tooEarlyForTiming} response{metrics.tooEarlyForTiming === 1 ? ' was' : 's were'} under 100 ms and excluded from time summaries without changing accuracy.</p>
  </>
}

function V11Results({ metrics }: { metrics: V11Metrics }) {
  const counts = (rows: [string, Cohort][]) => <div className="table-scroll"><table><caption>Responses in this sequence</caption><thead><tr><th>Condition</th><th>Correct</th><th>Wrong</th><th>Omitted</th></tr></thead><tbody>{rows.map(([label, row]) => <tr key={label}><th scope="row">{label}</th><td>{row.correct}/{row.denominator} ({row.correctPercent?.toFixed(1)}%)</td><td>{row.wrong}</td><td>{row.omitted}</td></tr>)}</tbody></table></div>
  const timing = (label: string, row: Cohort) => <p key={label}>{label}: {row.time.medianDisplayMs === null ? 'Not enough clean responses for a time summary' : `${row.time.medianDisplayMs} ms median`}; n={row.time.cleanCount}. {row.time.iqrDisplayMs !== null ? `${row.time.iqrDisplayMs} ms IQR` : row.time.reason === 'fewer_than_eight' ? 'Not enough clean responses for variability' : ''}</p>
  return <>{counts([['Overall', metrics.overall], ['Aligned', metrics.byCondition.aligned], ['Opposed', metrics.byCondition.opposed], ['Neutral', metrics.byCondition.neutral]])}{timing('Overall clean correct-response time', metrics.overall)}
    <details><summary>Response detail</summary>{counts([['Red', metrics.byColor.red], ['Blue', metrics.byColor.blue], ['Black', metrics.byColor.black], ['Rule switch', metrics.switch], ['Rule stay', metrics.stay]])}{([...Object.entries(metrics.byColor), ...Object.entries(metrics.byCondition), ['Rule switch', metrics.switch], ['Rule stay', metrics.stay]] as [string, Cohort][]).map(([label, row]) => timing(label, row))}<p>Switch minus stay: {signedTime(metrics.switchMinusStayMs)}. Opposed minus aligned: {signedTime(metrics.opposedMinusAlignedMs)}.</p></details>
    <p>{metrics.tooEarlyForTiming} responses under 100 ms were excluded from timing.</p></>
}

export function ArrowsJourney({ onLibrary, exclusive, mock, reportTarget }: { onLibrary: () => void; exclusive?: ExclusiveArrowsDocument; mock?: MockJourneyContext; reportTarget?: MockReportTarget }) {
  const usage = useRef(new Attempt('arrows'))
  useEffect(() => { const current=usage.current; return () => current.cancel() }, [])
  const [step, setStep] = useState<Step>('guide')
  const [store, setStore] = useState<ArrowsStore | null>(null)
  const [storageError, setStorageError] = useState('')
  const [unverifiedHistory, setUnverifiedHistory] = useState<Awaited<ReturnType<typeof ArrowsStore.unverifiedHistory>>>([])
  const [error, setError] = useState('')
  const [example, setExample] = useState(0)
  const preparationBack = useRef<Array<{step:PreparationStep;example:number}>>([])
  const preparationStarted = useRef(false)
  const [quiz, setQuiz] = useState<'center' | 'outer' | ''>('')
  const [firstResponseRule, setFirstResponseRule] = useState<'first' | 'last' | ''>('')
  const [canSkip, setCanSkip] = useState(false)
  const skipSource=useRef<{sessionId:string;profile:string}|null>(null)
  const skipChecking=useRef(false)
  const orderedReportsAvailable = typeof navigator !== 'undefined' && !!navigator.locks
  const [mode, setMode] = useState<'keyboard' | 'pointer'>(mock?.preferences.controls === 'alternative' ? 'pointer' : 'keyboard')
  const [leftCode, setLeftCode] = useState('ArrowLeft')
  const [rightCode, setRightCode] = useState('ArrowRight')
  const [checked, setChecked] = useState({ left: false, right: false })
  const [capture, setCapture] = useState<Capture>(null)
  const [setupPanel, setSetupPanel] = useState<'keys' | 'controls' | 'accessibility' | null>(null)
  const [capturedDown, setCapturedDown] = useState<string | null>(null)
  const observedDown = useRef<KeyboardEvent | null>(null)
  const [pointerSource, setPointerSource] = useState<PointerSource | null>(null)
  const [pointerPending, setPointerPending] = useState<{ id: number; direction: 'left' | 'right'; source: PointerSource } | null>(null)
  const [alternative, setAlternative] = useState(mock?.preferences.controls === 'alternative')
  const [spoken, setSpoken] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(mock?.preferences.reducedMotion ?? false)
  const [runState, setRunState] = useState<State | null>(null)
  const [starting, setStarting] = useState(false)
  const [startUncertain, setStartUncertain] = useState(false)
  const [uncertainProfile, setUncertainProfile] = useState<InputProfile | null>(null)
  const [saveStatus, setSaveStatus] = useState<'none' | 'pending' | 'saved' | 'unconfirmed'>('none')
  const [checkpointStatus, setCheckpointStatus] = useState<'none' | 'pending' | 'saved' | 'failed'>('none')
  const [history, setHistory] = useState<readonly ArmedAttempt[]>([])
  const [selected, setSelected] = useState<ArmedAttempt | null>(null)
  const [, setDraftArm] = useState<ArmedAttempt | null>(null)
  const [recoveryOutcome, setRecoveryOutcome] = useState<RecoveryOutcome | null>(null)
  const [reportAuthority, setReportAuthority] = useState<'verified' | 'checking' | 'revoked' | 'review_only'>('verified')
  const [comparison,setComparison]=useState('A comparable earlier run has not been verified for this view.')
  const [mockReady, setMockReady] = useState(false), [mockError, setMockError] = useState('')
  const mockTerminalSeen = useRef<string | null>(null)
  const mockReturnPending = useRef(false)
  const [authorityStatus, setAuthorityStatus] = useState<AuthorityStatus | null>(null)
  const [reportRegister, setReportRegister] = useState<{ revision: number | null; integrity: string; witness: number | null } | null>(null)
  const [reportSurface, setReportSurface] = useState<{ handleId: string; sessionId: string; recoveryKind: 'checkpoint' | 'terminal' | null; generation: number; opening: number; storeGeneration: number } | null>(null)
  const [activityRetry, setActivityRetry] = useState<{ installationId: string; sessionId: string;
    snapshot: PersistedSnapshot; viewId: string; source: 'live' | 'history'; wallMs: number;
    store: ArrowsStore; handle: ArrowsAuthorityHandle; generation: number; opening: number;
    storeGeneration: number } | null>(null)
  const [deleteAllConfirm, setDeleteAllConfirm] = useState(false)
  const run = useRef<ArrowsBrowserRun | null>(null)
  const breakExitRun = useRef<ArrowsBrowserRun | null>(null)
  const display = useRef<HTMLDivElement>(null)
  const journey = useRef<HTMLDivElement>(null)
  const exitAction = useRef<() => void>(() => {})
  const captureTarget = useRef<HTMLDivElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const mounted = useRef(true)
  const terminalChecked = useRef<ArrowsBrowserRun | null>(null)
  const publication = useRef(new ArrowsReportPublication())
  const publicationSuspended = useRef(false)
  const navigationEpoch = useRef(0)
  const liveOpening = useRef<NonNullable<typeof activityRetry> | null>(null)
  const storeRef = useRef<ArrowsStore | null>(null)
  const openedReportTarget=useRef<string|null>(null)
  useEffect(()=>{if(!store||!reportTarget||openedReportTarget.current===reportTarget.attemptId)return;openedReportTarget.current=reportTarget.attemptId;
    void store.loadArmed(reportTarget.attemptId).then(attempt=>{if(!attempt)throw Error('Exact Arrows report unavailable');return openReport(attempt)}).catch(error=>setError(String(error)))
  },[store,reportTarget])
  const storeOpeningEpoch = useRef(0)
  const openingEpoch = useRef(0)
  const activityEpoch = useRef(0)
  const recoverySurface = useRef<{ session: ArrowsReportSession; controller: ArrowsRecovery | null; handle: ArrowsAuthorityHandle;
    store: ArrowsStore; generation: number; opening: number; storeGeneration: number; unsubscribe: () => void } | null>(null)
  const recoveryPublicationEpoch = useRef(0)
  function detachRecovery() {
    recoverySurface.current?.unsubscribe()
    recoverySurface.current = null
    if (mounted.current) { setRecoveryOutcome(null); setAuthorityStatus(null); setReportRegister(null); setReportSurface(null) }
    recoveryPublicationEpoch.current++
  }
  function attached(handle: ArrowsAuthorityHandle, generation: number, opening: number, originalStore: ArrowsStore): boolean {
    const surface = recoverySurface.current
    return mounted.current && navigationEpoch.current === generation && storeRef.current === originalStore &&
      surface?.handle === handle && surface.generation === generation && surface.opening === opening &&
      surface.storeGeneration === originalStore.authority.generation
  }
  /** Every live/released/history report uses this attachment and withdrawal. */
  function attachReport(handle: ArrowsAuthorityHandle, originalStore: ArrowsStore, controller: ArrowsRecovery | null = null, captured?: ArrowsReportSession) {
    const generation = navigationEpoch.current
    const prior = recoverySurface.current
    if (prior?.handle === handle && prior.generation === generation && prior.store === originalStore) {
      if (prior.controller !== controller) throw Error('Arrows report recovery owner changed')
      return prior
    }
    const session = captured ?? new ArrowsReportSession(originalStore, handle, controller, controller ? 'live' : 'history')
    if (session.handle !== handle || session.store !== originalStore || session.controller !== controller) throw Error('Arrows report session changed')
    prior?.unsubscribe()
    const surface = { session, controller, handle, store: originalStore, generation, opening: ++openingEpoch.current,
      storeGeneration: originalStore.authority.generation, unsubscribe: () => {} }
    recoverySurface.current = surface
    setReportSurface({ handleId: handle.id, sessionId: session.id, recoveryKind: controller?.target.kind ?? null, generation, opening: surface.opening, storeGeneration: surface.storeGeneration })
    const owns = () => attached(handle, generation, surface.opening, originalStore)
    const unsubscribeAuthority = handle.subscribe(status => {
      if (!owns()) return
      setReportRegister({ ...originalStore.authority.register(), witness: handle.witnessRevision })
      if (status.kind === 'retired') {
        publication.current.cancel()
        flushSync(() => { setAuthorityStatus(status); setRecoveryOutcome(controller?.outcome() ?? null)
          setSelected(null); setRunState(null); setDraftArm(null); setActivityRetry(null)
          setReportAuthority('revoked'); setSaveStatus('unconfirmed') })
      } else if (status.kind === 'blocked' || status.kind === 'unknown') {
        publication.current.cancel()
        flushSync(() => { setAuthorityStatus(status); setSelected(null); setRunState(null); setDraftArm(null)
          setActivityRetry(null); setReportAuthority('checking'); setSaveStatus('unconfirmed') })
      } else setAuthorityStatus(status)
    })
    const unsubscribeRecovery = controller?.subscribe(outcome => {
      if (!owns() || handle.status().kind !== 'current') return
      if (outcome.kind === 'uncertain') {
        flushSync(() => { setRecoveryOutcome(outcome); setSelected(null); setReportAuthority('review_only'); setSaveStatus('unconfirmed') })
      } else setRecoveryOutcome(outcome)
    })
    surface.unsubscribe = () => { unsubscribeAuthority(); unsubscribeRecovery?.() }
    return surface
  }
  const uncertainStart = useRef<StartRequest | null>(null)

  useEffect(() => {
    mounted.current = true
    const gate = publication.current
    const epoch = ++storeOpeningEpoch.current
    void (mock||reportTarget?ArrowsStore.openForMock(undefined,!reportTarget):ArrowsStore.open()).then(value => { if (mounted.current && epoch === storeOpeningEpoch.current) { storeRef.current = value; setStore(value) } })
      .catch(async () => {
        if (mounted.current && epoch === storeOpeningEpoch.current) setStorageError('Saved Arrows data could not be opened or verified in this browser.')
        try { const labels = await ArrowsStore.unverifiedHistory(); if (mounted.current && epoch === storeOpeningEpoch.current) setUnverifiedHistory(labels) } catch { /* Labels are optional; explicit deletion recovery remains. */ }
      })
    return () => { mock?.retireReturnIntent();mounted.current = false; observedDown.current=null; detachRecovery(); gate.cancel(); run.current?.dispose() }
  }, [])
  useEffect(() => {
    const suspend = () => {
      if(document.visibilityState==='hidden')mock?.retireReturnIntent()
      if (mockReturnPending.current) navigationEpoch.current++
      publicationSuspended.current = true
      publication.current.cancel()
      if (step === 'report' && saveStatus === 'saved')
        flushSync(() => setReportAuthority('checking'))
    }
    const visibility = () => {
      if (document.visibilityState === 'hidden') suspend()
      else publicationSuspended.current = false
    }
    const resume = () => {
      if (document.visibilityState === 'visible') publicationSuspended.current = false
    }
    window.addEventListener('pagehide', suspend)
    window.addEventListener('pageshow', resume)
    window.addEventListener('focus', resume)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      window.removeEventListener('pagehide', suspend)
      window.removeEventListener('pageshow', resume)
      window.removeEventListener('focus', resume)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [step, saveStatus])
  function clearPreparationInput() { observedDown.current=null;setCapturedDown(null);setCapture(null);setPointerPending(null) }
  function prepare(next: Step, remember = true) {
    if (!preparationStarted.current && !starting && !startUncertain && !uncertainStart.current && isPreparationStep(step) && isPreparationStep(next)) {
      if(remember&&step!==next)preparationBack.current.push({step,example})
    } else preparationBack.current=[]
    navigationEpoch.current++
    detachRecovery()
    publication.current.cancel()
    clearPreparationInput()
    if(next==='setup'&&mode==='keyboard'&&(!checked.left||!checked.right))setCapture('check-both')
    setStep(next)
  }
  function backPreparation() {
    if(preparationStarted.current||starting||startUncertain||uncertainStart.current||!isPreparationStep(step))return
    if(step==='examples'&&example>0){prepare('examples',false);setExample(example-1);return}
    const previous=preparationBack.current.pop()
    if(previous){prepare(previous.step,false);setExample(previous.example)}
  }
  function retireSetupChoice(){navigationEpoch.current++;observedDown.current=null;setCapturedDown(null)}
  async function completedForSkip() {
    if (!store) return null
    const attempts = await store.listAttempts()
    return attempts.find(attempt => attempt.snapshot?.kind === 'terminal' &&
      attempt.snapshot.review.status === 'complete_headless' &&
      attempt.state.specificationVersion === 'arrows_spec_v1_1' &&
      JSON.stringify(attempt.profile)===JSON.stringify(profile()))??null
  }
  useEffect(() => {
    if (step !== 'guide' || !store || !orderedReportsAvailable) { setCanSkip(false); return }
    let active = true,pending=false
    const check = () => { if(pending||document.hidden||!document.hasFocus())return;pending=true;void completedForSkip().then(value => { if (active) setCanSkip(!!value) }).catch(() => { if (active) setCanSkip(false) }).finally(()=>{pending=false}) }
    check()
    const timer = window.setInterval(check, 1000)
    return () => { active = false; window.clearInterval(timer) }
  }, [step, store])
  async function skipGuide() {
    const epoch = navigationEpoch.current
    try {
      const source=await completedForSkip()
      if (!source || !mounted.current || epoch !== navigationEpoch.current) { setCanSkip(false); return }
      skipSource.current={sessionId:source.sessionId,profile:JSON.stringify(profile())}
      prepare('setup')
    } catch { setCanSkip(false); setError('A completed saved run could not be confirmed. Check the rule to continue.') }
  }
  useEffect(() => {
    if (step !== 'setup' || mode !== 'keyboard' || alternative || capture) return
    let active = true
    const epoch = navigationEpoch.current
    void readInputReceipt([leftCode, rightCode], 'standard').then(receipt => {
      if (active && epoch === navigationEpoch.current && receipt) setChecked({ left: true, right: true })
    }).catch(() => {})
    return () => { active = false }
  }, [step, mode, alternative, leftCode, rightCode, capture])
  const canPublish = useCallback(() =>
    !publicationSuspended.current && document.visibilityState === 'visible', [])
  useEffect(() => {
    const restored = (event: PageTransitionEvent) => {
      if (!event.persisted) return
      observedDown.current=null;setChecked({ left: false, right: false }); setCapture(null); setCapturedDown(null); setPointerPending(null)
      if (!run.current && (step === 'ready' || step === 'setup')) {
        setStep('setup'); setError('Check both response directions again after returning to this page.')
      }
    }
    window.addEventListener('pageshow', restored)
    return () => window.removeEventListener('pageshow', restored)
  }, [step])
  useEffect(() => { if (step==='setup'&&mode==='keyboard'&&capture) captureTarget.current?.focus() }, [capture,step,mode])
  useEffect(() => { if (step !== 'run'&&!(step==='setup'&&capture)) heading.current?.focus() }, [step,capture])
  useEffect(() => {
    if (!mock || step !== 'report' || saveStatus !== 'saved' || reportAuthority !== 'verified' ||
      !selected?.snapshot || !reportSurface || activityRetry || mockTerminalSeen.current === selected.sessionId) return
    if (selected.snapshot.kind !== 'terminal') return
    const sessionId = selected.sessionId, launchId = mock.launchId, epoch = navigationEpoch.current
    mockTerminalSeen.current = sessionId
    setMockReady(false)
    void mock.terminal().then(status => {
      if (mounted.current && navigationEpoch.current === epoch && mock.launchId === launchId) {
        setMockReady(status === 'ready')
        if (status === 'review_only') setMockError('This attempt needs review. Return to mock.')
      }
    }).catch(() => {
      if (mounted.current && navigationEpoch.current === epoch && mock.launchId === launchId) {
        setMockError('The mock result could not be confirmed. Try Return to mock again, or leave with this result unconfirmed.')
      }
    })
  }, [mock, step, saveStatus, reportAuthority, selected, reportSurface, activityRetry])
  useEffect(() => {
    if (step !== 'break') return
    const update = () => setCheckpointStatus(run.current?.checkpointStatus() ?? 'none')
    update()
    const timer = window.setInterval(update, 150)
    return () => window.clearInterval(timer)
  }, [step])
  useEffect(() => {
    if (step !== 'report' || !store || !selected || saveStatus !== 'saved') return
    const expected = selected.snapshot
    const sessionId = selected.sessionId
    const requestId = selected.requestId
    const ordinal = selected.ordinal
    const key = `report:${sessionId}`
    const gate = publication.current
    const surfaceEpoch = navigationEpoch.current
    const surface = recoverySurface.current
    if (!surface || !surface.handle.matches(selected)) return
    const handle = surface.handle
    const owns = () => attached(handle, surfaceEpoch, surface.opening, store)
    let active = true
    const withdraw = () => {
      if (!active || !mounted.current || surfaceEpoch !== navigationEpoch.current) return
      flushSync(() => { setReportAuthority('revoked'); setSelected(null); setRunState(null)
        setDraftArm(null); setSaveStatus('unconfirmed') })
    }
    const check = () => {
      if (!active || !canPublish() ||
        surfaceEpoch !== navigationEpoch.current) return Promise.resolve(false)
      return gate.run(key,
        signal => store.read(signal),
        root => {
          const retained=root.attempts[sessionId]
          if (!active || !owns() || handle.status().kind !== 'current') return
          if (!retained || retained.requestId !== requestId || retained.ordinal !== ordinal ||
            JSON.stringify(retained.snapshot) !== JSON.stringify(expected)) { withdraw(); return }
          surface.session.assertRecord(retained)
          const complete=retained.snapshot?.kind==='terminal'&&retained.snapshot.review.status==='complete_headless'
          const previous=complete?Object.values(root.attempts).filter(attempt=>attempt.sessionId!==sessionId&&attempt.createdAtWallMs<selected.createdAtWallMs&&attempt.snapshot?.kind==='terminal'&&attempt.snapshot.review.status==='complete_headless'&&attempt.state.specificationVersion===selected.state.specificationVersion&&JSON.stringify(attempt.profile)===JSON.stringify(selected.profile)).sort((a,b)=>b.createdAtWallMs-a.createdAtWallMs)[0]:undefined
          setComparison(previous?.snapshot?.review.metrics ? `Previous compatible saved run: ${previous.snapshot.review.metrics.overall.correct} of ${previous.snapshot.review.presented} trials followed the cue; this run: ${selected.snapshot?.review.metrics?.overall.correct ?? 0} of ${selected.snapshot?.review.presented ?? 0}.` : 'No comparable earlier run is currently verified.')
          // An unchanged background read does not hide or replace the live table.
          flushSync(() => setReportAuthority(current => current === 'verified' ? current : 'verified'))
          if (journey.current?.querySelector(selected.snapshot ? '[data-arrows-published-session]' : '[data-arrows-armed-only-session]')?.getAttribute(selected.snapshot ? 'data-arrows-published-session' : 'data-arrows-armed-only-session') !== sessionId)
            throw Error('Arrows report DOM publication was not confirmed')
        },
        () => {
          if (!active || !mounted.current || surfaceEpoch !== navigationEpoch.current) return
          if (handle.status().kind !== 'retired' && owns()) flushSync(() => setReportAuthority('checking'))
        }, true)
    }
    void check()
    const interval = window.setInterval(() => { void check() }, 1000)
    const unsubscribe = store.subscribeDeletion(notice => {
      if (!active || surfaceEpoch !== navigationEpoch.current) return
      if (notice.installationId !== selected.state.identity.installationId) return
      setComparison('Checking whether an earlier saved run is still available.')
      flushSync(() => setReportAuthority('checking'))
      void check()
    })
    const visible = () => {
      if (!active || surfaceEpoch !== navigationEpoch.current) return
      if (document.visibilityState !== 'visible') {
        gate.cancelKey(key)
        flushSync(() => setReportAuthority('checking'))
      } else void check()
    }
    const pageExit = () => {
      if (!active || surfaceEpoch !== navigationEpoch.current) return
      gate.cancelKey(key)
      flushSync(() => setReportAuthority('checking'))
    }
    window.addEventListener('focus', visible)
    window.addEventListener('pageshow', visible)
    document.addEventListener('visibilitychange', visible)
    window.addEventListener('pagehide', pageExit)
    return () => { active = false; gate.cancelKey(key); window.clearInterval(interval); unsubscribe()
      window.removeEventListener('focus', visible); window.removeEventListener('pageshow', visible)
      document.removeEventListener('visibilitychange', visible)
      window.removeEventListener('pagehide', pageExit) }
  }, [step, store, selected, saveStatus, canPublish])
  const appendView = useCallback(async (opening: NonNullable<typeof activityRetry>) => {
    const owns = () => attached(opening.handle, opening.generation, opening.opening, opening.store) &&
      opening.handle.status().kind === 'current'
    if (opening.handle.status().kind !== 'current') return
    const epoch = ++activityEpoch.current
    let timer: ReturnType<typeof setTimeout>
    const timedOut = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(Error('Arrows activity delivery timed out')), 2000) })
    const operation = opening.store.appendReportView(opening.sessionId, opening.snapshot, opening.viewId,
      opening.source, opening.wallMs, opening.handle)
    // Late actual success may settle only this opening's retry. It cannot publish.
    void operation.then(() => {
      if (owns()) setActivityRetry(current => current?.viewId === opening.viewId ? null : current)
    }, () => {})
    try {
      await Promise.race([operation, timedOut])
      if (owns()) setActivityRetry(current => current?.viewId === opening.viewId ? null : current)
    } catch {
      if (owns() && epoch === activityEpoch.current) setActivityRetry(opening)
    } finally { clearTimeout(timer!) }
  }, [])
  const recordView = useCallback(async (arm: ArmedAttempt, source: 'live' | 'history') => {
    const surface = recoverySurface.current
    if (!store || !arm.snapshot || !surface || !surface.handle.matches(arm) ||
      !attached(surface.handle, surface.generation, surface.opening, store) || surface.handle.status().kind !== 'current') return
    surface.session.assertRecord(arm)
    if (surface.session.source !== source) throw Error('Arrows report opening source changed')
    const prior = liveOpening.current
    const opening = prior?.source === source && prior?.handle === surface.handle && prior.generation === surface.generation &&
      prior.opening === surface.opening && prior.store === store ? prior : {
        installationId: arm.state.identity.installationId, sessionId: arm.sessionId, snapshot: arm.snapshot,
        viewId: surface.session.viewId, source, wallMs: surface.session.observedWallMs, store, handle: surface.handle,
        generation: surface.generation, opening: surface.opening, storeGeneration: surface.storeGeneration }
    liveOpening.current = opening
    await appendView(opening)
  }, [store, appendView])
  /** Resume the captured report opening. Execution may already be discarded. */
  const resumeReport = useCallback(async (session: ArrowsReportSession) => {
    const surface = attachReport(session.handle, session.store, session.controller, session)
    const epoch = ++recoveryPublicationEpoch.current
    const active = () => attached(session.handle, surface.generation, surface.opening, session.store) &&
      epoch === recoveryPublicationEpoch.current && session.handle.status().kind === 'current'
    if (!active()) return
    if (session.controller) {
      setSaveStatus('pending')
      const outcome = await session.controller.recover()
      if (!active()) return
      if (outcome.kind !== 'confirmed' || !canPublish()) {
        flushSync(() => { setSelected(null); setReportAuthority('review_only'); setSaveStatus('unconfirmed') })
        return
      }
    }
    let published: ArmedAttempt | null = null
    const publish=(permit=()=>{})=>publication.current.run(`resume:${session.id}`,
      async signal => {
        const retained = await session.store.loadArmed(session.handle.arm.sessionId, signal)
        if (!retained) throw Error('Arrows report unavailable')
        session.assertRecord(retained)
        return retained
      }, retained => {
        if (!active() || !canPublish()) return
        session.assertRecord(retained)
        permit()
        flushSync(() => { setSelected(retained); setDraftArm(null); setRunState(null); setStep('report');
          setSaveStatus('saved'); setReportAuthority('verified'); setError('') })
        const attribute = session.handle.armedOnly ? 'data-arrows-armed-only-session' : 'data-arrows-published-session'
        if (journey.current?.querySelector(`[${attribute}]`)?.getAttribute(attribute) !== session.handle.arm.sessionId)
          throw Error('Arrows report DOM publication was not confirmed')
        published = retained
        const r=retained.snapshot?.review
        if(session.source==='live' && retained.state.specificationVersion==='arrows_spec_v1_1' && r){
          if(r.status==='complete_headless' && r.metrics){const m=r.metrics.overall;usage.current.finish(retained.sessionId,'completed',()=>({correct:m.correct,trials:m.denominator}))}
          else if(r.status==='invalid_headless')usage.current.finish(retained.sessionId,'invalid')
        }
      }, () => {
        if (!active()) return
        publication.current.cancel()
        session.controller?.uncertain('publication_failed')
        flushSync(() => { setSelected(null); setRunState(null); setReportAuthority('review_only');
          setSaveStatus('unconfirmed'); setError('Saved data could not be verified. No numbers are shown.') })
      })
    if(reportTarget)await withSelectedMockReportPublication(reportTarget,publish)
    else await publish()
    if (published && active() && !session.handle.armedOnly) void recordView(published, session.source)
    else if (!published && active()) session.controller?.uncertain('publication_not_confirmed')
  }, [recordView, canPublish, reportTarget])
  const confirmRecovery = useCallback(async (current: ArrowsBrowserRun) => {
    const controller = current.recovery()
    if (!controller || !store) { setSaveStatus('unconfirmed'); return }
    const surface = attachReport(controller.authority, store, controller)
    await resumeReport(surface.session)
  }, [store, resumeReport])
  const confirmTerminal = confirmRecovery

  async function verifyAttachedReport() {
    const surface = recoverySurface.current
    if (!surface) return
    const owns = () => attached(surface.handle, surface.generation, surface.opening, surface.store)
    try {
      await surface.store.verifyIntegrity()
      if (!owns() || surface.handle.status().kind !== 'current' || !canPublish()) return
      await resumeReport(surface.session)
    } catch { if (owns()) setError('Saved data could not be verified. No numbers are shown.') }
  }

  function profile(): InputProfile {
    return mode === 'keyboard' ? { kind: 'keyboard', leftCode, rightCode, alternative,
      accommodation: 'default', reducedMotion } : { kind: 'pointer', pointerSource: pointerSource ?? 'mouse',
      alternative, accommodation: 'default', reducedMotion }
  }
  function startCapture(next: Capture) {
    retireSetupChoice();setCapturedDown(null);observedDown.current=null
    if(next==='check-both')setChecked({left:false,right:false})
    setCapture(next);setError('')
    requestAnimationFrame(() => captureTarget.current?.focus())
  }
  function captureDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.code === 'Tab' || !capture) return
    event.preventDefault(); event.stopPropagation()
    if (event.code === 'Escape') { retireSetupChoice();clearPreparationInput();return }
    retireSetupChoice()
    if (!capture || !allowedCode.test(event.code) || event.repeat || event.altKey || event.ctrlKey ||
      event.metaKey || event.shiftKey || event.nativeEvent.isComposing) {
      setCapturedDown(null);observedDown.current=null;setError('Press and release one button without holding Shift, Ctrl, Alt or Command.'); return
    }
    if (capturedDown && capturedDown !== event.code) {
      setCapturedDown(null);observedDown.current=null;setError('Press and release one button at a time.'); return
    }
    setCapturedDown(event.code)
    observedDown.current = event.nativeEvent
  }
  function captureUp(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!capture || event.code !== capturedDown) return
    event.preventDefault(); event.stopPropagation()
    if (event.repeat || event.altKey || event.ctrlKey || event.metaKey ||
      event.shiftKey || event.nativeEvent.isComposing) {
      setCapturedDown(null);observedDown.current=null
      setError('Release the button without modifiers, then press it again.');return
    }
    if (capture === 'left' || capture === 'right') {
      if (capture === 'left' && event.code === rightCode || capture === 'right' && event.code === leftCode) {
        setCapturedDown(null);observedDown.current=null;setError('Choose two different keyboard buttons.');return
      }
      retireSetupChoice();if (capture === 'left') setLeftCode(event.code); else setRightCode(event.code)
      setChecked({left:false,right:false});setCapture('check-both');setError('');return
    }
    const direction=event.code===leftCode?'left':event.code===rightCode?'right':null
    if(!direction){setCapturedDown(null);observedDown.current=null;setError(`Use ${keyLabel(leftCode)} for Left or ${keyLabel(rightCode)} for Right.`);return}
    const nextChecked={...checked,[direction]:true}
    setChecked(nextChecked)
    if(mode==='keyboard'&&!alternative&&observedDown.current)void storeNativeKeyProof('arrows',observedDown.current,event.nativeEvent,'standard').catch(()=>{})
    observedDown.current=null;setCapturedDown(null);setError('')
    if(nextChecked.left&&nextChecked.right)setCapture(null)
  }
  useEffect(() => {
    if (step === 'setup' && mode === 'keyboard') startCapture('check-both')
  }, [step, mode])
  const captureHandlers = useRef({ down: captureDown, up: captureUp })
  captureHandlers.current = { down: captureDown, up: captureUp }
  useEffect(() => {
    if (step !== 'setup' || mode !== 'keyboard' || capture !== 'check-both') return
    const wrap = (e: KeyboardEvent) => ({ code: e.code, repeat: e.repeat, altKey: e.altKey, ctrlKey: e.ctrlKey,
      metaKey: e.metaKey, shiftKey: e.shiftKey, nativeEvent: e,
      preventDefault: () => e.preventDefault(), stopPropagation: () => e.stopPropagation()
    }) as unknown as ReactKeyboardEvent<HTMLDivElement>
    const ours = (e: KeyboardEvent) => e.code === leftCode || e.code === rightCode
    const outside = (e: KeyboardEvent) => !captureTarget.current?.contains(e.target as Node)
    const down = (e: KeyboardEvent) => { if (!ours(e) || !outside(e)) return; captureHandlers.current.down(wrap(e)); captureTarget.current?.focus() }
    const up = (e: KeyboardEvent) => { if (ours(e) && outside(e)) captureHandlers.current.up(wrap(e)) }
    window.addEventListener('keydown', down, true); window.addEventListener('keyup', up, true)
    return () => { window.removeEventListener('keydown', down, true); window.removeEventListener('keyup', up, true) }
  }, [step, mode, capture, leftCode, rightCode])
  function pointerCheck(event: ReactPointerEvent<HTMLButtonElement>, direction: 'left' | 'right') {
    if (!event.isPrimary || event.button !== 0 || !['mouse', 'touch', 'pen'].includes(event.pointerType)) return
    const source = event.pointerType as PointerSource
    if (pointerSource && pointerSource !== source) {
      setChecked({ left: false, right: false }); setError('Use the same pointer type for both directions.'); return
    }
    setPointerPending({ id: event.pointerId, direction, source })
  }
  function pointerRelease(event: ReactPointerEvent<HTMLButtonElement>, direction: 'left' | 'right') {
    if (!pointerPending || pointerPending.id !== event.pointerId || pointerPending.direction !== direction) return
    retireSetupChoice()
    setPointerSource(pointerPending.source)
    setChecked(previous => ({ ...previous, [direction]: true }))
    setPointerPending(null)
  }
  async function begin() {
    const host = exclusive?.presentationHost ?? display.current
    if (!store || !host || !checked.left || !checked.right || spoken || run.current || skipChecking.current) return
    if(skipSource.current){const source=skipSource.current,epoch=navigationEpoch.current;skipChecking.current=true
      try{const attempts=await store.listAttempts()
        if(epoch!==navigationEpoch.current||!mounted.current)return
        if(source.profile!==JSON.stringify(profile())||!attempts.some(attempt=>attempt.sessionId===source.sessionId&&attempt.snapshot?.kind==='terminal'&&attempt.snapshot.review.status==='complete_headless'&&attempt.state.specificationVersion==='arrows_spec_v1_1'&&JSON.stringify(attempt.profile)===source.profile)){
          skipSource.current=null;setCanSkip(false);setQuiz('');setFirstResponseRule('');setError('The completed run used to skip the guide was deleted or changed. Check the rule to continue.');prepare('quiz');return
        }
        skipSource.current=null
      }catch{if(epoch===navigationEpoch.current){setQuiz('');setFirstResponseRule('');setError('The completed run used to skip the guide could not be checked. Check the rule to continue.');prepare('quiz')}return}
      finally{skipChecking.current=false}
    }
    navigationEpoch.current++
    preparationStarted.current=true;preparationBack.current=[]
    detachRecovery()
    setError('')
    if (!exclusive) host.scrollIntoView({ block: 'center' })
    const generation = navigationEpoch.current
    let publishedPhase: State['phase'] | null = null
    const controller = new ArrowsBrowserRun(new ArrowsEntry(store, generation), host, value => {
      if (!mounted.current || run.current !== controller || generation !== navigationEpoch.current) return
      const enteredBreak = value.phase === 'break' && publishedPhase !== 'break'
      publishedPhase = value.phase
      const recovery = controller.recovery(), withdrawal = controller.withdrawalAuthority()
      if (withdrawal || recovery && recovery.authority.status().kind !== 'current') {
        // Pass the recovery controller regardless of which handle wins the
        // withdrawal slot — a break-withdrawal carries its own Recovery and
        // the captured report session needs it whether a BrowserRun is live or not.
        exclusive?.leave()
        attachReport(withdrawal ?? recovery!.authority, store, recovery ?? null); setStep('report'); return
      }
      if (enteredBreak) setCheckpointStatus('pending')
      if (enteredBreak || value.phase === 'completed' || value.phase === 'invalid') exclusive?.leave()
      setRunState(value); if (value.phase === 'break') setStep('break')
    }, undefined, true, exclusive)
    run.current = controller
    setStarting(true)
    setSaveStatus('none')
    const selectedProfile = profile()
    const request: StartRequest = uncertainStart.current &&
      JSON.stringify(uncertainStart.current.profile) === JSON.stringify(selectedProfile)
      ? uncertainStart.current
      : Object.freeze({ requestId: crypto.randomUUID(), sessionId: crypto.randomUUID(),
          clockDomainId: crypto.randomUUID(), profile: Object.freeze(selectedProfile),
          atMs: performance.now(), wallMs: Date.now() })
    // Keep the exact identity and frozen setup through a failed arm readback.
    // A verified/protected start consumes it; a changed setup requires a new one.
    uncertainStart.current = request
    usage.current.begin(mock?'mock':'practice')
    try {
      exclusive?.enter(() => exitAction.current())
      await controller.begin(request, mock ? () => mock.beforeArm({ requestId: request.requestId, attemptId: request.sessionId,
        originTicketId: null, installationId: store.installationId, generation: null, requestKind: 'start', nativeIdentity: [] }) : undefined)
      if (run.current === controller) {
        usage.current.admit(request.sessionId,request.profile.kind==='keyboard' && !request.profile.alternative)
        uncertainStart.current = null;preparationBack.current=[]; setStarting(false); setStartUncertain(false); setStep('run')
      }
    } catch (cause) {
      if (run.current !== controller) return
      if (controller.armedAttempt()) uncertainStart.current = null
      controller.dispose(); run.current = null
      exclusive?.leave()
      setStarting(false); setStartUncertain(!controller.armedAttempt())
      setUncertainProfile(uncertainStart.current?.profile ?? null)
      setError(`Start could not be confirmed. ${cause instanceof Error ? cause.message : 'Check this browser and try again.'}`)
      setStep('ready')
    }
  }
  async function continueBlock() {
    if (!run.current || (!exclusive && !display.current)) return
    setError('')
    if (!exclusive) display.current?.scrollIntoView({ block: 'center' })
    const current = run.current, generation = navigationEpoch.current
    try {
      exclusive?.enter(() => exitAction.current())
      await current.continue()
      if (mounted.current && run.current === current && generation === navigationEpoch.current) setStep('run')
    } catch (cause) {
      if (mounted.current && run.current === current && generation === navigationEpoch.current) {
        exclusive?.leave()
        setError(cause instanceof Error ? cause.message : 'The next block could not start.')
      }
    }
  }
  async function verifyCheckpoint() {
    const current = run.current
    if (!current || step !== 'break') return
    setError(''); setCheckpointStatus('pending')
    try {
      await current.retryCheckpoint()
      if (mounted.current && run.current === current) setCheckpointStatus(current.checkpointStatus())
    } catch (cause) {
      if (mounted.current && run.current === current) {
        setCheckpointStatus(current.checkpointStatus())
        setError(cause instanceof Error ? cause.message : 'The checkpoint could not be verified.')
      }
    }
  }
  function endBreakForReview() {
    const current = run.current
    if (!current) return
    try {
      const arm = current.armedAttempt()
      const draft = current.endBreakForReview()
      exclusive?.leave()
      run.current = null; breakExitRun.current = current
      setDraftArm(arm); setSelected(null); setRunState(draft); setSaveStatus('pending')
      setReportAuthority('verified'); setStep('report'); setError('')
      if (arm) void confirmRecovery(current)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The break could not be closed.')
    }
  }

  function retainUnsavedReport(): boolean {
    const retained = recoverySurface.current
    if (step !== 'report' || selected || (saveStatus !== 'pending' && saveStatus !== 'unconfirmed') ||
      (!runState && !retained?.controller) || retained?.handle.status().kind === 'retired') return false
    setError('This result is still retained only in this tab. Confirm its save before leaving or starting another practice.')
    return true
  }
  function leave() {
    usage.current.cancel()
    mock?.retireReturnIntent()
    if (retainUnsavedReport()) return
    publication.current.cancel()
    const phase = run.current?.snapshot()?.phase
    if (starting && run.current && (!phase || phase === 'armed')) {
      // Cancel preparation/arming in this document; a late callback cannot navigate
      // or enter protection. Preserve an uncertain request for explicit readback.
      const current = run.current
      run.current = null; current.dispose(); exclusive?.leave()
      navigationEpoch.current++
      setStarting(false); setStartUncertain(true)
      setUncertainProfile(uncertainStart.current?.profile ?? null)
      setError('Start was canceled. Verify or retry the same request before timed play begins.')
      setStep('ready')
      return
    }
    uncertainStart.current = null
    setStarting(false); setStartUncertain(false)
    if (phase === 'break' && run.current) { endBreakForReview(); return }
    if (run.current && (step === 'run' || phase && !['armed', 'break', 'completed', 'invalid'].includes(phase))) {
      run.current.dispose()
      exclusive?.leave()
      setStep('report')
      return
    }
    navigationEpoch.current++
    detachRecovery()
    breakExitRun.current = null
    run.current?.dispose(); run.current = null; exclusive?.leave(); onLibrary()
  }
  function leaveMockUnconfirmed(fromReturn=false){
    if(mockReturnPending.current&&!fromReturn)return
    mock?.retireReturnIntent()
    navigationEpoch.current++
    detachRecovery()
    run.current?.dispose();run.current=null;exclusive?.leave();onLibrary()
  }
  function returnToMock(){
    if(!mock){leave();return}
    if(mockReturnPending.current)return
    const signal=mock.beginReturnIntent()
    const launchId=mock.launchId,epoch=navigationEpoch.current
    const current=run.current
    const active=()=>mounted.current&&!signal.aborted&&navigationEpoch.current===epoch&&mock.launchId===launchId
    mockReturnPending.current=true
    setMockError('')
    void (async()=>{
      try{
        let recovery=current?.recovery()??null
        if(current && current.snapshot()?.phase==='break'){
          endBreakForReview()
          if(breakExitRun.current!==current)throw Error('The Arrows break could not be closed.')
          recovery=current.recovery()
        }else if(current && step!=='report' && step!=='history'){
          // The owned live Return is an explicit mock exit. Preserve the native
          // page-exit terminal before releasing its presentation owner.
          try{current.dispose();recovery=current.recovery()}
          finally{
            run.current=null
            exclusive?.leave()
            setStarting(false)
            setStep('report')
          }
          if(recovery&&store)void confirmRecovery(current).catch(()=>{
            if(active())setSaveStatus('unconfirmed')
          })
        }
        if(recovery)await recovery.recover()
        if(!active())return
        const status=await mock.terminal()
        if(!active())return
        if(status==='ready'){await mock.continue(signal);return}
        leaveMockUnconfirmed(true)
      }catch{
        if(active())setMockError('Return could not be confirmed. Try Return to mock again, or leave with this result unconfirmed.')
      }finally{mock.finishReturnIntent(signal);mockReturnPending.current=false}
    })()
  }
  useLayoutEffect(() => { exitAction.current = mock?returnToMock:leave })
  async function loadHistory() {
    mock?.retireReturnIntent()
    if (!store) return
    detachRecovery()
    const epoch = ++navigationEpoch.current
    publication.current.cancel()
    // A report being left cannot remain visibly saved while a new surface is checked.
    flushSync(() => setReportAuthority('checking'))
    if (!canPublish()) {
      setError('Arrows history cannot be verified while this page is hidden. Return to this tab and try again.')
      return
    }
    await publication.current.run('history',
      signal => store.listAttempts(signal),
      attempts => {
        if (!mounted.current || epoch !== navigationEpoch.current) return
        flushSync(() => { setHistory(attempts); setSelected(null); setDraftArm(null)
          setActivityRetry(null); setError(''); setStep('history') })
        if (journey.current?.querySelector('[data-arrows-history-installation]')?.getAttribute('data-arrows-history-installation') !== store.installationId)
          throw Error('Arrows history DOM publication was not confirmed')
        requestAnimationFrame(() => { if (mounted.current && epoch === navigationEpoch.current) heading.current?.focus() })
      }, () => {
        if (!mounted.current || epoch !== navigationEpoch.current) return
        flushSync(() => { setHistory([]); setReportAuthority('checking')
          setError('Arrows history could not be verified. Saved results are unavailable.') })
      })
  }
  async function openReport(original: ArmedAttempt) {
    mock?.retireReturnIntent()
    const sessionId = original.sessionId
    if (!store) return
    detachRecovery()
    const epoch = ++navigationEpoch.current
    publication.current.cancel()
    if (!canPublish()) {
      setError('This report cannot be verified while this page is hidden. Return to this tab and try again.')
      return
    }
    const handle = store.authority.published(original)
    const surface = attachReport(handle, store)
    const owns = () => attached(handle, epoch, surface.opening, store) && handle.status().kind === 'current'
    if (!owns()) { setStep('report'); return }
    flushSync(() => { setSelected(null); setActivityRetry(null); setReportAuthority('checking') })
    const published: { value: ArmedAttempt | null } = { value: null }
    const publish=(permit=()=>{})=>publication.current.run(`open:${sessionId}`,
      signal => store.loadArmed(sessionId, signal),
      current => {
        if (!owns()) return
        if(current&&reportTarget)assertArrowsMockReport(current,reportTarget,store.installationId)
        if (current) surface.session.assertRecord(current)
        if (!current) {
          flushSync(() => { setSelected(null); setHistory([])
            setError('This report is unavailable or could not be verified.') })
          return
        }
        permit()
        flushSync(() => { setSelected(current); setDraftArm(null); setRunState(null)
          setSaveStatus('saved'); setReportAuthority('verified'); setStep('report'); setError('') })
        if (journey.current?.querySelector(handle.armedOnly ? '[data-arrows-armed-only-session]' : '[data-arrows-published-session]')?.getAttribute(handle.armedOnly ? 'data-arrows-armed-only-session' : 'data-arrows-published-session') !== sessionId)
          throw Error('Arrows history report DOM publication was not confirmed')
        published.value = current
      }, () => {
        if (!owns()) return
        publication.current.cancel()
        flushSync(() => { setSelected(null); setRunState(null); setSaveStatus('unconfirmed');
          setReportAuthority('review_only')
          setError('This report is unavailable or could not be verified.') })
      })
    if(reportTarget)await withSelectedMockReportPublication(reportTarget,publish)
    else await publish()
    if (published.value?.snapshot) void recordView(published.value, 'history')
  }

  async function remove(sessionId: string) {
    mock?.retireReturnIntent()
    if (!store) return
    detachRecovery()
    const epoch = ++navigationEpoch.current
    publication.current.cancel()
    flushSync(() => setReportAuthority('checking'))
    try {
      if (run.current?.armedAttempt()?.sessionId === sessionId) { run.current.dispose(); run.current = null }
      await store.deleteAttempt(sessionId)
      if (!mounted.current || epoch !== navigationEpoch.current) return
      setSelected(null); setRunState(null); setSaveStatus('none')
      const historyEpoch = navigationEpoch.current + 1
      await loadHistory()
      if (historyEpoch === navigationEpoch.current) setError('Attempt deleted.')
    } catch { if (epoch === navigationEpoch.current) setError('Deletion could not be confirmed. The attempt may remain in history.') }
  }
  function disposeActiveRun() {
    run.current?.dispose()
    run.current = null
  }
  async function deleteAll() {
    mock?.retireReturnIntent()
    const resetSurface = recoverySurface.current
    const resetOpening = liveOpening.current
    publication.current.cancel()
    flushSync(() => setReportAuthority('checking'))
    uncertainStart.current = null
    setStarting(false); setStartUncertain(false)
    detachRecovery()
    const epoch = ++navigationEpoch.current
    const openingGeneration = ++storeOpeningEpoch.current
    const originalStore = storeRef.current
    setDeleteAllConfirm(false)
    try {
      disposeActiveRun()
      const deletionStore = store ?? await ArrowsStore.openForDeletion()
      const replacement = await deletionStore.deleteAll()
      if (!mounted.current || epoch !== navigationEpoch.current || openingGeneration !== storeOpeningEpoch.current ||
        storeRef.current !== originalStore) return
      navigationEpoch.current++
      disposeActiveRun()
      storeRef.current = replacement; setStore(replacement); setStorageError(''); setUnverifiedHistory([])
      breakExitRun.current = null
      liveOpening.current = null; terminalChecked.current = null
      setHistory([]); setSelected(null); setDraftArm(null); setRunState(null); setActivityRetry(null)
      setReportAuthority('verified'); setSaveStatus('none')
      preparationStarted.current=false;preparationBack.current=[];clearPreparationInput();setError('All local Arrows data were deleted.'); setStep('guide')
    } catch {
      if (mounted.current && epoch === navigationEpoch.current && openingGeneration === storeOpeningEpoch.current && storeRef.current === originalStore) {
        // A failed reset still belongs to the old installation. Restore only
        // its blocked attachment so the explicit recovery action stays usable.
        if (resetSurface?.store === originalStore && resetSurface.handle.status().kind === 'blocked') {
          const restored = attachReport(resetSurface.handle, resetSurface.store, resetSurface.controller, resetSurface.session)
          if (resetOpening?.handle === restored.handle && resetOpening.store === restored.store)
            liveOpening.current = { ...resetOpening, generation: restored.generation, opening: restored.opening }
        }
        setError('Delete all could not be confirmed. Local Arrows data may remain.')
      }
    }
  }
  async function replay() {
    preparationBack.current=[];clearPreparationInput()
    mock?.retireReturnIntent()
    if (retainUnsavedReport()) return
    navigationEpoch.current++
    setMockReady(false)
    run.current?.dispose();run.current=null
    if(mock){try{await mock.retry()}catch(cause){setMockError(cause instanceof Error?cause.message:'The old Arrows attempt needs checking.');return}}
    exclusive?.leave()
    publication.current.cancel()
    uncertainStart.current = null
    setStarting(false); setStartUncertain(false)
    detachRecovery()
    breakExitRun.current = null
    terminalChecked.current = null
    liveOpening.current = null
    setRunState(null); setSelected(null); setDraftArm(null); setActivityRetry(null)
    setReportAuthority('verified'); setSaveStatus('none'); setError('')
    preparationStarted.current=false;setChecked({ left: false, right: false }); setStep('guide')
  }

  useEffect(() => {
    if (!runState || (runState.phase !== 'completed' && runState.phase !== 'invalid') ||
      terminalChecked.current === run.current || !run.current) return
    terminalChecked.current = run.current
    const current = run.current
    setStep('report'); setSaveStatus('pending')
    void confirmTerminal(current)
  }, [runState, store, confirmTerminal]) // Browser identity guards repeat confirmations, including reused session IDs.

  const retired = authorityStatus?.kind === 'retired' || recoveryOutcome?.kind === 'retired'
  const unavailable = retired || authorityStatus?.kind === 'blocked' || authorityStatus?.kind === 'unknown'
  const observed = unavailable ? null : selected?.snapshot?.state ?? selected?.state ?? runState
  const retrySameStart = startUncertain && uncertainProfile !== null &&
    JSON.stringify(uncertainProfile) === JSON.stringify(profile())
  const persisted: PersistedSnapshot | null = unavailable ? null : selected?.snapshot ?? null
  const review = step === 'report' ? persisted?.review ?? (observed ? reconcileHeadless(observed) : null) : null
  const live = step === 'run' || step === 'break' || step === 'ready'
  if(reportTarget&&step!=='report')return <Shell onLibrary={onLibrary}><section className="journey panel"><h1>Saved Arrows report</h1><p role={error||storageError?'alert':'status'}>{error||storageError||'Checking the exact retained result…'}</p><button onClick={onLibrary}>Return to mock</button></section></Shell>
  return <Shell onLibrary={mock?returnToMock:leave}>
    <div ref={journey} className="journey arrows-journey">
      <div className="journey-top"><button className="secondary" onClick={mock?returnToMock:leave}><span aria-hidden="true">← </span>{mock?'Return to mock':'Main menu'}</button><p>Arrows · Practice</p></div>
      {!preparationStarted.current&&!starting&&!startUncertain&&!uncertainStart.current&&isPreparationStep(step)&&(preparationBack.current.length>0||step==='examples'&&example>0)&&<button className="secondary" onClick={backPreparation}>Back</button>}
      {error && <p role="alert" className="feedback">{error}</p>}
      {mockError && step!=='report' && <p role="alert" className="feedback">{mockError} <button onClick={()=>leaveMockUnconfirmed()}>Leave with result unconfirmed</button></p>}
      {storageError && <p role="alert">{storageError} Timed play requires verified local storage.</p>}
      {storageError && unverifiedHistory.length > 0 && <details><summary>Unverified historical labels</summary><p>These labels have not been verified. Saved results and numerical summaries are unavailable.</p><ul>{unverifiedHistory.map(row => <li key={row.sessionId}>{row.specificationVersion} · {row.formId} · Unverified, review only</li>)}</ul></details>}
      {storageError && (deleteAllConfirm ? <div role="group" aria-label="Confirm Arrows data reset">
        <p>This permanently deletes all local Arrows attempts, results, events and form history in this browser. It cannot be undone. Other games are unaffected.</p>
        <button onClick={() => void deleteAll()}>Delete all Arrows data</button>
        <button className="secondary" onClick={() => setDeleteAllConfirm(false)}>Cancel</button>
      </div> : <button className="secondary" onClick={() => setDeleteAllConfirm(true)}>Delete all Arrows data</button>)}
    {step === 'guide' && <section className="panel"><h1 ref={heading} tabIndex={-1}>Arrows</h1>
      <QuickRules rules={['Red / SIDES: follow the four side arrows.', 'Blue or black / MIDDLE: follow the middle arrow.', 'Choose Left or Right. Your first response within 1.5 seconds counts.']} note="Five sets of 27, with breaks between sets. Keep this tab open and focused during each set."/>
      <button onClick={()=>prepare('quiz')}>Continue</button>
      <details className="start-options"><summary>Examples and saved results</summary><div className="actions"><button className="secondary" onClick={()=>prepare('examples')}>See an example</button><button className="secondary" disabled={!orderedReportsAvailable} onClick={()=>void loadHistory()}>Saved results</button>{canSkip&&<button className="secondary" onClick={()=>void skipGuide()}>Skip instructions</button>}</div><p>Black rows can show horizontal marks on either side of the middle arrow.</p><p>{disclosure}</p></details>
        {!orderedReportsAvailable && <p role="alert">This browser cannot verify saved Arrows reports or protect timed play across tabs. The untimed guide remains available.</p>}
        {!orderedReportsAvailable && !storageError && (deleteAllConfirm ? <div role="group" aria-label="Confirm Arrows data reset">
          <p>This permanently deletes all local Arrows attempts, results, events and form history in this browser. It cannot be undone. Other games are unaffected.</p>
          <button onClick={() => void deleteAll()}>Delete all Arrows data</button>
          <button className="secondary" onClick={() => setDeleteAllConfirm(false)}>Cancel</button>
        </div> : <button className="secondary" onClick={() => setDeleteAllConfirm(true)}>Delete all Arrows data</button>)}<AssessmentUsageNotice /></section>}
      {step === 'examples' && <section className="panel"><h1 ref={heading} tabIndex={-1}>Worked example {example + 1} of 3</h1>
        <p><strong>{example === 0 ? 'Red · SIDES' : example === 1 ? 'Blue · MIDDLE' : 'Black · MIDDLE'}</strong>: {example === 0 ? 'follow all four side arrows' : 'follow the middle arrow'}.</p>
        <div className="arrows-example" style={{ color: example === 0 ? '#b11f2f' : example === 1 ? '#184dab' : '#171717' }} aria-label={example === 0 ? 'Four red sides point right, middle points left' : example === 1 ? 'Blue middle points left, sides point right' : 'Black middle points left, four horizontal marks'}>{(example === 2 ? ['—', '—', '←', '—', '—'] : ['→', '→', '←', '→', '→']).map((symbol, index) => <span key={index}>{symbol}</span>)}</div>
        <p>The answer is <strong>{example === 0 ? 'Right' : 'Left'}</strong>.</p>
        <div className="actions"><button onClick={() => example < 2 ? setExample(example + 1) : prepare('quiz')}>{example < 2 ? 'Next example' : 'Check understanding'}</button></div></section>}
      {step === 'quiz' && <section className="panel"><h1 ref={heading} tabIndex={-1}>Check the rule</h1>
        <fieldset><legend>On a red SIDES row, which arrows and response count?</legend>
        <label className="choice"><input type="radio" name="arrow-quiz" checked={quiz === 'center'} onChange={() => {setQuiz('center');setFirstResponseRule('last')}} />Follow the middle arrow and use my last response</label>
        <label className="choice"><input type="radio" name="arrow-quiz" checked={quiz === 'outer'} onChange={() => {setQuiz('outer');setFirstResponseRule('first')}} />Follow the four side arrows and use my first eligible response before the deadline</label></fieldset>
        <div className="actions"><button onClick={() => { if (quiz === 'outer' && firstResponseRule === 'first') { skipSource.current=null;setError(''); prepare('setup') } else setError('On red rows follow the four side arrows; your first eligible response before the deadline counts. Try again.') }}>Check answers</button></div></section>}
      {step === 'setup' && <section className="panel"><h1 ref={heading} tabIndex={-1}>{mode === 'keyboard'
        ? checked.left && checked.right ? 'Both keys work.' : checked.left ? `Good. Now press ${rightCode === 'ArrowRight' ? '→' : keyLabel(rightCode)}.` : checked.right ? `Good. Now press ${leftCode === 'ArrowLeft' ? '←' : keyLabel(leftCode)}.` : leftCode === 'ArrowLeft' && rightCode === 'ArrowRight' ? 'Press ← then → on your keyboard.' : `Press ${keyLabel(leftCode)} then ${keyLabel(rightCode)}.`
        : 'Ready for Arrows'}</h1>
        {startUncertain && <p role="status">The earlier Start may already have reserved a form. Keep this input setup to verify or retry that same request. Changing input settings requires a new Start request and may use the next form.</p>}
        {mode === 'keyboard' ? <>
          <div ref={captureTarget} className="key-capture arrows-key-capture" tabIndex={0} role="group" aria-label="Arrows physical key capture" onKeyDown={captureDown} onKeyUp={captureUp}>
            <div className="arrows-key-tiles">{(['left', 'right'] as const).map(direction => <div key={direction} className={`arrows-key-tile${checked[direction] ? ' is-checked' : ''}`}>
              <span className="arrows-key-symbol" aria-hidden="true">{direction === 'left' ? '←' : '→'}</span>
              <span>{checked[direction] ? '✓ CHECKED' : 'PRESS IT'}</span>
            </div>)}</div>
            {(leftCode !== 'ArrowLeft' || rightCode !== 'ArrowRight') && <p className="current-controls">Using {keyLabel(leftCode)} for Left and {keyLabel(rightCode)} for Right</p>}
            {(capture === 'left' || capture === 'right') && <p>Press and release the new {capture === 'left' ? 'Left' : 'Right'} button. Escape cancels.</p>}
            <p role="status" className="arrows-visually-hidden">Left: {checked.left ? 'checked' : 'waiting'} · Right: {checked.right ? 'checked' : 'waiting'}</p>
          </div>
          <button className="arrows-setup-link" onClick={() => startCapture('check-both')}>Check again</button>
        </> : <><p>Press Left and Right below with the same primary pointer type.</p>
          <div className="actions"><button onPointerDown={event => pointerCheck(event, 'left')} onPointerUp={event => pointerRelease(event, 'left')} onPointerCancel={() => setPointerPending(null)}>Check Left</button><button onPointerDown={event => pointerCheck(event, 'right')} onPointerUp={event => pointerRelease(event, 'right')} onPointerCancel={() => setPointerPending(null)}>Check Right</button></div>
          <p role="status">{pointerSource ? `Detected ${pointerSource}. ` : ''}Left {checked.left ? 'passed' : 'needed'}; Right {checked.right ? 'passed' : 'needed'}.</p></>}
        <div className="actions"><button disabled={!checked.left || !checked.right || spoken || !store || !orderedReportsAvailable || starting} onClick={() => void begin()}>{starting ? 'Checking Start' : retrySameStart ? 'Verify or retry same Start' : startUncertain ? 'Start with changed setup' : mode === 'keyboard' && checked.left && checked.right ? 'Start practice' : 'Start'}</button></div>
        <div className="arrows-setup-links">
          {mode === 'keyboard' && <><button className="arrows-setup-link" aria-expanded={setupPanel === 'keys'} aria-controls="arrows-key-options" onClick={() => setSetupPanel(setupPanel === 'keys' ? null : 'keys')}>Use other keys</button><span aria-hidden="true">·</span></>}
          <button className="arrows-setup-link" aria-expanded={setupPanel === 'controls'} aria-controls="arrows-control-options" onClick={() => setSetupPanel(setupPanel === 'controls' ? null : 'controls')}>{mode === 'keyboard' ? 'Use mouse or touch' : 'Use keyboard'}</button><span aria-hidden="true">·</span>
          <button className="arrows-setup-link" aria-expanded={setupPanel === 'accessibility'} aria-controls="arrows-accessibility-options" onClick={() => setSetupPanel(setupPanel === 'accessibility' ? null : 'accessibility')}>Accessibility</button>
        </div>
        {setupPanel === 'keys' && mode === 'keyboard' && <div id="arrows-key-options" className="start-options">
          <div className="actions"><button className="secondary" onClick={() => startCapture('left')}>Change Left button</button><button className="secondary" onClick={() => startCapture('right')}>Change Right button</button></div>
        </div>}
        {setupPanel === 'controls' && <div id="arrows-control-options" className="start-options">
          <label className="choice"><input type="radio" name="arrow-mode" checked={mode === 'keyboard'} onChange={() => { retireSetupChoice();setMode('keyboard'); setChecked({ left: false, right: false });setCapture('check-both') }} />Keyboard</label>
          <label className="choice"><input type="radio" name="arrow-mode" checked={mode === 'pointer'} onChange={() => { retireSetupChoice();setMode('pointer'); setChecked({ left: false, right: false });setCapture(null);setPointerSource(null) }} />Mouse, touch or pen buttons</label>
        </div>}
        {setupPanel === 'accessibility' && <div id="arrows-accessibility-options" className="start-options"><label className="choice"><input type="checkbox" checked={alternative} onChange={event => { retireSetupChoice();setAlternative(event.target.checked); setChecked({ left: false, right: false }) }} />I use an alternative or assistive input method; it may change response timing.</label>
          <label className="choice"><input type="checkbox" checked={spoken} onChange={event => {retireSetupChoice();setSpoken(event.target.checked)}} />I need spoken interpretation of the arrows during timed play.</label>
          <label className="choice"><input type="checkbox" checked={reducedMotion} onChange={event => {retireSetupChoice();setReducedMotion(event.target.checked)}} />Reduce nonessential motion.</label>
        </div>}{(spoken||alternative)&&<p role="alert">{spoken?disclosure:'Alternative controls selected; timing is reported separately.'}</p>}
      </section>}
      {step === 'ready' && <section className="panel"><h1 ref={heading} tabIndex={-1}>Ready for Block 1?</h1>
        <p>Keep this tab visible and focused once you start. A hidden, blurred or interrupted scored block becomes review-only. The breaks after each block are untimed.</p>
        <p>Input: {mode === 'keyboard' ? `${leftCode} = Left; ${rightCode} = Right` : `${pointerSource} controls`} {alternative ? '(alternative input declared)' : ''}.</p>
        {startUncertain && <p role="status">{retrySameStart ? 'A form may already be reserved. Verify or retry the same Start request before timed play begins.' : 'Input setup changed after an unconfirmed Start. A new request may use the next form.'}</p>}
        <div className="actions"><button disabled={!store || !orderedReportsAvailable || !checked.left || !checked.right || spoken || starting} onClick={() => void begin()}>{starting ? 'Checking Start' : retrySameStart ? 'Verify or retry same Start' : startUncertain ? 'Start with changed setup' : 'Start Arrows'}</button><button className="secondary" disabled={starting} onClick={() => prepare('setup')}>Review setup</button></div>
        {!orderedReportsAvailable && <p>Timed Start needs a browser that supports exclusive tab coordination.</p>}</section>}
      {step === 'run' && <section className="panel"><h1 className="arrows-visually-hidden">Arrows scored block</h1>
        <p>Block {runState?.form.trials[runState.trialIndex - 1]?.block ?? 1} of 5 · Trial {runState?.trialIndex ?? 1} of {runState?.form.trials.length ?? 135}</p>
        <p>Respond when the row appears.</p></section>}
      {step === 'break' && <section className="panel"><h1 ref={heading} tabIndex={-1}>Block complete</h1>
        {runState && <><p>{blockCounts(runState).block} of 5 blocks complete. This break is untimed.</p>
          <p>In this block: {blockCounts(runState).correct} correct, {blockCounts(runState).wrong} wrong, {blockCounts(runState).omitted} omitted.</p>
          <p>Frozen input: {runState.profile.kind === 'keyboard' ? `${runState.profile.leftCode} Left / ${runState.profile.rightCode} Right` : `${runState.profile.pointerSource} pointer`} {runState.profile.alternative ? '(alternative input)' : ''}.</p></>}
        <p role="status">Checkpoint: {checkpointStatus === 'saved' ? 'saved' : checkpointStatus === 'failed' ? 'not confirmed; you can retry' : 'checking'}. Keep this tab open until saving finishes.</p>
        <div className="actions"><button disabled={checkpointStatus !== 'saved'} onClick={() => void continueBlock()}>Continue next block</button><button className="secondary" onClick={() => void verifyCheckpoint()}>Verify or retry checkpoint</button><button className="secondary" onClick={endBreakForReview}>End attempt and review saved trials</button></div></section>}
      {live && !exclusive && <div ref={display} className="arrows-display" aria-label="Arrows visual task display" />}
      {step === 'report' && <section className="panel"
        data-arrows-recovery-authority={authorityStatus?.kind === 'retired' ? 'retired' : recoveryOutcome?.kind}
        data-arrows-authority-handle={reportSurface?.handleId}
        data-arrows-authority-generation={reportSurface?.generation}
        data-arrows-authority-opening={reportSurface?.opening}
        data-arrows-authority-store-generation={reportSurface?.storeGeneration}
        data-arrows-authority-status={authorityStatus?.kind}
        data-arrows-register-revision={reportRegister?.revision ?? undefined}
        data-arrows-register-integrity={reportRegister?.integrity}
        data-arrows-target-witness={reportRegister?.witness ?? undefined}
        data-arrows-authority-evidence={authorityStatus?.kind === 'retired' ? authorityStatus.evidence : undefined}
        data-arrows-report-session={reportSurface?.sessionId}
        data-arrows-published-session={reportAuthority === 'verified' && saveStatus === 'saved' && selected?.snapshot ? selected.sessionId : undefined}
        data-arrows-armed-only-session={reportAuthority === 'verified' && saveStatus === 'saved' && selected && !selected.snapshot ? selected.sessionId : undefined}>
        <h1 ref={heading} tabIndex={-1}>Arrows report</h1>
        {reportAuthority === 'checking' ? <p role="status">Verifying the saved report. Results and status are hidden until the current record is confirmed.</p> : review ? <><p><strong>{review.status === 'complete_headless' ? 'Valid' : review.status === 'invalid_headless' ? 'Invalid' : 'Incomplete'} attempt.</strong> {saveStatus === 'saved' ? selected && !selected.snapshot ? 'Only this original Start record is saved; no trial result was recorded.' : review.status === 'incomplete_headless' ? 'Only these trials are saved; later activity could not be confirmed.' : 'Saved in this browser.' : saveStatus === 'pending' ? 'Checking the save. Keep this tab open.' : 'This result is retained in this tab; its save could not be confirmed.'}</p>
          {review.status === 'complete_headless' && review.metrics ? <ReportSummary feedback={choiceFeedback('arrows',review.metrics.overall)} /> : <p>This attempt ended after {review.closed} confirmed trials; a complete result is unavailable.</p>}
          <p>Interruption: {review.invalidReason ?? 'none recorded'}.</p>
          <details><summary>Detailed numbers</summary>
          <p>{comparison}</p>
          <p>Form {review.formId} · {review.formVersion} · {review.specificationVersion} · {review.scoringVersion}.</p>
          <p>Presented {review.presented}; closed {review.closed}; unresolved {review.unresolvedPresented}; unpresented {review.unpresented}.</p>
          {review.metrics ? review.specificationVersion === 'arrows_spec_v1_1' ? <V11Results metrics={review.metrics} /> : <ResultsTable metrics={review.metrics} /> : <><p>No aggregate accuracy or timing is reported for this review-only attempt.</p>
            <details><summary>Review recorded events</summary><ol>{observed?.events.map(event => <li key={event.sequenceNumber}>{event.sequenceNumber}. {event.type} · trial {event.trialIndex} · {event.atMs.toFixed(1)} ms{eventDetail(event)}</li>)}</ol></details>
            <p>Events after the last durable checkpoint may be missing.</p></>}
          {review.metrics && <p>In this TraitGame sequence, you followed the cued direction on {review.metrics.overall.correct} of {review.presented} trials. This describes only this run.</p>}
          <p>Input: {review.profile.kind === 'keyboard' ? `${review.profile.leftCode} Left / ${review.profile.rightCode} Right` : `${review.profile.pointerSource} pointer`}. Alternative input declared: {review.profile.alternative ? 'yes' : 'no'}; display accommodation: {review.profile.accommodation}; reduced motion: {review.profile.reducedMotion ? 'yes' : 'no'}.</p>
          </details>
          <p className="note">{limitation}</p>
          {activityRetry && reportSurface?.handleId === activityRetry.handle.id &&
            reportSurface.opening === activityRetry.opening && reportSurface.generation === activityRetry.generation && selected?.sessionId === activityRetry.sessionId &&
            selected.state.identity.installationId === activityRetry.installationId &&
            <p role="status">Report-view activity could not be confirmed. <button onClick={() => void appendView(activityRetry)}>Retry report-view record</button></p>}
          {saveStatus === 'saved'&&!reportTarget && <button className="secondary" onClick={() => void loadHistory()}>View history</button>}
        </> : <p role="alert">{retired ? 'This attempt is no longer available. No numbers are shown.' : 'This report could not be reconciled. No numbers are available.'}</p>}
          {(saveStatus === 'pending' || saveStatus === 'unconfirmed') && !selected && reportSurface?.recoveryKind &&
            authorityStatus?.kind === 'current' && <button onClick={() => { const surface = recoverySurface.current; if (surface) void resumeReport(surface.session) }}>
              {reportSurface.recoveryKind === 'terminal' ? 'Try confirming save' : 'Verify or retry saved prefix'}</button>}
          {saveStatus === 'unconfirmed' && !selected && reportSurface && !reportSurface.recoveryKind &&
            authorityStatus?.kind === 'current' && <button onClick={() => { const surface = recoverySurface.current; if (surface) void resumeReport(surface.session) }}>Verify saved report</button>}
        {authorityStatus?.kind === 'blocked' && <><p role="alert">Saved data need a fresh integrity check. No numbers are shown. <button onClick={() => void verifyAttachedReport()}>Verify saved data</button></p>
          {deleteAllConfirm ? <div role="group" aria-label="Confirm Arrows deletion"><p>This permanently deletes all local Arrows attempts, results, events and form history in this browser. It cannot be undone. Other games are unaffected.</p>
            <button onClick={() => void deleteAll()}>Delete all Arrows data</button><button className="secondary" onClick={() => setDeleteAllConfirm(false)}>Cancel</button></div> : <button className="secondary" onClick={() => setDeleteAllConfirm(true)}>Delete all Arrows data</button>}
        </>}
        {mockError && <p role="alert">{mockError}</p>}{mockReady && mock && reportAuthority === 'verified' && saveStatus === 'saved' && !activityRetry &&
          <button onClick={returnToMock}>Continue mock</button>}
        <div className="actions">{!reportTarget&&<button onClick={replay}>Replay from guide</button>}<button className="secondary" onClick={mock?returnToMock:leave}>{mock||reportTarget?'Return to mock':'Back to library'}</button>{mock&&(mockError||saveStatus==='pending'||saveStatus==='unconfirmed')&&<button className="secondary" onClick={()=>leaveMockUnconfirmed()}>Return to mock with save unconfirmed</button>}</div></section>}
      {step === 'history' && <section className="panel" data-arrows-history-installation={store?.installationId}>
        <h1 ref={heading} tabIndex={-1}>Arrows history</h1>
        <p>Incomplete attempts cannot resume after reload. A new attempt begins at Block 1 and may reuse a form.</p>
        {history.length === 0 ? <p>No retained Arrows attempts in this browser.</p> : ['arrows_spec_v1_0', 'arrows_spec_v1_1'].map(version => history.some(attempt => attempt.state.specificationVersion === version) && <section key={version}><h2>{version === 'arrows_spec_v1_0' ? 'Arrows V1.0 · historical' : 'Arrows V1.1'}</h2><ul>{history.filter(attempt => attempt.state.specificationVersion === version).map(attempt => <li key={attempt.sessionId}>
          <strong>{attempt.state.form.id}</strong> · {attempt.state.specificationVersion} · {attempt.snapshot?.kind === 'terminal' ? attempt.snapshot.review.status.replace('_headless', '') : 'Incomplete / review only'} · {attempt.ordinal > 6 ? 'Repeated form · ' : ''}{attempt.profile.kind === 'keyboard' ? attempt.profile.leftCode === 'ArrowLeft' && attempt.profile.rightCode === 'ArrowRight' ? 'Default keys' : 'Modified keys' : `${attempt.profile.pointerSource} pointer`}{attempt.profile.alternative ? ' · Alternative input' : ''} · {new Date(attempt.createdAtWallMs).toLocaleString()}
          <div className="actions"><button onClick={() => void openReport(attempt)}>{attempt.snapshot?.kind === 'terminal' ? 'Open report' : 'Review saved trials'}</button>
            <button className="secondary" onClick={() => void remove(attempt.sessionId)}>Delete this attempt</button></div></li>)}</ul></section>)}
        {deleteAllConfirm ? <div role="group" aria-label="Confirm Arrows deletion"><p>This permanently deletes all local Arrows attempts, results, events and form history in this browser. It cannot be undone. Other games are unaffected.</p>
          <button onClick={() => void deleteAll()}>Delete all Arrows data</button><button className="secondary" onClick={() => setDeleteAllConfirm(false)}>Cancel</button></div> : <button className="secondary" onClick={() => setDeleteAllConfirm(true)}>Delete all Arrows data</button>}
        <div className="actions"><button onClick={replay}>Start a new practice</button><button className="secondary" onClick={mock?returnToMock:leave}>{mock?'Return to mock':'Main menu'}</button></div></section>}
    </div>
  </Shell>
}
