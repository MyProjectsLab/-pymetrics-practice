/// <reference types="node" />
// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { setImmediate } from 'node:timers'
import { createEventRecorder } from '../core/events'
import { STOP_EVENT_SCHEMA_VERSION } from './versions'
import type { PreparationEventPayloads } from './preparation'
import { createStopRun, verifyCompletedResult, developmentDrafts } from './run'
import type { StopResult } from './run'
import { createMemoryExposureRepository } from './exposure'
import { stopFormRegistry, stopV13FormRegistry } from './forms'
import { RULE } from './engine/rules'
import { activeTabResults } from './run'
import type { FrameRequest, Setting } from './engine/contracts'
import { inspectLocalState, setStopLocalStore, StopLocalStore, STOP_LOCAL_SCHEMA } from './storage'
import type { StopLocalState } from './storage'
import { routeStop } from './training'
import type { TrainingChain } from './training'

it.each(['1.1', '1.3'] as const)('admits one saved %s baseline chain atomically and rejects stale authority', async version => {
  const h = harness(() => 0, undefined, () => 0, 'baseline', undefined, undefined, undefined, undefined, version)
  await h.warmup(); await h.run.startScored(); await h.advance(195600)
  const saved = { ...h.run.snapshot().result!, storageMode: 'persistent_local' as const }
  expect(verifyCompletedResult(saved)).toBe(true)
  const exposure = { formId: saved.form.id, sessionId: saved.sessionId, exposedAtWall: saved.completedAtWall,
    visualProfile: saved.setup.visualProfile, deleted: false, certainty: 'confirmed' as const }
  const state: StopLocalState = { schemaVersion: STOP_LOCAL_SCHEMA, installationId: 'fixture', results: { [saved.sessionId]: saved },
    drafts: {}, chains: {}, retiredChains: {}, activeChainId: null,
    exposures: { [saved.form.id]: exposure }, reservations: {} }
  const store = Object.create(StopLocalStore.prototype) as StopLocalStore
  store.mutate = async change => change(state, { get: () => ({}) } as unknown as IDBObjectStore)
  const chain = { schemaVersion: 'stop_training_chain_v1', id: crypto.randomUUID(), baseline: saved,
    recommendation: routeStop(saved), drillAttempts: [], retestAttempts: [], retest: null, status: 'assigned' } as TrainingChain
  await store.createChainFromSavedBaseline(chain)
  expect(state.activeChainId).toBe(chain.id)
  expect(state.chains[chain.id]).toBe(chain)
  expect(inspectLocalState(state).activeChain?.id).toBe(chain.id)
  await expect(store.createChainFromSavedBaseline({ ...chain, id: crypto.randomUUID() })).rejects.toThrow('already has a chain')
  state.chains = {}; state.activeChainId = null
  state.deletedSessions = { [saved.sessionId]: true }
  await expect(store.createChainFromSavedBaseline(chain)).rejects.toThrow('no longer eligible')
  delete state.deletedSessions[saved.sessionId]
  state.exposures[saved.form.id] = { ...exposure, deleted: true }
  await expect(store.createChainFromSavedBaseline(chain)).rejects.toThrow('no longer eligible')
  state.exposures[saved.form.id] = exposure
  state.results[saved.sessionId] = { ...saved, reportVersion: 'wrong' } as unknown as StopResult
  await expect(store.createChainFromSavedBaseline(chain)).rejects.toThrow('no longer eligible')
})

function harness(delay: (request: FrameRequest) => number = () => 0, validate?: Parameters<typeof createStopRun>[0]['validate'],
  stall: (request: FrameRequest) => number = () => 0, mode: 'baseline' | 'replay' | 'retest' = 'baseline', wallClock?: () => number, completed?: Parameters<typeof createStopRun>[0]['completed'], initialFrame?: Parameters<typeof createStopRun>[0]['initialFrame'], admission?: Parameters<typeof createStopRun>[0]['admission'], specificationVersion: '1.1' | '1.3' = '1.1', experienceVersion?: 'stop_experience_v1_3') {
  let time = 0
  const jobs: { time: number; fn: () => void; canceled: boolean }[] = []
  function enqueue(time: number, fn: () => void) {
    const job = { time, fn, canceled: false }; jobs.push(job)
    return () => { job.canceled = true }
  }
  const clock = () => time
  const recorder = createEventRecorder<PreparationEventPayloads, typeof STOP_EVENT_SCHEMA_VERSION>({
    sessionId: crypto.randomUUID(), schemaVersion: STOP_EVENT_SCHEMA_VERSION, clock })
  recorder.record('guide_opened', { source: 'library' })
  if (experienceVersion) {
    recorder.record('onboarding_v13_opened', { ruleVersion: 'stop_rule_v1', visualProfile: 'standard' })
    recorder.record('onboarding_v13_answered', { questionId: 'go', answerId: 'press', correct: true, attempt: 1 })
    recorder.record('input_check_v13', { origin: 'reused', code: 'Space', proof: { code: 'Space', trustedDown: true, trustedUp: true,
      sameCode: true, unmodifiedDownAndUp: true, downWasNotRepeat: true, upWasNotRepeat: true }, receiptId: crypto.randomUUID(),
      tabNonce: crypto.randomUUID(), inputDeviceClass: 'physical_keyboard', physicalKeyboardDeclared: true,
      latencyAffectedInput: false, timingProfile: 'standard', visualProfile: 'standard' })
  } else recorder.record('device_check_completed', { inputBinding: 'Space', inputDeviceClass: 'physical_keyboard', visualProfile: 'standard', timingProfile: 'standard' })
  recorder.record('readiness_confirmed', { focused: true, visible: true })
  const exposure = createMemoryExposureRepository(specificationVersion === '1.3' ? stopV13FormRegistry.all : stopFormRegistry.all)
  const reserved = mode === 'retest' ? exposure.reserve(recorder.sessionId, () => 0, 'retest', 1_800_000) : null
  const run = createStopRun({ preparation: recorder, setup: { binding: { code: 'Space', label: 'Space' }, visualProfile: 'standard', physicalKeyboard: true },
    exposure, clock, completed, initialFrame, admission, wallClock: wallClock ?? clock, reservedFormId: reserved?.id, validate, scheduler: { at: enqueue, after: (t, fn) => enqueue(t + .001, fn) },
    frames: { request: (r, fn) => enqueue(r.notBeforeMs + delay(r), () => { time += stall(r); fn() }) }, clear() {}, changed() {}, random: () => 0,
    environment: { userAgent: 'deterministic fixture', width: 1024, height: 768 }, mode, specificationVersion, experienceVersion })
  async function settle() { for (let i = 0; i < 15; i++) await new Promise(resolve => setImmediate(resolve)) }
  return { run, exposure, clock, settle,
    async advance(target: number) {
      for (;;) {
        const job = jobs.filter(j => !j.canceled && j.time <= target).sort((a, b) => a.time - b.time)[0]
        if (!job) break
        job.canceled = true; time = Math.max(time, job.time); job.fn(); await settle()
      }
      time = Math.max(time, target); await settle()
    },
    async warmup() { run.begin(false); run.startWarmup(); await this.advance(18600) },
  }
}

describe('M2B-2 orchestration and retained development boundary', () => {
  it('runs fixed unscored warm-up then reconciles all 80 manifest trials, preserving every event', async () => {
    const h = harness(); await h.warmup()
    expect(h.run.snapshot().screen).toBe('warmup_complete')
    expect(h.run.snapshot().form).toBeNull()
    expect(h.exposure.snapshot()).toEqual([])
    const warmup = h.run.snapshot().engine.events.filter(e => e.type === 'trial_scheduled').map(e => e.payload.trial.stimulus)
    expect(warmup).toEqual(['GO', 'GO', 'NO_GO', 'GO', 'GO', 'GO', 'NO_GO', 'GO'])
    await h.run.startScored()
    expect(h.run.snapshot().form?.family).toBe('baseline')
    expect(h.exposure.snapshot()).toEqual([])
    await h.advance(19600)
    expect(h.exposure.snapshot()).toHaveLength(1)
    await h.advance(195599)
    expect(h.run.snapshot().draft).toBeNull()
    expect(h.run.protectedNow()).toBe(true)
    await h.advance(195600)
    const { result, engine } = h.run.snapshot()
    expect(h.run.snapshot().screen).toBe('complete')
    expect(engine.state).toBe('closed')
    expect(result?.summarySnapshot.counts).toEqual({ hits: 0, misses: 60, withholds: 20, falseAlarms: 0 })
    expect(result?.events.map(e => e.sequenceNumber)).toEqual(Array.from({ length: result!.events.length }, (_, i) => i + 1))
    expect(result?.events.slice(3)).toEqual(engine.events)
    expect(result?.events.filter(e => e.type === 'session_completed')).toHaveLength(1)
    expect(result?.events.at(-1)?.type).toBe('protection_ended')
    expect(result?.events.every(e => Object.isFrozen(e))).toBe(true)
    expect(result?.events.find(e => e.type === 'session_completed')).toMatchObject({ payload: {
      eventCount: result!.events.length - 1, validity: 'valid', checksum: result!.form.checksum, scoringVersion: 'stop_scoring_v1',
    } })
    expect(activeTabResults().find(r => r.sessionId === result?.sessionId)).toBe(result)
    expect(verifyCompletedResult(result!)).toBe(true)
    expect(verifyCompletedResult({ ...result!, events: result!.events.filter(e => e.type !== 'session_completed') })).toBe(false)
    expect(verifyCompletedResult({ ...result!, events: result!.events.map(e => e.type === 'session_completed' ? { ...e, payload: { ...e.payload, checksum: 'wrong' } } : e) })).toBe(false)
    h.run.viewReport()
    expect(h.run.snapshot().screen).toBe('report')
    expect(h.run.recoverReport()).toBe(true)
    expect(h.run.snapshot().result).toBe(result)
    expect(h.exposure.snapshot()).toHaveLength(1)
  })
  it.each([false, true])('release before onset vs consumption after onset: %s', async afterOnset => {
    const h = harness(); await h.warmup(); await h.run.startScored()
    const form = h.run.snapshot().form!
    await h.advance(afterOnset ? 19600 : 19599)
    h.run.leave(); await h.settle()
    expect(h.exposure.snapshot()).toHaveLength(afterOnset ? 1 : 0)
    expect(h.exposure.reserve('next', () => 0)?.id === form.id).toBe(!afterOnset)
    expect(h.run.snapshot().draft?.status).toBe('invalid')
    expect(h.run.snapshot().draft?.realizedSequence).toEqual(afterOnset ? [form.sequence[0]] : [])
    await h.advance(23000) // canceled onset must never consume a released reservation
    expect(h.exposure.snapshot()).toHaveLength(afterOnset ? 1 : 0)
  })
  it.each([false, true])('retains a confirmed onset before immediate timing/blur rejection (blur=%s)', async blur => {
    const h = harness(undefined, undefined, r => r.kind === 'onset' && r.trial.phase === 'scored' ? 600 : 0)
    await h.warmup(); await h.run.startScored()
    if (blur) { await h.advance(19100); h.run.engine.focus(false) }
    await h.advance(19600) // confirmation arrives at 20200 before stalled watchdogs can run
    const { draft, engine, form } = h.run.snapshot()
    expect(engine.invalidRule).toBe(blur ? RULE.blur : RULE.severeTiming)
    expect(draft?.status).toBe('invalid')
    expect(draft?.realizedSequence).toEqual([form!.sequence[0]])
    const presented = draft!.events.filter(e => e.type === 'stimulus_presented').at(-1)!
    expect(presented).toMatchObject({ timestampMs: 20200, payload: {
      trialIndex: 0, stimulus: form!.sequence[0], confirmedOnsetMs: 20200, eligibleAtMs: 19600,
    } })
    expect(h.exposure.snapshot()).toEqual([{ formId: form!.id, sessionId: draft!.sessionId, exposedAtMs: 20200 }])
    expect(presented.sequenceNumber).toBeLessThan(draft!.events.find(e => e.type === 'session_invalidated')!.sequenceNumber)
    expect(draft!.events.map(e => e.sequenceNumber)).toEqual(draft!.events.map((_, i) => i + 1))
    expect(draft!.events.slice(3)).toEqual(engine.events)
    expect(draft!.events.every((e, i, all) => !i || e.timestampMs >= all[i - 1].timestampMs)).toBe(true)
    expect(engine.results).toEqual([])
    expect(draft!.events.filter(e => e.type === 'trial_resolved')).toHaveLength(8) // warm-up only
    expect(draft!.events.some(e => ['session_completed', 'protection_ended'].includes(e.type))).toBe(false)
    expect(draft!.scoringVersion).toBeNull(); expect(draft!.summarySnapshot).toBeNull()
    expect(h.exposure.reserve('next', () => 0)?.id).not.toBe(form!.id)
    await h.advance(30000)
    expect(h.run.snapshot().draft).toEqual(draft)
  })
  it('one warm-up anomaly restarts the exact sequence; the second invalidates without exposure', async () => {
    const h = harness(r => r.kind === 'offset' ? 51 : 0)
    h.run.begin(false); h.run.startWarmup(); await h.advance(1251)
    expect(h.run.snapshot().screen).toBe('warmup_restart')
    expect(h.run.protectedNow()).toBe(false)
    h.run.startWarmup(); await h.advance(2502)
    expect(h.run.snapshot().engine.invalidRule).toBe(RULE.warmupTiming)
    expect(h.run.snapshot().screen).toBe('invalid')
    expect(h.run.snapshot().form).toBeNull()
    expect(h.exposure.snapshot()).toEqual([])
    expect(h.run.snapshot().engine.events.filter(e => e.type === 'trial_scheduled').map(e => e.payload.trial)).toEqual([
      { phase: 'warmup', index: 0, stimulus: 'GO' }, { phase: 'warmup', index: 0, stimulus: 'GO' },
    ])
  })
  it.each(['hidden', 'blur', 'pagehide', 'freeze', 'resize'] as const)('restarts %s during warm-up without form consumption', async kind => {
    const h = harness(); h.run.begin(false); h.run.startWarmup()
    if (kind === 'hidden') h.run.engine.visibility(false)
    else if (kind === 'blur') { h.run.engine.focus(false); await h.advance(1001) }
    else if (kind === 'resize') h.run.engine.resize(767, 600)
    else h.run.engine.lifecycle(kind)
    await h.settle()
    expect(h.run.snapshot().screen).toBe('warmup_restart')
    expect(h.run.snapshot().engine.events.some(e => e.type === 'warmup_interrupted')).toBe(true)
    expect(h.run.protectedNow()).toBe(false)
    expect(h.exposure.snapshot()).toEqual([])
    const count = h.run.snapshot().events.length
    await h.advance(20000)
    expect(h.run.snapshot().events).toHaveLength(count)
    h.run.startWarmup()
    expect(h.run.snapshot().screen).toBe('live')
    await h.advance(h.clock() + 1000)
    expect(h.run.snapshot().engine.events.filter(e => e.type === 'trial_scheduled').at(-1)?.payload.trial.index).toBe(0)
  })
  it('accepts a complete scored result after an interrupted warm-up restarts from trial 1', async () => {
    const h = harness(); h.run.begin(false); h.run.startWarmup()
    await h.advance(1500)
    h.run.engine.visibility(false); await h.settle()
    expect(h.run.snapshot().screen).toBe('warmup_restart')
    expect(h.exposure.snapshot()).toEqual([])
    h.run.startWarmup()
    await h.advance(1500 + 18600)
    expect(h.run.snapshot().screen).toBe('warmup_complete')
    await h.run.startScored()
    await h.advance(1500 + 18600 + 195600)
    const result = h.run.snapshot().result
    expect(result).not.toBeNull()
    expect(result?.events.some(event => event.type === 'warmup_interrupted')).toBe(true)
    expect(result?.events.filter(event => event.type === 'session_invalidated')).toHaveLength(0)
    expect(verifyCompletedResult(result!)).toBe(true)
    expect(h.exposure.snapshot()).toHaveLength(1)
  })
  it('keeps an accepted warm-up restart live while its browser initial frame is pending', async () => {
    let ready = () => {}
    const h = harness(undefined, undefined, undefined, 'baseline', undefined, undefined, (callback, current) => {
      ready = () => { if (current()) callback() }
      return () => {}
    })
    h.run.begin(false); h.run.startWarmup(); ready()
    await h.advance(1500)
    h.run.engine.visibility(false); await h.settle()
    expect(h.run.snapshot().screen).toBe('warmup_restart')
    h.run.startWarmup()
    // Visibility/focus restoration queues update before a real rAF can arrive.
    await h.settle()
    expect(h.run.snapshot().screen).toBe('live')
    ready()
    await h.advance(1500 + 18600)
    expect(h.run.snapshot().screen).toBe('warmup_complete')
    expect(h.run.snapshot().engine.results.map(result => result.trial.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
    expect(h.exposure.snapshot()).toEqual([])
    await h.run.startScored(); ready()
    await h.advance(1500 + 18600 + 177000)
    expect(h.run.snapshot().result?.validity).toBe('valid')
    expect(verifyCompletedResult(h.run.snapshot().result!)).toBe(true)
    h.run.leave()
  })
  it.each(['response_key', 'visual_profile', 'timing_profile', 'input_device_class', 'accessibility'] satisfies Setting[])('invalidates attempted %s change during scored protection', async setting => {
    const h = harness(); await h.warmup(); await h.run.startScored(); h.run.engine.settingChanged(setting); await h.settle()
    expect(h.run.snapshot().engine.invalidRule).toBe(RULE.settings)
    expect(h.run.snapshot().screen).toBe('invalid')
  })
  it('warm-up complete is an untimed pause; scored blur still invalidates', async () => {
    const h = harness(); await h.warmup()
    for (let i = 0; i < 3; i++) {
      await h.advance(h.clock() + 999)
    }
    expect(h.run.protectedNow()).toBe(false)
    await h.run.startScored()
    expect(h.run.protectedNow()).toBe(true)
    h.run.engine.focus(false); await h.advance(h.clock() + 1001)
    expect(h.run.snapshot().engine.invalidRule).toBe(RULE.blur)
  })
  it('waits indefinitely at warm-up complete, rechecks admission, then protects scored initial fixation', async () => {
    const gate = { visible: true, focused: true, held: false, width: 1024, height: 768, compatible: true }
    const h = harness(undefined, undefined, undefined, 'baseline', undefined, undefined, undefined, () => gate)
    await h.warmup()
    const completedAt = h.clock()
    await h.advance(completedAt + 3_600_000)
    expect(h.run.snapshot().screen).toBe('warmup_complete')
    expect(h.run.snapshot().engine.events.some(e => e.type === 'session_invalidated')).toBe(false)
    expect(h.exposure.snapshot()).toEqual([])
    for (const [change, reason] of [
      [{ visible: false }, 'Return to this tab'], [{ focused: false }, 'Return to this tab'],
      [{ held: true }, 'Release Space'], [{ width: 767 }, 'Enlarge the window'],
      [{ compatible: false }, 'Confirm the required response key'],
    ] as const) {
      Object.assign(gate, change)
      await h.run.startScored()
      expect(h.run.snapshot().screen).toBe('warmup_complete')
      expect(h.run.snapshot().admissionMessage).toContain(reason)
      expect(h.run.protectedNow()).toBe(false)
      Object.assign(gate, { visible: true, focused: true, held: false, width: 1024, compatible: true })
    }
    await h.run.startScored()
    expect(h.run.protectedNow()).toBe(true)
    const events = h.run.snapshot().engine.events
    expect(events.at(-1)?.type).toBe('fixation_started')
    expect(events.findLast(e => e.type === 'protection_started')!.sequenceNumber).toBeLessThan(events.at(-1)!.sequenceNumber)
    expect(events.filter(e => e.type === 'stimulus_presented' && e.payload.trialIndex === 0)).toHaveLength(1) // warm-up only
  })
  it('distinguishes invalidation immediately before and after first scored onset', async () => {
    const before = harness(); await before.warmup(); await before.run.startScored()
    const form = before.run.snapshot().form!
    before.run.engine.visibility(false); await before.settle()
    expect(before.run.snapshot().draft?.invalidRule).toBe(RULE.hidden)
    expect(before.run.snapshot().draft?.form?.id).toBe(form.id)
    expect(before.run.snapshot().draft?.realizedSequence).toEqual([])
    expect(before.exposure.snapshot()).toEqual([])
    const after = harness(); await after.warmup(); await after.run.startScored()
    await after.advance(after.clock() + 1000)
    const confirmed = after.run.snapshot().form!
    after.run.engine.visibility(false); await after.settle()
    expect(after.run.snapshot().draft?.invalidRule).toBe(RULE.hidden)
    expect(after.run.snapshot().draft?.realizedSequence).toEqual([confirmed.sequence[0]])
    expect(after.exposure.snapshot().map(marker => marker.formId)).toEqual([confirmed.id])
  })
  it('retains M2B-02 early, post-offset, timeout anchors and no inherited input', async () => {
    const h = harness(); await h.warmup(); await h.run.startScored()
    const start = h.clock()
    h.run.engine.keyDown('Space'); h.run.engine.keyDown('Space', true)
    await h.advance(start + 1000)
    h.run.engine.keyDown('Space') // held through onset
    expect(h.run.snapshot().engine.results).toHaveLength(0)
    h.run.engine.keyUp('Space')
    await h.advance(start + 1150); h.run.engine.keyDown('Space'); h.run.engine.keyUp('Space')
    await h.advance(start + 1200)
    h.run.engine.keyDown('Space'); h.run.engine.keyUp('Space') // extra
    await h.advance(start + 2400) // offset + 1200
    h.run.engine.keyDown('KeyX')
    await h.advance(start + 2750); h.run.engine.keyDown('Space'); h.run.engine.keyUp('Space')
    await h.advance(start + 3950) // resolution + 1200
    await h.advance(start + 4951); h.run.engine.keyDown('Space'); h.run.engine.keyUp('Space') // late
    await h.advance(start + 6150) // timeout + 1200
    const ev = h.run.snapshot().engine.events
    const scored = ev.filter(e => e.type === 'stimulus_presented').slice(8)
    expect(scored.map(e => e.timestampMs - start)).toEqual([1000, 2400, 3950, 6150])
    expect(ev.filter(e => e.type === 'response_ignored').map(e => e.payload.reason)).toEqual(expect.arrayContaining(['fixation', 'repeat', 'held', 'extra', 'wrong_key', 'late']))
    expect(h.run.snapshot().engine.invalidRule).toBeNull()
  })
  it('exhaustion ends with a development record, without a reused form', async () => {
    const h = harness()
    for (let i = 0; i < 4; i++) { h.exposure.reserve(`prior-${i}`, () => 0); h.exposure.expose(`prior-${i}`, i); h.exposure.release(`prior-${i}`) }
    await h.warmup(); await h.run.startScored()
    expect(h.run.snapshot().screen).toBe('exhausted')
    expect(h.run.snapshot().form).toBeNull()
    expect(h.run.snapshot().draft?.status).toBe('no_unused_form')
  })
  it('keeps protection during asynchronous completion validation and never closes an interrupted draft', async () => {
    let calls = 0
    let release!: (issues: []) => void
    const h = harness(undefined, async () => {
      if (++calls === 1) return []
      return new Promise<[]>(resolve => { release = resolve })
    })
    await h.warmup(); await h.run.startScored(); await h.advance(195600)
    expect(h.run.protectedNow()).toBe(true)
    expect(h.run.snapshot().draft).toBeNull()
    h.run.engine.visibility(false); release([]); await h.settle()
    expect(h.run.snapshot().draft?.status).toBe('invalid')
    expect(h.run.snapshot().events.some(e => e.type === 'protection_ended')).toBe(false)
    expect(h.run.snapshot().events.some(e => e.type === 'session_completed')).toBe(false)
    expect(activeTabResults().find(r => r.sessionId === h.run.snapshot().draft?.sessionId)).toBeUndefined()
  })
  it('uses replay forms only for an explicitly selected replay and preserves exposure', async () => {
    const h = harness()
    await h.warmup()
    const before = h.exposure.snapshot()
    expect(before).toHaveLength(0)
    await h.run.startScored()
    expect(h.run.snapshot().form?.family).toBe('baseline')
    const chosen = h.run.snapshot().form!.id
    h.run.leave(); await h.settle()
    expect(h.exposure.reserve('fresh', () => 0)?.family).toBe('baseline')
    expect(h.exposure.reserve('replay', () => 0, 'replay')?.family).toBe('replay')
    expect(h.exposure.snapshot()).toHaveLength(0)
    h.exposure.release('fresh')
    expect(h.exposure.reserve('another', () => 0)?.id).toBe(chosen)
  })
  it('uses an unexposed replay form and stops when the replay family is exhausted', async () => {
    const h = harness(undefined, undefined, undefined, 'replay')
    await h.warmup(); await h.run.startScored()
    const form = h.run.snapshot().form!
    expect(form.family).toBe('replay')
    expect(h.exposure.snapshot()).toEqual([])
    await h.advance(19600)
    expect(h.exposure.snapshot().map(e => e.formId)).toEqual([form.id])
    h.run.leave(); await h.settle()
    expect(h.run.snapshot().draft).toMatchObject({ mode: 'replay', status: 'invalid' })
    for (const replay of stopFormRegistry.all.filter(f => f.family === 'replay' && f.id !== form.id)) {
      const reserved = h.exposure.reserve(replay.id, () => 0, 'replay')!
      expect(reserved.id).toBe(replay.id)
      h.exposure.expose(replay.id, h.clock())
      h.exposure.release(replay.id)
    }
    expect(h.exposure.reserve('exhausted-replay', () => 0, 'replay')).toBeNull()
    expect(h.exposure.reserve('available-baseline', () => 0, 'baseline')?.family).toBe('baseline')
  })
  it('completes an ordinary replay as a descriptive result without a retest or training action', async () => {
    const h = harness(undefined, undefined, undefined, 'replay')
    await h.warmup(); await h.run.startScored(); await h.advance(195600)
    expect(h.run.snapshot().screen).toBe('complete')
    expect(h.run.snapshot().result).toMatchObject({ mode: 'replay', form: { family: 'replay' }, validity: 'valid' })
    expect(h.run.snapshot().result?.events.filter(e => e.type === 'session_completed')).toHaveLength(1)
  })
  it.each([1, 2])('stops when manifest validation fails at check %s', async failingCall => {
    let calls = 0
    const h = harness(undefined, async form => ++calls === failingCall ? [{ code: 'checksum', formId: form.id, detail: 'QA mismatch' }] : [])
    await h.warmup(); await h.run.startScored(); await h.advance(195600)
    expect(h.run.snapshot().draft?.status).toBe('invalid')
    expect(h.run.snapshot().engine.invalidRule).toBe(RULE.integrity)
    expect(h.exposure.snapshot()).toHaveLength(failingCall === 1 ? 0 : 1)
    expect(h.run.snapshot().draft?.events).toContainEqual(expect.objectContaining({
      type: 'integrity_checked', payload: { valid: false, detail: failingCall === 1
        ? 'Assigned manifest validation failed' : 'Assigned manifest or continuous journal mismatch' },
    }))
  })
  it('a held response key at scored activation cannot leak into the first trial', async () => {
    const h = harness(); await h.warmup()
    h.run.engine.keyDown('Space'); await h.run.startScored()
    await h.advance(30000)
    expect(h.run.snapshot().engine.state).toBe('arming')
    expect(h.exposure.snapshot()).toHaveLength(0)
    h.run.engine.keyUp('Space'); await h.advance(31000)
    expect(h.run.snapshot().engine.state).toBe('response')
    expect(h.run.snapshot().engine.results).toHaveLength(0)
    expect(h.exposure.snapshot()).toHaveLength(1)
  })
  it('an unhandled integration failure uses the technical recovery rule', async () => {
    const h = harness(); h.run.begin(false); h.run.engine.technicalFailure('fixture failure'); await h.settle()
    expect(h.run.snapshot().engine.invalidRule).toBe(RULE.integrity)
    expect(h.run.snapshot().draft?.events).toContainEqual(expect.objectContaining({
      type: 'integrity_checked', payload: { valid: false, detail: 'fixture failure' },
    }))
  })
})

describe('M4 retest reservation and consumption integration (S50–S52)', () => {
  it('reuses only the explanation reservation, releases before onset, and consumes after confirmed onset', async () => {
    const before = harness(undefined, undefined, undefined, 'retest')
    await before.warmup(); await before.run.startScored()
    const form = before.run.snapshot().form!
    await before.advance(19_599)
    before.run.leave(); await before.settle()
    expect(before.exposure.snapshot()).toEqual([])
    expect(before.exposure.reserve('new-explanation', () => 0, 'retest', 1_800_000)?.id).toBe(form.id)
    const after = harness(undefined, undefined, undefined, 'retest')
    await after.warmup(); await after.run.startScored()
    const selected = after.run.snapshot().form!
    await after.advance(19_600)
    after.run.leave(); await after.settle()
    expect(after.exposure.snapshot().map(marker => marker.formId)).toEqual([selected.id])
    expect(after.exposure.reserve('retry', () => 0, 'retest', 1_800_000)?.id).not.toBe(selected.id)
    expect(after.run.snapshot().draft?.mode).toBe('retest')
  })
  it('expires without consuming before scored start and never substitutes another form', async () => {
    let wall = 0
    const h = harness(undefined, undefined, undefined, 'retest', () => wall)
    await h.warmup()
    wall = 1_800_000
    await h.run.startScored()
    expect(h.run.snapshot().screen).toBe('reservation_expired')
    expect(h.exposure.snapshot()).toEqual([])
    expect(h.run.snapshot().form).toBeNull()
  })
  it('rechecks before scored presentation and retains a real confirmed presentation if expiry races later', async () => {
    let wall = 0
    const h = harness(undefined, undefined, undefined, 'retest', () => wall)
    await h.warmup(); await h.run.startScored()
    expect(h.run.canPresentScored()).toBe(true)
    wall = 1_800_000
    expect(h.run.canPresentScored()).toBe(false)
    await h.settle()
    expect(h.run.snapshot().screen).toBe('reservation_expired')
    expect(h.run.snapshot().draft).toBeNull()
    expect(h.run.snapshot().engine.events.at(-1)?.type).toBe('pre_onset_aborted')
    expect(h.exposure.snapshot()).toEqual([])
  })
  it.each([1_800_000, 1_800_001])('invalidates a confirmed first onset at expired wall time %i after a successful guard', async onsetWall => {
    let wall = 1_799_999
    const h = harness(undefined, undefined, undefined, 'retest', () => wall)
    await h.warmup(); await h.run.startScored()
    const form = h.run.snapshot().form!
    expect(h.run.canPresentScored()).toBe(true)
    wall = onsetWall
    await h.advance(19_600)
    const { draft, engine, result } = h.run.snapshot()
    expect(draft?.status).toBe('invalid')
    expect(draft?.form?.id).toBe(form.id)
    expect(draft?.realizedSequence).toEqual([form.sequence[0]])
    expect(draft?.events.filter(event => event.type === 'stimulus_presented' && event.payload.trialIndex === 0).at(-1)).toMatchObject({
      payload: { confirmedOnsetMs: 19_600, stimulus: form.sequence[0] },
    })
    expect(h.exposure.snapshot()).toEqual([{ formId: form.id, sessionId: draft!.sessionId, exposedAtMs: 19_600 }])
    expect(engine.invalidRule).toBe(RULE.integrity)
    expect(engine.results).toEqual([])
    expect(result).toBeNull()
    expect(draft?.events.some(event => event.type === 'session_completed')).toBe(false)
    expect(h.exposure.reserve('next', () => 0, 'retest', onsetWall + 1)?.id).not.toBe(form.id)
    await h.advance(25_000)
    expect(h.run.snapshot().draft).toBe(draft)
  })
  it('keeps a form consumed when the reservation expires after a valid first onset', async () => {
    let wall = 1_799_999
    const h = harness(undefined, undefined, undefined, 'retest', () => wall)
    await h.warmup(); await h.run.startScored()
    expect(h.run.canPresentScored()).toBe(true)
    await h.advance(19_600)
    const form = h.run.snapshot().form!
    wall = 1_800_001
    expect(h.run.canPresentScored()).toBe(true)
    await h.advance(195_600)
    expect(h.run.snapshot().result?.form.id).toBe(form.id)
    expect(verifyCompletedResult(h.run.snapshot().result!)).toBe(true)
    expect(h.exposure.snapshot().map(marker => marker.formId)).toEqual([form.id])
  })
  it('completes a scored retest under the unchanged standard scorer and verifies its same-tab result', async () => {
    const h = harness(undefined, undefined, undefined, 'retest')
    await h.warmup(); await h.run.startScored(); await h.advance(195_600)
    const result = h.run.snapshot().result!
    expect(result.mode).toBe('retest')
    expect(result.form.family).toBe('retest')
    expect(result.summarySnapshot.counts).toEqual({ hits: 0, misses: 60, withholds: 20, falseAlarms: 0 })
    expect(verifyCompletedResult(result)).toBe(true)
    expect(h.exposure.snapshot()).toHaveLength(1)
  })
})

describe('memory exposure repository', () => {
  it('injects local tie-breaking, rejects invalid randomness, and never consumes a reservation', () => {
    const repo = createMemoryExposureRepository()
    const baseline = stopFormRegistry.all.filter(f => f.family === 'baseline')
    expect(repo.reserve('one', () => .99)?.id).toBe(baseline[3].id)
    expect(repo.snapshot()).toEqual([])
    expect(repo.reserve('one', () => 0)?.id).toBe(baseline[3].id)
    repo.release('one')
    expect(repo.reserve('two', () => .99)?.id).toBe(baseline[3].id)
    expect(() => repo.reserve('bad', () => 1)).toThrow()
    repo.expose('two', 100); repo.release('two')
    expect(repo.reserve('three', () => .99)?.id).not.toBe(baseline[3].id)
    expect(Object.isFrozen(repo.snapshot()[0])).toBe(true)
  })
})


describe('M3 B1–B3 audit repair regressions', () => {
  async function completed(extra = 0, timingNote = false) {
    const h = harness(r => timingNote && r.trial.phase === 'scored' && r.trial.index === 0 && r.kind === 'offset' ? 51 : 0)
    await h.warmup(); await h.run.startScored(); await h.advance(19950)
    h.run.engine.keyDown('Space'); h.run.engine.keyUp('Space')
    for (let i = 0; i < extra; i++) { h.run.engine.keyDown('Space'); h.run.engine.keyUp('Space') }
    await h.advance(200000)
    return h
  }
  it.each(['presentation identity', 'missing presentations', 'accepted response timing', 'form seed', 'invalidation',
    'missing offset', 'duplicate resolution', 'quality note missing', 'summary mismatch', 'completion count'])(
    'rejects corrupted %s in actual same-tab recovery while preserving evidence and exposure', async fault => {
      const h = await completed(5)
      const original = h.run.snapshot().result!
      expect(verifyCompletedResult(original)).toBe(true)
      const r = structuredClone(original)
      let events = [...r.events]
      const start = events.findIndex(e => e.type === 'trial_scheduled' && e.payload.trial.phase === 'scored')
      const mutate = (type: string, change: (e: any) => void) => {
        const event = events.slice(start).find(e => e.type === type)!
        change(event)
      }
      switch (fault) {
        case 'presentation identity': mutate('stimulus_presented', e => { e.payload.stimulus = 'NO_GO' }); break
        case 'missing presentations': events = events.filter(e => e.type !== 'stimulus_presented'); break
        case 'accepted response timing': mutate('response_accepted', e => { e.payload.responseTimeMs = 999 }); break
        case 'form seed': Object.assign(r.form, { seedId: 'wrong-seed' }); break
        case 'invalidation': events.splice(events.length - 2, 0, { ...events[events.length - 2], schemaVersion: 'stop_engine_event_v1', type: 'session_invalidated', payload: { ruleId: RULE.hidden, triggerSequenceNumber: 1 } }); break
        case 'missing offset': events.splice(events.findIndex((e, i) => i >= start && e.type === 'stimulus_removed'), 1); break
        case 'duplicate resolution': events.splice(start + 1, 0, events.slice(start).find(e => e.type === 'trial_resolved')!); break
        case 'quality note missing': events = events.filter(e => e.type !== 'quality_note'); break
        case 'summary mismatch': Object.assign(r.summarySnapshot.counts, { hits: 60 }); break
      }
      // Reconcile the envelope: the test must exercise deeper checks than a gap.
      events = events.map((e, i) => e.type === 'session_completed'
        ? { ...e, sequenceNumber: i + 1, payload: { ...e.payload, eventCount: i + (fault === 'completion count' ? 2 : 1) } }
        : { ...e, sequenceNumber: i + 1 })
      const corrupt = { ...r, events }
      const before = JSON.stringify(corrupt), exposure = h.exposure.snapshot()
      expect(verifyCompletedResult(corrupt)).toBe(false)
      const get = Map.prototype.get
      const spy = vi.spyOn(Map.prototype, 'get').mockImplementation(function (this: Map<unknown, unknown>, key) {
        const value = get.call(this, key)
        return value === original ? corrupt : value
      })
      try { expect(h.run.recoverReport()).toBe(false) } finally { spy.mockRestore() }
      expect(h.run.snapshot()).toMatchObject({ screen: 'invalid', result: null, draft: { status: 'invalid', invalidRule: RULE.integrity } })
      expect(h.run.snapshot().draft?.events).toEqual(corrupt.events)
      expect(h.run.snapshot().draft?.rejectedRecoveryRecord).toBe(corrupt)
      const rejectedDraft = h.run.snapshot().draft
      expect(h.run.recoverReport()).toBe(false)
      expect(h.run.snapshot().draft).toBe(rejectedDraft)
      expect(developmentDrafts().find(d => d.sessionId === original.sessionId)).toBe(h.run.snapshot().draft)
      expect(h.run.snapshot().engine.events).toEqual(original.events.slice(3))
      expect(h.exposure.snapshot()).toEqual(exposure)
      expect(h.run.snapshot().form).toBe(original.form)
      expect(activeTabResults().some(r => r.sessionId === original.sessionId)).toBe(false)
      expect(JSON.stringify(corrupt)).toBe(before)
    })
  it.each([0, 4, 5, 9, 10])('extra-input boundary %s preserves outcomes, note and invalidation rules', async extra => {
    const h = await completed(extra)
    if (extra === 10) {
      expect(h.run.snapshot()).toMatchObject({ screen: 'invalid', result: null, draft: { invalidRule: RULE.extra } })
      expect(h.exposure.snapshot()).toHaveLength(1)
      return
    }
    const result = h.run.snapshot().result!
    expect(result.validity).toBe('valid')
    expect(result.summarySnapshot.counts).toEqual({ hits: 1, misses: 59, withholds: 20, falseAlarms: 0 })
    expect(result.events.some(e => e.type === 'quality_note' && e.payload.ruleId === RULE.extraNote)).toBe(extra >= 5)
    expect(verifyCompletedResult(result)).toBe(true)
    const exposure = h.exposure.snapshot()
    expect(h.run.recoverReport()).toBe(true)
    expect(h.run.snapshot().result).toBe(result)
    expect(h.exposure.snapshot()).toEqual(exposure)
  })
  it('recovers an intact record with both timing and extra-input notes', async () => {
    const h = await completed(5, true)
    const result = h.run.snapshot().result!
    expect(result.validity).toBe('valid_with_note')
    expect(result.events.filter(e => e.type === 'quality_note').map(e => e.payload.ruleId)).toEqual([RULE.timingNote, RULE.extraNote])
    expect(verifyCompletedResult(result)).toBe(true)
    expect(h.run.recoverReport()).toBe(true)
  })
})

function completionStore(fake: StopLocalStore): StopLocalStore {
  const saved: Record<string, StopResult> = {}
  const save = fake.saveResult?.bind(fake)
  return Object.assign(fake, {
    subscribeDeletion: () => () => {}, sameInstallation: () => true, installationIdentity: () => undefined,
    release: fake.release ?? (async () => {}),
    read: async () => ({ results: saved, retiredChains: {}, deletedSessions: {} }),
    saveResult: async (result: StopResult, chainId?: string) => { await save?.(result, chainId); saved[result.sessionId] = result },
  })
}

describe('M5 completion storage boundary (S59)', () => {
  it.each(['dependency', 'result', 'installation'])('C2 never retries typed %s deletion or completes a temporary chain', async scope => {
    const { DeletedChainError, InstallationClearedError } = await import('./storage')
    let reject!: (error: Error) => void
    const callback = vi.fn(), save = vi.fn(() => new Promise<void>((_yes, no) => { reject = no }))
    const form = stopFormRegistry.all.find(f => f.family === 'baseline')!
    const fake = completionStore({ reserve: async () => ({ formId: form.id }), arm: async () => {}, confirm: async () => {},
      saveResult: save, activity: async () => {} } as unknown as StopLocalStore)
    setStopLocalStore(fake)
    try {
      const h = harness(undefined, undefined, undefined, 'baseline', undefined, callback)
      await h.warmup(); await h.run.startScored(); await h.advance(195600)
      const result = h.run.snapshot().result!
      h.run.viewReport()
      const state = { results: {}, retiredChains: {}, deletedSessions: scope === 'result' ? { [result.sessionId]: true } : {} } as unknown as StopLocalState
      reject(scope === 'installation' ? new InstallationClearedError('Deleted all') : new DeletedChainError('Deleted dependency', state))
      await h.settle()
      expect(save).toHaveBeenCalledOnce(); expect(callback).not.toHaveBeenCalled()
      expect(h.run.snapshot()).toMatchObject({ storageFailure: false, reviewOnly: true, screen: 'report',
        saveStatus: scope === 'dependency' ? 'review_only' : 'deleted' })
      if (scope === 'dependency') expect(h.run.snapshot().result!.events).toBe(result.events)
      else expect(activeTabResults().some(r => r.sessionId === result.sessionId)).toBe(false)
    } finally { setStopLocalStore(null) }
  })
  it.each(['rejected', 'delivered'] as const)('old installation completion %s preserves replacement tab records and chain', async delivery => {
    const { InstallationClearedError } = await import('./storage')
    const { restoreStopRecords } = await import('./run')
    const { beginTrainingChain, restoreTrainingChain, currentTrainingChain } = await import('./training')
    const fresh = harness(); await fresh.warmup(); await fresh.run.startScored(); await fresh.advance(195600)
    const replacement = fresh.run.snapshot().result!, chain = beginTrainingChain(replacement)
    restoreTrainingChain(null, true)
    let identity = 'old', deliver!: () => void, reject!: (error: Error) => void
    const form = stopFormRegistry.all.find(f => f.family === 'baseline')!
    const fake = { reserve: async () => ({ formId: form.id }), arm: async () => {}, confirm: async () => {},
      saveResult: () => new Promise<void>((yes, no) => { deliver = yes; reject = no }), release: async () => {},
      activity: async () => {}, sameInstallation: () => true, installationIdentity: () => identity,
      read: async () => ({ installationId: identity, results: { [replacement.sessionId]: replacement }, retiredChains: {}, deletedSessions: {} }),
      subscribeDeletion: () => () => {},
    } as unknown as StopLocalStore
    setStopLocalStore(fake)
    try {
      const h = harness(); await h.warmup(); await h.run.startScored(); await h.advance(195600)
      h.run.leave(); identity = 'replacement'
      restoreStopRecords([replacement], []); restoreTrainingChain(chain)
      if (delivery === 'rejected') reject(new InstallationClearedError('Old installation'))
      else deliver()
      await h.settle()
      expect(h.run.snapshot()).toMatchObject({ result: null, saveStatus: 'deleted' })
      expect(activeTabResults()).toContainEqual(replacement)
      expect(currentTrainingChain()).toEqual(chain)
    } finally { setStopLocalStore(null); restoreTrainingChain(null, true) }
  })
  it.each([false, true])('C4 checks actual retention after delayed success; notification=%s', async notification => {
    let deliver!: () => void, notify = () => {}
    const state = { results: {}, retiredChains: {}, deletedSessions: {} } as unknown as StopLocalState
    const callback = vi.fn(), form = stopFormRegistry.all.find(f => f.family === 'baseline')!
    const save = vi.fn(async (r: StopResult) => { state.results[r.sessionId] = r; await new Promise<void>(yes => { deliver = yes }) })
    const fake = { reserve: async () => ({ formId: form.id }), arm: async () => {}, confirm: async () => {},
      saveResult: save, release: async () => {}, activity: async () => {}, sameInstallation: () => true, installationIdentity: () => undefined, read: async () => structuredClone(state),
      subscribeDeletion: (fn: () => void) => { notify = fn; return () => {} },
    } as unknown as StopLocalStore
    setStopLocalStore(fake)
    try {
      const h = harness(undefined, undefined, undefined, 'baseline', undefined, callback)
      await h.warmup(); await h.run.startScored(); await h.advance(195600)
      const id = h.run.snapshot().result!.sessionId
      expect(state.results[id]).toBeDefined(); h.run.viewReport()
      delete state.results[id]; state.deletedSessions![id] = true
      if (notification) { notify(); await h.settle() }
      deliver(); await h.settle()
      expect(save).toHaveBeenCalledOnce(); expect(callback).not.toHaveBeenCalled()
      expect(h.run.snapshot()).toMatchObject({ screen: 'report', saveStatus: 'deleted', result: null, storageFailure: false })
      notify(); await h.settle()
      expect(h.run.snapshot().result).toBeNull()
    } finally { setStopLocalStore(null) }
  })

  it.each(['before transaction', 'after commit'])('C1 exposes completion and releases ownership with confirmation held %s', async boundary => {
    let signal: AbortSignal | undefined, deliver!: () => void, save!: () => void
    let confirmationCommitted = false
    const completedCallback = vi.fn()
    const saveResult = vi.fn(() => new Promise<void>(resolve => { save = resolve }))
    const fake = {
      arm: async () => {}, confirm: async (_id: string, _form: string, _date: string, _chain: string | null, abort: AbortSignal) => {
        signal = abort
        if (boundary === 'after commit') confirmationCommitted = true
        await new Promise<void>(resolve => { deliver = resolve })
        abort.throwIfAborted()
        confirmationCommitted = true
      },
      release: async () => {}, saveResult, activity: async () => {},
    } as unknown as StopLocalStore
    setStopLocalStore(completionStore(fake))
    try {
      const h = harness(undefined, undefined, undefined, 'retest', undefined, completedCallback)
      await h.warmup(); await h.run.startScored(); await h.advance(195600)
      const completed = h.run.snapshot().result!
      expect(verifyCompletedResult(completed)).toBe(true)
      expect(h.run.snapshot().screen).toBe('complete')
      expect(signal?.aborted).toBe(true)
      expect(h.run.snapshot()).toMatchObject({ saveStatus: 'pending', storageFailure: false })
      expect(completed.storageMode).toBe('temporary_memory')
      expect(saveResult).toHaveBeenCalledOnce()
      expect(completedCallback).not.toHaveBeenCalled()
      h.run.viewReport(); h.run.leave(); h.run.leave()
      expect(h.run.snapshot().screen).toBe('report')
      expect(h.run.snapshot().result).toBe(completed)
      save(); await h.settle()
      expect(h.run.snapshot()).toMatchObject({ screen: 'report', saveStatus: 'saved', storageFailure: false })
      expect(h.run.snapshot().result!.events).toBe(completed.events)
      expect(h.run.snapshot().result!.summarySnapshot).toBe(completed.summarySnapshot)
      deliver(); await h.settle()
      expect(confirmationCommitted).toBe(boundary === 'after commit')
      expect(saveResult).toHaveBeenCalledOnce()
      expect(h.run.snapshot().result!.storageMode).toBe('persistent_local')
      expect(h.run.snapshot().draft).toBeNull()
      expect(completedCallback).toHaveBeenCalledExactlyOnceWith(h.run.snapshot().result)
    } finally { setStopLocalStore(null) }
  })

  it('cancels confirmation on leaving a completed retest without rewriting its completed journal', async () => {
    let signal: AbortSignal | undefined, finish!: () => void
    const fake = {
      arm: async () => {}, confirm: (_id: string, _form: string, _date: string, _chain: string | null, abort: AbortSignal) => {
        signal = abort; return new Promise<void>(resolve => { finish = resolve })
      },
      release: async () => {}, saveResult: async () => {}, activity: async () => {},
    } as unknown as StopLocalStore
    setStopLocalStore(completionStore(fake))
    try {
      const h = harness(undefined, undefined, undefined, 'retest')
      await h.warmup(); await h.run.startScored(); await h.advance(195600)
      expect(h.run.snapshot().engine.state).toBe('closed')
      const journal = h.run.snapshot().result!.events
      h.run.leave()
      expect(signal?.aborted).toBe(true)
      expect(h.run.snapshot().result!.events).toBe(journal)
      expect(h.run.snapshot().exposed).toBe(true)
      finish(); await h.settle()
    } finally { setStopLocalStore(null) }
  })
  it('keeps an ordinary baseline confirmation failure visible after lifecycle cancellation', async () => {
    let reject!: (error: Error) => void
    const form = stopFormRegistry.all.find(item => item.family === 'baseline')!
    const fake = {
      reserve: async (sessionId: string) => ({ sessionId, formId: form.id }),
      arm: async () => {}, confirm: () => new Promise<void>((_resolve, fail) => { reject = fail }),
      release: async () => {}, saveDraft: async () => {}, activity: async () => {},
    } as unknown as StopLocalStore
    setStopLocalStore(completionStore(fake))
    try {
      const h = harness(); await h.warmup(); await h.run.startScored(); await h.advance(19600)
      h.run.leave(); reject(new Error('ordinary baseline storage failure')); await h.settle()
      expect(h.run.snapshot().storageFailure).toBe(true)
      expect(h.run.snapshot().draft?.realizedSequence).toHaveLength(1)
    } finally { setStopLocalStore(null) }
  })
  it.each([1, 2])('retries one failed completion write; %i failures', async failures => {
    let writes = 0
    const form = stopFormRegistry.all.find(item => item.family === 'baseline')!
    const fake = {
      reserve: async (sessionId: string) => ({ sessionId, formId: form.id, family: 'baseline', expiresAtMs: null, chainId: null, armed: false }),
      arm: async () => {}, confirm: async () => {}, release: async () => {},
      saveResult: async () => { if (++writes <= failures) throw new Error('injected completion write failure') },
      saveDraft: async () => {}, activity: async () => {},
    } as unknown as StopLocalStore
    setStopLocalStore(completionStore(fake))
    try {
      const h = harness(); await h.warmup(); await h.run.startScored(); await h.advance(195_600)
      const { result, screen, storageFailure } = h.run.snapshot()
      expect(screen).toBe('complete')
      expect(writes).toBe(2)
      expect(result?.validity).toBe('valid')
      expect(result?.storageMode).toBe(failures === 1 ? 'persistent_local' : 'temporary_memory')
      expect(storageFailure).toBe(failures === 2)
      expect(verifyCompletedResult(result!)).toBe(true)
      expect(h.exposure.snapshot().map(item => item.formId)).toEqual([form.id])
    } finally { setStopLocalStore(null) }
  })
  it('a late baseline confirmation rejection cannot undo a confirmed completion save', async () => {
    let reject!: (error: Error) => void
    const form = stopFormRegistry.all.find(item => item.family === 'baseline')!
    const fake = { reserve: async () => ({ formId: form.id }), arm: async () => {},
      confirm: () => new Promise<void>((_resolve, fail) => { reject = fail }),
      saveResult: async () => {}, activity: async () => {},
    } as unknown as StopLocalStore
    setStopLocalStore(completionStore(fake))
    try {
      const h = harness(); await h.warmup(); await h.run.startScored(); await h.advance(195600)
      const result = h.run.snapshot().result
      expect(h.run.snapshot()).toMatchObject({ screen: 'complete', saveStatus: 'saved', storageFailure: false })
      reject(new Error('late confirmation delivery')); await h.settle()
      expect(h.run.snapshot()).toMatchObject({ saveStatus: 'saved', storageFailure: false })
      expect(h.run.snapshot().result).toBe(result)
    } finally { setStopLocalStore(null) }
  })
  it('quarantines altered or unsupported saved evidence without clearing its exposure marker (S68)', async () => {
    const h = harness(); await h.warmup(); await h.run.startScored(); await h.advance(195_600)
    const result = h.run.snapshot().result!
    const state: StopLocalState = { schemaVersion: STOP_LOCAL_SCHEMA, installationId: 'fixture',
      results: { [result.sessionId]: result }, drafts: {}, chains: {}, retiredChains: {}, activeChainId: null, reservations: {},
      exposures: { [result.form.id]: { formId: result.form.id, sessionId: result.sessionId,
        exposedAtWall: result.completedAtWall, visualProfile: 'standard', deleted: false, certainty: 'confirmed' } } }
    expect(inspectLocalState(state).valid.map(item => item.sessionId)).toEqual([result.sessionId])
    const chain: TrainingChain = { schemaVersion: 'stop_training_chain_v1', id: crypto.randomUUID(), baseline: result,
      recommendation: routeStop(result), drillAttempts: [], retestAttempts: [], retest: null, status: 'assigned' }
    const withChain = { ...state, chains: { [chain.id]: chain }, activeChainId: chain.id }
    expect(inspectLocalState(withChain).activeChain?.id).toBe(chain.id)
    for (const version of ['stop_drill_router_v1', 'stop_drill_router_v2'] as const) {
      const historical = { ...withChain, chains: { [chain.id]: { ...chain, recommendation: routeStop(result, version) } } }
      const original = JSON.stringify(historical)
      expect(inspectLocalState(historical).activeChain?.recommendation.version).toBe(version)
      expect(JSON.stringify(historical)).toBe(original)
    }

    for (const mutation of ['visual', 'binding', 'keyboard', 'latency', 'unsupported', 'exposure identity', 'exposure profile', 'protection', 'device', 'missing device']) {
      const changed = structuredClone(withChain)
      const r = changed.results[result.sessionId]
      if (mutation === 'visual') Object.assign(r.setup, { visualProfile: 'shape_accommodation_v1' })
      if (mutation === 'binding') Object.assign(r.setup, { binding: { code: 'KeyA', label: 'A' } })
      if (mutation === 'keyboard') Object.assign(r.setup, { physicalKeyboard: false })
      if (mutation === 'latency') Object.assign(r.setup, { latencyAffectedInput: true })
      if (mutation === 'unsupported') Object.assign(r.setup, { visualProfile: 'future' })
      if (mutation === 'exposure identity') changed.exposures[r.form.id].formId = 'stop-baseline-04'
      if (mutation === 'exposure profile') changed.exposures[r.form.id].visualProfile = 'shape_accommodation_v1'
      if (mutation === 'protection') Object.assign(r.events.find(e => e.type === 'protection_started')!.payload, { responseKey: 'KeyA' })
      if (mutation === 'device') Object.assign(r.events.find(e => e.type === 'device_check_completed')!.payload, { timingProfile: 'future' })
      if (mutation === 'missing device') Object.assign(r, { events: r.events.filter(e => e.type !== 'device_check_completed') })
      Object.assign(changed.chains[chain.id], { baseline: structuredClone(r) })
      const original = JSON.stringify(changed)
      expect(inspectLocalState(changed).valid, mutation).toEqual([])
      expect(inspectLocalState(changed).activeChain, mutation).toBeNull()
      expect(JSON.stringify(changed)).toBe(original)
    }
    const altered = { ...result, events: result.events.filter(item => item.type !== 'stimulus_presented') }
    const corrupt = { ...state, results: { [result.sessionId]: altered } }
    expect(inspectLocalState(corrupt).valid).toEqual([])
    expect(inspectLocalState(corrupt).rejected).toHaveLength(1)
    expect(corrupt.exposures[result.form.id].certainty).toBe('confirmed')
    const unsupported = { ...state, results: { [result.sessionId]: { ...result, scoringVersion: 'future' } } } as unknown as StopLocalState
    expect(inspectLocalState(unsupported).valid).toEqual([])
    expect(inspectLocalState(unsupported).rejected).toHaveLength(1)
    expect(inspectLocalState({ ...state, exposures: {} }).valid).toEqual([])
  })
})

describe('R2: protected evidence without a derived invalidation', () => {
  it.each(['baseline', 'retest'] as const)('reconciles %s lifecycle/settings/thresholds and preserves rejected bytes', async mode => {
    const h = harness(undefined, undefined, undefined, mode)
    await h.warmup(); await h.run.startScored(); await h.advance(195600)
    const original = h.run.snapshot().result!
    const completion = original.events.at(-2)!.timestampMs
    const cases: [string, string, object, boolean][] = [
      ['hidden', 'visibility_changed', { visible: false }, false],
      ...['pagehide', 'freeze', 'resume', 'pageshow'].map(state => [state, 'page_lifecycle_changed', { state }, false] as [string, string, object, boolean]),
      ...['response_key', 'visual_profile', 'timing_profile', 'input_device_class', 'accessibility'].map(setting => [setting, 'setting_changed', { setting }, false] as [string, string, object, boolean]),
      ['small width', 'viewport_changed', { width: 767, height: 600 }, false],
      ['small height', 'viewport_changed', { width: 768, height: 599 }, false],
      ['minimum viewport', 'viewport_changed', { width: 768, height: 600 }, true],
      ['visible control', 'visibility_changed', { visible: true }, true],
      ['severe tail', 'timing_anomaly', { trialIndex: null, severity: 'severe', issues: ['transition'], expectedMs: completion - 501, observedMs: completion }, false],
    ]
    const inject = (items: { type: string; payload: object; timestampMs: number }[]) => {
      const r = structuredClone(original)
      const events = [...r.events, ...items.map((item, i) => ({ ...item, schemaVersion: 'stop_engine_event_v1', sessionId: r.sessionId, sequenceNumber: -i - 1 }))]
        .sort((a, b) => a.timestampMs - b.timestampMs || (a.sequenceNumber < 0 ? -1 : b.sequenceNumber < 0 ? 1 : a.sequenceNumber - b.sequenceNumber))
      const mapping = new Map(events.map((e, i) => [e.sequenceNumber, i + 1]))
      for (const [i, e] of events.entries()) {
        Object.assign(e, { sequenceNumber: i + 1 })
        const p = e.payload as Record<string, unknown>
        for (const key of ['triggerSequenceNumber', 'inputSequenceNumber']) if (typeof p[key] === 'number') p[key] = mapping.get(p[key])!
        if (e.type === 'session_completed') p.eventCount = i + 1
      }
      return { ...r, events } as typeof original
    }
    const check = (r: typeof original, valid: boolean, name: string) => {
      const state: StopLocalState = { schemaVersion: STOP_LOCAL_SCHEMA, installationId: 'fixture', results: { [r.sessionId]: r },
        drafts: {}, chains: {}, retiredChains: {}, activeChainId: null, reservations: {},
        exposures: { [r.form.id]: { formId: r.form.id, sessionId: r.sessionId, exposedAtWall: r.completedAtWall, visualProfile: 'standard', deleted: false, certainty: 'confirmed' } } }
      const before = JSON.stringify(state)
      expect(verifyCompletedResult(r), name).toBe(valid)
      expect(inspectLocalState(state).valid.length, name).toBe(valid ? 1 : 0)
      expect(JSON.stringify(state), name).toBe(before)
    }
    for (const [name, type, payload, valid] of cases) check(inject([{ type, payload, timestampMs: completion - 1 }]), valid, name)
    for (const duration of [999, 1000, 1001]) {
      check(inject([
        { type: 'focus_changed', payload: { focused: false, durationMs: null }, timestampMs: completion - 1100 },
        { type: 'focus_changed', payload: { focused: true, durationMs: duration }, timestampMs: completion - 1100 + duration },
      ]), duration <= 1000, `blur ${duration}`)
      check(inject([{ type: 'focus_changed', payload: { focused: false, durationMs: null }, timestampMs: completion - duration }]), duration <= 1000, `unmatched blur ${duration}`)
    }
    check(inject([
      { type: 'focus_changed', payload: { focused: false, durationMs: null }, timestampMs: completion - 1100 },
      { type: 'focus_changed', payload: { focused: true, durationMs: 500 }, timestampMs: completion - 600 },
      { type: 'focus_changed', payload: { focused: false, durationMs: null }, timestampMs: completion - 500 },
      { type: 'focus_changed', payload: { focused: true, durationMs: 499 }, timestampMs: completion - 1 },
    ]), true, 'repeated brief blurs')
    check(inject([
      { type: 'focus_changed', payload: { focused: false, durationMs: null }, timestampMs: completion - 1100 },
      { type: 'focus_changed', payload: { focused: true, durationMs: 999 }, timestampMs: completion - 99 },
    ]), false, 'duration contradicts timestamps')
    // Preparation evidence before protection must not be treated as a mid-run change.
    check(inject([{ type: 'setting_changed', payload: { setting: 'visual_profile' }, timestampMs: 0 }]), true, 'pre-start setting')
  })
  it('permits the specified single warm-up restart and a genuine scored timing note', async () => {
    let delayed = false
    const h = harness(r => {
      if (!delayed && r.kind === 'offset' && r.trial.phase === 'warmup') { delayed = true; return 80 }
      return r.kind === 'offset' && r.trial.phase === 'scored' && r.trial.index === 0 ? 80 : 0
    })
    await h.warmup()
    expect(h.run.snapshot().screen).toBe('warmup_restart')
    h.run.startWarmup(); await h.advance(40000); await h.run.startScored(); await h.advance(250000)
    expect(verifyCompletedResult(h.run.snapshot().result!)).toBe(true)
  })
})


describe('F3: full scored initial fixation admission', () => {
  it.each(['baseline', 'retest'] as const)('counts distinct initial fixation inputs for %s, excluding warm-up', async mode => {
    const h = harness(undefined, undefined, undefined, mode)
    await h.warmup(); await h.run.startScored(); await h.advance(195600)
    const original = h.run.snapshot().result!
    for (const [reason, count, expected] of [
      ['fixation', 2, true], ['fixation', 3, false], ['wrong_key', 4, true], ['wrong_key', 5, false],
    ] as const) for (const warmup of [false, true]) {
      const r = structuredClone(original)
      const first = r.events.findIndex(e => e.type === 'trial_scheduled' && e.payload.trial.phase === 'scored')
      const initial = warmup ? r.events.find(e => e.type === 'fixation_started')! :
        r.events.slice(0, first).findLast(e => e.type === 'fixation_started' && e.payload.kind === 'initial')!
      const additions = []
      for (let i = 0; i < count; i++) {
        const key = reason === 'fixation' ? 'Space' : 'KeyZ', id = -(i * 3 + 1), timestampMs = initial.timestampMs + 10 + i * 10
        additions.push(
          { type: 'input_received', sequenceNumber: id, timestampMs, payload: { key, repeated: false, held: false, focused: true } },
          { type: 'response_ignored', sequenceNumber: id - 1, timestampMs: timestampMs + 1, payload: { reason, inputSequenceNumber: id, trialIndex: null } },
          { type: 'key_released', sequenceNumber: id - 2, timestampMs: timestampMs + 2, payload: { key } })
      }
      const events = [...r.events, ...additions.map(e => ({ ...e, sessionId: r.sessionId, schemaVersion: 'stop_engine_event_v1' }))].sort((a,b) => a.timestampMs - b.timestampMs)
      const ids = new Map(events.map((e,i) => [e.sequenceNumber, i+1]))
      events.forEach((e,i) => {
        Object.assign(e, { sequenceNumber: i+1 })
        const payload = e.payload as Record<string, unknown>
        for (const key of ['inputSequenceNumber', 'triggerSequenceNumber']) if (typeof payload[key] === 'number') payload[key] = ids.get(payload[key])
        if (e.type === 'session_completed') payload.eventCount = i+1
      })
      const changed = { ...r, events } as typeof original
      const bytes = JSON.stringify(changed), exposure = h.exposure.snapshot()
      expect(verifyCompletedResult(changed), `${mode} ${reason} ${count} warmup=${warmup}`).toBe(warmup || expected)
      expect(JSON.stringify(changed)).toBe(bytes)
      expect(h.exposure.snapshot()).toEqual(exposure)
    }
  })
})

it('restarts warm-up after a missing initial frame at 2000 ms and fences late delivery', async () => {
  let ready = () => {}
  const h = harness(undefined, undefined, undefined, undefined, undefined, undefined, cb => { ready = cb })
  h.run.begin(false); h.run.startWarmup()
  await h.advance(1999)
  expect(h.run.snapshot().screen).toBe('live')
  await h.advance(2000)
  expect(h.run.snapshot().screen).toBe('warmup_restart')
  const before = h.run.snapshot().events
  ready(); await h.advance(10000)
  expect(h.run.snapshot().events).toEqual(before)
  expect(h.run.snapshot().draft).toBeNull()
  expect(h.exposure.snapshot()).toEqual([])
  h.run.startWarmup(); await h.settle()
  expect(h.run.snapshot().screen).toBe('live')
  await h.advance(12000)
  expect(h.run.snapshot().screen).toBe('invalid')
  expect(h.run.snapshot().engine.invalidRule).toBe(RULE.warmupTiming)
  expect(h.exposure.snapshot()).toEqual([])
})

it.each([false, true].flatMap(restarted => ['hidden', 'pagehide', 'freeze', 'leave'].map(kind => ({ restarted, kind }))))('warm-up initial-frame race: $kind, restarted=$restarted wins over late frame and timer', async ({ restarted, kind }) => {
  let ready = () => {}
  const h = harness(undefined, undefined, undefined, undefined, undefined, undefined, cb => { ready = cb })
  h.run.begin(false); h.run.startWarmup()
  if (restarted) {
    h.run.engine.visibility(false); await h.settle()
    h.run.startWarmup(); await h.settle()
  }
  await h.advance(1999)
  expect(h.run.snapshot().screen).toBe('live')
  if (kind === 'hidden') h.run.engine.visibility(false)
  else if (kind === 'leave') h.run.leave()
  else h.run.engine.lifecycle(kind as 'pagehide' | 'freeze')
  await h.settle()
  const events = h.run.snapshot().events
  ready(); await h.advance(10000)
  expect(h.run.snapshot().events).toEqual(events)
  expect(events.filter(e => e.type === 'session_invalidated')).toHaveLength(0)
  expect(events.filter(e => e.type === 'warmup_interrupted')).toHaveLength(restarted ? 2 : 1)
  expect(h.run.snapshot().draft).toBeNull()
})

it.each(['baseline', 'replay', 'retest'] as const)('M6-A missing scored initial frame preserves known unexposed %s state', async mode => {
  let calls = 0, late = () => {}
  const h = harness(undefined, undefined, undefined, mode, undefined, undefined, cb => {
    if (++calls === 1) cb(); else late = cb
  })
  await h.warmup(); await h.run.startScored()
  await h.advance(20599)
  expect(h.run.snapshot().screen).toBe('live')
  await h.advance(20600)
  expect(h.run.snapshot().screen).toBe('invalid')
  expect(h.run.snapshot().draft?.realizedSequence).toEqual([])
  expect(h.exposure.snapshot()).toEqual([])
  const events = h.run.snapshot().events
  late(); await h.advance(30000)
  expect(h.run.snapshot().events).toEqual(events)
})

it.each(['baseline', 'replay'] as const)('M6-A %s rechecks the durable lease before first onset', async mode => {
  let wall = 0
  const form = stopFormRegistry.all.find(f => f.family === mode)!
  const fake = { reserve: async () => ({ formId: form.id, expiresAtMs: 1800000 }), arm: async () => {}, release: async () => {},
    saveDraft: async () => {}, subscribeDeletion: () => () => {}, installationIdentity: () => 'lease' } as unknown as StopLocalStore
  setStopLocalStore(fake)
  try {
    const h = harness(undefined, undefined, undefined, mode, () => wall)
    await h.warmup(); await h.run.startScored()
    wall = 1799999; expect(h.run.canPresentScored()).toBe(true)
    wall = 1800000; expect(h.run.canPresentScored()).toBe(false)
    await h.settle()
    expect(h.run.snapshot().screen).toBe('reservation_expired')
    expect(h.run.snapshot().exposed).toBe(false)
    expect(h.run.snapshot().draft).toBeNull()
  } finally { setStopLocalStore(null) }
})

it.each(['baseline', 'replay'] as const)('M6-A %s preserves actual exposure when expiry is observed after the paint guard', async mode => {
  let wall = 1799999
  const form = stopFormRegistry.all.find(f => f.family === mode)!
  const fake = { reserve: async () => ({ formId: form.id, expiresAtMs: 1800000 }), arm: async () => {}, confirm: async () => {},
    saveDraft: async () => {}, subscribeDeletion: () => () => {}, installationIdentity: () => 'lease' } as unknown as StopLocalStore
  setStopLocalStore(fake)
  try {
    const h = harness(undefined, undefined, undefined, mode, () => wall)
    await h.warmup(); await h.run.startScored()
    expect(h.run.canPresentScored()).toBe(true)
    wall = 1800000
    await h.advance(19600)
    expect(h.run.snapshot().screen).toBe('invalid')
    expect(h.run.snapshot().exposed).toBe(true)
    expect(h.run.snapshot().draft?.realizedSequence).toEqual([form.sequence[0]])
    expect(h.exposure.snapshot()).toHaveLength(1)
    expect(h.run.snapshot().result).toBeNull()
  } finally { setStopLocalStore(null) }
})

it('completes a new V1.3 28/52 baseline with a reconciled immutable journal', async () => {
  const h = harness(undefined, undefined, undefined, 'baseline', undefined, undefined, undefined, undefined, '1.3')
  await h.warmup()
  await h.run.startScored()
  expect(h.run.snapshot().form?.id).toBe('stop-v13-baseline-01')
  await h.advance(195600)
  const record = h.run.snapshot().result!
  expect(record.specificationVersion).toBe('1.3')
  expect(record.scoringVersion).toBe('stop_scoring_v13')
  expect(record.reportVersion).toBe('stop_report_v13')
  expect(record.summarySnapshot.counts).toEqual({ hits: 0, misses: 28, withholds: 52, falseAlarms: 0 })
  expect(record.events.filter(event => event.type === 'trial_scheduled' && event.payload.trial.phase === 'scored' && event.payload.trial.stimulus === 'GO')).toHaveLength(28)
  expect(verifyCompletedResult(record)).toBe(true)
  expect(verifyCompletedResult({ ...record, specificationVersion: '1.1' })).toBe(false)
  const stored = JSON.parse(JSON.stringify({ ...record, storageMode: 'persistent_local' })) as StopResult
  const state = { schemaVersion: STOP_LOCAL_SCHEMA, installationId: 'fixture', results: { [stored.sessionId]: stored },
    drafts: {}, chains: {}, retiredChains: {}, activeChainId: null, reservations: {},
    exposures: { [stored.form.id]: { formId: stored.form.id, sessionId: stored.sessionId,
      exposedAtWall: stored.completedAtWall, visualProfile: stored.setup.visualProfile,
      deleted: false, certainty: 'confirmed' } } } as StopLocalState
  expect(inspectLocalState(state).valid.map(value => value.sessionId)).toEqual([stored.sessionId])
  expect(inspectLocalState(state).rejected).toEqual([])
  expect(inspectLocalState({ ...state, results: { [stored.sessionId]: { ...stored, reportVersion: undefined } } }).rejected).toHaveLength(1)
})

it('keeps legacy V1.3 meaning and verifies a truthful reused-input new experience after serialization', async () => {
  const legacy = harness(undefined, undefined, undefined, 'baseline', undefined, undefined, undefined, undefined, '1.3')
  await legacy.warmup(); await legacy.run.startScored(); await legacy.advance(195600)
  const oldResult = JSON.parse(JSON.stringify(legacy.run.snapshot().result!)) as StopResult
  expect(oldResult.experienceVersion).toBeUndefined()
  expect(verifyCompletedResult(oldResult)).toBe(true)

  const newer = harness(undefined, undefined, undefined, 'baseline', undefined, undefined, undefined, undefined, '1.3', 'stop_experience_v1_3')
  await newer.warmup(); await newer.run.startScored(); await newer.advance(195600)
  const saved = JSON.parse(JSON.stringify(newer.run.snapshot().result!)) as StopResult
  expect(saved.experienceVersion).toBe('stop_experience_v1_3')
  expect(verifyCompletedResult(saved)).toBe(true)
  const fresh = structuredClone(saved)
  const freshCheck = fresh.events.find(event => event.type === 'input_check_v13')!
  Object.assign(freshCheck.payload, { origin: 'fresh', receiptId: null, tabNonce: null })
  expect(verifyCompletedResult(fresh)).toBe(true)
  const incompleteReceipt = structuredClone(fresh)
  Object.assign(incompleteReceipt.events.find(event => event.type === 'input_check_v13')!.payload, { tabNonce: crypto.randomUUID() })
  expect(verifyCompletedResult(incompleteReceipt)).toBe(false)
  const altered = structuredClone(saved)
  const check = altered.events.find(event => event.type === 'input_check_v13')!
  Object.assign(check.payload, { code: 'KeyF' })
  expect(verifyCompletedResult(altered)).toBe(false)
  expect(verifyCompletedResult({ ...saved, events: saved.events.filter(event => event.type !== 'input_check_v13') })).toBe(false)
  expect(verifyCompletedResult({ ...saved, experienceVersion: undefined })).toBe(false)
})
