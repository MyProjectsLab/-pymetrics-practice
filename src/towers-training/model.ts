import { copyBoard, sameBoard } from '../towers/engine'
import type { Board } from '../towers/forms'
import { canonical, formById, placement, prepareRouteMap, shortestRoute } from './bank'
import type { TrainingForm } from './bank'
import { validateEnvelope, validateShape } from './schema'
import { ownJson } from './domain'
import type { WorkScope } from './authority'

export type Rule = 'state_tracking' | 'plan_before_action' | 'timed_planning' | 'sequencing'
export type RecordKind = 'board_onset' | 'move' | 'undo' | 'reset' | 'solved' | 'expired' |
  'interrupted' | 'exited' | 'plan_step' | 'plan_undo' | 'plan_clear' | 'plan_confirm' |
  'planning_release' | 'tracking_answer' | 'tracking_continue' | 'checkpoint_ack' |
  'round_reviewed' | 'exercise_completed'
export interface JournalRecord {
  seq: number; id: string; roundId: string; elapsedMs: number; wallMs: number
  puzzleRevision: number; kind: RecordKind; payload: Record<string, unknown>
}
export interface Round {
  id: string; index: number; formId: string; formHash: string
  presentation: 'unseen' | 'intent' | 'onset'
  puzzlePhase: 'reserved' | 'active' | 'solved' | 'expired' | 'interrupted' | 'exited'
  reviewPhase: 'not_ready' | 'pending' | 'reviewed'; reviewed: boolean
}
export interface Attempt {
  id: string; installationId: string; ordinal: number; revision: number; createdWallMs: number
  versions: Record<string, unknown>; context: Record<string, unknown>
  kind: 'baseline' | 'retest' | 'drill'; eligibility: 'eligible' | 'familiar_review'
  claim: 'unclaimed' | 'used' | 'retired'; attachment: Record<string, unknown>
  rounds: Round[]; records: JournalRecord[]
  phase: 'reserved' | 'active' | 'round_review' | 'between_rounds' | 'terminal' | 'abandoned'
  snapshot: unknown | null
}
export interface Descriptor { attemptId: string; sourceDigest: string }
export interface Chain {
  id: string; version: string; revision: number; createdWallMs: number
  context: Record<string, unknown>; baseline: Descriptor; recommendation: Recommendation
  drillRule: Rule; drillFormIds: [string, string]; firstGrant: Descriptor | null
  reservedRetestFormId: string | null; retestAttemptIds: string[]; completedRetest: Descriptor | null
  status: 'assigned' | 'drilling' | 'drill_complete' | 'retesting' | 'compared' | 'exhausted' | 'ended'
}
export interface Recommendation {
  version: 'towers-training-router/1'; rule: Rule; metrics: {
    status: 'solved' | 'expired'; moves: number; planningMs: number | null
    repeatedStateArrivals: number; immediateReversals: number; excess: number | null
  }; reasonCode: Rule
}
export interface TrainingRoot {
  version: 'towers-training-root/1'; installationId: string; revision: number; nextOrdinal: number
  attempts: Record<string, Attempt>; chains: Record<string, Chain>
  comparisons: Record<string, Record<string, unknown>>
  requests: Record<string, Record<string, unknown>>; activity: Record<string, unknown>[]
  tombstones: Record<string, true>
}
export interface Score {
  version: 'towers-training-score/1'; terminal: 'solved' | 'expired' | 'interrupted' | 'exited'
  moves: number; optimal: 9; excess: number | null; planningMs: number | null
  solutionMs: number | null; timeUsedMs: number; undoCount: number; resetCount: number
  repeatedStateArrivals: number; immediateReversals: number; interMoveMedianMs: number | null
  finalBoard: Board; recordDigest: string
}
export interface RoundResult { roundId: string; score: Score | null; executed: boolean; reviewed: boolean
  coaching: { plan: [number, number, number][]; releaseMs: number | null
    answers: { moveId: string; firstAnswer: boolean; correct: boolean }[]; checkpoints: number } }
export interface DrillSnapshot { version: 'towers-training-score/1'; roundResults: [RoundResult, RoundResult]
  exerciseCompleted: boolean; recordDigest: string }

const PUZZLE = new Set<RecordKind>(['board_onset','move','undo','reset','solved','expired','interrupted','exited'])
const FORMS: Record<Rule, [string, string]> = {
  plan_before_action: ['TT1-D01','TT1-D02'], timed_planning: ['TT1-D03','TT1-D04'],
  state_tracking: ['TT1-D05','TT1-D06'], sequencing: ['TT1-D07','TT1-D08'],
}
function need(condition: unknown, why: string): asserts condition {
  if (!condition) throw Error(`Training journal: ${why}`)
}
export function drillRule(attempt: Attempt): Rule | null {
  if (attempt.kind !== 'drill') return null
  const ids = attempt.rounds.map(round => round.formId)
  const rule = (Object.keys(FORMS) as Rule[]).find(key => ids.join('|') === FORMS[key].join('|'))
  need(rule, 'unknown drill inventory')
  return rule
}
function boardKey(board: Board) { return canonical(board) }
/** A task yield that is not subject to background-tab timer clamping. */
function yieldSlice(scope:WorkScope): Promise<void> {
  scope.check()
  return new Promise((resolve,reject)=>{
    const channel=new MessageChannel()
    const cleanup=()=>{scope.signal.removeEventListener('abort',abort);channel.port1.close();channel.port2.close()}
    const abort=()=>{cleanup();reject(Error('Training validation canceled'))}
    scope.signal.addEventListener('abort',abort,{once:true})
    channel.port1.onmessage=()=>{cleanup();try{scope.check();resolve()}catch(error){reject(error)}}
    channel.port2.postMessage(null)
  })
}
/** Build the exact canonical byte stream in finite cooperative replay slices. */
async function canonicalSliced(value: unknown, scope:WorkScope): Promise<string> {
  const parts: string[]=[]
  let count=0,sliceStart=performance.now()
  async function step(item: unknown): Promise<void> {
    if(++count % 64===0 || performance.now()-sliceStart>=2){
      scope.check()
      await yieldSlice(scope)
      scope.check()
      sliceStart=performance.now()
    }
    if(Array.isArray(item)){
      parts.push('[')
      for(let i=0;i<item.length;i++){if(i)parts.push(',');await step(item[i])}
      parts.push(']')
    }else if(item&&typeof item==='object'){
      parts.push('{')
      const object=item as Record<string,unknown>,keys=Object.keys(object).sort()
      for(let i=0;i<keys.length;i++){
        if(i)parts.push(',')
        parts.push(JSON.stringify(keys[i]),':')
        await step(object[keys[i]])
      }
      parts.push('}')
    }else parts.push(canonical(item))
  }
  await step(value)
  scope.check()
  const result=parts.join('')
  scope.check()
  return result
}
export const scopedCanonical=canonicalSliced
// A retired activation cannot free an outstanding native digest merely by
// abandoning its promise. This slot survives Store replacement in the document.
let activeDigest=false
async function digestSliced(value:unknown,scope:WorkScope):Promise<string>{
  scope.check()
  if(activeDigest)throw Error('Previous training digest is still pending')
  activeDigest=true
  try{
    const bytes=new TextEncoder().encode(await canonicalSliced(value,scope))
    scope.check()
    const digest=await crypto.subtle.digest('SHA-256',bytes)
    scope.check()
    return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('')
  }finally{activeDigest=false}
}
export const scopedDigest=digestSliced
interface ReplayState {
  form: TrainingForm; board: Board; seen: Set<string>; undo: { board: Board; moveId: string }[]
  puzzle: JournalRecord[]; puzzleRevision: number; lastMs: number
  terminal: Score['terminal'] | null; moves: number; repeated: number; reversals: number
  undoCount: number; resetCount: number; planningMs: number | null
  previous: [number, number, number] | null; previousMs: number | null; gaps: number[]
  mustSolve: boolean; plan: [number, number, number][]; planBoard: Board; confirmed: boolean
  releaseMs: number | null; prompt: { moveId: string; correctValue: boolean; answered: boolean } | null
  answers: { moveId: string; firstAnswer: boolean; correct: boolean }[]
  checkpoints: number; block: number; reviewed: boolean; executed: boolean
  score?: Score
  checkpointSteps: [number,number,number][]
}
interface ReplayFrame {
  readonly states: ReplayState[]; readonly ids:Set<string>
  readonly complete:boolean; readonly lastRound:number; readonly recordCount:number
}
const replayFrames=new WeakMap<Attempt,ReplayFrame>()
function copyReplayState(state:ReplayState):ReplayState {
  return {...state,board:copyBoard(state.board),seen:new Set(state.seen),
    undo:state.undo.slice(),puzzle:state.puzzle.slice(),gaps:state.gaps.slice(),
    previous:state.previous?[...state.previous]:null,plan:state.plan.slice(),
    planBoard:copyBoard(state.planBoard),prompt:state.prompt?{...state.prompt}:null,
    answers:state.answers.slice(),checkpointSteps:state.checkpointSteps.slice()}
}
function initial(form: TrainingForm): ReplayState {
  return { form, board: copyBoard(form.start), seen: new Set([boardKey(form.start)]), undo: [],
    puzzle: [], puzzleRevision: 0, lastMs: 0, terminal: null, moves: 0, repeated: 0,
    reversals: 0, undoCount: 0, resetCount: 0, planningMs: null, previous: null,
    previousMs: null, gaps: [], mustSolve: false, plan: [], planBoard: copyBoard(form.start),
    confirmed: false, releaseMs: null, prompt: null, answers: [], checkpoints: 0,
    block: 3, reviewed: false, executed: false,checkpointSteps:[] }
}
function median(values: number[]): number | null {
  if (values.length < 3) return null
  const sorted = [...values].sort((a,b) => a-b)
  return sorted.length % 2 ? sorted[(sorted.length-1)/2] :
    (sorted[sorted.length/2-1] + sorted[sorted.length/2]) / 2
}
function exactSteps(board: Board): [number,number,number][] {
  return shortestRoute(board).slice(0,3)
}
export function coachingComplete(state: Pick<ReplayState,'confirmed'|'releaseMs'|'prompt'|'checkpoints'>,rule: Rule): boolean {
  return rule === 'plan_before_action' ? state.confirmed :
    rule === 'timed_planning' ? state.releaseMs !== null :
    rule === 'state_tracking' ? state.prompt === null : state.checkpoints > 0
}
/** Semantic replay is mandatory after schema validation; it does not trust stored scores or round caches. */
export async function replayAttempt(attempt: Attempt, enforceSnapshot: boolean, scope:WorkScope,
  prior?:Attempt): Promise<Score | DrillSnapshot | null> {
  scope.check()
  need(attempt.rounds.length === (attempt.kind === 'drill' ? 2 : 1), 'round count')
  need(attempt.versions.exercise === (attempt.kind === 'drill' ? 'towers-training-exercise-events/1' : null), 'exercise version')
  const rule = drillRule(attempt)
  if(rule==='sequencing'&&attempt.records.some(event=>event.kind==='checkpoint_ack'))
    await prepareRouteMap(scope)
  const initialStates = attempt.rounds.map((round, index) => {
    need(round.id === `${attempt.id}_r${index}` && round.index === index, 'round identity')
    const form = formById(round.formId)
    need(round.formHash === form.hash && form.family === attempt.kind, 'form identity')
    return initial(form)
  })
  const previous=prior&&replayFrames.get(prior)
  const reuse=previous&&prior&&previous.recordCount===prior.records.length&&
    attempt.records.length>=previous.recordCount&&
    prior.records.every((record,index)=>attempt.records[index]===record)
  const states=reuse?previous.states.map(copyReplayState):initialStates
  const ids=reuse?new Set(previous.ids):new Set<string>()
  let complete = reuse?previous.complete:false, lastRound = reuse?previous.lastRound:0
  const start=reuse?previous.recordCount:0
  let sliceStart = performance.now()
  for (let index=start;index<attempt.records.length;index++) {
    const event=attempt.records[index]
    if (index && (index % 64 === 0 || performance.now() - sliceStart >= 2)) {
      scope.check()
      await yieldSlice(scope)
      scope.check()
      sliceStart = performance.now()
    }
    need(!complete && event.seq === index + 1 && !ids.has(event.id), 'sequence/id')
    ids.add(event.id)
    const roundIndex = attempt.rounds.findIndex(round => round.id === event.roundId)
    need(roundIndex >= 0 && roundIndex >= lastRound, 'round order')
    lastRound = roundIndex
    if (roundIndex === 1) need(states[0].reviewed && states[0].executed, 'round one before round zero review')
    const state = states[roundIndex], kind = event.kind, payload = event.payload, elapsed = event.elapsedMs
    need(event.puzzleRevision === state.puzzleRevision && elapsed >= state.lastMs, 'puzzle revision/time')
    state.lastMs = elapsed
    need(!state.mustSolve || kind === 'solved', 'target requires atomic solve')
    if (state.terminal) need((kind === 'tracking_answer' || kind === 'tracking_continue' ||
      kind === 'round_reviewed' || kind === 'exercise_completed') &&
      elapsed === state.puzzle.at(-1)!.elapsedMs, 'postterminal event')
    else need(!state.reviewed, 'event after review')
    if (PUZZLE.has(kind)) {
      if (!state.puzzle.length) need(kind === 'board_onset' && elapsed === 0, 'onset first')
      else need(kind !== 'board_onset', 'duplicate onset')
      if (kind === 'move' || kind === 'undo' || kind === 'reset') {
        need(elapsed < 120000, 'late action')
        if (rule === 'plan_before_action') need(state.confirmed, 'plan gate')
        if (rule === 'timed_planning') need(state.releaseMs !== null, 'release gate')
        if (rule === 'state_tracking') need(state.prompt === null, 'tracking gate')
        if (rule === 'sequencing' && kind === 'move') need(state.block < 3, 'checkpoint gate')
      }
      if (kind === 'move') {
        const from = payload.from as number, to = payload.to as number, disk = payload.disk as number
        need(state.board[from]?.at(-1) === disk, 'top disk')
        const prior = copyBoard(state.board)
        state.board = placement(state.board, from, to)
        state.undo.push({ board: prior, moveId: event.id })
        state.moves++
        need(payload.input === attempt.context.inputMode, 'input/context mismatch')
        const repeated = state.seen.has(boardKey(state.board))
        if (repeated) state.repeated++
        if (state.previous && from === state.previous[1] && to === state.previous[0] && disk === state.previous[2])
          state.reversals++
        if (state.previousMs !== null) state.gaps.push(elapsed-state.previousMs)
        state.previous = [from,to,disk]; state.previousMs = elapsed
        if (state.planningMs === null) state.planningMs = elapsed
        state.seen.add(boardKey(state.board)); state.mustSolve = sameBoard(state.board,state.form.target)
        state.block++
        if (rule === 'state_tracking') state.prompt = { moveId:event.id,correctValue:repeated,answered:false }
      } else if (kind === 'undo') {
        need(state.undo.length && state.undo.at(-1)!.moveId === payload.moveId, 'undo reference')
        state.board = state.undo.pop()!.board; state.undoCount++; state.previous = null; state.previousMs = null
        state.seen.add(boardKey(state.board)); state.block = 3
      } else if (kind === 'reset') {
        state.board = copyBoard(state.form.start); state.undo = []; state.resetCount++
        state.previous = null; state.previousMs = null; state.seen.add(boardKey(state.board)); state.block = 3
      } else if (kind === 'solved') {
        need(state.mustSolve && elapsed === state.puzzle.at(-1)?.elapsedMs && elapsed < 120000, 'false solve')
        state.terminal = 'solved'; state.mustSolve = false
      } else if (kind === 'expired') {
        need(elapsed === 120000 && !sameBoard(state.board,state.form.target), 'false expiry')
        state.terminal = 'expired'
      } else if (kind === 'interrupted' || kind === 'exited') {
        need(elapsed < 120000 && !sameBoard(state.board,state.form.target), 'false withdrawal')
        state.terminal = kind
      }
      state.puzzle.push(event); state.puzzleRevision++
    } else {
      need(attempt.kind === 'drill' && state.puzzle.length, 'exercise without onset')
      if (kind.startsWith('plan_')) {
        need(rule === 'plan_before_action' && !state.confirmed && !state.terminal, 'plan phase')
        if (kind === 'plan_step') {
          need(state.plan.length < 2 && state.planBoard[payload.from as number]?.at(-1) === payload.disk,
            'plan move')
          state.planBoard = placement(state.planBoard,payload.from as number,payload.to as number)
          state.plan.push([payload.from as number,payload.to as number,payload.disk as number])
        } else if (kind === 'plan_undo') {
          need(state.plan.length > 0, 'plan undo'); state.plan.pop(); state.planBoard = copyBoard(state.form.start)
          for (const [from,to] of state.plan) state.planBoard = placement(state.planBoard,from,to)
        } else if (kind === 'plan_clear') {
          state.plan = []; state.planBoard = copyBoard(state.form.start)
        } else if (kind === 'plan_confirm') {
          need(state.plan.length === 2, 'two plan steps'); state.confirmed = true
        }
      } else if (kind === 'planning_release') {
        need(rule === 'timed_planning' && state.releaseMs === null && !state.terminal, 'release phase')
        state.releaseMs = elapsed
      } else if (kind === 'checkpoint_ack') {
        need(rule === 'sequencing' && state.block >= 3 && !state.terminal &&
          sameBoard(payload.board as Board,state.board) &&
          canonical(payload.steps) === canonical(exactSteps(state.board)), 'checkpoint phase/path')
        state.checkpoints++; state.block = 0
        state.checkpointSteps=(payload.steps as [number,number,number][]).map(step=>[...step])
      } else if (kind === 'tracking_answer') {
        const prompt = state.prompt
        need(rule === 'state_tracking' && prompt && !prompt.answered && payload.moveId === prompt.moveId,
          'answer uniqueness')
        prompt.answered = true
        state.answers.push({ moveId:prompt.moveId,firstAnswer:payload.answer as boolean,
          correct:payload.answer === prompt.correctValue })
      } else if (kind === 'tracking_continue') {
        const prompt = state.prompt
        need(rule === 'state_tracking' && prompt && prompt.answered && payload.moveId === prompt.moveId,
          'continue phase')
        state.prompt = null
      } else if (kind === 'round_reviewed') {
        need((state.terminal === 'solved' || state.terminal === 'expired') && !state.reviewed,
          'round review')
        need(coachingComplete(state,rule!), 'coaching incomplete')
        state.reviewed = true; state.executed = state.terminal === 'solved' || state.moves >= 4
      } else if (kind === 'exercise_completed') {
        need(roundIndex === 1 && canonical(payload.roundIds) === canonical(attempt.rounds.map(round=>round.id)) &&
          states.every(item=>item.reviewed && item.executed), 'exercise completion')
        complete = true
      } else throw Error('Unknown exercise record')
    }
  }
  for (const state of states) need(!state.mustSolve, 'target without atomic solve')
  if (attempt.kind !== 'drill') {
    const scored = states[0]
    if(attempt.phase==='abandoned')need(!scored.terminal, 'scored abandonment')
    else need(attempt.phase === (scored.terminal ? 'terminal' : scored.puzzle.length ? 'active' : 'reserved'),
      'scored attempt phase')
  } else if (complete) need(attempt.phase === 'terminal', 'exercise phase')
  else {
    const active = states.findIndex(state => state.puzzle.length && !state.terminal)
    const last = states[1].puzzle.length ? 1 : 0
    const state = states[last]
    const incompleteExpiry = state.terminal === 'expired' && rule !== 'state_tracking' &&
      !coachingComplete(state,rule!)
    const expected = attempt.attachment.type === 'detached' || attempt.phase==='abandoned' &&
      !state.terminal ? 'abandoned' :
      incompleteExpiry || state.terminal === 'interrupted' || state.terminal === 'exited' ||
      state.reviewed && !state.executed ? 'abandoned' :
      active >= 0 ? 'active' : state.reviewed && last === 0 ? 'between_rounds' :
      state.terminal ? 'round_review' : 'reserved'
    need(attempt.phase === expected, 'exercise phase')
  }
  const results: RoundResult[] = []
  for (const [index,state] of states.entries()) {
    const terminal = state.terminal
    const score: Score | null = terminal ? state.score??{
      version:'towers-training-score/1', terminal, moves:state.moves, optimal:9,
      excess:terminal === 'solved' ? state.moves-9 : null, planningMs:state.planningMs,
      solutionMs:terminal === 'solved' ? state.puzzle.at(-1)!.elapsedMs : null,
      timeUsedMs:state.puzzle.at(-1)!.elapsedMs, undoCount:state.undoCount,resetCount:state.resetCount,
      repeatedStateArrivals:state.repeated,immediateReversals:state.reversals,
      interMoveMedianMs:median(state.gaps),finalBoard:copyBoard(state.board),
      recordDigest:await digestSliced(state.puzzle,scope),
    } : null
    if(score)state.score=score
    results.push({ roundId:attempt.rounds[index].id,score,executed:state.executed,
      reviewed:state.reviewed,coaching:{plan:state.plan,releaseMs:state.releaseMs,
        answers:state.answers,checkpoints:state.checkpoints} })
    const round = attempt.rounds[index]
    const actualPhase = terminal ?? (state.puzzle.length ? 'active' : 'reserved')
    need(round.puzzlePhase === actualPhase, 'round phase cache')
    need(round.reviewed === state.reviewed && round.reviewPhase ===
      (state.reviewed ? 'reviewed' : attempt.kind === 'drill' && (terminal === 'solved' || terminal === 'expired') ? 'pending' : 'not_ready'),
    'review cache')
    need(round.presentation === (state.puzzle.length ? 'onset' : round.presentation), 'presentation cache')
    if (!state.puzzle.length) need(round.presentation !== 'onset', 'onset missing')
  }
  const result = attempt.kind === 'drill' ? {
    version:'towers-training-score/1' as const, roundResults:results as [RoundResult,RoundResult],
    exerciseCompleted:complete,recordDigest:prior&&attempt.phase!=='terminal'?'':
      await digestSliced(attempt.records,scope),
  } : results[0].score
  if (enforceSnapshot) {
    if (attempt.phase === 'terminal') need(result !== null && canonical(attempt.snapshot) === canonical(result) &&
      (attempt.kind !== 'drill' || complete), 'terminal snapshot')
    else need(attempt.snapshot === null, 'nonterminal snapshot')
  }
  if(Object.isFrozen(attempt)||reuse)replayFrames.set(attempt,{states,ids,complete,lastRound,
    recordCount:attempt.records.length})
  return result
}

/** A copied UI projection from an admitted private replay frame. */
export function roundProjection(attempt:Attempt,index:number){
  const state=replayFrames.get(attempt)?.states[index]
  if(!state)throw Error('Training round has no admitted replay frame')
  const latestAnswer=state.answers.at(-1)
  const answer=state.prompt&&latestAnswer?.moveId===state.prompt.moveId?
    latestAnswer:null
  return {form:state.form,board:copyBoard(state.board),
    canUndo:state.undo.length>0,undoMoveId:state.undo.at(-1)?.moveId??null,
    plan:state.plan.map(step=>[...step] as [number,number,number]),
    planBoard:copyBoard(state.planBoard),confirmed:state.confirmed,
    released:state.releaseMs!==null,block:state.block,
    prompt:state.prompt?{moveId:state.prompt.moveId,answered:state.prompt.answered,
      answer:answer?.firstAnswer??null,correct:state.prompt.correctValue}:null,
    checkpoints:state.checkpointSteps.map(step=>[...step] as [number,number,number])}
}


export class Capacity extends Error { constructor(message='Local Towers training data are full') { super(message) } }
export async function closureProjectionBytes(attempt:Attempt,required:number,scope:WorkScope):Promise<number> {
  const encoder=new TextEncoder(),id='x'.repeat(64),roundId=attempt.rounds.at(-1)!.id
  const bytes=async(value:unknown)=>encoder.encode(await canonicalSliced(value,scope)).length
  const base={seq:1024,id,roundId,elapsedMs:120000,wallMs:Number.MAX_SAFE_INTEGER,
    puzzleRevision:1024}
  const templates=[
    {...base,kind:'checkpoint_ack',payload:{board:[[5,4,3,2,1],[],[]],steps:[[0,1,5],[0,2,4],[1,2,3]]}},
    {...base,kind:'tracking_answer',payload:{moveId:id,answer:false}},
    {...base,kind:'interrupted',payload:{reason:'event_capacity'}},
  ]
  let recordBytes=0
  for(const template of templates)recordBytes=Math.max(recordBytes,await bytes(template))
  recordBytes+=1
  const score:Score={version:'towers-training-score/1',terminal:'interrupted',moves:1024,optimal:9,
    excess:1024,planningMs:120000,solutionMs:120000,timeUsedMs:120000,undoCount:1024,
    resetCount:1024,repeatedStateArrivals:1024,immediateReversals:1024,
    interMoveMedianMs:120000,finalBoard:[[5,4,3,2,1],[],[]],recordDigest:'f'.repeat(64)}
  // Each answer has the same maximal frozen shape. Account for its array
  // punctuation algebraically; no previous answer journal is rebuilt here.
  const answerCount=attempt.kind==='drill'?
    Math.ceil((attempt.records.length+required)/3):0
  const answerBytes=answerCount?
    await bytes({moveId:id,firstAnswer:false,correct:false}):0
  const answerArrayExtra=answerCount?answerCount*(answerBytes+1)-1:0
  const snapshot=attempt.kind==='drill'?{version:'towers-training-score/1',
    roundResults:attempt.rounds.map(round=>({roundId:round.id,score,executed:true,reviewed:true,
      coaching:{plan:[[0,1,5],[0,2,4]],releaseMs:120000,answers:[],checkpoints:1024}})),
    exerciseCompleted:true,recordDigest:'f'.repeat(64)}:score
  const snapshotBytes=await bytes(snapshot)+
    (attempt.kind==='drill'?attempt.rounds.length*answerArrayExtra:0)-
    await bytes(attempt.snapshot)
  const receipt={kind:'complete_exercise',payloadDigest:'f'.repeat(64),expectedRootRevision:999999,
    outcome:{rootRevision:1000000,installationId:attempt.installationId,
      attemptId:attempt.id,chainId:id,status:'applied'}}
  const receiptBytes=await bytes(receipt)+id.length+4
  // The chain/grant descriptor and comparison metadata are bounded separately
  // from records and receipts. This projection uses their maximal fixed margin.
  return required*(recordBytes+receiptBytes)+Math.max(0,snapshotBytes)+8192
}
/** Retained closure budget is checked on the candidate root, before its put. */
export async function assertClosureReserve(root: TrainingRoot,scope:WorkScope): Promise<void> {
  let recordReserve=0,receiptReserve=0,byteReserve=0
  for(const attempt of Object.values(root.attempts)) {
    const live=attempt.phase==='active'||attempt.rounds.some(round=>round.presentation==='intent'&&
      round.puzzlePhase==='reserved')
    const review=attempt.phase==='round_review'
    const required=live?8:review?4:0
    if(attempt.records.length+required>1024)throw new Capacity('Training record closure reserve exhausted')
    recordReserve+=required;receiptReserve+=required
    if(required){
      if(await closureProjectionBytes(attempt,required,scope)>262144)throw new Capacity('Training closure byte projection exceeds reserve')
      byteReserve+=262144
    }
  }
  const records=Object.values(root.attempts).reduce((total,attempt)=>total+attempt.records.length,0)
  if(records+recordReserve>4096)throw new Capacity('Training root record closure reserve exhausted')
  if(Object.keys(root.requests).length+receiptReserve>128)
    throw new Capacity('Training receipt closure reserve exhausted')
  if(new TextEncoder().encode(await canonicalSliced(root,scope)).length+byteReserve>2097152)
    throw new Capacity('Training byte closure reserve exhausted')
}

export function router(score: Score): Rule | 'insufficient' {
  if (score.terminal !== 'solved' && score.terminal !== 'expired') throw Error('Invalid training baseline')
  if (score.moves < 4) return 'insufficient'
  if (score.repeatedStateArrivals >= 2) return 'state_tracking'
  if (score.planningMs !== null && score.planningMs < 3000 && score.immediateReversals >= 1)
    return 'plan_before_action'
  if (score.terminal === 'solved' && score.planningMs !== null && score.planningMs >= 15000 &&
    score.excess !== null && score.excess <= 1) return 'timed_planning'
  return 'sequencing'
}
export function recommendation(score: Score): Recommendation {
  const rule = router(score)
  if (rule === 'insufficient') throw Error('Insufficient baseline move evidence')
  return { version:'towers-training-router/1',rule,reasonCode:rule,
    metrics:{status:score.terminal as 'solved'|'expired',moves:score.moves,planningMs:score.planningMs,
      repeatedStateArrivals:score.repeatedStateArrivals,immediateReversals:score.immediateReversals,
      excess:score.excess} }
}
export async function descriptor(attempt: Attempt, scope:WorkScope): Promise<Descriptor> {
  const content = { ...attempt }
  delete (content as Partial<Attempt>).revision
  return { attemptId:attempt.id,sourceDigest:await digestSliced(content,scope) }
}
export function comparison(a: Score,b: Score) {
  const keys = ['moves','excess','planningMs','solutionMs','timeUsedMs','undoCount','resetCount',
    'repeatedStateArrivals','immediateReversals','interMoveMedianMs'] as const
  return Object.fromEntries(keys.map(key=>[key,a[key] !== null && b[key] !== null ? b[key]! - a[key]! : null]))
}
export async function validateRoot(value: unknown, scope:WorkScope,prior?:TrainingRoot): Promise<TrainingRoot> {
  scope.check()
  // Every raw occurrence must satisfy its schema position before allocating
  // the immutable occurrence-expanded image. Validate again on the owned
  // image so a direct caller cannot mutate across cooperative yield points.
  await validateShape(value,scope)
  const owned=await ownJson(value,scope)
  const root=owned.value as TrainingRoot
  validateEnvelope(root,scope);await validateShape(root,scope)
  void prior
  const ordinals = new Set<number>()
  for (const [id,attempt] of Object.entries(root.attempts)) {
    scope.check()
    need(attempt.id === id && attempt.installationId === root.installationId && !root.tombstones[id] &&
      attempt.ordinal < root.nextOrdinal && !ordinals.has(attempt.ordinal), 'attempt identity')
    ordinals.add(attempt.ordinal)
    need((attempt.kind === 'baseline') === (attempt.attachment.type === 'baseline'), 'attachment kind')
    if (attempt.kind !== 'baseline') need(attempt.claim === 'retired', 'nonbaseline claim')
    if (attempt.kind === 'drill') drillRule(attempt)
    const result = await replayAttempt(attempt,true,scope)
    if (attempt.phase === 'terminal') need(result !== null, 'terminal replay')
    if (attempt.attachment.type === 'detached') need(attempt.eligibility === 'familiar_review' &&
      attempt.claim === 'retired' && ['terminal','abandoned'].includes(attempt.phase), 'detached authority')
  }
  const linked = new Map<string, Attempt[]>()
  const exposedRetests = Object.values(root.attempts).filter(a => a.kind === 'retest' &&
    a.eligibility === 'eligible' &&
    a.rounds[0].presentation !== 'unseen').map(a => a.rounds[0].formId)
  need(new Set(exposedRetests).size === exposedRetests.length, 'retest exposure reused')
  // Eligibility is fixed at allocation. Surviving earlier exposure of the
  // same structure contradicts it; later familiar play does not.
  for (const attempt of Object.values(root.attempts)) {
    if (attempt.kind !== 'retest' || attempt.eligibility !== 'eligible') continue
    need(!Object.values(root.attempts).some(earlier => earlier.kind === 'retest' &&
      earlier.ordinal < attempt.ordinal &&
      (earlier.rounds[0].presentation !== 'unseen'||earlier.phase==='reserved') &&
      earlier.rounds[0].formId === attempt.rounds[0].formId), 'eligible retest already exposed')
  }
  const retainedReservations = new Set<string>()
  for (const attempt of Object.values(root.attempts)) {
    if (attempt.kind !== 'retest' || attempt.eligibility !== 'eligible' ||
      attempt.phase !== 'reserved') continue
    const formId = attempt.rounds[0].formId
    need(!retainedReservations.has(formId), 'retest reservation collision')
    retainedReservations.add(formId)
  }
  for (const attempt of Object.values(root.attempts)) {
    if (attempt.attachment.type !== 'linked') continue
    const chainId = attempt.attachment.chainId as string
    const chain = root.chains[chainId]
    need(chain && chain.status !== 'ended' && attempt.kind !== 'baseline', 'linked parent')
    need(canonical(attempt.context) === canonical(chain.context), 'linked context')
    need(attempt.claim === 'retired', 'linked claim')
    if (attempt.kind === 'drill') {
      need(attempt.attachment.grantAttemptId === null && attempt.attachment.grantDigest === null &&
        canonical(attempt.rounds.map(round => round.formId)) === canonical(chain.drillFormIds),
        'drill role')
    } else {
      need(attempt.attachment.grantAttemptId === chain.firstGrant?.attemptId &&
        attempt.attachment.grantDigest === chain.firstGrant?.sourceDigest &&
        (attempt.eligibility === 'familiar_review' || chain.retestAttemptIds.includes(attempt.id)), 'retest grant')
    }
    linked.set(chainId,[...(linked.get(chainId)??[]),attempt])
  }
  for (const [id,chain] of Object.entries(root.chains)) {
    scope.check()
    need(chain.id === id && chain.version === 'towers-training-chain/1', 'chain identity')
    for (const source of [chain.baseline,chain.firstGrant,chain.completedRetest]) {
      if (!source) continue
      const attempt = root.attempts[source.attemptId]
      need(attempt && canonical(await descriptor(attempt,scope)) === canonical(source), 'chain source')
    }
    const baseline = root.attempts[chain.baseline.attemptId]
    need(baseline && baseline.kind === 'baseline' && baseline.eligibility ===
      (chain.status === 'ended' ? 'familiar_review' : 'eligible') &&
      canonical(baseline.context) === canonical(chain.context) &&
      baseline.phase === 'terminal' && ['solved','expired'].includes((baseline.snapshot as Score)?.terminal) &&
      (chain.status === 'ended' ? baseline.claim === 'retired' : baseline.claim === 'used'), 'baseline chain')
    need(canonical(recommendation(baseline.snapshot as Score)) === canonical(chain.recommendation) &&
      chain.drillRule === chain.recommendation.rule &&
      canonical(chain.drillFormIds) === canonical(FORMS[chain.drillRule]), 'router chain')
    const members = linked.get(id) ?? []
    const eligibleDrills = members.filter(a => a.kind === 'drill' && a.eligibility === 'eligible')
    const retests = members.filter(a => a.kind === 'retest' && a.eligibility === 'eligible')
    need(eligibleDrills.filter(a=>['reserved','active','between_rounds','round_review'].includes(a.phase)).length <= 1 &&
      new Set(chain.retestAttemptIds).size === chain.retestAttemptIds.length &&
      chain.retestAttemptIds.every(retestId => retests.some(a => a.id === retestId)) &&
      retests.every(a => chain.retestAttemptIds.includes(a.id)), 'chain reverse membership')
    if (chain.status === 'ended') need(!members.length && !chain.firstGrant &&
      !chain.completedRetest && !chain.retestAttemptIds.length && !chain.reservedRetestFormId &&
      !root.comparisons[id], 'ended chain closure')
    else if (chain.status === 'assigned' || chain.status === 'drilling') {
      need(!chain.firstGrant && !chain.completedRetest && !chain.retestAttemptIds.length &&
        !root.comparisons[id] && (chain.status === 'assigned' ? eligibleDrills.length === 0 :
        eligibleDrills.length >= 1 && eligibleDrills.every(a=>a.phase!=='terminal')), 'ungranted chain status')
    } else {
      const grant = chain.firstGrant && root.attempts[chain.firstGrant.attemptId]
      need(grant?.kind === 'drill' && grant.phase === 'terminal' && grant.eligibility === 'eligible' &&
        grant.attachment.type === 'linked' && grant.attachment.chainId === id &&
        eligibleDrills.some(a=>a.id === grant.id) &&
        eligibleDrills.filter(a=>a.phase==='terminal').every(a=>a.id===grant.id),
        'first grant')
      if (chain.status === 'drill_complete') need(!retests.length && !chain.completedRetest &&
        !root.comparisons[id], 'drill complete closure')
      if (chain.status === 'retesting' || chain.status === 'exhausted')
        need(!chain.completedRetest && !root.comparisons[id] &&
          (chain.status !== 'retesting' || retests.length > 0), 'retest status closure')
      if (chain.status === 'exhausted')
        need(retests.every(a => !['reserved','active'].includes(a.phase)),
          'exhausted chain has unresolved retest')
      if (chain.status === 'compared') {
        const retest = chain.completedRetest && root.attempts[chain.completedRetest.attemptId]
        need(retest?.kind === 'retest' && retest.eligibility === 'eligible' &&
          retest.phase === 'terminal' && ['solved','expired'].includes((retest.snapshot as Score)?.terminal) &&
          retest.attachment.type === 'linked' && retest.attachment.chainId === id &&
          chain.retestAttemptIds.includes(retest.id) && !!root.comparisons[id], 'completed retest')
      }
    }
    const familiarDrills = members.filter(a => a.kind === 'drill' && a.eligibility === 'familiar_review')
    if (familiarDrills.length) {
      need(!!chain.firstGrant, 'familiar drill grant')
      need(familiarDrills.every(a => ['terminal','abandoned'].includes(a.phase) ||
        ['drill_complete','compared','exhausted'].includes(chain.status)), 'familiar drill status')
    }
    const reserved = chain.reservedRetestFormId
    need((['assigned','drilling','drill_complete'].includes(chain.status)) === (reserved !== null),
      'reserved retest status')
    if (reserved !== null) {
      const form = formById(reserved)
      need(form.family === 'retest' &&
        !Object.values(root.attempts).some(a => a.kind === 'retest' &&
          a.rounds[0].formId === reserved && a.rounds[0].presentation !== 'unseen'),
        'reserved retest already exposed')
      need(!Object.values(root.attempts).some(a => a.kind === 'retest' &&
        a.rounds[0].formId === reserved && a.phase === 'reserved'),
        'reserved retest already allocated')
      need(!retainedReservations.has(reserved), 'retest reservation collision')
      retainedReservations.add(reserved)
    }
    if (chain.status === 'compared') need(!!root.comparisons[id], 'comparison missing')
    else need(!root.comparisons[id], 'unexpected comparison')
  }
  for(const attempt of Object.values(root.attempts).filter(a=>a.kind==='baseline')) {
    const owners=Object.values(root.chains).filter(chain=>chain.baseline.attemptId===attempt.id)
    need(owners.length<=1 && (attempt.claim==='used'?owners.length===1:
      attempt.claim==='unclaimed'?owners.length===0:true), 'baseline reverse membership')
  }
  for (const [id,item] of Object.entries(root.comparisons)) {
    const chain = root.chains[id]
    need(chain?.status === 'compared' && item.chainId === id &&
      canonical(item.baseline) === canonical(chain.baseline) &&
      canonical(item.grant) === canonical(chain.firstGrant) &&
      canonical(item.retest) === canonical(chain.completedRetest) &&
      canonical(item.context) === canonical(chain.context), 'comparison refs')
  }
  for(const receipt of Object.values(root.requests)){
    const result=receipt.outcome as {rootRevision:number;installationId:string;
      attemptId:string|null;chainId:string|null;status:string}
    need(result.status==='applied' && result.installationId===root.installationId &&
      result.rootRevision<=root.revision && result.rootRevision>=1,
      'request outcome provenance')
    if(receipt.kind!=='delete_all')need(result.rootRevision===
      (receipt.expectedRootRevision as number)+1,'request revision provenance')
    if(result.attemptId)need(!!root.attempts[result.attemptId] && !root.tombstones[result.attemptId],
      'request attempt reference')
    if(result.chainId)need(!!root.chains[result.chainId],'request chain reference')
    if(receipt.kind==='complete_exercise'){
      const attempt=result.attemptId?root.attempts[result.attemptId]:undefined
      need(attempt?.kind==='drill' && attempt.phase==='terminal','exercise receipt source')
    }
  }
  await assertClosureReserve(root,scope)
  scope.check()
  return root
}
