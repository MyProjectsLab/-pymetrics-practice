import json,hashlib,gzip,collections,pathlib,copy,statistics
P=pathlib.Path('/private/tmp/balloons-b1b-repair/post');R=pathlib.Path('/Users/renzo/Documents/Assessment Practice/App')
forms={f['id']:f for f in json.load(open(R/'docs/specifications/ASSESSMENT_PRACTICE_BALLOONS_FIXED_MANIFESTS_V1_0.json'))['scored']}
versions=dict(schemaVersion='balloons-event-v1',specificationVersion='balloons-v1.0',formVersion='balloons-scored-v1',scoringVersion='balloons-scoring-v1',routerVersion='balloons-router-v1')
results=[]
def reconcile(rec,label,dom=None):
 h=rec['header'];s=rec['snapshot'];c=s['core'];f=forms[h['formId']];assert c['manifest']==f
 content={k:v for k,v in f.items() if k!='sha256'};assert hashlib.sha256(json.dumps(content,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()==f['sha256']
 rot=int(f['id'][-1])-1;mapping={f'Type {i+1}':'ABC'[(i+rot)%3] for i in range(3)};assert h['identity']['mapping']==mapping
 identity=h['identity'];round=1;revision=0;nextid=1;status='active';attempts=success=cents=bank=lost=0;rows=[];events=[];phase='pending_exposure';exposure='pending_exposure';confirmed=[];pending=None;generation=identity['ownershipGeneration'];eligible=not h['repeat'];interruptions=0
 def totals():return dict(attemptedPumps=attempts,successfulPumps=success,currentCents=cents,bankedCents=bank,lostCents=lost)
 def ce(typ,t,aid,source,pre,outcome):
  events.append(dict(**versions,**identity,manifestId=f['id'],manifestSha256=f['sha256'],round=round,sequenceNumber=len(events)+1,actionId=aid,source=source,wallTimeMs=t['wallTimeMs'],monotonicMs=t['monotonicMs'],clockEpochId=t['clockEpochId'],pre=pre,post=totals(),type=typ,outcome=outcome,validityCode='headless_unconfirmed'))
 ce('round_presented',h['created'],None,None,totals(),None)
 clocks={};lastsource=None
 for n,e in enumerate(rec['journal'],1):
  assert e['sequenceNumber']==n
  cmd=e['command'];pre=totals();start=len(events) if cmd else 0;aid=source=outcome=None
  if e['clockEpochId'] in clocks:assert e['monotonicMs']>=clocks[e['clockEpochId']]
  clocks[e['clockEpochId']]=e['monotonicMs']
  if cmd is None:assert n==1;typ='pending_exposure'
  elif cmd['kind']=='arm':
   assert phase in ['pending_exposure','awaiting_presentation'];phase='presentation_armed';exposure='exposure_uncertain' if exposure=='pending_exposure' else exposure;typ='presentation_armed'
  elif cmd['kind']=='confirm':
   assert phase=='presentation_armed';typ='form_exposed' if exposure!='form_exposed' else 'round_presented';exposure='form_exposed';phase='active';confirmed=sorted(set(confirmed+[round]))
  elif cmd['kind']=='action_pending':
   assert phase in ['active','resolved'];assert pending is None;pending=cmd['action'];phase='committing_action';aid=pending['actionId'];source=pending['source'];outcome=events[-1]['outcome'];typ='input_changed' if lastsource and lastsource!=source else 'action_pending'
  elif cmd['kind']=='action':
   a=cmd['action'];assert phase=='committing_action' and a==pending and exposure=='form_exposed';pending=None
   assert (a['actionId'],a['expectedRound'],a['expectedRevision'])==(nextid,round,revision);aid=a['actionId'];source=a['source'];revision+=1;nextid+=1;lastsource=source
   assert all(e[k]==a['time'][k] for k in ['wallTimeMs','monotonicMs','clockEpochId'])
   if a['kind']=='next':
    assert status=='resolved';round+=1;attempts=success=cents=0;status='active';phase='awaiting_presentation';ce('round_presented',a['time'],aid,source,pre,None)
   else:
    assert status=='active';row=f['rounds'][round-1];t=row['threshold'];resolved=False;cap=False
    if a['kind']=='pump':
     attempts+=1
     if attempts==t:kind='burst';lost+=cents;cents=0;resolved=True
     else:
      success+=1;cents+=5;kind='pump_success'
      if success==32:kind='cap_collect';bank+=cents;cents=0;resolved=cap=True
    else:assert a['kind']=='collect';kind='voluntary_collect';bank+=cents;cents=0;resolved=True
    if resolved:
     status='completed' if round==39 else 'resolved';visible=next(k for k,v in mapping.items() if v==row['profile']);rows.append(dict(round=round,profile=row['profile'],visibleType=visible,attemptedPumps=attempts,successfulPumps=success,voluntaryPoint=success if kind=='voluntary_collect' else None,bankedCents=0 if kind=='burst' else 5*success,lostCents=5*success if kind=='burst' else 0,outcome=kind,censored=kind!='voluntary_collect'))
    phase=status;ce('pump_attempted' if a['kind']=='pump' else 'voluntary_collected',a['time'],aid,source,pre,'pump_success' if cap else kind)
    if cap:ce('cap_collected',a['time'],aid,source,pre,'cap_collect')
    if resolved:ce('round_resolved',a['time'],aid,source,pre,kind)
    if status=='completed':ce('session_completed',a['time'],aid,source,pre,kind)
   outcome=events[-1]['outcome'];typ='session_completed' if status=='completed' else 'action_committed'
  elif cmd['kind']=='report':assert phase=='completed';typ='report_viewed'
  else:raise AssertionError('fresh uninterrupted journey has unexpected command '+str(cmd))
  expected=dict(versions);expected.update(schemaVersion='balloons-durable-v1',coreSchemaVersion='balloons-event-v1');expected.update(identity);expected.update(manifestId=f['id'],manifestSha256=f['sha256'],sequenceNumber=n,round=round,actionId=aid,source=source,wallTimeMs=e['wallTimeMs'],monotonicMs=e['monotonicMs'],clockEpochId=e['clockEpochId'],timeOriginMs=e['timeOriginMs'],ownershipGeneration=generation,pre=pre,post=totals(),outcome=outcome,validityCode='intact' if eligible else 'review_only',type=typ,command=cmd,coreEventStart=start,coreEventEnd=len(events))
  assert e==expected,(label,n,{k:(e.get(k),expected.get(k)) for k in set(e)|set(expected) if e.get(k)!=expected.get(k)})
 assert c['events']==events,(label,'core events')
 assert c['results']==rows
 assert {k:c[k] for k in ['status','round','revision','nextActionId','current','bankedCents','lostCents']}==dict(status=status,round=round,revision=revision,nextActionId=nextid,current=dict(attemptedPumps=attempts,successfulPumps=success,currentCents=cents),bankedCents=bank,lostCents=lost)
 assert s==dict(core=c,phase=phase,exposure=exposure,confirmedRounds=confirmed,ownershipGeneration=generation,comparisonEligible=eligible,interruptions=interruptions,pendingAction=pending)
 assert len(rows)==39 and confirmed==list(range(1,40)) and exposure=='form_exposed'
 def summary(rs):return [len(rs),sum(r['outcome']!='burst' for r in rs),sum(r['outcome']=='burst' for r in rs),sum(r['bankedCents'] for r in rs),sum(r['lostCents'] for r in rs),sum(r['attemptedPumps'] for r in rs),sum(r['successfulPumps'] for r in rs),sum(r['outcome']=='voluntary_collect' for r in rs),sum(r['voluntaryPoint']==0 for r in rs),sum(r['outcome']=='cap_collect' for r in rs)]
 for rs in [rows]+[[r for r in rows if r['visibleType']==f'Type {i}'] for i in range(1,4)]:
  q=summary(rs);assert q[1]+q[2]==q[0] and q[5]==q[6]+q[2] and 5*q[6]==q[3]+q[4]
 if dom:
  expected=[[[lab]+list(map(str,summary(rs))) for lab,rs in [('All balloons',rows)]+[(f'Type {i}',[r for r in rows if r['visibleType']==f'Type {i}']) for i in range(1,4)]],[[lab]+list(map(str,summary(rows[i*13:(i+1)*13]))) for i,lab in enumerate(['early','middle','late'])],[[str(r['round']),r['visibleType'],str(r['attemptedPumps']),str(r['successfulPumps']),r['outcome'].replace('_',' '),str(r['bankedCents']),str(r['lostCents'])] for r in rows]]
  assert dom['tables']==expected
  for i in range(1,4):
   v=[r['voluntaryPoint'] for r in rows if r['visibleType']==f'Type {i}' and r['voluntaryPoint'] is not None]
   if len(v)>=5:assert f"Median: {statistics.median(v):g} pumps ({len(v)} voluntary collections)." in dom['text']
 results.append(dict(label=label,form=f['id'],rounds=len(rows),coreEvents=len(events),durableEvents=len(rec['journal']),actions=nextid-1,totals=summary(rows),exposure=exposure,confirmed=len(confirmed),visibleTablesMatch=bool(dom)))
reconcile(json.load(gzip.open(R/'docs/qa/balloons-b1-b/complete-session.json.gz')), 'committed developer record')
reconcile(json.load(open(P/'independent-BL1-before-report.json')), 'fresh independent BL journey',json.load(open(P/'independent-BL1-report-dom.json')))
for r in json.load(open(P/'independent-full-root.json'))['records'].values():reconcile(r,'independent final root '+r['header']['formId'])
json.dump(results,open(P/'reconciliation-results.json','w'),indent=2)
print(json.dumps(results,indent=2))
