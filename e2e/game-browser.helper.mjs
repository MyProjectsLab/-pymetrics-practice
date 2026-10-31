// Read-only CDP inspection reaches author-owned closed roots. Activations below
// remain native browser pointer/key events; no receipts or results are injected.
export async function gameBrowser(page) {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('DOM.enable')
  async function roots() {
    const { root } = await cdp.send('DOM.getDocument', { depth: -1, pierce: true })
    const ids = [root.backendNodeId]
    function walk(node) { for (const child of node.shadowRoots || []) { ids.push(child.backendNodeId); walk(child) } for (const child of node.children || []) walk(child) }
    walk(root)
    const result = []
    for (const backendNodeId of ids) result.push((await cdp.send('DOM.resolveNode', { backendNodeId })).object.objectId)
    return result
  }
  async function call(objectId, fn, args = [], byValue = true) {
    const result = await cdp.send('Runtime.callFunctionOn', { objectId, functionDeclaration: typeof fn === 'string' ? fn : fn.toString(), arguments: args.map(value => ({ value })), returnByValue: byValue })
    if (result.exceptionDetails) throw Error(result.exceptionDetails.text)
    return byValue ? result.result.value : result.result
  }
  const selection = function(selector, name, exact) {
    const text = e => e.matches('input') ? [...(e.labels || [])].map(l => l.textContent).join(' ') : e.innerText || e.textContent || ''
    return [...this.querySelectorAll(selector)].filter(e => {
      const r = e.getBoundingClientRect(), s = getComputedStyle(e), label = text(e).replace(/\s+/g, ' ').trim()
      return r.width > 2 && r.height > 2 && s.visibility === 'visible' && s.display !== 'none' && (!name || (exact ? label === name : label.includes(name)))
    })
  }
  async function elements(selector, name = '', exact = false) {
    const found = []
    for (const root of await roots()) {
      const select = `function(selector,name,exact,index) { const select = ${selection}; const items = select.call(this,selector,name,exact); return index === null ? items.length : items[index] }`
      const count = await call(root, select, [selector, name, exact, null])
      for (let i = 0; i < count; i++) {
        const node = await call(root, select, [selector, name, exact, i], false)
        found.push(node.objectId)
      }
    }
    return found
  }
  async function click(name, selector = 'button,a,summary,input[type=radio]', exact = true) {
    const ids = await elements(selector, name, exact)
    if (!ids.length) throw Error(`No visible control: ${name}`)
    const id = ids[0]
    await call(id, function() { this.scrollIntoView({ block: 'nearest' }) })
    const box = await call(id, function() { const r = this.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, disabled: !!this.disabled } })
    if (box.disabled) throw Error(`Disabled control: ${name}`)
    await page.mouse.click(box.x, box.y)
  }
  async function snapshot() {
    const result = []
    for (const root of await roots()) result.push(...await call(root, function() {
      return [...this.querySelectorAll('h1,h2,legend,button,summary,input,label,[role=status],[role=alert]')].flatMap(e => {
        const r = e.getBoundingClientRect(), s = getComputedStyle(e)
        if (r.width <= 2 || r.height <= 2 || s.display === 'none' || s.visibility !== 'visible') return []
        return [{ tag: e.tagName, text: (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 210), type: e.type, name: e.name, disabled: !!e.disabled, checked: !!e.checked, value: e.value, box: { x: r.x, y: r.y, width: r.width, height: r.height } }]
      })
    }))
    return result
  }
  async function fonts() {
    const result = []
    for (const root of await roots()) result.push(...await call(root, function() {
      return [...this.querySelectorAll('*')].flatMap(e => {
        if (![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) return []
        const r = e.getBoundingClientRect(), s = getComputedStyle(e)
        if (r.width <= 2 || r.height <= 2 || s.display === 'none' || s.visibility !== 'visible') return []
        return [{ text: e.textContent.trim().slice(0, 100), size: parseFloat(s.fontSize) }]
      })
    }))
    return result
  }
  return { click, snapshot, fonts, elements, call, close: () => cdp.detach() }
}
