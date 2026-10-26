import type { VoiceIdentity } from './contracts'

export type VoiceLike = Pick<SpeechSynthesisVoice, 'voiceURI' | 'lang' | 'localService'>
function validEnglishTag(tag: unknown): tag is string {
  if (typeof tag !== 'string' || !/^en(?:-[A-Za-z0-9]+)*$/i.test(tag)) return false
  try { return Intl.getCanonicalLocales(tag).length === 1 } catch { return false }
}
function eligible(voice: VoiceLike, inventory: readonly VoiceLike[]): boolean {
  return typeof voice.voiceURI === 'string' && voice.voiceURI.length > 0 &&
    validEnglishTag(voice.lang) && voice.localService === true &&
    inventory.filter(item => item.voiceURI === voice.voiceURI).length === 1
}
/** Current local inventory is authoritative. An explicit remote or missing URI never falls back. */
export function selectDigitsVoice(voices: readonly VoiceLike[], explicitURI?: string): VoiceLike | null {
  if (explicitURI !== undefined && (!explicitURI || typeof explicitURI !== 'string')) return null
  const choices = voices.filter(voice => eligible(voice, voices))
  if (explicitURI !== undefined) return choices.find(voice => voice.voiceURI === explicitURI) ?? null
  return choices.toSorted((a, b) => a.voiceURI < b.voiceURI ? -1 : a.voiceURI > b.voiceURI ? 1 : 0)[0] ?? null
}
export function sameDigitsVoice(identity: VoiceIdentity, voices: readonly VoiceLike[]): boolean {
  const selected = selectDigitsVoice(voices, identity.voiceURI)
  return !!selected && selected.lang === identity.lang && selected.localService === true
}
