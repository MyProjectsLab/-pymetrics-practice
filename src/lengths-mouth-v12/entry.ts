import { MouthAuthorityError, authorityEqual } from './authority'
import type { MouthAuthorityHandle } from './authority'
import type { State } from './engine'
import type { ArmedAttempt, MouthStore, PersistedSnapshot, StartRequest } from './storage'
import { orderMouthStart } from './order'

export const MOUTH_LIVE_LOCK = 'assessment-practice-lengths-mouth-live-v1-2'
const retiredRequests = new Set<string>()
export interface MouthAdmission { readonly id: string; readonly requestId: string; readonly trialIndex: number; readonly epoch: number }
export class MouthAdmissionChanged extends Error {}
/** Exclusive live ownership and short, ordered admission through each block's
 * first confirmed onset. Timed handlers only settle the captured token. */
export class MouthEntry {
  private epoch = 0
  private pending = false
  private active = false
  private controller: AbortController | null = null
  private releaseOwner: (() => void) | null = null
  private cancelPending: (() => void) | null = null
  private currentRequestId: string | null = null
  private admission: { token: MouthAdmission; finish: () => void; cancel: () => void } | null = null
  private readonly store: MouthStore
  constructor(store: MouthStore, _surfaceGeneration = 0) { this.store = store }
  authority(expected: ArmedAttempt, state: State, floor = 0): MouthAuthorityHandle { return this.store.authority.handle(expected, state, undefined, floor) }
  armAuthority(expected: ArmedAttempt): MouthAuthorityHandle { return this.store.authority.handle(expected) }
  confirmAuthority(handle: MouthAuthorityHandle, snapshot: PersistedSnapshot): void { this.store.authority.confirm(handle, snapshot) }
  async begin(request: StartRequest): Promise<ArmedAttempt> {
    const owned = structuredClone(request)
    if (this.pending || this.active) throw Error('Mouth entry already active')
    if (retiredRequests.has(owned.requestId)) throw Error('Mouth entry request was retired')
    if (typeof navigator === 'undefined' || !navigator.locks) throw Error('This browser cannot protect a Mouth run across tabs')
    if (document.visibilityState !== 'visible' || !document.hasFocus()) throw Error('Keep this tab visible and focused before starting Mouth')
    const epoch = ++this.epoch, controller = new AbortController()
    const timer = setTimeout(() => controller.abort(Error('Mouth entry timed out')), 5_000)
    this.controller = controller; this.currentRequestId = owned.requestId; this.pending = true
    let report!: (acquired: boolean) => void
    const acquired = new Promise<boolean>(resolve => { report = resolve })
    const canceled = new Promise<boolean>(resolve => { this.cancelPending = () => resolve(false); controller.signal.addEventListener('abort', () => resolve(false), { once: true }) })
    try {
      void navigator.locks.request(MOUTH_LIVE_LOCK, { mode: 'exclusive', ifAvailable: true }, async lock => {
        if (!lock || epoch !== this.epoch || controller.signal.aborted) { report(false); return }
        const hold = new Promise<void>(resolve => { this.releaseOwner = resolve }); report(true); await hold
      }).catch(() => report(false))
      if (!await Promise.race([acquired, canceled])) throw Error('Mouth is active in another tab or entry was canceled')
      if (epoch !== this.epoch || controller.signal.aborted) throw Error('Mouth entry canceled')
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
    if (!this.active || !this.controller || this.currentRequestId !== expected.requestId) throw Error('Mouth browser ownership is no longer active')
    return this.controller.signal
  }
  async checkCurrentArm(expected: ArmedAttempt): Promise<void> { await this.confirmArm(expected, this.epoch, this.owned(expected)) }
  private async confirmArm(expected: ArmedAttempt, epoch: number, signal: AbortSignal): Promise<void> {
    const handle = this.armAuthority(expected)
    expected = handle.arm
    const retained = await this.store.loadArmed(expected.sessionId, signal)
    handle.assertCurrent()
    if (!retained || !handle.matches(retained)) throw new MouthAuthorityError(handle.status())
    if (retained.snapshot?.kind === 'terminal') throw Error('Mouth arm is already terminal')
    if (epoch !== this.epoch || signal.aborted) throw Error('Mouth arm confirmation canceled')
  }
  private admit(expected: ArmedAttempt, target: MouthAuthorityHandle | null, trialIndex: number,
    present: (token: MouthAdmission) => void, liveState?: State): Promise<void> {
    expected = target?.arm ?? this.armAuthority(expected).arm
    const ownerSignal = this.owned(expected), epoch = this.epoch, controller = new AbortController()
    const cancel = () => controller.abort(Error('Mouth admission canceled'))
    ownerSignal.addEventListener('abort', cancel, { once: true }); if (ownerSignal.aborted) cancel()
    const timer = setTimeout(() => controller.abort(Error('Mouth admission timed out')), 5_000)
    let accept!: () => void, reject!: (error: unknown) => void, accepted = false
    const acceptance = new Promise<void>((resolve, fail) => { accept = () => { accepted = true; resolve() }; reject = fail })
    void orderMouthStart(async () => {
      if (target) {
        this.store.authority.assertHandle(target)
        if (!target.matches(expected)) throw Error('Mouth admission target changed')
        await this.store.loadArmed(expected.sessionId, controller.signal)
        target.confirmed()
      } else await this.confirmArm(expected, epoch, controller.signal)
      if (liveState) {
        const retained = await this.store.loadArmed(expected.sessionId, controller.signal)
        const prefix = retained?.snapshot?.state ?? retained?.state
        if (!prefix || !authorityEqual(liveState.events.slice(0, prefix.events.length), prefix.events) || !authorityEqual(liveState.commands.slice(0, prefix.commands.length), prefix.commands)) throw Error('Mouth known durable prefix changed')
      }
      if (epoch !== this.epoch || controller.signal.aborted || !this.active) throw Error('Mouth admission canceled')
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
  admitTrial(expected: ArmedAttempt, state: State, present: (token: MouthAdmission) => void): Promise<void> { return this.admit(expected, null, state.trialIndex, present, state) }
  async reclaim(expected: ArmedAttempt): Promise<void> {
    if (this.active) return
    if (this.pending) throw Error('Ownership check already pending')
    if (!navigator.locks) throw Error('Cross-tab ownership unavailable')
    const epoch = ++this.epoch, controller = new AbortController()
    this.controller = controller; this.currentRequestId = expected.requestId; this.pending = true
    let report!: (ok: boolean) => void
    const acquired = new Promise<boolean>(resolve => { report = resolve })
    this.cancelPending = () => report(false)
    void navigator.locks.request(MOUTH_LIVE_LOCK, { ifAvailable: true }, async lock => {
      if (!lock || epoch !== this.epoch || controller.signal.aborted) { report(false); return }
      const hold = new Promise<void>(resolve => { this.releaseOwner = resolve }); report(true); await hold
    }).catch(() => report(false))
    if (!await acquired || epoch !== this.epoch) { if (epoch === this.epoch) this.close(false); throw Error('Mouth is active in another tab or ownership was canceled') }
    this.pending = false; this.active = true
    try { await this.confirmArm(expected, epoch, controller.signal) } catch (error) { this.close(false); throw error }
  }
  admitStart(expected: ArmedAttempt, present: (token: MouthAdmission) => void): Promise<void> { return this.admit(expected, null, 1, present) }
  admitContinue(expected: ArmedAttempt, target: MouthAuthorityHandle, present: (token: MouthAdmission) => void): Promise<void> {
    if (target.result?.phase !== 'break') return Promise.reject(Error('Mouth Continue prefix required'))
    return this.admit(expected, target, target.result.trialIndex, present)
  }
  confirmFirstPresentation(expected: ArmedAttempt, token: MouthAdmission, trialIndex: number): void {
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
    if (epoch !== this.epoch || signal.aborted || !this.active) throw Error('Mouth checkpoint was canceled')
    return snapshot
  }
  async currentCheckpoint(expected: ArmedAttempt, target: MouthAuthorityHandle): Promise<PersistedSnapshot | null> {
    this.store.authority.assertHandle(target)
    if (!target.matches(expected) || target.result?.phase !== 'break') throw Error('Mouth checkpoint target changed')
    expected = target.arm
    const epoch = this.epoch, ownerSignal = this.owned(expected), controller = new AbortController()
    const cancel = () => controller.abort(Error('Mouth checkpoint read canceled'))
    ownerSignal.addEventListener('abort', cancel, { once: true }); if (ownerSignal.aborted) cancel()
    const timer = setTimeout(() => controller.abort(Error('Mouth checkpoint verification timed out')), 2_000)
    try {
      // Both reads feed the same register, including verified observations whose
      // public delivery has already timed out or lost surface ownership.
      await this.confirmArm(expected, epoch, controller.signal)
      const snapshot = await this.store.loadSnapshot(expected.sessionId, controller.signal)
      target.assertCurrent()
      if (epoch !== this.epoch || controller.signal.aborted || !this.active) throw Error('Mouth checkpoint read was canceled')
      return snapshot?.kind === 'checkpoint' ? snapshot : null
    } finally { clearTimeout(timer); ownerSignal.removeEventListener('abort', cancel) }
  }
  async saveBreakExit(expected: ArmedAttempt, state: State, revision: number, signal?: AbortSignal): Promise<PersistedSnapshot> {
    if (state.phase !== 'break') throw Error('Mouth break prefix required')
    const target = this.authority(expected, state, revision)
    return this.store.saveSnapshot(target.arm, target.result!, revision, signal)
  }
  async currentBreakExit(expected: ArmedAttempt, target: MouthAuthorityHandle, signal?: AbortSignal): Promise<PersistedSnapshot | null> {
    this.store.authority.assertHandle(target)
    if (!target.matches(expected) || target.result?.phase !== 'break') throw Error('Mouth break target changed')
    const retained = await this.store.loadArmed(target.arm.sessionId, signal)
    target.assertCurrent()
    return retained?.snapshot ?? null
  }
  async saveTerminal(expected: ArmedAttempt, state: State, signal?: AbortSignal): Promise<PersistedSnapshot> {
    if (state.phase !== 'invalid' && state.phase !== 'completed') throw Error('Mouth terminal state required')
    const target = this.authority(expected, state)
    for (let attempt = 0; attempt < 2; attempt++) {
      const retained = await this.store.loadArmed(target.arm.sessionId, signal)
      target.assertCurrent()
      const prior = retained?.snapshot
      if (prior?.kind === 'terminal') return target.confirmed()
      try { return await this.store.saveSnapshot(target.arm, target.result!, prior?.revision ?? 0, signal) }
      catch (error) { if (attempt === 1 || !(error instanceof Error) || !error.message.includes('snapshot revision or prefix changed')) throw error }
    }
    throw Error('Mouth terminal save not confirmed')
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
