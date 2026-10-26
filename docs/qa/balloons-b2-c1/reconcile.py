"""Independent primitive-action arithmetic; no production module imports."""
import json
from pathlib import Path
packet = json.loads(Path('docs/specifications/ASSESSMENT_PRACTICE_BALLOONS_FIXED_MANIFESTS_V1_0.json').read_text())
forms = {f['id']: f for f in packet['scored']}
results = json.loads(Path('/private/tmp/balloons-b2-c1/browser-results.json').read_text())
required = {'fresh-baseline-drill-retest', 'full-RT2', 'full-RT3', 'exhaustion', 'prearm-expiry', 'postarm-expiry', 'postarm-hide', 'onset-owner-race', 'ownership', 'late-arm-delete', 'late-reserve-delete-all'}
assert required <= {r['name'] for r in results if r['pass']}, 'required final browser cases missing or failed'
assert all(r['pass'] for r in results), 'a final browser case failed'
seen = {}
for case in results:
    path = Path('/private/tmp/balloons-b2-c1') / (case['name'] + '.json')
    data = json.loads(path.read_text())
    if not isinstance(data, dict) or 'records' not in data:
        continue
    for r in data['records'].values():
        if r['snapshot']['phase'] != 'completed':
            continue
        header, snapshot = r['header'], r['snapshot']
        core = snapshot['core']
        form = forms[header['formId']]
        mapping = header['identity']['mapping']
        results, pumps, attempts, banked, lost, round_index, action_id = [], 0, 0, 0, 0, 0, 0
        for seq, e in enumerate(r['journal'], 1):
            assert e['sequenceNumber'] == seq
            command = e['command']
            if not command or command['kind'] != 'action':
                continue
            a = command['action']; action_id += 1
            assert a['actionId'] == action_id
            assert a['expectedRound'] == round_index + 1
            kind = a['kind']
            if kind == 'next':
                assert len(results) == round_index + 1
                round_index += 1; pumps = 0; attempts = 0
                continue
            threshold = form['rounds'][round_index]['threshold']
            outcome = None
            if kind == 'pump':
                attempts += 1
                if attempts == threshold: outcome = 'burst'
                else:
                    pumps += 1
                    if pumps == 32: outcome = 'cap_collect'
            else:
                assert kind == 'collect'; outcome = 'voluntary_collect'
            if outcome:
                b = pumps * 5 if outcome != 'burst' else 0
                l = pumps * 5 if outcome == 'burst' else 0
                profile = form['rounds'][round_index]['profile']
                results.append(dict(round=round_index + 1, profile=profile, visibleType=next(k for k, v in mapping.items() if v == profile), attemptedPumps=attempts, successfulPumps=pumps, voluntaryPoint=pumps if outcome == 'voluntary_collect' else None, bankedCents=b, lostCents=l, outcome=outcome, censored=outcome != 'voluntary_collect'))
                banked += b; lost += l
        assert results == core['results']
        assert len(results) == 39
        assert snapshot['confirmedRounds'] == list(range(1, 40))
        assert (banked, lost) == (core['bankedCents'], core['lostCents'])
        assert 5 * sum(r['successfulPumps'] for r in results) == banked + lost
        assert all(sum(r['profile'] == p for r in results) == 13 for p in 'ABC')
        if header.get('retest') and snapshot['comparisonEligible']:
            chain = data['training']['chains'][header['identity']['chainId']]
            assert chain['completedRetestSessionId'] == header['identity']['sessionId']
            assert header['retest']['drillAttemptId'] == chain['firstCompletedDrillId']
            baseline = data['records'][header['retest']['baselineSessionId']]
            assert mapping == baseline['header']['identity']['mapping']
            assert header['settings'] == baseline['header']['settings']
        seen[header['identity']['sessionId']] = dict(form=header['formId'], rounds=39, actions=action_id, bankedCents=banked, lostCents=lost, events=len(r['journal']))
assert {'RT1', 'RT2', 'RT3'} <= {v['form'] for v in seen.values()}, 'all three completed retests required'
summary = dict(pass_=True, sessions=list(seen.values()), totalRounds=sum(v['rounds'] for v in seen.values()))
Path('/private/tmp/balloons-b2-c1/arithmetic.json').write_text(json.dumps(summary, indent=2) + '\n')
print(json.dumps(summary, indent=2))
