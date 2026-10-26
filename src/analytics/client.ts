import { validPayload } from './contract'
import type { CoarseEvent, AnalyticsRowInput } from './contract'
export const candidateAnalyticsAvailable = import.meta.env.VITE_STOP_ANALYTICS_CANDIDATE === 'true'
// No storage, cookies, beacon, retries, unload delivery, or event-time timestamps.
// This build switch permits local consent testing; it never enables the server.
export function createAnalyticsClient({ available = false, send = fetch, randomId = () => crypto.randomUUID() }: {
  available?: boolean; send?: typeof fetch; randomId?: () => string
} = {}) {
  let consent = false, id: string | null = null, timer: ReturnType<typeof setTimeout> | null = null
  let queue: AnalyticsRowInput[] = [], flight: AbortController | null = null
  const busy = new Map<() => boolean, { retired: boolean }>()
  const subscribers = new Set<() => void>()
  function cancel() {
    if (timer !== null) clearTimeout(timer)
    timer = null
    flight?.abort(); flight = null
  }
  function kick() {
    if (!available || !consent || timer !== null || flight || !queue.length) return
    timer = setTimeout(() => { timer = null; void drain() }, 0)
  }
  async function drain() {
    if (!available || !consent || flight) return
    let blocked = false
    for (const [check, owner] of busy) {
      if (check()) blocked = true
      else if (owner.retired) busy.delete(check)
    }
    if (blocked) return
    const row = queue.shift()
    if (!row) return
    const controller = new AbortController()
    flight = controller
    const timeout = setTimeout(() => controller.abort(), 3000)
    try {
      await send('/api/stop-analytics', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(row), credentials: 'omit', mode: 'same-origin', cache: 'no-store',
        redirect: 'error', referrerPolicy: 'no-referrer', signal: controller.signal })
    } catch { /* Deliberately no product state, diagnostics, logging, or retry. */ }
    finally {
      clearTimeout(timeout)
      if (flight === controller) { flight = null; kick() }
    }
  }
  return {
    consented: () => consent,
    subscribe(listener: () => void) { subscribers.add(listener); return () => { subscribers.delete(listener) } },
    setConsent(value: boolean) {
      cancel(); queue = []; id = null; consent = available && value
      // New consent epoch gets a new random identifier, never a task/history id.
      if (consent) { try { id = randomId() } catch { consent = false } }
      for (const listener of subscribers) listener()
    },
    emit(event: CoarseEvent) {
      if (!available || !consent || !id || queue.length >= 64) return
      const row = { ...event, session_id: id }
      if (!validPayload(row)) return
      queue.push(row); kick()
    },
    // Register before starting timed work. Abort any pending network operation.
    // Busy checks only query coarse UI state; no task record reaches this module.
    hold(check: () => boolean) {
      cancel()
      const owner = { retired: false }
      busy.set(check, owner)
      return () => {
        // Leaving a component must not remove a still-pending save hold.
        // The next ordinary UI event/transition can drain after it has settled.
        owner.retired = true
        if (!check()) busy.delete(check)
        kick()
      }
    },
    kick,
  }
}
export const stopAnalytics = createAnalyticsClient({ available: candidateAnalyticsAvailable })
if (typeof window !== 'undefined') {
  // bfcache restoration also begins with consent off and no identifier.
  window.addEventListener('pagehide', () => stopAnalytics.setConsent(false))
}
