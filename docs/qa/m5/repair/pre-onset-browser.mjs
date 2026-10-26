import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { writeFile } from 'node:fs/promises'
const require = createRequire(import.meta.url)
const { chromium } = require('/Users/renzo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const browser = await chromium.launch({ headless: true, executablePath: '/Users/renzo/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell' })
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } })
const errors=[]; page.on('pageerror', e => errors.push(String(e)))
const evidence = { browser: browser.version(), errors, checks: {} }
const click = name => page.getByRole('button',{name,exact:true}).click({timeout:30000})
const read = () => page.evaluate(async () => {
 const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('assessment-practice-stop',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})
 const tx=db.transaction(['installation','activity'],'readonly')
 const get=(store,key)=>new Promise((resolve,reject)=>{const r=key===undefined?tx.objectStore(store).getAll():tx.objectStore(store).get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})
 const [state,activity]=await Promise.all([get('installation','stop'),get('activity')]);db.close();return {state,activity}
})
try {
 await page.goto(process.env.M5_PREVIEW_URL || 'http://127.0.0.1:5198/')
 await click('Open Stop'); await click('See the rule'); await click('Try examples')
 for(let i=0;i<4;i++){if(i%2===0) await page.keyboard.press('Space'); await click('Check example'); await click(i===3?'Check my understanding':'Next example')}
 for(const [q,a] of [['What should you do when GO appears?','Press Space once.'],['What should you do when NO-GO appears?','Do nothing.'],['Can you respond after the symbol disappears?','Yes, until the response window closes.']]) await page.getByRole('group',{name:q,exact:true}).getByLabel(a,{exact:true}).check()
 await click('Check answers'); await click('Check your setup')
 await page.getByRole('checkbox',{name:'I’m using a laptop or desktop with a physical keyboard.'}).check()
 await click('Run input check'); await page.keyboard.press('Space'); await click('Continue to readiness'); await click('I’m ready')
 await page.getByRole('heading',{name:'Warm-up complete',exact:true}).waitFor({timeout:30000})
 await page.evaluate(()=>history.pushState({},'',location.href))
 await click('Start scored task')
 await page.waitForTimeout(200)
 await page.goBack()
 await page.getByRole('heading',{name:'This run cannot continue as a valid session'}).waitFor()
 await page.reload()
 await click('Stop history')
 await page.getByRole('button',{name:'Review attempt',exact:true}).waitFor()
 const before=await read(), draft=Object.values(before.state.drafts)[0]
 assert(draft);assert.equal(draft.realizedSequence.length,0)
 assert.equal(Object.keys(before.state.reservations).length,0)
 assert.equal(Object.keys(before.state.exposures).length,0)
 const forms=await page.evaluate(async()=>{
   const {StopLocalStore}=await import('/src/stop/storage.ts'),store=await StopLocalStore.open(),ids=[]
   for(let i=0;i<4;i++)ids.push((await store.reserve(`native-back-${i}`,'baseline',0))?.formId)
   store.close();return ids
 })
 assert.equal(new Set(forms).size,4);assert(forms.includes(draft.form.id));assert(forms.every(Boolean))
 await click('Review attempt')
 assert((await page.locator('body').innerText()).includes('not valid for comparison'))
 evidence.checks={nativeBack:true,reloaded:true,reviewable:true,scoredPresentations:0,availableForms:forms,retainedForm:draft.form.id}
 assert.deepEqual(errors,[]);evidence.pass=true
} catch(e){ evidence.pass = false; evidence.failure = String(e) }
finally { await writeFile(new URL('./pre-onset-browser.json', import.meta.url), JSON.stringify(evidence,null,2)); await browser.close() }
if (!evidence.pass) throw new Error(evidence.failure)
