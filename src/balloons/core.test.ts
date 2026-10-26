import { beforeAll, describe, expect, it } from 'vitest'
import committed from '../../docs/specifications/ASSESSMENT_PRACTICE_BALLOONS_FIXED_MANIFESTS_V1_0.json'
import { startScoredSession, transition } from './core'
import type { CoreAction, CoreState, FormId, ScoredManifest, SessionIdentity } from './contracts'
import { loadScoredManifests } from './manifests'
import { basicReport } from './report'

let forms: ReadonlyMap<FormId, ScoredManifest>
const identity: SessionIdentity = {
  installationId: 'installation-test', sessionId: 'session-test', chainId: 'chain-test', stage: 'baseline',
  mapping: { 'Type 1': 'A', 'Type 2': 'B', 'Type 3': 'C' }, exposureGeneration: 4, ownershipGeneration: 7,
}
beforeAll(async () => { forms = await loadScoredManifests() })
function start(id: FormId): CoreState {
  const form = forms.get(id)!
  const stage = form.family === 'retest' ? 'retest' : form.family === 'replay' ? 'replay' : 'baseline'
  const offset = Number(id.at(-1)) - 1
  const profiles = ['A', 'B', 'C'] as const
  const mapping = form.family === 'retest' ? identity.mapping : { 'Type 1': profiles[offset], 'Type 2': profiles[(offset + 1) % 3], 'Type 3': profiles[(offset + 2) % 3] }
  return startScoredSession(form, { ...identity, stage, mapping }, { wallTimeMs: 1000, monotonicMs: 0, clockEpochId: 'epoch-1' })
}
function action(state: CoreState, kind: CoreAction['kind'], override: Partial<CoreAction> = {}): CoreAction {
  return { kind, actionId: state.nextActionId, expectedRound: state.round, expectedRevision: state.revision, source: 'keyboard', time: { wallTimeMs: 1000 + state.revision + 1, monotonicMs: state.revision + 1, clockEpochId: 'epoch-1' }, ...override }
}
function accepted(state: CoreState, kind: CoreAction['kind']): CoreState {
  const result = transition(state, action(state, kind))
  expect(result.accepted).toBe(true)
  return result.state
}
function advanceTo(state: CoreState, target: number): CoreState {
  while (state.round < target) {
    state = accepted(state, 'collect')
    state = accepted(state, 'next')
  }
  return state
}
function finishWithFixedPolicy(id: FormId, k: number): CoreState {
  let state = start(id)
  while (state.status !== 'completed') {
    const threshold = state.manifest.rounds[state.round - 1].threshold
    const attempts = Math.min(k, 32, threshold)
    for (let i = 0; i < attempts && state.status === 'active'; i++) state = accepted(state, 'pump')
    if (state.status === 'active') state = accepted(state, 'collect')
    if (state.status === 'resolved') state = accepted(state, 'next')
  }
  return state
}

describe('Balloons B1-A boundaries', () => {
  it('bursts on the first attempted pump without adding cents', () => {
    let state = start('BL1')
    state = accepted(state, 'pump')
    expect(state.status).toBe('resolved')
    expect(state.results[0]).toMatchObject({ attemptedPumps: 1, successfulPumps: 0, lostCents: 0, bankedCents: 0, voluntaryPoint: null, censored: true, outcome: 'burst' })
    expect(state.events.map(event => event.type)).toEqual(['round_presented', 'pump_attempted', 'round_resolved'])
    expect(state.events[1]).toMatchObject({ actionId: 1, sequenceNumber: 2, outcome: 'burst', pre: { currentCents: 0 }, post: { currentCents: 0 } })
  })
  it('T=32 bursts before increment; T=33 automatically banks 160 at cap', () => {
    let burst = advanceTo(start('RT1'), 34)
    for (let i = 0; i < 32; i++) burst = accepted(burst, 'pump')
    expect(burst.results.at(-1)).toMatchObject({ attemptedPumps: 32, successfulPumps: 31, lostCents: 155, bankedCents: 0, outcome: 'burst', voluntaryPoint: null, censored: true })
    const before = burst
    expect(transition(burst, action(burst, 'pump')).accepted).toBe(false)
    expect(burst).toBe(before)
    let cap = advanceTo(start('RP2'), 14)
    for (let i = 0; i < 32; i++) cap = accepted(cap, 'pump')
    expect(cap.results.at(-1)).toMatchObject({ attemptedPumps: 32, successfulPumps: 32, lostCents: 0, bankedCents: 160, outcome: 'cap_collect', voluntaryPoint: null, censored: true })
    expect(cap.events.at(-2)?.type).toBe('cap_collected')
    expect(cap.events.at(-1)?.type).toBe('round_resolved')
  })
  it('permits zero-pump Collect and keeps the earlier bank untouched after a burst', () => {
    let state = start('BL1')
    state = accepted(state, 'collect')
    expect(state.results[0]).toMatchObject({ attemptedPumps: 0, successfulPumps: 0, bankedCents: 0, voluntaryPoint: 0, outcome: 'voluntary_collect' })
    state = accepted(state, 'next')
    for (let i = 0; i < 3; i++) state = accepted(state, 'pump')
    state = accepted(state, 'collect')
    expect(state.bankedCents).toBe(15)
    state = accepted(state, 'next')
    const threshold = state.manifest.rounds[2].threshold
    for (let i = 0; i < threshold; i++) state = accepted(state, 'pump')
    expect(state.results[2].outcome).toBe('burst')
    expect(state.bankedCents).toBe(15)
    expect(state.results[2].lostCents).toBe(5 * (threshold - 1))
  })
  it('rejects duplicate action IDs, skipped IDs, stale revision and stale round without mutation', () => {
    const first = start('BL1')
    const command = action(first, 'collect')
    const after = transition(first, command).state
    for (const invalid of [command, action(after, 'next', { actionId: after.nextActionId + 1 }), action(after, 'next', { expectedRevision: first.revision }), action(after, 'next', { expectedRound: 2 })]) {
      const rejection = transition(after, invalid)
      expect(rejection.accepted).toBe(false)
      expect(rejection.state).toBe(after)
    }
    const next = accepted(after, 'next')
    expect(next.events.map(event => event.sequenceNumber)).toEqual([1, 2, 3, 4])
    expect(next.events.at(-1)).toMatchObject({ type: 'round_presented', actionId: 2, round: 2 })
  })
  it('finishes all nine 39-round forms and independently checks each conservation identity', () => {
    for (const form of forms.values()) {
      const state = finishWithFixedPolicy(form.id, 6)
      expect(state.status).toBe('completed')
      expect(state.results).toHaveLength(39)
      expect(state.events.at(-1)?.type).toBe('session_completed')
      expect(state.events.map(event => event.sequenceNumber)).toEqual(Array.from({ length: state.events.length }, (_, i) => i + 1))
      const expected = form.rounds.map(round => {
        const burst = round.threshold <= 6
        const successful = burst ? round.threshold - 1 : 6
        return { attempted: successful + Number(burst), successful, lost: burst ? 5 * successful : 0, banked: burst ? 0 : 30, burst }
      })
      const report = basicReport(state)
      expect(report.status).toBe('headless_complete')
      if (report.status !== 'headless_complete') throw new Error('missing report')
      const check = (indices: number[], summary: typeof report.total) => {
        const selected = indices.map(i => expected[i])
        const sum = (field: 'attempted' | 'successful' | 'lost' | 'banked') => selected.reduce((n, row) => n + row[field], 0)
        const bursts = selected.filter(row => row.burst).length
        expect(summary.rounds).toBe(selected.length)
        expect(summary.burstCount).toBe(bursts)
        expect(summary.collectedCount).toBe(selected.length - bursts)
        expect(summary.voluntaryCount + summary.capCount + summary.burstCount).toBe(selected.length)
        expect(summary.zeroPumpCount).toBeLessThanOrEqual(summary.voluntaryCount)
        expect(summary.attemptedPumps).toBe(sum('attempted'))
        expect(summary.successfulPumps).toBe(sum('successful'))
        expect(summary.attemptedPumps).toBe(summary.successfulPumps + summary.burstCount)
        expect(summary.bankedCents).toBe(sum('banked'))
        expect(summary.lostCents).toBe(sum('lost'))
        expect(5 * summary.successfulPumps).toBe(summary.bankedCents + summary.lostCents)
      }
      check(Array.from({ length: 39 }, (_, i) => i), report.total)
      for (const category of report.categories) check(form.rounds.flatMap((round, i) => round.profile === state.identity.mapping[category.visibleType] ? [i] : []), category)
      for (let block = 0; block < 3; block++) check(Array.from({ length: 13 }, (_, i) => block * 13 + i), report.blocks[block].summary)
      expect(JSON.stringify(report)).not.toContain('threshold')
      expect(report.rounds.every(round => round.outcome === 'burst' ? round.voluntaryPoint === null && round.censored : round.voluntaryPoint !== null)).toBe(true)
    }
  })
  it('reports explicit insufficient evidence for incomplete sessions and sparse voluntary medians', () => {
    expect(basicReport(start('BL1'))).toEqual({ status: 'insufficient_evidence', resolvedRounds: 0, requiredRounds: 39, message: 'Only 0 of 39 rounds are resolved.' })
    const complete = finishWithFixedPolicy('BL1', 32)
    const report = basicReport(complete)
    if (report.status !== 'headless_complete') throw new Error('missing report')
    expect(report.categories.some(category => category.voluntaryMedian.status === 'insufficient_evidence')).toBe(true)
    for (const category of report.categories) {
      if (category.voluntaryMedian.status === 'insufficient_evidence') expect(category.voluntaryMedian.message).toBe(`not enough voluntary collections (${category.voluntaryMedian.count}/5)`)
      if (category.earlyLate.status === 'insufficient_evidence') expect(category.earlyLate.message).toContain('not enough observed voluntary collections')
    }
    expect(report.postBurst.status).toBe('insufficient_evidence')
  })
  it('retains half-pump voluntary medians and rejects a falsified completed journal', () => {
    let state = start('BL1')
    while (state.status !== 'completed') {
      const k = state.round % 2 === 0 ? 5 : 4
      const threshold = state.manifest.rounds[state.round - 1].threshold
      for (let i = 0; i < Math.min(k, threshold) && state.status === 'active'; i++) state = accepted(state, 'pump')
      if (state.status === 'active') state = accepted(state, 'collect')
      if (state.status === 'resolved') state = accepted(state, 'next')
    }
    const report = basicReport(state)
    if (report.status !== 'headless_complete') throw new Error('missing report')
    const independentMedian = (points: number[]) => {
      points.sort((a, b) => a - b)
      const middle = Math.floor(points.length / 2)
      return points.length % 2 ? points[middle] : (points[middle - 1] + points[middle]) / 2
    }
    for (const category of report.categories) {
      const profile = state.identity.mapping[category.visibleType]
      const points = state.manifest.rounds.filter(round => round.profile === profile && round.threshold > (round.round % 2 === 0 ? 5 : 4)).map(round => round.round % 2 === 0 ? 5 : 4)
      if (points.length >= 5) {
        expect(category.voluntaryMedian).toEqual({ status: 'supported', count: points.length, value: independentMedian(points) })
      }
    }
    const altered = structuredClone(state)
    ;(altered.events[1] as { sequenceNumber: number }).sequenceNumber = 17
    expect(() => basicReport(altered)).toThrow(/event sequence/)
  })
  it('shows all four observed outcomes in each of two disjoint supported post-burst windows', () => {
    const choices = new Map([[6, 8], [7, 2], [12, 2], [16, 8], [26, 8], [29, 9], [32, 2], [37, 8]])
    let state = start('BL1')
    while (state.status !== 'completed') {
      const count = choices.get(state.round) ?? 0
      for (let i = 0; i < count && state.status === 'active'; i++) state = accepted(state, 'pump')
      if (state.status === 'active') state = accepted(state, 'collect')
      if (state.status === 'resolved') state = accepted(state, 'next')
    }
    const report = basicReport(state)
    if (report.status !== 'headless_complete' || report.postBurst.status !== 'supported') throw new Error('missing post-burst evidence')
    expect(report.postBurst.value.map(window => window.observations.map(item => [item.round, item.outcome, item.voluntaryPoint]))).toEqual([
      [[6, 'voluntary_collect', 8], [7, 'burst', null], [12, 'voluntary_collect', 2], [16, 'voluntary_collect', 8]],
      [[26, 'voluntary_collect', 8], [29, 'burst', null], [32, 'voluntary_collect', 2], [37, 'voluntary_collect', 8]],
    ])
    expect(JSON.stringify(report)).not.toContain('threshold')
  })
  it('rejects altered form bytes/hash and never starts an unverified manifest', async () => {
    const changed = structuredClone(committed)
    changed.scored[0].rounds[0].threshold = 2
    await expect(loadScoredManifests(changed)).rejects.toThrow(/integrity/)
    expect(() => startScoredSession(changed.scored[0] as ScoredManifest, identity, { wallTimeMs: 0, monotonicMs: 0, clockEpochId: 'epoch-1' })).toThrow(/verified committed loader/)
    const alteredHash = structuredClone(committed)
    alteredHash.scored[0].sha256 = '0'.repeat(64)
    await expect(loadScoredManifests(alteredHash)).rejects.toThrow(/hash mismatch/)
    expect(() => startScoredSession(forms.get('BL2')!, identity, { wallTimeMs: 0, monotonicMs: 0, clockEpochId: 'epoch-1' })).toThrow(/mapping must follow form number/)
  })
})
