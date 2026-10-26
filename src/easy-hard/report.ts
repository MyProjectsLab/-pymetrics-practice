import type { Choice, Form } from './forms'

export const EVENT_VERSION = 'easy-hard-events-v1.0-draft'
export const GAME_MS = 120_000
export const FEEDBACK_MS = 4_000
export interface JournalEvent {
  eventVersion: string; attemptId: string; formId: string; formHash: string
  ownershipGeneration: number; sequence: number; kind: string; phase: string
  elapsedMs: number; wallTimestampMs: number; inputSource: string
  offerIndex?: number; actionId?: string; pressId?: string
  probabilityPercent?: number; easyOfferCents?: number; hardOfferCents?: number
  choiceDeadlineMs?: number; choice?: Choice; automatic?: boolean
  selectedRewardCents?: number; taskOnsetMs?: number; taskDeadlineMs?: number
  acceptedPresses?: number; completedOnTime?: boolean; lotteryWon?: boolean | null
  earnedCents?: number; reason?: string
}
export interface TaskRow {
  offerIndex: number; choice: Choice; chancePercent: number; offeredCents: number
  automaticChoice: boolean; acceptedPresses: number; taskOnsetMs: number
  resolutionMs: number; durationMs: number; completedOnTime: boolean
  lotteryWon: boolean | null; earnedCents: number; reason: string
}
export interface Report {
  status: 'complete' | 'incomplete_review'; formId: string; formHash: string
  attempts: number; completedOnTime: number; easyChoices: number; hardChoices: number
  automaticChoices: number; easyAttempts: number; hardAttempts: number
  easyCompleted: number; hardCompleted: number; earnedCents: number
  terminalElapsedMs: number | null; terminalPhase: string | null; rows: TaskRow[]
  inputContext: 'standard_keyboard'
}
function assert(ok: unknown, reason: string): asserts ok {
  if (!ok) throw Error(`Easy or Hard journal integrity: ${reason}`)
}
const common = ['eventVersion', 'attemptId', 'formId', 'formHash', 'ownershipGeneration',
  'sequence', 'kind', 'phase', 'elapsedMs', 'wallTimestampMs', 'inputSource']
const fields: Record<string, string[]> = {
  offer_onset: ['offerIndex', 'probabilityPercent', 'easyOfferCents', 'hardOfferCents', 'choiceDeadlineMs'],
  choice_selected: ['offerIndex', 'actionId', 'choice', 'automatic'],
  task_onset: ['offerIndex', 'choice', 'automatic', 'probabilityPercent', 'selectedRewardCents',
    'taskOnsetMs', 'taskDeadlineMs', 'acceptedPresses'],
  press_accepted: ['offerIndex', 'actionId', 'pressId', 'choice', 'taskOnsetMs',
    'taskDeadlineMs', 'acceptedPresses'],
  task_resolved: ['offerIndex', 'choice', 'probabilityPercent', 'selectedRewardCents',
    'taskOnsetMs', 'taskDeadlineMs', 'acceptedPresses', 'completedOnTime', 'lotteryWon',
    'earnedCents', 'reason'],
  feedback_end: ['offerIndex'], global_expired: [],
  global_expired_in_choice: [], global_expired_after_choice: [],
  run_interrupted: ['reason'], run_exited: ['reason'], run_invalid: ['reason'],
}
function exactFields(event: JournalEvent) {
  const extra = fields[event.kind]
  assert(extra, 'unknown event kind')
  const expected = [...common, ...extra].sort()
  assert(JSON.stringify(Object.keys(event).sort()) === JSON.stringify(expected), 'event field set')
}

/** Rebuild candidate-safe results from ordered events and the immutable form. */
export function reportFromJournal(form: Form, formHash: string, events: readonly JournalEvent[]): Report {
  assert(events.length > 0 && form.formId && formHash.length === 64, 'empty or unidentified journal')
  const first = events[0]
  const seenActions = new Set<string>()
  const rows: TaskRow[] = []
  let stage: 'before_offer' | 'choice' | 'selected' | 'task' | 'feedback' | 'terminal' = 'before_offer'
  let offerIndex = 0, choice: Choice | null = null, automatic = false
  let choiceOnset = -1, choiceAt = -1, taskOnset = -1, taskDeadline = -1
  let accepted = 0, resolvedAt = -1, priorAt = -1
  let easyChoices = 0, hardChoices = 0, automaticChoices = 0
  let terminalElapsedMs: number | null = null, terminalPhase: string | null = null
  const unfinishedTask = (endMs: number, reason: string) => {
    assert(choice !== null && stage === 'task' && taskOnset >= 0, 'unfinished task')
    const selected = form.entries[offerIndex - 1]
    rows.push({ offerIndex, choice, chancePercent: selected.probabilityPercent,
      offeredCents: choice === 'easy' ? 100 : selected.hardOfferCents,
      automaticChoice: automatic, acceptedPresses: accepted, taskOnsetMs: taskOnset,
      resolutionMs: endMs, durationMs: Math.max(0, endMs - taskOnset),
      completedOnTime: false, lotteryWon: null, earnedCents: 0, reason })
  }
  for (const [position, event] of events.entries()) {
    exactFields(event)
    assert(event.eventVersion === EVENT_VERSION && event.attemptId === first.attemptId &&
      event.formId === form.formId && event.formHash === formHash &&
      event.ownershipGeneration === first.ownershipGeneration &&
      Number.isSafeInteger(event.sequence) && event.sequence === position + 1 &&
      Number.isSafeInteger(event.elapsedMs) && event.elapsedMs >= priorAt &&
      event.elapsedMs >= 0 && event.elapsedMs <= GAME_MS &&
      event.wallTimestampMs - event.elapsedMs === first.wallTimestampMs - first.elapsedMs &&
      stage !== 'terminal', 'event envelope/order')
    priorAt = event.elapsedMs
    if (event.actionId !== undefined) {
      assert(event.actionId.length > 0 && !seenActions.has(event.actionId), 'duplicate action identity')
      seenActions.add(event.actionId)
    }
    if (['offer_onset', 'task_onset', 'task_resolved', 'feedback_end',
      'global_expired', 'global_expired_in_choice', 'global_expired_after_choice',
      'run_interrupted', 'run_exited', 'run_invalid'].includes(event.kind))
      assert(event.inputSource === 'system', 'system event source')
    if (event.kind === 'offer_onset') {
      assert(stage === 'before_offer' && event.phase === 'choice' &&
        event.offerIndex === rows.length + 1 && event.elapsedMs < GAME_MS, 'offer order')
      offerIndex = event.offerIndex
      const offer = form.entries[offerIndex - 1]
      assert(offer && event.probabilityPercent === offer.probabilityPercent &&
        event.easyOfferCents === 100 && event.hardOfferCents === offer.hardOfferCents &&
        event.choiceDeadlineMs === event.elapsedMs + 5000, 'visible offer')
      choiceOnset = event.elapsedMs; stage = 'choice'
    } else if (event.kind === 'choice_selected') {
      assert(stage === 'choice' && event.phase === 'choice' && event.offerIndex === offerIndex &&
        (event.choice === 'easy' || event.choice === 'hard') &&
        event.elapsedMs >= choiceOnset && event.elapsedMs < GAME_MS &&
        (event.automatic ? event.elapsedMs === choiceOnset + 5000 &&
          event.choice === form.entries[offerIndex - 1].fallbackTask && event.inputSource === 'system' :
          event.elapsedMs < choiceOnset + 5000 &&
            ['pointer', 'keyboard', 'touch', 'assistive_or_unknown'].includes(event.inputSource)),
      'choice eligibility')
      choice = event.choice; automatic = !!event.automatic; choiceAt = event.elapsedMs
      if (choice === 'easy') easyChoices++
      else hardChoices++
      if (automatic) automaticChoices++
      stage = 'selected'
    } else if (event.kind === 'task_onset') {
      const offer = form.entries[offerIndex - 1]
      assert(stage === 'selected' && choice && event.phase === 'task' &&
        event.offerIndex === offerIndex && event.choice === choice &&
        event.automatic === automatic && event.probabilityPercent === offer.probabilityPercent &&
        event.selectedRewardCents === (choice === 'easy' ? 100 : offer.hardOfferCents) &&
        event.taskOnsetMs === event.elapsedMs && event.elapsedMs >= choiceAt &&
        event.elapsedMs < GAME_MS && event.taskDeadlineMs === event.elapsedMs +
          (choice === 'easy' ? 3000 : 12000) && event.acceptedPresses === 0, 'task onset')
      taskOnset = event.elapsedMs; taskDeadline = event.taskDeadlineMs; accepted = 0; stage = 'task'
    } else if (event.kind === 'press_accepted') {
      assert(stage === 'task' && event.phase === 'task' && event.inputSource === 'keyboard' &&
        event.offerIndex === offerIndex && event.choice === choice &&
        event.pressId === event.actionId && event.taskOnsetMs === taskOnset &&
        event.taskDeadlineMs === taskDeadline && event.acceptedPresses === accepted + 1 &&
        event.elapsedMs >= taskOnset && event.elapsedMs < taskDeadline &&
        event.elapsedMs < GAME_MS && accepted < (choice === 'easy' ? 5 : 60), 'accepted press')
      accepted++
    } else if (event.kind === 'task_resolved') {
      const offer = form.entries[offerIndex - 1]
      const target = choice === 'easy' ? 5 : 60
      const complete = accepted === target
      const won = complete ? offer.lotteryDrawBasisPoints < offer.probabilityPercent * 100 : null
      const earned = won ? (choice === 'easy' ? 100 : offer.hardOfferCents) : 0
      const expectedReason = complete ? (won ? 'won' : 'lottery_loss') :
        event.elapsedMs === GAME_MS ? 'global_expiry' : 'task_timeout'
      assert(stage === 'task' && choice && event.phase === 'feedback' &&
        event.offerIndex === offerIndex && event.choice === choice &&
        event.probabilityPercent === offer.probabilityPercent &&
        event.selectedRewardCents === (choice === 'easy' ? 100 : offer.hardOfferCents) &&
        event.taskOnsetMs === taskOnset && event.taskDeadlineMs === taskDeadline &&
        event.acceptedPresses === accepted && event.completedOnTime === complete &&
        event.lotteryWon === won && event.earnedCents === earned &&
        event.reason === expectedReason && (complete ?
          event.elapsedMs === events[position - 1]?.elapsedMs && event.elapsedMs < Math.min(taskDeadline, GAME_MS) :
          event.elapsedMs === Math.min(taskDeadline, GAME_MS)), 'task resolution')
      rows.push({ offerIndex, choice, chancePercent: offer.probabilityPercent,
        offeredCents: choice === 'easy' ? 100 : offer.hardOfferCents, automaticChoice: automatic,
        acceptedPresses: accepted, taskOnsetMs: taskOnset, resolutionMs: event.elapsedMs,
        durationMs: event.elapsedMs - taskOnset, completedOnTime: complete,
        lotteryWon: won, earnedCents: earned, reason: expectedReason })
      resolvedAt = event.elapsedMs; stage = 'feedback'
    } else if (event.kind === 'feedback_end') {
      assert(stage === 'feedback' && event.phase === 'feedback' &&
        event.offerIndex === offerIndex && event.elapsedMs === resolvedAt + FEEDBACK_MS &&
        event.elapsedMs < GAME_MS, 'feedback order')
      stage = 'before_offer'
    } else if (event.kind === 'run_interrupted' || event.kind === 'run_exited' ||
      event.kind === 'run_invalid') {
      assert(position > 0 && typeof event.reason === 'string' && event.reason.length > 0 &&
        event.phase === (event.kind === 'run_invalid' ? 'invalid' : 'interrupted'), 'closure reason')
      if (stage === 'task') unfinishedTask(event.elapsedMs, 'interrupted')
      terminalElapsedMs = event.elapsedMs; terminalPhase = event.phase; stage = 'terminal'
    } else if (event.kind === 'global_expired' || event.kind === 'global_expired_in_choice' ||
      event.kind === 'global_expired_after_choice') {
      const priorResolutionWasGlobal = events[position - 1]?.kind === 'task_resolved' &&
        events[position - 1]?.reason === 'global_expiry'
      assert(event.elapsedMs === GAME_MS && event.inputSource === 'system' &&
        ((event.kind === 'global_expired' &&
          ((stage === 'before_offer' && event.phase === 'feedback') ||
          (stage === 'feedback' && event.phase === (priorResolutionWasGlobal ? 'task' : 'feedback') &&
            (priorResolutionWasGlobal || resolvedAt + FEEDBACK_MS >= GAME_MS)))) ||
        (event.kind === 'global_expired_in_choice' && stage === 'choice' &&
          choiceOnset + 5000 >= GAME_MS && event.phase === 'choice') ||
        (event.kind === 'global_expired_after_choice' && stage === 'selected' && event.phase === 'choice')),
      'global expiry')
      terminalElapsedMs = event.elapsedMs; terminalPhase = event.phase; stage = 'terminal'
    }
  }
  if (stage === 'task') unfinishedTask(events.at(-1)!.elapsedMs, 'unresolved')
  const easyRows = rows.filter(row => row.choice === 'easy')
  const hardRows = rows.filter(row => row.choice === 'hard')
  return { status: stage === 'terminal' && terminalElapsedMs === GAME_MS &&
      !['interrupted', 'invalid'].includes(terminalPhase ?? '') ? 'complete' : 'incomplete_review', formId: form.formId,
    formHash, attempts: rows.length, completedOnTime: rows.filter(row => row.completedOnTime).length,
    easyChoices, hardChoices, automaticChoices, easyAttempts: easyRows.length,
    hardAttempts: hardRows.length, easyCompleted: easyRows.filter(row => row.completedOnTime).length,
    hardCompleted: hardRows.filter(row => row.completedOnTime).length,
    earnedCents: rows.reduce((sum, row) => sum + row.earnedCents, 0),
    terminalElapsedMs, terminalPhase, inputContext: 'standard_keyboard', rows }
}
