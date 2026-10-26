// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { setImmediate } from 'node:timers'
import { verifyDrillAttempt } from './storage'
import { createDrillRun } from './drill-run'
import { drillById } from './drills'
import type { DrillId } from './drills'
import type { FrameRequest } from './engine/contracts'

function harness(id: DrillId, started?: (id: string) => void, delayFirstOffset = false, initialFrame?: Parameters<typeof createDrillRun>[0]['initialFrame']) {
  let now = 0
  const jobs: { at: number; callback: () => void; canceled: boolean; serial: number }[] = []
  let serial = 0
  function schedule(at: number, callback: () => void) {
    const job = { at, callback, canceled: false, serial: serial++ }
    jobs.push(job)
    return () => { job.canceled = true }
  }
  const run = createDrillRun({ id: crypto.randomUUID(), manifest: drillById(id),
    setup: { binding: { code: 'Space', label: 'Space' }, visualProfile: 'standard', physicalKeyboard: true },
    clock: () => now, scheduler: { at: schedule, after: (at, callback) => schedule(at + .001, callback) },
    frames: { request: (request: FrameRequest, confirm) => schedule(request.notBeforeMs + (delayFirstOffset && request.kind === 'offset' && request.trial.index === 0 ? 100 : 0), confirm) },
    initialFrame: initialFrame ?? (ready => ready()), clear() {}, changed() {}, started,
  })
  async function settle() { for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve)) }
  return { run, now: () => now,
    async waitForScreen(expected: ReturnType<typeof run.snapshot>['screen']) {
      for (let i = 0; i < 500 && run.snapshot().screen !== expected; i++) await new Promise(resolve => setTimeout(resolve, 1))
      expect(run.snapshot().screen).toBe(expected)
    },
    async advance(target: number) {
      for (;;) {
        const job = jobs.filter(job => !job.canceled && job.at <= target).sort((left, right) => left.at - right.at || left.serial - right.serial)[0]
        if (!job) break
        job.canceled = true
        now = Math.max(now, job.at)
        job.callback()
        await settle()
      }
      now = Math.max(now, target)
      await settle()
    },
  }
}

describe('S48–S49 whole-drill execution', () => {
  it('runs all maintenance blocks with explicit summaries, 1,000-ms initial fixations, and one completed attempt', async () => {
    const h = harness('maintenance')
    await h.run.begin(false)
    await h.advance(60_000)
    await h.waitForScreen('summary')
    expect(h.run.snapshot().summaries).toHaveLength(1)
    expect(h.run.snapshot().summaries[0]).toMatchObject({ hits: 0, withholds: 5, medianMs: null, iqrMs: null })
    h.run.continue()
    await h.advance(120_000)
    await h.waitForScreen('summary')
    h.run.continue()
    await h.advance(180_000)
    await h.waitForScreen('complete')
    expect(h.run.snapshot().attempt).toMatchObject({ valid: true, completedBlocks: 3, drillId: 'maintenance' })
    const events = h.run.snapshot().attempt!.events
    expect(events.filter(event => event.type === 'trial_resolved')).toHaveLength(60)
    expect(events.filter(event => event.type === 'session_completed')).toHaveLength(1)
    expect(events.filter(event => event.type === 'fixation_started' && event.payload.kind === 'initial')).toHaveLength(3)
  })
  it('requires the full 15-second consistency reset and invalidates across a block summary', async () => {
    const h = harness('consistency')
    await h.run.begin(false)
    await h.advance(80_000)
    expect(h.run.snapshot().screen).toBe('summary')
    expect(h.run.continue()).toBe(false)
    const remaining = h.run.snapshot().resetRemainingMs
    await h.advance(h.now() + remaining - 1)
    expect(h.run.continue()).toBe(false)
    await h.advance(h.now() + 1)
    expect(h.run.continue()).toBe(true)
    h.run.engine.visibility(false)
    await h.advance(h.now())
    expect(h.run.snapshot().screen).toBe('invalid')
    expect(h.run.snapshot().attempt).toMatchObject({ valid: false, completedBlocks: 1 })
  })
  it('honors variable detection deadlines and 1,000-ms post-resolution fixation', async () => {
    const h = harness('detection')
    await h.run.begin(false)
    await h.advance(60_000)
    const first = h.run.snapshot().attempt?.events ?? h.run.engine.snapshot().events
    const timeouts = first.filter(event => event.type === 'trial_timed_out')
    expect(timeouts).toHaveLength(24)
    const onset = first.find(event => event.type === 'stimulus_presented')!
    expect(timeouts[0].payload.deadlineMs - onset.payload.confirmedOnsetMs).toBe(1200)
    const fixation = first.filter(event => event.type === 'fixation_started').find(event => event.payload.kind === 'post_resolution')!
    const secondOnset = first.filter(event => event.type === 'stimulus_presented')[1]
    expect(secondOnset.timestampMs - fixation.payload.expectedAtMs).toBe(1000)
  })
  it('keeps input-quality counters across drill blocks', async () => {
    const h = harness('maintenance')
    await h.run.begin(false)
    h.run.engine.keyDown('KeyQ')
    h.run.engine.keyDown('KeyQ')
    await h.advance(60_000)
    expect(h.run.snapshot().screen).toBe('summary')
    expect(h.run.continue()).toBe(true)
    h.run.engine.keyDown('KeyQ')
    h.run.engine.keyDown('KeyQ')
    h.run.engine.keyDown('KeyQ')
    await h.advance(h.now())
    expect(h.run.snapshot().screen).toBe('invalid')
    expect(h.run.snapshot().attempt?.completedBlocks).toBe(1)
  })
  it('retains one immutable invalid journal when leaving a live drill more than once', async () => {
    const h = harness('detection')
    await h.run.begin(false)
    await h.advance(1100)
    const attempt = h.run.leave()!
    expect(attempt).toMatchObject({ valid: false, completedBlocks: 0 })
    expect(attempt.events.some(event => event.type === 'stimulus_presented')).toBe(true)
    expect(attempt.events.filter(event => event.type === 'session_invalidated')).toHaveLength(1)
    expect(Object.isFrozen(attempt)).toBe(true)
    expect(Object.isFrozen(attempt.events)).toBe(true)
    expect(h.run.leave()).toBe(attempt)
    await h.advance(10000)
    expect(h.run.snapshot().attempt).toBe(attempt)
  })
  it('preserves a completed valid attempt when leaving before Continue', async () => {
    const h = harness('maintenance')
    await h.run.begin(false)
    for (const end of [60000, 120000, 180000]) {
      await h.advance(end)
      if (h.run.snapshot().screen === 'summary') h.run.continue()
    }
    const attempt = h.run.snapshot().attempt!
    expect(attempt.valid).toBe(true)
    expect(h.run.leave()).toBe(attempt)
    expect(attempt.events.filter(event => event.type === 'session_completed')).toHaveLength(1)
    expect(attempt.events.some(event => event.type === 'session_invalidated')).toBe(false)
  })
})


describe('M5 repair: drill evidence', () => {
  it.each(['maintenance', 'detection', 'withholding', 'stability', 'consistency'] as const)('accepts intact %s and rejects contradictory completion, timing and quality', async id => {
    const h = harness(id)
    await h.run.begin(false)
    for (let block = 0; block < drillById(id).blocks.length; block++) {
      await h.advance(h.now() + 100000)
      await h.waitForScreen(block === drillById(id).blocks.length - 1 ? 'complete' : 'summary')
      if (h.run.snapshot().screen === 'summary') h.run.continue()
    }
    const attempt = h.run.snapshot().attempt!
    expect(verifyDrillAttempt(attempt, 'Space')).toBe(true)
    for (const mutation of ['invalid completion', 'invalid flag', 'hidden page', 'missing final fixation', 'short middle interval', 'missing offset', 'unsupported key', 'severe tail', 'false note']) {
      const changed = structuredClone(attempt)
      const events = changed.events as import('./engine/contracts').EngineEvent[]
      if (mutation === 'invalid flag') Object.assign(changed, { valid: 'true' })
      if (mutation === 'hidden page') events.splice(events.length - 2, 0, { ...events.at(-2)!, type: 'visibility_changed', payload: { visible: false } })
      if (mutation === 'invalid completion') Object.assign(events.find(e => e.type === 'session_completed')!.payload, { validity: 'invalid' })
      if (mutation === 'missing final fixation') {
        const end = events.findLastIndex(e => e.type === 'trial_resolved')
        for (let i = end + 1; i < events.length; i++) Object.assign(events[i], { timestampMs: events[end].timestampMs })
      }
      if (mutation === 'short middle interval') Object.assign(events.find(e => e.type === 'trial_scheduled' && e.payload.trial.index === 1)!.payload, { eligibleAtMs: 100 })
      if (mutation === 'missing offset') events.splice(events.findIndex(e => e.type === 'stimulus_removed'), 1)
      if (mutation === 'unsupported key') Object.assign(events[0].payload, { responseKey: 'KeyA' })
      if (mutation === 'severe tail' || mutation === 'false note') {
        const end = events.length - 2
        events.splice(end, 0, { ...events[end], type: 'timing_anomaly', payload: {
          trialIndex: null, issues: ['onset'], severity: mutation === 'severe tail' ? 'severe' : 'non_severe', expectedMs: 0, observedMs: 1000,
        } })
      }
      events.forEach((e, index) => { Object.assign(e, { sequenceNumber: index + 1 }); if (e.type === 'session_completed') Object.assign(e.payload, { eventCount: index + 1 }) })
      expect(verifyDrillAttempt(changed, 'Space'), mutation).toBe(false)
    }
  })
  it('emits a start only on begin, once per actual attempt', async () => {
    const started = vi.fn()
    const first = harness('detection', started)
    expect(started).not.toHaveBeenCalled()
    await first.run.begin(false)
    await first.run.begin(false)
    expect(started).toHaveBeenCalledTimes(1)
    first.run.leave()
    const second = harness('detection', started)
    await second.run.begin(false)
    expect(started).toHaveBeenCalledTimes(2)
    expect(started.mock.calls[0][0]).not.toBe(started.mock.calls[1][0])
    second.run.leave()
  })
})

it.each(['timing', 'extra inputs'] as const)('restores a valid drill with a reconciled %s quality note', async note => {
  const h = harness('maintenance', undefined, note === 'timing')
  await h.run.begin(false)
  if (note === 'extra inputs') {
    await h.advance(1350)
    h.run.engine.keyDown('Space'); h.run.engine.keyUp('Space')
    for (let i = 0; i < 5; i++) { h.run.engine.keyDown('Space'); h.run.engine.keyUp('Space') }
  }
  for (let block = 0; block < 3; block++) {
    await h.advance(h.now() + 100000)
    await h.waitForScreen(block === 2 ? 'complete' : 'summary')
    if (block < 2) h.run.continue()
  }
  const attempt = h.run.snapshot().attempt!
  expect(attempt.events.find(e => e.type === 'session_completed')?.payload.validity).toBe('valid_with_note')
  expect(verifyDrillAttempt(attempt, 'Space')).toBe(true)
})

it('M6-A drill missing initial frame ends technically without eligibility and ignores late callbacks', async () => {
  let late = () => {}
  const h = harness('maintenance', undefined, false, ready => { late = ready })
  await h.run.begin(false); await h.advance(2000)
  expect(h.run.snapshot().screen).toBe('invalid')
  expect(h.run.snapshot().attempt?.valid).toBe(false)
  const events = h.run.snapshot().attempt?.events
  late(); await h.advance(5000)
  expect(h.run.snapshot().attempt?.events).toEqual(events)
  expect(events?.some(e => e.type === 'stimulus_presented')).toBe(false)
})
