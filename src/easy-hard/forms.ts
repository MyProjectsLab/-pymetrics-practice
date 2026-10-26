import raw from '../../docs/specifications/ASSESSMENT_PRACTICE_EASY_HARD_FORMS_V1_0_DRAFT.json'

export type Choice = 'easy' | 'hard'
export interface Offer {
  index: number
  probabilityPercent: 12 | 50 | 88
  hardOfferCents: 124 | 277 | 430
  fallbackTask: Choice
  lotteryDrawBasisPoints: number
}
export interface Form { formId: string; entries: Offer[] }

const EXPECTED_FORM_HASHES = [
  '5b846708ffef3600d07d7b11e75789d6acb598001ddf5b05d0848e7f5c931ad0',
  '960edd14adfd4b03a622c936ec14c371e2a78030f3ff5ca6c8ae21b4578f6fa3',
  'ad31c4eb54f73e4c4c0b84184bfb39c79e5937a1aea26887d0a343502fb20363',
  'caae2a55c33e49bde8ae15beacff1884bcb03933f11a80c2bc56ee9ffa379b8c',
] as const
const MANIFEST_VERSION = 'easy-hard-forms-v1.0-draft'
let cached: ReadonlyMap<string, { form: Form; hash: string }> | null = null

function assert(ok: unknown, reason: string): asserts ok {
  if (!ok) throw Error(`Easy or Hard form integrity: ${reason}`)
}
async function digest(text: string) {
  const bytes = new TextEncoder().encode(text)
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('')
}

export async function loadForms() {
  if (cached) return cached
  assert(raw.schemaVersion === MANIFEST_VERSION && raw.forms.length === 4, 'manifest header')
  const result = new Map<string, { form: Form; hash: string }>()
  for (const [i, value] of raw.forms.entries()) {
    const form = value as Form
    assert(form.formId === `EH${i + 1}` && form.entries.length === 512, 'form identity')
    for (const [j, offer] of form.entries.entries()) {
      assert(offer.index === j + 1 && [12, 50, 88].includes(offer.probabilityPercent) &&
        [124, 277, 430].includes(offer.hardOfferCents) &&
        (offer.fallbackTask === 'easy' || offer.fallbackTask === 'hard') &&
        Number.isSafeInteger(offer.lotteryDrawBasisPoints) &&
        offer.lotteryDrawBasisPoints >= 0 && offer.lotteryDrawBasisPoints < 10000,
      'offer support')
    }
    const hash = await digest(JSON.stringify(form))
    assert(hash === EXPECTED_FORM_HASHES[i], 'form bytes')
    result.set(form.formId, { form: structuredClone(form), hash })
  }
  cached = result
  return cached
}

export function formForOrdinal(forms: ReadonlyMap<string, { form: Form; hash: string }>, ordinal: number) {
  assert(Number.isSafeInteger(ordinal) && ordinal > 0, 'exposure ordinal')
  const id = `EH${(ordinal - 1) % 4 + 1}`
  const selected = forms.get(id)
  assert(selected, 'missing assigned form')
  return selected
}
