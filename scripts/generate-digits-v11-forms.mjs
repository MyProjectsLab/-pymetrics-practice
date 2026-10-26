import { createHash } from 'node:crypto'
import { writeFileSync } from 'node:fs'

const forms = []
for (const mode of ['visual', 'auditory']) {
  for (let ordinal = 1; ordinal <= 6; ordinal++) {
    forms.push({
      id: `${mode === 'visual' ? 'DV' : 'DA'}${ordinal}`,
      mode,
      seed: (0xD1610000 + (mode === 'visual' ? 0 : 0x100) + ordinal) >>> 0,
    })
  }
}
const packet = { version: 'digits_forms_v1_1', generatorVersion: 'digits_constructor_v1_1', forms }
const sha256 = createHash('sha256').update(JSON.stringify(packet)).digest('hex')
const path = new URL('../docs/specifications/ASSESSMENT_PRACTICE_DIGITS_FORMS_V1_1.json', import.meta.url)
writeFileSync(path, JSON.stringify({ ...packet, sha256 }, null, 2) + '\n')
process.stdout.write(`${sha256}\n`)
