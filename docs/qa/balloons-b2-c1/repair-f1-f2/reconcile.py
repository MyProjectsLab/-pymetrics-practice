import json,pathlib,hashlib,collections,os
base=pathlib.Path.cwd();out=pathlib.Path(os.environ.get('EVIDENCE_DIR','/private/tmp/balloons-c1-repair/post/'));packet=json.loads((base/'docs/specifications/ASSESSMENT_PRACTICE_BALLOONS_FIXED_MANIFESTS_V1_0.json').read_text());forms={m['id']:m for m in packet['scored']}
enc=lambda x:json.dumps(x,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()
for m in forms.values():
 assert hashlib.sha256(enc({k:v for k,v in m.items() if k!='sha256'})).hexdigest()==m['sha256']
 assert len(m['rounds'])==39 and collections.Counter(r['profile'] for r in m['rounds'])=={'A':13,'B':13,'C':13}
 for profile,maximum in [('A',12),('B',24),('C',48)]:
  ts=[r['threshold'] for r in m['rounds'] if r['profile']==profile];assert all(1<=t<=maximum for t in ts);assert min(ts)<=maximum//4 and max(ts)>3*maximum//4;assert 0.4*13*maximum<=sum(ts)<=0.6*13*maximum
results=[]
for p in sorted(out.glob('pair-*.json'))+sorted(out.glob('complete-RT*.json'))+[out/'fresh-admitted.json',out/'final-delivery-verified.json']+sorted(out.glob('repair-39-*-complete.json')):
 root=json.loads(p.read_text())
 for r in root['records'].values():
  if r['snapshot']['phase']!='completed':continue
  # Pair files contain reused synthetic BL seeds; count those only in fresh-admitted.
  if not r['header'].get('retest') and p.name!='fresh-admitted.json':continue
  f=forms[r['header']['formId']];assert r['snapshot']['core']['manifest']==f
  round_=1;attempts=successes=banked=lost=0;resolved=False;rows=[];actionid=0;revision=0
  mapping=r['header']['identity']['mapping'];inverse={v:k for k,v in mapping.items()}
  for e in r['journal']:
   c=e['command']
   if not c or c['kind']!='action':continue
   a=c['action'];actionid+=1;assert a['actionId']==actionid and a['expectedRound']==round_ and a['expectedRevision']==revision;revision+=1
   if a['kind']=='next':assert resolved;round_+=1;attempts=successes=0;resolved=False;continue
   assert not resolved;row=f['rounds'][round_-1];threshold=row['threshold'];outcome=None
   if a['kind']=='pump':
    attempts+=1
    if attempts==threshold:outcome='burst'
    else:
     successes+=1
     if successes==32:outcome='cap_collect'
   else:assert a['kind']=='collect';outcome='voluntary_collect'
   if outcome:
    b=0 if outcome=='burst' else successes*5;l=successes*5 if outcome=='burst' else 0;banked+=b;lost+=l;resolved=True
    rows.append({'round':round_,'profile':row['profile'],'visibleType':inverse[row['profile']],'attemptedPumps':attempts,'successfulPumps':successes,'voluntaryPoint':successes if outcome=='voluntary_collect' else None,'bankedCents':b,'lostCents':l,'outcome':outcome,'censored':outcome!='voluntary_collect'})
  assert len(rows)==39 and r['snapshot']['core']['results']==rows
  assert r['snapshot']['core']['bankedCents']==banked and r['snapshot']['core']['lostCents']==lost
  assert r['snapshot']['confirmedRounds']==list(range(1,40));assert 5*sum(x['successfulPumps'] for x in rows)==banked+lost
  if r['header'].get('retest'):
   chain=root['training']['chains'][r['header']['identity']['chainId']];bl=root['records'][r['header']['retest']['baselineSessionId']]
   assert chain['completedRetestSessionId']==r['header']['identity']['sessionId'];assert mapping==bl['header']['identity']['mapping'];assert r['header']['settings']==bl['header']['settings']
  results.append({'file':p.name,'form':f['id'],'rounds':len(rows),'actions':actionid,'banked':banked,'lost':lost})
(out/'independent-arithmetic.json').write_text(json.dumps(results,indent=2));print('PASS',len(results),'completed sessions;',sum(r['rounds']for r in results),'independently replayed rounds; all nine frozen hashes and profile bands checked')
