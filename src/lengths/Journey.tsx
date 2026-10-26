import type { LengthsAuthorityHandle, AuthorityStatus } from './authority'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'
import { flushSync } from 'react-dom'
import { Shell } from '../core/Shell'
import { LengthsBrowserRun } from './browser'
import type { LengthsRecovery, RecoveryOutcome } from './recovery'
import { LengthsEntry } from './entry'
import type { InputProfile, PointerSource, State } from './engine'
import type { Variant } from './contracts'
import { reconcileHeadless } from './report'
import type { Cohort, HeadlessMetrics } from './report'
import { LengthsStore } from './storage'
import type { ArmedAttempt, PersistedSnapshot, StartRequest } from './storage'
import { LengthsReportPublication } from './report-publication'
import { LengthsReportSession } from './report-session'
import { captureLengthsDisplayContext, lengthsContentWidth } from './display-context'
import './lengths.css'

type Step = 'guide' | 'examples' | 'quiz' | 'setup' | 'ready' | 'run' | 'break' | 'report' | 'history'
type Capture = 'left' | 'right' | 'check-left' | 'check-right' | null
const allowedCode = /^(ArrowLeft|ArrowRight|Space|Key[A-Z]|Digit[0-9]|Numpad[0-9]|Comma|Period|Slash|Semicolon|Quote|BracketLeft|BracketRight|Backslash|Backquote|Minus|Equal)$/
const disclosure = 'This visual timed task is not currently supported with screen-reader interpretation of the lengths. You can use the untimed guide and examples or choose another game.'
const limitation = 'These are choices and times observed by this browser in an original TraitGame sequence. Forms are not calibrated equivalents. Keyboard, pointer, device and display latency can affect timing. This report does not measure a stable trait or predict a hiring outcome.'
function keyLabel(code: string) {
  if (code === 'Space') return 'Space bar'
  if (code === 'ArrowLeft') return 'Left arrow key'
  if (code === 'ArrowRight') return 'Right arrow key'
  if (/^Key[A-Z]$/.test(code)) return `${code.slice(3)} key`
  if (/^Digit[0-9]$/.test(code)) return `${code.slice(5)} key`
  if (/^Numpad[0-9]$/.test(code)) return `Number pad ${code.slice(6)}`
  return `${code} key`
}
function time(value: number | null) { return value === null ? 'Not enough clean responses for a time summary' : `${value} ms` }
function eventDetail(event: State['events'][number]) {
  const side = event.detail.side
  if (side !== 'left' && side !== 'right') return ''
  const source = event.detail.source
  return ` · ${side === 'left' ? 'Left' : 'Right'}${typeof source === 'string' ? ` (${source})` : ''}`
}
function blockCounts(state: State) {
  const block = state.form.trials[state.trialIndex - 1].block - 1
  const start = (block - 1) * 24 + 1
  let correct = 0, wrong = 0, omitted = 0
  for (let index = start; index < start + 24; index++) {
    const side = state.events.find(event => event.type === 'response' && event.trialIndex === index)?.detail.side
    if (!state.events.some(event => event.type === 'trial_closed' && event.trialIndex === index)) continue
    if (!side) omitted++
    else if (side === state.form.trials[index - 1].longerSide) correct++
    else wrong++
  }
  return { block, correct, wrong, omitted }
}
function ResultsTable({ metrics }: { metrics: HeadlessMetrics }) {
  const rows: [string, Cohort][] = [
    ['Overall', metrics.overall], ['Small gap', metrics.byCategory.small],
    ['Medium gap', metrics.byCategory.medium], ['Large gap', metrics.byCategory.large],
    ...metrics.byBlock.map((block, index): [string, Cohort] => [`Block ${index + 1}`, block]),
  ]
  return <><div className="table-scroll"><table><caption>Accuracy and browser-observed time by condition</caption>
    <thead><tr><th scope="col">Condition</th><th scope="col">Correct</th><th scope="col">Wrong</th><th scope="col">Omitted</th><th scope="col">Clean median</th><th scope="col">Clean IQR</th></tr></thead>
    <tbody>{rows.map(([label, row]) => <tr key={label}><th scope="row">{label}</th>
      <td>{row.correct}/{row.denominator}{row.correctPercent === null ? '' : ` (${row.correctPercent.toFixed(1)}%)`}</td>
      <td>{row.wrong}/{row.denominator}</td><td>{row.omitted}/{row.denominator}</td>
      <td>{time(row.time.medianDisplayMs)} (n={row.time.cleanCount})</td>
      <td>{row.time.iqrDisplayMs === null ? row.time.reason === 'fewer_than_eight' ? 'Not enough clean responses for variability' : 'Not enough clean responses' : `${row.time.iqrDisplayMs} ms`}</td>
    </tr>)}</tbody></table></div>
    <p>{metrics.responseTendency.responded === 0 ? 'No response-side distribution.' :
      `Responses selected: Left ${metrics.responseTendency.left}, Right ${metrics.responseTendency.right}, out of ${metrics.responseTendency.responded} responses.`} The correct side was Left on 48 of 96 trials and Right on 48.</p>
    <p>{metrics.tooEarlyForTiming} response{metrics.tooEarlyForTiming === 1 ? ' was' : 's were'} under 100 ms and excluded from time summaries without changing accuracy.</p>
  </>
}

export function LengthsJourney({ onLibrary }: { onLibrary: () => void }) {
  const [step, setStep] = useState<Step>('guide')
  const [store, setStore] = useState<LengthsStore | null>(null)
  const [storageError, setStorageError] = useState('')
  const [error, setError] = useState('')
  const [example, setExample] = useState(0)
  const [quiz, setQuiz] = useState<'longer' | 'shorter' | ''>('')
  const [firstResponseRule, setFirstResponseRule] = useState<'first' | 'last' | ''>('')
  const [quizPassed, setQuizPassed] = useState(false)
  const [mode, setMode] = useState<'keyboard' | 'pointer'>('keyboard')
  const [deviceClass, setDeviceClass] = useState<'desktop_or_laptop' | 'tablet' | 'other'>('desktop_or_laptop')
  const [variant, setVariant] = useState<Variant>('standard')
  const [contrast, setContrast] = useState<'dark_on_light' | 'light_on_dark'>('dark_on_light')
  const [magnification, setMagnification] = useState<'none' | 'browser_zoom'>('none')
  const [leftCode, setLeftCode] = useState('ArrowLeft')
  const [rightCode, setRightCode] = useState('ArrowRight')
  const [checked, setChecked] = useState({ left: false, right: false })
  const [capture, setCapture] = useState<Capture>(null)
  const [capturedDown, setCapturedDown] = useState<string | null>(null)
  const [pointerSource, setPointerSource] = useState<PointerSource | null>(null)
  const [pointerPending, setPointerPending] = useState<{ id: number; direction: 'left' | 'right'; source: PointerSource } | null>(null)
  const [alternative, setAlternative] = useState(false)
  const [spoken, setSpoken] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [runState, setRunState] = useState<State | null>(null)
  const [starting, setStarting] = useState(false)
  const [startUncertain, setStartUncertain] = useState(false)
  const [uncertainProfile, setUncertainProfile] = useState<InputProfile | null>(null)
  const [saveStatus, setSaveStatus] = useState<'none' | 'pending' | 'saved' | 'unconfirmed'>('none')
  const [checkpointStatus, setCheckpointStatus] = useState<'none' | 'pending' | 'saved' | 'failed'>('none')
  const [layoutFits, setLayoutFits] = useState(false)
  const [history, setHistory] = useState<readonly ArmedAttempt[]>([])
  const [selected, setSelected] = useState<ArmedAttempt | null>(null)
  const [, setDraftArm] = useState<ArmedAttempt | null>(null)
  const [recoveryOutcome, setRecoveryOutcome] = useState<RecoveryOutcome | null>(null)
  const [reportAuthority, setReportAuthority] = useState<'verified' | 'checking' | 'revoked' | 'review_only'>('verified')
  const [authorityStatus, setAuthorityStatus] = useState<AuthorityStatus | null>(null)
  const [reportRegister, setReportRegister] = useState<{ revision: number | null; integrity: string; witness: number | null } | null>(null)
  const [reportSurface, setReportSurface] = useState<{ handleId: string; sessionId: string; recoveryKind: 'checkpoint' | 'terminal' | null; generation: number; opening: number; storeGeneration: number } | null>(null)
  const [activityRetry, setActivityRetry] = useState<{ installationId: string; sessionId: string;
    snapshot: PersistedSnapshot; viewId: string; source: 'live' | 'history'; wallMs: number;
    store: LengthsStore; handle: LengthsAuthorityHandle; generation: number; opening: number;
    storeGeneration: number } | null>(null)
  const [deleteAllConfirm, setDeleteAllConfirm] = useState(false)
  const run = useRef<LengthsBrowserRun | null>(null)
  const breakExitRun = useRef<LengthsBrowserRun | null>(null)
  const display = useRef<HTMLDivElement>(null)
  const captureTarget = useRef<HTMLDivElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const mounted = useRef(true)
  const terminalChecked = useRef<LengthsBrowserRun | null>(null)
  const publication = useRef(new LengthsReportPublication())
  const publicationSuspended = useRef(false)
  const navigationEpoch = useRef(0)
  const liveOpening = useRef<NonNullable<typeof activityRetry> | null>(null)
  const storeRef = useRef<LengthsStore | null>(null)
  const storeOpeningEpoch = useRef(0)
  const openingEpoch = useRef(0)
  const activityEpoch = useRef(0)
  const recoverySurface = useRef<{ session: LengthsReportSession; controller: LengthsRecovery | null; handle: LengthsAuthorityHandle;
    store: LengthsStore; generation: number; opening: number; storeGeneration: number; unsubscribe: () => void } | null>(null)
  const recoveryPublicationEpoch = useRef(0)
  function detachRecovery() {
    recoverySurface.current?.unsubscribe()
    recoverySurface.current = null
    if (mounted.current) { setRecoveryOutcome(null); setAuthorityStatus(null); setReportRegister(null); setReportSurface(null) }
    recoveryPublicationEpoch.current++
  }
  function attached(handle: LengthsAuthorityHandle, generation: number, opening: number, originalStore: LengthsStore): boolean {
    const surface = recoverySurface.current
    return mounted.current && navigationEpoch.current === generation && storeRef.current === originalStore &&
      surface?.handle === handle && surface.generation === generation && surface.opening === opening &&
      surface.storeGeneration === originalStore.authority.generation
  }
  /** Every live/released/history report uses this attachment and withdrawal. */
  function attachReport(handle: LengthsAuthorityHandle, originalStore: LengthsStore, controller: LengthsRecovery | null = null, captured?: LengthsReportSession) {
    const generation = navigationEpoch.current
    const prior = recoverySurface.current
    if (prior?.handle === handle && prior.generation === generation && prior.store === originalStore) {
      if (prior.controller !== controller) throw Error('Lengths report recovery owner changed')
      return prior
    }
    const session = captured ?? new LengthsReportSession(originalStore, handle, controller, controller ? 'live' : 'history')
    if (session.handle !== handle || session.store !== originalStore || session.controller !== controller) throw Error('Lengths report session changed')
    prior?.unsubscribe()
    const surface = { session, controller, handle, store: originalStore, generation, opening: ++openingEpoch.current,
      storeGeneration: originalStore.authority.generation, unsubscribe: () => {} }
    recoverySurface.current = surface
    setReportSurface({ handleId: handle.id, sessionId: session.id, recoveryKind: controller?.target.kind ?? null, generation, opening: surface.opening, storeGeneration: surface.storeGeneration })
    const owns = () => attached(handle, generation, surface.opening, originalStore)
    let attachingAuthority = true
    const commitAuthority = (update: () => void) => {
      if (attachingAuthority) update()
      else flushSync(update)
    }
    const unsubscribeAuthority = handle.subscribe(status => {
      if (!owns()) return
      setReportRegister({ ...originalStore.authority.register(), witness: handle.witnessRevision })
      if (status.kind === 'retired') {
        publication.current.cancel()
        commitAuthority(() => { setAuthorityStatus(status); setRecoveryOutcome(controller?.outcome() ?? null)
          setSelected(null); setRunState(null); setDraftArm(null); setActivityRetry(null)
          setReportAuthority('revoked'); setSaveStatus('unconfirmed') })
      } else if (status.kind === 'blocked' || status.kind === 'unknown') {
        publication.current.cancel()
        commitAuthority(() => { setAuthorityStatus(status); setSelected(null); setRunState(null); setDraftArm(null)
          setActivityRetry(null); setReportAuthority('checking'); setSaveStatus('unconfirmed') })
      } else setAuthorityStatus(status)
    })
    attachingAuthority = false
    let attachingRecovery = true
    const unsubscribeRecovery = controller?.subscribe(outcome => {
      if (!owns() || handle.status().kind !== 'current') return
      if (outcome.kind === 'uncertain') {
        const update = () => { setRecoveryOutcome(outcome); setSelected(null)
          setReportAuthority('review_only'); setSaveStatus('unconfirmed') }
        if (attachingRecovery) update()
        else flushSync(update)
      } else setRecoveryOutcome(outcome)
    })
    attachingRecovery = false
    surface.unsubscribe = () => { unsubscribeAuthority(); unsubscribeRecovery?.() }
    return surface
  }
  const uncertainStart = useRef<StartRequest | null>(null)

  useEffect(() => {
    mounted.current = true
    const gate = publication.current
    const epoch = ++storeOpeningEpoch.current
    void LengthsStore.open().then(value => { if (mounted.current && epoch === storeOpeningEpoch.current) { storeRef.current = value; setStore(value) } })
      .catch(() => { if (mounted.current && epoch === storeOpeningEpoch.current) setStorageError('Saved Lengths data could not be opened or verified in this browser.') })
    return () => { mounted.current = false; detachRecovery(); gate.cancel(); run.current?.dispose() }
  }, [])
  useEffect(() => {
    const suspend = () => {
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
  function prepare(next: Step) {
    navigationEpoch.current++
    detachRecovery()
    publication.current.cancel()
    setStep(next)
  }
  const canPublish = useCallback(() =>
    !publicationSuspended.current && document.visibilityState === 'visible', [])
  useEffect(() => { if (capture) captureTarget.current?.focus() }, [capture])
  useEffect(() => { if (step !== 'run') heading.current?.focus() }, [step])
  useEffect(() => {
    if (step !== 'break') return
    const update = () => setCheckpointStatus(run.current?.checkpointStatus() ?? 'none')
    update()
    const timer = window.setInterval(update, 150)
    return () => window.clearInterval(timer)
  }, [step])
  useEffect(() => {
    if (step !== 'ready' && step !== 'break') return
    const measure = () => {
      const box = display.current?.getBoundingClientRect()
      const viewport = window.visualViewport
      const left = viewport?.offsetLeft ?? 0
      const width = viewport?.width ?? document.documentElement.clientWidth
      setLayoutFits(!!box && !!display.current && lengthsContentWidth(display.current) >= 520 &&
        box.left >= left && box.right <= left + width &&
        document.documentElement.scrollWidth <= document.documentElement.clientWidth)
    }
    measure()
    const frame = requestAnimationFrame(measure)
    window.addEventListener('resize', measure)
    window.visualViewport?.addEventListener('resize', measure)
    window.visualViewport?.addEventListener('scroll', measure)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', measure)
      window.visualViewport?.removeEventListener('resize', measure)
      window.visualViewport?.removeEventListener('scroll', measure)
    }
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
        signal => store.loadArmed(sessionId, signal),
        retained => {
          if (!active || !owns() || handle.status().kind !== 'current') return
          if (!retained || retained.requestId !== requestId || retained.ordinal !== ordinal ||
            JSON.stringify(retained.snapshot) !== JSON.stringify(expected)) { withdraw(); return }
          surface.session.assertRecord(retained)
          // An unchanged background read does not hide or replace the live table.
          flushSync(() => setReportAuthority(current => current === 'verified' ? current : 'verified'))
          if (document.querySelector(selected.snapshot ? '[data-lengths-published-session]' : '[data-lengths-armed-only-session]')?.getAttribute(selected.snapshot ? 'data-lengths-published-session' : 'data-lengths-armed-only-session') !== sessionId)
            throw Error('Lengths report DOM publication was not confirmed')
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
      if (notice.installationId !== selected.state.identity.installationId ||
        notice.type === 'attempt_deleted' && notice.sessionId !== sessionId) return
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
    const timedOut = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(Error('Lengths activity delivery timed out')), 2000) })
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
    if (surface.session.source !== source) throw Error('Lengths report opening source changed')
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
  const resumeReport = useCallback(async (session: LengthsReportSession) => {
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
    await publication.current.run(`resume:${session.id}`,
      async signal => {
        const retained = await session.store.loadArmed(session.handle.arm.sessionId, signal)
        if (!retained) throw Error('Lengths report unavailable')
        session.assertRecord(retained)
        return retained
      }, retained => {
        if (!active() || !canPublish()) return
        session.assertRecord(retained)
        flushSync(() => { setSelected(retained); setDraftArm(null); setRunState(null); setStep('report');
          setSaveStatus('saved'); setReportAuthority('verified'); setError('') })
        const attribute = session.handle.armedOnly ? 'data-lengths-armed-only-session' : 'data-lengths-published-session'
        if (document.querySelector(`[${attribute}]`)?.getAttribute(attribute) !== session.handle.arm.sessionId)
          throw Error('Lengths report DOM publication was not confirmed')
        published = retained
      }, () => {
        if (!active()) return
        publication.current.cancel()
        session.controller?.uncertain('publication_failed')
        flushSync(() => { setSelected(null); setRunState(null); setReportAuthority('review_only');
          setSaveStatus('unconfirmed'); setError('Saved data could not be verified. No numbers are shown.') })
      })
    if (published && active() && !session.handle.armedOnly) void recordView(published, session.source)
    else if (!published && active()) session.controller?.uncertain('publication_not_confirmed')
  }, [recordView, canPublish])
  const confirmRecovery = useCallback(async (current: LengthsBrowserRun) => {
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
    const common = { variant, deviceClass, alternative, contrast, magnification, reducedMotion }
    return mode === 'keyboard' ? { kind: 'keyboard', leftCode, rightCode, ...common } :
      { kind: 'pointer', pointerSource: pointerSource ?? 'mouse', ...common }
  }
  function startCapture(next: Capture) { setCapturedDown(null); setCapture(next); setError('') }
  function captureDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.code === 'Tab') return
    event.preventDefault(); event.stopPropagation()
    if (event.code === 'Escape') { setCapture(null); setCapturedDown(null); return }
    if (!capture || !allowedCode.test(event.code) || event.repeat || event.altKey || event.ctrlKey ||
      event.metaKey || event.shiftKey || event.nativeEvent.isComposing) {
      setError('Use one unmodified allowed response key, then release it.'); return
    }
    if (capturedDown && capturedDown !== event.code) {
      setCapturedDown(null); setError('Press and release only one response key at a time.'); return
    }
    setCapturedDown(event.code)
  }
  function captureUp(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!capture || event.code !== capturedDown) return
    event.preventDefault(); event.stopPropagation()
    if (event.repeat || event.altKey || event.ctrlKey || event.metaKey ||
      event.shiftKey || event.nativeEvent.isComposing) {
      setCapturedDown(null)
      setError('Release the key without modifiers, then press it again.')
      return
    }
    if (capture === 'left' || capture === 'right') {
      if (capture === 'left' && event.code === rightCode || capture === 'right' && event.code === leftCode) {
        setError('Choose two different physical keys.'); return
      }
      if (capture === 'left') setLeftCode(event.code); else setRightCode(event.code)
      setChecked({ left: false, right: false })
    } else {
      const expected = capture === 'check-left' ? leftCode : rightCode
      if (event.code !== expected) { setError(`Detected ${event.code}. Press and release ${expected}.`); return }
      setChecked(previous => ({ ...previous, [capture === 'check-left' ? 'left' : 'right']: true }))
    }
    setCapture(null); setCapturedDown(null); setError('')
  }
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
    setPointerSource(pointerPending.source)
    setChecked(previous => ({ ...previous, [direction]: true }))
    setPointerPending(null)
  }
  async function begin() {
    if (!store || !display.current || !checked.left || !checked.right || spoken || run.current) return
    navigationEpoch.current++
    detachRecovery()
    setError('')
    display.current.scrollIntoView({ block: 'center' })
    const generation = navigationEpoch.current
    const controller = new LengthsBrowserRun(new LengthsEntry(store, generation), display.current, value => {
      if (!mounted.current || run.current !== controller || generation !== navigationEpoch.current) return
      const recovery = controller.recovery(), withdrawal = controller.withdrawalAuthority()
      if (withdrawal || recovery && recovery.authority.status().kind !== 'current') {
        // Pass the recovery controller regardless of which handle wins the
        // withdrawal slot — a break-withdrawal carries its own Recovery and
        // the captured report session needs it whether a BrowserRun is live or not.
        attachReport(withdrawal ?? recovery!.authority, store, recovery ?? null); setStep('report'); return
      }
      setRunState(value); if (value.phase === 'break') setStep('break')
    })
    run.current = controller
    setStarting(true)
    setSaveStatus('none')
    const selectedProfile = profile()
    const request: StartRequest = uncertainStart.current &&
      JSON.stringify(uncertainStart.current.profile) === JSON.stringify(selectedProfile)
      ? uncertainStart.current
      : Object.freeze({ requestId: crypto.randomUUID(), sessionId: crypto.randomUUID(),
          clockDomainId: crypto.randomUUID(), profile: Object.freeze(selectedProfile), variant,
          route: 'standalone' as const,
          atMs: performance.now(), wallMs: Date.now(),
          displayContext: captureLengthsDisplayContext(display.current) })
    // Keep the exact identity and frozen setup through a failed arm readback.
    // A verified/protected start consumes it; a changed setup requires a new one.
    uncertainStart.current = request
    try {
      await controller.begin(request)
      if (run.current === controller) {
        uncertainStart.current = null; setStarting(false); setStartUncertain(false); setStep('run')
      }
    } catch (cause) {
      if (run.current !== controller) return
      if (controller.armedAttempt()) uncertainStart.current = null
      controller.dispose(); run.current = null
      setStarting(false); setStartUncertain(!controller.armedAttempt())
      setUncertainProfile(uncertainStart.current?.profile ?? null)
      setError(`Start could not be confirmed. ${cause instanceof Error ? cause.message : 'Check this browser and try again.'}`)
      setStep('ready')
    }
  }
  async function continueBlock() {
    if (!run.current || !display.current) return
    setError('')
    display.current.scrollIntoView({ block: 'center' })
    const current = run.current, generation = navigationEpoch.current
    try { await current.continue(); if (mounted.current && run.current === current && generation === navigationEpoch.current) setStep('run') }
    catch (cause) { if (mounted.current && run.current === current && generation === navigationEpoch.current) setError(cause instanceof Error ? cause.message : 'The next block could not start.') }
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
      run.current = null; breakExitRun.current = current
      setDraftArm(arm); setSelected(null); setRunState(draft); setSaveStatus('pending')
      setReportAuthority('verified'); setStep('report'); setError('')
      if (arm) void confirmRecovery(current)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The break could not be closed.')
    }
  }

  function leave() {
    publication.current.cancel()
    uncertainStart.current = null
    setStarting(false); setStartUncertain(false)
    if (step === 'break' && run.current) { endBreakForReview(); return }
    if (step === 'run' && run.current) {
      run.current.dispose()
      setStep('report')
      return
    }
    navigationEpoch.current++
    detachRecovery()
    breakExitRun.current = null
    run.current?.dispose(); run.current = null; onLibrary()
  }
  async function loadHistory() {
    if (!store) return
    detachRecovery()
    const epoch = ++navigationEpoch.current
    publication.current.cancel()
    // A report being left cannot remain visibly saved while a new surface is checked.
    flushSync(() => setReportAuthority('checking'))
    if (!canPublish()) {
      setError('Lengths history cannot be verified while this page is hidden. Return to this tab and try again.')
      return
    }
    await publication.current.run('history',
      signal => store.listAttempts(signal),
      attempts => {
        if (!mounted.current || epoch !== navigationEpoch.current) return
        flushSync(() => { setHistory(attempts); setSelected(null); setDraftArm(null)
          setActivityRetry(null); setError(''); setStep('history') })
        if (document.querySelector('[data-lengths-history-installation]')?.getAttribute('data-lengths-history-installation') !== store.installationId)
          throw Error('Lengths history DOM publication was not confirmed')
        requestAnimationFrame(() => { if (mounted.current && epoch === navigationEpoch.current) heading.current?.focus() })
      }, () => {
        if (!mounted.current || epoch !== navigationEpoch.current) return
        flushSync(() => { setHistory([]); setReportAuthority('checking')
          setError('Lengths history could not be verified. Saved results are unavailable.') })
      })
  }
  async function openReport(original: ArmedAttempt) {
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
    await publication.current.run(`open:${sessionId}`,
      signal => store.loadArmed(sessionId, signal),
      current => {
        if (!owns()) return
        if (current) surface.session.assertRecord(current)
        if (!current) {
          flushSync(() => { setSelected(null); setHistory([])
            setError('This report is unavailable or could not be verified.') })
          return
        }
        flushSync(() => { setSelected(current); setDraftArm(null); setRunState(null)
          setSaveStatus('saved'); setReportAuthority('verified'); setStep('report'); setError('') })
        if (document.querySelector(handle.armedOnly ? '[data-lengths-armed-only-session]' : '[data-lengths-published-session]')?.getAttribute(handle.armedOnly ? 'data-lengths-armed-only-session' : 'data-lengths-published-session') !== sessionId)
          throw Error('Lengths history report DOM publication was not confirmed')
        published.value = current
      }, () => {
        if (!owns()) return
        publication.current.cancel()
        flushSync(() => { setSelected(null); setRunState(null); setSaveStatus('unconfirmed');
          setReportAuthority('review_only')
          setError('This report is unavailable or could not be verified.') })
      })
    if (published.value?.snapshot) void recordView(published.value, 'history')
  }

  async function remove(sessionId: string) {
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
      const deletionStore = store ?? await LengthsStore.openForDeletion()
      const replacement = await deletionStore.deleteAll()
      if (!mounted.current || epoch !== navigationEpoch.current || openingGeneration !== storeOpeningEpoch.current ||
        storeRef.current !== originalStore) return
      navigationEpoch.current++
      disposeActiveRun()
      storeRef.current = replacement; setStore(replacement); setStorageError('')
      breakExitRun.current = null
      liveOpening.current = null; terminalChecked.current = null
      setHistory([]); setSelected(null); setDraftArm(null); setRunState(null); setActivityRetry(null)
      setReportAuthority('verified'); setSaveStatus('none')
      setError('All local Lengths data were deleted.'); setStep('guide')
    } catch {
      if (mounted.current && epoch === navigationEpoch.current && openingGeneration === storeOpeningEpoch.current && storeRef.current === originalStore) {
        // A failed reset still belongs to the old installation. Restore only
        // its blocked attachment so the explicit recovery action stays usable.
        if (resetSurface?.store === originalStore && resetSurface.handle.status().kind === 'blocked') {
          const restored = attachReport(resetSurface.handle, resetSurface.store, resetSurface.controller, resetSurface.session)
          if (resetOpening?.handle === restored.handle && resetOpening.store === restored.store)
            liveOpening.current = { ...resetOpening, generation: restored.generation, opening: restored.opening }
        }
        setError('Delete all could not be confirmed. Local Lengths data may remain.')
      }
    }
  }
  function replay() {
    publication.current.cancel()
    uncertainStart.current = null
    setStarting(false); setStartUncertain(false)
    navigationEpoch.current++
    detachRecovery()
    breakExitRun.current = null
    run.current?.dispose(); run.current = null; terminalChecked.current = null
    liveOpening.current = null
    setRunState(null); setSelected(null); setDraftArm(null); setActivityRetry(null)
    setReportAuthority('verified'); setSaveStatus('none'); setError('')
    setChecked({ left: false, right: false }); setStep('guide')
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
  const review = persisted?.review ?? (observed ? reconcileHeadless(observed) : null)
  const live = step === 'run' || step === 'break' || step === 'ready'
  const orderedReportsAvailable = typeof navigator !== 'undefined' && !!navigator.locks
  return <Shell onLibrary={leave}>
    <div className="journey lengths-journey">
      <div className="journey-top"><p>Lengths · Standalone Practice</p><button className="secondary" onClick={leave}>Back to library</button></div>
      {error && <p role="alert" className="feedback">{error}</p>}
      {storageError && <p role="alert">{storageError} Timed play requires verified local storage.</p>}
      {storageError && (deleteAllConfirm ? <div role="group" aria-label="Confirm Lengths data reset">
        <p>This permanently deletes all local Lengths attempts, results, events and form history in this browser. It cannot be undone. Other games are unaffected.</p>
        <button onClick={() => void deleteAll()}>Delete all Lengths data</button>
        <button className="secondary" onClick={() => setDeleteAllConfirm(false)}>Cancel</button>
      </div> : <button className="secondary" onClick={() => setDeleteAllConfirm(true)}>Delete all Lengths data</button>)}
      {step === 'guide' && <section className="panel"><h1 ref={heading} tabIndex={-1}>Choose the longer bar</h1>
        <p>Two horizontal bars appear together. Choose the side with the longer bar: Left or Right. The bars are never equal.</p>
        <p>Practice has four blocks of 24 trials. The first response during each 1,400-millisecond window counts. You can pause between blocks.</p>
        <p className="note">{disclosure}</p><div className="actions"><button onClick={() => prepare('examples')}>See examples</button><button className="secondary" disabled={!orderedReportsAvailable} onClick={() => void loadHistory()}>Lengths history</button></div>
        {!orderedReportsAvailable && <p role="alert">This browser cannot verify saved Lengths reports or protect timed play across tabs. The untimed guide remains available.</p>}
        {!orderedReportsAvailable && !storageError && (deleteAllConfirm ? <div role="group" aria-label="Confirm Lengths data reset">
          <p>This permanently deletes all local Lengths attempts, results, events and form history in this browser. It cannot be undone. Other games are unaffected.</p>
          <button onClick={() => void deleteAll()}>Delete all Lengths data</button>
          <button className="secondary" onClick={() => setDeleteAllConfirm(false)}>Cancel</button>
        </div> : <button className="secondary" onClick={() => setDeleteAllConfirm(true)}>Delete all Lengths data</button>)}</section>}
      {step === 'examples' && <section className="panel"><h1 ref={heading} tabIndex={-1}>Worked example {example + 1} of 2</h1>
        <p>{example === 0 ? 'The Left bar is slightly longer.' : 'The Right bar is clearly longer.'}</p>
        <div className="lengths-example" aria-label={example === 0 ? 'Left bar longer than Right bar' : 'Right bar longer than Left bar'}>
          <span className="lengths-example-bar" style={{ width: example === 0 ? 164 : 116 }}>LEFT</span>
          <span className="lengths-example-bar" style={{ width: example === 0 ? 148 : 164 }}>RIGHT</span>
        </div>
        <p>The answer is <strong>{example === 0 ? 'Left' : 'Right'}</strong> because that bar is longer.</p>
        <div className="actions"><button onClick={() => example === 0 ? setExample(1) : prepare('quiz')}>{example === 0 ? 'Next example' : 'Check understanding'}</button></div></section>}
      {step === 'quiz' && <section className="panel"><h1 ref={heading} tabIndex={-1}>Check the rule</h1>
        <p>Which bar should you choose?</p>
        <label className="choice"><input type="radio" name="lengths-quiz" checked={quiz === 'longer'} onChange={() => setQuiz('longer')} />The longer bar</label>
        <label className="choice"><input type="radio" name="lengths-quiz" checked={quiz === 'shorter'} onChange={() => setQuiz('shorter')} />The shorter bar</label>
        <p>Which response counts during a display?</p>
        <label className="choice"><input type="radio" name="lengths-first" checked={firstResponseRule === 'first'} onChange={() => setFirstResponseRule('first')} />The first eligible Left or Right response before the deadline</label>
        <label className="choice"><input type="radio" name="lengths-first" checked={firstResponseRule === 'last'} onChange={() => setFirstResponseRule('last')} />The last response I make</label>
        {quizPassed && <p role="status">Correct. During play, your first eligible Left or Right response counts. A later response does not replace it.</p>}
        <div className="actions"><button onClick={() => { if (quiz === 'longer' && firstResponseRule === 'first') { setQuizPassed(true); setError('') } else setError('Choose the longer bar; your first eligible response before the deadline counts. Try again.') }}>Check answers</button>
          {quizPassed && <button onClick={() => prepare('setup')}>Set up input</button>}</div></section>}
      {step === 'setup' && <section className="panel"><h1 ref={heading} tabIndex={-1}>Set up your responses</h1>
        <p>Choose one input method. Timed play starts only after both directions pass an input check.</p>
        <label className="choice">Device in use <select value={deviceClass} onChange={event => setDeviceClass(event.target.value as typeof deviceClass)}>
          <option value="desktop_or_laptop">Desktop or laptop</option><option value="tablet">Tablet</option><option value="other">Other</option></select></label>
        {startUncertain && <p role="status">The earlier Start may already have reserved a form. Keep this input setup to verify or retry that same request. Changing input settings requires a new Start request and may use the next form.</p>}
        <fieldset><legend>Bar form</legend>
          <label className="choice"><input type="radio" name="lengths-variant" checked={variant === 'standard'} onChange={() => { setVariant('standard'); setChecked({ left: false, right: false }) }} />Standard bars</label>
          <label className="choice"><input type="radio" name="lengths-variant" checked={variant === 'visual_accommodation'} onChange={() => { setVariant('visual_accommodation'); setChecked({ left: false, right: false }) }} />Visual accommodation: thicker bars and larger gaps</label>
        </fieldset>
        <fieldset><legend>Input method</legend>
          <label className="choice"><input type="radio" name="lengths-mode" checked={mode === 'keyboard'} onChange={() => { setMode('keyboard'); setChecked({ left: false, right: false }) }} />Physical key codes</label>
          <label className="choice"><input type="radio" name="lengths-mode" checked={mode === 'pointer'} onChange={() => { setMode('pointer'); setChecked({ left: false, right: false }); setPointerSource(null) }} />Mouse, touch or pen buttons</label>
        </fieldset>
        {mode === 'keyboard' ? <><p>Left: {keyLabel(leftCode)} <kbd>{leftCode}</kbd>. Right: {keyLabel(rightCode)} <kbd>{rightCode}</kbd>. Choose distinct physical keys.</p>
          <div className="actions"><button className="secondary" onClick={() => startCapture('left')}>Change Left key</button><button className="secondary" onClick={() => startCapture('right')}>Change Right key</button>
            <button onClick={() => startCapture('check-left')}>Check Left key</button><button onClick={() => startCapture('check-right')}>Check Right key</button></div>
          <div ref={captureTarget} className="key-capture" tabIndex={0} role="group" aria-label="Lengths physical key capture" onKeyDown={captureDown} onKeyUp={captureUp}>
            {capture ? <p>Press and release {capture.startsWith('check') ? capture === 'check-left' ? leftCode : rightCode : 'a new key'} for {capture.endsWith('left') ? 'Left' : 'Right'}. Escape cancels.</p> : <p>Input check: Left {checked.left ? 'passed' : 'needed'}; Right {checked.right ? 'passed' : 'needed'}.</p>}
          </div></> : <><p>Press Left and Right below with the same primary pointer type.</p>
          <div className="actions"><button onPointerDown={event => pointerCheck(event, 'left')} onPointerUp={event => pointerRelease(event, 'left')} onPointerCancel={() => setPointerPending(null)}>Check Left</button><button onPointerDown={event => pointerCheck(event, 'right')} onPointerUp={event => pointerRelease(event, 'right')} onPointerCancel={() => setPointerPending(null)}>Check Right</button></div>
          <p role="status">{pointerSource ? `Detected ${pointerSource}. ` : ''}Left {checked.left ? 'passed' : 'needed'}; Right {checked.right ? 'passed' : 'needed'}.</p></>}
        <label className="choice"><input type="checkbox" checked={alternative} onChange={event => { setAlternative(event.target.checked); setChecked({ left: false, right: false }) }} />I use an alternative or assistive input method; it may change response timing.</label>
        <label className="choice"><input type="checkbox" checked={spoken} onChange={event => setSpoken(event.target.checked)} />I need spoken interpretation of the bars during timed play.</label>
        <label className="choice"><input type="checkbox" checked={reducedMotion} onChange={event => setReducedMotion(event.target.checked)} />Reduce nonessential motion.</label>
        <label className="choice">Contrast <select value={contrast} onChange={event => setContrast(event.target.value as typeof contrast)}>
          <option value="dark_on_light">Dark bars on light</option><option value="light_on_dark">Light bars on dark</option></select></label>
        <label className="choice"><input type="checkbox" checked={magnification === 'browser_zoom'} onChange={event => setMagnification(event.target.checked ? 'browser_zoom' : 'none')} />I am using browser zoom</label>
        {spoken && <p role="alert">{disclosure}</p>}
        <div className="actions"><button disabled={!checked.left || !checked.right || spoken || !store} onClick={() => prepare('ready')}>Continue to readiness</button></div>
        {(!checked.left || !checked.right) && <p>Complete both input checks to continue.</p>}</section>}
      {step === 'ready' && <section className="panel"><h1 ref={heading} tabIndex={-1}>Ready for Block 1?</h1>
        <p>Keep this tab visible and focused once you start. A hidden, blurred or interrupted scored block becomes review-only. The breaks after each block are untimed.</p>
        <p>Form: {variant === 'standard' ? 'standard' : 'visual accommodation'}. Input: {mode === 'keyboard' ? `${leftCode} = Left; ${rightCode} = Right` : `${pointerSource} controls`} {alternative ? '(alternative input declared)' : ''}.</p>
        {startUncertain && <p role="status">{retrySameStart ? 'A form may already be reserved. Verify or retry the same Start request before timed play begins.' : 'Input setup changed after an unconfirmed Start. A new request may use the next form.'}</p>}
        <div className="actions"><button disabled={!store || !orderedReportsAvailable || !checked.left || !checked.right || spoken || starting || !layoutFits} onClick={() => void begin()}>{starting ? 'Checking Start' : retrySameStart ? 'Verify or retry same Start' : startUncertain ? 'Start with changed setup' : 'Start Lengths'}</button><button className="secondary" disabled={starting} onClick={() => prepare('setup')}>Review setup</button></div>
        {!layoutFits && <p role="status">The full 520-pixel bar display does not fit. Enlarge the window or reduce browser zoom before starting.</p>}
        {!orderedReportsAvailable && <p>Timed Start needs a browser that supports exclusive tab coordination.</p>}</section>}
      {step === 'run' && <section className="panel"><h1 className="lengths-visually-hidden">Lengths scored block</h1>
        <p>Block {runState?.form.trials[runState.trialIndex - 1]?.block ?? 1} of 4 · Trial {runState?.trialIndex ?? 1} of 96</p>
        <p role="status">{runState?.phase === 'stimulus' ? 'Compare the bars' : 'Wait for the bars'}</p></section>}
      {step === 'break' && <section className="panel"><h1 ref={heading} tabIndex={-1}>Block complete</h1>
        {runState && <><p>{blockCounts(runState).block} of 4 blocks complete. This break is untimed.</p>
          <p>In this block: {blockCounts(runState).correct} correct, {blockCounts(runState).wrong} wrong, {blockCounts(runState).omitted} omitted.</p>
          <p>Frozen input: {runState.profile.kind === 'keyboard' ? `${runState.profile.leftCode} Left / ${runState.profile.rightCode} Right` : `${runState.profile.pointerSource} pointer`} {runState.profile.alternative ? '(alternative input)' : ''}.</p></>}
        <p role="status">Checkpoint: {checkpointStatus === 'saved' ? 'saved' : checkpointStatus === 'failed' ? 'not confirmed; you can retry' : 'checking'}. Keep this tab open until saving finishes.</p>
        <div className="actions"><button disabled={checkpointStatus !== 'saved' || !layoutFits} onClick={() => void continueBlock()}>Continue next block</button><button className="secondary" onClick={() => void verifyCheckpoint()}>Verify or retry checkpoint</button><button className="secondary" onClick={endBreakForReview}>End attempt and review known prefix</button></div>
        {!layoutFits && <p role="status">The full 520-pixel bar display does not fit. Enlarge the window or reduce browser zoom before continuing.</p>}</section>}
      {live && <div ref={display} className={`lengths-display${contrast === 'light_on_dark' ? ' light-on-dark' : ''}`} aria-label="Lengths visual task display" />}
      {step === 'report' && <section className="panel"
        data-lengths-recovery-authority={authorityStatus?.kind === 'retired' ? 'retired' : recoveryOutcome?.kind}
        data-lengths-authority-handle={reportSurface?.handleId}
        data-lengths-authority-generation={reportSurface?.generation}
        data-lengths-authority-opening={reportSurface?.opening}
        data-lengths-authority-store-generation={reportSurface?.storeGeneration}
        data-lengths-authority-status={authorityStatus?.kind}
        data-lengths-register-revision={reportRegister?.revision ?? undefined}
        data-lengths-register-integrity={reportRegister?.integrity}
        data-lengths-target-witness={reportRegister?.witness ?? undefined}
        data-lengths-authority-evidence={authorityStatus?.kind === 'retired' ? authorityStatus.evidence : undefined}
        data-lengths-report-session={reportSurface?.sessionId}
        data-lengths-published-session={reportAuthority === 'verified' && saveStatus === 'saved' && selected?.snapshot ? selected.sessionId : undefined}
        data-lengths-armed-only-session={reportAuthority === 'verified' && saveStatus === 'saved' && selected && !selected.snapshot ? selected.sessionId : undefined}>
        <h1 ref={heading} tabIndex={-1}>Lengths report</h1>
        {reportAuthority === 'checking' ? <p role="status">Verifying the saved report. Results and status are hidden until the current record is confirmed.</p> : review ? <><p><strong>{review.status === 'complete_headless' ? 'Valid' : review.status === 'invalid_headless' ? 'Invalid' : 'Incomplete'} attempt.</strong> {saveStatus === 'saved' ? selected && !selected.snapshot ? 'Only this original Start record is saved; no trial result was recorded.' : review.status === 'incomplete_headless' ? 'Only this known prefix is saved; later display status is unknown.' : 'Saved in this browser.' : saveStatus === 'pending' ? 'Checking the save. Keep this tab open.' : 'This result is retained in this tab; its save could not be confirmed.'}</p>
          <p>Form {review.formId} · {review.formVersion} · {review.specificationVersion} · {review.scoringVersion}.</p>
          <p>Presented {review.presented}; closed {review.closed}; unresolved {review.unresolvedPresented}; unpresented {review.unpresented}.</p>
          <p>Interruption: {review.invalidReason ?? 'none recorded'}.</p>
          {review.metrics ? <ResultsTable metrics={review.metrics} /> : <><p>No aggregate accuracy or timing is reported for this review-only attempt.</p>
            <details><summary>Review recorded events</summary><ol>{observed?.events.map(event => <li key={event.sequenceNumber}>{event.sequenceNumber}. {event.type} · trial {event.trialIndex} · {event.atMs.toFixed(1)} ms{eventDetail(event)}</li>)}</ol></details>
            <p>Events after the last durable checkpoint may be missing.</p></>}
          {review.metrics && <p>In this TraitGame sequence, you chose the longer bar on {review.metrics.overall.correct} of 96 trials. This describes only this run.</p>}
          <p>Device declared: {review.profile.deviceClass.replaceAll('_', ' ')}. Input: {review.profile.kind === 'keyboard' ? `${review.profile.leftCode} Left / ${review.profile.rightCode} Right` : `${review.profile.pointerSource} pointer`}. Alternative input declared: {review.profile.alternative ? 'yes' : 'no'}; bar form: {review.variant === 'standard' ? 'standard' : 'visual accommodation'}; contrast: {review.profile.contrast}; browser zoom declared: {review.profile.magnification === 'browser_zoom' ? 'yes' : 'no'}; reduced motion: {review.profile.reducedMotion ? 'yes' : 'no'}.</p>
          <p className="note">{limitation}</p>
          {activityRetry && reportSurface?.handleId === activityRetry.handle.id &&
            reportSurface.opening === activityRetry.opening && reportSurface.generation === activityRetry.generation && selected?.sessionId === activityRetry.sessionId &&
            selected.state.identity.installationId === activityRetry.installationId &&
            <p role="status">Report-view activity could not be confirmed. <button onClick={() => void appendView(activityRetry)}>Retry report-view record</button></p>}
          {saveStatus === 'saved' && <button className="secondary" onClick={() => void loadHistory()}>View history</button>}
        </> : <p role="alert">{retired ? 'This attempt is no longer available. No numbers are shown.' : 'This report could not be reconciled. No numbers are available.'}</p>}
          {(saveStatus === 'pending' || saveStatus === 'unconfirmed') && !selected && reportSurface?.recoveryKind &&
            authorityStatus?.kind === 'current' && <button onClick={() => { const surface = recoverySurface.current; if (surface) void resumeReport(surface.session) }}>
              {reportSurface.recoveryKind === 'terminal' ? 'Try confirming save' : 'Verify or retry saved prefix'}</button>}
          {saveStatus === 'unconfirmed' && !selected && reportSurface && !reportSurface.recoveryKind &&
            authorityStatus?.kind === 'current' && <button onClick={() => { const surface = recoverySurface.current; if (surface) void resumeReport(surface.session) }}>Verify saved report</button>}
        {authorityStatus?.kind === 'blocked' && <><p role="alert">Saved data need a fresh integrity check. No numbers are shown. <button onClick={() => void verifyAttachedReport()}>Verify saved data</button></p>
          {deleteAllConfirm ? <div role="group" aria-label="Confirm Lengths deletion"><p>This permanently deletes all local Lengths attempts, results, events and form history in this browser. It cannot be undone. Other games are unaffected.</p>
            <button onClick={() => void deleteAll()}>Delete all Lengths data</button><button className="secondary" onClick={() => setDeleteAllConfirm(false)}>Cancel</button></div> : <button className="secondary" onClick={() => setDeleteAllConfirm(true)}>Delete all Lengths data</button>}
        </>}
        <div className="actions"><button onClick={replay}>Replay from guide</button><button className="secondary" onClick={leave}>Back to library</button></div></section>}
      {step === 'history' && <section className="panel" data-lengths-history-installation={store?.installationId}>
        <h1 ref={heading} tabIndex={-1}>Lengths history</h1>
        <p>Incomplete attempts cannot resume after reload. A new attempt begins at Block 1. After six accepted arms in one family, a form may repeat.</p>
        {history.length === 0 ? <p>No retained Lengths attempts in this browser.</p> : <ul>{history.map(attempt => <li key={attempt.sessionId}>
          <strong>{attempt.state.form.id}</strong> · {attempt.variant === 'standard' ? 'Standard' : 'Visual accommodation'} · {attempt.snapshot?.kind === 'terminal' ? attempt.snapshot.review.status.replace('_headless', '') : 'Incomplete / review only'} · {attempt.ordinal > 6 ? 'Repeated form · ' : ''}{attempt.profile.kind === 'keyboard' ? attempt.profile.leftCode === 'ArrowLeft' && attempt.profile.rightCode === 'ArrowRight' ? 'Default keys' : 'Modified keys' : `${attempt.profile.pointerSource} pointer`}{attempt.profile.alternative ? ' · Alternative input' : ''} · {new Date(attempt.createdAtWallMs).toLocaleString()}
          <div className="actions"><button onClick={() => void openReport(attempt)}>{attempt.snapshot?.kind === 'terminal' ? 'Open report' : 'Review recorded prefix'}</button>
            <button className="secondary" onClick={() => void remove(attempt.sessionId)}>Delete this attempt</button></div></li>)}</ul>}
        {deleteAllConfirm ? <div role="group" aria-label="Confirm Lengths deletion"><p>This permanently deletes all local Lengths attempts, results, events and form history in this browser. It cannot be undone. Other games are unaffected.</p>
          <button onClick={() => void deleteAll()}>Delete all Lengths data</button><button className="secondary" onClick={() => setDeleteAllConfirm(false)}>Cancel</button></div> : <button className="secondary" onClick={() => setDeleteAllConfirm(true)}>Delete all Lengths data</button>}
        <div className="actions"><button onClick={replay}>Start a new practice</button><button className="secondary" onClick={leave}>Back to library</button></div></section>}
    </div>
  </Shell>
}
