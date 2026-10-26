import { NativePresenceError } from './native-presence'

/** Bridge scopes own the real Web Lock callback, including queued cancellation.
 * Signal presence alone is insufficient: every submission checks absolute time. */
type Scope = { signal: AbortSignal; parent?: AbortSignal; deadline: number; live: boolean; close: () => void; cleanup: Set<() => void> }
const scopes = new WeakMap<AbortSignal, Scope>()
export function assertAuthority(signal: AbortSignal): void {
  signal.throwIfAborted()
  const scope = scopes.get(signal)
  if (!scope) return
  if (scope.parent) assertAuthority(scope.parent)
  if (!scope.live || performance.now() >= scope.deadline) { scope.close(); throw Error('Save authority expired. Check the previous save.') }
}
export function onAuthorityClose(signal: AbortSignal, cleanup: () => void): () => void {
  assertAuthority(signal)
  const scope = scopes.get(signal)
  if (scope) { scope.cleanup.add(cleanup); return () => scope.cleanup.delete(cleanup) }
  signal.addEventListener('abort', cleanup, { once: true })
  return () => signal.removeEventListener('abort', cleanup)
}
async function bounded<T>(name: string | null, budget: number, work: (signal: AbortSignal) => Promise<T>, parent?: AbortSignal): Promise<T> {
  if (name !== null && !navigator.locks?.request) throw Error('Ordered local storage unavailable')
  if (parent) assertAuthority(parent)
  const controller = new AbortController()
  let rejectClosed!: (error: Error) => void
  const closed = new Promise<never>((_, reject) => { rejectClosed = reject })
  const retire = (notify: boolean) => {
    if (!scope.live) return
    scope.live = false
    controller.abort()
    for (const cleanup of scope.cleanup) { try { cleanup() } catch { /* Cleanup cannot retain a gate. */ } }
    scope.cleanup.clear()
    if (notify) rejectClosed(Error('Save authority retired. Check the previous save.'))
  }
  const scope: Scope = { signal: controller.signal, parent, deadline: Math.min(performance.now() + budget, parent ? scopes.get(parent)?.deadline ?? Infinity : Infinity), live: true, cleanup: new Set(), close: () => retire(true) }
  scopes.set(controller.signal, scope)
  const removeParent = parent ? onAuthorityClose(parent, scope.close) : () => {}
  const timer = setTimeout(scope.close, Math.max(0, scope.deadline - performance.now()))
  try {
    const request = name === null ? Promise.resolve().then(() => { assertAuthority(controller.signal); return work(controller.signal) }) : navigator.locks.request(name, { mode: 'exclusive', signal: controller.signal }, async () => {
      assertAuthority(controller.signal)
      try { return await Promise.race([work(controller.signal), closed]) }
      finally { retire(false) }
    })
    return await Promise.race([request, closed])
  } finally { retire(false); clearTimeout(timer); removeParent() }
}
export function withAuthority<T>(name: string, budget: number, work: (signal: AbortSignal) => Promise<T>, parent?: AbortSignal): Promise<T> { return bounded(name, budget, work, parent) }
/** A child resource deadline introduces no additional Web Lock or lock order. */
export function withinAuthority<T>(budget: number, work: (signal: AbortSignal) => Promise<T>, parent: AbortSignal): Promise<T> { return bounded(null, budget, work, parent) }
export type NativeLossHandler<T> = (loss: NativePresenceError, signal: AbortSignal) => Promise<T>
export async function withNativeObservation<T>(lock: string, work: (signal: AbortSignal) => Promise<T>, parent: AbortSignal, loss?: NativeLossHandler<T>): Promise<T> {
  return withAuthority(lock, 2000, async signal => {
    try { return await work(signal) }
    catch (error) {
      assertAuthority(signal)
      if (loss && error instanceof NativePresenceError && ['missing_database','missing_key','corrupt','unsupported','deleted','replaced'].includes(error.kind)) return loss(error, signal)
      throw error
    }
  }, parent)
}
