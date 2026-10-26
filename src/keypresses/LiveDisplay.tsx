import { useEffect, useRef } from 'react'
import type { ReactNode, RefObject } from 'react'
import { TARGET, WINDOW_MS } from './core'
import type { State } from './core'
import type { RunSnapshot } from './browser-run'

type SnapshotReader = { snapshot(): RunSnapshot }

/** Read-only display projection; admission, deadlines and accepted pairs stay in the run. */
export function liveDisplay(state: State | null, nowMs: number) {
  const at = state?.phase === 'active' ? nowMs : state?.logicalEndMs ?? nowMs
  const remainingMs = state?.goOnsetMs == null ? WINDOW_MS : Math.max(0, Math.min(WINDOW_MS, WINDOW_MS - (at - state.goOnsetMs)))
  return { count: state?.accepted.length ?? 0, seconds: Math.ceil(remainingMs / 1000), fraction: remainingMs / WINDOW_MS }
}

export function KeypressesLiveDisplay({ run, children }: { run: RefObject<SnapshotReader | null>; children: ReactNode }) {
  const count = useRef<HTMLElement>(null), seconds = useRef<HTMLElement>(null), progress = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const paint = () => {
      const state = run.current?.snapshot().state ?? null
      const display = liveDisplay(state, performance.now())
      const taps = `${display.count} / ${TARGET}`, time = `${display.seconds}s`
      if (count.current && count.current.textContent !== taps) count.current.textContent = taps
      if (seconds.current && seconds.current.textContent !== time) seconds.current.textContent = time
      if (progress.current) progress.current.style.transform = `scaleX(${display.fraction})`
      if (state && (state.phase === 'completed' || state.phase === 'invalid')) window.clearInterval(timer)
    }
    const timer = window.setInterval(paint, 100)
    paint()
    return () => window.clearInterval(timer)
  }, [run])
  return <div className="keypresses-stage">
    <div className="keypresses-progress" aria-hidden="true"><span ref={progress} /></div>
    <div className="keypresses-prompt">
      <div className="keypresses-stat keypresses-taps" aria-live="off"><span>TAPS</span><strong ref={count}>0 / {TARGET}</strong></div>
      <div className="keypresses-signal-group">{children}</div>
      <div className="keypresses-stat keypresses-left" aria-live="off"><span>LEFT</span><strong ref={seconds}>15s</strong></div>
    </div>
  </div>
}
