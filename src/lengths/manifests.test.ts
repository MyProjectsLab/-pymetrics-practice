import { describe, expect, it, vi } from 'vitest'
import committed from '../../docs/specifications/ASSESSMENT_PRACTICE_LENGTHS_FORMS_V1_0.json'
import { LENGTHS_CANONICAL_SHA256, isVerifiedLengthsForm, loadLengthsForms } from './manifests'

describe('Lengths frozen form admission', () => {
  it('admits exactly twelve immutable balanced forms with paired categorical orders', async () => {
    const forms = await loadLengthsForms()
    expect([...forms.keys()]).toEqual(['LS1', 'LS2', 'LS3', 'LS4', 'LS5', 'LS6',
      'LA1', 'LA2', 'LA3', 'LA4', 'LA5', 'LA6'])
    expect(committed.sha256).toBe(LENGTHS_CANONICAL_SHA256)
    for (const form of forms.values()) {
      expect(isVerifiedLengthsForm(form)).toBe(true)
      expect(Object.isFrozen(form) && Object.isFrozen(form.trials[0])).toBe(true)
      expect(form.trials).toHaveLength(96)
      for (let block = 1; block <= 4; block++) {
        const trials = form.trials.slice((block - 1) * 24, block * 24)
        expect(trials.filter(trial => trial.gapCategory === 'small')).toHaveLength(8)
        expect(trials.filter(trial => trial.longerSide === 'left')).toHaveLength(12)
      }
    }
    for (let index = 1; index <= 6; index++) {
      const standard = forms.get(`LS${index}` as 'LS1')!
      const accommodated = forms.get(`LA${index}` as 'LA1')!
      expect(standard.trials.map(trial => [trial.gapCategory, trial.longerSide]))
        .toEqual(accommodated.trials.map(trial => [trial.gapCategory, trial.longerSide]))
      expect(standard.trials[0].shortLength).not.toBe(accommodated.trials[0].shortLength)
    }
  })

  it('rejects changed bytes, unsupported versions and forged form objects', async () => {
    const changed = structuredClone(committed)
    changed.forms[0].trials[0].longLength++
    await expect(loadLengthsForms(changed)).rejects.toThrow('canonical digest')
    const unsupported = structuredClone(committed)
    unsupported.version = 'lengths_forms_v2'
    await expect(loadLengthsForms(unsupported)).rejects.toThrow('packet identity')
    const map = await loadLengthsForms()
    expect(isVerifiedLengthsForm(structuredClone(map.get('LS1')!))).toBe(false)
    await expect(loadLengthsForms(new Map())).rejects.toThrow('packet missing')
  })

  it('snapshots mutable input before an asynchronous digest', async () => {
    const mutable = structuredClone(committed)
    const original = crypto.subtle.digest.bind(crypto.subtle)
    let release!: () => void
    vi.spyOn(crypto.subtle, 'digest').mockImplementation(async (...args) => {
      await new Promise<void>(resolve => { release = resolve })
      return original(...args)
    })
    try {
      const pending = loadLengthsForms(mutable)
      await vi.waitFor(() => expect(release).toBeTypeOf('function'))
      mutable.forms[0].trials[0].shortLength = 1
      release()
      expect((await pending).get('LS1')!.trials[0].shortLength).toBe(108)
    } finally { vi.restoreAllMocks() }
  })
})
