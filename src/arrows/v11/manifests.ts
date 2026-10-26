import committed from '../../../docs/specifications/ASSESSMENT_PRACTICE_ARROWS_FORMS_V1_1.json'
import { ARROWS_FORM_VERSION } from './contracts'
import type { Form, FormId, Stimulus, Trial } from './contracts'
export const ARROWS_CANONICAL_SHA256 = 'bedfa8c58fd9bde20cf7b9408b6ac5909c6bae45d025bff9c3de8041f8ae6855'
export const FORM_IDS: readonly FormId[] = ['AR11-1', 'AR11-2', 'AR11-3', 'AR11-4', 'AR11-5', 'AR11-6']
const verified = new WeakSet<Form>()
function requireValid(condition: unknown): asserts condition { if (!condition) throw Error('Arrows V1.1 form integrity failed') }
function freeze<T>(value: T): T { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value) }; return value }
function keys(value: object, expected: string[]) { requireValid(Object.keys(value).sort().join('|') === expected.sort().join('|')) }
/** Exact fixed bytes are hashed before any form becomes trusted. Never generate during play. */
export async function loadArrowsForms(raw: unknown = committed): Promise<ReadonlyMap<FormId, Form>> {
  const value = structuredClone(raw) as typeof committed
  requireValid(value && typeof value === 'object'); keys(value, ['version', 'baseSeed', 'forms', 'sha256'])
  requireValid(value.version === ARROWS_FORM_VERSION && value.baseSeed === 0xA2210001 && value.sha256 === ARROWS_CANONICAL_SHA256 && Array.isArray(value.forms) && value.forms.length === 6)
  for (const [offset, form] of value.forms.entries()) {
    keys(form, ['id', 'seed', 'attempts', 'trials'])
    requireValid(form.id === FORM_IDS[offset] && form.seed === 0xA2210001 + offset && Number.isSafeInteger(form.attempts) && form.attempts > 0 && form.attempts <= 100000 && form.trials.length === 135)
    for (const [index, trial] of form.trials.entries()) {
      keys(trial, ['color', 'condition', 'direction', 'rule', 'block', 'index'])
      requireValid((trial.color === 'red' || trial.color === 'blue') && (trial.condition === 'aligned' || trial.condition === 'opposed') || trial.color === 'black' && trial.condition === 'neutral')
      requireValid(trial.rule === (trial.color === 'red' ? 'sides' : 'middle') && (trial.direction === 'left' || trial.direction === 'right') && trial.index === index + 1 && trial.block === Math.floor(index / 27) + 1)
    }
  }
  const bytes = new TextEncoder().encode(JSON.stringify({ version: value.version, baseSeed: value.baseSeed, forms: value.forms }))
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('')
  requireValid(digest === ARROWS_CANONICAL_SHA256)
  const forms = value.forms as unknown as Form[]
  for (const form of forms) { freeze(form); verified.add(form) }
  return new Map(forms.map(form => [form.id, form]))
}
export function isVerifiedArrowsForm(form: Form): boolean { return verified.has(form) }
/** Independent legal-cell projection also supports primitive verification outside a fixed form. */
export function projectTrial(trial: Trial): Stimulus {
  requireValid((trial.color === 'red' || trial.color === 'blue') && (trial.condition === 'aligned' || trial.condition === 'opposed') || trial.color === 'black' && trial.condition === 'neutral')
  requireValid(trial.rule === (trial.color === 'red' ? 'sides' : 'middle') && (trial.direction === 'left' || trial.direction === 'right'))
  const targetPositions = trial.color === 'red' ? [1, 2, 4, 5] : [3]
  const opposite = trial.direction === 'left' ? 'right' : 'left'
  return freeze({ trialIndex: trial.index, block: trial.block, color: trial.color,
    cue: trial.color === 'red' ? 'SIDES' : 'MIDDLE', cueInstruction: trial.color === 'red' ? 'Follow the four side arrows' : 'Follow the middle arrow', targetPositions,
    symbols: Array.from({ length: 5 }, (_, index) => targetPositions.includes(index + 1) ? trial.direction : trial.condition === 'neutral' ? 'bar' : trial.condition === 'aligned' ? trial.direction : opposite) })
}
export function stimulusFor(form: Form, trialIndex: number): Stimulus {
  requireValid(isVerifiedArrowsForm(form) && Number.isInteger(trialIndex) && trialIndex >= 1 && trialIndex <= 135)
  return projectTrial(form.trials[trialIndex - 1])
}
