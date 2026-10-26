import raw from '../../docs/specifications/ASSESSMENT_PRACTICE_MONEY_EXCHANGE_1_FORMS_V1_0_DRAFT.json'

export const FORM_PAYLOAD_HASH = 'cf4c07b085e883bce0ddcaea98fd4a5e4571ebf968a9ad1f440d81da40461cb0'
export const EVENT_VERSION = 'money_exchange_1_event_v1_0'
export const SPEC_VERSION = 'money_exchange_1_spec_v1_0'
export const STORAGE_VERSION = 'money_exchange_1_storage_v1_0'
export type Exposure = 'not_revealed' | 'possibly_revealed' | 'captured_visible'
export type Status = 'active' | 'incomplete' | 'complete'
export interface PlayContext {
  route: 'standalone' | 'mock_game_10'; mockRunId?: string
  device: 'desktop_class' | 'touch_capable' | 'unknown'
  input: 'fine_pointer_capable' | 'coarse_pointer_capable' | 'unknown'
  reducedMotion: boolean; highContrast: boolean
}
export interface Form { id: string; returnBps: number }
export interface Amounts { sentCents: number; potCents: number; returnedCents: number; selfCents: number; partnerCents: number }
export type Event =
  | { kind: 'form_armed'; id:string; at: number }
  | { kind: 'transfer_committed'; id:string; at: number; sentCents: number }
  | { kind: 'return_presented'; id:string; at: number; returnedCents: number; selfCents: number; partnerCents: number }
  | { kind: 'fairness_committed'; id:string; at: number; rating: number }
  | { kind: 'fairness_not_applicable'; id:string; at: number }
  | { kind: 'completed'; id:string; at: number }
  | { kind: 'ended_incomplete'; id:string; at: number; reason: string }
export interface Run {
  id: string; installationId: string; documentId: string; armRequestId:string; context:PlayContext
  ordinal: number; formId: string
  formPayloadHash: string; createdAt: number; revision: number; status: Status
  exposure: Exposure; events: Event[]; report?: Report
}
export interface Report {
  version: typeof SPEC_VERSION; runId: string; formId: string; ordinal: number; context:PlayContext
  status: 'complete_valid' | 'incomplete_review'; exposure: Exposure
  sentCents: number | null; potCents: number | null; returnedCents: number | null
  selfCents: number | null; partnerCents: number | null; rating: number | null
  eventKinds: Event['kind'][]; createdAt: number
}
function assert(ok: unknown, why: string): asserts ok { if (!ok) throw Error(`Money Exchange 1: ${why}`) }
async function sha256(text: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('')
}
let cached: readonly Form[] | null = null
export async function loadForms(): Promise<readonly Form[]> {
  if (cached) return cached
  assert(raw.version === 'money_exchange_1_forms_v1_0' && raw.forms.length === 6, 'form header')
  const payload = { version: raw.version, generator: raw.generator, forms: raw.forms }
  assert(raw.payloadSha256 === FORM_PAYLOAD_HASH && await sha256(JSON.stringify(payload)) === FORM_PAYLOAD_HASH, 'form bytes')
  const forms = raw.forms as Form[]
  assert(forms.every((f, i) => f.id === `ME1-${i + 1}` && Number.isInteger(f.returnBps) && f.returnBps >= 0 && f.returnBps <= 10000), 'form support')
  cached = Object.freeze(forms.map(f => Object.freeze({ ...f })))
  return cached
}
export function formForOrdinal(forms: readonly Form[], ordinal: number): Form {
  assert(Number.isSafeInteger(ordinal) && ordinal > 0 && forms.length === 6, 'ordinal')
  return forms[(ordinal - 1) % forms.length]
}
export function parseCents(value: string): number | null {
  if (!/^(?:0|[1-9]\d{0,1})(?:\.\d{1,2})?$/.test(value.trim())) return null
  const [dollars, fraction = ''] = value.trim().split('.')
  const cents = Number(dollars) * 100 + Number(fraction.padEnd(2, '0'))
  return Number.isInteger(cents) && cents >= 0 && cents <= 1000 ? cents : null
}
export function outcome(sentCents: number, returnBps: number): Amounts {
  assert(Number.isInteger(sentCents) && sentCents >= 0 && sentCents <= 1000, 'transfer')
  assert(Number.isInteger(returnBps) && returnBps >= 0 && returnBps <= 10000, 'form rate')
  const potCents = sentCents * 3
  const returnedCents = Math.floor((potCents * returnBps + 5000) / 10000)
  return { sentCents, potCents, returnedCents,
    selfCents: 1000 - sentCents + returnedCents, partnerCents: potCents - returnedCents }
}
export function money(cents: number) { return `$${(cents / 100).toFixed(2)}` }
export function reportRun(run: Run, form: Form): Report {
  assert(run.formId === form.id && run.formPayloadHash === FORM_PAYLOAD_HASH && run.events[0]?.kind === 'form_armed', 'run form')
  const kinds = run.events.map(e => e.kind)
  const transfer = run.events.find(e => e.kind === 'transfer_committed') as Extract<Event, { kind: 'transfer_committed' }> | undefined
  const shown = run.events.find(e => e.kind === 'return_presented') as Extract<Event, { kind: 'return_presented' }> | undefined
  const rated = run.events.find(e => e.kind === 'fairness_committed') as Extract<Event, { kind: 'fairness_committed' }> | undefined
  const na = kinds.includes('fairness_not_applicable')
  const completed = kinds.at(-1) === 'completed'
  const incomplete = kinds.at(-1) === 'ended_incomplete'
  assert((run.status === 'active' && !completed && !incomplete) || (run.status === 'complete' && completed) || (run.status === 'incomplete' && incomplete), 'terminal status')
  const expectedPrefix: Event['kind'][] = ['form_armed']
  if (transfer) expectedPrefix.push('transfer_committed')
  if (shown) expectedPrefix.push('return_presented')
  if (completed) expectedPrefix.push(transfer?.sentCents === 0 ? 'fairness_not_applicable' : 'fairness_committed', 'completed')
  if (incomplete) expectedPrefix.push('ended_incomplete')
  assert(JSON.stringify(kinds) === JSON.stringify(expectedPrefix), 'event order')
  assert(new Set(run.events.map(e=>e.id)).size===run.events.length &&
    run.events.every(e=>typeof e.id==='string' && e.id.length>0 && Number.isFinite(e.at)) &&
    run.events[0].id===run.armRequestId, 'ordered event identity')
  assert(kinds.filter(k => k === 'form_armed').length === 1 && kinds.filter(k => k === 'transfer_committed').length <= 1 && kinds.filter(k => k === 'return_presented').length <= 1, 'duplicate event')
  assert(!shown || !!transfer && run.exposure === 'captured_visible', 'return evidence')
  if (transfer && shown) {
    const amount = outcome(transfer.sentCents, form.returnBps)
    assert(shown.returnedCents === amount.returnedCents && shown.selfCents === amount.selfCents && shown.partnerCents === amount.partnerCents, 'result arithmetic')
  }
  if (completed) assert(transfer && shown && ((transfer.sentCents > 0 && rated && !na && Number.isInteger(rated.rating) && rated.rating >= 0 && rated.rating <= 10) || (transfer.sentCents === 0 && na && !rated)), 'complete journal')
  else assert(!rated && !na, 'unconfirmed rating')
  const amount = transfer ? outcome(transfer.sentCents, form.returnBps) : null
  return { version: SPEC_VERSION, runId: run.id, formId: form.id, ordinal: run.ordinal, context:run.context,
    status: completed ? 'complete_valid' : 'incomplete_review', exposure: run.exposure,
    sentCents: transfer?.sentCents ?? null, potCents: transfer ? amount!.potCents : null,
    returnedCents: shown?.returnedCents ?? null, selfCents: shown?.selfCents ?? null,
    partnerCents: shown?.partnerCents ?? null, rating: rated?.rating ?? null,
    eventKinds: kinds, createdAt: run.createdAt }
}
