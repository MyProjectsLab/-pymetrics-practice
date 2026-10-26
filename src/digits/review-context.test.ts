import { describe, expect, it } from 'vitest'
import { advanceDigits } from './engine'
import { actualDigitsAssistance, observedDigitsOnsets, removedDigitsReview } from './review-context'
import { closeTrial, initialRun, nextTrial, openEntry } from './test-support'

describe('Digits factual review context independent of saved authority', () => {
  it('labels actual undeclared accepted assistance before and after closure/invalidation', async () => {
    const ready = openEntry(await initialRun())
    const assisted = advanceDigits(ready, { kind: 'edit', atMs: ready.entryOpenedMs! + 1,
      value: ready.target!, assisted: true, source: 'assisted' })
    expect(assisted.profile.assistedEntryDeclared).toBe(false)
    expect(actualDigitsAssistance(assisted)).toBe(true)
    const closed = advanceDigits(assisted, { kind: 'submit', atMs: ready.entryOpenedMs! + 2 })
    expect(actualDigitsAssistance(closed)).toBe(true)
    expect(actualDigitsAssistance(advanceDigits(assisted, { kind: 'invalidate', atMs: ready.entryOpenedMs! + 3, reason: 'blur' }))).toBe(true)
    expect(actualDigitsAssistance(ready)).toBe(false)
  })
  it('retirement retains the exact known prefix and successor onset without inventing terminal facts', async () => {
    const checkpoint = closeTrial(await initialRun(), false)
    const successor = nextTrial(checkpoint)
    const observed = advanceDigits(successor, { kind: 'visual_onset', dueMs: successor.nextDueMs!, atMs: successor.nextDueMs! })
    const bytes = JSON.stringify(observed)
    expect(removedDigitsReview(observed)).toEqual({ status: 'incomplete', reason: 'saved_attempt_removed', presented: 2, closed: 1, unresolved: 1 })
    expect(observedDigitsOnsets(observed)).toEqual([{ trial: 1, digits: 4 }, { trial: 2, digits: 1 }])
    expect(JSON.stringify(observed)).toBe(bytes)
    expect(observed.events.some(event => event.type === 'invalidated')).toBe(false)
  })
  it('deletion-first factual review has no successor onset or invented unseen trial', async () => {
    const checkpoint = closeTrial(await initialRun(), false)
    expect(removedDigitsReview(checkpoint)).toMatchObject({ presented: 1, closed: 1, unresolved: 0 })
    expect(observedDigitsOnsets(checkpoint)).toEqual([{ trial: 1, digits: 4 }])
  })
})
