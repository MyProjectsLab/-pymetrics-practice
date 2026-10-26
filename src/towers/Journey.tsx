import { QuickRules } from '../onboarding/QuickRules'
import { ReportSummary } from '../reports/Summary'
import { towersFeedback } from '../reports/feedback'
import { AssessmentUsageNotice } from '../assessment-usage/Notice'
/* oxlint-disable react/immutability, react/purity, react-hooks/exhaustive-deps */
import { Attempt } from '../assessment-usage/client'
import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from 'react'
import { flushSync } from 'react-dom'
import { Shell } from '../core/Shell'
import type { Board, Form } from './forms'
import { replay, report as reportFromEvents } from './engine'
import type { PendingEvent, InputSource, Report } from './engine'
import { acquireTowersOwner, TowersAuthorityError, TowersStore, withTowersDataOrderBounded } from './storage'
import type { Run } from './storage'
import { createTowersDisplayGuard } from './display-guard'
import type { TowersDisplayGuard } from './display-guard'
import { TowersAttempt } from './controller'
import type { TowersRevocation } from './controller'
import { TowersViewSession } from './view-controller'
import type { TowersRuntime } from './runtime'
import type { MockJourneyContext } from '../mock/journey-context'
import type { ReportTarget } from '../mock/report-route'
import { withVerifiedReportPublication } from '../mock/report-route'
import './towers.css'

type Step = 'guide' | 'example' | 'check' | 'ready' | 'play' | 'completion' | 'report' | 'history'
type Saved = { run: Run; report: Report | null }
const LIMIT = 'This is an original practice puzzle. Its move and time counts describe this run; they are not a hiring score.'
const delayFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
async function confirmedFrames() {
  let timer = 0
  try { await Promise.race([delayFrame().then(delayFrame), new Promise<never>((_resolve, reject) => {
    timer = window.setTimeout(() => reject(Error('Board display could not be confirmed')), 500)
  })]) } finally { window.clearTimeout(timer) }
}
function delivered<T>(promise: Promise<T>): Promise<T> {
  let timer = 0
  return Promise.race([promise, new Promise<never>((_resolve, reject) => {
    timer = window.setTimeout(() => reject(Error('Save delivery unconfirmed')), 2500)
  })]).finally(() => window.clearTimeout(timer))
}
function mmss(ms: number) {
  const seconds = Math.floor(Math.max(0, ms) / 1000)
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}
function message(reason: unknown) { return reason instanceof Error ? reason.message : 'Local save could not be confirmed' }
function describe(board: Board, form: Form) {
  return board.map((stack, i) => `Tower ${i + 1}: ${stack.length ? stack.map(id =>
    form.disks[id - 1].name).join(', ') : 'empty'}`).join('. ')
}
function Disk({ form, id, small = false }: { form: Form; id: number; small?: boolean }) {
  const disk = form.disks[id - 1]
  return <span className={`towers-disk towers-pattern-${disk.pattern}${small ? ' towers-small' : ''}`}
    style={{ backgroundColor: disk.color }} aria-label={disk.name}>{disk.name}</span>
}
function BoardView({ board, form, selected, onTower, admitClick, onActivationKey, disabled, target = false }: {
  board: Board; form: Form; selected?: number | null; onTower?: (index: number, source: InputSource) => void
  admitClick?: (event: ReactMouseEvent<HTMLButtonElement>) => InputSource | null
  onActivationKey?: (event: ReactKeyboardEvent<HTMLButtonElement>) => void
  disabled?: boolean; target?: boolean
}) {
  return <div className={`towers-board${target ? ' towers-target' : ''}`} aria-label={target ? 'Target arrangement' : 'Your board'}>
    {board.map((stack, index) => {
      const content = <><span className="towers-stack">{stack.map((id, i) =>
        <Disk key={`${id}-${i}`} id={id} form={form} small={target} />)}</span>
        <span className="towers-pad">Tower {index + 1}</span></>
      return target ? <div className="towers-tower" key={index}>{content}</div> :
        <button type="button" className={`towers-tower${selected === index ? ' towers-picked' : ''}`}
          data-tower={index + 1} key={index} disabled={disabled}
          aria-label={`Tower ${index + 1}: ${stack.length ? stack.map(id => form.disks[id - 1].name).join(', ') : 'empty'}`}
          onKeyDown={onActivationKey}
          onClick={event => { const source = admitClick?.(event)
            if (source) onTower?.(index, source) }}>{content}</button>
    })}
  </div>
}

export function TowersJourney({ onLibrary, runtime, mock, reportTarget }: { onLibrary: () => void; runtime: TowersRuntime; mock?: MockJourneyContext; reportTarget?: ReportTarget }) {
  const usage = useRef(new Attempt('towers'))
  useEffect(() => { const current=usage.current; return () => current.cancel() }, [])
  const [step, setStep] = useState<Step>('guide')
  const viewSession = useRef(new TowersViewSession<Step>('guide'))
  const [error, setError] = useState('')
  const [settlementNotice, setSettlementNotice] = useState('')
  const [store, setStore] = useState<TowersStore | null>(null)
  const [form, setForm] = useState<Form | null>(null)
  const [run, setRun] = useState<Run | null>(null)
  const [report, setReport] = useState<Report | null>(null)
  const [comparison,setComparison]=useState('No comparable earlier run is currently verified.')
  const [mockReady, setMockReady] = useState(false), [mockError, setMockError] = useState('')
  const mockTerminalSeen = useRef<string | null>(null)
  const [history, setHistory] = useState<Saved[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const openedReportTarget=useRef<string|null>(null)
  useEffect(()=>{if(!store||!reportTarget||openedReportTarget.current===reportTarget.attemptId)return;openedReportTarget.current=reportTarget.attemptId;
    void store.inspect(reportTarget.attemptId).then(item=>openReport(item.run)).catch(reason=>setError(message(reason)))
  },[store,reportTarget])
  const [announcement, setAnnouncement] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [quiz, setQuiz] = useState('')
  const [skipAvailable, setSkipAvailable] = useState(false)
  const skipSource=useRef<string|null>(null)
  const skipChecking=useRef(false)
  const [exampleMoved, setExampleMoved] = useState(false)
  const [confirmRestart, setConfirmRestart] = useState(false)
  const [confirmAll, setConfirmAll] = useState(false)
  const [pending, setPending] = useState(false)
  const [pendingStart, setPendingStart] = useState(false)
  const [busy, setBusy] = useState(false)
  const preferredForm = useRef<string | null>(null)
  const storeRef = useRef<TowersStore | null>(null)
  const runRef = useRef<Run | null>(null)
  const formRef = useRef<Form | null>(null)
  const documentId = useRef(crypto.randomUUID())
  const ownerAbort = useRef<AbortController | null>(null)
  const releaseOwner = useRef<(() => void) | null>(null)
  const anchor = useRef<number | null>(null)
  const wallAnchor = useRef<number | null>(null)
  const selectedRef = useRef<number | null>(null)
  const keyActivation = useRef<{ target: EventTarget; at: number } | null>(null)
  const repeatedKeyUntil = useRef(0)
  const busyRef = useRef(false)
  const checkingRef = useRef(false)
  const historyChecking = useRef(false)
  const historyEpoch = useRef(0)
  const stepRef = useRef(step)
  stepRef.current = step
  useEffect(()=>{
    if(!store||step!=='guide')return
    let active=true,pending=false
    const check=()=>{if(pending||document.hidden||!document.hasFocus())return;pending=true;void withTowersDataOrderBounded(signal=>delivered(store.list(signal))).then(items=>{
      if(active)setSkipAvailable(items.some(item=>item.run.status==='complete'&&item.report?.status==='solved'))
    }).catch(()=>{if(active)setSkipAvailable(false)}).finally(()=>{pending=false})}
    check();const timer=window.setInterval(check,1000)
    return()=>{active=false;window.clearInterval(timer)}
  },[store,step])
  async function skipTutorial(){
    const current=storeRef.current,ticket=viewSession.current.capture()
    if(!current)return
    try{
      const items=await withTowersDataOrderBounded(signal=>delivered(current.list(signal)))
      if(!viewSession.current.current(ticket)||stepRef.current!=='guide'||storeRef.current!==current||!live.current)return
      const source=items.find(item=>item.run.status==='complete'&&item.report?.status==='solved')
      if(!source){
        setSkipAvailable(false);setError('A current solved Towers run is no longer saved. Check the rule instead.');return
      }
      skipSource.current=source.run.id
      goStep('ready')
    }catch{if(viewSession.current.current(ticket)){setSkipAvailable(false);setError('Saved Towers history could not be checked. Use the rule check instead.')}}
  }
  function goStep(next: Step) {
    const ticket = viewSession.current.choose(next)
    stepRef.current = next
    setStep(next)
    return ticket
  }
  const pendingRef = useRef<{ input: Parameters<TowersStore['append']>[0]; token: number } | null>(null)
  const pendingOnsetResolution = useRef<{ input: Parameters<TowersStore['resolveOnsetFailure']>[0];
    token: number } | null>(null)
  const startRequest = useRef<{ input: Parameters<TowersStore['start']>[0]; token: number } | null>(null)
  const intentRequest = useRef<{ input: Parameters<TowersStore['intent']>[0]; run: Run; token: number } | null>(null)
  const token = useRef(0)
  const live = useRef(true)
  const playBoard = useRef<HTMLDivElement>(null)
  const section = useRef<HTMLElement>(null)
  const displayGuard = useRef<TowersDisplayGuard | null>(null)
  const displayRevoked = useRef<string | null>(null)
  const attempt = useRef<TowersAttempt | null>(null)
  const playTitle = useRef<HTMLHeadingElement>(null)
  const reportTitle = useRef<HTMLHeadingElement>(null)
  const historyTitle = useRef<HTMLHeadingElement>(null)

  function putRun(value: Run | null) {
    runRef.current = value; setRun(value)
    if (value && (value.status === 'complete' || value.status === 'interrupted'))
      runtime.markSettled(value.id)
  }
  useEffect(()=>{
    if(step!=='completion'||!run?.snapshot?.report)return
    const r=run.snapshot.report
    if(run.status==='complete' && r.status==='solved')usage.current.finish(run.id,'completed',()=>({solved:1,moves:r.movesMade,optimal_moves:r.optimalMoves}))
    else if(r.status==='incomplete timeout')usage.current.finish(run.id,'incomplete')
  },[run,step])
  function putForm(value: Form | null) { formRef.current = value; setForm(value) }
  function clearSelection() { selectedRef.current = null; setSelected(null) }
  function onActivationKey(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key !== 'Enter' && event.key !== ' ') return
    if (event.repeat) { event.preventDefault(); repeatedKeyUntil.current = performance.now() + 250; return }
    keyActivation.current = { target: event.currentTarget, at: performance.now() }
  }
  function admitClick(event: ReactMouseEvent<HTMLButtonElement>): InputSource | null {
    if (!event.nativeEvent.isTrusted || performance.now() < repeatedKeyUntil.current) return null
    if (event.detail === 0) {
      const key = keyActivation.current; keyActivation.current = null
      return key?.target === event.currentTarget && performance.now() - key.at < 1000 ?
        'keyboard' : 'assistive'
    }
    return (event.nativeEvent as PointerEvent).pointerType === 'touch' ? 'touch' : 'pointer'
  }
  function release() { attempt.current?.stop(); attempt.current = null
    displayGuard.current?.stop(); displayGuard.current = null
    ownerAbort.current?.abort(); ownerAbort.current = null
    releaseOwner.current?.(); releaseOwner.current = null; anchor.current = null; wallAnchor.current = null
  }
  function retire(text: string) {
    runtime.withdraw(text, 'interrupted')
    token.current++; pendingRef.current = null; pendingOnsetResolution.current = null
    startRequest.current = null; intentRequest.current = null; busyRef.current = false
    setPending(false); setPendingStart(false); setBusy(false); clearSelection(); release(); putRun(null)
    setReport(null); setHistory([]); setError(text); goStep('history'); void loadHistory()
  }

  useEffect(() => {
    live.current = true
    let mounted = true
    void runtime.openStore(!!mock||!!reportTarget,!!reportTarget).then(opened => {
      if (!mounted) return
      storeRef.current = opened; setStore(opened)
      if (runtime.unsettled) setSettlementNotice('The previous Towers attempt is still being checked.')
    }, reason => { if (mounted) setError(message(reason)) })
    return () => { mounted = false; live.current = false; token.current++
      runtime.withdraw('Page left Towers', 'exited')
      release(); storeRef.current = null }
  }, [])
  useEffect(() => runtime.subscribe(value => {
    if (!live.current) return
    if (value.state === 'pending') {
      setSettlementNotice('The previous Towers attempt is still being checked. Retry before starting another.')
      return
    }
    setSettlementNotice('')
    token.current++
    release()
    if (['guide', 'example', 'check', 'ready'].includes(stepRef.current)) {
      putRun(null); setError(''); return
    }
    if (value.run) { putRun(value.run)
      const complete = value.run.status === 'complete' || value.run.events.at(-1)?.kind === 'expired'
      goStep(complete ? 'completion' : 'history')
      if (!complete) void loadHistory()
    } else { putRun(null); goStep('history'); void loadHistory() }
  }), [runtime])

  async function authority(runId: string, expectedToken: number, apply: (saved: Run, checked: Form) => void) {
    const current = storeRef.current
    if (!current) throw Error('Local history unavailable')
    return withTowersDataOrderBounded(async signal => {
      const checked = await delivered(current.inspect(runId, signal))
      if (token.current !== expectedToken || !live.current ||
        checked.run.documentId !== documentId.current ||
        checked.run.installationId !== current.installationId)
        throw Error('Towers authority changed')
      flushSync(() => apply(checked.run, checked.form))
      return checked.run
    })
  }
  async function retryStorage() {
    setError('Checking Towers storage…')
    try { const opened = await runtime.openStore(!!mock||!!reportTarget,!!reportTarget)
      if (live.current) { storeRef.current = opened; setStore(opened); setError('') }
    } catch (reason) { if (live.current) setError(message(reason)) }
  }
  function recoverReplacement(current: TowersStore, reason: unknown) {
    if (!(reason instanceof TowersAuthorityError) || reason.kind !== 'replaced') return
    void runtime.reopenAfterReplacement(current).then(next => {
      if (live.current && storeRef.current === current) { storeRef.current = next; setStore(next) }
    }, () => { if (live.current && storeRef.current === current)
      setError('The saved installation changed. Check local storage again.') })
  }
  function compareTowers(checked:Awaited<ReturnType<TowersStore['inspect']>>){
    const currentReport=checked.report
    if(checked.run.status!=='complete'||currentReport?.status!=='solved')return 'No comparable earlier run is currently verified.'
    const prior=Object.values(checked.root.runs).filter(item=>item.id!==checked.run.id&&item.wallMs<checked.run.wallMs&&item.status==='complete'&&!!item.snapshot&&item.formId===checked.run.formId&&item.formHash===checked.run.formHash).sort((a,b)=>b.wallMs-a.wallMs)[0]
    const priorReport=prior?reportFromEvents(checked.form,prior.events):null
    return priorReport?.status==='solved'?`Previous saved run on this same puzzle used ${priorReport.movesMade} moves; this run used ${currentReport.movesMade}.`:'No comparable earlier run is currently verified.'
  }
  async function checkCurrent() {
    const current = storeRef.current, active = runRef.current
    if (!current || !active || checkingRef.current) return
    checkingRef.current = true
    const observedToken = token.current
    try {
      const checked = await delivered(current.inspect(active.id))
      if (token.current !== observedToken || runRef.current?.id !== active.id || !live.current) return
      if (checked.run.documentId !== active.documentId ||
        checked.run.installationId !== current.installationId) throw Error('Towers authority changed')
      if(stepRef.current==='report')setComparison(compareTowers(checked))
    } catch { if (token.current === observedToken && runRef.current?.id === active.id && live.current) {
      runtime.withdraw('Saved Towers authority check failed', 'interrupted')
      retire('Saved Towers authority is being checked. Its board was withdrawn.')
    } }
    finally { checkingRef.current = false }
  }
  async function refreshPublishedHistory() {
    const current = storeRef.current
    const ticket = viewSession.current.capture()
    if (!current || ticket.screen !== 'history' || historyChecking.current) return
    historyChecking.current = true
    const epoch = ++historyEpoch.current
    try {
      await withTowersDataOrderBounded(async signal => {
        const items = await delivered(current.list(signal))
        if (epoch !== historyEpoch.current || !viewSession.current.current(ticket) ||
          storeRef.current !== current || !live.current) return
        flushSync(() => { setHistory(items)
          setError(previous => previous.startsWith('Saved Towers history could not be confirmed:') ? '' : previous) })
      })
    } catch (reason) {
      const currentView = epoch === historyEpoch.current &&
        viewSession.current.current(ticket) && live.current
      if (currentView) {
        flushSync(() => setHistory([]))
        setError(`Saved Towers history could not be confirmed: ${message(reason)}`)
      }
      // Connection recovery belongs to the document runtime even when the
      // history screen that detected replacement has since been abandoned.
      if (reason instanceof TowersAuthorityError && reason.kind === 'replaced' ||
        runtime.currentStore !== current) {
        try { const next = await runtime.reopenAfterReplacement(current)
          if (live.current && storeRef.current === current) { storeRef.current = next; setStore(next) }
        } catch { /* the cleared history remains unconfirmed until a later read */ }
      }
    } finally { historyChecking.current = false }
  }
  useEffect(() => {
    if (!store) return
    const unsubscribe = store.subscribe(() => { void checkCurrent(); void refreshPublishedHistory() })
    const timer = window.setInterval(() => { void checkCurrent(); void refreshPublishedHistory() }, 900)
    return () => { unsubscribe(); window.clearInterval(timer) }
  }, [store, step])

  function event(kind: PendingEvent['kind'], ms: number, extra: Partial<PendingEvent> = {}): PendingEvent {
    return { kind, sequence: (runRef.current?.events.length ?? 0) + 1,
      elapsedMs: ms, actionId: crypto.randomUUID(), wallTimestampMs: Date.now(), ...extra }
  }
  function nativeMs() { return anchor.current === null ? 0 :
    Math.max(0, Math.floor(performance.now() - anchor.current)) }
  function boardDisplayValid() {
    if (displayRevoked.current || (displayGuard.current && !displayGuard.current.validNow())) return false
    const board = playBoard.current
    if (!board?.isConnected || document.visibilityState !== 'visible') return false
    const rect = board.getBoundingClientRect(), style = getComputedStyle(board)
    return rect.width >= 100 && rect.height >= 100 &&
      style.display !== 'none' && style.visibility === 'visible'
  }
  function onRevoked(value: TowersRevocation) {
    if (live.current && !displayRevoked.current) {
      displayRevoked.current = value.reason
      // Withdraw pixels synchronously; persistence may be held or fail.
      playBoard.current?.style.setProperty('visibility', 'hidden')
      clearSelection()
      setError('The board was withdrawn. The saved attempt is being checked.')
    }
    runtime.captureRevocation(value)
  }
  function revokeDisplay(reason: string) { attempt.current?.revoke(reason) }
  function clockDiverged() { return wallAnchor.current !== null &&
    Math.abs(Date.now() - wallAnchor.current - nativeMs()) > 2000 }
  async function save(input: Parameters<TowersStore['append']>[0], expectedToken: number) {
    const current = storeRef.current
    if (!current) throw Error('Local history unavailable')
    runtime.recordAction(input)
    try {
      const write = current.append(input)
      const deliveredRun = await delivered(write)
      if (attempt.current?.revoked || !live.current) {
        runtime.confirmAction(input, deliveredRun)
        runtime.nudge(input.runId)
        return deliveredRun
      }
      pendingRef.current = null; setPending(false)
      const saved = await authority(input.runId, expectedToken, (saved, checked) => {
        putRun(saved); putForm(checked)
      })
      runtime.confirmAction(input, saved)
      return saved
    } catch (reason) {
      recoverReplacement(current, reason)
      if (token.current === expectedToken && live.current && !attempt.current?.revoked) {
        try { await delivered(current.inspect(input.runId)) }
        catch (inspectionFailure) {
          if (inspectionFailure instanceof TowersAuthorityError) {
            retire('The saved Towers attempt was deleted or replaced. Its board and numbers were withdrawn.')
            throw inspectionFailure
          }
        }
        if (token.current === expectedToken) {
          pendingRef.current = { input, token: expectedToken }
          setPending(true); setError(`${message(reason)}. Check the saved attempt before continuing.`)
        }
      }
      throw reason
    }
  }
  async function retrySave() {
    const held = pendingRef.current
    if (!held || busyRef.current || !storeRef.current) return
    if (runRef.current?.status === 'active' && !boardDisplayValid())
      void interrupt('Board display changed during play')
    busyRef.current = true; setBusy(true)
    try {
      const saved = await save(held.input, held.token)
      if (held.token !== token.current) return
      if (attempt.current?.revoked) return
      if (held.input.event.kind === 'move' && saved.status === 'complete') {
        release(); putRun(saved); goStep('completion')
      } else if (held.input.event.kind === 'expired') {
        release(); putRun(saved); goStep('completion')
      } else if (held.input.event.kind === 'interrupted' || held.input.event.kind === 'exited') {
        release(); goStep('history'); void loadHistory()
      }
      setError('')
    }
    catch { /* visible pending state remains */ }
    finally { busyRef.current = false; setBusy(false) }
  }
  async function resolveFailedOnset(held: NonNullable<typeof pendingOnsetResolution.current>) {
    const current = storeRef.current
    if (!current) return
    try {
      const resolved = await withTowersDataOrderBounded(signal =>
        delivered(current.resolveOnsetFailure(held.input, signal)))
      if (held.token !== token.current || !live.current) return
      pendingOnsetResolution.current = null; setPending(false)
      if (resolved.presentation === 'intent') {
        release(); setError(''); goStep('history'); void loadHistory()
      } else {
        flushSync(() => putRun(resolved))
        if (resolved.status === 'active') {
          pendingOnsetResolution.current = held
          setPending(true)
          setError('Board outcome still needs confirmation. Check the saved board outcome.')
        } else {
          const finished = resolved.status === 'complete' || resolved.events.at(-1)?.kind === 'expired'
          release(); setError(''); goStep(finished ? 'completion' : 'history')
          if (!finished) void loadHistory()
        }
      }
    } catch (reason) {
      if (held.token !== token.current || !live.current) return
      if (reason instanceof TowersAuthorityError) {
        retire('The saved Towers attempt was deleted or replaced. Its board and numbers were withdrawn.')
      } else {
        pendingOnsetResolution.current = held
        setPending(true)
        setError('Board onset outcome is unconfirmed. Check the saved attempt before continuing.')
      }
    }
  }
  async function retryOnsetResolution() {
    const held = pendingOnsetResolution.current
    if (!held || busyRef.current) return
    busyRef.current = true; setBusy(true)
    try { await resolveFailedOnset(held) }
    finally { busyRef.current = false; setBusy(false) }
  }
  async function append(nextEvent: PendingEvent, expectedToken: number) {
    const active = runRef.current
    if (!active) throw Error('No active Towers attempt')
    const input = { id: crypto.randomUUID(), runId: active.id, documentId: documentId.current,
      generation: active.generation, revision: active.revision, event: nextEvent }
    return save(input, expectedToken)
  }
  async function act(kind: 'move' | 'undo' | 'reset', extra: Partial<PendingEvent> = {}) {
    const active = runRef.current, checked = formRef.current
    if (active?.status === 'active' && anchor.current !== null && !boardDisplayValid()) {
      void interrupt('Board display changed during play'); return
    }
    if (displayRevoked.current || !active || !checked || anchor.current === null || busyRef.current || pendingRef.current) return
    const captured = nativeMs()
    if (captured >= checked.limitMs) { void expire(); return }
    if (clockDiverged()) { void interrupt('Clock changed during play'); return }
    busyRef.current = true; setBusy(true); clearSelection()
    const id = token.current
    try {
      const updated = await append(event(kind, captured, extra), id)
      if (id !== token.current) return
      if (attempt.current?.revoked) return
      const state = replay(checked, updated.events)
      setAnnouncement(describe(state.board, checked))
      if (updated.status === 'complete') { release(); putRun(updated); goStep('completion') }
      setError('')
    } catch { /* retry or retirement UI is authoritative */ }
    finally { busyRef.current = false; setBusy(false) }
  }
  async function expire() {
    if (displayRevoked.current || busyRef.current || pendingRef.current ||
      runRef.current?.status !== 'active' || !formRef.current ||
      anchor.current === null || nativeMs() < formRef.current.limitMs) return
    busyRef.current = true; setBusy(true)
    const id = token.current
    try { const saved = await append(event('expired', formRef.current.limitMs), id)
      if (id !== token.current) return
      release(); putRun(saved); goStep('completion'); setError('') }
    catch { /* saved status remains unconfirmed */ }
    finally { busyRef.current = false; setBusy(false) }
  }
  function interrupt(reason: string) { runtime.withdraw(reason, 'interrupted') }
  useEffect(() => {
    if (step !== 'play') return
    const timer = window.setInterval(() => {
      if (anchor.current === null) return
      const ms = nativeMs(); setElapsed(ms)
      if (!boardDisplayValid()) { void interrupt('Board display changed during play'); return }
      if (displayRevoked.current) return
      if (formRef.current && ms >= formRef.current.limitMs) void expire()
      else if (clockDiverged()) void interrupt('Clock changed during play')
    }, 100)
    return () => window.clearInterval(timer)
  }, [step])

  function tower(index: number, source: InputSource) {
    const active = runRef.current, checked = formRef.current
    if (active?.status === 'active' && anchor.current !== null && !boardDisplayValid()) {
      void interrupt('Board display changed during play'); return
    }
    if (displayRevoked.current || !active || !checked || active.status !== 'active' || busyRef.current || pendingRef.current) return
    const board = replay(checked, active.events).board
    if (selectedRef.current === null) {
      if (!board[index].length) return
      selectedRef.current = index; setSelected(index)
      setAnnouncement(`${checked.disks[board[index].at(-1)! - 1].name} selected from tower ${index + 1}. Choose destination.`)
      return
    }
    const from = selectedRef.current
    if (index === from) { clearSelection(); setAnnouncement('Selection canceled'); return }
    void act('move', { from, to: index, diskId: board[from].at(-1), inputSource: source })
  }

  async function showReserved(reserved: Run, id: number) {
    const current = storeRef.current
    if (!current) return
    let intentAttempted = false
    let exposurePossible = false
    let onsetInput: Parameters<TowersStore['append']>[0] | null = null
    const input = intentRequest.current?.run.id === reserved.id ? intentRequest.current.input :
      { id: crypto.randomUUID(), runId: reserved.id, documentId: documentId.current,
        generation: reserved.generation, revision: reserved.revision }
    try {
      if (id !== token.current) { await current.cancelUnseen({ runId: reserved.id,
        documentId: reserved.documentId, generation: reserved.generation }).catch(() => undefined); return }
      await withTowersDataOrderBounded(async signal => {
        const authoritative = await delivered(current.inspect(reserved.id, signal))
        if (id !== token.current || authoritative.run.status !== 'reserved' ||
          authoritative.run.documentId !== documentId.current ||
          !['unseen', 'intent'].includes(authoritative.run.presentation) ||
          (authoritative.run.presentation === 'unseen' && authoritative.run.revision !== reserved.revision))
          throw Error('Reserved board authority changed')
        const checked = authoritative.form
        intentAttempted = true
        if (authoritative.run.presentation === 'unseen') {
          intentRequest.current = { input, run: reserved, token: id }
          runtime.recordIntent(input)
          await delivered(current.intent(input, signal))
        }
        const prepared = await delivered(current.inspect(reserved.id, signal))
        runtime.recordRun(prepared.run, prepared.form)
        if (id !== token.current || !attempt.current?.active || displayRevoked.current ||
          prepared.run.presentation !== 'intent' || prepared.run.status !== 'reserved' ||
          prepared.run.documentId !== documentId.current ||
          prepared.run.installationId !== current.installationId)
          throw Error('Board presentation authority changed')
        intentRequest.current = null
        if (!section.current) throw Error('Board container unavailable')
        const guard = createTowersDisplayGuard(section.current, revokeDisplay)
        displayGuard.current = guard
        if (!guard.validNow()) throw Error('Board display could not be confirmed')
        flushSync(() => { putRun(prepared.run); putForm(checked); goStep('play'); setElapsed(0) })
        exposurePossible = true
        if (!playBoard.current || !guard.attach(playBoard.current))
          throw Error('Board display could not be confirmed')
        await confirmedFrames()
        if (signal.aborted || id !== token.current || !attempt.current?.active ||
          !guard.validNow() || !boardDisplayValid())
          throw Error('Board display could not be confirmed')
        preferredForm.current = null
        anchor.current = performance.now(); wallAnchor.current = Date.now()
        attempt.current?.setAnchor(anchor.current)
        onsetInput = { id: crypto.randomUUID(), runId: reserved.id,
          documentId: documentId.current, generation: reserved.generation,
          revision: prepared.run.revision, event: { kind: 'board_onset', sequence: 1,
            elapsedMs: 0, actionId: crypto.randomUUID(), wallTimestampMs: Date.now() } }
        runtime.recordOnset(onsetInput)
        await delivered(current.append(onsetInput, signal))
        const final = await delivered(current.inspect(reserved.id, signal))
        runtime.recordRun(final.run, final.form)
        if (id !== token.current || !attempt.current?.active || !guard.validNow() || final.run.status !== 'active' ||
          final.run.events[0]?.kind !== 'board_onset') throw Error('Board onset authority changed')
        usage.current.admit(final.run.id)
        flushSync(() => { putRun(final.run); putForm(final.form) })
      })
      if (id === token.current && attempt.current?.revoked) return
      if (id === token.current) { setError(''); playTitle.current?.focus() }
    } catch (reason) {
      recoverReplacement(current, reason)
      const capturedOnset = onsetInput as Parameters<TowersStore['append']>[0] | null
      if (exposurePossible) playBoard.current?.style.setProperty('visibility', 'hidden')
      if (runtime.unsettled && !attempt.current?.revoked &&
        !(intentRequest.current && !exposurePossible && /delivery unconfirmed/i.test(message(reason))))
        runtime.withdraw('Board presentation could not be confirmed')
      // The first attempted intent write may commit after its delivery watchdog. Never
      // classify that run as unseen or cancel it on the basis of a stale callback.
      if ((!intentAttempted && !exposurePossible && !intentRequest.current) ||
        (attempt.current?.revoked && !capturedOnset))
        await current.cancelUnseen({ runId: reserved.id, documentId: reserved.documentId,
          generation: reserved.generation }).catch(() => undefined)
      if (id === token.current) {
        if (exposurePossible && capturedOnset) {
          revokeDisplay('Board onset delivery was not confirmed')
          if (runtime.unsettled) return
          const decision = attempt.current?.revoked
          const held = { token: id, input: { id: crypto.randomUUID(),
            runId: capturedOnset.runId, documentId: capturedOnset.documentId,
            generation: capturedOnset.generation, revision: capturedOnset.revision,
            onsetActionId: capturedOnset.event.actionId,
            terminal: { elapsedMs: decision?.elapsedMs ?? nativeMs(),
              reason: decision?.reason ?? 'Board onset could not be confirmed',
              wallTimestampMs: decision?.wallTimestampMs ?? Date.now() } } }
          pendingOnsetResolution.current = held
          await resolveFailedOnset(held)
          return
        }
        if (pendingRef.current) {
          setError('Board onset save is unconfirmed. Check the saved attempt before continuing.')
        } else if (attempt.current?.revoked) {
          release(); intentRequest.current = null; setError('Board preparation was interrupted.')
          goStep('history'); void loadHistory()
        } else if (intentRequest.current) {
          setError('Board preparation is unconfirmed. Check it before starting.'); goStep('ready')
        } else {
          release(); setError(message(reason)); goStep(exposurePossible || intentAttempted ? 'history' : 'ready')
          if (exposurePossible || intentAttempted) void loadHistory()
        }
      }
    }
  }
  async function begin() {
    const current = storeRef.current
    if (!current || busyRef.current || skipChecking.current || startRequest.current || intentRequest.current || attempt.current) return
    if(skipSource.current){const sourceId=skipSource.current,ticket=viewSession.current.capture();skipChecking.current=true
      try{const items=await withTowersDataOrderBounded(signal=>delivered(current.list(signal)))
        if(!live.current||!viewSession.current.current(ticket)||stepRef.current!=='ready'||storeRef.current!==current)return
        if(!items.some(item=>item.run.id===sourceId&&item.run.status==='complete'&&item.report?.status==='solved')){
          skipSource.current=null;setSkipAvailable(false);setQuiz('');setError('The solved run used to skip the guide was deleted or changed. Check the rule to continue.');goStep('check');return
        }
        skipSource.current=null
      }catch{if(viewSession.current.current(ticket)&&stepRef.current==='ready'){setQuiz('');setError('The solved run used to skip the guide could not be checked. Check the rule to continue.');goStep('check')}return}
      finally{skipChecking.current=false}
    }
    if (runtime.unsettled) { setError('Confirm the previous Towers attempt before starting another.'); return }
    usage.current.begin(mock?'mock':'practice')
    const id = ++token.current
    displayRevoked.current = null
    busyRef.current = true; setBusy(true); setError('')
    const abort = new AbortController(); ownerAbort.current = abort
    const input = { id: crypto.randomUUID(), runId: crypto.randomUUID(),
      documentId: documentId.current, wallMs: Date.now(),
      preferredFormId: preferredForm.current ?? undefined }
    const lifetime = new TowersAttempt(input.runId, input.documentId, 1, onRevoked)
    attempt.current = lifetime
    runtime.begin(lifetime, current, input)
    startRequest.current = { input, token: id }
    try {
      releaseOwner.current = await acquireTowersOwner(() => lifetime.revoke('Exclusive owner ended'), abort.signal)
      runtime.adoptOwner(lifetime, releaseOwner.current)
      if (id !== token.current) return
      if (!lifetime.active) throw Error('Start was interrupted')
      if (mock) await mock.beforeArm({ requestId: input.id, attemptId: input.runId, originTicketId: null,
        installationId: current.installationId, generation: null, requestKind: 'start', nativeIdentity: [] })
      if (id !== token.current || !lifetime.active || abort.signal.aborted) throw Error('Start was interrupted')
      const reserved = await withTowersDataOrderBounded(signal => delivered(current.start(input, signal)), abort.signal)
      runtime.recordRun(reserved)
      if (id !== token.current || !lifetime.active) {
        await current.cancelUnseen({ runId: reserved.id,
          documentId: reserved.documentId, generation: reserved.generation }).catch(() => undefined)
        if (id === token.current) { startRequest.current = null; setPendingStart(false)
          release(); goStep('history'); void loadHistory() }
        return
      }
      startRequest.current = null; setPendingStart(false)
      await showReserved(reserved, id)
    } catch (reason) {
      recoverReplacement(current, reason)
      if (id === token.current && /delivery unconfirmed/i.test(message(reason))) {
        setPendingStart(true); setError('Start save unconfirmed. Check the saved start before opening a board.')
      } else {
        startRequest.current = null
        try { await current.cancelUnseen({ runId: input.runId, documentId: input.documentId,
          generation: 1, startRequestId: input.id })
          runtime.markSettled(input.runId)
          if (id === token.current) { release(); setError(message(reason)); goStep('ready') }
        } catch { runtime.withdraw('Start could not be confirmed') }
      }
    } finally { busyRef.current = false; setBusy(false) }
  }
  async function retryStart() {
    const held = startRequest.current, current = storeRef.current
    if (!held || !current || busyRef.current) return
    if (!attempt.current?.active) {
      try { await current.cancelUnseen({ runId: held.input.runId,
        documentId: held.input.documentId, generation: 1, startRequestId: held.input.id }) }
      catch { /* retain the pending request for another authoritative check */ return }
      runtime.markSettled(held.input.runId); startRequest.current = null; setPendingStart(false); release()
      goStep('history'); void loadHistory(); return
    }
    busyRef.current = true; setBusy(true)
    try {
      const reserved = await withTowersDataOrderBounded(signal => delivered(current.start(held.input,
        signal)), ownerAbort.current?.signal)
      runtime.recordRun(reserved)
      if (held.token !== token.current) return
      startRequest.current = null; setPendingStart(false)
      await showReserved(reserved, held.token)
    } catch (reason) {
      recoverReplacement(current, reason)
      if (held.token === token.current) setError(message(reason))
    }
    finally { busyRef.current = false; setBusy(false) }
  }
  async function retryIntent() {
    const held = intentRequest.current, current = storeRef.current
    if (!held || !current || busyRef.current) return
    if (!attempt.current?.active || !releaseOwner.current) {
      intentRequest.current = null
      try {
        await delivered(current.cancelUnseen({ runId: held.run.id,
          documentId: documentId.current, generation: held.run.generation }))
      } catch { /* An unconfirmed intent remains consumed and review-only. */ }
      release(); setError('Board preparation was interrupted. Start a new attempt to play.')
      goStep('history'); void loadHistory(); return
    }
    busyRef.current = true; setBusy(true)
    try {
      const checked = await delivered(current.inspect(held.run.id))
      if (held.token !== token.current || checked.run.installationId !== current.installationId ||
        checked.run.documentId !== documentId.current || checked.run.status !== 'reserved')
        throw Error('Board preparation authority changed')
      await showReserved(held.run, held.token)
    } catch (reason) {
      recoverReplacement(current, reason)
      if (held.token === token.current) {
        if (reason instanceof TowersAuthorityError)
          retire('The saved Towers preparation was deleted or replaced.')
        else setError(`${message(reason)}. Check board preparation again.`)
      }
    } finally { busyRef.current = false; setBusy(false) }
  }

  async function openReport(target = runRef.current) {
    if(stepRef.current==='history')mock?.retireReturnIntent()
    const current = storeRef.current
    if (!current || !target) return
    const ticket = viewSession.current.choose('report')
    let published: ReturnType<typeof goStep> | null = null
    try {
      const publish=async (signal?:AbortSignal,permit=()=>{}) => {
        if(reportTarget&&current.installationId!==reportTarget.reference.installationId)throw Error('Towers installation changed')
      const checked = await delivered(current.inspect(target.id, signal))
        if (!viewSession.current.current(ticket) || !['complete', 'interrupted'].includes(checked.run.status) ||
          (checked.run.status === 'complete' && !checked.run.snapshot) || !checked.report ||
          checked.run.installationId !== current.installationId) throw Error('Report authority changed')
        await delivered(current.view(target.id, crypto.randomUUID(), 'report_viewed', signal))
        const final = await delivered(current.inspect(target.id, signal))
        if (!viewSession.current.current(ticket) || !['complete', 'interrupted'].includes(final.run.status) ||
          !final.report)
          throw Error('Report authority changed')
        permit()
        flushSync(() => { putRun(final.run); putForm(final.form); setReport(final.report);setComparison(compareTowers(final))
          published = goStep('report') })
      }
      if(reportTarget)await withVerifiedReportPublication(reportTarget,permit=>publish(undefined,permit))
      else await withTowersDataOrderBounded(publish)
      if (published && viewSession.current.current(published)) reportTitle.current?.focus()
      if (mock && published && viewSession.current.current(published) && mockTerminalSeen.current !== target.id) {
        mockTerminalSeen.current = target.id
        try { const status = await mock.terminal(); setMockReady(status === 'ready'); if (status === 'review_only') setMockError('This attempt needs review. Return to mock to try again or skip this game.') }
        catch (cause) { mockTerminalSeen.current = null; setMockError(message(cause)) }
      }
    } catch (reason) {
      recoverReplacement(current, reason)
      if (!viewSession.current.current(ticket)) return
      setReport(null); setError(message(reason)); void loadHistory()
    }
  }
  async function loadHistory() {
    mock?.retireReturnIntent()
    const current = storeRef.current
    if (!current) return
    historyEpoch.current++
    const ticket = viewSession.current.choose('history')
    if (stepRef.current === 'history') setHistory([])
    let published: ReturnType<typeof goStep> | null = null
    try { await withTowersDataOrderBounded(async signal => {
      const items = await delivered(current.list(signal))
      if (!viewSession.current.current(ticket) || storeRef.current !== current || !live.current) return
      flushSync(() => { setHistory(items); published = goStep('history') })
    }); if (published && viewSession.current.current(published)) historyTitle.current?.focus() }
    catch (reason) { recoverReplacement(current, reason)
      if (viewSession.current.current(ticket)) {
      setHistory([]); setError(message(reason)); goStep('history')
    } }
  }
  async function erase(runId: string) {
    mock?.retireReturnIntent()
    const current = storeRef.current
    if (!current) return
    token.current++; setReport(null); setHistory([]); goStep('history'); clearSelection()
    const ticket = viewSession.current.capture()
    setError('Checking deletion…')
    try { await delivered(current.delete(runId)); if (runRef.current?.id === runId) { release(); putRun(null) }
      if (viewSession.current.current(ticket)) { setError(''); await loadHistory() } }
    catch (reason) { if (viewSession.current.current(ticket)) {
      setError(message(reason)); void loadHistory()
    } }
  }
  async function eraseAll() {
    mock?.retireReturnIntent()
    const current = storeRef.current
    if (!current) return
    token.current++; setReport(null); setHistory([]); goStep('history'); clearSelection()
    const ticket = viewSession.current.capture()
    release(); putRun(null); setConfirmAll(false); setError('Checking deletion…')
    try { await delivered(current.deleteAll())
      const next = await runtime.reopenAfterReplacement(current); storeRef.current = next; setStore(next)
      if (viewSession.current.current(ticket)) { setHistory([]); setError(''); goStep('history') } }
    catch (reason) {
      if (viewSession.current.current(ticket)) setError(message(reason))
      try { await delivered(current.read()); if (viewSession.current.current(ticket)) void loadHistory() }
      catch {
        try { const next = await runtime.reopenAfterReplacement(current); storeRef.current = next; setStore(next)
          if (viewSession.current.current(ticket))
            setError('The installation changed. Saved Towers data were withdrawn.') }
        catch { if (viewSession.current.current(ticket))
          setError('Deletion could not be confirmed. Saved Towers data remain hidden.') }
      }
    }
  }
  async function endAttempt(next: 'library' | 'restart') {
    if(next==='restart')mock?.retireReturnIntent()
    const active = runRef.current
    if (runtime.unsettled) await runtime.withdraw('left game', 'exited')
    token.current++; release()
    if (next === 'restart') {
      if(mock){try{await mock.retry()}catch(cause){setMockError(message(cause));return}}
      preferredForm.current = mock ? null : active?.formId ?? null
      putRun(null); putForm(null); setReport(null)
      setError(runtime.unsettled ? 'The previous attempt is being saved. Start again after it is confirmed.' : '')
      goStep('ready')
    } else onLibrary()
  }
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedRef.current !== null) { e.preventDefault(); clearSelection() }
    }
    window.addEventListener('keydown', key)
    const hidden = () => { if (document.visibilityState === 'hidden'){
      mock?.retireReturnIntent();void interrupt('Page hidden during play')} }
    const pagehide = () => { mock?.retireReturnIntent();void interrupt('Page left during play') }
    document.addEventListener('visibilitychange', hidden)
    window.addEventListener('pagehide', pagehide)
    return () => { window.removeEventListener('keydown', key)
      document.removeEventListener('visibilitychange', hidden)
      window.removeEventListener('pagehide', pagehide) }
  }, [])

  const activeBoard = run && form && run.events.length ? replay(form, run.events).board : form?.start
  const state = run && form && run.events.length ? replay(form, run.events) : null
  const msLeft = Math.max(0, 120000 - elapsed)
  if(reportTarget&&(step!=='report'||!report||!run))return <Shell onLibrary={onLibrary}><section className="journey panel"><h1>Saved Towers report</h1><p role={error?'alert':'status'}>{error||'Checking the exact retained result…'}</p><button onClick={onLibrary}>Return to mock</button></section></Shell>
  return <Shell onLibrary={() => void endAttempt('library')}><section ref={section} className="journey towers-journey">
    {step === 'guide' && <div className="journey-top"><button className="secondary" onClick={() => void endAttempt('library')}><span aria-hidden="true">← </span>{mock?'Return to mock':'Main menu'}</button><p>Towers · Practice</p></div>}
    {settlementNotice && <p role="status" className="panel">{settlementNotice}</p>}
    {error && <p role="alert" className="panel">{error}</p>}
    {!store && <button onClick={() => void retryStorage()}>Try local storage again</button>}
    {runtime.unsettled && runtime.current?.retryable && <div className="panel">
      <button onClick={() => runtime.retry()}>Check saved attempt again</button>
    </div>}
    {displayRevoked.current && pending && <div className="panel">
      <button disabled={busy} onClick={() => void retrySave()}>Check saved move and retry</button>
    </div>}
    {displayRevoked.current && pendingOnsetResolution.current && <div className="panel">
      <button disabled={busy} onClick={() => void retryOnsetResolution()}>Check saved board outcome</button>
    </div>}
    {step === 'guide' && <div className="panel"><p className="eyebrow">How it works</p><h1 tabIndex={-1}>Towers</h1><QuickRules rules={['Move only the top disk of a tower.', 'Select its tower, then the destination tower.', 'Match the target board within two minutes. Aim to use few moves.']} note={'Undo reverses a move. Clear All resets the board; the clock keeps running.'}/><div className="actions"><button onClick={() => goStep('check')}>Continue</button></div><details className="start-options"><summary>Examples and saved results</summary><div className="actions"><button className="secondary" onClick={() => goStep('example')}>See an example</button><button className="secondary" onClick={() => void loadHistory()}>Saved results</button>{skipAvailable&&<button className="secondary" onClick={()=>{void skipTutorial()}}>Skip instructions</button>}</div></details><AssessmentUsageNotice /></div>}
    {step === 'example' && <div className="panel"><h1 tabIndex={-1}>Try one move</h1>
      <p>This untimed example is separate from your scored puzzle. Disks are listed from bottom to top.</p>
      <div className="towers-example"><span>{exampleMoved ? 'Tower 1: Gold, Leaf' :
        'Tower 1: Gold, Leaf, Cobalt'}</span>
        <span>{exampleMoved ? 'Tower 2: Cobalt' : 'Tower 2: empty'}</span><span>Tower 3: empty</span></div>
      <button onClick={() => setExampleMoved(!exampleMoved)}>Move the top disk</button>
      <button onClick={() => goStep('check')}>Next</button></div>}
    {step === 'check' && <div className="panel"><h1 tabIndex={-1}>Check the rule</h1>
      <p>Which disk can you move from a tower?</p>
      <label><input type="radio" name="towers-rule" value="top" checked={quiz === 'top'}
        onChange={() => setQuiz('top')} /> Only the top disk</label>
      <label><input type="radio" name="towers-rule" value="any" checked={quiz === 'any'}
        onChange={() => setQuiz('any')} /> Any disk</label>
      <button disabled={!quiz} onClick={() => {if(quiz==='top'){skipSource.current=null;goStep('ready')}else setError('Only the top disk can move. Try again.')}}>Check answer</button></div>}
    {step === 'ready' && <div className="panel"><h1 tabIndex={-1}>Ready?</h1>
      <p>The two-minute clock starts when the board appears. Your result is saved in this browser.</p>
      {preferredForm.current && <p>Restart will use the familiar {preferredForm.current} puzzle in a new attempt.</p>}
      <button disabled={!store || busy || runtime.unsettled || pendingStart || !!intentRequest.current}
        onClick={() => void begin()}>Start</button>
      {pendingStart && <button disabled={busy} onClick={() => void retryStart()}>Check saved start</button>}
      {intentRequest.current && <button disabled={busy} onClick={() => void retryIntent()}>Check board preparation</button>}
      <button className="secondary" disabled={pendingStart || !!intentRequest.current || !!attempt.current}
        onClick={() => void loadHistory()}>History</button></div>}
    {step === 'play' && form && activeBoard && <div className="panel towers-play" ref={playBoard}>
      <div className="towers-top"><h1 ref={playTitle} tabIndex={-1}>Match the target</h1>
        <strong aria-label={`Time remaining ${mmss(msLeft)}`}>{mmss(msLeft)}</strong></div>
      {mock && run && <p>Local form {run.formId}. This label identifies the saved puzzle form.</p>}
      {run?.familiar && <p>Familiar puzzle · {run.formId}</p>}
      <p>Target</p><BoardView board={form.target} form={form} target />
      <p>Your board</p><BoardView board={activeBoard} form={form} selected={selected}
        disabled={busy || pending || !!displayRevoked.current || run?.status !== 'active'}
        onTower={tower} admitClick={admitClick} onActivationKey={onActivationKey} />
      <details className="towers-key-controls">
        <summary>Keyboard source and destination controls</summary>
        <p>Choose source, then destination. Escape cancels selection.</p>
        {[0, 1, 2].map(i => <button key={`s${i}`} disabled={selected !== null ||
          !activeBoard[i].length || busy || pending || !!displayRevoked.current ||
          run?.status !== 'active'} onKeyDown={onActivationKey}
          onClick={event => { const source = admitClick(event); if (source) tower(i, source) }}>Source {i + 1}</button>)}
        {[0, 1, 2].map(i => <button key={`d${i}`} disabled={selected === null || busy || pending ||
          !!displayRevoked.current || run?.status !== 'active'} onKeyDown={onActivationKey}
          onClick={event => { const source = admitClick(event); if (source) tower(i, source) }}>Destination {i + 1}</button>)}
      </details>
      <div className="towers-actions"><button disabled={selected === null} onClick={clearSelection}>Cancel selection</button>
        <button disabled={!state?.undoStack.length || busy || pending || !!displayRevoked.current}
          onKeyDown={onActivationKey} onClick={event => { if (admitClick(event))
            void act('undo', { refActionId: state!.undoStack.at(-1)!.actionId }) }}>Undo</button>
        <button disabled={busy || pending || !!displayRevoked.current}
          onKeyDown={onActivationKey} onClick={event => { if (admitClick(event)) void act('reset') }}>Clear All</button>
        <button disabled={busy || pending || !!displayRevoked.current}
          onKeyDown={onActivationKey} onClick={event => { if (admitClick(event)) setConfirmRestart(true) }}>Restart</button></div>
      {confirmRestart && <div className="panel"><p>End this attempt and start again from the guide?</p>
        <button onClick={() => setConfirmRestart(false)}>Cancel</button>
        <button onClick={() => { setConfirmRestart(false); void endAttempt('restart') }}>Restart</button></div>}
      {pending && <button disabled={busy} onClick={() => void retrySave()}>Check saved move and retry</button>}
      {pendingOnsetResolution.current && <button disabled={busy}
        onClick={() => void retryOnsetResolution()}>Check saved board outcome</button>}
      <p role="status" aria-live="polite">{announcement}</p>
      <p className="note">{LIMIT}</p></div>}
    {step === 'completion' && run && form && <div className="panel"><h1 tabIndex={-1}>
      {run.status === 'complete' ? 'Puzzle complete' : 'Time is up'}</h1>
      <p>{run.status === 'complete' ? 'Your saved puzzle is ready to review.' : 'This attempt is saved as incomplete.'}</p>
      <button onClick={() => void openReport(run)}>Next</button></div>}
    {step === 'report' && report && run && <div className="panel"><h1 ref={reportTitle} tabIndex={-1}>Towers report</h1>
      <p role="status"><strong>{report.status === 'solved' ? 'Solved and saved' : 'Incomplete or review-only attempt'}.</strong></p>
      {report.status === 'solved' ? <ReportSummary feedback={towersFeedback(report)} /> : <p>You made {report.movesMade} moves before this attempt ended. The puzzle was not solved.</p>}
      {report.interruptionReason && <p>Interruption: {report.interruptionReason}</p>}
      <details><summary>Detailed numbers</summary><p>{comparison}</p><p>Moves: {report.movesMade}</p>
      <p>Fewest moves for this form: {report.optimalMoves}</p>
      {report.excessMoves !== null && <p>Moves above the minimum: {report.excessMoves}</p>}
      <p>Time before first move: {report.planningMs === null ? 'Unavailable' : mmss(report.planningMs)}</p>
      <p>Time to solve: {report.solutionMs === null ? 'Unavailable' : mmss(report.solutionMs)}</p>
      {report.solutionMs === null && report.timeUsedMs !== null &&
        <p>Time used: {mmss(report.timeUsedMs)} (this is not a solve time)</p>}
      <p>Undo: {report.undoCount} · Clear All: {report.resetCount}</p><p>{LIMIT}</p>
      <p>Form: {report.formId} · Input used: {report.inputSources.length ?
        report.inputSources.join(', ') : 'no placements recorded'}</p>
      {run.familiar && <p>Familiar puzzle</p>}
      </details>
      <p className="note">Browser controls include text, patterns and keyboard choices.</p>
      {mockError && <p role="alert">{mockError}</p>}{mockReady && mock && <button data-mock-return-intent onClick={() => void mock.continue().catch(cause => setMockError(message(cause)))}>Continue mock</button>}
      {reportTarget?<button onClick={onLibrary}>Return to mock</button>:<><button onClick={() => { void (mock?mock.retry():Promise.resolve()).then(()=>{token.current++;putRun(null);setReport(null);putForm(null);
        preferredForm.current=null;setError('');goStep('guide')}).catch(cause=>setMockError(message(cause))) }}>Try Again</button>
      <button className="secondary" onClick={() => void loadHistory()}>History</button></>}</div>}
    {step === 'history' && <div className="panel"><h1 ref={historyTitle} tabIndex={-1}>Towers history</h1>
      {history.length === 0 ? <p>No saved attempts to review.</p> : <ul>{history.map(item =>
        <li key={item.run.id}><p>{item.run.formId}{item.run.familiar ? ' · Familiar' : ''} · {item.report?.status ??
          (item.run.presentation === 'unseen' ? 'Pending start' : 'Unfinished review')} · {new Date(item.run.wallMs).toLocaleString()}</p>
          {item.run.exposureReview && <p>{item.run.exposureReview.reason} Timing unavailable; no scored result was created.</p>}
          {item.report && <button onClick={() => void openReport(item.run)}>
            {item.run.status === 'complete' ? 'Open report' : 'Open review'}</button>}
          <button onClick={() => void erase(item.run.id)}>Delete attempt</button></li>)}</ul>}
      <button onClick={() => { mock?.retireReturnIntent();setError(''); goStep('guide') }}>Practice again</button>
      <button className="secondary" onClick={() => setConfirmAll(true)}>Delete all Towers data</button>
      {confirmAll && <div className="panel"><p>Delete every Towers attempt and report in this browser?</p>
        <button onClick={() => setConfirmAll(false)}>Cancel</button>
        <button onClick={() => void eraseAll()}>Delete all</button></div>}</div>}
  </section></Shell>
}
