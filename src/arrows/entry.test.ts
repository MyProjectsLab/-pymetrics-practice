import { ArrowsAuthority } from './authority'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ArrowsEntry } from './entry'
import { ArrowsBrowserRun } from './browser'
import { armHeadless } from './versions'
import { loadArrowsForms } from './versions'
import { ARROWS_PRESENTATION_LOCK } from './presentation-order'
import { ARROWS_STORAGE_VERSION } from './contracts'
import type { ArmedAttempt, ArrowsStore, StartRequest } from './storage'

const request: StartRequest = { requestId: 'request-1', sessionId: 'session-1', clockDomainId: 'clock-1',
  profile: { kind: 'keyboard', leftCode: 'ArrowLeft', rightCode: 'ArrowRight',
    alternative: false, accommodation: 'default', reducedMotion: false }, atMs: 100, wallMs: 1_000 }
const arm: ArmedAttempt = { ...request, ordinal: 1, createdAtWallMs: request.wallMs, state: armHeadless((await loadArrowsForms()).get('AR1')!, { installationId: 'installation', sessionId: request.sessionId, clockDomainId: request.clockDomainId }, request.profile, request.atMs) }
function seedAuthority(value: ArmedAttempt) {
  const authority = new ArrowsAuthority('installation')
  authority.observe({ version: ARROWS_STORAGE_VERSION, installationId: 'installation', revision: 1,
    scoredStartCount: 1, attempts: { [value.sessionId]: value }, tombstones: {}, activity: {} }, authority.provenance('read'))
  return authority
}
const storeWithArm = (start: ArrowsStore['start']) =>
  ({ authority: seedAuthority(arm), start, loadArmed: vi.fn(async () => arm) }) as unknown as ArrowsStore

class HeldLocks {
  owner = false
  queue: Array<(lock: object | null) => void> = []
  request(name: string, _options: object, callback: (lock: object | null) => Promise<void>) {
    if (name === ARROWS_PRESENTATION_LOCK) return Promise.resolve().then(() => callback({}))
    return new Promise<void>((resolve, reject) => {
      this.queue.push(lock => {
        if (lock) this.owner = true
        void callback(lock).then(() => { if (lock) this.owner = false; resolve() }, reject)
      })
    })
  }
  deliver() {
    const callback = this.queue.shift()
    if (!callback) throw Error('No queued lock callback')
    callback(this.owner ? null : {})
  }
}

let locks: HeldLocks
beforeEach(() => {
  locks = new HeldLocks()
  Object.defineProperty(navigator, 'locks', { configurable: true, value: locks })
  vi.spyOn(document, 'hasFocus').mockReturnValue(true)
})
afterEach(() => {
  Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined })
  vi.restoreAllMocks()
})

describe('Arrows entry lifetime', () => {
  it('does not start scored play from a late positive final read after cancellation', async () => {
    const owned = { ...request, requestId: 'held-authority-read' }
    const forms = await loadArrowsForms()
    const committed = { requestId: owned.requestId, sessionId: owned.sessionId,
      clockDomainId: owned.clockDomainId, profile: owned.profile, ordinal: 1,
      createdAtWallMs: owned.wallMs,
      state: armHeadless(forms.get('AR1')!, { installationId: 'installation',
        sessionId: owned.sessionId, clockDomainId: owned.clockDomainId }, owned.profile, owned.atMs) } as ArmedAttempt
    let deliver!: (value: ArmedAttempt) => void
    const loadArmed = vi.fn()
      .mockResolvedValueOnce(committed)
      .mockImplementation(() => new Promise<ArmedAttempt>(resolve => { deliver = resolve }))
    const entry = new ArrowsEntry({ authority: seedAuthority(committed), start: vi.fn(async () => committed), loadArmed } as unknown as ArrowsStore)
    const run = new ArrowsBrowserRun(entry, document.createElement('div'), vi.fn())
    vi.spyOn(run, 'layoutReady').mockReturnValue(true)
    const pending = run.begin(owned)
    locks.deliver()
    await vi.waitFor(() => expect(loadArmed).toHaveBeenCalledTimes(2))
    run.cancel()
    deliver(committed)
    await expect(pending).rejects.toThrow()
    expect(run.snapshot()).toBeNull()
    run.dispose()
  })

  it('preserves a committed request after an operational failure of the ordered final read', async () => {
    const owned = { ...request, requestId: 'ordered-final-read-retry' }
    const forms = await loadArrowsForms()
    const committed = { requestId: owned.requestId, sessionId: owned.sessionId,
      clockDomainId: owned.clockDomainId, profile: owned.profile, ordinal: 1,
      createdAtWallMs: owned.wallMs,
      state: armHeadless(forms.get('AR1')!, { installationId: 'installation',
        sessionId: owned.sessionId, clockDomainId: owned.clockDomainId }, owned.profile, owned.atMs) } as ArmedAttempt
    const start = vi.fn(async () => committed)
    const loadArmed = vi.fn().mockResolvedValueOnce(committed)
      .mockRejectedValueOnce(Error('Temporary final read failure')).mockResolvedValue(committed)
    const store = { authority: seedAuthority(committed), start, loadArmed } as unknown as ArrowsStore
    const first = new ArrowsBrowserRun(new ArrowsEntry(store), document.createElement('div'), vi.fn())
    vi.spyOn(first, 'layoutReady').mockReturnValue(true)
    const failure = first.begin(owned)
    locks.deliver()
    await expect(failure).rejects.toThrow('Temporary final read failure')
    await vi.waitFor(() => expect(locks.owner).toBe(false))
    expect(first.snapshot()).toBeNull()
    const retry = new ArrowsBrowserRun(new ArrowsEntry(store), document.createElement('div'), vi.fn())
    vi.spyOn(retry, 'layoutReady').mockReturnValue(true)
    const recovery = retry.begin(owned)
    locks.deliver()
    await expect(recovery).resolves.toMatchObject({ phase: 'fixation_pending' })
    expect(start).toHaveBeenNthCalledWith(2, owned, expect.any(AbortSignal))
    first.dispose(); retry.dispose()
  })

  it.each(['deletion', 'replacement', 'different attempt'] as const)(
    'rejects a delayed confirmed arm after %s before accepting scored Start', async retirement => {
      const owned = { ...request, requestId: `retired-start-${retirement}` }
      const forms = await loadArrowsForms()
      const committed = { requestId: owned.requestId, sessionId: owned.sessionId,
        clockDomainId: owned.clockDomainId, profile: owned.profile, ordinal: 1,
        createdAtWallMs: owned.wallMs,
        state: armHeadless(forms.get('AR1')!, { installationId: 'installation',
          sessionId: owned.sessionId, clockDomainId: owned.clockDomainId }, owned.profile, owned.atMs) } as ArmedAttempt
      let deliver!: (arm: ArmedAttempt) => void
      const start = vi.fn(() => new Promise<ArmedAttempt>(resolve => { deliver = resolve }))
      const loadArmed = vi.fn(async () => retirement === 'deletion' ? null :
        retirement === 'replacement' ? Promise.reject(Error('Arrows storage: installation replaced')) :
          { ...committed, requestId: 'another-request' })
      const entry = new ArrowsEntry({ authority: seedAuthority(committed), start, loadArmed } as unknown as ArrowsStore)
      const published = vi.fn()
      const run = new ArrowsBrowserRun(entry, document.createElement('div'), published)
      vi.spyOn(run, 'layoutReady').mockReturnValue(true)
      const pending = run.begin(owned)
      locks.deliver()
      await vi.waitFor(() => expect(start).toHaveBeenCalledTimes(1))
      deliver(committed)
      await expect(pending).rejects.toThrow(/authority changed|installation replaced/)
      expect(loadArmed).toHaveBeenCalledWith(owned.sessionId, expect.any(AbortSignal))
      expect(run.snapshot()).toBeNull()
      expect(published).not.toHaveBeenCalled()
      await vi.waitFor(() => expect(locks.owner).toBe(false))
      run.dispose()
    },
  )

  it('ignores a late positive authority read after pending Start was canceled', async () => {
    const owned = { ...request, requestId: 'late-confirmation' }
    const committed = { ...arm, requestId: owned.requestId, sessionId: owned.sessionId } as ArmedAttempt
    let deliver!: (value: ArmedAttempt) => void
    const loadArmed = vi.fn(() => new Promise<ArmedAttempt>(resolve => { deliver = resolve }))
    const entry = new ArrowsEntry({ authority: seedAuthority(committed), start: vi.fn(async () => committed), loadArmed } as unknown as ArrowsStore)
    const pending = entry.begin(owned)
    locks.deliver()
    await vi.waitFor(() => expect(loadArmed).toHaveBeenCalledTimes(1))
    entry.release()
    deliver(committed)
    await expect(pending).rejects.toThrow('confirmation canceled')
    await vi.waitFor(() => expect(locks.owner).toBe(false))
  })

  it('keeps the same request eligible after an operational confirmation-read failure', async () => {
    const owned = { ...request, requestId: 'confirmation-read-retry' }
    const committed = { ...arm, requestId: owned.requestId, sessionId: owned.sessionId } as ArmedAttempt
    const start = vi.fn(async () => committed)
    const loadArmed = vi.fn()
      .mockRejectedValueOnce(Error('Temporary read failure'))
      .mockResolvedValue(committed)
    const entry = new ArrowsEntry({ authority: seedAuthority(committed), start, loadArmed } as unknown as ArrowsStore)
    const first = entry.begin(owned)
    locks.deliver()
    await expect(first).rejects.toThrow('Temporary read failure')
    await vi.waitFor(() => expect(locks.owner).toBe(false))
    const retry = entry.begin(owned)
    locks.deliver()
    await expect(retry).resolves.toBe(committed)
    expect(start).toHaveBeenNthCalledWith(2, owned, expect.any(AbortSignal))
    entry.release()
  })

  it('fences a canceled owner callback before any durable arm and frees a later entry', async () => {
    const start = vi.fn(async () => arm)
    const entry = new ArrowsEntry(storeWithArm(start))
    const canceled = entry.begin(request)
    entry.release()
    await expect(canceled).rejects.toThrow('canceled')
    locks.deliver()
    await Promise.resolve()
    expect(start).not.toHaveBeenCalled()
    expect(locks.owner).toBe(false)
    await expect(new ArrowsEntry(storeWithArm(start)).begin(request)).rejects.toThrow('retired')
    const next = entry.begin({ ...request, requestId: 'request-2' })
    locks.deliver()
    await expect(next).resolves.toBe(arm)
    expect(locks.owner).toBe(true)
    entry.release()
    await vi.waitFor(() => expect(locks.owner).toBe(false))
  })

  it('releases ownership and aborts an undelivered storage start promptly', async () => {
    let observedSignal: AbortSignal | null = null
    const start = vi.fn((_request: StartRequest, signal: AbortSignal) => {
      observedSignal = signal
      return new Promise<ArmedAttempt>((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(Error('Arrows start canceled')), { once: true })
      })
    })
    const entry = new ArrowsEntry(storeWithArm(start))
    const pending = entry.begin({ ...request, requestId: 'request-3' })
    locks.deliver()
    for (let index = 0; index < 10 && !observedSignal; index++) await Promise.resolve()
    expect(start).toHaveBeenCalledTimes(1)
    entry.release()
    await expect(pending).rejects.toThrow('canceled')
    expect(start.mock.calls[0][1].aborted).toBe(true)
    await vi.waitFor(() => expect(locks.owner).toBe(false))
  })

  it('rejects a second entry while active and releases on explicit finish', async () => {
    const start = vi.fn(async () => arm)
    const entry = new ArrowsEntry(storeWithArm(start))
    const first = entry.begin({ ...request, requestId: 'request-4' })
    locks.deliver()
    await expect(first).resolves.toBe(arm)
    await expect(entry.begin({ ...request, requestId: 'request-5' })).rejects.toThrow('already active')
    entry.release()
    await vi.waitFor(() => expect(locks.owner).toBe(false))
    const second = entry.begin({ ...request, requestId: 'request-5' })
    locks.deliver()
    await expect(second).resolves.toBe(arm)
    entry.release()
  })

  it('allows the same request ID to retry after lock contention before any arm', async () => {
    const firstStart = vi.fn(async () => arm)
    const secondStart = vi.fn(async () => arm)
    const first = new ArrowsEntry(storeWithArm(firstStart))
    const second = new ArrowsEntry(storeWithArm(secondStart))
    const held = first.begin({ ...request, requestId: 'request-6' })
    locks.deliver()
    await held
    const blocked = second.begin({ ...request, requestId: 'request-7' })
    locks.deliver()
    await expect(blocked).rejects.toThrow('active in another tab')
    expect(secondStart).not.toHaveBeenCalled()
    first.release()
    await vi.waitFor(() => expect(locks.owner).toBe(false))
    const retry = second.begin({ ...request, requestId: 'request-7' })
    locks.deliver()
    await expect(retry).resolves.toBe(arm)
    expect(secondStart).toHaveBeenCalledTimes(1)
    second.release()
  })

  it('keeps the invocation request ID even when a caller substitutes a retired ID before ownership', async () => {
    const start = vi.fn(async (_request: StartRequest) => arm)
    const entry = new ArrowsEntry(storeWithArm(start))
    const original = entry.begin({ ...request, requestId: 'request-8' })
    locks.deliver()
    await original
    entry.release()
    await vi.waitFor(() => expect(locks.owner).toBe(false))

    const mutable = { ...request, requestId: 'request-9' }
    const pending = entry.begin(mutable)
    mutable.requestId = 'request-8'
    locks.deliver()
    await expect(pending).resolves.toBe(arm)
    expect(start.mock.calls[1][0].requestId).toBe('request-9')
    entry.release()
    await expect(entry.begin({ ...request, requestId: 'request-8' })).rejects.toThrow('retired')
  })

  it('keeps the nested input binding from invocation across delayed ownership', async () => {
    const start = vi.fn(async (_request: StartRequest) => arm)
    const entry = new ArrowsEntry(storeWithArm(start))
    const mutable = { ...request, requestId: 'request-10', profile: { ...request.profile } }
    const pending = entry.begin(mutable)
    if (mutable.profile.kind === 'keyboard') mutable.profile.rightCode = 'KeyZ'
    locks.deliver()
    await expect(pending).resolves.toBe(arm)
    expect(start.mock.calls[0][0].profile).toMatchObject({ rightCode: 'ArrowRight' })
    entry.release()
  })

  it('rechecks the original arm before an untimed continuation and rejects lost authority', async () => {
    const saved = { ...arm, requestId: 'request-11', sessionId: 'session-11' } as ArmedAttempt
    let retained: ArmedAttempt | null = saved
    const store = { authority: seedAuthority(saved), start: vi.fn(async () => saved), loadArmed: vi.fn(async () => retained) } as unknown as ArrowsStore
    const entry = new ArrowsEntry(store)
    const pending = entry.begin({ ...request, requestId: saved.requestId, sessionId: saved.sessionId })
    locks.deliver()
    await expect(pending).resolves.toBe(saved)
    await expect(entry.checkCurrentArm(saved)).resolves.toBeUndefined()
    retained = { ...saved, snapshot: { kind: 'checkpoint' } } as ArmedAttempt
    await expect(entry.checkCurrentArm(saved)).resolves.toBeUndefined()
    retained = { ...saved, snapshot: { kind: 'terminal' } } as ArmedAttempt
    await expect(entry.checkCurrentArm(saved)).rejects.toThrow(/authority changed|already terminal/)
    retained = null
    await expect(entry.checkCurrentArm(saved)).rejects.toThrow(/authority changed|already terminal/)
    entry.release()
    await expect(entry.checkCurrentArm(saved)).rejects.toThrow('ownership is no longer active')
  })
})

it('bounds an undelivered ownership callback without arming and fences its late delivery', async () => {
  vi.useFakeTimers()
  const start = vi.fn(async () => arm), entry = new ArrowsEntry(storeWithArm(start))
  const task = entry.begin({ ...request, requestId: 'deadline-owned-callback' }); void task.catch(() => {})
  await vi.advanceTimersByTimeAsync(5_000)
  await expect(task).rejects.toThrow(); expect(start).not.toHaveBeenCalled()
  locks.deliver(); await Promise.resolve(); expect(start).not.toHaveBeenCalled(); expect(locks.owner).toBe(false)
  vi.useRealTimers()
})
