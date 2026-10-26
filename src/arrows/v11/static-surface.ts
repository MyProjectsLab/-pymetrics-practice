import inventory from './static-images.json'
import type { Stimulus } from './contracts'

const registry = Object.freeze(inventory.map(item => Object.freeze({ ...item,
  symbols: item.symbols ? Object.freeze([...item.symbols]) : undefined,
  url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(item.svg)}`,
})))
const CSS = `
:host { all: initial; display: block; position: relative; z-index: 100; isolation: isolate; background: #fff; width: 352px; direction: ltr; writing-mode: horizontal-tb; color: #172d30; font: 16px system-ui; }
*, *::before, *::after { box-sizing: border-box; }
fieldset[data-surface] { all: initial; display: block; position: relative; width: 352px; direction: ltr; writing-mode: horizontal-tb; color: #172d30; font: 16px system-ui; }
figure { all: initial; display: block; width: 352px; height: 112px; margin: 0; background: #fff; }
img { all: initial; display: block; width: 352px; height: 112px; object-fit: contain; object-position: 50% 50%; direction: ltr; writing-mode: horizontal-tb; }
fieldset[data-controls] { all: initial; box-sizing: border-box; display: flex; justify-content: center; gap: 24px; width: 352px; height: 72px; padding: 16px 8px 8px; direction: ltr; writing-mode: horizontal-tb; }
button { all: initial; display: grid; place-items: center; box-sizing: border-box; width: 128px; height: 48px; background: #fff; border: 2px solid #18594f; border-radius: 6px; cursor: pointer; direction: ltr; writing-mode: horizontal-tb; color: #18594f; font: 16px system-ui; }
button img { width: 96px; height: 40px; }
button:focus-visible { outline: 3px solid #995500; outline-offset: 4px; }
output { all: initial; display: block; position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; direction: ltr; writing-mode: horizontal-tb; color: #172d30; font: 16px system-ui; }
`
const childrenAre = (node: Node, children: Node[]) => node.childNodes.length === children.length && children.every((child, i) => node.childNodes[i] === child)
const attributes = (node: Element) => [...node.attributes].map(a => [a.name, a.value]).sort(([a], [b]) => a.localeCompare(b)).map(a => a.join('=')).join('\n')
type Resource = { artifact: typeof registry[number]; image: HTMLImageElement; attrs: string; ready: number }
export type SurfaceStage = 'empty' | 'fixation' | 'stimulus'

/** Retained refs are JavaScript-private. Closed shadow is encapsulation, not an
 * attestation of the compositor or a security boundary against page tooling. */
export class ArrowsStaticSurface {
  #shell = document.createElement('div')
  #root: ShadowRoot
  #style = document.createElement('style')
  #styleText = document.createTextNode(CSS)
  #statusText = document.createTextNode('')
  #sheet: CSSStyleSheet | null
  #rules: string
  #section = document.createElement('fieldset')
  #frame = document.createElement('figure')
  #status = document.createElement('output')
  #controls = document.createElement('fieldset')
  #buttons = [document.createElement('button'), document.createElement('button')]
  #resources: Resource[]
  #attributes = new Map<Element, string>()
  #epoch = 0
  #prepared = 0
  #stage: SurfaceStage = 'empty'
  #expected: Stimulus | undefined
  #current: Resource | null = null
  #cue = ''
  #pointer = false
  #disposed = false
  #fault = false
  #cancel: (() => void) | null = null
  #observer: MutationObserver
  #host: HTMLElement

  constructor(host: HTMLElement, pointer: boolean, press: (event: PointerEvent, direction: 'left' | 'right') => void) {
    this.#host = host; this.#pointer = pointer
    this.#shell.setAttribute('data-arrows-shell', '')
    this.#root = this.#shell.attachShadow({ mode: 'closed' })
    this.#style.append(this.#styleText)
    this.#section.setAttribute('data-surface', '')
    this.#controls.setAttribute('data-controls', '')
    this.#controls.setAttribute('aria-label', 'Response controls')
    this.#status.setAttribute('role', 'status'); this.#status.setAttribute('aria-live', 'polite'); this.#status.setAttribute('aria-atomic', 'true')
    this.#resources = registry.map(artifact => {
      const image = document.createElement('img')
      image.setAttribute('src', artifact.url); image.setAttribute('alt', ''); image.setAttribute('aria-hidden', 'true')
      image.setAttribute('width', String(artifact.width)); image.setAttribute('height', String(artifact.height)); image.setAttribute('draggable', 'false')
      return { artifact, image, attrs: attributes(image), ready: 0 }
    })
    this.#buttons.forEach((button, i) => {
      const direction = i ? 'right' : 'left'
      button.type = 'button'; button.setAttribute('aria-label', i ? 'Right' : 'Left')
      button.append(this.#resource(direction).image)
      // Direction comes from retained identity, never retargeted DOM data.
      button.addEventListener('pointerdown', event => press(event, direction))
    })
    this.#controls.append(...this.#buttons)
    this.#section.append(this.#frame, this.#status, ...(pointer ? [this.#controls] : []))
    this.#root.append(this.#style, this.#section)
    this.#host.replaceChildren(this.#shell)
    this.#sheet = this.#style.sheet
    this.#rules = this.#sheet ? [...this.#sheet.cssRules].map(rule => rule.cssText).join('\n') : ''
    for (const node of [this.#shell, this.#style, this.#section, this.#frame, this.#status, this.#controls, ...this.#buttons]) this.#attributes.set(node, attributes(node))
    // No production attribute ever changes after construction. Even a restored
    // attribute mutation invalidates this preparation generation.
    this.#observer = new MutationObserver(records => {
      if (records.some(record => record.type === 'attributes')) this.#fault = true
    })
    this.#observer.observe(this.#shell, { attributes: true })
    this.#observer.observe(this.#root, { attributes: true, subtree: true })
    this.#resources.forEach(({ image }) => this.#observer.observe(image, { attributes: true }))
  }
  #resource(id: string): Resource {
    const result = this.#resources.find(value => value.artifact.id === id)
    if (!result) throw Error('Unknown Arrows artwork')
    return result
  }
  #mapped(expected: Stimulus): Resource | null {
    return this.#resources.find(({ artifact }) => artifact.color === expected.color && artifact.cue === expected.cue &&
      artifact.symbols?.length === 5 && artifact.symbols.every((symbol, i) => symbol === expected.symbols[i])) ?? null
  }
  #identity(resource: Resource): boolean {
    const { image, artifact } = resource
    return attributes(image) === resource.attrs && image.getAttribute('src') === artifact.url && image.currentSrc === artifact.url &&
      !image.hasAttribute('srcset') && !image.hasAttribute('sizes') && image.complete && image.naturalWidth === artifact.width && image.naturalHeight === artifact.height &&
      image.childNodes.length === 0 && image.ownerDocument === document
  }
  async prepare(): Promise<number> {
    if (this.#disposed) throw Error('Arrows image preparation canceled')
    this.#cancel?.()
    const epoch = ++this.#epoch
    this.#prepared = 0
    let reject!: (reason: Error) => void
    const canceled = new Promise<never>((_, fail) => { reject = fail })
    const cancel = () => reject(Error('Arrows image preparation canceled'))
    this.#cancel = cancel
    const timeout = setTimeout(() => reject(Error('Arrows images could not be prepared. Retry Start or Continue.')), 5000)
    try {
      await Promise.race([canceled, Promise.all(this.#resources.map(async resource => {
        const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(resource.artifact.svg)))].map(n => n.toString(16).padStart(2, '0')).join('')
        if (digest !== resource.artifact.sha256) throw Error('Arrows artwork integrity failed')
        await resource.image.decode()
        if (this.#disposed || epoch !== this.#epoch || this.#fault || !this.#identity(resource)) throw Error('Arrows images changed during preparation')
        resource.ready = epoch
      }))])
      if (this.#disposed || epoch !== this.#epoch || this.#fault) throw Error('Arrows image preparation canceled')
      this.#prepared = epoch
      return epoch
    } finally { clearTimeout(timeout); if (this.#cancel === cancel) this.#cancel = null }
  }
  prepared(epoch: number): boolean {
    return !this.#disposed && !this.#fault && epoch === this.#epoch && epoch === this.#prepared &&
      this.#resources.every(resource => resource.ready === epoch && this.#identity(resource))
  }
  show(stage: SurfaceStage, expected?: Stimulus): void {
    const current = stage === 'fixation' ? this.#resource('fixation') : stage === 'stimulus' && expected ? this.#mapped(expected) : null
    if (stage === 'stimulus' && !current) throw Error('Arrows canonical artwork unavailable')
    this.#expected = expected ? structuredClone(expected) : undefined
    this.#stage = stage; this.#current = current; this.#cue = stage === 'stimulus' ? expected!.cue : ''
    this.#frame.replaceChildren(...(current ? [current.image] : []))
    this.#statusText.data = this.#cue
    this.#status.replaceChildren(...(this.#cue ? [this.#statusText] : []))
  }
  clear(): void { this.show('empty') }
  dispose(): void {
    this.#disposed = true; this.#epoch++; this.#prepared = 0; this.#cancel?.(); this.#observer.disconnect(); this.#shell.remove()
  }
  /** Identity/readiness and semantics only. The separate outer predicate admits
   * composition of these known objects through the shadow host to the viewport. */
  admit(stage: SurfaceStage, expected?: Stimulus): boolean {
    const current = stage === 'fixation' ? this.#resource('fixation') : stage === 'stimulus' && expected ? this.#mapped(expected) : null
    if (this.#fault || this.#disposed || !this.#prepared || this.#prepared !== this.#epoch || this.#stage !== stage || this.#current !== current ||
      (stage === 'stimulus' && !current) || this.#cue !== (stage === 'stimulus' ? expected?.cue : '') ||
      this.#shell.getRootNode({ composed: true }) !== document || !this.#shell.isConnected || this.#root.mode !== 'closed' || this.#root.host !== this.#shell ||
      !childrenAre(this.#host, [this.#shell]) || !childrenAre(this.#root, [this.#style, this.#section]) ||
      !childrenAre(this.#section, [this.#frame, this.#status, ...(this.#pointer ? [this.#controls] : [])]) ||
      !childrenAre(this.#frame, current ? [current.image] : []) || !childrenAre(this.#controls, this.#buttons) ||
      this.#status.textContent !== this.#cue || !childrenAre(this.#status, this.#cue ? [this.#statusText] : []) ||
      this.#root.adoptedStyleSheets.length !== 0 || !childrenAre(this.#style, [this.#styleText]) || this.#style.textContent !== CSS || this.#style.sheet !== this.#sheet || !this.#sheet || this.#sheet.disabled ||
      [...this.#sheet.cssRules].map(rule => rule.cssText).join('\n') !== this.#rules ||
      [...this.#attributes].some(([node, attrs]) => attributes(node) !== attrs)) return false
    if (current && (current.ready !== this.#prepared || !this.#identity(current))) return false
    return this.#buttons.every((button, i) => {
      const label = this.#resource(i ? 'right' : 'left')
      return !button.disabled && childrenAre(button, [label.image]) && label.ready === this.#prepared && this.#identity(label)
    })
  }
  composition(check: (shell: HTMLElement, painted: Element[], root: ShadowRoot) => boolean): boolean {
    return this.admit(this.#stage, this.#expected) && check(this.#shell, [this.#section, this.#frame, ...(this.#current ? [this.#current.image] : []),
      ...(this.#pointer ? [this.#controls, ...this.#buttons, ...this.#buttons.map(button => button.firstElementChild!)] : [])], this.#root)
  }
}
