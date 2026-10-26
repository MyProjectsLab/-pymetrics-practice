/** Convenience history of an observed native key release, never hardware attestation. */
const KEY = 'traitgame.input-check.v1'
const MARKER = 'traitgame-input:'
export interface KeyProof {
  code: string
  trustedDown: true
  trustedUp: true
  sameCode: true
  unmodifiedDownAndUp: true
  downWasNotRepeat: true
  upWasNotRepeat: true
}
export interface InputCheckReceipt {
  schema: 'traitgame_input_check/1'
  receiptId: string
  tabNonce: string
  originGame: string
  controlProfile: { kind: 'physical_keyboard'; physicalKeyboardDeclared: true; latencyAffectedInput: false; timingProfile: 'standard'; modifierPolicy: 'none'; visualProfile: 'standard' | 'shape_accommodation_v1' }
  entries: KeyProof[]
  observedAtWallMs: number
}
export interface InputCheckObservation { proof: KeyProof; receipt: InputCheckReceipt | null }
let claimedNonce: string | null = null
let releaseClaim: (() => void) | null = null
let claimAttempt: Promise<boolean> | null = null
function clear() {
  try { sessionStorage.removeItem(KEY) } catch { /* cache unavailable */ }
  if (window.name.startsWith(MARKER)) window.name = ''
  releaseClaim?.()
}
function exactKeys(value: object, expected: readonly string[]) {
  const keys = Object.keys(value).sort()
  return keys.length === expected.length && keys.every((key, index) => key === expected[index])
}
function valid(value: unknown): value is InputCheckReceipt {
  if (!value || typeof value !== 'object') return false
  const item = value as InputCheckReceipt
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return exactKeys(item, ['controlProfile','entries','observedAtWallMs','originGame','receiptId','schema','tabNonce']) &&
    item.schema === 'traitgame_input_check/1' && typeof item.receiptId === 'string' && uuid.test(item.receiptId) &&
    typeof item.tabNonce === 'string' && uuid.test(item.tabNonce) && ['stop','keypresses','arrows','lengths'].includes(item.originGame) &&
    !!item.controlProfile && typeof item.controlProfile === 'object' &&
    exactKeys(item.controlProfile, ['kind','latencyAffectedInput','modifierPolicy','physicalKeyboardDeclared','timingProfile','visualProfile']) &&
    item.controlProfile?.kind === 'physical_keyboard' && item.controlProfile.physicalKeyboardDeclared === true &&
    item.controlProfile.latencyAffectedInput === false && item.controlProfile.timingProfile === 'standard' &&
    item.controlProfile.modifierPolicy === 'none' && ['standard','shape_accommodation_v1'].includes(item.controlProfile.visualProfile) &&
    Number.isSafeInteger(item.observedAtWallMs) && item.observedAtWallMs >= 0 &&
    Array.isArray(item.entries) && item.entries.length >= 1 && item.entries.length <= 2 &&
    new Set(item.entries.map(entry => entry.code)).size === item.entries.length && item.entries.every(entry =>
      !!entry && typeof entry === 'object' &&
      exactKeys(entry, ['code','downWasNotRepeat','sameCode','trustedDown','trustedUp','unmodifiedDownAndUp','upWasNotRepeat']) &&
      typeof entry.code === 'string' && /^(Space|ArrowLeft|ArrowRight|Key[A-Z]|Digit[0-9]|Numpad[0-9]|Comma|Period|Slash|Semicolon|Quote|BracketLeft|BracketRight|Backslash|Backquote|Minus|Equal)$/.test(entry.code) &&
      entry.trustedDown === true && entry.trustedUp === true && entry.sameCode === true &&
      entry.unmodifiedDownAndUp === true && entry.downWasNotRepeat === true && entry.upWasNotRepeat === true)
}
export function parseInputReceipt(raw: string | null): InputCheckReceipt | null {
  if (!raw || raw.length > 2048) return null
  try { const value: unknown = JSON.parse(raw); return valid(value) ? value : null } catch { return null }
}
async function claim(nonce: string): Promise<boolean> {
  if (claimedNonce === nonce) return true
  if (claimedNonce || !navigator.locks) return false
  if (claimAttempt) return claimAttempt
  claimAttempt = new Promise<boolean>(resolve => {
    void navigator.locks.request(`${MARKER}${nonce}`, { ifAvailable: true, mode: 'exclusive' }, async lock => {
      if (!lock) { resolve(false); return }
      claimedNonce = nonce
      resolve(true)
      await new Promise<void>(done => { releaseClaim = done })
      claimedNonce = null
      releaseClaim = null
    }).catch(() => resolve(false)).finally(() => { claimAttempt = null })
  })
  return claimAttempt
}
window.addEventListener('pagehide', () => releaseClaim?.(), { once: true })

export async function readInputReceipt(codes: readonly string[], visualProfile?: InputCheckReceipt['controlProfile']['visualProfile']): Promise<InputCheckReceipt | null> {
  try {
    const value = parseInputReceipt(sessionStorage.getItem(KEY))
    if (!value || window.name !== MARKER + value.tabNonce || !(await claim(value.tabNonce))) {
      clear(); return null
    }
    if (visualProfile && value.controlProfile.visualProfile !== visualProfile ||
      !codes.every(code => value.entries.some(entry => entry.code === code))) return null
    return value
  } catch { clear(); return null }
}

export async function storeNativeKeyProof(originGame: string, down: KeyboardEvent, up: KeyboardEvent,
  visualProfile: InputCheckReceipt['controlProfile']['visualProfile']): Promise<InputCheckObservation | null> {
  if (!down.isTrusted || !up.isTrusted || down.code !== up.code || down.repeat || up.repeat ||
    down.ctrlKey || down.altKey || down.metaKey || down.shiftKey || up.ctrlKey || up.altKey || up.metaKey || up.shiftKey ||
    down.isComposing || up.isComposing) return null
  const entry: KeyProof = { code: down.code, trustedDown: true, trustedUp: true, sameCode: true,
    unmodifiedDownAndUp: true, downWasNotRepeat: true, upWasNotRepeat: true }
  const fresh: InputCheckObservation = { proof: entry, receipt: null }
  const old = await readInputReceipt([])
  const compatibleOld = old?.controlProfile.visualProfile === visualProfile ? old : null
  const nonce = old?.tabNonce ?? (window.name === '' ? crypto.randomUUID() : null)
  if (!nonce) return fresh
  if (!old) window.name = MARKER + nonce
  if (!(await claim(nonce))) { clear(); return fresh }
  const receipt: InputCheckReceipt = { schema: 'traitgame_input_check/1', receiptId: crypto.randomUUID(), tabNonce: nonce,
    originGame, controlProfile: { kind: 'physical_keyboard', physicalKeyboardDeclared: true, latencyAffectedInput: false,
      timingProfile: 'standard', modifierPolicy: 'none', visualProfile },
    entries: [...(compatibleOld?.entries.filter(item => item.code !== entry.code) ?? []), entry].slice(-2), observedAtWallMs: Date.now() }
  try { sessionStorage.setItem(KEY, JSON.stringify(receipt)); return { proof: entry, receipt } } catch { clear(); return fresh }
}
