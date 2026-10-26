import { DIGITS_LIVE_LOCK } from './storage'

/** Keeps one scored Digits attempt live across tabs until terminal or explicit exit. */
export async function acquireDigitsOwner(signal?: AbortSignal): Promise<() => void> {
  if (typeof navigator === 'undefined' || !('locks' in navigator))
    throw Error('Exclusive browser ownership is unavailable')
  let settle!: (release: () => void) => void
  let fail!: (error: unknown) => void
  const acquired = new Promise<() => void>((resolve, reject) => { settle = resolve; fail = reject })
  let released = false
  const request = navigator.locks.request(DIGITS_LIVE_LOCK,
    { mode: 'exclusive', ifAvailable: true }, async lock => {
      if (!lock || signal?.aborted) { fail(Error('Another Digits tab owns the exercise')); return }
      await new Promise<void>(resolve => {
        const leave = () => { signal?.removeEventListener('abort', leave); resolve() }
        signal?.addEventListener('abort', leave, { once: true })
        settle(() => { if (released) return; released = true; leave() })
        if (signal?.aborted || released) leave()
      })
    })
  void request.catch(error => fail(error))
  return acquired
}
