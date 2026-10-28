import { QuickRules } from '../onboarding/QuickRules'
import { ReportSummary } from '../reports/Summary'
import { digitsFeedback } from '../reports/feedback'
import { AssessmentUsageNotice } from '../assessment-usage/Notice'
// Event/effect handlers share an imperative coordinator; function declarations are hoisted.
/* oxlint-disable react/immutability, react/purity, react-hooks/exhaustive-deps */
import { standardDigits, unassistedDigitsMetrics } from '../assessment-usage/boundaries'
import { Attempt } from '../assessment-usage/client'
import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { DIGITS_SPEC_VERSION } from './contracts'
import type { Mode, Profile, RunState, VoiceIdentity } from './contracts'
import { DigitsBrowserRun, sampleDigitsVoice } from './browser'
import { acquireDigitsOwner } from './owner'
import { DigitsPersistence } from './persistence'
import { DigitsAdmission } from './admission'
import { DigitsNavigation, digitsTarget } from './navigation'
import type { Destination, NavigationTicket } from './navigation'
import { DigitsHandles } from './handles'
import { actualDigitsAssistance, removedDigitsReview, observedDigitsOnsets } from './review-context'
import { scoreDigits } from './scoring'
import type { DigitsReview } from './scoring'
import { DigitsStore, withDigitsDataOrder } from './storage'
import type { ArmRequest, DigitsAttempt, DigitsRoot, DigitsSnapshot } from './storage'
import { selectDigitsVoice, sameDigitsVoice } from './voice'
import type { MockJourneyContext } from '../mock/journey-context'
import type { ReportTarget } from '../mock/report-route'
import { withVerifiedReportPublication } from '../mock/report-route'
import { Shell } from '../core/Shell'
import './digits.css'

type Screen = 'loading' | 'guide' | 'examples' | 'quiz' | 'setup' | 'ready' |
  'playing' | 'feedback' | 'report' | 'history' | 'error' | 'pending'
const LIMITATION = "Practice only. Not a memory or hiring score. Visual, spoken and extended-time runs aren't comparable."
const SOURCE_NOTE = 'Your actual assessment invitation controls what to prepare. This is an independent practice exercise.'
function savedStatus(saved: boolean, status: DigitsReview['status']) {
  return saved ? status === 'valid' ? 'Saved in this browser' :
    'Review-only record saved in this browser' : 'This report is only in this tab and has not been confirmed saved.'
}
function conciseReason(reason: string | null) {
  return reason ? reason.replaceAll('_', ' ') : 'No terminal result was recorded.'
}
function comparableDigits(a: DigitsAttempt, b: DigitsAttempt) {
  const x = a.arm.profile, y = b.arm.profile
  return a.arm.specificationVersion === b.arm.specificationVersion &&
    a.arm.scoringVersion === b.arm.scoringVersion && a.arm.form.version === b.arm.form.version &&
    x.mode === y.mode && x.entryWindow === y.entryWindow && x.entryMethod === y.entryMethod &&
    x.assistedEntryDeclared === y.assistedEntryDeclared && x.highContrast === y.highContrast &&
    x.reducedMotion === y.reducedMotion &&
    (x.voice?.voiceURI ?? null) === (y.voice?.voiceURI ?? null) &&
    (x.voice?.lang ?? null) === (y.voice?.lang ?? null)
}
function digitsComparison(root: DigitsRoot, current: DigitsAttempt) {
  if (current.snapshot?.kind !== 'terminal' || current.snapshot.review.status !== 'valid') return null
  const earlier = Object.values(root.attempts).filter(item =>
    item.sessionId !== current.sessionId && (item.createdAtWallMs < current.createdAtWallMs ||
      item.createdAtWallMs === current.createdAtWallMs && item.ordinal < current.ordinal) &&
    item.snapshot?.kind === 'terminal' && item.snapshot.review.status === 'valid' &&
    comparableDigits(item, current))
    .sort((a, b) => b.createdAtWallMs - a.createdAtWallMs || b.ordinal - a.ordinal)[0]
  if (!earlier || earlier.snapshot?.review.status !== 'valid') return null
  return `Your earlier comparable run recalled ${earlier.snapshot.review.exactCorrect} sequences exactly; this run recalled ${current.snapshot.review.exactCorrect}. These are practice counts, not employer scores.`
}
function layoutObservation() {
  const baseline = { x: window.scrollX, y: window.scrollY,
      width: window.innerWidth, height: window.innerHeight,
      visualX: window.visualViewport?.offsetLeft ?? 0,
      visualY: window.visualViewport?.offsetTop ?? 0,
      visualWidth: window.visualViewport?.width ?? window.innerWidth,
      visualHeight: window.visualViewport?.height ?? window.innerHeight }
  return () => Math.abs(window.scrollX - baseline.x) > 0.5 ||
      Math.abs(window.scrollY - baseline.y) > 0.5 ||
      Math.abs(window.innerWidth - baseline.width) > 0.5 ||
      Math.abs(window.innerHeight - baseline.height) > 0.5 ||
      Math.abs((window.visualViewport?.offsetLeft ?? 0) - baseline.visualX) > 0.5 ||
      Math.abs((window.visualViewport?.offsetTop ?? 0) - baseline.visualY) > 0.5 ||
      Math.abs((window.visualViewport?.width ?? window.innerWidth) - baseline.visualWidth) > 0.5 ||
      Math.abs((window.visualViewport?.height ?? window.innerHeight) - baseline.visualHeight) > 0.5
}
function newArmRequest(profile: Profile): ArmRequest {
  return { requestId: crypto.randomUUID(), sessionId: crypto.randomUUID(),
    clockDomainId: crypto.randomUUID(), profile, route: 'standalone',
    atMs: performance.now(), wallMs: Date.now() }
}
function DigitsReport({ review, attempt, facts, retired, saved, authorityPending, laterUnknown, comparison, onReplay, onHistory, onLibrary, readOnly, returnToMock,
}: { review: DigitsReview; attempt: DigitsAttempt; facts: RunState; retired: boolean; saved: boolean; authorityPending: boolean;
  laterUnknown: boolean; comparison: string | null;
  onReplay: () => void; onHistory: () => void; onLibrary: () => void; readOnly?: boolean; returnToMock?: boolean }) {
  const profile = attempt.arm.profile
  return <section className="panel digits-report" aria-labelledby="digits-report-heading">
    <h2 id="digits-report-heading" tabIndex={-1}>{review.status === 'valid' && !authorityPending && !retired && saved ? review.maximumRecalledLength === null ? 'No sequence recalled exactly' : `Longest sequence: ${review.maximumRecalledLength} digits` : 'Digits report'}</h2>
    <p role="status">{retired ? 'This attempt was removed from local storage. Factual review is only available in this tab; it cannot be saved again.' : authorityPending ? 'Saved status cannot be confirmed while the authority check is pending.' :
      saved && !attempt.snapshot ? 'Start record saved; no completed result was saved.' :
        savedStatus(saved, review.status)}</p>
    {!authorityPending && !retired && saved && review.status === 'valid' && <ReportSummary feedback={{ ...digitsFeedback(review), metrics: [
      { label: 'Correct', value: String(review.exactCorrect) }, { label: 'Mistakes', value: String(review.wrong) },
      { label: 'Timed out', value: String(review.timedOut) }, { label: 'Skipped', value: String(review.skipped) },
    ] }} />}
    {review.status !== 'valid' && !authorityPending && <p role="alert">{review.status === 'invalid' ? 'Invalid' : 'Incomplete'}: {conciseReason(review.reason)}</p>}
    <details><summary>Detailed numbers</summary>
    {!authorityPending && !retired && saved && comparison && <p>{comparison}</p>}
    <p>{profile.mode} presentation · {profile.entryWindow === 35000 ?
      'extended entry' : 'standard entry'} · {profile.entryMethod} input
      {actualDigitsAssistance(facts) ? ' · assisted entry used' : ''}{profile.assistedEntryDeclared ? ' · assisted entry declared' : ''} · {profile.highContrast ? 'high contrast' : 'standard contrast'} · {profile.reducedMotion ? 'reduced motion' : 'standard motion'}</p>
    {authorityPending ? <p role="status">Checking whether this saved report is still available. Numbers are hidden until the check finishes.</p> :
      review.status === 'valid' ? <>
        <p>Maximum correctly recalled length: <strong>{review.maximumRecalledLength ?? 'No sequence recalled exactly'}</strong>.</p>
        <p>{review.closedTrials} trials · {review.exactCorrect} correct · {review.wrong} incorrect.</p>
        <p>{review.completionReason === 'three_mistakes' ? 'The run ended after three mistakes.' : 'The TraitGame limit of 40 trials was reached. The three-mistake ending was not reached.'}</p>
        <p>Skipped: {review.skipped}; timed out: {review.timedOut}
          {review.fullMatchingTimeouts > 0 ? `; ${review.fullMatchingTimeouts} full matching entries reached the deadline and were not scored correct` : ''}.</p>
        <h3>Accuracy by length</h3>
        <ul>{review.byLength.map(row => <li key={row.length}>{row.length} digits: {row.exact}/{row.of} ({row.percent.toFixed(1)}%)</li>)}</ul>
        <h3>String differences</h3>
        <p>Wrong digit {review.substitutions} · Swapped neighbours {review.transpositionPairs} · Missing at end {review.missingSuffix}.</p>
        <ul>{review.serialPositionErrors.map(row => <li key={row.position}>Position {row.position}: {row.errors}/{row.opportunities} differed ({row.percent.toFixed(1)}%)</li>)}</ul>
        <p>These results describe the selected TraitGame form only. Auditory and accommodated runs are reported separately.</p>
      </> : <>
        <p><strong>{review.status === 'invalid' ? 'Invalid' : 'Incomplete'}</strong>: {conciseReason(review.reason)}</p>
        {laterUnknown ? <p>The saved prefix records {review.presented} presentation starts and {review.closed} closed trials. Later presentation status is unknown; missing events do not prove that the remaining trials were unseen.</p> :
          <p>{review.presented} trials began presentation; {review.closed} closed; {review.unresolved} presented trials remain unresolved.</p>}
        <p>No aggregate accuracy or error table is shown. A reload may know only the last saved prefix; later presentation status can be unknown.</p>
      </>}
    {retired && <><h3>Observed presentation in this tab</h3>
      <ul>{observedDigitsOnsets(facts).map(row => <li key={row.trial}>Trial {row.trial}: {row.digits} digits began presentation.</li>)}</ul>
      <p>Known closed trials: {facts.closed.length}. No later exposure is inferred and no removed result is eligible as a saved report.</p></>}
    </details>
    <p className="note digits-limitation">{LIMITATION}</p>
    <div className="digits-actions">{!readOnly&&<><button onClick={onReplay}>Try again</button>
      <button className="secondary" onClick={onHistory}>History</button></>}
      <button className="secondary" data-mock-return-intent={returnToMock ? "" : undefined} onClick={onLibrary}>{returnToMock?'Return to mock':'Main menu'}</button></div>
  </section>
}

export function DigitsJourney({ onLibrary, mock, reportTarget }: { onLibrary: () => void; mock?: MockJourneyContext; reportTarget?: ReportTarget }) {
  const usage = useRef(new Attempt('digits'))
  useEffect(() => { const current=usage.current; return () => current.cancel() }, [])
  const [screen, setScreen] = useState<Screen>('loading')
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>(mock?.preferences.digitsMode ?? 'visual')
  const [entryMethod, setEntryMethod] = useState<Profile['entryMethod']>(mock?.preferences.controls === 'alternative' ? 'keypad' : 'keyboard')
  const [extended, setExtended] = useState(mock?.preferences.digitsEntryMs === 35000)
  const [highContrast, setHighContrast] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(mock?.preferences.reducedMotion ?? false)
  const [assistedDeclared, setAssistedDeclared] = useState(false)
  const [voice, setVoice] = useState<VoiceIdentity | null>(null)
  const [samplePassed, setSamplePassed] = useState(false)
  const [audibleConfirmed, setAudibleConfirmed] = useState(false)
  const [quizOrder, setQuizOrder] = useState('')
  const [quizFeedback, setQuizFeedback] = useState('')
  const [skipAvailable, setSkipAvailable] = useState(false)
  const skipSource = useRef<{ sessionId: string; profile: string } | null>(null)
  const skipChecking = useRef(false)
  const [inputCheck, setInputCheck] = useState('')
  const [entryActive, setEntryActive] = useState(false)
  const [entryValue, setEntryValue] = useState('')
  const [entryMessage, setEntryMessage] = useState('')
  const [countdown, setCountdown] = useState('')
  const [state, setState] = useState<RunState | null>(null)
  const [attempt, setAttempt] = useState<DigitsAttempt | null>(null)
  const [snapshot, setSnapshot] = useState<DigitsSnapshot | null>(null)
  const [saved, setSaved] = useState(false)
  const [historyReview, setHistoryReview] = useState(false)
  const [authorityPending, setAuthorityPending] = useState(false)
  const [comparison, setComparison] = useState<string | null>(null)
  const [history, setHistory] = useState<readonly DigitsAttempt[]>([])
  const [saveIssue, setSaveIssue] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [pendingStart, setPendingStart] = useState(false)
  const [retryCanceledStart, setRetryCanceledStart] = useState(false)
  const [retryUsedState, setRetryUsedState] = useState(false)
  const [mockReady, setMockReady] = useState(false), [mockError, setMockError] = useState('')
  const mockTerminalSeen = useRef<string | null>(null)
  const [retired, setRetired] = useState(false)
  const [destination, setDestination] = useState<Destination>('boot')
  const storeRef = useRef<DigitsStore | null>(null)
  const runnerRef = useRef<DigitsBrowserRun | null>(null)
  const releaseRef = useRef<(() => void) | null>(null)
  const startController = useRef<AbortController | null>(null)
  const startInFlight = useRef<Promise<void> | null>(null)
  const stimulusRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const pendingView = useRef<{ id: string; target: string; epoch: number; revision: number } | null>(null)
  const reportSession = useRef<string | null>(null)
  const attemptRef = useRef<DigitsAttempt | null>(null)
  const stateRef = useRef<RunState | null>(null)
  const frozenSave = useRef<RunState | null>(null)
  const persistenceRef = useRef<DigitsPersistence | null>(null)
  const pendingArm = useRef<DigitsAdmission | null>(null)
  const startCleanup = useRef<(() => void) | null>(null)
  const canceledStartWork = useRef<{ admission: DigitsAdmission; promise: Promise<void> } | null>(null)
  const retryUsed = useRef(false)
  const navigation = useRef(new DigitsNavigation())
  const handles = useRef(new DigitsHandles())
  const [handle, setHandle] = useState<DigitsStore | null>(null)
  const skipProfile = () => JSON.stringify({ mode, entryMethod, entryWindow: extended ? 35000 : 20000,
    highContrast, reducedMotion, assistedDeclared, voice: mode === 'auditory' ? voice?.voiceURI ?? null : null })
  const completedForSkip = (item: DigitsAttempt) => item.snapshot?.kind === 'terminal' &&
    item.snapshot.review.status === 'valid' && item.snapshot.state.specificationVersion === DIGITS_SPEC_VERSION &&
    JSON.stringify({ mode: item.arm.profile.mode, entryMethod: item.arm.profile.entryMethod,
      entryWindow: item.arm.profile.entryWindow, highContrast: item.arm.profile.highContrast,
      reducedMotion: item.arm.profile.reducedMotion, assistedDeclared: item.arm.profile.assistedEntryDeclared,
      voice: item.arm.profile.mode === 'auditory' ? item.arm.profile.voice?.voiceURI ?? null : null }) === skipProfile()
  useEffect(() => {
    if (!handle || screen!=='guide') return
    let active=true,pending=false
    const check=()=>{if(pending||document.hidden||!document.hasFocus())return;pending=true;void withDigitsDataOrder(()=>handle.list()).then(entries=>{
      if(active)setSkipAvailable(entries.some(completedForSkip))
    }).catch(()=>{if(active)setSkipAvailable(false)}).finally(()=>{pending=false})}
    check();const timer=window.setInterval(check,1000)
    return ()=>{active=false;window.clearInterval(timer)}
  },[handle,screen])
  async function skipTutorial() {
    if(!handle)return
    const ticket=navigation.current.capture('skip')
    try {
      const entries=await withDigitsDataOrder(()=>handle.list())
      if(!admitted(ticket))return
      const source=entries.find(completedForSkip)
      if(!source) {
        setSkipAvailable(false);setQuizFeedback('A current completed Digits run is no longer saved. Check the rule instead.');return
      }
      skipSource.current={sessionId:source.sessionId,profile:skipProfile()}
      if(screen==='guide'){go('setup');void refreshVoices()}
    }catch{if(admitted(ticket)){setSkipAvailable(false);setQuizFeedback('Saved Digits history could not be checked. Use the rule check instead.')}}
  }
  const openedReportTarget=useRef<string|null>(null)
  useEffect(()=>{if(!handle||!reportTarget||openedReportTarget.current===reportTarget.attemptId)return;openedReportTarget.current=reportTarget.attemptId;
    void withDigitsDataOrder(async()=>{const exact=await handle.load(reportTarget.attemptId);if(!exact)throw Error('The exact Digits record is unavailable');return exact})
      .then(exact=>openSaved(exact)).catch(()=>setError('The exact Digits report is unavailable.'))
  },[handle,reportTarget])
  const pollWork = useRef<NavigationTicket | null>(null)
  const admissionLeases = useRef(new Map<DigitsAdmission, () => void>())
  const background = useRef(new Set<Promise<unknown>>())
  const voiceWork = useRef(0)
  const releaseOwner = () => { releaseRef.current?.(); releaseRef.current = null }
  const admitted = (ticket: NavigationTicket) => navigation.current.admits(ticket)
  function track(work: Promise<unknown>) {
    background.current.add(work)
    void work.finally(() => background.current.delete(work)).catch(() => undefined)
  }
  function markRetry(value: boolean) { retryUsed.current = value; setRetryUsedState(value) }
  function resetView() {
    reportSession.current = null; pendingView.current = null; frozenSave.current = null
    markRetry(false); setHistoryReview(false)
    setSnapshot(null); setSaved(false); setAuthorityPending(false); setComparison(null); setSaveIssue(null)
  }
  function show(ticket: NavigationTicket, next: Screen) {
    if (!admitted(ticket)) return false
    setDestination(ticket.destination); setScreen(next); return true
  }
  function stopLive() {
    startCleanup.current?.(); startCleanup.current = null
    const pending = pendingArm.current
    if (pending) { pending.cancel('page_exit', performance.now())
      track(reconcileCanceledStart(pending, null)) }
    startController.current?.abort(); startController.current = null
    const runner = runnerRef.current, persist = persistenceRef.current
    runnerRef.current = null
    if (runner?.protected) {
      runner.invalidate('page_exit')
      if (persist) track(handles.current.work(runner.store, () => persist.save(runner.state)).catch(() => undefined))
    }
    runner?.retire(); releaseOwner(); persistenceRef.current = null
  }
  function begin(destination: Destination, next: Screen, target?: string) {
    if(destination!=='library')mock?.retireReturnIntent()
    const ticket = navigation.current.begin(destination, storeRef.current, target)
    pollWork.current = null; voiceWork.current++
    stopLive()
    attemptRef.current = null; stateRef.current = null
    flushSync(() => { resetView(); setAttempt(null); setState(null); setError(pendingArm.current?.canceled ? 'Your last start was interrupted, and its saved status is not confirmed. Retry saving before starting again.' : null); setStarting(false); setEntryActive(false); setPendingStart(!!pendingArm.current); setRetryCanceledStart(!!pendingArm.current?.canceled); setRetired(false); setDestination(destination); setScreen(next) })
    return ticket
  }
  function go(next: Screen) { begin('prepare', next) }
  function changedSetup() {
    const ticket = navigation.current.begin('prepare', storeRef.current)
    voiceWork.current++
    const old = startInFlight.current
    const admission = pendingArm.current
    const controller = startController.current
    if (!old && !admission) return
    admission?.cancel('setup_changed', performance.now())
    controller?.abort()
    setStarting(true)
    const reconcile = admission ? reconcileCanceledStart(admission, null) : Promise.resolve()
    void Promise.allSettled([old, reconcile].filter((work): work is Promise<void> => !!work)).then(() => {
      if (!admitted(ticket)) return
      if (startController.current === controller) startController.current = null
      setPendingStart(!!pendingArm.current)
      if (pendingArm.current?.canceled) {
        setRetryCanceledStart(true)
        setError('Your last start was interrupted, and its saved status is not confirmed. Retry saving before starting again.')
      }
      setStarting(false)
    })
  }
  function library() { begin('library', 'pending'); onLibrary() }
  async function acquireCurrent(ticket: NavigationTicket): Promise<NavigationTicket | null> {
    if (!admitted(ticket)) return null
    const pool = handles.current
    const opened = await (mock||reportTarget?DigitsStore.openForMock(undefined,!reportTarget):DigitsStore.open())
    const adopted = navigation.current.adopt(ticket, opened)
    if (!adopted) { opened.close(); return null }
    pool.adopt(opened); storeRef.current = opened; setHandle(opened)
    return adopted
  }
  function setRunState(next: RunState, ticket: NavigationTicket) {
    if (!admitted(ticket) || ticket.target !== digitsTarget(attemptRef.current!)) return
    const prior = stateRef.current
    stateRef.current = next; setState(next)
    if (next.phase === 'invalid' && prior?.phase !== 'invalid') {
      releaseOwner(); setSaved(false); setSnapshot(null); show(ticket, 'report')
      void saveCurrent(next, ticket)
    }
  }

  useEffect(() => {
    const nav = navigation.current, pool = new DigitsHandles()
    handles.current = pool
    const ticket = nav.activate(), backgroundWork = background.current, leases = admissionLeases.current
    void (mock||reportTarget?DigitsStore.openForMock(undefined,!reportTarget):DigitsStore.open()).then(opened => {
      const adopted = nav.adopt(ticket, opened)
      if (!adopted) { opened.close(); return }
      pool.adopt(opened); storeRef.current = opened; setHandle(opened)
      const guide = nav.begin('prepare', opened); show(guide, 'guide')
    }).catch(() => { if (nav.admits(ticket)) {
      setError('Local storage is unavailable. A scored Digits result cannot start.'); show(ticket, 'error') } })
    return () => {
      nav.dispose(); stopLive()
      // Captured background reconciliation owns its connection until its known prefix is saved.
      void Promise.allSettled([...backgroundWork]).finally(() => {
        for (const release of leases.values()) release()
        leases.clear(); pool.dispose()
      })
      storeRef.current = null
    }
  }, [])
  useEffect(() => {
    if (!handle) return
    return handle.subscribeDeletion(notice => {
      if (notice.installationId !== handle.installationId || navigation.current.currentHandle !== handle) return
      if (navigation.current.currentDestination === 'history') { void refreshHistory(); return }
      const current = attemptRef.current
      if (!current || current.arm.identity.installationId !== notice.installationId ||
        notice.type === 'attempt_deleted' && notice.sessionId !== current.sessionId) return
      void checkTargetAuthority(navigation.current.capture('authority'), handle, current)
    })
  }, [handle])
  useEffect(() => {
    if (screen !== 'playing' && screen !== 'report' && screen !== 'feedback' && screen !== 'history') return
    const timer = window.setInterval(() => {
      if (pollWork.current) return
      if (screen === 'history') { void refreshHistory(true); return }
      const store = storeRef.current, current = attemptRef.current
      if (!store || !current || navigation.current.isRetired(digitsTarget(current))) return
      const ticket = navigation.current.capture('authority')
      pollWork.current = ticket
      void checkTargetAuthority(ticket, store, current).finally(() => {
        if (pollWork.current === ticket) pollWork.current = null
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [screen, saved, handle])
  async function checkTargetAuthority(ticket: NavigationTicket, store: DigitsStore, target: DigitsAttempt) {
    if (!admitted(ticket)) return
    let resolved = false
    const frame = requestAnimationFrame(() => {
      if (!resolved && admitted(ticket) && navigation.current.currentTarget === digitsTarget(target) && screen === 'report' && saved)
        setAuthorityPending(true)
    })
    try {
      const publish=async (permit=()=>{}) => {
        if (!admitted(ticket)) return
        const root = await store.read()
        const retained = root.attempts[target.sessionId] ?? null
        resolved = true; cancelAnimationFrame(frame)
        if (!admitted(ticket)) return
        if (!retained || digitsTarget(retained) !== digitsTarget(target)) retire(digitsTarget(target), 'This saved attempt was deleted.')
        else if (screen === 'report') {permit();flushSync(() => {setAuthorityPending(false);setComparison(digitsComparison(root, retained))})}
      }
      await handles.current.work(store, () => reportTarget?withVerifiedReportPublication(reportTarget,publish):withDigitsDataOrder(()=>publish()))
    } catch (failure) {
      if (!admitted(ticket)) return
      if (/installation replaced/.test(String(failure))) retire(digitsTarget(target), 'Local data was replaced.')
      else if (screen === 'report') setAuthorityPending(true)
    } finally { resolved = true; cancelAnimationFrame(frame) }
  }
  const liveScreen = screen === 'playing' || screen === 'feedback'
  useEffect(() => {
    if (!liveScreen) return
    const ticket = navigation.current.capture()
    const invalid = (reason: string) => { if (admitted(ticket)) runnerRef.current?.invalidate(reason) }
    const hidden = () => { if (document.visibilityState !== 'visible') invalid('hidden') }
    const blur = () => invalid('blur')
    const freeze = () => invalid('freeze')
    const exit = () => invalid('page_exit')
    const changed = layoutObservation()
    const layout = () => { if (changed()) invalid('viewport_changed') }
    document.addEventListener('visibilitychange', hidden)
    window.addEventListener('blur', blur)
    const voicesChanged = () => { const live = stateRef.current
      if (live?.profile.mode === 'auditory' && live.profile.voice &&
        !sameDigitsVoice(live.profile.voice, speechSynthesis.getVoices())) invalid('voice_changed') }
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.addEventListener('voiceschanged', voicesChanged)
    document.addEventListener('freeze', freeze)
    window.addEventListener('pagehide', exit)
    window.addEventListener('resize', layout)
    window.addEventListener('scroll', layout)
    window.addEventListener('orientationchange', layout)
    window.visualViewport?.addEventListener('resize', layout)
    window.visualViewport?.addEventListener('scroll', layout)
    return () => { document.removeEventListener('visibilitychange', hidden)
      if (typeof speechSynthesis !== 'undefined') speechSynthesis.removeEventListener('voiceschanged', voicesChanged)
      window.removeEventListener('blur', blur); document.removeEventListener('freeze', freeze)
      window.removeEventListener('pagehide', exit); window.removeEventListener('resize', layout)
      window.removeEventListener('scroll', layout); window.removeEventListener('orientationchange', layout)
      window.visualViewport?.removeEventListener('resize', layout)
      window.visualViewport?.removeEventListener('scroll', layout) }
  }, [liveScreen])
  useEffect(() => {
    if (screen !== 'playing' || !entryActive || !state?.entryDeadlineMs) return
    const ticket = navigation.current.capture()
    const announced = new Set<number>()
    const timer = window.setInterval(() => {
      if (!admitted(ticket)) return
      const remain = Math.max(0, Math.ceil((state.entryDeadlineMs! - performance.now()) / 1000))
      if ([10, 5, 0].includes(remain) && !announced.has(remain)) {
        announced.add(remain); setCountdown(`${remain} seconds remaining`)
      }
    }, 100)
    return () => clearInterval(timer)
  }, [screen, entryActive, state?.entryDeadlineMs])
  useEffect(() => {
    if (screen === 'playing' && entryActive) return
    document.querySelector<HTMLElement>('.journey.digits h1[tabindex], .journey.digits h2[tabindex]')?.focus({ preventScroll: true })
  }, [screen, entryActive])

  function currentProfile(): Profile {
    const chosen = mode === 'auditory' ? voice : null
    return { mode, entryWindow: extended ? 35000 : 20000,
      highContrast, reducedMotion, entryMethod, assistedEntryDeclared: assistedDeclared,
      voice: chosen, browserContext: { userAgent: navigator.userAgent.slice(0, 512),
        viewportWidth: window.innerWidth, viewportHeight: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio } }
  }
  async function refreshVoices() {
    changedSetup()
    const ticket = navigation.current.capture(), sequence = ++voiceWork.current
    const selected = typeof speechSynthesis !== 'undefined' ? selectDigitsVoice(speechSynthesis.getVoices()) : null
    if (!admitted(ticket) || sequence !== voiceWork.current) return
    setVoice(selected ? { voiceURI: selected.voiceURI, lang: selected.lang, localService: true } : null)
    setSamplePassed(false); setAudibleConfirmed(false)
  }
  async function playSamples() {
    if (!voice) return
    changedSetup()
    const ticket = navigation.current.capture(), sequence = ++voiceWork.current, selected = voice
    setSamplePassed(false); setAudibleConfirmed(false)
    try {
      const okay = await sampleDigitsVoice(selected)
      if (!admitted(ticket) || sequence !== voiceWork.current) return
      setSamplePassed(okay)
      if (!okay) setError('The local voice did not complete both browser samples. Use visual Practice or recheck the voice.')
    } catch { if (admitted(ticket) && sequence === voiceWork.current) setError('The local voice sample could not be verified.') }
  }
  async function reconcileCanceledStart(admission: DigitsAdmission, ticket: NavigationTicket | null) {
    if (canceledStartWork.current?.admission === admission) return canceledStartWork.current.promise
    let settled = false
    const pool = handles.current
    const cleanup = startCleanup.current
    const work = pool.work(admission.store, async () => {
      try {
        const known = await admission.reconcileCancellation()
        if (!known) {
          settled = true
          if (ticket && admitted(ticket)) { releaseOwner(); setError('Start canceled before any retained result could be confirmed. Start a new attempt to continue.'); show(ticket, 'ready') }
          return
        }
        await admission.store.save(known.attempt, known.state)
        settled = true
        if (!ticket || !admitted(ticket)) return
        const selected = navigation.current.select(ticket, known.attempt)
        if (!selected) return
        attemptRef.current = known.attempt; stateRef.current = known.state
        persistenceRef.current = new DigitsPersistence(admission.store, known.attempt)
        releaseOwner(); markRetry(false)
        flushSync(() => { setAttempt(known.attempt); setState(known.state); show(selected, 'report'); setError(null) })
        await saveCurrent(known.state, selected)
      } catch {
        let sourceChanged: 'deleted' | 'replaced' | null = null
        try {
          const root = await admission.store.read()
          const id = admission.request.sessionId
          if (!root.attempts[id] && root.tombstones[id]?.requestId === admission.request.requestId)
            sourceChanged = 'deleted'
        } catch { /* A failed read is not evidence of deletion. */ }
        if (!sourceChanged) {
          try {
            const current = await DigitsStore.openRetained(new AbortController().signal)
            sourceChanged = current.installationId !== admission.store.installationId ? 'replaced' : null
            current.close()
          } catch { /* An unavailable replacement read leaves custody unresolved. */ }
        }
        if (sourceChanged) settled = true
        const visible = ticket && admitted(ticket) ? ticket :
          navigation.current.currentDestination === 'prepare' && navigation.current.currentHandle === admission.store ? navigation.current.capture() : null
        if (!visible || !admitted(visible)) return
        if (sourceChanged) {
          setError(sourceChanged === 'deleted' ? 'The saved Digits start was deleted. Reload Digits before another attempt.' :
            'Local Digits data was replaced. Reload Digits before another attempt.')
          show(visible, 'error')
        } else {
          setRetryCanceledStart(true)
          setError('Your last start was interrupted, and its saved status is not confirmed. Retry saving before starting again.')
          show(visible, 'ready')
        }
      } finally {
        if (settled) {
          if (pendingArm.current === admission) {
            pendingArm.current = null
            if (admitted(navigation.current.capture())) {
              setPendingStart(false); setRetryCanceledStart(false)
              setError(previous => previous?.startsWith('Your last start was interrupted, and its saved status is not confirmed.') ? null : previous)
            }
            if (startController.current === admission.controller) startController.current = null
            if (startCleanup.current === cleanup) { cleanup?.(); startCleanup.current = null }
          }
          admissionLeases.current.get(admission)?.(); admissionLeases.current.delete(admission)
        }
      }
    })
    canceledStartWork.current = { admission, promise: work }
    try { await work } finally { if (canceledStartWork.current?.promise === work) canceledStartWork.current = null }
  }
  function start(): Promise<void> {
    if (startInFlight.current || starting || skipChecking.current || !storeRef.current) return Promise.resolve()
    const work = startAttempt()
    startInFlight.current = work
    void work.finally(() => { if (startInFlight.current === work) startInFlight.current = null }).catch(() => undefined)
    return work
  }
  async function startAttempt() {
    const selectedStore = storeRef.current
    if (!selectedStore) return
    const skip = skipSource.current
    if (skip) {
      const entry = navigation.current.capture('skip')
      skipChecking.current = true
      setStarting(true)
      try {
        const entries = await withDigitsDataOrder(() => selectedStore.list())
        if (!admitted(entry)) return
        if (skip.profile !== skipProfile() || !entries.some(item => item.sessionId === skip.sessionId && completedForSkip(item))) {
          skipSource.current = null; setSkipAvailable(false); setInputCheck('');setQuizOrder(''); setQuizFeedback('The completed run used to skip the guide changed or was deleted. Check the rule to continue.')
          setStarting(false); go('quiz'); return
        }
        skipSource.current = null
      } catch {
        if (admitted(entry)) { setStarting(false);setQuizOrder(''); setQuizFeedback('The completed run used to skip the guide could not be checked. Check the rule to continue.'); go('quiz') }
        return
      } finally { skipChecking.current = false }
    }
    usage.current.begin(mock?'mock':'practice')
    const ticket = navigation.current.begin('run', selectedStore)
    pollWork.current = null
    setStarting(true); setError(null); resetView()
    startCleanup.current?.(); startCleanup.current = null
    const controller = pendingArm.current?.controller ?? new AbortController()
    const ownerController = new AbortController()
    startController.current = ownerController
    let canceledAdmission: DigitsAdmission | null = null
    const cancelStart = (reason: string) => {
      if (!admitted(ticket)) return
      const admission = pendingArm.current
      if (admission) { canceledAdmission = admission; admission.cancel(reason, performance.now())
        setStarting(true)
        void reconcileCanceledStart(admission, ticket).finally(() => { if (admitted(ticket)) setStarting(false) })
      } else { controller.abort(); ownerController.abort() }
    }
    const blurStart = () => cancelStart('blur'), exitStart = () => cancelStart('page_exit')
    const freezeStart = () => cancelStart('freeze')
    const hiddenStart = () => { if (document.visibilityState !== 'visible') cancelStart('hidden') }
    const changed = layoutObservation()
    const layoutStart = () => { if (changed()) cancelStart('viewport_changed') }
    const voicesStart = () => { const selected = pendingArm.current?.request.profile.voice
      if (selected && !sameDigitsVoice(selected, speechSynthesis.getVoices())) cancelStart('voice_changed') }
    window.addEventListener('blur', blurStart); window.addEventListener('pagehide', exitStart)
    document.addEventListener('visibilitychange', hiddenStart); document.addEventListener('freeze', freezeStart)
    window.addEventListener('resize', layoutStart); window.addEventListener('scroll', layoutStart)
    window.addEventListener('orientationchange', layoutStart)
    window.visualViewport?.addEventListener('resize', layoutStart); window.visualViewport?.addEventListener('scroll', layoutStart)
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.addEventListener('voiceschanged', voicesStart)
    const cleanup = () => { window.removeEventListener('resize', layoutStart); window.removeEventListener('scroll', layoutStart)
      window.removeEventListener('orientationchange', layoutStart)
      window.visualViewport?.removeEventListener('resize', layoutStart); window.visualViewport?.removeEventListener('scroll', layoutStart)
      if (typeof speechSynthesis !== 'undefined') speechSynthesis.removeEventListener('voiceschanged', voicesStart)
      window.removeEventListener('blur', blurStart); window.removeEventListener('pagehide', exitStart)
      document.removeEventListener('visibilitychange', hiddenStart); document.removeEventListener('freeze', freezeStart) }
    startCleanup.current = cleanup
    let release: (() => void) | null = null
    const releaseStore = handles.current.lease(selectedStore)
    try {
      if (pendingArm.current?.canceled) { await reconcileCanceledStart(pendingArm.current, ticket); return }
      if (mode === 'auditory' && (!voice || !samplePassed || !audibleConfirmed ||
        !sameDigitsVoice(voice, speechSynthesis.getVoices()))) throw Error('Auditory setup is unavailable; choose visual Practice or replay the samples.')
      release = await acquireDigitsOwner(ownerController.signal)
      if (!admitted(ticket) || controller.signal.aborted) throw Error('Start canceled')
      releaseRef.current = release
      if (!pendingArm.current) {
        pendingArm.current = new DigitsAdmission(selectedStore, newArmRequest(currentProfile()), controller)
        setPendingStart(true)
        admissionLeases.current.set(pendingArm.current, handles.current.lease(selectedStore))
      }
      const admission = pendingArm.current
      startController.current = admission.controller
      if (mock) await mock.beforeArm({ requestId: admission.request.requestId, attemptId: admission.request.sessionId,
        originTicketId: null, installationId: selectedStore.installationId, generation: null,
        requestKind: 'arm', nativeIdentity: [] })
      if(!admitted(ticket) || controller.signal.aborted || admission.canceled)throw Error('Start canceled')
      let armTimer = 0
      const arm = await Promise.race([admission.arm(), new Promise<never>((_resolve, reject) => {
        armTimer = window.setTimeout(() => reject(Error('Start could not be confirmed. Retry Start to verify the same request.')), 2500)
      })]).finally(() => clearTimeout(armTimer))
      if (admission.canceled) { await reconcileCanceledStart(admission, admitted(ticket) ? ticket : null); return }
      if (!admitted(ticket)) return
      const live = navigation.current.select(ticket, arm)
      if (!live) throw Error('Start authority changed')
      releaseRef.current = release; release = null
      usage.current.admit(arm.sessionId,standardDigits(arm.arm.profile))
      attemptRef.current = arm; stateRef.current = arm.arm
      persistenceRef.current = new DigitsPersistence(selectedStore, arm)
      pendingArm.current = null; setPendingStart(false)
      admissionLeases.current.get(admission)?.(); admissionLeases.current.delete(admission)
      cleanup(); if (startCleanup.current === cleanup) startCleanup.current = null
      flushSync(() => { setAttempt(arm); setState(arm.arm); show(live, 'playing') })
      if (!stimulusRef.current) throw Error('Stimulus footprint unavailable')
      const runner = new DigitsBrowserRun(arm, selectedStore, { stimulus: () => admitted(live) ? stimulusRef.current : null,
        entry: () => admitted(live) ? inputRef.current : null,
        controls: () => admitted(live) ? inputRef.current?.closest<HTMLElement>('.digits-entry') ?? null : null,
        keypad: () => admitted(live) ? document.querySelector<HTMLElement>('.digits-keypad') : null,
        showEntry: () => { if (admitted(live)) flushSync(() => { setEntryActive(true); setEntryValue(''); setCountdown('') }) },
        hideEntry: () => { if (admitted(live)) flushSync(() => { setEntryActive(false); setEntryValue(''); setCountdown('') }) },
        onState: next => setRunState(next, live),
        onRetired: message => { if (admitted(live)) retire(digitsTarget(arm), message) } })
      runnerRef.current = runner
      await runTrial(runner, live)
    } catch (failure) {
      if (canceledAdmission) await reconcileCanceledStart(canceledAdmission, admitted(ticket) ? ticket : null)
      else if (admitted(ticket) && pendingArm.current?.canceled) await reconcileCanceledStart(pendingArm.current, ticket)
      else if (admitted(ticket)) { releaseOwner(); setError(failure instanceof Error ? failure.message : 'Start failed'); show(ticket, 'ready') }
    } finally {
      if (releaseRef.current === release) releaseRef.current = null
      release?.(); releaseStore()
      if (!pendingArm.current || !admitted(ticket)) { cleanup(); if (startCleanup.current === cleanup) startCleanup.current = null }
      if (admitted(ticket)) setStarting(false)
    }
  }
  async function saveCurrent(current: RunState, origin: NavigationTicket) {
    const arm = attemptRef.current, store = origin.handle, persistence = persistenceRef.current
    if (!arm || !store || !persistence || !admitted(origin) || digitsTarget(arm) !== origin.target) return
    const ticket = navigation.current.capture('save')
    frozenSave.current = current
    setSaved(false); setSnapshot(null); setSaveIssue(null)
    let timer: number | null = null
    const work = handles.current.work(store, () => persistence.save(current))
    try {
      const savedSnapshot = await Promise.race([work, new Promise<never>((_resolve, reject) => {
        timer = window.setTimeout(() => reject(Error('Save confirmation is still pending')), 2500)
      })])
      if (!admitted(ticket) || stateRef.current !== current) return
      setSnapshot(savedSnapshot)
      if (current.phase === 'completed' || current.phase === 'invalid') await publishReport(arm, 'live', ticket)
      else { setSaved(true); markRetry(false) }
    } catch (failure) {
      if (!admitted(ticket) || stateRef.current !== current) return
      setSaved(false); setSaveIssue(failure instanceof Error ? failure.message : 'Save unconfirmed')
      if (current.phase === 'completed' || current.phase === 'invalid') show(ticket, 'report')
      void checkTargetAuthority(navigation.current.capture('authority'), store, arm)
    } finally { if (timer !== null) clearTimeout(timer) }
  }
  async function runTrial(runner: DigitsBrowserRun, ticket: NavigationTicket) {
    try {
      const next = await runner.runTrial()
      if (!admitted(ticket) || runnerRef.current !== runner) return
      stateRef.current = next
      if (next.phase === 'completed' || next.phase === 'invalid') { releaseOwner(); show(ticket, 'report') }
      if (next.phase === 'feedback') show(ticket, 'feedback')
      if (next.phase === 'completed' || next.phase === 'feedback') { markRetry(false); await saveCurrent(next, ticket) }
    } catch (failure) { if (admitted(ticket)) {
      setError(failure instanceof Error ? failure.message : 'Trial could not start')
      if (runner.state.phase === 'feedback') show(ticket, 'feedback')
      else if (runner.state.phase === 'armed') runner.invalidate('start_admission_failed')
    } }
  }
  async function nextTrial() {
    const runner = runnerRef.current, current = stateRef.current
    if (!runner || !current || current.phase !== 'feedback' || !saved || !snapshot) return
    const ticket = navigation.current.capture()
    if (!admitted(ticket)) return
    setError(null); setSaved(false); setSnapshot(null); flushSync(() => show(ticket, 'playing'))
    await runTrial(runner, ticket)
  }
  function endAtFeedback() { runnerRef.current?.invalidate('candidate_ended') }
  async function retrySave() {
    const ticket = navigation.current.capture(), arm = attemptRef.current, candidate = frozenSave.current
    if (!admitted(ticket) || !arm || ticket.target !== digitsTarget(arm) || retryUsed.current) return
    markRetry(true)
    if (candidate) await saveCurrent(candidate, ticket)
    else await publishReport(arm, 'history', ticket)
  }
  function retire(key: string, message: string) {
    usage.current.cancel()
    const current = attemptRef.current
    const matches = current && digitsTarget(current) === key
    const facts = matches ? runnerRef.current?.state ?? stateRef.current : null
    const ticket = navigation.current.retire(key)
    if (!ticket || !matches || !facts) return
    pollWork.current = null
    startCleanup.current?.(); startCleanup.current = null
    startController.current?.abort(); pendingArm.current = null
    runnerRef.current?.retire(); runnerRef.current = null
    releaseOwner(); frozenSave.current = null; persistenceRef.current = null
    reportSession.current = null; pendingView.current = null
    stateRef.current = facts
    flushSync(() => { setState(facts); setRetired(true); setSnapshot(null); setSaved(false); setAuthorityPending(false); setSaveIssue(null); setError(message); show(ticket, 'report') })
  }
  async function publishReport(wanted: DigitsAttempt, surface: 'live' | 'history', origin: NavigationTicket) {
    if (!admitted(origin) || !origin.handle) return
    const store = origin.handle, key = digitsTarget(wanted), ticket = navigation.current.capture('report')
    setAuthorityPending(true)
    try {
      const publish=async (permit=()=>{}) => {
        if (!admitted(ticket)) return
        const retained = await store.load(wanted.sessionId)
        if (!admitted(ticket)) return
        if (!retained?.snapshot || digitsTarget(retained) !== key) throw Error('Saved report unavailable')
        const revision = retained.snapshot.revision
        const pending = pendingView.current
        const viewId = pending?.target === key && pending.epoch === ticket.epoch && pending.revision === revision ? pending.id : crypto.randomUUID()
        pendingView.current = { id: viewId, target: key, epoch: ticket.epoch, revision }
        if (!admitted(ticket)) return
        await store.appendReportView(wanted.sessionId, viewId, surface, Date.now())
        if (!admitted(ticket)) return
        const root = await store.read()
        const verified = root.attempts[wanted.sessionId] ?? null
        if (!admitted(ticket)) return
        if (!verified?.snapshot || digitsTarget(verified) !== key || verified.snapshot.revision !== revision) throw Error('Saved report changed')
        permit()
        attemptRef.current = verified; stateRef.current = verified.snapshot.state; reportSession.current = wanted.sessionId
        flushSync(() => { setAttempt(verified); setState(verified.snapshot!.state); setHistoryReview(surface === 'history')
          setSnapshot(verified.snapshot!); setSaved(true); setAuthorityPending(false); setComparison(digitsComparison(root, verified)); show(ticket, 'report') })
        if (admitted(ticket)) pendingView.current = null
        if(surface==='live' && verified.snapshot.kind==='terminal'){const r=verified.snapshot.review
          if(r.status==='valid'){const metrics=unassistedDigitsMetrics(r);if(metrics)usage.current.finish(wanted.sessionId,'completed',()=>metrics);else usage.current.cancel()}
          else usage.current.finish(wanted.sessionId,r.status)
        }
      }
      await handles.current.work(store, () => reportTarget?withVerifiedReportPublication(reportTarget,publish):withDigitsDataOrder(()=>publish()))
      if (mock && surface === 'live' && admitted(ticket) && mockTerminalSeen.current !== wanted.sessionId) {
        mockTerminalSeen.current = wanted.sessionId
        void mock.terminal().then(status => { setMockReady(status === 'ready'); if (status === 'review_only') setMockError('This attempt needs review. Return to mock to try again or skip this game.') })
          .catch(cause => { mockTerminalSeen.current = null; setMockError(cause instanceof Error ? cause.message : 'Mock result acknowledgement could not be confirmed.') })
      }
    } catch (failure) { if (admitted(ticket)) {
      if (/installation replaced|Saved report unavailable/.test(String(failure))) {
        if (attemptRef.current && digitsTarget(attemptRef.current) === key) retire(key, 'This saved attempt was deleted or local data was replaced.')
        else { navigation.current.retire(key); setError('This saved record was removed.'); show(navigation.current.capture(undefined, true), 'error') }
      } else { setAuthorityPending(true); setSaveIssue(failure instanceof Error ? failure.message : 'Report view unavailable')
        if (attemptRef.current && stateRef.current) show(ticket, 'report')
        else { setError('The saved record could not be verified.'); show(ticket, 'error') }
      }
    } }
  }
  async function readHistory(origin: NavigationTicket, fresh: boolean) {
    let ticket: NavigationTicket | null = origin
    for (let tries = 0; tries < 2; tries++) {
      try {
        if (!ticket || !admitted(ticket)) return
        if (fresh || tries) ticket = await acquireCurrent(ticket)
        if (!ticket?.handle || !admitted(ticket)) return
        const selected = ticket, store = ticket.handle
        await handles.current.work(store, () => withDigitsDataOrder(async () => {
          if (!admitted(selected)) return
          const listed = await store.list()
          if (!admitted(selected)) return
          const eligible = listed.filter(item => !navigation.current.isRetired(digitsTarget(item)))
          flushSync(() => { setHistory(eligible); setError(null); show(selected, 'history') })
        }))
        return
      } catch (failure) {
        if (!ticket || !admitted(ticket)) return
        if (tries === 0 && /installation replaced/.test(String(failure))) { fresh = true; continue }
        setError('History could not be read. Local data may be unavailable.'); show(ticket, 'error'); return
      }
    }
  }
  async function openHistory() {
    begin('history', 'pending')
    await readHistory(navigation.current.capture('history'), true)
  }
  async function refreshHistory(poll = false) {
    if (navigation.current.currentDestination !== 'history') return
    const ticket = navigation.current.capture('history')
    if (poll) pollWork.current = ticket
    try { await readHistory(ticket, false) }
    finally { if (pollWork.current === ticket) pollWork.current = null }
  }
  async function openSaved(wanted: DigitsAttempt) {
    const ticket = begin('review', 'pending', digitsTarget(wanted)), store = ticket.handle
    if (navigation.current.isRetired(digitsTarget(wanted))) { setError('This saved record was removed.'); show(navigation.current.capture(undefined, true), 'error'); return }
    if (!store || !admitted(ticket)) return
    try {
      let retained: DigitsAttempt | null = null
      const publish=async (permit=()=>{}) => {
        if (!admitted(ticket)) return
        retained = await store.load(wanted.sessionId)
        if (!admitted(ticket)) return
        if (!retained || digitsTarget(retained) !== digitsTarget(wanted)) throw Error('Saved record removed')
        if (!retained.snapshot) {
          permit()
          attemptRef.current = retained; stateRef.current = retained.arm
          flushSync(() => { setAttempt(retained); setState(retained!.arm); setHistoryReview(true); setSaved(true); show(ticket, 'report') })
        }
      }
      await handles.current.work(store, () => reportTarget?withVerifiedReportPublication(reportTarget,publish):withDigitsDataOrder(()=>publish()))
      if (admitted(ticket) && retained && (retained as DigitsAttempt).snapshot) await publishReport(retained, 'history', ticket)
    } catch (failure) { if (admitted(ticket)) {
      if (/removed|installation replaced/.test(String(failure))) navigation.current.retire(digitsTarget(wanted))
      setError('The saved record could not be verified or was removed.'); show(navigation.current.capture(undefined, true), 'error')
    } }
  }
  async function deleteOne(wanted: DigitsAttempt) {
    const ticket = begin('history', 'pending'), store = ticket.handle
    if (!store) return
    try {
      await handles.current.work(store, () => store.deleteAttempt(wanted.sessionId))
      retire(digitsTarget(wanted), 'This saved attempt was deleted.')
      if (admitted(ticket)) await readHistory(navigation.current.capture('history'), true)
    } catch { if (admitted(ticket)) { setError('Deletion could not be confirmed. Check storage and try again.'); show(ticket, 'error') } }
  }
  async function deleteAll() {
    const ticket = begin('history', 'pending'), store = ticket.handle
    if (!store) return
    try {
      const pool = handles.current
      await pool.work(store, async () => { const replacement = await store.deleteAll(); pool.discard(replacement) })
      const target = attemptRef.current
      if (target?.arm.identity.installationId === store.installationId) retire(digitsTarget(target), 'Local data was replaced.')
      if (admitted(ticket)) await replay()
    } catch { if (admitted(ticket)) { setError('Delete all could not be confirmed. Local data remains until deletion succeeds.'); show(ticket, 'error') } }
  }
  async function replay() {
    const ticket = begin('prepare', 'pending')
    try {
      const selected = await acquireCurrent(ticket)
      if (!selected || !admitted(selected)) return
      setInputCheck(''); setQuizOrder(''); setQuizFeedback(''); setSamplePassed(false); setAudibleConfirmed(false)
      show(selected, 'guide')
    } catch { if (admitted(ticket)) { setError('Local storage could not be reopened. Reload Digits to try again.'); show(ticket, 'error') } }
  }
  const auditoryAvailable = voice !== null
  const review = retired && state ? removedDigitsReview(state) : snapshot?.review ?? (screen === 'report' && state ? scoreDigits(state) : null)
  const currentLength = state?.length ?? 4
  if(reportTarget&&(screen!=='report'||!attempt||!review))return <Shell onLibrary={onLibrary}><section className="journey digits"><h1>Saved Digits report</h1><p role={error?'alert':'status'}>{error||'Checking the exact retained result…'}</p><button onClick={onLibrary}>Return to mock</button></section></Shell>
  return <Shell onLibrary={library}><div className={`journey digits ${highContrast ? 'digits-contrast' : ''} ${reducedMotion ? 'digits-reduced-motion' : ''}`}>
    {screen !== 'playing' && screen !== 'feedback' && <div className="journey-top"><button className="secondary" data-mock-return-intent={mock ? "" : undefined} onClick={library}><span aria-hidden="true">← </span>{mock?'Return to mock':'Main menu'}</button><p>Digits · Practice</p></div>}
    {error && <p role="alert">{error}</p>}
    {screen === 'loading' && <section className="panel"><h1>Checking Digits storage</h1></section>}
    {screen === 'pending' && <section className="panel"><h1 tabIndex={-1}>{destination === 'history' ? 'Loading Digits local history' : destination === 'review' ? 'Opening Digits review' : 'Preparing Digits'}</h1>
      <p role="status">Checking current local storage.</p>
      <button onClick={() => void replay()}>Practice again</button>
      <button className="secondary" onClick={() => void openHistory()}>History</button>
      <button className="secondary" data-mock-return-intent={mock ? "" : undefined} onClick={library}>{mock?'Return to mock':'Main menu'}</button></section>}
    {screen === 'error' && <section className="panel"><h1 tabIndex={-1}>{error?.includes('deleted') || error?.includes('replaced') ? 'Digits attempt removed' : 'Digits unavailable'}</h1>
      <p>{error?.includes('deleted') || error?.includes('replaced') ? 'Reload Digits to start a new attempt. The removed report is no longer available.' : 'Scored Practice requires working local storage and exclusive browser ownership. No temporary result is presented as saved.'}</p>
      <button onClick={() => location.reload()}>Reload Digits</button>
      <button className="secondary" data-mock-return-intent={mock ? "" : undefined} onClick={library}>{mock?'Return to mock':'Main menu'}</button></section>}
    {screen === 'guide' && <section className="panel"><p className="eyebrow">How it works</p><h1 tabIndex={-1}>Digits</h1><QuickRules rules={['Watch the digits, then enter them in the same order.', `Select Submit within ${extended ? 35 : 20} seconds.`, 'Start with four digits. Correct answers add one digit; a mistake shortens the next sequence. Three mistakes end the run.']} note={'Skipping or running out of time counts as a mistake. Takes about 5 minutes.'}/><div className="actions"><button onClick={() => go('quiz')}>Continue</button></div><details className="start-options"><summary>Examples and saved results</summary><div className="actions"><button className="secondary" onClick={() => go('examples')}>See an example</button><button className="secondary" onClick={() => void openHistory()}>Saved results</button>{skipAvailable&&<button className="secondary" onClick={()=>{void skipTutorial()}}>Skip instructions</button>}<p>A long run can take over 20 minutes. Results stay in this browser.</p><p>{SOURCE_NOTE}</p><p>{LIMITATION}</p>{quizFeedback&&<p role="alert">{quizFeedback}</p>}</div></details><AssessmentUsageNotice /></section>}
    {screen === 'examples' && <section className="panel"><h1 tabIndex={-1}>One example</h1>
      <p>See <strong>4</strong>, then <strong>2</strong>, then <strong>7</strong>, then <strong>0</strong>. Enter <strong>4270</strong> and select Submit. This example is untimed.</p>
      <button onClick={() => { setQuizFeedback(''); go('quiz') }}>Check understanding</button>
    </section>}
    {screen === 'quiz' && <section className="panel"><h1 tabIndex={-1}>Check understanding</h1>
      <fieldset><legend>What counts as correct?</legend>
        <label><input type="radio" name="digits-rule" checked={quizOrder === 'yes'} onChange={() => setQuizOrder('yes')} /> Same digits, same order, before time runs out</label>
        <label><input type="radio" name="digits-rule" checked={quizOrder === 'no'} onChange={() => setQuizOrder('no')} /> Same digits, any order, even after time runs out</label></fieldset>
      {quizFeedback && <p role="status">{quizFeedback}</p>}
      <button onClick={() => { if (quizOrder === 'yes') {
          setQuizFeedback(''); go('setup'); void refreshVoices()
        } else setQuizFeedback('Keep the original order and submit before the deadline. Try again.')
      }}>Check answer</button></section>}
    {screen === 'setup' && <section className="panel"><h1 tabIndex={-1}>Ready?</h1>
      <label>Try entering 4270 (untimed) <input inputMode="numeric" autoComplete="off" value={inputCheck}
        onChange={e => { if (/^[0-9]{0,4}$/.test(e.target.value)){changedSetup();setInputCheck(e.target.value)} }} /></label>
      {entryMethod === 'keypad' && <div className="digits-keypad" aria-label="Untimed input check keypad">
        {'0123456789'.split('').map(digit => <button key={digit} onClick={() => {changedSetup();setInputCheck(value => (value + digit).slice(0, 4))}}>{digit}</button>)}
        <button onClick={() => {changedSetup();setInputCheck('')}}>Clear</button></div>}
      <details><summary>Presentation and accessibility options</summary>
      <fieldset><legend>Presentation</legend>
        <label><input type="radio" name="digits-mode" checked={mode === 'visual'} onChange={() => { changedSetup(); setSamplePassed(false); setAudibleConfirmed(false); setMode('visual') }} /> Visual digits</label>
        <label><input type="radio" name="digits-mode" checked={mode === 'auditory'} disabled={!auditoryAvailable}
          onChange={() => { changedSetup(); setSamplePassed(false); setAudibleConfirmed(false); setMode('auditory') }} /> Auditory digits with a verified local English browser voice</label></fieldset>
      {!auditoryAvailable && <p>Auditory Practice is unavailable: no eligible unique local English browser voice was found. Visual Practice remains available.</p>}
      <button className="secondary" onClick={() => void refreshVoices()}>Recheck local voices</button>
      {mode === 'auditory' && voice && <div className="panel"><p>English voice</p>
        <button onClick={() => void playSamples()}>Play two sample digits</button>
        {samplePassed && <label><input type="checkbox" checked={audibleConfirmed}
          onChange={e => {changedSetup();setAudibleConfirmed(e.target.checked)}} /> I heard both sample digits clearly</label>}</div>}
      <fieldset><legend>Entry</legend>
        <label><input type="radio" name="digits-entry" checked={entryMethod === 'keyboard'}
          onChange={() => {changedSetup();setEntryMethod('keyboard')}} /> Keyboard text entry</label>
        <label><input type="radio" name="digits-entry" checked={entryMethod === 'keypad'}
          onChange={() => {changedSetup();setEntryMethod('keypad')}} /> On-screen numeric keypad</label></fieldset>
      <label><input type="checkbox" checked={extended} onChange={e => {changedSetup();setExtended(e.target.checked)}} /> Extended entry: 35 seconds instead of 20; separately labeled</label>
      <label><input type="checkbox" checked={highContrast} onChange={e => {changedSetup();setHighContrast(e.target.checked)}} /> High contrast</label>
      <label><input type="checkbox" checked={reducedMotion} onChange={e => {changedSetup();setReducedMotion(e.target.checked)}} /> Reduced motion</label>
      <label><input type="checkbox" checked={assistedDeclared} onChange={e => {changedSetup();setAssistedDeclared(e.target.checked)}} /> I plan to use assisted text entry; label this result separately</label>
      </details>
      <p>Visual scored digits are hidden from screen-reader text. This visual task does not have an equivalent nonvisual form here. The entry field and reports remain accessible.</p>
      <button disabled={inputCheck !== '4270' || mode === 'auditory' && (!samplePassed || !audibleConfirmed) || starting} onClick={() => void start()}>{starting ? 'Starting…' : retryCanceledStart ? 'Retry saving' : 'Start'}</button></section>}
    {screen === 'ready' && <section className="panel"><h1 tabIndex={-1}>Ready for Digits</h1>
      <p>{mode === 'visual' ? 'Visual digits' : 'Spoken digits'} · {extended ? '35-second' : '20-second'} entry · {entryMethod}</p>
      <p>Keep this window in front until the run ends.</p>
      <button disabled={starting} onClick={() => void start()}>{starting ? 'Starting…' : retryCanceledStart ? 'Retry saving' : 'Start'}</button>
      <button className="secondary" disabled={starting || pendingStart} onClick={() => go('setup')}>Change setup</button></section>}
    {(screen === 'playing' || screen === 'feedback') && <section className="panel digits-play" data-phase={state?.phase}>
      <div className="digits-trial-top">
        <p>Trial {state?.trialIndex ?? 1} · {screen === 'feedback' ? state?.closed.at(-1)?.target.length ?? currentLength : currentLength} digits</p>
        <h1 tabIndex={-1}>Digits</h1>
        <span className="digits-mistakes" aria-hidden="true">{[0, 1, 2].map(index => <span key={index} className={index < (state?.wrongCount ?? 0) ? 'used' : ''} />)}</span>
      </div>
      <p className="digits-sr-only">Trial {state?.trialIndex ?? 1} · {screen === 'feedback' ? state?.closed.at(-1)?.target.length ?? currentLength : currentLength} digits · Mistakes {state?.wrongCount ?? 0}/3</p>
      <div className="digits-entry-progress" aria-hidden="true">{entryActive && state?.entryDeadlineMs && <span key={state.entryDeadlineMs} style={{ animationDuration: `${state.entryDeadlineMs - (state.entryOpenedMs ?? state.entryDeadlineMs)}ms` }} />}</div>
      {screen === 'playing' && <>
        <div className="digits-stage">
          <div ref={stimulusRef} className="digits-stimulus" aria-hidden="true" />
          {mode === 'auditory' && state?.phase === 'presentation' && <span className="digits-listen" aria-hidden="true">Listen</span>}
          <div className="digits-position-ticks" aria-hidden="true">{Array.from({ length: currentLength }, (_, index) => <span key={index} className={index <= (state?.digitIndex ?? 0) ? 'shown' : ''} />)}</div>
        </div>
        <div className="digits-entry" aria-label="Digits entry" style={{ visibility: state?.phase === 'presentation' && !entryActive ? 'hidden' : undefined }}>
          <label className="digits-sr-only" htmlFor="digits-response">Enter the digits in order</label>
          <div className="digits-answer" onClick={() => inputRef.current?.focus({ preventScroll: true })}>
          <div className="digits-answer-boxes" aria-hidden="true">{Array.from({ length: currentLength }, (_, index) => <span key={index} className={index === entryValue.length ? 'next' : ''}>{entryValue[index] ?? ''}</span>)}</div>
          <input ref={inputRef} id="digits-response" type="text" inputMode="numeric"
            autoComplete="off" spellCheck={false} maxLength={currentLength}
            disabled={!entryActive || state?.profile.entryMethod === 'keypad'} value={entryValue}
            onChange={e => { if (!e.isTrusted) { setEntryValue(runnerRef.current?.state.draft ?? ''); return }
              if (e.nativeEvent instanceof InputEvent && e.nativeEvent.isComposing) {
                setEntryValue(e.target.value); return
              }
              const assisted = e.nativeEvent instanceof InputEvent &&
              /insertFromPaste|insertFromDrop|insertReplacementText/i.test(e.nativeEvent.inputType)
              const accepted = runnerRef.current?.edit(e.target.value, assisted) ?? ''
              if (accepted !== e.target.value) setEntryMessage('Only ASCII digits up to the shown length are accepted.')
              else setEntryMessage('')
              setEntryValue(accepted) }}
            onKeyDown={e => { if (e.repeat) { e.preventDefault(); return }
              if (e.key === 'Enter') { e.preventDefault(); if (e.isTrusted) runnerRef.current?.resolve('submit') } }}
            onPaste={() => setEntryMessage('Pasted digits will be labeled assisted entry.')}
            onCompositionEnd={e => { if (!e.isTrusted) { setEntryValue(runnerRef.current?.state.draft ?? ''); return }
              const accepted = runnerRef.current?.edit(e.currentTarget.value, true) ?? ''
              setEntryValue(accepted) }} />
          </div>
          <p role="status">{entryMessage}</p>
          <div className="digits-entry-actions"><button disabled={!entryActive} onKeyDown={e => { if (e.repeat) e.preventDefault() }} onClick={e => { if (e.isTrusted) runnerRef.current?.resolve('submit') }}>Submit</button>
          <button className="secondary" disabled={!entryActive} onKeyDown={e => { if (e.repeat) e.preventDefault() }} onClick={e => { if (e.isTrusted) runnerRef.current?.resolve('skip') }}>Skip</button></div>
          <p className="digits-countdown" aria-live="polite">{countdown.replace('seconds remaining', 's left')}</p>
          {entryActive && state?.profile.entryMethod === 'keypad' && <div className="digits-keypad" aria-label="Numeric keypad">
            {'0123456789'.split('').map(digit => <button key={digit} type="button" onKeyDown={e => { if (e.repeat) e.preventDefault() }}
              onClick={e => { if (!e.isTrusted) return; const accepted = runnerRef.current?.edit(entryValue + digit, false) ?? entryValue
                setEntryValue(accepted) }}>{digit}</button>)}
            <button type="button" onKeyDown={e => { if (e.repeat) e.preventDefault() }} onClick={e => { if (!e.isTrusted) return; const accepted = runnerRef.current?.edit(entryValue.slice(0, -1), false) ?? ''
              setEntryValue(accepted) }}>Delete last digit</button></div>}
        </div></>}
      {screen === 'feedback' && state && <>
        <div className="digits-feedback" role="status"><h2>{state.closed.at(-1)?.exactCorrect ? 'Correct' : 'Incorrect'}</h2><p>Next: {state.length} digits</p></div>
        {!saved && <p>{saveIssue ? 'Save unconfirmed. Next is unavailable.' : 'Saving…'}</p>}
        <button disabled={!saved || !!saveIssue || starting} onClick={() => void nextTrial()}>Next</button>
        {saveIssue && !retryUsedState && <button onClick={() => void retrySave()}>Retry saving</button>}
        <button className="secondary" onClick={endAtFeedback}>End and see results</button>
      </>}

    </section>}
    {screen === 'report' && attempt && review && <>
      {retired && <h1 tabIndex={-1}>Digits attempt removed</h1>}
      {saveIssue && !retired && !retryUsedState && <div className="panel" role="alert"><p>Save or report-view confirmation failed: {saveIssue}</p>
        <button onClick={() => void retrySave()}>Retry saving or verifying this result</button></div>}
      <DigitsReport review={review} attempt={snapshot ? { ...attempt, snapshot } : attempt} facts={state!} retired={retired} saved={saved} authorityPending={authorityPending} comparison={comparison}
        laterUnknown={historyReview && (retired ? attempt.snapshot?.kind !== 'terminal' : snapshot?.kind !== 'terminal')}
        onReplay={() => { void (mock?mock.retry():Promise.resolve()).then(replay).catch(cause=>setMockError(cause instanceof Error?cause.message:'The old Digits attempt needs checking.')) }} onHistory={() => void openHistory()} onLibrary={library} readOnly={!!reportTarget} returnToMock={!!mock||!!reportTarget} />
      {mockError && <p role="alert">{mockError}</p>}{mockReady && mock && !retired && saved && snapshot?.kind === 'terminal' &&
        <button data-mock-return-intent onClick={() => void mock.continue().catch(cause => setMockError(cause instanceof Error ? cause.message : 'Continue could not be confirmed.'))}>Continue mock</button>}</>}
    {screen === 'history' && <section className="panel"><h1 tabIndex={-1}>Digits history</h1>
      <p>Clearing local data also clears form-exposure and rotation history; a form may repeat afterward.</p>
      {history.length === 0 ? <p>No saved Digits attempts in this browser.</p> : <ul>{history.map(item => <li key={item.sessionId}>
        {item.arm.form.id} · {item.mode} · {item.arm.profile.entryWindow === 35000 ? 'extended entry' : 'standard entry'} · {item.arm.profile.entryMethod} · {(item.arm.profile.assistedEntryDeclared || actualDigitsAssistance(item.snapshot?.state ?? item.arm)) ? 'assisted entry · ' : ''}attempt {item.ordinal} · {item.snapshot?.review.status ?? 'Incomplete'} · {new Date(item.createdAtWallMs).toLocaleString()} · {item.snapshot?.kind === 'terminal' ? 'saved result' : item.snapshot ? 'Some trials saved; later activity could not be confirmed' : 'Start saved; no answers saved. Later activity could not be confirmed'}
        <button onClick={() => void openSaved(item)}>Review</button>
        <button className="secondary" onClick={() => void deleteOne(item)}>Delete</button>
      </li>)}</ul>}
      <button className="secondary" onClick={() => void deleteAll()}>Delete all Digits data</button>
      <button onClick={replay}>Practice again</button></section>}
  </div></Shell>
}
