import { canonical, formById, formsFor } from './bank'
import { assertClosureReserve, descriptor, recommendation, replayAttempt, scopedCanonical, scopedDigest } from './model'
import type { Attempt, Chain, JournalRecord, Rule, Round, Score, TrainingRoot } from './model'
import { Aborted, Changed, RetiredBeforePut, TrainingStore, Unconfirmed } from './store'
import type { OperationScope } from './authority'
import type { LiveCommand } from './live'
import { issueLiveEnvelope } from './live-envelope'
import { isCapturedCurrent } from './capture-custody'
import type { CaptureTicket } from './capture-custody'
import { exactJson, ownJson } from './domain'

const VERSIONS = { specification:'towers-training-spec/1',bank:'towers-training-bank/1',
  event:'towers-training-puzzle-events/1',exercise:null,scoring:'towers-training-score/1',
  report:'towers-training-report/1' }
const FORM_IDS: Record<Rule,[string,string]> = {
  plan_before_action:['TT1-D01','TT1-D02'],timed_planning:['TT1-D03','TT1-D04'],
  state_tracking:['TT1-D05','TT1-D06'],sequencing:['TT1-D07','TT1-D08'],
}
const id = () => crypto.randomUUID().replaceAll('-','_')
export type { CaptureTicket } from './capture-custody'
export interface FirstWithdrawal { order:number;offsetUs:number;kind:string;reason:string }
function ticket(elapsedMs:number, supplied?:CaptureTicket):CaptureTicket {
  const result=supplied
  need(result&&isCapturedCurrent(result),'original capture ticket')
  need(Number.isSafeInteger(result.ownerGeneration)&&result.ownerGeneration>=1&&
    result.ownerGeneration<=1000000&&Number.isSafeInteger(result.captureOrder)&&
    result.captureOrder>=1&&result.captureOrder<=1000000&&
    Number.isSafeInteger(result.offsetUs)&&result.offsetUs>=0&&
    Math.floor(result.offsetUs/1000)===elapsedMs&&result.withdrawal===null,'capture ticket')
  return result
}
function chainRevision(root:TrainingRoot,a:Attempt):number|null {
  const chainId=a.attachment.chainId as string|undefined
  if(!chainId)return null
  const chain=root.chains[chainId]
  need(chain,'linked chain unavailable')
  return chain.revision
}
function need(okay:unknown,why:string):asserts okay { if (!okay) throw Error(`Training transition: ${why}`) }
function uncertain(error:unknown):boolean {
  // A dev-module reload can give the same native outcome a different class realm.
  const name=error instanceof Error?error.constructor.name:''
  return error instanceof Unconfirmed||error instanceof Aborted||name==='Unconfirmed'||name==='Aborted'
}
const used = (root:TrainingRoot,family:'baseline'|'retest') => new Set(Object.values(root.attempts)
  .filter(a=>a.kind===family && a.rounds[0].presentation!=='unseen').map(a=>a.rounds[0].formId))
const nextForm = (root:TrainingRoot,family:'baseline'|'retest',excludeChainId?:string) => {
  const occupied=used(root,family)
  for(const a of Object.values(root.attempts))
    if(a.kind===family && a.phase==='reserved')occupied.add(a.rounds[0].formId)
  if(family==='retest')for(const chain of Object.values(root.chains))
    if(chain.id!==excludeChainId && chain.reservedRetestFormId)
      occupied.add(chain.reservedRetestFormId)
  return formsFor(family).find(form=>!occupied.has(form.id))
}
function round(attemptId:string,index:number,formId:string):Round {
  return {id:`${attemptId}_r${index}`,index,formId,formHash:formById(formId).hash,
    presentation:'unseen',puzzlePhase:'reserved',reviewPhase:'not_ready',reviewed:false}
}
function attempt(root:TrainingRoot,kind:Attempt['kind'],eligibility:Attempt['eligibility'],
  context:Attempt['context'],formIds:string[],attachment:Attempt['attachment'],reservedId?:string):Attempt {
  need(root.nextOrdinal<1000000 && Object.keys(root.attempts).length<64,'attempt capacity')
  const attemptId=reservedId??`tt_${id()}`
  need(attemptId.length<59,'attempt ID length')
  const result:Attempt = {id:attemptId,installationId:root.installationId,ordinal:root.nextOrdinal++,
    revision:root.revision+1,createdWallMs:Date.now(),versions:{...VERSIONS,
      exercise:kind==='drill'?'towers-training-exercise-events/1':null},context,
    kind,eligibility,claim:kind==='baseline'&&eligibility==='eligible'?'unclaimed':'retired',attachment,
    rounds:formIds.map((formId,index)=>round(attemptId,index,formId)),records:[],phase:'reserved',snapshot:null}
  root.attempts[attemptId]=result
  return result
}
function record(a:Attempt,roundIndex:number,kind:JournalRecord['kind'],elapsedMs:number,
  payload:Record<string,unknown>={}):JournalRecord {
  const r=a.rounds[roundIndex]
  const ownedPayload=structuredClone(payload)
  const freeze=(value:unknown,seen=new WeakSet<object>()):void=>{
    if(!value||typeof value!=='object'||seen.has(value))return
    seen.add(value)
    for(const key of Reflect.ownKeys(value)){
      const member=Object.getOwnPropertyDescriptor(value,key)
      if(member&&'value' in member)freeze(member.value,seen)
    }
    Object.freeze(value)
  }
  freeze(ownedPayload)
  return Object.freeze({seq:a.records.length+1,id:`${a.id}_e${a.records.length+1}`,roundId:r.id,elapsedMs,
    wallMs:Date.now(),puzzleRevision:a.records.filter(e=>e.roundId===r.id &&
      ['board_onset','move','undo','reset','solved','expired','interrupted','exited'].includes(e.kind)).length,
    kind,payload:ownedPayload})
}
interface Request {
  requestId:string;kind:string;installationId:string;expectedRootRevision:number;body:unknown
  payloadDigest:string
}
async function write(root:TrainingRoot,request:Request,
  change:(root:TrainingRoot)=>Promise<{attemptId:string|null;chainId:string|null}>,scope:OperationScope):Promise<TrainingRoot> {
  need((request.kind.startsWith('delete_') || request.kind==='end_chain' ||
    Object.keys(root.requests).length<128) && root.revision<1000000,
    'Local Towers training data are full. Review history or explicitly delete all Towers training data.')
  need(root.installationId===request.installationId&&root.revision===request.expectedRootRevision&&
    !root.requests[request.requestId],'command source changed')
  scope.check()
  const result=await change(root)
  scope.check()
  root.revision++
  if(Object.keys(root.requests).length>=128 &&
    (request.kind.startsWith('delete_')||request.kind==='end_chain')) {
    // The old request is fenced by root revision. An unresolved old document
    // cannot replay it after this deletion and must read current authority.
    delete root.requests[Object.keys(root.requests)[0]]
  }
  root.requests[request.requestId]={kind:request.kind,payloadDigest:request.payloadDigest,
    expectedRootRevision:request.expectedRootRevision,
    outcome:{rootRevision:root.revision,installationId:root.installationId,
      attemptId:result.attemptId,chainId:result.chainId,status:'applied'}}
  await assertClosureReserve(root,scope)
  return root
}
async function current(root:TrainingRoot,chainId:string,scope:OperationScope):Promise<Chain> {
  const chain=root.chains[chainId]
  need(chain && chain.status!=='ended','chain missing/ended')
  const baseline=root.attempts[chain.baseline.attemptId]
  need(baseline && canonical(await descriptor(baseline,scope))===canonical(chain.baseline),'baseline changed')
  if(chain.firstGrant){const grant=root.attempts[chain.firstGrant.attemptId]
    need(grant && canonical(await descriptor(grant,scope))===canonical(chain.firstGrant),'grant changed')}
  return chain
}
function noUnresolvedG2(root:TrainingRoot,chainId:string) {
  return !Object.values(root.attempts).some(a=>a.kind==='drill' && a.eligibility==='familiar_review' &&
    a.attachment.chainId===chainId &&
    ['reserved','active','between_rounds','round_review'].includes(a.phase))
}
function noUnresolvedRetest(root:TrainingRoot,chainId:string) {
  return !Object.values(root.attempts).some(a=>a.kind==='retest' &&
    a.attachment.chainId===chainId &&
    ['reserved','active'].includes(a.phase))
}
function eraseAttempt(next:TrainingRoot,attemptId:string):void {
  const a=next.attempts[attemptId],chainId=a.attachment.chainId as string|undefined
  const chain=chainId?next.chains[chainId]:Object.values(next.chains).find(c=>c.baseline.attemptId===attemptId)
  const role=chain?.baseline.attemptId===attemptId?'baseline':
    chain?.firstGrant?.attemptId===attemptId?'grant':
    a.kind==='retest'&&a.eligibility==='eligible'&&chain?'retest':'other'
  delete next.attempts[attemptId];next.tombstones[attemptId]=true
  if(chain && role!=='other') {
    delete next.comparisons[chain.id];delete next.chains[chain.id]
    const baseline=next.attempts[chain.baseline.attemptId]
    if(baseline){baseline.claim='retired';baseline.eligibility='familiar_review';
      baseline.revision=next.revision+1}
    const reason=role==='baseline'?'baseline_deleted':role==='grant'?'grant_deleted':'retest_deleted'
    for(const linked of Object.values(next.attempts))if(linked.attachment.chainId===chain.id){
      linked.attachment={type:'detached',reason};linked.eligibility='familiar_review'
      linked.claim='retired';linked.revision=next.revision+1
      if(linked.phase!=='terminal'){linked.phase='abandoned';linked.snapshot=null}
    }
  } else if(chain && a.kind==='drill' && a.eligibility==='eligible' &&
    chain.status==='drilling' && !Object.values(next.attempts).some(other=>
      other.kind==='drill'&&other.eligibility==='eligible'&&
      other.attachment.chainId===chain.id)){
    chain.status='assigned';chain.revision=next.revision+1
  }
  next.activity=next.activity.filter(entry=>entry.attemptId!==attemptId&&
    (!chain||role==='other'||entry.chainId!==chain.id))
  for(const [id,receipt] of Object.entries(next.requests)){
    const outcome=receipt.outcome as {attemptId:string|null;chainId:string|null}
    if(outcome.attemptId===attemptId || chain&&role!=='other'&&outcome.chainId===chain.id)
      delete next.requests[id]
  }
}
export class TrainingActions {
  private store: TrainingStore
  private pending:{request:Request;sourceRoot:TrainingRoot;
    apply:(next:TrainingRoot,scope:OperationScope)=>Promise<TrainingRoot>;
    publication:'source'|'delete';deletedId?:string}|null=null
  constructor(store:TrainingStore) { this.store = store }
  pendingKind(){return this.pending?.request.kind??null}
  private clearPending(requestId:string){
    if(this.pending?.request.requestId===requestId)this.pending=null
  }
  private async commit(root:TrainingRoot,kind:string,body:unknown,
    mutate:(next:TrainingRoot,scope:OperationScope)=>Promise<{attemptId:string|null;chainId:string|null}>,
    publication:'source'|'delete',deletedId:string|undefined,scope:OperationScope,
    live?:{attemptId:string;roundIndex:number;record:JournalRecord;
      publish:(next:TrainingRoot)=>void}) {
    if(scope.kind==='settlement'&&kind!=='settle')
      throw Error('Settlement has no ordinary training command authority')
    if(this.pending)throw new Unconfirmed('Resolve the previous training command before another action')
    scope.check()
    if(kind==='intent')this.store.recognizeIntentSource(root)
    const sourceRoot=live||kind==='intent'?root:structuredClone(root)
    const liveRoute=live?{attemptId:live.attemptId,roundIndex:live.roundIndex,
      publish:live.publish,capture:(body as {captureTicket:CaptureTicket}).captureTicket}:null
    scope.check()
    const command:Request={requestId:id(),kind,installationId:root.installationId,
      expectedRootRevision:root.revision,body:structuredClone(body),
      payloadDigest:''}
    const apply=(value:TrainingRoot,workScope:OperationScope)=>
      write(value,command,next=>mutate(next,workScope),workScope)
    const captured=kind==='append'||kind==='coach_live'
    // The event and request ID enter custody synchronously with capture. Its
    // digest may finish under S if withdrawal retires O during preparation.
    if(captured)this.pending={request:command,sourceRoot,apply,publication,deletedId}
    try{
      command.body=(await ownJson(command.body,scope)).value
      command.payloadDigest=await scopedDigest({kind,installationId:root.installationId,
        expectedRootRevision:root.revision,body:command.body},scope)
      scope.check()
      if(liveRoute){
        const item=(command.body as {record:JournalRecord}).record
        const liveCommand:LiveCommand=issueLiveEnvelope({kind:item.kind==='board_onset'?'onset':
          kind as LiveCommand['kind'],
          attemptId:liveRoute.attemptId,roundIndex:liveRoute.roundIndex,
          record:item,
          body:command.body,requestId:command.requestId,payloadDigest:command.payloadDigest,
          expectedRootRevision:command.expectedRootRevision},liveRoute.capture)
        const result=await this.store.commitLive(root,liveCommand,scope,liveRoute.publish)
        this.clearPending(command.requestId)
        return result.root
      }
      const observed=await this.store.read(scope)
      scope.check()
      if(observed.status!=='present'||!exactJson(observed.root,sourceRoot,scope))
        throw new Changed()
      if(!captured)this.pending={request:command,sourceRoot,apply,publication,deletedId}
      const next=kind==='intent'?
        await this.store.commitIntent(root,{requestId:command.requestId,body:command.body,
          payloadDigest:command.payloadDigest,expectedRootRevision:command.expectedRootRevision},scope):
        await this.store.update(root,value=>apply(value,scope),scope,
          publication,deletedId)
      this.clearPending(command.requestId);return next
    }catch(error){if(captured ? scope.valid()&&
      (error instanceof RetiredBeforePut||!uncertain(error)) :
      error instanceof RetiredBeforePut||!uncertain(error))this.clearPending(command.requestId)
      throw error}
  }
  /** Check confirms ordinary history; only a captured event can be retried by settlement. */
  async reconcilePending(scope:OperationScope,settleCaptured=false):Promise<TrainingRoot|null>{
    const pending=this.pending
    if(!pending)return null
    if(!pending.request.payloadDigest){
      const request=pending.request
      request.payloadDigest=await scopedDigest({kind:request.kind,
        installationId:request.installationId,
        expectedRootRevision:request.expectedRootRevision,body:request.body},scope)
    }
    const observed=await this.store.read(scope)
    if(observed.status!=='present')throw new Changed('Saved training source is unavailable')
    const root=observed.root,receipt=root.requests[pending.request.requestId]
    if(receipt){
      need(receipt.kind===pending.request.kind&&receipt.payloadDigest===pending.request.payloadDigest&&
        receipt.expectedRootRevision===pending.request.expectedRootRevision,
        'same request ID has a different payload')
      this.clearPending(pending.request.requestId)
      return root
    }
    if(root.installationId!==pending.request.installationId||
      root.revision!==pending.request.expectedRootRevision){this.clearPending(pending.request.requestId);throw new Changed()}
    if(!settleCaptured||!['append','coach_live','settle'].includes(pending.request.kind)){
      // A completed current observation can discharge an ordinary absent
      // command. It cannot itself become the missing user choice.
      this.clearPending(pending.request.requestId)
      return root
    }
    if(!exactJson(root,pending.sourceRoot,scope)){
      this.clearPending(pending.request.requestId);throw new Changed()}
    try{const next=await this.store.update(root,value=>pending.apply(value,scope),scope,
      pending.publication,pending.deletedId)
      this.clearPending(pending.request.requestId);return next
    }catch(error){
      // A captured input still has its original request and source after a
      // retired S submitted no put. A later explicit Check may use that exact
      // ticket if a completed read proves the source is still current.
      if(!(error instanceof RetiredBeforePut)&&!uncertain(error))this.clearPending(pending.request.requestId)
      throw error
    }
  }
  async reserveBaseline(root:TrainingRoot,context:Attempt['context'],scope:OperationScope):Promise<TrainingRoot> {
    const form=nextForm(root,'baseline')
    need(form,'All six training baseline puzzles have been used in this browser’s retained data.')
    need(!Object.values(root.attempts).some(a=>a.kind==='baseline'&&a.eligibility==='eligible'&&
      ['reserved','active'].includes(a.phase)),
    'A prior baseline reservation or live prefix must be reviewed or explicitly deleted first')
    need(!Object.values(root.chains).some(c=>['assigned','drilling','drill_complete','retesting'].includes(c.status)),
      'Another training chain is active')
    const attemptId=`tt_${id()}`
    return this.commit(root,'reserve',{attemptId,context,attemptKind:'baseline',chainId:null,
      eligibility:'eligible',preferredFormId:null},async (next,workScope)=>{workScope.check();
      const a=attempt(next,'baseline','eligible',context,[form.id],{type:'baseline'},attemptId)
      return {attemptId:a.id,chainId:null}
    },'source',undefined,scope)
  }
  async reserveFamiliar(root:TrainingRoot,sourceId:string,scope:OperationScope):Promise<TrainingRoot> {
    const source=root.attempts[sourceId]
    need(source && source.kind!=='drill' && source.phase==='terminal',
      'The earlier puzzle must have a saved terminal result before familiar Restart')
    need(source.attachment.type!=='detached','Detached history cannot be restarted in a chain')
    if(source.attachment.type==='linked')await current(root,source.attachment.chainId as string,scope)
    const attemptId=`tt_${id()}`
    return this.commit(root,'reserve',{attemptId,context:source.context,attemptKind:source.kind,
      chainId:(source.attachment.chainId as string|undefined)??null,eligibility:'familiar_review',
      preferredFormId:source.rounds[0].formId},async (next,workScope)=>{workScope.check();
      const a=attempt(next,source.kind,'familiar_review',source.context,
        [source.rounds[0].formId],structuredClone(source.attachment),attemptId)
      return {attemptId:a.id,chainId:(a.attachment.chainId as string|undefined)??null}
    },'source',undefined,scope)
  }
  async intent(root:TrainingRoot,attemptId:string,roundIndex:number,scope:OperationScope):Promise<TrainingRoot> {
    const source=root.attempts[attemptId],r=source?.rounds[roundIndex]
    need(source && r && r.presentation==='unseen','unavailable round')
    return this.commit(root,'intent',{attemptId,attemptRevision:source.revision,roundId:r.id,
      chainRevision:chainRevision(root,source)},async (next,workScope)=>{workScope.check();
      const a=next.attempts[attemptId];a.rounds[roundIndex].presentation='intent';a.revision=next.revision+1
      return {attemptId,chainId:a.attachment.chainId as string|null ?? null}
    },'source',undefined,scope)
  }
  async onset(root:TrainingRoot,attemptId:string,roundIndex:number,capture:CaptureTicket|undefined,
    scope:OperationScope,publish?:(next:TrainingRoot)=>void):Promise<TrainingRoot> {
    const source=root.attempts[attemptId],r=source?.rounds[roundIndex]
    need(source && r?.presentation==='intent','board intent missing')
    const item=record(source,roundIndex,'board_onset',0)
    return this.commit(root,'append',{attemptId,attemptRevision:source.revision,roundId:r.id,
      chainRevision:chainRevision(root,source),record:item,
      captureTicket:ticket(0,capture)},async (next,workScope)=>{workScope.check();
      const a=next.attempts[attemptId]
      a.records.push(item);a.rounds[roundIndex].presentation='onset';a.rounds[roundIndex].puzzlePhase='active'
      a.phase='active';a.revision=next.revision+1
      return {attemptId,chainId:a.attachment.chainId as string|null ?? null}
    },'source',undefined,scope,publish?{attemptId,roundIndex,record:item,publish}:undefined)
  }
  async append(root:TrainingRoot,attemptId:string,roundIndex:number,kind:'move'|'undo'|'reset',
    elapsedMs:number,payload:Record<string,unknown>,capture:CaptureTicket|undefined,
    scope:OperationScope,publish?:(next:TrainingRoot)=>void):Promise<TrainingRoot> {
    const source=root.attempts[attemptId],r=source?.rounds[roundIndex]
    need(source && r?.puzzlePhase==='active' && elapsedMs<120000,'active round unavailable')
    const item=record(source,roundIndex,kind,elapsedMs,payload)
    return this.commit(root,'append',{attemptId,attemptRevision:source.revision,roundId:r.id,
      chainRevision:chainRevision(root,source),record:item,captureTicket:ticket(elapsedMs,capture)},async (next,workScope)=>{workScope.check();
      const a=next.attempts[attemptId]
      a.records.push(item)
      // Pure replay rejects illegal placements or coaching order before a put.
      const form=formById(r.formId),state=boardFrom(a,roundIndex,workScope)
      if(kind==='move' && canonical(state)===canonical(form.target)){
        a.records.push(record(a,roundIndex,'solved',elapsedMs));a.rounds[roundIndex].puzzlePhase='solved'
        if(a.kind==='drill'){a.rounds[roundIndex].reviewPhase='pending';a.phase='round_review'}
        else {a.phase='terminal';a.snapshot=await replayAttempt(a,false,workScope)}
      }
      a.revision=next.revision+1
      await replayAttempt(a,true,workScope)
      return {attemptId,chainId:a.attachment.chainId as string|null ?? null}
    },'source',undefined,scope,publish?{attemptId,roundIndex,record:item,publish}:undefined)
  }
  async coach(root:TrainingRoot,attemptId:string,roundIndex:number,kind:JournalRecord['kind'],
    elapsedMs:number,payload:Record<string,unknown>,capture:CaptureTicket|undefined,
    scope:OperationScope,publish?:(next:TrainingRoot)=>void):Promise<TrainingRoot> {
    const source=root.attempts[attemptId],r=source?.rounds[roundIndex]
    need(source?.kind==='drill' && r?.puzzlePhase==='active' && elapsedMs<120000,'active coach unavailable')
    const item=record(source,roundIndex,kind,elapsedMs,payload)
    return this.commit(root,'coach_live',{attemptId,attemptRevision:source.revision,roundId:r.id,
      chainRevision:chainRevision(root,source),record:item,captureTicket:ticket(elapsedMs,capture)},async (next,workScope)=>{workScope.check();
      const a=next.attempts[attemptId];a.records.push(item)
      a.revision=next.revision+1;await replayAttempt(a,true,workScope)
      return {attemptId,chainId:a.attachment.chainId as string|null ?? null}
    },'source',undefined,scope,publish?{attemptId,roundIndex,record:item,publish}:undefined)
  }
  /** Retire an exposed intent or a hard-reload prefix without fabricating a clock terminal. */
  async retirePrefix(root:TrainingRoot,attemptId:string,reason:'intent_withdrawn'|'timing_unknown',scope:OperationScope):
    Promise<TrainingRoot> {
    const source=root.attempts[attemptId]
    need(source && (source.phase==='active'||source.phase==='reserved'&&
      source.rounds.some(round=>round.presentation==='intent')),'prefix retirement unavailable')
    return this.commit(root,'settle',{attemptId,attemptRevision:source.revision,
      chainRevision:chainRevision(root,source),reason,record:null},async (next,workScope)=>{workScope.check();
      const a=next.attempts[attemptId]
      a.phase='abandoned';a.snapshot=null;a.revision=next.revision+1
      await replayAttempt(a,true,workScope)
      return {attemptId,chainId:a.attachment.chainId as string|null ?? null}
    },'source',undefined,scope)
  }
  async cancelUnseenStart(root:TrainingRoot,attemptId:string,scope:OperationScope):Promise<TrainingRoot>{
    need(scope.kind==='settlement','Start withdrawal settlement required')
    const source=root.attempts[attemptId]
    need(source?.phase==='reserved'&&source.records.length===0&&
      source.rounds.every(round=>round.presentation==='unseen'),
    'Only an unexposed reserved Start can be canceled')
    return this.commit(root,'settle',{attemptId,attemptRevision:source.revision,
      reason:'start_withdrawn_before_intent'},async(next,workScope)=>{workScope.check()
      eraseAttempt(next,attemptId)
      return {attemptId:null,chainId:null}
    },'source',undefined,scope)
  }
  async settle(root:TrainingRoot,attemptId:string,roundIndex:number,
    kind:'expired'|'interrupted'|'exited',elapsedMs:number,reason:string|undefined,
    withdrawal:FirstWithdrawal|null|undefined,scope:OperationScope):Promise<TrainingRoot> {
    const source=root.attempts[attemptId],r=source?.rounds[roundIndex]
    need(source && r?.puzzlePhase==='active','settlement unavailable')
    const item=record(source,roundIndex,kind,elapsedMs,reason?{reason}:{})
    const firstWithdrawal=withdrawal===undefined?(kind==='expired'?null:{order:1,
      offsetUs:elapsedMs*1000,kind:kind==='exited'?'exit':'hide',reason:reason??'unknown'}):withdrawal
    return this.commit(root,'settle',{attemptId,attemptRevision:source.revision,roundId:r.id,
      chainRevision:chainRevision(root,source),record:item,firstWithdrawal,pendingRequestId:null},async (next,workScope)=>{workScope.check();
      const a=next.attempts[attemptId]
      a.records.push(item)
      a.rounds[roundIndex].puzzlePhase=kind
      if(a.kind==='drill'){
        if(kind==='expired'){
          a.rounds[roundIndex].reviewPhase='pending'
          const events=a.records.filter(event=>event.roundId===r.id)
          const rule=a.rounds[0].formId
          const incomplete=rule==='TT1-D01' || rule==='TT1-D02' ?
            !events.some(event=>event.kind==='plan_confirm') :
            rule==='TT1-D03' || rule==='TT1-D04' ?
            !events.some(event=>event.kind==='planning_release') :
            rule==='TT1-D07' || rule==='TT1-D08' ?
            !events.some(event=>event.kind==='checkpoint_ack') : false
          a.phase=incomplete?'abandoned':'round_review'
        }else a.phase='abandoned'
      } else {a.phase='terminal';a.snapshot=await replayAttempt(a,false,workScope)}
      a.revision=next.revision+1;await replayAttempt(a,true,workScope)
      return {attemptId,chainId:a.attachment.chainId as string|null ?? null}
    },'source',undefined,scope)
  }
  async assign(root:TrainingRoot,baselineId:string,scope:OperationScope):Promise<TrainingRoot> {
    const b=root.attempts[baselineId]
    need(b?.kind==='baseline' && b.phase==='terminal' && b.claim==='unclaimed' &&
      b.eligibility==='eligible','Baseline is not eligible')
    const score=b.snapshot as Awaited<ReturnType<typeof replayAttempt>>
    need(score && 'moves' in score && score.moves>=4 &&
      (score.terminal==='solved'||score.terminal==='expired'),'Not enough move evidence to choose an exercise')
    need(!Object.values(root.chains).some(c=>['assigned','drilling','drill_complete','retesting'].includes(c.status)),
      'Another training chain is active')
    const retest=nextForm(root,'retest');need(retest,'No unseen retest puzzle remains in this browser’s retained data.')
    const chainId=`tc_${id()}`
    const baseline=await descriptor(b,scope)
    return this.commit(root,'assign',{chainId,baseline},async (next,workScope)=>{workScope.check();
      need(nextForm(next,'retest')?.id===retest.id,'Retest allocation changed before assignment')
      const source=next.attempts[baselineId];source.claim='used';source.revision=next.revision+1
      const report=source.snapshot as Score
      const rec=recommendation(report)
      const chain:Chain={id:chainId,version:'towers-training-chain/1',revision:next.revision+1,
        createdWallMs:Date.now(),context:structuredClone(source.context),baseline:await descriptor(source,workScope),
        recommendation:rec,drillRule:rec.rule,drillFormIds:FORM_IDS[rec.rule],firstGrant:null,
        reservedRetestFormId:retest.id,retestAttemptIds:[],completedRetest:null,status:'assigned'}
      next.chains[chainId]=chain
      return {attemptId:baselineId,chainId}
    },'source',undefined,scope)
  }
  async reserveDrill(root:TrainingRoot,chainId:string,familiar:boolean,scope:OperationScope):Promise<TrainingRoot> {
    const chain=await current(root,chainId,scope)
    need(familiar ? !!chain.firstGrant && ['drill_complete','compared','exhausted'].includes(chain.status) :
      chain.status==='assigned'||chain.status==='drilling','drill status')
    need(noUnresolvedG2(root,chainId),'Unresolved familiar exercise')
    if(familiar)need(noUnresolvedRetest(root,chainId),'Unresolved retest play')
    else need(!Object.values(root.attempts).some(a=>a.kind==='drill'&&a.eligibility==='eligible'&&
      a.attachment.chainId===chainId&&['reserved','active','between_rounds','round_review'].includes(a.phase)),
      'An assigned exercise is still in progress')
    const attemptId=`tt_${id()}`
    return this.commit(root,'reserve',{attemptId,context:chain.context,attemptKind:'drill',chainId,
      eligibility:familiar?'familiar_review':'eligible',preferredFormId:null},async (next,workScope)=>{workScope.check();
      const c=next.chains[chainId]
      const a=attempt(next,'drill',familiar?'familiar_review':'eligible',c.context,c.drillFormIds,
        {type:'linked',chainId,grantAttemptId:null,grantDigest:null},attemptId)
      if(!familiar){c.status='drilling';c.revision=next.revision+1}
      return {attemptId:a.id,chainId}
    },'source',undefined,scope)
  }
  async review(root:TrainingRoot,attemptId:string,roundIndex:number,
    kind:'tracking_answer'|'tracking_continue'|'round_reviewed',payload:Record<string,unknown>,scope:OperationScope):Promise<TrainingRoot> {
    const source=root.attempts[attemptId],r=source?.rounds[roundIndex]
    need(source?.kind==='drill' && r && ['solved','expired'].includes(r.puzzlePhase),'round review unavailable')
    const terminal=source.records.filter(e=>e.roundId===r.id &&
      ['solved','expired'].includes(e.kind)).at(-1)!
    const item=record(source,roundIndex,kind,terminal.elapsedMs,payload)
    return this.commit(root,'review',{attemptId,attemptRevision:source.revision,
      chainRevision:chainRevision(root,source),record:item},async (next,workScope)=>{workScope.check();
      const a=next.attempts[attemptId]
      a.records.push(item)
      if(kind==='round_reviewed'){
        a.rounds[roundIndex].reviewed=true;a.rounds[roundIndex].reviewPhase='reviewed'
        const terminal=a.rounds[roundIndex].puzzlePhase
        const moves=a.records.filter(event=>event.roundId===r.id&&event.kind==='move').length
        const executed=terminal==='solved'||terminal==='expired'&&moves>=4
        a.phase=executed?(roundIndex===0?'between_rounds':'round_review'):'abandoned'
      }
      a.revision=next.revision+1;await replayAttempt(a,true,workScope)
      return {attemptId,chainId:a.attachment.chainId as string|null ?? null}
    },'source',undefined,scope)
  }
  async completeExercise(root:TrainingRoot,attemptId:string,scope:OperationScope):Promise<TrainingRoot> {
    const a=root.attempts[attemptId],chainId=a?.attachment.chainId as string
    need(a?.kind==='drill' && a.rounds.every(r=>r.reviewed) && chainId,'exercise incomplete')
    await current(root,chainId,scope)
    const last=a.records.filter(e=>e.roundId===a.rounds[1].id &&
      ['solved','expired'].includes(e.kind)).at(-1)!
    const item=record(a,1,'exercise_completed',last.elapsedMs,{roundIds:a.rounds.map(r=>r.id)})
    return this.commit(root,'complete_exercise',{attemptId,attemptRevision:a.revision,
      chainRevision:chainRevision(root,a),record:item},async (next,workScope)=>{workScope.check();
      const drill=next.attempts[attemptId],c=next.chains[chainId]
      drill.records.push(item)
      drill.phase='terminal';drill.snapshot=await replayAttempt(drill,false,workScope);drill.revision=next.revision+1
      if(drill.eligibility==='eligible'){
        need(!c.firstGrant,'grant already locked')
        c.firstGrant=await descriptor(drill,workScope);c.status='drill_complete';c.revision=next.revision+1
      }
      return {attemptId,chainId}
    },'source',undefined,scope)
  }
  async reserveRetest(root:TrainingRoot,chainId:string,scope:OperationScope):Promise<TrainingRoot> {
    const chain=await current(root,chainId,scope)
    need(chain.firstGrant && ['drill_complete','retesting'].includes(chain.status) &&
      noUnresolvedG2(root,chainId),'Retest source or exercise unresolved')
    need(noUnresolvedRetest(root,chainId),'An earlier retest is still in progress')
    need(!Object.values(root.attempts).some(a=>a.kind==='retest'&&a.eligibility==='eligible'&&
      a.attachment.chainId===chainId&&a.phase==='terminal'&&
      ['solved','expired'].includes((a.snapshot as Score)?.terminal)),
      'A completed retest is ready for comparison')
    if(chain.reservedRetestFormId)need(!used(root,'retest').has(chain.reservedRetestFormId) &&
      !Object.values(root.attempts).some(a=>a.kind==='retest'&&a.phase==='reserved'&&
        a.rounds[0].formId===chain.reservedRetestFormId), 'Reserved unseen retest was already retained')
    const form=chain.reservedRetestFormId ? formById(chain.reservedRetestFormId) : nextForm(root,'retest',chainId)
    if(!form) return this.commit(root,'reserve_retest',{chainId,chainRevision:chain.revision,attemptId:null},async (next,workScope)=>{workScope.check();
      need(!next.chains[chainId].reservedRetestFormId && !nextForm(next,'retest',chainId),
        'Retest inventory changed before exhaustion')
      const c=next.chains[chainId]
      c.status='exhausted';c.revision=next.revision+1
      return {attemptId:null,chainId}
    },'source',undefined,scope)
    const attemptId=`tt_${id()}`
    return this.commit(root,'reserve_retest',{chainId,chainRevision:chain.revision,attemptId},async (next,workScope)=>{workScope.check();
      const c=next.chains[chainId]
      need(c.reservedRetestFormId ? c.reservedRetestFormId===form.id &&
        !used(next,'retest').has(form.id) && !Object.values(next.attempts).some(a=>
          a.kind==='retest' && a.phase==='reserved' && a.rounds[0].formId===form.id) :
        nextForm(next,'retest',chainId)?.id===form.id,
        'Retest allocation changed before reservation')
      const a=attempt(next,'retest','eligible',c.context,[form.id],{type:'linked',chainId,
        grantAttemptId:c.firstGrant!.attemptId,grantDigest:c.firstGrant!.sourceDigest},attemptId)
      c.retestAttemptIds.push(a.id);c.reservedRetestFormId=null;c.status='retesting';c.revision=next.revision+1
      return {attemptId:a.id,chainId}
    },'source',undefined,scope)
  }
  async deleteAttempt(root:TrainingRoot,attemptId:string,scope:OperationScope):Promise<TrainingRoot> {
    const source=root.attempts[attemptId]
    need(source,'Attempt already removed')
    return this.commit(root,'delete_attempt',{attemptId,attemptRevision:source.revision},async (next,workScope)=>{workScope.check();
      eraseAttempt(next,attemptId)
      return {attemptId:null,chainId:null}
    },'delete',attemptId,scope)
  }
  async deleteChain(root:TrainingRoot,chainId:string,scope:OperationScope):Promise<TrainingRoot> {
    const chain=root.chains[chainId];need(chain,'Chain already removed')
    return this.commit(root,'delete_chain',{chainId,chainRevision:chain.revision},async (next,workScope)=>{workScope.check();
      const c=next.chains[chainId]
      delete next.chains[chainId];delete next.comparisons[chainId]
      const baseline=next.attempts[c.baseline.attemptId]
      if(baseline){baseline.claim='retired';baseline.eligibility='familiar_review';baseline.revision=next.revision+1}
      for(const a of Object.values(next.attempts))if(a.attachment.chainId===chainId){
        a.attachment={type:'detached',reason:'chain_deleted'};a.eligibility='familiar_review'
        a.revision=next.revision+1
        if(a.phase!=='terminal'){a.phase='abandoned';a.snapshot=null}
      }
      next.activity=next.activity.filter(entry=>entry.chainId!==chainId)
      for(const [id,receipt] of Object.entries(next.requests))
        if((receipt.outcome as {chainId:string|null}).chainId===chainId)delete next.requests[id]
      return {attemptId:null,chainId:null}
    },'delete',chainId,scope)
  }
  async endChain(root:TrainingRoot,chainId:string,scope:OperationScope):Promise<TrainingRoot> {
    const chain=await current(root,chainId,scope)
    return this.commit(root,'end_chain',{chainId,chainRevision:chain.revision},async (next,workScope)=>{workScope.check();
      const c=next.chains[chainId],baseline=next.attempts[c.baseline.attemptId]
      baseline.claim='retired';baseline.eligibility='familiar_review';baseline.revision=next.revision+1
      c.baseline=await descriptor(baseline,workScope);c.firstGrant=null;c.completedRetest=null
      c.reservedRetestFormId=null;c.retestAttemptIds=[];c.status='ended';c.revision=next.revision+1
      delete next.comparisons[chainId]
      for(const a of Object.values(next.attempts))if(a.attachment.chainId===chainId){
        a.attachment={type:'detached',reason:'chain_ended'};a.eligibility='familiar_review'
        a.revision=next.revision+1
        if(a.phase!=='terminal'){a.phase='abandoned';a.snapshot=null}
      }
      for(const [id,receipt] of Object.entries(next.requests))
        if((receipt.outcome as {chainId:string|null}).chainId===chainId)delete next.requests[id]
      return {attemptId:null,chainId}
    },'delete',chainId,scope)
  }
  async deleteAll(root:TrainingRoot,scope:OperationScope):Promise<TrainingRoot> {
    if(this.pending)throw new Unconfirmed('Resolve the previous training command before deleting data')
    scope.check()
    const observed=await this.store.read(scope)
    if(observed.status!=='present'||
      await scopedCanonical(observed.root,scope)!==await scopedCanonical(root,scope))throw new Changed()
    const body={observedRootToken:await scopedDigest(observed.root,scope)},newInstallationId=id()
    const request:Request={requestId:id(),kind:'delete_all',installationId:root.installationId,
      expectedRootRevision:root.revision,body,
      payloadDigest:await scopedDigest({kind:'delete_all',installationId:root.installationId,
        expectedRootRevision:root.revision,body},scope)}
    const apply=async(previous:TrainingRoot,workScope:OperationScope)=>{
      workScope.check()
      need(previous.installationId===request.installationId&&
        previous.revision===request.expectedRootRevision&&
        await scopedDigest(previous,workScope)===body.observedRootToken,'delete-all observation changed')
      workScope.check()
      const fresh:TrainingRoot={version:'towers-training-root/1',installationId:newInstallationId,
        revision:1,nextOrdinal:1,attempts:{},chains:{},comparisons:{},requests:{},activity:[],tombstones:{}}
      fresh.requests[request.requestId]={kind:'delete_all',payloadDigest:request.payloadDigest,
        expectedRootRevision:request.expectedRootRevision,outcome:{rootRevision:1,
          installationId:fresh.installationId,attemptId:null,chainId:null,status:'applied'}}
      return fresh
    }
    const sourceRoot=structuredClone(root)
    this.pending={request,sourceRoot,apply,publication:'delete'}
    try{const next=await this.store.update(root,value=>apply(value,scope),scope,
      'delete',undefined)
      this.clearPending(request.requestId);return next
    }catch(error){if(error instanceof RetiredBeforePut||!uncertain(error))this.clearPending(request.requestId);throw error}
  }
  async compare(root:TrainingRoot,chainId:string,retestId:string,scope:OperationScope):Promise<TrainingRoot> {
    const chain=await current(root,chainId,scope),retest=root.attempts[retestId]
    need(chain.status==='retesting' && chain.firstGrant && retest?.kind==='retest' &&
      retest.phase==='terminal' && ['solved','expired'].includes((retest.snapshot as Score)?.terminal) &&
      retest.eligibility==='eligible' &&
      chain.retestAttemptIds.includes(retestId),'Comparison unavailable')
    const retestDescriptor=await descriptor(retest,scope)
    return this.commit(root,'compare',{chainId,chainRevision:chain.revision,retest:retestDescriptor},async (next,workScope)=>{workScope.check();
      const c=next.chains[chainId],r=next.attempts[retestId]
      const source=await descriptor(r,workScope)
      c.completedRetest=source;c.status='compared';c.revision=next.revision+1
      next.comparisons[chainId]={version:'towers-training-comparison/1',chainId,
        baseline:c.baseline,grant:c.firstGrant,retest:source,context:c.context,
        reportVersion:'towers-training-report/1'}
      return {attemptId:retestId,chainId}
    },'source',undefined,scope)
  }
}

function boardFrom(a:Attempt,roundIndex:number,scope:OperationScope) {
  scope.check()
  const form=formById(a.rounds[roundIndex].formId)
  let board=structuredClone(form.start)
  let undo:typeof board[]=[]
  for(const event of a.records.filter(e=>e.roundId===a.rounds[roundIndex].id)) {
    scope.check()
    if(event.kind==='move'){
      undo.push(structuredClone(board))
      const from=event.payload.from as number,to=event.payload.to as number
      board[to].push(board[from].pop()!)
    } else if(event.kind==='undo') board=undo.pop()!
    else if(event.kind==='reset'){board=structuredClone(form.start);undo=[]}
  }
  return board
}
