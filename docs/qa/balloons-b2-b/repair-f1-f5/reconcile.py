"""Independent arithmetic over production-browser journals; no product imports."""
import hashlib, json
from pathlib import Path
repo = Path(__file__).resolve().parents[4]
evidence = Path('/private/tmp/balloons-b2b-repair')
packet = json.loads((repo/'docs/specifications/ASSESSMENT_PRACTICE_BALLOONS_FIXED_MANIFESTS_V1_0.json').read_text())
forms = {x['id']: x for x in packet['drills']}
summary = []
for kind in ['maintenance','outcome','information','updating','consistencyA','consistencyB','consistencyC']:
    root = json.loads((evidence/f'inventory-{kind}.json').read_text())
    a = list(root['training']['attempts'].values())[-1]
    manifest = forms[a['header']['manifestId']]
    rows = a['snapshot']['results']
    assert len(rows) == 18
    banked = lost = 0
    expected_action = 1
    for i,e in enumerate(a['journal'],1):
        assert e['sequenceNumber'] == i
        if e['command']:
            assert e['command']['actionId'] == expected_action
            assert e['command']['expectedRevision'] == expected_action-1
            assert e['command']['ownershipGeneration'] == root['owner']['generation']
            expected_action += 1
    for row,fixed in zip(rows,manifest['rounds']):
        round_number = row['round']
        commands = [e['command'] for e in a['journal'] if e['command'] and e['command']['expectedRound']==round_number and e['command']['kind'] in ['pump','collect']]
        pumps = sum(c['kind']=='pump' for c in commands)
        threshold = fixed['threshold']
        burst = pumps == threshold
        successes = pumps-int(burst)
        cap = successes == 32
        outcome = 'burst' if burst else 'cap_collect' if cap else 'voluntary_collect'
        assert pumps <= min(threshold,32)
        assert row['profile'] == fixed['profile']
        assert a['header']['recommendation']['mapping'][row['visibleType']] == fixed['profile']
        assert row['outcome'] == outcome
        assert row['successfulPumps'] == successes and row['attemptedPumps'] == pumps
        assert row['bankedCents'] == (0 if burst else 5*successes)
        assert row['lostCents'] == (5*successes if burst else 0)
        assert row['voluntaryPoint'] == (None if burst or cap else successes)
        assert commands[-1]['kind'] == ('pump' if burst or cap else 'collect')
        banked += row['bankedCents']; lost += row['lostCents']
    assert a['snapshot']['bankedCents'] == banked and a['snapshot']['lostCents'] == lost
    assert a['snapshot']['phase'] == 'completed'
    assert root['training']['chains']['chain']['firstCompletedDrillId'] == a['header']['attemptId']
    summary.append(dict(inventory=manifest['id'],rounds=18,events=len(a['journal']),banked=banked,lost=lost))
result=dict(status='PASS',rounds=sum(x['rounds'] for x in summary),events=sum(x['events'] for x in summary),inventories=summary)
(evidence/'arithmetic.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
