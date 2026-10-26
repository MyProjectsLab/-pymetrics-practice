import { describe, expect, it } from 'vitest'
import fixture from '../../docs/specifications/ASSESSMENT_PRACTICE_MONEY_EXCHANGE_1_FIXTURES_V1_0_DRAFT.json'
import { loadForms, outcome, parseCents } from './core'

describe('Money Exchange 1 frozen arithmetic',()=>{
  it('replays all 36 independently reviewed cent cases',async()=>{
    const forms=await loadForms()
    expect(forms).toHaveLength(6)
    for(const row of fixture.cases){
      expect(forms.find(form=>form.id===row.formId)?.returnBps).toBe(row.returnBps)
      expect(outcome(row.sentCents,row.returnBps)).toEqual({
        sentCents:row.sentCents,potCents:row.potCents,returnedCents:row.returnedCents,
        selfCents:row.selfCents,partnerCents:row.partnerCents})
    }
  })
  it('accepts only an unambiguous cent amount within the filmed $10 endowment',()=>{
    expect(parseCents('0')).toBe(0)
    expect(parseCents('0.01')).toBe(1)
    expect(parseCents('5')).toBe(500)
    expect(parseCents('10.00')).toBe(1000)
    for(const value of ['', '-1', '10.01', '2.345', '1e1', 'Infinity', '01', '1,00'])
      expect(parseCents(value)).toBeNull()
  })
})
