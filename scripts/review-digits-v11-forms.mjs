import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const path = new URL('../docs/specifications/ASSESSMENT_PRACTICE_DIGITS_FORMS_V1_1.json', import.meta.url)
const packet = JSON.parse(readFileSync(path, 'utf8'))
const fixtures = JSON.parse(readFileSync(new URL(
  '../docs/specifications/ASSESSMENT_PRACTICE_DIGITS_FIXTURES_V1_1.json', import.meta.url), 'utf8'))
assert.deepEqual(Object.keys(packet), ['version', 'generatorVersion', 'forms', 'sha256'])
assert.equal(packet.version, 'digits_forms_v1_1')
assert.equal(packet.generatorVersion, 'digits_constructor_v1_1')
assert.equal(packet.forms.length, 12)
assert.equal(fixtures.version, 'digits_fixtures_v1_1')
const digest = createHash('sha256').update(JSON.stringify({
  version: packet.version, generatorVersion: packet.generatorVersion, forms: packet.forms,
})).digest('hex')
assert.equal(packet.sha256, digest)
for (let index = 0; index < 12; index++) {
  const mode = index < 6 ? 'visual' : 'auditory'
  const ordinal = index % 6 + 1
  assert.deepEqual(packet.forms[index], {
    id: `${mode === 'visual' ? 'DV' : 'DA'}${ordinal}`,
    mode,
    seed: (0xD1610000 + (mode === 'visual' ? 0 : 0x100) + ordinal) >>> 0,
  })
}

function target(seed, index, length, prior) {
  assert(index >= 1 && index <= 40 && length >= 2 && length <= 16)
  let state = (seed ^ Math.imul(index, 0x9e3779b9) ^ Math.imul(length, 0x85ebca6b)) >>> 0
  if (state === 0) state = 0x6d2b79f5
  const draw = () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return state >>> 0
  }
  for (let attempt = 0; attempt < 1000; attempt++) {
    let value = ''
    for (let j = 0; j < length; j++) value += String(draw() % 10)
    const allSame = [...value].every(digit => digit === value[0])
    let arithmeticRun = false
    for (let start = 0; start <= length - 4; start++) {
      const group = value.slice(start, start + 4).split('').map(Number)
      if (group.every((digit, j) => j === 0 || digit === group[j - 1] + 1) ||
        group.every((digit, j) => j === 0 || digit === group[j - 1] - 1)) arithmeticRun = true
    }
    if (!allSame && !arithmeticRun && !prior.includes(value)) return value
  }
  throw Error('candidate exhaustion')
}

const paths = [
  () => true,
  () => false,
  n => n % 2 === 0,
  n => n % 3 !== 1,
  n => n % 5 !== 0,
  n => n < 12,
]
let inspected = 0
for (const form of packet.forms) {
  for (const choice of paths) {
    const prior = []
    let length = 4
    let wrong = 0
    let reason = null
    for (let index = 1; index <= 40; index++) {
      const value = target(form.seed, index, length, prior)
      assert.equal(value.length, length)
      assert.match(value, /^[0-9]+$/)
      assert(!prior.includes(value))
      prior.push(value)
      inspected++
      if (choice(index)) length = Math.min(16, length + 1)
      else {
        wrong++
        if (wrong === 3) { reason = 'three_mistakes'; break }
        length = Math.max(2, length - 1)
      }
      if (index === 40) reason = 'practice_limit_reached'
    }
    assert(reason === 'three_mistakes' || reason === 'practice_limit_reached')
    assert((reason === 'three_mistakes') === (wrong === 3))
  }
}
for (const item of fixtures.cases) {
  const answers = item.answers
  let length = 4
  let wrong = 0
  let maxCorrectLength = null
  const presentedLengths = []
  const byLength = new Map()
  let ending = null
  for (const answer of answers) {
    presentedLengths.push(length)
    const row = byLength.get(length) ?? { length, exact: 0, of: 0 }
    row.of++
    if (answer === 'correct') row.exact++
    byLength.set(length, row)
    if (answer === 'correct') {
      maxCorrectLength = Math.max(maxCorrectLength ?? 0, length)
      length = Math.min(16, length + 1)
    } else {
      assert.equal(answer, 'wrong')
      wrong++
      if (wrong === 3) { ending = 'three_mistakes'; break }
      length = Math.max(2, length - 1)
    }
    if (presentedLengths.length === 40) ending = 'practice_limit_reached'
  }
  assert.deepEqual(presentedLengths, item.presentedLengths)
  assert.equal(answers.length, presentedLengths.length)
  assert.equal(wrong, item.finalWrongCount)
  assert.equal(maxCorrectLength, item.maxCorrectLength)
  assert.equal(ending, item.ending)
  if (item.byLength) assert.deepEqual([...byLength.values()].sort((a, b) => a.length - b.length), item.byLength)
  if (item.serialPositionOpportunities) assert.deepEqual(
    Array.from({ length: Math.max(...presentedLengths) }, (_, index) =>
      presentedLengths.filter(value => value >= index + 1).length),
    item.serialPositionOpportunities)
}
for (const item of fixtures.closureCases) {
  const deadline = item.entryOpenedMs + item.entryWindowMs
  const actionMs = item.submitAtMs ?? item.skipAtMs
  const exact = item.submitAtMs !== undefined && actionMs < deadline && item.draft === item.target
  assert.equal(exact, item.expectedExactCorrect)
  assert.equal(exact ? 0 : 1, item.expectedWrongCount)
  assert.equal(exact ? 5 : 3, item.expectedNextLength)
}
assert.equal(fixtures.negativeCases.length, 5)
assert.equal(fixtures.authorityCases.length, 5)
for (const item of [...fixtures.negativeCases, ...fixtures.authorityCases]) {
  assert.equal(typeof item.name, 'string')
  assert.equal(typeof item.expected, 'string')
  assert(item.expected.length > 15)
}
process.stdout.write(`PASS ${packet.forms.length} seed records, ${paths.length} paths/form, ${inspected} generated trials, ${fixtures.cases.length} full paths, ${fixtures.closureCases.length} deadline cases; ${digest}\n`)
