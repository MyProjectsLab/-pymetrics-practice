import {chromium,options,setup} from './browser-support.mjs'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const browser=await chromium.launch(options),results=[];
let h;
try{h=await setup(browser);await h.page.emulateMedia({reducedMotion:'reduce',forcedColors:'active'});await h.start();await h.complete();const a=(await h.root()).attempts['A1.1'];assert.equal(a.status,'Completed');assert.equal(a.context.reducedMotion,true);assert.equal(a.context.highContrast,true);results.push({name:'reduced-motion-and-forced-colors',pass:true});console.log('PASS reduced-motion-and-forced-colors')}finally{await h?.context.close();await browser.close();fs.writeFileSync('/private/tmp/money2-accessibility-results.json',JSON.stringify(results,null,2))}
