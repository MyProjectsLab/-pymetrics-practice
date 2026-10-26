import { ArrowsAuthorityError } from './authority'
import type { ArrowsAuthorityHandle } from './authority'
import type { State } from './versions'
import type { ArmedAttempt, ArrowsStore, PersistedSnapshot, StartRequest } from './storage'
import { orderArrowsStart } from './presentation-order'

export const ARROWS_LIVE_LOCK = 'assessment-practice-arrows-live-v1'
const retiredRequests = new Set<string>()
export interface ArrowsAdmission { readonly id: string; readonly requestId: string; readonly trialIndex: number; readonly epoch: number }
export class ArrowsAdmissionChanged extends Error {}
/** Exclusive live ownership and short, ordered admission through each block's
 * first confirmed onset. Timed handlers only settle the captured token. */
export class ArrowsEntry {
  private epoch = 0
  private pending = false
  private active = false
  private controller: AbortController | null = null
  private releaseOwner: (() => void) | null = null
  private cancelPending: (() => void) | null = null
  private currentRequestId: string | null = null
  private admission: { token: ArrowsAdmission; finish: () => void; cancel: () => void } | null = null
  private readonly store: ArrowsStore
  constructor(store: ArrowsStore, _surfaceGeneration = 0) { this.store = store }
  authority(expected: ArmedAttempt, state: State, floor = 0): ArrowsAuthorityHandle { return this.store.authority.handle(expected, state, undefined, floor) }
  armAuthority(expected: ArmedAttempt): ArrowsAuthorityHandle { return this.store.authority.handle(expected) }
  confirmAuthority(handle: ArrowsAuthorityHandle, snapshot: PersistedSnapshot): void { this.store.authority.confirm(handle, snapshot) }
  async begin(request: StartRequest, beforeArm?: () => Promise<void>): Promise<ArmedAttempt> {
    const owned = structuredClone(request)
    if (this.pending || this.active) throw Error('Arrows entry already active')
    if (retiredRequests.has(owned.requestId)) throw Error('Arrows entry request was retired')
    if (typeof navigator === 'undefined' || !navigator.locks) throw Error('This browser cannot protect an Arrows run across tabs')
    if (document.visibilityState !== 'visible' || !document.hasFocus()) throw Error('Keep this tab visible and focused before starting Arrows')
    const epoch = ++this.epoch, controller = new AbortController()
    const timer = setTimeout(() => controller.abort(Error('Arrows entry timed out')), 5_000)
    this.controller = controller; this.currentRequestId = owned.requestId; this.pending = true
    let report!: (acquired: boolean) => void
    const acquired = new Promise<boolean>(resolve => { report = resolve })
    const canceled = new Promise<boolean>(resolve => { this.cancelPending = () => resolve(false); controller.signal.addEventListener('abort', () => resolve(false), { once: true }) })
    try {
      void navigator.locks.request(ARROWS_LIVE_LOCK, { mode: 'exclusive', ifAvailable: true }, async lock => {
        if (!lock || epoch !== this.epoch || controller.signal.aborted) { report(false); return }
        const hold = new Promise<void>(resolve => { this.releaseOwner = resolve }); report(true); await hold
      }).catch(() => report(false))
      if (!await Promise.race([acquired, canceled])) throw Error('Arrows is active in another tab or entry was canceled')
      if (epoch !== this.epoch || controller.signal.aborted) throw Error('Arrows entry canceled')
      if (beforeArm) { await beforeArm(); if (epoch !== this.epoch || controller.signal.aborted) throw Error('Arrows entry canceled') }
      const arm = await this.store.start(owned, controller.signal)
      await this.confirmArm(arm, epoch, controller.signal)
      this.pending = false; this.active = true; this.cancelPending = null
      return arm
    } catch (error) { if (epoch === this.epoch) this.close(false); throw error }
    finally { clearTimeout(timer) }
  }
  private close(retire: boolean): void {
    this.epoch++
    if (retire && this.currentRequestId !== null) retiredRequests.add(this.currentRequestId)
    this.currentRequestId = null; this.admission?.cancel(); this.admission = null
    this.controller?.abort(); this.cancelPending?.(); this.releaseOwner?.()
    this.controller = null; this.cancelPending = null; this.releaseOwner = null; this.pending = false; this.active = false
  }
  private owned(expected: ArmedAttempt): AbortSignal {
    if (!this.active || !this.controller || this.currentRequestId !== expected.requestId) throw Error('Arrows browser ownership is no longer active')
    return this.controller.signal
  }
  async checkCurrentArm(expected: ArmedAttempt): Promise<void> { await this.confirmArm(expected, this.epoch, this.owned(expected)) }
  private async confirmArm(expected: ArmedAttempt, epoch: number, signal: AbortSignal): Promise<void> {
    const handle = this.armAuthority(expected)
    expected = handle.arm
    const retained = await this.store.loadArmed(expected.sessionId, signal)
    handle.assertCurrent()
    if (!retained || !handle.matches(retained)) throw new ArrowsAuthorityError(handle.status())
    if (retained.snapshot?.kind === 'terminal') throw Error('Arrows arm is already terminal')
    if (epoch !== this.epoch || signal.aborted) throw Error('Arrows arm confirmation canceled')
  }
  private admit(expected: ArmedAttempt, target: ArrowsAuthorityHandle | null, trialIndex: number,
    present: (token: ArrowsAdmission) => void): Promise<void> {
    expected = target?.arm ?? this.armAuthority(expected).arm
    const ownerSignal = this.owned(expected), epoch = this.epoch, controller = new AbortController()
    const cancel = () => controller.abort(Error('Arrows admission canceled'))
    ownerSignal.addEventListener('abort', cancel, { once: true }); if (ownerSignal.aborted) cancel()
    const timer = setTimeout(() => controller.abort(Error('Arrows admission timed out')), 5_000)
    let accept!: () => void, reject!: (error: unknown) => void, accepted = false
    const acceptance = new Promise<void>((resolve, fail) => { accept = () => { accepted = true; resolve() }; reject = fail })
    void orderArrowsStart(async () => {
      if (target) {
        this.store.authority.assertHandle(target)
        if (!target.matches(expected)) throw Error('Arrows admission target changed')
        await this.store.loadArmed(expected.sessionId, controller.signal)
        target.confirmed()
      } else await this.confirmArm(expected, epoch, controller.signal)
      if (epoch !== this.epoch || controller.signal.aborted || !this.active) throw Error('Arrows admission canceled')
      const token = Object.freeze({ id: crypto.randomUUID(), requestId: expected.requestId, trialIndex, epoch })
      let finish!: () => void
      const onset = new Promise<void>(resolve => { finish = resolve })
      const admission = { token, finish, cancel }
      this.admission = admission
      try { present(token); accept(); await onset }
      finally { if (this.admission === admission) this.admission = null }
    }, controller.signal).catch(error => { if (!accepted) reject(error) })
      .finally(() => { clearTimeout(timer); ownerSignal.removeEventListener('abort', cancel) })
    return acceptance
  }
  admitStart(expected: ArmedAttempt, present: (token: ArrowsAdmission) => void): Promise<void> { return this.admit(expected, null, 1, present) }
  admitContinue(expected: ArmedAttempt, target: ArrowsAuthorityHandle, present: (token: ArrowsAdmission) => void): Promise<void> {
    if (target.result?.phase !== 'break') return Promise.reject(Error('Arrows Continue prefix required'))
    return this.admit(expected, target, target.result.trialIndex, present)
  }
  confirmFirstPresentation(expected: ArmedAttempt, token: ArrowsAdmission, trialIndex: number): void {
    const current = this.admission
    if (!current || current.token !== token || !this.active || this.epoch !== token.epoch ||
      expected.requestId !== token.requestId || this.currentRequestId !== token.requestId || trialIndex !== token.trialIndex) return
    current.finish()
  }
  async checkpoint(expected: ArmedAttempt, state: State, revision: number): Promise<PersistedSnapshot> {
    const epoch = this.epoch, signal = this.owned(expected)
    const target = this.authority(expected, state, revision)
    const snapshot = await this.store.saveSnapshot(target.arm, target.result!, revision, signal)
    target.assertCurrent()
    if (epoch !== this.epoch || signal.aborted || !this.active) throw Error('Arrows checkpoint was canceled')
    return snapshot
  }
  async currentCheckpoint(expected: ArmedAttempt, target: ArrowsAuthorityHandle): Promise<PersistedSnapshot | null> {
    this.store.authority.assertHandle(target)
    if (!target.matches(expected) || target.result?.phase !== 'break') throw Error('Arrows checkpoint target changed')
    expected = target.arm
    const epoch = this.epoch, ownerSignal = this.owned(expected), controller = new AbortController()
    const cancel = () => controller.abort(Error('Arrows checkpoint read canceled'))
    ownerSignal.addEventListener('abort', cancel, { once: true }); if (ownerSignal.aborted) cancel()
    const timer = setTimeout(() => controller.abort(Error('Arrows checkpoint verification timed out')), 2_000)
    try {
      // Both reads feed the same register, including verified observations whose
      // public delivery has already timed out or lost surface ownership.
      await this.confirmArm(expected, epoch, controller.signal)
      const snapshot = await this.store.loadSnapshot(expected.sessionId, controller.signal)
      target.assertCurrent()
      if (epoch !== this.epoch || controller.signal.aborted || !this.active) throw Error('Arrows checkpoint read was canceled')
      return snapshot?.kind === 'checkpoint' ? snapshot : null
    } finally { clearTimeout(timer); ownerSignal.removeEventListener('abort', cancel) }
  }
  async saveBreakExit(expected: ArmedAttempt, state: State, revision: number, signal?: AbortSignal): Promise<PersistedSnapshot> {
    if (state.phase !== 'break') throw Error('Arrows break prefix required')
    const target = this.authority(expected, state, revision)
    return this.store.saveSnapshot(target.arm, target.result!, revision, signal)
  }
  async currentBreakExit(expected: ArmedAttempt, target: ArrowsAuthorityHandle, signal?: AbortSignal): Promise<PersistedSnapshot | null> {
    this.store.authority.assertHandle(target)
    if (!target.matches(expected) || target.result?.phase !== 'break') throw Error('Arrows break target changed')
    const retained = await this.store.loadArmed(target.arm.sessionId, signal)
    target.assertCurrent()
    return retained?.snapshot ?? null
  }
  async saveTerminal(expected: ArmedAttempt, state: State, signal?: AbortSignal): Promise<PersistedSnapshot> {
    if (state.phase !== 'invalid' && state.phase !== 'completed') throw Error('Arrows terminal state required')
    const target = this.authority(expected, state)
    for (let attempt = 0; attempt < 2; attempt++) {
      const retained = await this.store.loadArmed(target.arm.sessionId, signal)
      target.assertCurrent()
      const prior = retained?.snapshot
      if (prior?.kind === 'terminal') return target.confirmed()
      try { return await this.store.saveSnapshot(target.arm, target.result!, prior?.revision ?? 0, signal) }
      catch (error) { if (attempt === 1 || !(error instanceof Error) || !error.message.includes('snapshot revision or prefix changed')) throw error }
    }
    throw Error('Arrows terminal save not confirmed')
  }
  async currentTerminal(expected: ArmedAttempt, state: State, signal?: AbortSignal): Promise<PersistedSnapshot | null> {
    const target = this.authority(expected, state)
    await this.store.loadArmed(target.arm.sessionId, signal)
    target.assertCurrent()
    const status = target.resultStatus()
    return status.kind === 'confirmed' ? status.snapshot : null
  }
  release(retire = true): void { this.close(retire) }
}
