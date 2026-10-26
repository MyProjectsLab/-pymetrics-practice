// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { stopV13FormRegistry } from './forms'
import { validateStopV13Form } from './forms/validate-v13'
import { scoreStop } from './scoring'
import { routeStop } from './training'
import { compareStop } from './comparison'
import type { StopResult } from './run'
import type { StopV13FormManifest, StopTrialOutcome } from './contracts'
import type { EngineEvent } from './engine/contracts'
import { createMemoryExposureRepository } from './exposure'
import { StopLocalStore } from './storage'
import type { StopLocalState } from './storage'

function outcomeJournal(form: StopV13FormManifest, choice: 'perfect' | 'always' | 'never' | 'late_two'): EngineEvent[] {
  const events: EngineEvent[] = []
  for (let index = 0; index < 80; index++) {
    const stimulus = form.sequence[index]
    const press = choice === 'always' || choice === 'perfect' && stimulus === 'GO' ||
      choice === 'late_two' && stimulus === 'GO' && !form.sequence.flatMap((value, i) => value === 'GO' && i >= 40 ? [i] : []).slice(0, 2).includes(index)
    const outcome: StopTrialOutcome = stimulus === 'GO' ? press ?
      { stimulus, kind: 'hit', responseTimeMs: 400 } : { stimulus, kind: 'miss', responseTimeMs: null } : press ?
      { stimulus, kind: 'false_alarm', responseTimeMs: 400 } : { stimulus, kind: 'correct_withhold', responseTimeMs: null }
    events.push({ schemaVersion: 'stop_engine_event_v1', sessionId: 'fixture', sequenceNumber: events.length + 1,
      timestampMs: events.length, type: 'trial_scheduled', payload: { trial: { phase: 'scored', index, stimulus } } } as EngineEvent)
    events.push({ schemaVersion: 'stop_engine_event_v1', sessionId: 'fixture', sequenceNumber: events.length + 1,
      timestampMs: events.length, type: 'trial_resolved', payload: { trialIndex: index, outcome,
        source: press ? 'response' : 'timeout' } } as EngineEvent)
  }
  return events
}

function result(form: StopV13FormManifest, choice: 'perfect' | 'always' | 'never' | 'late_two', mode: 'baseline' | 'retest' = 'baseline'): StopResult {
  return { mode, validity: 'valid', specificationVersion: '1.3', form, events: [],
    summarySnapshot: scoreStop(outcomeJournal(form, choice), form), setup: { visualProfile: 'standard',
      binding: { code: 'Space', label: 'Space' }, physicalKeyboard: true },
  } as unknown as StopResult
}

describe('Stop V1.3 variable-mix contracts', () => {
  it('checks every frozen new form and rejects changed sequence bytes', async () => {
    expect(stopV13FormRegistry.all).toHaveLength(14)
    for (const form of stopV13FormRegistry.all) expect(await validateStopV13Form(form)).toEqual([])
    const form = stopV13FormRegistry.all[0]
    const changed = { ...form, sequence: [...form.sequence.slice(0, 1), form.sequence[1] === 'GO' ? 'NO_GO' : 'GO', ...form.sequence.slice(2)] } as StopV13FormManifest
    expect((await validateStopV13Form(changed)).some(issue => issue.code === 'checksum')).toBe(true)
  })
  it('uses actual 28/52 and 45/35 denominators and the versioned router', () => {
    const low = stopV13FormRegistry.get('stop-v13-baseline-01')!
    const high = stopV13FormRegistry.get('stop-v13-baseline-04')!
    const perfect = result(low, 'perfect')
    expect(perfect.summarySnapshot.counts).toEqual({ hits: 28, misses: 0, withholds: 52, falseAlarms: 0 })
    expect(routeStop(perfect).drillId).toBe('maintenance')
    const always = result(low, 'always')
    expect(always.summarySnapshot.rates.overall).toBe(28 / 80)
    expect(always.summarySnapshot.counts.falseAlarms).toBe(52)
    expect(routeStop(always).drillId).toBe('withholding')
    const never = result(high, 'never')
    expect(never.summarySnapshot.counts).toEqual({ hits: 0, misses: 45, withholds: 35, falseAlarms: 0 })
    expect(routeStop(never).drillId).toBe('detection')
    expect(routeStop(result(low, 'late_two')).drillId).toBe('consistency')
  })
  it('holds timing route and accompanying timing comments at the exact sample gates', () => {
    const low = stopV13FormRegistry.get('stop-v13-baseline-01')!
    const perfect = result(low, 'perfect')
    const at = (count: number): StopResult => ({ ...perfect, summarySnapshot: { ...perfect.summarySnapshot,
      timing: { count, q1: 300, median: 400, q3: 450, iqr: 150 } } })
    expect(routeStop(at(19)).drillId).toBe('maintenance')
    expect(routeStop(at(20)).drillId).toBe('stability')
    const consistency = result(low, 'late_two')
    expect(routeStop(consistency).observed).toContain('Median timing-clean')
    const short = { ...consistency, summarySnapshot: { ...consistency.summarySnapshot,
      halfTiming: [{ count: 7, q1: 400, median: 400, q3: 400, iqr: 0 },
        { count: 12, q1: 400, median: 400, q3: 400, iqr: 0 }] as const } }
    expect(routeStop(short).drillId).toBe('consistency')
    expect(routeStop(short).observed).not.toContain('Median timing-clean')
  })
  it('applies the four/five and six/seven timing gates to actual block observations', () => {
    const form = stopV13FormRegistry.get('stop-v13-baseline-04')!
    const withClean = (firstCount: number, lastCount: number) => {
      const events = outcomeJournal(form, 'perfect')
      const retained = [firstCount, 20, 20, lastCount]
      const seen = [0, 0, 0, 0]
      return scoreStop(events.map(event => {
        if (event.type !== 'trial_resolved' || event.payload.outcome.kind !== 'hit') return event
        const block = Math.floor(event.payload.trialIndex / 20)
        const clean = seen[block]++ < retained[block]
        return { ...event, payload: { ...event.payload, outcome: {
          ...event.payload.outcome, responseTimeMs: clean ? 400 : 2000,
        } } } as EngineEvent
      }), form).speedAccuracy
    }
    expect(withClean(4, 7)).not.toContain('Median correct-GO response time:')
    expect(withClean(5, 7)).toContain('Median correct-GO response time:')
    expect(withClean(6, 7)).not.toContain('Correct-GO response-time IQR:')
    expect(withClean(7, 7)).toContain('Correct-GO response-time IQR:')
  })
  it('requires a 20-point false-alarm rise and two additional alarms for consistency', () => {
    const form = stopV13FormRegistry.get('stop-v13-baseline-03')!
    const routeWithLateAlarms = (count: number) => {
      let changed = 0
      const journal = outcomeJournal(form, 'perfect').map(event => {
        if (event.type !== 'trial_resolved' || event.payload.trialIndex < 40 ||
          event.payload.outcome.kind !== 'correct_withhold' || changed++ >= count) return event
        return { ...event, payload: { ...event.payload, source: 'response', outcome: {
          stimulus: 'NO_GO', kind: 'false_alarm', responseTimeMs: 400,
        } } } as EngineEvent
      })
      const baseline = result(form, 'perfect')
      return routeStop({ ...baseline, summarySnapshot: scoreStop(journal, form) })
    }
    expect(routeWithLateAlarms(3).candidates.find(value => value.id === 'consistency')?.triggered).toBe(false)
    expect(routeWithLateAlarms(4).drillId).toBe('consistency')
  })
  it('suppresses overall and raw-count directions across unlike mixes', () => {
    const low = stopV13FormRegistry.get('stop-v13-baseline-01')!
    const high = stopV13FormRegistry.get('stop-v13-retest-04')!
    const comparison = compareStop(result(low, 'always'), result(high, 'always', 'retest'))!
    expect(comparison.lines.join(' ')).toContain('different GO/NO-GO mixes')
    expect(comparison.lines.join(' ')).not.toContain('Overall accuracy changed')
    expect(comparison.details.join(' ')).not.toContain('Hits changed from')
    expect(comparison.details.join(' ')).not.toContain('Correct withholds changed from')
    expect(comparison.narrative).toBeNull()
    expect(comparison.lines.join(' ')).toContain('28 of 28')
    expect(comparison.lines.join(' ')).toContain('45 of 45')
  })
  it('allows an overall delta only for two V1.3 forms with the same mix', () => {
    const baseline = result(stopV13FormRegistry.get('stop-v13-baseline-01')!, 'always')
    const retest = result(stopV13FormRegistry.get('stop-v13-retest-01')!, 'never', 'retest')
    expect(compareStop(baseline, retest)?.lines[0]).toContain('Overall accuracy changed')
    expect(compareStop({ ...baseline, specificationVersion: '1.1' }, retest)).toBeNull()
  })
  it('prefers a matching unseen retest mix and falls back only after it is consumed', async () => {
    const baseline = { ...result(stopV13FormRegistry.get('stop-v13-baseline-01')!, 'perfect'), sessionId: 'base' }
    const chain = { id: 'chain', baseline, retest: null, drillAttempts: [], retestAttempts: [], status: 'drill_complete' } as unknown as import('./training').TrainingChain
    const state = { schemaVersion: 'stop_local_v1', installationId: 'fixture', results: { base: baseline },
      drafts: {}, chains: { chain }, retiredChains: {}, activeChainId: 'chain', exposures: {}, reservations: {} } as StopLocalState
    const store = Object.create(StopLocalStore.prototype) as StopLocalStore
    store.mutate = async change => change(state, { get: () => ({}) } as unknown as IDBObjectStore)
    const matching = await store.reserve('first', 'retest', 0, Date.now() + 10000, 'chain', chain, '1.3')
    expect(matching?.formId).toBe('stop-v13-retest-01')
    delete state.reservations.first
    state.exposures['stop-v13-retest-01'] = { formId: 'stop-v13-retest-01', exposedAtWall: '2026-10-09', visualProfile: 'standard', deleted: false, certainty: 'confirmed' }
    const fallback = await store.reserve('second', 'retest', 0, Date.now() + 10000, 'chain', chain, '1.3')
    expect(fallback?.formId).toBe('stop-v13-retest-02')
    const memory = createMemoryExposureRepository(stopV13FormRegistry.all)
    expect(memory.reserve('m1', () => 0, 'retest', undefined, '1.3', 28)?.id).toBe('stop-v13-retest-01')
    memory.expose('m1', 1)
    expect(memory.reserve('m2', () => 0, 'retest', undefined, '1.3', 28)?.id).toBe('stop-v13-retest-02')
  })
})
