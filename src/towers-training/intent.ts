import {canonical} from './bank'
import {closureProjectionBytes,replayAttempt} from './model'
import type {Attempt,TrainingRoot} from './model'
import type {WorkScope} from './authority'
import {FragmentTree} from './fragments'
import {validatePart} from './schema'

export interface IntentCommand {
  readonly requestId:string
  readonly body:unknown
  readonly payloadDigest:string
  readonly expectedRootRevision:number
}
type Body={attemptId:string;attemptRevision:number;roundId:string;chainRevision:number|null}
function need(valid:unknown,why:string):asserts valid {
  if(!valid)throw Error(`Training intent proof: ${why}`)
}
function bodyOf(input:unknown):Body {
  need(!!input&&typeof input==='object'&&!Array.isArray(input),'body shape')
  const body=input as Record<string,unknown>
  need(Object.keys(body).length===4&&['attemptId','attemptRevision','roundId','chainRevision']
    .every(key=>Object.hasOwn(body,key)),'body fields')
  need(typeof body.attemptId==='string'&&Number.isSafeInteger(body.attemptRevision)&&
    typeof body.roundId==='string'&&
    (body.chainRevision===null||Number.isSafeInteger(body.chainRevision)),
    'body domain')
  return body as Body
}
function freezeChanged(value:unknown):void {
  if(!value||typeof value!=='object'||Object.isFrozen(value))return
  for(const child of Object.values(value))freezeChanged(child)
  Object.freeze(value)
}

/** Fixed intent successor from the Store's private immutable P. */
export async function intentCandidate(source:TrainingRoot,command:IntentCommand,
  fragments:FragmentTree,scope:WorkScope):Promise<TrainingRoot>{
  scope.check()
  const body=bodyOf(command.body)
  // The receipt value schema does not validate its dynamic requests-map key.
  // Reject forbidden, invalid, oversized and non-string IDs before map use.
  await validatePart(command.requestId,'id',scope)
  need(source.revision===command.expectedRootRevision&&source.revision<1000000&&
    !Object.hasOwn(source.requests,command.requestId)&&
    Object.keys(source.requests).length<128,'source/request capacity')
  const old=source.attempts[body.attemptId]
  need(old&&old.revision===body.attemptRevision,'attempt revision')
  const roundIndex=old.rounds.findIndex(item=>item.id===body.roundId)
  const oldRound=old.rounds[roundIndex]
  need(roundIndex>=0&&oldRound?.presentation==='unseen'&&
    oldRound.puzzlePhase==='reserved'&&
    (old.phase==='reserved'||old.phase==='between_rounds'),
    'unseen reserved round')
  const chainId=old.attachment.chainId as string|undefined
  const chain=chainId?source.chains[chainId]:undefined
  need((chain?chain.revision:null)===body.chainRevision,'chain revision')
  need(!Object.values(source.chains).some(item=>
    item.baseline.attemptId===old.id||item.firstGrant?.attemptId===old.id||
    item.completedRetest?.attemptId===old.id),'immutable descriptor source')
  if(old.kind==='retest'&&old.eligibility==='eligible'&&roundIndex===0){
    need(!Object.values(source.attempts).some(item=>item!==old&&
      item.kind==='retest'&&item.eligibility==='eligible'&&
      item.rounds[0].formId===oldRound.formId&&
      item.rounds[0].presentation!=='unseen'), 'retest form exposure')
    need(!Object.values(source.attempts).some(item=>item!==old&&
      item.kind==='retest'&&item.ordinal<old.ordinal&&
      item.rounds[0].formId===oldRound.formId&&
      (item.rounds[0].presentation!=='unseen'||item.phase==='reserved')),
      'earlier retest exposure')
  }
  const next:TrainingRoot={...source,revision:source.revision+1,
    attempts:{...source.attempts},requests:{...source.requests}}
  const attempt:Attempt={...old,revision:next.revision,rounds:old.rounds.slice()}
  const round={...oldRound,presentation:'intent' as const}
  attempt.rounds[roundIndex]=round
  next.attempts[old.id]=attempt
  next.requests[command.requestId]={kind:'intent',payloadDigest:command.payloadDigest,
    expectedRootRevision:source.revision,
    outcome:{rootRevision:next.revision,installationId:source.installationId,
      attemptId:old.id,chainId:chainId??null,status:'applied'}}
  await validatePart(round,'round',scope)
  await validatePart(attempt,'attempt',scope)
  await validatePart(next.requests[command.requestId],'request',scope)
  // The admitted predecessor carries the proof for every unchanged record.
  // Reuse its replay frame; this checks the changed presentation and caches it.
  await replayAttempt(attempt,true,scope,old)
  need(canonical(attempt.context)===canonical(old.context)&&
    attempt.attachment===old.attachment&&attempt.records===old.records&&
    attempt.snapshot===old.snapshot,'immutable attempt components')
  freezeChanged(round)
  Object.freeze(attempt.rounds);Object.freeze(attempt)
  freezeChanged(next.requests[command.requestId])
  Object.freeze(next.attempts);Object.freeze(next.requests);Object.freeze(next)
  const fragment=fragments.delta(next,scope)
  let records=0,reserved=0,activeReserves=0
  for(const current of Object.values(next.attempts)){
    scope.check()
    const r=current.phase==='active'||current.rounds.some(item=>
      item.presentation==='intent'&&item.puzzlePhase==='reserved')?8:
      current.phase==='round_review'?4:0
    need(current.records.length+r<=1024,'attempt record reserve')
    records+=current.records.length;reserved+=r
    if(r){
      activeReserves++
      if(current===attempt)need(await closureProjectionBytes(current,r,scope)<=262144,
        'changed attempt projection reserve')
    }
  }
  need(records+reserved<=4096&&Object.keys(next.requests).length+reserved<=128&&
    fragment.length+262144*activeReserves<=2097152,'root closure reserve')
  scope.check()
  return next
}
