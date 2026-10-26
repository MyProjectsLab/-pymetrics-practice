import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { authorityMatrix } from './money-exchange-2-authority-matrix.mjs';
import { forms } from './money-exchange-2-forms-v1.mjs';

// Original fixed practice schedules. These are not provider probabilities or outcomes.
const policies = [
  { id: 'zero-take-max', candidateRound1GiveCents: 0, candidateRound2SignedGiveCents: -500, fairness: [0, 10] },
  { id: 'filmed-give-two', candidateRound1GiveCents: 200, candidateRound2SignedGiveCents: 200, fairness: [8, 8] },
  { id: 'give-max', candidateRound1GiveCents: 500, candidateRound2SignedGiveCents: 500, fairness: [10, 0] },
  { id: 'both-zero', candidateRound1GiveCents: 0, candidateRound2SignedGiveCents: 0, fairness: [0, 0] },
  { id: 'give-max-take-one-fifty', candidateRound1GiveCents: 500, candidateRound2SignedGiveCents: -150, fairness: [2, 6] },
  { id: 'give-two-zero', candidateRound1GiveCents: 200, candidateRound2SignedGiveCents: 0, fairness: [8, 1] },
  { id: 'half-dollar-low', candidateRound1GiveCents: 50, candidateRound2SignedGiveCents: 50, fairness: [1, 9] },
  { id: 'half-dollar-high', candidateRound1GiveCents: 450, candidateRound2SignedGiveCents: -50, fairness: [9, 1] },
];

function sha(payload) { return createHash('sha256').update(JSON.stringify(payload)).digest('hex'); }
function outcome(round, roundIndex, policy) {
  const signedGiveCents = round.bonusRecipient === 'partner'
    ? round.partnerSignedGiveCents
    : roundIndex === 0 ? policy.candidateRound1GiveCents : policy.candidateRound2SignedGiveCents;
  if (!Number.isInteger(signedGiveCents) || signedGiveCents % 50 !== 0 || signedGiveCents > 500 || signedGiveCents < (roundIndex === 0 ? 0 : -500)) throw new Error('invalid form or policy');
  const receiverFinalCents = 1000 - signedGiveCents;
  const otherFinalCents = 500 + signedGiveCents;
  const candidateFinalCents = round.bonusRecipient === 'candidate' ? receiverFinalCents : otherFinalCents;
  const partnerFinalCents = round.bonusRecipient === 'partner' ? receiverFinalCents : otherFinalCents;
  if (candidateFinalCents + partnerFinalCents !== 1500 || candidateFinalCents < 0 || partnerFinalCents < 0) throw new Error('nonconserving round');
  return { round: roundIndex + 1, partner: round.partner, bonusRecipient: round.bonusRecipient, actor: round.bonusRecipient,
    signedGiveCents, candidateStartCents: 500, partnerStartCents: 500, bonusCents: 500,
    candidateFinalCents, partnerFinalCents, fairness: policy.fairness[roundIndex] };
}

const manifest = { version: 'money_exchange_2_forms_v1_0', generator: 'money_exchange_2_generator_v1_0', forms };
manifest.payloadSha256 = sha(manifest);
const arithmeticCases = forms.flatMap(form => policies.map(policy => ({ formId: form.id, policyId: policy.id,
  rounds: form.rounds.map((round, index) => outcome(round, index, policy)) })));
const screenGraph = [
  ['instructions','Next','ready','none'],
  ['ready','Next','award_1','arm-confirmed'],
  ['award_1','Next','connecting_1','same-owner'],
  ['connecting_1','local-complete','connected_1','same-view-owner'],
  ['connected_1','Next','partner_rules_1','same-owner'],
  ['partner_rules_1','Next','bonus_1','same-owner'],
  ['bonus_1','Next','choice_1|partner_choice_1','form-recipient'],
  ['choice_1','Confirm','result_1','decision-and-possible-exposure-confirmed'],
  ['partner_choice_1','Next','result_1','fixed-decision-and-possible-exposure-confirmed'],
  ['result_1','Next','fairness_1','exact-render-receipt-confirmed'],
  ['fairness_1','Next','new_partner','rating-and-round1-terminal-confirmed'],
  ['new_partner','Next','award_2','round2-arm-confirmed'],
  ['award_2','Next','connecting_2','same-owner'],
  ['connecting_2','local-complete','connected_2','same-view-owner'],
  ['connected_2','Next','partner_rules_2','same-owner'],
  ['partner_rules_2','Next','bonus_2','same-owner'],
  ['bonus_2','Next','choice_2|partner_choice_2','form-recipient'],
  ['choice_2','Confirm','result_2','decision-and-possible-exposure-confirmed'],
  ['partner_choice_2','Next','result_2','fixed-decision-and-possible-exposure-confirmed'],
  ['result_2','Next','fairness_2','exact-render-receipt-confirmed'],
  ['fairness_2','Next','test_complete','rating-round2-terminal-completed-report-confirmed'],
  ['test_complete','Next','report_1','current-saved-report'],
  ['report_1','arrow-or-dot','report_2','current-root-view-epoch'],
  ['report_2','arrow-or-dot','report_1','current-root-view-epoch'],
  ['report_1|report_2','Tips','tips','current-root-view-epoch'],
  ['tips','Back Report','report_1|report_2','same-report-and-page-epoch'],
  ['report_1|report_2','Try Again','ready','old-settled-new-prearm'],
].map(([from, action, to, guard]) => ({ from, action, to, guard }));
const activeStages = ['ready','award_1','connecting_1','connected_1','partner_rules_1','bonus_1','choice_1','partner_choice_1','result_1','fairness_1','new_partner','award_2','connecting_2','connected_2','partner_rules_2','bonus_2','choice_2','partner_choice_2','result_2','fairness_2'];
const globalControlRules = [
  { from:['ready'], when:'no arm request admitted', action:'Restart', to:'fresh Ready', expectedDurable:{ attemptCountDelta:0, journalUnchanged:true }, expectedView:'fresh Ready' },
  { from:activeStages.filter(stage => stage !== 'ready' && stage !== 'fairness_2'), action:'Restart', to:'fresh Ready after exact settlement', expectedDurable:{ oldPlayCapability:false, oldStatus:'Incomplete after confirmed settlement', newArmAllowed:'only after settlement readback' }, expectedView:'fresh Ready; late old operation cannot advance' },
  { from:['instructions','ready'], when:'no arm request admitted', action:'Close', to:'library', expectedDurable:{ attemptCountDelta:0, journalUnchanged:true }, expectedView:'library' },
  { from:activeStages.filter(stage => stage !== 'ready' && stage !== 'fairness_2'), action:'Close', to:'library after exact settlement', expectedDurable:{ oldPlayCapability:false, oldStatus:'Incomplete after confirmed settlement', newArmAllowed:'only after settlement readback' }, expectedView:'library; late old operation cannot reopen or publish' },
  { from:['test_complete','report_1','report_2','tips'], action:'Close', to:'library', expectedDurable:{ oldStatus:'Completed', reportSnapshotPages:2, journalUnchanged:true }, expectedView:'library; late report/tip read cannot reopen' },
  { from:['report_1','report_2'], action:'same-page dot', to:'same report page', expectedDurable:{ journalUnchanged:true, reportActivity:'idempotent' }, expectedView:'same page; no new history entry' },
  { from:['report_1','report_2'], action:'Tips', to:'tips', expectedDurable:{ journalUnchanged:true }, expectedView:'same saved report identity' },
  { from:['history'], action:'open Incomplete', to:'incomplete review', expectedDurable:{ reportSnapshot:null, journalUnchanged:true }, expectedView:'confirmed round facts only; no invented second report page' },
];
globalControlRules.push({ from:['ready'], when:'arm admitted but callback undelivered', action:'Restart or Close', to:'requested destination after exact settlement', expectedDurable:{ armRequestCount:1, oldPlayCapability:false, oldStatus:'Incomplete if arm committed, absent if rejected', newArmAllowed:'only after same-request readback and settlement' }, expectedView:'no award from old arm; Restart to fresh Ready or Close to library' });
globalControlRules.push(
  { from:['fairness_2'], when:'terminal root transaction commits before withdrawal; callback delivery irrelevant', action:'Restart or Close', to:'requested destination after exact readback', expectedDurable:{ oldPlayCapability:false, oldStatus:'Completed', round2Fairness:'submitted rating', round2Terminal:true, reportSnapshotPages:2, completedCount:1 }, expectedView:'Restart fresh Ready without new arm; Close library; old Test Complete/report cannot steal view' },
  { from:['fairness_2'], when:'withdrawal root transaction commits before terminal transaction', action:'Restart or Close', to:'requested destination after exact readback', expectedDurable:{ oldPlayCapability:false, oldStatus:'Incomplete', round2Fairness:null, round2Terminal:false, reportSnapshot:null, completedCount:0 }, expectedView:'Restart fresh Ready without new arm; Close library; no old Test Complete/report' },
  { from:['fairness_2'], when:'terminal/withdrawal delivery or readback held; root order unknown', action:'Restart or Close', to:'pending requested destination', expectedDurable:{ statusKnowledge:'unknown to view', newArmAllowed:false, partialCompletedSnapshotAllowed:false }, expectedView:'checking/Retry; no saved-status claim, Test Complete, report or new scored arm' },
);
const disabledControls = [
  { at:['connecting_1','connecting_2'], action:'Next', expectedDurable:{ journalUnchanged:true }, expectedView:'same connecting stage; Next disabled until current local-complete' },
  { at:['test_complete'], action:'Restart', expectedDurable:{ journalUnchanged:true }, expectedView:'control absent' },
  { at:['fairness_1','fairness_2'], action:'Next without selected rating', expectedDurable:{ journalUnchanged:true }, expectedView:'same fairness stage' },
  { at:['result_1','result_2'], action:'Next before confirmed exact render receipt', expectedDurable:{ journalUnchanged:true }, expectedView:'checking or interrupted review; no fairness stage' },
];
const raceCases = [
  { id:'R01', start:'ready; root has no attempt', order:['Next arm held','Next again'], expectedDurable:{ attempts:1, committedArmAtMostOnce:true }, expectedView:'checking until same-request readback; no award before commit' },
  { id:'R02', start:'ready; root has no attempt', order:['Delete all commit','old arm callback'], expectedDurable:{ oldGenerationWrites:0, oldAttemptPresent:false }, expectedView:'library/current new generation' },
  { id:'R03', start:'ready; root has no attempt', order:['arm commit','Delete all commit'], expectedDurable:{ oldAttemptPresent:false, oldGenerationWritesAfterDelete:0 }, expectedView:'library/current new generation' },
  { id:'R04', start:'choice_1; arm confirmed', order:['preview Give $1.50','preview Give $2','Confirm twice'], expectedDurable:{ round1SignedGiveCents:200, round1DecisionCount:1, round1Exposure:'possibly_revealed' }, expectedView:'result_1 only after decision readback' },
  { id:'R05', start:'choice_2; arm confirmed', order:['preview Take $1.50','preview Give $2','Confirm'], expectedDurable:{ round2SignedGiveCents:200, round2DecisionCount:1, round2Exposure:'possibly_revealed' }, expectedView:'result_2 shows Give $2, no Take claim' },
  { id:'R06', start:'choice_1; arm confirmed', order:['Confirm Give $0 commit','result glyphs transparent','receipt callback'], expectedDurable:{ round1SignedGiveCents:0, round1Exposure:'possibly_revealed', round1ReceiptCount:0 }, expectedView:'interrupted review; no fairness advancement' },
  { id:'R07', start:'result_1; decision/intent committed', order:['valid result paint','receipt write held','pagehide','settlement read also held'], expectedDurable:{ round1ExposureAtLeast:'possibly_revealed', statusKnowledge:'unknown while settlement read held', round1DecisionCount:1, newArmAllowed:false }, expectedView:'Uncertain checking/retry label; no durable Uncertain claim, resumed scoring or unfamiliar replay' },
  { id:'R08', start:'result_1; decision/intent committed', order:['receipt commit','Restart request','settlement commit','late receipt callback'], expectedDurable:{ round1Exposure:'render_receipt', oldPlayCapability:false, oldStatus:'Incomplete' }, expectedView:'fresh Ready after settlement; old callback cannot advance' },
  { id:'R09', start:'fairness_1; result receipt confirmed', order:['select 8','select 0','Next'], expectedDurable:{ round1Fairness:0, round1Terminal:true }, expectedView:'new_partner after commit' },
  { id:'R10', start:'fairness_1; rating not committed', order:['select 8','Close'], expectedDurable:{ round1Fairness:null, status:'Incomplete after confirmed settlement' }, expectedView:'library after exact settlement; no saved 8 claim' },
  { id:'R11', start:'new_partner; round1 terminal', order:['round2 arm held','Restart','late arm callback'], expectedDurable:{ round1Terminal:true, round2AtMostOneArm:true, oldPlayCapability:false }, expectedView:'fresh Ready after settlement, no stale award_2' },
  { id:'R12', start:'result_2; decision/intent committed', order:['Delete all commit','late receipt/fairness callbacks'], expectedDurable:{ oldAttemptPresent:false, oldGenerationWritesAfterDelete:0 }, expectedView:'library/current generation; no old result/report' },
  { id:'R13', start:'fairness_2; round1 terminal and round2 receipt; rating 8 selected', order:['Next commit','callback lost','same-request readback'], expectedDurable:{ status:'Completed', completedCount:1, reportPages:2, round2Fairness:8 }, expectedView:'test_complete only after readback; then report_1' },
  { id:'R14', start:'history; saved Completed', order:['old report read held','Delete all commit','old read resolves'], expectedDurable:{ oldAttemptPresent:false, oldReportActivityCountAfterDelete:0 }, expectedView:'no stale report page' },
  { id:'R15', start:'report_1; saved Completed', order:['page-1 read held','select report_2','page-1 read resolves'], expectedDurable:{ reportPages:2, journalUnchanged:true }, expectedView:'report_2 remains selected' },
  { id:'R16', start:'result_2; decision/intent committed', order:['receipt commit','Close wins before terminal','settlement commit'], expectedDurable:{ round2Exposure:'render_receipt', status:'Incomplete', reportSnapshot:null }, expectedView:'library; incomplete review not two-page Completed report' },
];
for (const stage of ['connecting_1','result_1','fairness_1','connecting_2','result_2']) {
  raceCases.push({ id:`G-${stage}-restart`, start:`${stage}; pending local completion or scored write`, order:['Restart request','late old callback','exact settlement readback'], expectedDurable:{ oldPlayCapability:false, oldStatus:'Incomplete', newArmAllowed:'after settlement readback only' }, expectedView:'fresh Ready; no old-stage publication' });
  raceCases.push({ id:`G-${stage}-close`, start:`${stage}; pending local completion or scored write`, order:['Close request','late old callback','exact settlement readback'], expectedDurable:{ oldPlayCapability:false, oldStatus:'Incomplete', newArmAllowed:'after settlement readback only' }, expectedView:'library; no old-stage publication' });
}
const terminalRacePrefix = { formId:'ME2-1', round1:{ signedGiveCents:200, candidateFinalCents:800, partnerFinalCents:700, fairness:8, terminal:true }, round2:{ signedGiveCents:200, candidateFinalCents:800, partnerFinalCents:700, exposure:'render_receipt', fairness:null, terminal:false }, status:'Armed', reportSnapshot:null };
for (const action of ['Close','Restart']) {
  const destination = action === 'Close' ? 'library' : 'fresh Ready with no new arm';
  raceCases.push({ id:`G-fairness_2-${action.toLowerCase()}-terminal-first`, start:'fairness_2; rating 8 selected, terminal request admitted; filmed Give $2 path', initialDurable:terminalRacePrefix, order:['terminal atomic commit','terminal callback lost',`${action} withdrawal commit`,'same-request terminal and withdrawal readback','late terminal callback'], expectedDurable:{ status:'Completed', round2Fairness:8, round2Terminal:true, reportSnapshotPages:2, reportPagesSameAttemptAndGeneration:true, reportRoundFinals:[[800,700],[800,700]], reportRoundFairness:[8,8], completedCount:1, oldPlayCapability:false }, expectedView:`${destination}; Completed history/report remain byte-identical; no old Test Complete publication` });
  raceCases.push({ id:`G-fairness_2-${action.toLowerCase()}-withdrawal-first`, start:'fairness_2; rating 8 selected, terminal request admitted; filmed Give $2 path', initialDurable:terminalRacePrefix, order:[`${action} withdrawal commit`,'terminal request rejected by capability/revision guard','late terminal callback','same-request withdrawal readback'], expectedDurable:{ status:'Incomplete', round1Terminal:true, round2SignedGiveCents:200, round2Exposure:'render_receipt', round2Fairness:null, round2Terminal:false, reportSnapshot:null, completedCount:0, oldPlayCapability:false }, expectedView:`${destination}; Incomplete review only; no saved 8 or two-page report` });
  raceCases.push({ id:`G-fairness_2-${action.toLowerCase()}-unknown`, start:'fairness_2; rating 8 selected, terminal request admitted; filmed Give $2 path', initialDurable:terminalRacePrefix, order:['terminal or withdrawal transaction possibly commits',`${action} requested`,'callbacks lost','settlement read held'], expectedDurable:{ statusKnowledge:'unknown to view', possibleExactStates:[{ status:'Armed', round2Fairness:null, round2Terminal:false, reportSnapshot:null, oldPlayCapability:true },{ status:'Completed', round2Fairness:8, round2Terminal:true, reportSnapshotPages:2 },{ status:'Incomplete', round2Fairness:null, round2Terminal:false, reportSnapshot:null, oldPlayCapability:false }], partialCompletedSnapshotAllowed:false, newArmAllowed:false }, expectedView:`${destination} pending with checking/Retry; no saved-status claim, Test Complete, report or new scored arm until readback` });
}
raceCases.push({ id:'G-report-close', start:'report_2; saved Completed and tips open held', order:['Close request','late tips callback'], expectedDurable:{ status:'Completed', journalUnchanged:true }, expectedView:'library; no old report or tips publication' });
raceCases.push({ id:'G-incomplete-open', start:'history; saved round 1 Incomplete', order:['open review','Delete all commit','late review callback'], expectedDurable:{ oldAttemptPresent:false }, expectedView:'library/current generation; no two-page Completed report' });
raceCases.push({ id:'G-terminal-delete-first', start:'fairness_2; terminal request admitted', order:['Delete all generation replacement','old terminal and withdrawal callbacks'], expectedDurable:{ oldAttemptPresent:false, oldGenerationWritesAfterDelete:0 }, expectedView:'current-generation library; no old destination, history or report' });
raceCases.push({ id:'G-terminal-delete-after', start:'fairness_2; terminal request admitted', order:['terminal atomic commit','Delete all generation replacement','late terminal callback and held report read'], expectedDurable:{ oldAttemptPresent:false, oldGenerationWritesAfterDelete:0 }, expectedView:'current-generation library; old Completed report cannot publish' });
raceCases.push({ id:'G-terminal-individual-delete', start:'fairness_2; terminal request admitted', order:['individual attempt tombstone','old terminal request/retry'], expectedDurable:{ oldAttemptPresent:false, tombstoneRetained:true, reportSnapshot:null }, expectedView:'no old Test Complete or report' });
raceCases.push({ id:'G-terminal-repeat-readback', start:'fairness_2; terminal commit, callback lost', order:['same-request readback','same-request retry','Close settlement readback'], expectedDurable:{ status:'Completed', completedCount:1, reportSnapshotPages:2, reportBytesUnchanged:true }, expectedView:'library; no duplicate terminal or Test Complete publication' });
raceCases.push({ id:'G-terminal-restart-new-arm', start:'fairness_2; terminal committed before Restart, callback lost', order:['Restart settlement readback','fresh unarmed Ready','assert no new attempt or form allocation','candidate Ready Next','new arm commit','same-request arm readback','old terminal callback'], expectedDurable:{ oldStatus:'Completed', oldReportSnapshotPages:2, atReady:{ newAttemptCount:0, formCounterDelta:0 }, afterReadyNext:{ newAttemptCount:1, formCounterDelta:1, newAttemptIdDifferent:true } }, expectedView:'unarmed Ready until candidate Next; new award only after arm readback; old Completed remains in history' });
raceCases.push({ id:'G-terminal-try-again', start:'completed report_2', order:['Try Again','old report/root readback','fresh unarmed Ready','assert no new attempt or form allocation','candidate Ready Next','new arm commit','same-request arm readback'], expectedDurable:{ oldStatus:'Completed', oldReportSnapshotPages:2, atReady:{ newAttemptCount:0, formCounterDelta:0 }, afterReadyNext:{ newAttemptCount:1, formCounterDelta:1, newAttemptIdDifferent:true } }, expectedView:'unarmed Ready until candidate Next; then new award; old report remains byte-identical in history' });
raceCases.push({ id:'G-withdrawal-no-try-again', start:'fairness_2; withdrawal committed first', order:['terminal request rejected','open Incomplete review','attempt report Try Again'], expectedDurable:{ oldStatus:'Incomplete', reportSnapshot:null, newArmCount:0 }, expectedView:'no report Try Again control; Incomplete review only' });
for (const action of ['Restart','Close']) raceCases.push({ id:`G-ready-${action.toLowerCase()}-before-arm`, start:'unarmed Ready; old attempt settled', order:[`${action} accepted`,'old Ready epoch invalidated','late Ready Next request'], expectedDurable:{ newAttemptCount:0, formCounterDelta:0 }, expectedView:action === 'Restart' ? 'new unarmed Ready; no award' : 'library; no award' });
raceCases.push({ id:'G-ready-arm-before-close', start:'unarmed Ready; old attempt settled', order:['candidate Ready Next arm commit','Close withdrawal commit','arm callback lost','same-request readback'], expectedDurable:{ newAttemptCount:1, formCounterDelta:1, newAttemptStatus:'Incomplete', newAttemptPlayCapability:false }, expectedView:'library after settlement; no stale award' });
raceCases.push({ id:'G-ready-arm-unknown', start:'unarmed Ready; old attempt settled', order:['candidate Ready Next request admitted','callback and readback held','Close requested'], expectedDurable:{ armCommitKnowledge:'unknown to view', formCounterDeltaPossible:[0,1], secondArmAllowed:false }, expectedView:'library pending/checking; no award or second form allocation until same-request readback' });
raceCases.push({ id:'G-try-again-delete-before-ready-next', start:'completed report_2', order:['Try Again','fresh unarmed Ready','Delete all commit','late candidate Ready Next'], expectedDurable:{ oldAttemptPresent:false, newAttemptCount:0, oldGenerationWritesAfterDelete:0 }, expectedView:'current-generation library; no old report or award' });
raceCases.push({ id:'G-try-again-delete-after-ready-next', start:'completed report_2', order:['Try Again','fresh unarmed Ready','candidate Ready Next arm commit','Delete all commit','late arm callback and held old report read'], expectedDurable:{ oldAttemptPresent:false, newAttemptPresent:false, oldGenerationWritesAfterDelete:0 }, expectedView:'current-generation library; no old report or new award' });
raceCases.push({ id:'G-try-again-individual-old-delete', start:'completed report_2', order:['Try Again','candidate Ready Next arm commit/readback','delete old Completed attempt','late old report callback'], expectedDurable:{ oldAttemptPresent:false, newAttemptPresent:true, newAttemptIdDifferent:true }, expectedView:'new attempt remains current; deleted old report cannot publish' });
raceCases.push({ id:'G-duplicate-try-again-close', start:'completed report_2', order:['two Try Again activations','Close accepted before Ready Next','old navigation callbacks'], expectedDurable:{ oldStatus:'Completed', oldReportSnapshotPages:2, newAttemptCount:0, formCounterDelta:0 }, expectedView:'library; old report retained; no award' });
raceCases.push({ id:'G-duplicate-restart-close-terminal-first', start:'fairness_2; terminal commit before navigation, callback lost', order:['two Restart activations','Close accepted as later destination','withdrawal commit/readback','old navigation callbacks'], expectedDurable:{ oldStatus:'Completed', oldReportSnapshotPages:2, newAttemptCount:0, formCounterDelta:0 }, expectedView:'library; old Completed history retained; no award' });
raceCases.push({ id:'G-duplicate-restart-close-withdrawal-first', start:'fairness_2; terminal not committed', order:['two Restart activations','Close accepted as later destination','withdrawal commit/readback','late terminal callback'], expectedDurable:{ oldStatus:'Incomplete', oldReportSnapshot:null, newAttemptCount:0, formCounterDelta:0 }, expectedView:'library; Incomplete review only; no award' });
raceCases.push({ id:'G-reload-unarmed-ready', start:'unarmed Ready; old Completed settled', order:['page reload','current root readback'], expectedDurable:{ oldStatus:'Completed', newAttemptCount:0, formCounterDelta:0 }, expectedView:'Ready remains unarmed; no ghost attempt or award' });
raceCases.push({ id:'G-reload-armed-pending-settlement', start:'fairness_2; Close requested, terminal and withdrawal writes held', order:['page reload','root read shows unchanged Armed','atomic fence/settlement ordered with in-flight terminal','same-request readback'], expectedDurable:{ possibleExactStates:['Completed with immutable two-page report','Incomplete with no full report'], newArmAllowed:'after confirmed settlement only' }, expectedView:'no scored resume; checking/Retry then library; no status or report claim before readback' });
for (const edge of screenGraph) for (const stage of edge.to.split('|')) if (!['ready','report_1','report_2'].includes(stage) && !screenGraph.some(x => x.from.split('|').includes(stage))) throw new Error(`orphan graph stage ${stage}`);
const fixture = { version: 'money_exchange_2_fixtures_v1_0', formsPayloadSha256: manifest.payloadSha256,
  arithmeticCases, screenGraph, globalControlRules, disabledControls, raceCases,
  authorityCases: authorityMatrix(),
  checks: {
    filmed: { formId: 'ME2-1', policyId: 'filmed-give-two', finalCentsByRound: [[800, 700], [800, 700]], fairnessByRound: [8, 8] },
    constraints: ['two distinct partners', '1500 cents conserved per round', 'round 1 Give only in original 50 cent steps', 'round 2 signed Give or Take in 50 cent steps', 'fairness 0 through 10 inclusive', 'draft choice and rating never commit until Confirm/Next'],
    controlCases: ['double Next or Confirm', 'Enter plus pointer same turn', 'preview Take then commit Give', 'change rating 8 to 0 before Next', 'Close/Restart at every active stage', 'report page arrows and dots', 'Tips and Back Report', 'Try Again reaches unarmed Ready; only candidate Ready Next allocates a new attempt'],
    authorityCases: ['arm held/rejected/committed-undelivered', 'decision held/rejected/committed-undelivered', 'result maybe painted before receipt', 'transparent or occluded glyph denies receipt', 'fairness selected but uncommitted', 'round 1 terminal before round 2 arm', 'late callback after withdrawal', 'Delete all and replacement both orders', 'history/report publication versus deletion both orders', 'BroadcastChannel absent', 'corrupt present root blocks'],
  } };
fixture.payloadSha256 = sha(fixture);

writeFileSync(new URL('../docs/specifications/ASSESSMENT_PRACTICE_MONEY_EXCHANGE_2_FORMS_V1_0_DRAFT.json', import.meta.url), `${JSON.stringify(manifest, null, 2)}\n`);
writeFileSync(new URL('../docs/specifications/ASSESSMENT_PRACTICE_MONEY_EXCHANGE_2_FIXTURES_V1_0_DRAFT.json', import.meta.url), `${JSON.stringify(fixture, null, 2)}\n`);
console.log(JSON.stringify({ forms: forms.length, cases: arithmeticCases.length, outcomes: arithmeticCases.length * 2, formsSha256: manifest.payloadSha256, fixturesSha256: fixture.payloadSha256 }));
