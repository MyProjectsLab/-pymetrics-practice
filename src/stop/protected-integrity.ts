import type { EngineEvent } from './engine/contracts'

/** Reconcile §14 evidence even when a derived invalidation record is missing. */
export function verifyProtectedEvidence(events: readonly EngineEvent[]): boolean {
  const start = events.findIndex(e => e.type === 'protection_started')
  const end = events.findIndex(e => e.type === 'session_completed')
  if (start < 0 || end <= start) return false
  let blurAt: number | null = null
  let phase: string | null = null
  let warmupAnomalies = 0
  let warmupRestart: number | null = null
  for (const event of events.slice(start, end + 1)) {
    if (blurAt !== null && event.timestampMs - blurAt > 1000) return false
    if (event.type === 'visibility_changed' && event.payload.visible !== true ||
      event.type === 'page_lifecycle_changed' || event.type === 'setting_changed' ||
      event.type === 'viewport_changed' && (!Number.isFinite(event.payload.width) || !Number.isFinite(event.payload.height) ||
        event.payload.width < 768 || event.payload.height < 600)) return false
    if (event.type === 'focus_changed') {
      if (!event.payload.focused) {
        if (blurAt !== null || event.payload.durationMs !== null) return false
        blurAt = event.timestampMs
      } else {
        if (blurAt === null || event.payload.durationMs !== event.timestampMs - blurAt) return false
        blurAt = null
      }
    }
    if (event.type === 'trial_scheduled') phase = event.payload.trial.phase
    if (event.type === 'timing_anomaly') {
      if (phase === 'warmup' && !event.payload.issues.some(issue => issue === 'timestamp' || issue === 'integrity')) {
        if (++warmupAnomalies > 1) return false
        warmupRestart = event.sequenceNumber
      } else if (event.payload.severity !== 'non_severe') return false
    }
    if (event.type === 'warmup_restart_required') {
      if (warmupRestart !== event.payload.triggerSequenceNumber) return false
      warmupRestart = null
    }
    if (event.type === 'response_accepted') {
      const input = events.find(e => e.sequenceNumber === event.payload.inputSequenceNumber)
      if (input?.type !== 'input_received' || input.payload.held || input.payload.repeated || !input.payload.focused) return false
    }
  }
  return warmupRestart === null
}
