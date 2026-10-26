vi.mock('./v11/static-surface', async () => await import('./static-surface-test-support'))
import { afterEach, expect, it, vi } from 'vitest'
import { ArrowsBrowserRun } from './browser'
import { ArrowsEntry } from './entry'
import type { ArrowsAdmission } from './entry'
import { ARROWS_PRESENTATION_LOCK } from './presentation-order'
import { advance } from './versions'
import type { State } from './versions'
import { ArrowsReportSession } from './report-session'
import { registerFixture, barrier, installTestLocks } from './register-test-support'
const locks = Object.getOwnPropertyDescriptor(navigator, 'locks')
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); document.body.replaceChildren(); if (locks) Object.defineProperty(navigator, 'locks', locks); else Reflect.deleteProperty(navigator, 'locks') })
async function browserFixture(blocks = 1, holdLast = false) {
  const active = installTestLocks(), x = await registerFixture(blocks, !holdLast), entry = new ArrowsEntry(x.store)
  if (holdLast) {
    let prefix = x.arm.state
    for (const command of x.prefix.commands) {
      if (command.kind === 'resolve' && prefix.trialIndex === blocks * 27) prefix = advance(prefix, { kind: 'keydown', atMs: prefix.onsetMs! + 200, code: 'ArrowLeft', repeat: false, modified: false })
      prefix = advance(prefix, command)
    }
    x.prefix = prefix; x.snapshot = await x.store.saveSnapshot(x.arm, prefix, 0); x.handle = x.store.authority.handle(x.arm, prefix, x.snapshot)
  }
  const owner = entry as unknown as { active: boolean; controller: AbortController; currentRequestId: string }
  owner.active = true; owner.controller = new AbortController(); owner.currentRequestId = x.arm.requestId
  let now = x.prefix.commands.at(-1)!.atMs + 100
  const host = document.createElement('div'), output = document.createElement('div'); document.body.append(host, output)
  vi.stubGlobal('requestAnimationFrame', () => 1); vi.stubGlobal('cancelAnimationFrame', () => {})
  const run = new ArrowsBrowserRun(entry, host, state => { output.textContent = run.recovery()?.outcome().kind === 'retired' ? 'unavailable' : `${state.phase}:${state.trialIndex}:${state.events.length}` }, () => now)
  const internal = run as unknown as { state: State; attempt: typeof x.arm; checkpointRevision: number; pendingFrame: { stage: string }; confirmNow: (pending: unknown) => void; admissionToken: ArrowsAdmission }
  internal.state = x.prefix; internal.attempt = x.arm; internal.checkpointRevision = 1
  vi.spyOn(run, 'layoutReady').mockReturnValue(true)
  vi.spyOn(run as unknown as { displayMatches: () => boolean }, 'displayMatches').mockReturnValue(true)
  const onset = async () => {
    now = run.snapshot()!.fixationDueMs!; internal.confirmNow(internal.pendingFrame)
    now = run.snapshot()!.stimulusDueMs!
    await vi.waitFor(() => expect(internal.pendingFrame?.stage).toBe('stimulus'))
    internal.confirmNow(internal.pendingFrame)
  }
  return { ...x, run, internal, entry, active, host, output, onset }
}
for (const order of ['arm-first', 'result-first'] as const) for (const phase of ['saved break', 'pending break', 'protected'] as const)
  for (const conflict of ['same revision', 'higher history'] as const)
    it(`one ${phase} report owner under ${order} ${conflict} withdrawal and exact resumption`, async () => {
      const x = await browserFixture(1, phase === 'pending break')
      const internal = x.run as unknown as { watchArm: () => void; targetForBreak: () => unknown; state: State; protectedBlock: boolean }
      if (phase === 'pending break') internal.state = advance(x.prefix, { kind: 'keyup', atMs: x.prefix.commands.at(-1)!.atMs + 1, code: 'ArrowLeft' })
      if (phase === 'protected') { internal.state = advance(x.prefix, { kind: 'continue', atMs: x.prefix.commands.at(-1)!.atMs + 1, responseHeld: false }); internal.protectedBlock = true }
      const before = internal.state
      if (order === 'arm-first') { internal.watchArm(); if (phase !== 'protected') internal.targetForBreak() }
      else { if (phase !== 'protected') internal.targetForBreak(); internal.watchArm() }
      // The register notifies insertion order, so explicitly vary that order
      // while keeping actual Store verification and actual Browser callbacks.
      const shared = (x.store.authority as unknown as { shared: { handles: Map<string, unknown> } }).shared
      if (order === 'result-first') { const entries = [...shared.handles.entries()].reverse(); shared.handles.clear(); for (const [key, value] of entries) shared.handles.set(key, value) }
      const good = structuredClone(x.backend.root), bad = structuredClone(good)
      bad.attempts.session = { ...bad.attempts.session, createdAtWallMs: 1001 }
      if (conflict === 'higher history') bad.revision++
      const published = vi.spyOn(x.output, 'textContent', 'set')
      x.backend.root = bad
      await expect(x.store.read()).rejects.toThrow()
      const recovery = x.run.recovery()!, target = recovery.authority
      expect(x.run.withdrawalAuthority()).toBe(target)
      expect(target.status().kind).toBe('blocked'); expect(published).toHaveBeenCalledTimes(1)
      expect(recovery.target.state.commands.slice(0, before.commands.length)).toEqual(before.commands)
      expect(recovery.target.state.events.slice(0, before.events.length)).toEqual(before.events)
      expect(recovery.target.state.phase).toBe(phase === 'protected' ? 'invalid' : 'break')
      if (phase === 'protected') expect(recovery.target.state.events.at(-1)?.detail.reason).toBe('technical')
      const session = new ArrowsReportSession(x.store, target, recovery, 'live'), id = session.viewId
      x.run.dispose(); expect(x.run.recovery()).toBe(recovery)
      x.backend.root = { ...good, revision: bad.revision }; await x.store.verifyIntegrity()
      expect((await recovery.recover()).kind).toBe('confirmed')
      const retained = (await x.store.loadArmed('session'))!
      session.assertRecord(retained); expect(session.variant()).toBe('published')
      expect(retained.snapshot!.state).toEqual(recovery.target.state)
      await x.store.appendReportView('session', target.confirmed(), id, 'live', session.observedWallMs, target)
      await x.store.appendReportView('session', target.confirmed(), id, 'live', session.observedWallMs, target)
      expect(x.backend.root.activity!.session.events).toHaveLength(1)
      expect(session.viewId).toBe(id); expect(x.run.recovery()).toBe(recovery)
    })
for (const blocks of [1, 2, 3, 4]) for (const deletion of ['individual', 'all'] as const) {
  it(`block ${blocks + 1} deletion-first ${deletion} rejects Continue before fixation/onset`, async () => {
    const x = await browserFixture(blocks), gate = barrier<void>()
    x.backend.changeNext = () => gate.promise
    const deleted = deletion === 'individual' ? x.remote.deleteAttempt('session') : x.remote.deleteAll()
    await vi.waitFor(() => expect(x.active.has(ARROWS_PRESENTATION_LOCK)).toBe(true))
    const continuing = x.run.continue(); void continuing.catch(() => {})
    gate.release(); await deleted; await expect(continuing).rejects.toThrow()
    expect(x.run.snapshot()!.commands.filter(command => command.kind === 'continue')).toHaveLength(blocks - 1)
    expect(x.host.querySelector('[data-arrows-stage]')).toBeNull()
    expect(x.output.textContent).toBe('unavailable'); expect(x.active.has(ARROWS_PRESENTATION_LOCK)).toBe(false)
    expect(Object.keys(x.backend.root.attempts)).toHaveLength(0)
    expect(x.backend.root.scoredStartCountV11).toBe(deletion === 'all' ? 0 : 1); x.run.dispose()
  })
  it(`block ${blocks + 1} admission-first ${deletion} retains the order through its captured first onset`, async () => {
    const x = await browserFixture(blocks), gate = barrier<void>(), read = x.store.loadArmed.bind(x.store)
    vi.spyOn(x.store, 'loadArmed').mockImplementationOnce(async (...args) => { const arm = await read(...args); await gate.promise; return arm })
    const continuing = x.run.continue()
    await vi.waitFor(() => expect(x.active.has(ARROWS_PRESENTATION_LOCK)).toBe(true))
    const deleted = deletion === 'individual' ? x.remote.deleteAttempt('session') : x.remote.deleteAll()
    gate.release(); await continuing
    expect(x.run.snapshot()!.phase).toBe('fixation_pending'); expect(x.backend.root.attempts.session).toBeDefined()
    expect(x.active.has(ARROWS_PRESENTATION_LOCK)).toBe(true)
    const token = x.internal.admissionToken, trial = blocks * 27 + 1
    x.entry.confirmFirstPresentation(x.arm, { ...token }, trial)
    x.entry.confirmFirstPresentation(x.arm, token, trial - 27)
    await Promise.resolve(); expect(x.active.has(ARROWS_PRESENTATION_LOCK)).toBe(true)
    let boundary: { onset: boolean; stimulus: boolean } | null = null
    const change = x.backend.change.bind(x.backend)
    vi.spyOn(x.backend, 'change').mockImplementation(async work => {
      boundary = { onset: x.run.snapshot()!.events.some(event => event.type === 'stimulus_presented' && event.trialIndex === trial), stimulus: !!x.host.querySelector('[data-arrows-stage="stimulus"]') }
      return change(work)
    })
    await x.onset(); await deleted
    expect(boundary).toEqual({ onset: true, stimulus: true }); expect(x.active.has(ARROWS_PRESENTATION_LOCK)).toBe(false)
    expect(Object.keys(x.backend.root.attempts)).toHaveLength(0); x.run.dispose()
  })
}
for (const ordinal of [1, 2]) for (const cancelAt of ['before', 'after'] as const)
  it(`R7 read ${ordinal}, cancel ${cancelAt} verified U observation: exact P withdraws and U/arm survive`, async () => {
    const x = await browserFixture(), held = barrier<typeof x.backend.root>(), positive = structuredClone(x.backend.root)
    const t = x.prefix.commands.at(-1)!.atMs + 1, u = advance(x.prefix, { kind: 'invalidate', atMs: t, reason: 'technical' })
    const read = x.backend.read.bind(x.backend); let reads = 0
    vi.spyOn(x.backend, 'read').mockImplementation(async () => ++reads === ordinal ? held.promise : read())
    const task = x.run.retryCheckpoint(); void task.catch(() => {})
    await vi.waitFor(() => expect(reads).toBe(ordinal))
    // Independent backend wrapper prevents the write from pre-observing in A.
    vi.mocked(x.backend.read).mockImplementation(read)
    await x.remote.saveSnapshot(x.arm, u, 1)
    if (cancelAt === 'before') x.run.endBreakForReview()
    held.release(structuredClone(x.backend.root))
    await expect(task).rejects.toThrow()
    await vi.waitFor(() => expect(x.handle.status().kind).toBe('retired'))
    if (cancelAt === 'after' && x.run.snapshot()!.phase === 'break') expect(x.run.recovery()!.outcome().kind).toBe('retired')
    expect(x.store.authority.handle(x.arm, u).resultStatus().kind).toBe('confirmed')
    expect(x.store.authority.handle(x.arm).status().kind).toBe('current')
    const bytes = JSON.stringify(x.backend.root)
    x.backend.readNext = async () => positive; await x.store.read(); expect(JSON.stringify(x.backend.root)).toBe(bytes)
    x.run.dispose()
  })
for (const reason of ['blur', 'pagehide', 'dispose'] as const) it(`${reason} before Continue onset releases the order and permits queued deletion`, async () => {
  const x = await browserFixture(); await x.run.continue()
  const deleted = x.remote.deleteAttempt('session')
  if (reason === 'dispose') x.run.dispose(); else window.dispatchEvent(new Event(reason))
  await deleted; await vi.waitFor(() => expect(x.active.has(ARROWS_PRESENTATION_LOCK)).toBe(false))
  expect(x.run.snapshot()!.events.filter(event => event.type === 'stimulus_presented')).toHaveLength(27)
  expect(x.backend.root.scoredStartCountV11).toBe(1); x.run.dispose()
})
it('held response/layout failure withholds Continue, releases the short lock, and allows a healthy retry', async () => {
  const x = await browserFixture()
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft' }))
  await expect(x.run.continue()).rejects.toThrow('response control held'); expect(x.run.protectedNow()).toBe(false)
  expect(x.active.has(ARROWS_PRESENTATION_LOCK)).toBe(false)
  window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowLeft' }))
  vi.mocked(x.run.layoutReady).mockReturnValue(false)
  await expect(x.run.continue()).rejects.toThrow('display'); expect(x.active.has(ARROWS_PRESENTATION_LOCK)).toBe(false)
  vi.mocked(x.run.layoutReady).mockReturnValue(true); await x.run.continue(); await x.onset()
  expect(x.run.snapshot()!.trialIndex).toBe(28); expect(x.run.protectedNow()).toBe(true); x.run.dispose()
})

it('a key release during final Continue verification saves the extended prefix before admitting the next block', async () => {
  const x = await browserFixture(1, true), gate = barrier<void>(), read = x.store.loadArmed.bind(x.store)
  vi.spyOn(x.store, 'loadArmed').mockImplementationOnce(async (...args) => { const arm = await read(...args); await gate.promise; return arm })
  const task = x.run.continue()
  await vi.waitFor(() => expect(x.active.has(ARROWS_PRESENTATION_LOCK)).toBe(true))
  window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowLeft' }))
  const released = x.run.snapshot()!
  expect(released.events.at(-1)!.type).toBe('input_released'); expect(released.phase).toBe('break')
  gate.release(); await task
  expect(x.backend.root.attempts.session.snapshot!.state).toEqual(released)
  expect(x.backend.root.attempts.session.snapshot!.revision).toBe(2)
  expect(x.run.snapshot()!.phase).toBe('fixation_pending'); expect(x.run.snapshot()!.heldCodes).toEqual([])
  await x.onset(); x.run.dispose()
})
it('a held checkpoint verification times out independently; its canceled negative still withdraws the same target', async () => {
  const x = await browserFixture(), held = barrier<typeof x.backend.root>()
  x.backend.readNext = () => held.promise
  const task = x.run.retryCheckpoint(); void task.catch(() => {})
  await vi.waitFor(() => expect(x.backend.readNext).toBeNull()); vi.useFakeTimers()
  await vi.advanceTimersByTimeAsync(2_000); await expect(task).rejects.toThrow('canceled'); vi.useRealTimers()
  expect(x.handle.status().kind).toBe('current'); await x.remote.deleteAttempt('session')
  held.release(structuredClone(x.backend.root)); await vi.waitFor(() => expect(x.handle.status().kind).toBe('retired'))
  expect(x.output.textContent).toBe('unavailable'); x.run.dispose()
})

it('Continue captures the original arm and token before a caller mutates its arm during the final read', async () => {
  const x = await browserFixture(), gate = barrier<void>(), read = x.store.loadArmed.bind(x.store), mutable = structuredClone(x.arm)
  vi.spyOn(x.store, 'loadArmed').mockImplementationOnce(async (...args) => { const arm = await read(...args); await gate.promise; return arm })
  let token!: ArrowsAdmission
  const admitted = x.entry.admitContinue(mutable, x.handle, value => { token = value })
  await vi.waitFor(() => expect(x.active.has(ARROWS_PRESENTATION_LOCK)).toBe(true))
  ;(mutable as { requestId: string; sessionId: string }).requestId = 'changed'; (mutable as { sessionId: string }).sessionId = 'changed'
  gate.release(); await admitted
  expect(token.requestId).toBe(x.arm.requestId); x.entry.confirmFirstPresentation(x.arm, token, 28)
  await vi.waitFor(() => expect(x.active.has(ARROWS_PRESENTATION_LOCK)).toBe(false)); x.run.dispose()
})
