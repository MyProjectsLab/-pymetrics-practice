import { Attempt } from '../assessment-usage/client'
import { basicReport } from './report'
import type { ActionSource, CoreAction, EventTime } from './contracts'
import type { DurableRecord, Settings } from './durable'
import { reconcileDurable } from './durable'
import { acquireOwner, BalloonsStore, withMutationGate, WriteFailure } from './storage'
import type { OwnerToken } from './storage'
import type { MockJourneyContext } from '../mock/journey-context'

export type RunView = { mode: 'idle' | 'explanation' | 'saving' | 'mounting' | 'playing' | 'paused' | 'unsaved' | 'write_failed' | 'uncertain' | 'verified_completion' | 'error' | 'report' | 'checking'; record: DurableRecord | null; message: string }
export const CHANGE_CHANNEL = 'assessment-practice-balloons-changes-v1'
export function announceChange() {
  const id = crypto.randomUUID()
  const send = (phase: 'begin' | 'end') => { if (typeof BroadcastChannel !== 'undefined') { const c = new BroadcastChannel(CHANGE_CHANNEL); c.postMessage({ id, phase }); c.close() } }
  send('begin'); return () => send('end')
}
function canceled(signal: AbortSignal) { if (signal.aborted) throw new DOMException('Canceled', 'AbortError') }
function twoFrames(element: HTMLElement, signal: AbortSignal, confirmed?: () => void): Promise<void> {
  return new Promise((resolve, reject) => {
    let frames = 0, raf = 0
    const finish = (error?: Error) => { cancelAnimationFrame(raf); clearTimeout(timer); signal.removeEventListener('abort', abort); if (error) reject(error); else resolve() }
    const abort = () => finish(new DOMException('Canceled', 'AbortError'))
    const timer = window.setTimeout(() => finish(new Error('The balloon display could not be confirmed. Resume the same session or return to history.')), 2000)
    const tick = () => {
      if (signal.aborted) { abort(); return }
      const box = element.getBoundingClientRect()
      if (document.visibilityState !== 'visible' || !element.isConnected || box.width <= 0 || box.height <= 0 || !element.querySelector('[data-balloon-type]') || !element.querySelector('[data-control="pump"]') || !element.querySelector('[data-control="collect"]')) {
        finish(new Error('The balloon display was interrupted before confirmation.')); return
      }
      if (++frames === 2) { confirmed?.(); finish() } else raf = requestAnimationFrame(tick)
    }
    signal.addEventListener('abort', abort, { once: true }); raf = requestAnimationFrame(tick)
    if (signal.aborted) abort()
  })
}
export class BalloonsController {
  private usage = new Attempt('balloons')
  view: RunView = { mode: 'idle', record: null, message: '' }
  private scope = new AbortController()
  private token: OwnerToken | null = null
  private releaseOwner: (() => Promise<void>) | null = null
  private epoch = crypto.randomUUID()
  private busy = false
  private disposed = false
  private armAttempted = false
  private saveFailure: 'write_failed' | 'delivery_uncertain' | null = null
  private cleanup: AbortController | null = null
  private onset: { token: OwnerToken; round: number; armSequence: number; time: EventTime } | null = null
  private ownerId = crypto.randomUUID()
  readonly store: BalloonsStore
  private publish: (view: RunView) => void
  private mount: (record: DurableRecord) => HTMLElement
  constructor(store: BalloonsStore, publish: (view: RunView) => void, mount: (record: DurableRecord) => HTMLElement) { this.store = store; this.publish = publish; this.mount = mount }
  time(): EventTime & { timeOriginMs: number } { return { timeOriginMs: performance.timeOrigin, clockEpochId: this.epoch, monotonicMs: performance.now(), wallTimeMs: Date.now() } }
  private show(mode: RunView['mode'], record = this.view.record, message = '') { this.view = { mode, record, message }; if (!this.disposed) this.publish(this.view) }
  private async begin() {
    this.cleanup?.abort()
    this.scope.abort()
    const previousRelease = this.releaseOwner
    this.releaseOwner = null
    const scope = new AbortController()
    this.scope = scope; this.epoch = crypto.randomUUID(); this.onset = null
    await previousRelease?.()
    canceled(scope.signal)
    if (this.disposed) throw new DOMException('Canceled', 'AbortError')
    // Operation cancellation fences callbacks; browser ownership lives until the
    // positive-onset cleanup is durably saved or definitively unavailable.
    const ownerScope = new AbortController()
    const release = await acquireOwner(ownerScope.signal)
    // Acquisition can finish after navigation, before a release capability was
    // available to pause(). Never bind that late result or reserve any form.
    if (scope.signal.aborted || this.disposed || this.scope !== scope) {
      ownerScope.abort(); await release()
      throw new DOMException('Canceled', 'AbortError')
    }
    const unbind = this.store.bindOwner(this.ownerId, release)
    this.releaseOwner = () => { unbind(); ownerScope.abort(); return release() }
    canceled(scope.signal)
  }
  async start(mode: 'auto' | 'replay' | 'new_baseline', settings: Settings, mock?: { context: MockJourneyContext; sessionId: string }) {
    if (this.busy) return
    this.usage.begin(mock ? 'mock' : 'practice')
    this.busy = true; this.show('saving', null, 'Assigning and saving your sequence…')
    try {
      await this.begin(); const signal = this.scope.signal, runSignal = signal
      if (mock) {
        if (mode !== 'replay') throw Error('Balloons mock requires RP replay allocation')
        await mock.context.beforeArm({ requestId: mock.sessionId, attemptId: mock.sessionId, originTicketId: null,
          installationId: this.store.installationId, generation: null, requestKind: 'assign', nativeIdentity: [] })
        canceled(signal)
      }
      await withMutationGate(async signal => {
        canceled(signal)
        const result = await this.store.assign(this.ownerId, mode, settings, navigator.userAgent, this.time(), signal, mock?.sessionId)
        if (signal.aborted) {
          if (this.scope.signal === runSignal) { this.token = result.token; void this.pause('navigation', true) }
          canceled(signal)
        }
        this.token = result.token
        this.usage.admit(result.record.header.identity.sessionId)
        this.show('saving', result.record)
      }, signal)
      await this.present()
    } catch (e) { await this.failure(e) } finally { this.busy = false }
  }
  async explainRetest(baselineSessionId: string, freshAttempt = false) {
    if (this.busy) return
    this.busy = true; this.show('saving', null, 'Checking the saved baseline and exercise…')
    try {
      await this.begin(); const runSignal = this.scope.signal
      await withMutationGate(async signal => {
        const result = await this.store.reserveRetest(this.ownerId, baselineSessionId, this.time(), navigator.userAgent, freshAttempt, signal)
        if (signal.aborted) {
          if (this.scope.signal === runSignal) { this.token = result.token; void this.pause('navigation', true) }
          canceled(signal)
        }
        this.token = result.token
        await this.store.verify(result.token, result.record); canceled(signal)
        this.show('explanation', result.record)
      }, runSignal)
    } catch (e) { await this.failure(e) } finally { this.busy = false }
  }
  async startRetest() {
    if (this.busy || this.view.mode !== 'explanation') return
    this.busy = true
    try { await this.present() } catch (e) { await this.failure(e) } finally { this.busy = false }
  }
  async resume(sessionId: string) {
    if (this.busy) return
    this.busy = true; this.show('saving', this.view.record, 'Checking the saved journal and ownership…')
    try {
      await this.begin(); const signal = this.scope.signal, runSignal = signal
      await withMutationGate(async signal => {
        canceled(signal)
        const result = await this.store.recover(this.ownerId, sessionId, this.time(), signal)
        if (signal.aborted) {
          if (this.scope.signal === runSignal) { this.token = result.token; void this.pause('navigation', true) }
          canceled(signal)
        }
        this.token = result.token
        this.show('saving', result.record)
      }, signal)
      if (this.view.record!.snapshot.phase === 'resolved') this.show('playing')
      else await this.present()
    } catch (e) { await this.failure(e) } finally { this.busy = false }
  }
  private async present() {
    const signal = this.scope.signal, token = this.token!
    this.onset = null
    await withMutationGate(async signal => {
      canceled(signal)
      let record = this.view.record!
      await this.store.verify(token, record); canceled(signal)
      this.armAttempted = true
      record = await this.store.commit(token, record, { kind: 'arm' }, this.time(), signal)
      canceled(signal)
      if (record.snapshot.phase === 'released') {
        this.show('paused', record, 'The retest reservation expired or the clock changed. Reopen the explanation before starting.')
        this.scope.abort(); this.releaseOwner?.(); this.releaseOwner = null
        return
      }
      // The mutation gate stays held from recheck through actual mount and confirmation.
      await this.store.verify(token, record); canceled(signal)
      this.view = { mode: 'mounting', record, message: 'Confirming balloon display…' }
      const element = this.mount(record)
      await twoFrames(element, signal, () => { if (record.header.retest) this.onset = { token, round: record.snapshot.core.round, armSequence: record.journal.at(-1)!.sequenceNumber, time: this.time() } }); canceled(signal)
      record = await this.store.commit(token, record, { kind: 'confirm' }, this.onset?.time ?? this.time(), signal)
      canceled(signal)
      await this.store.verify(token, record); canceled(signal)
      if (record.snapshot.phase === 'paused') {
        this.show('paused', record, 'The reservation expired before display confirmation. This sequence was exposed and this attempt is review only.')
        this.scope.abort(); this.releaseOwner?.(); this.releaseOwner = null
      } else this.show('playing', record)
    }, signal)
  }
  async action(kind: CoreAction['kind'], source: ActionSource, expectedRound: number, expectedRevision: number) {
    if (this.busy || this.view.mode !== 'playing' || !this.token || !this.view.record) return
    const start = this.view.record
    if (start.snapshot.core.round !== expectedRound || start.snapshot.core.revision !== expectedRevision) return
    this.busy = true; this.show('saving', start, 'Saving… Further clicks are not accepted yet.')
    const signal = this.scope.signal, token = this.token
    const action: CoreAction = { kind, source, expectedRound, expectedRevision, actionId: start.snapshot.core.nextActionId, time: this.time() }
    try {
      await withMutationGate(async signal => {
        canceled(signal)
        // Durable intent means a crash/failure between intent and atomic action commit is review-only on recovery.
        const intent = await this.store.commit(token, start, { kind: 'action_pending', action }, action.time, signal)
        canceled(signal)
        const record = await this.store.commit(token, intent, { kind: 'action', action }, action.time, signal)
        canceled(signal)
        await this.store.verify(token, record); canceled(signal)
        this.show(kind === 'next' ? 'saving' : 'playing', record)
        if(record.snapshot.phase==='completed'){
          this.usage.finish(record.header.identity.sessionId,'completed',()=>{const r=basicReport(record.snapshot.core);if(r.status!=='headless_complete')throw Error('No summary');return {rounds:39,banked_cents:r.total.bankedCents,bursts:r.total.burstCount,collections:r.total.collectedCount,pumps:r.total.attemptedPumps}})
        }
      }, signal)
      if (kind === 'next') await this.present()
    } catch (e) { await this.failure(e) } finally { this.busy = false }
  }
  async report() {
    if (this.busy || !this.token || this.view.record?.snapshot.phase !== 'completed') return
    this.busy = true; this.show('saving')
    const signal = this.scope.signal, token = this.token
    try {
      await withMutationGate(async signal => {
        const record = await this.store.commit(token, this.view.record!, { kind: 'report' }, this.time(), signal)
        canceled(signal); await this.store.verify(token, record); canceled(signal)
        reconcileDurable(record); this.show('report', record)
      }, signal)
      this.releaseOwner?.(); this.releaseOwner = null
    } catch { this.scope.abort(); this.releaseOwner?.(); this.show('error', null, 'The report-view entry could not be saved or its authority changed. Open history to check the completed result.') } finally { this.busy = false }
  }
  /** Synchronous UI/callback fence precedes any asynchronous cleanup. */
  async pause(reason = 'interrupted', leaving = false) {
    this.usage.cancel()
    if (reason === 'write_failed' || reason === 'delivery_uncertain') this.saveFailure = reason
    const failure = this.saveFailure
    if (failure) reason = 'write_failed' // Preserve F1's durable conservative checkpoint policy.
    const token = this.token, wasArmed = this.armAttempted, prior = this.view.record
    const release = this.releaseOwner
    const onset = this.onset
    const matchesOnset = (record: DurableRecord) => onset?.token === token && onset.round === record.snapshot.core.round && onset.armSequence === record.journal.at(-1)?.sequenceNumber
    const retainOnset = !!token && !!prior?.header.retest && prior.snapshot.phase === 'presentation_armed' && matchesOnset(prior)
    this.scope.abort()
    if (!retainOnset) { release?.(); this.releaseOwner = null }
    this.cleanup?.abort()
    this.show(failure === 'write_failed' ? 'write_failed' : failure ? 'uncertain' : 'paused', prior,
      failure ? `${failure === 'write_failed' ? 'A local write failed. ' : ''}Save status needs checking. Controls are paused until the saved session can be verified.` : 'Practice paused. Resume checks the saved journal and keeps the same sequence.')
    if (!token) return
    const cleanup = new AbortController()
    this.cleanup = cleanup
    const deadline = window.setTimeout(() => cleanup.abort(), 2000)
    try {
      await withMutationGate(async signal => {
        const root = await this.store.read()
        canceled(signal)
        let record = failure && prior ? this.store.reconcileCurrent(root, token, prior) : root.records[token.sessionId]
        if (failure && record?.snapshot.phase === 'completed') {
          // Reconciliation replays the immutable journal and completed result.
          // Never invalidate or rewrite a genuine completion to match a warning.
          if (!this.disposed) {
            // A fresh read-only observation lifetime; the old mutation stays aborted.
            this.scope = new AbortController()
            this.show('verified_completion', record, 'Saved completion verified: all 39 rounds. Open history to review the saved result.')
          }
          return
        }
        if (!record || root.owner?.id !== token.id || root.owner.generation !== token.generation || ['completed', 'released'].includes(record.snapshot.phase)) return
        // Preserve a positively confirmed RT onset even if interruption canceled
        // its presentation transaction. Never fabricate it from a scheduled frame.
        if (record.header.retest && record.snapshot.phase === 'presentation_armed' && onset && matchesOnset(record)) {
          record = await this.store.retainRetestOnset(token, record, onset.time, signal)
          canceled(signal)
        }
        const release = (leaving || !!record.header.retest) && !wasArmed && record.snapshot.exposure === 'pending_exposure'
        const next = await this.store.commit(token, record, release ? { kind: 'release' } : { kind: 'pause', reason }, this.time(), signal)
        canceled(signal)
        if (failure) {
          this.store.reconcileCurrent(await this.store.read(), token, next); canceled(signal)
          if (!this.disposed) this.show('unsaved', next, `We checked what this browser saved. This attempt is paused, and some recent actions could not be confirmed. It cannot count as a completed ${next.header.retest ? 'second run' : 'first run'}. Reopen it to review the saved progress.`)
        } else if (this.view.record && this.view.mode === 'paused') this.show('paused', next, this.view.message)
      }, cleanup.signal)
    } catch (e) {
      // A failed pause is not a clean checkpoint. In particular, navigation's
      // subsequent dispose must not turn that failure into an eligible recovery.
      if (e instanceof WriteFailure && this.cleanup === cleanup && this.scope.signal.aborted) {
        this.saveFailure = 'write_failed'
        if (this.view.record === prior) this.show('write_failed', prior,
          'Pause could not be saved. Save status needs checking before this session can resume.')
      }
    }
    finally {
      clearTimeout(deadline)
      if (retainOnset && this.releaseOwner === release) { this.releaseOwner = null; release?.() }
    }
  }
  private async failure(e: unknown) {
    if (this.scope.signal.aborted) return
    const message = e instanceof Error ? e.message : 'Local save failed'
    if (this.token) await this.pause(e instanceof WriteFailure ? 'write_failed' : 'delivery_uncertain')
    else { this.scope.abort(); this.releaseOwner?.(); this.show('error', null, message) }
  }
  async checkSaveStatus() {
    if (this.busy || !this.saveFailure) return
    this.busy = true
    try { await this.pause(this.saveFailure) } finally { this.busy = false }
  }
  async checkAuthority() {
    if (!this.token || !this.view.record || !['explanation', 'playing', 'report', 'verified_completion'].includes(this.view.mode) || this.busy) return
    if (this.view.mode === 'explanation' && this.view.record.header.retest) {
      const rt = this.view.record.header.retest, now = Date.now()
      if (now >= rt.expiresAtMs || now < rt.issuedAtMs) { await this.pause('reservation_expired_or_clock_changed', true); return }
    }
    const view = this.view, signal = this.scope.signal
    let finished = false, frame = 0, checking: RunView | null = null
    const stillCurrent = () => this.view === view || (checking !== null && this.view === checking)
    frame = requestAnimationFrame(() => { frame = requestAnimationFrame(() => {
      if (!finished && this.view === view) {
        this.show('checking', view.record, 'Checking saved session authority… Controls are paused until this check finishes.')
        checking = this.view
      }
    }) })
    try {
      const root = await this.store.read()
      if (!stillCurrent() || signal.aborted) return
      if (view.record?.header.retest) await this.store.verify(this.token, view.record)
      if (!stillCurrent() || signal.aborted) return
      const record = root.records[this.token.sessionId]
      if (!record || recordFingerprintSafe(record) !== recordFingerprintSafe(view.record!) || (view.mode !== 'report' && root.owner?.generation !== this.token.generation)) await this.pause('ownership_or_deletion_changed')
      else if (checking) this.show(view.mode, view.record, view.message)
    } catch { if (stillCurrent() && !signal.aborted) await this.pause('authority_unavailable') }
    finally { finished = true; cancelAnimationFrame(frame) }
  }
  authorityChanged() {
    void this.pause('ownership_or_deletion_changed')
    this.show('paused', null, 'Local history changed in another tab. Open history to check what remains.')
  }
  dispose() { this.disposed = true; return this.pause('navigation', true) }
}
function recordFingerprintSafe(record: DurableRecord) { return JSON.stringify(record) }
