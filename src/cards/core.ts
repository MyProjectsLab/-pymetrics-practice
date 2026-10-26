import rawManifest from '../../docs/specifications/ASSESSMENT_PRACTICE_CARDS_FORMS_V1_1.json'

export type Deck = 'A' | 'B' | 'C' | 'D'
export const DECKS: readonly Deck[] = ['A', 'B', 'C', 'D']
export const DRAW_LIMIT = 80
export const START_BALANCE = 2000
export const RULE_VERSION = 'cards-rules/1.1.0'
export const EVENT_VERSION = 'cards-events/1.1.0'
export const SCORE_VERSION = 'cards-score/1.1.0'
export interface Form { id: string; seed: number; visibleOrder: string; decks: Record<Deck, number[]>; formSha256: string }
export interface EventEnvelope {
  seq: number; revision: number; version: typeof EVENT_VERSION; ruleVersion: typeof RULE_VERSION
  installationId: string; runId: string; formSha256: string
}
export type CardEvent = EventEnvelope & (
  | { type: 'run_started'; formId: string; balance: number }
  | { type: 'draw_ready'; seq: number; turn: number; atMs: number }
  | { type: 'choice_committed'; seq: number; turn: number; deck: Deck; deckDraw: number; value: number; priorBalance: number; balance: number; commandId: string; source: string; atMs: number; latencyMs: number }
  | { type: 'feedback_shown'; seq: number; turn: number; commandId: string; atMs: number }
  | { type: 'lifecycle_changed'; seq: number; reason: string; atMs: number }
  | { type: 'run_interrupted' | 'run_exited' | 'run_invalid'; seq: number; reason: string }
  | { type: 'run_completed'; seq: number; balance: number })
export interface Run {
  id: string; documentId: string; installationId: string; ordinal: number; createdAtWallMs: number;
  formId: string; formSha256: string
  epoch: number; revision: number; status: 'active' | 'interrupted' | 'exited' | 'invalid' | 'complete'
  events: CardEvent[]; requests: Record<string, string>; snapshot?: { events: CardEvent[]; report: Report; revision: number }
}
export interface Draw { turn: number; deck: Deck; deckDraw: number; value: number; balance: number; commandId: string; feedbackSeen: boolean }
export interface Report {
  status: 'complete_valid' | 'incomplete_review'
  formId: string; ordinal: number; committedDrawCount: number; feedbackSeenCount: number
  startingBalance: number; endingBalance: number; gains: number; losses: number; switches: number
  byDeck: Record<Deck, { count: number; gains: number; losses: number }>; trace: Draw[]
}
const manifest = rawManifest as { schemaVersion: string; startingBalance: number; drawCount: number; forms: Form[] }
const generated = new Map<string, Form>()

function assert(ok: unknown, message: string): asserts ok { if (!ok) throw Error(`Cards integrity: ${message}`) }
function equal(a: unknown, b: unknown) { return JSON.stringify(a) === JSON.stringify(b) }
function digestHex(data: string) {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(data)).then(buffer =>
    Array.from(new Uint8Array(buffer), n => n.toString(16).padStart(2, '0')).join(''))
}
export async function loadCardsForms(): Promise<ReadonlyMap<string, Form>> {
  if (generated.size) return generated
  assert(manifest.schemaVersion === 'cards-forms/1.1.0' && manifest.startingBalance === START_BALANCE &&
    manifest.drawCount === DRAW_LIMIT && manifest.forms.length === 6, 'manifest header')
  for (const [index, form] of manifest.forms.entries()) {
    assert(form.id === `CD${index + 1}` && /^([A-D]){4}$/.test(form.visibleOrder) &&
      new Set(form.visibleOrder).size === 4 && Number.isSafeInteger(form.seed), 'form identity')
    for (const deck of DECKS) {
      assert(Array.isArray(form.decks[deck]) && form.decks[deck].length === 80 &&
        form.decks[deck].every(Number.isSafeInteger), 'deck length/value')
    }
    const body = { id: form.id, seed: form.seed, visibleOrder: form.visibleOrder, decks: form.decks }
    assert(await digestHex(JSON.stringify(body, null, 2) + '\n') === form.formSha256, 'form digest')
    generated.set(form.id, structuredClone(form))
  }
  return generated
}
export function formForOrdinal(forms: ReadonlyMap<string, Form>, ordinal: number): Form {
  assert(Number.isSafeInteger(ordinal) && ordinal > 0, 'exposure ordinal')
  const form = forms.get(`CD${(ordinal - 1) % 6 + 1}`)
  assert(form, 'form unavailable')
  return form
}
export function reportRun(run: Run, form: Form): Report {
  assert(run && run.formId === form.id && run.formSha256 === form.formSha256 && run.events.length >= 1 &&
    run.events[0].type === 'run_started' && run.events[0].formId === form.id &&
    run.events[0].balance === START_BALANCE, 'start')
  const trace: Draw[] = []
  const perDeck: Record<Deck, { count: number; gains: number; losses: number }> = {
    A: { count: 0, gains: 0, losses: 0 }, B: { count: 0, gains: 0, losses: 0 },
    C: { count: 0, gains: 0, losses: 0 }, D: { count: 0, gains: 0, losses: 0 },
  }
  let stage: 'ready' | 'choice' | 'feedback' | 'terminal' = 'ready'
  let balance = START_BALANCE, readyAt = -1, lastAt = -1, feedbackSeenCount = 0
  let terminal: CardEvent | undefined, priorRevision = 0
  const commands = new Set<string>()
  for (let i = 0; i < run.events.length; i++) {
    const event = run.events[i]
    assert(event.seq === i + 1 && event.revision > priorRevision && event.revision <= run.revision &&
      event.version === EVENT_VERSION && event.ruleVersion === RULE_VERSION &&
      event.installationId === run.installationId && event.runId === run.id &&
      event.formSha256 === form.formSha256 && !terminal, 'event envelope/order')
    priorRevision = event.revision
    if (i === 0) continue
    if (event.type === 'draw_ready') {
      assert(stage === 'ready' && event.turn === trace.length + 1 && event.turn <= DRAW_LIMIT &&
        Number.isFinite(event.atMs) && event.atMs >= 0 && event.atMs >= lastAt, 'draw readiness')
      readyAt = lastAt = event.atMs; stage = 'choice'
    } else if (event.type === 'choice_committed') {
      assert(stage === 'choice' && DECKS.includes(event.deck) && event.turn === trace.length + 1 &&
        event.deckDraw === perDeck[event.deck].count + 1 && event.commandId.length > 0 &&
        !commands.has(event.commandId) && ['keyboard', 'pointer', 'touch', 'assistive_or_unknown'].includes(event.source) &&
        Number.isFinite(event.atMs) && event.atMs >= 0 && event.atMs >= readyAt && event.atMs >= lastAt &&
        Number.isFinite(event.latencyMs) && event.latencyMs === event.atMs - readyAt, 'choice order')
      const value = form.decks[event.deck][event.deckDraw - 1]
      assert(event.value === value && event.priorBalance === balance && event.balance === balance + value, 'outcome/balance')
      balance = event.balance; lastAt = event.atMs; stage = 'feedback'
      commands.add(event.commandId)
      perDeck[event.deck].count++
      perDeck[event.deck].gains += Math.max(value, 0)
      perDeck[event.deck].losses += Math.max(-value, 0)
      trace.push({ turn: event.turn, deck: event.deck, deckDraw: event.deckDraw,
        value, balance, commandId: event.commandId, feedbackSeen: false })
    } else if (event.type === 'feedback_shown') {
      const draw = trace.at(-1)
      assert(stage === 'feedback' && draw && !draw.feedbackSeen && event.turn === draw.turn &&
        event.commandId === draw.commandId && Number.isFinite(event.atMs) && event.atMs >= 0 && event.atMs >= lastAt,
        'feedback order')
      draw.feedbackSeen = true; feedbackSeenCount++; lastAt = event.atMs
      stage = trace.length === DRAW_LIMIT ? 'terminal' : 'ready'
    } else if (event.type === 'lifecycle_changed') {
      assert(typeof event.reason === 'string' && event.reason.length > 0 &&
        Number.isFinite(event.atMs) && event.atMs >= 0 && event.atMs >= lastAt &&
        i === run.events.length - 2 &&
        ['run_interrupted', 'run_exited', 'run_invalid'].includes(run.events[i + 1].type), 'lifecycle order')
      lastAt = event.atMs
    } else if (event.type === 'run_completed') {
      assert(stage === 'terminal' && trace.length === DRAW_LIMIT && feedbackSeenCount === DRAW_LIMIT &&
        event.balance === balance && run.status === 'complete', 'completion')
      terminal = event
    } else if (event.type === 'run_interrupted' || event.type === 'run_exited' || event.type === 'run_invalid') {
      const lifecycle = run.events[i - 1]
      assert(run.status === event.type.slice(4) && typeof event.reason === 'string' &&
        event.reason.length > 0 && lifecycle?.type === 'lifecycle_changed' &&
        lifecycle.reason === event.reason && !terminal, 'closure')
      terminal = event
    } else throw Error('Cards integrity: unknown event')
  }
  assert(priorRevision === run.revision, 'latest event revision')
  assert(run.status === 'active' ? !terminal : !!terminal, 'run state')
  const gains = DECKS.reduce((sum, deck) => sum + perDeck[deck].gains, 0)
  const losses = DECKS.reduce((sum, deck) => sum + perDeck[deck].losses, 0)
  assert(balance === START_BALANCE + gains - losses, 'conservation')
  const result: Report = {
    status: run.status === 'complete' ? 'complete_valid' : 'incomplete_review', formId: form.id,
    ordinal: run.ordinal, committedDrawCount: trace.length, feedbackSeenCount, startingBalance: START_BALANCE,
    endingBalance: balance, gains, losses, switches: trace.slice(1).filter((draw, i) => draw.deck !== trace[i].deck).length,
    byDeck: perDeck, trace,
  }
  if (run.status === 'complete') {
    assert(run.snapshot && equal(run.snapshot.events, run.events) && equal(run.snapshot.report, result) &&
      run.snapshot.revision === run.revision, 'terminal snapshot')
  } else assert(!run.snapshot, 'nonterminal snapshot')
  return result
}
