import { canonicalJson } from './manifests'
import { isRecommendation, routeBaseline } from './router'
import type { Recommendation } from './router'
import { reconcileDrill } from './drills'
import type { DrillAttempt } from './drills'
import type { Root } from './storage'
import { immutable } from './training-evidence'

export interface TrainingChain {
  readonly version: 'balloons-training-chain-v1'
  readonly recommendation: Recommendation
  readonly retestSessionId?: string
  readonly completedRetestSessionId?: string
  readonly firstCompletedDrillId: string | null
}
/** Adapter contract, not a new persisted schema. Supply one fresh authoritative
 * snapshot, including tombstones. No in-tab/unsaved attempt belongs in savedDrills.
 * Future storage must atomically revalidate before recording a grant/reservation. */
export interface TrainingAuthority {
  readonly root: Root | null
  readonly chains: Readonly<Record<string, TrainingChain>>
  readonly savedDrills: Readonly<Record<string, DrillAttempt>>
  readonly deletedDrillIds: readonly string[]
  readonly completedChainIds: readonly string[]
}
export function createTrainingChain(recommendation: Recommendation): TrainingChain {
  if (!isRecommendation(recommendation)) throw new Error('Admitted baseline recommendation required')
  return immutable({ version:'balloons-training-chain-v1',recommendation,firstCompletedDrillId:null })
}
export type DrillEligibility = { readonly status:'eligible'; readonly firstGrant:boolean; readonly chain:TrainingChain } | { readonly status:'ineligible'; readonly reason:string }
/** Evaluate/lock the first valid completion in memory. This does not persist a
 * grant, reserve an RT, or override deletion. Re-evaluate on EVERY later use. */
export function completedDrillEligibility(chain: TrainingChain, attemptId: string, authority: TrainingAuthority): DrillEligibility {
  const no = (reason:string): DrillEligibility => immutable({status:'ineligible',reason})
  if (chain.completedRetestSessionId) return no('chain_closed')
  if (chain.version !== 'balloons-training-chain-v1') return no('chain_version_mismatch')
  const current = authority.chains[chain.recommendation.chainId]
  if (!current || canonicalJson(current) !== canonicalJson(chain)) return no('chain_missing_or_stale')
  const rec = routeBaseline(authority.root,chain.recommendation.baseline,authority.completedChainIds)
  if (rec.status !== 'recommended') return no(rec.reason)
  if (canonicalJson(rec) !== canonicalJson(chain.recommendation)) return no('baseline_or_router_changed')
  if (chain.firstCompletedDrillId && chain.firstCompletedDrillId !== attemptId) return no('first_completion_already_locked')
  if (authority.deletedDrillIds.includes(attemptId)) return no('drill_deleted')
  const saved = authority.savedDrills[attemptId]
  if (!saved) return no('drill_missing_or_unsaved')
  try {
    const checked = reconcileDrill(saved)
    if (checked.header.attemptId !== attemptId || canonicalJson(checked.header.recommendation) !== canonicalJson(rec)) return no('drill_chain_or_profile_mismatch')
    if (checked.snapshot.phase !== 'completed' || checked.snapshot.results.length !== 18 || checked.snapshot.invalidReason !== null) return no('drill_invalid_or_incomplete')
    return immutable({status:'eligible',firstGrant:chain.firstCompletedDrillId === null,chain:{...chain,firstCompletedDrillId:attemptId}})
  } catch { return no('drill_integrity_failed') }
}
