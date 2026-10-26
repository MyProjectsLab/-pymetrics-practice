import { describe, expect, it } from 'vitest'
import { DECKS, EVENT_VERSION, RULE_VERSION, START_BALANCE, formForOrdinal, loadCardsForms, reportRun } from './core'
import type { CardEvent, Run } from './core'

describe('Cards V1.1 fixed outcomes', () => {
  it('verifies every checked-in form digest and cycles exposure order', async () => {
    const forms = await loadCardsForms()
    expect(forms.size).toBe(6)
    expect(formForOrdinal(forms, 7).id).toBe('CD1')
    let balance = START_BALANCE
    const path = forms.get('CD1')!.decks.B.map(value => balance += value)
    expect(Math.min(...path)).toBe(-400)
    expect(path.at(-1)).toBe(400)
  })
  it('reconciles all six forms under every fixed-deck policy', async () => {
    const forms = await loadCardsForms()
    for (const form of forms.values()) for (const deck of DECKS) {
      let balance = START_BALANCE
      const events: CardEvent[] = []
      const append = (partial: object) => events.push({ ...partial, seq: events.length + 1,
        revision: events.length + 1, version: EVENT_VERSION, ruleVersion: RULE_VERSION,
        installationId: 'installation', runId: 'run', formSha256: form.formSha256 } as CardEvent)
      append({ type: 'run_started', formId: form.id, balance })
      for (let turn = 1; turn <= 80; turn++) {
        const value = form.decks[deck][turn - 1]
        append({ type: 'draw_ready', turn, atMs: turn * 3 })
        append({ type: 'choice_committed', turn, deck, deckDraw: turn, value, priorBalance: balance,
          balance: balance + value, commandId: `command-${turn}`, source: 'keyboard',
          atMs: turn * 3 + 1, latencyMs: 1 })
        balance += value
        append({ type: 'feedback_shown', turn, commandId: `command-${turn}`, atMs: turn * 3 + 2 })
      }
      const run: Run = { id: 'run', documentId: 'doc', installationId: 'installation', ordinal: 1, createdAtWallMs: 0,
        formId: form.id, formSha256: form.formSha256, epoch: 1, revision: events.length, status: 'active', events, requests: {} }
      const prefix = reportRun(run, form)
      expect(prefix.endingBalance).toBe(balance)
      expect(prefix.committedDrawCount).toBe(80)
      expect(prefix.feedbackSeenCount).toBe(80)
      expect(prefix.byDeck[deck].count).toBe(80)
      expect(prefix.gains - prefix.losses + START_BALANCE).toBe(balance)
      append({ type: 'run_completed', balance })
      const completed: Run = { ...run, status: 'complete', events: [...events], revision: events.length,
        snapshot: { events: [...events], report: { ...prefix, status: 'complete_valid' }, revision: events.length } }
      expect(reportRun(completed, form).status).toBe('complete_valid')
      completed.events[1] = { ...completed.events[1], seq: 99 }
      expect(() => reportRun(completed, form)).toThrow()
    }
  })
})
