import { Attempt as UsageAttempt } from '../assessment-usage/client'
import type { FrameAdapter, Scheduler, EngineEvent } from './engine/contracts'
import { createStopEngine } from './engine/engine'
import { inspectTrialEvents } from './engine/integrity'
import { verifyProtectedEvidence } from './protected-integrity'
import { verifyDrillTiming } from './drill-integrity'
import { RULE } from './engine/rules'
import type { PreparationRecorder } from './preparation'
import { bindingFromKey, currentNewPreparationBranch } from './preparation'
import type { StopSetup } from './Preflight'
import type { StopFormManifest, StopTrialDefinition } from './contracts'
import type { FormExposureRepository } from './exposure'
import { validateStopForm } from './forms/validate'
import { validateStopStandardForm } from './forms/validate-v13'
import { findStopForm } from './forms'
import { STOP_SPECIFICATION_VERSION } from './versions'
import { STOP_SCORING_VERSION, STOP_V13_SPECIFICATION_VERSION, STOP_V13_SCORING_VERSION, STOP_V13_REPORT_VERSION } from './versions'
import { scoreStop } from './scoring'
import type { StopSummary } from './scoring'
import { FormClaimExpiredError, chainDeleted, DeletedChainError, InstallationClearedError, recordLocalActivity, stopLocalStore } from './storage'
import type { StopLocalState } from './storage'
import { beginRetestCompletion, retainRetestCompletion, ownsRetestCompletion, finishRetestCompletion, reconcileStoredCompletion, currentTrainingChain, reconcileTrainingDeletion, restoreTrainingChain } from './training'
import { waitForInitialFrame } from './initial-frame'
import type { InitialFrame } from './initial-frame'
import { firstScoredAdmission } from './presentation-order'
import type { NativeArm } from '../mock/contract'

export const WARMUP_ID = 'stop_warmup_v1' as const
const WARMUP: readonly StopTrialDefinition[] = Object.freeze(
  (['GO', 'GO', 'NO_GO', 'GO', 'GO', 'GO', 'NO_GO', 'GO'] as const)
    .map((stimulus, index) => Object.freeze({ phase: 'warmup' as const, index, stimulus })),
)
export type ResultSaveStatus = 'pending' | 'saved' | 'failed' | 'temporary' | 'review_only' | 'deleted'
export type RunScreen = 'live' | 'warmup_complete' | 'warmup_restart' | 'checking' | 'complete' | 'report' | 'invalid' | 'invalid_report' | 'exhausted' | 'reservation_expired'
type PreparationEvent = ReturnType<PreparationRecorder['snapshot']>[number]
export interface DevelopmentDraft {
  readonly schemaVersion: 'stop_development_draft_v1'
  readonly sessionId: string
  readonly status: 'invalid' | 'no_unused_form'
  readonly warmupId: typeof WARMUP_ID
  readonly setup: Readonly<StopSetup>
  readonly form: StopFormManifest | null
  readonly realizedSequence: readonly string[]
  readonly mode: 'baseline' | 'replay' | 'retest'
  readonly timingProfile: 'standard'
  readonly specificationVersion: typeof STOP_SPECIFICATION_VERSION | typeof STOP_V13_SPECIFICATION_VERSION
  readonly monotonicOriginMs: 0
  readonly storageMode: 'persistent_local' | 'temporary_memory'
  readonly scoringVersion: null
  readonly summarySnapshot: null
  readonly startedAtWall: string
  readonly retainedAtWall: string
  readonly clock: 'performance.now'
  readonly environment: Readonly<{ userAgent: string; width: number; height: number }>
  readonly engineQuality: string
  readonly invalidRule: string | null
  readonly events: readonly (PreparationEvent | EngineEvent)[]
  /** Rejected same-tab record, preserved verbatim for local diagnosis only. */
  readonly rejectedRecoveryRecord?: StopResult
}
export interface StopResult {
  readonly schemaVersion: 'stop_session_result_v1'
  readonly sessionId: string
  readonly mode: 'baseline' | 'replay' | 'retest'
  readonly form: StopFormManifest
  readonly setup: Readonly<StopSetup>
  readonly environment: DevelopmentDraft['environment']
  readonly validity: 'valid' | 'valid_with_note'
  readonly scoringVersion: typeof STOP_SCORING_VERSION | typeof STOP_V13_SCORING_VERSION
  readonly specificationVersion: typeof STOP_SPECIFICATION_VERSION | typeof STOP_V13_SPECIFICATION_VERSION
  readonly experienceVersion?: 'stop_experience_v1_3'
  readonly reportVersion?: typeof STOP_V13_REPORT_VERSION
  readonly storageMode: 'persistent_local' | 'temporary_memory'
  readonly startedAtWall: string
  readonly completedAtWall: string
  readonly events: readonly (PreparationEvent | EngineEvent)[]
  readonly summarySnapshot: Readonly<StopSummary>
}
const results = new Map<string, StopResult>()
export const activeTabResults = () => Object.freeze([...results.values()])
export function restoreStopRecords(restored: readonly StopResult[], retained: readonly DevelopmentDraft[]) {
  results.clear(); drafts.clear()
  for (const result of restored) results.set(result.sessionId, result)
  for (const draft of retained) drafts.set(draft.sessionId, draft)
}
export function verifyCompletedResult(record: StopResult): boolean {
  try {
    const all = record.events
    // Compare actual sequence and every provenance field, not merely a checksum label.
    if (record.schemaVersion !== 'stop_session_result_v1' ||
      record.scoringVersion !== (record.specificationVersion === '1.3' ? STOP_V13_SCORING_VERSION : STOP_SCORING_VERSION) ||
      (record.specificationVersion === '1.3' ? record.reportVersion !== STOP_V13_REPORT_VERSION : record.reportVersion !== undefined) ||
      record.specificationVersion !== record.form.specificationVersion ||
      JSON.stringify(record.form) !== JSON.stringify(findStopForm(record.form.id)) ||
      record.mode !== record.form.family || !['valid', 'valid_with_note'].includes(record.validity) ||
      all.at(-1)?.type !== 'protection_ended') return false
    const setup = record.setup
    if (typeof setup.binding.label !== 'string' || !setup.binding.label.length || setup.physicalKeyboard !== true || setup.latencyAffectedInput === true || !['standard', 'shape_accommodation_v1'].includes(setup.visualProfile) ||
      !bindingFromKey({ code: setup.binding.code, key: setup.binding.code === 'Space' ? ' ' : 'a',
        ctrlKey: false, altKey: false, metaKey: false, shiftKey: false, repeat: false, isComposing: false })) return false
    const protection = all.filter(e => e.type === 'protection_started')
    if (protection.length !== 1 || protection[0].payload.responseKey !== setup.binding.code) return false
    if (record.experienceVersion === 'stop_experience_v1_3') {
      if (record.specificationVersion !== '1.3' || all.some(e => e.type === 'device_check_completed')) return false
      const branch = currentNewPreparationBranch(all)
      const checks = all.filter(e => e.type === 'input_check_v13')
      const ready = all.filter(e => e.type === 'readiness_confirmed')
      if (!branch || branch.kind === 'skip' && branch.source.visualProfile !== setup.visualProfile ||
        checks.length !== 1 || ready.length !== 1) return false
      const check = checks[0]
      if (check.sequenceNumber >= protection[0].sequenceNumber || check.sequenceNumber >= ready[0].sequenceNumber ||
        check.sequenceNumber <= branch.sequenceNumber ||
        ready[0].sequenceNumber >= protection[0].sequenceNumber ||
        check.payload.code !== setup.binding.code || check.payload.visualProfile !== setup.visualProfile ||
        check.payload.inputDeviceClass !== 'physical_keyboard' || check.payload.physicalKeyboardDeclared !== true ||
        check.payload.latencyAffectedInput !== false || check.payload.timingProfile !== 'standard' ||
        !['fresh', 'reused'].includes(check.payload.origin) ||
        (check.payload.receiptId === null) !== (check.payload.tabNonce === null) ||
        (check.payload.origin === 'reused' && check.payload.receiptId === null) ||
        [check.payload.receiptId, check.payload.tabNonce].some(value => value !== null &&
          (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))) ||
        !check.payload.proof || check.payload.proof.code !== setup.binding.code ||
        ['trustedDown','trustedUp','sameCode','unmodifiedDownAndUp','downWasNotRepeat','upWasNotRepeat'].some(key =>
          check.payload.proof[key as keyof typeof check.payload.proof] !== true)) return false
    } else if (record.experienceVersion === undefined) {
      const device = all.filter(e => e.type === 'device_check_completed').at(-1)
      if (!device || device.sequenceNumber >= protection[0].sequenceNumber || device.payload.inputBinding !== setup.binding.code ||
        device.payload.visualProfile !== setup.visualProfile || device.payload.inputDeviceClass !== 'physical_keyboard' ||
        device.payload.timingProfile !== 'standard') return false
    } else return false
    let completed = 0
    for (let i = 0; i < all.length; i++) {
      const event = all[i]
      if (event.sessionId !== record.sessionId || event.sequenceNumber !== i + 1 ||
        !Number.isFinite(event.timestampMs) || event.timestampMs < 0 || (i && event.timestampMs < all[i - 1].timestampMs)) return false
      if (event.type === 'session_invalidated' || (event.type === 'integrity_checked' && !event.payload.valid)) return false
      if (event.type === 'session_completed') {
        completed++
        if (event.payload.eventCount !== i + 1 || event.payload.validity !== record.validity ||
          event.payload.checksum !== record.form.checksum || event.payload.scoringVersion !== record.scoringVersion ||
          i !== all.length - 2) return false
      }
    }
    if (completed !== 1 || all.filter(e => e.type === 'protection_ended').length !== 1) return false
    const engineEvents = all.filter((e): e is EngineEvent => e.schemaVersion === 'stop_engine_event_v1')
    if (!verifyProtectedEvidence(engineEvents) || !Number.isFinite(record.environment.width) || !Number.isFinite(record.environment.height) ||
      record.environment.width < 768 || record.environment.height < 600) return false
    const start = engineEvents.findIndex(e => e.type === 'trial_scheduled' && e.payload.trial.phase === 'scored')
    if (start < 0) return false
    const scored = engineEvents.slice(start)
    const trials = record.form.sequence.map((stimulus, index) => ({ phase: 'scored' as const, index, stimulus }))
    const schedules = scored.filter(e => e.type === 'trial_scheduled')
    if (schedules.length !== 80 || schedules.some((e, i) => JSON.stringify(e.payload.trial) !== JSON.stringify(trials[i])) ||
      !inspectTrialEvents(scored, trials, record.setup.binding.code).valid) return false
    const finished = scored.filter(e => e.type === 'batch_finished')
    const lastResolution = scored.filter(e => e.type === 'trial_resolved').at(-1)!
    const lastOffset = scored.filter(e => e.type === 'stimulus_removed').at(-1)!
    if (finished.length !== 1 || finished[0].payload.phase !== 'scored' || finished[0].payload.trialCount !== 80 ||
      finished[0].timestampMs < Math.max(lastResolution.payload.resolvedAtMs, lastOffset.timestampMs) + 1200 ||
      finished[0].sequenceNumber >= all[all.length - 2].sequenceNumber) return false
    const initial = engineEvents.slice(0, start).findLastIndex(e => e.type === 'fixation_started' && e.payload.kind === 'initial')
    const finish = engineEvents.indexOf(finished[0])
    if (initial < 0 || !verifyDrillTiming(engineEvents.slice(initial, finish + 1), 1200)) return false
    const anomalies = scored.filter(e => e.type === 'timing_anomaly')
    if (anomalies.length > 1 || anomalies.some(e => e.payload.severity !== 'non_severe') ||
      record.validity !== (anomalies.length ? 'valid_with_note' : 'valid')) return false
    const extras = engineEvents.filter(e => e.type === 'response_ignored' && e.payload.reason === 'extra')
    if (extras.length >= 10 || engineEvents.filter(e => e.type === 'response_accepted' && e.payload.anticipatory).length >= 3 ||
      engineEvents.slice(initial, finish + 1).filter(e => e.type === 'response_ignored' && e.payload.reason === 'fixation').length >= 3 ||
      engineEvents.slice(initial, finish + 1).filter(e => e.type === 'response_ignored' && e.payload.reason === 'wrong_key').length >= 5) return false
    const notes = engineEvents.filter(e => e.type === 'quality_note')
    const expectedNotes = [
      ...anomalies.map(e => ({ ruleId: RULE.timingNote, triggerSequenceNumber: e.sequenceNumber })),
      ...(extras.length >= 5 ? [{ ruleId: RULE.extraNote, triggerSequenceNumber: extras[4].sequenceNumber }] : []),
    ]
    if (notes.length !== expectedNotes.length || expectedNotes.some(expected => notes.filter(e =>
      e.payload.ruleId === expected.ruleId && e.payload.triggerSequenceNumber === expected.triggerSequenceNumber &&
      e.sequenceNumber > expected.triggerSequenceNumber).length !== 1)) return false
    return JSON.stringify(scoreStop(engineEvents, record.form)) === JSON.stringify(record.summarySnapshot)
  } catch { return false }
}
// Invalid and exhausted attempts remain in the tab and may be saved for local history.
const drafts = new Map<string, DevelopmentDraft>()
export const developmentDrafts = () => Object.freeze([...drafts.values()])

export function invalidReason(rule: string | null) {
  if (rule === RULE.hidden) return 'This page became hidden during the timed task.'
  if (rule === RULE.blur) return 'The game window was out of focus for more than one second.'
  if (rule === RULE.settings) return 'An input or accessibility setting changed during the timed task.'
  if (rule === RULE.viewport) return 'The timed task did not run in the supported physical-keyboard setup.'
  if (rule === RULE.integrity) return 'The recorded trials did not match the assigned form.'
  if (new Set<string>([RULE.anticipatory, RULE.premature, RULE.wrong, RULE.extra]).has(rule ?? '')) return 'The input record did not meet the session-quality rules.'
  // Lifecycle suspension/restoration is a severe timing failure under §14.3.
  return 'Browser timing moved outside the allowed range.'
}
export function createStopRun(options: {
  preparation: PreparationRecorder; setup: StopSetup; exposure: FormExposureRepository
  clock: () => number; scheduler: Scheduler; frames: FrameAdapter
  clear: () => void; changed: () => void; random?: () => number
  initialFrame?: InitialFrame
  validate?: typeof validateStopForm
  environment: DevelopmentDraft['environment']
  mode?: 'baseline' | 'replay' | 'retest'
  specificationVersion?: '1.1' | '1.3'
  experienceVersion?: 'stop_experience_v1_3'
  reservedFormId?: string
  chainId?: string
  storageFailed?: () => void
  completed?: (result: StopResult) => void
  beforeScoredArm?: (arm: NativeArm) => Promise<void>
  wallClock?: () => number
  admission?: () => { visible: boolean; focused: boolean; held: boolean; width: number; height: number; compatible: boolean }
}) {
  const usage=new UsageAttempt('stop')
  const { preparation, exposure, clock, scheduler, frames } = options
  const setup = Object.freeze({ ...options.setup, binding: Object.freeze({ ...options.setup.binding }) })
  const prepared = preparation.snapshot()
  const events: EngineEvent[] = []
  let screen: RunScreen = 'live'
  let phase: 'warmup' | 'scored' = 'warmup'
  let form: StopFormManifest | null = null
  let exposed = false
  let reservationExpired = false
  let admissionMessage = ''
  let started = false
  let processing = false
  let awaitingInitial = false
  let cancelInitial = () => {}
  let queued = false
  let draft: DevelopmentDraft | null = null
  let result: StopResult | null = null
  let storageFailure = false
  let saveStatus: ResultSaveStatus = 'temporary'
  let reviewOnly = false
  let completionCreated = false
  let completionSettled = false
  let deletionEpoch = 0
  let confirmation: Promise<void> = Promise.resolve()
  const mode = options.mode ?? 'baseline'
  const trainingChain = mode === 'retest' ? currentTrainingChain() : null
  const specificationVersion = options.specificationVersion ?? trainingChain?.baseline.specificationVersion ?? STOP_SPECIFICATION_VERSION
  const scoringVersion = specificationVersion === '1.3' ? STOP_V13_SCORING_VERSION : STOP_SCORING_VERSION
  const completionOwner = trainingChain ? beginRetestCompletion(trainingChain.id, preparation.sessionId) : null
  const localStore = stopLocalStore()
  const installationId = localStore?.installationIdentity()
  // Survives first confirmation, when the engine removes its frame cancel job.
  const presentation = new AbortController()
  const wallClock = options.wallClock ?? Date.now
  const startedAtWall = new Date().toISOString()
  const engine = createStopEngine({ sessionId: preparation.sessionId, responseKey: setup.binding.code, deferProtection: true,
    sequenceOffset: prepared.at(-1)?.sequenceNumber ?? 0, clock, scheduler,
    frames: mode === 'retest' && trainingChain && localStore ? firstScoredAdmission(frames,
      (present, signal) => localStore.admitPresentation(trainingChain, preparation.sessionId, async () => {
        await present()
        await confirmation
      }, signal), error => {
        engine.technicalFailure('Retest presentation admission failed')
        if (error instanceof DeletedChainError && error.state) reconcileTrainingDeletion(error.state)
        if (error instanceof InstallationClearedError) restoreTrainingChain(null, true)
      }, presentation) : frames,
    sink(event) {
      events.push(event)
      // Commit exposure from the retained confirmation, before onset-quality checks.
      // A failed exposure write is a sink integrity failure; the canonical event survives.
      if (event.type === 'stimulus_presented' && phase === 'scored' && !exposed) {
        // The canvas guard can pass before expiry and confirm only after it.
        const late = exposure.reservation(preparation.sessionId, wallClock())?.form.id !== form?.id
        exposure.expose(preparation.sessionId, event.payload.confirmedOnsetMs)
        exposed = true
        const store = stopLocalStore()
        if (store && form) confirmation = Promise.resolve().then(() => store.confirm(preparation.sessionId, form!.id, new Date().toISOString(), mode === 'retest' ? options.chainId ?? null : null,
          mode === 'retest' ? presentation.signal : undefined))
          .catch(() => { if (!presentation.signal.aborted && !result) storageFailure = true })
        else if (mode === 'retest' && form && options.chainId) void recordLocalActivity({ key: `${options.chainId}:retest_exposed:${preparation.sessionId}`,
          sessionId: preparation.sessionId, chainId: options.chainId, type: 'retest_exposed', payload: { formId: form.id, chainId: options.chainId, status: 'exposed' } })
        if (late) queueMicrotask(() => engine.technicalFailure('Form reservation expired at confirmed scored onset'))
      }
      if (mode === 'retest' && event.type === 'session_invalidated') presentation.abort()
      if (event.type === 'session_invalidated' || event.type === 'warmup_restart_required') { cancelInitial(); options.clear() }
      if (!queued) { queued = true; queueMicrotask(() => { queued = false; void update() }) }
    },
  })
  const unsubscribeDeletion = localStore?.subscribeDeletion(() => {
    deletionEpoch++
    if (completionCreated) { void refreshCompletion().catch(() => undefined); return }
    if (trainingChain && !localStore.chainAvailable(trainingChain) && protectedNow()) {
      if (!exposed) {
        exposure.release(preparation.sessionId)
        void localStore.release(preparation.sessionId, false).catch(() => undefined)
      }
      engine.technicalFailure('Training chain was broken by deletion')
    }
  })
  const protectedNow = () => engine.snapshot().protectionActive && !['invalid', 'closed', 'idle'].includes(engine.snapshot().state)
  const activeNow = () => protectedNow() || phase === 'warmup' && screen === 'live' &&
    !['invalid', 'closed', 'idle'].includes(engine.snapshot().state)
  function admissionReason() {
    const admission = options.admission?.()
    if (!admission) return ''
    if (!admission.visible || !admission.focused) return 'Return to this tab and focus it before starting timed play.'
    if (admission.held || engine.snapshot().held) return `Release ${setup.binding.label} before starting.`
    if (admission.width < 768 || admission.height < 600) return 'Enlarge the window or use a larger screen before starting.'
    if (!admission.compatible) return 'Confirm the required response key and visual profile for this retest.'
    if (!setup.physicalKeyboard || setup.latencyAffectedInput) return 'Timed Stop requires the confirmed physical-keyboard input setup.'
    return ''
  }
  function expireReservation() {
    reservationExpired = true
    exposure.release(preparation.sessionId)
    void stopLocalStore()?.release(preparation.sessionId, false).catch(() => undefined)
    if (!exposed && engine.abortPreOnset()) {
      cancelInitial(); options.clear(); show('reservation_expired')
    } else if (exposed) engine.technicalFailure('Form reservation expired after confirmed onset')
  }
  let deletionFrame = 0
  let observingDeletion = false
  let deletionRevision: string | undefined
  let deletionChecked = false
  function forgetDeletedInstallation() {
    // Delete all may already have rebound this store for replacement work.
    // An old delivery can clear only records still owned by its installation.
    if (stopLocalStore() === localStore && localStore?.installationIdentity() === installationId) {
      restoreTrainingChain(null, true); results.clear(); drafts.clear()
    } else {
      results.delete(preparation.sessionId); drafts.delete(preparation.sessionId)
    }
    result = null; saveStatus = 'deleted'; reviewOnly = true
  }
  function reconcileCompletion(state: StopLocalState, requireSaved = false) {
    if (!localStore || !completionCreated) return false
    const same = localStore.sameInstallation(state) && state.installationId === installationId
    for (const id of Object.keys(state.deletedSessions ?? {})) { results.delete(id); drafts.delete(id) }
    const deleted = !same || !!state.deletedSessions?.[preparation.sessionId]
    const broken = deleted || !!trainingChain && chainDeleted(state, trainingChain)
    if (broken) {
      if (!reviewOnly && same) void localStore.release(preparation.sessionId, true).catch(() => undefined)
      reviewOnly = true; storageFailure = false
      if (same) reconcileTrainingDeletion(state, deleted ? preparation.sessionId : undefined)
      else forgetDeletedInstallation()
      if (completionOwner) finishRetestCompletion(completionOwner)
    }
    if (deleted || saveStatus === 'deleted') {
      if (!same) forgetDeletedInstallation()
      else results.delete(preparation.sessionId)
      result = null; saveStatus = 'deleted'; reviewOnly = true
      options.changed(); return false
    }
    const saved = state.results[preparation.sessionId]
    const retained = result && saved && JSON.stringify(saved) === JSON.stringify({ ...result, storageMode: 'persistent_local' })
    if (!broken && requireSaved && trainingChain && state.chains[trainingChain.id]?.retest) {
      reconcileStoredCompletion(state.chains[trainingChain.id], !!completionOwner && !ownsRetestCompletion(completionOwner))
    }
    if (broken || requireSaved || completionSettled) {
      if (retained && (requireSaved || completionSettled || broken)) {
        result = Object.freeze({ ...result!, storageMode: 'persistent_local' }); results.set(preparation.sessionId, result); saveStatus = 'saved'
      } else if (reviewOnly || requireSaved) {
        reviewOnly = true; saveStatus = 'review_only'
        if (result) { result = Object.freeze({ ...result, storageMode: 'temporary_memory' }); results.set(preparation.sessionId, result) }
      }
      options.changed()
    }
    return !!retained && !reviewOnly
  }
  async function refreshCompletion(requireSaved = false) {
    if (!localStore || !completionCreated) return false
    const epoch = deletionEpoch
    const state = await localStore.read()
    // A notification received during this read wins over its older delivery.
    if (epoch !== deletionEpoch) return refreshCompletion(requireSaved)
    return reconcileCompletion(state, requireSaved)
  }
  // Independent observation, not a timing/input gate. The first-onset lock is
  // authoritative; this also stops an already exposed run when messages are lost.
  async function observeDeletion() {
    if (!observingDeletion || !localStore || !protectedNow() && !completionCreated) return
    try {
      // Poll only a small revision token; do not clone all task journals per frame.
      const revision = await localStore.deletionRevision()
      if (!deletionChecked || revision !== deletionRevision) {
        const state = await localStore.read()
        if (!observingDeletion) return
        if (completionCreated) reconcileCompletion(state)
        else if (trainingChain && (!localStore.sameInstallation(state) || chainDeleted(state, trainingChain))) {
          engine.technicalFailure('Training chain was broken by deletion')
          if (localStore.sameInstallation(state)) reconcileTrainingDeletion(state)
          else restoreTrainingChain(null, true)
          return
        }
        deletionChecked = true; deletionRevision = revision
      }
    } catch { /* Ordinary read failure cannot change task validity. Admission still fails closed. */ }
    if (observingDeletion && (protectedNow() || completionCreated) && saveStatus !== 'deleted') deletionFrame = requestAnimationFrame(() => { void observeDeletion() })
  }
  function retain(status: DevelopmentDraft['status']) {
    if (draft) return
    const snapshot = engine.snapshot()
    // Canonical events also retain local diagnostics if a sink failed.
    const journal = Object.freeze([...prepared, ...snapshot.events])
    let scored = false
    const realized: string[] = []
    for (const event of snapshot.events) {
      if (event.type === 'trial_scheduled') scored = event.payload.trial.phase === 'scored'
      if (event.type === 'stimulus_presented' && scored) realized.push(event.payload.stimulus)
    }
    draft = Object.freeze({ schemaVersion: 'stop_development_draft_v1', sessionId: preparation.sessionId,
      status, warmupId: WARMUP_ID, setup, form, realizedSequence: Object.freeze(realized),
      mode, timingProfile: 'standard', specificationVersion, monotonicOriginMs: 0,
      storageMode: storageFailure || !stopLocalStore() ? 'temporary_memory' : 'persistent_local', scoringVersion: null, summarySnapshot: null,
      startedAtWall, retainedAtWall: new Date().toISOString(), clock: 'performance.now',
      environment: Object.freeze({ ...options.environment }), engineQuality: snapshot.quality,
      invalidRule: snapshot.invalidRule, events: journal })
    drafts.set(preparation.sessionId, draft)
    void stopLocalStore()?.saveDraft(draft, options.chainId).catch(() => {
      storageFailure = true
      if (draft) { draft = Object.freeze({ ...draft, storageMode: 'temporary_memory' }); drafts.set(preparation.sessionId, draft) }
      void recordLocalActivity({ key: `storage_failure:${preparation.sessionId}`, sessionId: preparation.sessionId,
        chainId: options.chainId ?? null, type: 'storage_failure', payload: { errorClass: 'invalid_record_write', storageMode: 'temporary_memory' } })
      options.storageFailed?.(); options.changed()
    })
  }
  function show(next: RunScreen) { screen = next; options.changed() }
  function reconcile() {
    if (!form || JSON.stringify(form) !== JSON.stringify(findStopForm(form.id)) || form.specificationVersion !== specificationVersion) return false
    const results = engine.snapshot().results
    const journal = [...prepared, ...events]
    return results.length === 80 && results.every((r, i) => r.trial.phase === 'scored' && r.trial.index === i &&
      r.trial.stimulus === form!.sequence[i] && r.outcome.stimulus === form!.sequence[i]) &&
      journal.every((e, i) => e.sessionId === preparation.sessionId && e.sequenceNumber === i + 1 &&
        Number.isFinite(e.timestampMs) && (i === 0 || e.timestampMs >= journal[i - 1].timestampMs))
  }
  async function update() {
    const state = engine.snapshot().state
    if (state === 'invalid') {
      if (screen !== 'invalid' && screen !== 'reservation_expired') { options.clear(); retain('invalid'); exposure.release(preparation.sessionId); show(reservationExpired ? 'reservation_expired' : 'invalid') }
      return
    }
    if (state === 'warmup_restart_required') { if (screen !== 'warmup_restart') show('warmup_restart'); return }
    if (processing || awaitingInitial || state !== 'waiting' || !started || screen !== 'live') return
    const last = events.at(-1)
    if (last?.type !== 'batch_finished') return
    if (phase === 'warmup') { options.clear(); show('warmup_complete'); return }
    processing = true
    try {
      const issues = await (options.validate ?? validateStopStandardForm)(form!)
      if (!protectedNow()) return
      engine.verifyRetainedEvents(events.slice())
      if (!protectedNow()) return
      if (issues.length || !reconcile()) { engine.technicalFailure('Assigned manifest or continuous journal mismatch'); return }
      const summary = scoreStop(events, form!)
      const validity: StopResult['validity'] = engine.snapshot().notes.includes(RULE.timingNote) ? 'valid_with_note' : 'valid'
      // Retain the scored snapshot before closing the protected interval.
      const base = { schemaVersion: 'stop_session_result_v1' as const, sessionId: preparation.sessionId,
        mode, form: form!, setup, environment: Object.freeze({ ...options.environment }), validity, scoringVersion,
        specificationVersion, storageMode: 'temporary_memory' as const,
        ...(options.experienceVersion ? { experienceVersion: options.experienceVersion } : {}),
        ...(specificationVersion === '1.3' ? { reportVersion: STOP_V13_REPORT_VERSION } : {}),
        startedAtWall, completedAtWall: new Date().toISOString(), summarySnapshot: summary }
      const pending: StopResult = Object.freeze({ ...base, events: Object.freeze([...prepared, ...engine.snapshot().events]) })
      result = pending
      results.set(preparation.sessionId, pending)
      engine.recordCompletion({ eventCount: pending.events.length + 1, validity, checksum: form!.checksum, scoringVersion })
      if (!protectedNow()) { results.delete(preparation.sessionId); result = null; return }
      engine.endProtection()
      if (engine.snapshot().state === 'closed') {
        const complete: StopResult = Object.freeze({ ...base, events: Object.freeze([...prepared, ...engine.snapshot().events]) })
        result = complete
        completionCreated = true
        results.set(preparation.sessionId, complete)
        if (completionOwner) retainRetestCompletion(completionOwner, complete)
        exposure.release(preparation.sessionId); options.clear()
        // Completion owns an immutable recovery copy. End presentation ownership
        // now, including an outstanding confirmation transaction/delivery. The
        // completion write independently confirms exposure in its transaction.
        if (mode === 'retest') presentation.abort()
        const store = localStore
        saveStatus = store ? 'pending' : 'temporary'
        storageFailure = false
        show('complete')
        if (store && !observingDeletion && typeof requestAnimationFrame !== 'undefined') {
          observingDeletion = true; void observeDeletion()
        }
        if (store) {
          const persistent: StopResult = Object.freeze({ ...complete, storageMode: 'persistent_local' })
          for (let attempt = 0; attempt < 2; attempt++) {
            try {
              if (reviewOnly) break
              await store.saveResult(persistent, mode === 'retest' ? options.chainId : undefined, installationId)
              await refreshCompletion(true)
              break
            } catch (error) {
              if (error instanceof DeletedChainError) {
                reviewOnly = true; storageFailure = false
                if (error instanceof InstallationClearedError) {
                  forgetDeletedInstallation()
                } else {
                  void store.release(preparation.sessionId, true).catch(() => undefined)
                  saveStatus = 'review_only'
                  if (error.state) reconcileCompletion(error.state)
                  else {
                    if (trainingChain) reconcileTrainingDeletion({ retiredChains: { [trainingChain.id]: { drillAttempts: [] } } } as unknown as StopLocalState)
                    await refreshCompletion().catch(() => undefined)
                  }
                }
                break
              }
              if (reviewOnly) break
              storageFailure = attempt === 1
            }
          }
          if (storageFailure && !reviewOnly) await refreshCompletion().catch(() => undefined)
          if (storageFailure && !reviewOnly) {
            saveStatus = 'failed'
            void recordLocalActivity({ key: `storage_failure:${preparation.sessionId}`, sessionId: preparation.sessionId,
            chainId: options.chainId ?? null, type: 'storage_failure', payload: { errorClass: 'completion_write', storageMode: 'temporary_memory' } })
            options.storageFailed?.()
          }
        }
        // Do not navigate away from a report opened while saving. Notify even
        // after component cleanup so a pending write cannot lose chain completion.
        completionSettled = true
        if(result && !reviewOnly && result.storageMode==='persistent_local')usage.finish(preparation.sessionId,'completed',()=>({correct:summary.counts.hits+summary.counts.withholds,trials:summary.counts.hits+summary.counts.misses+summary.counts.withholds+summary.counts.falseAlarms,false_alarms:summary.counts.falseAlarms}))
        if (result && !reviewOnly && (!completionOwner || ownsRetestCompletion(completionOwner))) options.completed?.(result)
        if (completionOwner) finishRetestCompletion(completionOwner)
        options.changed()
      } else { results.delete(preparation.sessionId); result = null }
    } catch { results.delete(preparation.sessionId); result = null; engine.technicalFailure('Scoring or completion could not be reconciled') }
    finally { processing = false }
  }
  function startBatch(trials: readonly StopTrialDefinition[]) {
    awaitingInitial = true
    cancelInitial()
    cancelInitial = waitForInitialFrame({ clock, scheduler, request: options.initialFrame ?? (ready => ready()),
      active: () => activeNow() && screen === 'live',
      ready: () => { awaitingInitial = false; engine.start(trials) },
      failed: () => { awaitingInitial = false
        if (phase === 'warmup') engine.initialWarmupFrameFailure()
        else engine.technicalFailure('Initial frame did not arrive within 2000 ms') },
    })
  }
  return Object.freeze({
    engine, protectedNow, activeNow,
    canPresentScored() {
      if (phase !== 'scored' || exposed) return true
      if (trainingChain && localStore && !localStore.chainAvailable(trainingChain)) {
        engine.technicalFailure('Training chain was broken by deletion'); return false
      }
      if (exposure.reservation(preparation.sessionId, wallClock())?.form.id === form?.id) return true
      expireReservation()
      return false
    },
    begin(held: boolean) {
      engine.begin({ responseKeyHeld: held })
      if (setup.latencyAffectedInput) engine.technicalFailure('Latency-affected input supports untimed preparation only')
    },
    startWarmup() {
      if (started && screen !== 'warmup_restart') return
      const reason = admissionReason()
      if (reason) { admissionMessage = reason; options.changed(); return }
      if (engine.snapshot().state === 'warmup_restart_required') {
        engine.visibility(true); engine.focus(true)
      }
      if (engine.snapshot().state !== 'waiting' && engine.snapshot().state !== 'warmup_restart_required') return
      admissionMessage = ''
      engine.armWarmup()
      started = true; phase = 'warmup'; show('live'); startBatch(WARMUP)
    },
    async startScored() {
      if (screen !== 'warmup_complete' || engine.snapshot().state !== 'waiting') return
      const reason = admissionReason()
      if (reason) { admissionMessage = reason; options.changed(); return }
      if (mode === 'retest' && !exposure.reservation(preparation.sessionId, wallClock())) {
        reservationExpired = true; exposure.release(preparation.sessionId); show('reservation_expired'); return
      }
      admissionMessage = ''
      usage.begin(options.beforeScoredArm?'mock':'practice')
      if (!engine.activateProtection()) { usage.cancel(); return }
      show('checking')
      try {
        const store = stopLocalStore()
        if (mode === 'retest') form = exposure.reservation(preparation.sessionId, wallClock())?.form ?? null
        else if (store) {
          const claim = await store.reserve(preparation.sessionId, mode, (options.random ?? Math.random)(), null, null, undefined, specificationVersion)
          if (!protectedNow()) { if (claim) void store.release(preparation.sessionId, false).catch(() => undefined); return }
          form = claim ? exposure.claim(preparation.sessionId, claim.formId, claim.expiresAtMs ?? undefined) : null
        } else form = exposure.reserve(preparation.sessionId, options.random, mode, undefined, specificationVersion)
        if (!protectedNow()) { exposure.release(preparation.sessionId); return }
        if (mode === 'retest' && form?.id !== options.reservedFormId) form = null
        if (!form) {
          if (mode === 'retest') { expireReservation(); return }
          retain('no_unused_form'); engine.endProtection(); retain('no_unused_form'); show('exhausted'); return
        }
        if (form.specificationVersion !== specificationVersion) { engine.technicalFailure('Form version did not match this session'); return }
        const issues = await (options.validate ?? validateStopStandardForm)(form)
        if (!protectedNow()) return
        if (issues.length) { engine.technicalFailure('Assigned manifest validation failed'); return }
        if (mode === 'retest' && !exposure.reservation(preparation.sessionId, wallClock())) {
          expireReservation(); return
        }
        if (store && trainingChain) await store.checkChain(trainingChain)
        if (options.beforeScoredArm) {
          if (!store || mode !== 'baseline' || specificationVersion !== '1.3') throw Error('Current Stop mock baseline storage unavailable')
          const retainedInstallation = store.installationIdentity()
          if (!retainedInstallation) throw Error('Stop installation identity unavailable')
          await options.beforeScoredArm({ requestId: preparation.sessionId, attemptId: preparation.sessionId,
            originTicketId: null, installationId: retainedInstallation, generation: null,
            requestKind: 'reserve', nativeIdentity: [] })
          if (!protectedNow()) return
        }
        if (store) await store.arm(preparation.sessionId, form.id, setup.visualProfile)
        if (!protectedNow()) return
        if (trainingChain && store && typeof requestAnimationFrame !== 'undefined') {
          observingDeletion = true
          void observeDeletion()
        }
        usage.admit(preparation.sessionId,specificationVersion==='1.3' && mode!=='retest' && setup.visualProfile==='standard')
        phase = 'scored'; show('live')
        startBatch(form.sequence.map((stimulus, index) => ({ phase: 'scored', index, stimulus })))
      } catch (error) {
        if (error instanceof FormClaimExpiredError) { expireReservation(); return }
        engine.technicalFailure('Form assignment failed')
      }
    },
    leave() {
      usage.cancel()
      cancelInitial()
      observingDeletion = false
      if (deletionFrame) cancelAnimationFrame(deletionFrame)
      unsubscribeDeletion?.()
      if (activeNow()) engine.lifecycle('pagehide')
      if (mode === 'retest') presentation.abort()
      if (engine.snapshot().state === 'invalid') { retain('invalid'); exposure.release(preparation.sessionId); void stopLocalStore()?.release(preparation.sessionId, exposed).catch(() => { storageFailure = true }) }
    },
    viewReport() { if (screen === 'complete' && result) show('report') },
    viewInvalidReport() { if (screen === 'invalid' && draft) show('invalid_report') },
    recoverReport() {
      const retained = results.get(preparation.sessionId)
      const fail = () => {
        if (!retained && draft?.invalidRule === RULE.integrity) { show('invalid'); return false }
        results.delete(preparation.sessionId); result = null
        retain('invalid')
        if (draft) {
          // Keep the rejected evidence unchanged; the engine's canonical journal also survives.
          draft = Object.freeze({ ...draft, ...(retained ? { events: retained.events, form: retained.form, rejectedRecoveryRecord: retained } : {}),
            invalidRule: RULE.integrity, engineQuality: 'invalid' })
          drafts.set(preparation.sessionId, draft)
        }
        show('invalid')
        return false
      }
      try {
        if (!retained || retained.sessionId !== preparation.sessionId ||
          JSON.stringify(retained.form) !== JSON.stringify(form) || JSON.stringify(retained.setup) !== JSON.stringify(setup) ||
          JSON.stringify(retained.events) !== JSON.stringify([...prepared, ...engine.snapshot().events]) ||
          !verifyCompletedResult(retained)) return fail()
        result = retained; show('report'); return true
      } catch { return fail() }
    },
    snapshot: () => Object.freeze({ screen, draft, result, form, mode, exposed, setup, storageFailure, saveStatus, reviewOnly, admissionMessage, engine: engine.snapshot(),
      events: Object.freeze([...prepared, ...events]) }),
  })
}
export type StopRun = ReturnType<typeof createStopRun>
