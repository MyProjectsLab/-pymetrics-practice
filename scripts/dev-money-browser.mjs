import { createRequire } from 'node:module'
const require=createRequire(import.meta.url)
const {chromium}=require('/Users/renzo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const browser=await chromium.launch({headless:true,executablePath:'/Users/renzo/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell'})
const context=await browser.newContext({viewport:{width:1280,height:800}}), page=await context.newPage()
const errors=[];page.on('pageerror',e=>errors.push(e.message))
try {
 await page.goto('http://127.0.0.1:4182/practice')
 await page.getByRole('button',{name:/Open Money Exchange 1/}).click()
 const title=async()=>page.locator('#money-title').textContent()
 console.log('title',await title())
 await page.getByRole('button',{name:'See an example'}).click()
 await page.getByRole('button',{name:'Next'}).click()
 await page.getByLabel('If you send $2').selectOption('6')
 await page.getByRole('button',{name:'Continue'}).click()
 await page.getByRole('button',{name:'Start'}).click()
 await page.getByRole('button',{name:'Next'}).click() // Ready to award
 await page.getByRole('heading',{name:'You receive $10'}).waitFor()
 await page.getByRole('button',{name:'Next'}).click() // Award to connecting
 await page.getByRole('heading',{name:'Partner connected'}).waitFor()
 await page.getByRole('button',{name:'Next'}).click() // Connected to rules
 await page.getByRole('button',{name:'Next'}).click() // Rules to return explanation
 await page.getByRole('heading',{name:'Choose an amount to send'}).waitFor()
 await page.getByRole('button',{name:'Next'}).click()
 await page.getByLabel('Amount to send in dollars').fill('5')
 await page.getByRole('button',{name:'Next'}).click()
 await page.getByRole('heading',{name:'Your partner has received the money'}).waitFor()
 await page.getByRole('button',{name:'Next'}).click()
 await page.getByText('The partner received $15.00 and returned').waitFor()
 await page.screenshot({path:'/private/tmp/money-exchange-1-final-allocation.png',fullPage:true})
 console.log('result stage',await title())
 await page.getByRole('button',{name:'Next'}).click()
 await page.getByRole('radio',{name:'10'}).check()
 await page.getByRole('button',{name:'Next'}).click()
 await page.getByRole('heading',{name:'Test Complete'}).waitFor()
 await page.getByRole('button',{name:'Next'}).click()
 await page.getByRole('heading',{name:'Your Money Exchange 1 result'}).waitFor()
 await page.evaluate(()=>window.dispatchEvent(new StorageEvent('storage',{
  key:'assessment-practice-money-exchange-1-authority-v1',
  newValue:JSON.stringify({type:'replaced',installationId:crypto.randomUUID()})
 })))
 if((await page.locator('#money-title').textContent())!=='Your Money Exchange 1 result')
  throw Error('old-installation notice withdrew current report')
 await page.screenshot({path:'/private/tmp/money-exchange-1-report.png',fullPage:true})
 await page.setViewportSize({width:320,height:700})
 await page.screenshot({path:'/private/tmp/money-exchange-1-report-320.png',fullPage:true})
 console.log('report',await page.locator('.money-ledger').innerText())
 await page.reload()
 await page.getByRole('button',{name:/Open Money Exchange 1/}).click()
 await page.getByRole('button',{name:'Local history'}).click()
 console.log('history',await page.locator('.money-history').innerText())
 console.log('errors',errors)
} catch(e){console.error('FAIL',e);console.log('title now',await page.locator('#money-title').textContent().catch(()=>'?'));console.log('errors',errors);process.exitCode=1}
finally{await browser.close()}
