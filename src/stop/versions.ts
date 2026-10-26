/** Founder-approved product specification; changing this requires a new approval. */
export const STOP_SPECIFICATION_VERSION = '1.1' as const

/** These are repository schema identities, not new scoring or gameplay rules. */
export const STOP_FORM_SCHEMA_VERSION = 'stop_form_manifest_v1' as const
export const STOP_SESSION_SCHEMA_VERSION = 'stop_session_v1' as const
export const STOP_EVENT_SCHEMA_VERSION = 'stop_event_v1' as const
export const STOP_FORM_GENERATOR_VERSION = 'stop_standard_generator_v1' as const

export const STOP_STANDARD_FORM_VERSION = '1' as const
export const STOP_SCORING_VERSION = 'stop_scoring_v1' as const
export const STOP_REPORT_VERSION = 'stop_report_v1' as const

/** New standard forms coexist with, and never rewrite, the V1.1 inventory. */
export const STOP_V13_SPECIFICATION_VERSION = '1.3' as const
export const STOP_V13_FORM_SCHEMA_VERSION = 'stop_form_manifest_v2' as const
export const STOP_V13_FORM_VERSION = '2' as const
export const STOP_V13_GENERATOR_VERSION = 'stop_variable_mix_generator_v1' as const
export const STOP_V13_SCORING_VERSION = 'stop_scoring_v13' as const
export const STOP_V13_REPORT_VERSION = 'stop_report_v13' as const
