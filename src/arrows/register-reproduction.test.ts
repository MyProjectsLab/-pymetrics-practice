import { afterEach, expect, it, vi } from 'vitest'
import { advance } from './versions'
import { ArrowsEntry } from './entry'
import { ArrowsStore, freshArrowsRoot } from './storage'
import type { ArrowsBackend, ArrowsRoot } from './storage'

const profile = { kind: 'keyboard', leftCode: 'ArrowLeft', rightCode: 'ArrowRight', alternative: false,
  accommodation: 'default', reducedMotion: false } as const
const locks = Object.getOwnPropertyDescriptor(navigator, 'locks')
afterEach(() => { vi.restoreAllMocks(); if (locks) Object.defineProperty(navigator, 'locks', locks)
  else Reflect.deleteProperty(navigator, 'locks') })
class Backend implements ArrowsBackend {
  root = freshArrowsRoot()
  readNext: (() => Promise<ArrowsRoot>) | null = null
  changeNext: (() => Promise<void>) | null = null
  async read() { const next = this.readNext; this.readNext = null; return next ? next() : structuredClone(this.root) }
  async change<T>(work: (root: ArrowsRoot) => T) {
    const next = this.changeNext; this.changeNext = null; if (next) await next()
    const root = structuredClone(this.root), value = work(root); this.root = root; return value
  }
}
async function setup() {
  Object.defineProperty(navigator, 'locks', { configurable: true, value: {
    request: (_name: string, _options: object, work: () => Promise<unknown>) => Promise.resolve().then(work),
  } })
  const backend = new Backend(), store = new ArrowsStore(backend, backend.root.installationId)
  const arm = await store.start({ requestId: 'request', sessionId: 'session', clockDomainId: 'clock', atMs: 100,
    wallMs: 1000, profile })
  let prefix = advance(arm.state, { kind: 'start', atMs: 200, responseHeld: false })
  for (let n = 0; n < 27; n++) {
    prefix = advance(prefix, { kind: 'fixation', atMs: prefix.fixationDueMs! })
    prefix = advance(prefix, { kind: 'onset', atMs: prefix.stimulusDueMs! })
    prefix = advance(prefix, { kind: 'resolve', atMs: prefix.resolutionDueMs! })
    prefix = advance(prefix, { kind: 'offset', atMs: prefix.resolutionDueMs! })
  }
  const snapshot = await store.saveSnapshot(arm, prefix, 0)
  const handle = store.authority.handle(arm, prefix)
  return { backend, store, arm, prefix, snapshot, handle }
}

it('independent: currentCheckpoint first arm-confirmation observes terminal replacement and retires only prefix', async()=>{
 const x=await setup(),entry=new ArrowsEntry(x.store)
 const internal=entry as unknown as {active:boolean;controller:AbortController;currentRequestId:string}
 internal.active=true;internal.controller=new AbortController();internal.currentRequestId=x.arm.requestId
 const later=advance(x.prefix,{kind:'invalidate',atMs:x.prefix.commands.at(-1)!.atMs+1,reason:'technical'})
 const remote=new ArrowsStore({read:()=>x.backend.read(),change:work=>x.backend.change(work)},x.backend.root.installationId)
 await remote.saveSnapshot(x.arm,later,1)
 const other=x.store.authority.handle(x.arm,later)
 const target=entry.authority(x.arm,x.prefix,x.snapshot.revision)
 await expect(entry.currentCheckpoint(x.arm,target)).rejects.toThrow('already terminal')
 expect(other.status().kind).toBe('current');expect(x.store.authority.handle(x.arm).status().kind).toBe('current')
 expect(x.handle.status().kind).toBe('retired')
})

for (const control of ['same-prefix','transient-read'] as const) it(`independent checkpoint precheck control ${control} preserves authority`,async()=>{
 const x=await setup(),entry=new ArrowsEntry(x.store)
 const internal=entry as unknown as {active:boolean;controller:AbortController;currentRequestId:string}
 internal.active=true;internal.controller=new AbortController();internal.currentRequestId=x.arm.requestId
 const target=entry.authority(x.arm,x.prefix,x.snapshot.revision)
 if(control==='transient-read'){x.backend.readNext=async()=>{throw Error('transient read')};await expect(entry.currentCheckpoint(x.arm,target)).rejects.toThrow('transient read')}
 else expect(await entry.currentCheckpoint(x.arm,target)).toEqual(x.snapshot)
 expect(x.handle.status().kind).toBe('current');expect(x.store.authority.handle(x.arm).status().kind).toBe('current')
})
