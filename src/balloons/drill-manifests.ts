import committed from '../../docs/specifications/ASSESSMENT_PRACTICE_BALLOONS_FIXED_MANIFESTS_V1_0.json'
import type { ManifestRound, Profile } from './contracts'
import { canonicalJson, sha256 } from './manifests'
import { immutable, PROFILES } from './training-evidence'
import type { DrillKind } from './training-evidence'

export const DRILL_VERSION = 'balloons-drill-v1' as const
export type DrillId = 'D-outcome' | 'D-information' | 'D-updating' | 'D-consistency-A' | 'D-consistency-B' | 'D-consistency-C' | 'D-maintenance'
export interface DrillManifest { readonly id: DrillId; readonly candidateSeed: number; readonly rounds: readonly ManifestRound[]; readonly sha256: string }
const inventory: readonly [DrillId, number, string][] = [
  ['D-outcome',22,'89925bd177a61aa943b7a8d90d36ee5a1771f44fa27d781dc2e42ef880e6c564'],
  ['D-information',7,'6a4d6942171d3922d3784df24b9203e0ae9896c3c9fb5fd09ca079ddc24ca875'],
  ['D-updating',5,'0772f8be9d7dd20cf373e778a2bbc0223ea35781a5ce5ec39d71b4a2a1263ee7'],
  ['D-consistency-A',0,'0488906b7aa1b8338b2def71a5d8f2be36527a526b0440fd36c1eb7048195513'],
  ['D-consistency-B',0,'4c97b353b7503f204099cd02d36505de732c6d6a9cebd69d02818118a1f4caf2'],
  ['D-consistency-C',0,'8fa1d8e5070193759df88eb018abf5aaad176991345aefa46896d1381e95fdd1'],
  ['D-maintenance',1,'8869b5c978c0b3fe88c0e00559ac17650eebd59c35bcfd485e8568b50d8634ab'],
]
const loaded = new WeakSet<DrillManifest>(), byId = new Map<DrillId, DrillManifest>()
export const isDrillManifest = (m: DrillManifest) => loaded.has(m)
export const verifiedDrillManifest = (id: DrillId) => byId.get(id)
export function drillId(kind: DrillKind, profile: Profile | null): DrillId {
  if (kind === 'consistency') {
    if (!profile || !PROFILES.includes(profile)) throw new Error('Consistency needs winning profile')
    return `D-consistency-${profile}`
  }
  if (!['outcome','information','updating','maintenance'].includes(kind) || profile !== null) throw new Error('Invalid drill assignment')
  return `D-${kind}`
}
function assert(ok: unknown, reason: string): asserts ok { if (!ok) throw new Error(`Balloons drill manifest: ${reason}`) }
export async function loadDrillManifests(raw: unknown = committed): Promise<ReadonlyMap<DrillId, DrillManifest>> {
  const packet = structuredClone(raw) as typeof committed
  assert(packet?.schema === 'balloons-fixed-manifests-v1' && packet.drawAlgorithm === committed.drawAlgorithm && DRILL_VERSION === 'balloons-drill-v1', 'version')
  assert(Array.isArray(packet.drills) && packet.drills.length === 7, 'inventory count')
  const output = new Map<DrillId, DrillManifest>()
  for (const [i,[id, seed, hash]] of inventory.entries()) {
    const m = packet.drills[i] as DrillManifest
    assert(m && m.id === id && m.candidateSeed === seed && m.sha256 === hash, 'approved identity/seed/hash')
    assert(Object.keys(m).sort().join() === 'candidateSeed,id,rounds,sha256', 'manifest fields')
    const { sha256: _hash, ...body } = m
    assert(await sha256(canonicalJson(body)) === _hash, 'content hash')
    assert(m.rounds.length === 18, '18 rounds required')
    const single = id.startsWith('D-consistency-') ? id.at(-1) as Profile : null
    for (const [j,r] of m.rounds.entries()) assert(Object.keys(r).sort().join() === 'profile,round,threshold' && r.round === j+1 && PROFILES.includes(r.profile) && Number.isInteger(r.threshold) && r.threshold >= 1 && r.threshold <= { A:12,B:24,C:48 }[r.profile], 'round structure')
    for (const p of PROFILES) {
      const thresholds = m.rounds.filter(r => r.profile === p).map(r => r.threshold), n = single ? single === p ? 18 : 0 : 6
      assert(thresholds.length === n, 'profile count')
      if (!n) continue
      const max = { A:12,B:24,C:48 }[p], sum = thresholds.reduce((a,b) => a+b,0)
      assert(thresholds.some(t => t <= max/4) && thresholds.some(t => t > 3*max/4), 'quarter coverage')
      assert(sum >= Math.ceil(.4*n*max) && sum <= Math.floor(.6*n*max), 'sum band')
      for (let b=0;b<3;b++) assert(m.rounds.slice(6*b,6*b+6).filter(r => r.profile === p).length === (single ? 6 : 2), 'block composition')
    }
    if (!single) {
      const order = m.rounds.map(r => r.profile)
      for (let j=0;j<18;j++) {
        assert(j<3 || new Set(order.slice(j-3,j+1)).size !== 1, 'run')
        for (const period of [2,3]) {
          const part = order.slice(j,j+period*3)
          assert(part.length !== period*3 || new Set(part.slice(0,period)).size !== period || !part.every((p,k) => p === part[k%period]), 'alternation')
        }
      }
    }
    const frozen = immutable(m); loaded.add(frozen); output.set(id,frozen)
  }
  for (const [id,m] of output) byId.set(id,m)
  return output
}
