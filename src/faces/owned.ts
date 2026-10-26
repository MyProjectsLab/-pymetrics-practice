import { SITE_FOOTER_TEXT } from '../design/siteFooter'
import facesCss from './style.css?inline'
import headerCss from '../design/site-header.css?inline'
import { loadGameFonts } from '../design/gameFonts'
import { decorateSiteBrand } from '../design/siteBrand'
const css = `${headerCss}\n${facesCss}`
import {invariant} from './model'
import {Ownership,wipe} from './ownership'

type View={privateData?:object;title:string;eyebrow?:string;paragraphs?:string[];notice?:string;content?:(mount:HTMLElement,add:(node:Node)=>void)=>void;actions?:{label:string;run:(event:MouseEvent)=>void;secondary?:boolean;disabled?:boolean}[];question?:boolean}
type Snapshot={node:Node;children:Node[];data:{attrs:string|null;text:string|null}}
const attrs=(node:Element)=>JSON.stringify([...node.attributes].map(a=>[a.name,a.value]).sort(([a],[b])=>a.localeCompare(b)))
const snapshot=(node:Node):Snapshot[]=>{
 const entry:Snapshot={node,children:[...node.childNodes],data:{attrs:node instanceof Element?attrs(node):null,text:node.nodeType===Node.TEXT_NODE?node.textContent:null}}
 return [entry,...entry.children.flatMap(snapshot)]
}
const sameChildren=(node:Node,nodes:Node[])=>node.childNodes.length===nodes.length&&nodes.every((x,i)=>node.childNodes[i]===x)
export class OwnedStage {
 mockReturn:(()=>void)|null=null
 onNavigate:(()=>void)|null=null
 readonly html=document.createElement('html')
 readonly head=document.createElement('head')
 readonly body=document.createElement('body')
 readonly shadow=this.body.attachShadow({mode:'closed'})
 readonly style=document.createElement('style')
 readonly mount=document.createElement('main')
 readonly observer=new MutationObserver(()=>{this.fault=true})
 readonly doctype=document.doctype
 readonly originalCss=css
 owner:string|null=null
 private nodes=new Set<Node>()
 private views=new Set<View>()
 private actionPayloads=new WeakMap<Function,object>()
 private descriptors=new Set<object>()
 action<T extends Function>(run:T,descriptor:object){this.actionPayloads.set(run,descriptor);return run}
 private sheet:CSSStyleSheet|null=null
 private sheetText=''
 private records:Snapshot[]=[]
 private fault=false
 private epoch=0
 private currentImage:HTMLImageElement|null=null
 private currentContext:HTMLElement|null=null
 private timerNode:HTMLElement|null=null
 private statusNode:HTMLElement|null=null
 private bindings=new Set<{target:HTMLElement;run:((event:Event)=>void)|null}>()
 private adoptedDocument:CSSStyleSheet[]=[]
 private adoptedShadow:CSSStyleSheet[]=[]
 private drain(){if(this.observer.takeRecords().length)this.fault=true}
 private mutate(run:()=>void){this.assert();this.observer.disconnect();try{run()}finally{this.capture()}}
 readonly ownership:Ownership
 constructor(ownership=new Ownership()){
  loadGameFonts()
  this.ownership=ownership
  ownership.beforeErase=()=>{if(!this.intact())this.fault=true;this.observer.disconnect()}
  ownership.afterErase=()=>this.capture()
  invariant(window.top===window&&this.doctype?.name==='html'&&!this.doctype.publicId&&!this.doctype.systemId,'Faces requires its dedicated top-level document')
  this.html.lang='en'
  const charset=document.createElement('meta');charset.setAttribute('charset','utf-8')
  const viewport=document.createElement('meta');viewport.name='viewport';viewport.content='width=device-width, initial-scale=1'
  const title=document.createElement('title');title.textContent='Faces — TraitGame'
  this.head.append(charset,viewport,title)
  this.style.textContent=css
  this.shadow.append(this.style,this.mount)
  this.html.append(this.head,this.body)
  document.replaceChild(this.html,document.documentElement)
  this.sheet=this.style.sheet
  this.sheetText=this.cssRules()
  this.capture()
  invariant(this.intact(),'Faces document ownership failed')
 }
 private cssRules(){return this.sheet?[...this.sheet.cssRules].map(x=>x.cssText).join('\n'):''}
 own(owner:string,node:Node){this.ownership.dom(owner,node);return node}
 private register(node:Node,owner=this.owner??this.ownership.generationKey){const actual=this.ownership.owner(node)??owner;this.ownership.dom(actual,node);this.nodes.add(node);for(const child of [...node.childNodes,...(node instanceof Element?[...node.attributes]:[])])this.register(child,actual)}
 private capture(){this.drain();for(const r of this.records)wipe(r.data);for(const n of this.mount.childNodes)this.register(n);this.records=[...snapshot(this.html),...snapshot(this.shadow)];for(const r of this.records)if(this.nodes.has(r.node))this.ownership.own(this.ownership.owner(r.node)??this.ownership.generationKey,r.data);this.observer.disconnect();this.observer.observe(this.html,{subtree:true,childList:true,attributes:true,characterData:true});this.observer.observe(this.shadow,{subtree:true,childList:true,attributes:true,characterData:true})}
 intact():boolean {
  this.drain()
  if(document.adoptedStyleSheets.length!==this.adoptedDocument.length||document.adoptedStyleSheets.some((s,i)=>s!==this.adoptedDocument[i])||this.shadow.adoptedStyleSheets.length!==this.adoptedShadow.length||this.shadow.adoptedStyleSheets.some((s,i)=>s!==this.adoptedShadow[i]))this.fault=true
  if(this.fault||document.documentElement!==this.html||document.doctype!==this.doctype||!sameChildren(this.shadow,[this.style,this.mount])||this.style.textContent!==this.originalCss||this.style.sheet!==this.sheet||this.cssRules()!==this.sheetText)return false
  return this.records.every(r=>sameChildren(r.node,r.children)&&(r.data.attrs==null||r.node instanceof Element&&attrs(r.node)===r.data.attrs)&&(r.data.text==null||r.node.textContent===r.data.text))
 }
 assert(){invariant(this.intact(),'Owned Faces display changed')}
 get viewEpoch(){return this.epoch}
 render(view:View){
  this.assert()
  this.observer.disconnect()
  this.epoch++;this.clearView()
  this.views.add(view);this.ownership.own(this.owner??this.ownership.generationKey,view)
  this.currentImage=null;this.currentContext=null;this.timerNode=null;this.statusNode=null
  const frame=document.createElement('div');frame.className=view.question?'question':'journey'
  const header=document.createElement('header'),siteNav=document.createElement('nav');header.className='site-header';siteNav.setAttribute('aria-label','Site navigation')
  for(const [label,href] of [['TraitGame','/'],['Home','/'],['Assessments','/practice'],['Full mock','/mock']]){
   const link=document.createElement('a');link.href=href;link.textContent=label;if(label==='TraitGame')decorateSiteBrand(link)
   this.on(link,'click',()=>this.onNavigate?.());if(label==='TraitGame')header.append(link);else siteNav.append(link)
  }
  header.append(siteNav)
  if(this.mockReturn){const back=document.createElement('button');back.type='button';back.textContent='Return to mock';this.on(back,'click',this.mockReturn);header.append(back)}
  const heading=document.createElement('h1');heading.tabIndex=-1;heading.textContent=view.title
  const panel=view.question?frame:document.createElement('section');if(!view.question)panel.className='panel'
  frame.append(header);if(view.eyebrow){const eyebrow=document.createElement('p');eyebrow.className='eyebrow';eyebrow.textContent=view.eyebrow;panel.append(eyebrow)}panel.append(heading)
  const privacy:HTMLElement[]=[]
  for(const line of view.paragraphs??[]){const p=document.createElement('p');p.textContent=line;if(!view.question&&line.includes('Privacy')){p.className='assessment-usage-notice';const parts=line.split('Privacy');const link=document.createElement('a');link.href='/privacy.html';link.textContent='Privacy';p.replaceChildren(document.createTextNode(parts[0]),link,document.createTextNode(parts.slice(1).join('Privacy')));privacy.push(p)}else panel.append(p)}
  if(view.notice){const note=document.createElement('p');note.className='notice';note.textContent=view.notice;panel.append(note)}
  view.content?.(panel,n=>panel.append(n))
  if(view.actions?.length){const nav=document.createElement('nav'),extras=document.createElement('nav');nav.className='actions';extras.className='actions';for(const action of view.actions){const button=document.createElement('button');button.type='button';button.textContent=this.mockReturn&&['Close','Back to library','Back to mock'].includes(action.label)?'Return to mock':action.label;button.disabled=!!action.disabled;if(action.secondary)button.className='secondary';this.on(button,'click',action.run);if(!view.question&&action.label==='Main menu'){const top=document.createElement('div');top.className='journey-top';const arrow=document.createElement('span');arrow.setAttribute('aria-hidden','true');arrow.textContent='← ';button.prepend(arrow);const label=document.createElement('p');label.textContent='Faces · Practice';top.append(button,label);frame.append(top)}else if(view.eyebrow&&action.label!=='Continue')extras.append(button);else nav.append(button)}panel.append(nav);if(extras.childNodes.length){const details=document.createElement('details'),summary=document.createElement('summary');details.className='start-options';summary.textContent='Examples and saved results';details.append(summary,extras);panel.append(details)}}
  if(!view.question){panel.append(...privacy);frame.append(panel);const footer=document.createElement('footer');footer.className='site-footer';footer.textContent=SITE_FOOTER_TEXT;frame.append(footer)}
  this.register(frame);view.content=undefined
  this.mount.replaceChildren(frame)
  this.capture()
  window.scrollTo(0,0)
  heading.focus({preventScroll:true})
  this.capture()
 }
 /** Each native listener has its own revocable, payload-scrubbable scope. */
 on<E extends Event>(target:HTMLElement,type:string,run:(event:E)=>void){
  const cell={target,run:run as (event:Event)=>void|null},epoch=this.epoch
  this.bindings.add(cell);const descriptor=this.actionPayloads.get(run);if(descriptor)this.descriptors.add(descriptor)
  target.addEventListener(type,this.listener(cell,epoch))
 }
 private listener(cell:{target:HTMLElement;run:((event:Event)=>void)|null},epoch:number){
  return (event:Event)=>{if(epoch===this.epoch&&cell.target.isConnected)cell.run?.(event)}
 }
 private clearView(){
  for(const cell of this.bindings)cell.run=null
  this.bindings.clear();for(const descriptor of this.descriptors)wipe(descriptor);this.descriptors.clear()
  for(const node of this.nodes)wipe(node)
  this.nodes.clear()
  for(const r of this.records)wipe(r.data)
  for(const view of this.views){view.content=undefined;wipe(view)}this.views.clear()
 }
 private replaceText(node:HTMLElement,value:string){for(const child of [...node.childNodes])wipe(child);const next=document.createTextNode(value);this.register(next,this.ownership.owner(node)??this.owner??this.ownership.generationKey);node.replaceChildren(next)}
 setQuestionControls(image:HTMLImageElement,context:HTMLElement|null,timer:HTMLElement,status:HTMLElement){this.assert();this.currentImage=image;this.currentContext=context;this.timerNode=timer;this.statusNode=status;image.scrollIntoView({block:'nearest',inline:'nearest'})}
 enableChoices(){this.mutate(()=>{for(const choice of this.mount.querySelectorAll<HTMLButtonElement>('.choices button'))choice.disabled=false})}
 /** Conceal even a broken display; never recapture an unexpected state as trusted. */
 hideStimulus(expired=false){
  this.drain();if(!this.intact())this.fault=true
  this.observer.disconnect()
  this.currentImage?.remove();this.currentContext?.remove();this.currentImage=null;this.currentContext=null
  if(expired){if(this.timerNode)this.replaceText(this.timerNode,'Time expired — choose an answer');if(this.statusNode&&!this.statusNode.textContent)this.replaceText(this.statusNode,'Time expired — choose an answer')}
  this.capture()
 }
 setTimer(value:string){if(!this.timerNode||this.timerNode.textContent===value)return;this.mutate(()=>{this.replaceText(this.timerNode!,value)})}
 updateText(node:HTMLElement,value:string){this.mutate(()=>{this.replaceText(node,value)})}
 toggleDetails(node:HTMLDetailsElement){this.mutate(()=>{node.open=!node.open})}
 quarantine(){this.drain();this.observer.disconnect();this.epoch++;this.clearView();this.currentImage=null;this.currentContext=null;this.timerNode=null;this.statusNode=null;this.records=[];this.mount.replaceChildren(document.createTextNode('Faces display changed. This attempt is closed; reload to inspect local history.'));this.fault=true}
 presentationGood():boolean {
  if(!this.intact()||document.visibilityState!=='visible'||!document.hasFocus())return false
  // These are exactly the owned topology and its ancestors, not a general-page CSS scanner.
  const elements=[this.html,this.body,this.mount,...this.mount.querySelectorAll<HTMLElement>('*')]
  for(const e of elements){
   const s=getComputedStyle(e)
   if(s.display==='none'||s.visibility!=='visible'||Number(s.opacity)<(e instanceof HTMLButtonElement&&e.disabled ? .45 : .95)||s.contentVisibility==='hidden'||s.filter!=='none'||s.clipPath!=='none'||e.matches(':modal,:popover-open')){this.fault=true;return false}
  }
  if(this.timerNode){const choices=[...this.mount.querySelectorAll<HTMLButtonElement>('.choices button')];if(choices.length!==10||choices.some(b=>{const r=b.getBoundingClientRect();return r.width<44||r.height<44||Number.parseFloat(getComputedStyle(b).fontSize)<16})){this.fault=true;return false}}
  return true
 }
 admissionGood(image:HTMLImageElement|null,context:HTMLElement|null,expired:boolean):boolean {
  return this.presentationGood()&&(expired||!!image&&this.imageGeometryGood(image,context))
 }
 imageGeometryGood(image:HTMLImageElement,context:HTMLElement|null,confirmVisible=false):boolean {
  if(!this.presentationGood()||!image.isConnected||!image.complete||image.naturalWidth<=0||image.naturalHeight<=0)return false
  const rect=image.getBoundingClientRect(),style=getComputedStyle(image)
  if(rect.width<100||rect.height<100||rect.left+scrollX<0||rect.right+scrollX>this.html.scrollWidth+1||style.visibility!=='visible'||Number(style.opacity)<.95||style.display==='none')return false
  if(confirmVisible){const v=visualViewport,left=v?.offsetLeft??0,top=v?.offsetTop??0,width=v?.width??innerWidth,height=v?.height??innerHeight;if(rect.left<left-1||rect.right>left+width+1||rect.top<top-1||rect.bottom>top+height+1)return false}
  if(context){const c=context.getBoundingClientRect(),s=getComputedStyle(context);if(c.width<40||c.height<20||c.left+scrollX<0||c.right+scrollX>this.html.scrollWidth+1||s.visibility!=='visible'||Number(s.opacity)<.95)return false}
  const choices=this.mount.querySelectorAll<HTMLButtonElement>('.choices button')
  if(choices.length!==10||[...choices].some(b=>{const r=b.getBoundingClientRect();return r.width<44||r.height<44||r.left+scrollX<0||r.right+scrollX>this.html.scrollWidth+1||Number.parseFloat(getComputedStyle(b).fontSize)<16}))return false
  // Ordinary document scrolling and visual-viewport panning do not alter the
  // readable authored layout. The receipt confirms rendering, not human attention.
  if(context){const c=context.getBoundingClientRect();if(Math.min(c.right,rect.right)>Math.max(c.left,rect.left)+1&&Math.min(c.bottom,rect.bottom)>Math.max(c.top,rect.top)+1)return false}
  return true
 }
}
export type {View}
