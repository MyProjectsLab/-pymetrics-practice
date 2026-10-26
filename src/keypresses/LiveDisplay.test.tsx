import { cleanup, render } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { arm, advance, WINDOW_MS } from './core'
import { liveDisplay, KeypressesLiveDisplay } from './LiveDisplay'
import type { State } from './core'
const setup = { sessionId:'display',selectedKey:'Space',hand:'either',profile:'standard_physical',delayIndex:0 } as const
function active(){return advance(arm(setup,0),{kind:'go',atMs:1800})}
afterEach(()=>{cleanup();vi.useRealTimers();vi.restoreAllMocks()})
it('reads accepted pairs, not keydowns, from the unchanged run state',()=>{
  let state=active()
  state=advance(state,{kind:'keydown',atMs:2000,repeat:false,trusted:true})
  expect(liveDisplay(state,7800)).toEqual({count:0,seconds:9,fraction:.6})
  state=advance(state,{kind:'keyup',atMs:2050,trusted:true})
  const before=JSON.stringify(state)
  expect(liveDisplay(state,7800)).toEqual({count:1,seconds:9,fraction:.6})
  expect(JSON.stringify(state)).toBe(before)
  expect(liveDisplay(state,1800+WINDOW_MS+1)).toEqual({count:1,seconds:0,fraction:0})
})
it('does not continue draining or counting after the run has ended',()=>{
  const ended=advance(active(),{kind:'deadline',atMs:16800})
  expect(liveDisplay(ended,50000)).toEqual({count:0,seconds:0,fraction:0})
})
it('refreshes passive counters and stops its own timer on unmount',()=>{
  vi.useFakeTimers();let state:State=active(),now=1800
  vi.spyOn(performance,'now').mockImplementation(()=>now)
  const snapshot=vi.fn(()=>({state,saveStatus:'idle' as const,message:''})),ref={current:{snapshot}}
  const view=render(<KeypressesLiveDisplay run={ref}><div className="keypresses-signal" data-phase="go">GO</div></KeypressesLiveDisplay>)
  expect(view.container.querySelector('.keypresses-taps strong')?.textContent).toBe('0 / 40')
  state=advance(state,{kind:'keydown',atMs:2000,repeat:false,trusted:true});state=advance(state,{kind:'keyup',atMs:2050,trusted:true});now=7800
  vi.advanceTimersByTime(100)
  expect(view.container.querySelector('.keypresses-taps strong')?.textContent).toBe('1 / 40')
  expect(view.container.querySelector('.keypresses-left strong')?.textContent).toBe('9s')
  expect(view.container.querySelector('.keypresses-progress span')?.getAttribute('style')).toContain('scaleX(0.6)')
  view.unmount();const calls=snapshot.mock.calls.length;vi.advanceTimersByTime(1000);expect(snapshot).toHaveBeenCalledTimes(calls)
})
