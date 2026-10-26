// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { routeStop, beginTrainingChain, updateTrainingChain, retainDrillAttempt, restoreTrainingChain, currentTrainingChain, recordDrillStarted, retryTrainingSave, trainingSaveStatus, storageDisclosure, TEMPORARY_DISCLOSURE } from './training'
import type { StopResult } from './run'
import type { DrillAttempt, TrainingChain } from './training'
import type { Counts } from './scoring'
import { createMemoryExposureRepository } from './exposure'
import { setStopLocalStore } from './storage'
import type { LocalActivity, StopLocalStore } from './storage'

const half = (hits: number, falseAlarms: number): Counts => ({ hits, misses: 30 - hits, withholds: 10 - falseAlarms, falseAlarms })
function baseline(first = half(28, 1), second = half(28, 1), values: {
  iqr?: number; timingCount?: number; timingNote?: boolean; hitRate?: number; missRate?: number; falseAlarmRate?: number; blockPattern?: readonly number[]
} = {}): StopResult {
  const counts = { hits: first.hits + second.hits, misses: first.misses + second.misses,
    withholds: first.withholds + second.withholds, falseAlarms: first.falseAlarms + second.falseAlarms }
  return { mode: 'baseline', validity: values.timingNote ? 'valid_with_note' : 'valid', sessionId: crypto.randomUUID(),
    events: [], summarySnapshot: {
      counts, halves: [first, second], blocks: values.blockPattern?.map(accuracy => ({ accuracy })),
      timing: { count: values.timingCount ?? counts.hits, iqr: values.iqr ?? 80 },
      rates: { hit: values.hitRate ?? counts.hits / 60, miss: values.missRate ?? counts.misses / 60,
        falseAlarm: values.falseAlarmRate ?? counts.falseAlarms / 20 },
    },
  } as unknown as StopResult
}

describe('S45–S47 router and temporary-chain boundary', () => {
  it('routes exact withholding and detection thresholds and records nonselected candidates', () => {
    expect(routeStop(baseline(half(30, 1), half(30, 2))).candidates.find(c => c.id === 'withholding')?.triggered).toBe(false)
    const withholding = routeStop(baseline(half(30, 2), half(30, 2)))
    expect(withholding.drillId).toBe('withholding')
    expect(withholding.candidates.find(candidate => candidate.id === 'withholding')).toMatchObject({ triggered: true, severity: 1 })
    expect(routeStop(baseline(half(30, 2), half(30, 3))).candidates.find(c => c.id === 'withholding')?.severity).toBe(1.25)
    expect(routeStop(baseline(half(28, 0), half(27, 0))).candidates.find(c => c.id === 'detection')?.triggered).toBe(false)
    expect(routeStop(baseline(half(27, 0), half(27, 0))).drillId).toBe('detection')
    expect(routeStop(baseline(half(27, 0), half(26, 0))).candidates.find(c => c.id === 'detection')?.triggered).toBe(true)
    expect(routeStop(baseline(half(30, 0), half(30, 0))).drillId).toBe('maintenance')
  })
  it('uses complete halves, and requires both the false-alarm rise and two additional errors', () => {
    const exactHitDrop = routeStop(baseline(half(30, 0), half(27, 0)))
    expect(exactHitDrop.drillId).toBe('consistency')
    expect(exactHitDrop.candidates.find(candidate => candidate.id === 'consistency')?.severity).toBeCloseTo(1)
    expect(routeStop(baseline(half(30, 0), half(28, 0))).candidates.find(c => c.id === 'consistency')?.triggered).toBe(false)
    expect(routeStop(baseline(half(30, 0), half(26, 0))).candidates.find(c => c.id === 'consistency')?.severity).toBeGreaterThan(1)
    const route = routeStop(baseline(half(30, 0), half(30, 2)))
    expect(route.drillId).toBe('consistency')
    expect(route.candidates.find(candidate => candidate.id === 'consistency')?.metrics.falseAlarmCountRise).toBe(2)
    const noFalseRoute = routeStop(baseline(half(30, 0), half(30, 1)))
    expect(noFalseRoute.drillId).toBe('maintenance')
    // Opposite Block 1/4 observations cannot replace the identical half-session totals.
    expect(routeStop(baseline(half(30, 0), half(30, 2), { blockPattern: [.9, .8, .8, .7] })).drillId).toBe(
      routeStop(baseline(half(30, 0), half(30, 2), { blockPattern: [.7, .8, .8, .9] })).drillId)
  })
  it('excludes stability for every timing note while continuing to evaluate other routes, including maintenance', () => {
    const selected = routeStop(baseline(half(30, 2), half(30, 2), { iqr: 200, timingNote: true }))
    expect(selected.drillId).toBe('withholding')
    expect(selected.candidates.find(candidate => candidate.id === 'stability')?.exclusion).toContain('timing note')
    expect(selected.exclusionDisclosure).toContain('did not support the selected exercise')
    const maintenance = routeStop(baseline(half(30, 0), half(30, 0), { iqr: 200, timingNote: true }))
    expect(maintenance.drillId).toBe('maintenance')
    expect(maintenance.exclusionDisclosure).toContain('timing note')
    expect(routeStop(baseline(half(30, 0), half(30, 0), { iqr: 150 })).drillId).toBe('stability')
    expect(routeStop(baseline(half(30, 0), half(30, 0), { iqr: 149.999 })).drillId).toBe('maintenance')
    expect(routeStop(baseline(half(30, 0), half(30, 0), { iqr: 150.001 })).drillId).toBe('stability')
  })
  it('applies a strict less-than-0.001 severity tie and the fixed priority', () => {
    for (const [difference, selected, tieBreak] of [
      [.0009, 'detection', true], [.001, 'detection', true], [.0011, 'stability', false],
    ] as const) {
      const routed = routeStop(baseline(half(27, 0), half(27, 0), { iqr: 150 * (1 + difference) }))
      expect(routed.candidates.find(value => value.id === 'detection')?.severity).toBe(1)
      expect(routed.candidates.find(value => value.id === 'stability')?.severity).toBeCloseTo(1 + difference, 8)
      expect(routed.drillId).toBe(selected)
      expect(routed.tieBreak).toBe(tieBreak)
    }
  })
  it('retains an attempt exactly once and keeps valid and invalid resume eligibility separate', () => {
    const chain = beginTrainingChain(baseline())
    const attempt = (id: string, valid: boolean) => Object.freeze({ id, valid, events: Object.freeze([{ type: 'session_invalidated' }]) }) as unknown as DrillAttempt
    const invalid = attempt('invalid-one', false)
    const first = retainDrillAttempt(chain.id, invalid)
    expect(first.status).toBe('assigned')
    expect(first.drillAttempts).toEqual([invalid])
    expect(retainDrillAttempt(chain.id, invalid)).toBe(first)
    expect(first.retestAttempts).toEqual([])
    const completed = attempt('completed-two', true)
    const second = retainDrillAttempt(chain.id, completed)
    expect(second.status).toBe('drill_complete')
    expect(second.drillAttempts).toEqual([invalid, completed])
    expect(retainDrillAttempt(chain.id, completed)).toBe(second)
    expect(second.drillAttempts[0].events).toBe(invalid.events)
    updateTrainingChain({ status: 'complete' })
  })
  it('permits sequential chains only after completion and retains the exact temporary disclosure', () => {
    const first = baseline()
    const chain = beginTrainingChain(first)
    expect(() => beginTrainingChain(baseline())).toThrow('one active')
    updateTrainingChain({ status: 'complete' })
    expect(() => beginTrainingChain(first)).toThrow('new valid baseline')
    const second = beginTrainingChain(baseline())
    expect(second.id).not.toBe(chain.id)
    expect(TEMPORARY_DISCLOSURE).toContain('earlier visits or in other tabs')
    updateTrainingChain({ status: 'complete' })
  })
  it('retains same-page exposure records across completed sequential chains', () => {
    const exposure = createMemoryExposureRepository()
    const first = baseline()
    beginTrainingChain(first)
    const firstForm = exposure.reserve(first.sessionId, () => 0, 'baseline')!
    exposure.expose(first.sessionId, 100)
    exposure.release(first.sessionId)
    const firstRetest = exposure.reserve('retest-one', () => 0, 'retest')!
    exposure.expose('retest-one', 200)
    exposure.release('retest-one')
    updateTrainingChain({ status: 'complete' })
    const second = baseline()
    beginTrainingChain(second)
    const secondForm = exposure.reserve(second.sessionId, () => 0, 'baseline')!
    exposure.expose(second.sessionId, 300)
    expect(secondForm.id).not.toBe(firstForm.id)
    expect(exposure.snapshot().map(marker => marker.formId)).toEqual([firstForm.id, firstRetest.id, secondForm.id])
    updateTrainingChain({ status: 'complete' })
  })
})

describe('M5 local chain activity (N2)', () => {
  it('records actual recommendation, start, completion, and retest transitions without fabricating events on restore', async () => {
    restoreTrainingChain(null)
    const events: { type: string; key: string }[] = []
    const fake = { saveChain: async (_chain: unknown, event?: Omit<LocalActivity, 'schemaVersion' | 'recordedAtWall' | 'sequenceNumber'>) => {
      if (event) events.push({ type: event.type, key: event.key })
    } } as unknown as StopLocalStore
    setStopLocalStore(fake)
    try {
      const base = baseline()
      const assigned = beginTrainingChain(base)
      updateTrainingChain({ status: 'drilling' })
      const attempt = { id: crypto.randomUUID(), drillId: assigned.recommendation.drillId, manifestChecksum: 'fixture',
        version: '1', startedAtWall: '', completedAtWall: '', valid: true, completedBlocks: 3, events: [] } as DrillAttempt
      recordDrillStarted(assigned.id, attempt.id)
      retainDrillAttempt(assigned.id, attempt)
      const retest = { ...base, sessionId: crypto.randomUUID(), mode: 'retest', form: { id: 'stop-retest-01' } } as unknown as StopResult
      updateTrainingChain({ retest, status: 'complete' })
      await vi.waitFor(() => expect(trainingSaveStatus()).toBe('saved'))
      expect(events.map(item => item.type)).toEqual(['drill_recommended', 'drill_started', 'drill_completed', 'retest_completed'])
      const count = events.length
      restoreTrainingChain(null); restoreTrainingChain(assigned)
      expect(events).toHaveLength(count)
      expect(new Set(events.map(item => item.key)).size).toBe(count)
    } finally { setStopLocalStore(null); restoreTrainingChain(null) }
  })
})


describe('M5 repair: failed chain writes and per-attempt starts', () => {
  it('retains failed writes and retries in order without promising saved history or collapsing retries', async () => {
    restoreTrainingChain(null)
    let failing = false
    let durable: TrainingChain | null = null
    let writes = 0
    const activities: LocalActivity[] = []
    const fake = { saveChain: async (chain: TrainingChain, event?: LocalActivity) => {
      writes++
      if (failing) throw new Error('Injected chain write failure')
      durable = chain
      if (event) activities.push(event)
    }, activity: async (event: LocalActivity) => { activities.push(event) } } as unknown as StopLocalStore
    setStopLocalStore(fake)
    try {
      const chain = beginTrainingChain(baseline())
      updateTrainingChain({ status: 'drilling' })
      await vi.waitFor(() => expect(trainingSaveStatus()).toBe('saved'))
      expect(activities.filter(e => e.type === 'drill_started')).toHaveLength(0)
      recordDrillStarted(chain.id, 'attempt-1')
      recordDrillStarted(chain.id, 'attempt-2')
      await vi.waitFor(() => expect(trainingSaveStatus()).toBe('saved'))
      expect(activities.filter(e => e.type === 'drill_started').map(e => e.sessionId)).toEqual(['attempt-1', 'attempt-2'])
      failing = true
      const before = writes
      const attempt = { id: 'attempt-2', valid: true } as DrillAttempt
      retainDrillAttempt(chain.id, attempt)
      expect(currentTrainingChain()?.drillAttempts).toEqual([attempt])
      expect(storageDisclosure()).not.toContain('are saved')
      await vi.waitFor(() => expect(trainingSaveStatus()).toBe('failed'))
      expect(writes - before).toBe(2)
      expect(durable!.drillAttempts).toEqual([])
      expect(storageDisclosure()).toContain('could not be saved')
      expect(activities.some(e => e.type === 'storage_failure')).toBe(true)
      failing = false
      await retryTrainingSave()
      expect(trainingSaveStatus()).toBe('saved')
      expect(durable!.drillAttempts).toEqual([attempt])
      expect(storageDisclosure()).toContain('are saved')
    } finally { setStopLocalStore(null); restoreTrainingChain(null) }
  })
})

describe('R1 deletion and retained queue', () => {
  it('stops automatic retry after deletion while a failed write is still in flight', async () => {
    const { reconcileTrainingDeletion } = await import('./training')
    restoreTrainingChain(null)
    let reject!: (error: Error) => void
    let calls = 0
    const fake = { saveChain: () => { calls++; return new Promise<void>((_resolve, no) => { reject = no }) }, activity: async () => {} } as unknown as StopLocalStore
    setStopLocalStore(fake)
    try {
      const chain = beginTrainingChain(baseline())
      updateTrainingChain({ status: 'drilling' })
      reconcileTrainingDeletion({ retiredChains: { [chain.id]: {} } } as unknown as import('./storage').StopLocalState)
      reject(new Error('Delayed rejection'))
      await new Promise(resolve => setTimeout(resolve,0))
      await retryTrainingSave()
      expect(calls).toBe(1)
      expect(currentTrainingChain()).toBeNull()
      expect(trainingSaveStatus()).toBe('saved')
    } finally { setStopLocalStore(null); restoreTrainingChain(null) }
  })
  it('rejects a retired snapshot once, clears that chain, and preserves unrelated queued transitions', async () => {
    const { DeletedChainError } = await import('./storage')
    restoreTrainingChain(null)
    const old = baseline(), next = baseline()
    let failing = true
    const writes: string[] = []
    const fake = { saveChain: async (chain: TrainingChain) => {
      writes.push(chain.baseline.sessionId)
      if (failing) throw new Error('Transient')
      if (chain.baseline.sessionId === old.sessionId) throw new DeletedChainError('Retired')
    }, activity: async () => {} } as unknown as StopLocalStore
    setStopLocalStore(fake)
    try {
      beginTrainingChain(old)
      await vi.waitFor(() => expect(trainingSaveStatus()).toBe('failed'))
      updateTrainingChain({ status: 'complete' })
      const newer = beginTrainingChain(next)
      failing = false
      const before = writes.length
      await retryTrainingSave()
      expect(writes.slice(before)).toEqual([old.sessionId,next.sessionId])
      expect(currentTrainingChain()?.id).toBe(newer.id)
      expect(trainingSaveStatus()).toBe('saved')
    } finally { setStopLocalStore(null); restoreTrainingChain(null) }
  })
})

describe('F1 cross-tab retired recovery buffer', () => {
  it.each(['notification', 'rejected write'] as const)('preserves every nondeleted journal after %s, including a failed retirement write', async trigger => {
    const { DeletedChainError } = await import('./storage')
    const { retainedTrainingAttempts, reconcileTrainingDeletion } = await import('./training')
    restoreTrainingChain(null, true)
    const deleted = { id: 'deleted-drill', events: [{ type: 'session_invalidated', sequenceNumber: 1 }] } as unknown as DrillAttempt
    const kept = { id: 'buffered-drill', valid: false, events: Object.freeze([
      Object.freeze({ type: 'protection_started', sequenceNumber: 1, sessionId: 'buffered-drill', timestampMs: 0 }),
      Object.freeze({ type: 'session_invalidated', sequenceNumber: 2, sessionId: 'buffered-drill', timestampMs: 10 }),
    ]) } as DrillAttempt
    let retired = false, failRetirement = true
    let durable: DrillAttempt[] = []
    let state: import('./storage').StopLocalState
    const fake = {
      saveChain: async () => { if (retired) throw new DeletedChainError('Deleted in another tab', state); throw Error('Transient') },
      saveRetiredChain: async (chain: TrainingChain) => {
        if (failRetirement) throw Error('Retired-history disk failure')
        durable = [...chain.drillAttempts]
      }, activity: async () => {},
    } as unknown as StopLocalStore
    setStopLocalStore(fake)
    try {
      const chain = beginTrainingChain(baseline())
      retainDrillAttempt(chain.id, deleted)
      retainDrillAttempt(chain.id, kept)
      await vi.waitFor(() => expect(trainingSaveStatus()).toBe('failed'))
      state = { retiredChains: { [chain.id]: { drillAttempts: [] } }, deletedSessions: { [deleted.id]: true } } as unknown as import('./storage').StopLocalState
      retired = true
      if (trigger === 'notification') reconcileTrainingDeletion(state)
      await retryTrainingSave()
      await vi.waitFor(() => expect(trainingSaveStatus()).toBe('failed'))
      expect(currentTrainingChain()).toBeNull()
      expect(retainedTrainingAttempts()).toEqual([kept])
      expect(retainedTrainingAttempts()[0].events).toBe(kept.events)
      expect(durable).toEqual([])
      expect(storageDisclosure()).toContain('could not be saved')
      failRetirement = false
      await retryTrainingSave()
      await vi.waitFor(() => expect(trainingSaveStatus()).toBe('saved'))
      expect(durable).toEqual([kept])
      expect(currentTrainingChain()).toBeNull()
      expect(retainedTrainingAttempts()).toEqual([])
    } finally { setStopLocalStore(null); restoreTrainingChain(null, true) }
  })
})


describe('C3 completion ownership', () => {
  it('reserves the one valid retest before storage delivery and fences overlapping sessions and generations', async () => {
    const T = await import('./training')
    setStopLocalStore(null); restoreTrainingChain(null, true)
    const chain = beginTrainingChain(baseline())
    const first = { ...baseline(), mode: 'retest', form: { id: 'first-form' } } as StopResult
    const second = { ...baseline(), mode: 'retest', form: { id: 'second-form' } } as StopResult
    const old = T.beginRetestCompletion(chain.id, first.sessionId)
    T.retainRetestCompletion(old, first)
    expect(T.pendingRetestCompletion(chain.id)).toBe(true)
    restoreTrainingChain(chain) // stale history cannot erase pending completion
    expect(currentTrainingChain()!.retestAttempts[0].sessionId).toBe(first.sessionId)
    const newer = T.beginRetestCompletion(chain.id, second.sessionId)
    T.retainRetestCompletion(newer, second)
    expect(T.ownsRetestCompletion(old)).toBe(false)
    expect(T.ownsRetestCompletion(newer)).toBe(true)
    updateTrainingChain({ retest: second, status: 'complete' })
    T.finishRetestCompletion(old)
    expect(T.pendingRetestCompletion(chain.id)).toBe(true)
    T.finishRetestCompletion(newer)
    expect(currentTrainingChain()!.retest).toBe(second)
    expect(currentTrainingChain()!.retestAttempts.map(a => a.sessionId)).toEqual([first.sessionId, second.sessionId])
    restoreTrainingChain(null, true); restoreTrainingChain(chain)
    expect(T.ownsRetestCompletion(newer)).toBe(false)
    restoreTrainingChain(null, true)
  })
})

// M6-A regression: adjacent stored severities straddle the strict boundary.
it('S46 compares unrounded adjacent representable severities', () => {
  const lower = 1.001
  const upper = lower + Number.EPSILON
  for (const [severity, expected] of [[lower - Number.EPSILON, 'detection'], [lower, 'detection'], [upper, 'stability']] as const) {
    const routed = routeStop(baseline(half(27, 0), half(27, 0), { iqr: 150 * severity }))
    const recorded = routed.candidates.find(c => c.id === 'stability')!.severity!
    expect(routed.drillId).toBe(expected)
    expect(recorded).toBe(severity)
    expect(routed.tieBreak).toBe(recorded - 1 < .001)
  }
})

it('reproduces v1 recommendations without changing historical snapshots', () => {
  const source = baseline(half(27, 0), half(27, 0), { iqr: 150 * 1.001 })
  const old = routeStop(source, 'stop_drill_router_v1')
  const snapshot = JSON.stringify(old)
  expect(old.drillId).toBe('stability')
  expect(routeStop(source).version).toBe('stop_drill_router_v2')
  expect(routeStop(source).drillId).toBe('detection')
  expect(JSON.stringify(routeStop(source, old.version))).toBe(snapshot)
  expect(JSON.stringify(old)).toBe(snapshot)
})
