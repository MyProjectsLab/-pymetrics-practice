import stored from './drill-manifests.json'
import type { StopStimulus, StopTrialDefinition } from './contracts'
import type { EngineTiming } from './engine/contracts'

export const STOP_DRILL_MANIFEST_VERSION = 'stop_drill_manifest_v1' as const
export const STOP_DRILL_GENERATOR_VERSION = 'stop_drill_generator_v1' as const
export type DrillId = 'withholding' | 'detection' | 'consistency' | 'stability' | 'maintenance'
export interface DrillBlock {
  readonly go: number
  readonly noGo: number
  readonly deadlineMs: number
  readonly fixationMs: number
  readonly sequence: readonly StopStimulus[]
}
export interface DrillManifest {
  readonly schemaVersion: typeof STOP_DRILL_MANIFEST_VERSION
  readonly id: DrillId
  readonly version: '1'
  readonly specificationVersion: '1.1'
  readonly generatorVersion: typeof STOP_DRILL_GENERATOR_VERSION
  readonly seedId: string
  readonly blocks: readonly DrillBlock[]
  readonly checksum: string
}
export const drillManifests: readonly DrillManifest[] = Object.freeze(stored as DrillManifest[])
export const drillById = (id: DrillId) => drillManifests.find(manifest => manifest.id === id)!

const distributions: Record<DrillId, readonly (readonly [number, number, number, number])[]> = {
  withholding: [[12, 12, 1100, 1000], [16, 8, 1100, 1000], [18, 6, 1100, 1000]],
  detection: [[18, 6, 1200, 1000], [18, 6, 1100, 1000], [18, 6, 1000, 1000]],
  consistency: [[22, 8, 1000, 1200], [22, 8, 1000, 1200], [22, 8, 1000, 1200], [24, 6, 1000, 1200]],
  stability: [[18, 6, 1000, 1200], [18, 6, 1000, 1200], [18, 6, 1000, 1200]],
  maintenance: [[15, 5, 1000, 1200], [15, 5, 1000, 1200], [15, 5, 1000, 1200]],
}
function runs(sequence: readonly StopStimulus[]) {
  let last: StopStimulus | null = null, length = 0, go = 0, noGo = 0
  for (const value of sequence) {
    length = value === last ? length + 1 : 1
    last = value
    if (value === 'GO') go = Math.max(go, length)
    else noGo = Math.max(noGo, length)
  }
  return { go, noGo }
}
function followingThreeGo(sequence: readonly StopStimulus[]) {
  let preceding = 0, count = 0
  for (const value of sequence) {
    if (value === 'GO') preceding++
    else { if (preceding >= 3) count++; preceding = 0 }
  }
  return count
}
function canonical(manifest: DrillManifest) {
  return [manifest.schemaVersion, manifest.id, manifest.version, manifest.specificationVersion,
    manifest.generatorVersion, manifest.seedId, ...manifest.blocks.map(block =>
      [block.go, block.noGo, block.deadlineMs, block.fixationMs, block.sequence.map(value => value === 'GO' ? 'G' : 'N').join('')].join(':')), ''].join('\n')
}
export async function validateDrillManifest(manifest: DrillManifest): Promise<readonly string[]> {
  const errors: string[] = []
  if (!(manifest.id in distributions) || manifest.schemaVersion !== STOP_DRILL_MANIFEST_VERSION || manifest.version !== '1' ||
    manifest.specificationVersion !== '1.1' || manifest.generatorVersion !== STOP_DRILL_GENERATOR_VERSION ||
    !manifest.seedId.startsWith(`ap-stop-v1.1-drill-${manifest.id}-`)) errors.push('version_or_identity')
  const expected = distributions[manifest.id]
  if (!expected || manifest.blocks.length !== expected.length) errors.push('block_count')
  for (let i = 0; i < manifest.blocks.length; i++) {
    const block = manifest.blocks[i], values = expected?.[i]
    if (!values || block.go !== values[0] || block.noGo !== values[1] || block.deadlineMs !== values[2] || block.fixationMs !== values[3] ||
      block.sequence.length !== block.go + block.noGo || block.sequence.filter(value => value === 'GO').length !== block.go ||
      block.sequence.filter(value => value === 'NO_GO').length !== block.noGo || block.sequence.some(value => value !== 'GO' && value !== 'NO_GO')) errors.push(`block_${i + 1}`)
    if (manifest.id === 'withholding' && i > 0 && followingThreeGo(block.sequence) < 3) errors.push(`within_block_context_${i + 1}`)
    if (manifest.id === 'consistency' && runs(block.sequence).go < 4) errors.push(`go_run_${i + 1}`)
    if (manifest.id === 'detection' && block.sequence.every((value, index) => !index || value !== block.sequence[index - 1])) errors.push(`alternation_${i + 1}`)
  }
  const sequence = manifest.blocks.flatMap(block => block.sequence)
  const run = runs(sequence)
  if (run.go > (manifest.id === 'withholding' ? 6 : 8) || run.noGo > 8) errors.push('complete_sequence_run_cap')
  if (manifest.id === 'maintenance') {
    if (run.go < 4) errors.push('maintenance_go_context')
    if (followingThreeGo(sequence) < 4) errors.push('maintenance_no_go_context')
    if (sequence[0] === 'NO_GO' && sequence[1] === 'NO_GO' ||
      sequence.at(-2) === 'NO_GO' && sequence.at(-1) === 'NO_GO') errors.push('maintenance_endpoint')
  }
  if (manifest.id === 'withholding' && sequence.length !== 72 || manifest.id === 'detection' && sequence.length !== 72 ||
    manifest.id === 'consistency' && sequence.length !== 120 || manifest.id === 'stability' && sequence.length !== 72 ||
    manifest.id === 'maintenance' && sequence.length !== 60) errors.push('total_trials')
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(manifest)))
  const checksum = `sha256:${Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')}`
  if (manifest.checksum !== checksum) errors.push('checksum')
  return errors
}
export function drillBlockTiming(block: DrillBlock): EngineTiming {
  return Object.freeze({ visibilityMs: 200, deadlineMs: block.deadlineMs, fixationMs: block.fixationMs })
}
export function drillBlockTrials(manifest: DrillManifest, blockIndex: number): readonly StopTrialDefinition[] {
  const start = manifest.blocks.slice(0, blockIndex).reduce((sum, block) => sum + block.sequence.length, 0)
  return manifest.blocks[blockIndex].sequence.map((stimulus, offset) => Object.freeze({ phase: 'drill' as const, index: start + offset, stimulus }))
}
