import { BalloonsLibraryStatus } from './balloons/LibraryStatus'
import { BalloonsJourney } from './balloons/Journey'
import { KeypressesJourney } from './keypresses/Journey'
import { DigitsJourney } from './digits/Journey'
import { CardsJourney } from './cards/Journey'
import { EasyHardJourney } from './easy-hard/Journey'
import { TowersJourney } from './towers/Journey'
import { TowersTrainingJourney } from './towers-training/Journey'
import { TowersRuntime } from './towers/runtime'
import { AnalyticsConsent } from './analytics/Consent'
import { candidateAnalyticsAvailable, stopAnalytics } from './analytics/client'
import { useCoarseEvent } from './analytics/observations'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { GameLibrary, Shell } from './core/Shell'
import type { LibraryEntry } from './core/Shell'
import { StopJourney } from './stop/Journey'
import { createPreparationRecorder } from './stop/preparation'
import type { PreparationRecorder } from './stop/preparation'
import { stopExposure } from './stop/exposure'
import { verifyCompletedResult, restoreStopRecords, activeTabResults } from './stop/run'
import type { StopResult, DevelopmentDraft } from './stop/run'
import { pendingRetestCompletion, reconcileTrainingDeletion, checkTrainingChain, beginTrainingChain, beginSavedTrainingChain, currentTrainingChain, restoreTrainingChain, updateTrainingChain, storageDisclosure, trainingSaveStatus, subscribeTrainingSave, retryTrainingSave, CHAIN_SAVE_FAILURE } from './stop/training'
import type { TrainingChain } from './stop/training'
import { TrainingFlow } from './stop/TrainingFlow'
import type { Reservation } from './stop/TrainingFlow'
import { StopLocalStore, inspectLocalState, setStopLocalStore, stopTabIdentity } from './stop/storage'
import type { CheckedHistory } from './stop/storage'
import { StopHistory } from './stop/History'
import { StopReport } from './stop/Report'
import './App.css'

const towersRuntime = new TowersRuntime()
const queryPracticeGames = ['keypresses', 'stop', 'digits', 'cards', 'easy-hard', 'towers', 'balloons']
const cleanPracticeRoutes: Record<string, string> = {
  '/practice/keypresses': 'keypresses', '/practice/stop': 'stop', '/practice/digits': 'digits',
  '/practice/balloons': 'balloons', '/practice/towers': 'towers', '/practice/cards': 'cards',
  '/practice/easy-or-hard': 'easy-hard',
}
function parseInitialEntry(pathname: string, search: string) {
  if (!search && !cleanPracticeRoutes[pathname]) return null
  const query = new URLSearchParams(search)
  const requestedGame = query.get('practiceGame')
  return {
    practice: requestedGame && queryPracticeGames.includes(requestedGame) ? requestedGame :
      requestedGame ? null : cleanPracticeRoutes[pathname] ?? null,
    stopHistory: query.get('mockStopHistory') === '1',
    separateBalloonsEntry: search === '?practiceGame=balloons&balloonsBaseline=1',
  }
}
const library: readonly LibraryEntry[] = [{ id:'full-mock',name:'Full mock',description:'Try all twelve tasks, with progress saved between them.',metadata:'Twelve tasks · Saved in this browser',action:'Open full mock',href:'/mock',availability:'Full mock',illustration:<div className="card-symbols" aria-hidden="true"><span>12</span></div> },{
  id: 'stop', name: 'Stop',
  description: 'Press for GO. Wait for NO-GO.',
  metadata: '8 warm-up signals + 80 trials · Keyboard', action: 'Open Stop', href:'/practice/stop',
  availability: 'Practice, local reports and Advanced Training available',
  illustration: <div className="card-symbols" aria-hidden="true"><span>│</span><span>—</span></div>,
}, { id: 'balloons', name: 'Balloons', description: 'Pump or collect. See how your choices turn out.', metadata: '39 balloons · Untimed', action: 'Open Balloons', href:'/practice/balloons', availability: 'Practice, local reports and separate-baseline Advanced Training available', illustration: <BalloonsLibraryStatus /> },
{ id: 'keypresses', name: 'Keypresses', description: 'Wait for GO, then press and release repeatedly until END.', metadata: 'Target: 40 presses within 15 seconds · Keyboard', action: 'Open Keypresses', href:'/practice/keypresses', availability: 'Practice and local reports', illustration: <div className="card-symbols" aria-hidden="true"><span>⌨</span></div> },
{ id: 'arrows', name: 'Arrows', description: 'Follow the colour rule. Choose Left or Right.', metadata: '135 trials · Breaks between sets', action: 'Open Arrows', href:'/arrows.html', availability: 'Practice and local reports', illustration: <div className="card-symbols" aria-hidden="true"><span>←</span><span>→</span></div> },
{ id: 'lengths', name: 'Lengths', description: 'Spot whether the mouth is short or long.', metadata: '90 trials · About 3 minutes', action: 'Open Lengths', href:'/mouth-v13.html', availability: 'Practice and local reports', illustration: <div className="card-symbols" aria-hidden="true"><span>◡</span></div> },
{ id: 'digits', name: 'Digits', description: 'Remember the digits and enter them in order.', metadata: 'Time varies · Allow at least 5 minutes', action: 'Open Digits', href:'/practice/digits', availability: 'Practice and local reports', illustration: <div className="card-symbols" aria-hidden="true"><span>3</span><span>7</span></div> },
{ id: 'cards', name: 'Cards', description: 'Choose a deck. See each gain or loss.', metadata: '80 cards · Untimed', action: 'Open Cards', href:'/practice/cards', availability: 'Practice and local reports', illustration: <div className="card-symbols" aria-hidden="true"><span>◆</span><span>▲</span></div> },
{ id: 'easy-hard', name: 'Easy or Hard', description: 'Choose an effort level for a possible reward.', metadata: '2 minutes · Space button', action: 'Open Easy or Hard', href:'/practice/easy-or-hard', availability: 'Practice and local reports', illustration: <div className="card-symbols" aria-hidden="true"><span>▯</span></div> },
{ id: 'towers', name: 'Towers', description: 'Move the disks to match the target.', metadata: '2-minute puzzle', action: 'Open Towers', href:'/practice/towers', availability: 'Practice, local reports and separate Towers Advanced Training', illustration: <div className="card-symbols" aria-hidden="true"><span>▤</span></div> },
{ id: 'money-exchange-2', name: 'Money Exchange 2', description: 'Give or take in two rounds, then rate fairness.', metadata: 'Two rounds · Untimed', action: 'Open Money Exchange 2', href:'/money2.html', availability: 'Practice and local reports', illustration: <div className="card-symbols" aria-hidden="true"><span>$</span><span>↔</span></div> },
{ id: 'money-exchange-1', name: 'Money Exchange 1', description: 'Choose a transfer, see the return, then rate fairness.', metadata: 'One exchange · Untimed', action: 'Open Money Exchange 1', href:'/money.html', availability: 'Practice and local reports', illustration: <div className="card-symbols" aria-hidden="true"><span>$</span><span>↔</span></div> },
{ id: 'faces', name: 'Faces', description: 'Choose the label that fits the picture and story.', metadata: '14 items', action: 'Open Faces', href:'/faces.html', availability: 'Practice and local reports', illustration: <div className="card-symbols" aria-hidden="true"><span>◡</span></div> }]

export default function App({ createSession = createPreparationRecorder, storagePolicy = 'auto' }: { createSession?: () => PreparationRecorder; storagePolicy?: 'auto' | 'temporary' }) {
  const [balloonsOpen, setBalloonsOpen] = useState(false)
  const [balloonsSeparateBaseline, setBalloonsSeparateBaseline] = useState(false)
  const [keypressesOpen, setKeypressesOpen] = useState(false)
  const [digitsOpen, setDigitsOpen] = useState(false)
  const [cardsOpen, setCardsOpen] = useState(false)
  const [easyHardOpen, setEasyHardOpen] = useState(false)
  const [towersOpen, setTowersOpen] = useState(false)
  const [towersTrainingOpen, setTowersTrainingOpen] = useState(false)
  const chainSaveStatus = useSyncExternalStore(subscribeTrainingSave, trainingSaveStatus)
  const [session, setSession] = useState<PreparationRecorder | null>(null)
  const [mode, setMode] = useState<'baseline' | 'replay' | 'retest'>('baseline')
  const [chain, setChain] = useState<TrainingChain | null>(currentTrainingChain)
  const [viewTraining, setViewTraining] = useState(false)
  const [reservedFormId, setReservedFormId] = useState<string | undefined>()
  const [store, setStore] = useState<StopLocalStore | null>(null)
  const [storageStatus, setStorageStatus] = useState<'checking' | 'persistent' | 'blocked' | 'temporary'>(storagePolicy === 'temporary' ? 'temporary' : 'checking')
  const [history, setHistory] = useState<CheckedHistory | null>(null)
  const [viewHistory, setViewHistory] = useState(false)
  const [restoredReservation, setRestoredReservation] = useState<Reservation | null>(null)
  const [comparisonUnavailable, setComparisonUnavailable] = useState(false)
  const [reviewTemporary, setReviewTemporary] = useState(false)
  const [failedRetest, setFailedRetest] = useState<string | null>(null)
  useCoarseEvent(storageStatus === 'blocked' ? { event: 'stop_storage_failure', error_class: 'unavailable' } : chainSaveStatus === 'failed' ? { event: 'stop_storage_failure', error_class: 'write_failed' } : null)
  const [libraryOverlay, setLibraryOverlay] = useState(false)
  const navigation = useRef(0)
  const [initialEntry, setInitialEntry] = useState(() => parseInitialEntry(window.location.pathname, window.location.search))
  const entryHandled = useRef(false)
  const temporaryRetest = activeTabResults().findLast(result => result.mode === 'retest' && result.storageMode === 'temporary_memory')
  async function refreshHistory(selected = store) {
    if (!selected) return
    const state = await selected.read()
    const checked = inspectLocalState(state)
    const completedSession = activeTabResults().some(r => r.sessionId === session?.sessionId)
    if (!selected.sameInstallation(state)) { restoreTrainingChain(null, true); setChain(null); setRestoredReservation(null); if (!completedSession) setSession(null); setViewTraining(false); setHistory(checked); return }
    reconcileTrainingDeletion(state)
    if (!currentTrainingChain() && mode === 'retest') { if (!completedSession) setSession(null); setRestoredReservation(null); setViewTraining(false) }
    setChain(currentTrainingChain())
    setHistory(checked)
    if (!pendingRetestCompletion() && !['failed', 'pending'].includes(trainingSaveStatus())) { setChain(checked.activeChain); restoreTrainingChain(checked.activeChain) }
  }
  useEffect(() => subscribeTrainingSave(() => setChain(currentTrainingChain())), [])
  useEffect(() => store?.subscribeDeletion(() => { void refreshHistory(store).catch(() => undefined) }), [store, mode])
  async function checkStorage(request = navigation.current) {
    try {
      const opened = await StopLocalStore.open()
      const initial = await opened.read()
      for (const claim of Object.values(initial.reservations)) if (claim.ownerTabId === stopTabIdentity() &&
        !claim.armed && (claim.family !== 'retest' || claim.expiresAtMs !== null && Date.now() >= claim.expiresAtMs))
        await opened.release(claim.sessionId, false)
      const state = await opened.read()
      const checked = inspectLocalState(state)
      setStopLocalStore(opened)
      stopExposure.hydrate(Object.values(state.exposures).map(item => ({ formId: item.formId,
        sessionId: item.sessionId ?? `retained:${item.formId}`, exposedAtMs: 0 })))
      const ownReservation = Object.values(state.reservations).find(item => item.chainId === checked.activeChain?.id &&
        item.ownerTabId === stopTabIdentity() && !item.armed && item.expiresAtMs !== null && Date.now() < item.expiresAtMs)
      if (ownReservation) {
        try {
          stopExposure.claim(ownReservation.sessionId, ownReservation.formId, ownReservation.expiresAtMs!)
          setRestoredReservation({ recorder: createPreparationRecorder(ownReservation.sessionId), formId: ownReservation.formId,
            expiresAtMs: ownReservation.expiresAtMs! })
          if (request === navigation.current) setViewTraining(true)
        } catch { setRestoredReservation(null) }
      } else setRestoredReservation(null)
      restoreStopRecords(checked.valid, checked.invalid)
      restoreTrainingChain(checked.activeChain)
      setChain(checked.activeChain)
      setHistory(checked); setStore(opened); setStorageStatus('persistent')
    } catch { setStopLocalStore(null); setStorageStatus('blocked') }
  }
  useEffect(() => {
    if (storagePolicy !== 'auto') return
    const request = navigation.current
    const timer = window.setTimeout(() => { void checkStorage(request) }, 0)
    return () => window.clearTimeout(timer)
  }, [storagePolicy])
  const mounted = useRef(false)
  useEffect(() => {
    if (mounted.current && !session) document.querySelector<HTMLElement>('h1')?.focus()
    mounted.current = true
  }, [session])
  function retireInitialEntry() {
    if (entryHandled.current) return
    entryHandled.current = true
    if (window.location.search && !cleanPracticeRoutes[window.location.pathname]) window.history.replaceState(null, '', '/practice')
    setInitialEntry(null)
  }
  function open(id: string, nextMode: 'baseline' | 'replay' = 'baseline') {
    retireInitialEntry()
    setLibraryOverlay(false)
    if (id !== 'stop') {
      navigation.current++
      if (session || viewHistory || viewTraining || reviewTemporary) clearStopView()
    }
    if (id === 'full-mock') { window.location.assign('/mock'); return }
    if (id === 'balloons') { setBalloonsOpen(true); return }
    if (id === 'keypresses') { setKeypressesOpen(true); return }
    if (id === 'arrows') { window.location.assign(new URL('./arrows.html', document.baseURI).href); return }
    if (id === 'lengths') { window.location.assign(new URL('./mouth-v13.html', document.baseURI).href); return }
    if (id === 'digits') { setDigitsOpen(true); return }
    if (id === 'cards') { setCardsOpen(true); return }
    if (id === 'easy-hard') { setEasyHardOpen(true); return }
    if (id === 'towers') { setTowersOpen(true); return }
    if (id === 'towers-training') { setTowersTrainingOpen(true); return }
    if (id === 'money-exchange-2') { window.location.assign(new URL('./money2.html', document.baseURI).href); return }
    if (id === 'money-exchange-1') { window.location.assign(new URL('./money.html', document.baseURI).href); return }
    if (id === 'faces') { window.location.assign(new URL('./faces.html', document.baseURI).href); return }
    if (id !== 'stop') return
    navigation.current++; setReviewTemporary(false); setComparisonUnavailable(false)
    setMode(nextMode)
    setViewTraining(false)
    setViewHistory(false)
    setReservedFormId(undefined)
    setRestoredReservation(null)
    const next = createSession()
    next.record('guide_opened', { source: 'library' })
    setSession(next)
  }
  useEffect(() => {
    if (entryHandled.current || !initialEntry) return
    const { practice, stopHistory, separateBalloonsEntry } = initialEntry
    if (!practice && !stopHistory) return
    if ((stopHistory || practice === 'stop') && storageStatus === 'checking') return
    if ((stopHistory || practice === 'stop') && storageStatus === 'blocked') return
    retireInitialEntry()
    if (stopHistory) {
      if (storageStatus === 'persistent') setViewHistory(true)
      return
    }
    if (practice === 'balloons') setBalloonsSeparateBaseline(separateBalloonsEntry)
    open(practice!)
  }, [storageStatus, initialEntry])
  function startTraining(result: StopResult) {
    setLibraryOverlay(false)
    if (!verifyCompletedResult(result)) return
    try { setChain(beginTrainingChain(result)) }
    catch { setChain(currentTrainingChain()) }
    setViewTraining(true)
    setSession(null)
  }
  async function startSavedTraining(result: StopResult, signal: AbortSignal) {
    if (!store) throw new Error('Local history is unavailable')
    const selected = store, request = ++navigation.current
    try {
      const started = await beginSavedTrainingChain(result, selected, signal)
      if (request !== navigation.current || signal.aborted) return
      if (!await checkTrainingChain(started)) throw new Error('Saved training authority changed')
      if (request !== navigation.current || signal.aborted) return
      setChain(started); setSession(null); setViewHistory(false); setViewTraining(true)
    } catch (error) { await refreshHistory(selected); throw error }
  }
  function retestCompleted(result: StopResult) {
    const current = currentTrainingChain()
    // The run may finish saving after its component exits. Never apply that
    // callback to a replacement chain or overwrite its newer attempt history.
    if (!current || current.id !== chain?.id || result.sessionId !== session?.sessionId || result.form.id !== reservedFormId ||
      current.retest && current.retest.sessionId !== result.sessionId || !verifyCompletedResult(result) || !verifyCompletedResult(current.baseline)) return
    if (current.retest === result) return
    setChain(updateTrainingChain({ retest: result,
      retestAttempts: Object.freeze([...current.retestAttempts.filter(item => item.sessionId !== result.sessionId), { sessionId: result.sessionId, formId: result.form.id, valid: true }]),
      status: 'complete' }))
  }
  function showComparison(result: StopResult) {
    const current = currentTrainingChain()
    if (current?.retest?.sessionId !== result.sessionId) return
    void resumeTraining(current)
  }
  async function resumeTraining(selected: TrainingChain) {
    const request = ++navigation.current
    setComparisonUnavailable(false)
    const ok = await checkTrainingChain(selected)
    if (request !== navigation.current) return
    if (!ok) { setComparisonUnavailable(true); return }
    setLibraryOverlay(false); setReviewTemporary(false); setSession(null); setReservedFormId(undefined); setViewTraining(true)
  }
  function retestInvalid(draft: DevelopmentDraft) {
    if (!currentTrainingChain() || !chain || !draft.form || chain.retestAttempts.some(item => item.sessionId === draft.sessionId)) return
    setChain(updateTrainingChain({ retestAttempts: Object.freeze([...chain.retestAttempts,
      { sessionId: draft.sessionId, formId: draft.form.id, valid: false }]), status: 'drill_complete' }))
  }
  function clearStopView() {
    navigation.current++; setReviewTemporary(false); setComparisonUnavailable(false)
    if (session && mode === 'retest') {
      stopExposure.release(session.sessionId)
      void store?.release(session.sessionId, stopExposure.snapshot().some(marker => marker.sessionId === session.sessionId))
      if (currentTrainingChain() && !pendingRetestCompletion() && currentTrainingChain()?.status !== 'complete') setChain(updateTrainingChain({ status: 'drill_complete' }))
    }
    setSession(null)
    setViewTraining(false)
    setViewHistory(false)
    setRestoredReservation(null)
  }
  function pushPracticeURL(path: string) {
    if (window.location.pathname + window.location.search !== path) window.history.pushState(null, '', path)
  }
  function closeOtherPractice() {
    setBalloonsOpen(false); setBalloonsSeparateBaseline(false); setKeypressesOpen(false)
    setDigitsOpen(false); setCardsOpen(false); setEasyHardOpen(false); setTowersOpen(false); setTowersTrainingOpen(false)
  }
  function leaveToLibrary() {
    retireInitialEntry()
    pushPracticeURL('/practice')
    closeOtherPractice()
    // Keep the completed view mounted for Back, including an unsaved tab-only result.
    if (session && activeTabResults().some(result => result.sessionId === session.sessionId)) {
      navigation.current++; setLibraryOverlay(true)
    } else { setLibraryOverlay(false); clearStopView() }
  }
  useEffect(() => {
    const follow = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest('a[href]') : null
      if (event.defaultPrevented || !(link instanceof HTMLAnchorElement) || event.button !== 0 ||
        event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ||
        link.hasAttribute('download') || link.target && link.target !== '_self') return
      const destination = new URL(link.href)
      if (destination.origin !== window.location.origin || destination.hash || destination.search) return
      const game = cleanPracticeRoutes[destination.pathname]
      if (destination.pathname !== '/practice' && !game) return
      event.preventDefault()
      if (game) { closeOtherPractice(); pushPracticeURL(destination.pathname); open(game) }
      else leaveToLibrary()
    }
    const back = () => {
      const game = cleanPracticeRoutes[window.location.pathname]
      if (!window.location.search && game === 'stop' && libraryOverlay && session &&
        activeTabResults().some(result => result.sessionId === session.sessionId)) {
        closeOtherPractice(); setLibraryOverlay(false)
      } else if (!window.location.search && window.location.pathname === '/practice') leaveToLibrary()
      else if (game || window.location.search) {
        closeOtherPractice(); clearStopView(); setLibraryOverlay(false)
        entryHandled.current = false
        setInitialEntry(parseInitialEntry(window.location.pathname, window.location.search))
      }
    }
    document.addEventListener('click', follow)
    window.addEventListener('popstate', back)
    return () => { document.removeEventListener('click', follow); window.removeEventListener('popstate', back) }
  })
  async function deleteAll() {
    if (!store) return
    navigation.current++
    stopAnalytics.setConsent(false)
    await store.deleteAll()
    stopExposure.clear(); restoreStopRecords([], []); restoreTrainingChain(null, true)
    setChain(null); setSession(null); setViewTraining(false)
    await refreshHistory(store)
  }
  const towersTrainingEntry = <button className="secondary" onClick={() => open('towers-training')}>Open Towers Advanced Training</button>
  if (balloonsOpen) return <BalloonsJourney separateBaseline={balloonsSeparateBaseline} onLibrary={leaveToLibrary} />
  if (keypressesOpen) return <KeypressesJourney onLibrary={leaveToLibrary} />
  if (digitsOpen) return <DigitsJourney onLibrary={leaveToLibrary} />
  if (cardsOpen) return <CardsJourney onLibrary={leaveToLibrary} />
  if (easyHardOpen) return <EasyHardJourney onLibrary={leaveToLibrary} />
  if (towersOpen) return <TowersJourney runtime={towersRuntime} onLibrary={leaveToLibrary} />
  if (towersTrainingOpen) return <TowersTrainingJourney onLibrary={() => setTowersTrainingOpen(false)} />
  const pendingStopRoute = !entryHandled.current && (initialEntry?.stopHistory || initialEntry?.practice === 'stop')
  const stopView = Boolean(session || viewHistory || viewTraining || reviewTemporary || pendingStopRoute)
  const libraryContent = <>
      <GameLibrary entries={library} />
      {towersTrainingEntry}
      {candidateAnalyticsAvailable && <AnalyticsConsent />}
      {(storageStatus === 'persistent' || storageStatus === 'temporary') && chain && <button onClick={() => { void resumeTraining(chain) }}>Resume Stop training</button>}
      {(storageStatus === 'persistent' || storageStatus === 'temporary') && temporaryRetest && <button className="secondary" onClick={() => { setLibraryOverlay(false); navigation.current++; setReviewTemporary(true) }}>Review temporary retest</button>}
      {store && <button className="secondary" onClick={() => { setLibraryOverlay(false); clearStopView(); void refreshHistory(store); setViewHistory(true) }}>Stop history</button>}
      {storageStatus === 'temporary' && <p className="note">{storageDisclosure()}</p>}
    </>
  return <Shell onLibrary={leaveToLibrary}>
    <div hidden={libraryOverlay}>
    {comparisonUnavailable && <p role="alert">Comparison unavailable. The saved training dependencies or original installation could not be confirmed. Any retained temporary retest can still be reviewed in this tab.</p>}
    {chainSaveStatus === 'failed' && <div className="panel" role="alert"><p>{CHAIN_SAVE_FAILURE}</p>
      <p>The current training changes are temporary. Reloading restores only the last successfully saved state.</p>
      <button onClick={() => void retryTrainingSave()}>Try saving training again</button></div>}
    {chainSaveStatus === 'pending' && <p role="status">Saving training changes. Keep this tab open until saving finishes.</p>}
    {stopView && storageStatus === 'checking' ? <><div className="panel"><h1>Checking Stop local storage</h1></div><GameLibrary entries={library} /></> :
    stopView && storageStatus === 'blocked' ? <><div className="panel"><h1>Results cannot be saved in this browser</h1>
      <p>You can complete Stop in this tab, but closing or refreshing the page will erase the result. History will be unavailable. A baseline, drill, and retest can stay linked only while this tab remains open.</p>
      <button onClick={() => setStorageStatus('temporary')}>Continue without saving</button><button className="secondary" onClick={() => { setStorageStatus('checking'); void checkStorage() }}>Try storage check again</button></div><GameLibrary entries={library} /></> :
    reviewTemporary && temporaryRetest ? <section className="journey"><p role="status">{failedRetest === temporaryRetest.sessionId ? CHAIN_SAVE_FAILURE : 'This result is retained only in this tab for review. It is not saved in this browser.'}</p>
      <StopReport result={temporaryRetest} onReplay={() => open('stop', 'replay')} onLibrary={leaveToLibrary} /></section> :
    viewHistory && history && store ? <StopHistory history={history} store={store} onRefresh={() => refreshHistory(store)} onLibrary={() => { navigation.current++; setViewHistory(false) }} onPractice={() => open('stop')} onDeleteAll={deleteAll} onTraining={startSavedTraining} /> :
    session ? <StopJourney key={session.sessionId} recorder={session} mode={mode} specificationVersion={mode === 'retest' ? chain?.baseline.specificationVersion : '1.3'} reservedFormId={reservedFormId} chainId={chain?.id} requiredSetup={mode === 'retest' ? chain?.baseline.setup : undefined}
      onStorageFailure={() => { if (mode === 'retest') setFailedRetest(session.sessionId); setStopLocalStore(null); setStore(null); setStorageStatus('temporary') }}
      onLibrary={leaveToLibrary}
      onRestart={() => { if (mode === 'retest') { stopExposure.release(session.sessionId); void store?.release(session.sessionId, stopExposure.snapshot().some(marker => marker.sessionId === session.sessionId)); if (currentTrainingChain() && chain?.status !== 'complete') setChain(updateTrainingChain({ status: 'drill_complete' })); setSession(null); setViewTraining(true) } else open('stop', mode) }}
      onReplay={() => open('stop', 'replay')} onTraining={chain && chain.status !== 'complete' ? undefined : startTraining} onRetestResult={chain?.retest?.sessionId === session.sessionId ? showComparison : undefined} onRetestComplete={retestCompleted} onRetestInvalid={retestInvalid} /> : chain && viewTraining && chain.status !== 'complete' ?
      <TrainingFlow key={chain.id} chain={chain} restoredReservation={restoredReservation} onChain={setChain} onLibrary={() => { setRestoredReservation(null); setViewTraining(false) }}
        onRetest={reservation => { if (pendingRetestCompletion() || currentTrainingChain()?.retest) return; setRestoredReservation(null); setChain(updateTrainingChain({ status: 'retesting' })); setMode('retest'); setReservedFormId(reservation.formId); setSession(reservation.recorder) }}
        onNewBaseline={() => open('stop', 'baseline')} /> : chain && viewTraining && chain.status === 'complete' ?
      <TrainingFlow key={chain.id} chain={chain} onChain={setChain} onLibrary={() => setViewTraining(false)}
        onRetest={() => {}} onNewBaseline={() => open('stop', 'baseline')} /> : libraryContent}
    </div>
    {libraryOverlay && libraryContent}
  </Shell>
}
