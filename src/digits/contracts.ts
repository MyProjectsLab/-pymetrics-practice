export const DIGITS_SPEC_VERSION = 'digits_spec_v1_1' as const
export const DIGITS_FORMS_VERSION = 'digits_forms_v1_1' as const
export const DIGITS_EVENT_VERSION = 'digits_event_v1_1' as const
export const DIGITS_SCORING_VERSION = 'digits_scoring_v1_1' as const
export const DIGITS_STORAGE_VERSION = 'digits_storage_v1_1' as const

export const DIGITS_CONSTRUCTOR_VERSION = 'digits_constructor_v1_1' as const

export type Mode = 'visual' | 'auditory'
export type FormId = `DV${1 | 2 | 3 | 4 | 5 | 6}` | `DA${1 | 2 | 3 | 4 | 5 | 6}`
export interface Trial {
  readonly index: number
  readonly block: 0
  readonly length: number
  readonly digits: string
}
export interface Form {
  readonly id: FormId
  readonly mode: Mode
  readonly seed: number
  readonly version: typeof DIGITS_FORMS_VERSION
  readonly generatorVersion: typeof DIGITS_CONSTRUCTOR_VERSION
  readonly manifestDigest: string
}
export interface VoiceIdentity { readonly voiceURI: string; readonly lang: string; readonly localService: true }
export interface BrowserContext {
  readonly userAgent: string
  readonly viewportWidth: number
  readonly viewportHeight: number
  readonly devicePixelRatio: number
}
export interface Profile {
  readonly mode: Mode
  readonly entryWindow: 20000 | 35000
  readonly highContrast: boolean
  readonly reducedMotion: boolean
  readonly entryMethod: 'keyboard' | 'keypad'
  readonly assistedEntryDeclared: boolean
  readonly voice: VoiceIdentity | null
  readonly browserContext: BrowserContext
}
export interface Identity {
  readonly installationId: string
  readonly sessionId: string
  readonly requestId: string
  readonly clockDomainId: string
  readonly route: 'standalone' | { readonly kind: 'mock'; readonly mockRunId: string;
    readonly mockVersion: string; readonly gameIndex: 3 }
}
export type EventType = 'prepared' | 'form_assigned' | 'armed' | 'trial_started' |
  'digit_presented' | 'digit_ended' | 'speech_started' | 'speech_ended' |
  'entry_opened' | 'answer_committed' | 'trial_closed' | 'quality_note' | 'invalidated' | 'session_completed'
export interface DigitsEvent {
  readonly schemaVersion: typeof DIGITS_EVENT_VERSION
  readonly installationId: string
  readonly sessionId: string
  readonly formId: FormId
  readonly clockDomainId: string
  readonly sequenceNumber: number
  readonly block: number
  readonly trialIndex: number
  readonly atMs: number
  readonly type: EventType
  readonly detail: Readonly<Record<string, string | number | boolean | null>>
}
export interface ClosedTrial {
  readonly index: number
  readonly target: string
  readonly answer: string
  readonly skipped: boolean
  readonly timedOut: boolean
  readonly assistedEntry: boolean
  readonly source: 'keyboard' | 'keypad' | 'assisted' | 'timeout'
  readonly exactCorrect: boolean
}
export type Phase = 'armed' | 'presentation' | 'entry' | 'feedback' | 'completed' | 'invalid'
export type Command = Readonly<
  | { kind: 'start' | 'next'; atMs: number }
  | { kind: 'visual_onset' | 'visual_offset' | 'entry_opened'; dueMs: number; atMs: number }
  | { kind: 'speech_start'; requestMs: number; atMs: number; voiceURI: string; lang: string }
  | { kind: 'speech_end'; atMs: number; voiceURI: string; lang: string }
  | { kind: 'edit'; atMs: number; value: string; assisted: boolean; source: 'keyboard' | 'keypad' | 'assisted' }
  | { kind: 'submit' | 'skip' | 'timeout'; atMs: number }
  | { kind: 'invalidate'; atMs: number; reason: string }
  | { kind: 'quality'; atMs: number; reason: string }
>
export interface RunState {
  readonly specificationVersion: typeof DIGITS_SPEC_VERSION
  readonly scoringVersion: typeof DIGITS_SCORING_VERSION
  readonly form: Form
  readonly profile: Profile
  readonly identity: Identity
  readonly armedAtMs: number
  readonly phase: Phase
  readonly trialIndex: number
  readonly digitIndex: number
  readonly length: number
  readonly target: string | null
  readonly presentedTargets: readonly string[]
  readonly wrongCount: number
  readonly completionReason: 'three_mistakes' | 'practice_limit_reached' | null
  readonly presentedTrials: number
  readonly closed: readonly ClosedTrial[]
  readonly entryOpenedMs: number | null
  readonly entryDeadlineMs: number | null
  readonly nextDueMs: number | null
  readonly digitOnsetMs: number | null
  readonly speechStartMs: number | null
  readonly lastFrameMs: number | null
  readonly draft: string
  readonly draftAssisted: boolean
  readonly invalidReason: string | null
  readonly commands: readonly Command[]
  readonly events: readonly DigitsEvent[]
}
