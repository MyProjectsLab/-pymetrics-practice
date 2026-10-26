import { createRequire } from 'node:module'
import { writeFile, readFile } from 'node:fs/promises'
const require = createRequire(import.meta.url)
const { chromium } = require('/Users/renzo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const browser = await chromium.launch({ headless: true, executablePath: '/Users/renzo/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell' })
const base = process.env.PREVIEW_URL ?? 'http://127.0.0.1:4191/'
const results = []
function check(value, reason) { if (!value) throw Error(reason) }
async function root(page) { return page.evaluate(async () => {
  const db = await new Promise((resolve, reject) => { const r = indexedDB.open('assessment-practice-digits-v11', 1); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error) })
  const value = await new Promise((resolve, reject) => { const r = db.transaction('installation').objectStore('installation').get('root'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error) }); db.close(); return value
}) }
async function run(name, test, init = null) {
  if (process.env.CASE_FILTER && !name.includes(process.env.CASE_FILTER)) return
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  if (init) await context.addInitScript(init)
  const page = await context.newPage(), errors = []
  page.on('pageerror', error => errors.push(error.message))
  try { await page.goto(base); const detail = await test(page, context); check(!errors.length, `Page errors: ${errors.join('; ')}`); results.push({ name, status: 'PASS', detail }) }
  catch (error) { results.push({ name, status: 'FAIL', error: String(error), body: (await page.locator('body').innerText()).slice(-3500) }) }
  finally { await context.close(); console.log(name, results.at(-1).status); await writeFile(new URL(process.env.CASE_FILTER ? `./browser-${process.env.CASE_FILTER.replaceAll(' ', '-')}.json` : './browser-adjacent-final.json', import.meta.url), JSON.stringify(results, null, 2) + '\n') }
}
function storageFaults() {
  const meta = new WeakMap()
  window.__digitsFault = null; window.__digitsHeld = []
  const put = IDBObjectStore.prototype.put
  IDBObjectStore.prototype.put = function(value, ...args) {
    if (value?.version === 'digits_storage_v1_1') {
      const snapshot = Object.values(value.attempts).map(a => a.snapshot).find(s => s?.revision === value.revision)
      const type = snapshot?.kind ?? (Object.keys(value.attempts).length ? 'arm' : 'other')
      const prior = meta.get(this.transaction) ?? {}; meta.set(this.transaction, { ...prior, type })
      if (window.__digitsFault === `reject_${type}`) {
        window.__digitsFault = null; throw new DOMException('Injected write failure', 'UnknownError')
      }
    }
    return put.call(this, value, ...args)
  }
  const get = IDBObjectStore.prototype.get
  IDBObjectStore.prototype.get = function(...args) {
    const request = get.apply(this, args)
    meta.set(this.transaction, { ...(meta.get(this.transaction) ?? {}), request })
    return request
  }
  const complete = Object.getOwnPropertyDescriptor(IDBTransaction.prototype, 'oncomplete')
  Object.defineProperty(IDBTransaction.prototype, 'oncomplete', { configurable: true,
    get() { return complete.get.call(this) },
    set(handler) { complete.set.call(this, handler && function(event) {
      const observation = meta.get(this)
      if (observation?.request?.result?.version === 'digits_storage_v1_1') {
        const type = observation.type ?? 'read'
        if (window.__digitsFault === `hold_fail_${type}`) { window.__digitsFault = null; window.__digitsHeld.push(() => this.onerror?.(new Event('error'))); return }
        if (window.__digitsFault === `hold_${type}`) {
          window.__digitsFault = null; window.__digitsHeld.push(() => handler.call(this, event)); return
        }
        if (window.__digitsFault === `lose_${type}`) {
          window.__digitsFault = null; this.onerror?.(new Event('error')); return
        }
      }
      return handler.call(this, event)
    }) },
  })
}
async function deleteFromPeer(peer, type) {
  return peer.evaluate(async type => navigator.locks.request('assessment-practice-digits-data-v1',
    { mode: 'exclusive' }, async () => {
      const db = await new Promise((resolve, reject) => { const r = indexedDB.open('assessment-practice-digits-v11', 1); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error) })
      await new Promise((resolve, reject) => {
        const tx = db.transaction('installation', 'readwrite'), objectStore = tx.objectStore('installation')
        const r = objectStore.get('root')
        r.onsuccess = () => {
          const root = r.result
          if (type === 'all') { root.installationId = crypto.randomUUID(); root.revision = 0;
            root.counters = { visual: 0, auditory: 0 }; root.attempts = {}; root.tombstones = {}; root.activity = {} }
          else { const attempt = Object.values(root.attempts)[0]; delete root.attempts[attempt.sessionId]; delete root.activity[attempt.sessionId]
            root.tombstones[attempt.sessionId] = { requestId: attempt.requestId, mode: attempt.mode,
              ordinal: attempt.ordinal, deletedAtWallMs: Date.now() }; root.revision++ }
          objectStore.put(root, 'root')
        }; tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error)
      }); db.close(); return { type: 'deletion_committed', wallMs: Date.now() }
    }), type)
}
async function release(page) { await page.evaluate(()=>window.__digitsHeld.splice(0).forEach(f=>f())); await page.waitForTimeout(150) }
async function held(page,fault) { await page.evaluate(f=>window.__digitsFault=f,fault) }
async function waitHeld(page) { await page.waitForFunction(()=>window.__digitsHeld.length>0) }
async function guide(page) { await page.getByRole('button',{name:'See example',exact:true}).waitFor() }
async function history(page) { await page.getByRole('button',{name:'Local history',exact:true}).click();await page.getByRole('heading',{name:'Digits local history',exact:true}).waitFor() }
function neutral(body) { check(!body.includes('Maximum correctly recalled length')&&!body.includes('trials began presentation')&&!body.includes('Saved in this browser')&&!body.includes('Retry saving'),'pending destination leaked previous report authority') }

const fixture=JSON.parse(await readFile(new URL('../repair-f1-f3/F2-paste-root.json',import.meta.url),'utf8'))
async function seededHistory(page) {
 await page.getByRole('button',{name:'Open Digits',exact:true}).click();await guide(page)
 await page.evaluate(async value=>{const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('assessment-practice-digits-v11',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});await new Promise((resolve,reject)=>{const tx=db.transaction('installation','readwrite');tx.objectStore('installation').put(value,'root');tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error)});db.close()},fixture)
 await page.reload();await page.getByRole('button',{name:'Open Digits',exact:true}).click();await guide(page);await history(page)
}
function stagedFaults() {
 const get=IDBObjectStore.prototype.get, requests=new WeakMap()
 IDBObjectStore.prototype.get=function(...args){const r=get.apply(this,args);requests.set(this.transaction,r);return r}
 const complete=Object.getOwnPropertyDescriptor(IDBTransaction.prototype,'oncomplete')
 window.__stage=null;window.__digitsHeld=[]
 Object.defineProperty(IDBTransaction.prototype,'oncomplete',{configurable:true,get(){return complete.get.call(this)},set(handler){complete.set.call(this,handler&&function(e){
  const r=requests.get(this), stage=window.__stage
  if(stage&&r?.result?.version==='digits_storage_v1_1'){stage.count++;if(stage.count===stage.at){window.__stage=null;window.__digitsHeld.push(()=>stage.fail?this.onerror?.(new Event('error')):handler.call(this,e));return}}
  handler.call(this,e)
 })}})
 const request=navigator.locks.request.bind(navigator.locks)
 navigator.locks.request=(name,options,work)=>request(name,options,work).then(result=>{
  if(name==='assessment-practice-digits-data-v1'&&window.__holdAfterOrder){window.__holdAfterOrder=false;return new Promise(resolve=>window.__digitsHeld.push(()=>resolve(result)))}return result
 })
}
for(const type of ['one','all']) await run(`openSaved ${type} deletion between load and report publication`,async(page,context)=>{
 await seededHistory(page);await page.evaluate(()=>window.__holdAfterOrder=true);await page.getByRole('button',{name:'Open review'}).click();await waitHeld(page);const pending=await page.locator('body').innerText();neutral(pending);const peer=await context.newPage();await peer.goto(base);await deleteFromPeer(peer,type);const expected=await root(peer);await release(page);await page.getByRole('heading',{name:'Digits unavailable',exact:true}).waitFor();neutral(await page.locator('body').innerText());check(JSON.stringify(await root(peer))===JSON.stringify(expected),'missing publication resurrected target');return{pending,settled:await page.locator('body').innerText(),durable:expected,unchangedRoot:true};
},stagedFaults)
for(const at of [2,3,5]) for(const fail of [false,true]) await run(`report stage ${at} held ${fail?'error':'success'} then newer Replay`,async page=>{
 await seededHistory(page);await page.evaluate(stage=>window.__stage=stage,{at,fail,count:0});await page.getByRole('button',{name:'Open review'}).click();await waitHeld(page);neutral(await page.locator('body').innerText());const expected=await root(page);await page.getByRole('button',{name:'Practice again',exact:true}).click();await guide(page);await release(page);check(await page.getByRole('button',{name:'See example'}).isVisible(),'late report stage stole route');check(JSON.stringify(await root(page))===JSON.stringify(expected),'late report began new durable activity');return{guideRemains:true,unchangedRoot:true,heldStage:at};
},stagedFaults)
for(const fault of ['hold_read','hold_fail_read']) await run(`initial open ${fault} then unmount`,async page=>{
 await held(page,fault);await page.getByRole('button',{name:'Open Digits',exact:true}).click();await waitHeld(page);await page.getByRole('button',{name:'Back to library',exact:true}).click();await page.getByRole('button',{name:'Open Digits',exact:true}).waitFor();const expected=await root(page);await release(page);check(await page.getByRole('button',{name:'Open Digits',exact:true}).isVisible(),'initial callback stole route');check(JSON.stringify(await root(page))===JSON.stringify(expected),'initial callback changed root');await page.getByRole('button',{name:'Open Digits',exact:true}).click();await guide(page);return{libraryRemains:true,newOpenWorks:true};
},storageFaults)
function heldVoice(){const voice={voiceURI:'qa-local-en',lang:'en-US',localService:true};window.__speech=[];Object.defineProperty(window,'SpeechSynthesisUtterance',{configurable:true,value:class{constructor(text){this.text=text}}});Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{getVoices:()=>[voice],addEventListener(){},removeEventListener(){},cancel(){},speak(u){window.__speech.push(u);u.onstart?.()}}})}
for(const fail of [false,true]) await run(`voice sample held ${fail?'error':'success'} after visual switch`,async page=>{
 await page.getByRole('button',{name:'Open Digits',exact:true}).click();await page.getByRole('button',{name:'See example'}).click();await page.getByRole('button',{name:'Check understanding'}).click();await page.getByLabel('What counts as correct?').selectOption('yes');await page.getByRole('button',{name:'Check answer',exact:true}).click();await page.locator('summary').click();await page.getByLabel('Auditory digits with a verified local English browser voice').check();await page.getByRole('button',{name:'Play two sample digits'}).click();await page.waitForFunction(()=>window.__speech.length>0);await page.getByLabel('Visual digits',{exact:true}).check();await page.evaluate(fail=>{for(const u of window.__speech.splice(0)){if(fail)u.onerror?.();else u.onend?.()}},fail);await page.waitForTimeout(100);await page.evaluate(()=>window.__speech.splice(0).forEach(u=>u.onend?.()));await page.waitForTimeout(100);check(await page.getByLabel('I heard both sample digits clearly').count()===0,'stale sample approved mode');check(!await page.getByRole('alert').count(),'stale sample error leaked');return{visualRemains:true,staleSampleIgnored:true};
},heldVoice)
await browser.close();if(results.some(r=>r.status==='FAIL'))process.exitCode=1
