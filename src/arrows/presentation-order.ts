// Stable across installation replacement: old tabs and Delete all must compete.
export const ARROWS_PRESENTATION_LOCK = 'assessment-practice-arrows-presentation-v1'

function supported(): boolean { return typeof navigator !== 'undefined' && !!navigator.locks }

/** A canceled owner must release the short lock even if a storage callback
 * never delivers. Callers must check the signal after every pending read. */
export function untilArrowsCanceled<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason ?? Error('Arrows presentation canceled'))
    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) abort()
    work.then(value => { signal.removeEventListener('abort', abort); resolve(value) },
      error => { signal.removeEventListener('abort', abort); reject(error) })
  })
}

export function orderArrowsStart<T>(work: () => Promise<T>, signal: AbortSignal): Promise<T> {
  if (!supported()) return Promise.reject(Error('This browser cannot order Arrows deletion and Start'))
  return navigator.locks.request(ARROWS_PRESENTATION_LOCK, { signal },
    () => untilArrowsCanceled(work(), signal))
}

/** An authoritative report read and its synchronous DOM publication must be
 * ordered with both deletion operations. The caller owns cancellation and a
 * short deadline; a late read must never publish after the lock is released. */
export function orderArrowsPublication<T>(work: (signal: AbortSignal) => Promise<T>,
  signal: AbortSignal): Promise<T> {
  if (!supported()) return Promise.reject(Error('This browser cannot verify saved Arrows reports'))
  return navigator.locks.request(ARROWS_PRESENTATION_LOCK, { signal },
    () => untilArrowsCanceled(work(signal), signal))
}

/** Checkpoint and terminal replacement also compete with report publication. */
export function orderArrowsSnapshot<T>(work: (signal: AbortSignal) => Promise<T>,
  signal?: AbortSignal): Promise<T> {
  if (!supported()) return Promise.reject(Error('This browser cannot order Arrows snapshot saving'))
  const controller = new AbortController()
  const cancel = () => controller.abort(Error('Arrows snapshot canceled'))
  signal?.addEventListener('abort', cancel, { once: true })
  if (signal?.aborted) cancel()
  const timer = setTimeout(() => controller.abort(Error('Arrows snapshot confirmation timed out')), 5_000)
  return navigator.locks.request(ARROWS_PRESENTATION_LOCK, { signal: controller.signal },
    () => untilArrowsCanceled(work(controller.signal), controller.signal))
    .finally(() => { clearTimeout(timer); signal?.removeEventListener('abort', cancel) })
}

// Deletion remains available in browsers that cannot offer timed Start.
export const ARROWS_DELETION_ORDER_TIMEOUT_MS = 5_000
export function orderArrowsDeletion<T>(work: (signal?: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(Error('Arrows deletion confirmation timed out')),
    ARROWS_DELETION_ORDER_TIMEOUT_MS)
  const ordered = supported()
    ? navigator.locks.request(ARROWS_PRESENTATION_LOCK, { signal: controller.signal },
      () => untilArrowsCanceled(work(controller.signal), controller.signal))
    : untilArrowsCanceled(work(controller.signal), controller.signal)
  return ordered.finally(() => clearTimeout(timer))
}
