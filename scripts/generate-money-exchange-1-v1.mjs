import { createHash } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const out = join(root, 'docs/specifications')
const sha = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const rates = [4100, 2000, 6500, 0, 8000, 3500]
const forms = rates.map((returnBps, i) => ({ id: 'ME1-' + (i + 1), returnBps }))
const formPayload = { version: 'money_exchange_1_forms_v1_0', generator: 'money_exchange_1_generator_v1_0', forms }
const formFile = { ...formPayload, payloadSha256: sha(formPayload) }

function result(sentCents, returnBps) {
  if (!Number.isInteger(sentCents) || sentCents < 0 || sentCents > 1000) throw new Error('sentCents')
  if (!Number.isInteger(returnBps) || returnBps < 0 || returnBps > 10000) throw new Error('returnBps')
  const potCents = sentCents * 3
  const returnedCents = Math.floor((potCents * returnBps + 5000) / 10000)
  return {
    sentCents, potCents, returnedCents,
    selfCents: 1000 - sentCents + returnedCents,
    partnerCents: potCents - returnedCents,
    fairnessEligible: sentCents > 0,
  }
}
const sampleCents = [0, 1, 5, 500, 999, 1000]
const cases = forms.flatMap((form) => sampleCents.map((sentCents) => ({
  formId: form.id, returnBps: form.returnBps, ...result(sentCents, form.returnBps),
})))

// Layer 1 is the observable game. Delivery/recovery overlays never add a scored round.
const screens = [
  { id: 'instructions', evidence: 'game_still_0', controls: ['start', 'close'], next: 'ready', admitWhen: 'current_view', publishNextWhen: 'current_view', display: 'instructions_only' },
  { id: 'ready', evidence: 'game_still_1', controls: ['next', 'restart', 'close'], next: 'award', admitWhen: 'current_view', publishNextWhen: 'current_view', display: 'ready_prompt' },
  { id: 'award', evidence: 'film_1_3', controls: ['next', 'restart', 'close'], next: 'connecting', admitWhen: 'current_view', publishNextWhen: 'current_view', display: 'one_centered_candidate_1000' },
  { id: 'connecting', evidence: 'film_4', controls: ['restart', 'close'], disabled: ['next'], next: 'connected', admitWhen: 'automatic_current_epoch', publishNextWhen: 'connection_ready_and_current_epoch', display: 'pair_1000_0' },
  { id: 'connected', evidence: 'film_5_7', controls: ['next', 'restart', 'close'], next: 'partner_rules', admitWhen: 'current_view', publishNextWhen: 'current_view', display: 'pair_1000_0' },
  { id: 'partner_rules', evidence: 'film_8_14', controls: ['next', 'restart', 'close'], next: 'return_explanation', admitWhen: 'current_view', publishNextWhen: 'current_view', display: 'pair_1000_0' },
  { id: 'return_explanation', evidence: 'film_15_22', controls: ['next', 'restart', 'close'], next: 'transfer', admitWhen: 'owner_storage_ready_and_no_unresolved_attempt', publishNextWhen: 'confirmed_atomic_arm', display: 'pair_1000_0' },
  { id: 'transfer', evidence: 'film_23_25', controls: ['next', 'restart', 'close'], next: 'transfer_busy', admitWhen: 'valid_0_1000_cents_and_no_pending_request', publishNextWhen: 'confirmed_transfer', display: 'amount_field_pair_1000_0' },
  { id: 'transfer_busy', evidence: 'film_26_29', controls: ['restart', 'close'], disabled: ['next'], next: 'response_ready', admitWhen: 'automatic_current_epoch', publishNextWhen: 'confirmed_transfer_and_animation_ready', display: 'moving_pair_no_return' },
  { id: 'response_ready', evidence: 'film_30_33', controls: ['next', 'restart', 'close'], next: 'final_allocation', admitWhen: 'confirmed_transfer_and_current_epoch', publishNextWhen: 'current_result_view_only', display: 'tripled_pot_return_hidden' },
  { id: 'final_allocation', evidence: 'film_34_42', controls: ['next', 'restart', 'close'], next: 'fairness', admitWhen: 'captured_visible_result_and_confirmed_return_event_for_positive_and_zero', publishNextWhen: 'current_owner_and_view', display: 'return_and_both_final_balances' },
  { id: 'fairness', evidence: 'film_43_53', controls: ['next', 'restart', 'close'], next: 'test_complete', admitWhen: 'positive_selected_0_10_or_zero_na', publishNextWhen: 'confirmed_atomic_terminal', display: 'rating_without_balance_pair' },
  { id: 'test_complete', evidence: 'film_54', controls: ['next', 'close'], disabled: ['restart'], next: 'report', admitWhen: 'confirmed_completed_terminal_and_current_view', publishNextWhen: 'ordered_current_report_view', display: 'completion_without_balance_pair' },
  { id: 'report', evidence: 'game_still_2', controls: ['try_again', 'arithmetic_help', 'ordinary_exit'], next: 'arithmetic_help', admitWhen: 'current_saved_report_view', publishNextWhen: 'ordered_current_help_view', display: 'amounts_rating_and_original_help' },
  { id: 'arithmetic_help', evidence: 'game_still_3', controls: ['back', 'close'], next: 'report', admitWhen: 'same_saved_report_view', publishNextWhen: 'ordered_current_report_view', display: 'arithmetic_only' },
]
const positiveScreenPath = ['instructions', 'ready', 'award', 'connecting', 'connected', 'partner_rules', 'return_explanation', 'transfer', 'transfer_busy', 'response_ready', 'final_allocation', 'fairness', 'test_complete', 'report']
const zeroScreenPath = [...positiveScreenPath]
const progression = [
  { from: 'return_explanation', operation: 'arm', to: 'transfer', requires: ['arm_committed', 'current_owner'] },
  { from: 'transfer', operation: 'transfer', to: 'transfer_busy', requires: ['valid_cents', 'transfer_committed', 'current_owner'] },
  { from: 'response_ready', operation: 'return', to: 'final_allocation', requires: ['return_hidden_until_next', 'current_view'] },
  { from: 'final_allocation', operation: 'return', to: 'fairness', requires: ['visible_capture', 'return_presented_committed', 'current_owner'], appliesTo: ['positive', 'zero'] },
  { from: 'fairness', operation: 'terminal', to: 'test_complete', requires: ['rating_or_na_selected', 'atomic_terminal_committed', 'current_owner'], appliesTo: ['positive', 'zero'] },
  { from: 'test_complete', operation: 'view', to: 'report', requires: ['current_complete_root', 'ordered_publication'] },
]

// Layer 2 is the local authority protocol. Outcome and requested navigation are independent.
const outcomeRows = [
  { outcome: 'no_arm_fenced', continueView: 'return_explanation', restartView: 'ready', closeView: 'library', technicalView: 'review', consumed: false },
  { outcome: 'nonterminal_confirmed', continueView: 'operation_target', restartView: 'ready', closeView: 'library', technicalView: 'review', settleIncompleteBeforeExit: true },
  { outcome: 'incomplete_confirmed', continueView: 'review', restartView: 'ready', closeView: 'library', technicalView: 'review', retainIncomplete: true },
  { outcome: 'completed_confirmed', continueView: 'test_complete', restartView: 'ready', closeView: 'library', technicalView: 'review', retainCompleted: true },
  { outcome: 'unknown', continueView: 'checking', restartView: 'checking', closeView: 'library_unresolved', technicalView: 'review_retryable', blockNewArm: true, retainedRestartTarget: 'ready' },
  { outcome: 'invalid_root', continueView: 'blocked', restartView: 'blocked', closeView: 'library_unavailable', technicalView: 'blocked', blockNewArm: true },
  { outcome: 'deleted_or_replaced', continueView: 'library', restartView: 'library', closeView: 'library', technicalView: 'library', deletionOverridesIntent: true },
]
const intents = ['continue', 'restart', 'close', 'technical']
const routeCases = outcomeRows.flatMap((row) => intents.map((intent) => ({
  outcome: row.outcome, intent,
  view: row[intent + 'View'],
  retainedRestartTarget: intent === 'restart' && row.outcome === 'unknown' ? 'ready' : null,
  retainCompleted: Boolean(row.retainCompleted),
  retainIncomplete: Boolean(row.retainIncomplete),
  settleIncompleteBeforeExit: Boolean(row.settleIncompleteBeforeExit && intent !== 'continue'),
  blockNewArm: Boolean(row.blockNewArm),
  deletionOverridesIntent: Boolean(row.deletionOverridesIntent),
})))
const operationFacts = {
  arm: { continueTarget: 'transfer', fenceFirst: [], commitFirst: ['form_armed', 'ended_incomplete'], consumedIfFenceFirst: false, exposure: 'not_revealed' },
  transfer: { continueTarget: 'transfer_busy', fenceFirst: ['form_armed', 'ended_incomplete'], commitFirst: ['form_armed', 'transfer_committed', 'ended_incomplete'], consumedIfFenceFirst: true, exposure: 'not_revealed' },
  return: { continueTarget: 'final_allocation', fenceFirst: ['form_armed', 'transfer_committed', 'ended_incomplete'], commitFirst: ['form_armed', 'transfer_committed', 'return_presented', 'ended_incomplete'], consumedIfFenceFirst: true, exposure: 'captured_visible' },
  terminal: { continueTarget: 'test_complete', fenceFirst: ['form_armed', 'transfer_committed', 'return_presented', 'ended_incomplete'], commitFirst: ['form_armed', 'transfer_committed', 'return_presented', 'fairness_committed', 'completed'], consumedIfFenceFirst: true, exposure: 'captured_visible' },
}
const withdrawalIntents = ['restart', 'close', 'technical']
const durableOrders = ['fence_first', 'commit_first']
const deliveryKinds = ['immediate', 'callback_held', 'never_delivered_readback']
const cancellationCases = Object.entries(operationFacts).flatMap(([operation, facts]) =>
  withdrawalIntents.flatMap((intent) => durableOrders.flatMap((durableOrder) =>
    deliveryKinds.flatMap((delivery) => (operation === 'terminal' ? ['positive', 'zero'] : ['not_applicable']).map((branch) => {
      const committed = durableOrder === 'commit_first'
      const completed = operation === 'terminal' && committed
      return {
        operation, intent, durableOrder, delivery, branch,
        expectedJournal: completed && branch === 'zero'
          ? ['form_armed', 'transfer_committed', 'return_presented', 'fairness_not_applicable', 'completed']
          : committed ? facts.commitFirst : facts.fenceFirst,
        formConsumed: committed || facts.consumedIfFenceFirst,
        exposure: facts.exposure,
        terminal: completed ? 'completed' : (operation === 'arm' && !committed ? 'absent_fenced' : 'ended_incomplete'),
        route: intent === 'restart' ? 'ready' : intent === 'close' ? 'library' : 'review',
        newArmBeforeResolution: false,
        readbackRequired: delivery !== 'immediate',
        oldCallbackMayRestorePlay: false,
      }
    })))) )
const returnExposurePoints = [
  { point: 'before_reveal_request', event: false, exposure: 'not_revealed', retryAfterWithdrawal: false },
  { point: 'pixels_possible_capture_unconfirmed', event: false, exposure: 'possibly_revealed', retryAfterWithdrawal: false },
  { point: 'capture_confirmed_before_write_or_definitive_abort', event: false, exposure: 'captured_visible', retryAfterWithdrawal: false },
  { point: 'write_in_flight_fence_first', event: false, exposure: 'captured_visible', retryAfterWithdrawal: false },
  { point: 'write_in_flight_commit_first', event: true, exposure: 'captured_visible', retryAfterWithdrawal: false },
  { point: 'event_committed_delivery_held', event: true, exposure: 'captured_visible', retryAfterWithdrawal: false },
]
const returnExposureCases = returnExposurePoints.flatMap((row) => ['restart', 'close'].map((intent) => ({
  ...row, intent, routeAfterSettlement: intent === 'restart' ? 'ready' : 'library',
  formConsumed: true, terminal: 'ended_incomplete',
  journalIncludes: row.event ? ['return_presented', 'ended_incomplete'] : ['ended_incomplete'],
  journalExcludes: row.event ? [] : ['return_presented', 'fairness_committed', 'completed'],
})))
const returnAbortCases = [
  { point: 'capture_failed', playActive: true, validPresentationContextRequired: true, returnWriteAdmissible: false, retryKind: 'presentation_check_same_view', returnEvent: false, mayRetrySameRequest: false, fairnessAllowed: false, exposure: 'possibly_revealed' },
  { point: 'capture_succeeded_write_definitively_aborted', playActive: true, returnWriteAdmissible: true, retryKind: 'exact_return_request', returnEvent: false, mayRetrySameRequest: true, fairnessAllowed: false, exposure: 'captured_visible' },
  { point: 'capture_succeeded_write_definitively_aborted_then_withdrawn', playActive: false, returnWriteAdmissible: false, retryKind: 'none', returnEvent: false, mayRetrySameRequest: false, fairnessAllowed: false, exposure: 'captured_visible', terminal: 'ended_incomplete' },
]
const newerViewCases = intents.map((intent) => ({ oldIntent: intent, laterExplicitIntent: 'close', destination: 'library', oldCallbackMayPublish: false, durableFactStillRecorded: true }))
const deletionSubjects = ['arm', 'transfer', 'return', 'terminal', 'report_view', 'help_view', 'history_view']
const deletionCases = deletionSubjects.flatMap((subject) =>
  ['individual', 'all'].flatMap((kind) => ['deletion_first', 'subject_first'].map((order) => ({
    subject, kind, order, oldPublication: false, oldWriteResurrection: false,
    destinationByCurrentView: { library: 'library', history: 'history' }, counter: kind === 'individual' ? 'retained' : 'new_installation',
    sameRequestReadback: true,
  }))))
const failureCases = [
  { failure: 'timeout', durableMeaning: 'unknown', delivery: 'retryable_after_bounded_checks', newArm: false },
  { failure: 'final_read_rejection', durableMeaning: 'unknown', delivery: 'retryable_after_bounded_checks', newArm: false },
  { failure: 'invalid_root', durableMeaning: 'blocked', delivery: 'check_again_only', newArm: false },
  { failure: 'close_during_pending', durableMeaning: 'unknown_until_settled', delivery: 'document_owner_survives_unmount', newArm: false },
  { failure: 'reload_during_pending', durableMeaning: 'unknown_until_settled', delivery: 'history_recovery_no_scored_resume', newArm: false },
  { failure: 'late_callback_after_new_view', durableMeaning: 'actual_committed_fact_only', delivery: 'no_old_view_publication', newArm: false },
]
const deliveryRecoveryCases = [
  { step: 'initial_check_timeout', deadlineMs: 2500, fact: 'unknown', scoredNext: false, sameRequest: true },
  { step: 'one_automatic_retry', delayAtMostMs: 900, deadlineMs: 2500, fact: 'unknown_until_verified', scoredNext: false, sameRequest: true },
  { step: 'automatic_retry_failure', mode: 'retryable', manualRetryEnabled: true, scoredNext: false, newArmAllowed: false },
  { step: 'manual_retry', mode: 'checking', sameRequest: true, scoredNext: false, duplicateRetryAllowed: false },
  { step: 'manual_retry_failure', mode: 'retryable', scoredNext: false, newArmAllowed: false },
]
const exposureRecoveryCases = [
  { point: 'captured_then_committed_held_readback', exposure: 'captured_visible', durableReturnEvent: 'confirmed_committed', retryScoredAfterWithdrawal: false },
  { point: 'captured_then_fenced_absent_readback', exposure: 'captured_visible', durableReturnEvent: 'confirmed_absent', retryScoredAfterWithdrawal: false },
  { point: 'captured_then_repeated_read_rejection', exposure: 'captured_visible', durableReturnEvent: 'unknown', retryScoredAfterWithdrawal: false, savedClaim: false },
  { point: 'captured_then_late_callback', exposure: 'captured_visible', durableReturnEvent: 'actual_verified_fact_only', retryScoredAfterWithdrawal: false, oldViewMayPublish: false },
]
const terminationExposureCases = [
  { point: 'captured_metadata_persisted', reloadExposure: 'captured_visible', consumedForm: true, scoredResume: false },
  { point: 'captured_only_in_lost_document_memory', reloadExposure: 'possibly_revealed', consumedForm: true, scoredResume: false, noFabricatedCapture: true },
]
const fixturePayload = {
  version: 'money_exchange_1_fixtures_v1_0',
  formsPayloadSha256: formFile.payloadSha256,
  sampleCents, cases,
  filmedExample: { formId: 'ME1-1', rating: 10, ...result(500, 4100) },
  gameplay: { screens, positiveScreenPath, zeroScreenPath, progression },
  authority: {
    dimensions: {
      operations: ['none', 'arm', 'transfer', 'return', 'terminal', 'view', 'deletion'],
      delivery: ['idle', 'checking', 'retryable', 'blocked'],
      durable: ['absent_fenced', 'committed', 'unknown', 'deleted_or_replaced'],
      capability: ['active', 'permanently_withdrawn'],
      navigation: intents,
      exposure: ['not_revealed', 'possibly_revealed', 'captured_visible'],
    },
    checkDeadlineMs: 2500, automaticRetryDelayMaxMs: 900, automaticRetryCount: 1,
    outcomeRows, routeCases, newerViewCases, operationFacts, cancellationCases,
    exposureOrder: ['not_revealed', 'possibly_revealed', 'captured_visible'], exposureMerge: 'max_for_same_attempt_and_installation_only',
    returnExposurePoints, returnExposureCases, returnAbortCases, exposureRecoveryCases, terminationExposureCases,
    deletionCases, failureCases, deliveryRecoveryCases,
    pendingControlProjection: {
      checking: { scoredNext: false, duplicateRequest: false, retry: false, close: true },
      retryable: { scoredNext: false, duplicateRequest: false, retrySameId: true, close: true },
      blocked: { scoredNext: false, duplicateRequest: false, checkAgain: true, close: true },
      settledReview: { scoredNext: false, tryAgainAfterVerifiedTerminal: true, close: true },
    },
  },
  positiveJournal: ['form_armed', 'transfer_committed', 'return_presented', 'fairness_committed', 'completed'],
  zeroJournal: ['form_armed', 'transfer_committed', 'return_presented', 'fairness_not_applicable', 'completed'],
  reportExample: { sentCents: 500, potCents: 1500, returnedCents: 615, selfCents: 1115, partnerCents: 885, rating: 10 },
  invalidTransferInputs: ['', '-1', '10.01', '1.001', 'NaN', 'Infinity'],
}
const fixtureFile = { ...fixturePayload, payloadSha256: sha(fixturePayload) }
writeFileSync(join(out, 'ASSESSMENT_PRACTICE_MONEY_EXCHANGE_1_FORMS_V1_0_DRAFT.json'), JSON.stringify(formFile, null, 2) + '\n')
writeFileSync(join(out, 'ASSESSMENT_PRACTICE_MONEY_EXCHANGE_1_FIXTURES_V1_0_DRAFT.json'), JSON.stringify(fixtureFile, null, 2) + '\n')
console.log('forms ' + formFile.payloadSha256 + '; fixtures ' + fixtureFile.payloadSha256 + '; cases ' + cases.length)
