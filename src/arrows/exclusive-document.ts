import sizeTokens from '../design/tokens.css?inline'
import { loadGameFonts } from '../design/gameFonts'
/** A deliberately tiny author-owned document. Closed mode is encapsulation;
 * topology/identity, not absence inferred from shadowRoot, is the admission rule. */
const PROTECTED_CSS = `${sizeTokens}

:host { all: initial; display: block; margin: 0; background: #fff; color: #172d30; font: 16px system-ui; direction: ltr; writing-mode: horizontal-tb; }
fieldset { all: initial; display: grid; place-items: center; box-sizing: border-box; width: 420px; min-height: 240px; margin: 24px auto; padding: 32px; border: 2px solid #587568; border-radius: 8px; background: #fff; direction: ltr; writing-mode: horizontal-tb; }
button { all: initial; display: block; box-sizing: border-box; width: 160px; height: 44px; margin: 24px auto; border: 2px solid #18594f; border-radius: 6px; background: #fff; color: #18594f; font: 16px system-ui; text-align: center; cursor: pointer; direction: ltr; writing-mode: horizontal-tb; }
button:focus-visible { outline: 3px solid #995500; outline-offset: 4px; }
:host { font-size:var(--ap-font-body); line-height:var(--ap-line-height); }
button { height:var(--ap-button-height); min-height:var(--ap-button-height); font-size:var(--ap-font-button); line-height:var(--ap-line-height); }
button[data-mouth-exit] { width:max(160px,var(--ap-button-width)); height:var(--ap-button-height); font-size:var(--ap-font-button); }
.mouth-responses button { height:var(--ap-button-height); font-size:var(--ap-font-button); }
@media(min-width:768px) { button { min-width:var(--ap-button-width); } .mouth-responses { width:calc(2 * var(--ap-button-width) + var(--ap-control-gap)); gap:var(--ap-control-gap); } }

`
const attrs = (node: Element) => JSON.stringify([...node.attributes].map(a => [a.name, a.value]).sort(([a], [b]) => a.localeCompare(b)))
const children = (node: Node, expected: Node[]) => node.childNodes.length === expected.length && expected.every((child, i) => node.childNodes[i] === child)
type Sheet = { node: HTMLStyleElement; textNode: ChildNode | null; text: string; sheet: CSSStyleSheet | null; rules: string }
const sheetRecord = (node: HTMLStyleElement, text: string): Sheet => ({ node, textNode: node.firstChild, text, sheet: node.sheet, rules: node.sheet ? [...node.sheet.cssRules].map(r => r.cssText).join('\n') : '' })
const sheetIntact = (value: Sheet) => value.node.attributes.length === 0 && value.node.textContent === value.text && value.node.childNodes.length === 1 && value.node.firstChild === value.textNode && value.textNode?.nodeType === Node.TEXT_NODE && value.node.sheet === value.sheet && !!value.sheet && !value.sheet.disabled && [...value.sheet.cssRules].map(r => r.cssText).join('\n') === value.rules

export interface ArrowsDocumentBoundary {
  check(host: HTMLElement, shell: HTMLElement, root: ShadowRoot): boolean
}

export class ExclusiveArrowsDocument implements ArrowsDocumentBoundary {
  #html = document.createElement('html')
  #head = document.createElement('head')
  #body = document.createElement('body')
  #doctype = document.doctype
  #root: ShadowRoot
  #charset = document.createElement('meta')
  #viewport = document.createElement('meta')
  #title = document.createElement('title')
  #titleText = document.createTextNode('Arrows — TraitGame')
  #ui = document.createElement('fieldset')
  #uiStyle = document.createElement('style')
  #uiSheet: Sheet
  #protectedStyle = document.createElement('style')
  #protectedSheet: Sheet | null = null
  #host = document.createElement('fieldset')
  #exit = document.createElement('button')
  #exitText = document.createTextNode('Back to library')
  #exitLabel = 'Back to library'
  #exitAction: (() => void) | null = null
  #attributes = new Map<Element, string>()
  #active = false
  #quarantined = false
  #compromised = false
  #zoom = ''
  #htmlAttrs = ''
  #uiCss: string

  constructor(uiCss: string, mockContext = false) {
    loadGameFonts()
    this.#exitLabel = mockContext ? 'Return to mock' : 'Back to library'
    this.#exitText.data = this.#exitLabel
    if (window.top !== window) throw Error('Arrows needs a top-level page before setup or timed play.')
    if (!this.#doctype || this.#doctype.name !== 'html' || this.#doctype.publicId || this.#doctype.systemId) throw Error('Arrows needs its dedicated entry document. Return to the Library and open Arrows again.')
    // Construct all exposed author-shadow-capable objects before insertion.
    this.#root = this.#body.attachShadow({ mode: 'closed' })
    this.#html.lang = 'en'
    this.#charset.setAttribute('charset', 'utf-8')
    this.#viewport.name = 'viewport'; this.#viewport.content = 'width=device-width, initial-scale=1.0'
    this.#title.append(this.#titleText); this.#head.append(this.#charset, this.#viewport, this.#title)
    this.#uiCss = `${uiCss}\n:host { display:block; margin:0; }\nfieldset[data-arrows-ui] { display:block; margin:0; padding:0; border:0; min-width:0; }`
    this.#ui.setAttribute('data-arrows-ui', '')
    // Fragment navigation does not cross a shadow boundary. Preserve the native
    // skip link's keyboard/click activation inside this untimed owned UI only.
    this.#ui.addEventListener('click', event => {
      const link = event.target instanceof Element ? event.target.closest('a.skip-link[href="#main-content"]') : null
      const main = this.#ui.querySelector<HTMLElement>('main#main-content')
      if (link && this.#ui.contains(link) && main) { event.preventDefault(); main.focus(); main.scrollIntoView({ block: 'start' }) }
    })
    this.#uiStyle.textContent = this.#uiCss
    this.#protectedStyle.textContent = PROTECTED_CSS
    this.#host.setAttribute('aria-label', 'Arrows visual task display')
    this.#exit.type = 'button'; this.#exit.append(this.#exitText)
    this.#exit.addEventListener('click', () => this.#exitAction?.())
    this.#root.append(this.#uiStyle, this.#ui)
    this.#html.append(this.#head, this.#body)
    document.replaceChild(this.#html, document.documentElement)
    for (const node of [this.#head, this.#body, this.#charset, this.#viewport, this.#title, this.#host, this.#exit]) this.#attributes.set(node, attrs(node))
    this.#uiSheet = sheetRecord(this.#uiStyle, this.#uiCss)
  }
  get uiMount(): HTMLElement { return this.#ui }
  get presentationHost(): HTMLElement { return this.#host }
  get active(): boolean { return this.#active }
  #admittedZoom(): string | null {
    if (this.#html.lang !== 'en' || [...this.#html.attributes].some(a => !['lang', 'style'].includes(a.name))) return null
    if (!this.#html.hasAttribute('style')) return ''
    const style = this.#html.style, value = style.getPropertyValue('zoom')
    return style.length === 1 && style.item(0) === 'zoom' && /^\d+(?:\.\d+)?$/.test(value) && Number(value) >= .25 && Number(value) <= 4 && !style.getPropertyPriority('zoom') ? value : null
  }
  #documentIntact(): boolean {
    return document.documentElement === this.#html && document.head === this.#head && document.body === this.#body &&
      children(document, [this.#doctype!, this.#html]) && children(this.#html, [this.#head, this.#body]) &&
      children(this.#head, [this.#charset, this.#viewport, this.#title]) && children(this.#title, [this.#titleText]) &&
      this.#titleText.data === 'Arrows — TraitGame' && this.#charset.childNodes.length === 0 && this.#viewport.childNodes.length === 0 &&
      this.#body.childNodes.length === 0 && this.#body.isConnected && this.#root.host === this.#body && this.#root.mode === 'closed' && this.#body.shadowRoot === null &&
      document.styleSheets.length === 0 && document.adoptedStyleSheets.length === 0 && this.#root.adoptedStyleSheets.length === 0 &&
      document.fullscreenElement === null &&
      [this.#html, ...this.#attributes.keys(), this.#uiStyle, this.#protectedStyle].every(node => node.getAnimations().length === 0) &&
      [...this.#attributes].every(([node, value]) => attrs(node) === value) && children(this.#exit, [this.#exitText]) && this.#exitText.data === this.#exitLabel
  }
  enter(onExit: () => void): void {
    const zoom = this.#admittedZoom()
    if (this.#quarantined || this.#active || zoom === null || !this.#documentIntact() || !children(this.#root, [this.#uiStyle, this.#ui]) || !sheetIntact(this.#uiSheet) || this.#protectedStyle.textContent !== PROTECTED_CSS || this.#protectedStyle.attributes.length !== 0)
      { this.#recover(); throw Error('The Arrows document changed. Reload this page and complete setup again before starting.') }
    this.#htmlAttrs = attrs(this.#html)
    this.#zoom = zoom; this.#exitAction = onExit
    this.#root.replaceChildren(this.#protectedStyle, this.#exit, this.#host)
    this.#protectedSheet = sheetRecord(this.#protectedStyle, PROTECTED_CSS)
    this.#active = true
    window.scrollTo(0, 0)
  }
  leave(): void {
    if (!this.#active) return
    this.#active = false; this.#exitAction = null
    if (this.#compromised || !this.#documentIntact() || attrs(this.#html) !== this.#htmlAttrs) { this.#recover(); return }
    this.#root.replaceChildren(this.#uiStyle, this.#ui)
    this.#uiSheet = sheetRecord(this.#uiStyle, this.#uiCss)
  }
  #recover(): void {
    if (this.#quarantined) return
    // Retain the in-memory journey/draft, but never repair and keep scoring.
    this.#quarantined = true
    const html = document.createElement('html'), head = document.createElement('head'), body = document.createElement('body')
    html.lang = 'en'
    const title = document.createElement('title'); title.textContent = 'Arrows recovery'
    head.append(title)
    const root = body.attachShadow({ mode: 'closed' })
    const style = document.createElement('style'); style.textContent = this.#uiCss
    const notice = document.createElement('p'); notice.setAttribute('role', 'alert')
    notice.textContent = 'The Arrows document changed. Review any retained result here. Reload before another timed practice.'
    root.append(style, notice, this.#ui)
    html.append(head, body)
    document.adoptedStyleSheets = []
    for (const child of [...document.childNodes]) if (child !== document.documentElement && child !== this.#doctype) child.remove()
    if (document.documentElement) document.replaceChild(html, document.documentElement)
    else document.append(html)
    if (this.#doctype!.parentNode !== document) document.insertBefore(this.#doctype!, html)
  }
  check(host: HTMLElement, shell: HTMLElement, root: ShadowRoot): boolean {
    if (!this.#active || host !== this.#host || this.#admittedZoom() !== this.#zoom || attrs(this.#html) !== this.#htmlAttrs || !this.#documentIntact() ||
      !children(this.#root, [this.#protectedStyle, this.#exit, this.#host]) || !children(host, [shell]) ||
      shell.getRootNode() !== this.#root || root.host !== shell || root.mode !== 'closed' || shell.shadowRoot !== null ||
      !this.#protectedSheet || !sheetIntact(this.#protectedSheet)) { this.#compromised = true; return false }
    // No protected native element may gain an unobservable author root. The
    // body's and shell's already-owned roots are the only exceptions.
    const palette = new Set(['style', 'fieldset', 'figure', 'output', 'button', 'img'])
    // A retained node can paint through Web Animations without changing its
    // attributes or CSSOM. Finished fill effects are still effects; the static
    // presentation admits none on any owned element, including status/style.
    if ([...root.querySelectorAll('*')].some(node => !palette.has(node.localName) || node.getAnimations().length !== 0)) { this.#compromised = true; return false }
    const rect = this.#exit.getBoundingClientRect(), vv = window.visualViewport
    const x = vv?.offsetLeft ?? 0, y = vv?.offsetTop ?? 0
    const right = x + (vv?.width ?? document.documentElement.clientWidth), bottom = y + (vv?.height ?? document.documentElement.clientHeight)
    const zoom = Number(this.#zoom || 1), focus = this.#exit.matches(':focus-visible') ? 7 * zoom : 0
    const shellBox = shell.getBoundingClientRect()
    const cx = shellBox.left + shellBox.width / 2, cy = shellBox.top + shellBox.height / 2
    return document.elementFromPoint(cx, cy) === this.#body && this.#root.elementFromPoint(cx, cy) === shell && rect.width > 0 && rect.height > 0 && rect.left - focus >= x && rect.top - focus >= y && rect.right + focus <= right && rect.bottom + focus <= bottom
  }
}
