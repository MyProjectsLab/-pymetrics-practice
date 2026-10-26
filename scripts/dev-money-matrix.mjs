import { createRequire } from 'node:module'
const require=createRequire(import.meta.url)
const {chromium}=require('/Users/renzo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const browser=await chromium.launch({headless:true,executablePath:'/Users/renzo/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell'})
const base='http://127.0.0.1:4182/practice', results=[]
async function run(name,fn) {const context=await browser.newContext({viewport:{width:1280,height:800}}),page=await context.newPage(),errors=[]
 page.setDefaultTimeout(7000)
 page.on('pageerror',e=>errors.push(e.message))
 try {await page.goto(base);await page.getByRole('button',{name:/Open Money Exchange 1/}).click();await fn(page,context);if(errors.length)throw Error(errors.join('; '));results.push([name,'PASS'])}
 catch(e){results.push([name,'FAIL',String(e)]);process.exitCode=1}finally{console.log(...results.at(-1));await Promise.race([context.close(),new Promise(resolve=>setTimeout(resolve,2000))])}}
async function transferStage(page){await page.getByRole('button',{name:'See an example'}).click();await page.getByRole('button',{name:'Next'}).click();await page.getByLabel('If you send $2').selectOption('6');await page.getByRole('button',{name:'Continue'}).click();await page.getByRole('button',{name:'Start'}).click();await page.getByRole('button',{name:'Next'}).click();await page.getByRole('button',{name:'Next'}).click();await page.getByRole('heading',{name:'Partner connected'}).waitFor();await page.getByRole('button',{name:'Next'}).click();await page.getByRole('button',{name:'Next'}).click();await page.getByRole('button',{name:'Next'}).click();await page.getByLabel('Amount to send in dollars').waitFor()}
async function readRoot(page){return page.evaluate(()=>new Promise((resolve,reject)=>{const o=indexedDB.open('assessment-practice-money-exchange-1-v1');o.onsuccess=()=>{const db=o.result,t=db.transaction('installation','readonly'),r=t.objectStore('installation').get('root');t.oncomplete=()=>{db.close();resolve(r.result)};t.onerror=()=>reject(t.error)};o.onerror=()=>reject(o.error)}))}
await run('prearm Restart consumes nothing',async page=>{await page.getByRole('button',{name:'See an example'}).click();await page.getByRole('button',{name:'Next'}).click();await page.getByLabel('If you send $2').selectOption('6');await page.getByRole('button',{name:'Continue'}).click();await page.getByRole('button',{name:'Start'}).click();await page.getByRole('button',{name:'Restart'}).click();const r=await readRoot(page);if(r.nextOrdinal!==1||Object.keys(r.runs).length)throw Error('prearm exposure')})
await run('armed Restart retains incomplete and Ready',async page=>{await transferStage(page);await page.getByLabel('Amount to send in dollars').fill('5');await page.getByRole('button',{name:'Next'}).click();await page.getByRole('heading',{name:'Your partner has received the money'}).waitFor();await page.getByRole('button',{name:'Restart'}).click();await page.getByRole('heading',{name:'Ready?'}).waitFor();const r=await readRoot(page),a=Object.values(r.runs)[0];if(a.status!=='incomplete'||a.ordinal!==1||a.events.map(e=>e.kind).join()!=='form_armed,transfer_committed,ended_incomplete')throw Error('restart journal')})
await run('zero transfer terminal',async page=>{await transferStage(page);await page.getByLabel('Amount to send in dollars').fill('0');await page.getByRole('button',{name:'Next'}).click();await page.getByRole('heading',{name:'Your partner has received the money'}).waitFor();await page.getByRole('button',{name:'Next'}).click();await page.getByRole('button',{name:'Next'}).click();await page.getByRole('button',{name:'Next'}).click();await page.getByRole('heading',{name:'Test Complete'}).waitFor();const r=await readRoot(page),a=Object.values(r.runs)[0];if(a.status!=='complete'||!a.events.some(e=>e.kind==='fairness_not_applicable')||a.report.rating!==null)throw Error('zero report')})
await run('return shown then Restart retains capture without rating',async page=>{await transferStage(page);await page.getByLabel('Amount to send in dollars').fill('5');await page.getByRole('button',{name:'Next'}).click();await page.getByRole('heading',{name:'Your partner has received the money'}).waitFor();await page.getByRole('button',{name:'Next'}).click();await page.getByRole('button',{name:'Next'}).waitFor({state:'visible'});await page.waitForFunction(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent?.trim()==='Next');return b&&!b.disabled});await page.getByRole('button',{name:'Restart'}).click();await page.getByRole('heading',{name:'Ready?'}).waitFor();const r=await readRoot(page),a=Object.values(r.runs)[0];if(a.status!=='incomplete'||a.exposure!=='captured_visible'||!a.events.some(e=>e.kind==='return_presented')||a.events.some(e=>e.kind==='fairness_committed'))throw Error('return restart '+JSON.stringify(a))})
await run('history delete and new form',async page=>{await transferStage(page);await page.getByLabel('Amount to send in dollars').fill('5');await page.getByRole('button',{name:'Next'}).click();await page.getByRole('heading',{name:'Your partner has received the money'}).waitFor();await page.getByRole('button',{name:'Restart'}).click();await page.getByRole('heading',{name:'Ready?'}).waitFor();await page.getByRole('button',{name:'Close'}).click();await page.getByRole('button',{name:/Open Money Exchange 1/}).click();await page.getByRole('button',{name:'Local history'}).click();await page.getByRole('button',{name:'Delete',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.money-history li').length===0);const r=await readRoot(page);if(Object.keys(r.runs).length||r.nextOrdinal!==2||Object.keys(r.tombstones).length!==1)throw Error('delete result '+JSON.stringify(r))})
await run('pagehide settles a transferred attempt before another arm',async page=>{
 await transferStage(page);await page.getByLabel('Amount to send in dollars').fill('5');await page.getByRole('button',{name:'Next'}).click()
 await page.getByRole('heading',{name:'Your partner has received the money'}).waitFor()
 await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide')))
 await page.getByRole('heading',{name:'Checking your exchange'}).waitFor()
 await page.getByRole('button',{name:'Check saved outcome'}).click()
 await page.getByRole('heading',{name:'Local Money Exchange 1 history'}).waitFor()
 const root=await readRoot(page),run=Object.values(root.runs)[0]
 if(run.status!=='incomplete'||run.events.at(-1).reason!=='page_lifecycle_changed'||root.nextOrdinal!==2)
  throw Error('pagehide settlement '+JSON.stringify(root))
})
await run('second-tab deletion withdraws an open report',async(page,context)=>{
 await transferStage(page);await page.getByLabel('Amount to send in dollars').fill('5');await page.getByRole('button',{name:'Next'}).click();
 await page.getByRole('heading',{name:'Your partner has received the money'}).waitFor();await page.getByRole('button',{name:'Next'}).click();
 await page.getByRole('button',{name:'Next'}).waitFor({state:'visible'});await page.waitForFunction(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent?.trim()==='Next');return b&&!b.disabled});
 await page.getByRole('button',{name:'Next'}).click();await page.getByRole('radio',{name:'5'}).check();await page.getByRole('button',{name:'Next'}).click();
 await page.getByRole('heading',{name:'Test Complete'}).waitFor();await page.getByRole('button',{name:'Next'}).click();
 await page.getByRole('heading',{name:'Your Money Exchange 1 result'}).waitFor();
 const other=await context.newPage();await other.goto(base);await other.getByRole('button',{name:/Open Money Exchange 1/}).click();
 await other.getByRole('button',{name:'Local history'}).click();await other.getByRole('button',{name:'Delete',exact:true}).click();
 await other.waitForFunction(()=>document.querySelectorAll('.money-history li').length===0);
 await page.getByRole('heading',{name:'Local Money Exchange 1 history'}).waitFor({timeout:3000});
 if((await page.locator('.money-ledger').count())!==0)throw Error('deleted report remains visible');
 const root=await readRoot(page);if(Object.keys(root.runs).length||Object.keys(root.tombstones).length!==1)throw Error('delete durable root');
 await other.close()
})
{
 const context=await browser.newContext({viewport:{width:1280,height:800}})
 await context.addInitScript(()=>{Object.defineProperty(window,'BroadcastChannel',{configurable:true,value:undefined})})
 const page=await context.newPage()
 page.setDefaultTimeout(7000)
 try {
  console.log('Delete all case: setup')
  await page.goto(base);await page.getByRole('button',{name:/Open Money Exchange 1/}).click()
  await transferStage(page);await page.getByRole('button',{name:'Restart'}).click()
  await page.getByRole('heading',{name:'Ready?'}).waitFor();await page.getByRole('button',{name:'Close'}).click()
  await page.getByRole('button',{name:/Open Money Exchange 1/}).click()
  await transferStage(page)
  console.log('Delete all case: active second attempt')
  const other=await context.newPage();await other.goto(base);await other.getByRole('button',{name:/Open Money Exchange 1/}).click()
  console.log('Delete all case: second tab',await other.locator('#money-title').textContent())
  await other.getByRole('button',{name:'Local history'}).click();await other.getByRole('button',{name:'Delete all Money Exchange 1 data'}).click()
  await other.getByText('No saved exchanges yet.').waitFor()
  await page.getByRole('heading',{name:'Local Money Exchange 1 history'}).waitFor({timeout:3000})
  const root=await readRoot(page)
  if(root.nextOrdinal!==1||Object.keys(root.runs).length)throw Error('old active attempt survived replacement')
  results.push(['Delete all withdraws active other tab without BroadcastChannel','PASS'])
 } catch(e) {results.push(['Delete all withdraws active other tab without BroadcastChannel','FAIL',String(e)]);process.exitCode=1}
 finally{console.log(...results.at(-1));await Promise.race([context.close(),new Promise(resolve=>setTimeout(resolve,2000))])}
}
for(const x of results)console.log(...x)
await browser.close()
