// Reuse the exact previous repair drivers, with isolated output paths and local ports.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const dir='/private/tmp/stop-m5-f2c-regressions';await mkdir(dir,{recursive:true});
const evidence=fileURLToPath(new URL('.',import.meta.url));
const names=['matrix','admission-edges','onset','audit-f1','audit-boundaries','deletion-races','deletion-edges','initial-fixation-load','reload-evidence','regressions','supplement','pre-onset-browser','completion-browser','retest-completion'];
for(const name of names){let s=await readFile(new URL(`../repair-f2/${name}.mjs`,import.meta.url),'utf8');s=s.replaceAll('5337','5357').replaceAll('5338','5358').replaceAll('/private/tmp/stop-m5-f2-','/private/tmp/stop-m5-f2c-regression-');await writeFile(`${dir}/${name}.mjs`,s)}
const group=process.argv[2]??'fast',status=[];
async function run(name,extra={}){
 const label=name+(extra.DELIVERY?'-'+extra.DELIVERY:'');const env={...process.env,M5_FIXTURES:'/private/tmp/stop-m5-audit-53286f7/fixtures.json',...extra};
 const started=new Date().toISOString();let log='';
 const code=await new Promise(resolve=>{const child=spawn(process.execPath,[`${dir}/${name}.mjs`],{env});child.stdout.on('data',x=>log+=x);child.stderr.on('data',x=>log+=x);child.on('exit',resolve)});
 await writeFile(`${dir}/${label}.txt`,log);status.push({label,code,started,finished:new Date().toISOString()});await writeFile(evidence+`regression-${group}-status.json`,JSON.stringify(status,null,2));console.log(label,code);if(code!==0)process.exitCode=1;
}
if(group==='matrix')await Promise.all(['delivered','delayed','unavailable'].map(DELIVERY=>run('matrix',{DELIVERY})));
else if(group==='ordinary'){await run('pre-onset-browser',{M5_PREVIEW_URL:'http://127.0.0.1:5357/'});await run('completion-browser',{M5_PREVIEW_URL:'http://127.0.0.1:5358/'});await run('retest-completion')}
else for(const name of names.filter(x=>!['matrix','pre-onset-browser','completion-browser','retest-completion'].includes(x)))await run(name);
