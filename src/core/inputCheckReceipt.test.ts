import { expect, it } from 'vitest'
import { parseInputReceipt } from './inputCheckReceipt'

const example = () => ({ schema: 'traitgame_input_check/1', receiptId: crypto.randomUUID(), tabNonce: crypto.randomUUID(),
  originGame: 'stop', controlProfile: { kind: 'physical_keyboard', physicalKeyboardDeclared: true,
    latencyAffectedInput: false, timingProfile: 'standard', modifierPolicy: 'none', visualProfile: 'standard' },
  entries: [{ code: 'Space', trustedDown: true, trustedUp: true, sameCode: true,
    unmodifiedDownAndUp: true, downWasNotRepeat: true, upWasNotRepeat: true }], observedAtWallMs: Date.now() })

it('accepts only a bounded closed per-code receipt', () => {
  const good = example()
  expect(parseInputReceipt(JSON.stringify(good))?.entries[0].code).toBe('Space')
  expect(parseInputReceipt(JSON.stringify({ ...good, futureProof: true }))).toBeNull()
  expect(parseInputReceipt(JSON.stringify({ ...good, controlProfile: { ...good.controlProfile, extra: true } }))).toBeNull()
  expect(parseInputReceipt(JSON.stringify({ ...good, entries: [{ ...good.entries[0], extra: true }] }))).toBeNull()
  expect(parseInputReceipt(JSON.stringify({ ...good, entries: [good.entries[0], good.entries[0]] }))).toBeNull()
  expect(parseInputReceipt(JSON.stringify({ ...good, entries: [{ ...good.entries[0], trustedUp: false }] }))).toBeNull()
  expect(parseInputReceipt(JSON.stringify({ ...good, originGame: 'unknown' }))).toBeNull()
  expect(parseInputReceipt(JSON.stringify({ ...good, receiptId: 'not-a-uuid' }))).toBeNull()
  expect(parseInputReceipt('x'.repeat(2049))).toBeNull()
})
