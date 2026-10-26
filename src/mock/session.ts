import type { Availability, BreakRecord, Game, Mock, NativeArm, Preferences, Reason, Root } from './contract'
import { GAMES } from './contract'
import { applyMockCommand, canonicalEqual, claimLaunch } from './state'
import type { MockCommand } from './state'
import { MockStore, MockStoreError, withMockDataOrder } from './storage'
import { withSourceProjection } from './sources'
import { NativePresenceError } from './native-presence'
import { assertAuthority, onAuthorityClose } from './authority'
import { settleBalloonsMock } from '../balloons/mock-bridge'

function selected(root: Root, id: string): Mock {
  const mock = root.mocks.find(item => item.id === id)
  if (!mock) throw new MockStoreError('stale', 'This mock history was removed.')
  return mock
}
function matchesReceipt(mock: Mock, command: MockCommand) {
  const receipt = mock.lastCommand
  return receipt?.requestId === command.requestId && receipt.kind === command.kind && receipt.launchId === command.launchId &&
    receipt.expectedRevision === command.expectedRevision && canonicalEqual(receipt.canonicalMetadata, command.canonicalMetadata)
}
function lossReason(error: NativePresenceError): Reason {
  return error.kind === 'missing_database' || error.kind === 'missing_key' ? 'missing' : error.kind as Reason
}
type Operation = {
  readonly token: object; readonly epoch: number; readonly label: string; slot: number; game: Game;
  installationId: string | null; expectedRevision: number | null;
  state: 'running' | 'confirmed' | 'unknown' | 'reconciled';
  steps: readonly MockCommand[]; claim: { launchId: string; game: Game; expectedRevision: number } | null;
  attempted: boolean; autoRead: boolean;
}
/** One immutable admission identity; only finish/check may publish its final state. */
export class MockSession {
  readonly store: MockStore
  readonly mockId: string
  readonly documentId = crypto.randomUUID()
  private readonly life = new AbortController()
  private epoch = 0
  private publication: { view: Mock; status: 'running' | 'confirmed' | 'unknown' | 'reconciled'; target: { slot: number; game: Game; label: string }; epoch: number } | null = null
  viewFor(view: Mock | null): Mock | null {
    const published = this.publication
    return view && published && published.epoch === this.epoch && published.view.id === view.id && published.view.revision > view.revision ? published.view : view
  }
  private active: Operation | null = null
  private unresolved: Operation | null = null
  private admitted: { token: object; revision: number; slot: number } | null = null
  constructor(store: MockStore, mockId: string) { this.store = store; this.mockId = mockId }
  dispose() { this.epoch++; this.life.abort(); if (this.active?.state === 'running') this.retire(this.active) }
  get hasUnresolved() { return this.unresolved !== null }
  get isPending() { return this.active !== null }
  get unresolvedLabel() { const op = this.unresolved; return op ? `${op.label} for game ${op.slot} (${op.game})` : null }
  async fromView<T>(view: Mock, work: () => Promise<T>): Promise<T> {
    if (view.id !== this.mockId || this.admitted) throw new MockStoreError('stale', 'The displayed mock changed.')
    const admission = { token: {}, revision: view.revision, slot: Math.min(view.cursor, 12) }
    this.admitted = admission
    try { return await work() } finally { if (this.admitted === admission) this.admitted = null }
  }
  private mutationReady() {
    this.life.signal.throwIfAborted()
    if (this.unresolved) throw new MockStoreError('unknown', `The ${this.unresolvedLabel} is uncertain. Check that exact save first.`)
    if (this.active) throw new MockStoreError('stale', 'A mock save is still being checked.')
  }
  private assertOperation(op: Operation, signal: AbortSignal) {
    assertAuthority(signal); this.life.signal.throwIfAborted()
    if (this.active !== op || op.epoch !== this.epoch || op.state !== 'running') throw new MockStoreError('unknown', 'The original action has retired. Check its save.')
  }
  private retire(op: Operation) {
    if (op.state !== 'running') return
    op.state = 'unknown'
    if (this.publication?.epoch === op.epoch) this.publication = { ...this.publication, status: 'unknown' }
    if (op.attempted && this.active === op && !this.unresolved) this.unresolved = op
  }
  private current(root: Root, op: Operation): Mock {
    if (op.installationId !== null && root.installationId !== op.installationId) throw new MockStoreError('stale', 'The mock installation was replaced.')
    const mock = selected(root, this.mockId)
    if (op.expectedRevision !== null && mock.revision !== op.expectedRevision) throw new MockStoreError('stale', 'The displayed mock changed. Check its current game before another action.')
    op.installationId = root.installationId; op.expectedRevision = mock.revision
    return mock
  }
  /** The single synchronous finalizer runs while all required authorities are live. */
  private finish(op: Operation, mock: Mock, signal: AbortSignal): Mock {
    this.assertOperation(op, signal)
    this.publication = { view: structuredClone(mock), status: 'confirmed', target: { slot: op.slot, game: op.game, label: op.label }, epoch: op.epoch }
    op.state = 'confirmed'
    if (this.unresolved === op) this.unresolved = null
    if (this.admitted) this.admitted.revision = mock.revision
    return mock
  }
  private async run<T>(label: string, work: (op: Operation, signal: AbortSignal, before: Mock) => Promise<T>, parent?: AbortSignal, targetSlot?: number): Promise<T> {
    this.mutationReady()
    const slot = targetSlot ?? this.admitted?.slot ?? 1
    const op: Operation = { token: {}, epoch: this.epoch, label, slot, game: GAMES[slot - 1], installationId: null,
      expectedRevision: this.admitted?.revision ?? null, state: 'running', steps: [], claim: null, attempted: false, autoRead: false }
    this.active = op
    const controller = new AbortController(), cancel = () => controller.abort()
    const removeLife = onAuthorityClose(this.life.signal, cancel)
    let removeParent = () => {}
    try {
      if (parent) removeParent = onAuthorityClose(parent, cancel)
      return await withMockDataOrder(async signal => {
        const remove = onAuthorityClose(signal, () => this.retire(op))
        try {
          this.assertOperation(op, signal)
          const before = this.current(await this.store.readWithinOrder(signal), op)
          this.assertOperation(op, signal)
          if (!this.admitted && targetSlot === undefined) { op.slot = Math.min(before.cursor, 12); op.game = GAMES[op.slot - 1] }
          this.publication = { view: structuredClone(before), status: 'running', target: { slot: op.slot, game: op.game, label: op.label }, epoch: op.epoch }
          return await work(op, signal, before)
        } finally { remove(); if (op.state === 'running') this.retire(op) }
      }, controller.signal)
    } catch (error) {
      this.retire(op)
      // One event-independent overlapping read may release a private resource
      // cell. It never clears U or turns this retired call into success.
      if (this.unresolved === op && !op.autoRead && !this.life.signal.aborted) {
        op.autoRead = true
        try { await this.store.read() } catch { /* A failed/held barrier proves nothing. */ }
      }
      throw error
    } finally {
      removeLife(); removeParent()
      if (this.active === op) this.active = null
    }
  }
  private async write(op: Operation, command: MockCommand, signal: AbortSignal): Promise<Mock> {
    this.assertOperation(op, signal)
    if (command.expectedRevision !== op.expectedRevision) throw new MockStoreError('stale', 'Command revision changed.')
    const immutable = structuredClone(command)
    op.steps = [...op.steps, immutable]; op.attempted = true
    // U is staged before dispatch and belongs to this O, not its request UUID.
    this.unresolved = op
    await this.store.changeWithinOrder(root => {
      if (root.installationId !== op.installationId) throw new MockStoreError('stale', 'Mock installation changed.')
      return applyMockCommand(root, this.mockId, immutable)
    }, signal, () => this.assertOperation(op, signal))
    const root = await this.store.readWithinOrder(signal)
    this.assertOperation(op, signal)
    if (root.installationId !== op.installationId) throw new MockStoreError('stale', 'Mock installation changed.')
    const current = selected(root, this.mockId)
    if (!matchesReceipt(current, immutable) || current.lastCommand!.resultRevision < current.protocolStartRevision)
      throw new MockStoreError('unknown', 'The admitted save needs reconciliation.')
    op.expectedRevision = current.revision
    return current
  }
  private command(before: Mock, kind: MockCommand['kind'], launchId: string | null, canonicalMetadata: Record<string, unknown>): MockCommand {
    return { requestId: crypto.randomUUID(), expectedRevision: before.revision, kind, launchId, canonicalMetadata: structuredClone(canonicalMetadata) }
  }
  async read() { const root = await this.store.read(); this.life.signal.throwIfAborted(); return selected(root, this.mockId) }
  /** Deliberate reconciliation, never replay. A completed overlapping read is required. */
  async checkUnresolved(): Promise<Mock> {
    this.life.signal.throwIfAborted()
    if (this.active) throw new MockStoreError('stale', 'A mock save is still being checked.')
    const retained = this.unresolved, epoch = this.epoch
    return withMockDataOrder(async signal => {
      const root = await this.store.readWithinOrder(signal)
      assertAuthority(signal); this.life.signal.throwIfAborted()
      if (this.epoch !== epoch || this.unresolved !== retained) throw new MockStoreError('stale', 'The checked action changed.')
      if (retained?.installationId && retained.installationId !== root.installationId || !root.mocks.some(mock => mock.id === this.mockId)) {
        this.dispose(); throw new MockStoreError('stale', 'This mock history was removed or replaced. Leave this history.')
      }
      const mock = selected(root, this.mockId)
      // Exact receipt, supersession, legacy receipt and unchanged revision all
      // reconcile to this current view after the barrier, without an old success claim.
      this.publication = { view: structuredClone(mock), status: 'reconciled', target: { slot: Math.min(mock.cursor, 12), game: GAMES[Math.min(mock.cursor - 1, 11)], label: 'current view' }, epoch }
      if (retained) retained.state = 'reconciled'
      this.unresolved = null
      if (this.admitted) this.admitted.revision = mock.revision
      return mock
    }, this.life.signal)
  }
  private execute(kind: MockCommand['kind'], launchId: string | null, metadata: Record<string, unknown>) {
    const immutable = structuredClone(metadata)
    return this.run(kind, async (op, signal, before) => this.finish(op, await this.write(op, this.command(before, kind, launchId, immutable), signal), signal))
  }
  start() { return this.execute('start', null, { checkpointWallMs: Date.now() }) }
  launch() { return this.launchWithId(crypto.randomUUID()) }
  async launchWithId(launchId: string) { const mock = await this.read(); return this.execute('launch', launchId, { slot: mock.cursor, settingsRevision: mock.settings.length }) }
  claim(launchId: string, game: Game) {
    return this.run('claim launch', async (op, signal, before) => {
      op.claim = { launchId, game, expectedRevision: before.revision }; op.attempted = true; this.unresolved = op
      await this.store.changeWithinOrder(root => {
        if (root.installationId !== op.installationId) throw new MockStoreError('stale', 'Mock installation changed.')
        return claimLaunch(root, { mockId: this.mockId, launchId, game, documentId: this.documentId, expectedRevision: before.revision })
      }, signal, () => this.assertOperation(op, signal))
      const root = await this.store.readWithinOrder(signal), mock = selected(root, this.mockId)
      const attempt = mock.slots[before.cursor - 1]?.attempts.find(item => item.launchId === launchId)
      if (root.installationId !== op.installationId || mock.activeLaunchId !== launchId || attempt?.ownerDocumentId !== this.documentId) throw new MockStoreError('unknown', 'Launch claim needs checking.')
      return this.finish(op, mock, signal)
    })
  }
  async armPending(launchId: string, arm: NativeArm) {
    arm=structuredClone(arm)
    this.mutationReady()
    const mock = await this.read(), attempt = mock.slots[mock.cursor - 1]?.attempts.find(item => item.launchId === launchId)
    if (attempt?.nativeArm) {
      if (!canonicalEqual(attempt.nativeArm, arm)) throw new MockStoreError('stale', 'A different native arm is already bound to this launch.')
      if (['arm_pending', 'armed', 'terminal_verified'].includes(attempt.phase)) return mock
    }
    return this.execute('arm_pending', launchId, { slot: mock.cursor, settingsRevision: mock.settings.length, nativeArm: arm })
  }
  async cancelConfirmedNoArm(launchId: string) {
    this.mutationReady()
    const mock = await this.read(), attempt = mock.slots[mock.cursor - 1]?.attempts.find(item => item.launchId === launchId)
    if (mock.phase !== 'launching' || mock.activeLaunchId !== launchId || attempt?.phase !== 'pending_launch' || attempt.nativeArm !== null)
      throw new MockStoreError('stale', 'An arm may exist. Inspect the exact source before retrying.')
    return this.execute('cancel_no_arm', launchId, { slot: mock.cursor, reason: 'no_arm' })
  }
  reconcile(launchId: string, settleOrphan = false): Promise<Mock> { return this.inspectLaunch(launchId, false, settleOrphan) }
  async retireForRetry(launchId: string): Promise<Mock> {
    this.mutationReady()
    const mock = await this.read(), attempt = mock.slots[mock.cursor - 1]?.attempts.find(item => item.launchId === launchId)
    if (!attempt?.nativeArm) return this.cancelConfirmedNoArm(launchId)
    return this.inspectLaunch(launchId, true, false)
  }
  private inspectLaunch(launchId: string, retry: boolean, settleOrphan: boolean): Promise<Mock> {
    return this.run(retry ? 'retry retirement' : 'check native result', async (op, signal, current) => {
      const slot = current.slots[current.cursor - 1], attempt = slot?.attempts.find(item => item.launchId === launchId)
      if (current.activeLaunchId !== launchId || !attempt?.nativeArm) throw new MockStoreError('stale', 'This native launch is no longer active.')
      if (slot.game === 'balloons' && settleOrphan) {
        try { await settleBalloonsMock(attempt.nativeArm, signal) }
        catch (error) { if (!(error instanceof NativePresenceError)) throw error; /* Reobserve definite loss under the bridge's stable native order. */ }
      }
      return withSourceProjection(slot.game, attempt.nativeArm, attempt.settingsRevision, async (source, native) => {
        const remove = onAuthorityClose(native, () => this.retire(op))
        try {
          this.assertOperation(op, native)
          let mock = this.current(await this.store.readWithinOrder(native), op)
          let live = mock.slots[mock.cursor - 1]?.attempts.find(item => item.launchId === launchId)
          if (!live || !canonicalEqual(live.nativeArm, attempt.nativeArm) || mock.activeLaunchId !== launchId) throw new MockStoreError('stale', 'Native launch changed.')
          const normal = ['normal_complete', 'task_limit'].includes(source.classification)
          if (!retry && live.phase === 'terminal_verified' && normal && canonicalEqual(live.reference, source.reference) && live.classification === source.classification) return this.finish(op, mock, native)
          if ((retry || !normal) && source.reference && live.phase === 'arm_pending') {
            mock = await this.write(op, this.command(mock, 'bind_arm', launchId, { slot: mock.cursor, reference: source.reference }), native)
            this.assertOperation(op, native)
            live = mock.slots[mock.cursor - 1].attempts.find(item => item.launchId === launchId)
            if (live?.phase !== 'armed') throw new MockStoreError('stale', 'Native binding changed.')
          }
          const kind = source.classification === 'no_arm' ? 'cancel_no_arm' : !retry && normal && source.reference ? 'terminal' : 'review_only'
          const metadata = kind === 'cancel_no_arm' ? { slot: mock.cursor, reason: 'no_arm' } : kind === 'terminal' ?
            { slot: mock.cursor, reference: source.reference, classification: source.classification, reason: source.classification === 'task_limit' ? 'natural_limit' : 'none' } :
            { slot: mock.cursor, classification: source.classification, reason: source.classification === 'incomplete' ? 'technical_interruption' : retry ? 'user_exit' : 'unconfirmed' }
          return this.finish(op, await this.write(op, this.command(mock, kind, launchId, metadata), native), native)
        } finally { remove() }
      }, signal, async (loss, native) => {
        this.assertOperation(op, native)
        const mock = this.current(await this.store.readWithinOrder(native), op)
        const live = mock.slots[mock.cursor - 1]?.attempts.find(item => item.launchId === launchId)
        if (mock.activeLaunchId !== launchId || !live?.nativeArm || !canonicalEqual(live.nativeArm, attempt.nativeArm)) throw new MockStoreError('stale', 'Lost native launch changed.')
        return this.finish(op, await this.write(op, this.command(mock, 'review_only', launchId,
          { slot: mock.cursor, classification: live.classification === 'unknown' ? 'incomplete' : live.classification, reason: lossReason(loss) }), native), native)
      })
    })
  }
  accept(launchId: string, parent?: AbortSignal): Promise<Mock> {
    return this.run('Continue', async (op, signal, mock) => {
      const slot = mock.slots[mock.cursor - 1], attempt = slot?.attempts.find(item => item.launchId === launchId)
      if (!attempt?.nativeArm || !attempt.reference || attempt.phase !== 'terminal_verified') throw new MockStoreError('stale', 'Native report must be verified first.')
      return withSourceProjection(slot.game, attempt.nativeArm, attempt.settingsRevision, async (source, native) => {
        const remove = onAuthorityClose(native, () => this.retire(op))
        try {
          this.assertOperation(op, native)
          if (!source.reference || !canonicalEqual(source.reference, attempt.reference) || source.classification !== attempt.classification || !['normal_complete', 'task_limit'].includes(source.classification)) throw new MockStoreError('stale', 'Native result changed. Check its history.')
          return this.finish(op, await this.write(op, this.command(mock, 'accept', launchId,
            { slot: mock.cursor, reference: source.reference, classification: source.classification, checkpointWallMs: Date.now() }), native), native)
        } finally { remove() }
      }, signal)
    }, parent)
  }
  sourceStatus(slotIndex: number, parent?: AbortSignal): Promise<Availability> {
    return this.run('source status', async (op, signal, mock) => {
      const slot = mock.slots[slotIndex - 1]
      if (!slot || slot.index !== slotIndex) throw new MockStoreError('stale', 'Mock position changed.')
      const attempt = slot.attempts.find(item => item.launchId === slot.acceptedLaunchId) ?? slot.attempts.findLast(item => item.reference !== null)
      if (!attempt?.nativeArm || !attempt.reference) { this.finish(op, mock, signal); return 'unchecked' }
      const commit = async (availability: Availability, reason: Reason, native: AbortSignal): Promise<Availability> => {
        this.assertOperation(op, native)
        const before = this.current(await this.store.readWithinOrder(native), op), live = before.slots[slotIndex - 1]?.attempts.find(item => item.launchId === attempt.launchId)
        if (!live || !canonicalEqual(live.reference, attempt.reference)) throw new MockStoreError('stale', 'Mock reference changed.')
        const next = live.availability === availability && live.reason === reason ? before : await this.write(op,
          this.command(before, 'source_status', attempt.launchId, { slot: slotIndex, reference: attempt.reference, availability, reason }), native)
        this.finish(op, next, native); return availability
      }
      return withSourceProjection(slot.game, attempt.nativeArm, attempt.settingsRevision, async (source, native) => {
        if (!canonicalEqual(source.reference, attempt.reference) || source.classification !== attempt.classification) throw new MockStoreError('stale', 'Native source no longer matches its saved reference.')
        return commit('available', attempt.classification === 'task_limit' ? 'natural_limit' : 'none', native)
      }, signal, (loss, native) => {
        const reason = lossReason(loss), availability: Availability = ['deleted','replaced','corrupt'].includes(reason) ? reason as Availability : 'unavailable'
        return commit(availability, reason, native)
      })
    }, parent, slotIndex)
  }
  async omit(reason: string) { this.mutationReady();const mock = await this.read(); return this.execute('omit', null, { slot: mock.cursor, reason, checkpointWallMs: Date.now() }) }
  leave() { return this.execute('leave', null, { checkpointWallMs: Date.now() }) }
  finishEarly() { return this.execute('finish_early', null, { checkpointWallMs: Date.now() }) }
  async settings(preferences: Preferences) { preferences=structuredClone(preferences);this.mutationReady();const mock = await this.read(); return this.execute('settings', null,
    { settingsRevision: mock.settings.length + 1, preferences, checkpointWallMs: Date.now() }) }
  async breakStart(kind: BreakRecord['kind']) {
    this.mutationReady()
    const mock = await this.read(), wall = Date.now(), record: BreakRecord = { id: crypto.randomUUID(), kind,
      afterSlot: mock.cursor - 1, startWallMs: wall, endWallMs: null, clockDocumentId: this.documentId,
      startMonoMs: Math.round(performance.now()), endMonoMs: null, elapsedMs: null, durationBasis: 'open' }
    return this.execute('break_start', null, { breakId: record.id, checkpointWallMs: wall, breakRecord: record })
  }
  async breakEnd() {
    this.mutationReady()
    const mock = await this.read(), prior = mock.breaks.at(-1)
    if (!prior || prior.endWallMs !== null) throw new MockStoreError('stale', 'No break is open.')
    const wall = Date.now(), sameDocument = prior.clockDocumentId === this.documentId, mono = Math.round(performance.now())
    const elapsed = sameDocument && mono >= prior.startMonoMs ? mono - prior.startMonoMs : wall >= prior.startWallMs ? wall - prior.startWallMs : null
    const record: BreakRecord = { ...prior, endWallMs: wall, endMonoMs: sameDocument ? mono : null,
      elapsedMs: elapsed, durationBasis: sameDocument && mono >= prior.startMonoMs ? 'monotonic' : elapsed === null ? 'unknown' : 'estimated_wall' }
    return this.execute('break_end', null, { breakId: record.id, checkpointWallMs: wall, breakRecord: record })
  }
  declineBreak() { return this.execute('decline_break', null, { checkpointWallMs: Date.now() }) }
  async resume() {
    this.mutationReady()
    const mock = await this.read(), wall = Date.now(), gap = wall - mock.checkpointWallMs
    const label = gap < 0 ? 'multi_session_time_uncertain' : gap <= 86_400_000 ? 'resumed' : 'multi_session'
    const rank = { uninterrupted: 0, resumed: 1, multi_session: 2, multi_session_time_uncertain: 3 }
    const continuity = rank[label] > rank[mock.continuity] ? label : mock.continuity
    return this.execute('resume', null, { checkpointWallMs: wall, continuity })
  }
}
