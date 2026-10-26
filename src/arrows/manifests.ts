import committed from '../../docs/specifications/ASSESSMENT_PRACTICE_ARROWS_FORMS_V1_0.json'
import { ARROWS_FORM_VERSION } from './contracts'
import type { Condition, Direction, Form, FormId, Rule, Stimulus, Symbol, Trial } from './contracts'

export const ARROWS_CANONICAL_SHA256 = '228b0e10405a80830c73e4b69e12950482967dec717f156c789e19fa11b1150b' as const
const BASE_SEED = 0xA2200001
const IDS: readonly FormId[] = ['AR1', 'AR2', 'AR3', 'AR4', 'AR5', 'AR6']
const ATTEMPTS = [10, 11, 10, 2, 5, 5] as const
const RULES: readonly Rule[] = ['center', 'outer']
const CONDITIONS: readonly Condition[] = ['aligned', 'opposed', 'neutral']
const DIRECTIONS: readonly Direction[] = ['left', 'right']
const verified = new WeakSet<Form>()

function requireValid(condition: unknown, detail: string): asserts condition {
  if (!condition) throw Error(`Arrows form integrity: ${detail}`)
}
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
function exactKeys(value: Record<string, unknown>, expected: readonly string[]) {
  requireValid(Object.keys(value).toSorted().join('|') === [...expected].sort().join('|'), 'unexpected fields')
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value
}
async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}
function maxRun(trials: readonly Trial[], field: 'rule' | 'direction'): number {
  let best = 0, run = 0, prior: string | undefined
  for (const trial of trials) {
    run = trial[field] === prior ? run + 1 : 1
    best = Math.max(best, run)
    prior = trial[field]
  }
  return best
}
function inspectForm(raw: unknown, position: number): Form {
  requireValid(object(raw), 'form missing')
  exactKeys(raw, ['id', 'seed', 'attempts', 'trials'])
  requireValid(raw.id === IDS[position] && raw.seed === BASE_SEED + position && raw.attempts === ATTEMPTS[position], 'form identity/seed/attempts')
  requireValid(Array.isArray(raw.trials) && raw.trials.length === 120, 'trial length')
  const trials: Trial[] = raw.trials.map((value: unknown, index: number) => {
    requireValid(object(value), 'trial missing')
    exactKeys(value, ['rule', 'condition', 'direction', 'block', 'index'])
    requireValid(RULES.includes(value.rule as Rule) && CONDITIONS.includes(value.condition as Condition) && DIRECTIONS.includes(value.direction as Direction), 'invalid tuple')
    requireValid(value.block === Math.floor(index / 24) + 1 && value.index === index + 1, 'trial index/block')
    return { rule: value.rule as Rule, condition: value.condition as Condition,
      direction: value.direction as Direction, block: value.block as number, index: value.index as number }
  })
  requireValid(maxRun(trials, 'rule') <= 5 && maxRun(trials, 'direction') <= 5, 'run cap')
  for (let block = 0; block < 5; block++) {
    const slice = trials.slice(block * 24, block * 24 + 24)
    for (const rule of RULES) for (const condition of CONDITIONS) for (const direction of DIRECTIONS)
      requireValid(slice.filter(trial => trial.rule === rule && trial.condition === condition && trial.direction === direction).length === 2, 'block balance')
    const switches = slice.slice(1).filter((trial, index) => trial.rule !== slice[index].rule).length
    requireValid(switches >= 8 && switches <= 15, 'block switches')
  }
  for (const rule of RULES) for (const condition of CONDITIONS) {
    const indices = trials.flatMap((trial, index) => trial.rule === rule && trial.condition === condition ? [index] : [])
    const switched = indices.filter(index => index % 24 !== 0 && trials[index].rule !== trials[index - 1].rule).length
    const stayed = indices.filter(index => index % 24 !== 0 && trials[index].rule === trials[index - 1].rule).length
    requireValid(switched >= 5 && stayed >= 5, 'switch/stay cell balance')
  }
  return { id: raw.id as FormId, seed: raw.seed as number, attempts: raw.attempts as number, trials }
}

/** Strictly validates the fixed inventory and returns immutable, trusted form objects. No live generation. */
export async function loadArrowsForms(raw: unknown = committed): Promise<ReadonlyMap<FormId, Form>> {
  // The owned snapshot prevents a caller from changing form data during the asynchronous digest.
  const snapshot: unknown = structuredClone(raw)
  requireValid(object(snapshot), 'packet missing')
  exactKeys(snapshot, ['version', 'baseSeed', 'forms', 'sha256'])
  requireValid(snapshot.version === ARROWS_FORM_VERSION && snapshot.baseSeed === BASE_SEED &&
    snapshot.sha256 === ARROWS_CANONICAL_SHA256 && Array.isArray(snapshot.forms) && snapshot.forms.length === 6, 'packet identity')
  const forms = snapshot.forms.map((value: unknown, index: number) => inspectForm(value, index))
  const canonical = JSON.stringify({ version: ARROWS_FORM_VERSION, baseSeed: BASE_SEED, forms })
  requireValid(await sha256(canonical) === ARROWS_CANONICAL_SHA256, 'canonical digest')
  for (let a = 0; a < forms.length; a++) for (let b = a + 1; b < forms.length; b++) {
    const distance = forms[a].trials.filter((trial: Trial, index: number) => {
      const other = forms[b].trials[index]
      return trial.rule !== other.rule || trial.condition !== other.condition || trial.direction !== other.direction
    }).length
    requireValid(distance >= 101 && distance <= 115, 'playable order distance')
  }
  const output = new Map<FormId, Form>()
  for (const form of forms) {
    const immutable = freeze(form)
    verified.add(immutable)
    output.set(immutable.id, immutable)
  }
  return output
}

export function isVerifiedArrowsForm(value: Form): boolean { return verified.has(value) }

/** Candidate-visible projection; no hidden answer, condition or manifest sequence is returned. */
export function stimulusFor(form: Form, trialIndex: number): Stimulus {
  requireValid(isVerifiedArrowsForm(form), 'unverified form')
  requireValid(Number.isInteger(trialIndex) && trialIndex >= 1 && trialIndex <= 120, 'trial index')
  const trial = form.trials[trialIndex - 1]
  const targetPositions = trial.rule === 'center' ? [3] : [1, 5]
  const symbols: Symbol[] = Array.from({ length: 5 }, (_, index) => {
    if (targetPositions.includes(index + 1)) return trial.direction
    if (trial.condition === 'neutral') return 'bar'
    if (trial.condition === 'aligned') return trial.direction
    return trial.direction === 'left' ? 'right' : 'left'
  })
  return freeze({ trialIndex, block: trial.block, cue: trial.rule === 'center' ? 'CENTER' : 'OUTER',
    cueInstruction: trial.rule === 'center' ? 'Follow the one middle arrow' : 'Follow the matching outer pair',
    targetPositions, symbols })
}
