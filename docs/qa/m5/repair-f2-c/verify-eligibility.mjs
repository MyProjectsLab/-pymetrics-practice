import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';import{createRequire}from'node:module';
const {chromium}=createRequire(import.meta.url)('/Users/renzo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const b=await chromium.launch({headless:true,executablePath:'/Users/renzo/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell'});
const out=[];
try{const p=await b.newPage();await p.goto('http://127.0.0.1:5357/');await p.getByRole('button',{name:'Open Stop',exact:true}).waitFor();
 const data=JSON.parse(await readFile(new URL('liveness.json',import.meta.url)));
 for(const row of data.cases){const raw=JSON.parse(await readFile(`/private/tmp/stop-m5-f2c-${row.label}.json`));
  const admitted=await p.evaluate(async state=>{const S=await import('/src/stop/storage.ts');const checked=S.inspectLocalState(state);return{chains:checked.chains.length,active:!!checked.activeChain,invalid:checked.invalid.map(d=>d.sessionId),rejected:checked.rejected}},raw.after.state);
  assert.equal(admitted.chains,row.label.endsWith('unrelated')?1:0);assert.equal(admitted.active,row.label.endsWith('unrelated'));if(!row.label.endsWith('all'))assert(admitted.invalid.includes(raw.claim.sessionId));out.push({case:row.label,...admitted});
 }
}finally{await b.close();await writeFile(new URL('eligibility.json',import.meta.url),JSON.stringify(out,null,2))}
