import sizeTokens from '../design/tokens.css?inline'
import { decorateSiteBrand } from '../design/siteBrand'
import { loadGameFonts } from '../design/gameFonts'
import indexCss from '../index.css?inline'
import appCss from '../App.css?inline'
import moneyCss from './money-exchange-1.css?inline'
import type { MoneyResultArt } from './result-art'

const css = `${indexCss.replace(':root', ':host')}\n${appCss}\n${moneyCss}\n:host{display:block}`
const protectedCss = `${sizeTokens}
${moneyCss}
:host{all:initial;display:block;min-height:100vh;background:#fff;color:#14213d;font:var(--ap-font-body)/var(--ap-line-height) 'AP Inter',Arial,sans-serif;direction:ltr;writing-mode:horizontal-tb}
main[data-money-main]{display:block;padding:0 16px 24px}
nav[data-site-nav]{display:flex;flex-wrap:wrap;gap:12px 20px;align-items:center;box-sizing:border-box;max-width:var(--ap-panel-width);margin:0 auto;padding:16px 0}
nav[data-site-nav] a{display:inline-flex;align-items:center;min-height:44px;color:#0e7490;text-underline-offset:4px}
nav[data-site-nav] a.ap-wordmark{gap:16px;color:#14213d;font:600 18px/1.1 'AP Inter',Arial,sans-serif;text-decoration:none}
nav[data-site-nav] .ap-wordmark svg{width:40px;height:40px;flex-shrink:0;color:#0891b2}
fieldset[data-money-stage]{all:initial;display:flex;flex-direction:column;box-sizing:border-box;width:100%;max-width:var(--ap-panel-width);min-height:560px;margin:0 auto;padding:24px 32px;background:#fff;color:#14213d;font:var(--ap-font-body)/var(--ap-line-height) 'AP Inter',Arial,sans-serif;direction:ltr;writing-mode:horizontal-tb;border:0}
fieldset[data-money-stage]>legend{float:left;width:100%;box-sizing:border-box;margin:0 0 24px;text-align:center;color:#14213d;font:400 var(--ap-font-heading)/1.15 'AP Newsreader',Georgia,serif}
fieldset[data-money-stage]>legend:focus{outline:none}
fieldset[data-money-stage]>legend:focus-visible{outline:3px solid #0891b2;outline-offset:3px}
output{display:block;line-height:1.5;margin:8px 0;text-align:center;color:#14213d}
label{display:block;margin:12px 0;color:#14213d;text-align:center}
input{box-sizing:border-box;max-width:100%;padding:10px;font:inherit;accent-color:#0e7490}
input[type=text]{display:block;width:200px;margin:0 auto 20px;text-align:center;font-size:var(--ap-font-number);border:0;border-bottom:2px solid #a7b4bc;border-radius:0}
button{box-sizing:border-box;min-height:var(--ap-button-height);min-width:var(--ap-button-width);padding:12px 24px;border:0;border-radius:999px;background:#0e7490;color:#fff;font:500 var(--ap-font-button)/1.4 'AP Inter',Arial,sans-serif;cursor:pointer}
button.quiet-action{min-width:0;padding:8px 0;background:transparent;color:#0e7490;text-decoration:underline;text-underline-offset:4px;border-radius:0}
button:disabled{opacity:.45;cursor:default}
button:focus-visible,input:focus-visible,a:focus-visible{outline:3px solid #0891b2;outline-offset:3px}
[data-money-actions]{display:flex;flex-wrap:wrap;align-items:center;gap:12px 24px;margin-top:24px;min-height:56px}
[data-money-actions]>button[data-primary]{order:2;margin-left:auto}
fieldset[data-money-stage="report"] [data-money-actions]>button[data-primary]{order:0;margin-left:0}
[data-money-options]{display:flex;flex-wrap:wrap;gap:8px 24px;margin-top:12px}
img[data-money-result],img[data-money-pair]{display:block;width:100%;height:auto;object-fit:contain;background:#fff;margin:12px auto 20px;clear:both}
img[data-money-result]{max-height:320px}
output[data-money-semantics]{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
fieldset[aria-label="Fairness from 0 to 10"]{display:flex;flex-wrap:wrap;justify-content:center;gap:0;padding:12px 0;border:0;margin:12px auto}
fieldset[aria-label="Fairness from 0 to 10"] label{display:flex;flex-direction:column;align-items:center;min-width:36px;margin:0;padding:8px 2px;font-size:var(--ap-font-small)}
fieldset[aria-label="Fairness from 0 to 10"] input{width:22px;height:22px;margin:0 0 8px;padding:0}
[data-money-facts]{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px;max-width:640px;width:100%;margin:12px auto 20px}
[data-money-fact]{display:flex;flex-direction:column;text-align:center;gap:4px}
[data-money-fact] span{font-size:var(--ap-font-label);color:#596878}
[data-money-fact] strong{font:400 var(--ap-font-number)/1.2 'AP Newsreader',Georgia,serif}
[data-money-details]{margin-top:24px}
.assessment-usage-notice{font-size:var(--ap-font-small);color:#596878;margin-top:24px}
@media(max-width:600px){main[data-money-main]{padding:0 12px 16px}nav[data-site-nav]{gap:8px 16px;padding:8px 0}fieldset[data-money-stage]{padding:16px 4px;min-height:460px}fieldset[data-money-stage]>legend{margin-bottom:16px}fieldset[data-money-stage="final_allocation"]{min-height:0}img[data-money-result]{max-height:260px;margin:8px auto 12px}img[data-money-pair]{margin:8px auto 12px}fieldset[data-money-stage="transfer"] input[type=text]{font-size:40px}fieldset[data-money-stage="fairness"] [data-money-actions]{margin-top:12px}[data-money-actions]{gap:12px;margin-top:16px}[data-money-actions]>button[data-primary]{min-width:120px}[data-money-options]{gap:8px 20px}}
/* The amount stays between the participants on desktop, below them on phones. */
fieldset[data-money-stage="transfer"]{display:grid;grid-template-columns:minmax(0,1fr) minmax(200px,1.4fr) minmax(0,1fr);gap:12px 0}
fieldset[data-money-stage="transfer"]>legend{grid-column:1/-1;grid-row:1;float:none}
fieldset[data-money-stage="transfer"]>output:not([data-money-semantics]){grid-column:2;grid-row:2;align-self:end;margin:24px 0 0;position:relative;z-index:1;background:#fff}
fieldset[data-money-stage="transfer"]>label{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
fieldset[data-money-stage="transfer"]>input{grid-column:2;grid-row:3;align-self:start;width:160px;height:80px;padding:8px 12px;margin:0 auto 32px;font-family:'AP Newsreader',Georgia,serif;z-index:1;background:#fff}
fieldset[data-money-stage="transfer"]>input:focus{outline:none;border-bottom:3px solid #0e7490}
fieldset[data-money-stage="transfer"]>img[data-money-pair]{grid-column:1/-1;grid-row:2/4;align-self:center;width:100%;max-width:none!important;margin:0;pointer-events:none}
fieldset[data-money-stage="transfer"]>[data-money-actions]{grid-column:1/-1;grid-row:4}
fieldset[data-money-stage="transfer"]>[data-money-options]{grid-column:1/-1;grid-row:5}
@media(max-width:600px){fieldset[data-money-stage="transfer"]{display:flex;gap:0}fieldset[data-money-stage="transfer"]>img[data-money-pair]{order:-1;width:100%;max-width:320px!important}fieldset[data-money-stage="transfer"]>legend{order:-3}fieldset[data-money-stage="transfer"]>output:not([data-money-semantics]){order:-2;margin:4px 0 8px}fieldset[data-money-stage="transfer"]>input{margin:0 auto 12px;height:68px}}
@media(max-height:500px){nav[data-site-nav]{padding:0;gap:8px 16px}nav[data-site-nav] a{min-height:36px}fieldset[data-money-stage]{min-height:0;padding:12px 4px}fieldset[data-money-stage]>legend{font-size:28px;margin-bottom:8px}img[data-money-result]{max-height:180px;margin:4px auto 8px}[data-money-actions]{margin-top:8px}}
`

const attrs = (node: Element) => JSON.stringify([...node.attributes].map(a => [a.name, a.value]).sort(([a], [b]) => a.localeCompare(b)))
const children = (node: Node, expected: Node[]) => node.childNodes.length === expected.length && expected.every((item, index) => node.childNodes[index] === item)
type UiNode = { node: Node; children: Node[]; attributes: string | null; text: string | null }
export type ProtectedView = {
  stage: string
  title: string
  onViolation: () => void
  onNavigate?: (href:string,event:MouseEvent) => void
  lines: readonly string[]
  detailLines?: readonly string[]
  buttons: readonly { label: string; act: () => void; disabled?: boolean; expanded?: boolean }[]
  amount?: { value: string; current: () => string; changed: (value: string) => void }
  rating?: { value: number | null; current: () => number | null; changed: (value: number) => void }
  comprehension?: { question: string; value: string; current: () => string; changed: (value: string) => void }
  facts?: readonly {label:string;value:string}[]
  secondaryButtons?: readonly {label:string;act:()=>void;disabled?:boolean}[]
  pair?: { src: string; width: number; height: number; semantics: string }
  result?: { src: string; width: number; height: number; semantics: string }
}

/** Owns the top-level document before Money Exchange can arm an attempt. */
export class ExclusiveMoneyDocument {
  readonly #doctype = document.doctype
  readonly #html = document.createElement('html')
  readonly #head = document.createElement('head')
  readonly #body = document.createElement('body')
  readonly #root = this.#body.attachShadow({ mode: 'closed' })
  readonly #charset = document.createElement('meta')
  readonly #viewport = document.createElement('meta')
  readonly #title = document.createElement('title')
  readonly #titleText = document.createTextNode('Money Exchange 1 — TraitGame')
  readonly #style = document.createElement('style')
  readonly #mount = document.createElement('div')
  readonly #protectedStyle = document.createElement('style')
  readonly #protectedMain = document.createElement('main')
  #siteNav: HTMLElement | null = null
  readonly #protectedSurface = document.createElement('fieldset')
  readonly #attributes = new Map<Element, string>()
  readonly #sheet: CSSStyleSheet | null
  readonly #rules: string
  #uiNodes: UiNode[] = []
  #protectedNodes: UiNode[] = []
  #protectedSheet: CSSStyleSheet | null = null
  #protectedRules = ''
  #protectedSurfaceAttributes = ''
  #protectedStage: string | null = null
  #active = false
  #resultImage: HTMLImageElement | null = null
  #resultMeaning: HTMLOutputElement | null = null
  #renderEpoch = 0
  #preparedResultEpoch = 0
  #resultSizeProof: { image:HTMLImageElement; uri:string; epoch:number; width:number; height:number } | null = null
  readonly #observer = new MutationObserver(() => { this.#fault = true })
  #fault = false

  constructor() {
    loadGameFonts()
    if (window.top !== window || !this.#doctype || this.#doctype.name !== 'html' || this.#doctype.publicId || this.#doctype.systemId)
      throw Error('Money Exchange 1 requires its dedicated top-level page.')
    this.#html.lang = 'en'
    this.#charset.setAttribute('charset', 'utf-8')
    this.#viewport.name = 'viewport'
    this.#viewport.content = 'width=device-width, initial-scale=1.0'
    this.#title.append(this.#titleText)
    this.#head.append(this.#charset, this.#viewport, this.#title)
    this.#style.textContent = css
    this.#protectedStyle.textContent = protectedCss
    this.#protectedMain.setAttribute('data-money-main','')
    this.#protectedSurface.setAttribute('data-money-stage', '')
    this.#mount.id = 'money-owned-app'
    this.#root.append(this.#style, this.#mount)
    this.#html.append(this.#head, this.#body)
    document.replaceChild(this.#html, document.documentElement)
    this.#sheet = this.#style.sheet
    this.#rules = this.#sheet ? [...this.#sheet.cssRules].map(rule => rule.cssText).join('\n') : ''
    for (const node of [this.#html, this.#head, this.#body, this.#charset, this.#viewport, this.#title, this.#mount, this.#style])
      this.#attributes.set(node, attrs(node))
    this.captureUi()
    if (!this.checkOuter()) throw Error('The Money Exchange document could not be owned.')
  }

  get mount(): HTMLElement { return this.#mount }
  get active(): boolean { return this.#active }

  /** Discards every prearm React descendant before any durable arm. */
  enterProtected(): void {
    if (this.#active || !this.#outerIntact() || !children(this.#root, [this.#style, this.#mount]) ||
      !this.#sheetIntact(this.#style, css, this.#sheet, this.#rules))
      throw Error('The Money Exchange document changed before Start.')
    this.#protectedMain.replaceChildren(this.#protectedSurface)
    this.#root.replaceChildren(this.#protectedStyle, this.#protectedMain)
    this.#protectedSheet = this.#protectedStyle.sheet
    this.#protectedRules = this.#protectedSheet ? [...this.#protectedSheet.cssRules].map(rule => rule.cssText).join('\n') : ''
    this.#active = true
    this.showProtected({stage:'starting',title:'Starting exchange',lines:['Checking the saved starting state…'],buttons:[],onViolation:()=>undefined})
  }

  /** Every admitted node is made here from a finite palette, never learned from live DOM. */
  showProtected(view: ProtectedView): void {
    if (!this.#active || this.#protectedStage !== null && !this.checkProtected())
      throw Error('The Money Exchange display changed.')
    const priorStage=this.#protectedStage
    const priorFocus=this.#root.activeElement
    const focusedHeading=priorFocus instanceof HTMLLegendElement
    const focusedButton=priorFocus instanceof HTMLButtonElement?priorFocus.textContent:null
    const focusedInput=priorFocus instanceof HTMLInputElement?
      (priorFocus.type==='radio'?`${priorFocus.name}:${priorFocus.value}`:'amount'):null
    this.#observer.disconnect()
    const made: Node[] = []
    const siteNav=document.createElement('nav');siteNav.setAttribute('data-site-nav','');siteNav.setAttribute('aria-label','Site navigation')
    for(const [label,href] of [['TraitGame','/'],['Home','/'],['Assessments','/practice'],['Full mock','/mock']]){
      const link=document.createElement('a');link.href=href;link.textContent=label;if(label==='TraitGame')decorateSiteBrand(link)
      link.addEventListener('click',event=>{if(!this.checkProtected(view.stage)){event.preventDefault();this.recover();view.onViolation();return}view.onNavigate?.(href,event)})
      siteNav.append(link)
    }
    this.#renderEpoch++;this.#preparedResultEpoch=0
    this.#resultImage=null;this.#resultMeaning=null;this.#resultSizeProof=null
    const heading = document.createElement('legend');heading.tabIndex=-1
    heading.append(document.createTextNode(view.title)); made.push(heading)
    for (const line of view.lines) { const item=document.createElement('output');if(line.startsWith('This is an original practice exercise.'))item.className='assessment-usage-notice'; item.append(document.createTextNode(line)); made.push(item) }
    if(view.facts){const facts=document.createElement('div');facts.setAttribute('data-money-facts','');for(const fact of view.facts){const item=document.createElement('div');item.setAttribute('data-money-fact','');const label=document.createElement('span'),value=document.createElement('strong');label.textContent=fact.label;value.textContent=fact.value;item.append(label,value);facts.append(item)}made.push(facts)}
    if (view.detailLines?.length) { const region=document.createElement('section');region.setAttribute('data-money-details','');region.setAttribute('aria-label','Detailed numbers');for(const line of view.detailLines){const item=document.createElement('output');item.append(document.createTextNode(line));region.append(item)}made.push(region) }
    if (view.amount) {
      const label=document.createElement('label'); label.append(document.createTextNode('Amount to send in dollars'))
      const input=document.createElement('input'); input.type='text'; input.inputMode='decimal'; input.value=view.amount.value
      input.setAttribute('aria-label','Amount to send in dollars')
      input.addEventListener('input',()=>{
        if (!this.checkProtected(view.stage)) { this.recover(); view.onViolation(); return }
        view.amount?.changed(input.value)
      })
      made.push(label,input)
    }
    if (view.rating) {
      const group=document.createElement('fieldset');group.setAttribute('aria-label','Fairness from 0 to 10')
      for(let i=0;i<=10;i++) {
        const label=document.createElement('label'),input=document.createElement('input')
        input.type='radio';input.name='money-fairness';input.value=String(i);input.checked=view.rating.value===i
        input.addEventListener('change',()=>{
          if (!this.checkProtected(view.stage)) { this.recover(); view.onViolation(); return }
          view.rating?.changed(i)
        })
        label.append(input,document.createTextNode(String(i)));group.append(label)
      }
      made.push(group)
    }
    if (view.comprehension) {
      const group=document.createElement('fieldset'),legend=document.createElement('legend')
      legend.textContent=view.comprehension.question;group.append(legend)
      for(const [value,labelText] of [['2','$2'],['6','$6'],['20','$20']]) {
        const label=document.createElement('label'),input=document.createElement('input')
        input.type='radio';input.name='money-comprehension';input.value=value;input.checked=view.comprehension.value===value
        input.addEventListener('change',()=>{
          if (!this.checkProtected(view.stage)) { this.recover(); view.onViolation(); return }
          view.comprehension?.changed(value)
        })
        label.append(input,document.createTextNode(` ${labelText}`));group.append(label)
      }
      made.push(group)
    }
    if (view.pair) {
      const graphic=document.createElement('img');graphic.setAttribute('data-money-pair','')
      graphic.src=view.pair.src;graphic.width=view.pair.width;graphic.height=view.pair.height
      graphic.style.maxWidth=`${view.pair.width}px`
      graphic.alt='';graphic.setAttribute('aria-hidden','true');graphic.draggable=false
      const meaning=document.createElement('output');meaning.setAttribute('data-money-semantics','')
      meaning.setAttribute('role','status');meaning.append(document.createTextNode(view.pair.semantics))
      made.push(graphic,meaning)
    }
    if (view.result) {
      const graphic=document.createElement('img'); graphic.setAttribute('data-money-result','')
      graphic.src=view.result.src;graphic.width=view.result.width;graphic.height=view.result.height
      graphic.style.maxWidth=`${view.result.width}px`
      graphic.alt='';graphic.setAttribute('aria-hidden','true');graphic.draggable=false
      const meaning=document.createElement('output');meaning.setAttribute('data-money-semantics','')
      meaning.setAttribute('role','status');meaning.append(document.createTextNode(view.result.semantics))
      this.#resultImage=graphic;this.#resultMeaning=meaning
      made.push(graphic,meaning)
    }
    const controlsMatch=()=>
      (!view.amount || made.some(node=>node instanceof HTMLInputElement && node.type==='text' && node.value===view.amount?.current())) &&
      (!view.rating || made.filter(node=>node instanceof HTMLInputElement && node.type==='radio').every(node=>
        node instanceof HTMLInputElement && node.checked===(Number(node.value)===view.rating?.current()))) &&
      (!view.comprehension || [...this.#protectedSurface.querySelectorAll<HTMLInputElement>('input[name="money-comprehension"]')].every(node=>
        node.checked===(node.value===view.comprehension?.current())))
    const actions=document.createElement('div');actions.setAttribute('data-money-actions','')
    const appendAction=(action:ProtectedView['buttons'][number],region:HTMLElement,primary=false)=>{
      const button=document.createElement('button');button.type='button';button.disabled=!!action.disabled
      if(primary)button.setAttribute('data-primary','');else button.className='quiet-action'
      if(action.expanded!==undefined)button.setAttribute('aria-expanded',String(action.expanded))
      button.append(document.createTextNode(action.label));button.addEventListener('click',()=>{
        if (!this.checkProtected(view.stage) || !controlsMatch()) { this.recover(); view.onViolation(); return }
        action.act()
      });region.append(button)
    }
    const primary=view.buttons.find(action=>!['Restart','Close','Back','More options','Detailed numbers','How the amounts were calculated','Local history','History','Library','Main menu','Return to mock','Back to mock'].includes(action.label))
    for (const action of view.buttons){
      if(view.stage==='report'&&action.label==='Detailed numbers'){
        const disclosure=document.createElement('div');disclosure.setAttribute('data-money-disclosure','');appendAction(action,disclosure)
        const detailIndex=made.findIndex(node=>node instanceof HTMLElement&&node.hasAttribute('data-money-details'))
        made.splice(detailIndex<0?made.length:detailIndex,0,disclosure)
      }else if(view.stage==='report'&&action.label==='How the amounts were calculated'){
        const details=made.find(node=>node instanceof HTMLElement&&node.hasAttribute('data-money-details'))
        appendAction(action,details instanceof HTMLElement?details:actions)
      }else appendAction(action,actions,action===primary)
    }
    made.push(actions)
    if(view.secondaryButtons?.length){const options=document.createElement('div');options.setAttribute('data-money-options','');for(const action of view.secondaryButtons)appendAction(action,options);made.push(options)}
    const privacyLines = made.filter(node => node instanceof HTMLOutputElement && (/Privacy/.test(node.textContent ?? '') || node.classList.contains('assessment-usage-notice')))
    for (const node of privacyLines) { (node as HTMLElement).classList.add('assessment-usage-notice'); made.splice(made.indexOf(node), 1); made.push(node) }
    const records: UiNode[]=[]
    const viewport=window.visualViewport
    if (viewport && viewport.width<innerWidth*0.8) {
      this.#protectedSurface.style.margin=`8px 8px 8px ${Math.round(viewport.offsetLeft+8)}px`
      this.#protectedSurface.style.width=`${Math.max(120,Math.floor(viewport.width-16))}px`
    } else this.#protectedSurface.removeAttribute('style')
    this.#protectedSurface.setAttribute('data-money-stage',view.stage)
    this.#protectedSurfaceAttributes=attrs(this.#protectedSurface)
    const walk=(node:Node)=>{records.push({node,children:[...node.childNodes],attributes:node instanceof Element?attrs(node):null,
      text:node.nodeType===Node.TEXT_NODE?node.textContent:null});for(const child of node.childNodes)walk(child)}
    for (const node of made) walk(node)
    walk(siteNav)
    this.#siteNav=siteNav
    this.#protectedMain.replaceChildren(siteNav,this.#protectedSurface)
    this.#protectedSurface.replaceChildren(...made)
    this.#protectedNodes=records
    this.#protectedStage=view.stage
    if(priorStage!==view.stage)heading.focus()
    else if(focusedHeading)heading.focus({preventScroll:true})
    else if(focusedButton) {
      const target=[...this.#protectedSurface.querySelectorAll('button')].find(node=>node.textContent===focusedButton)
      if(target instanceof HTMLButtonElement)target.focus({preventScroll:true})
    } else if(focusedInput==='amount') {
      const target=made.find(node=>node instanceof HTMLInputElement&&node.type==='text')
      if(target instanceof HTMLInputElement)target.focus({preventScroll:true})
    }
    else if(focusedInput?.includes(':')) {
      const [name,value]=focusedInput.split(':')
      this.#protectedSurface.querySelector<HTMLInputElement>(`input[name="${name}"][value="${value}"]`)?.focus({preventScroll:true})
    }
    this.#observer.observe(this.#root,{subtree:true,childList:true,attributes:true,characterData:true})
    this.#observer.observe(this.#html,{subtree:true,childList:true,attributes:true,characterData:true})
  }

  checkProtected(stage: string | null = this.#protectedStage): boolean {
    if (this.#observer.takeRecords().length) this.#fault=true
    if (!this.#active || this.#fault || stage!==this.#protectedStage || !this.#outerIntact() ||
      !children(this.#root,[this.#protectedStyle,this.#protectedMain]) ||
      attrs(this.#protectedMain)!=='[["data-money-main",""]]' ||
      !this.#siteNav || !children(this.#protectedMain,[this.#siteNav,this.#protectedSurface]) ||
      !this.#sheetIntact(this.#protectedStyle,protectedCss,this.#protectedSheet,this.#protectedRules) ||
      attrs(this.#protectedStyle)!=='[]' ||
      attrs(this.#protectedSurface)!==this.#protectedSurfaceAttributes ||
      !children(this.#protectedSurface,this.#protectedNodes.filter(item=>item.node.parentNode===this.#protectedSurface).map(item=>item.node)) ||
      [this.#html,this.#head,this.#body,this.#protectedStyle,this.#protectedMain,this.#protectedSurface].some(node=>node.getAnimations().length>0) ||
      this.#protectedNodes.some(({node,children:expected,attributes,text})=>
        !children(node,expected) || attributes!==null && (!(node instanceof Element) || attrs(node)!==attributes) ||
        text!==null && node.textContent!==text || node instanceof Element && node.getAnimations().length>0)) return false
    return true
  }

  async prepareResult(): Promise<void> {
    const image=this.#resultImage, epoch=this.#renderEpoch
    if (!image || !this.checkProtected('final_allocation')) throw Error('Result display is not owned')
    const uri=image.getAttribute('src')
    if(!uri)throw Error('Result source is missing')
    await image.decode()
    if (this.#resultImage!==image || this.#renderEpoch!==epoch || !this.checkProtected('final_allocation') ||
      image.getAttribute('src')!==uri || image.currentSrc!==uri || !image.complete)
      throw Error('Result display changed during preparation')
    // WebKit rounds naturalWidth/naturalHeight of a laid-out SVG. Decode the
    // exact same resource detached, then bind its strict size proof to this view.
    const detached=new Image()
    detached.src=uri
    await detached.decode()
    if(this.#resultImage!==image || this.#renderEpoch!==epoch || !this.checkProtected('final_allocation') ||
      image.getAttribute('src')!==uri || image.currentSrc!==uri || !image.complete || detached.isConnected ||
      detached.getAttribute('src')!==uri || detached.src!==uri || detached.currentSrc!==uri || !detached.complete)
      throw Error('Result display changed during decoded-size preparation')
    this.#resultSizeProof={image,uri,epoch,width:detached.naturalWidth,height:detached.naturalHeight}
    this.#preparedResultEpoch=epoch
  }

  resultReady(expected:MoneyResultArt):boolean {
    const image=this.#resultImage, meaning=this.#resultMeaning, sizeProof=this.#resultSizeProof
    if (!image || !meaning || this.#preparedResultEpoch!==this.#renderEpoch ||
      !this.checkProtected('final_allocation') || image.ownerDocument!==document ||
      image.getAttribute('src')!==expected.src || image.currentSrc!==expected.src ||
      !image.complete || !sizeProof || sizeProof.image!==image || sizeProof.uri!==expected.src ||
      sizeProof.epoch!==this.#renderEpoch || sizeProof.width!==expected.width || sizeProof.height!==expected.height ||
      meaning.textContent!==expected.semantics) return false
    const rect=image.getBoundingClientRect(), viewport=window.visualViewport
    const left=viewport?.offsetLeft??0, top=viewport?.offsetTop??0
    const right=left+(viewport?.width??innerWidth), bottom=top+(viewport?.height??innerHeight)
    return rect.width>=100 && rect.height>=100 && rect.left>=left && rect.top>=top &&
      rect.right<=right && rect.bottom<=bottom && this.#root.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2)===image
  }

  /** A compromised connected tree is discarded, never repaired in place. */
  recover(): void {
    this.#observer.disconnect()
    const html=document.createElement('html'),head=document.createElement('head'),body=document.createElement('body')
    html.lang='en'
    const title=document.createElement('title');title.textContent='Money Exchange 1 recovery';head.append(title)
    const root=body.attachShadow({mode:'closed'})
    const style=document.createElement('style');style.textContent=protectedCss
    const field=document.createElement('fieldset'),heading=document.createElement('legend'),message=document.createElement('output')
    field.setAttribute('data-money-stage','');heading.textContent='Display changed'
    message.textContent='This exchange was stopped. Check local history before trying again.'
    const query=new URLSearchParams(location.search),mockId=query.get('mock')??query.get('mockReport')
    const safeMockId=mockId&&/^[A-Za-z0-9._-]{1,180}$/.test(mockId)?mockId:null
    const button=document.createElement('button');button.type='button';button.textContent=mockId?'Return to mock':'Back to library'
    button.addEventListener('click',()=>window.location.assign(mockId?safeMockId?`/mock?mock=${encodeURIComponent(safeMockId)}`:'/mock':'/practice'))
    field.append(heading,message,button);root.append(style,field);html.append(head,body)
    document.adoptedStyleSheets=[]
    for(const child of [...document.childNodes])if(child!==document.documentElement&&child!==this.#doctype)child.remove()
    if(document.documentElement)document.replaceChild(html,document.documentElement)
    else document.append(html)
    if(this.#doctype?.parentNode!==document)document.insertBefore(this.#doctype!,html)
  }

  #sheetIntact(style: HTMLStyleElement, expected: string, sheet: CSSStyleSheet | null, rules: string): boolean {
    return style.textContent===expected && style.childNodes.length===1 && style.firstChild?.nodeType===Node.TEXT_NODE &&
      style.sheet===sheet && !!sheet && !sheet.disabled && [...sheet.cssRules].map(rule=>rule.cssText).join('\n')===rules
  }

  #outerIntact(): boolean {
    return document.documentElement===this.#html && document.head===this.#head && document.body===this.#body &&
      children(document,[this.#doctype!,this.#html]) && children(this.#html,[this.#head,this.#body]) &&
      children(this.#head,[this.#charset,this.#viewport,this.#title]) && children(this.#title,[this.#titleText]) &&
      this.#titleText.data==='Money Exchange 1 — TraitGame' && this.#body.childNodes.length===0 &&
      this.#root.host===this.#body && this.#root.mode==='closed' && this.#body.shadowRoot===null &&
      document.styleSheets.length===0 && document.adoptedStyleSheets.length===0 && this.#root.adoptedStyleSheets.length===0 &&
      document.fullscreenElement===null && [...this.#attributes].every(([node,value])=>attrs(node)===value)
  }

  /** Called by the owned React tree after each completed commit. */
  captureUi(): void {
    const nodes: UiNode[] = []
    const walk = (node: Node) => {
      nodes.push({ node, children: [...node.childNodes], attributes: node instanceof Element ? attrs(node) : null,
        text: node.nodeType === Node.TEXT_NODE ? node.textContent : null })
      for (const child of node.childNodes) walk(child)
    }
    walk(this.#mount)
    this.#uiNodes = nodes
  }

  #uiIntact(): boolean {
    if (!this.#uiNodes.length || this.#uiNodes[0].node !== this.#mount) return false
    return this.#uiNodes.every(({ node, children: expected, attributes, text }) =>
      children(node, expected) && (attributes === null || node instanceof Element && attrs(node) === attributes) &&
      (text === null || node.textContent === text))
  }

  checkOuter(): boolean {
    return this.#outerIntact() && children(this.#root,[this.#style,this.#mount]) &&
      this.#sheetIntact(this.#style,css,this.#sheet,this.#rules) && this.#uiIntact()
  }
}
