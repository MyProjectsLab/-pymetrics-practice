// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createEventRecorder } from './events'

describe('memory-only event recorder', () => {
  function recorder(clock: () => number = () => 42) {
    return createEventRecorder<{ opened: { nested: { values: string[] } } }, 'test_v1'>({
      sessionId: 'session-a', schemaVersion: 'test_v1', clock,
    })
  }
  it('records ordered, versioned, session-bound events with one injected clock', () => {
    let time = 1
    const record = recorder(() => time)
    record.record('opened', { nested: { values: [] } })
    time = 2
    record.record('opened', { nested: { values: [] } })
    expect(record.snapshot().map(({ payload: _payload, ...event }) => event)).toEqual([
      { schemaVersion: 'test_v1', sessionId: 'session-a', sequenceNumber: 1, timestampMs: 1, type: 'opened' },
      { schemaVersion: 'test_v1', sessionId: 'session-a', sequenceNumber: 2, timestampMs: 2, type: 'opened' },
    ])
  })
  it('isolates payload references and freezes nested records and snapshots', () => {
    const record = recorder()
    const payload = { nested: { values: ['original'] } }
    const event = record.record('opened', payload)
    payload.nested.values.push('changed')
    expect(event.payload.nested.values).toEqual(['original'])
    expect(() => event.payload.nested.values.push('mutated')).toThrow()
    expect(Object.isFrozen(event)).toBe(true)
    const snapshot = record.snapshot()
    record.record('opened', payload)
    expect(snapshot).toHaveLength(1)
    expect(Object.isFrozen(snapshot)).toBe(true)
    expect(record.snapshot()).toHaveLength(2)
  })
  it.each([NaN, Infinity, -1, 9])('rejects invalid or regressing time %s without consuming a sequence number', time => {
    let now = 10
    const record = recorder(() => now)
    record.record('opened', { nested: { values: [] } })
    now = time
    expect(() => record.record('opened', { nested: { values: [] } })).toThrow()
    now = 10
    expect(record.record('opened', { nested: { values: [] } }).sequenceNumber).toBe(2)
  })
  it('requires a session identifier', () => {
    expect(() => createEventRecorder({ sessionId: '', schemaVersion: 'v1', clock: () => 0 })).toThrow()
  })
  it('captures the session identity, version, and clock once even if caller options later change', () => {
    const options = { sessionId: 'original', schemaVersion: 'v1', clock: () => 1 }
    const record = createEventRecorder<{ opened: object }, string>(options)
    options.sessionId = 'changed'
    options.schemaVersion = 'v2'
    options.clock = () => 2
    expect(record.record('opened', {})).toMatchObject({ sessionId: 'original', schemaVersion: 'v1', timestampMs: 1 })
  })
})

it('continues sequence ordering without rewriting an earlier stage', () => {
  const recorder = createEventRecorder<{ example: { value: number } }, 'test_v1'>({
    sessionId: 'continued', schemaVersion: 'test_v1', clock: () => 10, sequenceOffset: 12,
  })
  expect(recorder.record('example', { value: 1 }).sequenceNumber).toBe(13)
  expect(recorder.record('example', { value: 2 }).sequenceNumber).toBe(14)
  for (const sequenceOffset of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER]) {
    expect(() => createEventRecorder({ sessionId: 'bad', schemaVersion: 'test_v1', clock: () => 0, sequenceOffset })).toThrow()
  }
})
