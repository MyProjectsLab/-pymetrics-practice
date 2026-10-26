import { QuickRules } from '../onboarding/QuickRules'
import { ReportSummary } from '../reports/Summary'
import { cardsFeedback } from '../reports/feedback'
import { AssessmentUsageNotice } from '../assessment-usage/Notice'
/* oxlint-disable react/immutability, react/purity, react-hooks/exhaustive-deps */
import { Attempt } from '../assessment-usage/client'
import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { Shell } from '../core/Shell'
import { DECKS, loadCardsForms } from './core'
import type { Deck, Report, Run } from './core'
import { acquireCardsOwner, CardsStore, withCardsDataOrder } from './storage'
import type { MockJourneyContext } from '../mock/journey-context'
import type { ReportTarget } from '../mock/report-route'
import { withVerifiedReportPublication } from '../mock/report-route'
import './cards.css'

type Step = 'guide' | 'example' | 'quiz' | 'preflight' | 'ready' | 'play' | 'report' | 'history'
type Phase = 'preparing' | 'ready' | 'saving' | 'feedback' | 'uncertain'
const LIMITATION = 'These amounts describe only this TraitGame form. They do not reproduce a provider score, predict a hiring result or establish a personality trait.'
const deckSymbol: Record<Deck, string> = { A: '◆', B: '●', C: '▲', D: '■' }
function outcomeText(value: number) { return value > 0 ? `Gain +$${value}` : value < 0 ? `Loss -$${-value}` : 'No change $0' }
function money(value: number) { return value < 0 ? `-$${-value}` : `$${value}` }
function nextFrame() { return new Promise<void>(resolve => requestAnimationFrame(() => resolve())) }
function delivered<T>(operation: Promise<T>, controller: AbortController): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => { controller.abort(); reject(Error('Save delivery unconfirmed')) }, 2500)
    operation.then(value => { window.clearTimeout(timeout); resolve(value) }, reason => {
      window.clearTimeout(timeout); reject(reason)
    })
  })
}
function checkedRun(store: CardsStore, id: string) {
  const controller = new AbortController()
  return delivered(store.inspect(id, controller.signal), controller)
}
function checkedRoot(store: CardsStore) {
  const controller = new AbortController()
  return delivered(store.read(controller.signal), controller)
}
function safeError(value: unknown) { return value instanceof Error ? value.message : 'Local save could not be confirmed.' }
function ownerAlive(run: Run | null, docId: string) { return !!run && run.documentId === docId && run.status === 'active' }
function ReportPanel({ report, run, comparison, onHistory, onReplay, onLibrary, readOnly, returnToMock }: {
  report: Report; run: Run; comparison: string; onHistory: () => void; onReplay: () => void; onLibrary: () => void; readOnly?: boolean; returnToMock?: boolean
}) {
  return <section className="panel cards-report" aria-labelledby="cards-report-title">
    <h2 id="cards-report-title" tabIndex={-1}>Cards result</h2>
    <p role="status">{report.status === 'complete_valid' ? 'Completed and saved in this browser' :
      `Incomplete review, through draw ${report.committedDrawCount} of 80`}</p>
    {report.status === 'complete_valid' && <ReportSummary feedback={cardsFeedback(report)} />}
    <details><summary>Detailed numbers</summary>
    <p>{comparison}</p>
    <p>Form {report.formId}{report.ordinal > 6 ? ' · repeated form' : ''}.</p>
    <p>{report.committedDrawCount} committed draws; {report.feedbackSeenCount} feedback displays confirmed during play.
      {report.committedDrawCount > report.feedbackSeenCount ? ' The last saved outcome may not have been confirmed visible during play.' : ''}</p>
    {run.status === 'active' && <p>This attempt may still be in progress in another tab, or its closure save is unconfirmed. It cannot resume from this review.</p>}
    <div className="cards-totals"><p>Starting balance <strong>${report.startingBalance}</strong></p>
      <p>Total gains <strong>${report.gains}</strong></p><p>Total losses <strong>${report.losses}</strong></p>
      <p>{report.status === 'complete_valid' ? 'Ending balance' : 'Saved prefix balance'} <strong>{money(report.endingBalance)}</strong></p></div>
    <p>Deck switches: {report.switches}{report.status === 'complete_valid' ? ' of 79 adjacent draw pairs' : ' in the saved prefix'}.</p>
    <div className="cards-table"><table><caption>Chosen outcomes by deck</caption><thead><tr><th>Deck</th><th>Draws</th><th>Gains</th><th>Losses</th></tr></thead>
      <tbody>{DECKS.map(deck => <tr key={deck}><th scope="row">Deck {deck}</th><td>{report.byDeck[deck].count}</td>
        <td>${report.byDeck[deck].gains}</td><td>${report.byDeck[deck].losses}</td></tr>)}</tbody></table></div>
    <details><summary>Selected draw trace</summary><ol>{report.trace.map(draw => <li key={draw.turn}>
      Draw {draw.turn}: Deck {draw.deck}, its card {draw.deckDraw}; {outcomeText(draw.value)}; balance {money(draw.balance)}
      {!draw.feedbackSeen ? ' · display not confirmed' : ''}.</li>)}</ol></details>
    </details>
    <p>{LIMITATION}</p>
    <div className="cards-actions">{!readOnly&&<><button onClick={onReplay}>Play again</button><button className="secondary" onClick={onHistory}>Local history</button></>}
      <button className="secondary" data-mock-return-intent={returnToMock ? "" : undefined} onClick={onLibrary}>{returnToMock?'Return to mock':'Library'}</button></div>
  </section>
}
export function CardsJourney({ onLibrary, mock, reportTarget }: { onLibrary: () => void; mock?: MockJourneyContext; reportTarget?: ReportTarget }) {
  const usage = useRef(new Attempt('cards'))
  useEffect(() => { const current=usage.current; return () => current.cancel() }, [])
  const [step, setStep] = useState<Step>('guide')
  const [phase, setPhase] = useState<Phase>('preparing')
  const [store, setStore] = useState<CardsStore | null>(null)
  const [storageError, setStorageError] = useState('')
  const [error, setError] = useState('')
  const [quiz, setQuiz] = useState({ loss: '', switch: '', deadline: '', draws: '' })
  const [quizError, setQuizError] = useState('')
  const [skipAvailable, setSkipAvailable] = useState(false)
  const skipSource=useRef<string|null>(null)
  const skipChecking=useRef(false)
  const [run, setRun] = useState<Run | null>(null)
  const [report, setReport] = useState<Report | null>(null)
  const [comparison, setComparison] = useState('No comparable earlier run is currently verified.')
  const [mockReady, setMockReady] = useState(false), [mockError, setMockError] = useState('')
  const mockTerminalSeen = useRef<string | null>(null)
  const [history, setHistory] = useState<{ run: Run; report: Report }[]>([])
  const [historyEvidence, setHistoryEvidence] = useState<'checking' | 'withdrawn' | 'confirmed'>('checking')
  const [display, setDisplay] = useState<{ deck: Deck; value: number; balance: number } | null>(null)
  const [pendingLabel, setPendingLabel] = useState('')
  const [closurePending, setClosurePending] = useState(false)
  const [confirmAll, setConfirmAll] = useState(false)
  const docId = useRef(crypto.randomUUID())
  const nav = useRef(0)
  const runRef = useRef<Run | null>(null)
  const storeRef = useRef<CardsStore | null>(null)
  const phaseRef = useRef<Phase>('preparing')
  const admission = useRef(false)
  const entryClosed = useRef(false)
  const releaseOwner = useRef<(() => void) | null>(null)
  const ownerAbort = useRef<AbortController | null>(null)
  const writeAbort = useRef<AbortController | null>(null)
  const retry = useRef<(() => Promise<void>) | null>(null)
  const busy = useRef(false)
  const lastInput = useRef<{ kind: 'keyboard' | 'pointer' | 'touch'; deck: Deck; at: number } | null>(null)
  const pendingReady = useRef<{ id: string; runId: string; documentId: string; epoch: number;
    revision: number; turn: number; atMs: number } | null>(null)
  const deckHost = useRef<HTMLDivElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const feedbackRef = useRef<HTMLParagraphElement>(null)
  const currentReportId = useRef<string | null>(null)
  const pendingClosure = useRef<{ store: CardsStore; request: Parameters<CardsStore['closeRun']>[0] } | null>(null)
  const pendingStart = useRef<{ store: CardsStore; runId: string } | null>(null)
  const openedReportTarget=useRef<string|null>(null)
  useEffect(()=>{if(!store||!reportTarget||openedReportTarget.current===reportTarget.attemptId)return;openedReportTarget.current=reportTarget.attemptId;void showReport(reportTarget.attemptId,'history')},[store,reportTarget])

  function setPlayPhase(value: Phase) { phaseRef.current = value; setPhase(value) }
  function canUseOwner(ticket: number) { return ticket === nav.current && !entryClosed.current &&
    !!releaseOwner.current && !!ownerAbort.current && !ownerAbort.current.signal.aborted }
  function canContinue(ticket: number) { return admission.current && canUseOwner(ticket) }
  function release() { releaseOwner.current?.(); releaseOwner.current = null; ownerAbort.current?.abort(); ownerAbort.current = null }
  async function saveClosure(store: CardsStore, request: Parameters<CardsStore['closeRun']>[0]) {
    const controller = new AbortController()
    await delivered(store.closeRun(request, controller.signal), controller)
    if (pendingClosure.current?.request.id === request.id) {
      pendingClosure.current = null; setClosurePending(false); setError('')
    }
  }
  async function recoverClosure() {
    const pending = pendingClosure.current
    if (!pending) return
    try {
      const root = await checkedRoot(pending.store)
      if (pendingClosure.current?.request.id !== pending.request.id) return
      const current = root.runs[pending.request.runId]
      if (current?.status === 'active') await saveClosure(pending.store, pending.request)
      else { pendingClosure.current = null; setClosurePending(false); setError('') }
      if (step === 'history') await refreshHistory()
    } catch (reason) { if (pendingClosure.current?.request.id === pending.request.id)
      setError(`Exit or interruption save unconfirmed: ${safeError(reason)}`) }
  }
  async function abandonPendingStart(reason: string, ownerWasLost = false) {
    const pending = pendingStart.current
    pendingStart.current = null
    if (!pending) return
    let closureId: string | undefined
    try {
      await withCardsDataOrder(async () => {
        const root = await checkedRoot(pending.store)
        const started = root.runs[pending.runId]
        if (!started || started.status !== 'active' || started.documentId !== docId.current) return
        if (ownerWasLost) {
          await pending.store.revokeOwner({ id: crypto.randomUUID(), runId: started.id,
            documentId: docId.current, epoch: started.epoch, reason })
        } else {
          const request = { id: crypto.randomUUID(), runId: started.id, documentId: docId.current,
            epoch: started.epoch, type: 'run_interrupted' as const, reason }
          closureId = request.id
          pendingClosure.current = { store: pending.store, request }; setClosurePending(true)
          await saveClosure(pending.store, request)
        }
      })
    } catch (error) { if (!closureId || pendingClosure.current?.request.id === closureId)
      setError(`Interrupted start save unconfirmed: ${safeError(error)}`) }
  }
  function ownerLost() {
    if (!releaseOwner.current && !ownerAbort.current) return
    const selected = runRef.current, selectedStore = storeRef.current
    entryClosed.current = true; admission.current = false; writeAbort.current?.abort()
    retry.current = null; busy.current = true; setPlayPhase('uncertain')
    release()
    setPendingLabel('Play ownership ended. This run cannot continue.')
    if (!selected) void abandonPendingStart('owner_lost', true)
    if (selected && selectedStore && selected.status === 'active')
      void selectedStore.revokeOwner({ id: crypto.randomUUID(), runId: selected.id,
        documentId: docId.current, epoch: selected.epoch, reason: 'owner_lost' })
        .catch(reason => setError(`Owner revocation save unconfirmed: ${safeError(reason)}`))
  }
  function retire(reason: 'run_interrupted' | 'run_exited', why: string): Promise<unknown> | undefined {
    if (!admission.current) {
      if (ownerAbort.current) { entryClosed.current = true; release(); retry.current = null; busy.current = false
        void abandonPendingStart(why)
        setPendingLabel('Start was interrupted. Return to the guide before trying again.') }
      return
    }
    entryClosed.current = true
    admission.current = false; busy.current = true; writeAbort.current?.abort(); retry.current = null
    setPlayPhase('uncertain'); release()
    const selected = runRef.current, selectedStore = storeRef.current
    if (selected && selectedStore && selected.status === 'active') {
      const request = { id: crypto.randomUUID(), runId: selected.id, documentId: docId.current,
        epoch: selected.epoch, type: reason, reason: why }
      pendingClosure.current = { store: selectedStore, request }; setClosurePending(true)
      return saveClosure(selectedStore, request).catch(error => {
        if (pendingClosure.current?.request.id === request.id)
          setError(`Exit or interruption save unconfirmed: ${safeError(error)}`)
      })
    }
  }
  function newStep(next: Step, returning = false) {
    if(!returning)mock?.retireReturnIntent()
    nav.current++
    if (admission.current) retire('run_exited', 'candidate_left')
    release(); retry.current = null; pendingReady.current = null; busy.current = false; currentReportId.current = null
    runRef.current = null; setRun(null); setDisplay(null)
    if (next === 'history') { setHistory([]); setHistoryEvidence('checking') }
    if (next === 'guide') entryClosed.current = false
    setError(''); setPendingLabel(''); setReport(null); setStep(next)
  }
  function library() { newStep('guide',true); onLibrary() }
  useEffect(() => {
    let active = true
    void (mock||reportTarget?CardsStore.openForMock(undefined,!reportTarget):CardsStore.open()).then(opened => {
      if (!active) { opened.close(); return }
      storeRef.current = opened; setStore(opened)
    }).catch(reason => { if (active) setStorageError(`Local Cards storage unavailable: ${safeError(reason)}`) })
    return () => { mock?.retireReturnIntent();active = false; nav.current++; retire('run_interrupted', 'component_unmounted'); release(); storeRef.current?.close() }
  }, [])
  useEffect(() => { if (step !== 'play') heading.current?.focus() }, [step])
  useEffect(()=>{
    if(!store||step!=='guide')return
    let active=true,pending=false
    const check=()=>{if(pending||document.hidden||!document.hasFocus())return;pending=true;void withCardsDataOrder(()=>store.list()).then(items=>{
      if(active)setSkipAvailable(items.some(item=>item.run.status==='complete'&&item.report.status==='complete_valid'&&
        item.report.committedDrawCount===80&&item.report.feedbackSeenCount===80))
    }).catch(()=>{if(active)setSkipAvailable(false)}).finally(()=>{pending=false})}
    check();const timer=window.setInterval(check,1000)
    return()=>{active=false;window.clearInterval(timer)}
  },[store,step])
  async function skipTutorial(){
    if(!store)return
    const ticket=nav.current
    try{
      const items=await withCardsDataOrder(()=>store.list())
      if(ticket!==nav.current||step!=='guide')return
      const source=items.find(item=>item.run.status==='complete'&&item.report.status==='complete_valid'&&
        item.report.committedDrawCount===80&&item.report.feedbackSeenCount===80)
      if(!source){
        setSkipAvailable(false);setError('A current completed Cards run is no longer saved. Check the rules instead.');return
      }
      skipSource.current=source.run.id
      newStep('preflight')
    }catch{if(ticket===nav.current){setSkipAvailable(false);setError('Saved Cards history could not be checked. Use the rule check instead.')}}
  }
  useEffect(() => {
    const hidden = () => { if (document.visibilityState === 'hidden') retire('run_interrupted', 'tab_hidden') }
    const pagehide = () => retire('run_interrupted', 'pagehide')
    const freeze = () => retire('run_interrupted', 'freeze')
    document.addEventListener('visibilitychange', hidden); window.addEventListener('pagehide', pagehide)
    document.addEventListener('freeze', freeze)
    return () => { document.removeEventListener('visibilitychange', hidden); window.removeEventListener('pagehide', pagehide)
      document.removeEventListener('freeze', freeze) }
  }, [])
  useEffect(() => {
    const blur = () => {
      if (step === 'report') { nav.current++; flushSync(() => setReport(null)) }
      if (step === 'history') { nav.current++; flushSync(() => {
        setHistory([]); setHistoryEvidence('withdrawn')
      }) }
    }
    const focus = () => {
      if (step === 'report' && currentReportId.current) void showReport(currentReportId.current, 'history')
      if (step === 'history') void refreshHistory()
    }
    window.addEventListener('blur', blur); window.addEventListener('focus', focus)
    return () => { window.removeEventListener('blur', blur); window.removeEventListener('focus', focus) }
  }, [step])
  useEffect(() => {
    if (!store) return
    return store.subscribe(notice => {
      if (notice.type === 'replaced' || notice.runId === runRef.current?.id || notice.runId === currentReportId.current) {
        if (notice.type === 'replaced' || notice.runId === pendingClosure.current?.request.runId)
          { pendingClosure.current = null; setClosurePending(false) }
        if (admission.current) retire('run_interrupted', 'storage_authority_changed')
        if (step === 'play') newStep('guide')
        currentReportId.current = null; flushSync(() => {
          setReport(null); setHistory([]); setHistoryEvidence('withdrawn')
        })
        setError('The saved attempt was removed or replaced in another tab. You can start a fresh run.')
        if (notice.type === 'replaced') {
          store.close(); storeRef.current = null; setStore(null)
          void (mock||reportTarget?CardsStore.openForMock(undefined,!reportTarget):CardsStore.open()).then(next => { storeRef.current = next; setStore(next); setStorageError('') })
            .catch(reason => { storeRef.current = null; setStore(null); setStorageError(safeError(reason)) })
        }
      } else if (step === 'history') void refreshHistory()
      else if (step === 'report' && currentReportId.current) void showReport(currentReportId.current,'history')
    })
  }, [store, step])
  async function refreshHistory() {
    const selectedStore = storeRef.current, ticket = nav.current
    if (!selectedStore) return
    setHistoryEvidence('checking')
    try {
      await withCardsDataOrder(async () => {
        const list = await selectedStore.list()
        if (ticket !== nav.current) return
        flushSync(() => { setHistory(list); setHistoryEvidence('confirmed') })
        if (!pendingClosure.current) setError('')
        void selectedStore.viewHistory(crypto.randomUUID()).catch(() => undefined)
      })
    } catch (reason) { if (ticket === nav.current) {
      setHistory([]); setHistoryEvidence('withdrawn'); setError(safeError(reason))
    } }
  }
  async function showReport(id: string, source: 'live' | 'history') {
    if(source==='history')mock?.retireReturnIntent()
    const selectedStore = storeRef.current, ticket = nav.current
    if (!selectedStore) return
    currentReportId.current = id; flushSync(() => setReport(null))
    let usageSummary: {draws:number;ending_dollars:number;gains_dollars:number;losses_dollars:number}|null=null
    try {
      const publish=async (permit=()=>{}) => {
        const inspected = await checkedRun(selectedStore, id)
        const available = await selectedStore.list()
        const prior = available.filter(item=>item.run.id!==id && item.run.createdAtWallMs<inspected.run.createdAtWallMs &&
          item.report.status==='complete_valid').sort((a,b)=>b.run.createdAtWallMs-a.run.createdAtWallMs)[0]
        const comparisonText = inspected.report.status==='complete_valid' && prior ?
          `Your previous saved Cards run ended at ${money(prior.report.endingBalance)}. Different card sequences can change the outcome.` :
          'No comparable earlier run is currently verified.'
        if(reportTarget&&selectedStore.installationId!==reportTarget.reference.installationId)throw Error('Cards installation changed')
        if (ticket !== nav.current || currentReportId.current !== id) return
        permit()
        flushSync(() => { setRun(inspected.run); setReport(inspected.report); setComparison(comparisonText); setStep('report') })
        if(source==='live' && inspected.report.status==='complete_valid')usageSummary={draws:inspected.report.committedDrawCount,ending_dollars:inspected.report.endingBalance,gains_dollars:inspected.report.gains,losses_dollars:inspected.report.losses}
      }
      if(reportTarget)await withVerifiedReportPublication(reportTarget,publish)
      else await withCardsDataOrder(()=>publish())
      if (ticket === nav.current && currentReportId.current === id) {
        if (mock) await selectedStore.view(id, crypto.randomUUID(), 'report_viewed')
        else void selectedStore.view(id, crypto.randomUUID(), 'report_viewed').catch(() => undefined)
        if (source === 'live') {
          release()
          if(ticket===nav.current && currentReportId.current===id && usageSummary){const scalars=usageSummary;usage.current.finish(id,'completed',()=>scalars)}
          else usage.current.cancel()
        }
        if (mock && source === 'live' && mockTerminalSeen.current !== id) {
          mockTerminalSeen.current = id
          try { const status = await mock.terminal(); setMockReady(status === 'ready'); if (status === 'review_only') setMockError('This attempt needs review. Return to mock to try again or skip this game.') }
          catch (cause) { mockTerminalSeen.current = null; setMockError(safeError(cause)) }
        }
      }
    } catch (reason) { if (ticket === nav.current) {
      setReport(null); setStep('report'); setError(safeError(reason))
    } }
  }
  async function start() {
    const selectedStore = storeRef.current
    if (!selectedStore || busy.current || skipChecking.current || entryClosed.current) return
    if(skipSource.current){const sourceId=skipSource.current,ticket=nav.current;skipChecking.current=true
      try{const items=await withCardsDataOrder(()=>selectedStore.list())
        if(ticket!==nav.current||entryClosed.current||storeRef.current!==selectedStore)return
        if(!items.some(item=>item.run.id===sourceId&&item.run.status==='complete'&&item.report.status==='complete_valid'&&item.report.committedDrawCount===80&&item.report.feedbackSeenCount===80)){
          skipSource.current=null;setSkipAvailable(false);setQuiz({loss:'',switch:'',deadline:'',draws:''});setError('The completed run used to skip the guide was deleted or changed. Check the rules to continue.');newStep('quiz');return
        }
        skipSource.current=null
      }catch{if(ticket===nav.current){setQuiz({loss:'',switch:'',deadline:'',draws:''});setError('The completed run used to skip the guide could not be checked. Check the rules to continue.');newStep('quiz')}return}
      finally{skipChecking.current=false}
    }
    busy.current = true; setError(''); setPendingLabel('Saving the start…')
    usage.current.begin(mock?'mock':'practice')
    const ticket = ++nav.current
    const controller = new AbortController(); ownerAbort.current = controller
    const request = { id: crypto.randomUUID(), runId: crypto.randomUUID(), documentId: docId.current, wallMs: Date.now() }
    pendingStart.current = { store: selectedStore, runId: request.runId }
    let ownerAcquired = false
    try {
      const owner = await acquireCardsOwner(ownerLost, controller.signal)
      if (ticket !== nav.current || controller.signal.aborted) { owner(); return }
      releaseOwner.current = owner; ownerAcquired = true
      if (mock) await mock.beforeArm({ requestId: request.id, attemptId: request.runId, originTicketId: null,
        installationId: selectedStore.installationId, generation: null, requestKind: 'start', nativeIdentity: [] })
      if (!canUseOwner(ticket) || controller.signal.aborted) return
      const write = new AbortController(); writeAbort.current = write
      const started = await withCardsDataOrder(() => delivered(selectedStore.start(request, write.signal), write))
      const inspected = await checkedRun(selectedStore, started.id)
      if (!canUseOwner(ticket)) return
      if (!ownerAlive(inspected.run, docId.current) || inspected.run.ordinal !== started.ordinal) throw Error('Start could not be verified')
      usage.current.admit(inspected.run.id)
      admission.current = true; runRef.current = inspected.run; setRun(inspected.run)
      pendingStart.current = null
      setDisplay(null); setStep('play'); setPlayPhase('preparing'); busy.current = false; setPendingLabel('')
    } catch (reason) {
      if (ticket !== nav.current) return
      if (entryClosed.current) { release(); busy.current = false; retry.current = null
        setPendingLabel('Start was interrupted. Return to the guide before trying again.'); return }
      if (!ownerAcquired) { pendingStart.current = null; release(); busy.current = false; setPendingLabel(''); retry.current = null
        setError(safeError(reason)); return }
      // A timed-out callback may conceal a committed Start. Keep its exact request for retry.
      setPendingLabel('Start save unconfirmed. Check it before trying again.')
      retry.current = async () => {
        try {
          if (!canUseOwner(ticket)) return
          const root = await checkedRoot(selectedStore)
          if (!canUseOwner(ticket)) return
          const prior = root.runs[request.runId]
          if (prior && ownerAlive(prior, docId.current)) {
            usage.current.admit(prior.id); runRef.current = prior; admission.current = true; setRun(prior); setStep('play'); setPlayPhase('preparing')
            pendingStart.current = null
            setPendingLabel(''); busy.current = false; return
          }
          const write = new AbortController(); writeAbort.current = write
          await withCardsDataOrder(() => delivered(selectedStore.start(request, write.signal), write))
          const verified = await checkedRun(selectedStore, request.runId)
          if (!canUseOwner(ticket)) return
          if (!ownerAlive(verified.run, docId.current)) throw Error('Start authority unavailable')
          usage.current.admit(verified.run.id); runRef.current = verified.run; admission.current = true; setRun(verified.run); setStep('play')
          pendingStart.current = null
          setPlayPhase('preparing'); setPendingLabel(''); busy.current = false
        } catch (error) { setError(safeError(error)) }
      }
      setError(safeError(reason))
    }
  }
  useEffect(() => {
    if (step !== 'play' || phase !== 'preparing' || !admission.current || !runRef.current) return
    const selected = runRef.current, selectedStore = storeRef.current, ticket = nav.current
    if (!selectedStore) return
    let canceled = false
    const controller = new AbortController(); writeAbort.current = controller
    const watchdog = window.setTimeout(() => {
      if (canceled || !admission.current || ticket !== nav.current || phaseRef.current !== 'preparing') return
      setPlayPhase('uncertain'); setPendingLabel('The next draw did not become visible. Check the display before continuing.')
      retry.current = async () => { if (canContinue(ticket)) setPlayPhase('preparing') }
    }, 2500)
    void (async () => {
      await nextFrame()
      if (canceled || !admission.current || ticket !== nav.current || !deckHost.current ||
        !deckHost.current.getClientRects().length || document.visibilityState !== 'visible') return
      const turn = selected.events.filter(event => event.type === 'choice_committed').length + 1
      const request = pendingReady.current?.runId === selected.id && pendingReady.current.turn === turn ?
        pendingReady.current : { id: crypto.randomUUID(), runId: selected.id, documentId: docId.current,
          epoch: selected.epoch, revision: selected.revision, turn, atMs: performance.now() }
      pendingReady.current = request
      try {
        const before = await checkedRun(selectedStore, selected.id)
        if (canceled || !canContinue(ticket)) return
        if (!before.run.events.some(event => event.type === 'draw_ready' && event.turn === turn))
          await selectedStore.ready(request, controller.signal)
        const verified = await checkedRun(selectedStore, selected.id)
        if (canceled || !canContinue(ticket)) return
        if (!verified.run.events.some(event => event.type === 'draw_ready' && event.turn === turn)) throw Error('Readiness unconfirmed')
        window.clearTimeout(watchdog)
        pendingReady.current = null
        runRef.current = verified.run; setRun(verified.run); setPlayPhase('ready'); busy.current = false
        requestAnimationFrame(() => deckHost.current?.querySelector<HTMLButtonElement>('button')?.focus())
      } catch (reason) {
        if (canceled || !admission.current || ticket !== nav.current) return
        setPlayPhase('uncertain'); setPendingLabel('Draw readiness save unconfirmed.')
        retry.current = async () => {
          try {
            const current = await checkedRun(selectedStore, selected.id)
            if (!canContinue(ticket)) return
            if (!ownerAlive(current.run, docId.current)) throw Error('Run no longer active')
            if (!current.run.events.some(event => event.type === 'draw_ready' && event.turn === turn))
              { const write = new AbortController(); writeAbort.current = write
                await delivered(selectedStore.ready(request, write.signal), write) }
            const next = await checkedRun(selectedStore, selected.id)
            if (!canContinue(ticket)) return
            pendingReady.current = null
            runRef.current = next.run; setRun(next.run); setPlayPhase('ready'); setPendingLabel(''); busy.current = false
          } catch (error) { setError(safeError(error)) }
        }
        setError(safeError(reason))
      }
    })().catch(reason => { if (!canceled) setError(safeError(reason)) })
    return () => { canceled = true; window.clearTimeout(watchdog); controller.abort() }
  }, [step, phase, run?.id, run?.revision])
  function classify(deck: Deck): string {
    const trace = lastInput.current; lastInput.current = null
    return trace && trace.deck === deck && performance.now() - trace.at < 1500 ? trace.kind : 'assistive_or_unknown'
  }
  async function draw(deck: Deck, trusted: boolean, modified: boolean) {
    if (!trusted || modified || !admission.current || phaseRef.current !== 'ready' || busy.current) return
    const selectedStore = storeRef.current, selected = runRef.current
    if (!selectedStore || !selected) return
    busy.current = true; setPlayPhase('saving'); setError(''); setPendingLabel('Saving your draw…')
    const ticket = nav.current
    const turn = selected.events.filter(event => event.type === 'choice_committed').length + 1
    const deckDraw = selected.events.filter(event => event.type === 'choice_committed' && event.deck === deck).length + 1
    const command = { id: crypto.randomUUID(), runId: selected.id, documentId: docId.current,
      epoch: selected.epoch, revision: selected.revision, turn, deck, deckDraw,
      source: classify(deck), atMs: performance.now() }
    const controller = new AbortController(); writeAbort.current = controller
    async function afterChoice() {
      let verified: Awaited<ReturnType<CardsStore['inspect']>> | null = null
      await withCardsDataOrder(async () => {
        const read = await checkedRun(selectedStore!, selected!.id)
        if (!canContinue(ticket) || !ownerAlive(read.run, docId.current)) return
        const event = read.run.events.find(value => value.type === 'choice_committed' && value.commandId === command.id)
        if (!event || event.type !== 'choice_committed') throw Error('Choice save unconfirmed')
        verified = read; runRef.current = read.run; setRun(read.run)
        flushSync(() => { setDisplay({ deck, value: event.value, balance: event.balance }); setPlayPhase('feedback') })
      })
      if (!verified || !canContinue(ticket)) return
      try {
        await delivered(nextFrame(), new AbortController())
        if (!canContinue(ticket) || !feedbackRef.current?.getClientRects().length)
          throw Error('Feedback display unconfirmed')
      } catch (reason) {
        if (!canContinue(ticket)) return
        setPlayPhase('uncertain'); setPendingLabel('Feedback display unconfirmed. Check the saved draw.')
        retry.current = async () => { try { if (canContinue(ticket)) await afterChoice() }
          catch (error) { setError(safeError(error)) } }
        setError(safeError(reason)); return
      }
      feedbackRef.current.focus()
      const feedback = { id: crypto.randomUUID(), runId: selected!.id, documentId: docId.current,
        epoch: selected!.epoch, revision: (verified as Awaited<ReturnType<CardsStore['inspect']>>).run.revision,
        turn, commandId: command.id, atMs: performance.now() }
      async function afterFeedback() {
        const recorded = await checkedRun(selectedStore!, selected!.id)
        if (!canContinue(ticket) || !ownerAlive(recorded.run, docId.current)) return
        if (!recorded.run.events.some(value => value.type === 'feedback_shown' && value.commandId === command.id))
          throw Error('Feedback save unconfirmed')
        runRef.current = recorded.run; setRun(recorded.run)
        setPendingLabel(''); retry.current = null
        if (turn === 80) await finish(recorded.run, selectedStore!, ticket)
        else { busy.current = false; setPlayPhase('preparing') }
      }
      try { await delivered(selectedStore!.feedback(feedback, controller.signal), controller); await afterFeedback() }
      catch (reason) {
        if (!canContinue(ticket)) return
        setPlayPhase('uncertain'); setPendingLabel('Feedback save unconfirmed.')
        retry.current = async () => {
          try {
            const read = await checkedRun(selectedStore!, selected!.id)
            if (!canContinue(ticket)) return
            if (!ownerAlive(read.run, docId.current)) throw Error('Run no longer active')
            if (!read.run.events.some(value => value.type === 'feedback_shown' && value.commandId === command.id))
              { const write = new AbortController(); writeAbort.current = write
                await delivered(selectedStore!.feedback(feedback, write.signal), write) }
            await afterFeedback()
          } catch (error) { setError(safeError(error)) }
        }
        setError(safeError(reason))
      }
    }
    try { await delivered(selectedStore.choice(command, controller.signal), controller); await afterChoice() }
    catch (reason) {
      if (!canContinue(ticket)) return
      setPlayPhase('uncertain'); setPendingLabel('Choice save unconfirmed.')
      retry.current = async () => {
        try {
          const read = await checkedRun(selectedStore, selected.id)
          if (!canContinue(ticket)) return
          if (!ownerAlive(read.run, docId.current)) throw Error('Run no longer active')
          if (!read.run.events.some(value => value.type === 'choice_committed' && value.commandId === command.id))
            { const write = new AbortController(); writeAbort.current = write
              await delivered(selectedStore.choice(command, write.signal), write) }
          await afterChoice()
        } catch (error) { setError(safeError(error)) }
      }
      setError(safeError(reason))
    }
  }
  async function finish(selected: Run, selectedStore: CardsStore, ticket: number) {
    const request = { id: crypto.randomUUID(), runId: selected.id, documentId: docId.current,
      epoch: selected.epoch, revision: selected.revision }
    setPlayPhase('saving'); setPendingLabel('Saving the completed result…')
    const controller = new AbortController(); writeAbort.current = controller
    async function verify() {
      const confirmed = await checkedRun(selectedStore, selected.id)
      if (!canContinue(ticket)) return
      if (confirmed.report.status !== 'complete_valid') throw Error('Completion save unconfirmed')
      admission.current = false; runRef.current = confirmed.run; setPendingLabel(''); retry.current = null
      await showReport(selected.id, 'live')
    }
    try { await delivered(selectedStore.complete(request, controller.signal), controller); await verify() }
    catch (reason) {
      if (!canContinue(ticket)) return
      setPlayPhase('uncertain'); setPendingLabel('Completion save unconfirmed.')
      retry.current = async () => {
        try {
          const read = await checkedRun(selectedStore, selected.id)
          if (!canContinue(ticket)) return
          if (read.report.status !== 'complete_valid') {
            if (!ownerAlive(read.run, docId.current)) throw Error('Completion cannot be retried after interruption')
            { const write = new AbortController(); writeAbort.current = write
              await delivered(selectedStore.complete(request, write.signal), write) }
          }
          await verify()
        } catch (error) { setError(safeError(error)) }
      }
      setError(safeError(reason))
    }
  }
  function openHistory() { newStep('history'); void refreshHistory() }
  async function deleteRun(id: string) {
    mock?.retireReturnIntent()
    const selectedStore = storeRef.current
    if (!selectedStore) return
    try { await selectedStore.delete(id); if (pendingClosure.current?.request.runId === id)
      { pendingClosure.current = null; setClosurePending(false) }
      if (currentReportId.current === id) { currentReportId.current = null; setReport(null) }
      await refreshHistory() } catch (reason) { setError(safeError(reason)) }
  }
  async function deleteAll() {
    mock?.retireReturnIntent()
    const selectedStore = storeRef.current
    if (!selectedStore) return
    try {
      await selectedStore.deleteAll(); pendingClosure.current = null; setClosurePending(false)
      setHistory([]); setHistoryEvidence('confirmed'); setReport(null); setConfirmAll(false)
      selectedStore.close(); const replacement = await (mock||reportTarget?CardsStore.openForMock(undefined,!reportTarget):CardsStore.open())
      storeRef.current = replacement; setStore(replacement)
    } catch (reason) { setError(safeError(reason)) }
  }
  const choices = run?.events.filter(event => event.type === 'choice_committed').length ?? 0
  const values = run?.events.filter(event => event.type === 'choice_committed').map(event => event.type === 'choice_committed' ? event.value : 0) ?? []
  const shownGains = values.reduce((sum, value) => sum + Math.max(value, 0), 0)
  const shownLosses = values.reduce((sum, value) => sum + Math.max(-value, 0), 0)
  // The visible order belongs to the immutable assigned form, not the report's alphabetic grouping.
  const [visibleOrder, setVisibleOrder] = useState<Deck[]>([...DECKS])
  useEffect(() => { if (run) void loadCardsForms().then(forms => {
    const form = forms.get(run.formId); if (form) setVisibleOrder(form.visibleOrder.split('') as Deck[])
  }) }, [run?.formId])
  if(reportTarget&&(step!=='report'||!report||!run))return <Shell onLibrary={onLibrary}><section className="journey panel"><h1>Saved Cards report</h1><p role={error?'alert':'status'}>{error||'Checking the exact retained result…'}</p><button onClick={onLibrary}>Return to mock</button></section></Shell>
  return <Shell onLibrary={library}><section className="journey cards-journey">
    {step === 'guide' && <div className="journey-top"><button className="secondary" onClick={library}><span aria-hidden="true">← </span>{mock?'Return to mock':'Main menu'}</button><p>Cards · Practice</p></div>}
    {step !== 'guide' && <h1 ref={heading} tabIndex={-1}>Cards practice</h1>}
    {storageError && <p role="alert">{storageError} Saved history and scored play are unavailable.</p>}
    {error && <p role="alert">{error}</p>}
    {step === 'guide' && <div className="panel"><p className="eyebrow">How it works</p><h1 ref={heading} tabIndex={-1}>Cards</h1><QuickRules rules={['Choose from four decks. Each card adds to or subtracts from your balance.', 'You can switch decks after any card. There are 80 draws and no timer.', 'Watch the gains and losses as you choose.']} note={'Start with $2,000 in simulated money. No real money is involved.'}/><div className="actions"><button onClick={() => newStep('quiz')}>Continue</button></div><details className="start-options"><summary>Examples and saved results</summary><div className="actions"><button className="secondary" onClick={() => newStep('example')}>See an example</button><button className="secondary" onClick={openHistory}>Saved results</button>{skipAvailable&&<button className="secondary" onClick={()=>{void skipTutorial()}}>Skip instructions</button>}</div></details><AssessmentUsageNotice /></div>}
    {step === 'example' && <div className="panel"><h2>Four sample draws</h2>
      <ol><li>Deck A: gain $100.</li><li>Deck A: lose $50.</li><li>Deck C: no change.</li><li>Switch to Deck D: gain $25.</li></ol>
      <p>These coached examples are not scored and do not use a saved form.</p><button onClick={() => newStep('quiz')}>Check the rules</button></div>}
    {step === 'quiz' && <div className="panel"><h2>Check the rules</h2>
      <fieldset><legend>Can a draw lose money, and when does the game end?</legend>
        <label><input type="radio" name="cards-rule" checked={quiz.loss === 'Yes'} onChange={() => setQuiz({...quiz,loss:'Yes',draws:'80'})} /> A draw can lose money; the game ends after 80 draws.</label>
        <label><input type="radio" name="cards-rule" checked={quiz.loss === 'No'} onChange={() => setQuiz({...quiz,loss:'No',draws:'40'})} /> A draw cannot lose money; the game ends after 40 draws.</label></fieldset>
      {quizError && <p role="alert">{quizError}</p>}
      <button onClick={() => { if (quiz.loss === 'Yes' && quiz.draws === '80')
        { skipSource.current=null;setQuizError(''); newStep('preflight') } else setQuizError('A draw can lose money, and the game ends after 80 draws. Try again.') }}>Check answers</button></div>}
    {step === 'preflight' && <div className="panel"><h2>Ready for Cards</h2>
      <p>Use the four deck buttons. Keep this tab open during play; leaving ends this attempt.</p>
      <p>Results are saved in this browser.</p>
      <p>{store ? 'Local storage is available.' : 'Checking local storage…'}</p>
      <button disabled={!store || busy.current} onClick={() => void start()}>Start</button></div>}
    {step === 'ready' && <div className="panel cards-ready"><h2>Cards</h2><p>Start with $2,000. Pick from four decks for 80 draws. You may switch at any time.</p>
      <button disabled={!store || busy.current} onClick={() => void start()}>Start</button>
      {pendingLabel && <p role="status">{pendingLabel}</p>}{retry.current && <button className="secondary" onClick={() => void retry.current?.()}>Check saved start</button>}</div>}
    {step === 'play' && <div className="panel cards-board"><div className="cards-board-top"><p>Draw {Math.min(choices + 1, 80)} of 80</p>
      <p className="cards-balance">Balance <strong>{money(display?.balance ?? report?.endingBalance ?? 2000)}</strong></p></div>
      <div className="cards-bars"><label>Gains {money(shownGains)}<progress max="10000" value={Math.min(shownGains, 10000)} /></label>
        <label>Losses {money(shownLosses)}<progress max="10000" value={Math.min(shownLosses, 10000)} /></label></div>
      <div className="cards-reveal"><div className={`cards-face ${display ? 'cards-face-revealed' : ''}`} aria-hidden="true">
        {display ? <><span>{deckSymbol[display.deck]}</span><strong>{display.value > 0 ? '+' : ''}{display.value}</strong></> : <span>◇</span>}</div>
        <p ref={feedbackRef} tabIndex={-1} aria-live="polite">{display ? `Deck ${display.deck}: ${outcomeText(display.value)}. Balance ${money(display.balance)}.` : 'Choose any deck to draw.'}</p></div>
      <div className="cards-decks" ref={deckHost}>{visibleOrder.map(deck => <button key={deck} type="button" className="cards-deck"
        disabled={phase !== 'ready'} onKeyDown={event => { if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.nativeEvent.isComposing) { event.preventDefault(); return }
          if (event.key === 'Enter' || event.key === ' ') lastInput.current = { kind: 'keyboard', deck, at: performance.now() } }}
        onPointerDown={event => { lastInput.current = { kind: event.pointerType === 'touch' ? 'touch' : 'pointer', deck, at: performance.now() } }}
        onPointerCancel={() => { lastInput.current = null }}
        onBlur={() => { lastInput.current = null }}
        onClick={event => void draw(deck, event.nativeEvent.isTrusted, event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)}>
          <span className="cards-deck-art" aria-hidden="true">{deckSymbol[deck]}</span><span>Deck {deck}</span></button>)}</div>
      {phase === 'uncertain' ? <div role="alert"><p>{pendingLabel}</p>
        {retry.current && <button onClick={() => void retry.current?.()}>Check saved action</button>}</div> :
        phase === 'saving' ? <p role="status">{pendingLabel}</p> : null}
      <button className="secondary" onClick={() => {
        const closing = retire('run_exited', 'candidate_exit'); newStep('history')
        void Promise.resolve(closing).finally(() => refreshHistory())
      }}>Exit run</button></div>}
    {step === 'report' && report && run && <ReportPanel report={report} run={run} comparison={comparison}
      onHistory={openHistory} onReplay={() => { void (mock?mock.retry():Promise.resolve()).then(()=>newStep('guide')).catch(cause=>setMockError(safeError(cause))) }} onLibrary={library} readOnly={!!reportTarget} returnToMock={!!mock||!!reportTarget} />}
    {step === 'report' && mockError && <p role="alert">{mockError}</p>}
    {step === 'report' && mockReady && mock && <button data-mock-return-intent onClick={() => void mock.continue().catch(cause => setMockError(safeError(cause)))}>Continue mock</button>}
    {step === 'report' && !report && <div className="panel"><h2>Report unavailable</h2>
      <p>The saved result could not be confirmed or was removed.</p>
      <button onClick={openHistory}>Local history</button><button className="secondary" data-mock-return-intent={mock ? "" : undefined} onClick={library}>{mock?'Return to mock':'Library'}</button></div>}
    {step === 'history' && <div className="panel"><h2>Cards history</h2>
      <p>Saved only in this browser. Removing a run also removes its outcome trace.</p>
      {closurePending && <p role="alert">Exit or interruption save is unconfirmed. This attempt cannot resume.
        <button onClick={() => void recoverClosure()}>Check closure save</button></p>}
      <button className="secondary" onClick={() => void refreshHistory()}>Refresh history</button>
      {!store ? <p>Saved history cannot be checked in this browser.</p> :
        historyEvidence !== 'confirmed' ? <p>{historyEvidence === 'checking' ?
          'Checking saved Cards attempts…' : 'History is hidden until this tab rechecks saved data.'}</p> :
          history.length === 0 ? <p>No saved Cards attempts.</p> : <ul>{history.map(({ run: item, report: summary }) => {
        return <li key={item.id}>{new Date(item.createdAtWallMs).toLocaleString()} · Form {item.formId} · {item.status === 'complete' ? 'Complete' : item.status === 'active' ? 'In progress or closure unconfirmed' : 'Incomplete'} · {summary.committedDrawCount}/80 draws
          {summary.feedbackSeenCount !== summary.committedDrawCount ? ` · ${summary.feedbackSeenCount} feedback displays confirmed` : ''}
          {` · ${item.status === 'complete' ? 'Ending' : 'Prefix'} balance ${money(summary.endingBalance)}`}
          <button onClick={() => void showReport(item.id, 'history')}>Review</button>
          <button className="secondary" onClick={() => void deleteRun(item.id)}>Delete</button></li>
      })}</ul>}
      {confirmAll ? <p>Remove all local Cards history and restart form allocation? <button onClick={() => void deleteAll()}>Confirm Delete all</button>
        <button className="secondary" onClick={() => setConfirmAll(false)}>Cancel</button></p> :
        <button className="secondary" onClick={() => setConfirmAll(true)}>Delete all Cards data</button>}
      <button onClick={() => newStep('guide')}>Back to Cards</button></div>}
  </section></Shell>
}
