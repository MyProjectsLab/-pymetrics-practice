import type { FormId } from './contracts'
import { baseline, play, ref } from './training-test-support'
import { routeBaseline } from './router'
import { createDrillAttempt } from './drills'
import { verifiedDrillManifest } from './drill-manifests'
import { createTrainingChain, completedDrillEligibility } from './training-eligibility'
const time = (n = 0) => ({ wallTimeMs: 1000000 + n, monotonicMs: Math.max(0, n), clockEpochId: `rt-${n}` })
export function eligibleRoot(id: FormId = 'BL1') {
  const root = baseline(id, () => 0), rec = routeBaseline(root, ref, [])
  if (rec.status !== 'recommended') throw Error('fixture')
  let chain = createTrainingChain(rec)
  const attempt = play(createDrillAttempt(rec, verifiedDrillManifest('D-maintenance')!, 'drill', [], time(-1000)), () => 0)
  root.training = { version: 'balloons-training-storage-v1', chains: { chain }, attempts: { drill: attempt }, deletedAttemptIds: [] }
  const grant = completedDrillEligibility(chain, 'drill', { root, chains: root.training.chains, savedDrills: root.training.attempts, deletedDrillIds: [], completedChainIds: [] })
  if (grant.status !== 'eligible') throw Error('grant')
  chain = grant.chain; root.training.chains.chain = chain
  return root
}
