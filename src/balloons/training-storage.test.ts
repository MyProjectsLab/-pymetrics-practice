import { beforeAll, expect, it } from 'vitest'
import { webcrypto } from 'node:crypto'
import { loadScoredManifests } from './manifests'
import { loadDrillManifests } from './drill-manifests'
import { BalloonsStore, WriteFailure } from './storage'
import type { Backend, Root } from './storage'
import { baseline } from './training-test-support'
import { assignTraining, commitTrainingAction, pauseTraining, readTraining, restartInvalidTraining } from './training-storage'
import type { SavedTrainingView, TrainingOwner } from './training-storage'

beforeAll(async () => { Object.defineProperty(globalThis,'crypto',{value:webcrypto,configurable:true}); await loadScoredManifests(); await loadDrillManifests() })
const timestamp = (n: number) => ({ wallTimeMs: 200000+n, monotonicMs: n, clockEpochId: 'adapter' })
class MemoryBackend implements Backend {
  root: Root
  fail = false
  committedButDeliveryLost = false
  deliveryHold: Promise<void> | null = null
  constructor(root: Root) { this.root = structuredClone(root) }
  async read() { return structuredClone(this.root) }
  async change<T>(operation: (root: Root) => T): Promise<T> {
    const copy = structuredClone(this.root)
    const result = operation(copy)
    if (this.fail) { this.fail = false; throw new WriteFailure('injected abort') }
    copy.revision++
    this.root = copy
    if (this.deliveryHold) { const hold = this.deliveryHold; this.deliveryHold = null; await hold }
    if (this.committedButDeliveryLost) { this.committedButDeliveryLost = false; throw new Error('injected callback timeout') }
    return structuredClone(result)
  }
}
const owners = new WeakMap<BalloonsStore, TrainingOwner>()
function own(store: BalloonsStore) {
  let value = owners.get(store)
  if (!value) { value = { id: crypto.randomUUID(), token: null, live: true, release() { this.live = false } }; owners.set(store, value) }
  return value
}
function setup() { const backend = new MemoryBackend(baseline('BL1',()=>0)); return { backend, store: new BalloonsStore(backend,'install') } }
async function act(store: BalloonsStore, saved: SavedTrainingView, kind: 'start' | 'collect' | 'next' | 'demo_next' | 'invalidate' | 'resume' | 'pump' | 'pause', n: number) {
  return commitTrainingAction(store,own(store),saved.chain.recommendation.chainId,saved.attempt.header.attemptId,saved.attempt,kind,'mouse',timestamp(n),kind==='invalidate'?'authority_changed':undefined)
}
async function complete(store: BalloonsStore, saved: SavedTrainingView) {
  let n=6
  if(saved.attempt.snapshot.phase==='demo') { saved=await act(store,saved,'demo_next',n++); saved=await act(store,saved,'demo_next',n++) }
  saved=await act(store,saved,'start',n++)
  while(saved.attempt.snapshot.phase!=='completed') saved=await act(store,saved,saved.attempt.snapshot.phase==='active'?'collect':'next',n++)
  return saved
}

it('atomically locks the first saved completion, retains every committed journal action, and reopens the same chain',async()=>{
  const {backend,store}=setup()
  let saved=await assignTraining(store,own(store),'base',timestamp(1))
  const id=saved.attempt.header.attemptId, chainId=saved.chain.recommendation.chainId
  saved=await act(store,saved,'start',2)
  const first=await act(store,saved,'collect',3)
  expect(first.attempt.snapshot.results).toHaveLength(1)
  const reloaded=new BalloonsStore(backend,'install')
  saved=await assignTraining(reloaded,own(reloaded),'base',timestamp(4))
  expect(saved.attempt.header.attemptId).toBe(id)
  expect(saved.attempt.journal.slice(0, -1)).toEqual(first.attempt.journal)
  expect(saved.attempt.snapshot.phase).toBe('paused')
  await expect(act(store,first,'next',4)).rejects.toThrow('ownership')
  saved=await act(reloaded,saved,'resume',4)
  saved=await act(reloaded,saved,'next',5)
  let n=6
  while(saved.attempt.snapshot.phase!=='completed') saved=await act(reloaded,saved,saved.attempt.snapshot.phase==='active'?'collect':'next',n++)
  expect(saved.eligible).toBe(true)
  expect(saved.chain.firstCompletedDrillId).toBe(id)
  const journal=structuredClone(saved.attempt.journal)
  const repeated=await assignTraining(reloaded,own(reloaded),'base',timestamp(n++))
  expect(repeated.attempt.header.attemptId).toBe(id)
  expect(repeated.attempt.journal).toEqual(journal)
  expect(repeated.chain.firstCompletedDrillId).toBe(id)
  expect((await readTraining(reloaded,chainId,id)).eligible).toBe(true)
  await expect(act(reloaded,repeated,'collect',n)).rejects.toThrow()
  expect(backend.root.training!.attempts[id].journal).toEqual(journal)
})

it('rejects a delayed completion callback after baseline deletion rather than returning stale eligibility',async()=>{
  const {backend,store}=setup()
  let saved=await assignTraining(store,own(store),'base',timestamp(1)), n=2
  saved=await act(store,saved,'start',n++)
  while(saved.attempt.snapshot.results.length<17) saved=await act(store,saved,saved.attempt.snapshot.phase==='active'?'collect':'next',n++)
  saved=await act(store,saved,'next',n++)
  let release!:()=>void
  backend.deliveryHold=new Promise<void>(resolve=>{release=resolve})
  const pending=act(store,saved,'collect',n++)
  expect(Object.values(backend.root.training!.attempts)[0].snapshot.phase).toBe('completed')
  expect(Object.values(backend.root.training!.chains)[0].firstCompletedDrillId).toBe(saved.attempt.header.attemptId)
  delete backend.root.records.base
  backend.root.tombstones.base={sessionId:'base',chainId:'chain',formId:'BL1',exposure:'form_exposed',deletedAtMs:1}
  release()
  await expect(pending).rejects.toThrow('baseline')
})

it('withholds failed writes, reconciles committed callback loss, and rejects stale cross-tab actions',async()=>{
  const {backend,store}=setup()
  const prepared=await assignTraining(store,own(store),'base',timestamp(1))
  backend.fail=true
  await expect(act(store,prepared,'start',2)).rejects.toThrow('injected abort')
  expect((await readTraining(store,'chain',prepared.attempt.header.attemptId)).attempt.snapshot.phase).toBe('ready')
  backend.committedButDeliveryLost=true
  await expect(act(store,prepared,'start',3)).rejects.toThrow('callback timeout')
  const recovered=await readTraining(store,'chain',prepared.attempt.header.attemptId)
  expect(recovered.attempt.snapshot.phase).toBe('active')
  await expect(act(store,prepared,'start',4)).rejects.toThrow('Drill changed in another tab')
  expect((await readTraining(store,'chain',prepared.attempt.header.attemptId)).attempt.journal).toEqual(recovered.attempt.journal)
})

it('withdraws eligibility on baseline deletion and replacement installation, and restarts invalid attempts at round one',async()=>{
  const {backend,store}=setup()
  let saved=await assignTraining(store,own(store),'base',timestamp(1))
  saved=await act(store,saved,'start',2)
  saved=await act(store,saved,'collect',3)
  saved=await act(store,saved,'invalidate',4)
  expect(saved.attempt.snapshot.phase).toBe('invalid')
  expect(saved.eligible).toBe(false)
  const invalidId=saved.attempt.header.attemptId
  const restarted=await restartInvalidTraining(store,own(store),'chain',invalidId,timestamp(5))
  expect(restarted.attempt.snapshot.round).toBe(1)
  expect(restarted.attempt.snapshot.results).toHaveLength(0)
  expect(restarted.attempt.header.familiar).toBe(true)
  expect(restarted.attempt.header.manifestId).toBe(saved.attempt.header.manifestId)
  saved=await complete(store,restarted)
  expect(saved.eligible).toBe(true)
  delete backend.root.records.base
  backend.root.tombstones.base={sessionId:'base',chainId:'chain',formId:'BL1',exposure:'form_exposed',deletedAtMs:1}
  await expect(readTraining(store,'chain',saved.attempt.header.attemptId)).rejects.toThrow('baseline')
  backend.root.installationId='replacement'
  await expect(readTraining(store,'chain',saved.attempt.header.attemptId)).rejects.toThrow()
  await expect(assignTraining(store,own(store),'base',timestamp(500))).rejects.toThrow('replaced')
})

it('Delete all replaces the entire root and fences every old training mutation',async()=>{
  const {backend,store}=setup(), owner=own(store)
  const saved=await complete(store,await assignTraining(store,owner,'base',timestamp(1)))
  await store.deleteAll()
  expect(Object.keys(backend.root).sort()).toEqual(['version','installationId','revision','generation','owner','records','tombstones'].sort())
  expect(backend.root).toMatchObject({revision:1,generation:0,owner:null,records:{},tombstones:{}})
  expect(backend.root.installationId).not.toBe('install')
  const replacement=structuredClone(backend.root)
  await expect(act(store,saved,'collect',100)).rejects.toThrow('replaced')
  await expect(pauseTraining(store,owner,timestamp(101))).rejects.toThrow('replaced')
  await expect(assignTraining(store,owner,'base',timestamp(102))).rejects.toThrow('replaced')
  await expect(restartInvalidTraining(store,owner,'chain',saved.attempt.header.attemptId,timestamp(103))).rejects.toThrow('replaced')
  expect(backend.root).toEqual(replacement)
})

it.each(['id','generation','sessionId','released'] as const)('fresh polling cannot repair a lost %s owner capability',async(field)=>{
  const {backend,store}=setup(), owner=own(store)
  let saved=await assignTraining(store,owner,'base',timestamp(1));saved=await act(store,saved,'start',2)
  if(field==='released')owner.release()
  else if(field==='generation')backend.root.generation++
  else backend.root.owner![field]='another'
  const read=await readTraining(store,'chain',saved.attempt.header.attemptId)
  const before=structuredClone(backend.root)
  await expect(act(store,read,'pump',3)).rejects.toThrow('ownership')
  await expect(readTraining(store,'chain',read.attempt.header.attemptId,owner)).rejects.toThrow('ownership')
  await expect(pauseTraining(store,owner,timestamp(4))).rejects.toThrow('ownership')
  await expect(assignTraining(store,owner,'base',timestamp(5))).rejects.toThrow('ownership')
  expect(backend.root).toEqual(before)
})

it('recovery fences the old owner and pauses the identical committed round; pause is idempotent',async()=>{
  const {backend,store}=setup();let saved=await assignTraining(store,own(store),'base',timestamp(1))
  saved=await act(store,saved,'start',2);saved=await act(store,saved,'pump',3)
  const old=saved, second=new BalloonsStore(backend,'install'), replacement=own(second)
  saved=await assignTraining(second,replacement,'base',timestamp(4))
  expect(saved.attempt.snapshot).toMatchObject({...old.attempt.snapshot,phase:'paused',resumePhase:'active',revision:old.attempt.snapshot.revision+1,nextActionId:old.attempt.snapshot.nextActionId+1})
  const paused=await pauseTraining(second,replacement,timestamp(5))
  expect(paused.attempt).toEqual(saved.attempt)
  await expect(act(store,await readTraining(store,'chain',old.attempt.header.attemptId),'pump',6)).rejects.toThrow('ownership')
  saved=await act(second,saved,'resume',7)
  expect(saved.attempt.snapshot.currentCents).toBe(old.attempt.snapshot.currentCents)
  expect(saved.attempt.journal.at(-1)!.command!.ownershipGeneration).toBe(replacement.token!.generation)
})

it('repeated invalid restart, including after completion, creates only one successor and lock',async()=>{
  const {backend,store}=setup();let saved=await assignTraining(store,own(store),'base',timestamp(1))
  saved=await act(store,saved,'start',2);saved=await act(store,saved,'invalidate',3)
  const invalid=saved.attempt.header.attemptId
  const first=await restartInvalidTraining(store,own(store),'chain',invalid,timestamp(4))
  for(let i=5;i<9;i++)expect((await restartInvalidTraining(store,own(store),'chain',invalid,timestamp(i))).attempt.header.attemptId).toBe(first.attempt.header.attemptId)
  const done=await complete(store,first)
  expect((await restartInvalidTraining(store,own(store),'chain',invalid,timestamp(100))).attempt).toEqual(done.attempt)
  expect(Object.keys(backend.root.training!.attempts)).toHaveLength(2)
  expect(done.chain.firstCompletedDrillId).toBe(first.attempt.header.attemptId)
})

it.each([false,true])('pause reconciles pending action with committed=%s and ignores late delivery',async(committed)=>{
  const {backend,store}=setup();let saved=await assignTraining(store,own(store),'base',timestamp(1));saved=await act(store,saved,'start',2)
  let release!:()=>void
  if(committed)backend.deliveryHold=new Promise<void>(r=>{release=r})
  else backend.fail=true
  const action=act(store,saved,'pump',3)
  if(!committed)await expect(action).rejects.toThrow('abort')
  const paused=await pauseTraining(store,own(store),timestamp(4))
  expect(paused.attempt.snapshot.phase).toBe('paused')
  expect(paused.attempt.snapshot.successfulPumps).toBe(Number(committed))
  const durable=structuredClone(backend.root)
  if(committed){release();expect((await action).attempt).toEqual(paused.attempt)}
  expect(backend.root).toEqual(durable)
  await expect(act(store,saved,'collect',5)).rejects.toThrow('another tab')
})

it('failed assignment and restart transactions do not publish phantom tokens',async()=>{
  const {backend,store}=setup(), owner=own(store);backend.fail=true
  await expect(assignTraining(store,owner,'base',timestamp(1))).rejects.toThrow('abort')
  expect(owner.token).toBeNull()
  let saved=await assignTraining(store,owner,'base',timestamp(2));saved=await act(store,saved,'invalidate',3)
  const token=structuredClone(owner.token);backend.fail=true
  await expect(restartInvalidTraining(store,owner,'chain',saved.attempt.header.attemptId,timestamp(4))).rejects.toThrow('abort')
  expect(owner.token).toEqual(token)
  expect((await restartInvalidTraining(store,owner,'chain',saved.attempt.header.attemptId,timestamp(5))).attempt.snapshot.phase).toBe('ready')
})

it.each(['ready','started','completed'] as const)('familiarity spans chains after %s but resume and completion stay in their chain',async(phase)=>{
  const {backend,store}=setup();let first=await assignTraining(store,own(store),'base',timestamp(1))
  if(phase==='started')first=await act(store,first,'start',2)
  if(phase==='completed')first=await complete(store,first)
  const original=structuredClone(backend.root.training!)
  const {createRecord,advance}=await import('./durable')
  const record=baseline('BL2',()=>0).records.base
  let second=createRecord({...record.header,identity:{...record.header.identity,sessionId:'base2',chainId:'chain2'}})
  for(const e of record.journal.slice(1))second=advance(second,e.command!,{wallTimeMs:e.wallTimeMs,monotonicMs:e.monotonicMs,clockEpochId:e.clockEpochId},e.ownershipGeneration)
  backend.root.records.base2=second
  own(store).release()
  const other=new BalloonsStore(backend,'install'), saved=await assignTraining(other,own(other),'base2',timestamp(100))
  expect(saved.attempt.header.familiar).toBe(phase!=='ready')
  expect(saved.attempt.header.priorAttemptIds).toEqual(phase==='ready'?[]:[first.attempt.header.attemptId])
  expect(saved.chain.firstCompletedDrillId).toBeNull()
  expect(saved.attempt.snapshot.phase).toBe('ready')
  expect(backend.root.training!.chains.chain).toEqual(original.chains.chain)
  expect(backend.root.training!.attempts[first.attempt.header.attemptId]).toEqual(first.attempt)
})

it('an invalid restart with held delivery cannot create a second live successor',async()=>{
  const {backend,store}=setup(), owner=own(store)
  let saved=await assignTraining(store,owner,'base',timestamp(1));saved=await act(store,saved,'invalidate',2)
  let release!:()=>void;backend.deliveryHold=new Promise<void>(r=>{release=r})
  const first=restartInvalidTraining(store,owner,'chain',saved.attempt.header.attemptId,timestamp(3))
  // Inventory preparation is asynchronous; wait for the actual commit boundary.
  while(Object.keys(backend.root.training!.attempts).length===1)await new Promise(r=>setTimeout(r,0))
  await expect(restartInvalidTraining(store,owner,'chain',saved.attempt.header.attemptId,timestamp(4))).rejects.toThrow('ownership')
  release();const next=await first
  expect(Object.values(backend.root.training!.attempts).filter(a=>!['completed','invalid'].includes(a.snapshot.phase))).toHaveLength(1)
  expect((await restartInvalidTraining(store,owner,'chain',saved.attempt.header.attemptId,timestamp(5))).attempt.header.attemptId).toBe(next.attempt.header.attemptId)
})
