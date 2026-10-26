import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'

const BASE_SEED = 0xA2200001
const rules = ['center', 'outer']
const conditions = ['aligned', 'opposed', 'neutral']
const directions = ['left', 'right']

function rng(initial) {
  let state = initial >>> 0
  return () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return state >>> 0
  }
}

function templates() {
  const result = []
  for (const rule of rules) for (const condition of conditions) for (const direction of directions)
    for (let copy = 0; copy < 2; copy++) result.push({ rule, condition, direction })
  return result
}

function shuffle(items, next) {
  const array = items.map(item => ({ ...item }))
  for (let i = array.length - 1; i > 0; i--) {
    const j = next() % (i + 1)
    ;[array[i], array[j]] = [array[j], array[i]]
  }
  return array
}

function maxRun(trials, field) {
  let max = 0, run = 0, prior
  for (const trial of trials) {
    run = trial[field] === prior ? run + 1 : 1
    max = Math.max(max, run)
    prior = trial[field]
  }
  return max
}

function accepted(trials) {
  if (trials.length !== 120 || maxRun(trials, 'rule') > 5 || maxRun(trials, 'direction') > 5) return false
  for (let block = 0; block < 5; block++) {
    const slice = trials.slice(block * 24, block * 24 + 24)
    let switches = 0
    for (let i = 1; i < slice.length; i++) if (slice[i].rule !== slice[i - 1].rule) switches++
    if (switches < 8 || switches > 15) return false
  }
  for (const rule of rules) for (const condition of conditions) {
    const indices = trials.map((trial, index) => trial.rule === rule && trial.condition === condition ? index : -1).filter(index => index >= 0)
    const switched = indices.filter(index => index % 24 !== 0 && trials[index].rule !== trials[index - 1].rule).length
    const stayed = indices.filter(index => index % 24 !== 0 && trials[index].rule === trials[index - 1].rule).length
    if (switched < 5 || stayed < 5) return false
  }
  return true
}

function create(seed) {
  const next = rng(seed)
  for (let attempt = 1; attempt <= 100_000; attempt++) {
    const trials = Array.from({ length: 5 }, () => shuffle(templates(), next)).flat()
    if (accepted(trials)) return { seed, attempts: attempt, trials: trials.map((trial, index) => ({ ...trial, block: Math.floor(index / 24) + 1, index: index + 1 })) }
  }
  throw Error(`No accepted form for seed ${seed}`)
}

const forms = Array.from({ length: 6 }, (_, index) => ({ id: `AR${index + 1}`, ...create(BASE_SEED + index) }))
const signature = value => `${value.rule}/${value.condition}/${value.direction}`
const distances = []
for (let a = 0; a < forms.length; a++) for (let b = a + 1; b < forms.length; b++) {
  const different = forms[a].trials.filter((trial, index) => signature(trial) !== signature(forms[b].trials[index])).length
  distances.push({ first: forms[a].id, second: forms[b].id, different })
  if (different < 90) throw Error(`Forms too similar: ${forms[a].id}/${forms[b].id}: ${different}`)
}
const canonical = JSON.stringify({ version: 'arrows_forms_v1', baseSeed: BASE_SEED, forms })
const sha256 = createHash('sha256').update(canonical).digest('hex')
const output = new URL('../docs/specifications/ASSESSMENT_PRACTICE_ARROWS_FORMS_V1_0.json', import.meta.url)
const generated = JSON.stringify({ version: 'arrows_forms_v1', baseSeed: BASE_SEED, forms, sha256 }, null, 2) + '\n'
if (process.argv.includes('--check')) {
  if (readFileSync(output, 'utf8') !== generated) throw Error('Stored Arrows forms differ from the fixed generator')
} else writeFileSync(output, generated)
console.log(JSON.stringify({ sha256, attempts: forms.map(({ id, seed, attempts }) => ({ id, seed, attempts })), distances, maxRuns: forms.map(({ id, trials }) => ({ id, rule: maxRun(trials, 'rule'), direction: maxRun(trials, 'direction') })) }, null, 2))
