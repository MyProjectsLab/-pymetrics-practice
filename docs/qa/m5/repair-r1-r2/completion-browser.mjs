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
 await page.goto(process.env.M5_PREVIEW_URL || 'http://127.0.0.1:5196/')
 await click('Open Stop'); await click('See the rule'); await click('Try examples')
 for(let i=0;i<4;i++){if(i%2===0) await page.keyboard.press('Space'); await click('Check example'); await click(i===3?'Check my understanding':'Next example')}
 for(const [q,a] of [['What should you do when GO appears?','Press Space once.'],['What should you do when NO-GO appears?','Do nothing.'],['Can you respond after the symbol disappears?','Yes, until the response window closes.']]) await page.getByRole('group',{name:q,exact:true}).getByLabel(a,{exact:true}).check()
 await click('Check answers'); await click('Check your setup')
 await page.getByRole('checkbox',{name:'I’m using a laptop or desktop with a physical keyboard.'}).check()
 await click('Run input check'); await page.keyboard.press('Space'); await click('Continue to readiness'); await click('I’m ready')
 await page.getByRole('heading',{name:'Warm-up complete',exact:true}).waitFor({timeout:30000})
 await click('Start scored task')
 await page.getByRole('heading',{name:'Stop complete',exact:true}).waitFor({timeout:230000})
 const before = await read()
 const results=Object.values(before.state.results)
 evidence.checks.completion = { count: results.length, formId: results[0]?.form?.id,
   eventCount: results[0]?.events?.length, exposure: before.state.exposures[results[0]?.form?.id]?.certainty }
 assert.equal(results.length,1)
 const result=results[0]; assert.equal(result.storageMode,'persistent_local'); assert.equal(result.events.at(-1).type,'protection_ended')
 assert.equal(before.state.exposures[result.form.id].certainty,'confirmed')
 await click('View my result'); await page.getByRole('heading',{name:'Your Stop practice result'}).waitFor()
 await page.waitForTimeout(100)
 const activity=(await read()).activity
 assert(activity.some(e=>e.type==='report_viewed' && e.sessionId===result.sessionId))
 await page.reload(); await page.getByRole('button',{name:'Stop history'}).waitFor()
 await click('Stop history'); await page.getByRole('heading',{name:'Stop history'}).waitFor()
 assert((await page.locator('body').innerText()).includes(`Form ${result.form.id}`))
 const reloaded=await read();assert.deepEqual(reloaded.state.results[result.sessionId],result)
 await click('Open original report'); await page.getByRole('heading',{name:'Your Stop practice result'}).waitFor()
 await click('Back to library')
 await click('Stop history')
 await click('Delete this result')
 assert((await page.locator('body').innerText()).includes('A minimal form-exposure marker will remain'))
 await click('Delete this result')
 const after = await read()
 assert.equal(Object.keys(after.state.results).length,0)
 assert.equal(after.state.exposures[result.form.id].deleted,true)
 assert.deepEqual(errors,[])
 const scoredStart=result.events.findIndex(e=>e.type==='trial_scheduled'&&e.payload.trial.phase==='scored')
 const scored=result.events.slice(scoredStart)
 const resolutions=scored.filter(e=>e.type==='trial_resolved')
 assert.equal(resolutions.length,80)
 assert.equal(resolutions.filter(e=>e.payload.outcome.kind==='miss').length,60)
 assert.equal(resolutions.filter(e=>e.payload.outcome.kind==='correct_withhold').length,20)
 assert.equal(scored.filter(e=>e.type==='timing_anomaly').length,0)
 const offsets=scored.filter(e=>e.type==='stimulus_removed').map(e=>e.payload.visibleDurationMs)
 const final=scored.find(e=>e.type==='batch_finished').timestampMs-Math.max(resolutions.at(-1).payload.resolvedAtMs,scored.filter(e=>e.type==='stimulus_removed').at(-1).timestampMs)
 evidence.checks.timing={visibilityMin:Math.min(...offsets),visibilityMax:Math.max(...offsets),finalFixationMs:final,counts:result.summarySnapshot.counts}
 await writeFile(new URL('./completion-result.json',import.meta.url),JSON.stringify(result,null,2))
 evidence.checks.reportViewed = true
 evidence.checks.reloaded = true
 evidence.checks.individualDeleted = true
 evidence.checks.markerRetained = true
 evidence.pass = true
} catch(e){ evidence.pass = false; evidence.failure = String(e) }
finally { await writeFile(new URL('./completion-browser.json', import.meta.url), JSON.stringify(evidence,null,2)); await browser.close() }
if (!evidence.pass) throw new Error(evidence.failure)
