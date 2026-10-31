import {describe,it,expect} from 'vitest'
import {containsInOrder,outerAttributes,ownedHeadDefinitions} from './ownedDocumentOuter'
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

it('does not admit a competing base URL or viewport definition alongside owned metadata',()=>{
 const doc=document.implementation.createHTMLDocument('test'),head=doc.head,charset=doc.createElement('meta'),viewport=doc.createElement('meta'),title=doc.createElement('title')
 head.replaceChildren()
 charset.setAttribute('charset','utf-8');viewport.name='viewport';head.append(charset,viewport,title)
 expect(ownedHeadDefinitions(head,charset,viewport,title)).toBe(true)
 const unrelated=document.createElement('style');head.append(unrelated);expect(ownedHeadDefinitions(head,charset,viewport,title)).toBe(true)
 const base=document.createElement('base');head.append(base);expect(ownedHeadDefinitions(head,charset,viewport,title)).toBe(false)
 base.remove();const other=viewport.cloneNode();head.append(other);expect(ownedHeadDefinitions(head,charset,viewport,title)).toBe(false)
})

it('rejects active HTML definitions in body while allowing an inert SVG title',()=>{
 const doc=document.implementation.createHTMLDocument('test'),head=doc.head,charset=doc.createElement('meta'),viewport=doc.createElement('meta'),title=doc.createElement('title')
 charset.setAttribute('charset','utf-8');viewport.name='viewport';head.replaceChildren(charset,viewport,title)
 const svg=doc.createElementNS('http://www.w3.org/2000/svg','svg'),svgTitle=doc.createElementNS(svg.namespaceURI,'title');svgTitle.textContent='Extension icon';svg.append(svgTitle);doc.body.append(svg)
 expect(ownedHeadDefinitions(head,charset,viewport,title)).toBe(true)
 const base=doc.createElement('base');base.href='https://example.invalid/';doc.body.append(base)
 expect(ownedHeadDefinitions(head,charset,viewport,title)).toBe(false)
 base.remove();const competing=viewport.cloneNode();doc.body.append(competing)
 expect(ownedHeadDefinitions(head,charset,viewport,title)).toBe(false)
})
