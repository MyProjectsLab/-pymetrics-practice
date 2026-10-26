import source from '../../docs/specifications/ASSESSMENT_PRACTICE_TOWERS_FORMS_V1_0_DRAFT.json'

export type Board = [number[], number[], number[]]
export interface Disk { id: number; color: string; pattern: string; name: string }
export interface Form {
  formId: string; formVersion: string; start: Board; target: Board
  disks: Disk[]; limitMs: number; optimalMoves: number
}
export interface CheckedForm { form: Form; hash: string }
const HASHES = [
  'bfb13f60cf5383840bf2d45bc691d84c94488150ce64e76793d3a3f15e987014',
  'b93f1dabfb1d7e89a71774658f1a813a0d145c691ba63065086fa866cfa482f8',
  '5de25d34a2310f1d9ba6a829185504c84816a65f421e00afdb0bd9a4dd90e084',
  'dc484c03b7daf7c4faa7278046d14d6bb2d87528db8b919ecf7f204112522907',
  '6f56ac92455ff438583a035722a5f53c533faa28135760ea3a878fe430ea61e7',
  'b8b6306833ed8ce6571d9ef940a5c39b7508b934268afaf60a272e1c3f62224b',
] as const
let checked: readonly CheckedForm[] | null = null

function requireForm(ok: unknown, message: string): asserts ok {
  if (!ok) throw Error(`Towers form integrity: ${message}`)
}
async function sha256(value: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('')
}
export async function loadTowersForms(): Promise<readonly CheckedForm[]> {
  if (checked) return checked
  requireForm(source.schemaVersion === 'towers-forms-v1.0-draft' && source.forms.length === 6,
    'manifest header')
  const result: CheckedForm[] = []
  for (const [i, value] of source.forms.entries()) {
    const form = value as Form
    requireForm(form.formId === `TW${i + 1}` && form.formVersion === 'towers-form-v1.0-draft' &&
      form.limitMs === 120000 && form.optimalMoves === 9 && form.start.length === 3 &&
      form.target.length === 3 && form.start.map(stack => stack.length).join() === '3,0,2' &&
      form.target.map(stack => stack.length).join() === '5,0,0' &&
      [...form.start.flat()].sort().join() === '1,2,3,4,5' &&
      [...form.target.flat()].sort().join() === '1,2,3,4,5' &&
      form.disks.length === 5 && form.disks.every((disk, index) => disk.id === index + 1 &&
        /^#[0-9a-f]{6}$/i.test(disk.color) && !!disk.pattern && !!disk.name), 'form support')
    const hash = await sha256(JSON.stringify(form))
    requireForm(hash === HASHES[i], `form ${i + 1} bytes`)
    result.push({ form: structuredClone(form), hash })
  }
  checked = result
  return result
}
export function assignedForm(forms: readonly CheckedForm[], ordinal: number) {
  requireForm(Number.isSafeInteger(ordinal) && ordinal > 0, 'ordinal')
  return forms[(ordinal - 1) % forms.length]
}
