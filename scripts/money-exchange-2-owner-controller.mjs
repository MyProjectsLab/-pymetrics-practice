// Reference for admission and publication. Browser handlers close over an opaque
// token; delayed callbacks only call deliver/retry, never admit a fresh action.
import { currentAuthority } from './money-exchange-2-authority-model.mjs';
import { randomUUID } from 'node:crypto';
const copy = value => structuredClone(value);
export function ownerController(initial, { liveFixture = false, documentId = randomUUID() } = {}) {
  let known = copy(initial), epoch = 1, token = Object.freeze({}), serial = 0;
  const ownerId = initial.lease.ownerId, leaseEpoch = initial.lease.epoch, generation = initial.generation;
  const installationId = initial.installationId;
  let stage = initial.route.stage, ticketId = initial.currentTicketId;
  let attemptId = ticketId ? initial.tickets[ticketId]?.attemptId : null;
  if (attemptId && initial.attempts[attemptId]?.status === 'Armed') {
    if (!liveFixture) stage = 'recovery';
    else stage = initial.attempts[attemptId].stage;
  }
  let busy = null, pendingExit = null;
  const pending = new Map();
  function rotate() { epoch += 1; token = Object.freeze({}); }
  function base(kind) { return { kind, requestId:`${ownerId}/${leaseEpoch}/${documentId}/${++serial}`, installationId,generation,ownerId,leaseEpoch }; }
  function admission(viewToken, action, data = {}) {
    if (viewToken !== token || stage === 'recovery') return null;
    const isExit = action === 'Close' || action === 'Restart';
    let command;
    if (isExit) {
      if (stage === 'library' || (pendingExit && !(pendingExit.destination === 'Restart' && action === 'Close'))) return null;
      if (action === 'Restart' && ['instructions','test_complete','report_1','report_2','report','tips'].includes(stage)) return null;
      const previousExit = pendingExit;
      command = { ...base('exit'), ticketId, routeEpoch:known.route.epoch, destination:action };
      if (previousExit) command.afterRestartRequestId = previousExit.requestId;
      else if (busy && ['ready','tryAgain'].includes(pending.get(busy)?.command.kind)) command.afterReadyRequestId=busy;
      // This synchronous fence happens BEFORE dispatch or waiting for a write.
      rotate(); stage='checking'; pendingExit=command; busy=command.requestId;
    } else {
      if (busy || pendingExit) return null;
      const allowed = { enter:['library'], ready:['instructions'], arm:['ready'], terminal:['fairness_2'], report:['test_complete'], tryAgain:['report_1','report_2','report'] };
      if (!allowed[action]?.includes(stage)) return null;
      command = { ...base(action), routeEpoch:known.route.epoch, ticketId };
      if (action === 'terminal') { command.stage='fairness_2'; command.rating=data.rating; }
      busy=command.requestId;
    }
    const immutable = Object.freeze(copy(command));
    pending.set(command.requestId,{ command:immutable, epoch });
    return immutable;
  }
  function currentOutcome(requestId, liveRoot) {
    const entry=pending.get(requestId), record=liveRoot.outcomes[requestId];
    // Unrelated history writes may advance revision. Only the exact command's
    // still-current route identity can preserve its pending reconciliation.
    return Boolean(entry && record && JSON.stringify(record.command)===JSON.stringify(entry.command) &&
      record.command.generation===generation && record.command.ownerId===ownerId && record.command.leaseEpoch===leaseEpoch &&
      record.route?.epoch===liveRoot.route.epoch && record.route.stage===liveRoot.route.stage && record.route.ownerId===ownerId);
  }
  function deliver(requestId, snapshot, liveRoot) {
    const entry=pending.get(requestId);
    // This callback is executed under the publication/deletion ordering boundary.
    if (!entry || !snapshot || !liveRoot || snapshot.installationId!==liveRoot.installationId ||
      snapshot.generation!==liveRoot.generation || snapshot.revision!==liveRoot.revision ||
      !currentAuthority(liveRoot,ownerId,leaseEpoch,generation)) return false;
    const record=liveRoot.outcomes[requestId];
    if (!currentOutcome(requestId,liveRoot) || entry.epoch!==epoch) return false;
    const command=entry.command;
    if (pendingExit && command.requestId!==pendingExit.requestId) return false;
    const result=record.result;
    if (command.kind==='exit') {
      if (liveRoot.navigation?.requestId!==requestId) return false;
      if (result.destination==='Restart' && (liveRoot.currentTicketId!==result.successorTicketId || liveRoot.tickets[result.successorTicketId]?.state!=='open')) return false;
      if (result.destination==='Close' && liveRoot.route.stage!=='library') return false;
      stage=result.destination==='Close' ? 'library' : 'ready';
      ticketId=result.successorTicketId; attemptId=null; pendingExit=null;
    } else if (command.kind==='arm') {
      const attempt=liveRoot.attempts[result.attemptId];
      if (liveRoot.currentTicketId!==command.ticketId || liveRoot.activeAttemptId!==result.attemptId ||
        attempt?.status!=='Armed' || !attempt.playCapability || attempt.stage!=='award_1' || liveRoot.route.stage!=='active') return false;
      stage='award_1'; attemptId=result.attemptId;
    } else {
      const expected = { enter:'instructions', ready:'ready', terminal:'test_complete', report:'report', tryAgain:'ready' }[command.kind];
      if (liveRoot.route.stage!==expected) return false;
      if (result.ticketId && liveRoot.currentTicketId!==result.ticketId) return false;
      stage=command.kind==='report' ? 'report_1' : expected;
      ticketId=liveRoot.currentTicketId;
      attemptId=ticketId ? liveRoot.tickets[ticketId]?.attemptId : null;
    }
    known=copy(liveRoot); busy=null; rotate();
    return true;
  }
  function refresh(liveRoot) {
    const missing=ticketId && (liveRoot.currentTicketId!==ticketId || !liveRoot.tickets[ticketId] || (attemptId && !liveRoot.attempts[attemptId]));
    const ownPendingTransition = busy && currentOutcome(busy,liveRoot);
    const ownPendingRestart = pendingExit?.afterRestartRequestId && currentOutcome(pendingExit.afterRestartRequestId,liveRoot) && liveRoot.navigation?.requestId === pendingExit.afterRestartRequestId;
    const ownPendingOpening = pendingExit?.afterReadyRequestId && currentOutcome(pendingExit.afterReadyRequestId,liveRoot) && liveRoot.outcomes[pendingExit.afterReadyRequestId]?.result.ticketId === liveRoot.currentTicketId;
    if (!currentAuthority(liveRoot,ownerId,leaseEpoch,generation) || (missing && !ownPendingTransition && !ownPendingRestart && !ownPendingOpening)) {
      rotate(); stage='library'; ticketId=null; attemptId=null; busy=null; pendingExit=null;
      return false;
    }
    return true;
  }
  return Object.freeze({
    token:() => token,
    admit:admission,
    deliver,
    refresh,
    retry:requestId => pending.get(requestId)?.command ?? null,
    state:() => ({ stage,epoch,ticketId,attemptId,busy,pendingExit:pendingExit?.destination ?? null,requests:pending.size }),
  });
}
