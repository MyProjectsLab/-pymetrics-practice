import type { NativeArm, Preferences } from './contract'

/** Optional journey boundary. Native practice behaves as before when absent. */
export interface MockJourneyContext {
  readonly launchId: string
  readonly preferences: Preferences
  beforeArm(arm: NativeArm): Promise<void>
  terminal(): Promise<'ready' | 'review_only'>
  beginReturnIntent(): AbortSignal
  retireReturnIntent(): void
  finishReturnIntent(signal: AbortSignal): void
  continue(signal?: AbortSignal): Promise<void>
  retry(): Promise<void>
  leave(): void
}

/** Share only a running action for one launch; a settled action is always rechecked. */
export class InFlightLaunchAction<T> {
  private pending: { key: string; signal: AbortSignal | undefined; promise: Promise<T> } | null = null
  pendingFor(key: string, signal: AbortSignal): Promise<T> | null {
    return this.pending?.key===key && this.pending.signal===signal && !signal.aborted ? this.pending.promise : null
  }
  run(key: string, work: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    if (this.pending) return this.pending.key === key && this.pending.signal === signal && !signal?.aborted ? this.pending.promise :
      Promise.reject(new Error('The previous game action is still being checked.'))
    const promise = Promise.resolve().then(() => { signal?.throwIfAborted(); return work() })
    this.pending = { key, signal, promise }
    const clear = () => { if (this.pending?.promise === promise) this.pending = null }
    void promise.then(clear, clear)
    return promise
  }
}

/** One in-tab Return authority; old signals cannot authorize a later click. */
export class ReturnIntent {
  private active: AbortController | null = null
  begin(): AbortSignal {
    if (!this.active || this.active.signal.aborted) this.active = new AbortController()
    return this.active.signal
  }
  retire() { this.active?.abort(); this.active = null }
  finish(signal: AbortSignal) { if (this.active?.signal === signal) this.retire() }
}
