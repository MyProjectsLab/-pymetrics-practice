// QA-only sidecar. Install into dist after building; never imported by the app.
// Real browser clock, frames, input, engine, scoring and IndexedDB are unchanged.
const probeKey = 'stop-v12-repair-probe'
const trace = JSON.parse(sessionStorage.getItem(probeKey) || '[]')
const record = detail => {
  trace.push({ at: new Date().toISOString(), ...detail })
  sessionStorage.setItem(probeKey, JSON.stringify(trace))
}
const panel = document.createElement('aside')
panel.setAttribute('aria-label', 'QA evidence controls')
panel.style.cssText = 'position:fixed;right:4px;bottom:4px;background:white;color:black;border:1px solid black;padding:4px;z-index:1000;font-size:12px;max-width:400px'
const status = document.createElement('pre')
status.style.cssText = 'max-height:150px;overflow:auto;white-space:pre-wrap'
status.textContent = 'QA sidecar: native events observed; injection is explicit.'
const button = (name, action) => {
  const element = document.createElement('button')
  element.textContent = name
  element.onclick = action
  panel.append(element)
}
for (const [target, names] of [[document, ['visibilitychange', 'freeze', 'resume']], [window, ['blur', 'focus', 'pagehide', 'pageshow']]]) {
  for (const type of names) target.addEventListener(type, event => record({ type, trusted: event.isTrusted, visibility: document.visibilityState }), true)
}
for (const type of ['keydown', 'keyup']) document.addEventListener(type, event => {
  const target = event.target?.textContent?.slice(0, 80)
  queueMicrotask(() => record({ type, code: event.code, trusted: event.isTrusted, prevented: event.defaultPrevented, target }))
}, true)
button('Inject warm-up hidden event (QA)', () => {
  const live = document.querySelector('[data-game-focus]:not([hidden])')
  if (!live) { status.textContent = 'No injection: warm-up is not live.'; return }
  record({ type: 'INJECTED_HIDDEN_BEGIN', presentation: live.querySelector('[data-presentation]')?.dataset.presentation })
  const descriptor = Object.getOwnPropertyDescriptor(document, 'visibilityState')
  try {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    document.dispatchEvent(new Event('visibilitychange'))
  } finally {
    if (descriptor) Object.defineProperty(document, 'visibilityState', descriptor)
    else delete document.visibilityState
    document.dispatchEvent(new Event('visibilitychange'))
  }
  status.textContent = 'Injected visibilitychange (isTrusted=false); native visibility restored.'
})
const digest = async value => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)))), b => b.toString(16).padStart(2, '0')).join('')
button('Read durable evidence (QA)', async () => {
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open('assessment-practice-stop', 1)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  const state = await new Promise((resolve, reject) => {
    const request = db.transaction('installation', 'readonly').objectStore('installation').get('stop')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  db.close()
  const results = await Promise.all(Object.values(state.results).map(async result => ({
    sessionId: result.sessionId, form: result.form.id, validity: result.validity, storageMode: result.storageMode,
    counts: result.summarySnapshot.counts, events: result.events.length, hash: await digest(result),
    diagnostics: result.events.filter(event => ['visibility_changed', 'warmup_interrupted', 'warmup_restart_required', 'session_invalidated', 'batch_finished', 'session_completed', 'protection_started', 'protection_ended'].includes(event.type)),
    scheduled: result.events.filter(event => event.type === 'trial_scheduled').map(event => event.payload.trial),
  })))
  const evidence = { label: 'Production app with QA observer; any injection is explicitly recorded; real timers and IndexedDB',
    userAgent: navigator.userAgent, viewport: { width: innerWidth, height: innerHeight },
    scripts: [...document.scripts].map(script => script.src), trace, results, state }
  status.textContent = JSON.stringify({ viewport: evidence.viewport, results: results.map(({ scheduled, ...result }) => ({ ...result, scheduledCount: scheduled.length })), nativeHidden: trace.filter(event => event.type === 'visibilitychange' && event.visibility === 'hidden' && event.trusted), injectedHidden: trace.filter(event => event.type === 'INJECTED_HIDDEN_BEGIN') }, null, 2)
  const response = await fetch('http://127.0.0.1:5590/evidence', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(evidence) })
  if (!response.ok) throw new Error('Local QA evidence write failed')
  let link = panel.querySelector('a')
  if (!link) { link = document.createElement('a'); panel.append(link) }
  link.textContent = 'Download QA evidence'
  link.download = 'stop-v12-repair-evidence.json'
  link.href = URL.createObjectURL(new Blob([JSON.stringify(evidence, null, 2)], { type: 'application/json' }))
})
panel.append(status)
document.body.append(panel)
