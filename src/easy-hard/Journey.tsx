import { QuickRules } from '../onboarding/QuickRules'
import { ReportSummary } from '../reports/Summary'
import { easyHardFeedback } from '../reports/feedback'
import { AssessmentUsageNotice } from '../assessment-usage/Notice'
/* oxlint-disable react/immutability, react/purity, react-hooks/exhaustive-deps */
import { Attempt } from '../assessment-usage/client'
import { useEffect, useRef, useState } from 'react'
import type { MouseEvent, KeyboardEvent } from 'react'
import { flushSync } from 'react-dom'
import { Shell } from '../core/Shell'
import { loadForms } from './forms'
import type { Choice, Form } from './forms'
import { choice, due, materialClockDivergence, nextOfferIndex, onset, phaseOf, press, taskOnset } from './engine'
import type { PendingEvent } from './engine'
import { GAME_MS } from './report'
import type { Report } from './report'
import { acquireEasyHardOwner, EasyHardStore, withEasyHardDataOrder } from './storage'
import type { Run } from './storage'
import type { MockJourneyContext } from '../mock/journey-context'
import type { ReportTarget } from '../mock/report-route'
import { withVerifiedReportPublication } from '../mock/report-route'
import './easy-hard.css'

type Step = 'guide' | 'example' | 'check' | 'ready' | 'play' | 'completion' | 'report' | 'history'
type Surface = 'checking' | 'choice' | 'task' | 'feedback' | 'uncertain'
type Saved = { run: Run; report: Report | null }
function compareEasyHard(rows:readonly Saved[],current:Run){
  const retained=rows.find(row=>row.run.id===current.id)
  if(current.status!=='complete'||retained?.report?.status!=='complete')return 'No comparable earlier run is currently verified.'
  const previous=rows.filter(item=>item.run.id!==current.id&&item.run.createdAtWallMs<current.createdAtWallMs&&item.run.status==='complete'&&item.report?.status==='complete'&&item.run.formId===current.formId).sort((a,b)=>b.run.createdAtWallMs-a.run.createdAtWallMs)[0]
  return previous?.report?`Previous saved run on this same form completed ${previous.report.completedOnTime} of ${previous.report.attempts} tasks on time and collected ${dollars(previous.report.earnedCents)}; this run completed ${rows.find(row=>row.run.id===current.id)?.report?.completedOnTime??0} tasks on time.`:'No comparable earlier run is currently verified.'
}
const LIMIT = 'This is an original practice form. Earnings describe this run only; they do not predict hiring outcomes or reproduce a provider score.'
const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`
const rate = (part: number, whole: number) => whole ? `${Math.round(100 * part / whole)}%` : 'insufficient evidence'
const duration = (ms: number) => {
  const seconds = Math.floor(ms / 1000)
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}
const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
function confirmedFrames() {
  let timer = 0
  return Promise.race([frame().then(frame), new Promise<never>((_resolve, reject) => {
    timer = window.setTimeout(() => reject(Error('Visible onset was not confirmed')), 500)
  })]).finally(() => window.clearTimeout(timer))
}
function errorText(reason: unknown) { return reason instanceof Error ? reason.message : 'Local save could not be confirmed.' }
function delivered<T>(promise: Promise<T>, abort: AbortController): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => { abort.abort(); reject(Error('Save delivery unconfirmed')) }, 2500)
    promise.then(value => { window.clearTimeout(timer); resolve(value) }, reason => {
      window.clearTimeout(timer); reject(reason)
    })
  })
}
function inMs(performanceAnchor: number) {
  return Math.max(0, Math.floor(performance.now() - performanceAnchor))
}

export function EasyHardJourney({ onLibrary, mock, reportTarget }: { onLibrary: () => void; mock?: MockJourneyContext; reportTarget?: ReportTarget }) {
  const usage = useRef(new Attempt('easy_hard'))
  useEffect(() => { const current=usage.current; return () => current.cancel() }, [])
  const [step, setStep] = useState<Step>('guide')
  const [surface, setSurface] = useState<Surface>('checking')
  const [error, setError] = useState('')
  const [store, setStore] = useState<EasyHardStore | null>(null)
  const [run, setRun] = useState<Run | null>(null)
  const [form, setForm] = useState<Form | null>(null)
  const [report, setReport] = useState<Report | null>(null)
  const [comparison,setComparison]=useState('No comparable earlier run is currently verified.')
  const [mockReady, setMockReady] = useState(false), [mockError, setMockError] = useState('')
  const mockTerminalSeen = useRef<string | null>(null)
  const [history, setHistory] = useState<Saved[]>([])
  const [preview, setPreview] = useState<'choice' | 'task' | null>(null)
  const [quiz, setQuiz] = useState({ easy: '', payout: '' })
  const [skipAvailable, setSkipAvailable] = useState(false)
  const skipSource=useRef<string|null>(null)
  const skipChecking=useRef(false)
  const introStep=useRef(step)
  introStep.current=step
  const [now, setNow] = useState(0)
  const [confirmAll, setConfirmAll] = useState(false)
  const [uncertainStart, setUncertainStart] = useState(false)
  const [selectedChoice, setSelectedChoice] = useState<Choice | null>(null)
  const [soundCues, setSoundCues] = useState(false)
  const [reduceMotion, setReduceMotion] = useState(mock?.preferences.reducedMotion ?? false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const openedReportTarget=useRef<string|null>(null)
  useEffect(()=>{if(!store||!reportTarget||openedReportTarget.current===reportTarget.attemptId)return;openedReportTarget.current=reportTarget.attemptId;void openSaved(reportTarget.attemptId)},[store,reportTarget])
  const docId = useRef(crypto.randomUUID())
  const storeRef = useRef<EasyHardStore | null>(null)
  const runRef = useRef<Run | null>(null)
  const formRef = useRef<Form | null>(null)
  const anchor = useRef<number | null>(null)
  const ownerAbort = useRef<AbortController | null>(null)
  const releaseOwner = useRef<(() => void) | null>(null)
  const nav = useRef(0)
  function moveIntroStep(next:Step){nav.current++;introStep.current=next;setStep(next)}
  useEffect(()=>{
    if(!store||step!=='guide')return
    let active=true,pending=false
    const check=()=>{if(pending||document.hidden||!document.hasFocus())return;pending=true;void withEasyHardDataOrder(()=>checkedList(store)).then(rows=>{
      if(active)setSkipAvailable(rows.some(item=>item.run.status==='complete'&&item.report?.status==='complete'))
    }).catch(()=>{if(active)setSkipAvailable(false)}).finally(()=>{pending=false})}
    check();const timer=window.setInterval(check,1000)
    return()=>{active=false;window.clearInterval(timer)}
  },[store,step])
  async function skipTutorial(){
    if(!store)return
    const ticket=nav.current
    try{
      const rows=await withEasyHardDataOrder(()=>checkedList(store))
      if(ticket!==nav.current||introStep.current!=='guide')return
      const source=rows.find(item=>item.run.status==='complete'&&item.report?.status==='complete')
      if(!source){
        setSkipAvailable(false);setError('A current completed Easy or Hard run is no longer saved. Check the rules instead.');return
      }
      skipSource.current=source.run.id
      moveIntroStep('ready')
    }catch{if(ticket===nav.current){setSkipAvailable(false);setError('Saved Easy or Hard history could not be checked. Use the rule check instead.')}}
  }
  const serial = useRef<Promise<void>>(Promise.resolve())
  const keyDown = useRef(false)
  const pendingNative = useRef(new Set<string>())
  const onsetPending = useRef(false)
  const timerQueued = useRef(false)
  const closing = useRef(false)
  const lifecycleQueued = useRef(false)
  const authorityPollQueued = useRef(false)
  const reportId = useRef<string | null>(null)
  const completionOpening = useRef(false)
  const choiceTitle = useRef<HTMLHeadingElement>(null)
  const taskTitle = useRef<HTMLHeadingElement>(null)
  const feedbackTitle = useRef<HTMLHeadingElement>(null)
  const taskHost = useRef<HTMLDivElement>(null)

  function setCurrent(value: Run | null) { runRef.current = value; setRun(value) }
  function cue() {
    if (!soundCues) return
    try {
      const context = new AudioContext()
      const oscillator = context.createOscillator(), gain = context.createGain()
      oscillator.frequency.value = 660; gain.gain.value = 0.035
      oscillator.connect(gain); gain.connect(context.destination)
      oscillator.start(); oscillator.stop(context.currentTime + 0.08)
      oscillator.onended = () => { void context.close() }
    } catch { /* Visual feedback and text remain authoritative. */ }
  }
  function release() { releaseOwner.current?.(); releaseOwner.current = null
    ownerAbort.current?.abort(); ownerAbort.current = null; keyDown.current = false
    pendingNative.current.clear() }
  function current(ticket: number) { return ticket === nav.current && !!releaseOwner.current &&
    !ownerAbort.current?.signal.aborted }
  function enqueue(fn: () => Promise<void>) {
    serial.current = serial.current.catch(() => undefined).then(fn).catch(reason => {
      ++nav.current; release()
      setError(errorText(reason)); setSurface('uncertain')
    })
  }
  async function checkedInspect(selected: EasyHardStore, id: string) {
    const abort = new AbortController()
    return delivered(selected.inspect(id, abort.signal), abort)
  }
  async function checkedRoot(selected: EasyHardStore) {
    const abort = new AbortController()
    return delivered(selected.read(abort.signal), abort)
  }
  async function confirmActivity(selected: EasyHardStore, id: string,
    kind: 'report_viewed' | 'history_viewed', runId?: string) {
    const abort = new AbortController()
    try { await delivered(runId ? selected.view(runId, id, kind, abort.signal) :
      selected.viewHistory(id, abort.signal), abort) }
    catch { /* Verify exact activity identity after uncertain delivery. */ }
    const root = await checkedRoot(selected)
    if (!root.activity[runId ?? 'installation']?.some(item => item.id === id && item.kind === kind))
      throw Error('History or report view save was not confirmed')
  }
  async function checkedList(selected: EasyHardStore) {
    const abort = new AbortController()
    return delivered(selected.list(abort.signal), abort)
  }
  async function appendLocked(event: PendingEvent, ticket: number,
    onsetWallMs?: number, publish?: () => void) {
    const selected = storeRef.current, before = runRef.current
    if (!selected || !before || !current(ticket)) throw Error('Attempt ownership changed')
    const id = crypto.randomUUID()
    const request = { id, runId: before.id, documentId: docId.current,
      epoch: before.epoch, revision: before.revision, event, onsetWallMs }
    if (!current(ticket)) throw Error('Attempt ownership changed')
    const first = await checkedInspect(selected, before.id)
    if (first.run.revision !== before.revision || first.run.documentId !== docId.current)
      throw Error('Attempt authority changed')
    const abort = new AbortController()
    try { await delivered(selected.append(request, abort.signal), abort) }
    catch { /* An undelivered commit is decided only by authoritative readback. */ }
    const after = await checkedInspect(selected, before.id)
    if (after.root.requests[id]?.runId !== before.id ||
      after.run.events.length !== before.events.length + 1 ||
      after.run.events.at(-1)?.kind !== event.kind || !current(ticket))
      throw Error('Action save was not confirmed. Review local history before continuing.')
    flushSync(() => {
      setCurrent(after.run); setReport(after.report); setError(''); publish?.()
    })
    return after
  }
  async function append(event: PendingEvent, ticket: number,
    onsetWallMs?: number, publish?: () => void) {
    return withEasyHardDataOrder(() => appendLocked(event, ticket, onsetWallMs, publish))
  }
  async function publishReport(ticket: number) {
    if (completionOpening.current) return
    completionOpening.current = true
    try { await openCompletedReport(ticket)
      const id = runRef.current?.id
      if (mock && id && ticket === nav.current && mockTerminalSeen.current !== id) {
        mockTerminalSeen.current = id
        try { const status = await mock.terminal(); setMockReady(status === 'ready'); if (status === 'review_only') setMockError('This attempt needs review. Return to mock to try again or skip this game.') }
        catch (cause) { mockTerminalSeen.current = null; setMockError(errorText(cause)) }
      }
    }
    catch {
      if (ticket === nav.current) {
        flushSync(() => { setCurrent(null); setReport(null); setHistory([])
          setStep('history'); setError('The saved result could not be verified. Check local history.') })
        ++nav.current
      }
    }
    finally { completionOpening.current = false }
  }
  async function openCompletedReport(ticket: number) {
    const selected = storeRef.current, target = runRef.current
    if (!selected || !target || ticket !== nav.current) return
    await withEasyHardDataOrder(async () => {
      const checked = await checkedInspect(selected, target.id)
      if (ticket !== nav.current || !checked.report || checked.run.status !== 'complete') return
      const id = reportId.current ?? crypto.randomUUID()
      reportId.current = id
      await confirmActivity(selected, id, 'report_viewed', target.id)
      const again = await checkedInspect(selected, target.id)
      if (ticket !== nav.current || again.run.status !== 'complete') return
      const rows=await checkedList(selected)
      if(ticket!==nav.current)return
      flushSync(() => { setCurrent(again.run); setReport(again.report);setComparison(compareEasyHard(rows,again.run)); setStep('report') })
      release()
    })
  }
  async function publishCompletion(ticket: number) {
    const selected = storeRef.current, target = runRef.current
    if (!selected || !target || ticket !== nav.current) return
    await withEasyHardDataOrder(async () => {
      const checked = await checkedInspect(selected, target.id)
      if (ticket !== nav.current || checked.run.status !== 'complete' ||
        checked.report?.status !== 'complete' || !checked.run.snapshot) return
      flushSync(() => { setCurrent(checked.run); setReport(checked.report); setStep('completion') })
      release()
      const r=checked.report
      usage.current.finish(checked.run.id,'completed',()=>({attempts:r.attempts,completed:r.completedOnTime,hard_choices:r.hardChoices,easy_choices:r.easyChoices,earned_cents:r.earnedCents}))
    })
  }
  async function interruptUncertainClock(ticket: number): Promise<boolean> {
    const target = runRef.current
    if (!target || target.status === 'complete' || !current(ticket) ||
      anchor.current === null || !target.events.length) return false
    const elapsed = inMs(anchor.current)
    if (!materialClockDivergence(Date.now(), target.wallAnchorMs, elapsed)) return false
    await append({ kind: 'run_interrupted', phase: 'interrupted',
      elapsedMs: Math.max(target.events.at(-1)!.elapsedMs, Math.min(GAME_MS, elapsed)),
      inputSource: 'system', reason: 'material wall and monotonic clock divergence' },
    ticket, undefined, () => setSurface('uncertain'))
    release()
    return true
  }
  async function showOnset(kind: 'choice' | 'task', ticket: number) {
    const selected = storeRef.current, target = runRef.current, fixed = formRef.current
    if (!selected || !target || !fixed || !current(ticket) || onsetPending.current) return
    onsetPending.current = true
    try {
      await withEasyHardDataOrder(async () => {
        const checked = await checkedInspect(selected, target.id)
        if (!current(ticket) || checked.run.revision !== target.revision) throw Error('Attempt authority changed')
        keyDown.current = false
        flushSync(() => { setPreview(kind); setSurface('checking') })
        await confirmedFrames()
        if (!current(ticket) || document.visibilityState !== 'visible') throw Error('Visible onset unavailable')
        const host = kind === 'choice' ? choiceTitle.current : taskTitle.current
        if (!host || !host.getClientRects().length || getComputedStyle(host).visibility !== 'visible')
          throw Error('Visible onset unavailable')
        const atPerf = performance.now(), atWall = Date.now()
        if (kind === 'choice' && anchor.current === null) anchor.current = atPerf
        const elapsed = inMs(anchor.current!)
        if (elapsed >= GAME_MS) { setPreview(null); return }
        const event = kind === 'choice' ? onset(fixed, target.events, elapsed) :
          taskOnset(fixed, target.events, elapsed)
        await appendLocked(event, ticket, target.status === 'reserved' ? atWall : undefined,
          () => { setPreview(null); setSelectedChoice(null); setSurface(kind) })
      })
      if (anchor.current !== null && inMs(anchor.current) >= GAME_MS &&
        phaseOf(runRef.current?.events ?? []) === 'offer') { await settle(ticket); return }
      if (kind === 'task') taskHost.current?.focus()
      else choiceTitle.current?.focus()
    } finally { onsetPending.current = false }
  }
  async function settle(ticket: number) {
    if (!current(ticket) || !formRef.current || !runRef.current || anchor.current === null ||
      pendingNative.current.size > 0) return
    if (await interruptUncertainClock(ticket)) return
    let attempts = 0
    while (current(ticket) && attempts++ < 4) {
      const before = runRef.current!
      if (before.status === 'complete') { await publishCompletion(ticket); return }
      const event = due(formRef.current!, before.events, inMs(anchor.current), crypto.randomUUID())
      if (!event) {
        if (phaseOf(before.events) === 'selected' && !onsetPending.current)
          await showOnset('task', ticket)
        else if (phaseOf(before.events) === 'offer' && before.events.length > 0 && !onsetPending.current)
          await showOnset('choice', ticket)
        return
      }
      await append(event, ticket, undefined, () => {
        if (event.kind === 'task_resolved') { keyDown.current = false; setSurface('feedback'); cue() }
        if (event.kind === 'choice_selected' || event.kind === 'feedback_end') setSurface('checking')
      })
      if (event.kind === 'task_resolved') feedbackTitle.current?.focus()
    }
  }
  async function start() {
    const selected = storeRef.current
    if (!selected || releaseOwner.current || skipChecking.current) return
    if(skipSource.current){const sourceId=skipSource.current,ticket=nav.current;skipChecking.current=true
      try{const rows=await withEasyHardDataOrder(()=>checkedList(selected))
        if(ticket!==nav.current||introStep.current!=='ready'||storeRef.current!==selected)return
        if(!rows.some(item=>item.run.id===sourceId&&item.run.status==='complete'&&item.report?.status==='complete')){
          skipSource.current=null;setSkipAvailable(false);setQuiz({easy:'',payout:''});setError('The completed run used to skip the guide was deleted or changed. Check the rules to continue.');moveIntroStep('check');return
        }
        skipSource.current=null
      }catch{if(ticket===nav.current){setQuiz({easy:'',payout:''});setError('The completed run used to skip the guide could not be checked. Check the rules to continue.');moveIntroStep('check')}return}
      finally{skipChecking.current=false}
    }
    usage.current.begin(mock?'mock':'practice')
    const ticket = ++nav.current, abort = new AbortController()
    ownerAbort.current = abort
    lifecycleQueued.current = false
    anchor.current = null; formRef.current = null; reportId.current = null
    setCurrent(null); setForm(null); setReport(null); setPreview(null); setSelectedChoice(null); setNow(0)
    setError(''); setSurface('checking')
    try {
      let prepared: { leave: () => void; id: string; runId: string; wallMs: number } | null = null
      const lost = () => {
          if (ticket === nav.current) { ++nav.current; release()
            setError('Exclusive play ownership was lost.'); setSurface('uncertain') }
        }
      if (mock) {
        const leave = await acquireEasyHardOwner(lost, abort.signal)
        const id = crypto.randomUUID(), runId = crypto.randomUUID(), wallMs = Date.now()
        prepared = { leave, id, runId, wallMs }; releaseOwner.current = leave
        await mock.beforeArm({ requestId: id, attemptId: runId, originTicketId: null,
          installationId: selected.installationId, generation: null, requestKind: 'start', nativeIdentity: [] })
        if(ticket!==nav.current || abort.signal.aborted)throw Error('Start was canceled')
      }
      await withEasyHardDataOrder(async () => {
        const leave = prepared?.leave ?? await acquireEasyHardOwner(lost, abort.signal)
        if (ticket !== nav.current || abort.signal.aborted) { leave(); return }
        releaseOwner.current = leave
        const id = prepared?.id ?? crypto.randomUUID(), runId = prepared?.runId ?? crypto.randomUUID()
        const wallMs = prepared?.wallMs ?? Date.now()
        const saveAbort = new AbortController()
        try { await delivered(selected.start({ id, runId, documentId: docId.current,
          wallMs, wallAnchorMs: wallMs, soundCues, reducedMotion: reduceMotion }, saveAbort.signal), saveAbort) }
        catch { /* Verify an uncertain reservation against the exact request. */ }
        const root = await checkedRoot(selected)
        const reserved = root.runs[runId]
        if (ticket !== nav.current || !reserved || root.requests[id]?.runId !== runId) {
          leave(); releaseOwner.current = null; throw Error('Start was not confirmed')
        }
        const forms = await loadForms()
        const fixed = forms.get(reserved.formId)!.form
        usage.current.admit(reserved.id)
        formRef.current = fixed; setForm(fixed)
        flushSync(() => { setCurrent(reserved); setStep('play') })
      })
      if (current(ticket)) await showOnset('choice', ticket)
    } catch (reason) {
      release(); setError(errorText(reason)); moveIntroStep('ready')
      setUncertainStart(!errorText(reason).includes('Another Easy or Hard tab owns play'))
    }
  }
  function select(value: Choice, event: MouseEvent<HTMLButtonElement>) {
    if (!event.nativeEvent.isTrusted || !runRef.current || anchor.current === null || closing.current) return
    const at = inMs(anchor.current), ticket = nav.current
    const actionId = crypto.randomUUID()
    pendingNative.current.add(actionId)
    const native = event.nativeEvent
    const source = event.detail === 0 ? 'keyboard' :
      native instanceof PointerEvent && native.pointerType === 'touch' ? 'touch' : 'pointer'
    enqueue(async () => {
      let confirmed = false
      try {
        if (!current(ticket) || surface !== 'choice' || !formRef.current) return
        if (await interruptUncertainClock(ticket)) return
        let selected: PendingEvent
        try { selected = choice(runRef.current!.events, value, at, source, actionId) }
        catch { return } // A late native action is ignored; the fixed deadline settles next.
        setSelectedChoice(value); setSurface('checking')
        await append(selected, ticket)
        confirmed = true
      } finally {
        pendingNative.current.delete(actionId)
        if (confirmed && current(ticket) && pendingNative.current.size === 0) await settle(ticket)
      }
    })
  }
  function down(event: KeyboardEvent<HTMLDivElement>) {
    if (event.code !== 'Space') { keyDown.current = false; return }
    if (event.repeat || !event.nativeEvent.isTrusted ||
      event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.nativeEvent.isComposing ||
      phaseOf(runRef.current?.events ?? []) !== 'task' || surface !== 'task' ||
      document.activeElement !== taskHost.current) { keyDown.current = false; return }
    event.preventDefault(); keyDown.current = true
  }
  function up(event: KeyboardEvent<HTMLDivElement>) {
    if (event.code !== 'Space' || !event.nativeEvent.isTrusted || !keyDown.current || closing.current) return
    event.preventDefault(); keyDown.current = false
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey ||
      event.nativeEvent.isComposing || document.activeElement !== taskHost.current) return
    const at = anchor.current === null ? -1 : inMs(anchor.current), ticket = nav.current
    const actionId = crypto.randomUUID()
    pendingNative.current.add(actionId)
    enqueue(async () => {
      let confirmed = false
      try {
        if (!current(ticket) || !runRef.current || phaseOf(runRef.current.events) !== 'task') return
        if (await interruptUncertainClock(ticket)) return
        let accepted: PendingEvent
        try { accepted = press(runRef.current.events, at, actionId) }
        catch { return }
        await append(accepted, ticket)
        confirmed = true
      } finally {
        pendingNative.current.delete(actionId)
        if (confirmed && current(ticket) && pendingNative.current.size === 0) await settle(ticket)
      }
    })
  }
  async function refreshHistory() {
    mock?.retireReturnIntent()
    const selected = storeRef.current, ticket = ++nav.current
    release(); setSurface('checking'); setError('')
    if (!selected) return
    try {
      await withEasyHardDataOrder(async () => {
        await confirmActivity(selected, crypto.randomUUID(), 'history_viewed')
        const rows = await checkedList(selected)
        if (ticket === nav.current) flushSync(() => {
          setUncertainStart(false)
          setCurrent(null); setReport(null); setHistory(rows); setStep('history')
        })
      })
    } catch (reason) { if (ticket === nav.current) setError(errorText(reason)) }
  }
  async function openSaved(id: string) {
    mock?.retireReturnIntent()
    const selected = storeRef.current, ticket = ++nav.current
    if (!selected) return
    try {
      const publish=async (permit=()=>{}) => {
        if(reportTarget&&selected.installationId!==reportTarget.reference.installationId)throw Error('Easy or Hard installation changed')
        const first = await checkedInspect(selected, id)
        if (!first.report) throw Error('No saved scored events')
        await confirmActivity(selected, crypto.randomUUID(), 'report_viewed', id)
        const again = await checkedInspect(selected, id)
        permit()
        if (ticket === nav.current) flushSync(() => {
          setCurrent(again.run); setReport(again.report); setStep('report')
        })
      }
      if(reportTarget)await withVerifiedReportPublication(reportTarget,publish)
      else await withEasyHardDataOrder(()=>publish())
    } catch (reason) { if (ticket === nav.current) setError(errorText(reason)) }
  }
  async function deleteOne(id: string) {
    mock?.retireReturnIntent()
    const selected = storeRef.current
    if (!selected) return
    try {
      const abort = new AbortController()
      try { await delivered(selected.delete(id, abort.signal), abort) }
      catch { /* Check whether deletion committed despite lost delivery. */ }
      const root = await checkedRoot(selected)
      if (root.runs[id] || !root.tombstones[id]) throw Error('Deletion was not confirmed')
      setDeleteTarget(null); await refreshHistory()
    }
    catch (reason) { setError(errorText(reason)) }
  }
  async function deleteAll() {
    mock?.retireReturnIntent()
    const selected = storeRef.current
    if (!selected) return
    try {
      const abort = new AbortController()
      try { await delivered(selected.deleteAll(abort.signal), abort) }
      catch { /* Replacement identity below decides uncertain delivery. */ }
      const replacement = await (mock||reportTarget?EasyHardStore.openForMock(undefined,!reportTarget):EasyHardStore.open())
      if (replacement.installationId === selected.installationId) {
        replacement.close(); throw Error('Delete all was not confirmed')
      }
      setConfirmAll(false); setCurrent(null); setReport(null)
      if (storeRef.current === selected) {
        storeRef.current = replacement; setStore(replacement); selected.close()
      } else replacement.close()
      await refreshHistory() }
    catch (reason) { setError(errorText(reason)) }
  }
  async function leave() {
    if (closing.current) return
    closing.current = true
    await serial.current.catch(() => undefined)
    const target = runRef.current, selected = storeRef.current
    if (target && selected && target.status === 'active') {
      try {
        setSurface('checking')
        await withEasyHardDataOrder(async () => {
          const checked = await checkedInspect(selected, target.id)
          if (checked.run.status !== 'active' || checked.run.documentId !== docId.current) return
          const elapsed = Math.min(GAME_MS, anchor.current === null ? 0 : inMs(anchor.current))
          const event: PendingEvent = { kind: 'run_exited', phase: 'interrupted',
            elapsedMs: Math.max(elapsed, checked.run.events.at(-1)?.elapsedMs ?? 0),
            inputSource: 'system', reason: 'left before completion' }
          const id = crypto.randomUUID(), abort = new AbortController()
          try { await delivered(selected.append({ id, runId: target.id,
            documentId: docId.current, epoch: checked.run.epoch, revision: checked.run.revision,
            event }, abort.signal), abort) }
          catch { /* Verify uncertain delivery. */ }
          const after = await checkedInspect(selected, target.id)
          if (after.root.requests[id]?.runId !== target.id || after.run.status !== 'interrupted')
            throw Error('Exit save unconfirmed. Check local history before leaving.')
        })
      } catch (reason) { closing.current = false; setError(errorText(reason)); setSurface('uncertain'); return }
    }
    ++nav.current; release(); setCurrent(null); setReport(null); onLibrary()
  }

  useEffect(() => {
    let alive = true
    void (mock||reportTarget?EasyHardStore.openForMock(undefined,!reportTarget):EasyHardStore.open()).then(opened => { if (alive) { storeRef.current = opened; setStore(opened) }
      else opened.close() }, reason => { if (alive) setError(errorText(reason)) })
    return () => { mock?.retireReturnIntent();alive = false; ++nav.current; release(); storeRef.current?.close() }
  }, [])
  useEffect(() => {
    if (step !== 'play' || surface === 'uncertain') return
    const timer = window.setInterval(() => {
      if (anchor.current === null || closing.current) return
      setNow(inMs(anchor.current))
      if (timerQueued.current) return
      timerQueued.current = true
      const ticket = nav.current
      enqueue(async () => { try { if (current(ticket)) await settle(ticket) }
        finally { timerQueued.current = false } })
    }, 100)
    return () => window.clearInterval(timer)
  }, [step, surface])
  useEffect(() => {
    const stopForLifecycle = (reason: string) => {
      if (step !== 'play' || lifecycleQueued.current) return
      lifecycleQueued.current = true
      const ticket = nav.current
      enqueue(async () => {
        const target = runRef.current, selected = storeRef.current
        if (!target || !selected || !current(ticket) || target.status === 'complete') return
        if (target.events.length === 0) { setSurface('uncertain'); release(); return }
        const elapsed = Math.min(GAME_MS, anchor.current === null ? 0 : inMs(anchor.current))
        await append({ kind: 'run_interrupted', phase: 'interrupted',
          elapsedMs: Math.max(elapsed, target.events.at(-1)?.elapsedMs ?? 0),
          inputSource: 'system', reason }, ticket, undefined, () => setSurface('uncertain'))
        release()
      })
    }
    const onHide = () => { if (document.visibilityState === 'hidden'){mock?.retireReturnIntent();stopForLifecycle('page hidden during scored play')} }
    const onPageHide = () => {mock?.retireReturnIntent();stopForLifecycle('page left during scored play')}
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', onPageHide)
    return () => { document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', onPageHide) }
  }, [step])
  useEffect(() => store?.subscribe(notice => {
    const active = runRef.current
    if (notice.type === 'replaced' || notice.type === 'deleted' && notice.runId === active?.id) {
      mock?.retireReturnIntent()
      ++nav.current; release(); setCurrent(null); setReport(null); setSurface('uncertain')
      setError('This saved attempt was deleted in another tab.'); setStep('history'); setHistory([])
      if (notice.type === 'replaced') void (mock||reportTarget?EasyHardStore.openForMock(undefined,!reportTarget):EasyHardStore.open()).then(replacement => {
        if (storeRef.current !== store) { replacement.close(); return }
        storeRef.current = replacement; setStore(replacement); store?.close()
      }).catch(() => undefined)
    } else if (notice.type === 'deleted' && step === 'history') {
      void refreshHistory()
    }
  }), [store, step])
  useEffect(() => {
    if (!store || !['play', 'completion', 'report', 'history'].includes(step)) return
    const timer = window.setInterval(() => {
      if (authorityPollQueued.current) return
      authorityPollQueued.current = true
      const selected = store, ticket = nav.current
      void withEasyHardDataOrder(async () => {
        const root = await checkedRoot(selected)
        if (ticket !== nav.current || storeRef.current !== selected) return
        const id = runRef.current?.id
        if (id && !root.runs[id]) {
          flushSync(() => { setCurrent(null); setReport(null); setHistory([])
            setError('This saved attempt was deleted.'); setStep('history') })
          release(); ++nav.current
        } else if (step === 'history') {
          const rows = await checkedList(selected)
          if (ticket === nav.current) flushSync(() => setHistory(rows))
        } else if(step==='report'&&id){
          const rows=await checkedList(selected)
          if(ticket===nav.current)setComparison(compareEasyHard(rows,root.runs[id]))
        }
      }).catch(() => {
        if (ticket === nav.current && storeRef.current === selected) {
          flushSync(() => { setCurrent(null); setReport(null); setHistory([])
            setError('Local storage changed. Reopen history to verify saved data.'); setStep('history') })
          release(); ++nav.current
          void (mock||reportTarget?EasyHardStore.openForMock(undefined,!reportTarget):EasyHardStore.open()).then(replacement => {
            if (storeRef.current !== selected) { replacement.close(); return }
            storeRef.current = replacement; setStore(replacement); selected.close()
          }).catch(() => undefined)
        }
      }).finally(() => { authorityPollQueued.current = false })
    }, 750)
    return () => window.clearInterval(timer)
  }, [store, step])

  const phase = phaseOf(run?.events ?? [])
  const last = run?.events.at(-1)
  const taskEvent = run?.events.findLast(event => event.kind === 'task_onset')
  const displayOfferIndex = preview === 'choice' && phase === 'offer' ?
    nextOfferIndex(run?.events ?? []) : last?.offerIndex ?? 1
  const currentOffer = form?.entries[displayOfferIndex - 1]
  const taskChoice = last?.choice
  const taskChance = preview === 'task' ? currentOffer?.probabilityPercent : taskEvent?.probabilityPercent
  const taskReward = preview === 'task' ? taskChoice === 'easy' ? 100 : currentOffer?.hardOfferCents :
    taskEvent?.selectedRewardCents
  const taskAutomatic = preview === 'task' ? last?.automatic : taskEvent?.automatic
  const currentRow = report?.rows.at(-1)
  const remaining = Math.max(0, GAME_MS - now)
  const activeChoice = step === 'play' &&
    ((surface === 'choice' || surface === 'checking' && selectedChoice !== null) && phase === 'choice' || preview === 'choice')
  const activeTask = step === 'play' &&
    (surface === 'task' && phase === 'task' || preview === 'task')
  const choiceTime = Math.max(0, (run?.events.findLast(event => event.kind === 'offer_onset')?.choiceDeadlineMs ?? 0) - now)
  const taskTime = Math.max(0, (run?.events.findLast(event => event.kind === 'task_onset')?.taskDeadlineMs ?? 0) - now)
  if(reportTarget&&(step!=='report'||!report||!run))return <Shell onLibrary={onLibrary}><section className="journey panel"><h1>Saved Easy or Hard report</h1><p role={error?'alert':'status'}>{error||'Checking the exact retained result…'}</p><button onClick={onLibrary}>Return to mock</button></section></Shell>
  return <Shell onLibrary={leave}><div className={`journey easy-hard-journey${reduceMotion ? ' easy-hard-reduced-motion' : ''}`}>
    <div className="journey-top"><button className="secondary" data-mock-return-intent={mock ? "" : undefined} onClick={leave}><span aria-hidden="true">← </span>{mock?'Return to mock':'Main menu'}</button><p>Easy or Hard · Practice</p></div>
    {error && <p role="alert">{error}</p>}
    {step === 'guide' && <section className="panel"><p className="eyebrow">How it works</p><h1>Easy or Hard</h1><QuickRules rules={['Choose Easy or Hard within five seconds. A task is selected for you if time runs out.', 'Easy: 5 Space presses in 3 seconds, for a possible $1. Hard: 60 presses in 12 seconds, for the amount shown.', 'Finish on time to receive the shown chance of payment. A completed task can still pay nothing.']} note={'Two minutes in total. All money is simulated. Press and release Space each time; holding it down does not count.'}/><div className="actions"><button onClick={() => moveIntroStep('check')}>Continue</button></div><details className="start-options"><summary>Examples and saved results</summary><div className="actions"><button className="secondary" onClick={() => moveIntroStep('example')}>See an example</button><button className="secondary" disabled={!store} onClick={() => void refreshHistory()}>Saved results</button>{skipAvailable&&<button className="secondary" onClick={()=>{void skipTutorial()}}>Skip instructions</button>}<p>{LIMIT}</p></div></details><AssessmentUsageNotice /></section>}
    {step === 'example' && <section className="panel"><h1>Example</h1>
      <p>Suppose the chance is 50%. Easy offers $1 after five timely Space presses. Hard offers $2.77 after sixty timely presses.</p>
      <p>A completed task can still earn $0 when its payout draw loses. This example is not scored.</p>
      <button onClick={() => moveIntroStep('check')}>Check the rules</button></section>}
    {step === 'check' && <section className="panel"><h1>Check the rules</h1>
      <fieldset><legend>Which statement gets both rules right?</legend>
        <label><input type="radio" name="easy-hard-rule" checked={quiz.easy === '5'} onChange={() => setQuiz({easy:'5',payout:'no'})} /> Easy needs five presses; finishing on time gives the shown chance of payment.</label>
        <label><input type="radio" name="easy-hard-rule" checked={quiz.easy === '60'} onChange={() => setQuiz({easy:'60',payout:'yes'})} /> Easy needs sixty presses; finishing on time guarantees payment.</label></fieldset>
      <button onClick={() => {if(quiz.easy==='5'&&quiz.payout==='no'){skipSource.current=null;setError('');moveIntroStep('ready')}else setError('Easy needs five presses; finishing only gives a chance of payment. Try again.')}}>Check answers</button></section>}
    {step === 'ready' && <section className="panel"><h1>Ready?</h1>
      <p>Select Start. The two-minute clock begins when the first offer appears. Keep this tab visible and your keyboard ready.</p>
      <p>Input: physical Space key for the standard task. Timed repeated pressing may not be usable with every assistive device.</p>
      <label><input type="checkbox" checked={soundCues} onChange={event => {nav.current++;setSoundCues(event.target.checked)}} /> Optional sound on task feedback</label>
      <label><input type="checkbox" checked={reduceMotion} onChange={event => {nav.current++;setReduceMotion(event.target.checked)}} /> Reduce bar motion</label>
      <button disabled={!store || uncertainStart} onClick={() => void start()}>Start</button>
      {uncertainStart && <button className="secondary" onClick={() => void refreshHistory()}>Verify local history</button>}
      <button className="secondary" onClick={() => moveIntroStep('guide')}>Review guide</button></section>}
    {step === 'play' && <section className="panel easy-hard-board" aria-label="Easy or Hard task">
      <div className="easy-hard-top"><p>Earnings <strong>{dollars(report?.earnedCents ?? 0)}</strong></p>
        <p>Time <strong>{(remaining / 1000).toFixed(1)} s</strong></p></div>
      {activeChoice && currentOffer && <><h1 ref={choiceTitle} tabIndex={-1}>Choose Easy or Hard</h1>
        <p>{currentOffer.probabilityPercent}% chance of payment after timely completion.</p>
        <p>{preview === 'choice' ? 'Preparing the five-second choice.' :
          `Choose within ${(choiceTime / 1000).toFixed(1)} seconds.`}</p>
        <div className="easy-hard-options"><button className={selectedChoice === 'easy' ? 'easy-hard-selected' : ''} disabled={surface !== 'choice'} onClick={event => select('easy', event)}>Easy{selectedChoice === 'easy' ? ' · Selected' : ''}<br />5 presses · 3 seconds<br />$1.00</button>
          <button className={selectedChoice === 'hard' ? 'easy-hard-selected' : ''} disabled={surface !== 'choice'} onClick={event => select('hard', event)}>Hard{selectedChoice === 'hard' ? ' · Selected' : ''}<br />60 presses · 12 seconds<br />{dollars(currentOffer.hardOfferCents)}</button></div></>}
      {activeTask && <div ref={taskHost} tabIndex={0} onKeyDown={down} onKeyUp={up}
        onBlur={() => { keyDown.current = false }} className="easy-hard-task">
        <h1 ref={taskTitle} tabIndex={-1}>{last?.choice === 'hard' ? 'Hard' : 'Easy'} task</h1>
        <p>{taskChance}% chance to earn {dollars(taskReward ?? 0)} after timely completion.
          {taskAutomatic ? ' This task was selected automatically.' : ''}</p>
        <div className="easy-hard-bar"><div style={{ height: `${Math.min(100, 100 * (preview === 'task' ? 0 : last?.acceptedPresses ?? 0) / (last?.choice === 'hard' ? 60 : 5))}%` }} /></div>
        <p>Press and release Space. {last?.choice === 'hard' ? 60 : 5} presses required.</p>
        <p>{preview === 'task' ? 0 : last?.acceptedPresses ?? 0} of {last?.choice === 'hard' ? 60 : 5} accepted · {preview === 'task' ? 'Preparing task clock' : `${(taskTime / 1000).toFixed(1)} seconds left`}</p></div>}
      {surface === 'feedback' && phase === 'feedback' && <div role="status"><h1 ref={feedbackTitle} tabIndex={-1}>{currentRow?.reason === 'won' ? 'Completed · paid' :
        currentRow?.reason === 'lottery_loss' ? 'Completed · no payout this time' : 'Time ran out'}</h1>
        <p>{currentRow?.reason === 'won' ? `You earned ${dollars(currentRow.earnedCents)}.` :
          currentRow?.reason === 'lottery_loss' ? 'You completed the task, but the payout draw did not pay.' :
            'This task was not completed on time, so it paid $0.'}</p></div>}
      {surface === 'checking' && <p role="status">Checking saved action…</p>}
      {surface === 'uncertain' && <div role="alert"><p>Saved status cannot be confirmed. Review local history before another attempt.</p>
        <button onClick={() => void refreshHistory()}>Check local history</button></div>}
    </section>}
    {step === 'completion' && report?.status === 'complete' && run?.status === 'complete' &&
      <section className="panel"><h1>Test Complete</h1>
        <p>Your Easy or Hard attempt is saved in this browser.</p>
        <button onClick={() => void publishReport(nav.current)}>Next</button></section>}
    {step === 'report' && report && run && <section className="panel"><h1>Easy or Hard result</h1>
      <p role="status">{report.status === 'complete' && run.status === 'complete' ?
        'Completed and saved in this browser' : 'Incomplete review only'}</p>
      {report.status === 'complete' && run.status === 'complete' && <ReportSummary feedback={easyHardFeedback(report)} />}
      <details><summary>Detailed numbers</summary>
      <p>{comparison}</p>
      <p>{run.formId} · V1.0 · {run.ordinal > 4 ? 'Familiar form' : 'New form'} · {duration(report.terminalElapsedMs ?? 0)} · {run.status}.</p>
      <p>{report.completedOnTime} of {report.attempts} tasks completed on time ({rate(report.completedOnTime, report.attempts)}). Earnings {dollars(report.earnedCents)}.</p>
      <p>Easy: {report.easyCompleted} of {report.easyAttempts} completed ({rate(report.easyCompleted, report.easyAttempts)}).
        Hard: {report.hardCompleted} of {report.hardAttempts} completed ({rate(report.hardCompleted, report.hardAttempts)}).</p>
      <p>{report.easyChoices} Easy and {report.hardChoices} Hard choices; {report.automaticChoices} automatic selections.</p>
      {report.easyAttempts >= 2 && report.hardAttempts >= 2 && <p>In this run, {report.easyCompleted / report.easyAttempts === report.hardCompleted / report.hardAttempts ?
        'Easy and Hard had the same on-time completion rate.' : report.easyCompleted / report.easyAttempts > report.hardCompleted / report.hardAttempts ?
          'Easy had the higher on-time completion rate.' : 'Hard had the higher on-time completion rate.'} Offers and payout draws can differ between forms; this is descriptive, not a prediction.</p>}
      <p>Input context: Space key task; mouse, touch or keyboard choice is recorded per action. Sound cues {run.soundCues ? 'requested' : 'off'}; reduced motion {run.reducedMotion ? 'on' : 'off'}. This browser clock may differ from physical test equipment. Timed repeated pressing may not be usable with every assistive device.</p>
      <div className="easy-hard-table"><table><caption>Task details</caption><thead><tr><th>Task</th><th>Choice</th><th>Chance</th><th>Offered</th><th>Time</th><th>Outcome</th><th>Earned</th></tr></thead>
        <tbody>{report.rows.map(row => <tr key={row.offerIndex}><th scope="row">{row.offerIndex}</th><td>{row.choice}</td>
          <td>{row.chancePercent}%</td><td>{dollars(row.offeredCents)}</td><td>{['interrupted', 'unresolved'].includes(row.reason) ? '—' : duration(row.durationMs)}</td>
          <td>{row.reason === 'won' ? 'Completed, paid' : row.reason === 'lottery_loss' ? 'Completed, no payout' :
            row.reason === 'interrupted' ? 'Interrupted, review only' : row.reason === 'unresolved' ? 'Unresolved, review only' : 'Timed out'}</td>
          <td>{dollars(row.earnedCents)}</td></tr>)}</tbody></table></div>
      {report.easyChoices + report.hardChoices > report.attempts && <p>{run.events.at(-1)?.kind === 'global_expired_after_choice' ?
        'Selected as time expired; task not started.' : 'Selected before interruption; task not started.'}</p>}
      </details>
      <p>{LIMIT}</p>{reportTarget?<button onClick={onLibrary}>Return to mock</button>:<><button onClick={() => { void (mock?mock.retry():Promise.resolve()).then(()=>{setCurrent(null);setReport(null);moveIntroStep('guide')}).catch(cause=>setMockError(errorText(cause))) }}>Play again</button>
      <button className="secondary" onClick={() => void refreshHistory()}>Local history</button></>}</section>}
    {step === 'report' && mockError && <p role="alert">{mockError}</p>}
    {step === 'report' && mockReady && mock && <button data-mock-return-intent onClick={() => void mock.continue().catch(cause => setMockError(errorText(cause)))}>Continue mock</button>}
    {step === 'history' && <section className="panel"><h1>Easy or Hard local history</h1>
      <p>Saved only in this browser. Deleting all removes attempts, reports and form exposure history.</p>
      {history.length === 0 && <p>No saved attempts found.</p>}
      <ul>{history.map(item => <li key={item.run.id}><span>{item.run.formId} · {item.run.status === 'reserved' ? 'start unconfirmed; offer may have appeared' :
        item.run.status === 'active' ? 'saved prefix; incomplete review' : item.run.status} · {item.report ? dollars(item.report.earnedCents) : 'no scored actions confirmed'}</span>
        {item.report && <button className="secondary" onClick={() => void openSaved(item.run.id)}>View result</button>}
        <button className="secondary" onClick={() => setDeleteTarget(item.run.id)}>Delete</button>
        {deleteTarget === item.run.id && <span>Delete this attempt? <button onClick={() => void deleteOne(item.run.id)}>Confirm</button>
          <button className="secondary" onClick={() => setDeleteTarget(null)}>Cancel</button></span>}</li>)}</ul>
      {confirmAll ? <div>Delete all Easy or Hard data? <button onClick={() => void deleteAll()}>Confirm Delete all</button>
        <button className="secondary" onClick={() => setConfirmAll(false)}>Cancel</button></div> :
        <button className="secondary" onClick={() => setConfirmAll(true)}>Delete all Easy or Hard data</button>}
      <button onClick={() => { setCurrent(null); setReport(null); moveIntroStep('guide') }}>Back to guide</button></section>}
  </div></Shell>
}
