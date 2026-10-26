import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const path = fileURLToPath(new URL('../docs/specifications/ASSESSMENT_PRACTICE_DIGITS_FORMS_V1_0.json', import.meta.url))
const packet = JSON.parse(readFileSync(path, 'utf8'))
function check(condition, message) { if (!condition) throw Error(message) }
const { version, generatorVersion, forms, sha256 } = packet
check(version === 'digits_forms_v1_0' && generatorVersion === 'digits_constructor_v1_0', 'Version mismatch')
check(Array.isArray(forms) && forms.length === 12, 'Expected twelve mode-specific forms')
const digest = createHash('sha256').update(JSON.stringify({ version, generatorVersion, forms })).digest('hex')
check(digest === sha256, 'Canonical digest mismatch')
const seen = new Set()
const positional = Array(8).fill(0)
for (const [formIndex, form] of forms.entries()) {
  const mode = formIndex < 6 ? 'visual' : 'auditory'
  const ordinal = formIndex % 6 + 1
  check(form.id === `${mode === 'visual' ? 'DV' : 'DA'}${ordinal}` && form.mode === mode, 'Form identity/order mismatch')
  check(form.seed === 0xd1610000 + (mode === 'visual' ? 0 : 0x100) + ordinal, 'Seed mismatch')
  check(Array.isArray(form.trials) && form.trials.length === 18, 'Trial count mismatch')
  const count = Array(10).fill(0)
  const perLength = Array(6).fill(0)
  for (const [zeroIndex, trial] of form.trials.entries()) {
    const index = zeroIndex + 1
    const block = Math.floor(zeroIndex / 6) + 1
    const length = zeroIndex % 6 + 3
    check(trial.index === index && trial.block === block && trial.length === length, 'Position/length schedule mismatch')
    check(typeof trial.digits === 'string' && new RegExp(`^[0-9]{${length}}$`).test(trial.digits), 'Malformed digit string')
    check(new Set(trial.digits).size === length, 'Repeated digit within a trial')
    check(!seen.has(trial.digits), 'A sequence repeats across forms')
    seen.add(trial.digits)
    for (let j = 0; j <= trial.digits.length - 4; j++) {
      const chunk = [...trial.digits.slice(j, j + 4)].map(Number)
      check(!chunk.slice(1).every((digit, k) => digit - chunk[k] === 1) &&
        !chunk.slice(1).every((digit, k) => digit - chunk[k] === -1), 'Four-step monotone run')
    }
    for (const character of trial.digits) count[Number(character)]++
    perLength[length - 3]++
    for (let position = 0; position < length; position++) positional[position]++
  }
  check(perLength.every(value => value === 3), 'Unbalanced lengths')
  check(count.filter(value => value === 10).length === 9 && count.filter(value => value === 9).length === 1,
    'Unbalanced digit appearances')
}
const expectedPositionPerForm = [18, 18, 18, 15, 12, 9, 6, 3]
check(positional.every((value, index) => value === 12 * expectedPositionPerForm[index]), 'Serial-position denominator mismatch')
console.log(JSON.stringify({ sha256, forms: forms.length, trials: forms.length * 18,
  visualTrials: 108, auditoryTrials: 108, perFormDigits: 99, uniqueSequences: seen.size,
  serialPositionDenominatorsPerForm: expectedPositionPerForm,
  totalPositionOpportunities: positional.reduce((a, b) => a + b, 0) }, null, 2))
