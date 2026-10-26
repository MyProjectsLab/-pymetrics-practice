import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { writeFile } from 'node:fs/promises'
const {chromium}=createRequire(import.meta.url)('/Users/renzo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const browser=await chromium.launch({headless:true,executablePath:'/Users/renzo/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell'})
const out={browser:browser.version(),cases:[],errors:[]}
const disclosure='This input method can change response timing. You can use it to learn the rule, but this beta will not compare the timing result with the standard physical-keyboard form.'
async function setup(p) {
 await p.getByRole('button',{name:'Open Stop',exact:true}).click()
 await p.getByRole('button',{name:'See the rule',exact:true}).click()
 await p.getByRole('button',{name:'Try examples',exact:true}).click()
 for(let i=0;i<4;i++) {
  if(i%2===0)await p.keyboard.press('Space')
  await p.getByRole('button',{name:'Check example',exact:true}).click()
  await p.getByRole('button',{name:i===3?'Check my understanding':'Next example',exact:true}).click()
 }
 for(const [q,a] of [['What should you do when GO appears?','Press Space once.'],['What should you do when NO-GO appears?','Do nothing.'],['Can you respond after the symbol disappears?','Yes, until the response window closes.']]) await p.getByRole('group',{name:q,exact:true}).getByLabel(a,{exact:true}).check()
 await p.getByRole('button',{name:'Check answers',exact:true}).click()
 await p.getByRole('button',{name:'Check your setup',exact:true}).click()
 assert(await p.getByText(disclosure,{exact:true}).isVisible())
}
async function ready(p) {
 await p.getByLabel('I’m using a laptop or desktop with a physical keyboard.',{exact:true}).check()
 await p.getByRole('button',{name:'Run input check',exact:true}).click()
 await p.keyboard.press('Space')
 await p.getByRole('button',{name:'Continue to readiness',exact:true}).click()
 assert(await p.getByText(disclosure,{exact:true}).isVisible())
}
try {
 const p=await browser.newPage({viewport:{width:1200,height:800}})
 p.on('pageerror',e=>out.errors.push(String(e)))
 await p.goto('http://127.0.0.1:5567');await p.getByRole('button',{name:'Open Stop',exact:true}).waitFor()
 await setup(p);await ready(p)
 await p.getByRole('button',{name:'I’m ready',exact:true}).click()
 await p.getByRole('button',{name:'Start scored task',exact:true}).waitFor({timeout:25000})
 await p.evaluate(()=>history.pushState({},'',location.href))
 await p.getByRole('button',{name:'Start scored task',exact:true}).click()
 await p.locator('.stop-presentation[data-presentation="GO"], .stop-presentation[data-presentation="NO_GO"]').waitFor({timeout:4000})
 await p.goBack()
 await p.getByRole('heading',{name:'This run cannot continue as a valid session',exact:true}).waitFor()
 await p.waitForTimeout(150)
 const state=await p.evaluate(async()=>{
  const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('assessment-practice-stop',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})
  const s=await new Promise(resolve=>{const r=db.transaction('installation','readonly').objectStore('installation').get('stop');r.onsuccess=()=>resolve(r.result)})
  db.close();return s
 })
 const draft=Object.values(state.drafts)[0]
 assert(draft);assert(draft.realizedSequence.length>=1 && draft.realizedSequence.length<=3)
 let phase;const presented=[];for(const e of draft.events){if(e.type==='trial_scheduled')phase=e.payload.trial.phase;if(e.type==='stimulus_presented'&&phase==='scored')presented.push(e.payload.stimulus)}
 assert.deepEqual(draft.realizedSequence,presented)
 assert.equal(state.exposures[draft.form.id].certainty,'confirmed')
 assert.equal(Object.keys(state.reservations).length,0)
 await p.reload();await p.getByRole('button',{name:'Stop history',exact:true}).click()
 await p.getByRole('button',{name:'Review attempt',exact:true}).waitFor()
 out.cases.push({kind:'production-normal-start-onset-exit-reload',state,historyText:await p.locator('body').innerText()})
 assert.deepEqual(out.errors,[]);out.pass=true
} catch(e){out.pass=false;out.failure=String(e);throw e}
finally{await browser.close();await writeFile(new URL('production-start.json',import.meta.url),JSON.stringify(out,null,2))}
