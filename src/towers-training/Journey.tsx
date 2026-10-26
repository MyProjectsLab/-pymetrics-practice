/* oxlint-disable react/immutability, react/purity, react-hooks/exhaustive-deps */
import { useEffect, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { flushSync } from 'react-dom'
import { Shell } from '../core/Shell'
import { acquireTowersOwner } from '../towers/storage'
import { displayFirstPartyBrand } from '../design/brandDisplay'
import type { Board } from '../towers/forms'
import { canonical, prepareRouteMap, shortestRoute } from './bank'
import { TrainingStore, Unconfirmed } from './store'
import { TrainingActions } from './transitions'
import type { CaptureTicket, FirstWithdrawal } from './transitions'
import { issueCapturedTicket } from './capture-custody'
import { Capacity, replayAttempt, roundProjection } from './model'
import { OperationScope, SettlementScope } from './authority'
import type { Attempt, Chain, DrillSnapshot, JournalRecord, Score, TrainingRoot } from './model'
import './training.css'

const DISKS = [
  {name:'Gold',color:'#e9ce36',pattern:'horizontal-bars'},
  {name:'Orchid',color:'#ce65c9',pattern:'dots'},
  {name:'Cobalt',color:'#5e78de',pattern:'diagonal-bars'},
  {name:'Coral',color:'#e55d50',pattern:'crosshatch'},
  {name:'Leaf',color:'#5dcc68',pattern:'rings'},
]
type Stage = 'guide'|'check'|'ready'|'play'|'retired'|'review'|'report'|'comparison'|'history'
type Historical = {kind:'report'|'comparison'|'history';time:number;root:TrainingRoot;attemptId?:string;chainId?:string;
  lost:'known'|'unknown'|'unverified'|null;drillView?:DrillSnapshot|null}
function asTime(ms:number){const seconds=Math.floor(Math.max(0,ms)/1000)
  return `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`}
const n=(value:number|null|undefined,unit='')=>value===null||value===undefined?'unavailable':`${value}${unit}`
const sec=(value:number|null|undefined)=>value===null||value===undefined?'unavailable':
  `${(Math.sign(value)*Math.floor(Math.abs(value)/100+0.5)/10).toFixed(1)} seconds`
function ScoreDetails({score}:{score:Score}){
  return <div className="towers-score"><p>Status: {score.terminal} · Accepted placements: {score.moves} ·
    Verified minimum: {score.optimal} · Excess: {n(score.excess)}</p>
    <p>Planning: {sec(score.planningMs)} · Time used: {sec(score.timeUsedMs)} ·
      Solution time: {sec(score.solutionMs)}</p>
    <p>Undo: {score.undoCount} · Clear All: {score.resetCount} ·
      Repeated states: {score.repeatedStateArrivals} · Immediate reversals: {score.immediateReversals} ·
      Median gap between moves: {sec(score.interMoveMedianMs)}</p></div>
}
function ComparisonDetails({baseline,retest}:{baseline:Score;retest:Score}){
  const rows:[string,number|null,number|null,'count'|'time'][]=[
    ['Accepted placements',baseline.moves,retest.moves,'count'],
    ['Excess over nine moves',baseline.excess,retest.excess,'count'],
    ['Planning time',baseline.planningMs,retest.planningMs,'time'],
    ['Solution time',baseline.solutionMs,retest.solutionMs,'time'],
    ['Time used',baseline.timeUsedMs,retest.timeUsedMs,'time'],
    ['Undo',baseline.undoCount,retest.undoCount,'count'],
    ['Clear All',baseline.resetCount,retest.resetCount,'count'],
    ['Repeated states',baseline.repeatedStateArrivals,retest.repeatedStateArrivals,'count'],
    ['Immediate reversals',baseline.immediateReversals,retest.immediateReversals,'count'],
    ['Median gap between moves',baseline.interMoveMedianMs,retest.interMoveMedianMs,'time'],
  ]
  return <><p>Status: {baseline.terminal} → {retest.terminal}. Both puzzles have a verified nine-move minimum.</p>
    <table><caption>Baseline and retest measures; difference is retest minus baseline</caption>
      <thead><tr><th>Measure</th><th>Baseline</th><th>Retest</th><th>Difference</th></tr></thead>
      <tbody>{rows.map(([label,b,r,unit])=>{const format=unit==='time'?sec:n
        return <tr key={label}><th>{label}</th><td>{format(b)}</td><td>{format(r)}</td>
          <td>{b===null||r===null?'unavailable':format(r-b)}</td></tr>})}</tbody></table></>
}
function boardText(board:Board){return board.map((stack,i)=>`Tower ${i+1}: ${stack.length?
  stack.map(d=>`${d} ${DISKS[d-1].name}`).join(', '):'empty'}`).join('. ')}
type InputMode = 'pointer'|'touch'|'keyboard'|'assistive'
type ViewOperation = OperationScope & {epoch:number}
function savedRound(attempt:Attempt):number{
  if(attempt.phase==='between_rounds')return 1
  if(attempt.phase==='active'){
    const index=attempt.rounds.findIndex(round=>round.puzzlePhase==='active')
    if(index>=0)return index
  }
  if(attempt.phase==='round_review'){
    const index=attempt.rounds.findIndex(round=>round.reviewPhase==='pending')
    if(index>=0)return index
  }
  if(attempt.phase==='reserved'){
    const index=attempt.rounds.findIndex(round=>round.puzzlePhase==='reserved')
    if(index>=0)return index
  }
  if(attempt.phase==='terminal'||attempt.phase==='abandoned'){
    const index=attempt.rounds.findLastIndex(round=>round.presentation!=='unseen')
    return index>=0?index:0
  }
  throw Error('Saved training phase has no round')
}
function activationMode(event:ReactMouseEvent<HTMLButtonElement>,declared:InputMode):InputMode|null{
  if(!event.nativeEvent.isTrusted)return null
  if(event.detail===0)return declared==='assistive'?'assistive':'keyboard'
  const pointer=(event.nativeEvent as PointerEvent).pointerType
  return pointer==='touch'?'touch':'pointer'
}
function PuzzleBoard({board,target,selected,disabled,onTower,declared}:{board:Board;target?:boolean;selected?:number|null;
  disabled?:boolean;onTower?:(index:number,source:InputMode)=>void;declared?:InputMode}){
  const held=useRef(new Set<string>())
  return <div className={`towers-board${target?' towers-target':''}`} aria-label={target?'Target arrangement':'Current arrangement'}>
    {board.map((stack,index)=>{
      const inner=<><span className="towers-stack">{stack.map(d=><span key={d}
        className={`towers-disk towers-pattern-${DISKS[d-1].pattern}${target?' towers-small':''}`}
        style={{backgroundColor:DISKS[d-1].color}}>{d} {DISKS[d-1].name}</span>)}</span>
        <span className="towers-pad">Tower {index+1}</span></>
      return target?<div key={index} className="towers-tower" aria-label={`Tower ${index+1}: ${stack.join(', ')||'empty'}`}>{inner}</div>:
        <button key={index} type="button" className={`towers-tower${selected===index?' towers-picked':''}`}
          aria-label={`Tower ${index+1}: ${stack.join(', ')||'empty'}`} disabled={disabled}
          onKeyDown={event=>{if(event.nativeEvent.isTrusted&&(event.key==='Enter'||event.key===' ')){
            if(event.repeat||held.current.has(event.key)){event.preventDefault();event.stopPropagation()}
            else held.current.add(event.key)
          }}}
          onKeyUp={event=>{held.current.delete(event.key)}}
          onBlur={()=>held.current.clear()}
          onClick={event=>{const mode=activationMode(event,declared??'keyboard');if(mode)onTower?.(index,mode)}}>{inner}</button>
    })}</div>
}
function roundState(a:Attempt,index:number){
  return roundProjection(a,index)
}
function latestChain(root:TrainingRoot):Chain|null{return Object.values(root.chains).sort((a,b)=>b.createdWallMs-a.createdWallMs)[0]??null}
function repeatAvailable(root:TrainingRoot|null,chain:Chain|null){return !!(root&&chain?.firstGrant&&
  ['drill_complete','compared','exhausted'].includes(chain.status)&&
  !Object.values(root.attempts).some(a=>a.attachment.chainId===chain.id&&
    ((a.kind==='drill'&&a.eligibility==='familiar_review')||a.kind==='retest')&&
    ['reserved','active','between_rounds','round_review'].includes(a.phase))) }
function routerRationale(chain:Chain){
  const text={
    state_tracking:'You explored several moves and returned to earlier board states. Tracking those returns may help you avoid repeating a route.',
    plan_before_action:'You started moving within three seconds and then immediately reversed a move. Practise checking two moves before acting.',
    timed_planning:'Your route used at most one extra placement after at least fifteen seconds before the first move. Practise a shorter planning window while watching move count.',
    sequencing:'Practise following a short sequence while checking the changing board. This is a general exercise; this one attempt does not establish a specific weakness.',
  }[chain.drillRule]
  return `${text} The cutoffs are original selection rules for this training, not provider norms or a measure of ability.`
}
function label(snapshot:Historical){return snapshot.lost==='known'?'Source no longer saved — historical snapshot only':
  snapshot.lost==='unknown'?'Saved status unknown — historical snapshot only':
  snapshot.lost==='unverified'?'Could not verify saved data — historical snapshot only':
  `Historical snapshot from ${new Date(snapshot.time).toLocaleString()}. Saved data may have changed. Refresh to check.`}
function noticeAffects(snapshot:Historical,reason:'deleted'|'replaced'|'unknown',id?:string){
  if(reason==='replaced'||!id||snapshot.kind==='history')return true
  if(snapshot.kind==='comparison'){
    const chain=snapshot.root.chains[snapshot.chainId??'']
    return id===snapshot.chainId||[chain?.baseline.attemptId,chain?.firstGrant?.attemptId,
      chain?.completedRetest?.attemptId].includes(id)
  }
  const attempt=snapshot.root.attempts[snapshot.attemptId??'']
  const chain=snapshot.root.chains[attempt?.attachment.chainId as string]
  return id===snapshot.attemptId||id===attempt?.attachment.chainId||
    [chain?.baseline.attemptId,chain?.firstGrant?.attemptId,
      chain?.completedRetest?.attemptId].includes(id)
}
const context=(inputMode:InputMode)=>({contextVersion:'towers-training-context/1',inputMode,
  accessibilityMode:'visual-standard',reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,
  highContrast:matchMedia('(forced-colors: active)').matches,deviceClass:innerWidth<600?'phone':'desktop',
  viewportClass:innerWidth<600?'narrow-under600':'wide'})
const frames=(scope:OperationScope)=>new Promise<void>((resolve,reject)=>{
  scope.check()
  let done=false,first=0,second=0
  const finish=(error?:unknown)=>{if(done)return;done=true;clearTimeout(timer)
    cancelAnimationFrame(first);cancelAnimationFrame(second)
    scope.signal.removeEventListener('abort',abort)
    if(error)reject(error)
    else try{scope.check();resolve()}catch(cause){reject(cause)}}
  const abort=()=>finish(new Unconfirmed('Board confirmation retired'))
  const remaining=Math.max(1,Math.min(1000,scope.deadline-performance.now()))
  const timer=setTimeout(()=>finish(new Unconfirmed('Board confirmation timed out')),remaining)
  scope.signal.addEventListener('abort',abort,{once:true})
  if(scope.signal.aborted){abort();return}
  first=requestAnimationFrame(()=>{if(done)return
    try{scope.check();second=requestAnimationFrame(()=>finish())}catch(cause){finish(cause)}})
})

export function TowersTrainingJourney({onLibrary}:{onLibrary:()=>void}){
  const storeRef=useRef<TrainingStore|null>(null)
  if(!storeRef.current)storeRef.current=new TrainingStore()
  const actionsRef=useRef<TrainingActions|null>(null)
  if(!actionsRef.current)actionsRef.current=new TrainingActions(storeRef.current)
  const store=storeRef.current,actions=actionsRef.current
  const [root,setRoot]=useState<TrainingRoot|null>(null)
  const rootRef=useRef<TrainingRoot|null>(null)
  const [stage,setStage]=useState<Stage>('guide'),[error,setError]=useState(''),[busy,setBusy]=useState(false)
  const [needsRecovery,setNeedsRecovery]=useState(false)
  const busyRef=useRef(false),liveRef=useRef(true),generation=useRef(0)
  const captureOrder=useRef(0)
  const activeIdentity=useRef<{id:string;index:number}|null>(null)
  const activeContext=useRef<Attempt['context']|null>(null)
  const viewEpoch=useRef(0)
  const focusEpoch=useRef(0)
  const activeOperation=useRef<ViewOperation|null>(null)
  const [quiz,setQuiz]=useState<'yes'|'no'|null>(null)
  const [inputMode,setInputMode]=useState<InputMode>('keyboard')
  const [attemptId,setAttemptId]=useState<string|null>(null),[roundIndex,setRoundIndex]=useState(0)
  const [selected,setSelected]=useState<number|null>(null),[planSelected,setPlanSelected]=useState<number|null>(null)
  const sourceMode=useRef<InputMode|null>(null)
  const [elapsed,setElapsed]=useState(0),[playing,setPlaying]=useState(false)
  const anchor=useRef<number|null>(null),releaseOwner=useRef<(()=>void)|null>(null)
  const liveLease=useRef<{generation:number;release:()=>void}|null>(null)
  const wallAnchor=useRef<number|null>(null),lastClockCheck=useRef<number|null>(null)
  const releaseReview=useRef<(()=>void)|null>(null)
  const withdrawal=useRef<{kind:'interrupted'|'exited';elapsed:number;reason:string;
    first:FirstWithdrawal|null}|null>(null)
  const [historical,setHistorical]=useState<Historical|null>(null)
  const [deleteConfirm,setDeleteConfirm]=useState<string|null>(null)
  const [corruptToken,setCorruptToken]=useState<string|null>(null)
  const [currentRecovery,setCurrentRecovery]=useState<'exact'|'current'>('exact')
  const [message,setMessage]=useState('')
  const [timingUnknown,setTimingUnknown]=useState(false)
  const title=useRef<HTMLHeadingElement|null>(null)
  const initialRead=useRef<ReturnType<TrainingStore['read']>|null>(null)
  const initialScope=useRef<OperationScope|null>(null)
  const initialSuperseded=useRef(false)
  const closeTimer=useRef<ReturnType<typeof setTimeout>|null>(null)
  const current=root?.attempts[attemptId??'']
  const currentRound=current?.rounds[roundIndex]
  const scene=current&&currentRound?roundState(current,roundIndex):null
  const chain=root?(current?.attachment.chainId?
    root.chains[current.attachment.chainId as string]??null:latestChain(root)):null
  const rule=chain?.drillRule
  const timed=stage==='play'&&playing&&anchor.current!==null
  function setCurrent(next:TrainingRoot){rootRef.current=next;setRoot(next)}
  async function publishCurrent(operation:ViewOperation,expected:TrainingRoot,
    publish:(current:TrainingRoot)=>void){
    await store.admit(operation,current=>{
      operation.check()
      if(canonical(current)!==canonical(expected))throw Error('Training source changed before display')
      operation.check()
      flushSync(()=>publish(current))
      operation.check()
    })
  }
  function rememberSettled(next:TrainingRoot){const prior=rootRef.current
    if(prior?.installationId===next.installationId&&prior.revision<=next.revision)rootRef.current=next}
  function capture(raw:number):CaptureTicket {
    const stamp=performance.now()
    const epoch=generation.current,order=++captureOrder.current
    const ticket=issueCapturedTicket({ownerGeneration:generation.current,
      captureOrder:order,offsetUs:Math.floor(raw*1000),withdrawal:null},stamp,
      ()=>generation.current===epoch&&captureOrder.current===order&&
        releaseOwner.current!==null&&!withdrawal.current)
    return ticket
  }
  function focus(){const epoch=viewEpoch.current,token=focusEpoch.current
    requestAnimationFrame(()=>{if(liveRef.current&&epoch===viewEpoch.current&&
      token===focusEpoch.current)title.current?.focus()})}
  function retireView(){
    viewEpoch.current++
    focusEpoch.current++
    const prior=activeOperation.current
    if(prior){prior.retire();activeOperation.current=null;
      busyRef.current=false;if(liveRef.current)setBusy(false)}
  }
  function sceneValid():boolean {
    const saved=activeContext.current
    if(!saved||document.visibilityState!=='visible'||
      canonical(context(saved.inputMode as InputMode))!==canonical(saved))return false
    const target=document.querySelector('.towers-play .towers-target')
    const board=document.querySelector('.towers-play .towers-board:not(.towers-target)')
    if(!target||!board)return false
    const width=window.visualViewport?.width??innerWidth,height=window.visualViewport?.height??innerHeight
    return [target,board].every(element=>{const box=element.getBoundingClientRect()
      return box.width>0&&box.height>0&&box.left>=0&&box.top>=0&&
        box.right<=width&&box.bottom<=height})
  }
  function release(){releaseOwner.current?.();releaseOwner.current=null;liveLease.current=null;
    releaseReview.current?.();releaseReview.current=null}
  async function finishWithdrawal(scope:OperationScope):Promise<boolean>{
    scope.check()
    const deadline=scope.deadline
    const first=withdrawal.current,identity=activeIdentity.current
    if(!first||!identity)return true
    const pendingKind=actions.pendingKind()
    const publicationEpoch=viewEpoch.current,publicationToken=focusEpoch.current
    try {
      if(performance.now()>=deadline)throw new Unconfirmed('Training settlement timed out')
      let r=rootRef.current
      if(!r)return false
      // A captured command has its own immutable receipt. Its outcome must be
      // resolved before the distinct automatic settlement is allowed to write.
      const confirmed=await actions.reconcilePending(scope,true)
      if(confirmed){r=confirmed;rememberSettled(confirmed)}
      const settledSource=await store.read(scope)
      if(settledSource.status!=='present')throw Error('Saved training source unavailable')
      r=settledSource.root;rememberSettled(r)
      const a=r.attempts[identity.id],round=a?.rounds[identity.index]
      if(!a||!round){if(withdrawal.current===first)withdrawal.current=null;return true}
      if(anchor.current===null){
        const pending=r.attempts[identity.id]
        if(pending?.phase==='reserved'&&pending.rounds[identity.index]?.presentation==='intent') {
          const next=await actions.retirePrefix(r,identity.id,'intent_withdrawn',scope)
          rememberSettled(next);if(liveRef.current&&publicationEpoch===viewEpoch.current&&
            publicationToken===focusEpoch.current)setCurrent(next)
        }else if(pending?.phase==='reserved'&&
          pending.rounds[identity.index]?.presentation==='unseen'&&pendingKind===null){
          const next=await actions.cancelUnseenStart(r,identity.id,scope)
          rememberSettled(next);if(liveRef.current&&publicationEpoch===viewEpoch.current&&
            publicationToken===focusEpoch.current)setCurrent(next)
        }
        if(withdrawal.current===first)withdrawal.current=null;return true
      }
      if(round.puzzlePhase!=='active'){if(withdrawal.current===first)withdrawal.current=null;return true}
      const terminal=first.elapsed>=120000?'expired':first.kind
      const next=await actions.settle(r,a.id,identity.index,terminal,
        terminal==='expired'?120000:Math.max(first.elapsed,a.records.filter(e=>e.roundId===round.id).at(-1)?.elapsedMs??0),
        terminal==='expired'?undefined:first.reason,first.first,scope)
      rememberSettled(next);if(withdrawal.current===first)withdrawal.current=null
      if(liveRef.current&&publicationEpoch===viewEpoch.current&&
        publicationToken===focusEpoch.current){setCurrent(next);setStage('retired');focus()}
      return true
    }catch(cause){if(liveRef.current&&publicationEpoch===viewEpoch.current&&
      publicationToken===focusEpoch.current){
      // Any unresolved first withdrawal needs an explicit authoritative retry.
      // A failed settlement must never leave the retired screen as a dead end.
      setNeedsRecovery(true)
      setError(`Saved outcome unconfirmed: ${String(cause)}`)
    }return false}
  }
  function withdraw(kind:'interrupted'|'exited',reason:string,scope?:OperationScope):Promise<void>{
    if(!releaseOwner.current||withdrawal.current)return Promise.resolve()
    const savedReason=reason==='unmount'?'page_left':reason==='start_failed'?'save_unconfirmed':reason
    const raw=anchor.current===null?null:performance.now()-anchor.current
    const first=savedReason==='expired'||raw===null?null:{order:++captureOrder.current,
      offsetUs:Math.floor(raw*1000),kind:savedReason==='hidden'?'hide':
        savedReason==='page_left'?'pagehide':kind==='exited'?'exit':'owner_loss',reason:savedReason}
    withdrawal.current={kind,elapsed:raw===null?0:Math.min(120000,Math.floor(raw)),reason:savedReason,first}
    generation.current++;if(!scope)retireView()
    if(liveRef.current)flushSync(()=>{setPlaying(false);setTimingUnknown(false);setStage('retired')})
    release()
    const settlement=new SettlementScope(scope?scope.deadline-2500:performance.now())
    return finishWithdrawal(settlement).then(()=>undefined)
  }
  useEffect(()=>{
    liveRef.current=true
    if(closeTimer.current){clearTimeout(closeTimer.current);closeTimer.current=null}
    const hidden=()=>{if(document.visibilityState==='hidden')withdraw('interrupted','hidden')}
    const display=()=>{if(releaseOwner.current&&anchor.current!==null&&!sceneValid())
      withdraw('interrupted','context_changed')}
    const leaving=()=>withdraw('exited','page_left')
    const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'){setSelected(null);setPlanSelected(null)}}
    document.addEventListener('visibilitychange',hidden);window.addEventListener('pagehide',leaving)
    window.addEventListener('resize',display);window.visualViewport?.addEventListener('resize',display)
    window.addEventListener('scroll',display,true);window.visualViewport?.addEventListener('scroll',display)
    const motion=matchMedia('(prefers-reduced-motion: reduce)'),contrast=matchMedia('(forced-colors: active)')
    motion.addEventListener('change',display);contrast.addEventListener('change',display)
    window.addEventListener('keydown',escape)
    const unsubscribe=store.subscribe((reason,id)=>{
      if(releaseOwner.current)
        withdraw('interrupted','owner_lost')
      setHistorical(old=>old && noticeAffects(old,reason,id)?
        {...old,lost:reason==='unknown'||!id&&reason!=='replaced'?'unknown':'known'}:old)
    })
    const initialEpoch=viewEpoch.current
    if(!initialScope.current?.valid()){
      initialScope.current=new OperationScope(performance.now(),()=>liveRef.current&&initialEpoch===viewEpoch.current)
      initialRead.current=store.read(initialScope.current)
    }
    const mountedScope=initialScope.current!
    const initialCurrent=()=>mountedScope===initialScope.current&&mountedScope.valid()&&
      liveRef.current&&!initialSuperseded.current&&initialEpoch===viewEpoch.current&&
      !activeOperation.current
    void initialRead.current!.then(async result=>{if(result.status==='present'&&initialCurrent()){
      await store.admit(mountedScope,source=>{
        mountedScope.check()
        if(!initialCurrent())return
        flushSync(()=>{setCurrent(source)
          setTimingUnknown(Object.values(source.attempts).some(a=>a.phase==='active'))})
      })
    }else if(result.status==='corrupt'&&initialCurrent()){
        setCorruptToken(result.token)
        setCurrentRecovery(result.recovery)
        setError('Training data are unavailable for review. An explicit reset is required before a new start.')
      }else if(result.status==='recovery-unavailable'&&initialCurrent()){
        setError('Training data are damaged. Recovery is unavailable for this saved installation.')
      }
    }).catch(cause=>{if(liveRef.current&&!initialSuperseded.current&&
      !activeOperation.current&&initialEpoch===viewEpoch.current)setError(String(cause))})
    return()=>{liveRef.current=false
      if(releaseOwner.current)void withdraw('interrupted','unmount')
      generation.current++;retireView();initialScope.current?.retire();release();unsubscribe();
      closeTimer.current=setTimeout(()=>store.close(),0)
      document.removeEventListener('visibilitychange',hidden);window.removeEventListener('pagehide',leaving)
      window.removeEventListener('resize',display);window.visualViewport?.removeEventListener('resize',display)
      window.removeEventListener('scroll',display,true);window.visualViewport?.removeEventListener('scroll',display)
      motion.removeEventListener('change',display);contrast.removeEventListener('change',display)
      window.removeEventListener('keydown',escape)}
  },[])
  useEffect(()=>{if(!timed)return
    const timer=window.setInterval(()=>{if(!sceneValid()){void withdraw('interrupted','context_changed');return}
      const current=performance.now(),raw=current-anchor.current!
      const wallElapsed=Date.now()-(wallAnchor.current??Date.now())
      const gap=current-(lastClockCheck.current??current)
      lastClockCheck.current=current
      if(Math.abs(wallElapsed-raw)>2000||gap>1000){
        void withdraw('interrupted',Math.abs(wallElapsed-raw)>2000?'clock_anomaly':'frame_gap')
        return
      }
      setElapsed(Math.min(120000,Math.max(0,Math.floor(raw))))
      if(raw>=120000)withdraw('interrupted','expired')
    },80)
    return()=>clearInterval(timer)
  },[timed])
  const uncertain=(cause:unknown)=>cause instanceof Error&&
    ['Unconfirmed','Aborted'].includes(cause.constructor.name)
  async function run<T>(work:(operation:ViewOperation)=>Promise<T>):Promise<T|null>{
    if(busyRef.current)return null
    focusEpoch.current++
    initialSuperseded.current=true
    const epoch=viewEpoch.current
    const operation:ViewOperation=Object.assign(new OperationScope(performance.now(),()=>
      liveRef.current&&viewEpoch.current===epoch&&activeOperation.current===operation),{epoch})
    activeOperation.current=operation;busyRef.current=true;setBusy(true);setError('')
    let timer:ReturnType<typeof setTimeout>|null=null
    const timeout=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{
      operation.retire();reject(new Unconfirmed('Training operation timed out'))
    },Math.max(1,operation.deadline-performance.now()))})
    try{const result=await Promise.race([work(operation),timeout]);return operation.valid()?result:null}
    catch(cause){if(liveRef.current&&epoch===viewEpoch.current){
      if(uncertain(cause))setNeedsRecovery(true)
      setError(cause instanceof Error?cause.message:String(cause))}return null}
    finally{if(timer)clearTimeout(timer);operation.retire()
      if(activeOperation.current===operation){activeOperation.current=null;busyRef.current=false;
        if(liveRef.current)setBusy(false)}}
  }
  async function freshRoot(operation:ViewOperation){
    const existing=await store.read(operation);operation.check()
    if(existing.status==='present')return existing.root
    if(existing.status==='corrupt')throw Error('Training data need an explicit reset')
    if(existing.status==='recovery-unavailable')throw Error('Training data are damaged and recovery is unavailable')
    return store.initialize(existing.observationId,operation)
  }
  async function newBaseline(){await run(async operation=>{
    await initialRead.current?.catch(()=>undefined);operation.check()
    const base=await freshRoot(operation);operation.check()
    const next=await actions.reserveBaseline(base,context(inputMode),operation)
    operation.check()
    const a=Object.values(next.attempts).sort((a,b)=>b.ordinal-a.ordinal)[0]
    await publishCurrent(operation,next,current=>{setCurrent(current);setAttemptId(a.id);setRoundIndex(0)
      setHistorical(null);setStage('ready')});focus()
  })}
  async function continueSaved(){await run(async operation=>{
    let reloadPrefix:{id:string;root:TrainingRoot;reason:'timing_unknown'|'intent_withdrawn'}|null=null
    await store.admit(operation,source=>{
      operation.check()
      const latest=Object.values(source.attempts).sort((a,b)=>b.ordinal-a.ordinal)[0]
      if(!latest)throw Error('No saved training attempt is available')
      const selectedRound=savedRound(latest)
      if(latest.phase==='active'||latest.phase==='reserved'&&
        latest.rounds.some(round=>round.presentation==='intent')){
        reloadPrefix={id:latest.id,root:source,reason:latest.phase==='active'?'timing_unknown':'intent_withdrawn'}
        operation.check()
        flushSync(()=>{setCurrent(source);setAttemptId(latest.id);setRoundIndex(selectedRound)
          setTimingUnknown(latest.phase==='active');setStage('retired')})
        return
      }
      operation.check()
      flushSync(()=>{
        setCurrent(source);setAttemptId(latest.id);setRoundIndex(selectedRound)
        setStage(latest.phase==='reserved'||latest.phase==='between_rounds'?'ready':
          latest.phase==='round_review'?'review':'report')
        setHistorical(['terminal','abandoned'].includes(latest.phase)?{kind:'report',time:Date.now(),root:source,
          attemptId:latest.id,lost:null,drillView:latest.kind==='drill'?
            latest.snapshot as DrillSnapshot|null:undefined}:null)
      })
    })
    operation.check()
    if(reloadPrefix){
      const {id,root:source,reason}=reloadPrefix as {id:string;root:TrainingRoot;reason:'timing_unknown'|'intent_withdrawn'}
      const owner=await acquireTowersOwner(()=>undefined,operation.abort.signal)
      if(!operation.valid()){owner();operation.check()}
      try{operation.check();const next=await actions.retirePrefix(source,id,reason,operation)
        operation.check()
        await publishCurrent(operation,next,current=>{setCurrent(current)
          setHistorical({kind:'report',time:Date.now(),root:current,attemptId:id,lost:null})})
      }finally{owner()}
    }
    operation.check();focus()
  })}
  async function reconcile(){await run(async operation=>{
    if(withdrawal.current){
      if(!(await finishWithdrawal(new SettlementScope(operation.deadline-2500))))return
    }else{
      const confirmed=await actions.reconcilePending(operation);operation.check()
      const observed=confirmed?{status:'present' as const,root:confirmed}:await store.read(operation)
      operation.check()
      if(observed.status==='corrupt')throw Error('Training source requires explicit reset')
    }
    operation.check()
    await store.admit(operation,source=>{operation.check()
      flushSync(()=>{setCurrent(source);setNeedsRecovery(false);setCorruptToken(null)
        setStage('guide');setError('')})})
    focus()
  })}
  async function startRound(id:string,index:number){retireView();await run(async operation=>{
    if(!rootRef.current)throw Error('Training data unavailable')
    const epoch=++generation.current
    activeIdentity.current={id,index}
    anchor.current=null;wallAnchor.current=null;lastClockCheck.current=null
    captureOrder.current=0
    const ownerAbort=new AbortController()
    let provisionalRelease:(()=>void)|null=null,handed=false
    const abortWaiting=()=>{ownerAbort.abort()
      // Retire this provisional bridge immediately. A raw callback may stay
      // unknown, but it cannot later close a newer view or lease.
      if(provisionalRelease&&!handed&&epoch===generation.current&&
        releaseOwner.current===provisionalRelease)
        void withdraw('interrupted','start_failed')
    }
    operation.abort.signal.addEventListener('abort',abortWaiting,{once:true})
    let owner:()=>void
    try{owner=await acquireTowersOwner(()=>{
      if(epoch===generation.current)void withdraw('interrupted','owner_lost')
    },ownerAbort.signal)}
    catch(error){operation.abort.signal.removeEventListener('abort',abortWaiting);throw error}
    let released=false
    const ownedRelease=()=>{if(released)return;released=true
      operation.abort.signal.removeEventListener('abort',abortWaiting);ownerAbort.abort();owner()}
    provisionalRelease=ownedRelease
    if(!operation.valid()||epoch!==generation.current){ownedRelease();return}
    releaseOwner.current=ownedRelease
    try{
      const source=rootRef.current.attempts[id]
      operation.check();if(epoch!==generation.current)throw Error('Training view changed')
      activeContext.current=source?.context??null
      if(!source||!['reserved','between_rounds'].includes(source.phase)||
        !['unseen','intent'].includes(source.rounds[index]?.presentation))
        throw Error('This round is no longer ready to start')
      if(source.kind==='drill'&&rootRef.current.chains[source.attachment.chainId as string]?.drillRule==='sequencing')
        await prepareRouteMap(operation)
      operation.check()
      const intended=source.rounds[index].presentation==='intent'?rootRef.current:
        await actions.intent(rootRef.current,id,index,operation)
      operation.check();if(epoch!==generation.current)throw Error('Training view changed or timed out')
      flushSync(()=>{setCurrent(intended);setAttemptId(id);setRoundIndex(index);setTimingUnknown(false);
        setStage('play');setPlaying(false)})
      await frames(operation)
      operation.check();if(epoch!==generation.current||!sceneValid())throw Error('Board display or context unavailable')
      anchor.current=performance.now();wallAnchor.current=Date.now();lastClockCheck.current=anchor.current
      await actions.onset(intended,id,index,capture(0),operation,source=>{
        operation.check()
        if(epoch!==generation.current||released||releaseOwner.current!==ownedRelease||
          ownerAbort.signal.aborted||source.revision!==intended.revision+1||
          source.attempts[id]?.rounds[index]?.puzzlePhase!=='active')
          throw Error('Training live source changed before controls')
        operation.check()
        flushSync(()=>{setCurrent(source);setElapsed(0);setPlaying(true);withdrawal.current=null})
        operation.check()
        if(epoch!==generation.current||released||releaseOwner.current!==ownedRelease||!sceneValid())
          throw Error('Training live display changed before handoff')
        // No await or user callback between registering L and ending P's O bridge.
        liveLease.current={generation:epoch,release:ownedRelease}
        handed=true
        operation.abort.signal.removeEventListener('abort',abortWaiting)
      })
      operation.check();if(epoch!==generation.current)throw Error('Training view changed')
      if(operation.valid())focus()
    }catch(cause){
      if(!handed&&releaseOwner.current===ownedRelease)
        void withdraw('interrupted','start_failed')
      if(!handed&&liveLease.current?.release===ownedRelease)liveLease.current=null
      throw cause}
  })}
  async function doAction(kind:'move'|'undo'|'reset',payload:Record<string,unknown>={}){
    if(!rootRef.current||!current||!releaseOwner.current||liveLease.current?.generation!==generation.current||
      anchor.current===null||busyRef.current||withdrawal.current)return
    const expected=current.context.inputMode as InputMode
    if(kind==='move'&&payload.input!==expected){setError(`This training chain uses ${expected} input. Use the selected controls.`);return}
    if(!sceneValid()){withdraw('interrupted','context_changed');return}
    const raw=performance.now()-anchor.current
    if(raw>=120000){withdraw('interrupted','expired');return}
    const captured=Math.floor(raw),admitted=capture(raw),id=current.id,index=roundIndex
    let capacity=false,published=false
    const work=run(async operation=>{
      let next:TrainingRoot
      operation.check()
      try{next=await actions.append(rootRef.current!,id,index,kind,captured,payload,admitted,
        operation,source=>{
          operation.check()
          if(withdrawal.current||liveLease.current?.generation!==generation.current)
            throw Error('Training live authority changed')
          flushSync(()=>{
            setCurrent(source);setSelected(null)
            setMessage(boardText(roundState(source.attempts[id],index).board))
            if(source.attempts[id].rounds[index].puzzlePhase==='solved'){
              setPlaying(false);release();setStage('review')
            }
          })
          operation.check();published=true
        })}
      catch(cause){if(cause instanceof Capacity)capacity=true;throw cause}
      rememberSettled(next)
      if(next.attempts[id].rounds[index].puzzlePhase==='solved')focus()
    })
    const outcome=await work
    if(capacity)void withdraw('interrupted','event_capacity')
    else if(outcome===null&&!published&&liveLease.current?.generation===generation.current)
      void withdraw('interrupted','save_unconfirmed')
  }
  async function doCoach(kind:JournalRecord['kind'],payload:Record<string,unknown>={}){
    if(!rootRef.current||!current||busyRef.current||withdrawal.current)return
    const terminal=['solved','expired'].includes(current.rounds[roundIndex].puzzlePhase)
    if(!terminal&&liveLease.current?.generation!==generation.current)return
    if(!terminal&&!sceneValid()){withdraw('interrupted','context_changed');return}
    const raw=anchor.current===null?Infinity:performance.now()-anchor.current
    if(!terminal&&(!releaseOwner.current||raw>=120000)){withdraw('interrupted','expired');return}
    const admitted=terminal?null:capture(raw)
    let capacity=false,published=false
    const work=run(async operation=>{
      let next:TrainingRoot
      operation.check()
      try{next=terminal?await withReview(operation,()=>actions.review(rootRef.current!,current.id,roundIndex,
        kind as 'tracking_answer'|'tracking_continue',payload,operation)):
        await actions.coach(rootRef.current!,current.id,roundIndex,kind,Math.floor(raw),payload,
          admitted!,operation,source=>{
            operation.check()
            if(withdrawal.current||liveLease.current?.generation!==generation.current)
              throw Error('Training live authority changed')
            flushSync(()=>setCurrent(source))
            operation.check();published=true
          })
      }catch(cause){if(cause instanceof Capacity)capacity=true;throw cause}
      rememberSettled(next)
      if(terminal&&operation.valid()&&!withdrawal.current)
        await publishCurrent(operation,next,source=>{setCurrent(source);published=true})
    })
    const outcome=await work
    if(capacity)void withdraw('interrupted','event_capacity')
    else if(!terminal&&outcome===null&&!published&&releaseOwner.current&&
      liveLease.current?.generation===generation.current)
      void withdraw('interrupted','save_unconfirmed')
  }
  async function withReview<T>(operation:ViewOperation,work:()=>Promise<T>):Promise<T>{
    operation.check()
    const release=await store.claimReview(operation,()=>{
      if(operation.valid())setError('Another training tab owns review')
    })
    if(!operation.valid()){release();operation.check()}
    releaseReview.current=release
    try{operation.check();return await work()}finally{release();
      if(releaseReview.current===release)releaseReview.current=null}
  }
  async function reviewRound(){if(!rootRef.current||!current)return
    await run(async operation=>{
      const result=await withReview(operation,async()=>{
        let next=rootRef.current!
        if(!next.attempts[current.id].rounds[roundIndex].reviewed)
          next=await actions.review(next,current.id,roundIndex,'round_reviewed',{},operation)
        operation.check()
        const a=next.attempts[current.id]
        if(a.phase==='round_review'&&roundIndex===1)next=await actions.completeExercise(next,a.id,operation)
        return next
      })
      operation.check()
      const a=result.attempts[current.id]
      if(a.phase==='between_rounds'){
        await publishCurrent(operation,result,source=>{setCurrent(source);setHistorical(null)
          setRoundIndex(1);setStage('ready')});focus()
      }else await admit('report',current.id,undefined,operation)
    })
  }
  async function assign(){if(!rootRef.current||!current)return
    await run(async operation=>{const next=await withReview(operation,()=>actions.assign(rootRef.current!,current.id,operation))
      operation.check()
      await publishCurrent(operation,next,source=>{setCurrent(source);setHistorical(null);setStage('ready')});focus()})}
  async function startDrill(familiar=false){if(!rootRef.current||!chain)return
    await run(async operation=>{const next=await withReview(operation,()=>actions.reserveDrill(rootRef.current!,chain.id,familiar,operation))
      operation.check()
      const a=Object.values(next.attempts).sort((a,b)=>b.ordinal-a.ordinal)[0]
      await publishCurrent(operation,next,source=>{setCurrent(source);setAttemptId(a.id);setRoundIndex(0)
        setHistorical(null);setStage('ready')});focus()})}
  async function startRetest(){if(!rootRef.current||!chain)return
    await run(async operation=>{
      const existing=Object.values(rootRef.current!.attempts).find(a=>a.kind==='retest'&&
        a.eligibility==='eligible'&&a.attachment.chainId===chain.id&&a.phase==='reserved'&&
        a.rounds[0].presentation==='unseen')
      if(existing){await store.admit(operation,source=>{
        operation.check()
        const saved=source.attempts[existing.id]
        if(!saved||saved.phase!=='reserved'||saved.rounds[0].presentation!=='unseen')
          throw Error('Saved retest reservation changed')
        operation.check()
        flushSync(()=>{setCurrent(source);setAttemptId(saved.id);setRoundIndex(0)
          setHistorical(null);setStage('ready')})
      });operation.check();focus();return}
      const next=await withReview(operation,()=>actions.reserveRetest(rootRef.current!,chain.id,operation))
      operation.check()
      if(next.chains[chain.id].status==='exhausted'){
        await publishCurrent(operation,next,source=>{setCurrent(source)
          setError('All six unseen retest puzzles have been used in this browser’s retained data.');
          setStage('ready')});focus();return
      }
      const a=Object.values(next.attempts).sort((a,b)=>b.ordinal-a.ordinal)[0]
      await publishCurrent(operation,next,source=>{setCurrent(source);setAttemptId(a.id);setRoundIndex(0)
        setHistorical(null);setStage('ready')});focus()})}
  async function restartFamiliar(){
    const sourceId=attemptId
    if(!sourceId)return
    await run(async operation=>{
      if(stage==='play')await withdraw('exited','user_exit',operation)
      operation.check()
      const base=rootRef.current,source=base?.attempts[sourceId]
      if(!base||source?.phase!=='terminal')throw Error('Restart waits for the saved terminal result')
      const next=await withReview(operation,()=>actions.reserveFamiliar(base,sourceId,operation))
      operation.check()
      const newer=Object.values(next.attempts).sort((a,b)=>b.ordinal-a.ordinal)[0]
      await publishCurrent(operation,next,source=>{setCurrent(source);setAttemptId(newer.id)
        setRoundIndex(0);setSelected(null);setHistorical(null);setStage('ready')});focus()
    })
  }
  async function compare(){if(!rootRef.current||!chain||!current)return
    await run(async operation=>{
      await withReview(operation,()=>actions.compare(rootRef.current!,chain.id,current.id,operation))
      operation.check()
      await admit('comparison',undefined,chain.id,operation)
    })
  }
  async function admit(kind:Historical['kind'],id?:string,chainId?:string,
    parentOperation?:ViewOperation):Promise<boolean>{
    const epoch=viewEpoch.current
    const work=async(operation:ViewOperation)=>{
    await initialRead.current?.catch(()=>undefined);operation.check()
    let drillView:DrillSnapshot|null|undefined
    let preparedBytes:string|null=null
    if(kind==='report'){
      const prepared=await store.read(operation);operation.check()
      if(prepared.status!=='present')throw Error('Report source removed')
      const a=prepared.root.attempts[id??'']
      if(a?.kind==='drill'){
        drillView=await replayAttempt(a,true,operation) as DrillSnapshot|null
        preparedBytes=canonical(prepared.root)
      }
    }
    await store.admit(operation,source=>{
      operation.check()
      if(preparedBytes!==null&&canonical(source)!==preparedBytes)
        throw Error('Report source changed during preparation')
      if(epoch!==viewEpoch.current)throw Error('Training view changed')
      if(kind==='report'){
        const a=source.attempts[id??''];if(!a||!['terminal','abandoned'].includes(a.phase))throw Error('Report source removed')
      }else if(kind==='comparison'){
        const c=source.chains[chainId??''];if(!c||c.status!=='compared'||!source.comparisons[c.id])
          throw Error('Comparison source removed')
      }
      operation.check()
      flushSync(()=>{setCurrent(source)
        if(kind==='report'&&id)setAttemptId(id)
        setHistorical({kind,time:Date.now(),root:source,attemptId:id,chainId,lost:null,drillView})
        setStage(kind==='history'?'history':kind==='comparison'?'comparison':'report')})
    });operation.check();focus();return true
    }
    const result=parentOperation?await work(parentOperation):await run(work)
    return result===true
  }
  async function refresh(){if(!historical||busyRef.current)return
    const epoch=viewEpoch.current,old=historical;setHistorical({...old,lost:'unverified'})
    await run(async operation=>{
      let refreshed=false
      try{refreshed=await admit(old.kind,old.attemptId,old.chainId,operation)}
      catch{operation.check()}
      operation.check()
      if(refreshed||epoch!==viewEpoch.current)return
      try{const observed=await store.read(operation);operation.check()
        if(observed.status==='absent'||observed.status==='present'&&
          (old.kind==='report'?!observed.root.attempts[old.attemptId??'']:
            old.kind==='comparison'?!observed.root.comparisons[old.chainId??'']:false))
          setHistorical({...old,lost:'known'})
      }catch{/* The prior snapshot remains explicitly unverified. */}
    })
  }
  async function removeAttempt(id:string){await run(async operation=>{
    const observed=await store.read(operation);operation.check()
    if(observed.status!=='present')throw Error('Training source unavailable')
    const next=await actions.deleteAttempt(observed.root,id,operation);operation.check()
    await publishCurrent(operation,next,source=>{setCurrent(source);setDeleteConfirm(null)
      if(attemptId===id){release();setPlaying(false);setAttemptId(null)}
      setHistorical(old=>old?{...old,lost:'known'}:old)})
  })}
  async function removeChain(id:string){await run(async operation=>{
    const observed=await store.read(operation);operation.check()
    if(observed.status!=='present')throw Error('Training source unavailable')
    const next=await actions.deleteChain(observed.root,id,operation);operation.check()
    await publishCurrent(operation,next,source=>{setCurrent(source);setDeleteConfirm(null)
      setHistorical(old=>old?{...old,lost:'known'}:old)})
  })}
  async function endTraining(id:string){await run(async operation=>{
    const observed=await store.read(operation);operation.check()
    if(observed.status!=='present')throw Error('Training source unavailable')
    const next=await withReview(operation,()=>actions.endChain(observed.root,id,operation));operation.check()
    await publishCurrent(operation,next,source=>{setCurrent(source);setDeleteConfirm(null)
      setAttemptId(null);setHistorical(null);setStage('guide')});focus()
  })}
  async function removeAll(){await run(async operation=>{
    const observed=await store.read(operation);operation.check()
    if(observed.status!=='present')throw Error('Training installation unavailable')
    const next=await actions.deleteAll(observed.root,operation);operation.check()
    await publishCurrent(operation,next,source=>{release();setPlaying(false)
      setAttemptId(null);setCurrent(source);setDeleteConfirm(null)
      setHistorical(old=>old?{...old,lost:'known'}:old)})
  })}
  async function resetCorrupt(){await run(async operation=>{
    if(!corruptToken)throw Error('No completed corrupt-data observation is available')
    const next=await store.resetCorrupt(corruptToken,operation);operation.check()
    await publishCurrent(operation,next,source=>{setCurrent(source);setCorruptToken(null)
      setDeleteConfirm(null);setAttemptId(null)
      setHistorical(old=>old?{...old,lost:'known'}:old)})
  })}
  function leave(){retireView();if(stage==='play')withdraw('exited','user_exit');release();onLibrary()}
  const display=historical?.root.attempts[historical.attemptId??'']
  const compareChain=historical?.root.chains[historical.chainId??'']
  const b=compareChain&&historical?.root.attempts[compareChain.baseline.attemptId]
  const r=compareChain?.completedRetest&&historical?.root.attempts[compareChain.completedRetest.attemptId]
  const sourceControlsDisabled=busy||!!historical?.lost
  return <Shell onLibrary={leave}><section className="journey towers-journey towers-training">
    {error&&<p role="alert" className="panel">{error}</p>}
    {needsRecovery&&<button disabled={busy} onClick={()=>void reconcile()}>Check saved outcome</button>}
    {stage==='guide'&&<div className="panel"><h1 ref={title} tabIndex={-1}>Towers Advanced Training</h1>
      <p>Start with a new two-minute puzzle, practise one assigned two-round exercise, then try another unseen puzzle.</p>
      <p>Only the top disk can move. Select a source tower, then any other tower as destination. Undo and Clear All do not refund time or moves.</p>
      <p>Training forms and results stay in this browser. No prior presentation is recorded in retained training data for an unused form. Deleted data, other browsers and earlier knowledge cannot be checked.</p>
      <fieldset><legend>Input for this training cycle</legend>{(['keyboard','pointer','touch','assistive'] as InputMode[]).map(mode=><label key={mode}>
        <input type="radio" name="training-input" checked={inputMode===mode} onChange={()=>setInputMode(mode)}/>{mode}</label>)}</fieldset>
      <button disabled={!!corruptToken} onClick={()=>{retireView();setStage('check');focus()}}>Next</button>
      {root&&<button onClick={()=>void continueSaved()}>Continue saved training</button>}
      {corruptToken&&<><button onClick={()=>setDeleteConfirm('corrupt')}>Reset corrupt Towers training data</button>
        {deleteConfirm==='corrupt'&&<div className="panel" role="alertdialog" aria-label="Confirm corrupt training reset">
          <p>{currentRecovery==='current'?
            'Reset the currently damaged Towers training data for this saved installation. This deletes its saved attempts, exposure and chains.':
            'Replace this unreadable Towers training installation? This deletes its saved attempts, exposure and chains.'}</p>
          <button onClick={()=>setDeleteConfirm(null)}>Cancel</button>
          <button disabled={busy} onClick={()=>void resetCorrupt()}>Confirm reset</button></div>}</>}
      <button onClick={()=>void admit('history')}>Training history</button></div>}
    {stage==='check'&&<div className="panel"><h1 ref={title} tabIndex={-1}>Check the rule</h1>
      <p>Can you move a disk that has another disk above it?</p>
      <label><input type="radio" checked={quiz==='yes'} onChange={()=>setQuiz('yes')}/> Yes</label>
      <label><input type="radio" checked={quiz==='no'} onChange={()=>setQuiz('no')}/> No</label>
      <button disabled={!quiz} onClick={()=>{if(quiz==='no'){retireView();setStage('ready');setError('');focus()}
        else setError('Only a top disk can move. Try again.')}}>Check answer</button></div>}
    {stage==='ready'&&<div className="panel"><h1 ref={title} tabIndex={-1}>{current?.phase==='terminal'?'Next training step':`Ready for ${current?.kind??'training'}?`}</h1>
      {current?<><p>{current.phase==='terminal'?'Completed training puzzle':
          current.kind==='drill'?'Coached exercise':current.eligibility==='familiar_review'?'Familiar review puzzle':'New training puzzle'} · {currentRound?.formId}</p>
        {current.kind==='drill'&&current.phase!=='terminal'&&<p>Round {roundIndex+1} of 2 · {rule?.replaceAll('_',' ')}</p>}
        {['unseen','intent'].includes(currentRound?.presentation??'')&&<p>The two-minute clock begins when the complete board appears.</p>}
        {['unseen','intent'].includes(currentRound?.presentation??'')&&
          <button disabled={busy} onClick={()=>void startRound(current.id,roundIndex)}>Start</button>}</>:
        <button disabled={busy} onClick={()=>void newBaseline()}>Start a new baseline</button>}
      {chain&&chain.status==='assigned'&&<><p>Assigned exercise: {chain.drillRule.replaceAll('_',' ')}. {routerRationale(chain)}</p>
        <button onClick={()=>void startDrill()}>Start assigned exercise</button></>}
      {chain&&chain.status==='drill_complete'&&<button onClick={()=>void startRetest()}>Start unseen retest</button>}
      {repeatAvailable(root,chain)&&
        <button onClick={()=>void startDrill(true)}>Repeat assigned exercise (familiar)</button>}
      {chain&&chain.status==='retesting'&&current?.kind==='retest'&&current.phase==='terminal'&&
        !['solved','expired'].includes((current.snapshot as Score)?.terminal)&&
        <button onClick={()=>void startRetest()}>Try a new unseen retest</button>}
      {chain&&chain.status==='compared'&&<button onClick={()=>void admit('comparison',undefined,chain.id)}>Open comparison</button>}
      {chain&&['assigned','drilling','drill_complete','retesting'].includes(chain.status)&&
        <button onClick={()=>{setDeleteConfirm(`end:${chain.id}`);void admit('history')}}>End this training cycle</button>}
      <button onClick={()=>void admit('history')}>Training history</button></div>}
    {stage==='play'&&scene&&current&&<div className="panel towers-play"><div className="towers-top">
      <h1 ref={title} tabIndex={-1}>{current.kind==='drill'?'Coached round':'Match the target'}</h1>
      <strong aria-label={`Time remaining ${asTime(120000-elapsed)}`}>{asTime(120000-elapsed)}</strong></div>
      <p>{currentRound?.formId} · {current.eligibility==='familiar_review'?'Familiar review':'Training'} · Move the top disk only</p>
      <p>Target</p><PuzzleBoard board={scene.form.target} target/>
      <p>Your board</p><PuzzleBoard board={scene.board} selected={selected} disabled={busy||!playing||
        (current.kind==='drill'&&(rule==='plan_before_action'&&!scene.confirmed||
          rule==='timed_planning'&&!scene.released||rule==='state_tracking'&&!!scene.prompt||
          rule==='sequencing'&&scene.block>=3))} declared={current.context.inputMode as InputMode} onTower={(index,source)=>{
        const expected=current.context.inputMode as InputMode
        if(source!==expected){setError(`This training chain uses ${expected} input.`);return}
        if(selected===null){if(scene.board[index].length){setSelected(index);sourceMode.current=source}return}
        if(selected===index){setSelected(null);sourceMode.current=null;return}
        if(sourceMode.current!==source){setError('Use the same input for source and destination.');return}
        const disk=scene.board[selected].at(-1)!;void doAction('move',{from:selected,to:index,disk,input:source})}}/>
      <details><summary>Keyboard source and destination controls</summary>
        <p>Use the same three tower buttons, or choose source and destination below. Escape cancels a selection.</p>
        {[0,1,2].map(i=><button key={`s${i}`} disabled={!playing||busy||!scene.board[i].length}
          onClick={event=>{const mode=activationMode(event,current.context.inputMode as InputMode)
            if(mode!==(current.context.inputMode as InputMode)){setError('Input mode differs from this training context.');return}
            sourceMode.current=mode;setSelected(i)}}>Source {i+1}</button>)}
        {[0,1,2].map(i=><button key={`d${i}`} disabled={selected===null||busy||!playing}
          onClick={event=>{const mode=activationMode(event,current.context.inputMode as InputMode)
            if(selected!==null&&selected!==i&&mode===sourceMode.current)void doAction('move',
            {from:selected,to:i,disk:scene.board[selected].at(-1),input:mode})}}>Destination {i+1}</button>)}
      </details>
      {current.kind==='drill'&&rule==='plan_before_action'&&scene.confirmed&&<div className="panel">
        <p>Confirmed plan reminder: {scene.plan.map(([from,to,disk])=>`Disk ${disk}: Tower ${from+1} → Tower ${to+1}`).join('; ')}</p>
        <p>These two proposed steps remain visible while you move. You may follow or change your route.</p></div>}
      {current.kind==='drill'&&rule==='plan_before_action'&&!scene.confirmed&&<div className="panel">
        <h2>Plan two moves</h2><p>Preview only; this does not move the live board or count placements.</p>
        <PuzzleBoard board={scene.planBoard} selected={planSelected} disabled={busy||!playing}
          onTower={index=>{if(planSelected===null){if(scene.planBoard[index].length)setPlanSelected(index);return}
            if(planSelected===index){setPlanSelected(null);return}
            void doCoach('plan_step',{from:planSelected,to:index,disk:scene.planBoard[planSelected].at(-1)})
            setPlanSelected(null)}}/>
        <p>Proposed steps: {scene.plan.map(([from,to,disk])=>`Disk ${disk}: ${from+1} → ${to+1}`).join('; ')||'none'}</p>
        <button disabled={!scene.plan.length||busy} onClick={()=>void doCoach('plan_undo')}>Undo plan</button>
        <button disabled={!scene.plan.length||busy} onClick={()=>void doCoach('plan_clear')}>Clear plan</button>
        <button disabled={scene.plan.length!==2||busy} onClick={()=>void doCoach('plan_confirm')}>Confirm plan</button></div>}
      {current.kind==='drill'&&rule==='timed_planning'&&!scene.released&&<div className="panel"><p>Plan before moving. Ten seconds is an advisory target; the clock keeps running.</p>
        {elapsed>=10000&&<p role="status">Ten seconds have passed; begin when ready.</p>}
        <button disabled={busy} onClick={()=>void doCoach('planning_release')}>Begin moves</button></div>}
      {current.kind==='drill'&&rule==='state_tracking'&&scene.prompt&&<div className="panel"><p>Have you reached this board earlier in this round?</p>
        {!scene.prompt.answered?<><button disabled={busy} onClick={()=>void doCoach('tracking_answer',
          {moveId:scene.prompt!.moveId,answer:true})}>Yes</button>
          <button disabled={busy} onClick={()=>void doCoach('tracking_answer',
            {moveId:scene.prompt!.moveId,answer:false})}>No</button></>:<><p>{scene.prompt.answer===scene.prompt.correct?'Correct.':'Incorrect.'} Correct answer: {scene.prompt.correct?'Yes':'No'} — this board was {scene.prompt.correct?'seen earlier':'new'} in this round.</p>
          <button disabled={busy} onClick={()=>void doCoach('tracking_continue',
            {moveId:scene.prompt!.moveId})}>Continue</button></>}</div>}
      {current.kind==='drill'&&rule==='sequencing'&&scene.block>=3&&<div className="panel"><p>Suggested next steps from the current board:</p>
        <ol>{shortestRoute(scene.board).slice(0,3).map(([from,to,disk],i)=><li key={i}>Disk {disk}: Tower {from+1} to Tower {to+1}</li>)}</ol>
        <button disabled={busy} onClick={()=>void doCoach('checkpoint_ack',
          {board:scene.board,steps:shortestRoute(scene.board).slice(0,3)})}>I have checked these steps</button></div>}
      {current.kind==='drill'&&rule==='sequencing'&&scene.block<3&&<p>Suggested steps from the last checkpoint: {scene.checkpoints.map(([from,to,disk])=>
        `Disk ${disk}, ${from+1} to ${to+1}`).join('; ')}</p>}
      <div className="towers-actions"><button disabled={selected===null} onClick={()=>setSelected(null)}>Cancel selection</button>
        <button disabled={!scene.canUndo||busy||!playing} onClick={()=>void doAction('undo',
          {moveId:scene.undoMoveId})}>Undo</button>
        <button disabled={busy||!playing} onClick={()=>void doAction('reset')}>Clear All</button>
        <button onClick={()=>void restartFamiliar()}>Restart as familiar review</button>
        <button onClick={()=>void withdraw('exited','user_exit')}>End attempt</button></div>
      <p role="status" aria-live="polite">{message}</p></div>}
    {stage==='retired'&&<div className="panel"><h1 ref={title} tabIndex={-1}>Training play has ended</h1>
      <p>{timingUnknown?'The prior live clock cannot be reconstructed after reload. Its retained prefix is review-only with timing unknown and no score.':
        'The live board is closed. The saved outcome may still need confirmation.'}</p>
      <button onClick={()=>void admit('history')}>Check saved training history</button>
      <button onClick={()=>{retireView();setStage('guide');focus()}}>Training guide</button></div>}
    {stage==='review'&&current&&<div className="panel"><h1 ref={title} tabIndex={-1}>{currentRound?.puzzlePhase==='solved'?'Puzzle complete':
      currentRound?.puzzlePhase==='expired'?'Time is up':'Attempt ended'}</h1>
      <p>This round is saved as {currentRound?.puzzlePhase}. Review the recorded result before moving on.</p>
      {current.kind==='drill'&&rule==='state_tracking'&&scene?.prompt&&<div className="panel">
        <p>Final board question: Have you reached this board earlier in this round?</p>
        {!scene.prompt.answered?<><button onClick={()=>void doCoach('tracking_answer',
          {moveId:scene.prompt!.moveId,answer:true})}>Yes</button>
          <button onClick={()=>void doCoach('tracking_answer',
            {moveId:scene.prompt!.moveId,answer:false})}>No</button></>:
          <><p>{scene.prompt.answer===scene.prompt.correct?'Correct.':'Incorrect.'} Correct answer: {scene.prompt.correct?'Yes':'No'} — this board was {scene.prompt.correct?'seen earlier':'new'} in this round.</p>
            <button onClick={()=>void doCoach('tracking_continue',
              {moveId:scene.prompt!.moveId})}>Continue</button></>}</div>}
      {current.kind==='drill'?<button disabled={busy||!!scene?.prompt} onClick={()=>void reviewRound()}>Review round</button>:
        <><button onClick={()=>void admit('report',current.id)}>Next: report</button>
          <button onClick={()=>void restartFamiliar()}>Restart as familiar review</button></>}</div>}
    {stage==='report'&&<div className="panel"><h1 ref={title} tabIndex={-1}>Training report</h1>
      {historical&&historical.kind==='report'?<><p className="note" role="status">{label(historical)}</p>
        {display&&<><p>{display.kind} · {display.rounds.map(x=>x.formId).join(', ')} · {display.eligibility} ·
          {display.versions.report as string} · {display.context.contextVersion as string} ·
          {display.context.inputMode as string}</p>
          {display.kind==='drill'?<><p>Two coached rounds {display.phase==='terminal'?'completed':'incomplete'}.
            Completion records participation, not a training effect.</p>
            {(historical.drillView??display.snapshot as DrillSnapshot|null)?.roundResults.map((item,i)=><div key={item.roundId}>
              <h2>Round {i+1} · {display.rounds[i].formId}</h2><p>Executed: {item.executed?'yes':'no'} ·
                Reviewed: {item.reviewed?'yes':'no'} · Checkpoints: {item.coaching.checkpoints} ·
                Tracking answers: {item.coaching.answers.length}</p>
              {item.coaching.plan.length>0&&<p>Recorded plan: {item.coaching.plan.map(([from,to,disk])=>
                `Disk ${disk}: Tower ${from+1} → Tower ${to+1}`).join('; ')}.</p>}
              {['TT1-D03','TT1-D04'].includes(display.rounds[i].formId)&&<p>Planning release: {sec(item.coaching.releaseMs)}.
                Ten-second advisory target: {item.coaching.releaseMs===null?'not reached':
                  item.coaching.releaseMs<=10000?'within target':'after target'}.</p>}
              {['TT1-D05','TT1-D06'].includes(display.rounds[i].formId)&&<p>First-answer accuracy: {item.coaching.answers.filter(answer=>answer.correct).length}/{item.coaching.answers.length}.</p>}
              {item.score&&<ScoreDetails score={item.score}/>}</div>)}
          </>:display.snapshot?<ScoreDetails score={display.snapshot as Score}/>:
            <p>Saved prefix: {display.records.filter(event=>event.kind==='move').length} accepted placements. No terminal score or reconstructed clock is available.</p>}</>}
        <button onClick={()=>void refresh()}>Refresh</button></>:<p>Exercise status: {current?.phase??'unavailable'}.</p>}
      {current?.kind==='baseline'&&current.phase==='terminal'&&current.claim==='unclaimed'&&<button disabled={sourceControlsDisabled} onClick={()=>void assign()}>Choose assigned exercise</button>}
      {chain?.status==='assigned'&&<><p>Assigned exercise: {chain.drillRule.replaceAll('_',' ')}. {routerRationale(chain)}</p>
        <button disabled={sourceControlsDisabled} onClick={()=>void startDrill()}>Start assigned exercise</button></>}
      {chain?.status==='drill_complete'&&<button disabled={sourceControlsDisabled} onClick={()=>void startRetest()}>Start unseen retest</button>}
      {repeatAvailable(root,chain)&&
        <button disabled={sourceControlsDisabled} onClick={()=>void startDrill(true)}>Repeat assigned exercise (familiar)</button>}
      {chain?.status==='retesting'&&current?.kind==='retest'&&current.phase==='terminal'&&
        !['solved','expired'].includes((current.snapshot as Score)?.terminal)&&
        <button disabled={sourceControlsDisabled} onClick={()=>void startRetest()}>Try a new unseen retest</button>}
      {chain?.status==='compared'&&<button disabled={sourceControlsDisabled} onClick={()=>void admit('comparison',undefined,chain.id)}>Open comparison</button>}
      {chain?.status==='retesting'&&current?.kind==='retest'&&current.phase==='terminal'&&
        ['solved','expired'].includes((current.snapshot as Score)?.terminal)&&
        <button disabled={sourceControlsDisabled} onClick={()=>void compare()}>Show comparison</button>}
      {chain&&['assigned','drilling','drill_complete','retesting'].includes(chain.status)&&
        <button disabled={sourceControlsDisabled} onClick={()=>{setDeleteConfirm(`end:${chain.id}`);void admit('history')}}>End this training cycle</button>}
      <button onClick={()=>void admit('history')}>Training history</button>
      <p className="note">{displayFirstPartyBrand('These are different original Assessment Practice puzzles. Equal nine-move minima do not establish equal difficulty.')}</p></div>}
    {stage==='comparison'&&historical&&<div className="panel"><h1 ref={title} tabIndex={-1}>Baseline and retest</h1>
      <p role="status">{label(historical)} Displayed differences are historical and may no longer be a current saved comparison.</p>
      {b&&r&&<><p>Baseline: {b.rounds[0].formId} · Retest: {r.rounds[0].formId} ·
        {b.versions.report as string} · {b.context.contextVersion as string} · {b.context.inputMode as string}</p>
        <ComparisonDetails baseline={b.snapshot as Score} retest={r.snapshot as Score}/></>}
      <p>Ordinary variation, familiarity and other factors may affect the difference. This does not show that the exercise caused a change.</p>
      <button onClick={()=>void refresh()}>Refresh</button><button onClick={()=>void admit('history')}>Training history</button></div>}
    {stage==='history'&&historical&&<div className="panel"><h1 ref={title} tabIndex={-1}>Training history</h1>
      <p role="status">{label(historical)}</p><button onClick={()=>void refresh()}>Refresh</button>
      <ul>{Object.values(historical.root.attempts).sort((a,b)=>b.createdWallMs-a.createdWallMs||a.id.localeCompare(b.id))
        .map(a=><li key={a.id}>{a.kind} · {a.rounds.map(x=>x.formId).join(', ')} · {a.phase} ·
          {new Date(a.createdWallMs).toLocaleString()}
          {['terminal','abandoned'].includes(a.phase)&&<button disabled={sourceControlsDisabled} onClick={()=>void admit('report',a.id)}>Open report</button>}
          <button disabled={sourceControlsDisabled} onClick={()=>setDeleteConfirm(a.id)}>Delete training attempt</button></li>)}</ul>
      {Object.values(historical.root.chains).map(c=><p key={c.id}>Chain {c.id} · {c.status}
        {c.status==='compared'&&<button disabled={sourceControlsDisabled} onClick={()=>void admit('comparison',undefined,c.id)}>Open comparison</button>}
        {['assigned','drilling','drill_complete','retesting'].includes(c.status)&&
          <button disabled={sourceControlsDisabled} onClick={()=>setDeleteConfirm(`end:${c.id}`)}>End this training cycle</button>}
        <button disabled={sourceControlsDisabled} onClick={()=>setDeleteConfirm(`chain:${c.id}`)}>Delete chain</button></p>)}
      <button disabled={sourceControlsDisabled} onClick={()=>setDeleteConfirm('all')}>Delete all Towers training data</button>
      {deleteConfirm&&<div className="panel" role="alertdialog" aria-label="Confirm training deletion">
        <p>{deleteConfirm.startsWith('end:')?'End this training cycle? Its saved attempts remain for review; any reserved unseen retest is released.':
          `Delete ${deleteConfirm==='all'?'all Towers training data':deleteConfirm.startsWith('chain:')?'this training chain':'this attempt'}? This also clears its retained local exposure and dependent training links. Deleted data cannot be recovered here.`}</p>
        <button onClick={()=>setDeleteConfirm(null)}>Cancel</button>
        <button disabled={busy} onClick={()=>void (deleteConfirm==='all'?removeAll():deleteConfirm.startsWith('chain:')?removeChain(deleteConfirm.slice(6)):
          deleteConfirm.startsWith('end:')?endTraining(deleteConfirm.slice(4)):removeAttempt(deleteConfirm))}>
          {deleteConfirm.startsWith('end:')?'Confirm end':'Confirm deletion'}</button></div>}
      <button onClick={()=>{retireView();setHistorical(null);setStage('guide');focus()}}>Back to training guide</button></div>}
  </section></Shell>
}
