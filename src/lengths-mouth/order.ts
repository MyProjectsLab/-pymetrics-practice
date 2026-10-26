// Stable across installation replacement: old tabs and Delete all must compete.
export const MOUTH_PRESENTATION_LOCK = 'assessment-practice-lengths-mouth-presentation-v1-1'

function supported(): boolean { return typeof navigator !== 'undefined' && !!navigator.locks }

/** A canceled owner must release the short lock even if a storage callback
 * never delivers. Callers must check the signal after every pending read. */
export function untilMouthCanceled<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason ?? Error('Mouth presentation canceled'))
    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) abort()
    work.then(value => { signal.removeEventListener('abort', abort); resolve(value) },
      error => { signal.removeEventListener('abort', abort); reject(error) })
  })
}

export function orderMouthStart<T>(work: () => Promise<T>, signal: AbortSignal): Promise<T> {
  if (!supported()) return Promise.reject(Error('This browser cannot order Mouth deletion and Start'))
  return navigator.locks.request(MOUTH_PRESENTATION_LOCK, { signal },
    () => untilMouthCanceled(work(), signal))
}

/** An authoritative report read and its synchronous DOM publication must be
 * ordered with both deletion operations. The caller owns cancellation and a
 * short deadline; a late read must never publish after the lock is released. */
export function orderMouthPublication<T>(work: (signal: AbortSignal) => Promise<T>,
  signal: AbortSignal): Promise<T> {
  if (!supported()) return Promise.reject(Error('This browser cannot verify saved Mouth reports'))
  return navigator.locks.request(MOUTH_PRESENTATION_LOCK, { signal },
    () => untilMouthCanceled(work(signal), signal))
}

/** Checkpoint and terminal replacement also compete with report publication. */
export function orderMouthSnapshot<T>(work: (signal: AbortSignal) => Promise<T>,
  signal?: AbortSignal): Promise<T> {
  if (!supported()) return Promise.reject(Error('This browser cannot order Mouth snapshot saving'))
  const controller = new AbortController()
  const cancel = () => controller.abort(Error('Mouth snapshot canceled'))
  signal?.addEventListener('abort', cancel, { once: true })
  if (signal?.aborted) cancel()
  const timer = setTimeout(() => controller.abort(Error('Mouth snapshot confirmation timed out')), 5_000)
  return navigator.locks.request(MOUTH_PRESENTATION_LOCK, { signal: controller.signal },
    () => untilMouthCanceled(work(controller.signal), controller.signal))
    .finally(() => { clearTimeout(timer); signal?.removeEventListener('abort', cancel) })
}

// Deletion remains available in browsers that cannot offer timed Start.
export const MOUTH_DELETION_ORDER_TIMEOUT_MS = 5_000
export function orderMouthDeletion<T>(work: (signal?: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(Error('Mouth deletion confirmation timed out')),
    MOUTH_DELETION_ORDER_TIMEOUT_MS)
  const ordered = supported()
    ? navigator.locks.request(MOUTH_PRESENTATION_LOCK, { signal: controller.signal },
      () => untilMouthCanceled(work(controller.signal), controller.signal))
    : untilMouthCanceled(work(controller.signal), controller.signal)
  return ordered.finally(() => clearTimeout(timer))
}
