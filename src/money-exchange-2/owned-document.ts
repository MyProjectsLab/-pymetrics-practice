import { decorateSiteBrand } from '../design/siteBrand'
import { loadGameFonts } from '../design/gameFonts'
import type { Art } from './art'
const css=':host{display:block}'
const protectedCss = `
:host{all:initial;display:block;min-height:100vh;background:#ffffff;color:#14213d;font:18px system-ui;direction:ltr;writing-mode:horizontal-tb}
fieldset[data-money-stage]{all:initial;box-sizing:border-box;display:block;width:calc(100% - 64px);max-width:1800px;min-height:650px;margin:32px auto;padding:32px 48px;border:0;border-radius:12px;background:#fff;color:#14213d;font:18px system-ui;direction:ltr;writing-mode:horizontal-tb}
.eyebrow{font-size:12px;font-weight:600;letter-spacing:.09em;text-transform:uppercase;color:#0e7490;margin:0 0 12px;text-align:left}
legend{font-size:1.6rem;font-weight:650;color:#14213d;float:left;width:100%;margin-bottom:24px;text-align:center}
output{display:block;margin:12px auto;max-width:1000px;line-height:1.5;color:#14213d;text-align:center;clear:both}
label{display:inline-block;margin:12px 8px;color:#14213d}
input{box-sizing:border-box;max-width:100%;padding:10px;font:inherit;accent-color:#0e7490}
input[type=range]{display:block;width:500px;margin:22px auto}
fieldset[data-card]{display:inline-block;vertical-align:top;box-sizing:border-box;width:calc(50% - 16px);margin:8px;padding:20px;border:1px solid #e4e7ef;border-radius:8px;background:#fff}fieldset[data-card] legend{float:none;width:auto;font-size:1.1rem;text-align:left;margin:0}fieldset[data-card] output:first-of-type{background:#e3f6fa;font-size:1.3rem;padding:12px}fieldset[data-card] output{font-size:1rem}fieldset[aria-label]{display:flex;flex-wrap:wrap;justify-content:center;border:0;gap:4px;margin:24px auto;max-width:1100px}
fieldset[aria-label] label{display:flex;flex-direction:column;align-items:center;background:#e3f6fa;padding:10px 7px;border-radius:5px;margin:0;min-width:24px}
button{box-sizing:border-box;min-height:44px;margin:16px 12px 0 0;padding:10px 24px;border:0;border-radius:999px;background:#0e7490;color:#fff;font:inherit;cursor:pointer}
button:disabled{opacity:.48;cursor:default}
button:focus-visible,input:focus-visible{outline:3px solid #0891b2;outline-offset:3px}
img[data-money-result],img[data-money-pair]{display:block;width:100%;max-width:1100px;height:auto;object-fit:contain;background:#fff;margin:30px auto;clear:both}
output[data-money-semantics]{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.assessment-usage-notice{display:block;color:#4a5368;font-size:.8rem;line-height:1.6;text-align:left;margin:1.5rem 0 0}
nav[data-site-nav]{display:flex;clear:both;box-sizing:border-box;width:100%;flex-wrap:wrap;align-items:center;gap:12px;margin:0 0 20px}
nav[data-site-nav] a{color:#0e7490;min-height:44px;display:inline-flex;align-items:center}
nav[data-site-nav] a.ap-wordmark{gap:1rem;font:600 1rem/1.1 'AP Inter',Arial,sans-serif;color:#14213d;text-decoration:none}nav[data-site-nav] .ap-wordmark svg{width:40px;height:40px;flex-shrink:0;color:#0891b2}
nav[data-site-nav] a:focus-visible{outline:3px solid #0891b2;outline-offset:3px}
main[data-money-main]{display:block}
@media(max-width:600px){fieldset[data-card]{width:100%;margin:8px 0}fieldset[data-money-stage]{width:calc(100% - 16px);margin:8px;padding:16px;min-height:450px}.eyebrow{font-size:12px;font-weight:600;letter-spacing:.09em;text-transform:uppercase;color:#0e7490;margin:0 0 12px;text-align:left}
legend{font-size:1.25rem}img[data-money-result],img[data-money-pair]{margin:16px auto}button{padding:10px 16px}fieldset[aria-label]{gap:6px}fieldset[aria-label] label{min-width:30px}}
fieldset[data-money-stage^="choice_"]{position:relative;max-width:2400px;height:calc(100svh - 64px);min-height:650px;padding:100px 48px 140px}
fieldset[data-money-stage^="choice_"] legend{position:absolute;top:25%;left:25%;width:50%;font-size:clamp(24px,1.5vw,40px);float:none}
fieldset[data-money-stage^="choice_"]>output:not([data-decision-value]):not([data-endpoints]):not([data-money-semantics]){position:absolute;top:31%;left:25%;width:50%;font-size:clamp(16px,1vw,24px)}
fieldset[data-money-stage^="choice_"] img[data-money-pair]{position:absolute;top:24%;left:4%;width:92%;max-width:none!important;margin:0}
fieldset[data-money-stage^="choice_"]>:not(img){z-index:1}
[data-decision-label]{position:absolute;top:60%;left:28%;width:44%;text-align:center}
[data-decision-value]{position:absolute;top:40%;left:calc(50% - 110px);width:220px;padding:24px 0;border-radius:24px;background:#148568;color:white;font-size:32px;font-weight:650;z-index:1}
[data-endpoints]{position:absolute;top:52%;left:34%;width:32%;display:flex;justify-content:space-between;font-weight:600}
fieldset[data-money-stage^="choice_"] input[type=range]{position:absolute;top:56%;left:34%;width:32%;height:44px;margin:0;padding:0;accent-color:#148568}
fieldset[data-money-stage^="choice_"] button[data-action="Restart"]{position:absolute;top:3%;right:150px}
fieldset[data-money-stage^="choice_"] button[data-action="Close"]{position:absolute;top:3%;right:32px}
fieldset[data-money-stage^="choice_"] button[data-action="Confirm"]{position:absolute;bottom:6%;right:6%;min-width:220px}
@media(max-width:700px){fieldset[data-money-stage^="choice_"]{height:780px;min-height:780px;padding:90px 16px 110px}fieldset[data-money-stage^="choice_"] legend{top:16%;left:5%;width:90%;font-size:22px}fieldset[data-money-stage^="choice_"]>output:not([data-decision-value]):not([data-endpoints]):not([data-money-semantics]){top:22%;left:5%;width:90%;font-size:14px}fieldset[data-money-stage^="choice_"] img[data-money-pair]{top:27%;left:4%;width:92%}[data-decision-value]{top:61%;left:calc(50% - 80px);width:160px;padding:12px 0;font-size:24px}[data-endpoints]{top:71%;left:8%;width:84%;font-size:14px}fieldset[data-money-stage^="choice_"] input[type=range]{top:77%;left:8%;width:84%}[data-decision-label]{position:absolute;top:85%;left:4%;width:92%;margin:0;font-size:12px}fieldset[data-money-stage^="choice_"] button[data-action="Restart"]{top:0;right:110px}fieldset[data-money-stage^="choice_"] button[data-action="Close"]{top:0;right:8px}fieldset[data-money-stage^="choice_"] button[data-action="Confirm"]{bottom:0;right:16px;min-width:140px}}

`
const attrs = (node: Element) => JSON.stringify([...node.attributes].map(a => [a.name, a.value]).sort(([a], [b]) => a.localeCompare(b)))
const children = (node: Node, expected: Node[]) => node.childNodes.length === expected.length && expected.every((item, index) => node.childNodes[index] === item)
type UiNode = { node: Node; children: Node[]; attributes: string | null; text: string | null }
export type ProtectedView = {
  stage: string
  title: string
  onViolation: () => void
  onNavigate?: () => void
  lines: readonly string[]
  buttons: readonly { label: string; act: (event:MouseEvent) => void; disabled?: boolean; expanded?: boolean }[]
  cards?: readonly {label:string;value:string;detail:string}[]
  pairFirst?:boolean
  announceResult?:boolean
  amount?: { label:string;display:string;min:number; value: string; current: () => string; changed: (value: string) => void }
  rating?: { value: number | null; current: () => number | null; changed: (value: number) => void }
  comprehension?: { value: string | null; current: () => string | null; choices: readonly { id: string; label: string }[]; changed: (value: string) => void }
  detailLines?: readonly string[]
  pair?: { src: string; width: number; height: number; semantics: string }
  result?: { src: string; width: number; height: number; semantics: string }
}

/** Owns the top-level document before Money Exchange can arm an attempt. */
export class OwnedDocument {
  readonly #doctype = document.doctype
  readonly #html = document.createElement('html')
  readonly #head = document.createElement('head')
  readonly #body = document.createElement('body')
  readonly #root = this.#body.attachShadow({ mode: 'closed' })
  readonly #charset = document.createElement('meta')
  readonly #viewport = document.createElement('meta')
  readonly #title = document.createElement('title')
  readonly #titleText = document.createTextNode('Money Exchange 2 — TraitGame')
  readonly #style = document.createElement('style')
  readonly #mount = document.createElement('main')
  readonly #protectedStyle = document.createElement('style')
  readonly #protectedMain = document.createElement('main')
  readonly #protectedSurface = document.createElement('fieldset')
  readonly #attributes = new Map<Element, string>()
  readonly #sheet: CSSStyleSheet | null
  readonly #rules: string
  #uiNodes: UiNode[] = []
  #protectedNodes: UiNode[] = []
  #protectedSheet: CSSStyleSheet | null = null
  #protectedRules = ''
  #protectedSurfaceAttributes = ''
  #protectedMainAttributes = ''
  #protectedStage: string | null = null
  #active = false
  #resultImage: HTMLImageElement | null = null
  #resultMeaning: HTMLOutputElement | null = null
  #resultSizeProof: { image: HTMLImageElement; uri: string; epoch: number; width: number; height: number } | null = null
  #renderEpoch = 0
  #preparedResultEpoch = 0
  readonly #observer = new MutationObserver(() => { this.#fault = true })
  #fault = false

  constructor() {
    loadGameFonts()
    if (window.top !== window || !this.#doctype || this.#doctype.name !== 'html' || this.#doctype.publicId || this.#doctype.systemId)
      throw Error('Money Exchange 2 requires its dedicated top-level page.')
    this.#html.lang = 'en'
    this.#charset.setAttribute('charset', 'utf-8')
    this.#viewport.name = 'viewport'
    this.#viewport.content = 'width=device-width, initial-scale=1.0'
    this.#title.append(this.#titleText)
    this.#head.append(this.#charset, this.#viewport, this.#title)
    this.#style.textContent = css
    this.#protectedStyle.textContent = protectedCss
    this.#protectedMain.setAttribute('data-money-main', '')
    this.#protectedMainAttributes = attrs(this.#protectedMain)
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
    this.#protectedMain.append(this.#protectedSurface)
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
      (priorFocus.type==='radio'?`${priorFocus.name==='money-comprehension'?'comprehension':'rating'}:${priorFocus.value}`:'amount'):null
    this.#observer.disconnect()
    const made: Node[] = []
    const siteNav=document.createElement('nav');siteNav.setAttribute('data-site-nav','');siteNav.setAttribute('aria-label','Site navigation')
    for(const [label,href] of [['TraitGame','/'],['Home','/'],['Assessments','/practice'],['Full mock','/mock']]){
      const link=document.createElement('a');link.href=href;link.textContent=label;if(label==='TraitGame')decorateSiteBrand(link)
      link.addEventListener('click',event=>{if(!this.checkProtected(view.stage)){event.preventDefault();this.recover();view.onViolation();return}view.onNavigate?.()})
      siteNav.append(link)
    }
    this.#renderEpoch++;const eventEpoch=this.#renderEpoch;this.#preparedResultEpoch=0
    this.#resultImage=null;this.#resultMeaning=null;this.#resultSizeProof=null
    const heading = document.createElement('legend');heading.tabIndex=-1
    heading.append(document.createTextNode(view.title)); if(view.stage==='library'){const eyebrow=document.createElement('output');eyebrow.className='eyebrow';eyebrow.textContent='How it works';made.push(eyebrow)}made.push(heading)
    made.push(siteNav)
    for (const line of view.lines) { const item=document.createElement('output'); item.append(document.createTextNode(line)); made.push(item) }
    if (view.amount) {
      const label=document.createElement('label'); label.append(document.createTextNode(view.amount.label));label.htmlFor='money-amount';label.setAttribute('data-decision-label','')
      const input=document.createElement('input'); input.type='range'; input.min=String(view.amount.min);input.max='500';input.step='50';input.value=view.amount.value
      input.id='money-amount';input.setAttribute('aria-label',view.amount.label);input.setAttribute('aria-valuetext',view.amount.display)
      const tile=document.createElement('output');tile.setAttribute('data-decision-value','');tile.textContent=view.amount.display;
      const endpoints=document.createElement('output');endpoints.setAttribute('data-endpoints','');for(const text of [view.amount.min===0?'Give $0.00':'Take $5.00','Give $5.00']){const side=document.createElement('span');side.textContent=text;endpoints.append(side)}
      input.addEventListener('input',()=>{
        if(eventEpoch!==this.#renderEpoch)return
        if (!this.checkProtected(view.stage)) { this.recover(); view.onViolation(); return }
        view.amount?.changed(input.value)
      })
      made.push(label,tile,endpoints,input)
    }
    if (view.rating) {
      const group=document.createElement('fieldset');group.setAttribute('aria-label','Fairness from 0 to 10')
      for(let i=0;i<=10;i++) {
        const label=document.createElement('label'),input=document.createElement('input')
        input.type='radio';input.name='money-fairness';input.value=String(i);input.checked=view.rating.value===i
        input.addEventListener('change',()=>{
          if(eventEpoch!==this.#renderEpoch)return
          if (!this.checkProtected(view.stage)) { this.recover(); view.onViolation(); return }
          view.rating?.changed(i)
        })
        label.append(input,document.createTextNode(String(i)));group.append(label)
      }
      made.push(group)
    }
    if (view.comprehension) {
      const group=document.createElement('fieldset');group.setAttribute('aria-label','Money Exchange 2 understanding check')
      for (const choice of view.comprehension.choices) {
        const label=document.createElement('label'),input=document.createElement('input')
        input.type='radio';input.name='money-comprehension';input.value=choice.id;input.checked=view.comprehension.value===choice.id
        input.addEventListener('change',()=>{
          if(eventEpoch!==this.#renderEpoch)return
          if (!this.checkProtected(view.stage)) { this.recover();view.onViolation();return }
          view.comprehension?.changed(choice.id)
        })
        label.append(input,document.createTextNode(choice.label));group.append(label)
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
      meaning.setAttribute('role',view.announceResult?'status':'note');meaning.setAttribute('aria-live',view.announceResult?'polite':'off');meaning.append(document.createTextNode(view.result.semantics))
      this.#resultImage=graphic;this.#resultMeaning=meaning
      made.push(graphic,meaning)
    }
    if(view.pairFirst){const pair=made.splice(made.length-2,2);made.splice(1,0,...pair)}
    if(view.cards)for(const card of view.cards){const box=document.createElement('fieldset');box.setAttribute('data-card','');const legend=document.createElement('legend');legend.textContent=card.label;const value=document.createElement('output');value.textContent=card.value;const detail=document.createElement('output');detail.textContent=card.detail;box.append(legend,value,detail);made.splice(view.pairFirst?3:made.length,0,box)}
    if(view.detailLines){const detail=document.createElement('section');detail.setAttribute('aria-label','Detailed numbers');for(const line of view.detailLines){const item=document.createElement('output');item.textContent=line;detail.append(item)}made.push(detail)}
    const controlsMatch=()=>
      (!view.amount || made.some(node=>node instanceof HTMLInputElement && node.type==='range' && node.value===view.amount?.current())) &&
      (!view.rating || [...this.#protectedSurface.querySelectorAll('input[name="money-fairness"]')].every(node=>
        node instanceof HTMLInputElement && node.checked===(Number(node.value)===view.rating?.current()))) &&
      (!view.comprehension || [...this.#protectedSurface.querySelectorAll('input[name="money-comprehension"]')].every(node=>
        node instanceof HTMLInputElement && node.checked===(node.value===view.comprehension?.current())))
    for (const action of view.buttons) {
      const button=document.createElement('button');button.type='button';button.disabled=!!action.disabled
      if(action.expanded!==undefined)button.setAttribute('aria-expanded',String(action.expanded))
      button.setAttribute('data-action',action.label);button.append(document.createTextNode(action.label));button.addEventListener('click',(event)=>{
        if(eventEpoch!==this.#renderEpoch)return
        if (!this.checkProtected(view.stage) || !controlsMatch()) { this.recover(); view.onViolation(); return }
        action.act(event)
      });made.push(button)
    }
    const privacyLines = made.filter(node => node instanceof HTMLOutputElement && /Privacy/.test(node.textContent ?? ''))
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
    this.#protectedSurface.replaceChildren(...made)
    this.#protectedNodes=records
    this.#protectedStage=view.stage
    if(priorStage!==view.stage || focusedHeading)heading.focus()
    else if(focusedButton) {
      const target=made.find(node=>node instanceof HTMLButtonElement&&node.textContent===focusedButton)
      if(target instanceof HTMLButtonElement&&!target.disabled)target.focus();else heading.focus()
    } else if(focusedInput==='amount') {
      const target=made.find(node=>node instanceof HTMLInputElement&&node.type==='range')
      if(target instanceof HTMLInputElement)target.focus()
    }
    else if(focusedInput?.startsWith('rating:'))
      this.#protectedSurface.querySelector<HTMLInputElement>(`input[name="money-fairness"][value="${focusedInput.slice(7)}"]`)?.focus()
    else if(focusedInput?.startsWith('comprehension:'))
      this.#protectedSurface.querySelector<HTMLInputElement>(`input[name="money-comprehension"][value="${focusedInput.slice(14)}"]`)?.focus()
    this.#observer.observe(this.#root,{subtree:true,childList:true,attributes:true,characterData:true})
    this.#observer.observe(this.#html,{subtree:true,childList:true,attributes:true,characterData:true})
  }

  checkProtected(stage: string | null = this.#protectedStage): boolean {
    if (this.#observer.takeRecords().length) this.#fault=true
    if (!this.#active || this.#fault || stage!==this.#protectedStage || !this.#outerIntact() ||
      !children(this.#root,[this.#protectedStyle,this.#protectedMain]) ||
      !children(this.#protectedMain,[this.#protectedSurface]) ||
      attrs(this.#protectedMain)!==this.#protectedMainAttributes ||
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
    if (!image || !this.checkProtected()) throw Error('Result display is not owned')
    const uri=image.getAttribute('src')
    if (!uri) throw Error('Result source is missing')
    await image.decode()
    if (this.#resultImage!==image || this.#renderEpoch!==epoch || !this.checkProtected())
      throw Error('Result display changed during preparation')
    if (image.getAttribute('src')!==uri || image.currentSrc!==uri || !image.complete)
      throw Error('Result source changed during preparation')
    const detached=new Image()
    detached.src=uri
    await detached.decode()
    if (this.#resultImage!==image || this.#renderEpoch!==epoch || !this.checkProtected() ||
      image.getAttribute('src')!==uri || image.currentSrc!==uri || !image.complete || detached.isConnected ||
      detached.getAttribute('src')!==uri || detached.src!==uri || detached.currentSrc!==uri || !detached.complete)
      throw Error('Result display changed during decoded-size preparation')
    this.#resultSizeProof={image,uri,epoch,width:detached.naturalWidth,height:detached.naturalHeight}
    this.#preparedResultEpoch=epoch
  }

  resultReady(expected:Art):boolean {
    const image=this.#resultImage, meaning=this.#resultMeaning, sizeProof=this.#resultSizeProof
    if (!image || !meaning || this.#preparedResultEpoch!==this.#renderEpoch ||
      !this.checkProtected() || image.ownerDocument!==document ||
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
    const title=document.createElement('title');title.textContent='Money Exchange 2 recovery';head.append(title)
    const root=body.attachShadow({mode:'closed'})
    const style=document.createElement('style');style.textContent=protectedCss
    const field=document.createElement('fieldset'),heading=document.createElement('legend'),message=document.createElement('output')
    field.setAttribute('data-money-stage','');heading.textContent='Display changed'
    message.textContent='This exchange was stopped. Check local history before trying again.'
    const query=new URLSearchParams(location.search),mockId=query.get('mock')??query.get('mockReport')
    const safeMockId=mockId&&/^[A-Za-z0-9._-]{1,180}$/.test(mockId)?mockId:null
    const button=document.createElement('button');button.type='button';button.textContent=mockId?'Return to mock':'Back to library'
    button.addEventListener('click',()=>window.location.assign(mockId?safeMockId?`/mock?mock=${encodeURIComponent(safeMockId)}`:'/mock':'/practice'))
    const main=document.createElement('main');main.append(field)
    field.append(heading,message,button);root.append(style,main);html.append(head,body)
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
      this.#titleText.data==='Money Exchange 2 — TraitGame' && this.#body.childNodes.length===0 &&
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
