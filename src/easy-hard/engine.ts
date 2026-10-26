import type { Choice, Form } from './forms'
import { FEEDBACK_MS, GAME_MS } from './report'
import type { JournalEvent } from './report'

export type PendingEvent = Omit<JournalEvent, 'eventVersion' | 'attemptId' | 'formId' |
  'formHash' | 'ownershipGeneration' | 'sequence' | 'wallTimestampMs'>
export type Phase = 'offer' | 'choice' | 'selected' | 'task' | 'feedback' | 'terminal'

/** Wall time is only a suspension guard; scored deadlines use monotonic time. */
export function materialClockDivergence(wallNow: number, wallAnchor: number,
  monotonicElapsed: number): boolean {
  return ![wallNow, wallAnchor, monotonicElapsed].every(Number.isFinite) ||
    Math.abs(wallNow - wallAnchor - monotonicElapsed) > 3000
}

export function phaseOf(events: readonly JournalEvent[]): Phase {
  const kind = events.at(-1)?.kind
  if (!kind || kind === 'feedback_end') return 'offer'
  if (kind === 'offer_onset') return 'choice'
  if (kind === 'choice_selected') return 'selected'
  if (kind === 'task_onset' || kind === 'press_accepted') return 'task'
  if (kind === 'task_resolved') return 'feedback'
  return 'terminal'
}
export function nextOfferIndex(events: readonly JournalEvent[]) {
  return events.filter(event => event.kind === 'offer_onset').length + 1
}

function offer(form: Form, index: number) {
  const value = form.entries[index - 1]
  if (!value) throw Error('Easy or Hard offer exhausted')
  return value
}

export function onset(form: Form, events: readonly JournalEvent[], at: number): PendingEvent {
  if (phaseOf(events) !== 'offer' || !Number.isSafeInteger(at) || at >= GAME_MS || at < 0)
    throw Error('Easy or Hard onset unavailable')
  const index = nextOfferIndex(events)
  const value = offer(form, index)
  return { kind: 'offer_onset', phase: 'choice', elapsedMs: at, inputSource: 'system',
    offerIndex: index, probabilityPercent: value.probabilityPercent,
    easyOfferCents: 100, hardOfferCents: value.hardOfferCents,
    choiceDeadlineMs: at + 5000 }
}

export function choice(events: readonly JournalEvent[], selected: Choice, at: number,
  source: 'pointer' | 'keyboard' | 'touch' | 'assistive_or_unknown', actionId: string): PendingEvent {
  const opened = events.at(-1)
  if (phaseOf(events) !== 'choice' || !opened || opened.kind !== 'offer_onset' ||
    !Number.isSafeInteger(at) || at < opened.elapsedMs ||
    at >= Math.min(opened.choiceDeadlineMs!, GAME_MS)) throw Error('Easy or Hard choice expired')
  return { kind: 'choice_selected', phase: 'choice', elapsedMs: at, inputSource: source,
    offerIndex: opened.offerIndex, actionId, choice: selected, automatic: false }
}

export function taskOnset(form: Form, events: readonly JournalEvent[], at: number): PendingEvent {
  const selected = events.at(-1)
  if (phaseOf(events) !== 'selected' || !selected || !selected.choice ||
    !Number.isSafeInteger(at) || at < selected.elapsedMs || at >= GAME_MS)
    throw Error('Easy or Hard task onset unavailable')
  const value = offer(form, selected.offerIndex!)
  return { kind: 'task_onset', phase: 'task', elapsedMs: at, inputSource: 'system',
    offerIndex: selected.offerIndex, choice: selected.choice, automatic: selected.automatic,
    probabilityPercent: value.probabilityPercent,
    selectedRewardCents: selected.choice === 'easy' ? 100 : value.hardOfferCents,
    taskOnsetMs: at, taskDeadlineMs: at + (selected.choice === 'easy' ? 3000 : 12000),
    acceptedPresses: 0 }
}

function currentTask(events: readonly JournalEvent[]) {
  const opened = [...events].reverse().find(event => event.kind === 'task_onset')
  if (!opened || !opened.choice) throw Error('Easy or Hard task missing')
  const accepted = events.at(-1)?.kind === 'press_accepted' ? events.at(-1)!.acceptedPresses! : 0
  return { opened, accepted, target: opened.choice === 'easy' ? 5 : 60 }
}

export function press(events: readonly JournalEvent[], at: number, actionId: string): PendingEvent {
  if (phaseOf(events) !== 'task') throw Error('Easy or Hard task unavailable')
  const { opened, accepted, target } = currentTask(events)
  if (!Number.isSafeInteger(at) || at < opened.taskOnsetMs! ||
    at >= Math.min(opened.taskDeadlineMs!, GAME_MS) || accepted >= target)
    throw Error('Easy or Hard press expired')
  return { kind: 'press_accepted', phase: 'task', elapsedMs: at, inputSource: 'keyboard',
    offerIndex: opened.offerIndex, actionId, pressId: actionId, choice: opened.choice,
    taskOnsetMs: opened.taskOnsetMs, taskDeadlineMs: opened.taskDeadlineMs,
    acceptedPresses: accepted + 1 }
}

export function resolution(form: Form, events: readonly JournalEvent[], at: number): PendingEvent {
  if (phaseOf(events) !== 'task') throw Error('Easy or Hard task unavailable')
  const { opened, accepted, target } = currentTask(events)
  const value = offer(form, opened.offerIndex!)
  const complete = accepted === target
  const expectedAt = Math.min(opened.taskDeadlineMs!, GAME_MS)
  if (!Number.isSafeInteger(at) || (complete ?
    at !== events.at(-1)?.elapsedMs || at >= expectedAt : at !== expectedAt))
    throw Error('Easy or Hard resolution time')
  const won = complete ? value.lotteryDrawBasisPoints < value.probabilityPercent * 100 : null
  return { kind: 'task_resolved', phase: 'feedback', elapsedMs: at, inputSource: 'system',
    offerIndex: opened.offerIndex, choice: opened.choice,
    probabilityPercent: value.probabilityPercent,
    selectedRewardCents: opened.selectedRewardCents, taskOnsetMs: opened.taskOnsetMs,
    taskDeadlineMs: opened.taskDeadlineMs, acceptedPresses: accepted,
    completedOnTime: complete, lotteryWon: won,
    earnedCents: won ? opened.selectedRewardCents : 0,
    reason: complete ? (won ? 'won' : 'lottery_loss') :
      expectedAt === GAME_MS ? 'global_expiry' : 'task_timeout' }
}

/** One fixed-deadline transition at a time; callers durably confirm before planning again. */
export function due(form: Form, events: readonly JournalEvent[], now: number,
  actionId: string): PendingEvent | null {
  if (!Number.isSafeInteger(now) || now < 0) throw Error('Easy or Hard clock unavailable')
  const phase = phaseOf(events)
  const last = events.at(-1)
  if (phase === 'terminal') return null
  if (phase === 'offer') return now >= GAME_MS && events.length > 0 ? {
    kind: 'global_expired', phase: 'feedback', elapsedMs: GAME_MS, inputSource: 'system' } : null
  if (phase === 'task') {
    const { opened, accepted, target } = currentTask(events)
    if (accepted === target) return resolution(form, events, last!.elapsedMs)
    const deadline = Math.min(opened.taskDeadlineMs!, GAME_MS)
    return now >= deadline ? resolution(form, events, deadline) : null
  }
  if (phase === 'choice') {
    if (last!.choiceDeadlineMs! < GAME_MS && now >= last!.choiceDeadlineMs!) {
      const value = offer(form, last!.offerIndex!)
      return { kind: 'choice_selected', phase: 'choice', elapsedMs: last!.choiceDeadlineMs!,
        inputSource: 'system', offerIndex: last!.offerIndex, actionId,
        choice: value.fallbackTask, automatic: true }
    }
    return now >= GAME_MS ? { kind: 'global_expired_in_choice', phase: 'choice',
      elapsedMs: GAME_MS, inputSource: 'system' } : null
  }
  if (phase === 'selected') return now >= GAME_MS ? {
    kind: 'global_expired_after_choice', phase: 'choice', elapsedMs: GAME_MS,
    inputSource: 'system' } : null
  if (now >= GAME_MS && last!.reason === 'global_expiry') return { kind: 'global_expired',
    phase: 'task', elapsedMs: GAME_MS, inputSource: 'system' }
  const feedbackDeadline = last!.elapsedMs + FEEDBACK_MS
  return feedbackDeadline < GAME_MS && now >= feedbackDeadline ? {
    kind: 'feedback_end', phase: 'feedback', elapsedMs: feedbackDeadline,
    inputSource: 'system', offerIndex: last!.offerIndex } : now >= GAME_MS ? {
    kind: 'global_expired', phase: 'feedback', elapsedMs: GAME_MS, inputSource: 'system' } : null
}
