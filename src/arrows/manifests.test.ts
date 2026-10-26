import committed from '../../docs/specifications/ASSESSMENT_PRACTICE_ARROWS_FORMS_V1_0.json'
import { describe, expect, it } from 'vitest'
import type { Form, FormId } from './contracts'
import { ARROWS_CANONICAL_SHA256, isVerifiedArrowsForm, loadArrowsForms, stimulusFor } from './manifests'

describe('frozen Arrows V1 inventory', () => {
  it('loads six immutable forms and checks the approved canonical digest', async () => {
    const forms = await loadArrowsForms()
    expect([...forms.keys()]).toEqual(['AR1', 'AR2', 'AR3', 'AR4', 'AR5', 'AR6'])
    expect(committed.sha256).toBe(ARROWS_CANONICAL_SHA256)
    for (const form of forms.values()) {
      expect(isVerifiedArrowsForm(form)).toBe(true)
      expect(form.trials).toHaveLength(120)
      expect(Object.isFrozen(form.trials[0])).toBe(true)
    }
    expect(isVerifiedArrowsForm(structuredClone(forms.get('AR1')!))).toBe(false)
  })

  it.each([
    ['changed direction', (x: typeof committed) => { x.forms[0].trials[0].direction = 'left' }],
    ['changed block', (x: typeof committed) => { x.forms[0].trials[0].block = 2 }],
    ['changed trial index', (x: typeof committed) => { x.forms[0].trials[0].index = 2 }],
    ['changed attempt count', (x: typeof committed) => { x.forms[0].attempts = 99 }],
    ['changed seed', (x: typeof committed) => { x.forms[0].seed++ }],
    ['changed digest', (x: typeof committed) => { x.sha256 = '0'.repeat(64) }],
    ['swapped complete trials', (x: typeof committed) => { [x.forms[0].trials[0], x.forms[0].trials[2]] = [x.forms[0].trials[2], x.forms[0].trials[0]] }],
  ])('rejects %s', async (_name, alter) => {
    const copy = structuredClone(committed)
    alter(copy)
    await expect(loadArrowsForms(copy)).rejects.toThrow('Arrows form integrity')
  })

  it('does not trust a detached or modified form as a presentation authority', async () => {
    const forms = await loadArrowsForms()
    const genuine = forms.get('AR1')!
    expect(() => stimulusFor(structuredClone(genuine), 1)).toThrow('unverified form')
    expect(() => stimulusFor(genuine, 0)).toThrow('trial index')
    expect(() => stimulusFor(genuine, 121)).toThrow('trial index')
  })

  it('projects every tuple as five original symbols without a hidden answer field', async () => {
    const forms = await loadArrowsForms()
    const visited = new Set<string>()
    for (const [id, form] of forms) {
      for (const trial of form.trials) {
        const stimulus = stimulusFor(form, trial.index)
        visited.add(`${trial.rule}/${trial.condition}/${trial.direction}`)
        expect(stimulus.trialIndex).toBe(trial.index)
        expect(stimulus.block).toBe(trial.block)
        expect(stimulus.symbols).toHaveLength(5)
        expect(Object.keys(stimulus).toSorted()).toEqual(['block', 'cue', 'cueInstruction', 'symbols', 'targetPositions', 'trialIndex'])
        const targets = trial.rule === 'center' ? [3] : [1, 5]
        expect(stimulus.targetPositions).toEqual(targets)
        expect(stimulus.cue).toBe(trial.rule.toUpperCase())
        for (let position = 1; position <= 5; position++) {
          const symbol = stimulus.symbols[position - 1]
          if (targets.includes(position)) expect(symbol).toBe(trial.direction)
          else if (trial.condition === 'neutral') expect(symbol).toBe('bar')
          else expect(symbol).toBe(trial.condition === 'aligned' ? trial.direction : trial.direction === 'left' ? 'right' : 'left')
        }
      }
      expect(id).toBe(form.id)
    }
    expect(visited.size).toBe(12)
  })

  it('keeps the six forms distinct in playable tuple order', async () => {
    const forms = await loadArrowsForms()
    const ids: FormId[] = ['AR1', 'AR2', 'AR3', 'AR4', 'AR5', 'AR6']
    const distances: number[] = []
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      const first: Form = forms.get(ids[i])!, second: Form = forms.get(ids[j])!
      distances.push(first.trials.filter((trial, index) =>
        trial.rule !== second.trials[index].rule || trial.condition !== second.trials[index].condition || trial.direction !== second.trials[index].direction).length)
    }
    expect(Math.min(...distances)).toBe(101)
    expect(Math.max(...distances)).toBe(115)
  })
})
