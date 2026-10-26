import { createHash } from 'node:crypto'
import { writeFileSync } from 'node:fs'

const output = new URL('../docs/specifications/ASSESSMENT_PRACTICE_LENGTHS_MOUTH_FORMS_V1_1.json', import.meta.url)
const version = 'lengths_mouth_forms_v1_1'
const baseSeed = 0x1e470101

function generator(seed) {
  let state = seed >>> 0
  return () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return state >>> 0
  }
}
function shuffle(items, next) {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index--) {
    const other = next() % (index + 1)
    ;[result[index], result[other]] = [result[other], result[index]]
  }
  return result
}
function acceptable(order, prefix) {
  const all = [...prefix, ...order]
  if (all.some((side, index) => index >= 3 && all.slice(index - 3, index + 1).every(value => value === side))) return false
  const switches = order.slice(1).filter((side, index) => side !== order[index]).length
  return switches >= 12 && switches <= 22
}
function makeForm(number) {
  const next = generator(baseSeed + number - 1)
  const richSide = number % 2 ? 'short' : 'long'
  const leanCounts = [1, 1, 1]
  leanCounts[(number - 1) % 3] = 2
  const trials = []
  for (let block = 1; block <= 3; block++) {
    let order
    for (let candidate = 0; candidate < 100000; candidate++) {
      const proposed = shuffle([...Array(15).fill('short'), ...Array(15).fill('long')], next)
      if (acceptable(proposed, trials.map(trial => trial.mouth))) { order = proposed; break }
    }
    if (!order) throw Error(`Could not generate order ${number}/${block}`)
    const rich = order.flatMap((mouth, index) => mouth === richSide ? [index] : [])
    const lean = order.flatMap((mouth, index) => mouth !== richSide ? [index] : [])
    let eligible
    for (let candidate = 0; candidate < 100000; candidate++) {
      const selected = [...shuffle(rich, next).slice(0, 4), ...shuffle(lean, next).slice(0, leanCounts[block - 1])].sort((a, b) => a - b)
      if (selected.every((index, position) => position === 0 || index > selected[position - 1] + 1) &&
        (!trials.at(-1)?.rewardEligible || selected[0] !== 0)) { eligible = new Set(selected); break }
    }
    if (!eligible) throw Error(`Could not generate rewards ${number}/${block}`)
    order.forEach((mouth, index) => trials.push({
      trial: trials.length + 1,
      block,
      mouth,
      rewardEligible: eligible.has(index),
    }))
  }
  return { formId: `LM${number}`, seed: (baseSeed + number - 1) >>> 0, richSide, trials }
}

const forms = Array.from({ length: 6 }, (_, index) => makeForm(index + 1))
const payload = { version, baseSeed, forms }
const sha256 = createHash('sha256').update(JSON.stringify(payload)).digest('hex')
writeFileSync(output, JSON.stringify({ ...payload, sha256 }, null, 2) + '\n')
process.stdout.write(`${sha256}\n`)
