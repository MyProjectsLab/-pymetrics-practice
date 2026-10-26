// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { gameRegistry } from '../../games'
import type { StopFormManifest, StopStimulus } from '../contracts'
import { stopFormRegistry } from './index'
import { auditStopForms, validateStopForm } from './validate'

const forms = stopFormRegistry.all
const first = forms[0]

function changed(
  source: StopFormManifest,
  sequence: readonly StopStimulus[],
): StopFormManifest {
  return { ...source, sequence }
}

describe('Stop V1.1 standard form release set', () => {
  it('passes the complete deterministic audit for all fourteen manifests', async () => {
    const audit = await auditStopForms(forms)

    expect(audit.issues).toEqual([])
    expect(forms).toHaveLength(14)
    expect(forms.filter((form) => form.family === 'baseline')).toHaveLength(4)
    expect(forms.filter((form) => form.family === 'replay')).toHaveLength(6)
    expect(forms.filter((form) => form.family === 'retest')).toHaveLength(4)
    expect(audit.minimumPairwiseDifference).toBeGreaterThanOrEqual(24)
    expect(audit.maximumPairwiseMatches).toBeLessThanOrEqual(56)
    expect(new Set(forms.map((form) => form.seedId)).size).toBe(14)

    for (const form of forms) {
      const stats = audit.statistics[form.id]
      expect(form.sequence).toHaveLength(80)
      expect(stats.goCount).toBe(60)
      expect(stats.noGoCount).toBe(20)
      expect(stats.longestGoRun).toBeGreaterThanOrEqual(4)
      expect(stats.longestGoRun).toBeLessThanOrEqual(8)
      expect(stats.longestNoGoRun).toBeLessThanOrEqual(8)
      expect(stats.noGoAfterThreeGo).toBeGreaterThanOrEqual(4)
      expect(Object.isFrozen(form.sequence)).toBe(true)
    }
    expect(gameRegistry.get('stop')?.formIds).toHaveLength(14)
    expect(gameRegistry.all).toHaveLength(1)
  })

  it('rejects missing trials and a bad block distribution', async () => {
    const short = changed(first, first.sequence.slice(0, 79))
    const swapped = [...first.sequence]
    const firstGo = swapped.slice(0, 20).findIndex((stimulus) => stimulus === 'GO')
    const secondNoGo = swapped.findIndex((stimulus, index) => index >= 20 && index < 40 && stimulus === 'NO_GO')
    ;[swapped[firstGo], swapped[secondNoGo]] = [swapped[secondNoGo], swapped[firstGo]]

    expect((await validateStopForm(short)).map((issue) => issue.code)).toContain('trial_count')
    expect((await validateStopForm(changed(first, swapped))).map((issue) => issue.code)).toContain('block_distribution')
  })

  it('rejects runs, missing sequence context, and disallowed endpoints', async () => {
    const longGoRun = changed(first, Array(80).fill('GO'))
    const badEndpoint = [...first.sequence]
    badEndpoint[0] = 'NO_GO'
    badEndpoint[1] = 'NO_GO'

    const runIssues = (await validateStopForm(longGoRun)).map((issue) => issue.code)
    expect(runIssues).toContain('run_limit')
    expect(runIssues).toContain('no_go_context')
    expect((await validateStopForm(changed(first, badEndpoint))).map((issue) => issue.code)).toContain('endpoint')
  })

  it('rejects wrong family identity and tampered checksum', async () => {
    const familyIssue = { ...first, id: 'stop-retest-99' }
    const checksumIssue = { ...first, checksum: 'sha256:0' }

    expect((await validateStopForm(familyIssue)).map((issue) => issue.code)).toContain('family_identity')
    expect((await validateStopForm(checksumIssue)).map((issue) => issue.code)).toContain('checksum')
  })

  it('checks every pair across families and rejects a repeated sequence', async () => {
    const repeated: StopFormManifest = {
      ...forms[1],
      sequence: first.sequence,
    }
    const audit = await auditStopForms([first, repeated])

    expect(audit.issues.map((issue) => issue.code)).toContain('pairwise_difference')
    expect(audit.minimumPairwiseDifference).toBe(0)
    expect(audit.maximumPairwiseMatches).toBe(80)
  })

  it('rejects a missing family and reused seed', async () => {
    const duplicateSeed: StopFormManifest = { ...forms[1], seedId: first.seedId }
    const audit = await auditStopForms([first, duplicateSeed])

    expect(audit.issues.map((issue) => issue.code)).toContain('duplicate_seed')
    expect(audit.issues.map((issue) => issue.code)).toContain('family_inventory')
  })
})
