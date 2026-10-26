import assert from 'node:assert/strict';
import { initialRoot, transition, receiptIdentity, validCompleted } from './money-exchange-2-authority-model.mjs';
import { ownerController } from './money-exchange-2-owner-controller.mjs';
const copy = value => structuredClone(value);
const expected = (extra={}) => ({ generation:1,counter:0,attempts:[],openTickets:0,route:'library',view:'library',exposure:0,owner:'owner-1',leaseLive:true,...extra });
const armed = ['Armed',true,0,null];
const incomplete = ['Incomplete',false,0,null];
const completed = ['Completed',false,2,8];
function summary(h) {
  return { generation:h.root.generation,counter:h.root.formCounter,
    attempts:Object.values(h.root.attempts).map(a=>[a.status,a.playCapability,a.reportSnapshot?.length??0,a.rounds[1].fairness]),
    openTickets:Object.values(h.root.tickets).filter(t=>t.state==='open').length,
    route:h.root.route.stage,view:h.controller.state().stage,exposure:h.root.exposureHistory.length,
    owner:h.root.lease.ownerId,leaseLive:h.root.lease.live };
}
function harness() {
  const h={ root:initialRoot() }; h.controller=ownerController(h.root);
  h.admit=(action,data={})=>h.controller.admit(h.controller.token(),action,data);
  h.commit=command=>{ assert.ok(command,'command must have been admitted'); const r=transition(h.root,command); h.root=r.root; return r.outcome; };
  h.deliver=command=>h.controller.deliver(command.requestId,h.root,h.root);
  h.finish=action=>{ const c=h.admit(action); assert.equal(h.commit(c).accepted,true); assert.equal(h.deliver(c),true); return c; };
  h.finish('enter'); h.finish('ready');
  return h;
}
let maintenanceSerial=0;
function maintenance(h,kind,extra={}) {
  return { kind,requestId:`maintenance-${++maintenanceSerial}`,installationId:h.root.installationId,generation:h.root.generation,
    ownerId:h.root.lease.ownerId,leaseEpoch:h.root.lease.epoch,...extra };
}
function readyExit(destination,armFirst) {
  const h=harness(), token=h.controller.token(), arm=h.admit('arm'), exit=h.admit(destination);
  assert.equal(h.controller.admit(token,'Close'),null,'old view cannot admit another action');
  assert.equal(h.controller.state().stage,'checking');
  if (armFirst) { assert.equal(h.commit(arm).accepted,true); assert.equal(h.commit(exit).accepted,true); }
  else { assert.equal(h.commit(exit).accepted,true); assert.equal(h.commit(arm).accepted,false); }
  assert.equal(h.deliver(arm),false,'late arm callback cannot paint after exit admission');
  assert.equal(h.deliver(exit),true);
  return h;
}
function terminalPrefix() {
  const h=harness(); h.finish('arm');
  const a=h.root.attempts[h.root.activeAttemptId];
  // Fixed reachable prefix for the filmed form; preceding screen progression and
  // actual browser receipt proof remain separate implementation obligations.
  a.stage='fairness_2';
  a.rounds.forEach((r,i)=>{
    r.armed=true;
    r.decision={ signedGiveCents:200,actor:'candidate',candidateFinalCents:800,partnerFinalCents:700 };
    r.exposure='render_receipt';r.receiptIdentity=receiptIdentity(a,i);
    r.fairness=i===0?8:null;r.terminal=i===0;
  });
  h.root.revision+=20;
  h.controller=ownerController(h.root,{liveFixture:true});
  return h;
}
const cases=[];
function add(id,description,oracle,run) { cases.push({id,description,expected:oracle,run}); }
for (const destination of ['Close','Restart']) for (const armFirst of [false,true]) {
  add(`exit-${destination}-${armFirst?'arm-first':'exit-first'}`,'Admit arm and exit; deliver callbacks after both root orders',expected({
    counter:armFirst?1:0,attempts:armFirst?[incomplete]:[],exposure:armFirst?1:0,
    openTickets:destination==='Restart'?1:0,route:destination==='Restart'?'ready':'library',view:destination==='Restart'?'ready':'library',
  }),()=>readyExit(destination,armFirst));
}
add('arm-committed-close-admitted-before-delivery','The old seal gap is removed: arm already owns active route; delayed Close still retires that attempt',expected({counter:1,attempts:[incomplete],exposure:1}),()=>{
  const h=harness(), arm=h.admit('arm'); h.commit(arm);
  const close=h.admit('Close'); assert.equal(h.deliver(arm),false); h.commit(close); h.deliver(close); return h;
});
add('stale-ready-callback-after-award','Publishing award changes opaque token; old Ready callback cannot admit exit',expected({counter:1,attempts:[armed],exposure:1,route:'active',view:'award_1'}),()=>{
  const h=harness(), old=h.controller.token(); h.finish('arm');
  const before=copy(h.root), count=h.controller.state().requests;
  assert.equal(h.controller.admit(old,'Close'),null); assert.equal(h.controller.state().requests,count); assert.deepEqual(h.root,before); return h;
});
for (const restartFirst of [false,true]) add(`restart-close-${restartFirst?'restart-first':'close-first'}`,'Close overrides a pending Restart with its callback lost',expected(),()=>{
  const h=harness(), restart=h.admit('Restart'), close=h.admit('Close');
  if (restartFirst) { h.commit(restart); assert.equal(h.controller.refresh(h.root),true); h.commit(close); }
  else { h.commit(close); assert.equal(h.commit(restart).accepted,false); }
  assert.equal(h.deliver(restart),false); assert.equal(h.deliver(close),true); return h;
});
add('wrong-restart-chain','Root rejects mismatched original ticket even when successor is current',expected({openTickets:1,route:'ready',view:'checking'}),()=>{
  const h=harness(), restart=h.admit('Restart');h.commit(restart);
  const wrong=maintenance(h,'exit',{ticketId:'unrelated',destination:'Close',afterRestartRequestId:restart.requestId});
  const before=copy(h.root);assert.equal(h.commit(wrong).reason,'restart-chain-mismatch');assert.deepEqual(h.root,before);return h;
});
add('stale-T1-versus-T2','Historical replay and newly forged old-lineage exit cannot touch T2',expected({counter:1,attempts:[armed],exposure:1,route:'active',view:'award_1'}),()=>{
  const h=harness(), restart=h.finish('Restart'),oldTicket=restart.ticketId;h.finish('arm');
  const before=copy(h.root);assert.equal(h.commit(restart).replay,true);assert.deepEqual(h.root,before);
  assert.equal(h.deliver(restart),false);
  assert.equal(h.commit(maintenance(h,'exit',{ticketId:oldTicket,destination:'Close'})).accepted,false);assert.deepEqual(h.root,before);return h;
});
add('cross-owner-route','Owner 2 cannot use owner 1 current Instructions epoch to open Ready',expected({route:'instructions',view:'instructions'}),()=>{
  const h={root:initialRoot()};h.controller=ownerController(h.root);
  const enter=h.controller.admit(h.controller.token(),'enter');h.root=transition(h.root,enter).root;h.controller.deliver(enter.requestId,h.root,h.root);
  const before=copy(h.root),forged=maintenance(h,'ready',{ownerId:'owner-2',routeEpoch:h.root.route.epoch});
  assert.equal(transition(h.root,forged).outcome.reason,'owner-changed');assert.deepEqual(h.root,before);return h;
});
for (const armFirst of [false,true]) add(`owner-loss-${armFirst?'after-arm':'before-arm'}`,'Explicit lease loss and new claim fence old requests',expected({owner:'owner-2',counter:armFirst?1:0,attempts:armFirst?[incomplete]:[],exposure:armFirst?1:0}),()=>{
  const h=harness(),arm=h.admit('arm');if(armFirst)h.commit(arm);
  h.commit(maintenance(h,'loseLease'));h.commit(maintenance(h,'claimLease',{ownerId:'owner-2'}));
  if(!armFirst)assert.equal(h.commit(arm).reason,'owner-changed');
  assert.equal(h.deliver(arm),false);h.controller.refresh(h.root);return h;
});
add('duplicate-and-conflicting-requests','Double activation creates no second request; retry is identical; conflicting bytes reject',expected({counter:1,attempts:[armed],exposure:1,route:'active',view:'award_1'}),()=>{
  const h=harness(),arm=h.admit('arm');assert.equal(h.admit('arm'),null);h.commit(arm);
  const before=copy(h.root);assert.equal(h.commit(h.controller.retry(arm.requestId)).replay,true);assert.deepEqual(h.root,before);
  assert.equal(h.commit({...arm,ticketId:'wrong'}).reason,'request-conflict');assert.deepEqual(h.root,before);h.deliver(arm);return h;
});
for (const armFirst of [false,true]) add(`delete-${armFirst?'after-arm':'before-arm'}`,'Generation replacement fences held write, exit and publication',expected({generation:2,owner:null,leaseLive:false}),()=>{
  const h=harness(),arm=h.admit('arm'),close=h.admit('Close');if(armFirst)h.commit(arm);
  h.commit(maintenance(h,'deleteAll'));if(!armFirst)assert.equal(h.commit(arm).reason,'identity-changed');
  assert.equal(h.commit(close).reason,'identity-changed');assert.equal(h.deliver(arm),false);assert.equal(h.deliver(close),false);h.controller.refresh(h.root);return h;
});
for (const destination of ['Close','Restart']) for(const terminalFirst of [false,true]) add(`terminal-${destination}-${terminalFirst?'terminal-first':'exit-first'}`,'Terminal derives report from committed rounds; exit preserves committed completion',expected({
  counter:1,attempts:[terminalFirst?completed:incomplete],exposure:1,openTickets:destination==='Restart'?1:0,
  route:destination==='Restart'?'ready':'library',view:destination==='Restart'?'ready':'library',
}),()=>{
  const h=terminalPrefix(),a=h.root.attempts[h.root.activeAttemptId],round1=copy(a.rounds[0]);
  const terminal=h.admit('terminal',{rating:8}),exit=h.admit(destination);
  if(terminalFirst){assert.equal(h.commit(terminal).accepted,true);const report=copy(h.root.attempts[a.id].reportSnapshot);h.commit(exit);assert.deepEqual(h.root.attempts[a.id].reportSnapshot,report);}
  else {h.commit(exit);assert.equal(h.commit(terminal).accepted,false);}
  assert.deepEqual(h.root.attempts[a.id].rounds[0],round1);assert.equal(h.deliver(terminal),false);h.deliver(exit);
  if(terminalFirst)assert.deepEqual(h.root.attempts[a.id].reportSnapshot.map(p=>[p.candidateFinalCents,p.partnerFinalCents,p.fairness]),[[800,700,8],[800,700,8]]);
  return h;
});
add('fake-terminal-after-arm','Caller-supplied report cannot manufacture completion',expected({counter:1,attempts:[armed],exposure:1,route:'active',view:'award_1'}),()=>{
  const h=harness();h.finish('arm');const a=h.root.attempts[h.root.activeAttemptId],before=copy(h.root);
  assert.equal(h.commit(maintenance(h,'terminal',{ticketId:a.originTicketId,stage:'award_1',rating:8,reportPages:[{},{}]})).reason,'terminal-invalid');assert.deepEqual(h.root,before);return h;
});
add('held-readback-and-reload','Committed arm plus locally pending Close does not publish; reload requires recovery',expected({counter:1,attempts:[armed],exposure:1,route:'active',view:'recovery'}),()=>{
  const h=harness(),arm=h.admit('arm');h.commit(arm);h.admit('Close');assert.equal(h.deliver(arm),false);
  h.controller=ownerController(h.root);assert.equal(h.admit('arm'),null);return h;
});
add('late-open-and-fresh-launch','Old Instructions request cannot reopen after Close; fresh library action can',expected({openTickets:1,route:'ready',view:'ready'}),()=>{
  const h=harness(),oldEpoch=2;h.finish('Close');
  const before=copy(h.root);assert.equal(h.commit(maintenance(h,'ready',{routeEpoch:oldEpoch})).reason,'route-changed');assert.deepEqual(h.root,before);
  h.finish('enter');h.finish('ready');return h;
});
add('report-try-again-old-deletion','Try Again remains unarmed; deleting old report does not remove new attempt',expected({counter:2,attempts:[armed],exposure:1,route:'active',view:'award_1'}),()=>{
  const h=terminalPrefix();const old=h.root.activeAttemptId;const terminal=h.admit('terminal',{rating:8});h.commit(terminal);h.deliver(terminal);
  h.finish('report');h.finish('tryAgain');assert.equal(h.root.formCounter,1);assert.equal(Object.keys(h.root.attempts).length,1);
  h.finish('arm');h.commit(maintenance(h,'deleteAttempt',{attemptId:old}));assert.equal(h.controller.refresh(h.root),true);return h;
});
add('stale-readback-after-deletion','A read from before deletion cannot publish even with its old callback',expected({generation:2,owner:null,leaseLive:false}),()=>{
  const h=harness(),arm=h.admit('arm');h.commit(arm);const snapshot=copy(h.root);h.commit(maintenance(h,'deleteAll'));
  assert.equal(h.controller.deliver(arm.requestId,snapshot,h.root),false);h.controller.refresh(h.root);return h;
});
for(const openingFirst of [false,true]) add(`instructions-close-${openingFirst?'ready-first':'close-first'}`,'Close binds an admitted Ready-opening request even when its callback is lost',expected(),()=>{
  const h={root:initialRoot()};h.controller=ownerController(h.root);
  h.admit=(action)=>h.controller.admit(h.controller.token(),action);
  h.commit=command=>{const result=transition(h.root,command);h.root=result.root;return result.outcome;};
  h.deliver=command=>h.controller.deliver(command.requestId,h.root,h.root);
  const enter=h.admit('enter');h.commit(enter);h.deliver(enter);
  const opening=h.admit('ready'),close=h.admit('Close');
  if(openingFirst){h.commit(opening);h.controller.refresh(h.root);h.commit(close);}else{h.commit(close);assert.equal(h.commit(opening).accepted,false);}
  assert.equal(h.deliver(opening),false);assert.equal(h.deliver(close),true);return h;
});
for(const openingFirst of [false,true]) add(`try-again-close-${openingFirst?'ready-first':'close-first'}`,'Pending Try Again cannot lose a later Close or erase the old report',expected({counter:1,attempts:[completed],exposure:1}),()=>{
  const h=terminalPrefix(),terminal=h.admit('terminal',{rating:8});h.commit(terminal);h.deliver(terminal);h.finish('report');
  const oldReport=copy(Object.values(h.root.attempts)[0].reportSnapshot),opening=h.admit('tryAgain'),close=h.admit('Close');
  if(openingFirst){h.commit(opening);h.controller.refresh(h.root);h.commit(close);}else{h.commit(close);assert.equal(h.commit(opening).accepted,false);}
  assert.equal(h.deliver(opening),false);assert.equal(h.deliver(close),true);assert.deepEqual(Object.values(h.root.attempts)[0].reportSnapshot,oldReport);return h;
});
for (const openingKind of ['Restart','tryAgain']) for (const closeAfter of [false,true]) {
  add(`pending-${openingKind}-old-delete${closeAfter?'-close':''}`,'Old attempt deletion preserves exact pending successor across unrelated root revisions',expected({counter:1,openTickets:closeAfter?0:1,route:closeAfter?'library':'ready',view:closeAfter?'library':'ready'}),()=>{
    const h=openingKind==='Restart'?harness():terminalPrefix();
    if(openingKind==='Restart') h.finish('arm');
    else {const t=h.admit('terminal',{rating:8});h.commit(t);h.deliver(t);h.finish('report');}
    const old=Object.keys(h.root.attempts)[0],opening=h.admit(openingKind);
    assert.equal(h.commit(opening).accepted,true);
    const snapshot=copy(h.root);
    h.commit(maintenance(h,'deleteAttempt',{attemptId:old}));
    assert.equal(h.controller.refresh(h.root),true);
    assert.equal(h.controller.deliver(opening.requestId,snapshot,h.root),false,'old revision cannot publish');
    if(closeAfter){
      const close=h.admit('Close');assert.equal(h.commit(close).accepted,true);
      assert.equal(h.deliver(opening),false);assert.equal(h.deliver(close),true);
    }else assert.equal(h.deliver(opening),true,'current readback reconciles preserved successor');
    return h;
  });
}
add('pending-arm-current-delete','Deleting the actual successor denies held publication despite a recorded outcome',expected({counter:1}),()=>{
  const h=harness(),arm=h.admit('arm');h.commit(arm);
  h.commit(maintenance(h,'deleteAttempt',{attemptId:h.root.activeAttemptId}));
  assert.equal(h.controller.refresh(h.root),false);assert.equal(h.deliver(arm),false);return h;
});
add('pending-restart-successor-replaced','A committed old Restart cannot survive a genuine later route transition',expected({counter:1,attempts:[incomplete],exposure:1}),()=>{
  const h=harness();h.finish('arm');const restart=h.admit('Restart');h.commit(restart);
  const successor=h.root.currentTicketId;
  h.commit(maintenance(h,'exit',{ticketId:successor,destination:'Close'}));
  assert.equal(h.controller.refresh(h.root),false);assert.equal(h.deliver(restart),false);return h;
});
export function authorityMatrix() { return cases.map(({id,description,expected})=>({id,description,expected})); }
export function checkAuthorityMatrix() {
  for(const item of cases){
    const h=item.run();assert.deepEqual(summary(h),item.expected,item.id);
    for(const a of Object.values(h.root.attempts)){
      if(a.status==='Completed')assert.equal(validCompleted(a),true,item.id);
      if(a.status!=='Armed')assert.equal(a.playCapability,false,item.id);
      if(a.status==='Incomplete')assert.equal(a.reportSnapshot,null,item.id);
    }
  }
  return cases.length;
}
