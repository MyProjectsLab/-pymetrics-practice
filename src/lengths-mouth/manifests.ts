import packet from '../../docs/specifications/ASSESSMENT_PRACTICE_LENGTHS_MOUTH_FORMS_V1_1.json'
import { MOUTH_FORM_VERSION } from './contracts'
import type { Form, FormId } from './contracts'
export const MOUTH_CANONICAL_SHA256 = 'ae92d69cffeb20cac02d3be5648ee8e162e575583c55b03dfe3cd2301c0846e9'
const trusted = new WeakSet<Form>()
let cached: Promise<ReadonlyMap<FormId, Form>> | null = null
export function isVerifiedMouthForm(form: Form) { return trusted.has(form) }
export function loadMouthForms(raw: unknown = packet): Promise<ReadonlyMap<FormId, Form>> {
  if (raw === packet && cached) return cached
  const result = (async () => {
    const data = structuredClone(raw) as typeof packet
    if (!data || data.version !== MOUTH_FORM_VERSION || data.baseSeed !== 0x1e470101 || data.sha256 !== MOUTH_CANONICAL_SHA256) throw Error('Mouth manifest unsupported')
    const payload = JSON.stringify({ version: data.version, baseSeed: data.baseSeed, forms: data.forms })
    const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload)))].map(v => v.toString(16).padStart(2,'0')).join('')
    if (digest !== MOUTH_CANONICAL_SHA256 || data.forms.length !== 6) throw Error('Mouth manifest altered')
    const forms = new Map<FormId, Form>()
    for (const rawForm of data.forms) {
      const form: Form = Object.freeze({ id: rawForm.formId as FormId, seed: rawForm.seed, richSide: rawForm.richSide as Form['richSide'], trials: Object.freeze(rawForm.trials.map(t => Object.freeze({ index: t.trial, block: t.block, mouth: t.mouth as Form['richSide'], rewardEligible: t.rewardEligible }))) })
      trusted.add(form); forms.set(form.id, form)
    }
    return forms
  })()
  if (raw === packet) cached = result
  return result
}
