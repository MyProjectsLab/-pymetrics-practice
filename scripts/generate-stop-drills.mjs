import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const output = fileURLToPath(new URL('../src/stop/drill-manifests.json', import.meta.url))
const definitions = [
  ['withholding', [[12, 12, 1100, 1000], [16, 8, 1100, 1000], [18, 6, 1100, 1000]]],
  ['detection', [[18, 6, 1200, 1000], [18, 6, 1100, 1000], [18, 6, 1000, 1000]]],
  ['consistency', [[22, 8, 1000, 1200], [22, 8, 1000, 1200], [22, 8, 1000, 1200], [24, 6, 1000, 1200]]],
  ['stability', [[18, 6, 1000, 1200], [18, 6, 1000, 1200], [18, 6, 1000, 1200]]],
  ['maintenance', [[15, 5, 1000, 1200], [15, 5, 1000, 1200], [15, 5, 1000, 1200]]],
]
function randomFromSeed(seed) {
  let state = createHash('sha256').update(seed).digest().readUInt32LE(0)
  return () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}
function runStats(sequence) {
  let prior = '', length = 0, maxGo = 0, maxNoGo = 0
  for (const value of sequence) {
    length = value === prior ? length + 1 : 1
    prior = value
    if (value === 'GO') maxGo = Math.max(maxGo, length)
    else maxNoGo = Math.max(maxNoGo, length)
  }
  return { maxGo, maxNoGo }
}
function contextCount(sequence) {
  let goRun = 0, count = 0
  for (const value of sequence) {
    if (value === 'GO') goRun++
    else { if (goRun >= 3) count++; goRun = 0 }
  }
  return count
}
function candidate(seed, blocks) {
  const random = randomFromSeed(seed)
  return blocks.map(([go, noGo, deadlineMs, fixationMs]) => {
    const sequence = [...Array(go).fill('GO'), ...Array(noGo).fill('NO_GO')]
    for (let i = sequence.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1))
      ;[sequence[i], sequence[j]] = [sequence[j], sequence[i]]
    }
    return { go, noGo, deadlineMs, fixationMs, sequence }
  })
}
function acceptable(id, blocks) {
  const full = blocks.flatMap(block => block.sequence)
  const runs = runStats(full)
  if (runs.maxGo > (id === 'withholding' ? 6 : 8) || runs.maxNoGo > 8) return false
  if (id === 'withholding' && (contextCount(blocks[1].sequence) < 3 || contextCount(blocks[2].sequence) < 3)) return false
  if (id === 'consistency' && blocks.some(block => runStats(block.sequence).maxGo < 4)) return false
  if (id === 'maintenance' && (runs.maxGo < 4 || contextCount(full) < 4 ||
    full[0] === 'NO_GO' && full[1] === 'NO_GO' || full.at(-2) === 'NO_GO' && full.at(-1) === 'NO_GO')) return false
  if (id === 'detection' && blocks.some(block => block.sequence.every((value, index) => !index || value !== block.sequence[index - 1]))) return false
  return true
}
function canonical(manifest) {
  return [manifest.schemaVersion, manifest.id, manifest.version, manifest.specificationVersion,
    manifest.generatorVersion, manifest.seedId, ...manifest.blocks.map(block =>
      [block.go, block.noGo, block.deadlineMs, block.fixationMs, block.sequence.map(value => value === 'GO' ? 'G' : 'N').join('')].join(':')), ''].join('\n')
}
const manifests = definitions.map(([id, distribution]) => {
  for (let attempt = 1; attempt <= 100000; attempt++) {
    const seedId = `ap-stop-v1.1-drill-${id}-candidate-${String(attempt).padStart(5, '0')}`
    const blocks = candidate(seedId, distribution)
    if (!acceptable(id, blocks)) continue
    const manifest = { schemaVersion: 'stop_drill_manifest_v1', id, version: '1', specificationVersion: '1.1',
      generatorVersion: 'stop_drill_generator_v1', seedId, blocks }
    return { ...manifest, checksum: `sha256:${createHash('sha256').update(canonical(manifest)).digest('hex')}` }
  }
  throw new Error(`Could not generate ${id}`)
})
const content = `${JSON.stringify(manifests, null, 2)}\n`
if (process.argv.includes('--check')) {
  if (readFileSync(output, 'utf8') !== content) throw new Error('Stored drill manifests differ from generator')
  process.stdout.write('5 stored drill manifests match the deterministic generator.\n')
} else {
  writeFileSync(output, content)
  process.stdout.write('Wrote 5 Stop drill manifests.\n')
}
