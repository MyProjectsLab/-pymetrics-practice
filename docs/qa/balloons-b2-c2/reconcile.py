import json,hashlib,pathlib,collections,os
home=pathlib.Path(__file__).resolve().parents[3]
evidence=pathlib.Path(os.environ.get('EVIDENCE_DIR','/private/tmp/balloons-b2-c2'))
packet=json.loads((home/'docs/specifications/ASSESSMENT_PRACTICE_BALLOONS_FIXED_MANIFESTS_V1_0.json').read_text())
forms={m['id']:m for m in packet['scored']}
for m in forms.values():
    primitive={k:v for k,v in m.items() if k!='sha256'}
    assert hashlib.sha256(json.dumps(primitive,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()==m['sha256']
seen={};out=[]
paths=[evidence/'comparison-open.json']
for path in paths:
    root=json.loads(path.read_text())
    for r in root['records'].values():
        if r['snapshot']['phase']!='completed':continue
        sid=r['header']['identity']['sessionId']
        if sid in seen:
            assert seen[sid]==r['snapshot']['core'];continue
        core=r['snapshot']['core'];seen[sid]=core;form=forms[r['header']['formId']];assert core['manifest']==form
        mapping=r['header']['identity']['mapping'];rnd=1;attempts=success=current=banked=lost=revision=0;resolved=False;rows=[];pending=None;confirmed=set();prior=None
        def totals():return dict(attemptedPumps=attempts,successfulPumps=success,currentCents=current,bankedCents=banked,lostCents=lost)
        for idx,e in enumerate(r['journal'],1):
            assert e['sequenceNumber']==idx and e['manifestSha256']==form['sha256'] and e['mapping']==mapping
            assert e['sessionId']==sid and e['installationId']==root['installationId']
            if prior and prior['clockEpochId']==e['clockEpochId']:assert e['monotonicMs']>=prior['monotonicMs']
            prior=e;cmd=e['command'];kind=cmd['kind'] if cmd else None
            assert e['pre']==totals(),(path,idx,'pre')
            if kind=='confirm':confirmed.add(rnd)
            if kind=='action_pending':pending=cmd['action']
            if kind=='action':
                a=cmd['action'];assert pending==a;pending=None
                assert a['actionId']==revision+1 and a['expectedRevision']==revision and a['expectedRound']==rnd
                assert e['actionId']==a['actionId'] and e['source']==a['source'];revision+=1;k=a['kind'];outcome=None
                if k=='next':
                    assert resolved and rnd<39;rnd+=1;attempts=success=current=0;resolved=False
                else:
                    assert not resolved and rnd in confirmed
                    if k=='pump':
                        attempts+=1
                        if attempts==form['rounds'][rnd-1]['threshold']:outcome='burst';lost+=current;current=0
                        else:
                            success+=1;current+=5
                            if success==32:outcome='cap_collect';banked+=current;current=0
                    else:
                        assert k=='collect';outcome='voluntary_collect';banked+=current;current=0
                    if outcome:
                        resolved=True;profile=form['rounds'][rnd-1]['profile'];rows.append(dict(round=rnd,profile=profile,visibleType=next(k for k,v in mapping.items() if v==profile),attemptedPumps=attempts,successfulPumps=success,voluntaryPoint=success if outcome=='voluntary_collect' else None,bankedCents=0 if outcome=='burst' else success*5,lostCents=success*5 if outcome=='burst' else 0,outcome=outcome,censored=outcome!='voluntary_collect'))
            assert e['post']==totals(),(path,idx,'post')
        assert rows==core['results'] and len(rows)==39 and confirmed==set(range(1,40))
        assert core['bankedCents']==banked and core['lostCents']==lost and core['revision']==revision and core['nextActionId']==revision+1
        assert core['current']==dict(attemptedPumps=attempts,successfulPumps=success,currentCents=current)
        assert sum(x['successfulPumps'] for x in rows)*5==banked+lost
        assert sum(x['attemptedPumps'] for x in rows)==sum(x['successfulPumps'] for x in rows)+sum(x['outcome']=='burst' for x in rows)
        assert collections.Counter(x['profile'] for x in rows)=={'A':13,'B':13,'C':13}
        if 'retest' in r['header']:
            assert r['snapshot']['comparisonEligible']
            assert root['training']['chains'][r['header']['identity']['chainId']]['completedRetestSessionId']==sid
            assert sum(e['type']=='retest_completed' for e in r['journal'])==1
        out.append(dict(sessionId=sid,form=form['id'],rounds=39,bankedCents=banked,lostCents=lost,actions=revision,evidence=path.name))
assert len(out)==2 and {r['form'] for r in out}=={'BL1','RT1'}
bl=next(r for r in out if r['form']=='BL1');rt=next(r for r in out if r['form']=='RT1')
text=(evidence/'comparison-open.txt').read_text()
assert f"Banked cents: {bl['bankedCents']} → {rt['bankedCents']}; RT − BL +{rt['bankedCents']-bl['bankedCents']}" in text
assert f"Lost cents: {bl['lostCents']} → {rt['lostCents']}; RT − BL +{rt['lostCents']-bl['lostCents']}" in text
(evidence/'arithmetic-independent.json').write_text(json.dumps(out,indent=2));print(f'PASS: {len(out)} unique complete scored sessions / {len(out)*39} rounds; primitive action replay, visible total deltas, IDs/revisions, presentation, mapping and closure reconciled.')
