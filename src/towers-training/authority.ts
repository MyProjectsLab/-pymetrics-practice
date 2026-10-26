/** A single activation budget. Children may narrow authority but never renew it. */

export interface WorkScope {
  readonly deadline: number
  readonly signal: AbortSignal
  check(): void
}

export class OperationScope implements WorkScope {
  readonly id = crypto.randomUUID()
  readonly kind:'ordinary'|'settlement'='ordinary'
  readonly deadline: number
  readonly abort = new AbortController()
  private retired = false
  private readonly current: () => boolean
  constructor(activation: number, current: () => boolean) {
    this.deadline = activation + 2500
    this.current = current
  }
  get signal() { return this.abort.signal }
  valid() { return !this.retired && !this.signal.aborted && this.current() &&
    performance.now() < this.deadline }
  check() { if (!this.valid()) throw Error('Training operation retired or timed out') }
  retire() { if (!this.retired) { this.retired = true; this.abort.abort() } }
}

/** Exact captured-round cleanup may finish after its originating view exits. */
export class SettlementScope extends OperationScope {
  override readonly kind='settlement' as const
  constructor(activation:number){super(activation,()=>true)}
}

/** Pure fixture work only. It has no native or publication capability. */
export class ModelScope implements WorkScope {
  readonly signal = new AbortController().signal
  readonly deadline = Number.POSITIVE_INFINITY
  check() { /* finite fixture work does not own a browser operation */ }
}
