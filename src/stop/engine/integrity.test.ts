// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { fixture } from './fixture'
import { createStopEngine } from './engine'
import { inspectTrialEvents } from './integrity'
import { ENGINE_EVENT_VERSION, VALIDITY_RULE_VERSION } from './contracts'
import type { EngineEvent } from './contracts'
import { RULE } from './rules'

function completed(response = true) {
  const f = fixture()
  if (response) f.press(1350)
  f.advance(response ? 2550 : 3200)
  return f
}

describe('Engine event journal and integrity', () => {
  it('continues an existing session sequence and preserves causal references and batch checks', () => {
    const f = fixture({ sequenceOffset: 25 })
    f.press(1350)
    f.advance(2550)
    expect(f.events[0].sequenceNumber).toBe(26)
    expect(f.engine.snapshot().state).toBe('waiting')
    const accepted = f.ofType('response_accepted')[0]
    expect(f.events.find(e => e.sequenceNumber === accepted.payload.inputSequenceNumber)?.type).toBe('input_received')
    expect(f.ofType('integrity_checked')[0].payload.valid).toBe(true)
  })
  it('has immutable order, payloads, session/schema/rule versions, and one monotonic clock', () => {
    const f = completed()
    const snapshot = f.engine.snapshot()
    expect(snapshot.ruleVersion).toBe(VALIDITY_RULE_VERSION)
    for (const [i, event] of snapshot.events.entries()) {
      expect(event).toMatchObject({ sequenceNumber: i + 1, sessionId: 'synthetic-session', schemaVersion: ENGINE_EVENT_VERSION })
      expect(event.timestampMs).toBeGreaterThanOrEqual(i ? snapshot.events[i - 1].timestampMs : 0)
      expect(Object.isFrozen(event)).toBe(true)
      expect(Object.isFrozen(event.payload)).toBe(true)
    }
    expect(Object.isFrozen(snapshot.events)).toBe(true)
    expect(Object.isFrozen(snapshot.results[0].outcome)).toBe(true)
    expect(() => { (snapshot.results[0].outcome as { kind: string }).kind = 'miss' }).toThrow()
    expect(snapshot.events).toEqual(f.events)
    expect(f.ofType('response_accepted')[0].timestampMs).toBe(1350)
    expect(f.ofType('trial_resolved')[0].timestampMs).toBe(1350)
    expect(f.ofType('trial_resolved')[0].sequenceNumber).toBeGreaterThan(f.ofType('response_accepted')[0].sequenceNumber)
  })
  it('uses immutable snapshots and copies caller-supplied trials', () => {
    const f = fixture({ autoStart: false })
    const snapshot = f.engine.snapshot()
    f.engine.start(f.definitions)
    f.definitions[0].stimulus = 'NO_GO'
    f.advance(1000)
    expect(f.ofType('stimulus_presented')[0].payload.stimulus).toBe('GO')
    expect(snapshot.events).toHaveLength(1)
  })
  it.each([NaN, Infinity, -1, 999])('invalidates a bad/regressed clock %s without regressing event envelopes', value => {
    const f = fixture()
    f.advance(1000)
    f.setTime(value)
    f.engine.keyDown(' ')
    expect(f.engine.snapshot().invalidRule).toBe(RULE.severeTiming)
    expect(f.ofType('response_accepted')).toHaveLength(0)
    const last = f.events.at(-1)!
    expect(last.timestampMs).toBe(1000)
    expect(f.ofType('timing_anomaly')[0].payload.issues).toEqual(['timestamp'])
  })
  it('rejects duplicate confirmations and never creates a second onset', () => {
    const f = fixture()
    f.advance(1000)
    f.confirmations[0].confirm()
    expect(f.engine.snapshot().invalidRule).toBe(RULE.integrity)
    expect(f.ofType('stimulus_presented')).toHaveLength(1)
  })
  it('rejects a frame confirmed before its eligible onset', () => {
    const f = fixture({ frameDelay: () => 50 })
    f.advance(1000)
    f.setTime(999)
    f.confirmations[0].confirm()
    expect(f.engine.snapshot().invalidRule).toBe(RULE.severeTiming)
    expect(f.ofType('stimulus_presented')).toHaveLength(0)
  })
  it.each(['stimulus_presented', 'stimulus_removed', 'response_accepted', 'trial_resolved'] as const)('detects missing or duplicate %s in retained events', type => {
    for (const kind of ['missing', 'duplicate']) {
      const f = completed()
      const retained = [...f.events]
      const index = retained.findIndex(e => e.type === type)
      if (kind === 'missing') retained.splice(index, 1)
      else retained.splice(index, 0, retained[index])
      f.engine.verifyRetainedEvents(retained)
      expect(f.engine.snapshot().invalidRule).toBe(RULE.integrity)
    }
  })
  it('checks a matching sink journal without creating a valid product result', () => {
    const f = completed()
    f.engine.verifyRetainedEvents([...f.events])
    expect(f.engine.snapshot()).toMatchObject({ state: 'waiting', quality: 'clean', invalidRule: null })
    expect(f.ofType('integrity_checked').every(e => e.payload.valid)).toBe(true)
    expect(f.events.some(e => (e.type as string) === 'session_completed')).toBe(false)
  })
  it.each([true, false])('batch event audit passes a correct response=%s fixture', response => {
    const f = completed(response)
    expect(inspectTrialEvents(f.events, f.definitions, ' ').valid).toBe(true)
  })
  it.each(['held', 'repeat', 'wrong', 'response_missing', 'response_duplicate', 'resolution_missing', 'stimulus_duplicate', 'negative_rt', 'wrong_outcome', 'missing_timestamp', 'regressed_timestamp', 'wrong_schema'] as const)('rejects corrupted batch: %s', mutation => {
    const f = completed()
    const events = structuredClone(f.events) as EngineEvent[]
    const input = events.find(e => e.type === 'input_received')!
    const response = events.find(e => e.type === 'response_accepted')!
    const result = events.find(e => e.type === 'trial_resolved')!
    // Runtime fault fixtures deliberately bypass readonly types.
    const edit = (event: EngineEvent, payload: object) => Object.assign(event.payload, payload)
    if (mutation === 'held') edit(input, { held: true })
    if (mutation === 'repeat') edit(input, { repeated: true })
    if (mutation === 'wrong') edit(input, { key: 'x' })
    if (mutation === 'negative_rt') edit(response, { responseTimeMs: -1 })
    if (mutation === 'wrong_outcome') edit(result, { outcome: { stimulus: 'GO', kind: 'miss', responseTimeMs: null } })
    if (mutation === 'response_missing') events.splice(events.indexOf(response), 1)
    if (mutation === 'resolution_missing') events.splice(events.indexOf(result), 1)
    if (mutation === 'response_duplicate') events.splice(events.indexOf(response), 0, structuredClone(response))
    if (mutation === 'stimulus_duplicate') {
      const start = events.find(e => e.type === 'stimulus_presented')!
      events.splice(events.indexOf(start), 0, structuredClone(start))
    }
    if (mutation === 'missing_timestamp') Object.assign(response, { timestampMs: undefined })
    if (mutation === 'regressed_timestamp') Object.assign(response, { timestampMs: 1 })
    if (mutation === 'wrong_schema') Object.assign(response, { schemaVersion: 'unknown' })
    expect(inspectTrialEvents(events, f.definitions, ' ').valid).toBe(false)
  })
  it('rejects an outcome-producing response inserted into a timeout record', () => {
    const f = completed(false)
    const events = structuredClone(f.events)
    const resolved = events.find(e => e.type === 'trial_resolved')!
    Object.assign(resolved.payload, { source: 'response' })
    expect(inspectTrialEvents(events, f.definitions, ' ').valid).toBe(false)
  })
  it('invalidates safely if the event sink fails, preserving a local diagnostic', () => {
    const engine = createStopEngine({ sessionId: 'sink-failure', responseKey: ' ', clock: () => 0,
      scheduler: { at: () => () => {}, after: () => () => {} }, frames: { request: () => () => {} },
      sink: () => { throw new Error('Sink unavailable') },
    })
    engine.begin()
    expect(engine.snapshot().invalidRule).toBe(RULE.integrity)
    expect(engine.snapshot().events.map(e => e.type)).toEqual(['protection_started', 'session_invalidated'])
  })
  it('guards against reentrant sinks', () => {
    const engine = createStopEngine({ sessionId: 'sink-reentry', responseKey: ' ', clock: () => 0,
      scheduler: { at: () => () => {}, after: () => () => {} }, frames: { request: () => () => {} },
      sink: () => engine.keyDown(' '),
    })
    engine.begin()
    expect(engine.snapshot().invalidRule).toBe(RULE.integrity)
  })
  it('requires a single-phase caller batch and never selects a form', () => {
    const f = fixture({ autoStart: false })
    expect(() => f.engine.start([])).toThrow()
    expect(() => f.engine.start([{ phase: 'scored', index: 0, stimulus: 'GO' }, { phase: 'scored', index: 0, stimulus: 'NO_GO' }])).toThrow()
    expect(() => f.engine.start([{ phase: 'scored', index: 0, stimulus: 'GO' }, { phase: 'warmup', index: 1, stimulus: 'NO_GO' }])).toThrow()
    expect(() => f.engine.start([{ phase: 'drill', index: 0, stimulus: 'GO' }], { visibilityMs: 200, deadlineMs: 1100, fixationMs: 1000 })).not.toThrow()
    expect(() => f.engine.endProtection()).toThrow()
  })
  it('starts another supplied phase with a fresh initial fixation without ending protection', () => {
    const f = fixture({ phase: 'warmup', stimuli: ['NO_GO'] })
    f.advance(3200)
    f.engine.start([{ phase: 'scored', index: 10, stimulus: 'GO' }])
    f.advance(4200)
    expect(f.ofType('stimulus_presented').map(e => [e.timestampMs, e.payload.trialIndex])).toEqual([[1000, 0], [4200, 10]])
    expect(f.ofType('protection_started')).toHaveLength(1)
  })
})

describe('Faulty adapter contracts', () => {
  it('rejects an inclusive deadline timer dispatched exactly on the boundary', () => {
    let time = 0
    let atCallback = () => {}
    let deadlineCallback = () => {}
    let onsetCallback = () => {}
    const engine = createStopEngine({ sessionId: 'bad-scheduler', responseKey: ' ', clock: () => time,
      scheduler: {
        at: (_at, callback) => { atCallback = callback; return () => {} },
        after: (at, callback) => { if (at === 2000) deadlineCallback = callback; return () => {} },
      },
      frames: { request: (r, callback) => { if (r.kind === 'onset') onsetCallback = callback; return () => {} } },
      sink: () => {},
    })
    engine.begin()
    engine.start([{ phase: 'scored', index: 0, stimulus: 'GO' }])
    time = 1000
    atCallback(); onsetCallback()
    time = 2000
    deadlineCallback()
    expect(engine.snapshot().invalidRule).toBe(RULE.severeTiming)
    expect(engine.snapshot().results).toHaveLength(0)
  })
  it('rejects duplicate scheduler delivery before another trial can be created', () => {
    let time = 0
    let initialCallback = () => {}
    const engine = createStopEngine({ sessionId: 'duplicate-scheduler', responseKey: ' ', clock: () => time,
      scheduler: { at: (_at, cb) => { initialCallback = cb; return () => {} }, after: () => () => {} },
      frames: { request: () => () => {} }, sink: () => {},
    })
    engine.begin()
    engine.start([{ phase: 'scored', index: 0, stimulus: 'GO' }])
    time = 1000
    initialCallback(); initialCallback()
    expect(engine.snapshot().invalidRule).toBe(RULE.integrity)
  })
  it('rejects a missing clock sample, even before a trial starts', () => {
    const engine = createStopEngine({ sessionId: 'missing-clock', responseKey: ' ', clock: () => { throw new Error('Clock unavailable') },
      scheduler: { at: () => () => {}, after: () => () => {} }, frames: { request: () => () => {} }, sink: () => {},
    })
    engine.begin()
    expect(engine.snapshot().invalidRule).toBe(RULE.severeTiming)
    expect(engine.snapshot().events[0].timestampMs).toBe(0)
  })
})
