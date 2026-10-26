import { createEventRecorder } from '../core/events'
import type { StopEventPayloads } from './contracts'
import { STOP_EVENT_SCHEMA_VERSION } from './versions'
import { STOP_SPECIFICATION_VERSION, STOP_V13_SPECIFICATION_VERSION } from './versions'

export type PreparationEventPayloads = Pick<StopEventPayloads,
  'guide_opened' | 'example_presented' | 'example_resolved' |
  'comprehension_answered' | 'device_check_completed' | 'readiness_confirmed' | 'shortcut_chosen'>
  & Pick<StopEventPayloads, 'onboarding_v13_opened' | 'onboarding_v13_answered' | 'onboarding_v13_skip_verified' | 'input_check_v13'>

export const STOP_EXPERIENCE_VERSION = '1.2' as const
export const STOP_NEW_EXPERIENCE_VERSION = 'stop_experience_v1_3' as const
export const STOP_RULE_VERSION = 'stop_rule_v1' as const
export interface UnderstandingEvidence {
  readonly schemaVersion: 'stop_understanding_evidence_v1'
  readonly experienceVersion: typeof STOP_EXPERIENCE_VERSION
  readonly specificationVersion: typeof STOP_SPECIFICATION_VERSION | typeof STOP_V13_SPECIFICATION_VERSION
  readonly ruleVersion: typeof STOP_RULE_VERSION
  readonly sourceSessionId: string
  readonly events: readonly ReturnType<PreparationRecorder['snapshot']>[number][]
  readonly checksum: string
}
export interface NewUnderstandingEvidence {
  readonly schemaVersion: 'stop_understanding_evidence_v2'
  readonly experienceVersion: typeof STOP_NEW_EXPERIENCE_VERSION
  readonly specificationVersion: '1.3'
  readonly ruleVersion: typeof STOP_RULE_VERSION
  readonly sourceSessionId: string
  readonly events: readonly ReturnType<PreparationRecorder['snapshot']>[number][]
  readonly checksum: string
}

async function digest(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value))
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

export async function createUnderstandingEvidence(recorder: PreparationRecorder, specificationVersion: UnderstandingEvidence['specificationVersion'] = STOP_SPECIFICATION_VERSION): Promise<UnderstandingEvidence> {
  const events = recorder.snapshot()
  const base = { schemaVersion: 'stop_understanding_evidence_v1' as const,
    experienceVersion: STOP_EXPERIENCE_VERSION, specificationVersion,
    ruleVersion: STOP_RULE_VERSION,
    sourceSessionId: recorder.sessionId, events }
  return { ...base, checksum: await digest(base) }
}

export async function createNewUnderstandingEvidence(recorder: PreparationRecorder): Promise<NewUnderstandingEvidence> {
  const events = recorder.snapshot()
  const base = { schemaVersion: 'stop_understanding_evidence_v2' as const, experienceVersion: STOP_NEW_EXPERIENCE_VERSION,
    specificationVersion: '1.3' as const, ruleVersion: STOP_RULE_VERSION, sourceSessionId: recorder.sessionId, events }
  return { ...base, checksum: await digest(base) }
}

export async function verifyUnderstandingEvidence(value: unknown): Promise<boolean> {
  try {
    if ((value as NewUnderstandingEvidence)?.schemaVersion === 'stop_understanding_evidence_v2') {
      const evidence = value as NewUnderstandingEvidence
      if (evidence.experienceVersion !== STOP_NEW_EXPERIENCE_VERSION || evidence.specificationVersion !== '1.3' ||
        evidence.ruleVersion !== STOP_RULE_VERSION || typeof evidence.sourceSessionId !== 'string' ||
        !Array.isArray(evidence.events) || typeof evidence.checksum !== 'string') return false
      if (await digest({ schemaVersion: evidence.schemaVersion, experienceVersion: evidence.experienceVersion,
        specificationVersion: evidence.specificationVersion, ruleVersion: evidence.ruleVersion,
        sourceSessionId: evidence.sourceSessionId, events: evidence.events }) !== evidence.checksum) return false
      const events = evidence.events
      if (!events.length || events.some((event, index) => event.sessionId !== evidence.sourceSessionId ||
        event.schemaVersion !== STOP_EVENT_SCHEMA_VERSION || event.sequenceNumber !== index + 1 ||
        !Number.isFinite(event.timestampMs) || event.timestampMs < 0 ||
        index > 0 && event.timestampMs < events[index - 1].timestampMs)) return false
      return currentNewPreparationBranch(events) !== null
    }
    const evidence = value as UnderstandingEvidence
    if (!evidence || evidence.schemaVersion !== 'stop_understanding_evidence_v1' ||
      evidence.experienceVersion !== STOP_EXPERIENCE_VERSION ||
      ![STOP_SPECIFICATION_VERSION, STOP_V13_SPECIFICATION_VERSION].includes(evidence.specificationVersion) ||
      evidence.ruleVersion !== STOP_RULE_VERSION ||
      typeof evidence.sourceSessionId !== 'string' || !Array.isArray(evidence.events) ||
      typeof evidence.checksum !== 'string') return false
    if (await digest({ schemaVersion: evidence.schemaVersion, experienceVersion: evidence.experienceVersion,
      specificationVersion: evidence.specificationVersion,
      ruleVersion: evidence.ruleVersion, sourceSessionId: evidence.sourceSessionId, events: evidence.events }) !== evidence.checksum) return false
    const events = evidence.events
    if (!events.length || events[0].type !== 'guide_opened' || events.some((event, index) =>
      event.sessionId !== evidence.sourceSessionId || event.schemaVersion !== STOP_EVENT_SCHEMA_VERSION ||
      event.sequenceNumber !== index + 1 || !Number.isFinite(event.timestampMs) || event.timestampMs < 0 ||
      index > 0 && event.timestampMs < events[index - 1].timestampMs)) return false
    const answers = events.filter(event => event.type === 'comprehension_answered')
    if (answers.length < 3) return false
    const latestAttempt = Math.max(...answers.map(event => event.payload.attempt))
    const pass = answers.filter(event => event.payload.attempt === latestAttempt)
    return pass.length === 3 && new Set(pass.map(event => event.payload.itemId)).size === 3 &&
      questions.every(question => pass.some(event => event.payload.itemId === question.id &&
        event.payload.answerId === question.answer && event.payload.correct === true))
  } catch { return false }
}

export function createPreparationRecorder(sessionId: string = crypto.randomUUID()) {
  return createEventRecorder<PreparationEventPayloads, typeof STOP_EVENT_SCHEMA_VERSION>({
    sessionId,
    schemaVersion: STOP_EVENT_SCHEMA_VERSION,
    clock: () => performance.now(),
  })
}

export type PreparationRecorder = ReturnType<typeof createPreparationRecorder>

export type NewPreparationBranch =
  | Readonly<{ kind: 'answer'; sequenceNumber: number }>
  | Readonly<{ kind: 'skip'; sequenceNumber: number; source: StopEventPayloads['onboarding_v13_skip_verified'] }>

/** The latest observed answer or verified skip is the current preparation route. */
export function currentNewPreparationBranch(events: readonly Readonly<{ type: string; sequenceNumber: number; payload: unknown }>[]): NewPreparationBranch | null {
  const opened = events.filter(event => event.type === 'onboarding_v13_opened')
  if (opened.length !== 1) return null
  const opening = opened[0].payload as StopEventPayloads['onboarding_v13_opened']
  if (opening?.ruleVersion !== STOP_RULE_VERSION || !['standard', 'shape_accommodation_v1'].includes(opening.visualProfile)) return null
  let answers = 0
  let current: NewPreparationBranch | null = null
  for (const event of events) {
    if (event.type === 'onboarding_v13_answered') {
      const answer = event.payload as StopEventPayloads['onboarding_v13_answered']
      if (event.sequenceNumber <= opened[0].sequenceNumber || answer?.questionId !== 'go' ||
        !['press', 'wait', 'repeat'].includes(answer.answerId) || answer.correct !== (answer.answerId === 'press') ||
        answer.attempt !== ++answers) return null
      current = answer.correct ? { kind: 'answer', sequenceNumber: event.sequenceNumber } : null
    } else if (event.type === 'onboarding_v13_skip_verified') {
      const source = event.payload as StopEventPayloads['onboarding_v13_skip_verified']
      if (event.sequenceNumber <= opened[0].sequenceNumber || source?.sourceReadOutcome !== 'verified_complete' ||
        source.specificationVersion !== '1.3' || source.ruleVersion !== STOP_RULE_VERSION ||
        !['standard', 'shape_accommodation_v1'].includes(source.visualProfile) ||
        [source.installationId, source.sourceSessionId, source.formId, source.formChecksum, source.scoringVersion].some(value =>
          typeof value !== 'string' || !value.length)) return null
      current = { kind: 'skip', sequenceNumber: event.sequenceNumber, source }
    }
  }
  return current
}

export const exampleOrder = ['GO', 'NO_GO', 'GO', 'NO_GO'] as const

export const questions = [
  { id: 'go', prompt: 'What should you do when GO appears?', answer: 'press', choices: [
    { id: 'press', label: 'Press Space once.' }, { id: 'withhold', label: 'Do nothing.' },
    { id: 'repeat', label: 'Press Space repeatedly.' },
  ] },
  { id: 'no-go', prompt: 'What should you do when NO-GO appears?', answer: 'withhold', choices: [
    { id: 'withhold', label: 'Do nothing.' }, { id: 'press', label: 'Press Space once.' },
    { id: 'after', label: 'Wait for it to disappear, then press.' },
  ] },
  { id: 'window', prompt: 'Can you respond after the symbol disappears?', answer: 'window', choices: [
    { id: 'window', label: 'Yes, until the response window closes.' },
    { id: 'visible', label: 'No, the symbol must still be visible.' },
    { id: 'warmup', label: 'Only during the warm-up.' },
  ] },
] as const

export function questionsForKey(label: string) {
  return questions.map(question => ({ ...question, choices: question.choices.map(choice => ({ ...choice,
    label: choice.id === 'press' || choice.id === 'repeat' ? choice.label.replaceAll('Space', label) : choice.label })) }))
}

/** Fisher–Yates; inject randomness for deterministic fixtures. */
export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const shuffled = [...items]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1))
    ;[shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]]
  }
  return shuffled
}

export interface ResponseBinding { readonly code: string; readonly label: string }
export const spaceBinding: ResponseBinding = { code: 'Space', label: 'Space' }

/** Printable single keys only; no function/navigation/modifier keys or chords. */
export function bindingFromKey(event: Pick<KeyboardEvent,
  'key' | 'code' | 'ctrlKey' | 'altKey' | 'metaKey' | 'shiftKey' | 'repeat' | 'isComposing'>,
): ResponseBinding | null {
  if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey || event.repeat || event.isComposing) return null
  if (event.code === 'Space' && event.key === ' ') return spaceBinding
  if (!/^(Key[A-Z]|Digit[0-9]|Numpad[0-9]|Comma|Period|Slash|Semicolon|Quote|BracketLeft|BracketRight|Backslash|Backquote|Minus|Equal)$/.test(event.code)) return null
  if (event.key.length !== 1) return null
  return { code: event.code, label: event.key.toUpperCase() }
}

export function isPlainResponse(event: KeyboardEvent, binding: ResponseBinding) {
  return event.code === binding.code && !event.repeat && !event.isComposing &&
    !event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey
}
