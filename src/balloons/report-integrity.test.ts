import { beforeAll, describe, expect, it } from 'vitest'
import type { ActionSource, CoreAction, CoreEvent, CoreState, FormId, ManifestRound, Profile, RoundResult, ScoredManifest } from './contracts'
import { startScoredSession, transition } from './core'
import { loadScoredManifests } from './manifests'
import { basicReport } from './report'
import committed from '../../docs/specifications/ASSESSMENT_PRACTICE_BALLOONS_FIXED_MANIFESTS_V1_0.json'

type Mutable<T> = { -readonly [K in keyof T]: T[K] extends object ? Mutable<T[K]> : T[K] }
type Snapshot = Mutable<CoreState>
let forms: ReadonlyMap<FormId, ScoredManifest>
let baseline: CoreState
const profiles: readonly Profile[] = ['A', 'B', 'C']
const sources: readonly ActionSource[] = ['keyboard', 'mouse', 'touch_or_pen', 'unknown_or_assistive']

function run(id: FormId, plan: (round: ManifestRound) => number = () => 6): CoreState {
  const manifest = forms.get(id)!
  const rotation = Number(id.at(-1)) - 1
  let state = startScoredSession(manifest, {
    installationId: 'repro-installation', sessionId: 'repro-session', chainId: 'repro-chain', stage: manifest.family,
    mapping: { 'Type 1': profiles[rotation], 'Type 2': profiles[(rotation + 1) % 3], 'Type 3': profiles[(rotation + 2) % 3] },
    exposureGeneration: 0, ownershipGeneration: 0,
  }, { wallTimeMs: 0, monotonicMs: 0, clockEpochId: 'epoch-1' })
  const choices = manifest.rounds.map(plan)
  function act(kind: CoreAction['kind']) {
    const n = state.nextActionId
    const step = transition(state, {
      kind, actionId: n, expectedRound: state.round, expectedRevision: state.revision, source: sources[n % 4],
      time: { wallTimeMs: n, monotonicMs: n < 100 ? n : n - 100, clockEpochId: n < 100 ? 'epoch-1' : 'epoch-2' },
    })
    if (!step.accepted) throw new Error('fixture action refused')
    state = step.state
  }
  while (state.status !== 'completed') {
    while (state.status === 'active' && state.current.attemptedPumps < choices[state.round - 1]) act('pump')
    if (state.status === 'active') act('collect')
    if (state.status === 'resolved') act('next')
  }
  return state
}
function clone(state = baseline): Snapshot { return structuredClone(state) as Snapshot }
function renumber(state: Snapshot) { state.events.forEach((event, index) => { event.sequenceNumber = index + 1 }) }
function refuses(change: (state: Snapshot) => void, original = baseline) {
  const state = clone(original)
  change(state)
  expect(() => basicReport(state)).toThrow()
}
beforeAll(async () => { forms = await loadScoredManifests(); baseline = run('BL1') })

describe('reported B1-A audit failures', () => {
  it('control: accepts original and detached genuine BL1, exactly 810 banked / 125 lost', () => {
    const expected = { status: 'headless_complete', total: { bankedCents: 810, lostCents: 125 } }
    expect(basicReport(baseline)).toMatchObject(expected)
    expect(basicReport(clone())).toEqual(basicReport(baseline))
    expect(baseline.events.every(event => event.validityCode === 'headless_unconfirmed')).toBe(true)
  })
  it('F1 rejects resolution before action despite contiguous event sequences', () => {
    refuses(state => { [state.events[1], state.events[2]] = [state.events[2], state.events[1]]; renumber(state) })
  })
  it('F1 rejects one action ID reused everywhere, even with a matching final counter', () => {
    refuses(state => { state.events.forEach(event => { if (event.actionId !== null) event.actionId = 1 }); state.nextActionId = 2 })
  })
  it('F2 rejects burst money reclassified as banked despite conservation and adjusted cumulative resolution totals', () => {
    refuses(state => {
      const round = state.results[4]
      expect(round).toMatchObject({ round: 5, outcome: 'burst', bankedCents: 0, lostCents: 15 })
      round.bankedCents = 15; round.lostCents = 0
      state.bankedCents += 15; state.lostCents -= 15
      for (const event of state.events) if (event.round >= 5 && event.type === 'round_resolved') {
        event.post.bankedCents += 15; event.post.lostCents -= 15
      }
    })
  })
  it('F3 rejects swapped candidate labels against the stored mapping', () => {
    refuses(state => { state.results.forEach(round => { if (round.visibleType === 'Type 1') round.visibleType = 'Type 2'; else if (round.visibleType === 'Type 2') round.visibleType = 'Type 1' }) })
  })
  it('F4 rejects altered threshold bytes retaining the approved stored hash', () => {
    refuses(state => { state.manifest.rounds[0].threshold = 2 })
  })
  it('verifies and retains a private manifest snapshot across asynchronous hash checks', async () => {
    const input = structuredClone(committed)
    const pending = loadScoredManifests(input)
    input.scored[0].rounds[0].threshold = 2
    const loaded = await pending
    expect(loaded.get('BL1')!.rounds[0].threshold).toBe(1)
    expect(Object.isFrozen(loaded.get('BL1')!.rounds[0])).toBe(true)
    expect(basicReport(clone())).toMatchObject({ status: 'headless_complete', total: { bankedCents: 810, lostCents: 125 } })
  })
  it('rejects the audit combined pump-total contradiction', () => {
    refuses(state => {
      const event = state.events.find(event => event.type === 'pump_attempted' && event.outcome === 'pump_success')!
      event.pre.currentCents = 999; event.post.successfulPumps = 999; event.post.currentCents = -5
    })
  })
  it('rejects the audit combined context contradiction', () => {
    refuses(state => { Object.assign(state.events[1], { chainId: 'other-chain', stage: 'mock', ownershipGeneration: 999, exposureGeneration: 999, validityCode: 'invalid' }) })
  })
  it('rejects the audit combined final-state contradiction', () => {
    refuses(state => { state.round = 1; state.current.currentCents = 995; state.current.attemptedPumps = 200; state.revision = 0 })
  })
})

describe('complete groups, context and final snapshot', () => {
  const contexts: [keyof CoreEvent, unknown][] = [
    ['schemaVersion', 'wrong'], ['specificationVersion', 'wrong'], ['formVersion', 'wrong'],
    ['scoringVersion', 'wrong'], ['routerVersion', 'wrong'], ['installationId', 'other'],
    ['sessionId', 'other'], ['chainId', 'other'], ['stage', 'mock'], ['manifestId', 'BL2'],
    ['manifestSha256', '0'.repeat(64)], ['mapping', { 'Type 1': 'C', 'Type 2': 'A', 'Type 3': 'B' }],
    ['round', 2], ['sequenceNumber', 99], ['actionId', 2], ['source', 'keyboard'],
    ['wallTimeMs', 999], ['clockEpochId', 'other'], ['monotonicMs', 999],
    ['exposureGeneration', 999], ['ownershipGeneration', 999], ['validityCode', 'invalid'], ['outcome', 'cap_collect'],
  ]
  it.each(contexts)('rejects contradictory %s inside a resolution group', (field, value) => {
    refuses(state => { Object.assign(state.events[2], { [field]: value }) })
  })
  it.each(['pre', 'post'] as const)('checks every %s total on successful Pump events', side => {
    for (const field of ['attemptedPumps', 'successfulPumps', 'currentCents', 'bankedCents', 'lostCents'] as const) {
      refuses(state => { state.events.find(event => event.outcome === 'pump_success')![side][field] += 1 })
    }
  })
  it.each(['round', 'revision', 'nextActionId', 'bankedCents', 'lostCents'] as const)('rejects mismatched final %s', field => {
    refuses(state => { state[field] += 1 })
  })
  it.each(['attemptedPumps', 'successfulPumps', 'currentCents'] as const)('rejects mismatched final current.%s', field => {
    refuses(state => { state.current[field] += 1 })
  })
  it('rejects mapping contradictions in initial context and final identity', () => {
    refuses(state => { state.events[0].mapping['Type 1'] = 'C' })
    refuses(state => { state.identity.mapping = { 'Type 1': 'B', 'Type 2': 'C', 'Type 3': 'A' } })
  })
  it('rejects removed, duplicated, appended and split groups after renumbering', () => {
    refuses(state => { state.events.splice(2, 1); renumber(state) })
    refuses(state => { state.events.splice(3, 0, structuredClone(state.events[2])); renumber(state) })
    refuses(state => { state.events.push(structuredClone(state.events.at(-1)!)); renumber(state) })
    refuses(state => { state.events[2].actionId = 2 })
  })
  it('rejects invalid action time/source without silently changing the headless boundary', () => {
    for (const patch of [{ source: 'invalid' }, { monotonicMs: NaN }, { wallTimeMs: Infinity }, { clockEpochId: '' }]) {
      refuses(state => { Object.assign(state.events[1], patch) })
    }
    refuses(state => { state.events.forEach(event => { Object.assign(event, { validityCode: 'valid' }) }) })
  })
  it('rejects corrupted form metadata as well as threshold/profile/order bytes', () => {
    for (const patch of [{ id: 'BL2' }, { candidateSeed: 2 }, { family: 'replay' }, { sha256: '0'.repeat(64) }, { playableSignatureSha256: '0'.repeat(64) }, { extra: true }]) {
      refuses(state => { Object.assign(state.manifest, patch) })
    }
    refuses(state => { state.manifest.rounds[0].profile = 'B' })
    refuses(state => { [state.manifest.rounds[0], state.manifest.rounds[1]] = [state.manifest.rounds[1], state.manifest.rounds[0]] })
  })
  it('rejects outcome-specific pump, cent and censoring contradictions', () => {
    const patches: Partial<RoundResult>[] = [
      { attemptedPumps: 0 }, { successfulPumps: -1 }, { bankedCents: 0.5 }, { lostCents: -5 },
      { voluntaryPoint: 0 }, { censored: false }, { outcome: 'cap_collect' },
    ]
    for (const patch of patches) refuses(state => { Object.assign(state.results[0], patch) })
    refuses(state => { const row = state.results.find(row => row.outcome === 'voluntary_collect')!; row.lostCents = 5; row.bankedCents -= 5 })
    const capped = run('RP2', () => 32)
    expect(capped.results[13]).toMatchObject({ outcome: 'cap_collect', attemptedPumps: 32, successfulPumps: 32, bankedCents: 160, lostCents: 0 })
    refuses(state => { state.results[13].successfulPumps = 31; state.results[13].attemptedPumps = 31; state.results[13].bankedCents = 155 }, capped)
    refuses(state => { state.results[13].outcome = 'voluntary_collect'; state.results[13].voluntaryPoint = 32; state.results[13].censored = false }, capped)
    const at32 = run('RT1', () => 32)
    expect(at32.results[33]).toMatchObject({ outcome: 'burst', attemptedPumps: 32, successfulPumps: 31, lostCents: 155 })
    refuses(state => { Object.assign(state.results[33], { outcome: 'cap_collect', successfulPumps: 32, bankedCents: 160, lostCents: 0 }) }, at32)
  })
})

describe('genuine complete sessions and unchanged report evidence thresholds', () => {
  it.each(['BL1', 'BL2', 'BL3', 'RP1', 'RP2', 'RP3', 'RT1', 'RT2', 'RT3'] as const)('admits every fixed policy 0..32 on %s with independent arithmetic', id => {
    for (let k = 0; k <= 32; k++) {
      const state = run(id, () => k)
      const report = basicReport(clone(state))
      if (report.status !== 'headless_complete') throw new Error('genuine complete report refused')
      let banked = 0, lost = 0, attempts = 0, successes = 0
      for (const row of forms.get(id)!.rounds) {
        const burst = row.threshold <= k
        const successful = burst ? row.threshold - 1 : k
        successes += successful; attempts += successful + Number(burst)
        banked += burst ? 0 : 5 * successful; lost += burst ? 5 * successful : 0
        expect(report.rounds[row.round - 1]).toMatchObject({
          outcome: burst ? 'burst' : k === 32 ? 'cap_collect' : 'voluntary_collect',
          attemptedPumps: successful + Number(burst), successfulPumps: successful,
          bankedCents: burst ? 0 : 5 * successful, lostCents: burst ? 5 * successful : 0,
          voluntaryPoint: burst || k === 32 ? null : k, censored: burst || k === 32,
        })
      }
      expect(report.total).toMatchObject({ bankedCents: banked, lostCents: lost, attemptedPumps: attempts, successfulPumps: successes })
      expect(JSON.stringify(report)).not.toMatch(/"(?:threshold|profile|mapping|candidateSeed|manifestSha256)"/)
    }
  })
  it.each([0, 4, 5, 13])('preserves the five-voluntary-point minimum with n=%i per category', count => {
    const seen = { A: 0, B: 0, C: 0 }
    const state = run('BL1', row => ++seen[row.profile] <= count ? Math.min(row.threshold - 1, row.round % 6) : 32)
    const report = basicReport(state)
    if (report.status !== 'headless_complete') throw new Error('missing complete report')
    for (const category of report.categories) {
      expect(category.voluntaryMedian).toMatchObject({ status: count >= 5 ? 'supported' : 'insufficient_evidence', count })
    }
  })
  it.each([[2, 3], [3, 2], [3, 3]])('preserves early/late minimum with counts %i/%i', (early, late) => {
    const seen = new Map<string, number>()
    const state = run('BL1', row => {
      const block = Math.floor((row.round - 1) / 13), key = `${row.profile}${block}`
      seen.set(key, (seen.get(key) ?? 0) + 1)
      return seen.get(key)! <= (block === 0 ? early : block === 2 ? late : 0) ? 0 : 32
    })
    const report = basicReport(state)
    if (report.status !== 'headless_complete') throw new Error('missing complete report')
    for (const category of report.categories) expect(category.earlyLate).toMatchObject({ status: early >= 3 && late >= 3 ? 'supported' : 'insufficient_evidence', earlyCount: early, lateCount: late })
  })
})
