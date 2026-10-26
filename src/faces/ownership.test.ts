import {describe,it,expect} from 'vitest'
import {Ownership} from './ownership'

describe('Faces private ownership boundary',()=>{
 it('rejects a nested cross-owner alias atomically, including a retired importer',()=>{
  const r=new Ownership(),b=r.own('B',{timing:987654,child:{choice:'private B'}}),wrapper={child:b,whenObserved:13579}
  expect(()=>r.own('A',wrapper)).toThrow('alias')
  expect(r.owner(wrapper)).toBeUndefined();r.retire('A')
  expect(()=>r.own('A',wrapper)).toThrow('alias')
  expect(b).toEqual({timing:987654,child:{choice:'private B'}})
  expect(wrapper.whenObserved).toBe(13579)
 })
 it('scrubs original detached DOM descendants, Attr and independently retained data children',()=>{
  const r=new Ownership(),node=document.createElement('p');node.setAttribute('data-time','123456');const text=document.createTextNode('selected private answer');node.append(text)
  const attr=node.getAttributeNode('data-time')!,child={whenObserved:123456},root=r.own('A',{node,child})
  text.remove();node.removeAttribute('data-time');delete (root as Partial<typeof root>).child
  r.retire('A');expect(text.data).toBe('');expect(attr.value).toBe('');expect(child).toEqual({})
 })
 it('erases the actual fulfilled and losing-race object while preserving the survivor partition',async()=>{
  const r=new Ownership(),root={attempts:[{id:'A',facts:{elapsed:13579}},{id:'B',facts:{elapsed:97531}}]}
  r.importRoot(root);const a=root.attempts[0],child=a.facts,b=root.attempts[1],bytes=JSON.stringify(b)
  const original=Promise.resolve(a),aggregate=Promise.all([original]),race=Promise.race([original,Promise.resolve('PUBLIC')])
  expect(await original).toBe(a);r.retire('A')
  expect(child).toEqual({});expect(await aggregate).toEqual([{}]);expect(await race).toEqual({});expect(JSON.stringify(b)).toBe(bytes)
 })
 it('preflights every partition before mutating any ownership or retired input',()=>{
  const r=new Ownership(),shared={elapsed:13579},a={id:'A',facts:shared},b={id:'B',facts:shared}
  r.retire('A');expect(()=>r.importRoot({attempts:[a,b]})).toThrow('alias')
  expect(shared.elapsed).toBe(13579);expect(r.owner(a)).toBeUndefined();expect(r.owner(b)).toBeUndefined()
 })
 it('resets original generation metadata as well as independently retained attempt descendants',()=>{
  const r=new Ownership(),root={installationId:'old',generation:1,exposure:[{familiarity:'familiar'}],attempts:[{id:'A',facts:{whenObserved:13579}}]}
  r.importRoot(root);const metadata=root.exposure[0],fact=root.attempts[0].facts;r.reset()
  expect(root).toEqual({});expect(metadata).toEqual({});expect(fact).toEqual({})
  const successor=r.own('B',{whenObserved:97531});expect(successor.whenObserved).toBe(97531)
 })
})
