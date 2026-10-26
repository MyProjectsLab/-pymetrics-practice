import fs from 'node:fs'
export const probe='data:text/javascript;base64,'+fs.readFileSync('/private/tmp/money2-v2-probe/probe.js').toString('base64')
import {createRequire} from 'node:module'
export const {chromium}=createRequire(import.meta.url)('/Users/renzo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
export const options={headless:true,executablePath:'/Users/renzo/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell'}
export async function setup(browser,viewport={width:1334,height:900},inject){
 const context=await browser.newContext({viewport});await context.addInitScript(()=>{const original=Element.prototype.attachShadow;window.__roots=[];Element.prototype.attachShadow=function(init){const root=original.call(this,init);window.__roots.push(root);return root};window.__callbacks=[];
  window.__fault=null;const decode=HTMLImageElement.prototype.decode;HTMLImageElement.prototype.decode=async function(){await decode.call(this);if(this.hasAttribute('data-money-result')&&window.__fault){const fault=window.__fault;window.__fault=null;const root=window.__roots.at(-1);
    if(fault==='transparent')this.style.opacity='0';if(fault==='hidden')this.hidden=true;if(fault==='amount')this.src='data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="340"><rect width="1100" height="340" fill="white"/></svg>';
    if(fault==='direction')root.querySelector('[data-money-semantics]').textContent='Take $5.00';
    if(fault==='occluded'){const cover=document.createElement('fieldset');cover.style.cssText='position:fixed;inset:0;background:white;z-index:999';root.append(cover)}
    if(fault==='top-layer'){const d=document.createElement('dialog');d.textContent='Cover';root.append(d);d.showModal()}
    if(fault==='closed-root'){const host=document.createElement('div');const shadow=host.attachShadow({mode:'closed'});shadow.innerHTML='<div style="position:fixed;inset:0;background:white">Cover</div>';document.body.append(host)}
  }}
 });if(inject)await context.addInitScript(inject);
 const page=await context.newPage();await page.goto('http://127.0.0.1:4282/money2.html');
 const rootShadow=()=>window.__roots.findLast(r=>r.host===document.body);
 const stage=()=>page.evaluate(()=>window.__roots.findLast(r=>r.host===document.body)?.querySelector('fieldset[data-money-stage]')?.getAttribute('data-money-stage'));
 const text=()=>page.evaluate(()=>window.__roots.findLast(r=>r.host===document.body)?.textContent);
 async function wait(s){await page.waitForFunction(s=>window.__roots.findLast(r=>r.host===document.body)?.querySelector('fieldset[data-money-stage]')?.getAttribute('data-money-stage')===s,s,{timeout:15000})}
 async function click(label,key){await page.waitForFunction(label=>[...window.__roots.findLast(r=>r.host===document.body).querySelectorAll('button')].some(b=>b.textContent===label&&!b.disabled),label,{timeout:15000});const point=await page.evaluate(label=>{const b=[...window.__roots.findLast(r=>r.host===document.body).querySelectorAll('button')].find(b=>b.textContent===label);b.scrollIntoView({block:'center'});b.focus();const r=b.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}},label);if(key||await page.evaluate(()=>visualViewport.scale>1))await page.keyboard.press(key??'Enter');else await page.mouse.click(point.x,point.y);await page.waitForTimeout(30)}
 async function root(){return page.evaluate(()=>new Promise((resolve,reject)=>{const q=indexedDB.open('assessment-practice-money-exchange-2-v1',2);q.onsuccess=()=>{const db=q.result,t=db.transaction('installation'),g=t.objectStore('installation').get('root');g.onsuccess=()=>{resolve(g.result);db.close()};g.onerror=()=>reject(g.error)}}))}
 async function guide(){await wait('library');await click('Read the guide');await wait('instructions');await click('See an example');await click('Check understanding');await click('You $8.00 · Partner $7.00');await click('Next');await wait('ready')}
 async function start(){await guide();await click('Next')}
 async function toChoice(i){for(const s of ['award','connected','partner_rules','bonus']){await wait(`${s}_${i}`);await click('Next')}await page.waitForFunction(i=>['choice_'+i,'partner_choice_'+i].includes(window.__roots.findLast(r=>r.host===document.body)?.querySelector('fieldset[data-money-stage]')?.getAttribute('data-money-stage')),i)}
 async function choose(i,cents){if(await stage()===`choice_${i}`){await page.evaluate(c=>{const e=window.__roots.findLast(r=>r.host===document.body).querySelector('input[type=range]');e.value=String(c);e.dispatchEvent(new Event('input',{bubbles:true}))},cents);await click('Confirm')}else await click('Next');await wait(`result_${i}`)}
 async function rate(i,rating){await click('Next');await wait(`fairness_${i}`);await page.evaluate(r=>{const e=window.__roots.findLast(r=>r.host===document.body).querySelector(`input[value="${r}"]`);e.click()},rating);await click('Next')}
 async function round(i,cents,rating){await toChoice(i);await choose(i,cents);await rate(i,rating)}
 async function complete(c1=200,c2=200,r1=8,r2=8){await round(1,c1,r1);await wait('new_partner');await click('Next');await round(2,c2,r2);await wait('test_complete');await click('Next');await wait('report')}
 return{context,page,stage,text,wait,click,root,guide,start,toChoice,choose,rate,round,complete,rootShadow}
}
