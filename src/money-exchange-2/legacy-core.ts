// Executable local-authority contract, independent of browser/IndexedDB adapters.
// Renderer receipts are bounded external evidence, never proof of human attention.
import forms from './forms.json'
export { forms }
const formHashes: Record<string,string> = {"ME2-1": "1b56a2afee5c0893dbabb6169bf6077d9fa8a697545fe53e4ee52c495205e0ea", "ME2-2": "f31c156eeea11799e2b53e247161e251713c3f48031a8f81d92ccf9bc2a67830", "ME2-3": "bc0a798eb3c1b7936e533ce1750a3ff6f6869e985cacda58df86521eb5244e1f", "ME2-4": "3d98007fa37886e30564a47ce34321436653b3f73958747f22cc114494140ffe", "ME2-5": "d1f14e242cfcc806284253cb8a23b61c123108a6350dff94774aae51ccc937bc", "ME2-6": "e881594aad4bdbbac33cc421bf7973fc426058f60c456c41bc6c80f72faca056"}

const clone = <T>(value:T) => structuredClone(value);
const hash = (value:unknown) => JSON.stringify(value);
type Form = typeof forms[number];
const formHash = (form:Form) => formHashes[form.id];
export const initialRoot = (ownerId: string|null = null): Root => ({
  version:'money_exchange_2_storage_v1_0', activity:{},
  installationId:crypto.randomUUID(), generation:1, revision:0,
  lease:{ ownerId, epoch:1, live:!!ownerId }, route:{ stage:'library', epoch:1, ownerId },
  ticketSerial:0, currentTicketId:null, tickets:{}, activeAttemptId:null,
  formCounter:0, exposureHistory:[], attempts:{}, tombstones:{}, outcomes:{}, navigation:null,
});
const reject = (root:Root, reason:string) => ({ root, outcome:{ accepted:false, reason } });
function save(root: Root, command: Command, result: ResultData) {
  root.revision += 1;
  root.outcomes[command.requestId] = { payloadHash:hash(command), command:clone(command), result:clone(result), route:clone(root.route), revision:root.revision };
  return { root, outcome:{ accepted:true, ...result } };
}
function route(root:Root, stage:string) {
  root.route = { stage, epoch:root.route.epoch + 1, ownerId:root.lease.ownerId };
}
function openTicket(root:Root) {
  const id = `T${root.generation}.${++root.ticketSerial}`;
  root.tickets[id] = { id, generation:root.generation, ownerId:root.lease.ownerId!, leaseEpoch:root.lease.epoch, state:'open', attemptId:null };
  root.currentTicketId = id; route(root, 'ready');
  return id;
}
function owned(root:Root, command:Command) {
  return root.lease.live && root.lease.ownerId === command.ownerId && root.lease.epoch === command.leaseEpoch && root.route.ownerId === command.ownerId;
}
function currentTicket(root:Root, id:string|null|undefined) {
  const ticket = id ? root.tickets[id] : null;
  return ticket && root.currentTicketId === id && ticket.generation === root.generation &&
    ticket.ownerId === root.lease.ownerId && ticket.leaseEpoch === root.lease.epoch ? ticket : null;
}
function retire(attempt: Attempt, reason:string, command?: Command) {
  attempt.playCapability = false;
  if (attempt.status === 'Armed') {
    if(command) event(attempt,command,'ended_incomplete',undefined,{reason});attempt.status = 'Incomplete'; attempt.endedReason = reason; attempt.reportSnapshot = null;
  }
}
export function decisionResult(form:Form, index:number, signedGiveCents:number) {
  const round = form.rounds[index];
  const min = index === 0 ? 0 : -500;
  if (!Number.isInteger(signedGiveCents) || signedGiveCents % 50 || signedGiveCents < min || signedGiveCents > 500) throw new Error('invalid cents');
  if (round.bonusRecipient === 'partner' && signedGiveCents !== round.partnerSignedGiveCents) throw new Error('not the fixed partner action');
  const recipientFinal = 1000 - signedGiveCents, otherFinal = 500 + signedGiveCents;
  return { signedGiveCents, actor:round.bonusRecipient,
    candidateFinalCents:round.bonusRecipient === 'candidate' ? recipientFinal : otherFinal,
    partnerFinalCents:round.bonusRecipient === 'partner' ? recipientFinal : otherFinal };
}
export function receiptIdentity(attempt:Attempt, index:number) {
  const round = attempt.rounds[index];
  return hash({ generation:attempt.generation, attemptId:attempt.id, formDigest:attempt.formDigest,
    roundId:round.id, partner:round.partner, bonusRecipient:round.bonusRecipient, decision:round.decision });
}
function validRound(attempt:Attempt, index:number, terminalRequired:boolean) {
  const form = forms.find(value => value.id === attempt.formId), round = attempt.rounds[index];
  if (!form || attempt.rounds.length !== 2 || attempt.formDigest !== formHash(form) || !round?.armed || round.id !== `${attempt.id}/R${index + 1}` ||
    round.partner !== form.rounds[index].partner || round.bonusRecipient !== form.rounds[index].bonusRecipient || !round.decision) return false;
  let expected;
  try { expected = decisionResult(form, index, round.decision.signedGiveCents); } catch { return false; }
  if (JSON.stringify(round.decision) !== JSON.stringify(expected) || round.exposure !== 'render_receipt' || round.receiptIdentity !== receiptIdentity(attempt,index)) return false;
  return terminalRequired ? round.terminal && Number.isInteger(round.fairness) && round.fairness! >= 0 && round.fairness! <= 10 : !round.terminal && round.fairness === null;
}
function reportFor(attempt:Attempt) {
  return attempt.rounds.map((round,index) => ({ generation:attempt.generation, attemptId:attempt.id,
    formId:attempt.formId, formDigest:attempt.formDigest, round:index+1, partner:round.partner,
    bonusRecipient:round.bonusRecipient, candidateStartCents:500, partnerStartCents:500,
    ...round.decision, fairness:round.fairness }));
}
export function validCompleted(attempt:Attempt) {
  return Boolean(attempt?.status === 'Completed' && !attempt.playCapability && attempt.rounds.length === 2 &&
    validRound(attempt,0,true) && validRound(attempt,1,true) && JSON.stringify(attempt.reportSnapshot) === JSON.stringify(reportFor(attempt)));
}
export function transition(previous: Root, command: Command) {
  const root: Root = clone(previous);
  if (!command.requestId || command.installationId !== root.installationId) return reject(root,'identity-changed');
  const prior = root.outcomes[command.requestId];
  if (prior) return prior.payloadHash === hash(command)
    ? { root, outcome:{ accepted:true, ...clone(prior.result), replay:true } } : reject(root,'request-conflict');
  if (command.generation !== root.generation) return reject(root,'identity-changed');
  // Deletion is a separate current-generation data authority, independent of play ownership.
  if (command.kind === 'deleteAll') {
    const next = initialRoot(null); next.installationId=root.installationId; next.generation = root.generation+1; next.revision = root.revision;
    next.lease = { ownerId:null, epoch:root.lease.epoch+1, live:false };
    next.route.epoch = root.route.epoch+1;
    return save(next,command,{ generation:next.generation });
  }
  if (command.kind === 'deleteAttempt') {
    const attempt = root.attempts[command.attemptId! ];
    if (!attempt) return reject(root,'attempt-missing');
    delete root.attempts[command.attemptId! ]; root.tombstones[command.attemptId! ] = true;
    // Preserve consumed inventory even when the associated report is deleted.
    delete root.activity[command.attemptId! ];
    if (root.currentTicketId === attempt.originTicketId) {
      root.tickets[attempt.originTicketId].state = 'canceled'; root.currentTicketId=null; root.activeAttemptId=null; route(root,'library');
    }
    return save(root,command,{ deleted:command.attemptId });
  }
  if (command.kind === 'claimLease') {
    if (!command.ownerId || root.lease.live || root.activeAttemptId || root.currentTicketId) return reject(root,'lease-busy');
    root.lease = { ownerId:command.ownerId, epoch:root.lease.epoch+1, live:true }; route(root,'library');
    return save(root,command,{ leaseEpoch:root.lease.epoch });
  }
  if (!owned(root,command)) return reject(root,'owner-changed');
  if (command.kind === 'loseLease') {
    if (root.activeAttemptId) retire(root.attempts[root.activeAttemptId],'owner-lost',command);
    if (root.currentTicketId && root.tickets[root.currentTicketId].state === 'open') root.tickets[root.currentTicketId].state='canceled';
    root.activeAttemptId=null; root.currentTicketId=null; root.lease.live=false; route(root,'library');
    return save(root,command,{ ownerLost:true });
  }
  if (command.kind === 'enter' || command.kind === 'ready') {
    const from = command.kind === 'enter' ? 'library' : 'instructions';
    if (root.route.stage !== from || root.route.epoch !== command.routeEpoch || root.currentTicketId || root.activeAttemptId) return reject(root,'route-changed');
    if (command.kind === 'enter') { root.navigation=null; route(root,'instructions'); return save(root,command,{ stage:'instructions' }); }
    return save(root,command,{ ticketId:openTicket(root), stage:'ready' });
  }
  if (command.kind === 'arm') {
    const ticket = currentTicket(root,command.ticketId);
    if (!ticket || ticket.state !== 'open' || root.route.stage !== 'ready' || root.activeAttemptId) return reject(root,'ticket-changed');
    const ordinal = ++root.formCounter, form = forms[(ordinal-1)%forms.length];
    const id = `A${root.generation}.${ordinal}`;
    const attempt: Attempt = { id, ordinal, createdAt:command.at, context:clone(command.context ?? {}), events:[], revision:1, generation:root.generation, ownerId:command.ownerId, leaseEpoch:command.leaseEpoch,
      originTicketId:ticket.id, formId:form.id, formDigest:formHash(form), status:'Armed', playCapability:true,
      stage:'award_1', rounds:form.rounds.map((round,index) => ({ id:`${id}/R${index+1}`, partner:round.partner,
        bonusRecipient:round.bonusRecipient, armed:index===0, decision:null, exposure:'unshown', receiptIdentity:null, fairness:null, terminal:false })), reportSnapshot:null };
    event(attempt,command,'attempt_armed');event(attempt,command,'round_intent',0);root.attempts[id]=attempt; root.activeAttemptId=id; ticket.state='consumed'; ticket.attemptId=id;
    root.exposureHistory.push({ attemptId:id, formId:form.id, formDigest:attempt.formDigest });
    route(root,'active'); // Arm and active ownership are ONE transaction. There is no seal operation.
    return save(root,command,{ ticketId:ticket.id, attemptId:id, stage:'award_1' });
  }
  if (command.kind === 'exit') {
    if (!['Close','Restart'].includes(command.destination ?? '')) return reject(root,'destination-invalid');
    let ticketId=command.ticketId ?? null;
    if (command.afterRestartRequestId) {
      if (command.destination !== 'Close') return reject(root,'restart-chain-mismatch');
      const restart=root.outcomes[command.afterRestartRequestId];
      if (restart) {
        const old=restart.command;
        if (old.kind!=='exit' || old.destination!=='Restart' || old.ticketId!==command.ticketId ||
          old.ownerId!==command.ownerId || old.leaseEpoch!==command.leaseEpoch || old.generation!==command.generation) return reject(root,'restart-chain-mismatch');
        ticketId=restart.result.successorTicketId ?? null;
      }
    }
    if (command.afterReadyRequestId) {
      if (command.destination !== 'Close' || command.afterRestartRequestId) return reject(root,'ready-chain-mismatch');
      const opening=root.outcomes[command.afterReadyRequestId];
      if (opening) {
        const old=opening.command;
        if (!['ready','tryAgain','reviewReplay'].includes(old.kind) || old.ticketId!==command.ticketId || old.routeEpoch!==command.routeEpoch ||
          old.ownerId!==command.ownerId || old.leaseEpoch!==command.leaseEpoch || old.generation!==command.generation) return reject(root,'ready-chain-mismatch');
        ticketId=opening.result.ticketId ?? null;
      }
    }
    let attemptId:string|null=null;
    if (ticketId) {
      const ticket=currentTicket(root,ticketId);
      if (!ticket || ticket.state==='canceled') return reject(root,'ticket-changed');
      if (ticket.state==='open') ticket.state='canceled';
      else {
        const attempt=root.attempts[ticket.attemptId!];
        if (!attempt || root.tombstones[ticket.attemptId!] || attempt.originTicketId!==ticketId ||
          attempt.ownerId!==command.ownerId || attempt.leaseEpoch!==command.leaseEpoch ||
          !['Armed','Completed'].includes(attempt.status)) return reject(root,'attempt-changed');
        if (attempt.status==='Completed' && !validCompleted(attempt)) return reject(root,'completed-invalid');
        attemptId=attempt.id; retire(attempt,command.reason || 'candidate-exit',command);
      }
    } else if (command.destination!=='Close' || !['instructions',...(command.afterReadyRequestId?['review']:[])].includes(root.route.stage) || root.route.epoch!==command.routeEpoch) return reject(root,'route-changed');
    root.activeAttemptId=null; root.currentTicketId=null;
    root.navigation={ destination:command.destination!, requestId:command.requestId };
    let successorTicketId:string|null=null;
    if (command.destination==='Restart') successorTicketId=openTicket(root); else route(root,'library');
    return save(root,command,{ destination:command.destination, attemptId, successorTicketId });
  }
  if(command.kind==='history') {if(root.activeAttemptId || root.currentTicketId) return reject(root,'play-pending');route(root,'history');return save(root,command,{stage:'history'});}
  if(command.kind==='historyReport') {const target=root.attempts[command.attemptId! ];if(root.route.stage!=='history' || !target || target.status==='Armed' || root.tombstones[target.id])return reject(root,'report-missing');recordActivity(root,target.id,command);route(root,'review');return save(root,command,{stage:'review',attemptId:target.id});}
  if(command.kind==='historyBack') {if(!['history','review'].includes(root.route.stage))return reject(root,'route-changed');route(root,command.destination==='history'?'history':'library');return save(root,command,{stage:root.route.stage});}
  if(command.kind==='reviewReplay') {const target=root.attempts[command.attemptId!];if(root.route.stage!=='review'||root.route.epoch!==command.routeEpoch||!validCompleted(target))return reject(root,'report-changed');return save(root,command,{stage:'ready',ticketId:openTicket(root)});}
  const ticket=currentTicket(root,command.ticketId), attempt=ticket && root.attempts[ticket.attemptId!];
  if (!attempt || root.tombstones[attempt.id]) return reject(root,'attempt-changed');
  if (command.kind==='report' || command.kind==='tryAgain') {
    if (!validCompleted(attempt)) return reject(root,'completed-invalid');
    if (command.kind==='report') { recordActivity(root,attempt.id,command);route(root,'report'); return save(root,command,{ stage:'report_1',attemptId:attempt.id }); }
    if (root.route.stage!=='report' || command.routeEpoch!==root.route.epoch) return reject(root,'route-changed');
    return save(root,command,{ stage:'ready',ticketId:openTicket(root) });
  }
  if (attempt.status!=='Armed' || !attempt.playCapability || root.activeAttemptId!==attempt.id || command.stage!==attempt.stage) return reject(root,'stage-changed');
  if (command.expectedRevision !== attempt.revision) return reject(root,'revision-changed');
  if (command.kind==='step') return gameplay(root,attempt,command);
  if (command.kind==='terminal') {
    if (attempt.stage!=='fairness_2' || !validRound(attempt,0,true) || !validRound(attempt,1,false) ||
      !Number.isInteger(command.rating) || command.rating!<0 || command.rating!>10) return reject(root,'terminal-invalid');
    attempt.rounds[1].fairness=command.rating!; attempt.rounds[1].terminal=true;
    attempt.status='Completed'; attempt.playCapability=false; attempt.stage='test_complete'; event(attempt,command,'fairness_committed',1,{rating:command.rating});event(attempt,command,'round_terminal',1);event(attempt,command,'completed');attempt.revision++; attempt.reportSnapshot=reportFor(attempt);
    root.activeAttemptId=null; route(root,'test_complete');
    return save(root,command,{ stage:'test_complete',attemptId:attempt.id });
  }
  return reject(root,'unknown-operation');
}
export function currentAuthority(root:Root, ownerId:string, leaseEpoch:number, generation:number) {
  return root.generation===generation && root.lease.live && root.lease.ownerId===ownerId && root.lease.epoch===leaseEpoch;
}

export interface Command {
  kind:string; requestId:string; installationId:string; generation:number; ownerId:string; leaseEpoch:number;
  at:number; context?:Record<string,unknown>; routeEpoch?:number; ticketId?:string; stage?:string; expectedRevision?:number;
  destination?:string; afterReadyRequestId?:string; afterRestartRequestId?:string; attemptId?:string;
  rating?:number; cents?:number; operation?:string; receipt?:string; reason?:string;
}
export interface Decision { signedGiveCents:number; actor:string; candidateFinalCents:number; partnerFinalCents:number }
export interface Round { id:string;partner:string;bonusRecipient:string;armed:boolean;decision:Decision|null;exposure:string;receiptIdentity:string|null;fairness:number|null;terminal:boolean }
export interface JournalEvent { version:string;seq:number;requestId:string;at:number;kind:string;round?:number;data?:Record<string,unknown> }
export interface Attempt { id:string;generation:number;ownerId:string;leaseEpoch:number;originTicketId:string;formId:string;formDigest:string;status:string;playCapability:boolean;stage:string;rounds:Round[];reportSnapshot:Record<string,unknown>[]|null;endedReason?:string;ordinal:number;createdAt:number;context:Record<string,unknown>;events:JournalEvent[];revision:number }
export interface Ticket { id:string;generation:number;ownerId:string;leaseEpoch:number;state:string;attemptId:string|null }
export interface Route { stage:string;epoch:number;ownerId:string|null }
export interface Root {
 version:string;installationId:string;generation:number;revision:number;lease:{ownerId:string|null;epoch:number;live:boolean};route:Route;
 ticketSerial:number;currentTicketId:string|null;tickets:Record<string,Ticket>;activeAttemptId:string|null;formCounter:number;
 exposureHistory:{attemptId:string;formId:string;formDigest:string}[];attempts:Record<string,Attempt>;tombstones:Record<string,true>;
 outcomes:Record<string,{payloadHash:string;command:Command;result:ResultData;route:Route;revision:number}>;
 navigation:{destination:string;requestId:string}|null;activity:Record<string,{id:string;kind:string;at:number}[]>;
}
function event(attempt:Attempt, command:Command, kind:string, round?:number, data?:Record<string,unknown>) {
 attempt.events.push({version:'money_exchange_2_event_v1_0',seq:attempt.events.length+1,requestId:command.requestId,at:command.at,kind,...(round===undefined?{}:{round:round+1}),...(data?{data}: {})});
}
function recordActivity(root:Root,id:string,command:Command){(root.activity[id]??=[]).push({id:command.requestId,kind:'report_opened',at:command.at});}
function gameplay(root:Root,attempt:Attempt,command:Command) {
 const stage=attempt.stage,index=stage.endsWith('_2')?1:0, round=attempt.rounds[index];
 const form=forms.find(f=>f.id===attempt.formId)!;
 let next:string;
 if(command.operation==='receipt') {
  if(!stage.startsWith('result_') || round.exposure!=='possibly_revealed' || command.receipt!==receiptIdentity(attempt,index))return reject(root,'receipt-invalid');
  round.exposure='render_receipt';round.receiptIdentity=command.receipt;event(attempt,command,'result_receipt',index,{identity:command.receipt});next=stage;
 } else if(stage==='new_partner') {
  if(!validRound(attempt,0,true)||attempt.rounds[1].armed)return reject(root,'round-order');
  attempt.rounds[1].armed=true;event(attempt,command,'round_intent',1);next='award_2';
 } else if(stage.startsWith('award_')) next=`connecting_${index+1}`;
 else if(stage.startsWith('connecting_')) {if(command.operation!=='animation')return reject(root,'connecting-disabled');next=`connected_${index+1}`;}
 else if(stage.startsWith('connected_'))next=`partner_rules_${index+1}`;
 else if(stage.startsWith('partner_rules_'))next=`bonus_${index+1}`;
 else if(stage.startsWith('bonus_')){event(attempt,command,'bonus_presented',index,{recipient:round.bonusRecipient});next=`${round.bonusRecipient==='candidate'?'choice':'partner_choice'}_${index+1}`;}
 else if(stage.startsWith('choice_')||stage.startsWith('partner_choice_')) {
  if(round.decision)return reject(root,'decision-exists');
  let decision:Decision;try{decision=decisionResult(form,index,command.cents!);}catch{return reject(root,'decision-invalid');}
  round.decision=decision;round.exposure='possibly_revealed';event(attempt,command,'decision_committed',index,{...decision});
  event(attempt,command,'possibly_revealed',index,{identity:receiptIdentity(attempt,index)});next=`result_${index+1}`;
 } else if(stage.startsWith('result_')) {if(!validRound(attempt,index,false))return reject(root,'receipt-unconfirmed');next=`fairness_${index+1}`;}
 else if(stage==='fairness_1') {
  if(!validRound(attempt,0,false)||!Number.isInteger(command.rating)||command.rating!<0||command.rating!>10)return reject(root,'rating-invalid');
  round.fairness=command.rating!;round.terminal=true;event(attempt,command,'fairness_committed',0,{rating:command.rating});event(attempt,command,'round_terminal',0);next='new_partner';
 }else return reject(root,'stage-invalid');
 attempt.stage=next;attempt.revision++;event(attempt,command,'stage_committed',undefined,{from:stage,to:next});route(root,'active');
 return save(root,command,{stage:next,attemptId:attempt.id});
}
export const money=(cents:number)=>`$${(cents/100).toFixed(2)}`;
export const action=(cents:number)=>`${cents<0?'Take':'Give'} ${money(Math.abs(cents))}`;
export function assert(ok:unknown,reason:string):asserts ok {if(!ok)throw Error(`Money Exchange 2: ${reason}`);}
const record=(value:unknown)=>value && typeof value==='object' && !Array.isArray(value);
const integer=(v:number)=>Number.isSafeInteger(v)&&v>=0;
/** Validate retained state by replaying every committed command in order. The
 * ledger is local authority evidence, not protection against malicious storage
 * replacement with an entirely different internally consistent history. */
export function validateRoot(root:Root) {
 assert(record(root)&&root.version==='money_exchange_2_storage_v1_0'&&typeof root.installationId==='string'&&root.installationId.length>0&&
  integer(root.generation)&&root.generation>0&&integer(root.revision)&&record(root.lease)&&integer(root.lease.epoch)&&record(root.route)&&integer(root.route.epoch)&&
  integer(root.ticketSerial)&&integer(root.formCounter)&&record(root.tickets)&&record(root.attempts)&&record(root.outcomes)&&record(root.tombstones)&&record(root.activity)&&Array.isArray(root.exposureHistory),'corrupt root');
 const values=Object.values(root.outcomes).sort((a,b)=>a.revision-b.revision);
 // The reset itself is the first record of a new generation. Its baseline can
 // be reconstructed without retaining deleted personal round/choice bytes.
 let replay=initialRoot(null);replay.installationId=root.installationId;
 if(values[0]?.command.kind==='deleteAll') {
  const reset=values[0];replay.generation=reset.command.generation;replay.revision=reset.revision-1;
  replay.lease.epoch=root.lease.epoch; // overwritten below from the reset route/claim identity
  const firstClaim=values.find(v=>v.command.kind==='claimLease');
  replay.lease.epoch=firstClaim?Number(firstClaim.result.leaseEpoch)-2:root.lease.epoch-1;
  replay.route.epoch=reset.route.epoch-1;
 }
 for(const saved of values) {
  assert(saved && integer(saved.revision)&&saved.revision===replay.revision+1&&record(saved.command)&&Number.isFinite(saved.command.at)&&saved.command.at>=0,'request ledger');
  const result=transition(replay,saved.command);assert(result.outcome.accepted,'unreplayable request');replay=result.root;
 }
 assert(JSON.stringify(replay)===JSON.stringify(root),'root disagrees with committed requests');
}

export interface ResultData { stage?:string; ticketId?:string|null; attemptId?:string|null; destination?:string; successorTicketId?:string|null; generation?:number; deleted?:string; leaseEpoch?:number; ownerLost?:boolean }
