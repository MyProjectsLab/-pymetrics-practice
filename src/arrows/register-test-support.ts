import { advance } from './versions'
import type { State } from './versions'
import { ArrowsStore, freshArrowsRoot } from './storage'
import type { ArrowsBackend, ArrowsRoot } from './storage'
export const testProfile = { kind: 'keyboard', leftCode: 'ArrowLeft', rightCode: 'ArrowRight', alternative: false,
  accommodation: 'default', reducedMotion: false } as const
export function barrier<T>() { let release!: (value: T) => void, reject!: (error: Error) => void
  const promise = new Promise<T>((yes, no) => { release = yes; reject = no }); return { promise, release, reject } }
export class RegisterBackend implements ArrowsBackend {
  root = freshArrowsRoot()
  readNext: (() => Promise<ArrowsRoot>) | null = null
  changeNext: (() => Promise<void>) | null = null
  async read() { const next = this.readNext; this.readNext = null; return next ? next() : structuredClone(this.root) }
  async change<T>(work: (root: ArrowsRoot) => T) {
    const next = this.changeNext; this.changeNext = null; if (next) await next()
    const root = structuredClone(this.root), value = work(root); this.root = root; return value
  }
}
export function breakAfter(state: State, blocks = 1): State {
  let next = advance(state, { kind: 'start', atMs: state.armedAtMs + 100, responseHeld: false })
  for (let block = 0; block < blocks; block++) {
    if (block) next = advance(next, { kind: 'continue', atMs: next.commands.at(-1)!.atMs + 100, responseHeld: false })
    for (let n = 0; n < state.form.trials.length / 5; n++) {
      next = advance(next, { kind: 'fixation', atMs: next.fixationDueMs! })
      next = advance(next, { kind: 'onset', atMs: next.stimulusDueMs! })
      next = advance(next, { kind: 'resolve', atMs: next.resolutionDueMs! })
      next = advance(next, { kind: 'offset', atMs: next.resolutionDueMs! })
    }
  }
  return next
}
export async function registerFixture(blocks = 1, saved = true) {
  const backend = new RegisterBackend(), store = new ArrowsStore(backend, backend.root.installationId)
  const arm = await store.start({ requestId: 'request', sessionId: 'session', clockDomainId: 'clock', atMs: 100, wallMs: 1000, profile: testProfile })
  const prefix = breakAfter(arm.state, blocks)
  const snapshot = saved ? await store.saveSnapshot(arm, prefix, 0) : null
  const handle = store.authority.handle(arm, prefix, snapshot ?? undefined)
  const remote = new ArrowsStore({ read: () => backend.read(), change: work => backend.change(work) }, backend.root.installationId)
  return { backend, store, arm, prefix, snapshot, handle, remote }
}
/** Small FIFO Web Locks model. Different names are independent; cancellation
 * releases a held presentation via the actual order helper. */
export function installTestLocks() {
  const tails = new Map<string, Promise<unknown>>(), active = new Set<string>()
  Object.defineProperty(navigator, 'locks', { configurable: true, value: {
    request: (name: string, options: LockOptions, work: (lock: Lock | null) => unknown) => {
      if (options.ifAvailable && active.has(name)) return Promise.resolve(work(null))
      const prior = tails.get(name) ?? Promise.resolve()
      const task = prior.catch(() => {}).then(async () => {
        if (options.signal?.aborted) throw Error('lock canceled')
        active.add(name)
        try { return await work({ name, mode: 'exclusive' } as Lock) } finally { active.delete(name) }
      })
      tails.set(name, task); return task
    },
  } })
  return active
}
