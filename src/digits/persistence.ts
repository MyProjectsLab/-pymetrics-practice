import type { RunState } from './contracts'
import type { DigitsAttempt, DigitsSnapshot, DigitsStore } from './storage'

/** A lifecycle terminal reconciles an outstanding checkpoint before extending its prefix.
 * Same-byte retry can read a committed checkpoint even while delivery remains held. */
export class DigitsPersistence {
  private pending: { state: RunState; promise: Promise<DigitsSnapshot>; settled: boolean } | null = null
  private readonly store: DigitsStore
  private readonly arm: DigitsAttempt
  constructor(store: DigitsStore, arm: DigitsAttempt) { this.store = store; this.arm = arm }
  async save(state: RunState): Promise<DigitsSnapshot> {
    const prior = this.pending
    if (prior && prior.state !== state && !prior.settled) {
      const retained = await this.store.load(this.arm.sessionId)
      if (!retained) throw Error('Digits save authority changed')
      const bytes = JSON.stringify(retained.snapshot?.state)
      if (bytes !== JSON.stringify(prior.state) && bytes !== JSON.stringify(state)) {
        // No durable proof yet. Await the real operation, rather than interpreting a UI timeout as failure.
        await prior.promise.catch(() => undefined)
      }
    }
    const work = { state, promise: this.store.save(this.arm, state), settled: false }
    this.pending = work
    void work.promise.then(() => { work.settled = true }, () => { work.settled = true })
    return work.promise
  }
}
