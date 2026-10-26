import type { FrameAdapter, Scheduler, Setting } from './engine/contracts'
import type { StopEngine } from './engine/engine'
import type { StopVisualProfile } from './contracts'
import fixation from './assets/fixation.svg?raw'
import standardGo from './assets/standard-go.svg?raw'
import standardNoGo from './assets/standard-no-go.svg?raw'
import shapeGo from './assets/shape-go.svg?raw'
import shapeNoGo from './assets/shape-no-go.svg?raw'

export function createBrowserScheduler(clock: () => number): Scheduler {
  function schedule(time: number, exclusive: boolean, callback: () => void) {
    let canceled = false
    let id: ReturnType<typeof setTimeout>
    function tick() {
      if (canceled) return
      const remaining = time - clock()
      if (remaining > 0 || (exclusive && remaining === 0)) {
        id = setTimeout(tick, Math.max(1, remaining))
      } else callback()
    }
    id = setTimeout(tick, Math.max(0, time - clock()))
    return () => { canceled = true; clearTimeout(id) }
  }
  return { at: (t, cb) => schedule(t, false, cb), after: (t, cb) => schedule(t, true, cb) }
}

/** DOM writes and confirmations share the eligible rAF and performance.now clock.
 * Layout presence is observable; browser APIs do not attest physical display scanout.
 * Inline original SVGs avoid network/image decode work during the protected interval. */
export function createBrowserCanvas(clock: () => number, profile: StopVisualProfile, failed: () => void = () => {}, beforeScoredOnset: () => boolean = () => true) {
  let host: HTMLElement | null = null
  const art = { fixation, GO: profile === 'standard' ? standardGo : shapeGo,
    NO_GO: profile === 'standard' ? standardNoGo : shapeNoGo }
  function paint(kind: keyof typeof art) {
    if (!host?.isConnected) throw new Error('Canvas is detached')
    host.innerHTML = art[kind]
    host.dataset.presentation = kind
    const svg = host.querySelector('svg')!
    svg.setAttribute('aria-hidden', 'true')
    svg.removeAttribute('role')
    const bounds = svg.getBoundingClientRect()
    if (bounds.width <= 0 || bounds.height <= 0 || host.getClientRects().length === 0 ||
      getComputedStyle(host).visibility === 'hidden') throw new Error('Stimulus is not visible in the DOM')
  }
  return {
    attach(element: HTMLElement) { host = element },
    fixation: () => paint('fixation'),
    clear() { if (host) { host.replaceChildren(); delete host.dataset.presentation } },
    frames: { request(request, confirm) {
      let canceled = false
      let id = 0
      const render = () => {
        if (canceled) return
        if (clock() < request.notBeforeMs) { id = requestAnimationFrame(render); return }
        // A failed DOM check withholds confirmation; the engine watchdog stops it.
        try {
          if (request.kind === 'onset' && request.trial.phase === 'scored' && !beforeScoredOnset()) throw new Error('Reservation expired before scored presentation')
          paint(request.kind === 'onset' ? request.trial.stimulus : 'fixation')
        } catch { failed(); return }
        confirm()
      }
      id = requestAnimationFrame(render)
      return () => { canceled = true; cancelAnimationFrame(id) }
    } } satisfies FrameAdapter,
  }
}

export function bindBrowserEvents(engine: StopEngine, responseKey: string, activeNow: () => boolean, keyReleaseNow: () => boolean = () => false) {
  const remove: (() => void)[] = []
  const down = new Set<string>()
  function listen(target: EventTarget, type: string, listener: EventListener, capture = false) {
    target.addEventListener(type, listener, capture)
    remove.push(() => target.removeEventListener(type, listener, capture))
  }
  const guarded = (fn: (e: Event) => void): EventListener => e => { if (activeNow()) fn(e) }
  listen(window, 'keydown', guarded(e => {
    const key = e as KeyboardEvent
    if (key.code === responseKey) key.preventDefault()
    const chord = key.ctrlKey || key.metaKey || key.altKey || key.shiftKey || key.isComposing
    const inheritedModifiedHold = down.has(key.code) && !engine.snapshot().held
    down.add(key.code)
    engine.keyDown(chord ? `modified:${key.code}` : key.code, key.repeat || (!chord && inheritedModifiedHold))
  }), true)
  listen(window, 'keyup', e => {
    if (!activeNow() && !keyReleaseNow()) return
    const key = e as KeyboardEvent
    if (key.code === responseKey) key.preventDefault()
    down.delete(key.code)
    engine.keyUp(key.code)
  }, true)
  listen(document, 'visibilitychange', guarded(() => engine.visibility(document.visibilityState === 'visible')))
  listen(window, 'blur', guarded(() => engine.focus(false)))
  listen(window, 'focus', guarded(() => engine.focus(true)))
  for (const event of ['pagehide', 'pageshow'] as const) listen(window, event, guarded(() => engine.lifecycle(event)))
  for (const event of ['freeze', 'resume'] as const) listen(document, event, guarded(() => engine.lifecycle(event)))
  const dpr = window.devicePixelRatio
  listen(window, 'resize', guarded(() => {
    engine.resize(window.innerWidth, window.innerHeight)
    if (window.devicePixelRatio !== dpr) engine.settingChanged('accessibility')
  }))
  listen(window, 'error', guarded(() => engine.technicalFailure('Unhandled browser error during protected interval')))
  listen(window, 'unhandledrejection', guarded(() => engine.technicalFailure('Unhandled promise rejection during protected interval')))
  listen(window, 'popstate', guarded(() => engine.lifecycle('pagehide')))
  listen(window, 'beforeunload', guarded(() => engine.lifecycle('pagehide')))
  // Reject an in-app exit before React removes the recovery UI. Browser navigation
  // cannot be prevented reliably; lifecycle records remain in memory while possible.
  listen(document, 'click', guarded(e => {
    const target = e.target instanceof Element ? e.target.closest('a[href], button.brand') : null
    if (!target) return
    e.preventDefault(); e.stopPropagation(); engine.lifecycle('pagehide')
  }), true)
  for (const query of ['(prefers-reduced-motion: reduce)', '(prefers-contrast: more)', '(forced-colors: active)']) {
    const media = window.matchMedia?.(query)
    if (media) listen(media, 'change', guarded(() => engine.settingChanged('accessibility')))
  }
  return {
    settingsAttempt(setting: Setting) { if (activeNow()) engine.settingChanged(setting) },
    dispose() { remove.forEach(fn => fn()) },
  }
}
