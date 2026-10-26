import { describe, expect, it } from 'vitest'
import fixtures from '../../docs/specifications/ASSESSMENT_PRACTICE_EASY_HARD_FIXTURES_V1_0_DRAFT.json'
import { loadForms } from './forms'
import { reportFromJournal } from './report'
import type { JournalEvent } from './report'

describe('Easy or Hard journal reconciliation', () => {
  it('reconstructs the full EH1 trace and report from the fixed form', async () => {
    const session = fixtures.replayableSessions[0]
    const item = (await loadForms()).get('EH1')!
    const report = reportFromJournal(item.form, item.hash, session.expectedJournal as JournalEvent[])
    expect(report).toMatchObject(session.expectedReport)
    expect(report.status).toBe('complete')
    expect(report.attempts).toBe(session.expectedReport.attempts)
    expect(report.completedOnTime).toBe(session.expectedReport.completedOnTime)
    expect(report.earnedCents).toBe(session.expectedReport.earnedCents)
    expect(report.easyChoices).toBe(session.expectedReport.easyChoices)
    expect(report.hardChoices).toBe(session.expectedReport.hardChoices)
    expect(report.automaticChoices).toBe(session.expectedReport.automaticChoices)
  })

  it('rejects a burst of outcome tampering', async () => {
    const session = fixtures.replayableSessions[0]
    const item = (await loadForms()).get('EH1')!
    const journal = structuredClone(session.expectedJournal) as JournalEvent[]
    const burst = journal.find(event => event.kind === 'task_resolved' && event.reason === 'task_timeout')!
    burst.earnedCents = 100
    expect(() => reportFromJournal(item.form, item.hash, journal)).toThrow('task resolution')
  })

  it('rejects fabricated system provenance even when the money is unchanged', async () => {
    const item = (await loadForms()).get('EH1')!
    const journal = structuredClone(fixtures.replayableSessions[0].expectedJournal) as JournalEvent[]
    journal[0].inputSource = 'pointer'
    expect(() => reportFromJournal(item.form, item.hash, journal)).toThrow('system event source')
  })

  it('counts a started but interrupted task as an unpaid attempt', async () => {
    const item = (await loadForms()).get('EH1')!
    const prefix = structuredClone(fixtures.replayableSessions[0].expectedJournal.slice(0,4)) as JournalEvent[]
    const active = reportFromJournal(item.form, item.hash, prefix)
    expect(active).toMatchObject({ status: 'incomplete_review', attempts: 1,
      completedOnTime: 0, earnedCents: 0 })
    expect(active.rows[0]).toMatchObject({ offerIndex: 1, acceptedPresses: 1,
      reason: 'unresolved' })
    const last = prefix.at(-1)!
    prefix.push({ ...last, sequence: 5, kind: 'run_interrupted', phase: 'interrupted',
      elapsedMs: 700, wallTimestampMs: last.wallTimestampMs + 50,
      inputSource: 'system', reason: 'page hidden', offerIndex: undefined,
      actionId: undefined, pressId: undefined, choice: undefined,
      taskOnsetMs: undefined, taskDeadlineMs: undefined, acceptedPresses: undefined })
    const closure = Object.fromEntries(Object.entries(prefix[4]).filter(([, value]) => value !== undefined)) as unknown as JournalEvent
    prefix[4] = closure
    const stopped = reportFromJournal(item.form, item.hash, prefix)
    expect(stopped).toMatchObject({ attempts: 1, earnedCents: 0,
      terminalPhase: 'interrupted' })
    expect(stopped.rows[0].reason).toBe('interrupted')
  })

  it('rejects expiry that skips an earlier five-second fallback', async () => {
    const item = (await loadForms()).get('EH1')!
    const first = structuredClone(fixtures.replayableSessions[0].expectedJournal[0]) as JournalEvent
    const invalid: JournalEvent = { eventVersion: first.eventVersion,
      attemptId: first.attemptId, formId: first.formId, formHash: first.formHash,
      ownershipGeneration: first.ownershipGeneration, sequence: 2,
      kind: 'global_expired_in_choice', phase: 'choice', elapsedMs: 120000,
      wallTimestampMs: first.wallTimestampMs + 120000, inputSource: 'system' }
    expect(() => reportFromJournal(item.form, item.hash, [first, invalid]))
      .toThrow('global expiry')
  })
})
