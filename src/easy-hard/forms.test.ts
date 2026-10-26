import { describe, expect, it } from 'vitest'
import { formForOrdinal, loadForms } from './forms'

describe('frozen Easy or Hard forms', () => {
  it('admits the four reviewed form identities and cycles only after exposure', async () => {
    const forms = await loadForms()
    expect([...forms.keys()]).toEqual(['EH1', 'EH2', 'EH3', 'EH4'])
    expect(formForOrdinal(forms, 1).form.formId).toBe('EH1')
    expect(formForOrdinal(forms, 5).form.formId).toBe('EH1')
    expect(formForOrdinal(forms, 1).form.entries[0]).toEqual({
      index: 1, probabilityPercent: 88, hardOfferCents: 124,
      fallbackTask: 'hard', lotteryDrawBasisPoints: 4836,
    })
  })
})
