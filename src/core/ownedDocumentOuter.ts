/** Extension-owned light DOM is outside the sealed assessment. Only the owned
 * ancestors may inherit its CSS; their paint and overlapping outsiders are
 * checked separately from the exact author-owned shadow tree. */
export function outerAttributes(node: Element): string {
  return JSON.stringify([...node.attributes].filter(a => a.name !== 'class' && !a.name.startsWith('data-'))
    .map(a => [a.name, a.value]).sort(([a], [b]) => a.localeCompare(b)))
}
export function containsInOrder(parent: Node, owned: readonly Node[]): boolean {
  const nodes: Node[] = [...parent.childNodes]
  return owned.every((node, i) => node.parentNode === parent && (i === 0 || nodes.indexOf(owned[i - 1]) < nodes.indexOf(node)))
}
const paintProperties = ['display','visibility','opacity','transform','perspective','rotate','scale','translate','filter','backdrop-filter','clip-path','clip','mask-image','mix-blend-mode','content-visibility','zoom','font-size','font-family','line-height','direction','writing-mode','background-color','background-image','box-shadow','text-shadow','border-image-source','mask-border-source','offset-path','isolation','position','z-index','overflow-x','overflow-y','contain','margin-top','margin-right','margin-bottom','margin-left','padding-top','padding-right','padding-bottom','padding-left','top','right','bottom','left','border-top-width','border-right-width','border-bottom-width','border-left-width']
export function ancestorPaint(nodes: readonly Element[]): string {
  return JSON.stringify(nodes.map(node => {
    const style = getComputedStyle(node)
    return [paintProperties.map(name => style.getPropertyValue(name)), ...['::before','::after'].map(pseudo=>getComputedStyle(node,pseudo).content)]
  }))
}
export function outsideOccludes(surface: Element, ownedOuter: readonly Element[]): boolean {
  const box = surface.getBoundingClientRect()
  if (box.width <= 0 || box.height <= 0) return true
  for (const node of document.querySelectorAll('html *')) {
    if (ownedOuter.includes(node)) continue
    const style = getComputedStyle(node), r = node.getBoundingClientRect()
    if (style.display !== 'none' && style.visibility === 'visible' && Number(style.opacity) !== 0 &&
      r.width > 0 && r.height > 0 && r.left < box.right && r.right > box.left && r.top < box.bottom && r.bottom > box.top) return true
  }
  return false
}

/** Do not learn an already altered ancestor as a new trusted paint baseline. */
export function ancestorPaintSafe(nodes: readonly Element[]): boolean {
  return nodes.every(node => {
    const style=getComputedStyle(node)
    const expected: Record<string,string[]> = {
      display:['block'],visibility:['visible'],opacity:['1'],transform:['none'],perspective:['none'],
      rotate:['none'],scale:['none'],translate:['none'],filter:['none'],'backdrop-filter':['none'],
      'clip-path':['none'],clip:['auto'],'mask-image':['none'],'mix-blend-mode':['normal'],
      'content-visibility':['visible'],zoom:['1','normal'],'writing-mode':['horizontal-tb'],direction:['ltr'],
      position:['static'],top:['auto'],right:['auto'],bottom:['auto'],left:['auto'],
      'margin-top':['0px'],'margin-right':['0px'],'margin-bottom':['0px'],'margin-left':['0px'],
      'padding-top':['0px'],'padding-right':['0px'],'padding-bottom':['0px'],'padding-left':['0px'],
      'border-top-width':['0px'],'border-right-width':['0px'],'border-bottom-width':['0px'],'border-left-width':['0px'],
      'background-image':['none'],'box-shadow':['none'],'text-shadow':['none'],'animation-name':['none'],
    }
    return Object.entries(expected).every(([key,values])=>!style.getPropertyValue(key)||values.includes(style.getPropertyValue(key))) &&
      ['::before','::after'].every(p=>['none','normal'].includes(getComputedStyle(node,p).content))
  })
}

/** Extra styles/markers may coexist; competing document definitions may not. */
export function ownedHeadDefinitions(head: HTMLHeadElement, charset: Element, viewport: Element, title: Element): boolean {
  const definitions=[...head.querySelectorAll('meta[charset],meta[name="viewport" i],title,base')]
  return definitions.length===3 && definitions.includes(charset) && definitions.includes(viewport) && definitions.includes(title)
}
