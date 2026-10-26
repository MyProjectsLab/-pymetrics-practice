import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const output = fileURLToPath(new URL('../docs/specifications/ASSESSMENT_PRACTICE_DIGITS_FORMS_V1_0.json', import.meta.url))
const version = 'digits_forms_v1_0'
const generatorVersion = 'digits_constructor_v1_0'
const lengths = [3, 4, 5, 6, 7, 8]
const u32 = value => value >>> 0

function rng(seed) {
  let state = u32(seed)
  return () => {
    state = u32(state ^ (state << 13))
    state = u32(state ^ (state >>> 17))
    state = u32(state ^ (state << 5))
    return state
  }
}

function hasLongRun(digits) {
  for (let i = 0; i <= digits.length - 4; i++) {
    const chunk = digits.slice(i, i + 4).map(Number)
    if (chunk.every((value, j) => j === 0 || value - chunk[j - 1] === 1) ||
      chunk.every((value, j) => j === 0 || value - chunk[j - 1] === -1)) return true
  }
  return false
}

function oneForm(mode, ordinal, seen) {
  const modeOffset = mode === 'visual' ? 0 : 0x100
  const seed = u32(0xd1610000 + modeOffset + ordinal)
  const next = rng(seed)
  const counts = Array(10).fill(0)
  const trials = []
  for (let block = 1; block <= 3; block++) for (const length of lengths) {
    let digits
    for (let attempt = 0; attempt < 1000; attempt++) {
      const candidate = []
      while (candidate.length < length) {
        const eligible = Array.from({ length: 10 }, (_, digit) => digit)
          .filter(digit => !candidate.includes(digit))
        const minimum = Math.min(...eligible.map(digit => counts[digit]))
        const tied = eligible.filter(digit => counts[digit] === minimum)
        candidate.push(tied[next() % tied.length])
      }
      if (!hasLongRun(candidate) && !seen.has(candidate.join(''))) { digits = candidate; break }
    }
    if (!digits) throw Error(`No acceptable sequence for ${mode} ${ordinal} block ${block} length ${length}`)
    for (const digit of digits) counts[digit]++
    seen.add(digits.join(''))
    trials.push({ index: trials.length + 1, block, length, digits: digits.join('') })
  }
  if (Math.min(...counts) !== 9 || Math.max(...counts) !== 10) throw Error('Digit balance failed')
  return { id: `${mode === 'visual' ? 'DV' : 'DA'}${ordinal}`, mode, seed, trials }
}

const forms = []
const seen = new Set()
for (const mode of ['visual', 'auditory']) for (let ordinal = 1; ordinal <= 6; ordinal++)
  forms.push(oneForm(mode, ordinal, seen))
const core = { version, generatorVersion, forms }
const sha256 = createHash('sha256').update(JSON.stringify(core)).digest('hex')
const bytes = JSON.stringify({ ...core, sha256 }, null, 2) + '\n'
if (process.argv.includes('--check')) {
  if (readFileSync(output, 'utf8') !== bytes) throw Error('Digits form bytes or digest differ from generator')
  console.log(`Digits forms match constructor: ${sha256}`)
} else {
  writeFileSync(output, bytes)
  console.log(`Wrote Digits forms: ${sha256}`)
}
