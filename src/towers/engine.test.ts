import { describe, expect, it } from 'vitest'
import fixtures from '../../docs/specifications/ASSESSMENT_PRACTICE_TOWERS_FIXTURES_V1_0_DRAFT.json'
import { loadTowersForms } from './forms'
import { EVENT_VERSION, copyBoard, initialState, reduce, replay, report, sameBoard } from './engine'
import type { Event } from './engine'

function meta(formId: string, formHash: string): Pick<Event, 'eventVersion' | 'attemptId' |
  'formId' | 'formHash' | 'ownershipGeneration' | 'wallTimestampMs'> {
  return { eventVersion: EVENT_VERSION, attemptId: 'test-run', formId, formHash,
    ownershipGeneration: 1, wallTimestampMs: 1000 }
}
function solvedPath(path: number[][], formId: string, formHash: string, startAt = 3000): Event[] {
  const events: Event[] = [{ ...meta(formId, formHash), kind: 'board_onset', sequence: 1, elapsedMs: 0, actionId: 'onset' }]
  for (const [i, move] of path.entries()) {
    events.push({ ...meta(formId, formHash), kind: 'move', sequence: events.length + 1,
      elapsedMs: startAt + Math.floor(i * 52000 / 8),
      actionId: `move-${i}`, from: move[0], to: move[1], diskId: -1,
      inputSource: 'pointer' })
  }
  return events
}

describe('Towers fixed forms and journal', () => {
  it('replays all six shortest paths and exact sample reports', async () => {
    const forms = await loadTowersForms()
    expect(forms).toHaveLength(6)
    for (const [i, checked] of forms.entries()) {
      const fixture = fixtures.scenarios[i]
      const events = solvedPath(fixture.oneShortestPath, checked.form.formId, checked.hash)
      let board = copyBoard(checked.form.start)
      for (const event of events.slice(1)) {
        event.diskId = board[event.from!].at(-1)!
        board[event.to!].push(board[event.from!].pop()!)
      }
      expect(sameBoard(board, checked.form.target)).toBe(true)
      events.push({ ...meta(checked.form.formId, checked.hash), kind: 'solved', sequence: events.length + 1,
        elapsedMs: events.at(-1)!.elapsedMs, actionId: 'solved' })
      const state = replay(checked.form, events)
      expect(state.movesMade).toBe(9)
      expect(report(checked.form, events)).toMatchObject(fixture.sampleReport)
    }
  })

  it('keeps placement history through undo and reset and treats deadline tie as expired', async () => {
    const checked = (await loadTowersForms())[0]
    const form = checked.form
    const identity = meta(form.formId, checked.hash)
    let state = reduce(initialState(form), { ...identity, kind: 'board_onset', sequence: 1,
      elapsedMs: 0, actionId: 'onset' }, form)
    const first: Event = { ...identity, kind: 'move', sequence: 2, elapsedMs: 3000, actionId: 'first',
      diskId: form.start[0].at(-1), from: 0, to: 1, inputSource: 'pointer' }
    state = reduce(state, first, form)
    state = reduce(state, { ...identity, kind: 'undo', sequence: 3, elapsedMs: 4000,
      actionId: 'undo', refActionId: 'first' }, form)
    expect(sameBoard(state.board, form.start)).toBe(true)
    expect(state.movesMade).toBe(1)
    expect(state.undoCount).toBe(1)
    state = reduce(state, { ...identity, kind: 'expired', sequence: 4, elapsedMs: 120000,
      actionId: 'expired' }, form)
    expect(state.terminal).toBe('expired')
    expect(() => reduce(state, { ...first, sequence: 5, actionId: 'late',
      elapsedMs: 120000 }, form)).toThrow()
  })
})
