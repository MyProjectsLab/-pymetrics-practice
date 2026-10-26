"""Independently reconcile retained ordinary journals; no product imports or UI control."""
import collections
import json
from pathlib import Path

ROOT = Path(__file__).parent
raw = json.loads((ROOT / 'after-chrome-final-records.json').read_text())
out = []
for result in raw['installation'][0]['results'].values():
    phases = collections.defaultdict(list)
    phase = None
    lifecycle = []
    for event in result['events']:
        if event['type'] == 'trial_scheduled':
            phase = event['payload']['trial']['phase']
        if phase:
            phases[phase].append(event)
        if event['type'] in ('visibility_changed', 'focus_changed', 'page_lifecycle_changed', 'session_invalidated'):
            lifecycle.append(event)
    events = phases['scored']
    trials = [e['payload'] for e in events if e['type'] == 'trial_resolved']
    counts = collections.Counter(t['outcome']['kind'] for t in trials)
    expected = {'hits': counts['hit'], 'misses': counts['miss'],
                'withholds': counts['correct_withhold'], 'falseAlarms': counts['false_alarm']}
    assert len(trials) == 80
    assert [t['trialIndex'] for t in trials] == list(range(80))
    assert [t['outcome']['stimulus'] for t in trials] == result['form']['sequence']
    assert expected == result['summarySnapshot']['counts']
    assert result['summarySnapshot']['rates']['overall'] == (expected['hits'] + expected['withholds']) / 80
    assert result['summarySnapshot']['rates']['hit'] == expected['hits'] / 60
    assert result['summarySnapshot']['rates']['withhold'] == expected['withholds'] / 20
    blocks = []
    for index in range(4):
        b = collections.Counter(t['outcome']['kind'] for t in trials[index*20:(index+1)*20])
        bc = {'hits': b['hit'], 'misses': b['miss'], 'withholds': b['correct_withhold'], 'falseAlarms': b['false_alarm']}
        assert bc == result['summarySnapshot']['blocks'][index]['counts']
        blocks.append(bc)
    assert result['summarySnapshot']['timing']['count'] == 0
    assert result['summarySnapshot']['timing']['median'] is None
    onset = [e['payload'] for e in events if e['type'] == 'stimulus_presented']
    offset = [e['payload'] for e in events if e['type'] == 'stimulus_removed']
    schedule = [e['payload'] for e in events if e['type'] == 'trial_scheduled']
    assert len(onset) == len(offset) == len(schedule) == 80
    intervals = []
    for index in range(79):
        anchor = max(trials[index]['resolvedAtMs'], offset[index]['confirmedOffsetMs'])
        assert abs(schedule[index+1]['eligibleAtMs'] - anchor - 1200) < .0001
        intervals.append(onset[index+1]['confirmedOnsetMs'] - anchor)
    def span(values):
        return {'min': min(values), 'max': max(values), 'count': len(values)}
    out.append({'sessionId': result['sessionId'], 'form': result['form']['id'],
                'setup': result['setup'], 'recordedValidity': result['validity'],
                'counts': expected, 'blocks': blocks, 'overallPercent': 25,
                'warmupTrials': sum(e['type'] == 'trial_resolved' for e in phases['warmup']),
                'scoredTrials': len(trials), 'eventCount': len(result['events']),
                'domConfirmedVisibleMs': span([o['visibleDurationMs'] for o in offset]),
                'domOnsetDelayMs': span([o['confirmedOnsetMs'] - o['eligibleAtMs'] for o in onset]),
                'domPostResolutionIntervalMs': span(intervals), 'lifecycleEvidence': lifecycle,
                'reconciliation': 'PASS for counts, blocks, form order, rates, RT suppression, 1200 ms requested anchor',
                'qualification': 'Not physical timing or native lifecycle certification. Second run included unresolved tab-switch probes.'})
(ROOT / 'NATIVE-RECONCILIATION.json').write_text(json.dumps(out, indent=2) + '\n')
print(json.dumps([{k:v for k,v in r.items() if k not in ('lifecycleEvidence','blocks')} for r in out], indent=2))
