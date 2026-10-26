import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import fs from 'node:fs'
import type { StopResult } from './run'

const authority=vi.hoisted(()=>({ pending:[] as ((value:unknown)=>void)[], notify:()=>{}, reads:0 }))
vi.mock('./storage',()=>({
  stopLocalStore:()=>({sameInstallation:()=>true,read:()=>{authority.reads++;return new Promise(resolve=>authority.pending.push(resolve))},subscribeDeletion:(fn:()=>void)=>{authority.notify=fn;return()=>{}}}),
  inspectLocalState:(root:{valid:StopResult[]})=>({valid:root.valid}),recordLocalActivity:()=>Promise.resolve(),
}))
vi.mock('../analytics/observations',()=>({useCoarseEvent:()=>{}}))
import { StopReport } from './Report'

const current=JSON.parse(fs.readFileSync('docs/qa/m6-c/physical-baseline-2026-10-03/baseline-record.json','utf8')) as StopResult
const earlier={...current,sessionId:'earlier-source',completedAtWall:'2020-01-01T00:00:00.000Z'} as StopResult
const result=(valid:StopResult[])=>({valid})
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.useRealTimers();authority.pending=[];authority.reads=0})
function focused(){vi.spyOn(document,'visibilityState','get').mockReturnValue('visible');vi.spyOn(document,'hasFocus').mockReturnValue(true)}

it('retires a held comparison read when source deletion arrives, then publishes only the newer source',async()=>{
  focused()
  const view=render(<StopReport result={current} onReplay={()=>{}} onLibrary={()=>{}}/>)
  expect(authority.pending).toHaveLength(1)
  const stale=authority.pending.shift()!
  await act(async()=>{authority.notify()})
  expect(view.container.textContent).not.toContain('Previous compatible saved run:')
  expect(authority.reads).toBe(1)
  await act(async()=>{stale(result([current,earlier]))})
  expect(authority.pending).toHaveLength(1)
  await act(async()=>{authority.pending.shift()!(result([current]))})
  expect(view.container.textContent).toContain('No comparable earlier run is currently verified.')
  expect(view.container.textContent).not.toContain('Previous compatible saved run:')
})

it('withdraws a published comparison when the previous or current saved source is removed',async()=>{
  focused()
  const view=render(<StopReport result={current} onReplay={()=>{}} onLibrary={()=>{}}/>)
  await act(async()=>{authority.pending.shift()!(result([current,earlier]))})
  expect(view.container.textContent).toContain('Previous compatible saved run:')
  await act(async()=>{authority.notify()})
  expect(view.container.textContent).not.toContain('Previous compatible saved run:')
  await act(async()=>{authority.pending.shift()!(result([current]))})
  expect(view.container.textContent).toContain('No comparable earlier run is currently verified.')
  await act(async()=>{authority.notify()})
  await act(async()=>{authority.pending.shift()!(result([earlier]))})
  expect(view.container.textContent).toContain('This saved result changed or was deleted.')
})

it('does not start overlapping comparison reads while hidden or while a read is pending',async()=>{
  vi.useFakeTimers();focused()
  vi.spyOn(document,'visibilityState','get').mockReturnValue('hidden')
  render(<StopReport result={current} onReplay={()=>{}} onLibrary={()=>{}}/>)
  await act(async()=>{vi.advanceTimersByTime(3100)})
  expect(authority.reads).toBe(0)
  vi.spyOn(document,'visibilityState','get').mockReturnValue('visible')
  await act(async()=>{window.dispatchEvent(new Event('focus'))})
  expect(authority.reads).toBe(1)
  await act(async()=>{vi.advanceTimersByTime(3100)})
  expect(authority.reads).toBe(1)
})
