import type { Board, Form } from './forms'

export type Terminal = 'solved' | 'expired' | 'interrupted' | 'exited'
export type InputSource = 'pointer' | 'touch' | 'keyboard' | 'assistive'
export const EVENT_VERSION = 'towers-events-v1.0-draft'
export interface Event {
  eventVersion: typeof EVENT_VERSION; attemptId: string; formId: string; formHash: string
  ownershipGeneration: number; wallTimestampMs: number
  kind: 'board_onset' | 'move' | 'undo' | 'reset' | Terminal
  sequence: number; elapsedMs: number; actionId: string
  diskId?: number; from?: number; to?: number; refActionId?: string
  inputSource?: InputSource; reason?: string
}
export type PendingEvent = Omit<Event, 'eventVersion' | 'attemptId' | 'formId' |
  'formHash' | 'ownershipGeneration'>
export interface State {
  board: Board; events: number; movesMade: number; undoCount: number; resetCount: number
  planningMs: number | null; solutionMs: number | null; timeUsedMs: number | null
  terminal: Terminal | null; elapsedMs: number; actionIds: Set<string>
  undoStack: { board: Board; actionId: string }[]
}
export interface Report {
  status: 'solved' | 'incomplete timeout' | 'interrupted' | 'exited'
  formId: string; eventVersion: typeof EVENT_VERSION; inputSources: InputSource[]
  interruptionReason: string | null
  movesMade: number; optimalMoves: number; excessMoves: number | null
  planningMs: number | null; solutionMs: number | null; timeUsedMs: number | null
  undoCount: number; resetCount: number; finalBoard: Board
}
function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw Error(`Towers journal: ${message}`)
}
export function copyBoard(board: Board): Board { return board.map(stack => [...stack]) as Board }
export function sameBoard(a: Board, b: Board) {
  return a.every((stack, index) => stack.length === b[index].length &&
    stack.every((disk, j) => disk === b[index][j]))
}
export function initialState(form: Form): State {
  return { board: copyBoard(form.start), events: 0, movesMade: 0, undoCount: 0, resetCount: 0,
    planningMs: null, solutionMs: null, timeUsedMs: null, terminal: null, elapsedMs: 0,
    actionIds: new Set(), undoStack: [] }
}
export function reduce(state: State, event: Event, form: Form): State {
  assert(event.sequence === state.events + 1 && typeof event.actionId === 'string' &&
    /^[a-zA-Z0-9_-]{1,128}$/.test(event.actionId) && !state.actionIds.has(event.actionId) &&
    Number.isSafeInteger(event.elapsedMs) && event.elapsedMs >= state.elapsedMs &&
    event.eventVersion === EVENT_VERSION && event.formId === form.formId &&
    /^[0-9a-f]{64}$/.test(event.formHash) && !!event.attemptId &&
    Number.isSafeInteger(event.ownershipGeneration) && event.ownershipGeneration > 0 &&
    Number.isFinite(event.wallTimestampMs),
  'sequence, action, or time')
  assert(!state.terminal, 'event after terminal')
  if (!state.events) assert(event.kind === 'board_onset' && event.elapsedMs === 0, 'first onset')
  else assert(event.kind !== 'board_onset', 'duplicate onset')
  const next: State = { ...state, board: copyBoard(state.board), undoStack: [...state.undoStack],
    actionIds: new Set(state.actionIds), events: event.sequence, elapsedMs: event.elapsedMs }
  next.actionIds.add(event.actionId)
  if (event.kind === 'board_onset') return next
  assert(state.events > 0, 'missing onset')
  if (sameBoard(state.board, form.target)) assert(event.kind === 'solved', 'target requires solve')
  if (event.kind === 'move') {
    assert(event.elapsedMs < form.limitMs &&
      Number.isInteger(event.from) && Number.isInteger(event.to) &&
      event.from! >= 0 && event.from! < 3 && event.to! >= 0 && event.to! < 3 &&
      event.from !== event.to &&
      ['pointer', 'touch', 'keyboard', 'assistive'].includes(event.inputSource ?? '') &&
      state.board[event.from!].at(-1) === event.diskId, 'illegal placement')
    next.undoStack.push({ board: copyBoard(state.board), actionId: event.actionId })
    next.board[event.to!].push(next.board[event.from!].pop()!)
    next.movesMade++
    if (next.planningMs === null) next.planningMs = event.elapsedMs
  } else if (event.kind === 'undo') {
    assert(event.elapsedMs < form.limitMs && !!state.undoStack.length &&
      state.undoStack.at(-1)!.actionId === event.refActionId, 'illegal undo')
    next.board = copyBoard(next.undoStack.pop()!.board)
    next.undoCount++
  } else if (event.kind === 'reset') {
    assert(event.elapsedMs < form.limitMs, 'late reset')
    next.board = copyBoard(form.start); next.undoStack = []; next.resetCount++
  } else if (event.kind === 'solved') {
    assert(event.elapsedMs < form.limitMs && sameBoard(state.board, form.target) &&
      event.elapsedMs === state.elapsedMs, 'false or delayed solve')
    next.terminal = 'solved'; next.solutionMs = event.elapsedMs; next.timeUsedMs = event.elapsedMs
  } else if (event.kind === 'expired') {
    assert(event.elapsedMs === form.limitMs && !sameBoard(state.board, form.target), 'false expiry')
    next.terminal = 'expired'; next.timeUsedMs = form.limitMs
  } else if (event.kind === 'interrupted' || event.kind === 'exited') {
    assert(event.elapsedMs < form.limitMs && !sameBoard(state.board, form.target) &&
      !!event.reason, 'false interruption')
    next.terminal = event.kind; next.timeUsedMs = event.elapsedMs
  } else assert(false, 'unknown event')
  assert(next.board.flat().length === 5 && [...next.board.flat()].sort().join() === '1,2,3,4,5',
    'disk conservation')
  return next
}
export function replay(form: Form, events: readonly Event[]): State {
  return events.reduce((state, event) => reduce(state, event, form), initialState(form))
}
export function report(form: Form, events: readonly Event[]): Report | null {
  const state = replay(form, events)
  if (!state.events || !state.terminal) return null
  const status = state.terminal === 'solved' ? 'solved' : state.terminal === 'expired' ?
    'incomplete timeout' : state.terminal === 'exited' ? 'exited' : 'interrupted'
  return { status, formId: form.formId, eventVersion: EVENT_VERSION,
    inputSources: [...new Set(events.flatMap(event => event.inputSource ? [event.inputSource] : []))],
    interruptionReason: events.at(-1)?.reason ?? null,
    movesMade: state.movesMade, optimalMoves: form.optimalMoves,
    excessMoves: status === 'solved' ? state.movesMade - form.optimalMoves : null,
    planningMs: state.planningMs, solutionMs: state.solutionMs, timeUsedMs: state.timeUsedMs,
    undoCount: state.undoCount, resetCount: state.resetCount, finalBoard: copyBoard(state.board) }
}
