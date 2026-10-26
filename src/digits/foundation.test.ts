import { describe, expect, it } from 'vitest'
import fixtures from '../../docs/specifications/ASSESSMENT_PRACTICE_DIGITS_FIXTURES_V1_0.json'
import { loadDigitsForms, isVerifiedDigitsForm, digitsTarget } from './forms'
import { classifyPositions } from './scoring'
import { sameDigitsVoice, selectDigitsVoice } from './voice'

describe('Digits versioned adaptive foundation', () => {
  it('accepts the exact frozen inventory and rejects altered bytes', async () => {
    const forms = await loadDigitsForms()
    expect(forms.size).toBe(12)
    expect([...forms.values()].every(isVerifiedDigitsForm)).toBe(true)
    const altered = structuredClone((await import('../../docs/specifications/ASSESSMENT_PRACTICE_DIGITS_FORMS_V1_1.json')).default)
    altered.forms[0].seed += 1
    await expect(loadDigitsForms(altered)).rejects.toThrow()
  })
  it('classifies every primitive fixture without guessing nonadjacent moves', () => {
    for (const fixture of fixtures.classificationCases) {
      const actual = classifyPositions(fixture.target, fixture.response)
      for (const [key, expected] of Object.entries(fixture.expected))
        expect(actual[key as keyof typeof actual], fixture.id).toEqual(expected)
    }
  })
  it('admits only a unique current local English voice with a valid language tag', () => {
    for (const fixture of fixtures.voiceEligibilityCases) {
      const selected = selectDigitsVoice(fixture.voices, fixture.explicitVoiceURI ?? undefined)
      expect(selected?.voiceURI ?? null, fixture.id).toBe(fixture.expectedSelectedVoiceURI)
      if (fixture.recheckVoices && selected)
        expect(sameDigitsVoice({ voiceURI: selected.voiceURI, lang: selected.lang,
          localService: true }, fixture.recheckVoices), fixture.id)
          .toBe(fixture.expectedRecheckEligible)
    }
    expect(selectDigitsVoice([{ voiceURI: 'x', lang: 'en-!', localService: true }])).toBeNull()
    expect(selectDigitsVoice([{ voiceURI: 'x', lang: 'en-GB', localService: true }])?.voiceURI).toBe('x')
  })
})

// Independent 32-bit arithmetic translation, without importing the product constructor's rejection code.
function reference(seed: number, index: number, length: number, prior: string[]) {
  let word = (seed ^ Math.imul(index, 2654435769) ^ Math.imul(length, 2246822507)) >>> 0
  if (word === 0) word = 1831565813
  for (let retry = 0; retry < 1000; retry++) {
    const digits: number[] = []
    for (let slot = 0; slot < length; slot++) {
      word = (word ^ (word << 13)) >>> 0
      word = (word ^ (word >>> 17)) >>> 0
      word = (word ^ (word << 5)) >>> 0
      digits.push(word % 10)
    }
    const value = digits.join('')
    const steps = digits.slice(1).map((digit, k) => digit - digits[k])
    const forbidden = steps.some((step, k) => Math.abs(step) === 1 &&
      steps[k + 1] === step && steps[k + 2] === step)
    if (digits.some(digit => digit !== digits[0]) && !forbidden && !prior.includes(value)) return value
  }
  throw Error('reference exhausted')
}
it('independently regenerates six complete answer paths on every visual and auditory seed', async () => {
  const paths = [[true, false, true, false, true, false], [false, false, false],
    Array(40).fill(true), [...Array(37).fill(true), false, false, false],
    [true, true, false, true, true, false, true, false],
    [false, true, true, true, false, true, true, false]]
  for (const form of (await loadDigitsForms()).values()) for (const path of paths) {
    const prior: string[] = []; let length = 4, wrong = 0
    for (let i = 0; i < path.length; i++) {
      const target = digitsTarget(form.seed, i + 1, length, prior)
      expect(target).toBe(reference(form.seed, i + 1, length, prior))
      prior.push(target)
      if (!path[i] && ++wrong === 3) break
      length = path[i] ? Math.min(16, length + 1) : Math.max(2, length - 1)
    }
    expect(new Set(prior).size).toBe(prior.length)
  }
})
