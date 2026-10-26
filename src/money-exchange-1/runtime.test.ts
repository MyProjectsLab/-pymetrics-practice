import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MoneyRuntime } from './runtime'
import { MoneyStore, newRoot } from './storage'
import type { Backend, Root } from './storage'

class MemoryBackend implements Backend {
  root:Root=newRoot()
  close() {}
  async read(){return structuredClone(this.root)}
  async change<T>(fn:(root:Root)=>T){const draft=structuredClone(this.root),result=fn(draft)
    this.root=draft;return structuredClone(result)}
}
function deferred<T>() { let resolve!:(value:T)=>void
  const promise=new Promise<T>(done=>{resolve=done});return {promise,resolve} }

describe('Money Exchange 1 runtime settlement',()=>{
  const originalNavigator=globalThis.navigator, originalMatchMedia=globalThis.matchMedia
  beforeEach(()=>{
    Object.defineProperty(globalThis,'navigator',{configurable:true,value:{locks:{request:async(
      _name:string,_options:unknown,work:(lock:object)=>unknown)=>work({})}}})
    Object.defineProperty(globalThis,'matchMedia',{configurable:true,value:()=>({matches:false})})
  })
  afterEach(()=>{vi.restoreAllMocks()
    Object.defineProperty(globalThis,'navigator',{configurable:true,value:originalNavigator})
    Object.defineProperty(globalThis,'matchMedia',{configurable:true,value:originalMatchMedia})})

  it('recovers the exact arm when the commit succeeded but delivery failed',async()=>{
    const backend=new MemoryBackend(),store=await MoneyStore.open(backend)
    const arm=store.arm.bind(store)
    vi.spyOn(store,'arm').mockImplementation(async input=>{await arm(input);throw Error('delivery lost')})
    vi.spyOn(MoneyStore,'open').mockResolvedValue(store)
    const runtime=new MoneyRuntime(),run=await runtime.start()
    expect(run.ordinal).toBe(1)
    expect(runtime.state.capable).toBe(true)
    expect(Object.keys(backend.root.runs)).toEqual([run.id])
    await runtime.withdraw('technical','test')
  })

  it('blocks replay after an unverified arm until a successful absent-root check',async()=>{
    const backend=new MemoryBackend(),store=await MoneyStore.open(backend)
    vi.spyOn(store,'arm').mockRejectedValueOnce(Error('delivery lost'))
    vi.spyOn(store,'inspect').mockRejectedValueOnce(Error('read failed'))
    vi.spyOn(MoneyStore,'open').mockResolvedValue(store)
    const runtime=new MoneyRuntime()
    await expect(runtime.start()).rejects.toThrow('read failed')
    expect(runtime.state.pendingArm).toBe(true)
    expect(runtime.state.error).toMatch(/could not be verified/)
    expect(await runtime.checkSaved()).toBeNull()
    expect(runtime.state.pendingArm).toBe(false)
    expect((await runtime.start()).ordinal).toBe(1)
    await runtime.withdraw('technical','test')
  })

  it('conserves captured exposure if it strengthens while settlement delivery is held',async()=>{
    const backend=new MemoryBackend(),store=await MoneyStore.open(backend)
    vi.spyOn(MoneyStore,'open').mockResolvedValue(store)
    const runtime=new MoneyRuntime(),run=await runtime.start()
    await runtime.transfer(500)
    const gate=deferred<void>(),interrupt=store.interrupt.bind(store)
    let first=true
    vi.spyOn(store,'interrupt').mockImplementation(async input=>{
      const value=await interrupt(input)
      if(first){first=false;await gate.promise}
      return value
    })
    const pending=runtime.withdraw('technical','owner_lost','possibly_revealed')
    await vi.waitFor(()=>expect(first).toBe(false))
    void runtime.withdraw('technical','owner_lost','captured_visible')
    gate.resolve()
    const settled=await pending
    expect(settled?.status).toBe('incomplete')
    expect(settled?.exposure).toBe('captured_visible')
    expect(settled?.report?.exposure).toBe('captured_visible')
    expect((await store.inspect(run.id))?.events.filter(e=>e.kind==='ended_incomplete')).toHaveLength(1)
  })

  it('does not publish an arm after Delete all retires its installation',async()=>{
    const backend=new MemoryBackend(),store=await MoneyStore.open(backend)
    vi.spyOn(MoneyStore,'open').mockResolvedValue(store)
    const gate=deferred<void>(),arm=store.arm.bind(store)
    vi.spyOn(store,'arm').mockImplementation(async input=>{const saved=await arm(input);await gate.promise;return saved})
    const runtime=new MoneyRuntime(),pending=runtime.start()
    await vi.waitFor(()=>expect(Object.keys(backend.root.runs)).toHaveLength(1))
    await store.deleteAll()
    gate.resolve()
    await expect(pending).rejects.toThrow()
    expect(runtime.state.capable).toBe(false)
    expect(runtime.state.run).toBeNull()
    expect(Object.keys(backend.root.runs)).toHaveLength(0)
  })

  it('settles a committed arm when Restart wins before its callback',async()=>{
    const backend=new MemoryBackend(),store=await MoneyStore.open(backend)
    vi.spyOn(MoneyStore,'open').mockResolvedValue(store)
    const gate=deferred<void>(),arm=store.arm.bind(store)
    vi.spyOn(store,'arm').mockImplementation(async input=>{const saved=await arm(input);await gate.promise;return saved})
    const runtime=new MoneyRuntime(),pending=runtime.start()
    await vi.waitFor(()=>expect(Object.keys(backend.root.runs)).toHaveLength(1))
    const settled=await runtime.withdraw('restart','candidate_restart')
    gate.resolve()
    await expect(pending).rejects.toThrow()
    expect(settled?.status).toBe('incomplete')
    expect(settled?.events.map(event=>event.kind)).toEqual(['form_armed','ended_incomplete'])
    expect(runtime.state.capable).toBe(false)
  })

  it('does not accept a late transfer callback after Restart settles the run',async()=>{
    const backend=new MemoryBackend(),store=await MoneyStore.open(backend)
    vi.spyOn(MoneyStore,'open').mockResolvedValue(store)
    const runtime=new MoneyRuntime(),run=await runtime.start()
    const gate=deferred<void>(),transfer=store.transfer.bind(store)
    vi.spyOn(store,'transfer').mockImplementation(async input=>{const saved=await transfer(input);await gate.promise;return saved})
    const pending=runtime.transfer(500)
    await vi.waitFor(()=>expect(backend.root.runs[run.id].events.some(e=>e.kind==='transfer_committed')).toBe(true))
    const settled=await runtime.withdraw('restart','candidate_restart')
    gate.resolve()
    await expect(pending).rejects.toThrow('withdrawn')
    expect(settled?.status).toBe('incomplete')
    expect((await store.inspect(run.id))?.events.map(e=>e.kind)).toEqual([
      'form_armed','transfer_committed','ended_incomplete'])
  })

  it('keeps a committed terminal when Close wins its callback race',async()=>{
    const backend=new MemoryBackend(),store=await MoneyStore.open(backend)
    vi.spyOn(MoneyStore,'open').mockResolvedValue(store)
    const runtime=new MoneyRuntime(),run=await runtime.start()
    await runtime.transfer(500);await runtime.markPossible();runtime.noteFrameConfirmed()
    await runtime.capture();await runtime.returnShown()
    const gate=deferred<void>(),complete=store.complete.bind(store)
    vi.spyOn(store,'complete').mockImplementation(async input=>{const saved=await complete(input);await gate.promise;return saved})
    const pending=runtime.complete(7)
    await vi.waitFor(()=>expect(backend.root.runs[run.id].status).toBe('complete'))
    const settled=await runtime.withdraw('close','candidate_close')
    gate.resolve()
    await expect(pending).rejects.toThrow('withdrawn')
    expect(settled?.status).toBe('complete')
    expect(settled?.report?.rating).toBe(7)
    expect((await store.inspect(run.id))?.events.at(-1)?.kind).toBe('completed')
  })

  it('rejects a terminal whose installation was replaced before its write',async()=>{
    const backend=new MemoryBackend(),store=await MoneyStore.open(backend)
    vi.spyOn(MoneyStore,'open').mockResolvedValue(store)
    const runtime=new MoneyRuntime();await runtime.start()
    await runtime.transfer(500);await runtime.markPossible();runtime.noteFrameConfirmed()
    await runtime.capture();await runtime.returnShown()
    const gate=deferred<void>(),entered=deferred<void>(),complete=store.complete.bind(store)
    vi.spyOn(store,'complete').mockImplementation(async input=>{entered.resolve();await gate.promise;return complete(input)})
    const pending=runtime.complete(7)
    await entered.promise
    await store.deleteAll()
    gate.resolve()
    await expect(pending).rejects.toThrow()
    expect(runtime.state.capable).toBe(false)
    expect(runtime.state.run).toBeNull()
    expect(Object.keys(backend.root.runs)).toHaveLength(0)
  })

  it('uses the accepted transfer request after delivery fails without a second transfer',async()=>{
    const backend=new MemoryBackend(),store=await MoneyStore.open(backend)
    vi.spyOn(MoneyStore,'open').mockResolvedValue(store)
    const runtime=new MoneyRuntime(),run=await runtime.start()
    const transfer=store.transfer.bind(store)
    vi.spyOn(store,'transfer').mockImplementationOnce(async input=>{await transfer(input);throw Error('callback lost')})
    const saved=await runtime.transfer(500)
    expect(saved.events.map(e=>e.kind)).toEqual(['form_armed','transfer_committed'])
    expect((await store.inspect(run.id))?.events.filter(e=>e.kind==='transfer_committed')).toHaveLength(1)
    await runtime.withdraw('technical','test')
  })

  it('conserves visible return evidence and rejects a held return write after Restart',async()=>{
    const backend=new MemoryBackend(),store=await MoneyStore.open(backend)
    vi.spyOn(MoneyStore,'open').mockResolvedValue(store)
    const runtime=new MoneyRuntime(),run=await runtime.start()
    await runtime.transfer(500);await runtime.markPossible();runtime.noteFrameConfirmed();await runtime.capture()
    const gate=deferred<void>(),entered=deferred<void>(),save=store.saveReturn.bind(store)
    vi.spyOn(store,'saveReturn').mockImplementation(async input=>{entered.resolve();await gate.promise;return save(input)})
    const pending=runtime.returnShown()
    await entered.promise
    const settled=await runtime.withdraw('restart','candidate_restart','captured_visible')
    gate.resolve()
    await expect(pending).rejects.toThrow()
    expect(settled?.status).toBe('incomplete')
    expect(settled?.exposure).toBe('captured_visible')
    expect(settled?.report?.returnedCents).toBeNull()
    expect((await store.inspect(run.id))?.events.map(e=>e.kind)).toEqual([
      'form_armed','transfer_committed','ended_incomplete'])
  })

  it('recovers the exact completed rating after its success callback is lost',async()=>{
    const backend=new MemoryBackend(),store=await MoneyStore.open(backend)
    vi.spyOn(MoneyStore,'open').mockResolvedValue(store)
    const runtime=new MoneyRuntime(),run=await runtime.start()
    await runtime.transfer(500);await runtime.markPossible();runtime.noteFrameConfirmed()
    await runtime.capture();await runtime.returnShown()
    const complete=store.complete.bind(store)
    vi.spyOn(store,'complete').mockImplementationOnce(async input=>{await complete(input);throw Error('delivery lost')})
    const saved=await runtime.complete(7)
    expect(saved.status).toBe('complete')
    expect(saved.report?.rating).toBe(7)
    expect((await store.inspect(run.id))?.events.map(e=>e.kind)).toEqual([
      'form_armed','transfer_committed','return_presented','fairness_committed','completed'])
    expect(runtime.state.capable).toBe(false)
  })

  it('keeps a rejected terminal retryable with its original rating and no saved claim',async()=>{
    const backend=new MemoryBackend(),store=await MoneyStore.open(backend)
    vi.spyOn(MoneyStore,'open').mockResolvedValue(store)
    const runtime=new MoneyRuntime(),run=await runtime.start()
    await runtime.transfer(500);await runtime.markPossible();runtime.noteFrameConfirmed()
    await runtime.capture();await runtime.returnShown()
    vi.spyOn(store,'complete').mockRejectedValueOnce(Error('transaction failed'))
    await expect(runtime.complete(7)).rejects.toThrow('transaction failed')
    expect(runtime.state.capable).toBe(true)
    expect(runtime.state.error).toMatch(/unconfirmed/)
    expect((await store.inspect(run.id))?.status).toBe('active')
    const saved=await runtime.complete(7)
    expect(saved.report?.rating).toBe(7)
    expect((await store.inspect(run.id))?.events.filter(e=>e.kind==='completed')).toHaveLength(1)
  })

  it('ignores a delayed replacement notice from a different installation',async()=>{
    const backend=new MemoryBackend(),store=await MoneyStore.open(backend)
    vi.spyOn(MoneyStore,'open').mockResolvedValue(store)
    const runtime=new MoneyRuntime(),run=await runtime.start()
    window.dispatchEvent(new StorageEvent('storage',{
      key:'assessment-practice-money-exchange-1-authority-v1',
      newValue:JSON.stringify({type:'replaced',installationId:crypto.randomUUID()}),
    }))
    expect(runtime.state.capable).toBe(true)
    expect(runtime.state.run?.id).toBe(run.id)
    expect((await runtime.transfer(500)).events.at(-1)?.kind).toBe('transfer_committed')
    await runtime.withdraw('technical','test')
  })
})
