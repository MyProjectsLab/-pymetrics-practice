// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { drillBlockTiming, drillBlockTrials, drillManifests, validateDrillManifest } from './drills'
import type { DrillManifest } from './drills'

describe('S48 five frozen drill manifests', () => {
  it('validates complete counts, prescribed timing, SHA-256, within-block context and whole-sequence run caps', async () => {
    expect(drillManifests.map(manifest => manifest.id)).toEqual(['withholding', 'detection', 'consistency', 'stability', 'maintenance'])
    for (const manifest of drillManifests) {
      expect(await validateDrillManifest(manifest)).toEqual([])
      expect(manifest.checksum).toMatch(/^sha256:[0-9a-f]{64}$/)
      const indices = manifest.blocks.flatMap((_, index) => drillBlockTrials(manifest, index).map(trial => trial.index))
      expect(indices).toEqual(Array.from({ length: indices.length }, (_, index) => index))
      expect(drillBlockTiming(manifest.blocks[0]).visibilityMs).toBe(200)
    }
    expect(drillManifests.map(manifest => manifest.blocks.flatMap(block => block.sequence).length)).toEqual([72, 72, 120, 72, 60])
    expect(drillManifests[1].blocks.map(block => block.deadlineMs)).toEqual([1200, 1100, 1000])
    expect(drillManifests[2].blocks.map(block => block.fixationMs)).toEqual([1200, 1200, 1200, 1200])
  })
  it('rejects a count mutation, a cross-block run, an in-block withholding-context loss, and a timing mutation', async () => {
    const base = drillManifests[0]
    const changed = (index: number, block: object): DrillManifest => ({ ...base, blocks: base.blocks.map((original, i) => i === index ? { ...original, ...block } : original) })
    expect(await validateDrillManifest(changed(0, { go: 11 }))).toContain('block_1')
    expect(await validateDrillManifest(changed(0, { deadlineMs: 1200 }))).toContain('block_1')
    expect(await validateDrillManifest(changed(1, { sequence: [...Array(16).fill('GO'), ...Array(8).fill('NO_GO')] }))).toContain('within_block_context_2')
    const boundary = base.blocks.map(block => ({ ...block, sequence: [...block.sequence] }))
    boundary[0].sequence.splice(-6, 6, ...Array(6).fill('GO'))
    boundary[1].sequence.splice(0, 6, ...Array(6).fill('GO'))
    expect(await validateDrillManifest({ ...base, blocks: boundary })).toContain('complete_sequence_run_cap')
  })
  it('enforces maintenance standard-form context and endpoint constraints', async () => {
    const base = drillManifests[4]
    const noContext = { ...base, blocks: base.blocks.map(block => ({ ...block,
      sequence: [...Array(block.noGo).fill('NO_GO'), ...Array(block.go).fill('GO')] })) }
    expect(await validateDrillManifest(noContext as DrillManifest)).toContain('maintenance_no_go_context')
    const endpoint = { ...base, blocks: base.blocks.map((block, index) => index ? block : {
      ...block, sequence: ['NO_GO', 'NO_GO', ...block.sequence.slice(2)],
    }) }
    expect(await validateDrillManifest(endpoint as DrillManifest)).toContain('maintenance_endpoint')
  })
})
