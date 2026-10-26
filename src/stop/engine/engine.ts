import { createEventRecorder } from '../../core/events'
import type { StopTrialDefinition, StopTrialOutcome } from '../contracts'
import { ENGINE_EVENT_VERSION, STANDARD_TIMING, VALIDITY_RULE_VERSION } from './contracts'
import type { Cancel, EngineOptions, EnginePayloads, EngineState, EngineTiming, IgnoreReason, Setting, TimingIssue, TrialResult } from './contracts'
import { RULE, timingSeverity } from './rules'
import { inspectTrialEvents } from './integrity'

/** Headless protected interval. A finished batch is not a completed/valid product session. */
export function createStopEngine(options: EngineOptions) {
  const { clock, scheduler, frames, sink, responseKey, sessionId, sequenceOffset = 0 } = options
  if (!responseKey) throw new Error('A preflight-approved response key is required')
  let now = 0
  const recorder = createEventRecorder<EnginePayloads, typeof ENGINE_EVENT_VERSION>({ sessionId, schemaVersion: ENGINE_EVENT_VERSION, sequenceOffset, clock: () => now })
  let state: EngineState = 'idle'
  let held = false
  let focused = true
  let blurAt: number | null = null
  let blurSequence = 0
  let blurCancel: Cancel | null = null
  let sinkFailed = false
  let emitting = false
  let batch = 0
  let trials: readonly StopTrialDefinition[] = []
  let cursor = -1
  let onset: number | null = null
  let resolvedAt: number | null = null
  let resolvedByResponse = false
  let offsetAt: number | null = null
  let transitionAt: number | null = null
  let timingCount = 0
  let warmupAnomalies = 0
  let invalidRule: string | null = null
  const notes = new Set<string>()
  const excluded = new Set<number>()
  const results: Omit<TrialResult, 'timingExcluded'>[] = []
  const jobs = new Set<Cancel>()
  const counts = { anticipatory: 0, premature: 0, wrong: 0, extra: 0 }
  let deadlineCancel: Cancel | null = null
  let pendingTrials: readonly StopTrialDefinition[] | null = null
  let batchStartSequence = 0
  let timing: EngineTiming = STANDARD_TIMING
  let protectionActive = false
  let warmupActive = false

  const protectedNow = () => state !== 'idle' && state !== 'invalid' && state !== 'closed'
  const activeBatch = () => protectedNow() && state !== 'waiting' && state !== 'warmup_restart_required'
  const trial = () => trials[cursor]
  const trialIndex = () => trial()?.index ?? null
  const scored = () => (trial()?.phase ?? trials[0]?.phase) !== 'warmup' && activeBatch()
  const unprotectedWarmup = () => options.deferProtection === true && !protectionActive && warmupActive && protectedNow()
  const unprotectedPause = () => options.deferProtection === true && !protectionActive && !warmupActive && protectedNow()
  function interruptWarmup(reason: 'hidden' | 'blur' | 'pagehide' | 'freeze' | 'viewport' | 'settings', trigger: number) {
    if (!unprotectedWarmup()) return
    cancelJobs(); blurCancel?.(); blurAt = null
    const seq = emit('warmup_interrupted', { reason, triggerSequenceNumber: trigger })
    state = 'warmup_restart_required'
    warmupActive = false
    emit('warmup_restart_required', { triggerSequenceNumber: seq })
  }

  function emit<K extends keyof EnginePayloads>(type: K, payload: EnginePayloads[K]) {
    const event = recorder.record(type, payload)
    if (!sinkFailed) {
      emitting = true
      try { sink(event) } catch { sinkFailed = true } finally { emitting = false }
      if (sinkFailed && state !== 'invalid') invalidate(RULE.integrity, event.sequenceNumber)
    }
    return event.sequenceNumber
  }
  function cancelJobs() {
    for (const cancel of jobs) cancel()
    jobs.clear()
  }
  function invalidate(ruleId: string, triggerSequenceNumber: number) {
    if (state === 'invalid' || state === 'closed') return
    state = 'invalid'
    invalidRule = ruleId
    cancelJobs()
    blurCancel?.()
    emit('session_invalidated', { ruleId, triggerSequenceNumber })
  }
  function checkBlurDuration() {
    if (blurAt !== null && now - blurAt > 1000) {
      if (unprotectedWarmup()) interruptWarmup('blur', blurSequence)
      else invalidate(RULE.blur, blurSequence)
      return false
    }
    return true
  }
  function sample(checkFocus = true) {
    if (emitting) throw new Error('Event sinks must not re-enter the engine')
    if (!protectedNow()) return false
    let value: number
    try { value = clock() } catch { value = Number.NaN }
    if (!Number.isFinite(value) || value < now || value < 0) {
      // Preserve the last reliable envelope time; never manufacture a clean timestamp.
      if (unprotectedWarmup()) anomaly(['timestamp'], now, Number.isFinite(value) ? value : Number.NaN, 'severe')
      else invalidate(RULE.severeTiming, emit('timing_anomaly', { trialIndex: trialIndex(), issues: ['timestamp'], severity: 'severe', expectedMs: now, observedMs: Number.isFinite(value) ? value : null }))
      return false
    }
    now = value
    return !checkFocus || checkBlurDuration()
  }
  function schedule(time: number, exclusive: boolean, callback: () => void, isBlur = false): Cancel {
    let canceled = false
    let dispatched = false
    const scheduledBatch = batch
    let adapterCancel: Cancel = () => {}
    const cancel = () => { canceled = true; adapterCancel(); jobs.delete(cancel) }
    if (!isBlur) jobs.add(cancel)
    adapterCancel = scheduler[exclusive ? 'after' : 'at'](time, () => {
      if (canceled || (!isBlur && scheduledBatch !== batch) || !sample()) return
      if (dispatched) { anomaly(['integrity'], time, now, 'severe'); return }
      dispatched = true
      jobs.delete(cancel)
      if (now < time || (exclusive && now === time)) {
        anomaly(['timestamp'], time, now, 'severe')
        return
      }
      if (!isBlur && now - time > 500) {
        anomaly(['transition'], time, now, 'severe')
        return
      }
      callback()
    })
    return cancel
  }
  function anomaly(issues: TimingIssue[], expectedMs: number, observedMs: number, severity: 'non_severe' | 'severe') {
    const index = trialIndex()
    if (index !== null) excluded.add(index)
    const seq = emit('timing_anomaly', { trialIndex: index, issues, expectedMs, observedMs: Number.isFinite(observedMs) ? observedMs : null, severity })
    if (!protectedNow()) return
    if ((warmupActive || (trial()?.phase ?? trials[0]?.phase) === 'warmup') && !issues.includes('integrity')) {
      warmupAnomalies++
      cancelJobs()
      if (warmupAnomalies === 1) {
        state = 'warmup_restart_required'
        warmupActive = false
        emit('warmup_restart_required', { triggerSequenceNumber: seq })
      } else invalidate(RULE.warmupTiming, seq)
      return
    }
    if (severity === 'severe') invalidate(issues.includes('integrity') ? RULE.integrity : RULE.severeTiming, seq)
    else if (++timingCount >= 2) invalidate(RULE.repeatedTiming, seq)
    else {
      notes.add(RULE.timingNote)
      emit('quality_note', { ruleId: RULE.timingNote, triggerSequenceNumber: seq })
    }
  }
  function frame(kind: 'onset' | 'offset', eligible: number, callback: () => void) {
    const currentBatch = batch
    const definition = trial()
    let delivered = false
    let canceled = false
    let adapterCancel: Cancel = () => {}
    const cancel = () => { canceled = true; adapterCancel(); jobs.delete(cancel) }
    jobs.add(cancel)
    // Missing frame confirmations cannot leave an apparently live run waiting forever.
    const latest = kind === 'offset' ? onset! + 500 : eligible + 500
    const watchdog = schedule(latest, true, () => {
      if (!delivered) anomaly([kind === 'offset' ? 'visibility' : 'onset'], eligible, now, 'severe')
    })
    adapterCancel = frames.request(Object.freeze({ kind, trial: definition, notBeforeMs: eligible }), () => {
      // A confirmed onset is an observation even if its quality immediately fails.
      if (canceled || currentBatch !== batch || !sample(kind !== 'onset')) return
      if (delivered) { anomaly(['integrity'], eligible, now, 'severe'); return }
      delivered = true
      jobs.delete(cancel)
      watchdog()
      if (kind === 'onset' && now < eligible) { anomaly(['timestamp'], eligible, now, 'severe'); return }
      callback()
    })
  }
  function requestOnset(eligible: number, initial: boolean) {
    const priorTransition = transitionAt
    const priorIndex = trialIndex()
    cursor++
    onset = null
    resolvedAt = null
    offsetAt = null
    transitionAt = null
    resolvedByResponse = false
    state = 'awaiting_onset'
    emit('trial_scheduled', { trial: trial(), eligibleAtMs: eligible })
    if (!protectedNow()) return
    frame('onset', eligible, () => {
      emit('fixation_ended', { kind: initial ? 'initial' : 'post_resolution', expectedAtMs: eligible, trialIndex: priorIndex })
      if (!activeBatch()) return
      onset = now
      emit('stimulus_presented', { trialIndex: trial().index, stimulus: trial().stimulus, confirmedOnsetMs: now, eligibleAtMs: eligible })
      if (!activeBatch() || !checkBlurDuration()) return
      const delay = now - eligible
      const issues: TimingIssue[] = []
      const onsetSeverity = timingSeverity('onset', delay)
      if (onsetSeverity !== 'clean') issues.push('onset')
      const postSeverity = priorTransition === null ? 'clean' : timingSeverity('post_resolution', now - priorTransition, timing.fixationMs)
      if (postSeverity !== 'clean') issues.push('post_resolution')
      // One delayed transition may violate two bands; record both causes in one observation.
      if (issues.length) {
        anomaly(issues, eligible, now, onsetSeverity === 'severe' || postSeverity === 'severe' ? 'severe' : 'non_severe')
      }
      if (!activeBatch()) return
      state = 'response'
      frame('offset', onset + timing.visibilityMs, () => {
        const duration = now - onset!
        const seq = emit('stimulus_removed', { trialIndex: trial().index, confirmedOffsetMs: now, visibleDurationMs: duration })
        offsetAt = now
        if (duration < 0) { invalidate(RULE.integrity, seq); return }
        const severity = timingSeverity('visibility', duration)
        if (severity !== 'clean') anomaly(['visibility'], onset! + timing.visibilityMs, now, severity)
        beginPostTrialInterval()
      })
      deadlineCancel = schedule(onset + timing.deadlineMs, true, () => timeout())
    })
  }
  function finishPostResolution() {
    if (offsetAt === null || transitionAt === null) { anomaly(['integrity'], now, now, 'severe'); return }
    if (cursor + 1 < trials.length) {
      requestOnset(transitionAt + timing.fixationMs, false)
      return
    }
    const duration = now - transitionAt
    const severity = timingSeverity('post_resolution', duration, timing.fixationMs)
    if (severity !== 'clean') anomaly(['post_resolution'], transitionAt + timing.fixationMs, now, severity)
    if (!activeBatch()) return
    emit('fixation_ended', { kind: 'post_resolution', expectedAtMs: transitionAt + timing.fixationMs, trialIndex: trialIndex() })
    const check = inspectTrialEvents(recorder.snapshot().filter(e => e.sequenceNumber > batchStartSequence), trials, responseKey, timing.deadlineMs)
    const seq = emit('integrity_checked', check)
    if (!check.valid) { invalidate(RULE.integrity, seq); return }
    state = 'waiting'
    if (trials[0].phase === 'warmup') warmupActive = false
    emit('batch_finished', { phase: trials[0].phase, trialCount: trials.length })
  }
  function resolve(outcome: StopTrialOutcome, source: 'response' | 'timeout', time: number, triggerSequenceNumber: number) {
    if (state !== 'response') return
    resolvedAt = time
    resolvedByResponse = source === 'response'
    state = 'post_resolution'
    deadlineCancel?.()
    results.push(Object.freeze({ trial: trial(), outcome: Object.freeze(outcome), resolvedAtMs: time }))
    emit('trial_resolved', { trialIndex: trial().index, outcome, source, resolvedAtMs: time, triggerSequenceNumber })
    beginPostTrialInterval()
  }
  function beginPostTrialInterval() {
    if (state !== 'post_resolution' || resolvedAt === null || offsetAt === null || transitionAt !== null) return
    // M2B-02: resolve the outcome immediately, but wait for confirmed offset before
    // starting the full fixation interval. Never substitute the requested offset.
    transitionAt = Math.max(resolvedAt, offsetAt)
    emit('fixation_started', { kind: 'post_resolution', expectedAtMs: transitionAt, trialIndex: trialIndex() })
    if (activeBatch()) schedule(transitionAt + timing.fixationMs, false, finishPostResolution)
  }
  function timeout() {
    if (state !== 'response') return
    const deadline = onset! + timing.deadlineMs
    const severity = timingSeverity('deadline', now - deadline)
    if (severity !== 'clean') anomaly(['deadline'], deadline, now, severity)
    if (!activeBatch()) return
    const seq = emit('trial_timed_out', { trialIndex: trial().index, deadlineMs: deadline, latenessMs: now - deadline })
    const outcome: StopTrialOutcome = trial().stimulus === 'GO'
      ? { stimulus: 'GO', kind: 'miss', responseTimeMs: null }
      : { stimulus: 'NO_GO', kind: 'correct_withhold', responseTimeMs: null }
    resolve(outcome, 'timeout', deadline, seq)
  }
  function ignored(reason: IgnoreReason, inputSequenceNumber: number) {
    const seq = emit('response_ignored', { trialIndex: trialIndex(), reason, inputSequenceNumber })
    if (!activeBatch()) return
    if (scored() && reason === 'fixation' && ++counts.premature >= 3) invalidate(RULE.premature, seq)
    if (scored() && reason === 'wrong_key' && ++counts.wrong >= 5) invalidate(RULE.wrong, seq)
    if (reason === 'extra') {
      counts.extra++
      if (counts.extra === 5) { notes.add(RULE.extraNote); emit('quality_note', { ruleId: RULE.extraNote, triggerSequenceNumber: seq }) }
      if (counts.extra >= 10) invalidate(RULE.extra, seq)
    }
  }
  function beginInitialFixation() {
    if (!pendingTrials || held || !focused) return
    trials = pendingTrials
    pendingTrials = null
    cursor = -1
    onset = null
    resolvedAt = null
    offsetAt = null
    transitionAt = null
    state = 'initial_fixation'
    emit('fixation_started', { kind: 'initial', expectedAtMs: now, trialIndex: null })
    const eligible = now + 1000
    schedule(eligible, false, () => requestOnset(eligible, true))
  }

  return Object.freeze({
    begin({ responseKeyHeld = false } = {}) {
      if (state !== 'idle') throw new Error('Protection can begin only once')
      state = 'waiting'
      if (!sample()) return
      held = responseKeyHeld
      if (!options.deferProtection) {
        protectionActive = true
        emit('protection_started', { responseKey, held })
      }
    },
    activateProtection() {
      if (!options.deferProtection || protectionActive || state !== 'waiting') throw new Error('Scored protection requires completed warm-up')
      if (!sample()) return false
      protectionActive = true
      emit('protection_started', { responseKey, held })
      return protectedNow()
    },
    armWarmup() {
      if (!options.deferProtection || protectionActive || !['waiting', 'warmup_restart_required'].includes(state)) return false
      // Acknowledge restart before the asynchronous initial frame. Restoration
      // events must not re-publish the previous restart request while it waits.
      state = 'waiting'
      warmupActive = true
      return true
    },
    initialWarmupFrameFailure() {
      if (!unprotectedWarmup() || !sample()) return
      anomaly(['onset'], now, now, 'severe')
    },
    abortPreOnset() {
      if (!protectionActive || state === 'closed' || state === 'invalid' ||
        trials[0]?.phase === 'scored' && onset !== null) return false
      if (!sample()) return false
      cancelJobs(); blurCancel?.()
      emit('pre_onset_aborted', { reason: 'reservation_expired' })
      state = 'closed'
      return true
    },
    start(definitions: readonly StopTrialDefinition[], batchTiming: EngineTiming = STANDARD_TIMING) {
      if (state !== 'waiting' && state !== 'warmup_restart_required') throw new Error('Start requires an idle protected interval or a warm-up restart')
      if (!definitions.length || !['warmup', 'scored', 'drill'].includes(definitions[0].phase) || definitions.some((t, i) => !Number.isInteger(t.index) || t.index < 0 || !['GO', 'NO_GO'].includes(t.stimulus) || t.phase !== definitions[0].phase || definitions.findIndex(d => d.index === t.index) !== i)) throw new Error('Supply a nonempty single-phase batch with unique trial indices')
      if (![batchTiming.visibilityMs, batchTiming.deadlineMs, batchTiming.fixationMs].every(Number.isFinite) || batchTiming.visibilityMs !== 200 || batchTiming.deadlineMs < 1000 || batchTiming.deadlineMs > 1200 || ![1000, 1200].includes(batchTiming.fixationMs)) throw new Error('Unsupported Stop batch timing')
      if (state === 'warmup_restart_required' && definitions[0].phase !== 'warmup') throw new Error('Warm-up must restart before another phase')
      if (!sample()) return
      cancelJobs()
      batch++
      batchStartSequence = recorder.snapshot().at(-1)?.sequenceNumber ?? sequenceOffset
      trials = Object.freeze(definitions.map(t => Object.freeze({ ...t })))
      timing = Object.freeze({ ...batchTiming })
      pendingTrials = trials
      results.length = 0
      excluded.clear()
      cursor = -1
      state = 'arming'
      beginInitialFixation()
    },
    keyDown(key: string, repeated = false) {
      if (!sample()) return
      const wasHeld = held
      if (key === responseKey) held = true
      const seq = emit('input_received', { key, repeated, held: wasHeld, focused, trialIndex: trialIndex() })
      if (!protectedNow()) return
      if (repeated) { ignored('repeat', seq); return }
      if (key !== responseKey) { ignored('wrong_key', seq); return }
      if (wasHeld) { ignored('held', seq); return }
      if (!focused) { ignored('unfocused', seq); return }
      if (state === 'response') {
        const rt = now - onset!
        if (rt > timing.deadlineMs) { ignored('late', seq); if (protectedNow()) timeout(); return }
        if (rt < 0) { anomaly(['timestamp'], onset!, now, 'severe'); return }
        const responseSeq = emit('response_accepted', { trialIndex: trial().index, responseTimeMs: rt, anticipatory: rt < 100, inputSequenceNumber: seq })
        if (rt < 100) excluded.add(trial().index)
        const outcome: StopTrialOutcome = trial().stimulus === 'GO'
          ? { stimulus: 'GO', kind: 'hit', responseTimeMs: rt }
          : { stimulus: 'NO_GO', kind: 'false_alarm', responseTimeMs: rt }
        resolve(outcome, 'response', now, responseSeq)
        if (rt < 100 && activeBatch() && ++counts.anticipatory >= 3) invalidate(RULE.anticipatory, responseSeq)
      } else if (state === 'post_resolution' && onset !== null) {
        // A fresh press after an accepted response is extra even beyond the deadline.
        // Also retain the late classification without counting the input twice.
        if (resolvedByResponse) ignored('extra', seq)
        if (protectedNow() && now - onset > timing.deadlineMs) ignored('late', seq)
      } else ignored('fixation', seq)
    },
    keyUp(key: string) {
      if (!sample() || key !== responseKey) return
      held = false
      emit('key_released', { key })
      if (state === 'arming') beginInitialFixation()
    },
    visibility(visible: boolean) {
      if (!sample()) return
      const seq = emit('visibility_changed', { visible })
      if (!visible) {
        if (unprotectedWarmup()) interruptWarmup('hidden', seq)
        else if (!unprotectedPause()) invalidate(RULE.hidden, seq)
      }
    },
    focus(value: boolean) {
      if (!sample() || focused === value) return
      focused = value
      const duration = blurAt === null ? null : now - blurAt
      const seq = emit('focus_changed', { focused, durationMs: duration })
      if (!value) {
        if (unprotectedPause()) return
        blurAt = now
        blurSequence = seq
        blurCancel = schedule(now + 1000, true, () => {
          if (unprotectedWarmup()) interruptWarmup('blur', seq)
          else invalidate(RULE.blur, seq)
        }, true)
      } else {
        blurCancel?.()
        blurAt = null
        if (state === 'arming') beginInitialFixation()
      }
    },
    lifecycle(value: 'pagehide' | 'freeze' | 'resume' | 'pageshow') {
      if (!sample()) return
      const seq = emit('page_lifecycle_changed', { state: value })
      if (unprotectedWarmup() && (value === 'pagehide' || value === 'freeze')) interruptWarmup(value, seq)
      else if (!unprotectedPause() && !unprotectedWarmup()) invalidate(RULE.lifecycle, seq)
    },
    resize(width: number, height: number) {
      if (!sample()) return
      const seq = emit('viewport_changed', { width, height })
      if (!Number.isFinite(width) || !Number.isFinite(height) || width < 768 || height < 600) {
        if (unprotectedWarmup()) interruptWarmup('viewport', seq)
        else if (!unprotectedPause()) invalidate(RULE.viewport, seq)
      }
    },
    settingChanged(setting: Setting) {
      if (!sample()) return
      const seq = emit('setting_changed', { setting })
      if (unprotectedWarmup()) interruptWarmup('settings', seq)
      else if (!unprotectedPause()) invalidate(RULE.settings, seq)
    },
    /** Integration failures use the same versioned integrity rule and stop immediately. */
    technicalFailure(detail: string) {
      if (!sample()) return
      invalidate(RULE.integrity, emit('integrity_checked', { valid: false, detail }))
    },
    /** Caller audits its retained sink copy before creating a product completion record. */
    verifyRetainedEvents(events: readonly import('./contracts').EngineEvent[]) {
      if (!sample()) return
      const canonical = recorder.snapshot()
      const same = JSON.stringify(events) === JSON.stringify(canonical)
      const seq = emit('integrity_checked', { valid: same, detail: same ? 'Retained journal matches' : 'Retained journal mismatch' })
      if (!same) invalidate(RULE.integrity, seq)
    },
    recordCompletion(payload: import('./contracts').EnginePayloads['session_completed']) {
      if (state !== 'waiting') throw new Error('Cannot complete during a batch')
      if (!sample()) return
      emit('session_completed', payload)
    },
    /** M2B-2 calls only after its completion record exists; this creates no product result. */
    endProtection() {
      if (state !== 'waiting') throw new Error('Cannot end protection during a batch')
      if (!sample()) return
      emit('protection_ended', {})
      if (!protectedNow()) return
      state = 'closed'
      cancelJobs()
    },
    snapshot() {
      return Object.freeze({
        state, held, protectionActive, ruleVersion: VALIDITY_RULE_VERSION, invalidRule,
        // Never claim valid: forms, denominators and completion belong to later milestones.
        quality: invalidRule ? 'invalid' as const : notes.size ? 'with_note' as const : 'clean' as const,
        notes: Object.freeze([...notes]), counts: Object.freeze({ ...counts }),
        results: Object.freeze(results.map(r => Object.freeze({ ...r, timingExcluded: excluded.has(r.trial.index) }))),
        events: recorder.snapshot(),
      })
    },
  })
}
export type StopEngine = ReturnType<typeof createStopEngine>
