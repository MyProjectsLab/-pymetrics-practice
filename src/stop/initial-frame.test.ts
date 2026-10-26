// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { waitForInitialFrame } from './initial-frame'

describe('M6-A initial-frame deadline and callback ownership', () => {
  it.each([1999.999, 2000, 2000.001])('checks frame time %s even when timer delivery is delayed', time => {
    let now = 0, timer = () => {}, frame = () => {}, current = () => false
    const ready = vi.fn(), failed = vi.fn(), cancelFrame = vi.fn()
    waitForInitialFrame({ clock: () => now, scheduler: { at: (_at, cb) => { timer = cb; return () => {} }, after: () => () => {} },
      active: () => true, request: (cb, guard) => { frame = cb; current = guard; return cancelFrame }, ready, failed })
    now = time
    const canPaint = current()
    frame(); timer(); frame()
    expect(canPaint).toBe(time < 2000)
    expect(ready).toHaveBeenCalledTimes(time < 2000 ? 1 : 0)
    expect(failed).toHaveBeenCalledTimes(time < 2000 ? 0 : 1)
    expect(cancelFrame).toHaveBeenCalled()
  })
  it('fences frame and timer after cancellation', () => {
    let now = 0, timer = () => {}, frame = () => {}, active = true, guard = () => false
    const ready = vi.fn(), failed = vi.fn()
    const cancel = waitForInitialFrame({ clock: () => now, scheduler: { at: (_at, cb) => { timer = cb; return () => {} }, after: () => () => {} },
      active: () => active, request: (cb, current) => { frame = cb; guard = current }, ready, failed })
    active = false; cancel(); now = 2000; timer(); frame()
    expect(guard()).toBe(false); expect(ready).not.toHaveBeenCalled(); expect(failed).not.toHaveBeenCalled()
  })
})
