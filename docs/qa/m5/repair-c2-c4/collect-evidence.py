"""Archive only this repair's fresh evidence, after all runs and reviews finish."""
from pathlib import Path
import json,hashlib,tarfile
root=Path('/private/tmp/stop-m5-c234-repair-20261001')
out=Path(__file__).resolve().parent
status=json.loads((root/'run-status.json').read_text())
assert len(status)==31,status
reruns={x['label']:x for x in json.loads((root/'replacement-rerun-status.json').read_text())}
final=[]
for x in status:
 if x['code']!=0:
  assert x['label'] in ['same-tab-all-before','same-tab-all-after'] and reruns[x['label']]['code']==0
  final.append({**reruns[x['label']], 'supersedes':x, 'reason':'Synthetic activity session ID corrected; preserved in harness-failures/replacement-null-activity'})
 else:final.append(x)
assert all(x['code']==0 for x in final)
(root/'FINAL-RUN-STATUS.json').write_text(json.dumps(final,indent=2)+'\n')
for group,count in [('fast',10),('cancellation',6),('ordinary',3)]:
 rows=json.loads((root/(group+'-status.json')).read_text());assert len(rows)==count and all(x['code']==0 for x in rows),group
for name in ['focused-independent-review','regression-independent-review','additional-independent-review','overlap-independent-review']:
 assert (root/(name+'.json')).exists(),name
assert len(json.loads((root/'focused-independent-review.json').read_text()))==22
files=sorted(p for p in root.rglob('*') if p.is_file() and not p.is_symlink() and '__pycache__' not in p.parts and 'node_modules' not in p.parts)
index=[]
with tarfile.open(out/'raw-evidence.tar.gz','w:gz') as archive:
 for p in files:
  rel=p.relative_to(root);data=p.read_bytes();index.append(dict(path=str(rel),bytes=len(data),sha256=hashlib.sha256(data).hexdigest()))
  archive.add(p,arcname=str(rel),recursive=False)
(out/'raw-evidence-index.json').write_text(json.dumps(index,indent=2)+'\n')
print('Archived',len(index),'files;',sum(x['bytes'] for x in index),'uncompressed bytes')
