import inventory from '../../docs/specifications/ASSESSMENT_PRACTICE_DIGITS_FORMS_V1_1.json'
import { DIGITS_FORMS_VERSION, DIGITS_CONSTRUCTOR_VERSION } from './contracts'
import type { Form, FormId, Mode } from './contracts'

export const DIGITS_MANIFEST_DIGEST = '5feb7ca195d7d7619c68904d79361b1a7e1ac2a25bab71a80bc4f437c1c48ee6'
const trusted = new WeakSet<Form>()
function assert(condition: unknown, reason: string): asserts condition {
  if (!condition) throw Error(`Digits form integrity: ${reason}`)
}
function record(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const p = Object.getPrototypeOf(value)
  return p === Object.prototype || p === null
}
function keys(value: Record<string, unknown>, expected: readonly string[]) {
  assert(Object.keys(value).toSorted().join('|') === [...expected].sort().join('|'), 'unexpected fields')
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value
}
async function sha256(text: string) {
  const bytes = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map(n => n.toString(16).padStart(2, '0')).join('')
}
function inspectForm(value: unknown, position: number): Form {
  assert(record(value), 'missing form')
  keys(value, ['id', 'mode', 'seed'])
  const mode: Mode = position < 6 ? 'visual' : 'auditory'
  const ordinal = position % 6 + 1
  const id = `${mode === 'visual' ? 'DV' : 'DA'}${ordinal}` as FormId
  assert(value.id === id && value.mode === mode &&
    value.seed === (0xD1610000 + (mode === 'auditory' ? 0x100 : 0) + ordinal) >>> 0,
  'form identity')
  return { id, mode, seed: value.seed as number, version: DIGITS_FORMS_VERSION,
    generatorVersion: DIGITS_CONSTRUCTOR_VERSION, manifestDigest: DIGITS_MANIFEST_DIGEST }
}

/** The fixed file is checked before it can be used for scored presentation. */
export async function loadDigitsForms(raw: unknown = inventory): Promise<ReadonlyMap<FormId, Form>> {
  const data: unknown = structuredClone(raw)
  assert(record(data), 'missing packet')
  keys(data, ['version', 'generatorVersion', 'forms', 'sha256'])
  assert(data.version === DIGITS_FORMS_VERSION && data.generatorVersion === DIGITS_CONSTRUCTOR_VERSION &&
    data.sha256 === DIGITS_MANIFEST_DIGEST && Array.isArray(data.forms) && data.forms.length === 12,
  'packet identity')
  assert(await sha256(JSON.stringify({ version: data.version,
    generatorVersion: data.generatorVersion, forms: data.forms })) === DIGITS_MANIFEST_DIGEST,
  'manifest digest')
  const forms = data.forms.map(inspectForm)
  const result = new Map<FormId, Form>()
  forms.forEach(form => {
    const fixed = freeze(form)
    trusted.add(fixed)
    result.set(fixed.id, fixed)
  })
  return result
}
export function isVerifiedDigitsForm(form: Form): boolean { return trusted.has(form) }

/** Original adaptive constructor. Prior contains only actually presented targets. */
export function digitsTarget(seed: number, index: number, length: number,
  prior: readonly string[]): string {
  assert(Number.isSafeInteger(seed) && seed >= 0 && seed <= 0xffffffff &&
    Number.isSafeInteger(index) && index >= 1 && index <= 40 &&
    Number.isSafeInteger(length) && length >= 2 && length <= 16, 'target inputs')
  let state = (seed ^ Math.imul(index, 0x9e3779b9) ^ Math.imul(length, 0x85ebca6b)) >>> 0
  if (!state) state = 0x6d2b79f5
  const next = () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5
    state >>>= 0; return state % 10 }
  for (let attempt = 0; attempt < 1000; attempt++) {
    const candidate = Array.from({ length }, next).join('')
    if (new Set(candidate).size === 1 || prior.includes(candidate)) continue
    let run = false
    for (let start = 0; start <= length - 4; start++) {
      const digits = [...candidate.slice(start, start + 4)].map(Number)
      if (digits.every((d, i) => i === 0 || d === digits[i - 1] + 1) ||
        digits.every((d, i) => i === 0 || d === digits[i - 1] - 1)) run = true
    }
    if (!run) return candidate
  }
  throw Error('Digits target exhaustion')
}
