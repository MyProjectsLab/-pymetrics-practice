import { Attempt } from '../assessment-usage/client'
import type { Exposure, PlayContext, Run } from './core'
import { acquireMoneyOwner, MoneyStore } from './storage'
import type { Root } from './storage'
import type { MockJourneyContext } from '../mock/journey-context'

type Intent = 'restart' | 'close' | 'technical'
type Listener = () => void
function delay(ms: number) { return new Promise<void>(resolve => setTimeout(resolve, ms)) }
function stronger(a: Exposure, b: Exposure): Exposure {
  const rank = { not_revealed: 0, possibly_revealed: 1, captured_visible: 2 }
  return rank[a] >= rank[b] ? a : b
}
function playContext():PlayContext {
  const coarse=matchMedia('(pointer: coarse)').matches
  return {route:'standalone',device:coarse?'touch_capable':'desktop_class',
    input:coarse?'coarse_pointer_capable':'fine_pointer_capable',
    reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,
    highContrast:matchMedia('(forced-colors: active)').matches}
}
export class MoneyRuntime {
  private usage = new Attempt('money_1')
  private store: MoneyStore | null = null
  private opening: Promise<MoneyStore> | null = null
  private releaseOwner: (() => void) | null = null
  private listeners = new Set<Listener>()
  private unsubscribeStore: (() => void) | null = null
  private run: Run | null = null
  private documentId = crypto.randomUUID()
  private capability = false
  private exposure: Exposure = 'not_revealed'
  private settlementId: string | null = null
  private settlementInput: { id: string; runId: string; documentId: string; at: number; reason: string; exposure: Exposure } | null = null
  private settlement: Promise<Run | null> | null = null
  private pendingArm: { id: string; runId: string; documentId: string; at: number; context:PlayContext } | null = null
  private starting = false
  private pendingIds = new Map<string, { id: string; payload: string; at: number }>()
  private lastError: string | null = null
  private viewEpoch = 0
  subscribe(fn: Listener) { this.listeners.add(fn); return () => { this.listeners.delete(fn) } }
  noteFrameConfirmed() { if(this.capability && this.run?.status==='active')
    this.exposure=stronger(this.exposure,'captured_visible') }
  private emit() { this.listeners.forEach(fn => fn()) }
  get state() { return { run: this.run, capable: this.capability, exposure: this.exposure,
    error: this.lastError, settling: this.settlement !== null, pendingArm: this.pendingArm !== null || this.starting,
    viewEpoch: this.viewEpoch } }
  private retireView() { this.viewEpoch++; this.emit(); return this.viewEpoch }
  private requestId(kind: string, payload: unknown) {
    const bytes = JSON.stringify(payload), old = this.pendingIds.get(kind)
    if (old) { if (old.payload !== bytes) throw Error('Resolve the accepted request before changing it'); return old }
    const value = { id: crypto.randomUUID(), payload: bytes, at: Date.now() }
    this.pendingIds.set(kind,value); return value
  }
  private clearRequest(kind: string) { this.pendingIds.delete(kind) }
  private release() { this.releaseOwner?.(); this.releaseOwner = null }
  private mockStorage=false
  private retainedOnly=false
  async open(mockStorage=false,retainedOnly=false) {
    this.mockStorage ||= mockStorage
    this.retainedOnly ||= retainedOnly
    if (this.store) return this.store
    if (this.opening) return this.opening
    this.opening = (this.mockStorage?MoneyStore.openForMock(undefined,!this.retainedOnly):MoneyStore.open()).then(store => {
      this.store = store
      this.unsubscribeStore = store.subscribe(notice => {
        if (notice.installationId !== store.installationId) return
        if (notice.type === 'deleted' && notice.runId === this.run?.id || notice.type === 'replaced') {
          this.capability = false; this.run = null; this.release(); this.retireView()
          this.pendingIds.clear()
          if (notice.type === 'replaced') {
            this.unsubscribeStore?.(); this.unsubscribeStore = null
            store.close(); if (this.store === store) this.store = null
          }
        } else this.emit()
      })
      return store
    }).finally(() => { this.opening = null })
    return this.opening
  }
  async root() { return (await this.open()).read() }
  async publish(id: string | null, fn: (root: Root) => void) { return (await this.open()).publishChecked(id, fn) }
  async recoverExisting() {
    const store=await this.open(), root=await store.read()
    const old=Object.values(root.runs).find(r=>r.status==='active')
    if (!old) return null
    const release=await acquireMoneyOwner(()=>undefined)
    try {
      const exposure:Exposure=old.events.some(e=>e.kind==='transfer_committed') ?
        stronger(old.exposure,'possibly_revealed') : old.exposure
      const result=await store.interrupt({id:crypto.randomUUID(),runId:old.id,documentId:old.documentId,
        at:Date.now(),reason:'recovered_after_interruption',exposure})
      this.lastError=null;this.emit();return result
    } finally { release() }
  }
  async start(mock?: MockJourneyContext) {
    if (this.starting) throw Error('Start is already being checked')
    this.starting=true
    this.usage.begin(mock ? 'mock' : 'practice')
    const epoch=this.viewEpoch
    try {
    if (this.settlement) await this.settlement
    if (this.run?.status === 'active' || this.capability) throw Error('Resolve the previous exchange first')
    const store = await this.open()
    if(epoch!==this.viewEpoch) throw Error('Start was canceled')
    if (!this.releaseOwner) {
      const controller = new AbortController()
      this.releaseOwner = await acquireMoneyOwner(() => {
        if (this.run?.status === 'active') void this.withdraw('technical', 'owner_lost', this.exposure)
      }, controller.signal)
    }
    try {
      const root = await store.read()
      if(epoch!==this.viewEpoch) throw Error('Start was canceled')
      const old = Object.values(root.runs).find(r => r.status === 'active')
      if (old && old.id !== this.pendingArm?.runId) throw Error('An earlier exchange needs review before a new form can start')
      const input = this.pendingArm ?? { id: crypto.randomUUID(), runId: crypto.randomUUID(), documentId: this.documentId,
        at: Date.now(),context:{...playContext(),...(mock?{route:'mock_game_10' as const,mockRunId:mock.launchId}:{})} }
      this.pendingArm = input
      if(mock) await mock.beforeArm({requestId:input.id,attemptId:input.runId,originTicketId:null,
        installationId:store.installationId,generation:null,requestKind:'arm',nativeIdentity:[{key:'runId',value:input.runId},{key:'documentId',value:input.documentId}]})
      if(epoch!==this.viewEpoch || !this.releaseOwner || this.pendingArm!==input) throw Error('Start was canceled')
      let run: Run
      try { run = await store.arm(input) }
      catch (reason) {
        const checked = await store.inspect(input.runId)
        if (!checked) { this.pendingArm = null; throw reason }
        run = checked
      }
      if (run.status !== 'active' || run.documentId !== this.documentId) throw Error('New exchange authority changed')
      this.usage.admit(run.id)
      await store.publishChecked(run.id,root=>{
        const current=root.runs[run.id]
        if(epoch!==this.viewEpoch || !current || current.status!=='active' ||
          current.documentId!==this.documentId || current.armRequestId!==input.id)
          throw Error('New exchange authority changed')
        this.pendingArm = null;this.run=current;this.exposure=current.exposure
        this.capability=true;this.lastError=null;this.retireView()
      })
      if(!this.capability || this.run?.id!==run.id)throw Error('New exchange authority changed')
      return this.run
    } catch (reason) {
      this.capability = false
      if (!this.pendingArm) this.release()
      else this.lastError = 'Start could not be verified. Check the saved outcome before trying again.'
      throw reason
    }
    } finally {this.starting=false}
  }
  private async settlePendingArm(intent:Intent,reason:string) {
    const input=this.pendingArm
    if (!input) {this.release();return null}
    try {
      const store=await this.open()
      let checked:Run|null=null
      await store.publishChecked(null,root=>{checked=root.runs[input.runId]??null})
      this.pendingArm=null
      const found=checked as Run|null
      if (!found) {this.lastError=null;this.release();this.emit();return null}
      this.run=found;this.exposure=found.exposure
      return this.withdraw(intent,reason,found.exposure)
    } catch(reason) {
      this.lastError='Start cancellation is not yet confirmed. Check the saved outcome before trying again.'
      this.emit();throw reason
    }
  }
  private async action(kind:string,request:{id:string},expected: (run: Run) => boolean,
    work: (store: MoneyStore, run: Run) => Promise<Run>) {
    if (!this.capability || !this.run || !this.releaseOwner) throw Error('This exchange cannot continue')
    const original = this.run, epoch = this.viewEpoch, store = await this.open()
    if (!this.capability || epoch!==this.viewEpoch || this.run?.id!==original.id) throw Error('Exchange withdrawn')
    let next: Run
    try { next = await work(store, original) }
    catch (reason) {
      const root = await store.read().catch(() => null), checked=root?.runs[original.id]
      const savedRequest=root?.requests[request.id]
      if (!checked || !expected(checked) || savedRequest?.kind!==kind ||
        savedRequest.runId!==original.id) {
        this.lastError = 'The local save could not be confirmed. Check the saved outcome before continuing.'
        this.emit(); throw reason
      }
      next = checked
    }
    if (!this.capability || epoch !== this.viewEpoch || this.run?.id !== original.id) throw Error('Exchange withdrawn')
    if (!expected(next) || next.status !== 'active') throw Error('Exchange authority changed')
    this.run = next; this.exposure = stronger(this.exposure,next.exposure); this.lastError = null; this.emit(); return next
  }
  transfer(sentCents: number) { const request = this.requestId('transfer',sentCents)
    return this.action('transfer',request,run => run.events.some(e => e.kind === 'transfer_committed' && e.id===request.id && e.sentCents === sentCents),
      (store,run) => store.transfer({ id:request.id,runId:run.id,documentId:this.documentId,expectedRevision:run.revision,sentCents,at:request.at })).then(run=>{this.clearRequest('transfer');return run}) }
  markPossible() { const request = this.requestId('possible','result')
    return this.action('possible',request,run => run.exposure !== 'not_revealed',
      (store,run) => store.markPossible({ id:request.id,runId:run.id,documentId:this.documentId,expectedRevision:run.revision,at:request.at })).then(run=>{this.clearRequest('possible');return run}) }
  capture() { const request = this.requestId('capture','result')
    return this.action('capture',request,run => run.exposure === 'captured_visible',
      (store,run) => store.capture({ id:request.id,runId:run.id,documentId:this.documentId,expectedRevision:run.revision,at:request.at })).then(run=>{this.clearRequest('capture');return run}) }
  returnShown() { const request = this.requestId('return','result')
    return this.action('return',request,run => run.events.some(e => e.kind === 'return_presented' && e.id===request.id),
      (store,run) => store.saveReturn({ id:request.id,runId:run.id,documentId:this.documentId,expectedRevision:run.revision,at:request.at })).then(run=>{this.clearRequest('return');return run}) }
  async complete(rating: number | null) {
    if (!this.capability || !this.run) throw Error('No active exchange')
    const original=this.run, epoch=this.viewEpoch, store=await this.open()
    if (!this.capability || epoch!==this.viewEpoch || this.run?.id!==original.id) throw Error('Exchange withdrawn')
    const request=this.requestId('terminal',rating)
    let next:Run
    try { next=await store.complete({id:request.id,runId:original.id,documentId:this.documentId,expectedRevision:original.revision,at:request.at,rating}) }
    catch (reason) {
      const root=await store.read().catch(()=>null),checked=root?.runs[original.id]
      if (!checked || checked.status!=='complete' || root?.requests[request.id]?.kind!=='terminal' ||
        !checked.events.some(e=>e.kind==='completed' && e.id===request.id) ||
        !checked.events.some(e=>e.kind==='fairness_committed' && e.rating===rating || e.kind==='fairness_not_applicable' && rating===null)) {
        this.lastError='Completion save is unconfirmed. Check the saved outcome.';this.emit();throw reason }
      next=checked
    }
    if (epoch!==this.viewEpoch || this.run?.id!==original.id || !this.capability) throw Error('Exchange withdrawn')
    this.run=next;this.clearRequest('terminal');this.capability=false;this.release();this.lastError=null;this.retireView();this.usage.finish(next.id,'completed',()=>({exchanges:1}));return next
  }
  async checkSaved() {
    if (!this.run && this.pendingArm) {
      const input = this.pendingArm, store = await this.open()
      let checked:Run|null=null
      await store.publishChecked(null,root=>{checked=root.runs[input.runId]??null})
      const found=checked as Run|null
      this.pendingArm = null
      if (found) {
        this.run = found; this.exposure = found.exposure
        this.capability = found.status === 'active' && found.documentId === this.documentId && !!this.releaseOwner
      } else this.release()
      this.lastError = null; this.retireView()
      return found
    }
    if (!this.run) return null
    const store=await this.open(), checked=await store.inspect(this.run.id)
    if (!checked) { this.capability=false;this.release();this.run=null;this.retireView();return null }
    this.run=checked;this.exposure=stronger(this.exposure,checked.exposure)
    if (checked.status!=='active') { this.capability=false;this.release() }
    this.lastError=null;this.emit();return checked
  }
  withdraw(intent: Intent, reason: string, exposureHint: Exposure=this.exposure): Promise<Run | null> {
    this.usage.cancel()
    this.capability=false;this.exposure=stronger(this.exposure,exposureHint);this.retireView()
    if (!this.run) return this.settlePendingArm(intent,reason)
    if (this.settlement) return this.settlement
    const target=this.run, id=this.settlementId ?? crypto.randomUUID()
    this.settlementId=id
    const input=this.settlementInput ?? {id,runId:target.id,documentId:target.documentId,at:Date.now(),reason,exposure:this.exposure}
    this.settlementInput=input
    this.settlement=(async()=>{
      const store=await this.open()
      for (let attempt=0;attempt<2;attempt++) {
        try {
          let result: Run
          try { result=await store.interrupt(input) }
          catch { const checked=await store.inspect(target.id); if (!checked || checked.status==='active') throw Error('Interruption unconfirmed');result=checked }
          while (result.status==='incomplete' &&
            (result.exposure==='not_revealed' && this.exposure!=='not_revealed' ||
              result.exposure==='possibly_revealed' && this.exposure==='captured_visible')) {
            const upgrade={...input,id:`${input.id}_${this.exposure}`,exposure:this.exposure}
            try { result=await store.interrupt(upgrade) }
            catch { const checked=await store.inspect(target.id);if (!checked ||
              checked.exposure==='not_revealed' || checked.exposure==='possibly_revealed' && this.exposure==='captured_visible')
              throw Error('Visible return evidence unconfirmed');result=checked }
          }
          if (result.status==='active') throw Error('Interruption unconfirmed')
          this.run=result;this.exposure=stronger(this.exposure,result.exposure);this.lastError=null
          this.release();this.settlementInput=null;this.settlementId=null;this.emit();return result
        } catch {
          if (!this.run || this.run.id !== target.id) { this.release(); return null }
          const checked=await store.inspect(target.id).catch(()=>null)
          if (checked?.status==='complete' || checked?.status==='incomplete' &&
            (checked.exposure==='captured_visible' || checked.exposure==='possibly_revealed' && this.exposure!=='captured_visible' || this.exposure==='not_revealed')) {
            this.run=checked;this.exposure=stronger(this.exposure,checked.exposure);this.lastError=null
            this.release();this.settlementInput=null;this.settlementId=null;this.emit();return checked
          }
          if (attempt===0) await delay(900)
        }
      }
      this.lastError='This exchange is not yet confirmed saved. Check the saved outcome; do not start a new one.'
      this.emit();throw Error(this.lastError)
    })().finally(()=>{ this.settlement=null;this.emit() })
    void intent // Route belongs to the caller; durable settlement never rewrites navigation intent.
    return this.settlement
  }
  resetForReplay() {
    this.usage.cancel()
    if (this.run?.status==='active' || this.pendingArm || this.settlement || this.lastError) throw Error('Resolve the prior exchange before replay')
    this.run=null;this.exposure='not_revealed';this.capability=false;this.retireView()
    this.pendingIds.clear();this.settlementInput=null;this.settlementId=null
  }
  async deleteOne(id:string) { const store=await this.open();await store.deleteOne(id)
    if (this.run?.id===id) { this.capability=false;this.run=null;this.release();this.retireView() } }
  async deleteAll() { const store=await this.open();await store.deleteAll();this.capability=false;this.run=null;this.release()
    this.unsubscribeStore?.();store.close();this.store=null;this.exposure='not_revealed';this.retireView() }
}
