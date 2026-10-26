export const MOUTH_SPEC_VERSION = 'lengths_mouth_spec_v1_3' as const
export const MOUTH_FORM_VERSION = 'lengths_mouth_forms_v1_3' as const
export const MOUTH_TIMING_VERSION = 'lengths_mouth_timing_v1' as const
export const MOUTH_INPUT_VERSION = 'lengths_mouth_input_v1' as const
export const MOUTH_EVENT_VERSION = 'lengths_mouth_event_v2' as const
export const MOUTH_SCORING_VERSION = 'lengths_mouth_scoring_v2' as const
export const MOUTH_REPORT_VERSION = 'lengths_mouth_report_v1_3' as const
export const MOUTH_STORAGE_VERSION = 'lengths_mouth_storage_v1_3' as const
export const MOUTH_ACTIVITY_VERSION = 'lengths_mouth_activity_v1' as const
export type Variant = 'standard' | 'visual_accommodation'
export type FormId = 'LM13-1' | 'LM13-2' | 'LM13-3' | 'LM13-4' | 'LM13-5' | 'LM13-6'
export type Side = 'short' | 'long'
export interface Trial { readonly index: number; readonly block: number; readonly mouth: Side; readonly rewardEligible: boolean; readonly rewardCents: 0 | 10 | 50 }
export interface Form { readonly id: FormId; readonly seed: number; readonly richSide: Side; readonly surplusSet: number; readonly tenCentTrial: number; readonly trials: readonly Trial[]; readonly sha256: string }
