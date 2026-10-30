import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, expect, it, vi } from 'vitest'
import { webcrypto } from 'node:crypto'
import { BalloonsJourney } from './Journey'
import { BalloonsStore } from './storage'
import { baseline } from './training-test-support'
import { loadScoredManifests } from './manifests'
import type { DurableRecord } from './durable'
import type { RunView } from './controller'
const fixture = vi.hoisted(() => ({ record: null as DurableRecord | null }))
vi.mock('./controller', async original => ({ ...await original<typeof import('./controller')>(), BalloonsController: class {
  view: RunView = { mode:'idle',record:null,message:'' }
  emit:(v:RunView)=>void
  constructor(_s: BalloonsStore, emit:(v:RunView)=>void) { this.emit=emit }
  async start() { this.view={mode:'playing',record:fixture.record,message:''};this.emit(this.view) }
  dispose() { return Promise.resolve() }
  checkAuthority() {}
} }))
beforeAll(async () => { Object.defineProperty(globalThis,'crypto',{value:webcrypto,configurable:true});await loadScoredManifests() })
afterEach(() => { cleanup();vi.restoreAllMocks() })
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
