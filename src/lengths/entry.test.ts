import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LengthsAuthority } from './authority'
import { LengthsEntry } from './entry'
import { armHeadless } from './engine'
import { loadLengthsForms } from './manifests'
import { LENGTHS_STORAGE_VERSION } from './contracts'
import type { ArmedAttempt, LengthsStore, StartRequest } from './storage'

const profile = { kind: 'keyboard', variant: 'standard', deviceClass: 'desktop_or_laptop',
  leftCode: 'ArrowLeft', rightCode: 'ArrowRight', alternative: false,
  contrast: 'dark_on_light', magnification: 'none', reducedMotion: false } as const
const displayContext = { layoutWidthCssPx: 1512, layoutHeightCssPx: 900,
  visualWidthCssPx: 1512, visualHeightCssPx: 900, taskHostWidthCssPx: 650,
  devicePixelRatio: 2, browserFamily: 'chromium', visibility: 'visible', focused: true } as const
const request: StartRequest = { requestId: 'request-1', sessionId: 'session-1', clockDomainId: 'clock-1',
  profile, variant: 'standard', route: 'standalone', atMs: 100, wallMs: 1_000,
  displayContext }
const form = (await loadLengthsForms()).get('LS1')!
function attemptFor(owned: StartRequest): ArmedAttempt {
  return { ...owned, armDisplayContext: owned.displayContext,
    ordinal: 1, createdAtWallMs: owned.wallMs,
    state: armHeadless(form, { installationId: 'installation', sessionId: owned.sessionId,
      clockDomainId: owned.clockDomainId, route: owned.route }, owned.profile, owned.atMs) }
}
const arm = attemptFor(request)

function store(start: LengthsStore['start'], loadArmed: LengthsStore['loadArmed'], seeded = arm): LengthsStore {
  const authority = new LengthsAuthority('installation')
  authority.observe({ version: LENGTHS_STORAGE_VERSION, installationId: 'installation', revision: 1,
    counters: { standard: 1, visual_accommodation: 0 },
    attempts: { [seeded.sessionId]: seeded }, tombstones: {}, activity: {} }, authority.provenance('read'))
  return { authority, start, loadArmed } as LengthsStore
}

class HeldLocks {
  owner = false
  queue: Array<(available: boolean) => void> = []
  request(_name: string, _options: object, callback: (lock: object | null) => Promise<void>) {
    return new Promise<void>((resolve, reject) => {
      this.queue.push(available => {
        if (available) this.owner = true
        void callback(available ? {} : null).then(() => {
          if (available) this.owner = false
          resolve()
        }, reject)
      })
    })
  }
  deliver() {
    const next = this.queue.shift()
    if (!next) throw Error('No queued lock callback')
    next(!this.owner)
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

describe('Lengths entry lifetime and cross-tab ownership', () => {
  it('canceled acquisition cannot arm later or retain ownership', async () => {
    const start = vi.fn(async () => arm)
    const entry = new LengthsEntry(store(start, vi.fn(async () => arm)))
    const canceled = entry.begin(request)
    entry.release()
    await expect(canceled).rejects.toThrow()
    locks.deliver()
    await Promise.resolve()
    expect(start).not.toHaveBeenCalled()
    await vi.waitFor(() => expect(locks.owner).toBe(false))
  })

  it('rejects a late positive final read after cancellation and releases ownership', async () => {
    const owned = { ...request, requestId: 'request-2', sessionId: 'session-2' }
    const committed = attemptFor(owned)
    let deliver!: (value: ArmedAttempt) => void
    const loadArmed = vi.fn(() => new Promise<ArmedAttempt>(resolve => { deliver = resolve }))
    const entry = new LengthsEntry(store(vi.fn(async () => committed), loadArmed, committed))
    const pending = entry.begin(owned)
    locks.deliver()
    await vi.waitFor(() => expect(loadArmed).toHaveBeenCalledTimes(1))
    entry.release()
    deliver(committed)
    await expect(pending).rejects.toThrow()
    await vi.waitFor(() => expect(locks.owner).toBe(false))
  })

  it('permits only one active tab owner', async () => {
    const owned = { ...request, requestId: 'request-3', sessionId: 'session-3' }
    const committed = attemptFor(owned)
    const first = new LengthsEntry(store(vi.fn(async () => committed), vi.fn(async () => committed), committed))
    const second = new LengthsEntry(store(vi.fn(async () => committed), vi.fn(async () => committed), committed))
    const firstStart = first.begin(owned)
    locks.deliver()
    await expect(firstStart).resolves.toEqual(committed)
    const secondStart = second.begin(owned)
    locks.deliver()
    await expect(secondStart).rejects.toThrow('active in another tab')
    first.release(); second.release()
    await vi.waitFor(() => expect(locks.owner).toBe(false))
  })

  it('does not publish scored Start after a canceled final ordered read', async () => {
    const owned = { ...request, requestId: 'request-4', sessionId: 'session-4' }
    const committed = attemptFor(owned)
    let deliver!: (value: ArmedAttempt) => void
    const loadArmed = vi.fn().mockResolvedValueOnce(committed)
      .mockImplementationOnce(() => new Promise<ArmedAttempt>(resolve => { deliver = resolve }))
    const entry = new LengthsEntry(store(vi.fn(async () => committed), loadArmed, committed))
    const beginning = entry.begin(owned)
    locks.deliver()
    await expect(beginning).resolves.toEqual(committed)
    const present = vi.fn()
    const admission = entry.admitStart(committed, present)
    locks.deliver()
    await vi.waitFor(() => expect(loadArmed).toHaveBeenCalledTimes(2))
    entry.release()
    deliver(committed)
    await expect(admission).rejects.toThrow()
    expect(present).not.toHaveBeenCalled()
    await vi.waitFor(() => expect(locks.owner).toBe(false))
  })
})
