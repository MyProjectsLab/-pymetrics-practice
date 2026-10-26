import type { Scheduler } from './engine/contracts'

export type InitialFrame = (ready: () => void, current: () => boolean) => void | (() => void)

/** The timer and frame share one deadline and ownership token. The adapter must
 * check current() before touching the canvas, not only before starting trials. */
export function waitForInitialFrame(options: {
  clock: () => number; scheduler: Scheduler; request: InitialFrame
  active: () => boolean; ready: () => void; failed: () => void
}): () => void {
  const deadline = options.clock() + 2000
  let pending = true
  let cancelFrame: (() => void) | void
  let cancelTimer = () => {}
  const cancel = () => { pending = false; cancelTimer(); cancelFrame?.() }
  function current() {
    if (!pending || !options.active()) { cancel(); return false }
    if (options.clock() >= deadline) { cancel(); options.failed(); return false }
    return true
  }
  cancelTimer = options.scheduler.at(deadline, () => { current() })
  try {
    cancelFrame = options.request(() => {
      if (!current()) return
      cancel(); options.ready()
    }, current)
    if (!pending) cancelFrame?.()
  } catch { if (pending) { cancel(); options.failed() } }
  return cancel
}
