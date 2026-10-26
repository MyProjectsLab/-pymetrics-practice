import type { StopStimulus } from '../contracts'
import type { Cancel, FrameAdapter, Scheduler } from '../engine/contracts'
import { STANDARD_TIMING } from '../engine/contracts'
import { TOUCH_FORM_CHECKSUM, TOUCH_FORM_ID, TOUCH_SEQUENCE, TOUCH_WARMUP } from './form'

export type TouchPhase = 'ready' | 'warmup' | 'warmup_complete' | 'scored' | 'report'
export type TouchInput = 'touch_pointer' | 'assistive_click' | null
export type TouchOutcome = 'hit' | 'miss' | 'false_alarm' | 'correct_withhold'
export interface TouchRecord { phase: 'warmup' | 'scored'; index: number; stimulus: StopStimulus; outcome: TouchOutcome; input: TouchInput; onsetMs: number; offsetMs: number | null; presentation: 'offset_observed' | 'interrupted_before_offset'; resolvedMs: number }
export interface TouchReport { version: 'stop_touch_practice_result_v1'; inputProfile: 'touch_practice_v1'; formId: typeof TOUCH_FORM_ID; checksum: typeof TOUCH_FORM_CHECKSUM; status: 'completed' | 'early_exit'; reason?: string; warmup: readonly TouchRecord[]; scored: readonly TouchRecord[]; totals: { hit: number; miss: number; false_alarm: number; correct_withhold: number }; assistiveActivations: number }
export interface TouchSnapshot { phase: TouchPhase; trial: number; stimulus: StopStimulus | null; report: TouchReport | null }
export interface TouchControllerOptions { clock: () => number; scheduler: Scheduler; frames: FrameAdapter; showFixation: () => void; changed: (state: TouchSnapshot) => void }

export function validateTouchReport(report: TouchReport): boolean {
  if (report.version !== 'stop_touch_practice_result_v1' || report.inputProfile !== 'touch_practice_v1' || report.formId !== TOUCH_FORM_ID || report.checksum !== TOUCH_FORM_CHECKSUM || report.warmup.length > 8 || report.scored.length > 80 || report.scored.length > 0 && report.warmup.length !== 8 ||
    report.status === 'completed' && (report.warmup.length !== 8 || report.scored.length !== 80)) return false
  const records = [...report.warmup, ...report.scored]
  if (records.some((record, combinedIndex) => {
    const phase = combinedIndex < report.warmup.length ? 'warmup' : 'scored'
    const index = phase === 'warmup' ? combinedIndex : combinedIndex - report.warmup.length
    const expected = phase === 'warmup' ? TOUCH_WARMUP[index] : TOUCH_SEQUENCE[index]
    const interrupted = record.presentation === 'interrupted_before_offset' && record.offsetMs === null && report.status === 'early_exit' &&
      combinedIndex === records.length - 1 && (record.input !== null || record.resolvedMs >= record.onsetMs + STANDARD_TIMING.deadlineMs)
    const observed = record.presentation === 'offset_observed' && record.offsetMs !== null && Number.isFinite(record.offsetMs) && record.offsetMs >= record.onsetMs
    return record.phase !== phase || record.index !== index || record.stimulus !== expected || !Number.isFinite(record.onsetMs) || !Number.isFinite(record.resolvedMs) || (!interrupted && !observed) || record.resolvedMs < record.onsetMs ||
      (record.outcome === 'hit' || record.outcome === 'false_alarm') !== (record.input !== null) ||
      (record.stimulus === 'GO' ? !['hit', 'miss'].includes(record.outcome) : !['false_alarm', 'correct_withhold'].includes(record.outcome))
  })) return false
  const totals = { hit: 0, miss: 0, false_alarm: 0, correct_withhold: 0 }
  for (const record of report.scored) totals[record.outcome]++
  return Object.keys(totals).every(key => totals[key as TouchOutcome] === report.totals[key as TouchOutcome]) &&
    records.filter(record => record.input === 'assistive_click').length === report.assistiveActivations
}

export function createTouchController(options: TouchControllerOptions) {
  const { clock, scheduler, frames, showFixation, changed } = options
  let phase: TouchPhase = 'ready'
  let generation = 0
  let index = -1
  let stimulus: StopStimulus | null = null
  let onset: number | null = null
  let offset: number | null = null
  let resolution: number | null = null
  let response: TouchInput = null
  let owner: number | null = null
  let live = true
  let report: TouchReport | null = null
  const warmup: TouchRecord[] = [], scored: TouchRecord[] = []
  const jobs = new Set<Cancel>()
  function snapshot(): TouchSnapshot { return { phase, trial: Math.max(0, index + 1), stimulus, report } }
  function publish() { if (live) changed(snapshot()) }
  function cancelJobs() { generation++; for (const cancel of jobs) cancel(); jobs.clear() }
  function guardedSchedule(time: number, after: boolean, fn: () => void) {
    const g = generation
    let cancel: Cancel
    cancel = (after ? scheduler.after : scheduler.at)(time, () => { jobs.delete(cancel); if (live && generation === g) fn() })
    jobs.add(cancel)
  }
  function guardedFrame(kind: 'onset' | 'offset', notBeforeMs: number, fn: () => void) {
    const g = generation
    let cancel: Cancel
    cancel = frames.request({ kind, trial: { phase: phase === 'warmup' ? 'warmup' : 'scored', index, stimulus: stimulus! }, notBeforeMs }, () => { jobs.delete(cancel); if (live && generation === g) fn() })
    jobs.add(cancel)
  }
  function makeReport(status: TouchReport['status'], reason?: string): TouchReport {
    const totals = { hit: 0, miss: 0, false_alarm: 0, correct_withhold: 0 }
    for (const record of scored) totals[record.outcome]++
    return { version: 'stop_touch_practice_result_v1', inputProfile: 'touch_practice_v1', formId: TOUCH_FORM_ID, checksum: TOUCH_FORM_CHECKSUM, status, reason,
      warmup: Object.freeze([...warmup]), scored: Object.freeze([...scored]), totals, assistiveActivations: [...warmup, ...scored].filter(record => record.input === 'assistive_click').length }
  }
  function end(reason: string) {
    if (!live || phase === 'report') return
    cancelJobs()
    if (resolution !== null && offset === null && onset !== null && stimulus !== null) {
      const records = phase === 'warmup' ? warmup : scored
      if (records.length !== index) throw new Error('Interrupted response index mismatch')
      records.push(Object.freeze({ phase: phase as 'warmup' | 'scored', index, stimulus, onsetMs: onset, offsetMs: null,
        presentation: 'interrupted_before_offset' as const, resolvedMs: resolution, input: response,
        outcome: response === null ? stimulus === 'GO' ? 'miss' as const : 'correct_withhold' as const :
          stimulus === 'GO' ? 'hit' as const : 'false_alarm' as const }))
    }
    phase = 'report'; stimulus = null; report = makeReport('early_exit', reason)
    if (!validateTouchReport(report)) throw new Error('Touch report validation failed')
    publish()
  }
  function advance() {
    if (offset === null || resolution === null || onset === null || stimulus === null) return
    const record: TouchRecord = { phase: phase as 'warmup' | 'scored', index, stimulus, onsetMs: onset, offsetMs: offset, presentation: 'offset_observed', resolvedMs: resolution,
      input: response, outcome: response ? stimulus === 'GO' ? 'hit' : 'false_alarm' : stimulus === 'GO' ? 'miss' : 'correct_withhold' }
    const records = phase === 'warmup' ? warmup : scored
    if (records.length !== index) throw new Error('Touch sequence index mismatch')
    records.push(Object.freeze(record))
    const eligible = Math.max(offset, resolution) + STANDARD_TIMING.fixationMs
    const last = index === (phase === 'warmup' ? TOUCH_WARMUP : TOUCH_SEQUENCE).length - 1
    guardedSchedule(eligible, false, () => {
      if (last) {
        if (phase === 'warmup') { phase = 'warmup_complete'; stimulus = null; index = -1; publish() }
        else { phase = 'report'; stimulus = null; report = makeReport('completed'); if (!validateTouchReport(report)) throw new Error('Touch report validation failed'); publish() }
      } else nextTrial()
    })
  }
  function resolve(at: number, input: TouchInput) {
    if (resolution !== null || onset === null) return
    resolution = at; response = input; advance()
  }
  function nextTrial() {
    index++
    const sequence = phase === 'warmup' ? TOUCH_WARMUP : TOUCH_SEQUENCE
    stimulus = sequence[index]
    onset = null; offset = null; resolution = null; response = null
    publish()
    guardedFrame('onset', clock(), () => {
      onset = clock(); publish()
      guardedFrame('offset', onset + STANDARD_TIMING.visibilityMs, () => { offset = clock(); advance() })
      guardedSchedule(onset + STANDARD_TIMING.deadlineMs, true, () => resolve(clock(), null))
    })
  }
  function startBatch(next: 'warmup' | 'scored') {
    if (!live || phase !== (next === 'warmup' ? 'ready' : 'warmup_complete') || owner !== null) return false
    cancelJobs(); phase = next; index = -1; stimulus = null; showFixation(); publish()
    guardedSchedule(clock() + 1000, false, nextTrial)
    return true
  }
  function pointerDown(pointerId: number, isPrimary: boolean, pointerType: string) {
    if (!live || phase === 'report') return false
    if (pointerType !== 'touch' || !isPrimary) return false
    if (owner !== null) return false
    owner = pointerId
    return accept('touch_pointer')
  }
  function pointerEnd(pointerId: number) { if (owner === pointerId) owner = null }
  function accept(input: Exclude<TouchInput, null>) {
    const at = clock()
    if ((phase !== 'warmup' && phase !== 'scored') || onset === null || resolution !== null || at < onset || at > onset + STANDARD_TIMING.deadlineMs) return false
    resolve(at, input)
    return true
  }
  function click(metadata: { detail: number; pointerType?: string; firesTouchEvents?: boolean } = { detail: 0 }) {
    // Browser compatibility clicks have pointer provenance (including WebKit's
    // mouse-typed click after a touch). Only a provenance-free activation can
    // represent a keyboard or assistive click.
    if (metadata.detail !== 0 || metadata.pointerType || metadata.firesTouchEvents) return false
    if (owner !== null) return false
    return accept('assistive_click')
  }
  return Object.freeze({ snapshot, startWarmup: () => startBatch('warmup'), startScored: () => startBatch('scored'), pointerDown, pointerEnd, click,
    canStart: () => owner === null && (phase === 'ready' || phase === 'warmup_complete'), exit: end,
    dispose() { if (!live) return; cancelJobs(); live = false; owner = null; report = null } })
}
