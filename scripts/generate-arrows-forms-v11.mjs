import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'

// An original, fixed practice inventory. The counts match one observed
// JobTestPrep practice report; they are not a claim about current Pymetrics.
const VERSION = 'arrows_forms_v1_1'
const BASE_SEED = 0xA2210001
const CARD_COUNTS = [
  ['red', 'aligned', 31],
  ['blue', 'aligned', 31],
  ['red', 'opposed', 27],
  ['blue', 'opposed', 27],
  ['black', 'neutral', 19],
]
const BLOCK_LENGTH = 27
const BLOCK_COUNT = 5
const FORM_COUNT = 6
const MAX_ATTEMPTS = 100_000

function rng(initial) {
  let state = initial >>> 0
  return () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return state >>> 0
  }
}

function deck() {
  const cards = []
  for (let cell = 0; cell < CARD_COUNTS.length; cell++) {
    const [color, condition, count] = CARD_COUNTS[cell]
    for (let copy = 0; copy < count; copy++) {
      const direction = copy % 2 === cell % 2 ? 'left' : 'right'
      cards.push({ color, condition, direction })
    }
  }
  return cards
}

function shuffle(cards, next) {
  const result = cards.map(card => ({ ...card }))
  for (let i = result.length - 1; i > 0; i--) {
    const j = next() % (i + 1)
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

const rule = card => card.color === 'red' ? 'sides' : 'middle'
const maxRun = (cards, value) => {
  let prior
  let run = 0
  let max = 0
  for (const card of cards) {
    const current = value(card)
    run = current === prior ? run + 1 : 1
    max = Math.max(max, run)
    prior = current
  }
  return max
}
const count = (cards, predicate) => cards.filter(predicate).length

function accepted(cards) {
  if (cards.length !== 135 || maxRun(cards, rule) > 5 || maxRun(cards, card => card.direction) > 5) return false
  if (maxRun(cards, card => card.condition) > 6) return false
  for (let block = 0; block < BLOCK_COUNT; block++) {
    const slice = cards.slice(block * BLOCK_LENGTH, (block + 1) * BLOCK_LENGTH)
    const aligned = count(slice, card => card.condition === 'aligned')
    const opposed = count(slice, card => card.condition === 'opposed')
    const neutral = count(slice, card => card.condition === 'neutral')
    const sides = count(slice, card => rule(card) === 'sides')
    const left = count(slice, card => card.direction === 'left')
    const switches = count(slice.slice(1), (card, index) => rule(card) !== rule(slice[index]))
    if (aligned < 9 || aligned > 16 || opposed < 7 || opposed > 14 || neutral < 1 || neutral > 7) return false
    if (sides < 8 || sides > 15 || left < 9 || left > 18 || switches < 8 || switches > 20) return false
  }
  for (const [color, condition] of CARD_COUNTS) {
    const indices = cards.flatMap((card, index) => card.color === color && card.condition === condition ? [index] : [])
    const switched = count(indices, index => index % BLOCK_LENGTH !== 0 && rule(cards[index]) !== rule(cards[index - 1]))
    const stayed = count(indices, index => index % BLOCK_LENGTH !== 0 && rule(cards[index]) === rule(cards[index - 1]))
    if (switched < 3 || stayed < 3) return false
  }
  return true
}

function create(seed) {
  const next = rng(seed)
  const cards = deck()
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const trials = shuffle(cards, next)
    if (accepted(trials)) {
      return { seed, attempts: attempt, trials: trials.map((card, index) => ({
        ...card,
        rule: rule(card),
        block: Math.floor(index / BLOCK_LENGTH) + 1,
        index: index + 1,
      })) }
    }
  }
  throw Error(`No accepted form for seed ${seed}`)
}

const forms = Array.from({ length: FORM_COUNT }, (_, index) => ({ id: `AR11-${index + 1}`, ...create(BASE_SEED + index) }))
const signature = trial => `${trial.color}/${trial.condition}/${trial.direction}`
const distances = []
for (let a = 0; a < forms.length; a++) for (let b = a + 1; b < forms.length; b++) {
  const different = forms[a].trials.filter((trial, index) => signature(trial) !== signature(forms[b].trials[index])).length
  distances.push({ first: forms[a].id, second: forms[b].id, different })
  if (different < 100) throw Error(`Forms too similar: ${forms[a].id}/${forms[b].id}: ${different}`)
}
const canonical = JSON.stringify({ version: VERSION, baseSeed: BASE_SEED, forms })
const sha256 = createHash('sha256').update(canonical).digest('hex')
const output = new URL('../docs/specifications/ASSESSMENT_PRACTICE_ARROWS_FORMS_V1_1.json', import.meta.url)
const generated = JSON.stringify({ version: VERSION, baseSeed: BASE_SEED, forms, sha256 }, null, 2) + '\n'
if (process.argv.includes('--check')) {
  if (readFileSync(output, 'utf8') !== generated) throw Error('Stored Arrows V1.1 forms differ from fixed generator')
} else writeFileSync(output, generated)
console.log(JSON.stringify({ sha256, attempts: forms.map(({ id, seed, attempts }) => ({ id, seed, attempts })), distances }, null, 2))
