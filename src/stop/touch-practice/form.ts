import type { StopStimulus } from '../contracts'
import { stopFormRegistry, stopV13FormRegistry } from '../forms'

export const TOUCH_FORM_ID = 'stop-touch-practice-01' as const
export const TOUCH_FORM_VERSION = 'stop_touch_practice_form_v1' as const
export const TOUCH_SEQUENCE_TEXT = 'GGGGGNNGNGGGNGGGGGGNNGNNGNGGGGGGGNGGGGGGGGNGGGGNGGGGGGNGNGGNNNGGGGNGNGGGNGGGGGGG' as const
export const TOUCH_FORM_CHECKSUM = '013014d3d4e217c93a23d8fa79b65bdb134559aad0318bf17f2ef627f3be51cd' as const
export const TOUCH_SEQUENCE: readonly StopStimulus[] = Object.freeze([...TOUCH_SEQUENCE_TEXT].map(letter => letter === 'G' ? 'GO' : 'NO_GO'))
export const TOUCH_WARMUP: readonly StopStimulus[] = Object.freeze(['GO', 'GO', 'NO_GO', 'GO', 'GO', 'GO', 'NO_GO', 'GO'])

export async function validateTouchForm(): Promise<boolean> {
  if (TOUCH_SEQUENCE_TEXT.length !== 80 || !/^[GN]+$/.test(TOUCH_SEQUENCE_TEXT) ||
    TOUCH_WARMUP.length !== 8 || TOUCH_SEQUENCE.some((value, index) => value !== (TOUCH_SEQUENCE_TEXT[index] === 'G' ? 'GO' : 'NO_GO'))) return false
  for (let block = 0; block < 4; block++) {
    if (TOUCH_SEQUENCE_TEXT.slice(block * 20, block * 20 + 20).split('G').length - 1 !== 15) return false
  }
  const allStandard = [...stopFormRegistry.all, ...stopV13FormRegistry.all]
  if (allStandard.some(form => form.sequence.every((value, index) => value === TOUCH_SEQUENCE[index]))) return false
  const canonical = `${TOUCH_FORM_VERSION}\n${TOUCH_FORM_ID}\n${TOUCH_SEQUENCE_TEXT}\n`
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical))
  const actual = [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('')
  return actual === TOUCH_FORM_CHECKSUM
}
