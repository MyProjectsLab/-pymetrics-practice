import type { State } from './engine'
import type { ArmedAttempt, LengthsRoot, PersistedSnapshot } from './storage'

/** Canonical full supported JSON; insertion order is not durable identity. */
export function authorityBytes(value: unknown): string {
  return JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item)
}
export const authorityEqual = (a: unknown, b: unknown) => authorityBytes(a) === authorityBytes(b)
function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value) }
  return value
}
function original(arm: ArmedAttempt): ArmedAttempt { const { snapshot: _snapshot, ...value } = arm; return freeze(structuredClone(value)) }
const extendsState = (next: State, prior: State) => authorityEqual(next.form, prior.form) &&
  authorityEqual(next.identity, prior.identity) && authorityEqual(next.profile, prior.profile) && next.armedAtMs === prior.armedAtMs &&
  authorityEqual(next.commands.slice(0, prior.commands.length), prior.commands) && authorityEqual(next.events.slice(0, prior.events.length), prior.events)
export type AuthorityEvidence = 'installation_replaced' | 'missing_or_changed_arm' | 'incompatible_result'
export type AuthorityStatus = { readonly kind: 'current' } | { readonly kind: 'unknown' } |
  { readonly kind: 'blocked'; readonly cause: string } |
  { readonly kind: 'retired'; readonly evidence: AuthorityEvidence; readonly revision?: number }
export type ResultAuthority = Exclude<AuthorityStatus, { kind: 'current' }> |
  { readonly kind: 'recoverable'; readonly snapshot: PersistedSnapshot | null } |
  { readonly kind: 'confirmed'; readonly snapshot: PersistedSnapshot }
export class LengthsAuthorityError extends Error { readonly status: AuthorityStatus; constructor(status: AuthorityStatus) { super(status.kind === 'blocked' ? 'Lengths integrity needs fresh verification' : 'Lengths authority changed'); this.name = 'LengthsAuthorityError'; this.status = status } }
export class LengthsIntegrityError extends Error { readonly cause: string; constructor(cause: string) { super(`Lengths integrity: ${cause}`); this.name = 'LengthsIntegrityError'; this.cause = cause } }
export interface RootProvenance { readonly storeId: string; readonly installationId: string; readonly kind: 'read' | 'preimage' | 'open' | 'replacement'; readonly dispatched: number; readonly resolution: boolean }
interface VerifiedRoot { readonly root: LengthsRoot; readonly bytes: string }
export interface LengthsAuthorityState {
  readonly handles: Map<string, LengthsAuthorityHandle>
  readonly armWitnesses: Map<string, number>
  readonly snapshotWitnesses: Map<string, { readonly revision: number; readonly arm: string; readonly snapshot: PersistedSnapshot }>
  latest: VerifiedRoot | null
  replacement: { observed: string; revision?: number } | null
  blocked: { cause: string; revision: number; since: number } | null
  serial: number
}
export const createLengthsAuthorityState = (): LengthsAuthorityState => ({ handles: new Map(), armWitnesses: new Map(), snapshotWitnesses: new Map(), latest: null, replacement: null, blocked: null, serial: 0 })
let storeGeneration = 0
/** One register per durable domain and installation. Every verified root is
 * observed centrally; operations cannot choose which targets see its facts. */
export class LengthsAuthority {
  readonly storeId = crypto.randomUUID()
  readonly generation = ++storeGeneration
  readonly installationId: string
  private readonly shared: LengthsAuthorityState
  constructor(installationId: string, shared = createLengthsAuthorityState()) { this.installationId = installationId; this.shared = shared }
  provenance(kind: RootProvenance['kind'], resolution = false): RootProvenance {
    return freeze({ storeId: this.storeId, installationId: this.installationId, kind, dispatched: ++this.shared.serial, resolution })
  }
  register(): { revision: number | null; integrity: 'verified' | 'unknown' | 'blocked' | 'replaced'; cause: string | null } {
    return { revision: this.shared.latest?.root.revision ?? null, integrity: this.shared.replacement ? 'replaced' : this.shared.blocked ? 'blocked' : this.shared.latest ? 'verified' : 'unknown', cause: this.shared.blocked?.cause ?? null }
  }
  latest(): LengthsRoot | null { return this.shared.latest?.root ?? null }
  private notify(): void { for (const handle of new Set(this.shared.handles.values())) handle.refresh() }
  private block(cause: string, revision: number): never {
    this.shared.blocked = { cause, revision: Math.max(revision, this.shared.blocked?.revision ?? 0), since: ++this.shared.serial }
    this.notify(); throw new LengthsIntegrityError(cause)
  }
  /** Inputs are validated by Store. Clone the committed preimage before a
   * transaction is permitted to mutate its own root object. */
  observe(value: LengthsRoot, provenance: RootProvenance): void {
    if (provenance.installationId !== this.installationId || provenance.storeId !== this.storeId) throw new LengthsIntegrityError('observation provenance changed')
    if (this.shared.replacement) return
    if (value.installationId !== this.installationId) {
      this.shared.replacement = freeze({ observed: value.installationId, revision: value.revision }); this.notify(); return
    }
    const root = freeze(structuredClone(value)), bytes = authorityBytes(root), previous = this.shared.latest
    if (previous && root.revision < previous.root.revision) return
    const resolving = this.shared.blocked && provenance.resolution && provenance.kind === 'read' &&
      provenance.dispatched > this.shared.blocked.since && root.revision >= this.shared.blocked.revision
    if (previous && root.revision === previous.root.revision && bytes !== previous.bytes && !resolving)
      this.block('conflicting content at the same revision', root.revision)
    if (previous && root.revision > previous.root.revision) {
      const contradiction = this.transition(previous.root, root)
      if (contradiction) this.block(contradiction, root.revision)
    }
    if (this.shared.blocked && !resolving) return
    if (resolving) {
      // Same-revision fresh resolution may choose the actual durable branch;
      // it must still preserve the last verified history apart from activity.
      if (previous && root.revision === previous.root.revision && bytes !== previous.bytes) {
        const contradiction = this.transition(previous.root, root)
        if (contradiction) this.block(contradiction, root.revision)
      }
      this.shared.blocked = null
    }
    this.shared.latest = { root, bytes }
    for (const arm of Object.values(root.attempts)) {
      const key = authorityBytes(original(arm))
      if (!this.shared.armWitnesses.has(key)) this.shared.armWitnesses.set(key, root.revision)
      if (arm.snapshot) {
        const snapshotKey = `${key}:${authorityBytes(arm.snapshot)}`
        if (!this.shared.snapshotWitnesses.has(snapshotKey)) this.shared.snapshotWitnesses.set(snapshotKey, { revision: root.revision, arm: key, snapshot: arm.snapshot })
      }
    }
    this.notify()
  }
  private transition(before: LengthsRoot, after: LengthsRoot): string | null {
    if (after.counters.standard < before.counters.standard ||
      after.counters.visual_accommodation < before.counters.visual_accommodation) return 'arm counter regressed'
    for (const [id, tombstone] of Object.entries(before.tombstones))
      if (!authorityEqual(after.tombstones[id], tombstone)) return 'tombstone history changed'
    for (const [id, arm] of Object.entries(after.attempts))
      if (!before.attempts[id] && arm.ordinal <= before.counters[arm.variant]) return 'new arm reused an earlier ordinal'
    for (const [id, prior] of Object.entries(before.attempts)) {
      const next = after.attempts[id]
      if (!next) { if (after.tombstones[id] === undefined) return 'arm disappeared without tombstone'; continue }
      if (!authorityEqual(original(prior), original(next))) return 'original arm changed'
      if (prior.snapshot) {
        const snapshot = next.snapshot
        if (!snapshot || snapshot.revision < prior.snapshot.revision) return 'snapshot history regressed'
        if (snapshot.revision === prior.snapshot.revision && !authorityEqual(snapshot, prior.snapshot)) return 'snapshot changed at the same revision'
        if ((prior.snapshot.kind === 'terminal' || before.activity?.[id]) && !authorityEqual(snapshot, prior.snapshot)) return 'immutable reported result changed'
        if (!extendsState(snapshot.state, prior.snapshot.state)) return 'snapshot journal history diverged'
      }
      const activity = before.activity?.[id]
      if (activity && (!after.activity?.[id] || after.activity[id].resultRevision !== activity.resultRevision ||
        !authorityEqual(after.activity[id].events.slice(0, activity.events.length), activity.events))) return 'activity history changed'
    }
    return null
  }
  handle(arm: ArmedAttempt, result: State | null = null, snapshot?: PersistedSnapshot, floor = 0): LengthsAuthorityHandle {
    if (arm.state.identity.installationId !== this.installationId) throw new LengthsIntegrityError('target installation changed')
    const key = `${authorityBytes(original(arm))}:${authorityBytes(result)}`
    const snapshotKey = snapshot ? `${key}:published:${authorityBytes(snapshot)}` : key
    let handle = this.shared.handles.get(snapshotKey)
    if (!handle) {
      const candidate = this.shared.handles.get(key)
      handle = snapshot && candidate && (!candidate.snapshot() || authorityEqual(candidate.snapshot(), snapshot)) ? candidate : new LengthsAuthorityHandle(this, arm, result)
      this.shared.handles.set(snapshotKey, handle)
      if (!candidate) this.shared.handles.set(key, handle)
    }
    if (floor) handle.raiseFloor(floor)
    if (snapshot) handle.bindSnapshot(snapshot)
    handle.refresh(); return handle
  }
  published(arm: ArmedAttempt): LengthsAuthorityHandle {
    if (arm.snapshot) return this.handle(arm, arm.snapshot.state, arm.snapshot)
    const key = `${authorityBytes(original(arm))}:published:armed-only`
    let handle = this.shared.handles.get(key)
    if (!handle) { handle = new LengthsAuthorityHandle(this, arm, arm.state, true); this.shared.handles.set(key, handle) }
    handle.refresh(); return handle
  }
  confirm(handle: LengthsAuthorityHandle, snapshot: PersistedSnapshot): void {
    this.assertHandle(handle); handle.bindSnapshot(snapshot); handle.refresh()
  }
  assertHandle(handle: LengthsAuthorityHandle): void {
    if (![...this.shared.handles.values()].includes(handle)) throw new LengthsIntegrityError('target durable domain changed')
  }
  witness(arm: ArmedAttempt, snapshot?: PersistedSnapshot, floor = 0, result?: State | null): number | null {
    const key = authorityBytes(original(arm))
    if (snapshot) return this.shared.snapshotWitnesses.get(`${key}:${authorityBytes(snapshot)}`)?.revision ?? null
    if (floor) {
      const witnesses = [...this.shared.snapshotWitnesses.values()].filter(x => x.arm === key && x.snapshot.kind === 'checkpoint' &&
        x.snapshot.revision >= floor && (!result || extendsState(result, x.snapshot.state)))
      return witnesses.length ? Math.min(...witnesses.map(x => x.revision)) : null
    }
    return this.shared.armWitnesses.get(key) ?? null
  }
  evaluate(handle: LengthsAuthorityHandle): ResultAuthority | AuthorityStatus {
    if (this.shared.replacement) return { kind: 'retired', evidence: 'installation_replaced', revision: this.shared.replacement.revision }
    if (this.shared.blocked) return { kind: 'blocked', cause: this.shared.blocked.cause }
    const root = this.latest()
    if (!root || handle.witnessRevision === null || root.counters[handle.arm.variant] < handle.arm.ordinal || handle.witnessRevision !== null && root.revision < handle.witnessRevision) return { kind: 'unknown' }
    const retained = root.attempts[handle.arm.sessionId]
    if (!retained || root.tombstones[handle.arm.sessionId] !== undefined || !handle.matches(retained)) return { kind: 'retired', evidence: 'missing_or_changed_arm', revision: root.revision }
    if (!handle.result) return { kind: 'current' }
    const snapshot = retained.snapshot ?? null, expected = handle.snapshot()
    if (handle.armedOnly) return snapshot ? { kind: 'retired', evidence: 'incompatible_result', revision: root.revision } : { kind: 'recoverable', snapshot: null }
    if (expected) return authorityEqual(snapshot, expected) ? { kind: 'confirmed', snapshot: expected } : { kind: 'retired', evidence: 'incompatible_result', revision: root.revision }
    const target = handle.result
    if (target.phase === 'break') {
      if (!snapshot ? handle.minimumRevision > 0 : snapshot.kind !== 'checkpoint' || snapshot.revision < handle.minimumRevision || !extendsState(target, snapshot.state))
        return { kind: 'retired', evidence: 'incompatible_result', revision: root.revision }
      return snapshot && authorityEqual(snapshot.state, target) ? { kind: 'confirmed', snapshot } : { kind: 'recoverable', snapshot }
    }
    if (snapshot?.kind === 'terminal') return authorityEqual(snapshot.state, target) ? { kind: 'confirmed', snapshot } : { kind: 'retired', evidence: 'incompatible_result', revision: root.revision }
    return { kind: 'recoverable', snapshot }
  }
}
/** Immutable target identity; witnesses/floors are acquired only from verified
 * register evidence. No operation can set authority or synthesize retirement. */
export class LengthsAuthorityHandle {
  readonly id = crypto.randomUUID()
  readonly arm: ArmedAttempt
  readonly result: State | null
  private witnessedRevision: number | null
  private floorRevision = 0
  get witnessRevision(): number | null { return this.witnessedRevision }
  get minimumRevision(): number { return this.floorRevision }
  private snapshotValue: PersistedSnapshot | null = null
  private retired: Extract<AuthorityStatus, { kind: 'retired' }> | null = null
  private readonly listeners = new Set<(status: AuthorityStatus) => void>()
  private previous = ''
  private readonly authority: LengthsAuthority
  readonly armedOnly: boolean
  constructor(authority: LengthsAuthority, arm: ArmedAttempt, result: State | null = null, armedOnly = false) {
    this.authority = authority; this.armedOnly = armedOnly
    this.arm = original(arm); this.result = result && freeze(structuredClone(result)); this.witnessedRevision = authority.witness(this.arm)
  }
  snapshot(): PersistedSnapshot | null { return this.snapshotValue }
  raiseFloor(floor: number): void {
    if (!Number.isSafeInteger(floor) || floor < this.minimumRevision) throw new LengthsIntegrityError('target floor regressed')
    const witness = this.authority.witness(this.arm, undefined, floor, this.result)
    if (witness === null) throw new LengthsIntegrityError('target floor has no verified witness')
    this.floorRevision = floor; this.witnessedRevision = Math.max(this.witnessRevision ?? 0, witness)
  }
  bindSnapshot(snapshot: PersistedSnapshot): void {
    if (!authorityEqual(this.result, snapshot.state) || this.snapshotValue && !authorityEqual(this.snapshotValue, snapshot)) throw new LengthsIntegrityError('immutable target snapshot changed')
    const witness = this.authority.witness(this.arm, snapshot)
    if (witness === null) throw new LengthsIntegrityError('published snapshot has no verified witness')
    this.snapshotValue = freeze(structuredClone(snapshot)); this.witnessedRevision = Math.max(this.witnessRevision ?? 0, witness)
  }
  resultStatus(): ResultAuthority | AuthorityStatus {
    if (this.retired) return this.retired
    const result = this.authority.evaluate(this)
    if (result.kind === 'retired') this.retired = freeze(result)
    return result
  }
  status(): AuthorityStatus { const result = this.resultStatus(); return result.kind === 'confirmed' || result.kind === 'recoverable' ? { kind: 'current' } : result }
  refresh(): void {
    if (this.witnessedRevision === null) this.witnessedRevision = this.authority.witness(this.arm)
    const status = this.status(), key = authorityBytes([status, this.resultStatus()])
    if (key === this.previous) return
    this.previous = key; for (const listener of this.listeners) listener(status)
  }
  subscribe(listener: (status: AuthorityStatus) => void): () => void { this.listeners.add(listener); listener(this.status()); return () => { this.listeners.delete(listener) } }
  assertCurrent(): void { const status = this.status(); if (status.kind !== 'current') throw new LengthsAuthorityError(status) }
  confirmed(): PersistedSnapshot { const status = this.resultStatus(); if (status.kind !== 'confirmed') throw new LengthsAuthorityError(this.status()); return status.snapshot }
  matches(arm: ArmedAttempt): boolean { return authorityEqual(this.arm, original(arm)) }
}
