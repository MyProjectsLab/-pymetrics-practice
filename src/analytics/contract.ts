// Stop §23.5 only. Technical spellings are M6-B review proposals.
export const emptyEvents = [
  'stop_guide_opened', 'stop_report_viewed', 'stop_training_recommendation_shown',
  'stop_drill_started', 'stop_drill_completed', 'stop_retest_started', 'stop_retest_completed',
] as const
export type CoarseEvent =
  | { event: typeof emptyEvents[number] }
  | { event: 'stop_session_started'; mode: 'baseline' | 'replay' | 'retest' }
  | { event: 'stop_session_ended'; status: 'completed' | 'invalid' | 'technical_failure' }
  | { event: 'stop_device_check_completed'; passed: boolean; reason: 'none' | 'input_check_failed' | 'viewport_unsupported' | 'browser_unsupported' }
  | { event: 'stop_storage_failure'; error_class: 'unavailable' | 'write_failed' }
  | { event: 'stop_technical_error'; error_class: 'record_integrity' | 'report_render_failed' }
export type AnalyticsRowInput = CoarseEvent & { session_id: string }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
function exact(value: Record<string, unknown>, fields: readonly string[]) {
  return Object.keys(value).length === fields.length && fields.every(key => Object.hasOwn(value, key))
}
export function validPayload(input: unknown): input is AnalyticsRowInput {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return false
  const value = input as Record<string, unknown>
  if (typeof value.session_id !== 'string' || !uuid.test(value.session_id) || typeof value.event !== 'string') return false
  const keys = ['session_id', 'event']
  if ((emptyEvents as readonly string[]).includes(value.event)) return exact(value, keys)
  switch (value.event) {
    case 'stop_session_started': return exact(value, [...keys, 'mode']) && ['baseline', 'replay', 'retest'].includes(value.mode as string)
    case 'stop_session_ended': return exact(value, [...keys, 'status']) && ['completed', 'invalid', 'technical_failure'].includes(value.status as string)
    case 'stop_device_check_completed': return exact(value, [...keys, 'passed', 'reason']) && typeof value.passed === 'boolean' &&
      (value.passed ? value.reason === 'none' : ['input_check_failed', 'viewport_unsupported', 'browser_unsupported'].includes(value.reason as string))
    case 'stop_storage_failure': return exact(value, [...keys, 'error_class']) && ['unavailable', 'write_failed'].includes(value.error_class as string)
    case 'stop_technical_error': return exact(value, [...keys, 'error_class']) && ['record_integrity', 'report_render_failed'].includes(value.error_class as string)
    default: return false
  }
}
