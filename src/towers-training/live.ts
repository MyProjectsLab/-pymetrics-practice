import { canonical, formById, placement } from './bank'
import { closureProjectionBytes, replayAttempt, roundProjection } from './model'
import type { Attempt, JournalRecord, TrainingRoot } from './model'
import type { WorkScope } from './authority'
import { FragmentTree } from './fragments'
import { ownJson } from './domain'
import { validatePart } from './schema'

export interface LiveCommand {
  readonly kind:'onset'|'append'|'coach_live'
  readonly attemptId:string
  readonly roundIndex:number
  readonly record:JournalRecord
  readonly body:unknown
  readonly requestId:string
  readonly payloadDigest:string
  readonly expectedRootRevision:number
}

function need(okay:unknown,why:string):asserts okay {
  if(!okay)throw Error(`Training live proof: ${why}`)
}
function freezeChanged(value:unknown):void {
  if(!value||typeof value!=='object'||Object.isFrozen(value))return
  for(const child of Object.values(value))freezeChanged(child)
  Object.freeze(value)
}
function puzzleRecord(a:Attempt,roundIndex:number,kind:'solved',elapsedMs:number):JournalRecord{
  const round=a.rounds[roundIndex]
  return {seq:a.records.length+1,id:`${a.id}_e${a.records.length+1}`,roundId:round.id,
    elapsedMs,wallMs:a.records.at(-1)!.wallMs,puzzleRevision:a.records.filter(item=>
      item.roundId===round.id&&['board_onset','move','undo','reset','solved','expired','interrupted','exited']
        .includes(item.kind)).length,kind,payload:{}}
}

/** The only live delta constructor; no caller supplied mutation closure crosses this boundary. */
export async function liveCandidate(source:TrainingRoot,command:LiveCommand,
  fragments:FragmentTree,scope:WorkScope):Promise<TrainingRoot>{
  scope.check()
  await validatePart(command.requestId,'id',scope)
  need(source.revision===command.expectedRootRevision&&
    !Object.hasOwn(source.requests,command.requestId),'source/request revision')
  const old=source.attempts[command.attemptId],oldRound=old?.rounds[command.roundIndex]
  need(old&&oldRound&&oldRound.id===command.record.roundId&&
    command.record.id===`${old.id}_e${old.records.length+1}`&&
    command.record.seq===old.records.length+1,'attempt/record identity')
  need(!Object.values(source.chains).some(chain=>
    chain.baseline.attemptId===old.id||chain.firstGrant?.attemptId===old.id||
    chain.completedRetest?.attemptId===old.id),'immutable descriptor source')
  need(source.revision<1000000&&Object.keys(source.requests).length<128,
    'receipt capacity')
  const next:TrainingRoot={...source,revision:source.revision+1,
    attempts:{...source.attempts},requests:{...source.requests}}
  const attempt:Attempt={...old,revision:next.revision,
    rounds:old.rounds.slice(),records:old.records.slice(),snapshot:old.snapshot}
  const round={...oldRound};attempt.rounds[command.roundIndex]=round
  next.attempts[old.id]=attempt
  const record=(await ownJson(command.record,scope)).value as JournalRecord
  await validatePart(record,'record',scope)
  need(record.puzzleRevision===old.records.filter(item=>item.roundId===oldRound.id&&
    ['board_onset','move','undo','reset','solved','expired','interrupted','exited'].includes(item.kind)).length,
  'puzzle revision')
  attempt.records.push(record)
  if(command.kind==='onset'){
    need(record.kind==='board_onset'&&oldRound.presentation==='intent'&&
      oldRound.puzzlePhase==='reserved'&&record.elapsedMs===0&&
      (old.phase==='reserved'||old.phase==='between_rounds'),'onset phase')
    round.presentation='onset';round.puzzlePhase='active';attempt.phase='active'
  }else if(command.kind==='append'){
    need(['move','undo','reset'].includes(record.kind)&&oldRound.puzzlePhase==='active'&&
      old.phase==='active'&&record.elapsedMs<120000,'active move phase')
    if(record.kind==='move'){
      const before=roundProjection(old,command.roundIndex).board
      const after=placement(before,record.payload.from as number,record.payload.to as number)
      if(canonical(after)===canonical(formById(round.formId).target)){
        attempt.records.push(puzzleRecord(attempt,command.roundIndex,'solved',record.elapsedMs))
        round.puzzlePhase='solved'
        if(attempt.kind==='drill'){round.reviewPhase='pending';attempt.phase='round_review'}
        else attempt.phase='terminal'
      }
    }
  }else{
    need(old.kind==='drill'&&oldRound.puzzlePhase==='active'&&old.phase==='active'&&
      record.elapsedMs<120000&&['plan_step','plan_undo','plan_clear','plan_confirm',
        'planning_release','checkpoint_ack','tracking_answer','tracking_continue'].includes(record.kind),
      'active coach phase')
  }
  if(attempt.phase==='terminal'){
    attempt.snapshot=await replayAttempt(attempt,false,scope,old)
    await validatePart(attempt.snapshot,'score',scope)
  }
  else await replayAttempt(attempt,true,scope,old)
  const chainId=attempt.attachment.chainId as string|undefined
  next.requests[command.requestId]={kind:command.kind==='coach_live'?'coach_live':'append',
    payloadDigest:command.payloadDigest,expectedRootRevision:source.revision,
    outcome:{rootRevision:next.revision,installationId:next.installationId,
      attemptId:attempt.id,chainId:chainId??null,status:'applied'}}
  await validatePart(next.requests[command.requestId],'request',scope)
  // Only new nodes need freezing. Every retained predecessor node came from
  // the private deep-frozen P; scanning its journal again would charge the
  // captured move for unrelated earlier actions.
  for(let index=old.records.length;index<attempt.records.length;index++)
    freezeChanged(attempt.records[index])
  if(attempt.snapshot)freezeChanged(attempt.snapshot)
  Object.freeze(attempt.records)
  Object.freeze(round)
  Object.freeze(attempt.rounds)
  Object.freeze(attempt)
  freezeChanged(next.requests[command.requestId])
  Object.freeze(next.attempts)
  Object.freeze(next.requests)
  Object.freeze(next)
  const fragment=fragments.delta(next,scope)
  let records=0,recordReserve=0,receiptReserve=0,byteReserve=0
  for(const current of Object.values(next.attempts)){
    scope.check()
    records+=current.records.length
    const required=current.phase==='active'||current.rounds.some(item=>
      item.presentation==='intent'&&item.puzzlePhase==='reserved')?8:
      current.phase==='round_review'?4:0
    need(current.records.length+required<=1024,'attempt closure record capacity')
    recordReserve+=required;receiptReserve+=required
    if(required){
      if(current===attempt)need(await closureProjectionBytes(current,required,scope)<=262144,
        'attempt closure byte projection')
      byteReserve+=262144
    }
  }
  need(records+recordReserve<=4096&&
    Object.keys(next.requests).length+receiptReserve<=128&&
    fragment.length+byteReserve<=2097152,'root closure capacity')
  scope.check()
  return next
}
