vi.mock('./v11/static-surface', async () => await import('./static-surface-test-support'))
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { advance, armHeadless, verifyHeadless, canonicalState } from './versions'
import { loadArrowsForms } from './versions'
import { ArrowsStore, freshArrowsRoot, inspectArrowsRoot } from './storage'
import { ArrowsEntry } from './entry'
import { ArrowsBrowserRun } from './browser'
import { ARROWS_DELETION_ORDER_TIMEOUT_MS, ARROWS_PRESENTATION_LOCK } from './presentation-order'
import type { ArrowsBackend, ArrowsRoot, StartRequest, ArmedAttempt, PersistedSnapshot } from './storage'

const clone = <T,>(value: T): T => structuredClone(value)
const profile = { kind: 'keyboard', leftCode: 'ArrowLeft', rightCode: 'ArrowRight',
  alternative: false, accommodation: 'default', reducedMotion: false } as const
const request = (number: number): StartRequest => ({ requestId: `request-${number}`,
  sessionId: `session-${number}`, clockDomainId: `clock-${number}`, profile,
  atMs: 100 + number, wallMs: 1_000 + number })

class MemoryBackend implements ArrowsBackend {
  root = freshArrowsRoot()
  queue: Promise<unknown> = Promise.resolve()
  rejectBeforeCommit = false
  loseDeliveryAfterCommit = false
  rejectRead = false
  async read() {
    await this.queue
    if (this.rejectRead) throw Error('Injected read failure')
    return clone(this.root)
  }
  change<T>(operation: (root: ArrowsRoot) => T, signal?: AbortSignal): Promise<T> {
    const pending = this.queue.then(() => {
      if (signal?.aborted) throw Error('Injected transaction aborted')
      if (this.rejectBeforeCommit) throw Error('Injected uncommitted failure')
      const candidate = clone(this.root)
      const result = operation(candidate)
      this.root = candidate
      if (this.loseDeliveryAfterCommit) throw Error('Injected lost delivery')
      return result
    })
    this.queue = pending.catch(() => undefined)
    return pending
  }
}

class SerialLocks {
  active = new Set<string>()
  private waiting = new Map<string, Array<() => void>>()
  request<T>(name: string, options: object | ((lock: object | null) => Promise<T>),
    handler?: (lock: object | null) => Promise<T>): Promise<T> {
    const callback = typeof options === 'function' ? options : handler!
    const settings = typeof options === 'function' ? {} : options as { ifAvailable?: boolean; signal?: AbortSignal }
    if (settings.ifAvailable && this.active.has(name)) return callback(null)
    return new Promise<T>((resolve, reject) => {
      const waiting = this.waiting.get(name) ?? []
      this.waiting.set(name, waiting)
      const abort = () => {
        const index = waiting.indexOf(acquire)
        if (index >= 0) waiting.splice(index, 1)
        reject(settings.signal?.reason ?? Error('Lock request canceled'))
      }
      const acquire = () => {
        settings.signal?.removeEventListener('abort', abort)
        if (settings.signal?.aborted) { abort(); this.next(name); return }
        this.active.add(name)
        void Promise.resolve().then(() => callback({})).then(resolve, reject).finally(() => {
          this.active.delete(name)
          this.next(name)
        })
      }
      settings.signal?.addEventListener('abort', abort, { once: true })
      if (settings.signal?.aborted) abort()
      else { waiting.push(acquire); this.next(name) }
    })
  }
  private next(name: string) {
    if (!this.active.has(name)) this.waiting.get(name)?.shift()?.()
  }
}

const originalLocks = Object.getOwnPropertyDescriptor(navigator, 'locks')
beforeEach(() => Object.defineProperty(navigator, 'locks', {
  configurable: true, value: new SerialLocks(),
}))
afterEach(() => {
  if (originalLocks) Object.defineProperty(navigator, 'locks', originalLocks)
  else Reflect.deleteProperty(navigator, 'locks')
})

async function withSerialLocks(work: (locks: SerialLocks) => Promise<void>) {
  const locks = new SerialLocks()
  const oldLocks = Object.getOwnPropertyDescriptor(navigator, 'locks')
  const oldChannel = Object.getOwnPropertyDescriptor(globalThis, 'BroadcastChannel')
  Object.defineProperty(navigator, 'locks', { configurable: true, value: locks })
  Object.defineProperty(globalThis, 'BroadcastChannel', { configurable: true, value: undefined })
  const focus = vi.spyOn(document, 'hasFocus').mockReturnValue(true)
  try { await work(locks) } finally {
    focus.mockRestore()
    if (oldLocks) Object.defineProperty(navigator, 'locks', oldLocks)
    else Reflect.deleteProperty(navigator, 'locks')
    if (oldChannel) Object.defineProperty(globalThis, 'BroadcastChannel', oldChannel)
    else Reflect.deleteProperty(globalThis, 'BroadcastChannel')
  }
}

const form = await loadArrowsForms()
function firstBreak(armed: ReturnType<typeof armHeadless>) {
  let state = advance(armed, { kind: 'start', atMs: armed.armedAtMs + 100, responseHeld: false })
  for (let trial = 0; trial < state.form.trials.length / 5; trial++) {
    state = advance(state, { kind: 'fixation', atMs: state.fixationDueMs! })
    state = advance(state, { kind: 'onset', atMs: state.stimulusDueMs! })
    state = advance(state, { kind: 'resolve', atMs: state.resolutionDueMs! })
    state = advance(state, { kind: 'offset', atMs: state.resolutionDueMs! })
  }
  return state
}

describe('Arrows durable arm foundation', () => {
  it('atomically rotates six forms and keeps prior arms immutable across another tab', async () => {
    const backend = new MemoryBackend()
    const first = new ArrowsStore(backend, backend.root.installationId)
    const second = new ArrowsStore(backend, backend.root.installationId)
    const arms = await Promise.all(Array.from({ length: 7 }, (_, index) =>
      (index % 2 ? second : first).start(request(index + 1))))
    expect(arms.map(arm => arm.ordinal).toSorted((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(arms.every(arm => arm.state.form.id ===
      (['AR11-1', 'AR11-2', 'AR11-3', 'AR11-4', 'AR11-5', 'AR11-6'] as const)[(arm.ordinal - 1) % 6])).toBe(true)
    expect(backend.root.scoredStartCountV11).toBe(7)
    expect(backend.root.revision).toBe(7)
    const firstArm = arms.find(arm => arm.ordinal === 1)!
    expect(firstArm.state.events.map(event => event.type)).toEqual(['prepared', 'form_assigned', 'armed'])
    await inspectArrowsRoot(await backend.read())
    expect(firstArm.state.form).toEqual(form.get('AR11-1'))
    expect(verifyHeadless(firstArm.state)).toBe(true)
    expect(advance(firstArm.state, { kind: 'start', atMs: 201, responseHeld: false }).phase).toBe('fixation_pending')
    expect(Object.isFrozen(firstArm) && Object.isFrozen(firstArm.state.profile)).toBe(true)
    expect(verifyHeadless((await second.loadArmed(firstArm.sessionId))!.state)).toBe(true)
  })

  it('deduplicates a retry and recovers a committed arm whose callback was lost', async () => {
    const backend = new MemoryBackend()
    const store = new ArrowsStore(backend, backend.root.installationId)
    backend.loseDeliveryAfterCommit = true
    const first = await store.start(request(1))
    expect(first.ordinal).toBe(1)
    expect(backend.root.scoredStartCountV11).toBe(1)
    backend.loseDeliveryAfterCommit = false
    expect(await store.start(request(1))).toEqual(first)
    expect(backend.root.scoredStartCountV11).toBe(1)
    await expect(store.start({ ...request(1), profile: { ...profile, rightCode: 'KeyF' } })).rejects.toThrow('identity changed')
    expect(backend.root.scoredStartCountV11).toBe(1)
  })

  it('does not count an uncommitted or unverified arm', async () => {
    const backend = new MemoryBackend()
    const store = new ArrowsStore(backend, backend.root.installationId)
    backend.rejectBeforeCommit = true
    await expect(store.start(request(1))).rejects.toThrow('Injected uncommitted failure')
    expect(backend.root.scoredStartCountV11).toBe(0)
    backend.rejectBeforeCommit = false
    backend.rejectRead = true
    await expect(store.start(request(1))).rejects.toThrow('Injected read failure')
    expect(backend.root.scoredStartCountV11).toBe(0)
    backend.rejectRead = false
    expect((await store.start(request(1))).ordinal).toBe(1)
    expect(backend.root.scoredStartCountV11).toBe(1)
  })

  it('cancels pending admission without starting after its transaction eventually commits', async () => {
    class HeldBackend extends MemoryBackend {
      release: (() => void) | null = null
      override change<T>(operation: (root: ArrowsRoot) => T): Promise<T> {
        return new Promise((resolve, reject) => {
          this.release = () => { void super.change(operation).then(resolve, reject) }
        })
      }
    }
    const backend = new HeldBackend()
    const store = new ArrowsStore(backend, backend.root.installationId)
    const controller = new AbortController()
    const pending = store.start(request(1), controller.signal)
    for (let index = 0; index < 20 && !backend.release; index++) await new Promise(resolve => setTimeout(resolve, 0))
    expect(backend.release).not.toBeNull()
    controller.abort()
    await expect(pending).rejects.toThrow('canceled')
    expect(backend.root.scoredStartCountV11).toBe(0)
    backend.release!()
    await backend.queue
    expect(backend.root.scoredStartCountV11).toBe(1)
    expect(Object.keys(backend.root.attempts)).toEqual(['session-1'])
  })

  it('freezes the request profile before a delayed transaction reads it', async () => {
    class HeldBackend extends MemoryBackend {
      release: (() => void) | null = null
      override change<T>(operation: (root: ArrowsRoot) => T): Promise<T> {
        return new Promise((resolve, reject) => {
          this.release = () => { void super.change(operation).then(resolve, reject) }
        })
      }
    }
    const backend = new HeldBackend()
    const mutable = { ...request(1), profile: { ...profile, rightCode: 'ArrowRight' } }
    const pending = new ArrowsStore(backend, backend.root.installationId).start(mutable as StartRequest)
    for (let index = 0; index < 20 && !backend.release; index++) await new Promise(resolve => setTimeout(resolve, 0))
    expect(backend.release).not.toBeNull()
    mutable.profile.rightCode = 'KeyF'
    backend.release!()
    const arm = await pending
    expect(arm.profile).toMatchObject({ rightCode: 'ArrowRight' })
    expect(arm.state.profile).toMatchObject({ rightCode: 'ArrowRight' })
  })

  it('rejects replacement, changed installation identity and tampered arm evidence', async () => {
    const backend = new MemoryBackend()
    const store = new ArrowsStore(backend, backend.root.installationId)
    await store.start(request(1))
    const retired = backend.root
    backend.root = freshArrowsRoot()
    await expect(store.start(request(2))).rejects.toThrow('installation replaced')
    await expect(store.read()).rejects.toThrow('installation replaced')
    const tampered = clone(retired)
    tampered.attempts['session-1'] = { ...tampered.attempts['session-1'],
      state: { ...tampered.attempts['session-1'].state,
        identity: { ...tampered.attempts['session-1'].state.identity, installationId: 'another' } } }
    await expect(inspectArrowsRoot(tampered)).rejects.toThrow('invalid arm identity')
    const wrongForm = clone(retired)
    wrongForm.attempts['session-1'] = { ...wrongForm.attempts['session-1'],
      state: canonicalState(wrongForm.attempts['session-1'].state, form.get('AR11-2')!) }
    await expect(inspectArrowsRoot(wrongForm)).rejects.toThrow()
    const ordinal = clone(retired)
    ordinal.attempts['session-1'] = { ...ordinal.attempts['session-1'], ordinal: 2 }
    await expect(inspectArrowsRoot(ordinal)).rejects.toThrow('invalid arm identity')
    await expect(store.start({ ...request(3), sessionId: '__proto__' })).rejects.toThrow('invalid start request')
  })

  it('rejects unsupported roots non-destructively and verifies detached authentic arms', async () => {
    const backend = new MemoryBackend()
    const store = new ArrowsStore(backend, backend.root.installationId)
    await store.start(request(1))
    const detached = await backend.read()
    await inspectArrowsRoot(detached)
    const original = JSON.stringify(detached)
    detached.version = 'unsupported' as ArrowsRoot['version']
    await expect(inspectArrowsRoot(detached)).rejects.toThrow('unsupported root')
    expect(JSON.stringify(await backend.read())).toBe(original)
    const forged = clone(await backend.read())
    forged.attempts['session-1'] = { ...forged.attempts['session-1'],
      state: armHeadless(form.get('AR11-1')!,
        { installationId: forged.installationId, sessionId: 'session-1', clockDomainId: 'clock-other' }, profile, 101) }
    await expect(inspectArrowsRoot(forged)).rejects.toThrow('invalid arm identity')
  })

  it('rejects structured-clone Map, Set and Date dictionaries without consuming rotation', async () => {
    for (const malformed of [new Map(), new Set(), new Date()]) {
      const backend = new MemoryBackend()
      backend.root.attempts = malformed as unknown as ArrowsRoot['attempts']
      await expect(inspectArrowsRoot(await backend.read())).rejects.toThrow('unsupported root')
      const store = new ArrowsStore(backend, backend.root.installationId)
      await expect(store.start(request(1))).rejects.toThrow('unsupported root')
      expect(backend.root.scoredStartCountV11).toBe(0)
    }
    const backend = new MemoryBackend()
    backend.root.tombstones = new Map([['session-1', 10]]) as unknown as ArrowsRoot['tombstones']
    await expect(inspectArrowsRoot(await backend.read())).rejects.toThrow('unsupported root')
    await expect(new ArrowsStore(backend, backend.root.installationId).start(request(1))).rejects.toThrow('unsupported root')
    expect(backend.root.scoredStartCountV11).toBe(0)
  })
})

describe('Arrows Start and deletion ordering', () => {
  it('releases ordered Start on the first-stage watchdog without an onset', async () => {
    await withSerialLocks(async locks => {
      const backend = new MemoryBackend()
      const store = new ArrowsStore(backend, backend.root.installationId)
      const entry = new ArrowsEntry(store)
      const host = document.createElement('div')
      const run = new ArrowsBrowserRun(entry, host, vi.fn(), undefined, true)
      vi.spyOn(run, 'layoutReady').mockReturnValue(true)
      const owned = { ...request(1), requestId: 'watchdog-ordered-start' }
      try {
        await run.begin(owned)
        expect(run.snapshot()?.phase).toBe('fixation_pending')
        expect(locks.active.has(ARROWS_PRESENTATION_LOCK)).toBe(true)
        const deletion = store.deleteAttempt(owned.sessionId)
        await Promise.resolve()
        expect(backend.root.attempts[owned.sessionId]).toBeDefined()
        ;(run as unknown as { apply: (command: { kind: 'watchdog'; atMs: number }) => void })
          .apply({ kind: 'watchdog', atMs: run.snapshot()!.fixationDueMs! + 2_001 })
        expect(run.snapshot()?.phase).toBe('invalid')
        await deletion
        await vi.waitFor(() => expect(locks.active.has(ARROWS_PRESENTATION_LOCK)).toBe(false))
        expect(backend.root.attempts[owned.sessionId]).toBeUndefined()
      } finally { run.dispose() }
    })
  })

  it('releases a held final-read lock on cancellation and ignores its late positive delivery', async () => {
    await withSerialLocks(async locks => {
      const backend = new MemoryBackend()
      const store = new ArrowsStore(backend, backend.root.installationId)
      const entry = new ArrowsEntry(store)
      const arm = await entry.begin({ ...request(1), requestId: 'cancel-held-final-read' })
      const read = backend.read.bind(backend)
      let deliver!: () => void
      let captured = false
      backend.read = async () => {
        const old = await read()
        if (!captured) {
          captured = true
          await new Promise<void>(resolve => { deliver = resolve })
        }
        return old
      }
      let presented = false
      const admission = entry.admitStart(arm, () => { presented = true })
      await vi.waitFor(() => expect(captured).toBe(true))
      const deletion = store.deleteAttempt(arm.sessionId)
      entry.release()
      await expect(admission).rejects.toThrow()
      await deletion
      expect(locks.active.has(ARROWS_PRESENTATION_LOCK)).toBe(false)
      deliver()
      await Promise.resolve()
      expect(presented).toBe(false)
      expect(backend.root.attempts[arm.sessionId]).toBeUndefined()
    })
  })

  it.each(['individual', 'all'] as const)(
    'orders actual browser Start/fixation against %s deletion in both directions', async scope => {
      await withSerialLocks(async locks => {
        const backend = new MemoryBackend()
        const store = new ArrowsStore(backend, backend.root.installationId)
        const entry = new ArrowsEntry(store)
        const host = document.createElement('div')
        const run = new ArrowsBrowserRun(entry, host, vi.fn(), undefined, true)
        vi.spyOn(run, 'layoutReady').mockReturnValue(true)
        const owned = { ...request(1), requestId: `browser-present-${scope}` }
        const load = store.loadArmed.bind(store)
        let calls = 0, deliver!: () => void
        let captured = false
        store.loadArmed = async (sessionId, signal) => {
          const old = await load(sessionId, signal)
          if (++calls === 2) {
            captured = true
            await new Promise<void>(resolve => { deliver = resolve })
          }
          return old
        }
        try {
          const starting = run.begin(owned)
          await vi.waitFor(() => expect(captured).toBe(true))
          const deletion = scope === 'individual' ? store.deleteAttempt(owned.sessionId) : store.deleteAll()
          await Promise.resolve()
          expect(run.snapshot()).toBeNull()
          deliver()
          await starting
          expect(run.snapshot()?.phase).toBe('fixation_pending')
          expect(host.querySelector('[data-arrows-stage="fixation"]')).not.toBeNull()
          expect(locks.active.has(ARROWS_PRESENTATION_LOCK)).toBe(true)
          expect(backend.root.attempts[owned.sessionId]).toBeDefined()
          entry.confirmFirstPresentation(run.armedAttempt()!, (run as unknown as { admissionToken: import('./entry').ArrowsAdmission }).admissionToken, 1)
          await deletion
          expect(backend.root.attempts[owned.sessionId]).toBeUndefined()
          expect(locks.active.has(ARROWS_PRESENTATION_LOCK)).toBe(false)
        } finally { run.dispose() }
      })

      await withSerialLocks(async locks => {
        const backend = new MemoryBackend()
        const store = new ArrowsStore(backend, backend.root.installationId)
        const entry = new ArrowsEntry(store)
        const host = document.createElement('div')
        const published = vi.fn()
        const run = new ArrowsBrowserRun(entry, host, published, undefined, true)
        vi.spyOn(run, 'layoutReady').mockReturnValue(true)
        const owned = { ...request(1), requestId: `browser-delete-${scope}` }
        const begin = entry.begin.bind(entry)
        let releaseArm!: () => void
        let armReady = false
        entry.begin = async request => {
          const arm = await begin(request)
          armReady = true
          await new Promise<void>(resolve => { releaseArm = resolve })
          return arm
        }
        try {
          const starting = run.begin(owned)
          await vi.waitFor(() => expect(armReady).toBe(true))
          let releaseChange!: () => void
          backend.queue = new Promise<void>(resolve => { releaseChange = resolve })
          const deletion = scope === 'individual' ? store.deleteAttempt(owned.sessionId) : store.deleteAll()
          await vi.waitFor(() => expect(locks.active.has(ARROWS_PRESENTATION_LOCK)).toBe(true))
          releaseArm()
          releaseChange()
          await deletion
          await expect(starting).rejects.toThrow(/authority changed|installation replaced/)
          expect(run.snapshot()).toBeNull()
          expect(host.childElementCount).toBe(0)
          expect(published).not.toHaveBeenCalled()
        } finally { run.dispose() }
      })
    },
  )

  it('releases the short lock after a committed deletion has an indefinitely held completion', async () => {
    await withSerialLocks(async locks => {
      const backend = new MemoryBackend()
      const store = new ArrowsStore(backend, backend.root.installationId)
      const entry = new ArrowsEntry(store)
      const arm = await entry.begin({ ...request(1), requestId: 'held-delete-delivery' })
      const change = backend.change.bind(backend)
      let deliver!: () => void
      backend.change = async <T,>(operation: (root: ArrowsRoot) => T, signal?: AbortSignal) => {
        const result = await change(operation, signal)
        await new Promise<void>(resolve => { deliver = resolve })
        return result
      }
      try {
        const deletion = store.deleteAttempt(arm.sessionId).then(() => null, error => error)
        await vi.waitFor(() => expect(Boolean(backend.root.attempts[arm.sessionId])).toBe(false))
        expect(locks.active.has(ARROWS_PRESENTATION_LOCK)).toBe(true)
        await vi.waitFor(() => expect(locks.active.has(ARROWS_PRESENTATION_LOCK)).toBe(false),
          { timeout: ARROWS_DELETION_ORDER_TIMEOUT_MS + 1_000 })
        expect((await deletion as Error).message).toContain('timed out')
        expect(locks.active.has(ARROWS_PRESENTATION_LOCK)).toBe(false)
        let presented = false
        await expect(entry.admitStart(arm, () => { presented = true })).rejects.toThrow('authority changed')
        expect(presented).toBe(false)
        deliver()
        await Promise.resolve()
        expect(backend.root.attempts[arm.sessionId]).toBeUndefined()
      } finally { entry.release() }
    })
  }, ARROWS_DELETION_ORDER_TIMEOUT_MS + 2_000)

  it('aborts a still-live deletion before unlocking, so a late write cannot retire a later Start', async () => {
    await withSerialLocks(async locks => {
      const backend = new MemoryBackend()
      const store = new ArrowsStore(backend, backend.root.installationId)
      const entry = new ArrowsEntry(store)
      const arm = await entry.begin({ ...request(1), requestId: 'held-delete-transaction' })
      let releaseTransaction!: () => void
      backend.queue = new Promise<void>(resolve => { releaseTransaction = resolve })
      vi.useFakeTimers()
      try {
        const deletion = store.deleteAttempt(arm.sessionId).then(() => null, error => error)
        for (let tick = 0; tick < 30 && !locks.active.has(ARROWS_PRESENTATION_LOCK); tick++) await Promise.resolve()
        expect(locks.active.has(ARROWS_PRESENTATION_LOCK)).toBe(true)
        await vi.advanceTimersByTimeAsync(ARROWS_DELETION_ORDER_TIMEOUT_MS + 1)
        expect((await deletion as Error).message).toContain('timed out')
        expect(locks.active.has(ARROWS_PRESENTATION_LOCK)).toBe(false)
        let presented = false

        const admission = entry.admitStart(arm, () => { presented = true })
        for (let tick = 0; tick < 30 && !locks.active.has(ARROWS_PRESENTATION_LOCK); tick++) await Promise.resolve()
        expect(locks.active.has(ARROWS_PRESENTATION_LOCK)).toBe(true)
        releaseTransaction()
        await admission
        expect(presented).toBe(true)
        expect(backend.root.attempts[arm.sessionId]).toBeDefined()
        expect(backend.root.tombstones[arm.sessionId]).toBeUndefined()
      } finally { vi.useRealTimers(); entry.release() }
    })
  })

  it.each(['initial', 'same-request retry'] as const)(
    '%s orders a held final read before individual deletion and Delete all', async mode => {
      for (const scope of ['individual', 'all'] as const) await withSerialLocks(async locks => {
        const backend = new MemoryBackend()
        const store = new ArrowsStore(backend, backend.root.installationId)
        const owned = { ...request(1), requestId: `order-first-${mode.replace(' ', '-')}-${scope}` }
        if (mode === 'same-request retry') await store.start(owned)
        const entry = new ArrowsEntry(store)
        const arm = await entry.begin(owned)
        const read = backend.read.bind(backend)
        let deliver!: () => void
        let captured = false
        backend.read = async () => {
          const old = await read()
          if (captured) return old
          captured = true
          await new Promise<void>(resolve => { deliver = resolve })
          return old
        }
        let presented = false
        let admissionToken!: import('./entry').ArrowsAdmission
        const admission = entry.admitStart(arm, token => { admissionToken = token; presented = true })
        await vi.waitFor(() => expect(captured).toBe(true))
        expect(locks.active.has(ARROWS_PRESENTATION_LOCK)).toBe(true)
        const deletion = scope === 'individual' ? store.deleteAttempt(arm.sessionId) : store.deleteAll()
        await Promise.resolve()
        expect(backend.root.attempts[arm.sessionId]).toBeDefined()
        expect(presented).toBe(false)
        deliver()
        await admission
        expect(presented).toBe(true)
        expect(locks.active.has(ARROWS_PRESENTATION_LOCK)).toBe(true)
        expect(backend.root.attempts[arm.sessionId]).toBeDefined()
        entry.confirmFirstPresentation(arm, admissionToken, 1)
        await deletion
        expect(backend.root.attempts[arm.sessionId]).toBeUndefined()
        expect(locks.active.has(ARROWS_PRESENTATION_LOCK)).toBe(false)
        entry.release()
      })
    },
  )

  it.each(['initial', 'same-request retry'] as const)(
    '%s rejects admission when individual deletion or Delete all commits first', async mode => {
      for (const scope of ['individual', 'all'] as const) await withSerialLocks(async locks => {
        const backend = new MemoryBackend()
        const store = new ArrowsStore(backend, backend.root.installationId)
        const owned = { ...request(1), requestId: `order-delete-${mode.replace(' ', '-')}-${scope}` }
        if (mode === 'same-request retry') await store.start(owned)
        const entry = new ArrowsEntry(store)
        const arm = await entry.begin(owned)
        let releaseChange!: () => void
        backend.queue = new Promise<void>(resolve => { releaseChange = resolve })
        const deletion = scope === 'individual' ? store.deleteAttempt(arm.sessionId) : store.deleteAll()
        await vi.waitFor(() => expect(locks.active.has(ARROWS_PRESENTATION_LOCK)).toBe(true))
        let presented = false

        const admission = entry.admitStart(arm, () => { presented = true })
        releaseChange()
        await deletion
        await expect(admission).rejects.toThrow(/authority changed|installation replaced/)
        expect(presented).toBe(false)
        expect(backend.root.attempts[arm.sessionId]).toBeUndefined()
        entry.release()
      })
    },
  )
})

describe('Arrows durable snapshot foundation', () => {
  it.each(['snapshot-first', 'deletion-first'] as const)(
    'orders %s snapshot authority with retirement', async order => {
      await withSerialLocks(async locks => {
        const backend = new MemoryBackend()
        const store = new ArrowsStore(backend, backend.root.installationId)
        const arm = await store.start(request(1))
        const state = firstBreak(arm.state)
        let release!: () => void
        backend.queue = new Promise<void>(resolve => { release = resolve })
        let saving: Promise<unknown>, deleting: Promise<unknown>
        if (order === 'snapshot-first') {
          saving = store.saveSnapshot(arm, state, 0)
          await vi.waitFor(() => expect(locks.active.has(ARROWS_PRESENTATION_LOCK)).toBe(true))
          deleting = store.deleteAttempt(arm.sessionId)
        } else {
          deleting = store.deleteAttempt(arm.sessionId)
          await vi.waitFor(() => expect(locks.active.has(ARROWS_PRESENTATION_LOCK)).toBe(true))
          saving = store.saveSnapshot(arm, state, 0)
        }
        release()
        if (order === 'snapshot-first') await expect(saving).resolves.toMatchObject({ kind: 'checkpoint' })
        await expect(deleting).resolves.toBeUndefined()
        if (order === 'deletion-first') await expect(saving).rejects.toThrow('snapshot authority changed')
        expect(backend.root.attempts[arm.sessionId]).toBeUndefined()
        expect(backend.root.tombstones[arm.sessionId]).toBeDefined()
      })
    },
  )

  it('confirms a full between-block prefix and retains the immutable armed provenance', async () => {
    const backend = new MemoryBackend()
    const store = new ArrowsStore(backend, backend.root.installationId)
    const arm = await store.start(request(1))
    const state = firstBreak(arm.state)
    expect(state.phase).toBe('break')
    const saved = await store.saveSnapshot(arm, state, 0)
    expect(saved).toMatchObject({ revision: 1, kind: 'checkpoint', closedTrials: 27 })
    expect(saved.review).toMatchObject({ status: 'incomplete_headless', presented: 27, closed: 27, metrics: null })
    expect((await store.loadSnapshot(arm.sessionId))?.state.events).toEqual(state.events)
    expect((await store.loadArmed(arm.sessionId))?.state).toEqual(arm.state)
    await inspectArrowsRoot(await backend.read())
  })

  it('extends a confirmed untimed break checkpoint when a selected key is released', async () => {
    const backend = new MemoryBackend()
    const store = new ArrowsStore(backend, backend.root.installationId)
    const arm = await store.start(request(1))
    const breakState = firstBreak(arm.state)
    await store.saveSnapshot(arm, breakState, 0)
    const pressed = advance(breakState, { kind: 'keydown',
      atMs: breakState.commands.at(-1)!.atMs + 1,
      code: 'ArrowLeft', repeat: false, modified: false })
    const released = advance(pressed, { kind: 'keyup',
      atMs: pressed.commands.at(-1)!.atMs + 1, code: 'ArrowLeft' })
    const saved = await store.saveSnapshot(arm, released, 1)
    expect(saved.revision).toBe(2)
    expect(saved.closedTrials).toBe(27)
    expect(saved.state.events).toEqual(released.events)
    await inspectArrowsRoot(await backend.read())
  })

  it('recovers a committed checkpoint with lost delivery and rejects an uncommitted write', async () => {
    const backend = new MemoryBackend()
    const store = new ArrowsStore(backend, backend.root.installationId)
    const arm = await store.start(request(1))
    const state = firstBreak(arm.state)
    backend.loseDeliveryAfterCommit = true
    const saved = await store.saveSnapshot(arm, state, 0)
    expect(saved.revision).toBe(1)
    backend.loseDeliveryAfterCommit = false
    expect(await store.saveSnapshot(arm, state, 0)).toEqual(saved)
    const invalid = advance(state, { kind: 'invalidate', atMs: state.commands.at(-1)!.atMs + 1, reason: 'settings' })
    backend.rejectBeforeCommit = true
    await expect(store.saveSnapshot(arm, invalid, 1)).rejects.toThrow('Injected uncommitted failure')
    expect((await store.loadSnapshot(arm.sessionId))?.kind).toBe('checkpoint')
    backend.rejectBeforeCommit = false
    const terminal = await store.saveSnapshot(arm, invalid, 1)
    expect(terminal).toMatchObject({ revision: 2, kind: 'terminal', closedTrials: 27,
      review: { status: 'invalid_headless', metrics: null } })
    await expect(store.saveSnapshot(arm, state, 1)).rejects.toThrow('snapshot revision or prefix changed')
  })

  it('fences stale snapshots after deletion or replacement and rejects a changed saved review', async () => {
    const backend = new MemoryBackend()
    const store = new ArrowsStore(backend, backend.root.installationId)
    const arm = await store.start(request(1))
    const state = firstBreak(arm.state)
    await store.saveSnapshot(arm, state, 0)
    const forged = clone(await backend.read())
    forged.attempts[arm.sessionId] = { ...forged.attempts[arm.sessionId], snapshot: {
      ...forged.attempts[arm.sessionId].snapshot!, closedTrials: 23 } }
    await expect(inspectArrowsRoot(forged)).rejects.toThrow('unreconciled snapshot')
    const deleted = clone(await backend.read())
    delete deleted.attempts[arm.sessionId]
    deleted.tombstones[arm.sessionId] = { version: 'arrows_spec_v1_1', ordinal: arm.ordinal, requestId: arm.requestId, deletedAtWallMs: 1234 }
    deleted.revision++
    backend.root = deleted
    await expect(store.saveSnapshot(arm, state, 0)).rejects.toThrow('snapshot authority changed')
    backend.root = freshArrowsRoot()
    await expect(store.saveSnapshot(arm, state, 0)).rejects.toThrow('installation replaced')
  })

  it('does not create snapshot work after cancellation during form verification', async () => {
    const backend = new MemoryBackend()
    const store = new ArrowsStore(backend, backend.root.installationId)
    const arm = await store.start(request(1))
    const state = firstBreak(arm.state)
    const change = vi.spyOn(backend, 'change')
    const originalDigest = crypto.subtle.digest.bind(crypto.subtle)
    let finishDigest!: () => void
    vi.spyOn(crypto.subtle, 'digest').mockImplementation(async (...args) => {
      const result = await originalDigest(...args)
      await new Promise<void>(resolve => { finishDigest = resolve })
      return result
    })
    try {
      const controller = new AbortController()
      const pending = store.saveSnapshot(arm, state, 0, controller.signal)
      await vi.waitFor(() => expect(finishDigest).toBeTypeOf('function'))
      controller.abort()
      finishDigest()
      await expect(pending).rejects.toThrow('canceled')
      expect(change).not.toHaveBeenCalled()
      expect(backend.root.attempts[arm.sessionId].snapshot).toBeUndefined()
    } finally { vi.restoreAllMocks() }
  })

  it('saves the identical terminal journal after owner release and fences deletion', async () => {
    const backend = new MemoryBackend()
    const store = new ArrowsStore(backend, backend.root.installationId)
    const arm = await store.start(request(1))
    const state = advance(firstBreak(arm.state), { kind: 'invalidate',
      atMs: firstBreak(arm.state).commands.at(-1)!.atMs + 1, reason: 'settings' })
    const entry = new ArrowsEntry(store)
    const saved = await entry.saveTerminal(arm, state)
    expect(saved).toMatchObject({ kind: 'terminal', closedTrials: 27 })
    expect(saved.state).toEqual(state)
    expect(await entry.currentTerminal(arm, state)).toEqual(saved)
    expect(await entry.saveTerminal(arm, state)).toEqual(saved)
    expect((await store.loadSnapshot(arm.sessionId))?.state).toEqual(state)
    const replacement = clone(await backend.read())
    delete replacement.attempts[arm.sessionId]
    replacement.tombstones[arm.sessionId] = { version: 'arrows_spec_v1_1', ordinal: arm.ordinal, requestId: arm.requestId, deletedAtWallMs: 1234 }
    replacement.revision++
    backend.root = replacement
    await expect(entry.currentTerminal(arm, state)).rejects.toThrow('authority changed')
    await expect(entry.saveTerminal(arm, state)).rejects.toThrow('authority changed')
    expect(backend.root.attempts[arm.sessionId]).toBeUndefined()
  })

  it.each(['deleted', 'replaced', 'intact'] as const)(
    'preserves %s authority evidence after a committed write loses delivery', async outcome => {
      const backend = new MemoryBackend()
      const store = new ArrowsStore(backend, backend.root.installationId)
      const arm = await store.start(request(1))
      const atBreak = firstBreak(arm.state)
      const state = advance(atBreak, { kind: 'invalidate',
        atMs: atBreak.commands.at(-1)!.atMs + 1, reason: 'settings' })
      const originalChange = backend.change.bind(backend)
      let rejectDelivery!: (error: Error) => void
      backend.change = <T,>(operation: (root: ArrowsRoot) => T): Promise<T> =>
        originalChange(operation).then(() => new Promise<T>((_, reject) => { rejectDelivery = reject }))
      const pending = store.saveSnapshot(arm, state, 0)
      await vi.waitFor(() => expect(rejectDelivery).toBeTypeOf('function'))
      if (outcome === 'deleted') {
        delete backend.root.attempts[arm.sessionId]
        backend.root.tombstones[arm.sessionId] = { version: 'arrows_spec_v1_1', ordinal: arm.ordinal, requestId: arm.requestId, deletedAtWallMs: 1234 }
        backend.root.revision++
      } else if (outcome === 'replaced') backend.root = freshArrowsRoot()
      rejectDelivery(Error('Injected lost delivery'))
      if (outcome === 'intact') {
        await expect(pending).resolves.toMatchObject({ kind: 'terminal', state })
      } else {
        await expect(pending).rejects.toThrow(outcome === 'deleted' ?
          'snapshot authority changed' : 'installation replaced')
      }
    })

  it('persists a complete 135-trial terminal journal without changing its scored bytes', async () => {
    const backend = new MemoryBackend()
    const store = new ArrowsStore(backend, backend.root.installationId)
    const arm = await store.start(request(1))
    let state = advance(arm.state, { kind: 'start', atMs: arm.state.armedAtMs + 100,
      responseHeld: false })
    for (let trial = 1; trial <= 135; trial++) {
      state = advance(state, { kind: 'fixation', atMs: state.fixationDueMs! })
      state = advance(state, { kind: 'onset', atMs: state.stimulusDueMs! })
      state = advance(state, { kind: 'resolve', atMs: state.resolutionDueMs! })
      state = advance(state, { kind: 'offset', atMs: state.resolutionDueMs! })
      if (state.phase === 'break') state = advance(state, { kind: 'continue',
        atMs: state.commands.at(-1)!.atMs + 1, responseHeld: false })
    }
    expect(state.phase).toBe('completed')
    const saved = await new ArrowsEntry(store).saveTerminal(arm, state)
    expect(saved.review.status).toBe('complete_headless')
    expect(saved.closedTrials).toBe(135)
    expect(saved.state).toEqual(state)
    expect((await store.loadSnapshot(arm.sessionId))?.state).toEqual(state)
  })

  it('rejects changed first-checkpoint and first-terminal arm provenance without changing durable bytes', async () => {
    for (const changed of ['time', 'form'] as const) for (const terminal of [false, true]) {
      const backend = new MemoryBackend()
      const store = new ArrowsStore(backend, backend.root.installationId)
      const arm = await store.start(request(1))
      const altered = armHeadless(changed === 'form' ? form.get('AR11-2')! : form.get('AR11-1')!,
        arm.state.identity, arm.profile, arm.state.armedAtMs + (changed === 'time' ? 1 : 0))
      let state = firstBreak(altered)
      if (terminal) state = advance(state, { kind: 'invalidate',
        atMs: state.commands.at(-1)!.atMs + 1, reason: 'settings' })
      expect(verifyHeadless(state)).toBe(true)
      const before = JSON.stringify(await backend.read())
      await expect(store.saveSnapshot(arm, state, 0)).rejects.toThrow('snapshot arm prefix changed')
      expect(JSON.stringify(await backend.read())).toBe(before)
      expect(await store.loadSnapshot(arm.sessionId)).toBeNull()
      const correct = firstBreak(arm.state)
      expect((await store.saveSnapshot(arm, correct, 0)).closedTrials).toBe(27)
    }
  })
})

describe('Arrows history retirement', () => {
  it('rejects impossible count/history combinations before history reads or new arms', async () => {
    const backend = new MemoryBackend()
    const store = new ArrowsStore(backend, backend.root.installationId)
    await store.start(request(1))
    await store.deleteAttempt('session-1')
    const intact = clone(backend.root)
    backend.root.scoredStartCountV11 = 0
    await expect(inspectArrowsRoot(await backend.read())).rejects.toThrow('invalid V1.1 tombstone')
    await expect(store.listAttempts()).rejects.toThrow('invalid V1.1 tombstone')
    await expect(store.start(request(2))).rejects.toThrow('invalid V1.1 tombstone')
    expect(backend.root.attempts['session-2']).toBeUndefined()

    backend.root = intact
    delete backend.root.tombstones['session-1']
    await expect(inspectArrowsRoot(await backend.read())).rejects.toThrow('arm counter and retained history disagree')
    await expect(store.listAttempts()).rejects.toThrow('arm counter and retained history disagree')
    await expect(store.start(request(1))).rejects.toThrow('arm counter and retained history disagree')
    expect(backend.root.attempts['session-1']).toBeUndefined()
  })

  it('lists verified attempts, retains rotation across individual deletion, and fences a late terminal save', async () => {
    const backend = new MemoryBackend()
    const store = new ArrowsStore(backend, backend.root.installationId)
    const first = await store.start(request(1))
    await store.start(request(2))
    expect((await store.listAttempts()).map(attempt => attempt.sessionId)).toEqual(['session-2', 'session-1'])
    const atBreak = firstBreak(first.state)
    await store.deleteAttempt(first.sessionId)
    expect(backend.root.scoredStartCountV11).toBe(2)
    expect(backend.root.tombstones[first.sessionId]).toMatchObject({ version: 'arrows_spec_v1_1', ordinal: first.ordinal, requestId: first.requestId })
    expect((await store.listAttempts()).map(attempt => attempt.sessionId)).toEqual(['session-2'])
    await expect(store.saveSnapshot(first, atBreak, 0)).rejects.toThrow('snapshot authority changed')
    await store.deleteAttempt(first.sessionId)
    expect((await store.start(request(3))).state.form.id).toBe('AR11-3')
    await inspectArrowsRoot(await backend.read())
  })

  it('replaces only Arrows installation state and fences old callbacks, even after lost delivery', async () => {
    const backend = new MemoryBackend()
    const old = new ArrowsStore(backend, backend.root.installationId)
    const first = await old.start(request(1))
    backend.loseDeliveryAfterCommit = true
    const fresh = await old.deleteAll()
    backend.loseDeliveryAfterCommit = false
    expect(fresh.installationId).not.toBe(old.installationId)
    expect(await fresh.listAttempts()).toEqual([])
    expect((await fresh.read()).scoredStartCountV11).toBe(0)
    await expect(old.start(request(2))).rejects.toThrow('installation replaced')
    await expect(old.saveSnapshot(first, firstBreak(first.state), 0)).rejects.toThrow('installation replaced')
    expect((await fresh.start(request(3))).state.form.id).toBe('AR11-1')
    await inspectArrowsRoot(await backend.read())
  })

  it('does not claim deletion succeeded when its transaction failed before commit', async () => {
    const backend = new MemoryBackend()
    const store = new ArrowsStore(backend, backend.root.installationId)
    await store.start(request(1))
    backend.rejectBeforeCommit = true
    await expect(store.deleteAttempt('session-1')).rejects.toThrow('Injected uncommitted failure')
    await expect(store.deleteAll()).rejects.toThrow('Injected uncommitted failure')
    expect(backend.root.attempts['session-1']).toBeDefined()
    expect(backend.root.tombstones['session-1']).toBeUndefined()
  })
})

function activityPort(store: ArrowsStore, arm: ArmedAttempt, snapshot: PersistedSnapshot) {
  return store.authority.handle(arm, snapshot.state, snapshot)
}

describe('Arrows report-view activity continuation', () => {
  async function terminalFixture() {
    const backend = new MemoryBackend()
    const store = new ArrowsStore(backend, backend.root.installationId)
    const arm = await store.start(request(1))
    const atBreak = firstBreak(arm.state)
    const invalid = advance(atBreak, { kind: 'invalidate',
      atMs: atBreak.commands.at(-1)!.atMs + 1, reason: 'settings' })
    const snapshot = await store.saveSnapshot(arm, invalid, 0)
    return { backend, store, arm, snapshot }
  }

  it('appends distinct openings in order, deduplicates a retry, and preserves timed bytes', async () => {
    const { backend, store, arm, snapshot } = await terminalFixture()
    const before = JSON.stringify(backend.root.attempts[arm.sessionId])
    expect(await store.loadReportViews(arm.sessionId, activityPort(store, arm, snapshot))).toEqual({ status: 'legacy_absent', events: [] })
    const first = await store.appendReportView(arm.sessionId, snapshot, 'view-1', 'live', 2000, activityPort(store, arm, snapshot))
    const second = await store.appendReportView(arm.sessionId, snapshot, 'view-2', 'history', 2100, activityPort(store, arm, snapshot))
    expect(await store.appendReportView(arm.sessionId, snapshot, 'view-1', 'live', 2000, activityPort(store, arm, snapshot))).toEqual(first)
    expect(second.sequenceNumber).toBe(2)
    expect((await store.loadReportViews(arm.sessionId, activityPort(store, arm, snapshot))).events).toEqual([first, second])
    expect(JSON.stringify(backend.root.attempts[arm.sessionId])).toBe(before)
    await inspectArrowsRoot(await backend.read())
  })

  it('loads older roots without activity and creates a continuation without changing their result', async () => {
    const fixture = await terminalFixture(), backend = new MemoryBackend()
    backend.root = clone(fixture.backend.root); delete backend.root.activity
    const store = new ArrowsStore(backend, backend.root.installationId), arm = fixture.arm, snapshot = fixture.snapshot
    await store.read()
    await inspectArrowsRoot(await backend.read())
    const before = JSON.stringify(backend.root.attempts[arm.sessionId])
    expect(await store.loadReportViews(arm.sessionId, activityPort(store, arm, snapshot))).toEqual({ status: 'legacy_absent', events: [] })
    await store.appendReportView(arm.sessionId, snapshot, 'view-legacy', 'history', 2200, activityPort(store, arm, snapshot))
    expect((await store.loadReportViews(arm.sessionId, activityPort(store, arm, snapshot))).status).toBe('present')
    expect(JSON.stringify(backend.root.attempts[arm.sessionId])).toBe(before)
  })

  it('records a verified checkpoint review and fences later changes to its report bytes', async () => {
    const backend = new MemoryBackend()
    const store = new ArrowsStore(backend, backend.root.installationId)
    const arm = await store.start(request(1))
    const atBreak = firstBreak(arm.state)
    const checkpoint = await store.saveSnapshot(arm, atBreak, 0)
    const before = JSON.stringify(backend.root.attempts[arm.sessionId])
    const event = await store.appendReportView(arm.sessionId, checkpoint, 'view-checkpoint', 'history', 2000, activityPort(store, arm, checkpoint))
    expect((await store.loadReportViews(arm.sessionId, activityPort(store, arm, checkpoint))).events).toEqual([event])
    expect(JSON.stringify(backend.root.attempts[arm.sessionId])).toBe(before)
    const invalid = advance(atBreak, { kind: 'invalidate',
      atMs: atBreak.commands.at(-1)!.atMs + 1, reason: 'settings' })
    await expect(store.saveSnapshot(arm, invalid, 1)).rejects.toThrow('snapshot authority changed')
    expect((await store.loadSnapshot(arm.sessionId))?.kind).toBe('checkpoint')
  })

  it('rejects corrupt version, sequence, identity, duplicate ID and orphan activity without mutation', async () => {
    const { backend, store, arm, snapshot } = await terminalFixture()
    await store.appendReportView(arm.sessionId, snapshot, 'view-1', 'live', 2000, activityPort(store, arm, snapshot))
    const original = JSON.stringify(await backend.read())
    for (const mutate of [
      (root: ArrowsRoot) => { (root.activity![arm.sessionId] as { version: string }).version = 'other' },
      (root: ArrowsRoot) => { (root.activity![arm.sessionId].events[0] as { sequenceNumber: number }).sequenceNumber = 2 },
      (root: ArrowsRoot) => { (root.activity![arm.sessionId].events[0] as { installationId: string }).installationId = 'other' },
      (root: ArrowsRoot) => { (root.activity![arm.sessionId].events as unknown[]).push(clone(root.activity![arm.sessionId].events[0])) },
      (root: ArrowsRoot) => { delete root.attempts[arm.sessionId] },
    ]) {
      const bad = clone(await backend.read())
      mutate(bad)
      await expect(inspectArrowsRoot(bad)).rejects.toThrow()
    }
    expect(JSON.stringify(await backend.read())).toBe(original)
  })

  it('recovers a committed append with lost delivery but does not invent an uncommitted event', async () => {
    const { backend, store, arm, snapshot } = await terminalFixture()
    backend.loseDeliveryAfterCommit = true
    const recovered = await store.appendReportView(arm.sessionId, snapshot, 'view-1', 'live', 2000, activityPort(store, arm, snapshot))
    backend.loseDeliveryAfterCommit = false
    expect(recovered.sequenceNumber).toBe(1)
    backend.rejectBeforeCommit = true
    await expect(store.appendReportView(arm.sessionId, snapshot, 'view-2', 'history', 2100, activityPort(store, arm, snapshot)))
      .rejects.toThrow('Injected uncommitted failure')
    backend.rejectBeforeCommit = false
    expect((await store.loadReportViews(arm.sessionId, activityPort(store, arm, snapshot))).events).toEqual([recovered])
  })

  it('requires the exact verified terminal bytes even for an existing view ID', async () => {
    const { backend, store, arm, snapshot } = await terminalFixture()
    await store.appendReportView(arm.sessionId, snapshot, 'view-1', 'live', 2000, activityPort(store, arm, snapshot))
    const altered = clone(snapshot)
    ;(altered as { closedTrials: number }).closedTrials--
    const before = JSON.stringify(await backend.read())
    await expect(store.appendReportView(arm.sessionId, altered, 'view-1', 'live', 2000, activityPort(store, arm, snapshot)))
      .rejects.toThrow('activity authority scope unavailable')
    expect(JSON.stringify(await backend.read())).toBe(before)
  })

  it('serializes simultaneous tabs and fences deletion and replacement', async () => {
    const { backend, store, arm, snapshot } = await terminalFixture()
    const other = new ArrowsStore(backend, store.installationId)
    const events = await Promise.all([
      store.appendReportView(arm.sessionId, snapshot, 'view-a', 'live', 2000, activityPort(store, arm, snapshot)),
      other.appendReportView(arm.sessionId, snapshot, 'view-b', 'history', 2100, activityPort(other, arm, snapshot)),
    ])
    expect(events.map(event => event.sequenceNumber).toSorted()).toEqual([1, 2])
    await other.deleteAttempt(arm.sessionId)
    expect(backend.root.activity?.[arm.sessionId]).toBeUndefined()
    await expect(store.appendReportView(arm.sessionId, snapshot, 'view-c', 'live', 2200, activityPort(store, arm, snapshot)))
      .rejects.toThrow('report view authority changed')
    const fresh = await other.deleteAll()
    expect((await fresh.read()).activity).toEqual({})
    await expect(store.appendReportView(arm.sessionId, snapshot, 'view-d', 'live', 2300, activityPort(store, arm, snapshot)))
      .rejects.toThrow('installation replaced')
  })

  it('does not resurrect activity when another tab deletes before a delayed append transaction', async () => {
    const { backend, store, arm, snapshot } = await terminalFixture()
    const other = new ArrowsStore(backend, store.installationId)
    const ordinary = backend.change.bind(backend)
    let release!: () => void
    let held = true
    backend.change = <T,>(operation: (root: ArrowsRoot) => T): Promise<T> => {
      if (!held) return ordinary(operation)
      held = false
      return new Promise<T>((resolve, reject) => {
        release = () => { void ordinary(operation).then(resolve, reject) }
      })
    }
    const pending = store.appendReportView(arm.sessionId, snapshot, 'view-late', 'live', 2000, activityPort(store, arm, snapshot))
    await vi.waitFor(() => expect(release).toBeTypeOf('function'))
    await other.deleteAttempt(arm.sessionId)
    release()
    await expect(pending).rejects.toThrow('report view authority changed')
    expect(backend.root.activity?.[arm.sessionId]).toBeUndefined()
    expect(backend.root.tombstones[arm.sessionId]).toMatchObject({ version: 'arrows_spec_v1_1', ordinal: arm.ordinal, requestId: arm.requestId })
  })

  it('notifies only after confirmed retirement and keeps notification failures advisory', async () => {
    const { backend, store, arm } = await terminalFixture()
    const notices: unknown[] = []
    const unsubscribe = store.subscribeDeletion(notice => { notices.push(notice) })
    store.subscribeDeletion(() => { throw Error('Observer failed') })
    backend.rejectBeforeCommit = true
    await expect(store.deleteAttempt(arm.sessionId)).rejects.toThrow('Injected uncommitted failure')
    expect(notices).toEqual([])
    backend.rejectBeforeCommit = false
    await store.deleteAttempt(arm.sessionId)
    expect(notices).toEqual([{ type: 'attempt_deleted',
      installationId: store.installationId, sessionId: arm.sessionId }])
    const fresh = await store.deleteAll()
    expect(notices).toEqual([
      { type: 'attempt_deleted', installationId: store.installationId, sessionId: arm.sessionId },
      { type: 'installation_replaced', installationId: store.installationId,
        replacementInstallationId: fresh.installationId },
    ])
    unsubscribe()
  })

  it('broadcasts confirmed deletion to another subscribed store', async () => {
    class Channel {
      static peers = new Set<Channel>()
      onmessage: ((event: MessageEvent) => void) | null = null
      readonly name: string
      constructor(name: string) { this.name = name; Channel.peers.add(this) }
      postMessage(data: unknown) {
        for (const peer of Channel.peers) if (peer !== this && peer.name === this.name)
          queueMicrotask(() => peer.onmessage?.({ data } as MessageEvent))
      }
      close() { Channel.peers.delete(this) }
    }
    vi.stubGlobal('BroadcastChannel', Channel)
    try {
      const { backend, store, arm } = await terminalFixture()
      const other = new ArrowsStore(backend, store.installationId)
      const notices: unknown[] = []
      const unsubscribe = other.subscribeDeletion(notice => { notices.push(notice) })
      await store.deleteAttempt(arm.sessionId)
      await vi.waitFor(() => expect(notices).toEqual([{ type: 'attempt_deleted',
        installationId: store.installationId, sessionId: arm.sessionId }]))
      unsubscribe()
      expect(Channel.peers.size).toBe(0)
    } finally { vi.unstubAllGlobals() }
  })

  it('permits explicit Delete all of an identifiable corrupt root without admitting it', async () => {
    const { backend, store, arm, snapshot } = await terminalFixture()
    await store.appendReportView(arm.sessionId, snapshot, 'view-1', 'live', 2000, activityPort(store, arm, snapshot))
    ;(backend.root.activity![arm.sessionId] as { version: string }).version = 'unsupported'
    await expect(store.read()).rejects.toThrow('invalid activity journal')
    await expect(store.deleteAll()).rejects.toThrow('invalid activity journal')
    const deletionOnly = new ArrowsStore(backend, store.installationId, true)
    await expect(deletionOnly.read()).rejects.toThrow('invalid activity journal')
    const fresh = await deletionOnly.deleteAll()
    expect((await fresh.read()).activity).toEqual({})
    await expect(store.start(request(2))).rejects.toThrow('installation replaced')
  })

  it('saves a break-exit prefix after owner release and fences deletion and replacement', async () => {
    const backend = new MemoryBackend()
    const store = new ArrowsStore(backend, backend.root.installationId)
    const arm = await store.start(request(1))
    const prefix = firstBreak(arm.state)
    const entry = new ArrowsEntry(store)
    entry.release()
    const saved = await entry.saveBreakExit(arm, prefix, 0)
    expect(saved.kind).toBe('checkpoint')
    expect(saved.state).toEqual(prefix)
    expect(await entry.currentBreakExit(arm, entry.authority(arm, prefix, saved.revision))).toEqual(saved)
    await store.deleteAttempt(arm.sessionId)
    await expect(entry.currentBreakExit(arm, entry.authority(arm, prefix, saved.revision))).rejects.toThrow('authority changed')
    await expect(entry.saveBreakExit(arm, prefix, saved.revision)).rejects.toThrow('snapshot authority changed')
    await store.deleteAll()
    await expect(entry.currentBreakExit(arm, entry.authority(arm, prefix, saved.revision))).rejects.toThrow('installation replaced')
    await expect(entry.saveBreakExit(arm, prefix, saved.revision)).rejects.toThrow('installation replaced')
  })
})
