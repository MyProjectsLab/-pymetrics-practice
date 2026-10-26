import { LENGTHS_EVENT_VERSION, LENGTHS_INPUT_VERSION, LENGTHS_SCORING_VERSION,
  LENGTHS_SPEC_VERSION, LENGTHS_TIMING_VERSION } from './contracts'
import type { Form, Side, Variant } from './contracts'
import { isVerifiedLengthsForm } from './manifests'
import { validLengthsDisplayContext } from './display-context'
import type { LengthsDisplayContext } from './display-context'

/** Pure ordered evidence. A browser adapter must supply actual frame/input observations. */
export const HEADLESS_VALIDITY = 'headless_unconfirmed' as const
export type PointerSource = 'mouse' | 'touch' | 'pen'
export type Route = 'standalone' | Readonly<{
  kind: 'mock'; mockRunId: string; mockVersion: string; gameIndex: 7
}>
export type InputProfile = Readonly<{
  kind: 'keyboard'; variant: Variant; deviceClass: string; leftCode: string; rightCode: string
  alternative: boolean; contrast: 'dark_on_light' | 'light_on_dark'
  magnification: 'none' | 'browser_zoom'; reducedMotion: boolean
} | {
  kind: 'pointer'; variant: Variant; deviceClass: string; pointerSource: PointerSource
  alternative: boolean; contrast: 'dark_on_light' | 'light_on_dark'
  magnification: 'none' | 'browser_zoom'; reducedMotion: boolean
}>
export interface Identity {
  readonly installationId: string
  readonly sessionId: string
  readonly clockDomainId: string
  readonly route: Route
}
export type Phase = 'armed' | 'fixation_pending' | 'fixation' | 'stimulus' |
  'offset_pending' | 'break' | 'completed' | 'invalid'
export type InvalidReason = 'hidden' | 'blur' | 'freeze' | 'page_exit' | 'viewport' |
  'ownership' | 'settings' | 'timing' | 'frame_gap' | 'watchdog' | 'technical'
export type Command = Readonly<
  | { kind: 'start' | 'continue'; atMs: number; responseHeld: boolean;
      displayContext?: LengthsDisplayContext }
  | { kind: 'fixation' | 'onset' | 'resolve' | 'offset' | 'watchdog'; atMs: number }
  | { kind: 'keydown'; atMs: number; code: string; repeat: boolean; modified: boolean; composing: boolean }
  | { kind: 'keyup'; atMs: number; code: string }
  | { kind: 'pointerdown'; atMs: number; side: Side; pointerId: number;
      pointerType: PointerSource; button: number; isPrimary: boolean }
  | { kind: 'pointerup'; atMs: number; pointerId: number }
  | { kind: 'frameGap'; atMs: number; gapMs: number }
  | { kind: 'invalidate'; atMs: number; reason: InvalidReason }
>
export type EventType = 'prepared' | 'form_assigned' | 'armed' | 'block_started' |
  'block_continued' | 'fixation_confirmed' | 'stimulus_presented' | 'response' |
  'response_ignored' | 'response_extra' | 'boundary_extra' | 'input_released' |
  'omission' | 'deadline_resolved' | 'stimulus_offset' | 'trial_closed' |
  'block_summary' | 'timing_note' | 'frame_gap' | 'invalidated' | 'session_completed'
export interface Event {
  readonly schemaVersion: typeof LENGTHS_EVENT_VERSION
  readonly installationId: string
  readonly sessionId: string
  readonly formId: Form['id']
  readonly variant: Variant
  readonly clockDomainId: string
  readonly sequenceNumber: number
  readonly trialIndex: number
  readonly block: number
  readonly atMs: number
  readonly type: EventType
  readonly detail: Readonly<Record<string, string | number | boolean | null>>
  readonly validity: typeof HEADLESS_VALIDITY
}
export interface FirstResponse {
  readonly side: Side
  readonly atMs: number
  readonly source: string
}
export interface State {
  readonly specificationVersion: typeof LENGTHS_SPEC_VERSION
  readonly eventVersion: typeof LENGTHS_EVENT_VERSION
  readonly scoringVersion: typeof LENGTHS_SCORING_VERSION
  readonly timingVersion: typeof LENGTHS_TIMING_VERSION
  readonly inputVersion: typeof LENGTHS_INPUT_VERSION
  readonly validity: typeof HEADLESS_VALIDITY
  readonly form: Form
  readonly identity: Identity
  readonly profile: InputProfile
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
const POINTERS: readonly PointerSource[] = ['mouse', 'touch', 'pen']
const INVALID: readonly InvalidReason[] = ['hidden', 'blur', 'freeze', 'page_exit', 'viewport',
  'ownership', 'settings', 'timing', 'frame_gap', 'watchdog', 'technical']
function assert(condition: unknown, reason: string): asserts condition {
  if (!condition) throw Error(`Lengths engine: ${reason}`)
}
function keys(value: object, expected: readonly string[]) {
  assert(Object.keys(value).toSorted().join('|') === [...expected].sort().join('|'), 'malformed fields')
}
function at(value: unknown) { assert(typeof value === 'number' && Number.isFinite(value) && value >= 0, 'invalid monotonic time') }
function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value
}
function exactDeep(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object' ||
    Array.isArray(left) !== Array.isArray(right) ||
    Object.getPrototypeOf(left) !== Object.getPrototypeOf(right) ||
    Array.isArray(left) && left.length !== (right as unknown[]).length) return false
  const a = left as Record<string, unknown>, b = right as Record<string, unknown>
  const aKeys = Object.keys(a), bKeys = Object.keys(b)
  return aKeys.length === bKeys.length && aKeys.every(key =>
    Object.hasOwn(b, key) && exactDeep(a[key], b[key]))
}
function profileValid(profile: InputProfile) {
  assert(profile && typeof profile === 'object' && !Array.isArray(profile) &&
    (profile.variant === 'standard' || profile.variant === 'visual_accommodation') &&
    typeof profile.deviceClass === 'string' && profile.deviceClass.trim().length > 0 &&
    typeof profile.alternative === 'boolean' && typeof profile.reducedMotion === 'boolean' &&
    (profile.contrast === 'dark_on_light' || profile.contrast === 'light_on_dark') &&
    (profile.magnification === 'none' || profile.magnification === 'browser_zoom'), 'invalid profile')
  const common = ['kind', 'variant', 'deviceClass', 'alternative', 'contrast', 'magnification', 'reducedMotion']
  if (profile.kind === 'keyboard') {
    keys(profile, [...common, 'leftCode', 'rightCode'])
    assert(typeof profile.leftCode === 'string' && typeof profile.rightCode === 'string' &&
      SAFE_CODE.test(profile.leftCode) && SAFE_CODE.test(profile.rightCode) &&
      profile.leftCode !== profile.rightCode, 'invalid key bindings')
  } else {
    assert(profile.kind === 'pointer', 'invalid profile kind')
    keys(profile, [...common, 'pointerSource'])
    assert(typeof profile.pointerSource === 'string' &&
      POINTERS.includes(profile.pointerSource), 'invalid pointer source')
  }
}
function identityValid(identity: Identity) {
  assert(identity && typeof identity === 'object' && !Array.isArray(identity), 'invalid identity')
  keys(identity, ['installationId', 'sessionId', 'clockDomainId', 'route'])
  assert([identity.installationId, identity.sessionId, identity.clockDomainId]
    .every(value => typeof value === 'string' && value.trim().length > 0), 'invalid identity fields')
  if (identity.route !== 'standalone') {
    assert(identity.route && typeof identity.route === 'object' && !Array.isArray(identity.route), 'invalid route')
    keys(identity.route, ['kind', 'mockRunId', 'mockVersion', 'gameIndex'])
    assert(identity.route.kind === 'mock' && identity.route.gameIndex === 7 &&
      typeof identity.route.mockRunId === 'string' && identity.route.mockRunId.trim().length > 0 &&
      typeof identity.route.mockVersion === 'string' && identity.route.mockVersion.trim().length > 0,
    'invalid mock route')
  }
}
function commandValid(command: unknown): asserts command is Command {
  assert(command && typeof command === 'object' && !Array.isArray(command), 'invalid command')
  const value = command as Record<string, unknown>
  const kind = value.kind
  const fields = kind === 'start' || kind === 'continue' ?
    ['kind', 'atMs', 'responseHeld', ...(value.displayContext === undefined ? [] : ['displayContext'])] :
    kind === 'keydown' ? ['kind', 'atMs', 'code', 'repeat', 'modified', 'composing'] :
      kind === 'keyup' ? ['kind', 'atMs', 'code'] :
        kind === 'pointerdown' ? ['kind', 'atMs', 'side', 'pointerId', 'pointerType', 'button', 'isPrimary'] :
          kind === 'pointerup' ? ['kind', 'atMs', 'pointerId'] :
            kind === 'frameGap' ? ['kind', 'atMs', 'gapMs'] :
              kind === 'invalidate' ? ['kind', 'atMs', 'reason'] :
                ['fixation', 'onset', 'resolve', 'offset', 'watchdog'].includes(kind as string) ?
                  ['kind', 'atMs'] : null
  assert(fields !== null, 'unsupported command')
  keys(command, fields)
  at(value.atMs)
  if (kind === 'start' || kind === 'continue') assert(typeof value.responseHeld === 'boolean' &&
    (value.displayContext === undefined || validLengthsDisplayContext(value.displayContext)), 'start context evidence')
  if (kind === 'keydown') assert(typeof value.code === 'string' &&
    typeof value.repeat === 'boolean' && typeof value.modified === 'boolean' &&
    typeof value.composing === 'boolean', 'key evidence')
  if (kind === 'keyup') assert(typeof value.code === 'string', 'release evidence')
  if (kind === 'pointerdown') assert((value.side === 'left' || value.side === 'right') &&
    Number.isSafeInteger(value.pointerId) && POINTERS.includes(value.pointerType as PointerSource) &&
    Number.isInteger(value.button) && typeof value.isPrimary === 'boolean', 'pointer evidence')
  if (kind === 'pointerup') assert(Number.isSafeInteger(value.pointerId), 'pointer release')
  if (kind === 'frameGap') assert(typeof value.gapMs === 'number' &&
    Number.isFinite(value.gapMs) && value.gapMs >= 0, 'frame gap')
  if (kind === 'invalidate') assert(typeof value.reason === 'string' &&
    INVALID.includes(value.reason as InvalidReason) && value.reason !== 'watchdog', 'invalid reason')
}
function append(state: State, type: EventType, atMs: number, detail: Event['detail'] = {}): State {
  const trial = state.form.trials[state.trialIndex - 1]
  const event: Event = { schemaVersion: LENGTHS_EVENT_VERSION,
    installationId: state.identity.installationId, sessionId: state.identity.sessionId,
    formId: state.form.id, variant: state.form.variant, clockDomainId: state.identity.clockDomainId,
    sequenceNumber: state.events.length + 1, trialIndex: state.trialIndex,
    block: trial.block, atMs, type, detail, validity: HEADLESS_VALIDITY }
  return { ...state, events: [...state.events, event] }
}
function invalidate(state: State, atMs: number, reason: InvalidReason): State {
  return append({ ...state, phase: 'invalid', invalidReason: reason }, 'invalidated', atMs, { reason })
}
function stage(state: State, name: string, dueMs: number, atMs: number, type: EventType): State {
  assert(atMs >= dueMs, `${name} before due time`)
  const latenessMs = atMs - dueMs
  let next = append(state, type, atMs, { stage: name, dueMs, actualMs: atMs, latenessMs })
  if (latenessMs > 250) return invalidate(next, atMs, 'timing')
  if (latenessMs > 50) next = append({ ...next, timingNoted: true }, 'timing_note', atMs, { stage: name, latenessMs })
  return next
}
function sideFor(profile: InputProfile, code: string): Side | null {
  return profile.kind === 'keyboard' ?
    code === profile.leftCode ? 'left' : code === profile.rightCode ? 'right' : null : null
}
function scoreAction(state: State, atMs: number, side: Side, source: string, code: string | null): State {
  if (state.phase === 'stimulus' && state.onsetMs !== null &&
    state.resolutionDueMs !== null && atMs < state.resolutionDueMs) {
    if (state.firstResponse) return append(state, 'response_extra', atMs,
      { side, inputClass: state.profile.kind, source, code })
    return append({ ...state, firstResponse: { side, atMs, source } },
      'response', atMs, { side, inputClass: state.profile.kind, source, code })
  }
  if (state.phase === 'stimulus' || state.phase === 'offset_pending')
    return append(state, 'boundary_extra', atMs, { side, inputClass: state.profile.kind, source, code })
  return append(state, 'response_ignored', atMs,
    { side, inputClass: state.profile.kind, source, reason: 'outside_stimulus' })
}
function blockCounts(state: State): Event['detail'] {
  let correct = 0, wrong = 0, omitted = 0
  for (let index = state.trialIndex - 23; index <= state.trialIndex; index++) {
    const events = state.events.filter(event => event.trialIndex === index)
    const response = events.find(event => event.type === 'response')
    const omission = events.find(event => event.type === 'omission')
    assert((response === undefined) !== (omission === undefined), 'unreconciled block outcome')
    if (omission) omitted++
    else if (response?.detail.side === state.form.trials[index - 1].longerSide) correct++
    else wrong++
  }
  assert(correct + wrong + omitted === 24, 'unreconciled block count')
  return { correct, wrong, omitted, denominator: 24 }
}

/** Creates only a headless arm. It does not prove a durable Start or visible bars. */
export function armHeadless(form: Form, identity: Identity, profile: InputProfile, armedAtMs: number): State {
  assert(isVerifiedLengthsForm(form), 'form is not verified')
  identityValid(identity)
  profileValid(profile)
  assert(profile.variant === form.variant, 'profile/form variant mismatch')
  at(armedAtMs)
  let state: State = { specificationVersion: LENGTHS_SPEC_VERSION, eventVersion: LENGTHS_EVENT_VERSION,
    scoringVersion: LENGTHS_SCORING_VERSION, timingVersion: LENGTHS_TIMING_VERSION,
    inputVersion: LENGTHS_INPUT_VERSION, validity: HEADLESS_VALIDITY,
    form, identity: structuredClone(identity), profile: structuredClone(profile), armedAtMs,
    phase: 'armed', trialIndex: 1, startMs: null, fixationDueMs: null, fixationMs: null,
    stimulusDueMs: null, onsetMs: null, resolutionDueMs: null, resolutionMs: null,
    firstResponse: null, timingNoted: false, heldCodes: [], activePointer: null,
    invalidReason: null, commands: [], events: [] }
  state = append(state, 'prepared', armedAtMs)
  state = append(state, 'form_assigned', armedAtMs, { formId: form.id, variant: form.variant })
  state = append(state, 'armed', armedAtMs,
    { profile: JSON.stringify(state.profile), route: JSON.stringify(state.identity.route) })
  return freeze(state)
}

/** Consumes one already observed command. All effects are synchronous and immutable. */
export function advance(prior: State, command: Command): State {
  assert(isVerifiedLengthsForm(prior.form), 'form is not verified')
  commandValid(command)
  assert(command.atMs >= prior.armedAtMs &&
    command.atMs >= (prior.commands.at(-1)?.atMs ?? prior.armedAtMs), 'regressing command time')
  assert(prior.phase !== 'completed' && prior.phase !== 'invalid', 'terminal state')
  if ((command.kind === 'keydown' || command.kind === 'keyup') &&
    sideFor(prior.profile, command.code) === null) return prior
  if (command.kind === 'pointerup' && prior.profile.kind !== 'pointer') return prior
  if (command.kind === 'pointerdown' && prior.profile.kind !== 'pointer') return prior
  if (command.kind === 'frameGap' &&
    !['fixation_pending', 'fixation', 'stimulus', 'offset_pending'].includes(prior.phase)) return prior
  if (command.kind === 'invalidate' && ['armed', 'break'].includes(prior.phase) &&
    ['hidden', 'blur', 'freeze', 'page_exit', 'viewport'].includes(command.reason)) return prior
  let state: State = { ...prior, commands: [...prior.commands, structuredClone(command)] }
  const time = command.atMs
  if (state.phase === 'stimulus' && state.resolutionDueMs !== null &&
    time - state.resolutionDueMs > 250 &&
    ['keydown', 'keyup', 'pointerdown', 'pointerup', 'frameGap'].includes(command.kind))
    return freeze(invalidate(state, time, 'timing'))
  switch (command.kind) {
    case 'start':
    case 'continue': {
      assert(state.phase === (command.kind === 'start' ? 'armed' : 'break'), 'block start out of order')
      assert(!command.responseHeld && state.heldCodes.length === 0 && state.activePointer === null,
        'response control held at block start')
      state = { ...state, phase: 'fixation_pending', startMs: time, fixationDueMs: time,
        fixationMs: null, stimulusDueMs: null, onsetMs: null, resolutionDueMs: null,
        resolutionMs: null, firstResponse: null, timingNoted: false }
      if (command.kind === 'continue') state = append(state, 'block_continued', time,
        { profile: JSON.stringify(state.profile), clockDomainId: state.identity.clockDomainId,
          ...(command.displayContext ? { displayContext: JSON.stringify(command.displayContext) } : {}) })
      state = append(state, 'block_started', time,
        { profile: JSON.stringify(state.profile), clockDomainId: state.identity.clockDomainId,
          ...(command.displayContext ? { displayContext: JSON.stringify(command.displayContext) } : {}) })
      break
    }
    case 'fixation': {
      assert(state.phase === 'fixation_pending' && state.fixationDueMs !== null, 'fixation out of order')
      state = stage({ ...state, phase: 'fixation', fixationMs: time, stimulusDueMs: time + 600 },
        'fixation', state.fixationDueMs, time, 'fixation_confirmed')
      break
    }
    case 'onset': {
      assert(state.phase === 'fixation' && state.stimulusDueMs !== null, 'onset out of order')
      state = stage({ ...state, phase: 'stimulus', onsetMs: time, resolutionDueMs: time + 1400 },
        'stimulus', state.stimulusDueMs, time, 'stimulus_presented')
      break
    }
    case 'keydown': {
      const side = sideFor(state.profile, command.code)!
      const held = state.heldCodes.includes(command.code)
      if (command.modified || command.repeat || command.composing || held) {
        state = append(held ? state :
          { ...state, heldCodes: [...state.heldCodes, command.code] }, 'response_ignored', time,
          { source: 'keyboard', reason: command.modified ? 'modified' :
            command.composing ? 'composition' : command.repeat ? 'repeat' : 'held' })
        break
      }
      state = { ...state, heldCodes: [...state.heldCodes, command.code] }
      state = scoreAction(state, time, side, 'keyboard', command.code)
      break
    }
    case 'keyup': {
      const held = state.heldCodes.includes(command.code)
      state = append({ ...state, heldCodes: state.heldCodes.filter(code => code !== command.code) },
        'input_released', time, { source: 'keyboard', code: command.code, held })
      break
    }
    case 'pointerdown': {
      if (!command.isPrimary || command.button !== 0 || state.activePointer !== null) {
        state = append(state, 'response_ignored', time,
          { source: command.pointerType, reason: state.activePointer !== null ? 'multiple_or_held' : 'non_primary' })
        break
      }
      if (state.profile.kind !== 'pointer' || command.pointerType !== state.profile.pointerSource) {
        state = invalidate(state, time, 'settings')
        break
      }
      state = { ...state, activePointer: command.pointerId }
      state = scoreAction(state, time, command.side, command.pointerType, null)
      break
    }
    case 'pointerup': {
      const held = state.activePointer === command.pointerId
      state = append({ ...state, activePointer: held ? null : state.activePointer },
        'input_released', time, { source: 'pointer', held })
      break
    }
    case 'resolve': {
      assert(state.phase === 'stimulus' && state.resolutionDueMs !== null, 'resolution out of order')
      state = stage({ ...state, phase: 'offset_pending', resolutionMs: time },
        'resolution', state.resolutionDueMs, time, 'deadline_resolved')
      if (state.phase !== 'invalid' && !state.firstResponse) state = append(state, 'omission', time)
      break
    }
    case 'offset': {
      assert(state.phase === 'offset_pending' && state.resolutionDueMs !== null &&
        state.resolutionMs !== null && time >= state.resolutionMs, 'offset out of order')
      state = stage(state, 'offset', state.resolutionDueMs, time, 'stimulus_offset')
      if (state.phase === 'invalid') break
      state = append(state, 'trial_closed', time, { timingNoted: state.timingNoted })
      if (state.trialIndex === 96) state = append({ ...state, phase: 'completed' }, 'session_completed', time)
      else if (state.trialIndex % 24 === 0) {
        state = append({ ...state, phase: 'break' }, 'block_summary', time, blockCounts(state))
        state = { ...state, trialIndex: state.trialIndex + 1 }
      } else state = { ...state, phase: 'fixation_pending', trialIndex: state.trialIndex + 1,
        fixationDueMs: time, fixationMs: null, stimulusDueMs: null, onsetMs: null,
        resolutionDueMs: null, resolutionMs: null, firstResponse: null, timingNoted: false }
      break
    }
    case 'frameGap': {
      state = append(state, 'frame_gap', time, { gapMs: command.gapMs })
      if (command.gapMs > 250) state = invalidate(state, time, 'frame_gap')
      else if (command.gapMs > 50)
        state = append({ ...state, timingNoted: true }, 'timing_note', time,
          { stage: 'frame_gap', latenessMs: command.gapMs })
      break
    }
    case 'watchdog': {
      const due = state.phase === 'fixation_pending' ? state.fixationDueMs :
        state.phase === 'fixation' ? state.stimulusDueMs :
          state.phase === 'stimulus' || state.phase === 'offset_pending' ? state.resolutionDueMs : null
      assert(due !== null && time >= due + 2000, 'watchdog before required stage')
      state = invalidate(state, time, 'watchdog')
      break
    }
    case 'invalidate': state = invalidate(state, time, command.reason); break
    default: throw Error('Lengths engine: unsupported command')
  }
  return freeze(state)
}

/** Full replay rejects changed commands, derived fields, events or event order. */
export function verifyHeadless(state: State): boolean {
  try {
    if (!isVerifiedLengthsForm(state.form)) return false
    let replay = armHeadless(state.form, state.identity, state.profile, state.armedAtMs)
    for (const command of state.commands) replay = advance(replay, command)
    return exactDeep(replay, state)
  } catch { return false }
}
