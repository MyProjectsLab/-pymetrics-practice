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
 for(const kind of ['access','warmup-missing','warmup-hidden','scored-missing','scored-save-failure','lease-before-arm','lease-before-onset'].filter(kind => !process.env.CASE || kind === process.env.CASE)) {
  const ctx=await browser.newContext({viewport:{width:1200,height:800}}),p=await ctx.newPage()
  p.on('pageerror',e=>out.errors.push({kind,error:String(e)}))
  await p.goto('http://127.0.0.1:5566');await p.getByRole('button',{name:'Open Stop',exact:true}).waitFor()
  await setup(p)
  if(kind==='access') {
   await p.getByLabel('I’m using a laptop or desktop with a physical keyboard.',{exact:true}).check()
   await p.getByLabel('My input or screen-reader setup adds delay to timed responses.',{exact:true}).focus()
   await p.keyboard.press('Space')
   assert(await p.getByRole('button',{name:'Run input check',exact:true}).isDisabled())
   assert(await p.getByRole('button',{name:'Continue to readiness',exact:true}).isDisabled())
   await p.setViewportSize({width:320,height:800})
   const overflow=await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth)
   assert(!overflow)
   await p.screenshot({path:decodeURIComponent(new URL('assistive-input-320.png',import.meta.url).pathname),fullPage:true})
   await p.getByRole('button',{name:'Back',exact:true}).focus();await p.keyboard.press('Enter')
   await p.getByRole('heading',{name:'One rule, two actions',exact:true}).waitFor()
   out.cases.push({kind,disclosure:true,timedBlocked:true,keyboardBackToRule:true,overflow});await ctx.close();continue
  }
  await ready(p)
  await p.evaluate(async()=>{
   const S=await import('/src/stop/storage.ts');window.__store=S.stopLocalStore()
   const wall=Date.now;Date.now=()=>window.__nowOverride ?? wall()
   const raf=window.requestAnimationFrame.bind(window),cancel=window.cancelAnimationFrame.bind(window)
   window.__frames=[];window.__hold=false
   window.requestAnimationFrame=cb=>{
    if(window.__hold && new Error().stack.includes('/src/stop/Journey.tsx')) {window.__frames.push(cb);return -123}
    return raf(cb)
   }
   window.cancelAnimationFrame=id=>{if(id!==-123)cancel(id)}
  })
  if(kind.startsWith('warmup'))await p.evaluate(()=>{window.__hold=true})
  await p.getByRole('button',{name:'I’m ready',exact:true}).click()
  if(kind==='warmup-hidden')await p.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'hidden'});document.dispatchEvent(new Event('visibilitychange'))})
  if(!kind.startsWith('warmup')) {
   await p.getByRole('button',{name:'Start scored task',exact:true}).waitFor({timeout:25000})
   if(kind.startsWith('scored'))await p.evaluate(async fail=>{
    window.__hold=true
    if(fail){const S=await import('/src/stop/storage.ts');S.stopLocalStore().saveDraft=async()=>{throw Error('injected draft write failure')}}
   },kind==='scored-save-failure')
   if(kind.startsWith('lease'))await p.evaluate(async kind=>{
    const S=await import('/src/stop/storage.ts'),s=S.stopLocalStore(),reserve=s.reserve.bind(s),arm=s.arm.bind(s)
    s.reserve=async(...args)=>{const claim=await reserve(...args);window.__expiry=claim.expiresAtMs;return claim}
    s.arm=async(...args)=>{
     if(kind==='lease-before-arm')window.__nowOverride=window.__expiry
     await arm(...args)
     if(kind==='lease-before-onset')window.__nowOverride=window.__expiry
    }
   },kind)
   await p.getByRole('button',{name:'Start scored task',exact:true}).click()
  }
  const heading=kind.startsWith('lease')?'Form reservation expired':kind==='warmup-hidden'?'This run cannot continue as a valid session':'Stop could not finish this session'
  await p.getByRole('heading',{name:heading,exact:true}).waitFor({timeout:6000})
  const capture=()=>p.evaluate(async()=>{
   const R=await import('/src/stop/run.ts')
   return {draft:R.developmentDrafts().at(-1),state:await window.__store.read(),held:window.__frames.length,presentation:document.querySelector('.stop-presentation')?.innerHTML,text:document.body.innerText}
  })
  const before=await capture()
  await p.evaluate(()=>{for(const cb of window.__frames)cb(performance.now());window.__hold=false})
  await p.waitForTimeout(150)
  const after=await capture()
  assert.deepEqual(after.draft,before.draft);assert.equal(after.presentation,'')
  assert.deepEqual(after.draft.realizedSequence,[])
  const form=after.draft.form?.id
  if(kind==='scored-save-failure') {assert.equal(after.state.exposures[form].certainty,'uncertain');assert(after.state.reservations[after.draft.sessionId].armed)}
  else {assert.equal(Object.keys(after.state.exposures).length,0);assert.equal(Object.keys(after.state.reservations).length,0)}
  await p.screenshot({path:decodeURIComponent(new URL(`${kind}.png`,import.meta.url).pathname)})
  await p.getByRole('button',{name:kind.startsWith('lease')?'Restart Stop':'Restart with a new form',exact:true}).focus()
  await p.keyboard.press('Enter')
  await p.getByRole('heading',{name:'Learn the Stop task',exact:true}).waitFor()
  out.cases.push({kind,before,after,keyboardRestart:true})
  await ctx.close()
 }
 assert.deepEqual(out.errors,[]);out.pass=true
} catch(e){out.pass=false;out.failure=String(e);throw e}
finally{await browser.close();await writeFile(new URL(process.env.CASE ? `journey-${process.env.CASE}.json` : 'journey-browser.json',import.meta.url),JSON.stringify(out,null,2))}
