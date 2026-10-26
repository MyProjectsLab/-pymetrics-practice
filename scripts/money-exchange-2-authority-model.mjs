// Executable local-authority contract, independent of browser/IndexedDB adapters.
// Renderer receipts are bounded external evidence, never proof of human attention.
import { createHash } from 'node:crypto';
import { forms } from './money-exchange-2-forms-v1.mjs';
export { forms } from './money-exchange-2-forms-v1.mjs';
const clone = value => structuredClone(value);
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const initialRoot = (ownerId = 'owner-1') => ({
  installationId:'money2-local', generation:1, revision:0,
  lease:{ ownerId, epoch:1, live:true }, route:{ stage:'library', epoch:1, ownerId },
  ticketSerial:0, currentTicketId:null, tickets:{}, activeAttemptId:null,
  formCounter:0, exposureHistory:[], attempts:{}, tombstones:{}, outcomes:{}, navigation:null,
});
const reject = (root, reason) => ({ root, outcome:{ accepted:false, reason } });
function save(root, command, result) {
  root.revision += 1;
  root.outcomes[command.requestId] = { payloadHash:hash(command), command:clone(command), result:clone(result), route:clone(root.route), revision:root.revision };
  return { root, outcome:{ accepted:true, ...result } };
}
function route(root, stage) {
  root.route = { stage, epoch:root.route.epoch + 1, ownerId:root.lease.ownerId };
}
function openTicket(root) {
  const id = `T${root.generation}.${++root.ticketSerial}`;
  root.tickets[id] = { id, generation:root.generation, ownerId:root.lease.ownerId, leaseEpoch:root.lease.epoch, state:'open', attemptId:null };
  root.currentTicketId = id; route(root, 'ready');
  return id;
}
function owned(root, command) {
  return root.lease.live && root.lease.ownerId === command.ownerId && root.lease.epoch === command.leaseEpoch && root.route.ownerId === command.ownerId;
}
function currentTicket(root, id) {
  const ticket = root.tickets[id];
  return ticket && root.currentTicketId === id && ticket.generation === root.generation &&
    ticket.ownerId === root.lease.ownerId && ticket.leaseEpoch === root.lease.epoch ? ticket : null;
}
function retire(attempt, reason) {
  attempt.playCapability = false;
  if (attempt.status === 'Armed') {
    attempt.status = 'Incomplete'; attempt.endedReason = reason; attempt.reportSnapshot = null;
  }
}
export function decisionResult(form, index, signedGiveCents) {
  const round = form.rounds[index];
  const min = index === 0 ? 0 : -500;
  if (!Number.isInteger(signedGiveCents) || signedGiveCents % 50 || signedGiveCents < min || signedGiveCents > 500) throw new Error('invalid cents');
  if (round.bonusRecipient === 'partner' && signedGiveCents !== round.partnerSignedGiveCents) throw new Error('not the fixed partner action');
  const recipientFinal = 1000 - signedGiveCents, otherFinal = 500 + signedGiveCents;
  return { signedGiveCents, actor:round.bonusRecipient,
    candidateFinalCents:round.bonusRecipient === 'candidate' ? recipientFinal : otherFinal,
    partnerFinalCents:round.bonusRecipient === 'partner' ? recipientFinal : otherFinal };
}
export function receiptIdentity(attempt, index) {
  const round = attempt.rounds[index];
  return hash({ generation:attempt.generation, attemptId:attempt.id, formDigest:attempt.formDigest,
    roundId:round.id, partner:round.partner, bonusRecipient:round.bonusRecipient, decision:round.decision });
}
function validRound(attempt, index, terminalRequired) {
  const form = forms.find(value => value.id === attempt.formId), round = attempt.rounds[index];
  if (!form || attempt.rounds.length !== 2 || attempt.formDigest !== hash(form) || !round?.armed || round.id !== `${attempt.id}/R${index + 1}` ||
    round.partner !== form.rounds[index].partner || round.bonusRecipient !== form.rounds[index].bonusRecipient || !round.decision) return false;
  let expected;
  try { expected = decisionResult(form, index, round.decision.signedGiveCents); } catch { return false; }
  if (JSON.stringify(round.decision) !== JSON.stringify(expected) || round.exposure !== 'render_receipt' || round.receiptIdentity !== receiptIdentity(attempt,index)) return false;
  return terminalRequired ? round.terminal && Number.isInteger(round.fairness) && round.fairness >= 0 && round.fairness <= 10 : !round.terminal && round.fairness === null;
}
function reportFor(attempt) {
  return attempt.rounds.map((round,index) => ({ generation:attempt.generation, attemptId:attempt.id,
    formId:attempt.formId, formDigest:attempt.formDigest, round:index+1, partner:round.partner,
    bonusRecipient:round.bonusRecipient, candidateStartCents:500, partnerStartCents:500,
    ...round.decision, fairness:round.fairness }));
}
export function validCompleted(attempt) {
  return Boolean(attempt?.status === 'Completed' && !attempt.playCapability && attempt.rounds.length === 2 &&
    validRound(attempt,0,true) && validRound(attempt,1,true) && JSON.stringify(attempt.reportSnapshot) === JSON.stringify(reportFor(attempt)));
}
export function transition(previous, command) {
  const root = clone(previous);
  if (!command.requestId || command.installationId !== root.installationId) return reject(root,'identity-changed');
  const prior = root.outcomes[command.requestId];
  if (prior) return prior.payloadHash === hash(command)
    ? { root, outcome:{ accepted:true, ...clone(prior.result), replay:true } } : reject(root,'request-conflict');
  if (command.generation !== root.generation) return reject(root,'identity-changed');
  // Deletion is a separate current-generation data authority, independent of play ownership.
  if (command.kind === 'deleteAll') {
    const next = initialRoot(null); next.generation = root.generation+1; next.revision = root.revision;
    next.lease = { ownerId:null, epoch:root.lease.epoch+1, live:false };
    next.route.epoch = root.route.epoch+1;
    return save(next,command,{ generation:next.generation });
  }
  if (command.kind === 'deleteAttempt') {
    const attempt = root.attempts[command.attemptId];
    if (!attempt) return reject(root,'attempt-missing');
    delete root.attempts[command.attemptId]; root.tombstones[command.attemptId] = true;
    root.exposureHistory = root.exposureHistory.filter(item => item.attemptId !== command.attemptId);
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
    if (root.activeAttemptId) retire(root.attempts[root.activeAttemptId],'owner-lost');
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
    const attempt = { id, generation:root.generation, ownerId:command.ownerId, leaseEpoch:command.leaseEpoch,
      originTicketId:ticket.id, formId:form.id, formDigest:hash(form), status:'Armed', playCapability:true,
      stage:'award_1', rounds:form.rounds.map((round,index) => ({ id:`${id}/R${index+1}`, partner:round.partner,
        bonusRecipient:round.bonusRecipient, armed:index===0, decision:null, exposure:'unshown', receiptIdentity:null, fairness:null, terminal:false })), reportSnapshot:null };
    root.attempts[id]=attempt; root.activeAttemptId=id; ticket.state='consumed'; ticket.attemptId=id;
    root.exposureHistory.push({ attemptId:id, formId:form.id, formDigest:attempt.formDigest });
    route(root,'active'); // Arm and active ownership are ONE transaction. There is no seal operation.
    return save(root,command,{ ticketId:ticket.id, attemptId:id, stage:'award_1' });
  }
  if (command.kind === 'exit') {
    if (!['Close','Restart'].includes(command.destination)) return reject(root,'destination-invalid');
    let ticketId=command.ticketId;
    if (command.afterRestartRequestId) {
      if (command.destination !== 'Close') return reject(root,'restart-chain-mismatch');
      const restart=root.outcomes[command.afterRestartRequestId];
      if (restart) {
        const old=restart.command;
        if (old.kind!=='exit' || old.destination!=='Restart' || old.ticketId!==command.ticketId ||
          old.ownerId!==command.ownerId || old.leaseEpoch!==command.leaseEpoch || old.generation!==command.generation) return reject(root,'restart-chain-mismatch');
        ticketId=restart.result.successorTicketId;
      }
    }
    if (command.afterReadyRequestId) {
      if (command.destination !== 'Close' || command.afterRestartRequestId) return reject(root,'ready-chain-mismatch');
      const opening=root.outcomes[command.afterReadyRequestId];
      if (opening) {
        const old=opening.command;
        if (!['ready','tryAgain'].includes(old.kind) || old.ticketId!==command.ticketId || old.routeEpoch!==command.routeEpoch ||
          old.ownerId!==command.ownerId || old.leaseEpoch!==command.leaseEpoch || old.generation!==command.generation) return reject(root,'ready-chain-mismatch');
        ticketId=opening.result.ticketId;
      }
    }
    let attemptId=null;
    if (ticketId) {
      const ticket=currentTicket(root,ticketId);
      if (!ticket || ticket.state==='canceled') return reject(root,'ticket-changed');
      if (ticket.state==='open') ticket.state='canceled';
      else {
        const attempt=root.attempts[ticket.attemptId];
        if (!attempt || root.tombstones[ticket.attemptId] || attempt.originTicketId!==ticketId ||
          attempt.ownerId!==command.ownerId || attempt.leaseEpoch!==command.leaseEpoch ||
          !['Armed','Completed'].includes(attempt.status)) return reject(root,'attempt-changed');
        if (attempt.status==='Completed' && !validCompleted(attempt)) return reject(root,'completed-invalid');
        attemptId=attempt.id; retire(attempt,'candidate-exit');
      }
    } else if (command.destination!=='Close' || root.route.stage!=='instructions' || root.route.epoch!==command.routeEpoch) return reject(root,'route-changed');
    root.activeAttemptId=null; root.currentTicketId=null;
    root.navigation={ destination:command.destination, requestId:command.requestId };
    let successorTicketId=null;
    if (command.destination==='Restart') successorTicketId=openTicket(root); else route(root,'library');
    return save(root,command,{ destination:command.destination, attemptId, successorTicketId });
  }
  const ticket=currentTicket(root,command.ticketId), attempt=ticket && root.attempts[ticket.attemptId];
  if (!attempt || root.tombstones[attempt.id]) return reject(root,'attempt-changed');
  if (command.kind==='report' || command.kind==='tryAgain') {
    if (!validCompleted(attempt)) return reject(root,'completed-invalid');
    if (command.kind==='report') { route(root,'report'); return save(root,command,{ stage:'report_1',attemptId:attempt.id }); }
    if (root.route.stage!=='report' || command.routeEpoch!==root.route.epoch) return reject(root,'route-changed');
    return save(root,command,{ stage:'ready',ticketId:openTicket(root) });
  }
  if (attempt.status!=='Armed' || !attempt.playCapability || root.activeAttemptId!==attempt.id || command.stage!==attempt.stage) return reject(root,'stage-changed');
  if (command.kind==='terminal') {
    if (attempt.stage!=='fairness_2' || !validRound(attempt,0,true) || !validRound(attempt,1,false) ||
      !Number.isInteger(command.rating) || command.rating<0 || command.rating>10) return reject(root,'terminal-invalid');
    attempt.rounds[1].fairness=command.rating; attempt.rounds[1].terminal=true;
    attempt.status='Completed'; attempt.playCapability=false; attempt.stage='test_complete'; attempt.reportSnapshot=reportFor(attempt);
    root.activeAttemptId=null; route(root,'test_complete');
    return save(root,command,{ stage:'test_complete',attemptId:attempt.id });
  }
  return reject(root,'unknown-operation');
}
export function currentAuthority(root, ownerId, leaseEpoch, generation) {
  return root.generation===generation && root.lease.live && root.lease.ownerId===ownerId && root.lease.epoch===leaseEpoch;
}
