import { ARROWS_PRESENTATION_VERSION, ARROWS_EVENT_VERSION, ARROWS_INPUT_VERSION, ARROWS_SCORING_VERSION, ARROWS_SPEC_VERSION, ARROWS_TIMING_VERSION } from './contracts'
import type { Direction, Form } from './contracts'
import { isVerifiedArrowsForm, stimulusFor } from './manifests'

/** Pure, headless timing engine. The browser adapter must confirm actual DOM frames and durable arming. */
export const HEADLESS_VALIDITY = 'headless_unconfirmed' as const
export type PointerSource = 'mouse' | 'touch' | 'pen'
export type InputProfile = Readonly<{
  kind: 'keyboard'; leftCode: string; rightCode: string; alternative: boolean; accommodation: string; reducedMotion: boolean
} | {
  kind: 'pointer'; pointerSource: PointerSource; alternative: boolean; accommodation: string; reducedMotion: boolean
}>
export interface Identity { readonly installationId: string; readonly sessionId: string; readonly clockDomainId: string }
export type Phase = 'armed' | 'fixation_pending' | 'fixation' | 'stimulus' | 'offset_pending' | 'break' | 'completed' | 'invalid'
export type InvalidReason = 'hidden' | 'blur' | 'freeze' | 'page_exit' | 'viewport' | 'ownership' | 'settings' | 'timing' | 'frame_gap' | 'watchdog' | 'technical'
export type Command = Readonly<
  | { kind: 'start' | 'continue'; atMs: number; responseHeld: boolean }
  | { kind: 'fixation'; atMs: number }
  | { kind: 'onset'; atMs: number }
  | { kind: 'keydown'; atMs: number; code: string; repeat: boolean; modified: boolean }
  | { kind: 'keyup'; atMs: number; code: string }
  | { kind: 'pointerdown'; atMs: number; direction: Direction; pointerId: number; pointerType: PointerSource; button: number; isPrimary: boolean }
  | { kind: 'pointerup'; atMs: number; pointerId: number }
  | { kind: 'resolve' | 'offset'; atMs: number }
  | { kind: 'frameGap'; atMs: number; gapMs: number }
  | { kind: 'watchdog'; atMs: number }
  | { kind: 'invalidate'; atMs: number; reason: InvalidReason }
>
export type EventType = 'prepared' | 'form_assigned' | 'armed' | 'block_started' | 'fixation_confirmed' |
  'stimulus_presented' | 'response' | 'response_ignored' | 'response_extra' | 'boundary_extra' |
  'input_released' | 'omitted' | 'deadline_resolved' | 'stimulus_offset' | 'trial_closed' |
  'block_summary_ready' | 'timing_note' | 'frame_gap' | 'invalidated' | 'session_completed'
export interface Event {
  readonly schemaVersion: typeof ARROWS_EVENT_VERSION
  readonly sessionId: string
  readonly formId: Form['id']
  readonly clockDomainId: string
  readonly sequenceNumber: number
  readonly trialIndex: number
  readonly block: number
  readonly atMs: number
  readonly type: EventType
  readonly detail: Readonly<Record<string, string | number | boolean | null>>
  readonly validity: typeof HEADLESS_VALIDITY
}
export interface FirstResponse { readonly direction: Direction; readonly atMs: number; readonly source: string }
export interface State {
  readonly presentationVersion: typeof ARROWS_PRESENTATION_VERSION
  readonly specificationVersion: typeof ARROWS_SPEC_VERSION
  readonly eventVersion: typeof ARROWS_EVENT_VERSION
  readonly scoringVersion: typeof ARROWS_SCORING_VERSION
  readonly timingVersion: typeof ARROWS_TIMING_VERSION
  readonly inputVersion: typeof ARROWS_INPUT_VERSION
  readonly validity: typeof HEADLESS_VALIDITY
  readonly identity: Identity
  readonly profile: InputProfile
  readonly form: Form
  readonly armedAtMs: number
  readonly phase: Phase
  readonly trialIndex: number
  readonly startMs: number | null
  readonly fixationDueMs: number | null
  readonly fixationMs: number | null
  readonly stimulusDueMs: number | null
  readonly onsetMs: number | null
  readonly resolutionDueMs: number | null
  readonly resolutionMs: number | null
  readonly firstResponse: FirstResponse | null
  readonly timingNoted: boolean
  readonly heldCodes: readonly string[]
  readonly activePointer: number | null
  readonly invalidReason: InvalidReason | null
  readonly commands: readonly Command[]
  readonly events: readonly Event[]
}

const SAFE_CODE = /^(ArrowLeft|ArrowRight|Space|Key[A-Z]|Digit[0-9]|Numpad[0-9]|Comma|Period|Slash|Semicolon|Quote|BracketLeft|BracketRight|Backslash|Backquote|Minus|Equal)$/
const INVALID: readonly InvalidReason[] = ['hidden', 'blur', 'freeze', 'page_exit', 'viewport', 'ownership', 'settings', 'timing', 'frame_gap', 'watchdog', 'technical']
const POINTERS: readonly PointerSource[] = ['mouse', 'touch', 'pen']
function requireValid(condition: unknown, detail: string): asserts condition {
  if (!condition) throw Error(`Arrows engine: ${detail}`)
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value
}
function at(value: number) { requireValid(Number.isFinite(value) && value >= 0, 'invalid monotonic time') }
function exactKeys(value: object, expected: readonly string[]) {
  requireValid(Object.keys(value).toSorted().join('|') === [...expected].sort().join('|'), 'malformed fields')
}
function validateProfile(profile: InputProfile) {
  requireValid(profile && typeof profile === 'object' && typeof profile.alternative === 'boolean' &&
    typeof profile.accommodation === 'string' && profile.accommodation.length > 0 &&
    typeof profile.reducedMotion === 'boolean' && !Array.isArray(profile), 'invalid profile')
  if (profile.kind === 'keyboard') {
    exactKeys(profile, ['kind', 'leftCode', 'rightCode', 'alternative', 'accommodation', 'reducedMotion'])
    requireValid(typeof profile.leftCode === 'string' && typeof profile.rightCode === 'string' &&
      SAFE_CODE.test(profile.leftCode) && SAFE_CODE.test(profile.rightCode) &&
      profile.leftCode !== profile.rightCode, 'invalid key bindings')
  } else {
    requireValid(profile.kind === 'pointer', 'invalid pointer profile')
    exactKeys(profile, ['kind', 'pointerSource', 'alternative', 'accommodation', 'reducedMotion'])
    requireValid(typeof profile.pointerSource === 'string' && POINTERS.includes(profile.pointerSource), 'invalid pointer profile')
  }
}
function validateCommand(command: unknown): asserts command is Command {
  requireValid(command && typeof command === 'object' && !Array.isArray(command), 'missing command')
  const value = command as Record<string, unknown>
  const kind = value.kind
  const fields = kind === 'start' || kind === 'continue' ? ['kind', 'atMs', 'responseHeld'] :
    kind === 'keydown' ? ['kind', 'atMs', 'code', 'repeat', 'modified'] :
      kind === 'keyup' ? ['kind', 'atMs', 'code'] :
        kind === 'pointerdown' ? ['kind', 'atMs', 'direction', 'pointerId', 'pointerType', 'button', 'isPrimary'] :
          kind === 'pointerup' ? ['kind', 'atMs', 'pointerId'] :
            kind === 'frameGap' ? ['kind', 'atMs', 'gapMs'] :
              kind === 'invalidate' ? ['kind', 'atMs', 'reason'] :
                ['fixation', 'onset', 'resolve', 'offset', 'watchdog'].includes(kind as string) ? ['kind', 'atMs'] : null
  requireValid(fields !== null, 'unsupported command')
  exactKeys(command, fields)
  at(value.atMs as number)
  if (kind === 'start' || kind === 'continue') requireValid(typeof value.responseHeld === 'boolean', 'invalid held evidence')
  if (kind === 'keydown') requireValid(typeof value.code === 'string' &&
    typeof value.repeat === 'boolean' && typeof value.modified === 'boolean', 'invalid key evidence')
  if (kind === 'keyup') requireValid(typeof value.code === 'string', 'invalid release evidence')
  if (kind === 'pointerdown') requireValid((value.direction === 'left' || value.direction === 'right') &&
    Number.isSafeInteger(value.pointerId) && typeof value.pointerType === 'string' &&
    POINTERS.includes(value.pointerType as PointerSource) && Number.isInteger(value.button) &&
    typeof value.isPrimary === 'boolean', 'invalid pointer evidence')
  if (kind === 'pointerup') requireValid(Number.isSafeInteger(value.pointerId), 'invalid pointer ID')
  if (kind === 'frameGap') requireValid(typeof value.gapMs === 'number' && Number.isFinite(value.gapMs) && value.gapMs >= 0, 'invalid frame gap')
  if (kind === 'invalidate') requireValid(typeof value.reason === 'string' &&
    INVALID.includes(value.reason as InvalidReason) && value.reason !== 'watchdog', 'invalid reason')
}
function append(state: State, type: EventType, atMs: number, detail: Event['detail'] = {}): State {
  const trial = state.form.trials[state.trialIndex - 1]
  const event: Event = { schemaVersion: ARROWS_EVENT_VERSION, sessionId: state.identity.sessionId,
    formId: state.form.id, clockDomainId: state.identity.clockDomainId,
    sequenceNumber: state.events.length + 1, trialIndex: state.trialIndex, block: trial.block,
    atMs, type, detail: type === 'stimulus_presented' ? { ...detail,
      specificationVersion: ARROWS_SPEC_VERSION, presentationVersion: ARROWS_PRESENTATION_VERSION,
      formVersion: state.form.id.startsWith('AR11-') ? 'arrows_forms_v1_1' : '', scoringVersion: ARROWS_SCORING_VERSION,
      color: trial.color, condition: trial.condition, direction: trial.direction, rule: trial.rule,
      symbols: JSON.stringify(stimulusFor(state.form, state.trialIndex).symbols) } : detail, validity: HEADLESS_VALIDITY }
  return { ...state, events: [...state.events, event] }
}
function fail(state: State, atMs: number, reason: InvalidReason): State {
  return append({ ...state, phase: 'invalid', invalidReason: reason }, 'invalidated', atMs, { reason })
}
function timing(state: State, stage: string, dueMs: number, atMs: number, type: EventType): State {
  requireValid(atMs >= dueMs, `${stage} before due time`)
  const latenessMs = atMs - dueMs
  let next = append(state, type, atMs, { stage, dueMs, actualMs: atMs, latenessMs })
  if (latenessMs > 250) return fail(next, atMs, 'timing')
  if (latenessMs > 50) next = append({ ...next, timingNoted: true }, 'timing_note', atMs, { stage, latenessMs })
  return next
}
function selectedDirection(profile: InputProfile, code: string): Direction | null {
  if (profile.kind !== 'keyboard') return null
  return code === profile.leftCode ? 'left' : code === profile.rightCode ? 'right' : null
}

/** Allocates a pure state only. It does not prove an IndexedDB arm or a browser display. */
export function armHeadless(form: Form, identity: Identity, profile: InputProfile, armedAtMs: number): State {
  requireValid(isVerifiedArrowsForm(form), 'form is not verified')
  requireValid(identity && typeof identity === 'object' && !Array.isArray(identity), 'missing identity')
  exactKeys(identity, ['installationId', 'sessionId', 'clockDomainId'])
  requireValid(typeof identity.installationId === 'string' && identity.installationId.trim().length > 0 &&
    typeof identity.sessionId === 'string' && identity.sessionId.trim().length > 0 &&
    typeof identity.clockDomainId === 'string' && identity.clockDomainId.trim().length > 0, 'invalid identity')
  validateProfile(profile)
  at(armedAtMs)
  let state: State = { presentationVersion: ARROWS_PRESENTATION_VERSION, specificationVersion: ARROWS_SPEC_VERSION, eventVersion: ARROWS_EVENT_VERSION,
    scoringVersion: ARROWS_SCORING_VERSION, timingVersion: ARROWS_TIMING_VERSION,
    inputVersion: ARROWS_INPUT_VERSION, validity: HEADLESS_VALIDITY,
    identity: { ...identity }, profile: { ...profile }, form, armedAtMs, phase: 'armed', trialIndex: 1,
    startMs: null, fixationDueMs: null, fixationMs: null, stimulusDueMs: null, onsetMs: null,
    resolutionDueMs: null, resolutionMs: null, firstResponse: null, timingNoted: false,
    heldCodes: [], activePointer: null, invalidReason: null, commands: [], events: [] }
  state = append(state, 'prepared', armedAtMs)
  state = append(state, 'form_assigned', armedAtMs, { formId: form.id })
  state = append(state, 'armed', armedAtMs, { profile: JSON.stringify(profile) })
  return freeze(state)
}

/** Applies one already observed, monotonic command; no storage or timer is awaited. */
export function advance(prior: State, command: Command): State {
  requireValid(isVerifiedArrowsForm(prior.form), 'form is not verified')
  validateCommand(command)
  requireValid(command.atMs >= prior.armedAtMs && command.atMs >= (prior.commands.at(-1)?.atMs ?? prior.armedAtMs), 'regressing command time')
  requireValid(prior.phase !== 'completed' && prior.phase !== 'invalid', 'terminal state')
  // Never retain unrelated raw key codes in a command journal.
  if ((command.kind === 'keydown' || command.kind === 'keyup') && selectedDirection(prior.profile, command.code) === null) return prior
  if (command.kind === 'pointerup' && prior.profile.kind !== 'pointer') return prior
  if (command.kind === 'invalidate' && ['armed', 'break'].includes(prior.phase) &&
    ['hidden', 'blur', 'freeze', 'page_exit', 'viewport'].includes(command.reason)) return prior
  let state: State = { ...prior, commands: [...prior.commands, command] }
  const time = command.atMs
  if (state.phase === 'stimulus' && state.resolutionDueMs !== null && time - state.resolutionDueMs > 250 &&
    ['keydown', 'keyup', 'pointerdown', 'pointerup', 'frameGap'].includes(command.kind))
    return freeze(fail(state, time, 'timing'))
  switch (command.kind) {
    case 'start':
    case 'continue': {
      requireValid(state.phase === (command.kind === 'start' ? 'armed' : 'break'), 'block start out of order')
      requireValid(command.responseHeld === false && state.heldCodes.length === 0 && state.activePointer === null, 'response control held at start')
      state = append({ ...state, phase: 'fixation_pending', startMs: time, fixationDueMs: time,
        fixationMs: null, stimulusDueMs: null, onsetMs: null, resolutionDueMs: null,
        resolutionMs: null, firstResponse: null, timingNoted: false }, 'block_started', time,
      { block: state.form.trials[state.trialIndex - 1].block, profile: JSON.stringify(state.profile) })
      break
    }
    case 'fixation': {
      requireValid(state.phase === 'fixation_pending' && state.fixationDueMs !== null, 'fixation out of order')
      state = timing({ ...state, phase: 'fixation', fixationMs: time,
        stimulusDueMs: time + (state.trialIndex % 27 === 1 ? 800 : 700) }, 'fixation', state.fixationDueMs, time, 'fixation_confirmed')
      break
    }
    case 'onset': {
      requireValid(state.phase === 'fixation' && state.stimulusDueMs !== null, 'onset out of order')
      // The confirmed presentation must precede even an immediate timing invalidation.
      state = timing({ ...state, phase: 'stimulus', onsetMs: time, resolutionDueMs: time + 1500 },
        'stimulus', state.stimulusDueMs, time, 'stimulus_presented')
      break
    }
    case 'keydown': {
      requireValid(typeof command.repeat === 'boolean' && typeof command.modified === 'boolean', 'invalid key evidence')
      const direction = selectedDirection(state.profile, command.code)!
      if (command.modified || command.repeat || state.heldCodes.includes(command.code)) {
        state = append(state, 'response_ignored', time, { source: 'keyboard', reason: command.modified ? 'modified' : command.repeat ? 'repeat' : 'held' })
        break
      }
      state = { ...state, heldCodes: [...state.heldCodes, command.code] }
      state = scoreAction(state, time, direction, 'keyboard')
      break
    }
    case 'keyup': {
      const held = state.heldCodes.includes(command.code)
      state = append({ ...state, heldCodes: state.heldCodes.filter(code => code !== command.code) },
        'input_released', time, { source: 'keyboard', held })
      break
    }
    case 'pointerdown': {
      requireValid(Number.isSafeInteger(command.pointerId) && Number.isInteger(command.button) &&
        POINTERS.includes(command.pointerType) && (command.direction === 'left' || command.direction === 'right') &&
        typeof command.isPrimary === 'boolean', 'invalid pointer evidence')
      if (state.profile.kind !== 'pointer') return prior
      if (!command.isPrimary || command.button !== 0 || state.activePointer !== null) {
        state = append(state, 'response_ignored', time, { source: command.pointerType, reason: state.activePointer !== null ? 'multiple_or_held' : 'non_primary' })
        break
      }
      if (command.pointerType !== state.profile.pointerSource) {
        state = fail(state, time, 'settings')
        break
      }
      state = { ...state, activePointer: command.pointerId }
      state = scoreAction(state, time, command.direction, command.pointerType)
      break
    }
    case 'pointerup': {
      requireValid(Number.isSafeInteger(command.pointerId), 'invalid pointer ID')
      const held = state.activePointer === command.pointerId
      state = append({ ...state, activePointer: held ? null : state.activePointer },
        'input_released', time, { source: 'pointer', held })
      break
    }
    case 'resolve': {
      requireValid(state.phase === 'stimulus' && state.resolutionDueMs !== null, 'resolution out of order')
      state = timing({ ...state, phase: 'offset_pending', resolutionMs: time },
        'resolution', state.resolutionDueMs, time, 'deadline_resolved')
      if (state.phase !== 'invalid' && state.firstResponse === null) state = append(state, 'omitted', time)
      break
    }
    case 'offset': {
      requireValid(state.phase === 'offset_pending' && state.resolutionDueMs !== null && state.resolutionMs !== null &&
        time >= state.resolutionMs, 'offset out of order')
      state = timing(state, 'offset', state.resolutionDueMs, time, 'stimulus_offset')
      if (state.phase === 'invalid') break
      state = append(state, 'trial_closed', time, { timingNoted: state.timingNoted })
      if (state.trialIndex === 135) {
        state = append({ ...state, phase: 'completed' }, 'session_completed', time)
      } else if (state.trialIndex % 27 === 0) {
        state = append({ ...state, phase: 'break' }, 'block_summary_ready', time)
        state = { ...state, trialIndex: state.trialIndex + 1 }
      } else {
        state = { ...state, phase: 'fixation_pending', trialIndex: state.trialIndex + 1,
          fixationDueMs: time, fixationMs: null, stimulusDueMs: null, onsetMs: null,
          resolutionDueMs: null, resolutionMs: null, firstResponse: null, timingNoted: false }
      }
      break
    }
    case 'frameGap': {
      requireValid(Number.isFinite(command.gapMs) && command.gapMs >= 0, 'invalid frame gap')
      state = append(state, 'frame_gap', time, { gapMs: command.gapMs })
      if (['fixation_pending', 'fixation', 'stimulus', 'offset_pending'].includes(state.phase)) {
        if (command.gapMs > 250) state = fail(state, time, 'frame_gap')
        else if (command.gapMs > 50) state = append({ ...state, timingNoted: true }, 'timing_note', time, { stage: 'frame_gap', latenessMs: command.gapMs })
      }
      break
    }
    case 'watchdog': {
      const due = state.phase === 'fixation_pending' ? state.fixationDueMs :
        state.phase === 'fixation' ? state.stimulusDueMs :
          state.phase === 'offset_pending' ? state.resolutionDueMs : null
      requireValid(due !== null && time >= due + 2_000, 'watchdog before required display deadline')
      state = fail(state, time, 'watchdog')
      break
    }
    case 'invalidate': {
      requireValid(INVALID.includes(command.reason) && command.reason !== 'watchdog', 'invalid reason')
      state = fail(state, time, command.reason)
      break
    }
    default: throw Error('Arrows engine: unsupported command')
  }
  return freeze(state)
}

function scoreAction(state: State, time: number, direction: Direction, source: string): State {
  if (state.phase === 'stimulus' && state.onsetMs !== null && state.resolutionDueMs !== null && time < state.resolutionDueMs) {
    if (state.firstResponse !== null) return append(state, 'response_extra', time, { direction, source })
    return append({ ...state, firstResponse: { direction, atMs: time, source } }, 'response', time, { direction, source })
  }
  if (state.phase === 'stimulus' || state.phase === 'offset_pending') return append(state, 'boundary_extra', time, { direction, source })
  return append(state, 'response_ignored', time, { source, reason: 'outside_stimulus' })
}

/** Replays every observed command; a saved object cannot substitute a changed event or summary. */
export function verifyHeadless(state: State): boolean {
  try {
    if (!isVerifiedArrowsForm(state.form)) return false
    let replay = armHeadless(state.form, state.identity, state.profile, state.armedAtMs)
    for (const command of state.commands) replay = advance(replay, command)
    return JSON.stringify(replay) === JSON.stringify(state)
  } catch { return false }
}
