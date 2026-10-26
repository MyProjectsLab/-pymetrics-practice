from pathlib import Path
import json,hashlib,subprocess,shutil
root=Path.cwd();qa=root/'docs/qa/money-exchange-2-v1/grouped-repair';e=qa/'evidence'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
old=json.loads((e/'checkpoint-source-sha256.json').read_text());sources={p:sha(root/p) for p in old}
(e/'final-source-sha256.json').write_text(json.dumps(sources,indent=2)+'\n')
frozen=json.loads((e/'frozen-identities.json').read_text());extra={'path':'docs/specifications/ASSESSMENT_PRACTICE_MONEY_EXCHANGE_2_STORAGE_V2_1_RETIREMENT_ADDENDUM_DRAFT.md','sha256':'2325bdb283cb2e8fe580f37a5fe4ac51b7d8e0e2c5c5f3e8603cf7a14cf95d57','matches':True}
if not any(x['path']==extra['path'] for x in frozen):frozen.append(extra)
for item in frozen:assert sha(root/item['path'])==item['sha256'],item['path']
(e/'frozen-identities.json').write_text(json.dumps(frozen,indent=2)+'\n')
legacy=hashlib.sha256(subprocess.check_output(['git','show','a3fd628528aa1a81eac0620095cafebbfff65ea7:src/money-exchange-2/core.ts'])).hexdigest();assert legacy==sources['src/money-exchange-2/legacy-core.ts']
changed=[p for p in old if old[p]!=sources[p]];assert sorted(changed)==['src/money-exchange-2/core.ts','src/money-exchange-2/storage-v2.test.ts'],changed
for label,name in [('focused','focused'),('build','build'),('lint','lint'),('v21-native','native'),('v2-native','v2native'),('deletion','deletion'),('storage','storage')]:shutil.copyfile(Path('/private/tmp')/f'money2-v21-{name}.log',e/f'final-{label}.log')
checks={}
for suite,n in [('v21',26),('v2',40),('deletion',18),('storage',18),('matrix',14)]:
 results=json.loads((e/suite/'results.json').read_text());assert len(results)==n and all(x['pass'] for x in results),suite;checks[suite]={'cases':n,'passed':n}
assert 'Tests  132 passed (132)' in (e/'final-focused.log').read_text()
drivers={str(p.relative_to(root)):sha(p) for p in sorted([*qa.glob('*.mjs'),*qa.glob('*.py')])};drivers[str((qa/'probe.ts').relative_to(root))]=sha(qa/'probe.ts');(e/'final-driver-sha256.json').write_text(json.dumps(drivers,indent=2)+'\n')
inventory={str(p.relative_to(qa)):sha(p) for p in sorted(e.rglob('*')) if p.is_file() and p.name!='final-integrity.json'}
report={'base':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),'frozenFilesVerified':len(frozen),'legacyCoreOriginalSHA256':legacy,'changedSinceVisualCheckpoint':changed,'unchangedVisualSources':['art.ts','entry.ts','owned-document.ts','controller.ts','storage.ts','forms.json'],'focused':{'files':4,'passed':132},'native':checks,'build':'success','lint':'success; 3 inherited warnings','sourceManifestSHA256':sha(e/'final-source-sha256.json'),'driverManifestSHA256':sha(e/'final-driver-sha256.json'),'evidenceFiles':len(inventory),'evidenceSHA256':inventory,'lostOriginalArtifacts':37,'scope':'Developer checks only; no independent product audit or integration'}
(e/'final-integrity.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:report[k] for k in ['base','frozenFilesVerified','changedSinceVisualCheckpoint','focused','native','evidenceFiles']}))
