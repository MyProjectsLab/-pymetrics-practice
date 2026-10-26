import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const outputPath = fileURLToPath(new URL('../src/stop/forms/manifests.json', import.meta.url))
const schemaVersion = 'stop_form_manifest_v1'
const specificationVersion = '1.1'
const generatorVersion = 'stop_standard_generator_v1'
const formVersion = '1'
const families = [
  ['baseline', 4],
  ['replay', 6],
  ['retest', 4],
]

function randomFromSeed(seedId) {
  let state = createHash('sha256').update(seedId).digest().readUInt32LE(0)
  return () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function sequenceForSeed(seedId) {
  const random = randomFromSeed(seedId)
  const sequence = []
  for (let block = 0; block < 4; block += 1) {
    const trials = [
      ...Array(15).fill('GO'),
      ...Array(5).fill('NO_GO'),
    ]
    for (let index = trials.length - 1; index > 0; index -= 1) {
      const other = Math.floor(random() * (index + 1))
      ;[trials[index], trials[other]] = [trials[other], trials[index]]
    }
    sequence.push(...trials)
  }
  return sequence
}

function acceptable(sequence, prior) {
  if (sequence[0] === 'NO_GO' && sequence[1] === 'NO_GO') return false
  if (sequence[78] === 'NO_GO' && sequence[79] === 'NO_GO') return false

  let runKind = null
  let runLength = 0
  let hasLongGoRun = false
  let longRunNoGoContexts = 0
  for (const stimulus of sequence) {
    if (stimulus === 'NO_GO' && runKind === 'GO' && runLength >= 3) {
      longRunNoGoContexts += 1
    }
    if (stimulus === runKind) {
      runLength += 1
    } else {
      if (runKind === 'GO' && runLength >= 4) hasLongGoRun = true
      runKind = stimulus
      runLength = 1
    }
    if (runLength > 8) return false
  }
  if (runKind === 'GO' && runLength >= 4) hasLongGoRun = true
  if (!hasLongGoRun || longRunNoGoContexts < 4) return false

  return prior.every((form) =>
    sequence.reduce(
      (difference, stimulus, index) => difference + Number(stimulus !== form.sequence[index]),
      0,
    ) >= 24,
  )
}

function checksum(form) {
  const sequence = form.sequence.map((stimulus) => stimulus === 'GO' ? 'G' : 'N').join('')
  const canonical = [
    form.schemaVersion,
    form.id,
    form.family,
    form.formVersion,
    form.specificationVersion,
    form.generatorVersion,
    form.seedId,
    String(form.blockCount),
    String(form.blockSize),
    sequence,
    '',
  ].join('\n')
  return `sha256:${createHash('sha256').update(canonical).digest('hex')}`
}

function generate() {
  const forms = []
  for (const [family, count] of families) {
    for (let number = 1; number <= count; number += 1) {
      const id = `stop-${family}-${String(number).padStart(2, '0')}`
      let selected = null
      for (let attempt = 1; attempt <= 100_000; attempt += 1) {
        const seedId = `ap-stop-v1.1-${family}-${String(number).padStart(2, '0')}-candidate-${String(attempt).padStart(5, '0')}`
        const sequence = sequenceForSeed(seedId)
        if (acceptable(sequence, forms)) {
          selected = {
            id,
            family,
            schemaVersion,
            formVersion,
            specificationVersion,
            generatorVersion,
            seedId,
            blockCount: 4,
            blockSize: 20,
            sequence,
          }
          selected.checksum = checksum(selected)
          break
        }
      }
      if (!selected) throw new Error(`No valid sequence found for ${id}`)
      forms.push(selected)
    }
  }
  return `${JSON.stringify(forms, null, 2)}\n`
}

const generated = generate()
if (process.argv.includes('--check')) {
  const stored = readFileSync(outputPath, 'utf8')
  if (stored !== generated) throw new Error('Stored Stop manifests differ from seeded generator output')
  process.stdout.write('14 stored Stop manifests match the deterministic generator.\n')
} else {
  writeFileSync(outputPath, generated)
  process.stdout.write('Wrote 14 Stop form manifests.\n')
}
