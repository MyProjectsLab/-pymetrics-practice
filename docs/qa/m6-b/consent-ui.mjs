import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { writeFile } from 'node:fs/promises'
const { chromium } = createRequire(import.meta.url)('/Users/renzo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const browser = await chromium.launch({headless:true,executablePath:'/Users/renzo/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell'})
const p=await browser.newPage({viewport:{width:320,height:800}})
const requests=[]
await p.route('**/api/stop-analytics',async route=>{requests.push(route.request().postDataJSON());await route.fulfill({status:503})})
const out={}
try {
 await p.goto('http://127.0.0.1:5568');await p.getByRole('button',{name:'Open Stop',exact:true}).waitFor()
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
 const allow=p.getByRole('button',{name:'Allow optional analytics',exact:true})
 await allow.focus();await p.keyboard.press('Enter')
 assert(await p.getByText('Analytics consent is on for this page.',{exact:true}).isVisible())
 await p.keyboard.press('Tab');assert.equal(await p.evaluate(()=>document.activeElement.textContent),'Withdraw analytics consent')
 await p.keyboard.press('Enter')
 assert(await p.getByText('Analytics consent is off.',{exact:true}).isVisible())
 await allow.focus();await p.keyboard.press('Enter')
 await p.getByRole('button',{name:'Open Stop',exact:true}).click()
 await p.waitForTimeout(100)
 assert.equal(requests.length,1)
 await p.reload();await p.getByRole('button',{name:'Open Stop',exact:true}).waitFor()
 assert(await p.getByText('Analytics consent is off.',{exact:true}).isVisible())
 await p.getByRole('button',{name:'Allow optional analytics',exact:true}).click()
 await p.getByRole('button',{name:'Open Stop',exact:true}).click();await p.waitForTimeout(100)
 assert.equal(requests.length,2);assert.notEqual(requests[0].session_id,requests[1].session_id)
 await p.evaluate(()=>dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})))
 await p.getByRole('button',{name:'Back',exact:true}).click()
 assert(await p.getByText('Analytics consent is off.',{exact:true}).isVisible())
 out.passed=true;out.checks=['320px reflow','keyboard allow and withdrawal','page reload consent off','new random ID after reload/reconsent','bfcache-style pagehide consent reset']
} catch(e) {out.failure=String(e);process.exitCode=1}
finally {out.requests=requests;await writeFile('docs/qa/m6-b/consent-ui.json',JSON.stringify(out,null,2)+'\n');await browser.close()}
