import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MoneyStore, newRoot } from './storage'
import type { Backend, Root } from './storage'

class MemoryBackend implements Backend {
  root: Root = newRoot()
  close() {}
  async read() { return structuredClone(this.root) }
  async change<T>(fn: (root: Root) => T) {
    const draft = structuredClone(this.root)
    const result = fn(draft)
    this.root = draft
    return structuredClone(result)
  }
}
const context = {route:'standalone' as const,device:'desktop_class' as const,
  input:'fine_pointer_capable' as const,reducedMotion:false,highContrast:false}

describe('Money Exchange 1 durable authority', () => {
  const originalNavigator = globalThis.navigator
  beforeEach(() => {
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {
      locks: { request: async (_name: string, _options: unknown, work: (lock: object) => unknown) => work({}) },
    } })
  })
  afterEach(() => Object.defineProperty(globalThis, 'navigator', { configurable: true, value: originalNavigator }))

  it('keeps a captured return after an interrupted save and exact-request retry', async () => {
    const backend = new MemoryBackend(), store = await MoneyStore.open(backend)
    const arm = { id: 'arm', runId: 'run', documentId: 'doc', at: 1,context }
    expect((await store.arm(arm)).ordinal).toBe(1)
    expect((await store.arm(arm)).ordinal).toBe(1)
    await store.transfer({ id: 'transfer', runId: 'run', documentId: 'doc', expectedRevision:1, sentCents: 500, at: 2 })
    await store.markPossible({ id: 'possible', runId: 'run', documentId: 'doc', expectedRevision:2, at: 3 })
    await store.capture({ id: 'capture', runId: 'run', documentId: 'doc', expectedRevision:3, at: 4 })
    const result = await store.interrupt({ id: 'end', runId: 'run', documentId: 'doc', at: 5,
      reason: 'candidate_restart', exposure: 'captured_visible' })
    expect(result.status).toBe('incomplete')
    expect(result.exposure).toBe('captured_visible')
    expect(result.report?.returnedCents).toBeNull()
    expect((await store.interrupt({ id: 'end', runId: 'run', documentId: 'doc', at: 5,
      reason: 'candidate_restart', exposure: 'captured_visible' })).events).toEqual(result.events)
    await expect(store.saveReturn({ id: 'late', runId: 'run', documentId: 'doc', expectedRevision:5, at: 6 })).rejects.toThrow()
    store.close()
  })

  it('does not revive a deleted attempt or change its allocated ordinal', async () => {
    const backend = new MemoryBackend(), store = await MoneyStore.open(backend)
    await store.arm({ id: 'arm1', runId: 'run1', documentId: 'doc', at: 1,context })
    await store.interrupt({ id: 'end1', runId: 'run1', documentId: 'doc', at: 2,
      reason: 'close', exposure: 'not_revealed' })
    await store.deleteOne('run1')
    await expect(store.arm({ id: 'arm1', runId: 'run1', documentId: 'doc', at: 1,context })).rejects.toThrow()
    expect((await store.arm({ id: 'arm2', runId: 'run2', documentId: 'doc', at: 3,context })).ordinal).toBe(2)
    expect(backend.root.tombstones.run1).toBe(true)
    store.close()
  })

  it('upgrades an already saved interruption when return pixels were captured later', async () => {
    const backend = new MemoryBackend(), store = await MoneyStore.open(backend)
    await store.arm({ id: 'arm', runId: 'run', documentId: 'doc', at: 1,context })
    await store.transfer({ id: 'transfer', runId: 'run', documentId: 'doc', expectedRevision:1, sentCents: 500, at: 2 })
    const first = await store.interrupt({ id: 'end', runId: 'run', documentId: 'doc', at: 3,
      reason: 'owner_lost', exposure: 'possibly_revealed' })
    expect(first.report?.exposure).toBe('possibly_revealed')
    const second = await store.interrupt({ id: 'end_captured_visible', runId: 'run', documentId: 'doc', at: 3,
      reason: 'owner_lost', exposure: 'captured_visible' })
    expect(second.report?.exposure).toBe('captured_visible')
    expect(second.events.filter(event => event.kind === 'ended_incomplete')).toHaveLength(1)
    expect((await store.interrupt({ id: 'end', runId: 'run', documentId: 'doc', at: 3,
      reason: 'owner_lost', exposure: 'possibly_revealed' })).report?.exposure).toBe('captured_visible')
    store.close()
  })

  it('refuses a present corrupt root rather than resetting it', async () => {
    const backend = new MemoryBackend()
    backend.root = undefined as unknown as Root
    await expect(MoneyStore.open(backend)).rejects.toThrow()
  })

  it('confirms individual and full deletion after a lost success callback',async()=>{
    const backend=new MemoryBackend(),store=await MoneyStore.open(backend)
    await store.arm({id:'arm',runId:'run',documentId:'doc',at:1,context})
    const change=backend.change.bind(backend)
    let lose=true
    const spy=vi.spyOn(backend,'change').mockImplementation(async fn=>{
      const value=await change(fn)
      if(lose){lose=false;throw Error('delivery lost')}
      return value
    })
    await store.deleteOne('run')
    expect(backend.root.tombstones.run).toBe(true)
    await store.deleteOne('run')
    spy.mockRestore()
    const installation=backend.root.installationId
    const spyAll=vi.spyOn(backend,'change').mockImplementation(async fn=>{
      await change(fn);throw Error('delivery lost after commit')
    })
    await store.deleteAll()
    expect(backend.root.installationId).not.toBe(installation)
    expect(backend.root.nextOrdinal).toBe(1)
    spyAll.mockRestore();store.close()
  })

  it('rejects a new action against an outdated run revision while exact retry remains idempotent',async()=>{
    const backend=new MemoryBackend(),store=await MoneyStore.open(backend)
    await store.arm({id:'arm',runId:'run',documentId:'doc',at:1,context})
    const transfer={id:'transfer',runId:'run',documentId:'doc',expectedRevision:1,sentCents:500,at:2}
    const saved=await store.transfer(transfer)
    expect(saved.revision).toBe(2)
    await expect(store.markPossible({id:'stale',runId:'run',documentId:'doc',expectedRevision:1,at:3}))
      .rejects.toThrow('stale possible revision')
    expect((await store.transfer(transfer)).events.filter(e=>e.kind==='transfer_committed')).toHaveLength(1)
    expect((await store.inspect('run'))?.revision).toBe(2)
    store.close()
  })

  it('delivers replacement to every subscriber when the first subscriber closes the old store',async()=>{
    const backend=new MemoryBackend(),store=await MoneyStore.open(backend)
    let laterNotice=0
    store.subscribe(notice=>{if(notice.type==='replaced')store.close()})
    store.subscribe(notice=>{if(notice.type==='replaced')laterNotice++})
    await store.deleteAll()
    expect(laterNotice).toBe(1)
    expect(backend.root.nextOrdinal).toBe(1)
    expect(Object.keys(backend.root.runs)).toHaveLength(0)
  })
})
