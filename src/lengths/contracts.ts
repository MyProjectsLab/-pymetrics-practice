/** Frozen Lengths V1.0 identities. This module has no browser or storage behavior. */
export const LENGTHS_SPEC_VERSION = 'lengths_spec_v1_0' as const
export const LENGTHS_FORM_VERSION = 'lengths_forms_v1' as const
export const LENGTHS_TIMING_VERSION = 'lengths_timing_v1' as const
export const LENGTHS_INPUT_VERSION = 'lengths_input_v1' as const
export const LENGTHS_EVENT_VERSION = 'lengths_event_v1' as const
export const LENGTHS_SCORING_VERSION = 'lengths_scoring_v1' as const
export const LENGTHS_STORAGE_VERSION = 'lengths_storage_v1' as const
export const LENGTHS_ACTIVITY_VERSION = 'lengths_activity_v1' as const

export type Variant = 'standard' | 'visual_accommodation'
export type FormId = 'LS1' | 'LS2' | 'LS3' | 'LS4' | 'LS5' | 'LS6' |
  'LA1' | 'LA2' | 'LA3' | 'LA4' | 'LA5' | 'LA6'
export type GapCategory = 'small' | 'medium' | 'large'
export type Side = 'left' | 'right'
export interface Trial {
  readonly index: number
  readonly block: number
  readonly gapCategory: GapCategory
  readonly longerSide: Side
  readonly shortLength: number
  readonly longLength: number
}
export interface Form {
  readonly id: FormId
  readonly variant: Variant
  readonly seed: number
  readonly attempts: number
  readonly barHeight: number
  readonly trials: readonly Trial[]
}
