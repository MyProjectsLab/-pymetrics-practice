import { TowersAttempt } from './controller'
import type { TowersRevocation } from './controller'
import { awaitTowersDelivery, TowersAuthorityError, TowersStore, withTowersDataOrderBounded } from './storage'
import type { Run } from './storage'
import type { Form } from './forms'
import type { PendingEvent } from './engine'

type StartInput = Parameters<TowersStore['start']>[0]
type IntentInput = Parameters<TowersStore['intent']>[0]
type AppendInput = Parameters<TowersStore['append']>[0]
type ExitKind = 'exited' | 'interrupted'
export type TowersSettlement = { state: 'settled' | 'pending' | 'retired'; run?: Run;
  reason?: string; retryable?: boolean }

interface ResolutionOperation { id: string; controller: AbortController; promise?: Promise<void> }

interface Session {
  attempt: TowersAttempt
  store: TowersStore
  start?: StartInput
  intent?: IntentInput
  onset?: AppendInput
  action?: AppendInput
  run?: Run
  form?: Form
  owner?: () => void
  decision?: { kind: ExitKind; elapsedMs: number | null; wallMs: number; reason: string }
  terminalId?: string
  resolving?: ResolutionOperation
  retryTimer?: ReturnType<typeof setTimeout>
  retries: number
  settlement: TowersSettlement
}

class TowersOpenTimeout extends Error {}

/** Document-lifetime authority. A route may detach while this resolver keeps running. */
export class TowersRuntime {
  private store: TowersStore | null = null
  private opening: Promise<TowersStore> | null = null
  private everOpened = false
  private unresolvedRawOpens = 0
  private session: Session | null = null
  private withdrawKind: ExitKind | null = null
  private listeners = new Set<(value: TowersSettlement) => void>()

  subscribe(listener: (value: TowersSettlement) => void) {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }
  private publish(value: TowersSettlement) {
    if (this.session) this.session.settlement = value
    this.notify(value)
  }
  private notify(value: TowersSettlement) {
    for (const listener of this.listeners) {
      try { listener(value) } catch (reason) { console.error('Towers view subscriber failed', reason) }
    }
  }
  get current() { return this.session?.settlement ?? null }
  get unsettled() { return !!this.session && this.session.settlement.state === 'pending' }
  get currentStore() { return this.store }

  private mockStorage=false
  private retainedOnly=false
  async openStore(mockStorage=false,retainedOnly=false) {
    this.mockStorage ||= mockStorage
    this.retainedOnly ||= retainedOnly
    if (this.store) return this.store
    if (this.opening) return this.opening
    const opening = (async () => {
      try { return await this.openOnce() }
      catch (reason) {
        if (!(reason instanceof TowersOpenTimeout) &&
          !(reason instanceof DOMException && reason.name === 'AbortError')) throw reason
        await new Promise<void>(resolve => setTimeout(resolve, 900))
        return this.openOnce()
      }
    })()
    this.opening = opening
    try { return await opening }
    finally { if (this.opening === opening) this.opening = null }
  }
  private async openOnce() {
    const controller = new AbortController()
    const opening = this.mockStorage?TowersStore.openForMock(controller.signal,!this.retainedOnly):TowersStore.open(undefined, { signal: controller.signal,
      initializeIfAbsent: !this.everOpened,
      acquireRawOpen: () => {
        if (this.unresolvedRawOpens >= 2)
          throw Error('Towers storage is unavailable. Try again later.')
        this.unresolvedRawOpens++
        let released = false
        return () => { if (!released) { released = true; this.unresolvedRawOpens-- } }
      } })
    let adopted = false
    let expired = false
    const bounded = new Promise<TowersStore>((resolve, reject) => {
      const timer = setTimeout(() => { expired = true
        controller.abort()
        reject(new TowersOpenTimeout('Towers storage opening is unconfirmed')) }, 2500)
      void opening.then(value => { clearTimeout(timer)
        if (adopted || expired) { value.close(); return }
        adopted = true; this.store = value; this.everOpened = true; resolve(value) }, reason => {
        clearTimeout(timer); if (!expired) reject(reason) })
    })
    return bounded
  }
  replaceStore(old: TowersStore, next: TowersStore) {
    if (this.store === old && !this.unsettled) { old.close(); this.store = next; return true }
    next.close(); return false
  }
  async reopenAfterReplacement(old: TowersStore) {
    if (this.store === old) this.store = null
    if (this.session?.store !== old || !this.unsettled) old.close()
    return this.openStore()
  }
  begin(attempt: TowersAttempt, store: TowersStore, start: StartInput) {
    if (this.unsettled) throw Error('A prior Towers attempt still needs confirmation')
    this.session = { attempt, store, start, retries: 0, settlement: { state: 'pending' } }
  }
  adoptOwner(attempt: TowersAttempt, release: () => void) {
    const current = this.session
    if (!current || current.attempt !== attempt || !attempt.active) { release(); return false }
    current.owner = release
    return true
  }
  recordRun(run: Run, form?: Form) {
    const current = this.session
    if (!current || current.attempt.runId !== run.id) return
    current.run = run; if (form) current.form = form
  }
  recordIntent(input: IntentInput) {
    if (this.session?.attempt.runId === input.runId) this.session.intent = input
  }
  recordOnset(input: AppendInput) {
    if (this.session?.attempt.runId === input.runId) this.session.onset = input
  }
  recordAction(input: AppendInput) {
    if (this.session?.attempt.runId === input.runId) this.session.action = input
  }
  confirmAction(input: AppendInput, run: Run) {
    const current = this.session
    if (!current || current.attempt.runId !== input.runId || current.action?.id !== input.id) return
    current.action = undefined; current.run = run
  }
  markSettled(runId: string) {
    const current = this.session
    if (!current || runId !== current.attempt.runId) return
    current.resolving?.controller.abort()
    if (current.retryTimer) clearTimeout(current.retryTimer)
    current.owner?.(); current.owner = undefined
    current.attempt.stop()
    if (this.store !== current.store) current.store.close()
    const value: TowersSettlement = { state: 'settled' }
    current.settlement = value
    this.session = null
  }
  /** Capture the first withdrawal before any asynchronous read or route teardown. */
  withdraw(reason: string, kind: ExitKind = 'interrupted') {
    const current = this.session
    if (!current || current.settlement.state !== 'pending') return
    this.withdrawKind = kind
    try { const decision = current.attempt.revoke(reason)
      if (decision) this.captureRevocation(decision, kind) }
    finally { this.withdrawKind = null }
  }
  captureRevocation(value: TowersRevocation, kind: ExitKind = 'interrupted') {
    const current = this.session
    if (!current || current.settlement.state !== 'pending') return
    if (!current.decision) current.decision = { kind: this.withdrawKind ?? kind,
      elapsedMs: value.elapsedMs, wallMs: value.wallTimestampMs, reason: value.reason }
    current.owner?.(); current.owner = undefined
    this.resolve(current)
  }
  /** Called after every new durable delivery; late callbacks never regain input authority. */
  nudge(runId: string) { const current = this.session
    if (current?.attempt.runId === runId && current.decision &&
      current.settlement.state === 'pending' && current.retries < 2 && !current.resolving) {
      if (current.retryTimer) clearTimeout(current.retryTimer)
      current.retryTimer = undefined
      this.resolve(current)
    } }
  private resolve(current: Session) {
    if (current.resolving || current.settlement.state !== 'pending') return
    if (current.retryTimer) clearTimeout(current.retryTimer)
    current.retryTimer = undefined
    const op: ResolutionOperation = { id: crypto.randomUUID(), controller: new AbortController() }
    current.resolving = op
    const timer = setTimeout(() => op.controller.abort(), 2500)
    op.promise = (async () => {
      try {
        const signal = op.controller.signal
        let value = await awaitTowersDelivery(this.settleOnce(current, signal), signal)
        if (this.session !== current || current.resolving !== op || signal.aborted) return
        if (value.state !== 'pending') {
          if (value.run) {
            // A durable read may go stale before the screen publishes it. Hold the
            // same order as deletion through the synchronous listener handoff.
            value = await withTowersDataOrderBounded(async orderedSignal => {
              try {
                const root = await awaitTowersDelivery(current.store.read(orderedSignal), orderedSignal)
                const latest = root.runs[value.run!.id]
                if (!latest || root.tombstones[value.run!.id]) return { state: 'retired' } as TowersSettlement
                if (latest.revision !== value.run!.revision) return {
                  state: 'pending', reason: 'Towers saved state changed during confirmation',
                } as TowersSettlement
                if (this.session !== current || current.resolving !== op || signal.aborted)
                  return { state: 'pending', reason: 'Towers confirmation changed' } as TowersSettlement
                this.finish(current, value)
                return value
              } catch (reason) {
                if (reason instanceof TowersAuthorityError) return { state: 'retired' } as TowersSettlement
                throw reason
              }
            }, signal)
          }
          if (this.session === current && current.resolving === op && value.state !== 'pending')
            this.finish(current, value)
        }
        if (this.session === current && current.resolving === op) this.remainPending(current, value)
      } catch (reason) {
        if (this.session === current && current.resolving === op) {
          if (reason instanceof TowersAuthorityError) this.finish(current,
            { state: 'retired', reason: reason.message })
          else this.remainPending(current, { state: 'pending', retryable: true,
            reason: op.controller.signal.aborted ? 'Towers settlement delivery unconfirmed' :
              reason instanceof Error ? reason.message : 'Save unconfirmed' })
        }
      } finally {
        clearTimeout(timer)
        if (current.resolving === op) current.resolving = undefined
      }
    })()
    void op.promise.catch(reason => console.error('Towers settlement failed unexpectedly', reason))
  }
  private remainPending(current: Session, value: TowersSettlement) {
    this.publish({ ...value, state: 'pending', retryable: true })
    if (++current.retries < 2) current.retryTimer = setTimeout(() => {
      current.retryTimer = undefined
      if (this.session === current) this.resolve(current)
    }, 900)
  }
  private finish(current: Session, value: TowersSettlement) {
    if (this.session !== current) return
    if (current.retryTimer) clearTimeout(current.retryTimer)
    current.retryTimer = undefined
    current.attempt.stop(); current.settlement = value; this.session = null
    if (this.store !== current.store) current.store.close()
    this.notify(value)
  }
  retry() { const current = this.session
    if (current?.decision && !current.resolving) {
      current.retries = 0
      this.resolve(current)
    } }

  private async settleOnce(current: Session, signal: AbortSignal): Promise<TowersSettlement> {
    const decision = current.decision
    if (!decision) return { state: 'pending', reason: 'No withdrawal decision' }
    {
      const store = current.store
      const root = await awaitTowersDelivery(store.read(signal), signal)
      const run = root.runs[current.attempt.runId]
      if (root.tombstones[current.attempt.runId]) return { state: 'retired' }
      if (!run) {
        if (current.start) await awaitTowersDelivery(store.cancelUnseen({ runId: current.start.runId,
          documentId: current.start.documentId, generation: current.attempt.generation,
          startRequestId: current.start.id }, signal), signal)
        return { state: 'settled' }
      }
      if (run.status === 'complete' || run.status === 'interrupted') return { state: 'settled', run }
      if (run.presentation === 'unseen') {
        await awaitTowersDelivery(store.cancelUnseen({ runId: run.id, documentId: run.documentId,
          generation: run.generation, startRequestId: current.start?.id }, signal), signal)
        return { state: 'settled' }
      }
      if (run.presentation === 'intent') {
        const onset = current.onset
        if (!onset) return { state: 'settled', run }
        const resolved = await withTowersDataOrderBounded(orderedSignal =>
          awaitTowersDelivery(store.resolveOnsetFailure({ id: `${onset.id}_resolve`,
          runId: run.id, documentId: run.documentId, generation: run.generation,
          revision: onset.revision, onsetActionId: onset.event.actionId,
          terminal: decision.elapsedMs === null ? undefined : { elapsedMs: decision.elapsedMs,
            reason: decision.reason, wallTimestampMs: decision.wallMs, kind: decision.kind } },
          orderedSignal), orderedSignal), signal)
        if (resolved.status === 'active') return { state: 'pending',
          reason: 'Board onset timing needs confirmation' }
        return { state: 'settled', run: resolved }
      }
      return withTowersDataOrderBounded(async orderedSignal => {
        const fresh = await awaitTowersDelivery(store.read(orderedSignal), orderedSignal)
        let updated = fresh.runs[run.id]
        if (!updated || fresh.tombstones[run.id]) return { state: 'retired' }
        if (updated.status !== 'active') return { state: 'settled', run: updated }
        if (current.action) updated = await awaitTowersDelivery(
          store.append(current.action, orderedSignal), orderedSignal)
        if (updated.status !== 'active') return { state: 'settled', run: updated }
        const form = current.form ?? store.forms.find(item => item.form.formId === run.formId)?.form
        if (!form || decision.elapsedMs === null) return { state: 'pending', reason: 'Timing needs confirmation' }
        const elapsedMs = Math.max(decision.elapsedMs, updated.events.at(-1)?.elapsedMs ?? 0)
        const kind: PendingEvent['kind'] = elapsedMs >= form.limitMs ? 'expired' : decision.kind
        const terminal: PendingEvent = { kind, sequence: updated.events.length + 1,
          elapsedMs: kind === 'expired' ? form.limitMs : elapsedMs,
          wallTimestampMs: decision.wallMs,
          actionId: current.terminalId ??= crypto.randomUUID(),
          ...(kind === 'expired' ? {} : { reason: decision.reason }) }
        const saved = await awaitTowersDelivery(store.append({ id: `${current.terminalId}_request`, runId: run.id,
          documentId: run.documentId, generation: run.generation, revision: updated.revision,
          event: terminal }, orderedSignal), orderedSignal)
        return { state: 'settled', run: saved }
      }, signal)
    }
  }
}
