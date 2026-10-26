export const COLLECTION_ENDPOINT = 'https://gateway.umami.is/api/send'
const pages: Record<string, string> = {
  '/': '/', '/pymetrics-practice.html': '/info/1', '/blackstone-pymetrics.html': '/info/2',
}
// Fixed neutral labels; never employer names, actual guide titles, query values or task data.
const selections: Record<string, string> = {
  '/practice': 'library_selected', '/mock': 'mock_selected',
  '/practice/stop': 'stop_selected', '/practice/balloons': 'balloons_selected',
  '/practice/keypresses': 'keypresses_selected', '/practice/digits': 'digits_selected',
  '/practice/cards': 'cards_selected', '/practice/easy-or-hard': 'easy_hard_selected',
  '/practice/towers': 'towers_selected', '/arrows.html': 'arrows_selected',
  '/mouth-v13.html': 'lengths_selected', '/money.html': 'money_1_selected',
  '/money2.html': 'money_2_selected', '/faces.html': 'faces_selected',
}
export interface UsageContext {
  protocol: string; hostname: string; pathname: string; search: string
  visible: boolean; dnt: boolean; gpc: boolean
}
export function browserUsageContext(): UsageContext {
  return { protocol: location.protocol, hostname: location.hostname, pathname: location.pathname,
    search: location.search, visible: document.visibilityState === 'visible',
    dnt: navigator.doNotTrack === '1' || navigator.doNotTrack === 'yes',
    gpc: (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true }
}
export function createMarketingUsage(website: string, context = browserUsageContext, send: typeof fetch = fetch) {
  let enabled = false, viewed = false, retired = false, revision = 0, flight: AbortController | null = null
  let submittedSelection: AbortController | null = null
  let timeout: ReturnType<typeof setTimeout> | undefined
  const listeners = new Set<() => void>()
  const configured = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(website)
  function allowed() {
    const c = context()
    return configured && !retired && c.protocol === 'https:' && c.hostname === 'traitgame.com' &&
      Object.hasOwn(pages, c.pathname) && !c.search && c.visible && !c.dnt && !c.gpc
  }
  function announce() { revision++; listeners.forEach(fn => fn()) }
  function abortTransport() {
    if (timeout !== undefined) clearTimeout(timeout)
    timeout = undefined
    const previous = flight; flight = null; submittedSelection = null; previous?.abort()
  }
  function revoke() {
    enabled = false; abortTransport(); announce()
  }
  function prepare(name?: string) {
    if (!enabled || !allowed() || flight || name && !Object.values(selections).includes(name)) return null
    return { website, hostname: 'traitgame.com', url: pages[context().pathname], ...(name ? { name } : {}) }
  }
  function transmit(payload: NonNullable<ReturnType<typeof prepare>>, finishAfterNavigation = false) {
    // No queue, retry, beacon, response parsing or provider identifier reuse.
    const controller = new AbortController()
    flight = controller
    submittedSelection = finishAfterNavigation ? controller : null
    // This bounds active-document work, not a browser-owned request after teardown.
    timeout = setTimeout(() => { if (flight === controller) { flight = null; submittedSelection = null; controller.abort() } }, 2000)
    try {
      void send(COLLECTION_ENDPOINT, { method: 'POST', credentials: 'omit', referrerPolicy: 'no-referrer',
        cache: 'no-store', redirect: 'error', signal: controller.signal,
        ...(finishAfterNavigation ? { keepalive: true } : {}),
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'event', payload }) })
        .catch(() => { /* Analytics failure never becomes a product failure. */ })
        .finally(() => { if (flight === controller) { clearTimeout(timeout); timeout = undefined; flight = null; submittedSelection = null } })
    } catch { if (flight === controller) { clearTimeout(timeout); timeout = undefined; flight = null; submittedSelection = null } }
  }
  function record(name?: string) { const payload = prepare(name); if (payload) transmit(payload) }
  function pause() {
    enabled = false
    // Only the tiny, previously submitted navigation selection may finish. There
    // is no new send at hide/unload and no client in the destination game.
    if (!submittedSelection || flight !== submittedSelection) abortTransport()
    announce()
  }
  return {
    available: allowed,
    active: () => enabled && allowed(),
    snapshot: () => revision,
    subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn) } },
    start(countView = true) {
      enabled = allowed()
      if (enabled && !viewed) {
        viewed = true
        if (countView) record()
      }
    },
    selection(path: string) { if (Object.hasOwn(selections, path)) record(selections[path]) },
    navigate(path: string) {
      abortTransport()
      const payload = Object.hasOwn(selections, path) ? prepare(selections[path]) : null
      retired = true; enabled = false
      if (payload) transmit(payload, true)
      announce()
    },
    refresh: announce,
    pause,
    leave() { retired = true; pause() },
    retire() { retired = true; revoke() },
  }
}
export type MarketingUsageClient = ReturnType<typeof createMarketingUsage>
