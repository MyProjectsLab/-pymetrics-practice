import committed from '../../docs/specifications/ASSESSMENT_PRACTICE_LENGTHS_FORMS_V1_0.json'
import { LENGTHS_FORM_VERSION } from './contracts'
import type { Form, FormId, GapCategory, Side, Trial } from './contracts'

export const LENGTHS_CANONICAL_SHA256 = '671b48c20e32daa886ce79e25a6265f4577a5dc069af8d5417328fd1ae0b39e7' as const
const SEED = 0x1e470001
const ATTEMPTS = [24, 58, 24, 22, 35, 28] as const
const CATEGORIES: readonly GapCategory[] = ['small', 'medium', 'large']
const SIDES: readonly Side[] = ['left', 'right']
const trusted = new WeakSet<Form>()

function assert(condition: unknown, reason: string): asserts condition {
  if (!condition) throw Error(`Lengths form integrity: ${reason}`)
}
function record(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}
function keys(value: Record<string, unknown>, expected: readonly string[]) {
  assert(Object.keys(value).toSorted().join('|') === [...expected].sort().join('|'), 'unexpected fields')
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value
}
function maxRun(trials: readonly Trial[], field: 'longerSide' | 'gapCategory') {
  let best = 0, run = 0, previous: string | undefined
  for (const trial of trials) {
    run = trial[field] === previous ? run + 1 : 1
    best = Math.max(best, run)
    previous = trial[field]
  }
  return best
}
function inspectForm(value: unknown, position: number): Form {
  assert(record(value), 'form missing')
  keys(value, ['id', 'variant', 'seed', 'attempts', 'barHeight', 'trials'])
  const family = position < 6 ? 'standard' : 'visual_accommodation'
  const number = position % 6
  const id = `${family === 'standard' ? 'LS' : 'LA'}${number + 1}`
  assert(value.id === id && value.variant === family && value.seed === SEED + number &&
    value.attempts === ATTEMPTS[number] &&
    value.barHeight === (family === 'standard' ? 12 : 20), 'form identity')
  assert(Array.isArray(value.trials) && value.trials.length === 96, 'trial count')
  const bases = family === 'standard' ? [108, 124, 140, 156] : [96, 112, 128, 144]
  const gaps = family === 'standard' ? [16, 32, 48] : [24, 40, 56]
  const trials: Trial[] = value.trials.map((raw: unknown, index: number) => {
    assert(record(raw), 'trial missing')
    keys(raw, ['index', 'block', 'gapCategory', 'longerSide', 'shortLength', 'longLength'])
    const category = CATEGORIES.indexOf(raw.gapCategory as GapCategory)
    assert(raw.index === index + 1 && raw.block === Math.floor(index / 24) + 1 &&
      category >= 0 && SIDES.includes(raw.longerSide as Side) &&
      bases.includes(raw.shortLength as number) &&
      raw.longLength === (raw.shortLength as number) + gaps[category] &&
      (raw.longLength as number) <= 204, 'invalid trial')
    return raw as unknown as Trial
  })
  assert(maxRun(trials, 'longerSide') <= 3 && maxRun(trials, 'gapCategory') <= 3, 'run cap')
  for (let block = 0; block < 4; block++) {
    const slice = trials.slice(block * 24, (block + 1) * 24)
    for (const category of CATEGORIES) for (const side of SIDES) for (const base of bases)
      assert(slice.filter(trial => trial.gapCategory === category &&
        trial.longerSide === side && trial.shortLength === base).length === 1, 'block balance')
    const switches = slice.slice(1).filter((trial, index) => trial.longerSide !== slice[index].longerSide).length
    assert(switches >= 8 && switches <= 16, 'block side switches')
  }
  return { id: value.id as FormId, variant: family, seed: value.seed as number,
    attempts: value.attempts as number, barHeight: value.barHeight as number, trials }
}
async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

/** No live generation: verify the exact fixed inventory before any headless arm. */
export async function loadLengthsForms(raw: unknown = committed): Promise<ReadonlyMap<FormId, Form>> {
  const snapshot: unknown = structuredClone(raw)
  assert(record(snapshot), 'packet missing')
  keys(snapshot, ['version', 'baseSeed', 'forms', 'sha256'])
  assert(snapshot.version === LENGTHS_FORM_VERSION && snapshot.baseSeed === SEED &&
    snapshot.sha256 === LENGTHS_CANONICAL_SHA256 &&
    Array.isArray(snapshot.forms) && snapshot.forms.length === 12, 'packet identity')
  const payload = { version: snapshot.version, baseSeed: snapshot.baseSeed, forms: snapshot.forms }
  assert(await sha256(JSON.stringify(payload)) === LENGTHS_CANONICAL_SHA256, 'canonical digest')
  const forms = snapshot.forms.map(inspectForm)
  for (let index = 0; index < 6; index++) {
    const standard = forms[index], accommodation = forms[index + 6]
    for (let trial = 0; trial < 96; trial++)
      assert(standard.trials[trial].gapCategory === accommodation.trials[trial].gapCategory &&
        standard.trials[trial].longerSide === accommodation.trials[trial].longerSide &&
        [108, 124, 140, 156].indexOf(standard.trials[trial].shortLength) ===
          [96, 112, 128, 144].indexOf(accommodation.trials[trial].shortLength), 'variant pairing')
  }
  for (let first = 0; first < 6; first++) for (let second = first + 1; second < 6; second++) {
    const difference = forms[first].trials.filter((trial, index) => {
      const other = forms[second].trials[index]
      return trial.gapCategory !== other.gapCategory ||
        trial.longerSide !== other.longerSide || trial.shortLength !== other.shortLength
    }).length
    assert(difference >= 70, 'pairwise order')
  }
  const result = new Map<FormId, Form>()
  for (const form of forms) {
    const frozen = freeze(form)
    trusted.add(frozen)
    result.set(frozen.id, frozen)
  }
  return result
}
export function isVerifiedLengthsForm(form: Form): boolean { return trusted.has(form) }
