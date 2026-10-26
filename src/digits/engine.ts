import { DIGITS_EVENT_VERSION, DIGITS_SCORING_VERSION, DIGITS_SPEC_VERSION } from './contracts'
import type { ClosedTrial, Command, DigitsEvent, EventType, Form, Identity, Profile, RunState } from './contracts'
import { isVerifiedDigitsForm, digitsTarget } from './forms'
import { classifyPositions } from './scoring'

function assert(condition: unknown, reason: string): asserts condition {
  if (!condition) throw Error(`Digits engine: ${reason}`)
}
function time(value: unknown) {
  assert(typeof value === 'number' && Number.isFinite(value) && value >= 0, 'invalid time')
}
function same(a: unknown, b: unknown) { return JSON.stringify(a) === JSON.stringify(b) }
function append(state: RunState, type: EventType, atMs: number,
  detail: DigitsEvent['detail'] = {}): RunState {
  assert(!state.events.length || atMs >= state.events[state.events.length - 1].atMs,
    'event time regressed')
  const event: DigitsEvent = { schemaVersion: DIGITS_EVENT_VERSION,
    installationId: state.identity.installationId, sessionId: state.identity.sessionId,
    formId: state.form.id, clockDomainId: state.identity.clockDomainId,
    sequenceNumber: state.events.length + 1, block: 0,
    trialIndex: state.trialIndex, atMs, type, detail }
  return { ...state, events: [...state.events, event] }
}
function invalid(state: RunState, atMs: number, reason: string): RunState {
  if (state.phase === 'invalid' || state.phase === 'completed') return state
  return append({ ...state, phase: 'invalid', invalidReason: reason,
    nextDueMs: null }, 'invalidated', atMs, { reason })
}
function frame(state: RunState, dueMs: number, atMs: number, type: 'digit_presented' | 'digit_ended' |
  'entry_opened', detail: DigitsEvent['detail']): RunState {
  assert(state.nextDueMs === dueMs && atMs >= dueMs, 'stage due time')
  const latenessMs = atMs - dueMs
  let next = append({ ...state, lastFrameMs: atMs }, type, atMs,
    { ...detail, dueMs, actualMs: atMs, latenessMs })
  if (latenessMs > 50 && latenessMs <= 250)
    next = append(next, 'quality_note', atMs, { reason: 'visual_lateness', latenessMs })
  if (latenessMs > 250) next = invalid(next, atMs, 'visual_timing')
  return next
}
function close(state: RunState, atMs: number, kind: 'submit' | 'skip' | 'timeout'): RunState {
  assert(state.phase === 'entry' && state.entryOpenedMs !== null &&
    state.entryDeadlineMs !== null && atMs >= state.entryOpenedMs, 'entry not open')
  const timedOut = kind === 'timeout' || atMs >= state.entryDeadlineMs
  assert(!timedOut || atMs >= state.entryDeadlineMs, 'early timeout')
  const skipped = kind === 'skip' && !timedOut
  const target = currentDigitsTrial(state).digits
  const answer = skipped ? '' : state.draft
  const source = timedOut ? 'timeout' : skipped ?
    (state.profile.entryMethod === 'keyboard' ? 'keyboard' : 'keypad') :
    state.draftAssisted ? 'assisted' : state.profile.entryMethod
  const item: ClosedTrial = { index: state.trialIndex, target, answer, skipped,
    timedOut, assistedEntry: state.draftAssisted, source,
    exactCorrect: !skipped && !timedOut && answer === target }
  const classification = classifyPositions(target, answer)
  let next = append(state, 'answer_committed', atMs, { answer, skipped, timedOut,
    assistedEntry: item.assistedEntry, source })
  const wrongCount = state.wrongCount + (item.exactCorrect ? 0 : 1)
  const reason = wrongCount === 3 ? 'three_mistakes' as const :
    state.trialIndex === 40 ? 'practice_limit_reached' as const : null
  const nextLength = reason ? null : item.exactCorrect ?
    Math.min(16, state.length + 1) : Math.max(2, state.length - 1)
  next = append({ ...next, closed: [...state.closed, item], wrongCount }, 'trial_closed', atMs,
    { targetLength: target.length, wrongCount, exactCorrect: item.exactCorrect, nextLength,
      positionMatches: classification.positionMatches,
      substitutions: classification.substitutions,
      transpositionPairs: classification.transpositionPairs,
      missingSuffix: classification.missingSuffix })
  if (reason) next = append({ ...next, phase: 'completed', nextDueMs: null,
    completionReason: reason }, 'session_completed', atMs,
    { reason, wrongCount, closedTrials: next.closed.length })
  else next = { ...next, phase: 'feedback', length: nextLength!, nextDueMs: null }
  return next
}

export function armDigits(form: Form, identity: Identity, profile: Profile, atMs: number): RunState {
  assert(isVerifiedDigitsForm(form), 'unverified form')
  time(atMs)
  assert(form.mode === profile.mode &&
    (profile.entryWindow === 20000 || profile.entryWindow === 35000) &&
    (profile.entryMethod === 'keyboard' || profile.entryMethod === 'keypad') &&
    typeof profile.highContrast === 'boolean' && typeof profile.reducedMotion === 'boolean' &&
    typeof profile.assistedEntryDeclared === 'boolean' &&
    typeof profile.browserContext?.userAgent === 'string' &&
    profile.browserContext.userAgent.length <= 512 &&
    Number.isSafeInteger(profile.browserContext.viewportWidth) && profile.browserContext.viewportWidth > 0 &&
    Number.isSafeInteger(profile.browserContext.viewportHeight) && profile.browserContext.viewportHeight > 0 &&
    Number.isFinite(profile.browserContext.devicePixelRatio) && profile.browserContext.devicePixelRatio > 0 &&
    (profile.mode === 'visual' ? profile.voice === null :
      !!profile.voice && profile.voice.localService === true), 'profile')
  assert([identity.installationId, identity.sessionId, identity.requestId, identity.clockDomainId]
    .every(id => typeof id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(id)), 'identity')
  let state: RunState = { specificationVersion: DIGITS_SPEC_VERSION,
    scoringVersion: DIGITS_SCORING_VERSION, form, identity, profile,
    armedAtMs: atMs, phase: 'armed', trialIndex: 1, digitIndex: 0,
    length: 4, target: null, presentedTargets: [], wrongCount: 0, completionReason: null,
    presentedTrials: 0, closed: [], entryOpenedMs: null, entryDeadlineMs: null,
    nextDueMs: null, digitOnsetMs: null, speechStartMs: null, lastFrameMs: null,
    draft: '', draftAssisted: false, invalidReason: null, commands: [], events: [] }
  state = append(state, 'prepared', atMs, { mode: form.mode, entryWindow: profile.entryWindow })
  state = append(state, 'form_assigned', atMs, { formId: form.id, formsVersion: form.version, generatorVersion: form.generatorVersion,
    manifestDigest: form.manifestDigest })
  return append(state, 'armed', atMs, { profile: JSON.stringify(profile) })
}

function reduce(state: RunState, command: Command): RunState {
  time(command.atMs)
  assert(command.atMs >= state.armedAtMs &&
    command.atMs >= state.events[state.events.length - 1].atMs, 'command time regressed')
  if (state.phase === 'invalid' || state.phase === 'completed')
    throw Error('Digits engine: terminal attempt')
  const trial = state.target ? currentDigitsTrial(state) : null
  switch (command.kind) {
    case 'start': case 'next': {
      assert(command.kind === (state.phase === 'armed' ? 'start' : 'next') &&
        (state.phase === 'armed' || state.phase === 'feedback'), 'trial admission')
      const index = state.phase === 'feedback' ? state.trialIndex + 1 : state.trialIndex
      let target: string
      try { target = digitsTarget(state.form.seed, index, state.length, state.presentedTargets) }
      catch { return invalid(state, command.atMs, 'target_generation_failed') }
      const next = { ...state, phase: 'presentation' as const, trialIndex: index, target,
        digitIndex: 0, nextDueMs: command.atMs, digitOnsetMs: null,
        speechStartMs: null, entryOpenedMs: null, entryDeadlineMs: null,
        draft: '', draftAssisted: false }
      return append(next, 'trial_started', command.atMs,
        { targetLength: state.length, acceptedAtMs: command.atMs,
          generatorVersion: state.form.generatorVersion, profile: JSON.stringify(state.profile) })
    }
    case 'visual_onset': {
      assert(state.profile.mode === 'visual' && state.phase === 'presentation' &&
        state.digitOnsetMs === null && state.digitIndex < trial!.length, 'visual onset phase')
      const index = state.digitIndex + 1
      let next = frame(state, command.dueMs, command.atMs, 'digit_presented',
        { digitIndex: index, value: trial!.digits[index - 1] })
      next = { ...next, digitIndex: index, digitOnsetMs: command.atMs,
        nextDueMs: next.phase === 'invalid' ? null : command.atMs + 700,
        presentedTrials: state.presentedTrials + (index === 1 ? 1 : 0),
        presentedTargets: index === 1 ? [...state.presentedTargets, trial!.digits] : state.presentedTargets }
      return next
    }
    case 'visual_offset': {
      assert(state.profile.mode === 'visual' && state.phase === 'presentation' &&
        state.digitOnsetMs !== null && state.digitIndex > 0, 'visual offset phase')
      let next = frame(state, command.dueMs, command.atMs, 'digit_ended',
        { digitIndex: state.digitIndex, value: trial!.digits[state.digitIndex - 1] })
      next = { ...next, digitOnsetMs: null,
        nextDueMs: next.phase === 'invalid' ? null :
          command.atMs + (state.digitIndex === trial!.length ? 750 : 250) }
      return next
    }
    case 'speech_start': {
      assert(state.profile.mode === 'auditory' && state.phase === 'presentation' &&
        state.speechStartMs === null && state.digitIndex < trial!.length &&
        state.nextDueMs !== null && command.requestMs >= state.nextDueMs &&
        command.atMs >= command.requestMs && command.atMs - command.requestMs <= 2000 &&
        command.voiceURI === state.profile.voice?.voiceURI &&
        command.lang === state.profile.voice.lang, 'speech start')
      const index = state.digitIndex + 1
      const next = append(state, 'speech_started', command.atMs,
        { digitIndex: index, value: trial!.digits[index - 1], requestMs: command.requestMs,
          voiceURI: command.voiceURI, lang: command.lang, localService: true })
      return { ...next, digitIndex: index, speechStartMs: command.atMs,
        nextDueMs: null, presentedTrials: state.presentedTrials + (index === 1 ? 1 : 0),
        presentedTargets: index === 1 ? [...state.presentedTargets, trial!.digits] : state.presentedTargets }
    }
    case 'speech_end': {
      assert(state.profile.mode === 'auditory' && state.phase === 'presentation' &&
        state.speechStartMs !== null && command.atMs - state.speechStartMs <= 4000 &&
        command.voiceURI === state.profile.voice?.voiceURI &&
        command.lang === state.profile.voice.lang, 'speech end')
      const next = append(state, 'speech_ended', command.atMs,
        { digitIndex: state.digitIndex, value: trial!.digits[state.digitIndex - 1],
          startMs: state.speechStartMs, voiceURI: command.voiceURI,
          lang: command.lang, localService: true })
      return { ...next, speechStartMs: null,
        nextDueMs: command.atMs + (state.digitIndex === trial!.length ? 750 : 250) }
    }
    case 'entry_opened': {
      assert(state.phase === 'presentation' && state.digitIndex === trial!.length &&
        state.digitOnsetMs === null && state.speechStartMs === null, 'entry phase')
      const next = frame(state, command.dueMs, command.atMs, 'entry_opened',
        { deadlineMs: command.atMs + state.profile.entryWindow,
          entryWindowVersion: state.profile.entryWindow === 20000 ? 'standard' : 'extended' })
      return { ...next, phase: next.phase === 'invalid' ? 'invalid' : 'entry',
        entryOpenedMs: command.atMs, entryDeadlineMs: command.atMs + state.profile.entryWindow,
        nextDueMs: null }
    }
    case 'edit': {
      assert(state.phase === 'entry' && state.entryOpenedMs !== null &&
        state.entryDeadlineMs !== null &&
        command.source === (command.assisted ? 'assisted' : state.profile.entryMethod) &&
        /^[0-9]*$/.test(command.value) && command.value.length <= trial!.length,
      'entry edit')
      if (command.atMs >= state.entryDeadlineMs) return state
      return { ...state, draft: command.value,
        draftAssisted: state.draftAssisted || command.assisted }
    }
    case 'submit': case 'skip': case 'timeout':
      return close(state, command.atMs, command.kind)
    case 'invalidate':
      assert(command.reason.length > 0, 'invalid reason')
      return invalid(state, command.atMs, command.reason)
    case 'quality':
      assert(command.reason.length > 0, 'quality reason')
      return append(state, 'quality_note', command.atMs, { reason: command.reason })
  }
}

/** Pure transition. The command log is retained so a saved state can be replayed. */
export function advanceDigits(state: RunState, command: Command): RunState {
  const next = reduce(state, command)
  return { ...next, commands: [...state.commands, command] }
}
export function verifyDigitsRun(state: RunState): boolean {
  try {
    if (!isVerifiedDigitsForm(state.form)) return false
    let replay = armDigits(state.form, state.identity, state.profile, state.armedAtMs)
    for (const command of state.commands) replay = advanceDigits(replay, command)
    return same(replay, state)
  } catch { return false }
}

export function currentDigitsTrial(state: RunState) {
  assert(state.target !== null, 'target not prepared')
  return { index: state.trialIndex, block: 0 as const, length: state.target.length,
    digits: state.target }
}
