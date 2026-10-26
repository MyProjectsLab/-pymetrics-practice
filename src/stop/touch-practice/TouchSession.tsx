import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createBrowserCanvas, createBrowserScheduler } from '../browser'
import { createTouchController, validateTouchReport } from './controller'
import type { TouchSnapshot } from './controller'
import { TOUCH_FORM_ID, validateTouchForm } from './form'
import './touch.css'

export function TouchSession({ onMenu }: { onMenu: () => void }) {
  const [state, setState] = useState<TouchSnapshot>({ phase: 'ready', trial: 0, stimulus: null, report: null })
  const [sourceOkay, setSourceOkay] = useState(false)
  const [fit, setFit] = useState<boolean | null>(null)
  const [responseFlashing, setResponseFlashing] = useState(false)
  const feedbackTimer = useRef<number | null>(null)
  const board = useRef<HTMLDivElement>(null)
  const action = useRef<HTMLButtonElement>(null)
  const exitButton = useRef<HTMLButtonElement>(null)
  const controller = useRef<ReturnType<typeof createTouchController> | null>(null)
  const canvas = useRef<ReturnType<typeof createBrowserCanvas> | null>(null)
  const startPointer = useRef<{ id: number; released: boolean } | null>(null)
  const playPointer = useRef<number | null>(null)
  const flashResponse = useCallback(() => {
    if (feedbackTimer.current !== null) window.clearTimeout(feedbackTimer.current)
    setResponseFlashing(true)
    feedbackTimer.current = window.setTimeout(() => {
      feedbackTimer.current = null
      setResponseFlashing(false)
    }, 140)
  }, [])
  const checkFit = useCallback(() => {
    const b = board.current?.getBoundingClientRect(), a = action.current?.getBoundingClientRect(), x = exitButton.current?.getBoundingClientRect()
    const viewport = window.visualViewport
    const left = viewport?.offsetLeft ?? 0, top = viewport?.offsetTop ?? 0
    const right = left + (viewport?.width ?? innerWidth), bottom = top + (viewport?.height ?? innerHeight)
    const contained = (r: DOMRect | undefined) => !!r && r.width > 0 && r.height > 0 && r.left >= left && r.right <= right && r.top >= top && r.bottom <= bottom
    const hit = (element: HTMLElement | null, rect: DOMRect | undefined) => !!element && !!rect &&
      element.contains(document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2))
    const okay = contained(b) && contained(a) && contained(x) && b!.height >= 128 && b!.width >= 128 && a!.height >= 72 && a!.width >= 160 && x!.height >= 44 && x!.width >= 44 &&
      b!.bottom + 12 <= a!.top && x!.bottom + 12 <= b!.top && hit(board.current, b) && hit(action.current, a) && hit(exitButton.current, x) && document.visibilityState === 'visible'
    setFit(okay)
    return okay
  }, [])
  useLayoutEffect(() => {
    if (!board.current) return
    const clock = () => performance.now()
    const render = createBrowserCanvas(clock, 'standard', () => controller.current?.exit('Stimulus presentation failed'))
    render.attach(board.current)
    canvas.current = render
    const run = createTouchController({ clock, scheduler: createBrowserScheduler(clock), frames: render.frames,
      showFixation: () => render.fixation(), changed: setState })
    controller.current = run
    let mounted = true
    void validateTouchForm().then(okay => { if (mounted) setSourceOkay(okay) }).catch(() => { if (mounted) setSourceOkay(false) })
    const fitNow = () => { if (!checkFit() && ['warmup', 'scored'].includes(run.snapshot().phase)) run.exit('Visible touch controls no longer fit') }
    const hidden = () => { if (document.visibilityState !== 'visible') run.exit('Page became hidden'); else fitNow() }
    const pagehide = () => run.exit('Page was left')
    // The response button is replaced at the warm-up boundary. Observe the
    // matching release at document level so its owner cannot be stranded.
    const pointerEnd = (event: PointerEvent) => {
      run.pointerEnd(event.pointerId)
      if (playPointer.current === event.pointerId) playPointer.current = null
      if (startPointer.current?.id === event.pointerId) {
        if (event.type === 'pointerup' && action.current?.contains(event.target as Node)) startPointer.current.released = true
        else if (event.type !== 'lostpointercapture' || !startPointer.current.released) startPointer.current = null
      }
    }
    document.addEventListener('pointerup', pointerEnd, true)
    document.addEventListener('pointercancel', pointerEnd, true)
    document.addEventListener('lostpointercapture', pointerEnd, true)
    window.addEventListener('resize', fitNow)
    window.addEventListener('orientationchange', fitNow)
    window.addEventListener('pagehide', pagehide)
    window.visualViewport?.addEventListener('resize', fitNow)
    window.visualViewport?.addEventListener('scroll', fitNow)
    document.addEventListener('visibilitychange', hidden)
    const id = requestAnimationFrame(fitNow)
    return () => { mounted = false; cancelAnimationFrame(id); window.removeEventListener('resize', fitNow); window.removeEventListener('orientationchange', fitNow);
      window.removeEventListener('pagehide', pagehide); window.visualViewport?.removeEventListener('resize', fitNow); window.visualViewport?.removeEventListener('scroll', fitNow);
      document.removeEventListener('visibilitychange', hidden); document.removeEventListener('pointerup', pointerEnd, true);
      document.removeEventListener('pointercancel', pointerEnd, true); document.removeEventListener('lostpointercapture', pointerEnd, true);
      if (feedbackTimer.current !== null) window.clearTimeout(feedbackTimer.current)
      feedbackTimer.current = null
      startPointer.current = null; playPointer.current = null; run.dispose(); render.clear(); controller.current = null; canvas.current = null }
  }, [checkFit])
  useEffect(() => { if (state.phase !== 'ready' && state.phase !== 'warmup_complete') return
    const id = requestAnimationFrame(checkFit)
    return () => cancelAnimationFrame(id)
  }, [state.phase, checkFit])
  function start() {
    if (!sourceOkay || !checkFit() || document.visibilityState !== 'visible' || !document.hasFocus()) return
    try { if (state.phase === 'ready') controller.current?.startWarmup(); else controller.current?.startScored() }
    catch { controller.current?.exit('Could not begin touch practice') }
  }
  function startClick(event: React.MouseEvent<HTMLButtonElement>) {
    const native = event.nativeEvent as MouseEvent & { pointerType?: string; sourceCapabilities?: { firesTouchEvents?: boolean } }
    const assistive = event.detail === 0 && !native.pointerType && !native.sourceCapabilities?.firesTouchEvents
    const freshPointer = startPointer.current?.released === true
    startPointer.current = null
    if ((assistive || freshPointer) && controller.current?.canStart()) start()
  }
  function playPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'touch' || !event.isPrimary || playPointer.current !== null) return
    const phase = controller.current?.snapshot().phase
    if (phase !== 'warmup' && phase !== 'scored') return
    const target = event.target as Element
    const control = target.closest('button, a, input, select, textarea, [role="button"]')
    if (control && control !== action.current) return
    event.preventDefault()
    playPointer.current = event.pointerId
    controller.current?.pointerDown(event.pointerId, true, 'touch')
    flashResponse()
    try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* Document release/cancel still clears ownership. */ }
  }
  function exit() { if (state.phase === 'ready' || state.phase === 'warmup_complete' || state.phase === 'report') onMenu(); else controller.current?.exit('Exit practice selected') }
  const report = state.report
  const validReport = report ? validateTouchReport(report) : false
  const interrupted = report ? [...report.warmup, ...report.scored].find(item => item.presentation === 'interrupted_before_offset') : undefined
  return <div className="touch-practice" data-stop-touch-practice data-phase={state.phase} onPointerDown={playPointerDown}>
    <header className="touch-practice-header"><span>Stop · Touch practice</span><button ref={exitButton} className="secondary touch-exit" onClick={exit}>{state.phase === 'report' ? 'Game menu' : 'Exit practice'}</button></header>
    {state.phase === 'report' ? <main className="touch-report">
      <h1 tabIndex={-1}>{report?.status === 'completed' && validReport ? 'Touch practice complete' : 'Touch practice ended early'}</h1>
      {!validReport ? <p role="alert">The touch report could not be verified.</p> : <>
        {report?.reason && <p>{report.reason}.</p>}
        <p>Warm-up: {report!.warmup.length} of 8 resolved. Practice: {report!.scored.length} of 80 resolved.</p>
        {interrupted && <p>{interrupted.input === null ? 'The last trial timed out without a response' : 'The last accepted response was recorded'}; the symbol's removal was not observed before exit.</p>}
        {report?.status === 'completed' && <p>GO hits: {report.totals.hit} · GO misses: {report.totals.miss} · NO-GO false alarms: {report.totals.false_alarm} · Correct withholds: {report.totals.correct_withhold}.</p>}
        {report!.assistiveActivations > 0 && <p>{report!.assistiveActivations} {report!.assistiveActivations === 1 ? 'response used' : 'responses used'} an accessibility click activation; {report!.assistiveActivations === 1 ? 'it was' : 'they were'} not recorded as a finger tap.</p>}
        <p><strong>Touch practice on this device. This result is not saved and cannot be compared with physical-keyboard Stop, used for training or used in a mock.</strong></p>
        <p className="note">Source: {TOUCH_FORM_ID}. Reloading clears this page-only report.</p>
      </>}
    </main> : <>
      <p className="touch-practice-reminder">{state.phase === 'ready' ? '8 warm-up trials, then 80 practice trials. Tap anywhere on the play screen for GO; leave NO-GO alone.' :
        state.phase === 'warmup_complete' ? 'Warm-up complete. Start 80 touch practice trials when ready.' : 'GO: tap the play screen once · NO-GO: do not tap'}</p>
      <div className="touch-practice-board" ref={board} aria-label="Stop stimulus" />
      <div className="touch-practice-actions">{state.phase === 'ready' || state.phase === 'warmup_complete' ?
        <button ref={action} className="touch-start" disabled={!sourceOkay || !fit}
          onPointerDown={event => { startPointer.current = controller.current?.canStart() ? { id: event.pointerId, released: false } : null }}
          onPointerCancel={() => { startPointer.current = null }}
          onClick={startClick}>{state.phase === 'ready' ? 'Start warm-up' : 'Start 80 practice trials'}</button> :
        <button ref={action} className={`touch-response${responseFlashing ? ' is-pressed' : ''}`}
          onClick={event => { event.preventDefault(); const native = event.nativeEvent as MouseEvent & { pointerType?: string; sourceCapabilities?: { firesTouchEvents?: boolean } }
            if (controller.current?.click({ detail: event.detail, pointerType: native.pointerType, firesTouchEvents: native.sourceCapabilities?.firesTouchEvents })) flashResponse() }}>Tap screen for GO</button>}
        {fit === false && <p role="status">The symbol and controls do not fit in the visible area. Rotate your phone or enlarge the view.</p>}
        {!sourceOkay && <p role="status">Checking the touch practice source.</p>}
      </div>
    </>}
  </div>
}
