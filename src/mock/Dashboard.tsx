import { useEffect, useRef, useState } from 'react'
import { Shell } from '../core/Shell'
import { KeypressesJourney } from '../keypresses/Journey'
import { DigitsJourney } from '../digits/Journey'
import { CardsJourney } from '../cards/Journey'
import { EasyHardJourney } from '../easy-hard/Journey'
import { TowersJourney } from '../towers/Journey'
import { TowersRuntime } from '../towers/runtime'
import { BalloonsJourney } from '../balloons/Journey'
import { StopJourney } from '../stop/Journey'
import { createPreparationRecorder } from '../stop/preparation'
import type { PreparationRecorder } from '../stop/preparation'
import { StopLocalStore, inspectLocalState, setStopLocalStore } from '../stop/storage'
import { stopExposure } from '../stop/exposure'
import { restoreStopRecords } from '../stop/run'
import { GAMES, initialPreferences } from './contract'
import type { Mock, Preferences, Root } from './contract'
import { MockStore, MockStoreError, acquireMockOwner } from './storage'
import { MockSession } from './session'
import type { MockJourneyContext } from './journey-context'
import { InFlightLaunchAction, ReturnIntent } from './journey-context'
import { ReactGameActionBoundary } from './ReactGameActionBoundary'
import { reportUrl, verifiedReportTarget } from './report-route'
import { mockReturnUrl } from './dedicated'
import '../App.css'

const labels = ['Keypresses','Stop','Digits','Arrows','Balloons','Towers','Lengths','Cards','Easy or Hard','Money Exchange 1','Money Exchange 2','Faces']
const reportDescriptions=['press counts and timing','GO and NO-GO accuracy and timing','sequence recall by length','rule choices and response timing','pump and collect choices','puzzle moves and time limit','mouth responses and simulated rewards','deck choices and simulated gains or losses','effort choices and simulated rewards','transfer, scripted return and fairness rating','two round transfers and fairness ratings','portrait interpretation and response timing']
const dedicatedRoutes: Partial<Record<typeof GAMES[number],string>> = { arrows:'/arrows.html', lengths:'/mouth-v13.html', money_1:'/money.html', money_2:'/money2.html', faces:'/faces.html' }
const practiceUrl=(game:typeof GAMES[number])=>dedicatedRoutes[game]??`/practice?practiceGame=${encodeURIComponent(game==='easy_hard'?'easy-hard':game)}`
const towersRuntime = new TowersRuntime()
function mockPhaseLabel(phase: Mock['phase']) {
  return ({ preflight: 'Ready to begin', boundary: 'Choose your next game', launching: 'Checking this game',
    in_game: 'Game in progress', checking: 'Checking saved result', break: 'On a break',
    finished: 'Finished', ended_early: 'Finished early' } as const)[phase]
}
function MockReturnBar({onReturn}:{onReturn:()=>Promise<void>}) {
  const [error,setError]=useState(''),[pending,setPending]=useState(false)
  return <div className="mock-return-bar"><button data-mock-return-intent disabled={pending} onClick={()=>{setPending(true);void onReturn().catch(()=>setError('This result needs checking before you return. Try again.')).finally(()=>setPending(false))}}>Return to mock</button>{error&&<p role="alert">{error}</p>}</div>
}
function PreferencesFields({preferences,change}:{preferences:Preferences;change:(next:Preferences)=>void}){
 return <fieldset className="mock-preferences"><legend>Settings for future starts</legend>
  <label>Desired controls <select value={preferences.controls} onChange={event=>change({...preferences,controls:event.target.value as Preferences['controls']})}><option value="physical_keyboard">Physical keyboard</option><option value="alternative">Alternative controls where supported</option></select></label>
  <label><input type="checkbox" checked={preferences.reducedMotion} onChange={event=>change({...preferences,reducedMotion:event.target.checked})}/> Reduced motion where the game offers it</label>
  <label>Digits presentation <select value={preferences.digitsMode} onChange={event=>change({...preferences,digitsMode:event.target.value as Preferences['digitsMode']})}><option value="visual">Visual</option><option value="auditory">Auditory, subject to local voice and audible check</option></select></label>
  <label>Time to enter your Digits answer <select value={preferences.digitsEntryMs} onChange={event=>change({...preferences,digitsEntryMs:Number(event.target.value) as Preferences['digitsEntryMs']})}><option value="20000">20 seconds (default)</option><option value="35000">35 seconds</option></select></label><p>Choose more time if you need it to type or tap the remembered digits.</p>
  <label>Lengths display <select value={preferences.lengthsVariant} onChange={event=>change({...preferences,lengthsVariant:event.target.value as Preferences['lengthsVariant']})}><option value="standard">Standard (default)</option><option value="visual_accommodation">Larger visual difference</option></select></label><p>The second option makes the mouth difference easier to see.</p>
  <label>Time to answer Faces <select value={preferences.facesMode} onChange={event=>change({...preferences,facesMode:event.target.value as Preferences['facesMode']})}><option value="standard-v1">Standard: 30 seconds, then 7 seconds</option><option value="extended-v1">More time: 60 seconds, then 14 seconds</option></select></label><p>The first time applies to situation-and-photo items; the second applies to photo-only items.</p>
  <p>Each game checks its actual device, controls and readiness again. These preferences do not change past results.</p>
 </fieldset>
}
export default function MockDashboard() {
  const [store, setStore] = useState<MockStore | null>(null), [root, setRoot] = useState<Root | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null), [session, setSession] = useState<MockSession | null>(null)
  const [launchId, setLaunchId] = useState<string | null>(null)
  const [needsResume,setNeedsResume]=useState(false)
  const [stopRecorder, setStopRecorder] = useState<PreparationRecorder | null>(null)
  const [goal, setGoal] = useState<Mock['goal']>('early_career_finance')
  const [invitation, setInvitation] = useState<Mock['invitation'] | null>(null)
  const [privacy, setPrivacy] = useState(false), [preferences, setPreferences] = useState<Preferences>(initialPreferences)
  const [preflight, setPreflight] = useState(1)
  const [skipConfirm, setSkipConfirm] = useState<number | null>(null)
  const [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const [recoveryBusy,setRecoveryBusy]=useState(false),[recoveryError,setRecoveryError]=useState('')
  const recoverySeen=useRef<string|null>(null)
  const recoveryController=useRef<AbortController|null>(null)
  const returnPending=useRef(false)
  const terminalChecks=useRef(new InFlightLaunchAction<'ready'|'review_only'>())
  const continuations=useRef(new InFlightLaunchAction<void>())
  const returnIntent=useRef(new ReturnIntent())
  const retiredLaunches=useRef(new Set<string>())
  const [viewBlocked,setViewBlocked]=useState(false)
  const actionPending=useRef<object|null>(null), pageEpoch=useRef(0), storeRef=useRef<MockStore|null>(null)
  const [corrupt,setCorrupt]=useState(false)
  const [cardStatus,setCardStatus]=useState<Record<number,'checking'|'available'|'unavailable'|'deleted'|'replaced'|'corrupt'>>({})
  const releaseOwner = useRef<(() => void) | null>(null), alive = useRef(true), sessionRef = useRef<MockSession | null>(null)
  const cardCheckEpoch=useRef(0),activeIdRef=useRef<string|null>(null)
  const cardCheckAbort=useRef<AbortController|null>(null),cardCheckInFlight=useRef(false)
  useEffect(() => {
    alive.current = true
    const mountLife=new AbortController()
    const pageExit = () => { returnIntent.current.retire();pageEpoch.current++;alive.current=false;mountLife.abort();recoveryController.current?.abort();storeRef.current?.close();document.documentElement.dataset.mockRetired='true';setViewBlocked(true);cardCheckEpoch.current++; cardCheckAbort.current?.abort(); releaseOwner.current?.(); releaseOwner.current=null; sessionRef.current?.dispose() }
    const restore = (event: PageTransitionEvent) => { if(event.persisted) window.location.reload() }
    window.addEventListener('pagehide',pageExit)
    document.addEventListener('freeze',pageExit)
    window.addEventListener('pageshow',restore)
    void MockStore.open(mountLife.signal).then(async opened => { if(mountLife.signal.aborted){opened.close();return}storeRef.current=opened;const value = await opened.read(); if (alive.current&&!mountLife.signal.aborted) { setStore(opened); setRoot(value);
      const hint = new URLSearchParams(window.location.search).get('mock')
      if (hint && value.mocks.some(item => item.id === hint)) { const selectedSession = new MockSession(opened, hint); sessionRef.current = selectedSession;activeIdRef.current=hint;
        setSession(selectedSession); setActiveId(hint); setPreferences(value.mocks.find(item=>item.id===hint)!.settings.at(-1)!.preferences)
        setNeedsResume(['boundary','break'].includes(value.mocks.find(item=>item.id===hint)!.phase)) }
    } else opened.close() })
      .catch(cause => { if (alive.current&&!mountLife.signal.aborted) {setError(cause instanceof Error ? cause.message : 'Local mock storage is unavailable.');setCorrupt(cause instanceof MockStoreError&&cause.kind==='corrupt')} })
    return () => { document.removeEventListener('freeze',pageExit);window.removeEventListener('pagehide',pageExit);window.removeEventListener('pageshow',restore)
      returnIntent.current.retire();alive.current = false;mountLife.abort();recoveryController.current?.abort();storeRef.current?.close();cardCheckEpoch.current++;cardCheckAbort.current?.abort();cardCheckAbort.current=null;cardCheckInFlight.current=false;releaseOwner.current?.(); sessionRef.current?.dispose() }
  }, [])
  const rootView = root?.mocks.find(item => item.id === activeId) ?? null
  const selected = session?.viewFor(rootView) ?? rootView
  const unresolved=viewBlocked||!!session?.hasUnresolved||!!store?.hasUnresolved
  async function recoverCurrentLaunch(force=false){
    const current=sessionRef.current, id=activeIdRef.current
    if(!current||!id||actionPending.current||current.hasUnresolved||storeRef.current?.hasUnresolved)return
    const key=selected?.id===id?`${id}:${selected.revision}:${selected.activeLaunchId}`:null
    if(!force&&recoverySeen.current===key)return
    recoverySeen.current=key;setRecoveryBusy(true);setRecoveryError('')
    const controller=new AbortController(),epoch=pageEpoch.current
    recoveryController.current=controller
    let release:(()=>void)|null=null
    try{
      const latest=await current.read()
      if(controller.signal.aborted||!alive.current||pageEpoch.current!==epoch||sessionRef.current!==current||activeIdRef.current!==id)return
      if(!['launching','in_game','checking'].includes(latest.phase)||!latest.activeLaunchId)return
      release=await acquireMockOwner(controller.signal)
      if(controller.signal.aborted||!alive.current||pageEpoch.current!==epoch||sessionRef.current!==current||activeIdRef.current!==id)return
      const fresh=await current.read()
      if(fresh.activeLaunchId!==latest.activeLaunchId||fresh.revision!==latest.revision)throw new MockStoreError('stale','This game changed. Check it again.')
      const attempt=fresh.slots[fresh.cursor-1].attempts.find(item=>item.launchId===fresh.activeLaunchId)
      if(fresh.phase==='launching'&&attempt?.phase==='pending_launch'&&!attempt.nativeArm)
        await current.cancelConfirmedNoArm(fresh.activeLaunchId!)
      else if(attempt?.nativeArm)await current.reconcile(fresh.activeLaunchId!,true)
      else throw new MockStoreError('unknown','This game cannot be checked yet.')
      if(!controller.signal.aborted&&alive.current&&pageEpoch.current===epoch)await refresh(storeRef.current)
    }catch(cause){
      if(alive.current&&!controller.signal.aborted&&pageEpoch.current===epoch){setRecoveryError(cause instanceof Error&&cause.message.includes('Another mock is active')
        ? 'This game may still be open in another tab. Close it, then check again.'
        : 'This game needs another check before you can continue. Its saved status is not confirmed.')
        try{await refresh(storeRef.current)}catch{/* Keep current controls unavailable. */}}
    }finally{release?.();if(recoveryController.current===controller)recoveryController.current=null;if(alive.current&&pageEpoch.current===epoch)setRecoveryBusy(false)}
  }
  useEffect(()=>{
    if(!selected||launchId||busy||recoveryBusy||unresolved||!['launching','in_game','checking'].includes(selected.phase))return
    void recoverCurrentLaunch()
  },[selected?.id,selected?.revision,selected?.phase,launchId,busy,recoveryBusy,unresolved])
  const lastBreak=selected?.breaks.findLast(record=>record.endWallMs!==null)
  const summaryId=selected&&['finished','ended_early'].includes(selected.phase)?selected.id:null
  function withdrawCardChecks(){
    cardCheckEpoch.current++
    cardCheckAbort.current?.abort();cardCheckAbort.current=null;cardCheckInFlight.current=false
    if(alive.current)setCardStatus({})
  }
  async function checkSavedResults(allowForeground=false){
    const current=sessionRef.current,mockId=activeIdRef.current
    if(actionPending.current&&!allowForeground||current?.isPending||current?.hasUnresolved||!current||!summaryId||mockId!==summaryId||cardCheckInFlight.current||document.visibilityState!=='visible'||!document.hasFocus())return
    const epoch=++cardCheckEpoch.current,controller=new AbortController()
    cardCheckAbort.current=controller;cardCheckInFlight.current=true
    try{
      const fresh=await current.read()
      if(controller.signal.aborted||cardCheckEpoch.current!==epoch||!['finished','ended_early'].includes(fresh.phase))return
      const references=fresh.slots.flatMap(slot=>{
        const attempt=slot.attempts.find(item=>item.launchId===slot.acceptedLaunchId)??slot.attempts.findLast(item=>item.reference)
        return attempt?.nativeArm&&attempt.reference?[slot.index]:[]
      })
      setCardStatus(Object.fromEntries(references.map(index=>[index,'checking'])))
      const checked:Array<readonly [number,'available'|'unavailable'|'deleted'|'replaced'|'corrupt']>=[]
      for(const index of references){
        if(controller.signal.aborted)break
        try{const availability=await current.sourceStatus(index,controller.signal)
          checked.push([index,availability==='unchecked'?'unavailable':availability])}
        catch{checked.push([index,'unavailable'])}
      }
      if(alive.current&&cardCheckAbort.current===controller&&!controller.signal.aborted&&cardCheckEpoch.current===epoch&&
        activeIdRef.current===mockId&&document.visibilityState==='visible'&&document.hasFocus()){
        setCardStatus(Object.fromEntries(checked))
        const updated=await current.store.read()
        if(alive.current&&cardCheckAbort.current===controller&&!controller.signal.aborted&&cardCheckEpoch.current===epoch&&activeIdRef.current===mockId)
          setRoot(updated)
      }
    }catch{
      if(alive.current&&cardCheckAbort.current===controller&&!controller.signal.aborted&&cardCheckEpoch.current===epoch)setCardStatus({})
    }finally{
      if(cardCheckAbort.current===controller){cardCheckAbort.current=null;cardCheckInFlight.current=false}
    }
  }
  useEffect(()=>{
    if(!summaryId){withdrawCardChecks();return}
    const visible=()=>document.visibilityState==='visible'&&document.hasFocus()
    let timer:number|null=null
    const stop=()=>{if(timer!==null){window.clearInterval(timer);timer=null}withdrawCardChecks()}
    const check=()=>{if(visible())void checkSavedResults();else stop()}
    const start=()=>{if(!visible())return;if(timer===null)timer=window.setInterval(check,1000);void checkSavedResults()}
    const restore=()=>{stop();start()}
    start()
    window.addEventListener('focus',restore);window.addEventListener('pageshow',restore)
    window.addEventListener('blur',stop);window.addEventListener('pagehide',stop)
    document.addEventListener('visibilitychange',restore)
    return()=>{stop();window.removeEventListener('focus',restore);window.removeEventListener('pageshow',restore)
      window.removeEventListener('blur',stop);window.removeEventListener('pagehide',stop)
      document.removeEventListener('visibilitychange',restore)}
  },[summaryId])
  async function refresh(opened = store) { if (opened) {const current=await opened.read();if(alive.current){setRoot(current)}} }
  async function perform(work: () => Promise<void>) {
    if (actionPending.current) return
    const action={},epoch=pageEpoch.current
    actionPending.current=action;setBusy(true); setError('')
    try { if(session&&selected)await session.fromView(selected,work);else await work();if(alive.current&&pageEpoch.current===epoch&&!sessionRef.current?.hasUnresolved&&!store?.hasUnresolved)setViewBlocked(false) } catch (cause) { if(!alive.current||pageEpoch.current!==epoch)return;setViewBlocked(true);setError(cause instanceof Error ? cause.message : 'The saved mock could not be confirmed.');try{await refresh()}catch{/* Keep all mutation controls withdrawn until a current view can be published. */} }
    finally { if(actionPending.current===action){actionPending.current=null;if (alive.current&&pageEpoch.current===epoch) setBusy(false)} }
  }
  async function create() {
    if (!store || !root || !privacy || !invitation) return
    await perform(async () => {
      const next = await store.create({ requestId: crypto.randomUUID(), expectedRevision: root.revision, goal, invitation, preferences, createdWallMs: Date.now() })
      const id=next.lastRootCommand!.targetMockId!
      const createdSession=new MockSession(store,id);sessionRef.current=createdSession;setSession(createdSession)
      cardCheckEpoch.current++;activeIdRef.current=id;setCardStatus({});setRoot(next); setActiveId(id);setNeedsResume(false)
    })
  }
  async function choose(id: string) {
    returnIntent.current.retire()
    if (!store) return
    await perform(async () => {
      releaseOwner.current?.(); releaseOwner.current = null; sessionRef.current?.dispose()
      const selectedSession = new MockSession(store, id)
      sessionRef.current=selectedSession
      cardCheckEpoch.current++;activeIdRef.current=id;setCardStatus({});setSession(selectedSession); setActiveId(id); setLaunchId(null)
      const opened=await selectedSession.read();setPreferences(opened.settings.at(-1)!.preferences)
      setNeedsResume(['boundary','break'].includes(opened.phase))
      await refresh(store)
    })
  }
  async function start() { if (!session) return; await perform(async () => { await session.start(); await refresh() }) }
  async function beginGame() {
    if (!session || !selected || busy) return
    await perform(async () => {
      const currentGame=selected.slots[selected.cursor-1].game
      if(needsResume)throw Error('Resume this mock before opening a game.')
      if(selected.settings.at(-1)!.preferences.controls==='alternative'&&['keypresses','stop','easy_hard'].includes(currentGame))
        throw Error('This task requires a physical keyboard. Change the future-start setting, recheck the native controls, omit this slot or finish early.')
      const release = await acquireMockOwner()
      releaseOwner.current = release
      try {
        const id = crypto.randomUUID()
        if (selected.slots[selected.cursor - 1].game === 'stop') {
          const native = await StopLocalStore.openForMock(), state = await native.read(), checked = inspectLocalState(state)
          setStopLocalStore(native)
          stopExposure.hydrate(Object.values(state.exposures).map(item => ({ formId:item.formId,
            sessionId:item.sessionId ?? `retained:${item.formId}`, exposedAtMs:0 })))
          restoreStopRecords(checked.valid,checked.invalid)
          const recorder = createPreparationRecorder()
          recorder.record('guide_opened',{source:'library'})
          setStopRecorder(recorder)
        }
        await session.launchWithId(id)
        const game = selected.slots[selected.cursor - 1].game, route = dedicatedRoutes[game]
        if (route) {
          await refresh(); release(); releaseOwner.current = null
          window.location.assign(`${route}?mock=${encodeURIComponent(selected.id)}&launch=${encodeURIComponent(id)}`)
        } else {
          await session.claim(id, game)
          await refresh(); setLaunchId(id)
        }
      } catch (cause) { release(); releaseOwner.current = null; throw cause }
    })
  }
  const mockContext: MockJourneyContext | null = session && launchId && selected?.activeLaunchId===launchId && selected?.slots[selected.cursor - 1].game &&
    ['keypresses','stop','digits','cards','easy_hard','towers','balloons'].includes(selected.slots[selected.cursor - 1].game) ? {
    launchId,
    preferences: selected.settings.at(-1)!.preferences,
    beginReturnIntent: () => returnIntent.current.begin(),
    retireReturnIntent: () => returnIntent.current.retire(),
    finishReturnIntent: signal => returnIntent.current.finish(signal),
    beforeArm: async arm => { await session.armPending(launchId, arm); await refresh() },
    terminal: () => {
      const current=()=>alive.current&&sessionRef.current===session&&activeIdRef.current===selected.id&&!retiredLaunches.current.has(launchId)
      if(!current())return Promise.reject(Error('Mock launch retired'))
      return terminalChecks.current.run(launchId,async()=>{
      if(!current())throw Error('Mock launch retired')
      const mock=await session.reconcile(launchId)
      if(!current())throw Error('Mock launch retired')
      const ready=mock.slots[mock.cursor - 1].attempts.find(item=>item.launchId===launchId)?.phase==='terminal_verified'
      if(ready)await refresh()
      if(!current())throw Error('Mock launch retired')
      return ready?'ready':'review_only' }) },
    continue: signal => {
      const current=()=>alive.current&&sessionRef.current===session&&activeIdRef.current===selected.id&&!retiredLaunches.current.has(launchId)
      if(!current())return Promise.reject(Error('Mock launch retired'))
      const authority=signal??returnIntent.current.begin()
      return continuations.current.run(launchId,async()=>{
      authority.throwIfAborted();if(!current())throw Error('Mock launch retired')
      await session.accept(launchId,authority)
      authority.throwIfAborted();if(!current())throw Error('Mock launch retired')
      retiredLaunches.current.add(launchId)
      releaseOwner.current?.();releaseOwner.current=null;setLaunchId(null);await refresh() },authority).finally(()=>{if(!signal)returnIntent.current.finish(authority)}) },
    retry: async () => { returnIntent.current.retire();await session.retireForRetry(launchId); const id=crypto.randomUUID();await session.launchWithId(id);
      await session.claim(id,selected.slots[selected.cursor-1].game);retiredLaunches.current.add(launchId);setLaunchId(id);await refresh() },
    leave: () => { returnIntent.current.retire();retiredLaunches.current.add(launchId);releaseOwner.current?.(); releaseOwner.current = null; setLaunchId(null); void refresh() },
  } : null
  function leaveReactSource(){void returnFromReactGame().catch(()=>setError('This game needs another check before you return. Try again.'))}
  async function returnFromReactGame(){
    if(!mockContext||!selected||returnPending.current)return
    returnPending.current=true
    const signal=mockContext.beginReturnIntent(),exact=launchId
    try {
      const joined=exact ? continuations.current.pendingFor(exact,signal) : null
      if(joined){await joined;return}
      const fresh=await session!.read(),attempt=fresh.slots[fresh.cursor-1]?.attempts.find(item=>item.launchId===launchId)
      signal.throwIfAborted()
      if(mockContext.launchId!==exact)throw Error('Mock launch retired')
      if(fresh.activeLaunchId===launchId&&attempt?.nativeArm){
        const status=await mockContext.terminal()
        signal.throwIfAborted()
        if(status==='ready'){await mockContext.continue(signal);return}
      }
      signal.throwIfAborted()
      mockContext.leave()
      window.location.assign(mockReturnUrl(selected.id))
    } catch(error) { if(!signal.aborted)throw error
    } finally {mockContext.finishReturnIntent(signal);returnPending.current=false}
  }
  if (mockContext && selected?.slots[selected.cursor - 1].game === 'keypresses')
    return <ReactGameActionBoundary onCompetingAction={mockContext.retireReturnIntent}><MockReturnBar onReturn={returnFromReactGame}/><KeypressesJourney key={launchId!} mock={mockContext} onLibrary={leaveReactSource} /></ReactGameActionBoundary>
  if (mockContext && selected?.slots[selected.cursor - 1].game === 'digits')
    return <ReactGameActionBoundary onCompetingAction={mockContext.retireReturnIntent}><MockReturnBar onReturn={returnFromReactGame}/><DigitsJourney key={launchId!} mock={mockContext} onLibrary={leaveReactSource} /></ReactGameActionBoundary>
  if (mockContext && selected?.slots[selected.cursor - 1].game === 'cards')
    return <ReactGameActionBoundary onCompetingAction={mockContext.retireReturnIntent}><MockReturnBar onReturn={returnFromReactGame}/><CardsJourney key={launchId!} mock={mockContext} onLibrary={leaveReactSource} /></ReactGameActionBoundary>
  if (mockContext && selected?.slots[selected.cursor - 1].game === 'easy_hard')
    return <ReactGameActionBoundary onCompetingAction={mockContext.retireReturnIntent}><MockReturnBar onReturn={returnFromReactGame}/><EasyHardJourney key={launchId!} mock={mockContext} onLibrary={leaveReactSource} /></ReactGameActionBoundary>
  if (mockContext && selected?.slots[selected.cursor - 1].game === 'towers')
    return <ReactGameActionBoundary onCompetingAction={mockContext.retireReturnIntent}><MockReturnBar onReturn={returnFromReactGame}/><TowersJourney key={launchId!} runtime={towersRuntime} mock={mockContext} onLibrary={leaveReactSource} /></ReactGameActionBoundary>
  if (mockContext && selected?.slots[selected.cursor - 1].game === 'balloons')
    return <ReactGameActionBoundary onCompetingAction={mockContext.retireReturnIntent}><MockReturnBar onReturn={returnFromReactGame}/><BalloonsJourney key={launchId!} mock={mockContext} onLibrary={leaveReactSource} /></ReactGameActionBoundary>
  if (mockContext && selected?.slots[selected.cursor - 1].game === 'stop' && stopRecorder)
    return <ReactGameActionBoundary onCompetingAction={mockContext.retireReturnIntent}><MockReturnBar onReturn={returnFromReactGame}/><Shell onLibrary={leaveReactSource}><StopJourney key={launchId!} recorder={stopRecorder} mode="baseline" specificationVersion="1.3" mock={mockContext}
      onLibrary={leaveReactSource} onRestart={() => { void mockContext.retry().catch(cause=>setError(cause instanceof Error?cause.message:'Stop retry needs source checking.')) }} onReplay={() => { void mockContext.retry().catch(cause=>setError(cause instanceof Error?cause.message:'Stop retry needs source checking.')) }} /></Shell></ReactGameActionBoundary>
  return <Shell onLibrary={() => { window.location.assign('/practice') }}><section className="journey">
    <h1 tabIndex={-1}>Full mock</h1>
    {error && <p role="alert">{error}</p>}
    {corrupt&&<div className="panel"><p>Mock progress is corrupt. Individual game histories are separate.</p><button disabled={busy} onClick={()=>void perform(async()=>{if(!window.confirm('Delete all mock progress, breaks, settings and result links? Individual game results remain in their own histories.'))return;await MockStore.deleteCorruptHistory();window.location.reload()})}>Delete all mock histories and start again</button></div>}
    {!store || !root ? <p role="status">Checking local mock history…</p> : !selected ? <>
      {unresolved&&<div role="alert"><p>The previous history save is uncertain.</p><button disabled={busy} onClick={()=>void perform(async()=>{setRoot(await store.checkUnresolvedRoot());setViewBlocked(false)})}>Check previous history save</button></div>}
      <div className="panel"><h2>Start a full mock · Step {preflight} of 5</h2>
        {preflight===1&&<><p>Practise the format so there are fewer surprises on the day. Some games test accuracy; others explore choices. These twelve games follow our original practice order, while real invitations can differ. This practice does not reproduce an employer score.</p><fieldset><legend>Practice goal</legend><label><input type="radio" name="goal" checked={goal==='early_career_finance'} onChange={()=>setGoal('early_career_finance')}/> General early career finance / investment banking preparation</label><label><input type="radio" name="goal" checked={goal==='general_practice'} onChange={()=>setGoal('general_practice')}/> General practice</label></fieldset></>}
        {preflight===2&&<><p>Follow your real invitation if you have one. It is authoritative for any employer assessment.</p><fieldset><legend>Invitation check</legend><label><input type="radio" name="invitation" checked={invitation==='checked'} onChange={()=>setInvitation('checked')}/> I checked my invitation; I will follow its instructions</label><label><input type="radio" name="invitation" checked={invitation==='not_available'} onChange={()=>setInvitation('not_available')}/> I do not have an invitation to check</label></fieldset></>}
        {preflight===3&&<><p>Detailed results stay in this browser. We collect completion counts and limited result totals to improve TraitGame. <a href="/privacy.html">Privacy</a>. There is no account, sync or employer transmission. Clearing browser data can remove history and familiarity records. Leaving during a game may make that attempt incomplete; play resumes only between games.</p><label><input type="checkbox" checked={privacy} onChange={event=>setPrivacy(event.target.checked)}/> I understand the local privacy and interruption limits</label></>}
        {preflight===4&&<><details><summary>Accessibility options (optional)</summary><PreferencesFields preferences={preferences} change={setPreferences}/></details><p>The defaults are ready to use. Each game checks its own controls before play.</p></>}
        {preflight===5&&<><p>Allow about 60–90 minutes for a first full practice with instructions, plus any breaks. This is a planning estimate, not a measured completion promise: several games and all explanations are self-paced.</p><ol>{labels.map(name=><li key={name}>{name}</li>)}</ol><p>Timed tasks keep their own limits. There is no whole mock countdown.</p></>}
        <div className="actions">{preflight>1&&<button className="secondary" onClick={()=>setPreflight(preflight-1)}>Back</button>}{preflight<5?<button disabled={preflight===2&&!invitation||preflight===3&&!privacy} onClick={()=>setPreflight(preflight+1)}>Next</button>:<button disabled={busy||unresolved||!invitation||!privacy||root.mocks.length>=50} onClick={()=>void create()}>Create mock</button>}</div>
        {root.mocks.length >= 50 && <p role="status">The 50 mock history limit is reached. Delete a history to create another.</p>}
      </div>
      <section><h2>Local mock histories</h2>{root.mocks.length ? <ul>{root.mocks.map(item => <li key={item.id}>
        Mock {item.ordinal} · {mockPhaseLabel(item.phase)} · reached game {Math.min(item.cursor,12)}
        <button disabled={busy||unresolved} onClick={() => void choose(item.id)}>Open mock</button>
        <button className="secondary" disabled={busy || unresolved || ['in_game','launching','checking'].includes(item.phase)} onClick={() => void perform(async () => { if(!window.confirm('Remove this mock progress, breaks, settings and result links? Individual game results remain in their own histories.'))return;setRoot(await store.deleteOne({ requestId:crypto.randomUUID(),expectedRevision:root.revision,targetMockId:item.id })) })}>Delete mock history</button>
      </li>)}</ul> : <p>No saved mock histories.</p>}
        <button className="secondary" disabled={busy||unresolved||root.mocks.some(item=>['launching','in_game','checking'].includes(item.phase))} onClick={()=>void perform(async()=>{
          if(!window.confirm('Delete all mock progress, breaks, settings and result links? Individual game results remain in their own histories.'))return
          setRoot(await store.deleteAll({requestId:crypto.randomUUID(),expectedRevision:root.revision,newInstallationId:crypto.randomUUID()}))
        })}>Delete all mock histories</button>
      </section>
    </> : <>
      <div className="panel"><h2>Mock {selected.ordinal}</h2><p>{mockPhaseLabel(selected.phase)} · {selected.continuity.replaceAll('_',' ')}</p>
        {unresolved&&<div role="alert"><p>The {session?.unresolvedLabel??'previous save'} is uncertain. Check that exact save before another change.</p>
          <button disabled={busy} onClick={()=>void perform(async()=>{await session!.checkUnresolved();await refresh();setViewBlocked(false)})}>Check previous save</button><button className="secondary" onClick={()=>{sessionRef.current?.dispose();window.location.assign('/practice')}}>Leave without another save</button></div>}
        <p>Game {Math.min(selected.cursor,12)} of 12: {labels[Math.min(selected.cursor - 1,11)]}</p>
        <p>{selected.slots.filter(slot=>slot.resolution==='normal_complete').length} of 12 games completed · {selected.slots.filter(slot=>slot.resolution==='pending').length} to go{selected.slots.some(slot=>slot.resolution==='omitted'||slot.resolution==='task_limit')&&` · ${selected.slots.filter(slot=>slot.resolution==='omitted').length} skipped · ${selected.slots.filter(slot=>slot.resolution==='task_limit').length} reached the time limit`}</p>
        <ol>{selected.slots.map((slot,index) => <li key={slot.game}><strong>{labels[index]}</strong> — {slot.resolution === 'normal_complete' ? 'Completed' : slot.resolution === 'task_limit' ? 'Time limit reached' : slot.resolution === 'omitted' ? 'Skipped' : index === selected.cursor-1 ? 'Next' : 'Not started'}
          {(slot.acceptedLaunchId||index===selected.cursor-1&&slot.attempts.some(attempt=>attempt.phase==='review_only'&&attempt.reference))&&<> · <button className="secondary" disabled={busy} onClick={()=>void perform(async()=>{await verifiedReportTarget({mockId:selected.id,slot:slot.index});location.assign(reportUrl(selected.id,slot.index,slot.game))})}>{slot.resolution==='normal_complete'?'View report':'Review attempt'}</button></>}
        </li>)}</ol>
        {selected.phase === 'preflight' && <button disabled={busy||unresolved} onClick={() => void start()}>Begin mock</button>}
        {selected.phase==='boundary'&&needsResume&&<button disabled={busy||unresolved} onClick={()=>void perform(async()=>{await session!.resume();setNeedsResume(false);await refresh()})}>Resume mock</button>}
        {selected.phase === 'boundary' && selected.cursor <= 12 && <>
          {lastBreak?.kind==='scheduled'&&lastBreak.afterSlot===selected.cursor-1&&<p role="status">{lastBreak.elapsedMs===null?'Break duration is uncertain because the clock changed.':lastBreak.elapsedMs>600_000?'Longer than the recommended 10 minutes.':'Within the recommended 10 minutes.'}</p>}
          {selected.scheduledBreak === 'offered' && <p>{selected.cursor === 7 ? 'Optional midpoint break. We recommend no more than 10 minutes. Return when ready.' : 'The earlier midpoint break choice is still open. Continue without it before opening or skipping another game.'}</p>}
          {selected.scheduledBreak === 'offered' && selected.cursor === 7 && <p role="status">Choose Take halfway break or Continue without midpoint break before opening or skipping Lengths.</p>}
          {selected.slots[selected.cursor-1].attempts.length>=16&&<p role="alert">This game reached its 16-attempt limit in this mock. Omit it or finish early. A new mock starts a separate sequence.</p>}
          {selected.breaks.length>=64&&<p role="status">This mock reached its 64-break limit. Continue without another break or finish early.</p>}
          <div className="actions"><button disabled={busy || unresolved || !!launchId||needsResume||selected.scheduledBreak==='offered'||selected.slots[selected.cursor-1].attempts.length>=16} onClick={() => void beginGame()}>Open {labels[selected.cursor - 1]}</button>
            <button className="secondary" disabled={busy||unresolved||needsResume||selected.scheduledBreak==='offered'} onClick={() => setSkipConfirm(selected.cursor)}>Skip this game</button>
            <button className="secondary" disabled={busy||unresolved||needsResume} onClick={() => void perform(async () => { await session!.finishEarly(); await refresh() })}>Finish early</button></div>
          {skipConfirm===selected.cursor&&<div className="panel" role="alertdialog" aria-label={`Skip ${labels[selected.cursor-1]}?`}><p>Skip {labels[selected.cursor-1]}? You can’t come back to it in this mock.</p><div className="actions"><button disabled={busy||unresolved||needsResume||selected.scheduledBreak==='offered'} onClick={() => void perform(async()=>{await session!.omit('user_exit');setSkipConfirm(null);await refresh()})}>Skip {labels[selected.cursor-1]}</button><button className="secondary" onClick={()=>setSkipConfirm(null)}>Cancel</button></div></div>}
          {selected.scheduledBreak === 'offered' && selected.cursor === 7 && <button disabled={busy||unresolved||needsResume||selected.breaks.length>=64} onClick={() => void perform(async () => { await session!.breakStart('scheduled'); await refresh() })}>Take halfway break</button>}
          {selected.scheduledBreak === 'offered' && <button className="secondary" disabled={busy||unresolved||needsResume} onClick={()=>void perform(async()=>{await session!.declineBreak();await refresh()})}>Continue without midpoint break</button>}
          <button className="secondary" disabled={busy||unresolved||needsResume||selected.breaks.length>=64} onClick={() => void perform(async () => { await session!.breakStart('accommodation'); await refresh() })}>Take a break</button>
        </>}
        {selected.phase === 'break' && <><p>Return when ready. Break length does not change earlier results.</p><button disabled={busy||unresolved} onClick={() => void perform(async () => { await session!.breakEnd();setNeedsResume(false); await refresh() })}>End break</button></>}
        {['launching','in_game','checking'].includes(selected.phase)&&<p role="status">{recoveryBusy?'Checking your game…':recoveryError||'Checking the saved game before you continue.'}</p>}
        {['launching','in_game','checking'].includes(selected.phase)&&selected.activeLaunchId&&<button disabled={busy||unresolved||recoveryBusy} onClick={()=>void recoverCurrentLaunch(true)}>Check this game</button>}
        {selected.phase==='checking'&&selected.activeLaunchId&&selected.slots[selected.cursor-1].attempts.some(attempt=>attempt.launchId===selected.activeLaunchId&&attempt.phase==='terminal_verified'&&attempt.reference)&&<>
          <button className="secondary" disabled={busy} onClick={()=>void perform(async()=>{await verifiedReportTarget({mockId:selected.id,slot:selected.cursor});location.assign(reportUrl(selected.id,selected.cursor,selected.slots[selected.cursor-1].game))})}>Review current saved report</button>
          <button disabled={busy||unresolved} onClick={()=>void perform(async()=>{const release=await acquireMockOwner();try{await session!.accept(selected.activeLaunchId!);await refresh()}finally{release()}})}>Continue after reviewing saved report</button>
        </>}
        {['finished','ended_early'].includes(selected.phase)&&<><h3>{selected.phase==='finished'?'Mock finished':'Mock ended early'}</h3>
          {selected.phase==='finished'&&selected.slots.every(slot=>slot.resolution==='normal_complete'&&cardStatus[slot.index]==='available')&&<p>12 games completed</p>}
          <p>These are local practice results. There is no combined score. Check saved results before opening a report.</p>
          <button disabled={busy} onClick={()=>void perform(()=>checkSavedResults(true))}>Check saved results</button>
          <ol>{selected.slots.map((slot,index)=>{const attempt=slot.attempts.find(item=>item.launchId===slot.acceptedLaunchId)??slot.attempts.findLast(item=>item.reference);const status=cardStatus[slot.index]
            return <li key={slot.game}><strong>{labels[index]}</strong> · {slot.resolution==='task_limit'?'Time limit reached — puzzle incomplete':slot.resolution.replaceAll('_',' ')}{attempt?.reference?` · ${status??'check needed'} · ${attempt.reference.versions.formId??'form unknown'}`:''}
              <p>Report: {reportDescriptions[index]}.</p>
              {attempt?.reference&&status==='available'&&<button disabled={busy} onClick={()=>void perform(async()=>{await verifiedReportTarget({mockId:selected.id,slot:slot.index});location.assign(reportUrl(selected.id,slot.index,slot.game))})}>Open saved report</button>}
              <a href={practiceUrl(slot.game)}>Practise {labels[index]}</a>
              {slot.game==='stop'&&status==='available'&&slot.resolution==='normal_complete'&&<a href="/practice?mockStopHistory=1">Open Stop history and training</a>}
              {slot.game==='balloons'&&status==='available'&&slot.resolution==='normal_complete'&&<p><a href="/practice?practiceGame=balloons&balloonsBaseline=1">Start Balloons training with a separate baseline</a>. An available BL form is assigned through Balloons practice. The mock RP result is separate from that training chain.</p>}
              {slot.game==='towers'&&<p>Towers Advanced Training is available separately from this full mock.</p>}
              {status==='checking'&&<p role="status">Checking saved result…</p>}
              {status&&status!=='available'&&status!=='checking'&&<p role="alert">Saved result {status}. Open the native game history to check it.</p>}
            </li>})}</ol>
        </>}
        <p>Mock history deletion removes progress and links. Individual game results remain in their own histories.</p>
        <button className="secondary" disabled={busy||unresolved} onClick={() => void perform(async()=>{if(selected.phase==='boundary'&&!needsResume)await session!.leave();cardCheckEpoch.current++;activeIdRef.current=null;setCardStatus({});setActiveId(null);sessionRef.current?.dispose();sessionRef.current=null;setSession(null);await refresh()})}>Back to mock histories</button>
      </div>
      <div className="panel"><h2>Preferences for the next game</h2>
        <PreferencesFields preferences={preferences} change={setPreferences}/>
        {selected.settings.length>=64&&<p role="status">This mock reached its 64-setting limit. Continue with saved settings or start a new mock.</p>}
        <button disabled={busy || unresolved || needsResume || selected.phase !== 'boundary'||selected.settings.length>=64||JSON.stringify(preferences)===JSON.stringify(selected.settings.at(-1)!.preferences)} onClick={() => void perform(async () => { await session!.settings(preferences); await refresh() })}>Save changed preferences</button>
      </div>
      <p className="note">Open each game to review its saved result and details.</p>
    </>}
  </section></Shell>
}
