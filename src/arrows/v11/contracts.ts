/** Arrows V1.1 headless form/stimulus contracts. Browser presentation is a later stage. */
export const ARROWS_SPEC_VERSION = 'arrows_spec_v1_1' as const
export const ARROWS_FORM_VERSION = 'arrows_forms_v1_1' as const
export const ARROWS_EVENT_VERSION = 'arrows_event_v1_1' as const
export const ARROWS_SCORING_VERSION = 'arrows_scoring_v1_1' as const
export const ARROWS_TIMING_VERSION = 'arrows_timing_v1' as const
export const ARROWS_INPUT_VERSION = 'arrows_input_v1' as const
export const ARROWS_STORAGE_VERSION = 'arrows_storage_v2' as const
export const ARROWS_ACTIVITY_VERSION = 'arrows_activity_v1' as const

export type FormId = 'AR11-1' | 'AR11-2' | 'AR11-3' | 'AR11-4' | 'AR11-5' | 'AR11-6'
export type Rule = 'middle' | 'sides'
export type Condition = 'aligned' | 'opposed' | 'neutral'
export type Direction = 'left' | 'right'
export type Symbol = Direction | 'bar'

export type Color = 'red' | 'blue' | 'black'
export interface Trial {
  readonly color: Color
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
  readonly color: Color
  readonly trialIndex: number
  readonly block: number
  readonly cue: 'MIDDLE' | 'SIDES'
  readonly cueInstruction: string
  readonly targetPositions: readonly number[]
  readonly symbols: readonly Symbol[]
}

export const ARROWS_PRESENTATION_VERSION = 'arrows_presentation_v1_1' as const
