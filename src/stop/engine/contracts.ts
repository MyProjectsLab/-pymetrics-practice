import type { RecordedEvent } from '../../core/events'
import type { StopTrialDefinition, StopTrialOutcome } from '../contracts'

export const ENGINE_EVENT_VERSION = 'stop_engine_event_v1' as const
export const VALIDITY_RULE_VERSION = 'stop_validity_v1' as const
export type Cancel = () => void
export interface EngineTiming {
  readonly visibilityMs: number
  readonly deadlineMs: number
  readonly fixationMs: number
}
export const STANDARD_TIMING: EngineTiming = Object.freeze({ visibilityMs: 200, deadlineMs: 1000, fixationMs: 1200 })

/** Every adapter uses the injected clock's origin and units. No Date/event.timeStamp/rAF clock. */
export interface Scheduler {
  at(timeMs: number, callback: () => void): Cancel
  /** Dispatch only when clock() > timeMs, preserving the inclusive input boundary. */
  after(timeMs: number, callback: () => void): Cancel
}
export interface FrameRequest {
  readonly kind: 'onset' | 'offset'
  readonly trial: StopTrialDefinition
  readonly notBeforeMs: number
}
export interface FrameAdapter {
  /** Confirm exactly once, synchronously with the first eligible rendered frame. */
  request(request: FrameRequest, confirm: () => void): Cancel
}
export type TimingIssue = 'visibility' | 'deadline' | 'onset' | 'post_resolution' | 'transition' | 'timestamp' | 'integrity'
export type IgnoreReason = 'repeat' | 'held' | 'wrong_key' | 'fixation' | 'late' | 'extra' | 'unfocused'
export type EngineState = 'idle' | 'waiting' | 'arming' | 'initial_fixation' | 'awaiting_onset' | 'response' | 'post_resolution' | 'warmup_restart_required' | 'invalid' | 'closed'
export type Setting = 'response_key' | 'visual_profile' | 'timing_profile' | 'input_device_class' | 'accessibility'
export interface EnginePayloads {
  protection_started: { responseKey: string; held: boolean }
  key_released: { key: string }
  fixation_started: { kind: 'initial' | 'post_resolution'; expectedAtMs: number; trialIndex: number | null }
  fixation_ended: { kind: 'initial' | 'post_resolution'; expectedAtMs: number; trialIndex: number | null }
  trial_scheduled: { trial: StopTrialDefinition; eligibleAtMs: number }
  stimulus_presented: { trialIndex: number; stimulus: StopTrialDefinition['stimulus']; confirmedOnsetMs: number; eligibleAtMs: number }
  stimulus_removed: { trialIndex: number; confirmedOffsetMs: number; visibleDurationMs: number }
  input_received: { key: string; repeated: boolean; held: boolean; focused: boolean; trialIndex: number | null }
  response_accepted: { trialIndex: number; responseTimeMs: number; anticipatory: boolean; inputSequenceNumber: number }
  response_ignored: { trialIndex: number | null; reason: IgnoreReason; inputSequenceNumber: number }
  trial_timed_out: { trialIndex: number; deadlineMs: number; latenessMs: number }
  trial_resolved: { trialIndex: number; outcome: StopTrialOutcome; source: 'response' | 'timeout'; resolvedAtMs: number; triggerSequenceNumber: number }
  timing_anomaly: { trialIndex: number | null; issues: readonly TimingIssue[]; severity: 'non_severe' | 'severe'; expectedMs: number; observedMs: number | null }
  quality_note: { ruleId: string; triggerSequenceNumber: number }
  session_invalidated: { ruleId: string; triggerSequenceNumber: number }
  visibility_changed: { visible: boolean }
  focus_changed: { focused: boolean; durationMs: number | null }
  page_lifecycle_changed: { state: 'pagehide' | 'freeze' | 'resume' | 'pageshow' }
  viewport_changed: { width: number; height: number }
  setting_changed: { setting: Setting }
  integrity_checked: { valid: boolean; detail: string }
  warmup_restart_required: { triggerSequenceNumber: number }
  warmup_interrupted: { reason: 'hidden' | 'blur' | 'pagehide' | 'freeze' | 'viewport' | 'settings'; triggerSequenceNumber: number }
  pre_onset_aborted: { reason: 'reservation_expired' }
  batch_finished: { phase: StopTrialDefinition['phase']; trialCount: number }
  session_completed: { eventCount: number; validity: 'valid' | 'valid_with_note'; checksum: string; scoringVersion: string }
  protection_ended: Record<string, never>
}
export type EngineEvent = RecordedEvent<EnginePayloads, typeof ENGINE_EVENT_VERSION>
export interface EngineOptions {
  sessionId: string
  /** Last sequence already emitted by a prior stage of this same session. */
  sequenceOffset?: number
  responseKey: string
  /** Run orchestration may begin an unprotected warm-up and activate scored protection later. */
  deferProtection?: boolean
  clock: () => number
  scheduler: Scheduler
  frames: FrameAdapter
  /** Receives already frozen events. Must not throw or re-enter the engine. */
  sink: (event: EngineEvent) => void
}
export interface TrialResult {
  readonly trial: StopTrialDefinition
  readonly outcome: StopTrialOutcome
  readonly resolvedAtMs: number
  /** Eligibility foundation only; scoring and denominator checks are outside M2B-1. */
  readonly timingExcluded: boolean
}
