import { describe, expect, it } from 'vitest'
import fixtures from '../../docs/specifications/ASSESSMENT_PRACTICE_EASY_HARD_FIXTURES_V1_0_DRAFT.json'
import { loadForms } from './forms'
import { choice, due, materialClockDivergence, onset, phaseOf, press, resolution, taskOnset } from './engine'
import type { JournalEvent } from './report'

const journal = fixtures.replayableSessions[0].expectedJournal as JournalEvent[]
function payload(event: JournalEvent) {
  const { eventVersion: _v, attemptId: _a, formId: _f, formHash: _h,
    ownershipGeneration: _o, sequence: _s, wallTimestampMs: _w, ...value } = event
  void [_v, _a, _f, _h, _o, _s, _w]
  return value
}

describe('Easy or Hard fixed-deadline transitions', () => {
  it('marks a material wall-clock jump uncertain without changing monotonic deadlines', () => {
    expect(materialClockDivergence(12500, 10000, 2500)).toBe(false)
    expect(materialClockDivergence(72500, 10000, 2500)).toBe(true)
    expect(materialClockDivergence(12500, 10000, Number.NaN)).toBe(true)
  })
  it('derives the opening choice, task, presses and winning resolution', async () => {
    const form = (await loadForms()).get('EH1')!.form
    expect(onset(form, [], 0)).toEqual(payload(journal[0]))
    expect(choice(journal.slice(0, 1), 'easy', 500, 'pointer', journal[1].actionId!))
      .toEqual(payload(journal[1]))
    expect(taskOnset(form, journal.slice(0, 2), 550)).toEqual(payload(journal[2]))
    expect(press(journal.slice(0, 3), 650, journal[3].actionId!)).toEqual(payload(journal[3]))
    expect(resolution(form, journal.slice(0, 8), 1050)).toEqual(payload(journal[8]))
    expect(due(form, journal.slice(0, 8), 1050, 'unused')).toEqual(payload(journal[8]))
    expect(phaseOf(journal.slice(0, 9))).toBe('feedback')
    expect(due(form, journal.slice(0, 9), 5050, 'unused')).toEqual(payload(journal[9]))
    expect(onset(form, journal.slice(0, 10), 5050)).toEqual(payload(journal[10]))
  })

  it('gives half-open deadlines priority over exact-tie actions', async () => {
    const form = (await loadForms()).get('EH1')!.form
    expect(() => choice(journal.slice(0, 1), 'easy', 5000, 'pointer', 'tie')).toThrow()
    expect(due(form, journal.slice(0, 1), 5000, 'fallback')).toMatchObject({
      kind: 'choice_selected', choice: 'hard', automatic: true, elapsedMs: 5000,
    })
    expect(() => press(journal.slice(0, 3), 3550, 'tie')).toThrow()
    expect(due(form, journal.slice(0, 3), 3550, 'unused')).toMatchObject({
      kind: 'task_resolved', reason: 'task_timeout', elapsedMs: 3550,
    })
  })

  it('expires feedback, a selected choice and the between-offer interval without adding a task', async () => {
    const form = (await loadForms()).get('EH1')!.form
    expect(due(form, journal.slice(0, -1), 120000, 'unused')).toMatchObject({
      kind: 'global_expired', phase: 'feedback', elapsedMs: 120000,
    })
    const lastOffer = { ...journal[0], elapsedMs: 119000, choiceDeadlineMs: 124000 }
    const selected = { ...journal[1], elapsedMs: 119500 }
    expect(due(form, [lastOffer, selected], 120000, 'unused')).toMatchObject({
      kind: 'global_expired_after_choice', elapsedMs: 120000,
    })
    expect(due(form, journal.slice(0, 10), 120000, 'unused')).toMatchObject({
      kind: 'global_expired', phase: 'feedback', elapsedMs: 120000,
    })
  })

  it('settles earlier deadlines before the global clock even after a late callback', async () => {
    const form = (await loadForms()).get('EH1')!.form
    expect(due(form, journal.slice(0, 1), 120000, 'fallback')).toMatchObject({
      kind: 'choice_selected', automatic: true, elapsedMs: 5000,
    })
    const nearEnd = { ...journal[0], elapsedMs: 117000, choiceDeadlineMs: 122000 }
    expect(due(form, [nearEnd], 120000, 'unused')).toMatchObject({
      kind: 'global_expired_in_choice', elapsedMs: 120000,
    })
    expect(due(form, journal.slice(0, 9), 120000, 'unused')).toMatchObject({
      kind: 'feedback_end', elapsedMs: 5050,
    })
  })

  it('ends globally before feedback whose deadline is later or tied', async () => {
    const form = (await loadForms()).get('EH1')!.form
    const resolved = journal[8]
    expect(due(form, [{ ...resolved, elapsedMs: 117650 }], 122000, 'unused'))
      .toMatchObject({ kind: 'global_expired', elapsedMs: 120000 })
    expect(due(form, [{ ...resolved, elapsedMs: 116000 }], 120000, 'unused'))
      .toMatchObject({ kind: 'global_expired', elapsedMs: 120000 })
    expect(due(form, [{ ...resolved, elapsedMs: 115000 }], 120000, 'unused'))
      .toMatchObject({ kind: 'feedback_end', elapsedMs: 119000 })
  })
})
