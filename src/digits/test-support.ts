import { advanceDigits, armDigits } from './engine'
import { loadDigitsForms } from './forms'
import type { Identity, Profile, RunState } from './contracts'
export const identity: Identity = { installationId: 'install_1', sessionId: 'session_1',
  requestId: 'request_1', clockDomainId: 'clock_1', route: 'standalone' }
export const visual: Profile = { mode: 'visual', entryWindow: 20000, highContrast: false,
  reducedMotion: true, entryMethod: 'keyboard', assistedEntryDeclared: false, voice: null,
  browserContext: { userAgent: 'test', viewportWidth: 1280, viewportHeight: 720, devicePixelRatio: 1 } }
export async function initialRun(legacy = false) {
  return advanceDigits(armDigits((await loadDigitsForms()).get('DV1')!, identity, visual, 0, !legacy),
    { kind: 'start', atMs: 0 })
}
export function openEntry(state: RunState) {
  let next = state
  for (let index = 0; index < state.length; index++) {
    if (state.profile.mode === 'visual') {
      next = advanceDigits(next, { kind: 'visual_onset', dueMs: next.nextDueMs!, atMs: next.nextDueMs! })
      next = advanceDigits(next, { kind: 'visual_offset', dueMs: next.nextDueMs!, atMs: next.nextDueMs! })
    } else {
      const requestMs = next.nextDueMs!
      next = advanceDigits(next, { kind: 'speech_start', requestMs, atMs: requestMs,
        voiceURI: state.profile.voice!.voiceURI, lang: state.profile.voice!.lang })
      next = advanceDigits(next, { kind: 'speech_end', atMs: requestMs + 300,
        voiceURI: state.profile.voice!.voiceURI, lang: state.profile.voice!.lang })
    }
  }
  return advanceDigits(next, { kind: 'entry_opened', dueMs: next.nextDueMs!, atMs: next.nextDueMs! })
}
export function closeTrial(state: RunState, correct: boolean, kind: 'submit' | 'skip' | 'timeout' = 'submit') {
  let next = openEntry(state)
  next = advanceDigits(next, { kind: 'edit', atMs: next.entryOpenedMs! + 1,
    value: correct ? next.target! : '', assisted: false, source: 'keyboard' })
  return advanceDigits(next, { kind, atMs: kind === 'timeout' ? next.entryDeadlineMs! : next.entryOpenedMs! + 2 })
}
export function nextTrial(state: RunState) {
  return advanceDigits(state, { kind: 'next', atMs: state.events.at(-1)!.atMs + 500 })
}
