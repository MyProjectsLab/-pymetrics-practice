import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const legacyPath = fileURLToPath(new URL('../src/stop/forms/manifests.json', import.meta.url))
const outputPath = fileURLToPath(new URL('../docs/specifications/ASSESSMENT_PRACTICE_STOP_V1_3_FORMS.json', import.meta.url))
const schemaVersion = 'stop_form_manifest_v2'
const specificationVersion = '1.3'
const generatorVersion = 'stop_variable_mix_generator_v1'
const formVersion = '2'

// These quotas are original Assessment Practice choices. The two saved
// JobTestPrep runs bound the range; they do not determine this inventory.
const profiles = [
  ['baseline', 1, [7, 7, 7, 7]],
  ['baseline', 2, [8, 9, 8, 9]],
  ['baseline', 3, [10, 10, 10, 10]],
  ['baseline', 4, [11, 11, 11, 12]],
  ['replay', 1, [7, 8, 7, 8]],
  ['replay', 2, [8, 8, 8, 9]],
  ['replay', 3, [9, 9, 9, 9]],
  ['replay', 4, [10, 9, 10, 10]],
  ['replay', 5, [10, 11, 10, 11]],
  ['replay', 6, [11, 12, 11, 11]],
  ['retest', 1, [7, 7, 7, 7]],
  ['retest', 2, [9, 8, 9, 8]],
  ['retest', 3, [10, 10, 10, 10]],
  ['retest', 4, [12, 11, 11, 11]],
]

function randomFromSeed(seedId) {
  let state = createHash('sha256').update(seedId).digest().readUInt32LE(0)
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function sequenceForSeed(seedId, blockGoCounts) {
  const random = randomFromSeed(seedId)
  const sequence = []
  for (const goCount of blockGoCounts) {
    const block = [...Array(goCount).fill('GO'), ...Array(20 - goCount).fill('NO_GO')]
    for (let index = block.length - 1; index > 0; index -= 1) {
      const other = Math.floor(random() * (index + 1))
      ;[block[index], block[other]] = [block[other], block[index]]
    }
    sequence.push(...block)
  }
  return sequence
}

function distance(left, right) {
  return left.reduce((total, stimulus, index) => total + Number(stimulus !== right[index]), 0)
}

function acceptable(sequence, prior, legacy) {
  if (sequence[0] === 'NO_GO' && sequence[1] === 'NO_GO') return false
  if (sequence[78] === 'NO_GO' && sequence[79] === 'NO_GO') return false
  let kind = null
  let run = 0
  let longGo = false
  let contexts = 0
  for (const stimulus of sequence) {
    if (stimulus === 'NO_GO' && kind === 'GO' && run >= 3) contexts += 1
    if (stimulus === kind) run += 1
    else {
      if (kind === 'GO' && run >= 4) longGo = true
      kind = stimulus
      run = 1
    }
    if (run > 8) return false
  }
  if (kind === 'GO' && run >= 4) longGo = true
  if (!longGo || contexts < 4) return false
  return prior.every((form) => distance(sequence, form.sequence) >= 24) &&
    legacy.every((form) => distance(sequence, form.sequence) >= 24)
}

function canonical(form) {
  return [
    form.schemaVersion, form.id, form.family, form.formVersion,
    form.specificationVersion, form.generatorVersion, form.seedId,
    String(form.blockCount), String(form.blockSize),
    form.blockGoCounts.join(','),
    form.sequence.map((stimulus) => stimulus === 'GO' ? 'G' : 'N').join(''),
    '',
  ].join('\n')
}

function generate() {
  const legacy = JSON.parse(readFileSync(legacyPath, 'utf8'))
  const forms = []
  for (const [family, number, blockGoCounts] of profiles) {
    const ordinal = String(number).padStart(2, '0')
    let selected = null
    for (let attempt = 1; attempt <= 100000; attempt += 1) {
      const seedId = `ap-stop-v1.3-${family}-${ordinal}-candidate-${String(attempt).padStart(5, '0')}`
      const sequence = sequenceForSeed(seedId, blockGoCounts)
      if (!acceptable(sequence, forms, legacy)) continue
      selected = {
        id: `stop-v13-${family}-${ordinal}`,
        family, schemaVersion, formVersion, specificationVersion,
        generatorVersion, seedId, blockCount: 4, blockSize: 20,
        blockGoCounts, sequence,
      }
      selected.checksum = `sha256:${createHash('sha256').update(canonical(selected)).digest('hex')}`
      break
    }
    if (!selected) throw new Error(`No legal candidate for ${family}-${ordinal}`)
    forms.push(selected)
  }
  return `${JSON.stringify(forms, null, 2)}\n`
}

const generated = generate()
if (process.argv.includes('--check')) {
  if (readFileSync(outputPath, 'utf8') !== generated) throw new Error('V1.3 manifests differ from generator')
  process.stdout.write('14 Stop V1.3 manifests match deterministic generation.\n')
} else {
  writeFileSync(outputPath, generated)
  process.stdout.write('Wrote 14 Stop V1.3 manifests.\n')
}
