import { loadGameFonts } from '../design/gameFonts'
/** Owns the complete scored display. The ordinary React document is detached
 * during play so unrelated app styling cannot change what a trial paints. */
const TASK_CSS = `
:host { all:initial; display:block; background:#fff; color:#111; font:16px system-ui; direction:ltr; writing-mode:horizontal-tb; }
.mouth-host { box-sizing:border-box; display:block; width:min(32rem,calc(100vw - 32px)); margin:16px auto; padding:12px; border:2px solid #162a20; border-radius:16px; background:#fff; color:#111; }
.mouth-host.mouth-inverted { background:#111; color:#fff; border-color:#fff; }
.mouth-bank { box-sizing:border-box; display:block; width:240px; min-height:28px; margin:0 auto; padding:0; color:inherit; background:transparent; font:18px system-ui; text-align:center; }
.mouth-bank:has(+ .mouth-host.mouth-inverted) { color:#fff; background:#111; }
.mouth-stage { box-sizing:border-box; display:grid; place-items:center; width:240px; height:240px; min-width:0; min-height:0; margin:0 auto; padding:0; border:0; font:32px system-ui; }
.mouth-stage svg { display:block; width:240px; height:240px; }
.mouth-responses { box-sizing:border-box; display:flex; gap:12px; width:240px; margin:12px auto 0; padding:0; border:0; min-width:0; }
.mouth-responses button { box-sizing:border-box; display:block; flex:1; min-width:0; height:48px; margin:0; padding:0; border:2px solid #162a20; border-radius:6px; background:#fff; color:#111; font:16px system-ui; text-align:center; touch-action:none; cursor:pointer; }
.mouth-stage output { display:block; color:inherit; font:32px system-ui; }
button:focus-visible { outline:3px solid #005fcc; outline-offset:4px; }
button[data-mouth-exit] { box-sizing:border-box; display:block; width:160px; height:48px; margin:12px auto; border:2px solid #162a20; border-radius:6px; background:#fff; color:#111; font:16px system-ui; cursor:pointer; }
`

const attrs = (node: Element) => JSON.stringify([...node.attributes].map(a => [a.name, a.value]).sort(([a], [b]) => a.localeCompare(b)))
const hostAttrs = (inverted: boolean, hidden = false) => {
  const expected = document.createElement('fieldset')
  expected.className = inverted ? 'mouth-host mouth-inverted' : 'mouth-host'
  expected.setAttribute('aria-label', 'Lengths visual task display')
  expected.tabIndex = -1
  expected.hidden = hidden
  return attrs(expected)
}
const children = (node: Node, expected: Node[]) => node.childNodes.length === expected.length && expected.every((child, i) => node.childNodes[i] === child)
type Sheet = { node: HTMLStyleElement; text: string; textNode: ChildNode | null; sheet: CSSStyleSheet | null; rules: string }
const sheetRecord = (node: HTMLStyleElement, text: string): Sheet => ({ node, text, textNode: node.firstChild, sheet: node.sheet, rules: node.sheet ? [...node.sheet.cssRules].map(r => r.cssText).join('\n') : '' })
const intactSheet = (s: Sheet) => s.node.attributes.length === 0 && s.node.textContent === s.text && children(s.node, [s.textNode!]) && s.textNode?.nodeType === Node.TEXT_NODE && s.node.sheet === s.sheet && !!s.sheet && !s.sheet.disabled && [...s.sheet.cssRules].map(r => r.cssText).join('\n') === s.rules

export class ExclusiveMouthDocument {
  #doctype = document.doctype
  #html = document.createElement('html')
  #head = document.createElement('head')
  #body = document.createElement('body')
  #root: ShadowRoot
  #charset = document.createElement('meta')
  #viewport = document.createElement('meta')
  #title = document.createElement('title')
  #titleText = document.createTextNode('Lengths — TraitGame')
  #ui = document.createElement('fieldset')
  #uiStyle = document.createElement('style')
  #uiSheet: Sheet
  #taskStyle = document.createElement('style')
  #taskSheet: Sheet | null = null
  #host = document.createElement('fieldset')
  #exit = document.createElement('button')
  #exitText = document.createTextNode('End this attempt')
  #exitLabel: string
  #bank = document.createElement('output')
  #bankText = document.createTextNode('Simulated total: $0.00')
  #bankCents = 0
  #exitAction: (() => void) | null = null
  #fixed = new Map<Element, string>()
  #active = false
  #compromised = false
  #quarantined = false
  #hostAttrs = ''
  #htmlAttrs: string
  #responseMarkup = ''
  #previewMount: HTMLElement | null = null
  #uiCss: string

  constructor(uiCss: string, mockContext = false) {
    loadGameFonts()
    this.#exitLabel = mockContext ? 'Return to mock' : 'End this attempt'
    this.#exitText.data = this.#exitLabel
    if (window.top !== window || !this.#doctype || this.#doctype.name !== 'html' || this.#doctype.publicId || this.#doctype.systemId)
      throw Error('Lengths needs its own full page. Return to the library and open it again.')
    this.#root = this.#body.attachShadow({ mode: 'closed' })
    this.#html.lang = 'en'
    this.#charset.setAttribute('charset', 'utf-8')
    this.#viewport.name = 'viewport'; this.#viewport.content = 'width=device-width, initial-scale=1.0'
    this.#title.append(this.#titleText); this.#head.append(this.#charset, this.#viewport, this.#title)
    this.#uiCss = `${uiCss}\n:host { display:block; margin:0; }\nfieldset[data-mouth-ui] { display:block; margin:0; padding:0; border:0; min-width:0; }\n[hidden] { display:none !important; }`
    this.#ui.setAttribute('data-mouth-ui', '')
    this.#uiStyle.textContent = this.#uiCss
    this.#taskStyle.textContent = TASK_CSS
    this.#host.className = 'mouth-host'
    this.#host.setAttribute('aria-label', 'Lengths visual task display')
    this.#host.tabIndex = -1
    this.#host.hidden = true
    this.#exit.type = 'button'; this.#exit.setAttribute('data-mouth-exit', ''); this.#exit.append(this.#exitText)
    this.#exit.addEventListener('click', () => this.#exitAction?.())
    this.#bank.className = 'mouth-bank'; this.#bank.setAttribute('aria-label','Simulated total'); this.#bank.append(this.#bankText)
    this.#root.append(this.#uiStyle, this.#ui)
    this.#html.append(this.#head, this.#body)
    document.replaceChild(this.#html, document.documentElement)
    // Pin the new document before any Start listener can change its paint.
    this.#htmlAttrs = attrs(this.#html)
    for (const node of [this.#html, this.#head, this.#body, this.#charset, this.#viewport, this.#title, this.#ui, this.#exit, this.#bank]) this.#fixed.set(node, attrs(node))
    this.#uiSheet = sheetRecord(this.#uiStyle, this.#uiCss)
  }
  get uiMount(): HTMLElement { return this.#ui }
  get presentationHost(): HTMLElement { return this.#host }
  get active(): boolean { return this.#active }
  setBank(cents:number):void {
    if(!Number.isSafeInteger(cents)||cents<0||cents>760)throw Error('Invalid simulated bank')
    this.#bankCents=cents;this.#bankText.data=`Simulated total: $${(cents/100).toFixed(2)}`
  }
  bankValid(cents=this.#bankCents):boolean {
    if(!this.#active||this.#bankText.data!==`Simulated total: $${(cents/100).toFixed(2)}`||!children(this.#bank,[this.#bankText])||attrs(this.#bank)!==this.#fixed.get(this.#bank)||this.#bank.getAnimations().length)return false
    const box=this.#bank.getBoundingClientRect(),v=window.visualViewport,left=v?.offsetLeft??0,top=v?.offsetTop??0,right=left+(v?.width??innerWidth),bottom=top+(v?.height??innerHeight)
    if(!box.width||!box.height||box.left<left||box.top<top||box.right>right||box.bottom>bottom)return false
    for(let node:Element|null=this.#bank;node;node=node.parentElement){const style=getComputedStyle(node);if(style.display==='none'||style.visibility!=='visible'||Number(style.opacity)!==1||style.filter!=='none'||style.clipPath!=='none'||style.transform!=='none'||style.getPropertyValue('mix-blend-mode')!=='normal')return false;const area=node.getBoundingClientRect();if(node!==this.#bank&&(style.overflowX!=='visible'||style.overflowY!=='visible'||style.contain.split(/\s+/).includes('paint'))&&(box.left<area.left-0.5||box.top<area.top-0.5||box.right>area.right+0.5||box.bottom>area.bottom+0.5))return false}
    const paint=getComputedStyle(this.#bank),expectedBackground=this.#host.classList.contains('mouth-inverted')?'rgb(17, 17, 17)':'rgba(0, 0, 0, 0)';if(paint.color!==getComputedStyle(this.#host).color||paint.backgroundColor!==expectedBackground||paint.fontSize!=='18px'||paint.textAlign!=='center')return false
    const hit=this.#root.elementFromPoint((box.left+box.right)/2,(box.top+box.bottom)/2);return hit===this.#bank||this.#bank.contains(hit)
  }
  showReady(ready: boolean, mount?: HTMLElement | null): void {
    if (this.#active) return
    this.#host.hidden = !ready
    if (ready && mount) { this.#previewMount = mount; mount.append(this.#host) }
    else { this.#host.remove(); this.#previewMount = null }
  }
  #documentIntact(): boolean {
    return document.documentElement === this.#html && document.head === this.#head && document.body === this.#body &&
      children(document, [this.#doctype!, this.#html]) && children(this.#html, [this.#head, this.#body]) &&
      children(this.#head, [this.#charset, this.#viewport, this.#title]) && children(this.#title, [this.#titleText]) &&
      this.#titleText.data === 'Lengths — TraitGame' && !this.#charset.childNodes.length && !this.#viewport.childNodes.length &&
      !this.#body.childNodes.length && this.#body.isConnected && this.#root.host === this.#body && this.#root.mode === 'closed' && this.#body.shadowRoot === null &&
      document.styleSheets.length === 0 && document.adoptedStyleSheets.length === 0 && this.#root.adoptedStyleSheets.length === 0 &&
      document.fullscreenElement === null && [...this.#fixed].every(([node, value]) => attrs(node) === value) &&
      [this.#html, ...this.#fixed.keys(), this.#uiStyle, this.#taskStyle, this.#host].every(node => node.getAnimations().length === 0)
  }
  enter(onExit: () => void, inverted: boolean): void {
    // The host may be hidden at a break, but its other attributes are fixed.
    const expectedHostAttrs = hostAttrs(inverted)
    if (this.#quarantined || this.#active || !this.#documentIntact() || !children(this.#root, [this.#uiStyle, this.#ui]) || !intactSheet(this.#uiSheet) || this.#taskStyle.textContent !== TASK_CSS ||
      attrs(this.#host) !== expectedHostAttrs && attrs(this.#host) !== hostAttrs(inverted, true))
      { this.#recover(); throw Error('The Lengths display changed. Reload and complete setup again.') }
    this.#host.hidden = false
    this.#hostAttrs = expectedHostAttrs
    this.#responseMarkup = this.#host.querySelector('.mouth-responses')?.outerHTML ?? ''
    if (!this.#responseMarkup) throw Error('Response controls are unavailable.')
    this.#exitAction = onExit
    this.#root.replaceChildren(this.#taskStyle, this.#exit, this.#bank, this.#host)
    this.#taskSheet = sheetRecord(this.#taskStyle, TASK_CSS)
    this.#active = true
    window.scrollTo(0, 0)
  }
  leave(): void {
    if (!this.#active) return
    this.#active = false; this.#exitAction = null
    if (this.#compromised || !this.#documentIntact() || attrs(this.#html) !== this.#htmlAttrs) { this.#recover(); return }
    this.#host.hidden = true
    this.#root.replaceChildren(this.#uiStyle, this.#ui)
    if (this.#previewMount?.isConnected) this.#previewMount.append(this.#host)
    this.#uiSheet = sheetRecord(this.#uiStyle, this.#uiCss)
  }
  #recover(): void {
    if (this.#quarantined) return
    this.#quarantined = true
    const html = document.createElement('html'), head = document.createElement('head'), body = document.createElement('body')
    html.lang = 'en'
    const title = document.createElement('title'); title.textContent = 'Lengths recovery'; head.append(title)
    const root = body.attachShadow({ mode: 'closed' })
    const style = document.createElement('style'); style.textContent = this.#uiCss
    const notice = document.createElement('p'); notice.setAttribute('role', 'alert')
    notice.textContent = 'The Lengths display changed. Review retained results here. Reload before another timed practice.'
    root.append(style, notice, this.#ui); html.append(head, body)
    document.adoptedStyleSheets = []
    for (const node of [...document.childNodes]) if (node !== document.documentElement && node !== this.#doctype) node.parentNode?.removeChild(node)
    if (document.documentElement) document.replaceChild(html, document.documentElement)
    else document.append(html)
    if (this.#doctype!.parentNode !== document) document.insertBefore(this.#doctype!, html)
  }
  check(host: HTMLElement): boolean {
    const stage = host.querySelector('.mouth-stage'), responses = host.querySelector('.mouth-responses')
    const buttons = responses?.querySelectorAll('button[data-mouth-side]')
    if (!this.#active || host !== this.#host || !this.#documentIntact() || attrs(this.#html) !== this.#htmlAttrs || !children(this.#root, [this.#taskStyle, this.#exit, this.#bank, host]) ||
      !this.#taskSheet || !intactSheet(this.#taskSheet) || attrs(host) !== this.#hostAttrs ||
      !stage || !responses || !buttons || buttons.length !== 2 || !children(host, [stage, responses]) ||
      responses.outerHTML !== this.#responseMarkup || !children(this.#exit, [this.#exitText]) || this.#exitText.data !== this.#exitLabel || !this.bankValid() ||
      [...host.querySelectorAll('*')].some(node => !new Set(['fieldset', 'button', 'svg', 'circle', 'line', 'rect', 'output']).has(node.localName) || node.getAnimations().length > 0) ||
      [...this.#root.querySelectorAll('*')].some(node => node.getAnimations().length > 0)) { this.#compromised = true; return false }
    const vv = window.visualViewport, left = vv?.offsetLeft ?? 0, top = vv?.offsetTop ?? 0
    const right = left + (vv?.width ?? innerWidth), bottom = top + (vv?.height ?? innerHeight)
    for (const node of [stage, ...buttons, this.#exit, this.#bank]) {
      const box = node.getBoundingClientRect(), focus = node.matches(':focus-visible') ? 7 : 0
      if (!box.width || !box.height || box.left - focus < left || box.top - focus < top || box.right + focus > right || box.bottom + focus > bottom) return false
    }
    const svg = stage.querySelector('svg'), stageBox = stage.getBoundingClientRect(), svgBox = svg?.getBoundingClientRect()
    if (Math.abs(stageBox.width - 240) > 1 || Math.abs(stageBox.height - 240) > 1 || svgBox &&
      (Math.abs(svgBox.width - 240) > 1 || Math.abs(svgBox.height - 240) > 1 || svgBox.left < stageBox.left || svgBox.right > stageBox.right || svgBox.top < stageBox.top || svgBox.bottom > stageBox.bottom)) return false
    return true
  }
}
