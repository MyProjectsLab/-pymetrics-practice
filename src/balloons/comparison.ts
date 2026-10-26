import type { VisibleType } from './contracts'
import { BALLOONS_FORM_VERSION, BALLOONS_ROUTER_VERSION, BALLOONS_SCORING_VERSION, BALLOONS_SPEC_VERSION } from './contracts'
import { durableBaseline, DURABLE_VERSION, reconcileDurable } from './durable'
import { canonicalJson } from './manifests'
import { basicReport } from './report'
import type { BasicReport, CategoryReport, CountSummary } from './report'
import { retestChain } from './retest'
import type { Root } from './storage'

export type Difference = { readonly baseline: number; readonly retest: number; readonly delta: number }
export type MedianDifference = { readonly baselineCount: number; readonly retestCount: number; readonly required: number; readonly difference: Difference | null }
export interface ComparisonRow {
  readonly label: string
  readonly denominator: number
  readonly bankedCents: Difference
  readonly lostCents: Difference
  readonly collectedCount: Difference
  readonly burstCount: Difference
  readonly voluntaryCount: Difference
  readonly capCount: Difference
  readonly median?: MedianDifference
  readonly early?: MedianDifference
  readonly late?: MedianDifference
}
export interface SavedComparison {
  readonly status: 'ready'
  readonly baselineFormId: string
  readonly retestFormId: string
  readonly baselineSessionId: string
  readonly retestSessionId: string
  readonly installationId: string
  readonly rows: readonly ComparisonRow[]
}
export type ComparisonResult = SavedComparison | { readonly status: 'unavailable'; readonly reason: string }
const diff = (baseline: number, retest: number): Difference => ({ baseline, retest, delta: retest - baseline })
function median(points: number[]): number {
  points.sort((a, b) => a - b)
  const middle = Math.floor(points.length / 2)
  return points.length % 2 ? points[middle] : (points[middle - 1] + points[middle]) / 2
}
function points(report: BasicReport, type: VisibleType, segment: 'all' | 'early' | 'late'): number[] {
  return report.rounds.filter(r => r.visibleType === type && r.outcome === 'voluntary_collect' &&
    (segment === 'all' || (segment === 'early' ? r.round <= 13 : r.round >= 27))).map(r => r.voluntaryPoint!)
}
function medianDifference(bl: number[], rt: number[], required: number): MedianDifference {
  return { baselineCount: bl.length, retestCount: rt.length, required,
    difference: bl.length >= required && rt.length >= required ? diff(median(bl), median(rt)) : null }
}
function row(label: string, bl: CountSummary, rt: CountSummary, denominator: number, medians?: { bl: BasicReport; rt: BasicReport; type: VisibleType }): ComparisonRow {
  return { label, denominator, bankedCents: diff(bl.bankedCents, rt.bankedCents), lostCents: diff(bl.lostCents, rt.lostCents),
    collectedCount: diff(bl.collectedCount, rt.collectedCount), burstCount: diff(bl.burstCount, rt.burstCount),
    voluntaryCount: diff(bl.voluntaryCount, rt.voluntaryCount), capCount: diff(bl.capCount, rt.capCount),
    ...(medians ? { median: medianDifference(points(medians.bl, medians.type, 'all'), points(medians.rt, medians.type, 'all'), 5),
      early: medianDifference(points(medians.bl, medians.type, 'early'), points(medians.rt, medians.type, 'early'), 3),
      late: medianDifference(points(medians.bl, medians.type, 'late'), points(medians.rt, medians.type, 'late'), 3) } : {}) }
}

/** Caller supplies one freshly read installation root. No cached report, recommendation,
 * completion flag or UI record can authorize the numbers. This function never writes. */
export function compareSaved(root: Root, retestSessionId: string): ComparisonResult {
  const unavailable = (reason: string): ComparisonResult => ({ status: 'unavailable', reason })
  const rt = root.records[retestSessionId]
  if (root.tombstones[retestSessionId]) return unavailable('The saved retest was deleted.')
  if (!rt) return unavailable('The saved retest is missing or unsaved.')
  if (!rt.header.retest || rt.header.identity.stage !== 'retest') return unavailable('This result is not a retest.')
  const binding = rt.header.retest, bl = root.records[binding.baselineSessionId]
  if (root.tombstones[binding.baselineSessionId]) return unavailable('The saved baseline was deleted.')
  if (!bl) return unavailable('The saved baseline is missing or unsaved.')
  if (bl.header.identity.installationId !== root.installationId || rt.header.identity.installationId !== root.installationId)
    return unavailable('The Balloons installation was replaced.')
  const versions = [bl, rt].map(record => {
    const e = record.journal[0]
    return record.header.version === DURABLE_VERSION && e?.specificationVersion === BALLOONS_SPEC_VERSION &&
      e?.formVersion === BALLOONS_FORM_VERSION && e?.scoringVersion === BALLOONS_SCORING_VERSION && e?.routerVersion === BALLOONS_ROUTER_VERSION
  })
  if (versions.some(supported => !supported)) return unavailable('The specification, form, scoring or router versions are incompatible.')
  try { reconcileDurable(bl); reconcileDurable(rt) } catch { return unavailable('A saved endpoint failed journal or manifest integrity checks.') }
  if (!durableBaseline(bl)) return unavailable('The baseline is invalid, incomplete or ineligible.')
  if (rt.snapshot.phase !== 'completed' || !rt.snapshot.comparisonEligible || rt.snapshot.exposure !== 'form_exposed' || rt.snapshot.confirmedRounds.length !== 39 || rt.header.repeat)
    return unavailable('The retest is invalid, incomplete or ineligible.')
  const chainId = bl.header.identity.chainId, chain = chainId && root.training?.chains[chainId]
  if (!chainId || !chain || rt.header.identity.chainId !== chainId || chain.retestSessionId !== retestSessionId || chain.completedRetestSessionId !== retestSessionId ||
    chain.recommendation.baseline.sessionId !== binding.baselineSessionId || binding.baselineFormId !== bl.header.formId || binding.drillAttemptId !== chain.firstCompletedDrillId)
    return unavailable('The original training chain or its closed endpoints changed.')
  try { retestChain(root, chainId, retestSessionId) } catch { return unavailable('The assigned drill, baseline or chain authority is missing, deleted or invalid.') }
  const a = bl.header, b = rt.header, ac = bl.snapshot.core, bc = rt.snapshot.core
  if (a.version !== b.version || ac.events[0]?.specificationVersion !== bc.events[0]?.specificationVersion ||
    ac.events[0]?.scoringVersion !== bc.events[0]?.scoringVersion || ac.events[0]?.formVersion !== bc.events[0]?.formVersion ||
    ac.events[0]?.routerVersion !== bc.events[0]?.routerVersion || ac.events[0]?.routerVersion !== BALLOONS_ROUTER_VERSION)
    return unavailable('The specification, form, scoring or router versions differ.')
  if (canonicalJson(a.identity.mapping) !== canonicalJson(b.identity.mapping) || canonicalJson(a.settings) !== canonicalJson(b.settings) ||
    canonicalJson(a.identity.mapping) !== canonicalJson(chain.recommendation.mapping) || canonicalJson(a.settings) !== canonicalJson(chain.recommendation.settings))
    return unavailable('The Type mapping, visible identity or information settings differ.')
  if (ac.manifest.family !== 'baseline' || bc.manifest.family !== 'retest')
    return unavailable('The risk model, cap, payout or form family is incompatible.')
  let blReport: BasicReport, rtReport: BasicReport
  try {
    const left = basicReport(ac), right = basicReport(bc)
    if (left.status !== 'headless_complete' || right.status !== 'headless_complete') return unavailable('Both complete saved endpoints are required.')
    blReport = left; rtReport = right
  } catch { return unavailable('The saved result arithmetic failed integrity checks.') }
  const types: VisibleType[] = ['Type 1', 'Type 2', 'Type 3']
  const categories = (report: BasicReport, type: VisibleType): CategoryReport => report.categories.find(c => c.visibleType === type)!
  return { status: 'ready', baselineFormId: a.formId, retestFormId: b.formId,
    baselineSessionId: a.identity.sessionId, retestSessionId: b.identity.sessionId, installationId: root.installationId,
    rows: [row('All balloons', blReport.total, rtReport.total, 39),
      ...types.map(type => row(type, categories(blReport, type), categories(rtReport, type), 13, { bl: blReport, rt: rtReport, type }))] }
}
