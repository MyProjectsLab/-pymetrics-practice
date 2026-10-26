import { expect,it } from 'vitest'
import { project } from './contract'
it('rejects extras, individual Money answers, malformed numbers, denominators and unknown families',()=>{
  expect(project('money_1','practice','completed',{exchanges:1,sentCents:500} as never)).toBeNull()
  expect(project('money_2','practice','completed',{exchanges:2,rating:10} as never)).toBeNull()
  for(const correct of [NaN,Infinity,-1,15,1.5])expect(project('faces','practice','completed',{correct,trials:14})).toBeNull()
  expect(project('faces','practice','completed',{correct:12,trials:12})).toBeNull()
  expect(project('arrows','practice','completed',{correct:120,trials:120})).toBeNull()
  expect(project('digits','practice','completed',{correct:8,trials:7,maximum_length:6})).toBeNull()
  expect(project('balloons','practice','completed',{rounds:39,bursts:20,collections:20,pumps:300,banked_cents:200})).toBeNull()
  expect(project('faces','practice','invalid',{correct:10,trials:14})).toBeNull()
  expect(project('__proto__' as never,'practice','incomplete')).toBeNull()
})
