import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { bindBrowserEvents, createBrowserCanvas, createBrowserScheduler } from './browser'
import { fixture } from './engine/fixture'
import { RULE } from './engine/rules'

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); document.body.replaceChildren() })

describe('production browser scheduler', () => {
  it('never dispatches early and preserves the strictly-after deadline contract', () => {
    let now = 0
    const scheduler = createBrowserScheduler(() => now)
    const inclusive = vi.fn(), exclusive = vi.fn(), canceled = vi.fn()
    scheduler.at(1000, inclusive); scheduler.after(1000, exclusive)
    scheduler.at(1000, canceled)()
    now = 999; vi.advanceTimersByTime(1000)
    expect(inclusive).not.toHaveBeenCalled()
    now = 1000; vi.advanceTimersByTime(1)
    expect(inclusive).toHaveBeenCalledOnce()
    expect(exclusive).not.toHaveBeenCalled()
    now = 1000.001; vi.advanceTimersByTime(1)
    expect(exclusive).toHaveBeenCalledOnce()
    expect(canceled).not.toHaveBeenCalled()
  })
})

describe('DOM/frame adapter', () => {
  it.each(['standard', 'shape_accommodation_v1'] as const)('confirms actual %s DOM changes on eligible animation frames', profile => {
    let now = 0
    const frames: FrameRequestCallback[] = []
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => { frames.push(cb); return frames.length })
    const canvas = createBrowserCanvas(() => now, profile)
    const host = document.createElement('div'); document.body.append(host); canvas.attach(host)
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ width: 128, height: 128 } as DOMRect)
    vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList)
    canvas.fixation()
    const confirm = vi.fn(() => expect(host.dataset.presentation).toBe('GO'))
    canvas.frames.request({ kind: 'onset', notBeforeMs: 1000, trial: { phase: 'scored', index: 0, stimulus: 'GO' } }, confirm)
    now = 999; frames.shift()!(2000) // rAF's own timestamp is deliberately not our clock
    expect(confirm).not.toHaveBeenCalled()
    now = 1000; frames.shift()!(9000)
    expect(confirm).toHaveBeenCalledOnce()
    expect(host.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    const offset = vi.fn(() => expect(host.dataset.presentation).toBe('fixation'))
    canvas.frames.request({ kind: 'offset', notBeforeMs: 1200, trial: { phase: 'scored', index: 0, stimulus: 'GO' } }, offset)
    now = 1200; frames.shift()!(9900)
    expect(offset).toHaveBeenCalledOnce()
    canvas.clear(); expect(host).toBeEmptyDOMElement()
  })
  it('never confirms missing/zero-size presentation and respects cancellation', () => {
    const callbacks: FrameRequestCallback[] = []
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => { callbacks.push(cb); return 1 })
    const canvas = createBrowserCanvas(() => 1000, 'standard')
    const confirm = vi.fn()
    const request = { kind: 'onset' as const, notBeforeMs: 1000, trial: { phase: 'scored' as const, index: 0, stimulus: 'GO' as const } }
    canvas.frames.request(request, confirm); callbacks.shift()!(0)
    const host = document.createElement('div'); document.body.append(host); canvas.attach(host)
    canvas.frames.request(request, confirm); callbacks.shift()!(0)
    canvas.frames.request(request, confirm)(); callbacks.shift()!(0)
    expect(confirm).not.toHaveBeenCalled()
  })
})

describe('browser event delivery and scoped defaults', () => {
  function bind() {
    const f = fixture({ key: 'Space' })
    const listeners = bindBrowserEvents(f.engine, 'Space', () => !['closed', 'invalid'].includes(f.engine.snapshot().state))
    return { ...f, listeners }
  }
  function key(type: string, code: string, extra: KeyboardEventInit = {}) {
    const event = new KeyboardEvent(type, { code, key: code === 'Space' ? ' ' : 'x', bubbles: true, cancelable: true, ...extra })
    document.dispatchEvent(event); return event
  }
  it('forwards a held-key release on an untimed warm-up pause or restart screen', () => {
    const f = fixture({ key: 'Space', held: true, autoStart: false })
    const listeners = bindBrowserEvents(f.engine, 'Space', () => false, () => true)
    expect(key('keydown', 'Space').defaultPrevented).toBe(false)
    expect(key('keyup', 'Space').defaultPrevented).toBe(true)
    expect(f.engine.snapshot().held).toBe(false)
    expect(f.ofType('key_released')).toHaveLength(1)
    listeners.dispose()
  })
  it('prevents only the selected key during protection, preserves modifier filtering and removes listeners', () => {
    const f = bind(); f.advance(1000)
    expect(key('keydown', 'Space', { ctrlKey: true }).defaultPrevented).toBe(true)
    expect(f.engine.snapshot().results).toHaveLength(0)
    key('keydown', 'Space') // modifiers released while the physical response key stays held
    expect(f.engine.snapshot().results).toHaveLength(0)
    key('keyup', 'Space')
    f.advance(1350); key('keydown', 'Space'); key('keydown', 'Space', { repeat: true }); key('keyup', 'Space')
    expect(f.engine.snapshot().results).toHaveLength(1)
    expect(key('keydown', 'KeyX').defaultPrevented).toBe(false)
    f.listeners.dispose()
    expect(key('keydown', 'Space').defaultPrevented).toBe(false)
  })
  it.each(['pagehide', 'pageshow', 'freeze', 'resume'] as const)('stops on %s and never resumes', event => {
    const f = bind()
    ;(event === 'freeze' || event === 'resume' ? document : window).dispatchEvent(new Event(event))
    expect(f.engine.snapshot().invalidRule).toBe(RULE.lifecycle)
    expect(key('keydown', 'Space').defaultPrevented).toBe(false)
    f.listeners.dispose()
  })
  it('forwards hidden, blur/focus, resize and route exit', () => {
    for (const kind of ['hidden', 'blur', 'resize', 'popstate', 'beforeunload', 'route']) {
      const f = bind()
      if (kind === 'hidden') {
        const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
        document.dispatchEvent(new Event('visibilitychange')); visibility.mockRestore()
        expect(f.engine.snapshot().invalidRule).toBe(RULE.hidden)
      } else if (kind === 'blur') {
        window.dispatchEvent(new Event('blur')); f.advance(999); window.dispatchEvent(new Event('focus'))
        expect(f.engine.snapshot().invalidRule).toBeNull()
        window.dispatchEvent(new Event('blur')); f.advance(2000)
        expect(f.engine.snapshot().invalidRule).toBe(RULE.blur)
      } else if (kind === 'resize') {
        const width = window.innerWidth; window.innerWidth = 767; window.dispatchEvent(new Event('resize')); window.innerWidth = width
        expect(f.engine.snapshot().invalidRule).toBe(RULE.viewport)
      } else if (kind === 'route') {
        const anchor = document.createElement('a'); anchor.href = '/exit'; document.body.append(anchor)
        const e = new MouseEvent('click', { bubbles: true, cancelable: true }); anchor.dispatchEvent(e)
        expect(e.defaultPrevented).toBe(true)
        expect(f.engine.snapshot().invalidRule).toBe(RULE.lifecycle)
      } else {
        window.dispatchEvent(new Event(kind)); expect(f.engine.snapshot().invalidRule).toBe(RULE.lifecycle)
      }
      f.listeners.dispose()
    }
  })
  it.each(['error', 'unhandledrejection'])('stops an unexpected browser %s', kind => {
    const f = bind(); window.dispatchEvent(new Event(kind))
    expect(f.engine.snapshot().invalidRule).toBe(RULE.integrity)
    f.listeners.dispose()
  })
  it('invalidates an OS accessibility preference change', () => {
    const media = new EventTarget()
    vi.stubGlobal('matchMedia', () => media)
    const f = bind(); media.dispatchEvent(new Event('change'))
    expect(f.engine.snapshot().invalidRule).toBe(RULE.settings)
    f.listeners.dispose(); vi.unstubAllGlobals()
  })
})
