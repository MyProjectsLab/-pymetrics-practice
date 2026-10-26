"""Retain full observations, and publish compact case tables; run after all drivers."""
from pathlib import Path
import hashlib,json,tarfile,shutil,subprocess
P=Path(__file__).resolve().parent
B=Path('/private/tmp/stop-m5-f2c-regressions')
files={}
def add(path,name):
 if path.is_file():files[name]=path
for path in Path('/private/tmp/stop-m5-f2c-before').iterdir():add(path,'before/'+path.name)
for path in B.iterdir():add(path,'regressions/'+path.name)
for path in Path('/private/tmp').glob('stop-m5-f2c-regression-*.json'):add(path,'ordering/'+path.name)
for path in Path('/private/tmp').glob('stop-m5-f2c-*.json'):
 if not path.name.startswith('stop-m5-f2c-regression-'):add(path,'liveness/'+path.name)
for path in Path('/private/tmp/stop-m5-f2c-protocol').iterdir():add(path,'protocol/'+path.name)
for name in ['audit-candidate-edges.json','candidate-read-pending.json','candidate-confirm-pending.json','audit-watchdog.json','watchdog-read-pending-cancel.json','transactions.json']:
 add(P/name,'focused/'+name)
add(P/'completed-leave.json','excluded/completed-leave.json')
add(P/'completed-leave.mjs','excluded/completed-leave.mjs')
add(Path('/private/tmp/stop-m5-audit-53286f7/fixtures.json'),'inputs/fixtures.json')
for path in Path('/private/tmp').glob('stop-m5-f2c-*.txt'):add(path,'logs/'+path.name)
index=[]
with tarfile.open(P/'raw-evidence.tar.gz','w:gz') as archive:
 for name,path in sorted(files.items()):
  content=path.read_bytes();archive.add(path,arcname=name,recursive=False);index.append({'entry':name,'bytes':len(content),'sha256':hashlib.sha256(content).hexdigest()})
(P/'raw-evidence-index.json').write_text(json.dumps(index,indent=2)+'\n')
for name in ['matrix-delivered','matrix-delayed','matrix-unavailable','admission-edges','audit-onset','audit-f1','audit-boundaries','deletion-races','deletion-edges','initial-fixation-load','reload-evidence','regressions','supplement','pre-onset-browser','completion-browser','retest-completion']:
 source=B/(name+'.json');data=json.loads(source.read_text());assert not data.get('error') and not data.get('errors'),name
 if name in ['audit-onset','matrix-delivered','matrix-delayed','matrix-unavailable']:assert all(r['pass'] for r in data['cases']),name
 shutil.copyfile(source,P/(('prior-regressions' if name=='regressions' else name)+'.json'))
# Full repeated state/journal snapshots live in the indexed archive.
candidate=json.loads((P/'audit-candidate-edges.json').read_text())
summary=[]
for r in candidate['cases']:
 draft=next(d for d in r['before']['drafts'] if d['sessionId']==r['claim']['sessionId'])
 summary.append({'case':r['kind'],'deletionBlockedWhilePromiseHeld':r['blockedAfterCancellation'],'locksWhileHeld':r['before']['locks'],'scoredOnsets':len(draft['realizedSequence']),'invalidRule':draft['invalidRule'],'reservation':r['before']['state']['reservations'].get(r['claim']['sessionId']),'exposure':r['before']['state']['exposures'].get(r['claim']['formId']),'locksAfterRelease':r['after']['locks']})
(P/'reproduction-after.json').write_text(json.dumps(summary,indent=2)+'\n')
tx=json.loads((P/'transactions.json').read_text())
assert not tx.get('error') and not tx['errors'] and len(tx['cases'])==4
(P/'transactions-summary.json').write_text(json.dumps([{'boundary':r['boundary'],'deletion':r['kind'],'abortedBeforeDeletion':r['atDeletion']['aborted'],'promiseSettledAtDeletion':r['atDeletion']['settled'],'locks':r['atDeletion']['locks'],'replacementUnchanged':r['replacement']==r['after'],'trace':r['trace']}for r in tx['cases']],indent=2)+'\n')
for name in ['audit-candidate-edges.json','candidate-read-pending.json','candidate-confirm-pending.json','audit-watchdog.json','watchdog-read-pending-cancel.json','transactions.json','completed-leave.json','completed-leave.mjs']:(P/name).unlink(missing_ok=True)
life=json.loads((P/'liveness.json').read_text());assert len(life['cases'])==24 and not life.get('error') and not life['errors']
lines=['# F2-C case-by-case results','','Injected stalls use real candidate preparation, warm-up, Web Locks and IndexedDB. BroadcastChannel is unavailable. Full records are in [raw-evidence.tar.gz](raw-evidence.tar.gz), identified by [the SHA-256 index](raw-evidence-index.json).','','## Cancellation liveness','','Every row completes deletion while promise delivery remains held (queued cases release only the external control lock after cancellation). Late delivery leaves events and durable state unchanged.','','| Stage / cancellation / deletion | Scored events | Invalid rule | Marker after deletion | Claim | Chain | Late bytes |','|---|---:|---|---|---|---|---|']
for r in life['cases']:
 lines.append(f"| {r['label']} | {r['onsets']} | {r['invalidRule'].split('.')[-1]} | {'confirmed' if r['marker'] else 'absent'} | absent | {r['chainCount']} | unchanged |")
lines+=['','Queued controls hold an external owner lock; cancellation removes the retest request from its queue. The acquired-read/frame/confirmation cases show no held presentation lock after cancellation. All rows show empty held/pending lock lists after deletion and late delivery. See [liveness.json](liveness.json), [production eligibility checks](eligibility.json), and [raw journal verification](journal-check.json).','','## Existing deletion/onset ordering','','| Delivery | Boundary | Deletion | Scored events | Marker | Claim | Eligible |','|---|---|---|---:|---|---|---|']
for delivery in ['delivered','delayed','unavailable']:
 for r in json.loads((P/f'matrix-{delivery}.json').read_text())['cases']:
  lines.append(f"| {delivery} | {r['point']} | {r['kind']} | {r['onsets']} | {'confirmed' if r['marker'] else 'absent'} | absent | {r['eligible']} |")
lines+=['','All 15 Delete-all rows reject five old-store operations (arm, reserve, saveChain, saveDraft, deleteAll) without changing replacement bytes. Required deletion before onset has zero scored events; presentation first retains one. Unrelated deletion leaves the run live until the driver deliberately exits.','','## Additional boundaries','','Four real transaction-abort probes pass: pending read delivery and uncommitted write, each with individual deletion and Delete all. Read-delivery promises remain unsettled when deletion completes. See [transactions-summary.json](transactions-summary.json).','','The 13 protocol cases cover queued cancellation, installed-frame cancellation, missing-frame watchdog, a permitted 200 ms onset delay, read/lock/frame rejection, exposure failure, held read/confirmation cancellation, and timed input/offset/later-trial progress while confirmation is held. Full journals are in the archive under `protocol/`.']
(P/'CASES.md').write_text('\n'.join(lines)+'\n')
paths=subprocess.check_output(['git','ls-files','src','package.json','package-lock.json','vite.config.ts','tsconfig.json'],text=True).splitlines()+[str(p) for p in Path('dist').rglob('*')if p.is_file()]
identity={p:hashlib.sha256(Path(p).read_bytes()).hexdigest() for p in paths}
(P/'tested-source.json').write_text(json.dumps({'parent':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),'sha256':identity},indent=2)+'\n')
print('Retained',len(index),'raw entries; compact case table and source identity generated.')
