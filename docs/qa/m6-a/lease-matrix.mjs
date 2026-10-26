import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { writeFile } from 'node:fs/promises'
const { chromium } = createRequire(import.meta.url)('/Users/renzo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const browser = await chromium.launch({headless:true, executablePath:'/Users/renzo/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell'})
const out = {browser:browser.version(),cases:[],errors:[]}, start = 2000000000000
try {
 for (const family of ['baseline','replay']) for (const kind of ['before','exact','after','armed','confirmed','uncertain-marker','confirmed-marker','armed-no-marker','unknown-armed','legacy','race','arm-first','reclaim-first']) {
  const ctx = await browser.newContext(), a = await ctx.newPage(), b = await ctx.newPage()
  for (const p of [a,b]) {
   p.on('pageerror',e=>out.errors.push(String(e)))
   await p.goto('http://127.0.0.1:5566'); await p.getByRole('button',{name:'Open Stop',exact:true}).waitFor()
  }
  const first = await a.evaluate(async ({family,start,kind})=>{
   const S=await import('/src/stop/storage.ts'); Date.now=()=>start; window.store=await S.StopLocalStore.open()
   const claim=await store.reserve('old',family,0)
   if(['armed','confirmed','arm-first'].includes(kind)) await store.arm('old',claim.formId,'standard')
   if(kind==='confirmed') await store.confirm('old',claim.formId,new Date().toISOString(),null)
   if(['uncertain-marker','confirmed-marker'].includes(kind)) await store.mutate(s=>{s.exposures[claim.formId]={formId:claim.formId,sessionId:'old',certainty:kind==='uncertain-marker'?'uncertain':'confirmed',visualProfile:'standard',deleted:false,exposedAtWall:new Date().toISOString()}})
   if(kind==='armed-no-marker') await store.mutate(s=>{s.reservations.old.armed=true})
   if(kind==='unknown-armed') await store.mutate(s=>{delete s.reservations.old.armed})
   if(kind==='legacy') await store.mutate(s=>{s.reservations.old.expiresAtMs=null;delete s.reservations.old.leaseVersion})
   return claim
  },{family,start,kind})
  const now = start+(kind==='before'?1799999:kind==='after'?1800001:1800000)
  const allocate = ()=>b.evaluate(async ({family,now})=>{Date.now=()=>now; const S=await import('/src/stop/storage.ts'); window.store=await S.StopLocalStore.open(); return store.reserve('new',family,0)},{family,now})
  const arm = ()=>a.evaluate(async({formId,now})=>{Date.now=()=>now; try {await store.arm('old',formId,'standard');return 'armed'}catch(e){return e.constructor.name}},{formId:first.formId,now:kind==='race'?start+1799999:now})
  let second, stale
  if(kind==='race') [stale,second]=await Promise.all([arm(),allocate()])
  else {second=await allocate(); if(['exact','after','reclaim-first'].includes(kind)) stale=await arm()}
  let state=await b.evaluate(()=>store.read())
  const safe=['before','armed','confirmed','uncertain-marker','confirmed-marker','armed-no-marker','unknown-armed','legacy','arm-first'].includes(kind)
  if(safe) assert.notEqual(second.formId,first.formId,kind)
  else if(kind==='race') assert.equal(second.formId===first.formId,stale!=='armed')
  else {assert.equal(second.formId,first.formId); assert.equal(stale,'FormClaimExpiredError')}
  if(kind==='legacy') {
   assert.equal(state.reservations.old.expiresAtMs,now+1800000)
   const originalExpiry=state.reservations.old.expiresAtMs
   await b.evaluate(async now=>{Date.now=()=>now;await store.mutate(()=>{})},now+1)
   assert.equal((await b.evaluate(()=>store.read())).reservations.old.expiresAtMs,originalExpiry)
   const reclaimed=await b.evaluate(async now=>{Date.now=()=>now;return store.reserve('legacy-reclaimed','baseline',0)},originalExpiry)
   // The family used for the additional claim is irrelevant to removal of the old lease.
   state=await b.evaluate(()=>store.read());assert(!state.reservations.old);assert(reclaimed)
  }
  out.cases.push({family,kind,first,second,stale,state})
  await ctx.close()
 }
 assert.deepEqual(out.errors,[]);out.pass=true
} catch(e) {out.pass=false;out.failure=String(e);throw e}
finally {await browser.close();await writeFile(new URL('lease-matrix.json',import.meta.url),JSON.stringify(out,null,2))}
