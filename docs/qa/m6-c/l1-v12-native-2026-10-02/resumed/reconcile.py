"""Reconcile retained native exports without importing product code; emit lossless slices."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent

def read(name):
    return json.loads((ROOT / name).read_text())

def write(name, value):
    (ROOT / name).write_text(json.dumps(value, indent=2) + '\n')

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

control = read('control.raw.json')
pause = read('cases1-2-pause.raw.json')
combined = read('cases1-2-final.raw.json')
pre = read('case3-pre-onset.raw.json')
post = read('case4-post-onset.raw.json')
sid12 = '93ba0dae-e7ff-4df1-acaa-a4c883240e99'
sid3 = '351e8b4f-b7f9-42d0-a01d-a5c4b1daa3a2'
sid4 = '99e75f87-e7b5-42aa-b64f-c3d417823533'
a = combined['installation']['drafts'][sid12]
b = pre['installation']['drafts'][sid3]
c = post['installation']['drafts'][sid4]
origin = 1790993973385.3

def events(draft, kind):
    return [e for e in draft['events'] if e['type'] == kind]

def scored(draft):
    return [e for e in events(draft, 'trial_scheduled') if e['payload']['trial']['phase'] == 'scored']

def exposure(raw):
    i = raw['installation']
    return {key: i[key] for key in ['installationId', 'exposures', 'reservations']}

def window(raw, start, end):
    return [e for e in raw['browserEvents'] if e['timeOriginMs'] == origin and start <= e['performanceNowMs'] <= end]

def hidden_near(raw, stamp):
    matches = [e for e in raw['browserEvents'] if e['type'] == 'visibilitychange' and e['visibilityState'] == 'hidden' and e['timeOriginMs'] == origin and abs(e['performanceNowMs'] - stamp) < 2]
    assert len(matches) == 1 and matches[0]['isTrusted'] is True
    return matches[0]

for draft in [a, b, c]:
    assert [e['sequenceNumber'] for e in draft['events']] == list(range(1, len(draft['events']) + 1))
    assert draft['clock'] == 'performance.now'
    assert all(x['timestampMs'] <= y['timestampMs'] for x, y in zip(draft['events'], draft['events'][1:]))
    assert not events(draft, 'page_lifecycle_changed')  # these cases test tab hiding, not freeze/restore

control_hidden = [e for e in control['browserEvents'] if e['type'] == 'visibilitychange' and e['visibilityState'] == 'hidden'][0]
assert control_hidden['isTrusted'] is True
assert not control['installation']['drafts'] and not control['installation']['results']
assert not control['installation']['exposures']
assert not pause['installation']['exposures'] and not pause['installation']['reservations']
assert not pause['installation']['drafts'] and not pause['installation']['results']

interrupted = events(a, 'warmup_interrupted')[0]
assert interrupted['payload']['reason'] == 'hidden'
assert interrupted['payload']['triggerSequenceNumber'] == 30
assert a['events'][29]['type'] == 'visibility_changed' and a['events'][29]['payload']['visible'] is False
assert a['events'][31]['type'] == 'warmup_restart_required'
warm = [e for e in events(a, 'trial_scheduled') if e['payload']['trial']['phase'] == 'warmup']
assert [e['payload']['trial']['index'] for e in warm if e['sequenceNumber'] < 31] == [0, 1]
assert [e['payload']['trial']['index'] for e in warm if e['sequenceNumber'] > 32] == list(range(8))
finish = events(a, 'batch_finished')[0]
assert finish['sequenceNumber'] == 94 and finish['payload'] == {'phase': 'warmup', 'trialCount': 8}
protect = events(a, 'protection_started')[0]
assert protect['sequenceNumber'] == 95
h1 = hidden_near(combined, interrupted['timestampMs'])
pause_hides = [e for e in window(combined, finish['timestampMs'], protect['timestampMs']) if e['type'] == 'visibilitychange' and e['visibilityState'] == 'hidden']
assert len(pause_hides) == 1 and pause_hides[0]['isTrusted'] is True
assert not [e for e in events(a, 'session_invalidated') if e['timestampMs'] < protect['timestampMs']]
assert a['invalidRule'] == 'stop_validity_v1.viewport_below_768x600' and len(scored(a)) == 78
assert a['events'][-2]['payload'] == {'width': 760, 'height': 749}
assert a['events'][-1]['payload']['triggerSequenceNumber'] == 644
assert not combined['installation']['results']

for draft, raw in [(b, pre), (c, post)]:
    invalid = events(draft, 'session_invalidated')[0]
    assert draft['invalidRule'] == 'stop_validity_v1.hidden'
    trigger = draft['events'][invalid['payload']['triggerSequenceNumber'] - 1]
    assert trigger['type'] == 'visibility_changed' and trigger['payload']['visible'] is False
    hidden_near(raw, trigger['timestampMs'])
assert not scored(b)
assert b['form']['id'] not in pre['installation']['exposures']
assert b['form']['id'] not in pre['installation']['reservations']
assert len(scored(c)) == 3
protect4 = events(c, 'protection_started')[0]
onset4 = next(e for e in events(c, 'stimulus_presented') if e['timestampMs'] > protect4['timestampMs'])
h4 = hidden_near(post, events(c, 'session_invalidated')[0]['timestampMs'])
assert protect4['timestampMs'] < onset4['timestampMs'] < h4['performanceNowMs']
assert post['installation']['exposures'][c['form']['id']]['sessionId'] == sid4
assert post['installation']['exposures'][c['form']['id']]['certainty'] == 'confirmed'
assert not post['installation']['results']

write('control.browser-events.json', control['browserEvents'])
write('control.stop-journal.json', control['installation']['drafts'])
write('control.exposure-state.json', exposure(control))
for name, raw, draft, journal, start, end, before in [
    ('case1', combined, a, a['events'][:94], a['events'][0]['timestampMs'], finish['timestampMs'], pause),
    ('case2', combined, a, a['events'][93:], finish['timestampMs'], protect['timestampMs'] + 1500, pause),
    ('case3', pre, b, b['events'], b['events'][0]['timestampMs'], b['events'][-1]['timestampMs'] + 2000, pre),
    ('case4', post, c, c['events'], c['events'][0]['timestampMs'], c['events'][-1]['timestampMs'] + 2000, pre),
]:
    write(name + '.browser-events.json', window(raw, start, end))
    write(name + '.stop-journal.json', journal)
    write(name + '.exposure-state.json', {'sessionId': draft['sessionId'], 'formId': draft['form']['id'], 'beforeOrPause': exposure(before), 'after': exposure(pause if name == 'case1' else raw)})

summary = {
    'scope': 'Bounded native tab-hide observations at unchanged f6b8ae0; not browser/support certification',
    'control': control_hidden,
    'case1': {'sessionId': sid12, 'browserHidden': h1, 'journalInterruption': interrupted, 'freshWarmupCompletion': finish, 'unexposedAtPause': True},
    'case2': {'sessionId': sid12, 'browserHidden': pause_hides[0], 'acceptedScoredStart': protect, 'laterViewportInvalidation': a['events'][-1], 'scoredScheduledBeforeViewportInvalidation': len(scored(a)), 'validCompletionObserved': False},
    'case3': {'sessionId': sid3, 'formId': b['form']['id'], 'acceptedScoredStart': events(b, 'protection_started')[0], 'browserHidden': hidden_near(pre, b['events'][-1]['timestampMs']), 'invalidation': b['events'][-1], 'scoredScheduled': 0, 'formConsumed': False},
    'case4': {'sessionId': sid4, 'formId': c['form']['id'], 'acceptedScoredStart': protect4, 'firstScoredOnset': onset4, 'browserHidden': h4, 'invalidation': c['events'][-1], 'scoredScheduled': 3, 'exposure': post['installation']['exposures'][c['form']['id']]},
    'limits': ['Cases 1 and 2 share an attempt; separate boundary snapshots.', 'No completed valid native-hide recovery result; later viewport invalidation retained.', 'Native app bridge inputs, not human physical input/display calibration.', 'No lock/sleep/minimize/discard/freeze/bfcache or blur-duration qualification.', 'No Chrome or support-matrix certification.'],
}
write('RECONCILIATION.json', summary)
print('PASS: trusted control; four bounded cases; contiguous journals; trigger linkage; exposure boundaries; later viewport limit retained.')
