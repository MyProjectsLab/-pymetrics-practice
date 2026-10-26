import { createRequire } from 'node:module'
import { writeFile } from 'node:fs/promises'
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
async function prepare(page, { keypad = false, auditory = false } = {}) {
  await page.getByRole('button', { name: 'Open Digits', exact: true }).click()
  await page.getByRole('button', { name: 'See example', exact: true }).click()
  await page.getByRole('button', { name: 'Check understanding', exact: true }).click()
  await page.getByLabel('What counts as correct?').selectOption('yes')
  await page.getByRole('button', { name: 'Check answer', exact: true }).click()
  await page.getByLabel('Try entering 4270 (untimed)').fill('4270')
  if (keypad || auditory) await page.locator('summary').click()
  if (keypad) await page.getByLabel('On-screen numeric keypad').check()
  if (auditory) { await page.getByLabel('Auditory digits with a verified local English browser voice').check()
    await page.getByRole('button', { name: 'Play two sample digits' }).click()
    await page.getByLabel('I heard both sample digits clearly').check() }
  await page.getByRole('button', { name: 'Continue to readiness' }).click()
}
async function observe(page) {
  await page.evaluate(() => {
    window.__digitsObserved = []
    window.__digitsOrder = []
    window.__digitsObserver?.disconnect()
    window.__digitsObserver = new MutationObserver(records => {
      for (const record of records) {
        if (!(record.target instanceof Element) || !record.target.matches('.digits-stimulus')) continue
        for (const added of record.addedNodes) if (/^[0-9]$/.test(added.textContent ?? ''))
          { window.__digitsObserved.push(added.textContent); window.__digitsOrder?.push({ type: 'digit_dom_write', value: added.textContent, wallMs: Date.now(), atMs: performance.now() }) }
      }
    })
    window.__digitsObserver.observe(document.body, { childList: true, subtree: true })
  })
}
async function entry(page) { await page.getByRole('button', { name: 'Submit', exact: true }).waitFor()
  await page.waitForFunction(() => !document.querySelector('.digits-entry button')?.disabled, null, { timeout: 25000 }) }
async function answer(page, correct, { keypad = false, enter = false } = {}) {
  await entry(page)
  const target = await page.evaluate(() => window.__digitsObserved.join(''))
  if (correct) {
    if (keypad) for (const digit of target) await page.locator('.digits-keypad').getByRole('button', { name: digit, exact: true }).click()
    else await page.locator('#digits-response').pressSequentially(target)
  }
  if (enter) await page.locator('#digits-response').press('Enter')
  else await page.getByRole('button', { name: correct ? 'Submit' : 'Skip', exact: true }).click()
  return target
}
async function run(name, test, init = null) {
  if (process.env.CASE_FILTER && !name.includes(process.env.CASE_FILTER)) return
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  if (init) await context.addInitScript(init)
  const page = await context.newPage(), errors = []
  page.on('pageerror', error => errors.push(error.message))
  try { await page.goto(base); const detail = await test(page, context); check(!errors.length, `Page errors: ${errors.join('; ')}`); results.push({ name, status: 'PASS', detail }) }
  catch (error) { results.push({ name, status: 'FAIL', error: String(error), body: (await page.locator('body').innerText()).slice(-3500) }) }
  finally { await context.close(); console.log(name, results.at(-1).status); await writeFile(new URL(process.env.CASE_FILTER ? `./browser-${process.env.CASE_FILTER.replaceAll(' ', '-')}.json` : './browser-navigation-final.json', import.meta.url), JSON.stringify(results, null, 2) + '\n') }
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
async function settledReport(page) {
  await page.getByRole('heading', { name: 'Digits report', exact: true }).waitFor()
  await page.waitForFunction(() => /Review-only record saved in this browser|Saved in this browser/.test(document.body.innerText))
}
async function partialSaved(page){await prepare(page);await observe(page);await page.getByRole('button',{name:'Start scored Digits'}).click();await answer(page,false);await page.getByRole('button',{name:'End and review'}).click();await settledReport(page);}

async function release(page) { await page.evaluate(()=>window.__digitsHeld.splice(0).forEach(f=>f())); await page.waitForTimeout(150) }
async function held(page,fault) { await page.evaluate(f=>window.__digitsFault=f,fault) }
async function waitHeld(page) { await page.waitForFunction(()=>window.__digitsHeld.length>0) }
async function guide(page) { await page.getByRole('button',{name:'See example',exact:true}).waitFor() }
async function history(page) { await page.getByRole('button',{name:'Local history',exact:true}).click();await page.getByRole('heading',{name:'Digits local history',exact:true}).waitFor() }
function neutral(body) { check(!body.includes('Maximum correctly recalled length')&&!body.includes('trials began presentation')&&!body.includes('Saved in this browser')&&!body.includes('Retry saving'),'pending destination leaked previous report authority') }
for(const type of ['one','all']) await run(`F4 retired ${type}: pending history detached and fresh current installation`,async(page,context)=>{
 await partialSaved(page);const peer=await context.newPage();await peer.goto(base);await deleteFromPeer(peer,type);await page.getByRole('heading',{name:'Digits attempt removed',exact:true}).waitFor();const expected=await root(peer);
 await held(page,'hold_read');await page.getByRole('button',{name:'Local history',exact:true}).click();await waitHeld(page);const pending=await page.locator('body').innerText();neutral(pending);check(pending.includes('Loading Digits local history'),'no synchronous pending destination');await release(page);await page.getByRole('heading',{name:'Digits local history',exact:true}).waitFor();check(JSON.stringify(await root(peer))===JSON.stringify(expected),'history changed removed root');check(await page.getByRole('button',{name:'Open review'}).count()===0,'removed attempt listed');return{pending,settled:await page.locator('body').innerText(),unchangedRoot:true};
},storageFaults)
for(const fault of ['hold_read','hold_fail_read']) for(const type of ['one','all']) await run(`F5 retired ${type} history ${fault} then newer Replay`,async(page,context)=>{
 await partialSaved(page);const peer=await context.newPage();await peer.goto(base);await deleteFromPeer(peer,type);await page.getByRole('heading',{name:'Digits attempt removed',exact:true}).waitFor();const expected=await root(peer);await held(page,fault);await page.getByRole('button',{name:'Local history',exact:true}).click();await waitHeld(page);neutral(await page.locator('body').innerText());await page.getByRole('button',{name:'Practice again',exact:true}).click();await guide(page);await release(page);check(await page.getByRole('button',{name:'See example'}).isVisible(),'stale history stole route');check(JSON.stringify(await root(peer))===JSON.stringify(expected),'stale history changed root');return{guideRemains:true,unchangedRoot:true};
},storageFaults)
for(const fault of ['hold_read','hold_fail_read']) await run(`F5 openSaved ${fault} then newer Replay`,async page=>{
 await partialSaved(page);await history(page);const expected=await root(page);await held(page,fault);await page.getByRole('button',{name:'Open review'}).click();await waitHeld(page);neutral(await page.locator('body').innerText());await page.getByRole('button',{name:'Practice again',exact:true}).click();await guide(page);await release(page);check(await page.getByRole('button',{name:'See example'}).isVisible(),'stale review stole route');check(JSON.stringify(await root(page))===JSON.stringify(expected),'stale review appended activity');return{guideRemains:true,unchangedRoot:true};
},storageFaults)
for(const fault of ['hold_read','hold_fail_read']) await run(`report poll ${fault} then newer Replay`,async page=>{
 await partialSaved(page);const expected=await root(page);await held(page,fault);await waitHeld(page);await page.getByRole('button',{name:'Replay Digits',exact:true}).click();await guide(page);await release(page);check(await page.getByRole('button',{name:'See example'}).isVisible(),'stale poll stole route');check(JSON.stringify(await root(page))===JSON.stringify(expected),'poll changed root');return{guideRemains:true,unchangedRoot:true};
},storageFaults)
for(const fault of ['hold_read','hold_fail_read']) await run(`Replay current-store ${fault} then newer History`,async page=>{
 await partialSaved(page);const expected=await root(page);await held(page,fault);await page.getByRole('button',{name:'Replay Digits',exact:true}).click();await waitHeld(page);await page.getByRole('button',{name:'Local history',exact:true}).click();await page.getByRole('heading',{name:'Digits local history',exact:true}).waitFor();await release(page);check(await page.getByRole('heading',{name:'Digits local history',exact:true}).isVisible(),'stale Replay stole route');check(JSON.stringify(await root(page))===JSON.stringify(expected),'Replay changed root');await page.getByRole('button',{name:'Open review'}).click();await settledReport(page);return{historyRemains:true,newHandleReviewWorks:true};
},storageFaults)
for(const type of ['one','all']) for(const fault of ['hold_other','hold_fail_other']) await run(`stale delete ${type} ${fault} then newer Replay`,async page=>{
 await partialSaved(page);await history(page);await held(page,fault);await page.getByRole('button',{name:type==='one'?'Delete this attempt':'Delete all Digits data',exact:true}).click();await waitHeld(page);const expected=await root(page);await page.getByRole('button',{name:'Practice again',exact:true}).click();await guide(page);await release(page);check(await page.getByRole('button',{name:'See example'}).isVisible(),'stale delete completion stole route');check(JSON.stringify(await root(page))===JSON.stringify(expected),'delete callback resurrected root');await history(page);check(await page.getByRole('button',{name:'Open review'}).count()===0,'new active alias closed or retired item returned');return{guideRemains:true,newHandleHistoryWorks:true,unchangedRoot:true};
},storageFaults)
for(const fault of ['hold_read','hold_fail_read']) await run(`history refresh ${fault} then Library`,async page=>{
 await partialSaved(page);await history(page);const expected=await root(page);await held(page,fault);await waitHeld(page);await page.getByRole('button',{name:'Back to library',exact:true}).click();await page.getByRole('button',{name:'Open Digits',exact:true}).waitFor();await release(page);check(await page.getByRole('button',{name:'Open Digits',exact:true}).isVisible(),'stale history refresh stole Library');check(JSON.stringify(await root(page))===JSON.stringify(expected),'refresh changed root');return{libraryRemains:true,unchangedRoot:true};
},storageFaults)
for(const type of ['one','all']) await run(`current delete ${type}: current History or Replay usable`,async page=>{
 await partialSaved(page);await history(page);await page.getByRole('button',{name:type==='one'?'Delete this attempt':'Delete all Digits data',exact:true}).click();if(type==='all'){await guide(page);await history(page)}else await page.getByRole('heading',{name:'Digits local history',exact:true}).waitFor();const durable=await root(page);check(Object.keys(durable.attempts).length===0,'deletion incomplete');check(await page.getByRole('button',{name:'Open review'}).count()===0,'deletion stale history');return{body:await page.locator('body').innerText(),durable};
},storageFaults)
await browser.close();if(results.some(r=>r.status==='FAIL')) process.exitCode=1
