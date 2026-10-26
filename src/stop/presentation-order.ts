import type { FrameAdapter } from './engine/contracts'

// Stable across installation replacement: old tabs must compete with delete-all too.
export const STOP_PRESENTATION_LOCK = 'assessment-practice-stop-presentation-v1'
export const presentationOrderingSupported = () => typeof navigator !== 'undefined' && !!navigator.locks
export function orderPresentation<T>(work: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!presentationOrderingSupported()) return Promise.reject(new Error('Browser cannot order deletion and presentation'))
  return navigator.locks.request(STOP_PRESENTATION_LOCK, { signal }, work)
}

/** Only for work whose late continuations/writes are fenced by this signal.
 * Settles the acquired lock callback even if promise delivery never resumes. */
export function untilPresentationCanceled<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason)
    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) abort()
    work.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort))
  })
}

/** Gate only the first scored onset. Keep the original eligible time/watchdog;
 * offsets, input, resolution and subsequent frame requests never await admission. */
export function firstScoredAdmission(frames: FrameAdapter,
  enter: (present: () => Promise<void>, signal: AbortSignal) => Promise<void>, failed: (error: unknown) => void,
  controller = new AbortController()): FrameAdapter {
  let requested = false
  return { request(request, confirm) {
    if (requested || request.kind !== 'onset' || request.trial.phase !== 'scored') return frames.request(request, confirm)
    requested = true
    let cancelFrame = () => {}
    let finish = () => {}
    const canceled = () => { cancelFrame(); finish() }
    controller.signal.addEventListener('abort', canceled, { once: true })
    void enter(() => new Promise<void>(resolve => {
      finish = resolve
      if (controller.signal.aborted) { resolve(); return }
      cancelFrame = frames.request(request, () => {
        if (!controller.signal.aborted) confirm()
        resolve()
      })
    }), controller.signal).catch(error => { if (!controller.signal.aborted) failed(error) })
      .finally(() => controller.signal.removeEventListener('abort', canceled))
    return () => { controller.abort(); canceled() }
  } }
}
