import type { LengthsAuthorityHandle } from './authority'
import type { State } from './engine'
import type { LengthsEntry } from './entry'
import type { ArmedAttempt, PersistedSnapshot } from './storage'

export const LENGTHS_RECOVERY_TIMEOUT_MS = 2_000
export type RecoveryEvidence = 'missing_or_changed_arm' | 'installation_replaced' | 'incompatible_result'
export interface RecoveryTarget {
  readonly kind: 'checkpoint' | 'terminal'
  readonly installationId: string
  readonly sessionId: string
  readonly requestId: string
  readonly ordinal: number
  readonly clockDomainId: string
  readonly arm: ArmedAttempt
  readonly state: State
}
export type RecoveryOutcome =
  | { readonly kind: 'uncertain'; readonly target: RecoveryTarget; readonly cause: string }
  | { readonly kind: 'confirmed'; readonly target: RecoveryTarget; readonly snapshot: PersistedSnapshot }
  | { readonly kind: 'retired'; readonly target: RecoveryTarget; readonly evidence: RecoveryEvidence }

function frozen<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(frozen)
    Object.freeze(value)
  }
  return value
}
/** The register owns authority; this controller owns bounded delivery and the
 * immutable in-tab recovery request. Catches only record operational uncertainty. */
export class LengthsRecovery {
  readonly target: RecoveryTarget
  readonly authority: LengthsAuthorityHandle
  private cause = 'not_confirmed'
  private settled = false
  private readonly listeners = new Set<(value: RecoveryOutcome) => void>()
  private active: { controller: AbortController; task: Promise<RecoveryOutcome>; finish: () => void } | null = null
  private readonly entry: LengthsEntry
  constructor(entry: LengthsEntry, arm: ArmedAttempt, state: State, revision = 0) {
    this.entry = entry
    const { snapshot: _snapshot, ...original } = arm
    this.target = frozen(structuredClone({ kind: state.phase === 'break' ? 'checkpoint' : 'terminal',
      installationId: arm.state.identity.installationId, sessionId: arm.sessionId,
      requestId: arm.requestId, ordinal: arm.ordinal, clockDomainId: arm.clockDomainId, arm: original, state }))
    this.authority = entry.authority(arm, state, revision)
    this.authority.subscribe(status => {
      if (status.kind === 'retired' || status.kind === 'blocked') {
        const active = this.active; this.active = null; active?.controller.abort(); active?.finish()
      }
      this.notify()
    })
  }
  outcome(): RecoveryOutcome {
    const status = this.authority.resultStatus()
    if (status.kind === 'retired') return frozen({ kind: 'retired', target: this.target, evidence: status.evidence })
    if (status.kind === 'confirmed' && this.settled) return frozen({ kind: 'confirmed', target: this.target, snapshot: status.snapshot })
    return frozen({ kind: 'uncertain', target: this.target, cause: status.kind === 'blocked' ? status.cause : this.cause })
  }
  pending(): boolean { return this.active !== null }
  subscribe(listener: (value: RecoveryOutcome) => void): () => void {
    this.listeners.add(listener); listener(this.outcome()); return () => { this.listeners.delete(listener) }
  }
  private notify(): void { const value = this.outcome(); for (const listener of this.listeners) listener(value) }
  uncertain(cause: string): void { this.settled = false; this.cause = cause; this.notify() }
  recover(initialWrite = false): Promise<RecoveryOutcome> {
    const status = this.authority.status()
    if (status.kind === 'retired' || status.kind === 'blocked') return Promise.resolve(this.outcome())
    if (this.active) return this.active.task
    const controller = new AbortController()
    let resolve!: (value: RecoveryOutcome) => void, timer: ReturnType<typeof setTimeout>
    const task = new Promise<RecoveryOutcome>(done => { resolve = done })
    const operation = { controller, task, finish: () => { clearTimeout(timer); resolve(this.outcome()) } }
    this.active = operation
    const current = () => this.active === operation && this.authority.status().kind === 'current'
    timer = setTimeout(() => {
      if (this.active === operation) {
        this.active = null; controller.abort(); this.uncertain('recovery_timed_out'); operation.finish()
      }
    }, LENGTHS_RECOVERY_TIMEOUT_MS)
    const { arm, state, kind } = this.target
    void (async () => {
      try {
        if (!initialWrite) {
          if (kind === 'checkpoint') await this.entry.currentBreakExit(arm, this.authority, controller.signal)
          else await this.entry.currentTerminal(arm, state, controller.signal)
        }
        if (!current()) return
        let result = this.authority.resultStatus()
        if (result.kind !== 'confirmed') {
          const revision = result.kind === 'recoverable' ? result.snapshot?.revision ?? 0 : 0
          if (kind === 'checkpoint') await this.entry.saveBreakExit(arm, state, revision, controller.signal)
          else await this.entry.saveTerminal(arm, state, controller.signal)
          result = this.authority.resultStatus()
        }
        if (current() && result.kind === 'confirmed') { this.entry.confirmAuthority(this.authority, result.snapshot); this.settled = true }
      } catch (error) {
        if (current()) this.uncertain(error instanceof Error ? error.message : 'recovery_failed')
      } finally {
        if (this.active === operation) this.active = null
        this.notify(); operation.finish()
      }
    })()
    return task
  }
  async snapshot(): Promise<PersistedSnapshot> {
    const value = await this.recover()
    if (value.kind === 'confirmed') return value.snapshot
    throw Error(value.kind === 'retired' ? 'Lengths recovery authority changed' : value.cause)
  }
}
