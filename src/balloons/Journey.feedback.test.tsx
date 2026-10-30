import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, expect, it, vi } from 'vitest'
import { webcrypto } from 'node:crypto'
import { BalloonsJourney } from './Journey'
import { BalloonsStore } from './storage'
import { baseline } from './training-test-support'
import { loadScoredManifests } from './manifests'
import type { DurableRecord } from './durable'
import { QUEUE_FULL_NOTICE, ROUND_CLOSED_NOTICE } from './controller'
import type { RunView } from './controller'
const fixture = vi.hoisted(() => ({ record: null as DurableRecord | null, capacity:false, message:'', emit:null as ((v:RunView)=>void)|null }))
vi.mock('./controller', async original => ({ ...await original<typeof import('./controller')>(), BalloonsController: class {
  view: RunView = { mode:'idle',record:null,message:'' }
  emit:(v:RunView)=>void
  constructor(_s: BalloonsStore, emit:(v:RunView)=>void) { this.emit=emit;fixture.emit=v=>{this.view=v;emit(v)} }
  get atActionCapacity() { return fixture.capacity }
  acceptsRoundActions() { return !fixture.capacity && this.view.record?.snapshot.core.status==='active' }
  async start() { this.view={mode:'playing',record:fixture.record,message:fixture.message};this.emit(this.view) }
  dispose() { return Promise.resolve() }
  checkAuthority() {}
} }))
beforeAll(async () => { Object.defineProperty(globalThis,'crypto',{value:webcrypto,configurable:true});await loadScoredManifests() })
afterEach(() => { cleanup();vi.restoreAllMocks();fixture.capacity=false;fixture.message='';fixture.emit=null })
it.each(['BL1','RP1'] as const)('shows the committed %s burst loss until Next without inventing money', async form => {
  const root=baseline(form,()=>32,1);fixture.record=root.records.base
  vi.spyOn(BalloonsStore,'open').mockResolvedValue({installationId:root.installationId,read:async()=>root} as BalloonsStore)
  await act(async()=>{render(<BalloonsJourney onLibrary={()=>{}} />)})
  fireEvent.click(screen.getByRole('button',{name:'Continue'}));fireEvent.click(screen.getByRole('radio',{name:/Only this balloon’s \$0\.10/}));fireEvent.click(screen.getByRole('button',{name:'Check answer'}));fireEvent.click(screen.getByRole('button',{name:'Pump'}));fireEvent.click(screen.getByRole('button',{name:'Collect'}));await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Start'}))})
  const lost=fixture.record.snapshot.core.results[0].lostCents
  expect(document.querySelector('.balloons-loss')).toHaveTextContent(lost===0?'No money lost':`$${(lost/100).toFixed(2)}`)
  expect(fixture.record.snapshot.core.current.currentCents).toBe(0)
  expect(screen.getByRole('button',{name:'Pump'})).toBeDisabled()
  expect(screen.getByRole('button',{name:'Next balloon'})).toBeEnabled()
})

async function openPlay(limit=0) {
  const root=baseline('BL1',()=>0,limit);fixture.record=root.records.base
  vi.spyOn(BalloonsStore,'open').mockResolvedValue({installationId:root.installationId,read:async()=>root} as BalloonsStore)
  await act(async()=>{render(<BalloonsJourney onLibrary={()=>{}} />)})
  fireEvent.click(screen.getByRole('button',{name:'Continue'}));fireEvent.click(screen.getByRole('radio',{name:/Only this balloon’s \$0\.10/}));fireEvent.click(screen.getByRole('button',{name:'Check answer'}));fireEvent.click(screen.getByRole('button',{name:'Pump'}));fireEvent.click(screen.getByRole('button',{name:'Collect'}));await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Start'}))})
}
it('synchronously disables both actions at queue capacity and shows the warning in the reserved visible slot', async()=>{
  await openPlay()
  const pump=screen.getByRole('button',{name:'Pump'}),collect=screen.getByRole('button',{name:'Collect'})
  expect(pump).toBeEnabled();expect(collect).toBeEnabled()
  act(()=>{fixture.capacity=true;fixture.emit!({mode:'saving',record:fixture.record,message:QUEUE_FULL_NOTICE});expect(pump).toBeDisabled();expect(collect).toBeDisabled()})
  const notice=document.querySelector('.balloons-outcome p')!
  expect(notice).toHaveTextContent(QUEUE_FULL_NOTICE);expect(notice).not.toHaveClass('sr-only');expect(notice).not.toHaveAttribute('aria-hidden','true')
  act(()=>{fixture.capacity=false;fixture.emit!({mode:'playing',record:fixture.record,message:''})})
  expect(pump).toBeEnabled();expect(collect).toBeEnabled()
})
it('visibly explains closed-round extra clicks without moving Next or hiding the result amount', async()=>{
  fixture.message=ROUND_CLOSED_NOTICE;await openPlay(1)
  const notice=document.querySelector('.balloons-outcome p')!
  expect(notice).toHaveTextContent(ROUND_CLOSED_NOTICE);expect(notice).not.toHaveClass('sr-only');expect(notice).not.toHaveAttribute('aria-hidden','true')
  expect(screen.getByRole('button',{name:'Next balloon'})).toBeEnabled()
  expect(document.querySelector('.balloons-balances')).toHaveTextContent('Banked')
})
