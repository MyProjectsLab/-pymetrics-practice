import type { FormId, Mapping, VisibleType, Profile } from './contracts'
import { BALLOONS_ROUTER_VERSION, BALLOONS_SCORING_VERSION, BALLOONS_SPEC_VERSION } from './contracts'
import { durableBaseline } from './durable'
import type { Settings } from './durable'
import { canonicalJson } from './manifests'
import { inspectRoot } from './storage'
import type { Root } from './storage'
import { deriveRouterEvidence, immutable } from './training-evidence'
import type { DrillKind, RouterEvidence } from './training-evidence'

export interface BaselineRef { readonly installationId: string; readonly sessionId: string }
export interface Recommendation {
  readonly status: 'recommended'
  readonly specificationVersion: typeof BALLOONS_SPEC_VERSION
  readonly scoringVersion: typeof BALLOONS_SCORING_VERSION
  readonly routerVersion: typeof BALLOONS_ROUTER_VERSION
  readonly baseline: BaselineRef
  readonly baselineFormId: FormId
  readonly baselineCore: string
  readonly chainId: string
  readonly mapping: Mapping
  readonly settings: Settings
  readonly kind: DrillKind
  readonly consistencyProfile: Profile | null
  readonly evidence: RouterEvidence
  readonly card: { readonly observation: string; readonly possibleAdvantage: string; readonly tradeOff: string; readonly purpose: string; readonly limitation: string }
}
export type RoutingResult = Recommendation | { readonly status: 'ordinary_replay'; readonly reason: string }
const admitted = new WeakSet<Recommendation>()
export const isRecommendation = (value: Recommendation) => admitted.has(value)
const limitation = "These are the choices and outcomes from this Assessment Practice sequence. A different sequence could produce a different amount. This result is not a personality score or a prediction of an employer's decision."
export function typeFor(mapping: Mapping, profile: Profile): VisibleType {
  const type = (Object.keys(mapping) as VisibleType[]).find(t => mapping[t] === profile)
  if (!type) throw new Error('Missing visible type')
  return type
}
function card(e: RouterEvidence, mapping: Mapping): Recommendation['card'] {
  if (e.primary === 'outcome') return {
    observation: `${e.outcomeSelected.length} disjoint four-round windows met both five-pump differences: ${e.outcomeSelected.map(w => `${typeFor(mapping,w.profile)} rounds ${w.rounds.join(', ')}: ${w.observations[0].voluntaryPoint}, burst, ${w.observations[2].voluntaryPoint}, ${w.observations[3].voluntaryPoint} pumps`).join('; ')}.`,
    possibleAdvantage: 'Changing a choice after an outcome may help you respond to new information.', tradeOff: 'A large brief change may give one outcome more weight than the accumulated evidence.', purpose: 'Review outcomes alongside the next observed collection choice.', limitation }
  if (e.primary === 'information' || e.primary === 'updating') {
    const pair = (e.primary === 'information' ? e.informationPair : e.updatingPair)!
    const high = e.categories.find(c => c.profile === pair.high)!, low = e.categories.find(c => c.profile === pair.low)!
    const late = e.categories.map(c => `${typeFor(mapping,c.profile)}: ${c.lateMedian ?? 'unavailable'} pumps (${c.lateVoluntaryN} voluntary out of ${c.lateRounds})`).join('; ')
    return { observation: `Rounds 1–26: ${typeFor(mapping,pair.high)} had ${high.earlyBursts}/${high.earlyRounds} bursts; ${typeFor(mapping,pair.low)} had ${low.earlyBursts}/${low.earlyRounds}. Late medians: ${late}.`,
      possibleAdvantage: e.primary === 'information' ? 'Continuing to explore can provide further observed outcomes.' : 'Using similar collection points can make choices easier to compare.',
      tradeOff: e.primary === 'information' ? 'Higher late collection points also occurred in a type with more earlier bursts. A burst does not prove a wrong decision.' : 'Similar late points may leave observed differences between types unused. A burst does not prove a wrong decision.',
      purpose: e.primary === 'information' ? 'Review accumulated collected and burst counts before continuing.' : 'Review accumulated voluntary, cap and burst outcomes by type.', limitation }
  }
  if (e.primary === 'consistency') {
    const c = e.consistencyCategory!
    return { observation: `${typeFor(mapping,c.profile)} had ${c.voluntaryN}/13 voluntary collections; Q1 ${c.quartiles!.q1}, Q3 ${c.quartiles!.q3}, IQR ${c.quartiles!.iqr} pumps. ${c.excludedBursts} bursts and ${c.excludedCaps} caps were excluded.`,
      possibleAdvantage: 'Varying collection points can explore different choices.', tradeOff: 'Wide variation can make your own choices harder to compare.', purpose: 'Observe voluntary collection spread within one type, without an ideal pump target.', limitation }
  }
  return { observation: `No targeted threshold was reached in this session. ${e.categories.reduce((n,c) => n+c.voluntaryN+c.excludedCaps,0)}/39 collected; ${e.categories.reduce((n,c) => n+c.excludedBursts,0)}/39 burst.`, possibleAdvantage: 'A mixed exercise offers further task familiarization.', tradeOff: 'An absent trigger does not establish a personal strength or weakness.', purpose: 'Practise eighteen mixed rounds and review their collected and lost amounts.', limitation }
}
/** Pure admission against a caller-supplied CURRENT durable installation snapshot.
 * A future adapter must read under its authority boundary, persist/recheck the result,
 * and supply completed-chain tombstones. A cached snapshot cannot prove freshness.
 * No storage reads/writes, UI activation, or retest reservation occur here. */
export function routeBaseline(root: Root | null, ref: BaselineRef, completedChainIds: readonly string[]): RoutingResult {
  const replay = (reason: string): RoutingResult => immutable({ status: 'ordinary_replay', reason })
  if (!root) return replay('baseline_unsaved_or_authority_unavailable')
  try {
    if (root.installationId !== ref.installationId) return replay('installation_replaced')
    if (root.tombstones[ref.sessionId]) return replay('baseline_deleted')
    const record = root.records[ref.sessionId]
    if (!record) return replay('baseline_missing_or_unsaved')
    inspectRoot(root)
    if (!durableBaseline(record)) return replay('baseline_invalid_incomplete_or_not_standalone_BL')
    const chainId = record.header.identity.chainId!
    if (completedChainIds.includes(chainId)) return replay('chain_already_completed')
    // A deleted BL invalidates the source chain. RT tombstones instead retain
    // form exposure history; an invalid retest can use a later unseen RT.
    if (Object.values(root.tombstones).some(t => t.chainId === chainId && t.formId.startsWith('BL'))) return replay('chain_deleted')
    const evidence = deriveRouterEvidence(record.snapshot.core.results)
    const result: Recommendation = immutable({ status: 'recommended', specificationVersion: BALLOONS_SPEC_VERSION, scoringVersion: BALLOONS_SCORING_VERSION,
      routerVersion: BALLOONS_ROUTER_VERSION, baseline: { ...ref }, baselineFormId: record.header.formId,
      baselineCore: canonicalJson(record.snapshot.core), chainId, mapping: { ...record.header.identity.mapping }, settings: { ...record.header.settings },
      kind: evidence.primary, consistencyProfile: evidence.primary === 'consistency' ? evidence.consistencyCategory!.profile : null,
      evidence, card: card(evidence,record.header.identity.mapping) })
    admitted.add(result)
    return result
  } catch { return replay('baseline_integrity_failed') }
}
