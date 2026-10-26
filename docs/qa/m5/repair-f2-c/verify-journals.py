from pathlib import Path
import json
P=Path(__file__).resolve().parent
B=Path('/private/tmp/stop-m5-f2c-regressions')
def scored(es):
 phase=None; out=[]
 for e in es:
  if e['type']=='trial_scheduled': phase=e['payload']['trial']['phase']
  if e['type']=='stimulus_presented' and phase=='scored': out.append(e)
 return out
rows=[]
for delivery in ['unavailable','delivered','delayed']:
 data=json.loads((B/f'matrix-{delivery}.json').read_text())
 assert not data.get('error') and not data['errors'] and len(data['cases'])==15
 for r in data['cases']:
  raw=json.loads(Path(f"/private/tmp/stop-m5-f2c-regression-{delivery}-{r['point']}-{r['kind']}.json").read_text())
  d=next(x for x in raw['end']['drafts'] if x['sessionId']==r['claim']['sessionId']); es=scored(d['events'])
  expected=0 if r['kind']!='unrelated' and r['point'] in ['before-arm','fixation','delete-first'] else 1
  assert len(es)==len(d['realizedSequence'])==expected
  assert d['status']=='invalid' and all(e['payload']['confirmedOnsetMs']==e['timestampMs'] for e in es)
  assert len(r['confirmations'])==expected and not r['reservation']
  assert bool(r['marker'])==(expected==1 and r['kind']!='all')
  assert r['eligible']==(r['kind']=='unrelated')
  if r['kind']!='unrelated' and r['point'] in ['present-first','after']:assert r['confirmations'][0]['at']<=r['deletion']['committedAt']
  if r['kind']=='all':assert r['replacement']==['InstallationClearedError']*5
  rows.append({'case':f"{delivery}/{r['point']}/{r['kind']}",'actualScoredEvents':len(es),'reservation':r['reservation'],'marker':r['marker'],'eligible':r['eligible']})
life=json.loads((P/'liveness.json').read_text());assert len(life['cases'])==24 and not life.get('error') and not life['errors']
for r in life['cases']:
 d=json.loads(Path(f"/private/tmp/stop-m5-f2c-{r['label']}.json").read_text())
 es=scored(d['retained']['events']);expected=int(r['label'].startswith('confirm'))
 assert len(es)==len(d['late']['draft']['realizedSequence'])==expected
 assert d['late']['draft']['events']==d['retained']['events']
 assert d['after']['state']==d['replacement']['state'] and d['after']['activity']==d['replacement']['activity']
 assert not d['before']['locks']['held'] and not d['before']['locks']['pending']
 assert not d['after']['locks']['held'] and not d['after']['locks']['pending']
 assert d['retained']['invalidRule']==('stop_validity_v1.severe_timing' if '-watchdog-' in r['label'] else 'stop_validity_v1.lifecycle')
 if expected:assert es[0]['timestampMs']==es[0]['payload']['confirmedOnsetMs']
 rows.append({'case':r['label'],'actualScoredEvents':len(es),'locksAfterDeletion':d['before']['locks'],'originalEventsUnchanged':True,'replacementBytesUnchanged':True})
(P/'journal-check.json').write_text(json.dumps(rows,indent=2));print('Raw-journal/ordering verification:',len(rows),'cases')

protocol=json.loads(Path('/private/tmp/stop-m5-f2c-protocol/audit-protocol.json').read_text())
assert len(protocol['cases'])==13 and not protocol['errors']
for r in protocol['cases']:
 if r['kind'] in ['frame-cancel','frame-missing']:
  trace=r['after']['trace'];deleted=next(x['time'] for x in trace if x['what']=='delete-committed');late=next(x for x in trace if x['what']=='held-frame-delivered')
  assert late['canceled'] and deleted<late['time']
 if r['kind']=='later-storage-pending':
  events=r['beforeRelease']['snapshot']['events'];response=next(e for e in events if e['type']=='response_accepted');offset=next(e for e in events if e['type']=='stimulus_removed');onsets=[e for e in events if e['type']=='stimulus_presented']
  assert len(onsets)==2 and len(r['beforeRelease']['snapshot']['results'])==2
  assert onsets[1]['payload']['eligibleAtMs']==max(response['timestampMs'],offset['timestampMs'])+1200
  assert any(e['type']=='trial_timed_out' for e in events)
print('Protocol late-frame ordering and storage-independent M2B-02 progression verified.')
