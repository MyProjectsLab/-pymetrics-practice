import type { RunState } from './contracts'
import { advanceDigits } from './engine'
import type { ArmRequest, DigitsAttempt, DigitsStore } from './storage'
import { withDigitsDataOrder } from './storage'

/** Delivery timeout keeps one request. A lifecycle cancellation permanently fences it.
 * Reconciliation reads authority without allocating a replacement arm. */
export class DigitsAdmission {
  readonly controller: AbortController
  readonly store: DigitsStore
  readonly request: ArmRequest
  private observation: { reason: string; atMs: number } | null = null
  private canceledResult: { attempt: DigitsAttempt; state: RunState } | null = null
  constructor(store: DigitsStore, request: ArmRequest, controller = new AbortController()) {
    this.store = store; this.request = request; this.controller = controller
  }
  get canceled() { return this.observation !== null }
  cancel(reason: string, atMs: number) {
    this.observation ??= { reason, atMs }
    this.controller.abort()
  }
  async arm(): Promise<DigitsAttempt> {
    if (this.canceled) throw Error('Canceled Start cannot be resumed')
    return this.store.arm(this.request, this.controller.signal)
  }
  async reconcileCancellation(): Promise<{ attempt: DigitsAttempt; state: RunState } | null> {
    const observation = this.observation
    if (!observation) throw Error('Start was not canceled')
    return withDigitsDataOrder(async () => {
      const retained = await this.store.load(this.request.sessionId)
      // A noncommitted request or deleted arm has no writable result to reconstruct.
      if (!retained) return null
      if (retained.requestId !== this.request.requestId) throw Error('Start authority changed')
      this.canceledResult ??= { attempt: retained, state: advanceDigits(retained.arm,
        { kind: 'invalidate', atMs: observation.atMs, reason: observation.reason }) }
      return this.canceledResult
    })
  }
}
