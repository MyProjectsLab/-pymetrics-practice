import { beforeAll, expect, it } from 'vitest'
import { webcrypto } from 'node:crypto'
import type { FormId, ManifestRound } from './contracts'
import { compareSaved } from './comparison'
import { advance } from './durable'
import { loadScoredManifests } from './manifests'
import { loadDrillManifests } from './drill-manifests'
import { closeRetest, reserveRetest } from './retest'
import { eligibleRoot } from './retest-test-support'

beforeAll(async () => { Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true }); await loadScoredManifests(); await loadDrillManifests() })
function completed(bl: FormId, rtNumber: number, policy: (row: ManifestRound) => number = () => 0, source: 'mouse' | 'keyboard' | 'touch_or_pen' = 'mouse') {
  const root = eligibleRoot(bl)
  let tick = 0
  const time = () => ({ wallTimeMs: 1000000 + ++tick, monotonicMs: tick, clockEpochId: 'compare' })
  for (let n = 1; n < rtNumber; n++) {
    const prior = reserveRetest(root, `owner-${n}`, 'base', time(), 'test', n > 1)
    let attempt = advance(prior.record, { kind: 'arm' }, time())
    attempt = advance(attempt, { kind: 'pause' }, time())
    root.records[prior.token.sessionId] = attempt
  }
  const reservation = reserveRetest(root, 'owner-final', 'base', time(), 'test', rtNumber > 1)
  let record = reservation.record
  const present = () => { record = advance(advance(record, { kind: 'arm' }, time()), { kind: 'confirm' }, time()) }
  present()
  while (record.snapshot.phase !== 'completed') {
    const core = record.snapshot.core, row = core.manifest.rounds[core.round - 1], now = time()
    const action = { kind: core.status === 'resolved' ? 'next' as const : core.current.successfulPumps < policy(row) ? 'pump' as const : 'collect' as const,
      actionId: core.nextActionId, expectedRound: core.round, expectedRevision: core.revision,
      source: core.nextActionId % 2 ? source : 'unknown_or_assistive' as const, time: now }
    record = advance(advance(record, { kind: 'action_pending', action }, now), { kind: 'action', action }, now)
    if (action.kind === 'next') present()
  }
  root.records[reservation.token.sessionId] = record
  closeRetest(root, record)
  return { root, record, id: reservation.token.sessionId }
}

it.each(['BL1', 'BL2', 'BL3'] as FormId[])('compares %s against every actual RT identity, including mixed action sources', bl => {
  for (let n = 1; n <= 3; n++) {
    const { root, id } = completed(bl, n, row => row.round % 3 === 0 ? 2 : 0, 'keyboard')
    const result = compareSaved(root, id)
    expect(result.status).toBe('ready')
    if (result.status !== 'ready') continue
    expect([result.baselineFormId, result.retestFormId]).toEqual([bl, `RT${n}`])
    expect(result.rows.map(r => [r.label, r.denominator])).toEqual([['All balloons', 39], ['Type 1', 13], ['Type 2', 13], ['Type 3', 13]])
    for (const row of result.rows) {
      for (const key of ['bankedCents', 'lostCents', 'collectedCount', 'burstCount', 'voluntaryCount', 'capCount'] as const)
        expect(row[key].delta).toBe(row[key].retest - row[key].baseline)
      expect(row.collectedCount.retest + row.burstCount.retest).toBe(row.denominator)
    }
    expect(root.records[id].snapshot.core.events.some(e => e.source === 'keyboard')).toBe(true)
    expect(root.records[id].snapshot.core.events.some(e => e.source === 'unknown_or_assistive')).toBe(true)
  }
}, 60000)

it('keeps half-pump medians exact and suppresses only unsupported full/early/late measures', () => {
  const { root, id } = completed('BL2', 1, row => {
    const same = rtRows.filter(r => r.profile === row.profile)
    const index = same.findIndex(r => r.round === row.round)
    return index < 5 ? index % 2 : row.threshold
  })
  const result = compareSaved(root, id)
  expect(result.status).toBe('ready')
  if (result.status !== 'ready') return
  for (const row of result.rows.slice(1)) {
    expect(row.median?.retestCount).toBeGreaterThanOrEqual(5)
    expect(row.median?.difference).not.toBeNull()
    expect(row.early?.retestCount).toBeLessThanOrEqual(5)
    expect(row.late?.difference).toBeNull()
    expect(row.late?.baselineCount).toBeGreaterThanOrEqual(3)
  }
})

it.each([4, 5])('full-type median boundary: %i voluntary RT observations', count => {
  const selected = new Set<string>()
  for (const profile of ['A', 'B', 'C']) rtRows.filter(r => r.profile === profile).slice(0, count).forEach(r => selected.add(String(r.round)))
  const { root, id } = completed('BL1', 1, row => selected.has(String(row.round)) ? 0 : row.threshold)
  const comparison = compareSaved(root, id)
  expect(comparison.status).toBe('ready')
  if (comparison.status !== 'ready') return
  for (const row of comparison.rows.slice(1)) {
    expect(row.median?.retestCount).toBe(count)
    expect(row.median?.difference !== null).toBe(count === 5)
  }
})

it.each([2, 3])('early and late segment boundary: %i voluntary RT observations each', count => {
  const selected = new Set<number>()
  for (const profile of ['A', 'B', 'C']) {
    rtRows.filter(r => r.profile === profile && r.round <= 13).slice(0, count).forEach(r => selected.add(r.round))
    rtRows.filter(r => r.profile === profile && r.round >= 27).slice(0, count).forEach(r => selected.add(r.round))
  }
  const { root, id } = completed('BL3', 1, row => selected.has(row.round) ? 0 : row.threshold)
  const comparison = compareSaved(root, id)
  expect(comparison.status).toBe('ready')
  if (comparison.status !== 'ready') return
  for (const row of comparison.rows.slice(1)) {
    expect(row.early?.retestCount).toBe(count)
    expect(row.late?.retestCount).toBe(count)
    expect(row.early?.difference !== null).toBe(count === 3)
    expect(row.late?.difference !== null).toBe(count === 3)
    expect(row.median?.difference !== null).toBe(count === 3)
  }
})

// A separately loaded fixed row list supplies the intended collection plan; it
// does not read a comparison output to choose observations.
let rtRows: readonly ManifestRound[] = []
beforeAll(async () => { const { verifiedScoredManifest } = await import('./manifests'); rtRows = verifiedScoredManifest('RT1')!.rounds })

it.each(['baseline', 'baseline-missing', 'baseline-invalid', 'retest', 'retest-missing', 'drill', 'drill-missing', 'drill-corrupt', 'chain', 'endpoint-substitute', 'installation', 'settings', 'mapping', 'version', 'risk-model', 'payout', 'incomplete'])(
  'withdraws numerical output for %s authority failure', fault => {
    const built = completed('BL1', 1), root = structuredClone(built.root), id = built.id
    if (fault === 'baseline') { root.tombstones.base = { sessionId: 'base', chainId: 'chain', formId: 'BL1', exposure: 'form_exposed', deletedAtMs: 1 }; delete root.records.base }
    if (fault === 'baseline-missing') delete root.records.base
    if (fault === 'baseline-invalid') root.records.base.snapshot.comparisonEligible = false
    if (fault === 'retest') { root.tombstones[id] = { sessionId: id, chainId: 'chain', formId: 'RT1', exposure: 'form_exposed', deletedAtMs: 1 }; delete root.records[id] }
    if (fault === 'retest-missing') delete root.records[id]
    if (fault === 'drill') root.training!.deletedAttemptIds.push('drill')
    if (fault === 'drill-missing') delete root.training!.attempts.drill
    if (fault === 'drill-corrupt') (root.training!.attempts.drill.snapshot.results as unknown[]).pop()
    if (fault === 'chain') root.training!.chains.chain = { ...root.training!.chains.chain, completedRetestSessionId: 'substitute' }
    if (fault === 'endpoint-substitute') root.training!.chains.chain = { ...root.training!.chains.chain, retestSessionId: 'substitute' }
    if (fault === 'installation') root.installationId = 'replacement'
    if (fault === 'settings') root.records[id].header.settings.verbose = true
    if (fault === 'mapping') (root.records[id].header.identity.mapping as Record<string, string>)['Type 1'] = 'C'
    if (fault === 'version') (root.records[id].journal[0] as { scoringVersion: string }).scoringVersion = 'other'
    if (fault === 'risk-model') (root.records[id].snapshot.core.manifest.rounds[0] as { threshold: number }).threshold = 49
    if (fault === 'payout') (root.records[id].snapshot.core.results[0] as { bankedCents: number }).bankedCents = 999
    if (fault === 'incomplete') root.records[id].snapshot.confirmedRounds.pop()
    const result = compareSaved(root, id)
    expect(result.status).toBe('unavailable')
    if (result.status === 'unavailable' && fault === 'version') expect(result.reason).toMatch(/versions are incompatible/)
    if (result.status === 'unavailable' && fault === 'installation') expect(result.reason).toMatch(/installation was replaced/)
  }, 60000)

it('does not mutate either immutable journal or the saved chain while comparing', () => {
  const { root, id } = completed('BL3', 3, () => 32, 'touch_or_pen')
  const before = JSON.stringify(root)
  const result = compareSaved(root, id)
  expect(result.status).toBe('ready')
  expect(JSON.stringify(root)).toBe(before)
  if (result.status === 'ready') expect(result.rows[0].bankedCents.delta).toBe(result.rows.slice(1).reduce((sum, row) => sum + row.bankedCents.delta, 0))
}, 60000)
