import { verify as verifyV101 } from './core-v101'

export const SPEC_VERSION = 'keypresses_spec_v1_0_2'
export const EVENT_VERSION = 'keypresses_event_v2'
export const SCORING_VERSION = 'keypresses_scoring_v1_0_2'
export const INPUT_PROFILE_VERSION = 'keypresses_input_profile_v1'
export const PRESENTATION_PLAN_VERSION = 'keypresses_presentation_plan_v1'
export const TARGET = 40
export const WINDOW_MS = 15_000
export const LATE_MS = 1_000
export const DELAYS_MS = Object.freeze([1_800, 1_950, 2_100, 2_250, 2_400, 2_550, 2_700, 2_850] as const)

export type Profile = 'standard_physical' | 'alternative' | 'unknown'
export type Hand = 'left' | 'right' | 'either'
export type Phase = 'waiting' | 'active' | 'await_end' | 'late' | 'completed' | 'invalid'
export type InvalidReason = 'go_timeout' | 'end_timeout' | 'deadline_delay' | 'frame_gap' | 'hidden' | 'blur' | 'freeze' | 'resize' | 'settings_changed' | 'ownership_lost' | 'reload' | 'navigation' | 'technical_failure' | 'implausible_input'

export interface Setup {
  readonly sessionId: string
  readonly selectedKey: string
  readonly hand: Hand
  readonly profile: Profile
  readonly delayIndex: number
}

export type Command = Readonly<
  | { kind: 'go'; atMs: number }
  | { kind: 'keydown'; atMs: number; repeat: boolean; trusted: boolean }
  | { kind: 'keyup'; atMs: number; trusted: boolean }
  | { kind: 'deadline'; atMs: number }
  | { kind: 'end'; atMs: number }
  | { kind: 'close'; atMs: number }
  | { kind: 'invalidate'; atMs: number; reason: InvalidReason }
>

export type EventType = 'armed' | 'go_confirmed' | 'keydown_admitted' | 'keydown_ignored' | 'keyup_ignored' | 'press_early' | 'press_accepted' | 'press_boundary' | 'press_late' | 'keyup' | 'logical_end' | 'end_confirmed' | 'session_completed' | 'invalidated' | 'report_viewed'
export interface Event {
  readonly schemaVersion: string
  readonly sessionId: string
  readonly sequenceNumber: number
  readonly timestampMs: number
  readonly type: EventType
  readonly detail: string | null
}

export interface State {
  readonly specificationVersion: string
  readonly scoringVersion: string
  readonly eventVersion: string
  readonly inputProfileVersion: typeof INPUT_PROFILE_VERSION
  readonly presentationPlanVersion: typeof PRESENTATION_PLAN_VERSION
  readonly setup: Setup
  readonly armedAtMs: number
  readonly phase: Phase
  readonly held: boolean
  readonly pendingDownMs: number | null
  readonly pendingPhase: Phase | null
  readonly repeatSeen: boolean
  readonly heldAtResolution: boolean
  readonly goOnsetMs: number | null
  readonly logicalEndMs: number | null
  readonly endOnsetMs: number | null
  readonly endReason: 'target' | 'deadline' | null
  readonly accepted: readonly number[]
  readonly commands: readonly Command[]
  readonly events: readonly Event[]
}

function checkTime(atMs: number) {
  if (!Number.isFinite(atMs) || atMs < 0) throw new Error('Invalid monotonic time')
}

const SAFE_CODE = /^(Space|Key[A-Z]|Digit[0-9]|Numpad[0-9]|Comma|Period|Slash|Semicolon|Quote|BracketLeft|BracketRight|Backslash|Backquote|Minus|Equal)$/
export function validSelectedCode(value: unknown): value is string { return typeof value === 'string' && SAFE_CODE.test(value) }
const INVALID_REASONS: readonly InvalidReason[] = ['go_timeout', 'end_timeout', 'deadline_delay', 'frame_gap', 'hidden', 'blur', 'freeze', 'resize', 'settings_changed', 'ownership_lost', 'reload', 'navigation', 'technical_failure', 'implausible_input']
function validateCommand(command: Command) {
  if (!command || typeof command !== 'object') throw new Error('Invalid command')
  const expected = command.kind === 'keydown' ? ['atMs', 'kind', 'repeat', 'trusted'] :
    command.kind === 'keyup' ? ['atMs', 'kind', 'trusted'] :
    command.kind === 'invalidate' ? ['atMs', 'kind', 'reason'] :
      ['go', 'deadline', 'end', 'close'].includes(command.kind) ? ['atMs', 'kind'] : null
  if (!expected || JSON.stringify(Object.keys(command).toSorted()) !== JSON.stringify(expected)) throw new Error('Malformed command')
  if (command.kind === 'keydown' && typeof command.repeat !== 'boolean') throw new Error('Missing repeat evidence')
  if ((command.kind === 'keydown' || command.kind === 'keyup') && typeof command.trusted !== 'boolean') throw new Error('Missing trust evidence')
  if (command.kind === 'invalidate' && !INVALID_REASONS.includes(command.reason)) throw new Error('Unknown invalidation reason')
}

function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value
}

function append(state: State, type: EventType, atMs: number, detail: string | null = null): State {
  const next: Event = { schemaVersion: EVENT_VERSION, sessionId: state.setup.sessionId,
    sequenceNumber: state.events.length + 1, timestampMs: atMs, type, detail }
  return { ...state, events: [...state.events, next] }
}

export function arm(setup: Setup, atMs: number): State {
  checkTime(atMs)
  if (typeof setup.sessionId !== 'string' || !setup.sessionId.trim() ||
    !validSelectedCode(setup.selectedKey) ||
    !Number.isInteger(setup.delayIndex) || setup.delayIndex < 0 || setup.delayIndex >= DELAYS_MS.length ||
    !(['left', 'right', 'either'] as const).includes(setup.hand) ||
    !(['standard_physical', 'alternative', 'unknown'] as const).includes(setup.profile)) throw new Error('Invalid Keypresses setup')
  const state: State = { specificationVersion: SPEC_VERSION, scoringVersion: SCORING_VERSION,
    eventVersion: EVENT_VERSION, inputProfileVersion: INPUT_PROFILE_VERSION,
    presentationPlanVersion: PRESENTATION_PLAN_VERSION,
    setup: { ...setup }, armedAtMs: atMs, phase: 'waiting', held: false,
    pendingDownMs: null, pendingPhase: null, repeatSeen: false, heldAtResolution: false,
    goOnsetMs: null, logicalEndMs: null, endOnsetMs: null, endReason: null,
    accepted: [], commands: [], events: [] }
  return freeze(append(state, 'armed', atMs, JSON.stringify(state.setup)))
}

function endLogically(state: State, logicalAtMs: number, reason: 'target' | 'deadline', observedAtMs = logicalAtMs): State {
  return append({ ...state, phase: 'await_end', logicalEndMs: logicalAtMs, endReason: reason,
    heldAtResolution: state.heldAtResolution || state.held },
    'logical_end', observedAtMs, reason === 'deadline' ? `deadline:${logicalAtMs}` : reason)
}

function invalid(state: State, atMs: number, reason: InvalidReason): State {
  return append({ ...state, phase: 'invalid' }, 'invalidated', atMs, reason)
}

/** Pure transition. Browser input and timing must never await storage here. */
export function advance(prior: State, command: Command): State {
  validateCommand(command)
  checkTime(command.atMs)
  if (prior.commands.length && command.atMs < prior.commands.at(-1)!.atMs) throw new Error('Regressing command time')
  if (command.atMs < prior.events.at(-1)!.timestampMs) throw new Error('Regressing event time')
  if (prior.phase === 'invalid' || prior.phase === 'completed') throw new Error('Run already resolved')
  let state: State = { ...prior, commands: [...prior.commands, command] }
  const atMs = command.atMs
  switch (command.kind) {
    case 'go': {
      if (state.phase !== 'waiting') throw new Error('GO out of order')
      const due = state.armedAtMs + DELAYS_MS[state.setup.delayIndex]
      if (atMs < due) throw new Error('GO before scheduled delay')
      state = atMs - due > 2_000 ? invalid(state, atMs, 'go_timeout') :
        append({ ...state, phase: 'active', goOnsetMs: atMs }, 'go_confirmed', atMs)
      break
    }
    case 'keydown': {
      if (!command.trusted) { state = append(state, 'keydown_ignored', atMs, 'untrusted'); break }
      if (command.repeat || state.held) {
        state = append({ ...state, repeatSeen: true }, 'keydown_ignored', atMs, command.repeat ? 'repeat' : 'held')
        break
      }
      if (state.phase === 'active' && atMs >= state.goOnsetMs! + WINDOW_MS) {
        const due = state.goOnsetMs! + WINDOW_MS
        state = atMs - due > 250 ? invalid(state, atMs, 'deadline_delay') : endLogically(state, due, 'deadline', atMs)
      }
      if (state.phase === 'invalid') break
      state = append({ ...state, held: true, pendingDownMs: atMs, pendingPhase: state.phase }, 'keydown_admitted', atMs, state.phase)
      break
    }
    case 'keyup': {
      if (!command.trusted) { state = append(state, 'keyup_ignored', atMs, 'untrusted'); break }
      if (!state.held || state.pendingDownMs === null || state.pendingPhase === null) {
        state = append(state, 'keyup_ignored', atMs, 'without_down'); break
      }
      const origin = state.pendingPhase
      const heldThroughDeadline = state.goOnsetMs !== null &&
        state.pendingDownMs < state.goOnsetMs + WINDOW_MS && atMs >= state.goOnsetMs + WINDOW_MS
      state = append({ ...state, held: false, pendingDownMs: null, pendingPhase: null,
        heldAtResolution: state.heldAtResolution || heldThroughDeadline }, 'keyup', atMs, 'released')
      if (origin !== state.phase) {
        state = append(state, 'keyup_ignored', atMs, `crossed_${origin}_${state.phase}`)
        break
      }
      if (state.phase === 'active' && atMs >= state.goOnsetMs! + WINDOW_MS) {
        const due = state.goOnsetMs! + WINDOW_MS
        state = atMs - due > 250 ? invalid(state, atMs, 'deadline_delay') : endLogically(state, due, 'deadline', atMs)
        break
      }
      if (state.phase === 'waiting') state = append(state, 'press_early', atMs)
      else if (state.phase === 'active') {
        const accepted = [...state.accepted, atMs]
        state = append({ ...state, accepted }, 'press_accepted', atMs)
        if (accepted.length === TARGET) state = endLogically(state, atMs, 'target')
      } else if (state.phase === 'await_end') state = append(state, 'press_boundary', atMs)
      else if (state.phase === 'late') state = append(state,
        atMs < state.endOnsetMs! + LATE_MS ? 'press_late' : 'keyup_ignored', atMs,
        atMs < state.endOnsetMs! + LATE_MS ? null : 'outside_late_window')
      break
    }
    case 'deadline': {
      if (state.phase !== 'active') throw new Error('Deadline out of order')
      const due = state.goOnsetMs! + WINDOW_MS
      if (atMs < due) throw new Error('Deadline before window end')
      state = atMs - due > 250 ? invalid(state, atMs, 'deadline_delay') : endLogically(state, due, 'deadline', atMs)
      break
    }
    case 'end': {
      if (state.phase !== 'await_end' || atMs < state.logicalEndMs!) throw new Error('END out of order')
      state = atMs - state.logicalEndMs! > 250 ? invalid(state, atMs, 'end_timeout') :
        append({ ...state, phase: 'late', endOnsetMs: atMs }, 'end_confirmed', atMs)
      break
    }
    case 'close': {
      if (state.phase !== 'late' || atMs < state.endOnsetMs! + LATE_MS) throw new Error('Late window not complete')
      const intervals = state.accepted.slice(1).map((time, index) => time - state.accepted[index]).toSorted((a, b) => a - b)
      const middle = Math.floor(intervals.length / 2)
      const median = intervals.length ? intervals.length % 2 ? intervals[middle] : (intervals[middle - 1] + intervals[middle]) / 2 : null
      state = state.held || state.heldAtResolution || state.repeatSeen || (median !== null && median < 40) || intervals.filter(interval => interval < 20).length > 3
        ? invalid(state, atMs, 'implausible_input')
        : append({ ...state, phase: 'completed' }, 'session_completed', atMs)
      break
    }
    case 'invalidate': state = invalid(state, atMs, command.reason); break
    default: throw new Error('Unsupported command')
  }
  return freeze(state)
}

/** Admission check reconstructs the complete event journal from primitive commands. */
export function verify(state: State): boolean {
  if (state?.specificationVersion === 'keypresses_spec_v1_0_1') return verifyV101(state as unknown as Parameters<typeof verifyV101>[0])
  try {
    let replay = arm(state.setup, state.armedAtMs)
    for (const command of state.commands) replay = advance(replay, command)
    return JSON.stringify(replay) === JSON.stringify(state)
  } catch { return false }
}
