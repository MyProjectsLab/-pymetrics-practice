import type {
  STOP_EVENT_SCHEMA_VERSION,
  STOP_FORM_GENERATOR_VERSION,
  STOP_FORM_SCHEMA_VERSION,
  STOP_SESSION_SCHEMA_VERSION,
  STOP_SPECIFICATION_VERSION,
  STOP_STANDARD_FORM_VERSION,
  STOP_V13_FORM_SCHEMA_VERSION,
  STOP_V13_FORM_VERSION,
  STOP_V13_GENERATOR_VERSION,
  STOP_V13_SPECIFICATION_VERSION,
} from './versions'

export type StopStimulus = 'GO' | 'NO_GO'
export type StopStandardFormFamily = 'baseline' | 'replay' | 'retest'
export type StopSessionMode = StopStandardFormFamily | 'mock' | 'drill'
export type StopValidityStatus =
  | 'valid'
  | 'valid_with_note'
  | 'invalid'
  | 'incomplete'

export type StopVisualProfile = 'standard' | 'shape_accommodation_v1'
export type StopTimingProfile = 'standard'
export type StopStorageMode = 'persistent_local' | 'temporary_memory'

export type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer Item)[]
    ? readonly DeepReadonly<Item>[]
    : T extends object
      ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
      : T

interface StopFormBase {
  readonly id: string
  readonly family: StopStandardFormFamily
  readonly seedId: string
  readonly blockCount: 4
  readonly blockSize: 20
  readonly sequence: readonly StopStimulus[]
  readonly checksum: string
}
export interface StopLegacyFormManifest extends StopFormBase {
  readonly schemaVersion: typeof STOP_FORM_SCHEMA_VERSION
  readonly formVersion: typeof STOP_STANDARD_FORM_VERSION
  readonly specificationVersion: typeof STOP_SPECIFICATION_VERSION
  readonly generatorVersion: typeof STOP_FORM_GENERATOR_VERSION
}
export interface StopV13FormManifest extends StopFormBase {
  readonly schemaVersion: typeof STOP_V13_FORM_SCHEMA_VERSION
  readonly formVersion: typeof STOP_V13_FORM_VERSION
  readonly specificationVersion: typeof STOP_V13_SPECIFICATION_VERSION
  readonly generatorVersion: typeof STOP_V13_GENERATOR_VERSION
  readonly blockGoCounts: readonly [number, number, number, number]
}
export type StopFormManifest = StopLegacyFormManifest | StopV13FormManifest

export interface StopTrialDefinition {
  readonly phase: 'warmup' | 'scored' | 'drill'
  readonly index: number
  readonly stimulus: StopStimulus
}

export type StopTrialOutcome =
  | Readonly<{ stimulus: 'GO'; kind: 'hit'; responseTimeMs: number }>
  | Readonly<{ stimulus: 'GO'; kind: 'miss'; responseTimeMs: null }>
  | Readonly<{ stimulus: 'NO_GO'; kind: 'false_alarm'; responseTimeMs: number }>
  | Readonly<{ stimulus: 'NO_GO'; kind: 'correct_withhold'; responseTimeMs: null }>

export interface StopTrialRecord {
  readonly definition: StopTrialDefinition
  readonly outcome: StopTrialOutcome | null
  readonly eventSequenceNumbers: readonly number[]
}

export interface StopValidity {
  readonly status: StopValidityStatus
  readonly reasons: readonly string[]
}

export interface StopEventPayloads {
  guide_opened: Readonly<{ source: 'library' | 'mock' | 'history' | 'training' }>
  example_presented: Readonly<{ exampleId: string; expectedAction: 'press' | 'withhold' }>
  example_resolved: Readonly<{ exampleId: string; observedAction: 'press' | 'withhold' }>
  comprehension_answered: Readonly<{ itemId: string; answerId: string; correct: boolean; attempt: number }>
  shortcut_chosen: Readonly<{ sourceSessionId: string; ruleVersion: 'stop_rule_v1'; experienceVersion: '1.2'; skipped: readonly ['rule', 'examples', 'comprehension'] }>
  device_check_completed: Readonly<{ inputBinding: string; inputDeviceClass: string; visualProfile: StopVisualProfile; timingProfile: StopTimingProfile }>
  onboarding_v13_opened: Readonly<{ ruleVersion: 'stop_rule_v1'; visualProfile: StopVisualProfile; questionCount?: 2 }>
  onboarding_v13_answered: Readonly<{ questionId: 'go' | 'no-go'; answerId: string; correct: boolean; attempt: number }>
  onboarding_v13_skip_verified: Readonly<{ installationId: string; sourceSessionId: string; formId: string; formChecksum: string; specificationVersion: '1.3'; scoringVersion: string; ruleVersion: 'stop_rule_v1'; visualProfile: StopVisualProfile; sourceReadOutcome: 'verified_complete' }>
  input_check_v13: Readonly<{ origin: 'fresh' | 'reused'; code: string; proof: Readonly<{ code: string; trustedDown: true; trustedUp: true; sameCode: true; unmodifiedDownAndUp: true; downWasNotRepeat: true; upWasNotRepeat: true }>; receiptId: string | null; tabNonce: string | null; inputDeviceClass: 'physical_keyboard'; physicalKeyboardDeclared: true; latencyAffectedInput: false; timingProfile: 'standard'; visualProfile: StopVisualProfile }>
  readiness_confirmed: Readonly<{ focused: boolean; visible: boolean }>
  fixation_started: Readonly<{ phase: StopTrialDefinition['phase']; expectedAtMs: number; actualAtMs: number }>
  fixation_ended: Readonly<{ phase: StopTrialDefinition['phase']; expectedAtMs: number; actualAtMs: number }>
  trial_scheduled: Readonly<{ trial: StopTrialDefinition; plannedOnsetMs: number; plannedVisibilityMs: number; plannedDeadlineMs: number }>
  stimulus_presented: Readonly<{ trialIndex: number; stimulus: StopStimulus; confirmedOnsetMs: number; frameDelayMs: number }>
  stimulus_removed: Readonly<{ trialIndex: number; confirmedOffsetMs: number; visibleDurationMs: number }>
  input_received: Readonly<{ keyClass: 'response' | 'wrong'; keyValue: string; keydownAtMs: number; repeated: boolean; held: boolean; focused: boolean; visible: boolean }>
  response_accepted: Readonly<{ trialIndex: number; responseTimeMs: number; stimulus: StopStimulus }>
  response_ignored: Readonly<{ trialIndex: number | null; reason: 'repeat' | 'extra' | 'wrong_key' | 'late' | 'held' | 'fixation' }>
  trial_timed_out: Readonly<{ trialIndex: number; actualDeadlineMs: number; deadlineLatenessMs: number }>
  trial_resolved: Readonly<{ trialIndex: number; outcome: StopTrialOutcome; source: 'response' | 'timeout'; anomalyFlags: readonly string[] }>
  visibility_changed: Readonly<{ visible: boolean }>
  focus_changed: Readonly<{ focused: boolean; durationMs: number | null }>
  page_lifecycle_changed: Readonly<{ state: 'pagehide' | 'freeze' | 'resume' | 'pageshow' }>
  timing_anomaly: Readonly<{ anomalyType: string; expectedMs: number; actualMs: number; severity: 'non_severe' | 'severe' }>
  session_invalidated: Readonly<{ ruleId: string; triggerSequenceNumber: number }>
  session_completed: Readonly<{ eventCount: number; validity: StopValidity; checksum: string }>
  report_viewed: Readonly<{ reportVersion: string }>
  drill_recommended: Readonly<{ ruleVersion: string; drillId: string; reasonMetrics: Readonly<Record<string, number>> }>
  drill_started: Readonly<{ ruleVersion: string; drillId: string; reasonMetrics: Readonly<Record<string, number>> }>
  drill_completed: Readonly<{ ruleVersion: string; drillId: string; reasonMetrics: Readonly<Record<string, number>> }>
  retest_reserved: Readonly<{ formId: string; chainId: string; status: string }>
  retest_exposed: Readonly<{ formId: string; chainId: string; status: string }>
  retest_completed: Readonly<{ formId: string; chainId: string; status: string }>
  history_deleted: Readonly<{ scope: 'individual' | 'all'; formId: string | null }>
  storage_failure: Readonly<{ errorClass: string; storageMode: StopStorageMode }>
}

export type StopEvent = {
  readonly [K in keyof StopEventPayloads]: Readonly<{
    readonly schemaVersion: typeof STOP_EVENT_SCHEMA_VERSION
    readonly type: K
    readonly sessionId: string
    readonly sequenceNumber: number
    readonly timestampMs: number
    readonly payload: StopEventPayloads[K]
  }>
}[keyof StopEventPayloads]

/** The result shape is supplied by the later approved scoring milestone. */
export interface StopSessionRecord<TSummary> {
  readonly schemaVersion: typeof STOP_SESSION_SCHEMA_VERSION
  readonly sessionId: string
  readonly chainId: string | null
  readonly mode: StopSessionMode
  readonly formFamily: StopStandardFormFamily | null
  readonly formId: string | null
  readonly formVersion: string | null
  readonly generatorVersion: string | null
  readonly seedId: string | null
  readonly manifestChecksum: string | null
  readonly scoringVersion: string | null
  readonly specificationVersion: typeof STOP_SPECIFICATION_VERSION | typeof STOP_V13_SPECIFICATION_VERSION
  readonly startedAtWall: string
  readonly completedAtWall: string | null
  readonly monotonicOriginMs: number
  readonly inputBinding: string
  readonly inputDeviceClass: string
  readonly visualProfile: StopVisualProfile
  readonly timingProfile: StopTimingProfile
  readonly accommodationId: 'shape_accommodation_v1' | null
  readonly viewportClass: string
  readonly browserFamily: string
  readonly browserVersion: string
  readonly storageMode: StopStorageMode
  readonly validity: StopValidity
  readonly realizedSequence: readonly StopStimulus[]
  readonly events: readonly StopEvent[]
  readonly summarySnapshot: DeepReadonly<TSummary> | null
}
