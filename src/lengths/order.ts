// Stable across installation replacement: old tabs and Delete all must compete.
export const LENGTHS_PRESENTATION_LOCK = 'assessment-practice-lengths-presentation-v1'

function supported(): boolean { return typeof navigator !== 'undefined' && !!navigator.locks }

/** A canceled owner must release the short lock even if a storage callback
 * never delivers. Callers must check the signal after every pending read. */
export function untilLengthsCanceled<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason ?? Error('Lengths presentation canceled'))
    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) abort()
    work.then(value => { signal.removeEventListener('abort', abort); resolve(value) },
      error => { signal.removeEventListener('abort', abort); reject(error) })
  })
}

export function orderLengthsStart<T>(work: () => Promise<T>, signal: AbortSignal): Promise<T> {
  if (!supported()) return Promise.reject(Error('This browser cannot order Lengths deletion and Start'))
  return navigator.locks.request(LENGTHS_PRESENTATION_LOCK, { signal },
    () => untilLengthsCanceled(work(), signal))
}

/** An authoritative report read and its synchronous DOM publication must be
 * ordered with both deletion operations. The caller owns cancellation and a
 * short deadline; a late read must never publish after the lock is released. */
export function orderLengthsPublication<T>(work: (signal: AbortSignal) => Promise<T>,
  signal: AbortSignal): Promise<T> {
  if (!supported()) return Promise.reject(Error('This browser cannot verify saved Lengths reports'))
  return navigator.locks.request(LENGTHS_PRESENTATION_LOCK, { signal },
    () => untilLengthsCanceled(work(signal), signal))
}

/** Checkpoint and terminal replacement also compete with report publication. */
export function orderLengthsSnapshot<T>(work: (signal: AbortSignal) => Promise<T>,
  signal?: AbortSignal): Promise<T> {
  if (!supported()) return Promise.reject(Error('This browser cannot order Lengths snapshot saving'))
  const controller = new AbortController()
  const cancel = () => controller.abort(Error('Lengths snapshot canceled'))
  signal?.addEventListener('abort', cancel, { once: true })
  if (signal?.aborted) cancel()
  const timer = setTimeout(() => controller.abort(Error('Lengths snapshot confirmation timed out')), 5_000)
  return navigator.locks.request(LENGTHS_PRESENTATION_LOCK, { signal: controller.signal },
    () => untilLengthsCanceled(work(controller.signal), controller.signal))
    .finally(() => { clearTimeout(timer); signal?.removeEventListener('abort', cancel) })
}

// Deletion remains available in browsers that cannot offer timed Start.
export const LENGTHS_DELETION_ORDER_TIMEOUT_MS = 5_000
export function orderLengthsDeletion<T>(work: (signal?: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(Error('Lengths deletion confirmation timed out')),
    LENGTHS_DELETION_ORDER_TIMEOUT_MS)
  const ordered = supported()
    ? navigator.locks.request(LENGTHS_PRESENTATION_LOCK, { signal: controller.signal },
      () => untilLengthsCanceled(work(controller.signal), controller.signal))
    : untilLengthsCanceled(work(controller.signal), controller.signal)
  return ordered.finally(() => clearTimeout(timer))
}
