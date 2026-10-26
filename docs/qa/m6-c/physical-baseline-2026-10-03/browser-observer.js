// QA-only native-browser observer. No event injection, product mutation, or clock override.
(() => {
  const storageKey = 'stop-physical-baseline-browser-events-v1'
  const timeOriginMs = performance.timeOrigin
  let events = []
  try { events = JSON.parse(localStorage.getItem(storageKey) || '[]') } catch {}
  let dirty = false
  const flush = () => {
    if (!dirty) return
    localStorage.setItem(storageKey, JSON.stringify(events))
    dirty = false
  }
  const record = (type, event, extra = {}) => {
    events.push({
      type, utc: new Date().toISOString(), epochMs: Date.now(), timeOriginMs,
      performanceNowMs: performance.now(), eventTimeStampMs: event?.timeStamp ?? null,
      isTrusted: event?.isTrusted ?? null, visibilityState: document.visibilityState,
      hasFocus: document.hasFocus(), href: location.href,
      innerWidth, innerHeight, devicePixelRatio,
      screen: { width: screen.width, height: screen.height, availWidth: screen.availWidth,
        availHeight: screen.availHeight },
      ...extra,
    })
    dirty = true
  }
  for (const type of ['keydown', 'keyup']) {
    document.addEventListener(type, event => record(type, event, {
      key: event.key, code: event.code, repeat: event.repeat, location: event.location,
      altKey: event.altKey, ctrlKey: event.ctrlKey, metaKey: event.metaKey,
      shiftKey: event.shiftKey, targetTag: event.target?.tagName ?? null,
    }), true)
  }
  for (const type of ['visibilitychange', 'freeze', 'resume']) {
    document.addEventListener(type, event => record(type, event), true)
  }
  for (const type of ['blur', 'focus', 'pagehide', 'pageshow', 'resize']) {
    window.addEventListener(type, event => { record(type, event); if (type === 'pagehide') flush() }, true)
  }
  record('probe_loaded', null, { userAgent: navigator.userAgent })
  setInterval(() => { record('window_sample', null); flush() }, 2000)
  setInterval(flush, 250)
})()
