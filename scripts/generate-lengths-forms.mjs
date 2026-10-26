// Reproducible specification artifacts only; this is not a runtime form generator.
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const formsPath = resolve(root, 'docs/specifications/ASSESSMENT_PRACTICE_LENGTHS_FORMS_V1_0.json')
const fixturesPath = resolve(root, 'docs/specifications/ASSESSMENT_PRACTICE_LENGTHS_FIXTURES_V1_0.json')
const BASE_SEED = 0x1e470001
const categories = ['small', 'medium', 'large']
const sides = ['left', 'right']
const variants = {
  standard: { prefix: 'LS', shorts: [108, 124, 140, 156], gaps: [16, 32, 48], barHeight: 12 },
  visual_accommodation: { prefix: 'LA', shorts: [96, 112, 128, 144], gaps: [24, 40, 56], barHeight: 20 },
}

function fail(message) { throw Error(`Lengths forms: ${message}`) }
function prng(seed) {
  let state = seed >>> 0
  return () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return state >>> 0
  }
}
function cards() {
  return categories.flatMap((gapCategory, gapIndex) =>
    sides.flatMap(longerSide => [0, 1, 2, 3].map(baseIndex =>
      ({ gapCategory, gapIndex, longerSide, baseIndex }))))
}
function key(card) { return `${card.gapCategory}/${card.longerSide}/${card.baseIndex}` }
function admissible(prior, block) {
  let switches = 0
  for (let index = 1; index < block.length; index++)
    if (block[index].longerSide !== block[index - 1].longerSide) switches++
  if (switches < 8 || switches > 16) return false
  const joined = [...prior.slice(-3), ...block]
  for (const field of ['longerSide', 'gapCategory']) {
    let run = 1
    for (let index = 1; index < joined.length; index++) {
      run = joined[index][field] === joined[index - 1][field] ? run + 1 : 1
      if (run > 3) return false
    }
  }
  return true
}
function orderFor(seed) {
  const next = prng(seed)
  const ordered = []
  let attempts = 0
  for (let block = 1; block <= 4; block++) {
    let accepted = false
    for (let candidate = 0; candidate < 100000; candidate++) {
      attempts++
      const shuffled = cards()
      for (let index = shuffled.length - 1; index > 0; index--) {
        const other = next() % (index + 1)
        ;[shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]]
      }
      if (!admissible(ordered, shuffled)) continue
      ordered.push(...shuffled)
      accepted = true
      break
    }
    if (!accepted) fail(`no accepted block for seed ${seed}, block ${block}`)
  }
  return { ordered, attempts }
}
function form(id, variant, seed, attempts, ordered) {
  const settings = variants[variant]
  return { id, variant, seed, attempts, barHeight: settings.barHeight,
    trials: ordered.map((card, position) => {
      const shortLength = settings.shorts[card.baseIndex]
      const longLength = shortLength + settings.gaps[card.gapIndex]
      return { index: position + 1, block: Math.floor(position / 24) + 1,
        gapCategory: card.gapCategory, longerSide: card.longerSide,
        shortLength, longLength }
    }) }
}
function digest(value) { return createHash('sha256').update(JSON.stringify(value)).digest('hex') }
function artifact(value) { return JSON.stringify({ ...value, sha256: digest(value) }, null, 2) + '\n' }

const orders = Array.from({ length: 6 }, (_, index) => orderFor((BASE_SEED + index) >>> 0))
const forms = Object.entries(variants).flatMap(([variant, settings]) =>
  orders.map(({ ordered, attempts }, index) =>
    form(`${settings.prefix}${index + 1}`, variant, (BASE_SEED + index) >>> 0, attempts, ordered)))
const formsPayload = { version: 'lengths_forms_v1', baseSeed: BASE_SEED, forms }

// Primitive actions and stage observations, with explicit expected outcomes
// derived from the fixed LS1 schedule. No product code is used here.
const first = forms[0].trials[0]
const second = forms[0].trials[1]
const categoryCounts = { small: 32, medium: 32, large: 32 }
const oneWrongOneOmitted = structuredClone(categoryCounts)
oneWrongOneOmitted[first.gapCategory]--
oneWrongOneOmitted[second.gapCategory]--
const fixturesPayload = { version: 'lengths_fixtures_v1', formId: 'LS1',
  cases: [
    { id: 'all_correct_200', primitive: 'Each of 96 trials: first action is its longerSide at onset+200ms; all stage lateness 0.',
      expected: { status: 'valid', correct: 96, wrong: 0, omitted: 0, byCategoryCorrect: categoryCounts,
        byBlockCorrect: [24, 24, 24, 24], selectedLeft: 48, selectedRight: 48,
        cleanTimes: 96, medianMs: 200, iqrMs: 0 } },
    { id: 'first_wrong_second_omitted', primitive: 'LS1 trial 1: first action is opposite longerSide at onset+200ms. Trial 2: no eligible action. All other trials correct at onset+200ms.',
      expected: { status: 'valid', correct: 94, wrong: 1, omitted: 1,
        byCategoryCorrect: oneWrongOneOmitted, cleanTimes: 94, medianMs: 200, iqrMs: 0 } },
    { id: 'early_correct', primitive: 'LS1 trial 1 first correct action at onset+80ms; all other trials correct at onset+200ms.',
      expected: { status: 'valid', correct: 96, cleanTimes: 95, medianMs: 200, iqrMs: 0 } },
    { id: 'last_eligible', primitive: 'LS1 trial 1 first correct action at onset+1399ms; all others correct at onset+200ms.',
      expected: { status: 'valid', correct: 96, cleanTimes: 96, medianMs: 200, iqrMs: 0 } },
    { id: 'deadline_boundary', primitive: 'LS1 trial 1 first selected action at onset+1400ms before confirmed offset; all others correct at onset+200ms.',
      expected: { status: 'valid', correct: 95, omitted: 1, boundaryExtras: 1,
        cleanTimes: 95, medianMs: 200, iqrMs: 0 } },
    { id: 'quality_50', primitive: 'All correct at onset+200ms; LS1 trial 1 has stimulus lateness 50ms.',
      expected: { status: 'valid', correct: 96, cleanTimes: 96, medianMs: 200, iqrMs: 0 } },
    { id: 'quality_51', primitive: 'All correct at onset+200ms; LS1 trial 1 has stimulus lateness 51ms.',
      expected: { status: 'valid', correct: 96, cleanTimes: 95, medianMs: 200, iqrMs: 0 } },
    { id: 'quality_250', primitive: 'All correct at onset+200ms; LS1 trial 1 has stimulus lateness 250ms.',
      expected: { status: 'valid', correct: 96, cleanTimes: 95, medianMs: 200, iqrMs: 0 } },
    { id: 'severe_251', primitive: 'LS1 trial 1 stimulus confirms 251ms late; the run invalidates after recording its confirmed onset.',
      expected: { status: 'invalid', aggregateMetrics: null, timingMetrics: null, presentedAtLeast: 1 } },
    { id: 'five_times', primitive: 'One valid cell has five clean correct RTs [100,200,300,400,500]ms.',
      expected: { medianMs: 300, iqr: 'insufficient_variability' } },
    { id: 'eight_times', primitive: 'One valid cell has eight clean correct RTs [100,200,300,400,500,600,700,800]ms.',
      expected: { medianMs: 450, q1Ms: 250, q3Ms: 650, iqrMs: 400 } },
  ] }

for (const [path, bytes] of [[formsPath, artifact(formsPayload)], [fixturesPath, artifact(fixturesPayload)]]) {
  if (process.argv.includes('--check')) {
    if (readFileSync(path, 'utf8') !== bytes) fail(`artifact differs: ${path}`)
  } else writeFileSync(path, bytes)
}
for (const formRecord of forms) {
  if (formRecord.trials.length !== 96) fail(`wrong count ${formRecord.id}`)
  for (let block = 1; block <= 4; block++) {
    const trials = formRecord.trials.slice((block - 1) * 24, block * 24)
    if (new Set(trials.map(trial => `${trial.gapCategory}/${trial.longerSide}/${trial.shortLength}`)).size !== 24)
      fail(`duplicate block card ${formRecord.id} block ${block}`)
  }
}
for (let firstIndex = 0; firstIndex < 6; firstIndex++) for (let secondIndex = firstIndex + 1; secondIndex < 6; secondIndex++) {
  const difference = orders[firstIndex].ordered.filter((card, position) =>
    key(card) !== key(orders[secondIndex].ordered[position])).length
  if (difference < 70) fail(`insufficient order difference ${firstIndex + 1}/${secondIndex + 1}: ${difference}`)
}
console.log(JSON.stringify({ formsSha256: digest(formsPayload), fixturesSha256: digest(fixturesPayload),
  orderAttempts: orders.map(order => order.attempts) }, null, 2))
