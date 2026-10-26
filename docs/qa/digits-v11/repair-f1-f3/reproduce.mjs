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
  finally { await context.close(); console.log(name, results.at(-1).status); await writeFile(new URL(process.env.CASE_FILTER ? `./browser-${process.env.CASE_FILTER.replaceAll(' ', '-')}.json` : './independent-browser.json', import.meta.url), JSON.stringify(results, null, 2) + '\n') }
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
await run('independent: undeclared clipboard paste report label',async(page,context)=>{
 await context.grantPermissions(['clipboard-read','clipboard-write']);await prepare(page);await observe(page);await page.getByRole('button',{name:'Start scored Digits'}).click();await entry(page);const target=await page.evaluate(()=>window.__digitsObserved.join(''));await page.evaluate(t=>navigator.clipboard.writeText(t),target);await page.locator('#digits-response').focus();await page.keyboard.press('Meta+V');await page.waitForTimeout(100);const accepted=await page.locator('#digits-response').inputValue();await page.getByRole('button',{name:'Submit',exact:true}).click();await page.getByRole('button',{name:'Next',exact:true}).waitFor();let durable=await root(page);const first=Object.values(durable.attempts)[0];
 for(let i=0;i<3;i++){await page.getByRole('button',{name:'Next',exact:true}).click();await answer(page,false);}
 await page.getByText('Saved in this browser',{exact:true}).waitFor();const body=await page.locator('body').innerText();durable=await root(page);await writeFile(new URL('./paste-root.json',import.meta.url),JSON.stringify(durable,null,2));await writeFile(new URL('./paste-report.txt',import.meta.url),body);return {target,accepted,assisted:first.snapshot.state.closed[0].assistedEntry,reportAssisted:Object.values(durable.attempts)[0].snapshot.review.assistedEntry,visibleAssistedLabel:/assisted/i.test(body),body};
});
await run('independent: committed arm delivery then blur and retry',async page=>{await prepare(page);await observe(page);await page.evaluate(()=>window.__digitsFault='hold_arm');await page.getByRole('button',{name:'Start scored Digits'}).click();await page.waitForFunction(()=>window.__digitsHeld.length>0);const committed=await root(page);await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.getByRole('button',{name:'Start scored Digits'}).waitFor();await page.evaluate(()=>window.__digitsHeld.splice(0).forEach(f=>f()));await page.getByRole('button',{name:'Start scored Digits'}).click();await entry(page);await page.getByRole('button',{name:'Skip',exact:true}).click();await page.getByRole('button',{name:'Next',exact:true}).waitFor();const after=await root(page);await writeFile(new URL('./arm-blur-root.json',import.meta.url),JSON.stringify(after,null,2));return {beforeCounter:committed.counters.visual,afterCounter:after.counters.visual,beforeSession:Object.keys(committed.attempts)[0],afterSessions:Object.keys(after.attempts),state:Object.values(after.attempts)[0].snapshot.state.phase,invalidations:Object.values(after.attempts)[0].snapshot.state.events.filter(e=>e.type==='invalidated')};},storageFaults);
await run('independent: deletion after confirmed successor onset preserves review',async(page,context)=>{await prepare(page);await observe(page);await page.getByRole('button',{name:'Start scored Digits'}).click();await answer(page,false);await page.getByRole('button',{name:'Next',exact:true}).waitFor();await observe(page);await page.getByRole('button',{name:'Next',exact:true}).click();await page.waitForFunction(()=>window.__digitsObserved.length===1);await page.waitForTimeout(100);const peer=await context.newPage();await peer.goto(base);const deletion=await deleteFromPeer(peer,'one');await page.getByRole('heading',{name:'Digits attempt removed'}).waitFor();const body=await page.locator('body').innerText();const durable=await root(page);await writeFile(new URL('./deletion-after-onset.json',import.meta.url),JSON.stringify({body,durable},null,2));return {deletion,body,observed:await page.evaluate(()=>window.__digitsObserved),attempts:Object.keys(durable.attempts).length};});
await browser.close();
