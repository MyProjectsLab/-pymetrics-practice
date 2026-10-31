import {describe,it,expect} from 'vitest'
import {containsInOrder,outerAttributes} from './ownedDocumentOuter'
describe('owned document outside boundary',()=>{
 it('allows unrelated siblings without admitting replacement or reordering',()=>{
  const parent=document.createElement('div'),first=document.createElement('meta'),last=document.createElement('title'),outside=document.createElement('aside')
  parent.append(first,outside,last)
  expect(containsInOrder(parent,[first,last])).toBe(true)
  outside.replaceWith(first.cloneNode())
  expect(containsInOrder(parent,[first,last])).toBe(true)
  first.remove();expect(containsInOrder(parent,[first,last])).toBe(false)
  parent.append(first);expect(containsInOrder(parent,[first,last])).toBe(false)
 })
 it('ignores extension markers only on explicitly selected outer ancestors',()=>{
  const node=document.createElement('body'),before=outerAttributes(node)
  node.className='extension';node.dataset.extension='ready'
  expect(outerAttributes(node)).toBe(before)
  node.style.opacity='.5';expect(outerAttributes(node)).not.toBe(before)
  node.removeAttribute('style');node.hidden=true;expect(outerAttributes(node)).not.toBe(before)
 })
})
