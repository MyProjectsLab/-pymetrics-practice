import { ArrowsAuthority } from './authority'
import { describe, expect, it, vi } from 'vitest'
import { ArrowsBrowserRun } from './browser'
import { advance, armHeadless, canonicalState } from './versions'
import type { State } from './versions'
import { loadArrowsForms } from './versions'
import type { ArrowsEntry } from './entry'
import type { ArmedAttempt, PersistedSnapshot, ArrowsRoot } from './storage'
import { ARROWS_STORAGE_VERSION } from './contracts'
import { reconcileHeadless } from './versions'

const forms = await loadArrowsForms()
const profile = { kind: 'keyboard' as const, leftCode: 'ArrowLeft', rightCode: 'ArrowRight',
  alternative: false, accommodation: 'default' as const, reducedMotion: false }
function armed(state: State): ArmedAttempt {
  return { requestId: 'request', sessionId: 'session', clockDomainId: 'clock',
    profile, ordinal: 1, createdAtWallMs: 0, state }
}
function throughFirstBlock(holdLastKey = false): State {
  let state = armHeadless(forms.get('AR1')!, { installationId: 'installation', sessionId: 'session',
    clockDomainId: 'clock' }, profile, 0)
  state = advance(state, { kind: 'start', atMs: 0, responseHeld: false })
  for (let trial = 1; trial <= 24; trial++) {
    state = advance(state, { kind: 'fixation', atMs: state.fixationDueMs! })
    state = advance(state, { kind: 'onset', atMs: state.stimulusDueMs! })
    if (holdLastKey && trial === 24) state = advance(state, { kind: 'keydown',
      atMs: state.onsetMs! + 200, code: 'ArrowLeft', repeat: false, modified: false })
    state = advance(state, { kind: 'resolve', atMs: state.resolutionDueMs! })
    state = advance(state, { kind: 'offset', atMs: state.resolutionDueMs! })
  }
  expect(state.phase).toBe('break')
  return state
}

/** Frame-unit adapter: storage outcomes enter the same register rather than
 * emitting caller-selected authority facts. Native/real Store coverage is in
 * register-browser and the bounded browser evidence. */
function withAuthority(entry: ArrowsEntry): ArrowsEntry {
  const authority = new ArrowsAuthority('installation')
  let root: ArrowsRoot | null = null
  const seed = (arm: ArmedAttempt) => {
    if (!root) { root = { version: ARROWS_STORAGE_VERSION, installationId: 'installation', revision: 1,
      scoredStartCount: 1, attempts: { [arm.sessionId]: arm }, tombstones: {}, activity: {} }
      authority.observe(root, authority.provenance('read')) }
  }
  const observe = (arm: ArmedAttempt, snapshot: PersistedSnapshot | null, state?: State) => {
    seed(arm)
    if (snapshot) {
      const raw = snapshot.state ?? state!
      const saved = canonicalState(raw, forms.get(raw.form.id)!)
      const complete: PersistedSnapshot = { ...snapshot, kind: saved.phase === 'break' ? 'checkpoint' : 'terminal',
        state: saved, closedTrials: saved.events.filter(event => event.type === 'trial_closed').length, review: reconcileHeadless(saved) }
      root = { ...root!, revision: root!.revision + 1, attempts: { ...root!.attempts, [arm.sessionId]: { ...arm, snapshot: complete } } }
      authority.observe(root, authority.provenance('read'))
    }
  }
  for (const name of ['checkpoint', 'saveBreakExit', 'saveTerminal', 'currentCheckpoint', 'currentBreakExit', 'currentTerminal'] as const) {
    const method = entry[name]
    if (typeof method === 'function') Object.assign(entry, { [name]: async (...args: unknown[]) => {
      const arm = args[0] as ArmedAttempt
      const value = await (method as (...args: unknown[]) => Promise<PersistedSnapshot | null>)(...args)
      const state = name === 'currentCheckpoint' || name === 'currentBreakExit'
        ? (args[1] as import('./authority').ArrowsAuthorityHandle)?.result ?? undefined : args[1] as State
      observe(arm, value, state); return value
    } })
  }
  Object.assign(entry, {
    authority: (arm: ArmedAttempt, state: State, floor = 0) => { seed(arm); return authority.handle(arm, state, undefined, floor) },
    armAuthority: (arm: ArmedAttempt) => { seed(arm); return authority.handle(arm) },
    confirmAuthority: (handle: import('./authority').ArrowsAuthorityHandle, snapshot: PersistedSnapshot) => authority.confirm(handle, { ...snapshot,
      closedTrials: snapshot.state.events.filter(event => event.type === 'trial_closed').length, review: reconcileHeadless(canonicalState(snapshot.state, forms.get(snapshot.state.form.id)!)) }),
  })
  if (!entry.admitContinue) entry.admitContinue = async (arm, target, present) => {
    await entry.checkCurrentArm?.(arm); target.confirmed()
    present({ id: 'unit-admission', requestId: arm.requestId, trialIndex: target.result!.trialIndex, epoch: 0 })
  }
  return entry
}
function createRun(entry: ArrowsEntry, host: HTMLElement, publish: (state: State) => void, clock?: () => number) {
  return new ArrowsBrowserRun(typeof entry.authority === 'function' ? entry : withAuthority(entry), host, publish, clock)
}

describe('Arrows browser break release', () => {
  it('records a selected key release at an untimed break so Continue cannot inherit a held key', () => {
    let state = armHeadless(forms.get('AR1')!, { installationId: 'installation', sessionId: 'session',
      clockDomainId: 'clock' }, { kind: 'keyboard', leftCode: 'ArrowLeft', rightCode: 'ArrowRight',
      alternative: false, accommodation: 'default', reducedMotion: false }, 0)
    state = advance(state, { kind: 'start', atMs: 0, responseHeld: false })
    for (let trial = 1; trial <= 24; trial++) {
      state = advance(state, { kind: 'fixation', atMs: state.fixationDueMs! })
      state = advance(state, { kind: 'onset', atMs: state.stimulusDueMs! })
      if (trial === 24) state = advance(state, { kind: 'keydown', atMs: state.onsetMs! + 200,
        code: 'ArrowLeft', repeat: false, modified: false })
      state = advance(state, { kind: 'resolve', atMs: state.resolutionDueMs! })
      state = advance(state, { kind: 'offset', atMs: state.resolutionDueMs! })
    }
    expect(state.phase).toBe('break')
    expect(state.heldCodes).toContain('ArrowLeft')
    const now = state.commands.at(-1)!.atMs + 1
    const run = createRun({ release() {} } as ArrowsEntry, document.createElement('div'), () => {}, () => now)
    ;(run as unknown as { state: State }).state = state
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowLeft', bubbles: true }))
    expect(run.snapshot()?.heldCodes).toEqual([])
    expect(run.snapshot()?.events.at(-1)?.type).toBe('input_released')
    run.dispose()
  })
})

describe('Arrows browser accepted-block failure fences', () => {
  it('releases Start ordering only when the first stimulus frame is confirmed', () => {
    let state = armHeadless(forms.get('AR1')!, { installationId: 'installation', sessionId: 'session',
      clockDomainId: 'clock' }, profile, 0)
    state = advance(state, { kind: 'start', atMs: 0, responseHeld: false })
    state = advance(state, { kind: 'fixation', atMs: state.fixationDueMs! })
    const confirmFirstPresentation = vi.fn()
    const run = createRun({ confirmFirstPresentation, release() {} } as unknown as ArrowsEntry,
      document.createElement('div'), () => {}, () => state.stimulusDueMs!)
    ;(run as unknown as { state: State; attempt: ArmedAttempt; protectedBlock: boolean }).state = state
    ;(run as unknown as { attempt: ArmedAttempt }).attempt = armed(state)
    ;(run as unknown as { protectedBlock: boolean }).protectedBlock = true
    const pending = { stage: 'stimulus' as const, due: state.stimulusDueMs!,
      phase: 'fixation' as const, token: 0 }
    ;(run as unknown as { admissionToken: import('./entry').ArrowsAdmission }).admissionToken = { id: 'unit', requestId: 'request', trialIndex: 1, epoch: 0 }
    ;(run as unknown as { pendingFrame: typeof pending }).pendingFrame = pending
    vi.spyOn(run, 'layoutReady').mockReturnValue(true)
    vi.spyOn(run as unknown as { displayMatches: (stage: string) => boolean }, 'displayMatches').mockReturnValue(true)
    ;(run as unknown as { confirmNow: (frame: typeof pending) => void }).confirmNow(pending)
    expect(run.snapshot()?.phase).toBe('stimulus')
    expect(confirmFirstPresentation).toHaveBeenCalledTimes(1)
    run.dispose()
    vi.restoreAllMocks()
  })

  it('ends protection before publishing a break so reentrant exit releases ownership', () => {
    const completedBlock = throughFirstBlock()
    let prior = armHeadless(completedBlock.form, completedBlock.identity,
      completedBlock.profile, completedBlock.armedAtMs)
    for (const command of completedBlock.commands.slice(0, -1)) prior = advance(prior, command)
    const release = vi.fn(), checkpoint = vi.fn()
    let run!: ArrowsBrowserRun
    run = createRun({ release, checkpoint } as unknown as ArrowsEntry,
      document.createElement('div'), next => { if (next.phase === 'break') run.cancel() })
    ;(run as unknown as { state: State; attempt: ArmedAttempt; protectedBlock: boolean }).state = prior
    ;(run as unknown as { attempt: ArmedAttempt }).attempt = armed(prior)
    ;(run as unknown as { protectedBlock: boolean }).protectedBlock = true
    const offset = completedBlock.commands.at(-1)!
    ;(run as unknown as { apply: (command: typeof offset) => void }).apply(offset)
    expect(run.snapshot()?.phase).toBe('break')
    expect(run.protectedNow()).toBe(false)
    expect(release).toHaveBeenCalledTimes(1)
    expect(checkpoint).not.toHaveBeenCalled()
    run.dispose()
  })

  it('does not start Continue before the break checkpoint is confirmed', async () => {
    const state = throughFirstBlock()
    let confirm!: (value: { revision: number }) => void
    const checkpoint = vi.fn(() => new Promise<{ revision: number }>(resolve => { confirm = resolve }))
    const checkCurrentArm = vi.fn(async () => {})
    const release = vi.fn()
    const entry = { checkpoint, checkCurrentArm, release } as unknown as ArrowsEntry
    const run = createRun(entry, document.createElement('div'), () => {},
      () => state.commands.at(-1)!.atMs + 1)
    ;(run as unknown as { state: State; attempt: ArmedAttempt }).state = state
    ;(run as unknown as { attempt: ArmedAttempt }).attempt = armed(state)
    vi.spyOn(run, 'layoutReady').mockReturnValue(true)
    const pending = run.continue()
    expect(run.snapshot()?.phase).toBe('break')
    expect(run.checkpointStatus()).toBe('pending')
    expect(checkCurrentArm).not.toHaveBeenCalled()
    confirm({ revision: 1 })
    await pending
    expect(checkCurrentArm).toHaveBeenCalledTimes(1)
    expect(run.snapshot()?.phase).toBe('fixation_pending')
    run.dispose()
    vi.restoreAllMocks()
  })

  it.each(['saved', 'rejected'] as const)(
    'keeps a new break release untimed until its checkpoint is %s after the authority read', async outcome => {
      const state = throughFirstBlock(true)
      let finishArm!: () => void
      let finishCheckpoint!: (value: { revision: number }) => void
      let failCheckpoint!: (error: Error) => void
      let confirmRead!: (value: PersistedSnapshot) => void
      let failRead!: (error: Error) => void
      const readback = new Promise<PersistedSnapshot>((resolve, reject) => {
        confirmRead = resolve; failRead = reject
      })
      const checkpoint = vi.fn().mockResolvedValueOnce({ revision: 1 })
        .mockImplementationOnce(() => new Promise((resolve, reject) => {
          finishCheckpoint = resolve; failCheckpoint = reject
        }))
      const checkCurrentArm = vi.fn().mockImplementationOnce(() => new Promise<void>(resolve => {
        finishArm = resolve
      })).mockResolvedValue(undefined)
      const run = createRun({ checkpoint, currentCheckpoint: () => readback,
        checkCurrentArm, release() {} } as unknown as ArrowsEntry,
        document.createElement('div'), () => {}, () => state.commands.at(-1)!.atMs + 1)
      ;(run as unknown as { state: State; attempt: ArmedAttempt }).state = state
      ;(run as unknown as { attempt: ArmedAttempt }).attempt = armed(state)
      vi.spyOn(run, 'layoutReady').mockReturnValue(true)
      const continuation = run.continue()
      await vi.waitFor(() => expect(checkCurrentArm).toHaveBeenCalledTimes(1))
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowLeft', bubbles: true }))
      expect(run.snapshot()?.events.at(-1)?.type).toBe('input_released')
      expect(checkpoint).toHaveBeenCalledTimes(2)
      finishArm()
      await Promise.resolve()
      expect(run.snapshot()?.phase).toBe('break')
      expect(run.protectedNow()).toBe(false)
      if (outcome === 'saved') {
        finishCheckpoint({ revision: 2 })
        confirmRead({ revision: 2, state: run.snapshot()!, kind: 'checkpoint' } as PersistedSnapshot)
        await continuation
        expect(checkCurrentArm).toHaveBeenCalledTimes(2)
        expect(run.snapshot()?.phase).toBe('fixation_pending')
      } else {
        failCheckpoint(Error('newer write rejected'))
        failRead(Error('newer write rejected'))
        await expect(continuation).rejects.toThrow('newer write rejected')
        expect(run.snapshot()?.phase).toBe('break')
        expect(run.checkpointStatus()).toBe('failed')
      }
      run.dispose()
      vi.restoreAllMocks()
    })

  it('keeps a failed break checkpoint untimed and permits a later retry', async () => {
    const state = throughFirstBlock()
    const checkpoint = vi.fn().mockRejectedValueOnce(Error('write failed'))
      .mockResolvedValueOnce({ revision: 1 })
    const checkCurrentArm = vi.fn(async () => {})
    const release = vi.fn()
    const run = createRun({ checkpoint, checkCurrentArm, release } as unknown as ArrowsEntry,
      document.createElement('div'), () => {}, () => state.commands.at(-1)!.atMs + 1)
    ;(run as unknown as { state: State; attempt: ArmedAttempt }).state = state
    ;(run as unknown as { attempt: ArmedAttempt }).attempt = armed(state)
    vi.spyOn(run, 'layoutReady').mockReturnValue(true)
    await expect(run.continue()).rejects.toThrow('write failed')
    expect(run.snapshot()?.phase).toBe('break')
    expect(run.checkpointStatus()).toBe('failed')
    expect(checkCurrentArm).not.toHaveBeenCalled()
    await run.continue()
    expect(checkpoint).toHaveBeenCalledTimes(2)
    expect(run.snapshot()?.phase).toBe('fixation_pending')
    run.dispose()
    vi.restoreAllMocks()
  })

  it('recovers a committed checkpoint after its save delivery was lost', async () => {
    const state = throughFirstBlock()
    const checkpoint = vi.fn().mockRejectedValueOnce(Error('delivery lost'))
    const currentCheckpoint = vi.fn(async () => ({ revision: 1, state, kind: 'checkpoint' }))
    const checkCurrentArm = vi.fn(async () => {})
    const release = vi.fn()
    const run = createRun({ checkpoint, currentCheckpoint, checkCurrentArm, release } as unknown as ArrowsEntry,
      document.createElement('div'), () => {}, () => state.commands.at(-1)!.atMs + 1)
    ;(run as unknown as { state: State; attempt: ArmedAttempt }).state = state
    ;(run as unknown as { attempt: ArmedAttempt }).attempt = armed(state)
    vi.spyOn(run, 'layoutReady').mockReturnValue(true)
    await run.continue()
    expect(checkpoint).toHaveBeenCalledTimes(1)
    expect(currentCheckpoint).toHaveBeenCalledTimes(1)
    expect(run.snapshot()?.phase).toBe('fixation_pending')
    run.dispose()
    vi.restoreAllMocks()
  })

  it('reads back a committed break checkpoint while the original delivery never settles', async () => {
    const state = throughFirstBlock()
    let rejectOld!: (error: Error) => void
    const checkpoint = vi.fn(() => new Promise<PersistedSnapshot>((_, reject) => { rejectOld = reject }))
    const saved = { revision: 1, state, kind: 'checkpoint' } as PersistedSnapshot
    const currentCheckpoint = vi.fn(async () => saved)
    const release = vi.fn()
    const run = createRun({ checkpoint, currentCheckpoint, release } as unknown as ArrowsEntry,
      document.createElement('div'), () => {}, () => state.commands.at(-1)!.atMs + 1)
    ;(run as unknown as { state: State; attempt: ArmedAttempt }).state = state
    ;(run as unknown as { attempt: ArmedAttempt }).attempt = armed(state)
    const initial = (run as unknown as { ensureCheckpoint: () => Promise<void> }).ensureCheckpoint().catch(() => {})
    expect(run.checkpointStatus()).toBe('pending')
    expect(await run.retryCheckpoint()).toMatchObject(saved)
    expect(run.checkpointStatus()).toBe('saved')
    expect(checkpoint).toHaveBeenCalledTimes(1)
    rejectOld(Error('late delivery failure'))
    await initial
    expect(run.checkpointStatus()).toBe('saved')
    run.dispose()
  })

  it('retries the exact break prefix when the first delivery is pending but not committed', async () => {
    const state = throughFirstBlock()
    let resolveOld!: (value: PersistedSnapshot) => void
    const saved = { revision: 1, state, kind: 'checkpoint' } as PersistedSnapshot
    const checkpoint = vi.fn().mockImplementationOnce(() => new Promise<PersistedSnapshot>(resolve => {
      resolveOld = resolve
    })).mockResolvedValueOnce(saved)
    const currentCheckpoint = vi.fn(async () => null)
    const run = createRun({ checkpoint, currentCheckpoint, release() {} } as unknown as ArrowsEntry,
      document.createElement('div'), () => {}, () => state.commands.at(-1)!.atMs + 1)
    ;(run as unknown as { state: State; attempt: ArmedAttempt }).state = state
    ;(run as unknown as { attempt: ArmedAttempt }).attempt = armed(state)
    const initial = (run as unknown as { ensureCheckpoint: () => Promise<void> }).ensureCheckpoint().catch(() => {})
    expect(await run.retryCheckpoint()).toMatchObject(saved)
    expect(checkpoint.mock.calls.map(call => call[1])).toEqual([state, state])
    expect(run.checkpointStatus()).toBe('saved')
    resolveOld(saved)
    await initial
    expect(run.checkpointStatus()).toBe('saved')
    run.dispose()
  })

  it('refuses checkpoint retry after deletion or installation replacement', async () => {
    const state = throughFirstBlock()
    const checkpoint = vi.fn()
    const run = createRun({ checkpoint,
      currentCheckpoint: async () => { throw Error('installation replaced') }, release() {} } as unknown as ArrowsEntry,
    document.createElement('div'), () => {}, () => state.commands.at(-1)!.atMs + 1)
    ;(run as unknown as { state: State; attempt: ArmedAttempt }).state = state
    ;(run as unknown as { attempt: ArmedAttempt }).attempt = armed(state)
    await expect(run.retryCheckpoint()).rejects.toThrow('installation replaced')
    expect(checkpoint).not.toHaveBeenCalled()
    run.dispose()
  })

  it('returns a truthful in-tab break draft on explicit exit and fences later recovery', async () => {
    const state = throughFirstBlock()
    const release = vi.fn()
    const run = createRun({ release, currentCheckpoint: async () => null } as unknown as ArrowsEntry,
      document.createElement('div'), () => {}, () => state.commands.at(-1)!.atMs + 1)
    ;(run as unknown as { state: State; attempt: ArmedAttempt }).state = state
    ;(run as unknown as { attempt: ArmedAttempt }).attempt = armed(state)
    expect(run.endBreakForReview()).toBe(state)
    expect(run.snapshot()).toBe(state)
    expect(run.snapshot()?.phase).toBe('break')
    expect(release).toHaveBeenCalledTimes(1)
    await expect(run.retryCheckpoint()).rejects.toThrow('No Arrows checkpoint')
  })

  it('cannot confirm or retry a checkpoint after exit while readback is in flight', async () => {
    const state = throughFirstBlock()
    let completeRead!: (value: PersistedSnapshot | null) => void
    const currentCheckpoint = vi.fn(() => new Promise<PersistedSnapshot | null>(resolve => {
      completeRead = resolve
    }))
    const checkpoint = vi.fn()
    const release = vi.fn()
    const run = createRun({ currentCheckpoint, checkpoint, release } as unknown as ArrowsEntry,
      document.createElement('div'), () => {}, () => state.commands.at(-1)!.atMs + 1)
    ;(run as unknown as { state: State; attempt: ArmedAttempt }).state = state
    ;(run as unknown as { attempt: ArmedAttempt }).attempt = armed(state)
    const recovery = run.retryCheckpoint()
    expect(currentCheckpoint).toHaveBeenCalledTimes(1)
    expect(run.endBreakForReview()).toBe(state)
    completeRead(null)
    await expect(recovery).rejects.toThrow('canceled')
    expect(checkpoint).not.toHaveBeenCalled()
    expect(release).toHaveBeenCalledTimes(1)
  })

  it('releases ownership before saving the exact break prefix as an Incomplete checkpoint', async () => {
    const state = throughFirstBlock()
    const order: string[] = []
    const saved = { revision: 1, kind: 'checkpoint', state } as PersistedSnapshot
    const currentBreakExit = vi.fn(async () => { order.push('read'); return null })
    const saveBreakExit = vi.fn(async () => { order.push('save'); return saved })
    const run = createRun({ currentBreakExit, saveBreakExit,
      release() { order.push('release') } } as unknown as ArrowsEntry,
    document.createElement('div'), () => {}, () => state.commands.at(-1)!.atMs + 1)
    ;(run as unknown as { state: State; attempt: ArmedAttempt }).state = state
    ;(run as unknown as { attempt: ArmedAttempt }).attempt = armed(state)
    const draft = run.endBreakForReview()
    expect(draft).toBe(state)
    expect(run.breakExitStatus()).toBe('unconfirmed')
    expect(currentBreakExit).not.toHaveBeenCalled()
    void run.retryBreakExit()
    expect(run.breakExitStatus()).toBe('pending')
    await vi.waitFor(() => expect(run.breakExitStatus()).toBe('saved'))
    expect(order).toEqual(['release', 'read', 'save'])
    expect(saveBreakExit).toHaveBeenCalledWith(armed(state), state, 0, expect.any(AbortSignal))
    expect(run.snapshot()).toBe(state)
    expect(state.phase).toBe('break')
  })

  it('recovers a committed checkpoint after an undelivered pre-exit write', async () => {
    const state = throughFirstBlock()
    const saved = { revision: 1, kind: 'checkpoint', state } as PersistedSnapshot
    const checkpoint = vi.fn(() => new Promise<PersistedSnapshot>(() => {}))
    const saveBreakExit = vi.fn()
    const release = vi.fn()
    const run = createRun({ checkpoint, currentBreakExit: async () => saved,
      saveBreakExit, release } as unknown as ArrowsEntry,
    document.createElement('div'), () => {}, () => state.commands.at(-1)!.atMs + 1)
    ;(run as unknown as { state: State; attempt: ArmedAttempt }).state = state
    ;(run as unknown as { attempt: ArmedAttempt }).attempt = armed(state)
    void (run as unknown as { ensureCheckpoint: () => Promise<void> }).ensureCheckpoint().catch(() => {})
    expect(run.checkpointStatus()).toBe('pending')
    run.endBreakForReview()
    void run.retryBreakExit().catch(() => {})
    await vi.waitFor(() => expect(run.breakExitStatus()).toBe('saved'))
    expect(release).toHaveBeenCalledTimes(1)
    expect(saveBreakExit).not.toHaveBeenCalled()
  })

  it('recovers a committed break-exit write whose callback never delivered', async () => {
    const state = throughFirstBlock()
    const saved = { revision: 1, kind: 'checkpoint', state } as PersistedSnapshot
    let rejectOld!: (error: Error) => void
    const currentBreakExit = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(saved)
    const saveBreakExit = vi.fn(() => new Promise<PersistedSnapshot>((_, reject) => { rejectOld = reject }))
    const run = createRun({ currentBreakExit, saveBreakExit, release() {} } as unknown as ArrowsEntry,
      document.createElement('div'), () => {}, () => state.commands.at(-1)!.atMs + 1)
    ;(run as unknown as { state: State; attempt: ArmedAttempt }).state = state
    ;(run as unknown as { attempt: ArmedAttempt }).attempt = armed(state)
    run.endBreakForReview()
    void run.retryBreakExit().catch(() => {})
    await vi.waitFor(() => expect(saveBreakExit).toHaveBeenCalledTimes(1))
    await vi.waitFor(() => expect(run.recovery()?.pending()).toBe(false), { timeout: 2500 })
    expect(await run.retryBreakExit()).toMatchObject(saved)
    expect(run.breakExitStatus()).toBe('saved')
    rejectOld(Error('late delivery failure'))
    await Promise.resolve()
    expect(run.breakExitStatus()).toBe('saved')
    expect(saveBreakExit).toHaveBeenCalledTimes(1)
  })

  it('retries the immutable break prefix after an uncommitted exit write fails', async () => {
    const state = throughFirstBlock()
    const saved = { revision: 1, kind: 'checkpoint', state } as PersistedSnapshot
    const currentBreakExit = vi.fn(async () => null)
    const saveBreakExit = vi.fn().mockRejectedValueOnce(Error('write failed')).mockResolvedValueOnce(saved)
    const run = createRun({ currentBreakExit, saveBreakExit, release() {} } as unknown as ArrowsEntry,
      document.createElement('div'), () => {}, () => state.commands.at(-1)!.atMs + 1)
    ;(run as unknown as { state: State; attempt: ArmedAttempt }).state = state
    ;(run as unknown as { attempt: ArmedAttempt }).attempt = armed(state)
    run.endBreakForReview()
    void run.retryBreakExit().catch(() => {})
    await vi.waitFor(() => expect(run.breakExitStatus()).toBe('unconfirmed'))
    await vi.waitFor(() => expect(run.recovery()?.pending()).toBe(false), { timeout: 2500 })
    expect(await run.retryBreakExit()).toMatchObject(saved)
    expect(saveBreakExit.mock.calls.map(call => call[1])).toEqual([state, state])
    expect(run.breakExitStatus()).toBe('saved')
  })

  it('extends a verified older checkpoint with only the later known break event', async () => {
    const prior = throughFirstBlock(true)
    const state = advance(prior, { kind: 'keyup', atMs: prior.commands.at(-1)!.atMs + 1,
      code: 'ArrowLeft' })
    const older = { revision: 1, kind: 'checkpoint', state: prior } as PersistedSnapshot
    const saved = { revision: 2, kind: 'checkpoint', state } as PersistedSnapshot
    const saveBreakExit = vi.fn(async () => saved)
    const run = createRun({ currentBreakExit: async () => older,
      saveBreakExit, release() {} } as unknown as ArrowsEntry,
    document.createElement('div'), () => {}, () => state.commands.at(-1)!.atMs + 1)
    ;(run as unknown as { state: State; attempt: ArmedAttempt }).state = state
    ;(run as unknown as { attempt: ArmedAttempt }).attempt = armed(state)
    run.endBreakForReview()
    void run.retryBreakExit().catch(() => {})
    await vi.waitFor(() => expect(run.breakExitStatus()).toBe('saved'))
    expect(saveBreakExit).toHaveBeenCalledWith(armed(state), state, 1, expect.any(AbortSignal))
    expect(state.events.length).toBe(prior.events.length + 1)
  })

  it('fences deletion after a pending exit save, including its late callback', async () => {
    const state = throughFirstBlock()
    let resolveOld!: (value: PersistedSnapshot) => void
    const saved = { revision: 1, kind: 'checkpoint', state } as PersistedSnapshot
    const currentBreakExit = vi.fn().mockResolvedValueOnce(null)
      .mockImplementationOnce(async () => {
        const handle = run.recovery()!.authority; const root = { version: ARROWS_STORAGE_VERSION, installationId: 'installation', revision: 99, scoredStartCount: 1, attempts: {}, tombstones: { session: 1000 }, activity: {} }; (handle as unknown as { authority: ArrowsAuthority }).authority.observe(root, (handle as unknown as { authority: ArrowsAuthority }).authority.provenance('read')); throw Error('Arrows break-exit authority changed')
      })
    const saveBreakExit = vi.fn(() => new Promise<PersistedSnapshot>(resolve => { resolveOld = resolve }))
    const run = createRun({ currentBreakExit, saveBreakExit, release() {} } as unknown as ArrowsEntry,
      document.createElement('div'), () => {}, () => state.commands.at(-1)!.atMs + 1)
    ;(run as unknown as { state: State; attempt: ArmedAttempt }).state = state
    ;(run as unknown as { attempt: ArmedAttempt }).attempt = armed(state)
    run.endBreakForReview()
    void run.retryBreakExit().catch(() => {})
    await vi.waitFor(() => expect(saveBreakExit).toHaveBeenCalledTimes(1))
    await vi.waitFor(() => expect(run.recovery()?.pending()).toBe(false), { timeout: 2500 })
    await expect(run.retryBreakExit()).rejects.toThrow('authority changed')
    resolveOld(saved)
    await Promise.resolve()
    expect(run.breakExitStatus()).toBe('unconfirmed')
    await expect(run.retryBreakExit()).rejects.toThrow('authority changed')
    expect(currentBreakExit).toHaveBeenCalledTimes(2)
  })

  it.each(['throw', 'cancel'] as const)('does not revive a Start after publication %s', async failure => {
    const state = armHeadless(forms.get('AR1')!, { installationId: 'installation', sessionId: 'session',
      clockDomainId: 'clock' }, profile, 0)
    const release = vi.fn()
    const entry = { begin: async () => armed(state),
      admitStart: async (_arm: ArmedAttempt, present: () => void) => { present() }, release } as unknown as ArrowsEntry
    const host = document.createElement('div')
    let run!: ArrowsBrowserRun
    run = createRun(entry, host, next => {
      if (next.events.at(-1)?.type === 'block_started') {
        if (failure === 'throw') throw Error('render failed')
        run.cancel()
      }
    }, () => 1)
    vi.spyOn(run, 'layoutReady').mockReturnValue(true)
    await expect(run.begin({ requestId: 'request', sessionId: 'session', clockDomainId: 'clock',
      profile, atMs: 0, wallMs: 0 })).rejects.toThrow()
    expect(run.snapshot()?.phase).toBe('invalid')
    expect(run.protectedNow()).toBe(false)
    expect(release).toHaveBeenCalledTimes(1)
    run.cancel()
    expect(release).toHaveBeenCalledTimes(1)
    run.dispose()
    vi.restoreAllMocks()
  })

  it('does not revive Continue after publication fails', async () => {
    const state = throughFirstBlock()
    const release = vi.fn()
    const entry = { checkpoint: async () => ({ revision: 1 }), checkCurrentArm: async () => {}, release } as unknown as ArrowsEntry
    const run = createRun(entry, document.createElement('div'), next => {
      if (next.events.at(-1)?.type === 'block_started') throw Error('render failed')
    }, () => state.commands.at(-1)!.atMs + 1)
    ;(run as unknown as { state: State; attempt: ArmedAttempt }).state = state
    ;(run as unknown as { attempt: ArmedAttempt }).attempt = armed(state)
    vi.spyOn(run, 'layoutReady').mockReturnValue(true)
    await expect(run.continue()).rejects.toThrow('canceled')
    expect(run.snapshot()?.phase).toBe('invalid')
    expect(run.snapshot()?.invalidReason).toBe('technical')
    expect(run.protectedNow()).toBe(false)
    expect(release).toHaveBeenCalledTimes(1)
    run.dispose()
    vi.restoreAllMocks()
  })

  it('invalidates a changed profile at an untimed break', async () => {
    const state = throughFirstBlock()
    const release = vi.fn()
    const entry = { checkpoint: async () => ({ revision: 1 }), checkCurrentArm: async () => {}, release } as unknown as ArrowsEntry
    const run = createRun(entry, document.createElement('div'), () => {},
      () => state.commands.at(-1)!.atMs + 1)
    ;(run as unknown as { state: State; attempt: ArmedAttempt }).state = state
    ;(run as unknown as { attempt: ArmedAttempt }).attempt = armed(state)
    run.settingsChanged()
    expect(run.snapshot()?.phase).toBe('invalid')
    expect(run.snapshot()?.invalidReason).toBe('settings')
    expect(release).toHaveBeenCalledTimes(1)
    await expect(run.continue()).rejects.toThrow('No Arrows block')
    run.dispose()
  })

  it('releases ownership before a terminal write settles and retries the same immutable draft', async () => {
    const state = throughFirstBlock()
    const release = vi.fn()
    let rejectSave!: (error: Error) => void
    const saveTerminal = vi.fn().mockImplementationOnce(() => new Promise((_, reject) => {
      rejectSave = reject
    })).mockImplementationOnce(async (_arm: ArmedAttempt, terminal: State) =>
      ({ revision: 1, kind: 'terminal', state: terminal }))
    const run = createRun({ release, saveTerminal,
      currentTerminal: async () => null } as unknown as ArrowsEntry,
      document.createElement('div'), () => {}, () => state.commands.at(-1)!.atMs + 1)
    ;(run as unknown as { state: State; attempt: ArmedAttempt }).state = state
    ;(run as unknown as { attempt: ArmedAttempt }).attempt = armed(state)
    run.settingsChanged()
    expect(run.snapshot()?.phase).toBe('invalid')
    expect(run.terminalStatus()).toBe('pending')
    expect(release).toHaveBeenCalledTimes(1)
    await vi.waitFor(() => expect(saveTerminal).toHaveBeenCalledTimes(1))
    const captured = saveTerminal.mock.calls[0][1] as State
    rejectSave(Error('write failed'))
    await vi.waitFor(() => expect(run.terminalStatus()).toBe('unconfirmed'))
    const saved = await run.retryTerminal()
    expect(saved.state).toEqual(captured)
    expect(saveTerminal.mock.calls[1][1]).toEqual(captured)
    expect(run.terminalStatus()).toBe('saved')
    expect(release).toHaveBeenCalledTimes(1)
    run.dispose()
  })

  it.each(['cancel', 'dispose'] as const)(
    'captures a break invalidation before a reentrant terminal-listener %s', async exit => {
      const state = throughFirstBlock()
      const release = vi.fn()
      const saveTerminal = vi.fn().mockRejectedValueOnce(Error('write failed'))
        .mockImplementationOnce(async (_arm: ArmedAttempt, terminal: State) =>
          ({ revision: 2, kind: 'terminal', state: terminal }))
      let listenerRetry!: Promise<unknown>
      let run!: ArrowsBrowserRun
      run = createRun({ release, saveTerminal,
        currentTerminal: async () => null } as unknown as ArrowsEntry,
        document.createElement('div'), next => {
          if (next.phase === 'invalid') {
            listenerRetry = run.retryTerminal()
            run[exit]()
          }
        }, () => state.commands.at(-1)!.atMs + 1)
      ;(run as unknown as { state: State; attempt: ArmedAttempt }).state = state
      ;(run as unknown as { attempt: ArmedAttempt }).attempt = armed(state)
      run.settingsChanged()
      expect(run.snapshot()?.phase).toBe('invalid')
      expect(run.snapshot()?.invalidReason).toBe('settings')
      expect(release).toHaveBeenCalledTimes(1)
      await expect(listenerRetry).rejects.toThrow('write failed')
      expect(saveTerminal).toHaveBeenCalledTimes(1)
      expect(run.terminalStatus()).toBe('unconfirmed')
      const result = await run.retryTerminal()
      expect(result.state).toEqual(run.snapshot())
      expect(saveTerminal.mock.calls[1][1]).toBe(saveTerminal.mock.calls[0][1])
      expect(run.terminalStatus()).toBe('saved')
      expect(release).toHaveBeenCalledTimes(1)
      run.dispose()
    })

  it.each(['committed', 'not-committed'] as const)(
    'recovers a terminal %s despite a never-delivered earlier callback', async outcome => {
      const state = throughFirstBlock()
      let rejectOld!: (error: Error) => void
      const saveTerminal = vi.fn().mockImplementationOnce(() => new Promise((_, reject) => {
        rejectOld = reject
      })).mockImplementationOnce(async (_arm: ArmedAttempt, terminal: State) =>
        ({ revision: 2, kind: 'terminal', state: terminal }))
      let terminal!: State
      const currentTerminal = vi.fn(async () => outcome === 'committed' ?
        { revision: 2, kind: 'terminal', state: terminal } : null)
      const run = createRun({ release() {}, saveTerminal, currentTerminal } as unknown as ArrowsEntry,
        document.createElement('div'), () => {}, () => state.commands.at(-1)!.atMs + 1)
      ;(run as unknown as { state: State; attempt: ArmedAttempt }).state = state
      ;(run as unknown as { attempt: ArmedAttempt }).attempt = armed(state)
      run.settingsChanged()
      terminal = run.snapshot()!
      await vi.waitFor(() => expect(saveTerminal).toHaveBeenCalledTimes(1))
      expect(run.terminalStatus()).toBe('pending')
      await vi.waitFor(() => expect(run.recovery()?.pending()).toBe(false), { timeout: 2500 })
      const saved = await run.retryTerminal()
      expect(saved.state).toEqual(terminal)
      expect(currentTerminal).toHaveBeenCalledTimes(1)
      expect(saveTerminal).toHaveBeenCalledTimes(outcome === 'committed' ? 1 : 2)
      expect(run.terminalStatus()).toBe('saved')
      rejectOld(Error('late old delivery failure'))
      await Promise.resolve()
      expect(run.terminalStatus()).toBe('saved')
      run.dispose()
    })

  it('withholds Continue while a response key is held without stranding the owner', async () => {
    const state = throughFirstBlock()
    const release = vi.fn()
    const entry = { checkpoint: async () => ({ revision: 1 }), checkCurrentArm: async () => {}, release } as unknown as ArrowsEntry
    const run = createRun(entry, document.createElement('div'), () => {},
      () => state.commands.at(-1)!.atMs + 1)
    ;(run as unknown as { state: State; attempt: ArmedAttempt }).state = state
    ;(run as unknown as { attempt: ArmedAttempt }).attempt = armed(state)
    vi.spyOn(run, 'layoutReady').mockReturnValue(true)
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft', bubbles: true }))
    await expect(run.continue()).rejects.toThrow('response control held')
    expect(run.snapshot()?.phase).toBe('break')
    expect(run.protectedNow()).toBe(false)
    expect(release).not.toHaveBeenCalled()
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowLeft', bubbles: true }))
    run.cancel()
    expect(release).toHaveBeenCalledTimes(1)
    run.dispose()
    vi.restoreAllMocks()
  })

  it('releases ownership even when technical DOM cleanup throws', () => {
    const release = vi.fn()
    const host = document.createElement('div')
    const run = createRun({ release } as unknown as ArrowsEntry, host, () => {})
    const state = advance(armHeadless(forms.get('AR1')!, { installationId: 'installation',
      sessionId: 'session', clockDomainId: 'clock' }, profile, 0),
    { kind: 'start', atMs: 0, responseHeld: false })
    ;(run as unknown as { state: State; protectedBlock: boolean }).state = state
    ;(run as unknown as { protectedBlock: boolean }).protectedBlock = true
    vi.spyOn(host, 'replaceChildren').mockImplementation(() => { throw Error('DOM cleanup failed') })
    expect(() => window.dispatchEvent(new Event('error'))).not.toThrow()
    expect(run.snapshot()?.invalidReason).toBe('technical')
    expect(release).toHaveBeenCalledTimes(1)
    vi.restoreAllMocks()
    run.dispose()
  })
})
