import { describe, expect, it, vi } from 'vitest'
import type { FrameAdapter, FrameRequest } from './engine/contracts'
import { firstScoredAdmission } from './presentation-order'
import { StopLocalStore } from './storage'
import type { TrainingChain } from './training'

const onset: FrameRequest = { kind: 'onset', trial: { phase: 'scored', index: 0, stimulus: 'GO' }, notBeforeMs: 1000 }
function fixture() {
  let grant = () => {}
  let painted = false
  let released = false
  let callback = () => {}
  let signal: AbortSignal
  const frames: FrameAdapter = { request: vi.fn((_r, confirm) => { callback = () => { painted = true; confirm() }; return () => { callback = () => {} } }) }
  const failed = vi.fn(), confirm = vi.fn()
  const guarded = firstScoredAdmission(frames, async (present, abort) => {
    signal = abort
    await new Promise<void>(resolve => { grant = resolve })
    await present()
    released = true
  }, failed)
  const cancel = guarded.request(onset, confirm)
  return { frames, failed, confirm, guarded, cancel, grant: () => grant(), paint: () => callback(),
    state: () => ({ painted, released, aborted: signal.aborted }) }
}
const settle = async () => { for (let i = 0; i < 8; i++) await Promise.resolve() }

describe('first scored presentation admission', () => {
  it.each(['resolve', 'reject'])('releases an acquired admission while read delivery is held, fencing its late %s', async outcome => {
    let held = false
    const old = navigator.locks
    Object.defineProperty(navigator, 'locks', { configurable: true, value: { request: async (_name: string, _options: unknown, work: () => Promise<void>) => {
      held = true
      try { await work() } finally { held = false }
    } } })
    try {
      let resolve!: (value: unknown) => void, reject!: (error: Error) => void
      const store = Object.create(StopLocalStore.prototype)
      store.read = () => new Promise((yes, no) => { resolve = yes; reject = no })
      const controller = new AbortController(), paint = vi.fn()
      const admission = store.admitPresentation({} as TrainingChain, 'session', paint, controller.signal).catch(() => undefined)
      expect(held).toBe(true)
      controller.abort(); await admission
      expect(held).toBe(false)
      if (outcome === 'resolve') resolve({})
      else reject(new Error('late rejection'))
      await settle()
      expect(paint).not.toHaveBeenCalled()
    } finally { Object.defineProperty(navigator, 'locks', { configurable: true, value: old }) }
  })
  it('keeps cancellation reachable after the real frame confirmation', async () => {
    const controller = new AbortController(), failed = vi.fn(), confirm = vi.fn()
    let callback = () => {}, delivered = false
    const frames = { request: (_r: FrameRequest, cb: () => void) => { callback = cb; return vi.fn() } }
    firstScoredAdmission(frames, async present => {
      await present(); delivered = true
      await new Promise<void>(() => {})
    }, failed, controller).request(onset, confirm)
    callback(); await settle()
    expect(confirm).toHaveBeenCalledOnce(); expect(delivered).toBe(true)
    controller.abort()
    callback(); await settle()
    expect(confirm).toHaveBeenCalledOnce(); expect(failed).not.toHaveBeenCalled()
  })
  it('rejects a late canceled exposure confirmation before opening any transaction', async () => {
    const store = Object.create(StopLocalStore.prototype), transaction = vi.fn()
    store.db = { transaction }
    const controller = new AbortController(); controller.abort()
    await expect(store.confirm('session', 'form', 'date', 'chain', controller.signal)).rejects.toThrow()
    expect(transaction).not.toHaveBeenCalled()
  })
  it('holds admission across the asynchronous gap until actual confirmation, retaining the original eligible time', async () => {
    const f = fixture()
    expect(f.frames.request).not.toHaveBeenCalled()
    f.grant(); await settle()
    expect(f.frames.request).toHaveBeenCalledWith(onset, expect.any(Function))
    expect(f.state()).toMatchObject({ painted: false, released: false })
    f.paint(); await settle()
    expect(f.confirm).toHaveBeenCalledOnce()
    expect(f.state()).toMatchObject({ painted: true, released: true })
    f.guarded.request({ ...onset, kind: 'offset' }, () => {})
    f.guarded.request({ ...onset, trial: { ...onset.trial, index: 1 } }, () => {})
    expect(f.frames.request).toHaveBeenCalledTimes(3)
  })
  it.each(['queued', 'frame pending'])('never paints after engine cancellation while %s', async stage => {
    const f = fixture()
    if (stage === 'frame pending') { f.grant(); await settle() }
    f.cancel(); f.grant(); await settle(); f.paint()
    expect(f.state()).toEqual({ painted: false, released: true, aborted: true })
    expect(f.confirm).not.toHaveBeenCalled()
    expect(f.failed).not.toHaveBeenCalled()
  })
  it('rejects deletion before admission without requesting a canvas frame', async () => {
    const frames = { request: vi.fn() }, failed = vi.fn()
    const error = new Error('deleted')
    firstScoredAdmission(frames, async () => { throw error }, failed).request(onset, vi.fn())
    await settle()
    expect(frames.request).not.toHaveBeenCalled()
    expect(failed).toHaveBeenCalledWith(error)
  })
})
