import { describe, expect, it } from 'vitest'
import type { FrameAdapter, Scheduler } from '../engine/contracts'
import { createTouchController, validateTouchReport } from './controller'
import { TOUCH_SEQUENCE, validateTouchForm } from './form'

function rig(autoGo = false, offsetDelayMs = 0) {
  let now = 0
  let controller: ReturnType<typeof createTouchController>
  const tasks: { at: number; run: () => void; cancelled: boolean }[] = []
  function enqueue(at: number, run: () => void) {
    const job = { at, run, cancelled: false }; tasks.push(job); return () => { job.cancelled = true }
  }
  const scheduler: Scheduler = { at: enqueue, after: (at, run) => enqueue(at + 0.001, run) }
  const frames: FrameAdapter = { request(request, confirm) { return enqueue(Math.max(now, request.notBeforeMs) + (request.kind === 'offset' ? offsetDelayMs : 0), () => {
    confirm()
    if (autoGo && request.kind === 'onset' && request.trial.stimulus === 'GO') {
      controller.pointerDown(1, true, 'touch'); controller.pointerEnd(1)
    }
  }) } }
  controller = createTouchController({ clock: () => now, scheduler, frames, showFixation() {}, changed() {} })
  function advanceTo(target: number) {
    let guard = 0
    while (true) {
      const job = tasks.filter(item => !item.cancelled && item.at <= target).sort((a, b) => a.at - b.at)[0]
      if (!job) break
      if (++guard > 1000) throw new Error('Task loop')
      job.cancelled = true; now = job.at; job.run()
    }
    now = target
  }
  function advanceUntil(phase: string) {
    for (let i = 0; i < 1000 && controller.snapshot().phase !== phase; i++) {
      const job = tasks.filter(item => !item.cancelled).sort((a, b) => a.at - b.at)[0]
      if (!job) throw new Error('No pending task')
      advanceTo(job.at)
    }
    expect(controller.snapshot().phase).toBe(phase)
  }
  return { controller, advanceTo, advanceUntil, now: () => now }
}

describe('separate Stop touch practice', () => {
  it('binds one frozen touch-only source outside Standard form sequences', async () => {
    expect(TOUCH_SEQUENCE).toHaveLength(80)
    expect(await validateTouchForm()).toBe(true)
  })
  it('accepts the inclusive deadline once and suppresses held and compatibility click', () => {
    const r = rig()
    expect(r.controller.startWarmup()).toBe(true)
    r.advanceTo(1000)
    r.advanceTo(2000)
    expect(r.controller.pointerDown(7, true, 'touch')).toBe(true)
    expect(r.controller.pointerDown(7, true, 'touch')).toBe(false)
    r.controller.pointerEnd(7)
    expect(r.controller.click()).toBe(false)
    r.advanceTo(2000.01)
    r.controller.exit('test exit')
    const report = r.controller.snapshot().report!
    expect(validateTouchReport(report)).toBe(true)
    expect(report.warmup).toHaveLength(1)
    expect(report.warmup[0]).toMatchObject({ outcome: 'hit', input: 'touch_pointer', onsetMs: 1000, offsetMs: 1200, resolvedMs: 2000 })
  })
  it('keeps early response visible for 200 ms and uses one post-resolution interval', () => {
    const r = rig()
    r.controller.startWarmup(); r.advanceTo(1000)
    expect(r.controller.pointerDown(1, true, 'touch')).toBe(true)
    r.controller.pointerEnd(1)
    r.advanceTo(2399)
    expect(r.controller.snapshot().trial).toBe(1)
    r.advanceTo(2400)
    expect(r.controller.snapshot().trial).toBe(2)
    r.controller.exit('test exit')
    expect(r.controller.snapshot().report!.warmup[0].offsetMs).toBe(1200)
  })
  it('keeps one touch owner, ignores a second finger, and labels a separate accessibility activation', () => {
    const r = rig()
    r.controller.startWarmup(); r.advanceTo(1000)
    expect(r.controller.pointerDown(1, true, 'touch')).toBe(true)
    expect(r.controller.pointerDown(2, false, 'touch')).toBe(false)
    r.controller.pointerEnd(2)
    r.advanceTo(2400)
    expect(r.controller.pointerDown(3, true, 'touch')).toBe(false)
    r.controller.pointerEnd(1)
    r.controller.exit('test exit')
    expect(r.controller.snapshot().report?.warmup).toHaveLength(1)
    const a = rig()
    a.controller.startWarmup(); a.advanceTo(1000)
    expect(a.controller.click()).toBe(true)
    a.advanceTo(1200); a.controller.exit('test exit')
    expect(a.controller.snapshot().report?.assistiveActivations).toBe(1)
    expect(a.controller.snapshot().report?.warmup[0].input).toBe('assistive_click')
  })
  it('finishes eight warm-ups and 80 scored outcomes with separate arithmetic and no saved result', () => {
    const r = rig(true)
    r.controller.startWarmup(); r.advanceUntil('warmup_complete')
    expect(r.controller.snapshot().trial).toBe(0)
    expect(r.controller.startScored()).toBe(true)
    r.advanceUntil('report')
    const report = r.controller.snapshot().report!
    expect(validateTouchReport(report)).toBe(true)
    expect(report.status).toBe('completed')
    expect(report.warmup).toHaveLength(8)
    expect(report.scored).toHaveLength(80)
    expect(report.totals).toEqual({ hit: 60, miss: 0, false_alarm: 0, correct_withhold: 20 })
  })
  it('cancels pending onset on exit and disallows stale input', () => {
    const r = rig()
    r.controller.startWarmup(); r.controller.exit('user exit')
    r.advanceTo(5000)
    expect(r.controller.snapshot().report?.status).toBe('early_exit')
    expect(r.controller.snapshot().report?.warmup).toHaveLength(0)
    expect(r.controller.pointerDown(1, true, 'touch')).toBe(false)
  })
  it('rejects a long-held touch click and clicks from ignored gestures without a time window', () => {
    const r = rig()
    r.controller.startWarmup(); r.advanceTo(1000)
    expect(r.controller.pointerDown(4, true, 'touch')).toBe(true)
    r.advanceTo(2800)
    r.controller.pointerEnd(4)
    expect(r.controller.click({ detail: 1, pointerType: 'mouse', firesTouchEvents: true })).toBe(false)
    r.controller.exit('test exit')
    expect(r.controller.snapshot().report?.warmup).toHaveLength(1)
    expect(r.controller.snapshot().report?.assistiveActivations).toBe(0)
    const ignored = rig()
    ignored.controller.startWarmup(); ignored.advanceTo(500)
    expect(ignored.controller.pointerDown(5, true, 'touch')).toBe(false) // initial fixation
    ignored.advanceTo(2000)
    ignored.controller.pointerEnd(5)
    expect(ignored.controller.click({ detail: 1, pointerType: 'touch' })).toBe(false)
    ignored.controller.exit('test exit')
    expect(ignored.controller.snapshot().report?.assistiveActivations).toBe(0)
  })
  it('retains an accepted response when exit precedes the offset without inventing visibility', () => {
    const r = rig()
    r.controller.startWarmup(); r.advanceTo(1000)
    expect(r.controller.pointerDown(1, true, 'touch')).toBe(true)
    r.advanceTo(1100); r.controller.exit('Page became hidden')
    const report = r.controller.snapshot().report!
    expect(validateTouchReport(report)).toBe(true)
    expect(report.warmup).toHaveLength(1)
    expect(report.warmup[0]).toMatchObject({ input: 'touch_pointer', outcome: 'hit', resolvedMs: 1000, offsetMs: null, presentation: 'interrupted_before_offset' })
    r.advanceTo(5000)
    expect(r.controller.snapshot().report).toBe(report)
    const unresolved = rig()
    unresolved.controller.startWarmup(); unresolved.advanceTo(1000); unresolved.controller.exit('test exit')
    expect(unresolved.controller.snapshot().report?.warmup).toHaveLength(0)
  })
  it('counts a scored accepted response before offset in the scored totals only', () => {
    const r = rig(true)
    r.controller.startWarmup(); r.advanceUntil('warmup_complete')
    expect(r.controller.startScored()).toBe(true)
    r.advanceTo(r.now() + 1000)
    if (TOUCH_SEQUENCE[0] === 'NO_GO') expect(r.controller.pointerDown(9, true, 'touch')).toBe(true)
    r.controller.exit('Visible touch controls no longer fit')
    const report = r.controller.snapshot().report!
    expect(validateTouchReport(report)).toBe(true)
    expect(report.warmup).toHaveLength(8)
    expect(report.scored).toHaveLength(1)
    expect(report.scored[0].offsetMs).toBeNull()
    expect(report.scored[0].presentation).toBe('interrupted_before_offset')
    expect(report.totals[report.scored[0].outcome]).toBe(1)
  })
  it('retains a GO timeout before a delayed offset and cancels its frame on exit', () => {
    const r = rig(false, 1500)
    r.controller.startWarmup(); r.advanceTo(2100)
    expect(r.controller.snapshot()).toMatchObject({ phase: 'warmup', trial: 1, stimulus: 'GO' })
    r.controller.exit('Exit practice selected')
    const report = r.controller.snapshot().report!
    expect(validateTouchReport(report)).toBe(true)
    expect(report.warmup[0]).toMatchObject({ outcome: 'miss', input: null, onsetMs: 1000, resolvedMs: 2000.001,
      offsetMs: null, presentation: 'interrupted_before_offset' })
    r.advanceTo(8000)
    expect(r.controller.snapshot()).toMatchObject({ phase: 'report', trial: 1, report })
  })
  it('retains a NO_GO timeout before delayed offset on hidden-page exit, then stays retired', () => {
    const r = rig(false, 1500)
    r.controller.startWarmup(); r.advanceTo(7900)
    expect(r.controller.snapshot()).toMatchObject({ phase: 'warmup', trial: 3, stimulus: 'NO_GO' })
    r.controller.exit('Page became hidden')
    const report = r.controller.snapshot().report!
    expect(validateTouchReport(report)).toBe(true)
    expect(report.warmup).toHaveLength(3)
    expect(report.warmup[2]).toMatchObject({ outcome: 'correct_withhold', input: null, onsetMs: 6800, resolvedMs: 7800.001,
      offsetMs: null, presentation: 'interrupted_before_offset' })
    r.advanceTo(20000)
    expect(r.controller.snapshot()).toMatchObject({ phase: 'report', trial: 3, report })
  })
})
