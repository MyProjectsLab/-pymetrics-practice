/** Arrows V1.0 headless form/stimulus contracts. Browser presentation is a later stage. */
export const ARROWS_SPEC_VERSION = 'arrows_spec_v1_0' as const
export const ARROWS_FORM_VERSION = 'arrows_forms_v1' as const
export const ARROWS_EVENT_VERSION = 'arrows_event_v1' as const
export const ARROWS_SCORING_VERSION = 'arrows_scoring_v1' as const
export const ARROWS_TIMING_VERSION = 'arrows_timing_v1' as const
export const ARROWS_INPUT_VERSION = 'arrows_input_v1' as const
export const ARROWS_STORAGE_VERSION = 'arrows_storage_v1' as const
export const ARROWS_ACTIVITY_VERSION = 'arrows_activity_v1' as const

export type FormId = 'AR1' | 'AR2' | 'AR3' | 'AR4' | 'AR5' | 'AR6'
export type Rule = 'center' | 'outer'
export type Condition = 'aligned' | 'opposed' | 'neutral'
export type Direction = 'left' | 'right'
export type Symbol = Direction | 'bar'

export interface Trial {
  readonly rule: Rule
  readonly condition: Condition
  readonly direction: Direction
  readonly block: number
  readonly index: number
}

export interface Form {
  readonly id: FormId
  readonly seed: number
  readonly attempts: number
  readonly trials: readonly Trial[]
}

export interface Stimulus {
  readonly trialIndex: number
  readonly block: number
  readonly cue: 'CENTER' | 'OUTER'
  readonly cueInstruction: string
  readonly targetPositions: readonly number[]
  readonly symbols: readonly Symbol[]
}
