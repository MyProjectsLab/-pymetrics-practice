/** Headless Balloons B1-A contracts. Persistence and browser action admission are later stages. */
export const BALLOONS_SPEC_VERSION = 'balloons-v1.0' as const
export const BALLOONS_SCORING_VERSION = 'balloons-scoring-v1' as const
export const BALLOONS_FORM_VERSION = 'balloons-scored-v1' as const
export const BALLOONS_ROUTER_VERSION = 'balloons-router-v1' as const
export const BALLOONS_EVENT_VERSION = 'balloons-event-v1' as const
export const BALLOONS_PAYOUT_CENTS = 5 as const
export const BALLOONS_CAP = 32 as const
export const BALLOONS_ROUND_COUNT = 39 as const

export type Profile = 'A' | 'B' | 'C'
export type VisibleType = 'Type 1' | 'Type 2' | 'Type 3'
export type Mapping = Readonly<Record<VisibleType, Profile>>
export type FormId = 'BL1' | 'BL2' | 'BL3' | 'RP1' | 'RP2' | 'RP3' | 'RT1' | 'RT2' | 'RT3'
export type FormFamily = 'baseline' | 'replay' | 'retest'
export interface ManifestRound { readonly round: number; readonly profile: Profile; readonly threshold: number }
export interface ScoredManifest {
  readonly id: FormId
  readonly family: FormFamily
  readonly candidateSeed: number
  readonly rounds: readonly ManifestRound[]
  readonly playableSignatureSha256: string
  readonly sha256: string
}
export type Stage = 'baseline' | 'replay' | 'retest' | 'mock'
export type ActionSource = 'keyboard' | 'mouse' | 'touch_or_pen' | 'unknown_or_assistive'
export type Outcome = 'voluntary_collect' | 'cap_collect' | 'burst'
export interface RoundResult {
  readonly round: number
  readonly profile: Profile
  readonly visibleType: VisibleType
  readonly attemptedPumps: number
  readonly successfulPumps: number
  readonly voluntaryPoint: number | null
  readonly bankedCents: number
  readonly lostCents: number
  readonly outcome: Outcome
  readonly censored: boolean
}
export interface ActionTotals {
  readonly attemptedPumps: number
  readonly successfulPumps: number
  readonly currentCents: number
  readonly bankedCents: number
  readonly lostCents: number
}
export type EventType = 'round_presented' | 'pump_attempted' | 'voluntary_collected' | 'cap_collected' | 'round_resolved' | 'session_completed'
export interface CoreEvent {
  readonly schemaVersion: typeof BALLOONS_EVENT_VERSION
  readonly specificationVersion: typeof BALLOONS_SPEC_VERSION
  readonly formVersion: typeof BALLOONS_FORM_VERSION
  readonly scoringVersion: typeof BALLOONS_SCORING_VERSION
  readonly routerVersion: typeof BALLOONS_ROUTER_VERSION
  readonly installationId: string
  readonly sessionId: string
  readonly chainId: string | null
  readonly stage: Stage
  readonly manifestId: FormId
  readonly manifestSha256: string
  readonly mapping: Mapping
  readonly round: number
  readonly sequenceNumber: number
  readonly actionId: number | null
  readonly source: ActionSource | null
  readonly wallTimeMs: number
  readonly clockEpochId: string
  readonly monotonicMs: number
  readonly exposureGeneration: number
  readonly ownershipGeneration: number
  readonly pre: ActionTotals
  readonly post: ActionTotals
  readonly type: EventType
  readonly outcome: Outcome | 'pump_success' | null
  readonly validityCode: 'headless_unconfirmed'
}
export interface EventTime { readonly wallTimeMs: number; readonly monotonicMs: number; readonly clockEpochId: string }
export interface SessionIdentity {
  readonly installationId: string
  readonly sessionId: string
  readonly chainId: string | null
  readonly stage: Stage
  readonly mapping: Mapping
  readonly exposureGeneration: number
  readonly ownershipGeneration: number
}
export interface RoundProgress {
  readonly attemptedPumps: number
  readonly successfulPumps: number
  readonly currentCents: number
}
export interface CoreState {
  readonly identity: SessionIdentity
  readonly manifest: ScoredManifest
  readonly status: 'active' | 'resolved' | 'completed'
  readonly round: number
  readonly revision: number
  readonly nextActionId: number
  readonly current: RoundProgress
  readonly bankedCents: number
  readonly lostCents: number
  readonly results: readonly RoundResult[]
  readonly events: readonly CoreEvent[]
}
export interface CoreAction {
  readonly kind: 'pump' | 'collect' | 'next'
  readonly actionId: number
  readonly expectedRound: number
  readonly expectedRevision: number
  readonly source: ActionSource
  readonly time: EventTime
}
