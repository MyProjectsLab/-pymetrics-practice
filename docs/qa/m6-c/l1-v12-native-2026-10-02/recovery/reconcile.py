"""Independently reconcile the one native recovery journey; no product imports."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent

def read(name):
    return json.loads((ROOT / name).read_text())

def write(name, value):
    (ROOT / name).write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n')

def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()

def digest(value):
    return hashlib.sha256(canonical(value)).hexdigest()

before, pause, saved, reloaded = [read(n + '.raw.json') for n in ['before', 'pause', 'saved', 'reloaded']]
new_ids = set(saved['installation']['results']) - set(before['installation']['results'])
assert len(new_ids) == 1
sid = new_ids.pop()
r = saved['installation']['results'][sid]
r2 = reloaded['installation']['results'][sid]
journal = r['events']
def events(kind):
    return [e for e in journal if e['type'] == kind]

assert r['validity'] == 'valid' and r['storageMode'] == 'persistent_local'
assert r == r2 and canonical(r) == canonical(r2)
assert [e['sequenceNumber'] for e in journal] == list(range(1, len(journal) + 1))
assert all(e['sessionId'] == sid for e in journal)
assert all(a['timestampMs'] <= b['timestampMs'] for a, b in zip(journal, journal[1:]))
assert not events('session_invalidated')
assert not events('viewport_changed')
assert len(events('warmup_interrupted')) == len(events('warmup_restart_required')) == 1
interruption = events('warmup_interrupted')[0]
assert interruption['payload']['reason'] == 'hidden'
trigger = journal[interruption['payload']['triggerSequenceNumber'] - 1]
assert trigger['type'] == 'visibility_changed' and trigger['payload'] == {'visible': False}
restart = events('warmup_restart_required')[0]
assert restart['payload']['triggerSequenceNumber'] == interruption['sequenceNumber']
assert events('fixation_started')[0]['timestampMs'] < trigger['timestampMs']
warmup = [e for e in events('trial_scheduled') if e['payload']['trial']['phase'] == 'warmup']
assert [e['payload']['trial']['index'] for e in warmup] == list(range(8))
assert warmup[0]['sequenceNumber'] > restart['sequenceNumber']
assert not [e for e in events('trial_scheduled') if e['sequenceNumber'] < restart['sequenceNumber']]
finish_warmup, finish_scored = events('batch_finished')
assert finish_warmup['payload'] == {'phase': 'warmup', 'trialCount': 8}
assert finish_scored['payload'] == {'phase': 'scored', 'trialCount': 80}
for kind in ['stimulus_presented', 'stimulus_removed', 'trial_resolved']:
    fresh = [e for e in events(kind) if restart['sequenceNumber'] < e['sequenceNumber'] < finish_warmup['sequenceNumber']]
    assert [e['payload']['trialIndex'] for e in fresh] == list(range(8)), kind
protection = events('protection_started')[0]
completion = events('session_completed')[0]
assert finish_warmup['sequenceNumber'] < protection['sequenceNumber'] < finish_scored['sequenceNumber'] < completion['sequenceNumber']
assert completion['payload']['validity'] == 'valid'
assert events('protection_ended')[0]['sequenceNumber'] == completion['sequenceNumber'] + 1

browser = saved['browserEvents']
origin = next(e['timeOriginMs'] for e in browser if e.get('label') == 'I’m ready')
ready = next(e for e in browser if e.get('label') == 'I’m ready')
for label in ['I’m ready', 'Restart warm-up', 'Start scored task']:
    actions = [e for e in browser if e.get('label') == label]
    assert len(actions) == 1 and actions[0]['isTrusted'] is True
    assert actions[0]['hasFocus'] and actions[0]['visibilityState'] == 'visible'
def in_window(start, end, source=browser):
    return [e for e in source if e['timeOriginMs'] == origin and start <= e['performanceNowMs'] <= end]

hidden = [e for e in browser if e['type'] == 'visibilitychange' and e['visibilityState'] == 'hidden' and abs(e['performanceNowMs'] - trigger['timestampMs']) < 2]
assert len(hidden) == 1 and hidden[0]['isTrusted'] is True
pause_events = in_window(finish_warmup['timestampMs'], protection['timestampMs'])
pause_hides = [e for e in pause_events if e['type'] == 'visibilitychange' and e['visibilityState'] == 'hidden']
assert len(pause_hides) == 1 and pause_hides[0]['isTrusted'] is True
assert any(e['type'] == 'visibilitychange' and e['visibilityState'] == 'visible' and e['isTrusted'] is True for e in pause_events)
# Exposure/drafts are preexisting on this same origin: require exact preservation at pause.
for key in ['exposures', 'reservations', 'results', 'drafts']:
    assert before['installation'][key] == pause['installation'][key], key
assert sid not in pause['installation']['results'] and sid not in pause['installation']['drafts']

scored = [e for e in journal if protection['sequenceNumber'] < e['sequenceNumber'] <= completion['sequenceNumber']]
scheduled = [e for e in scored if e['type'] == 'trial_scheduled']
presented = [e for e in scored if e['type'] == 'stimulus_presented']
removed = [e for e in scored if e['type'] == 'stimulus_removed']
resolved = [e for e in scored if e['type'] == 'trial_resolved']
assert [e['payload']['trial']['index'] for e in scheduled] == list(range(80))
assert all(e['payload']['trial']['phase'] == 'scored' for e in scheduled)
assert [e['payload']['trial']['stimulus'] for e in scheduled] == r['form']['sequence']
for group in [presented, removed, resolved]:
    assert [e['payload']['trialIndex'] for e in group] == list(range(80))
assert [e['payload']['stimulus'] for e in presented] == r['form']['sequence']
assert [e['payload']['outcome']['stimulus'] for e in resolved] == r['form']['sequence']
assert not [e for e in scored if e['type'] in ['keydown', 'response_recorded', 'visibility_changed', 'focus_changed']]
form_id = r['form']['id']
assert form_id not in pause['installation']['exposures']
exposure = saved['installation']['exposures'][form_id]
assert exposure['sessionId'] == sid and exposure['certainty'] == 'confirmed'
assert form_id not in saved['installation']['reservations']
assert saved['installation']['exposures'] == reloaded['installation']['exposures']
assert saved['installation']['drafts'] == before['installation']['drafts']
assert r['summarySnapshot']['counts'] == {'hits': 0, 'misses': 60, 'withholds': 20, 'falseAlarms': 0}

run_window = in_window(ready['performanceNowMs'], completion['timestampMs'])
protected_window = in_window(protection['timestampMs'], completion['timestampMs'])
assert run_window
assert all((e['innerWidth'], e['innerHeight'], e['outerWidth'], e['outerHeight'], e['screenX'], e['screenY']) == (1512, 827, 1512, 948, 0, 34) for e in run_window)
assert not [e for e in run_window if e['type'] in ['resize','visualViewport.resize']]
assert all(e['visibilityState'] == 'visible' and e['hasFocus'] for e in protected_window)
samples = [e for e in protected_window if e['type'] == 'window_sample']
max_sample_gap = max(b['performanceNowMs'] - a['performanceNowMs'] for a,b in zip(samples,samples[1:]))
assert max_sample_gap < 2500
resize_events = [e for e in browser if e['type'] == 'resize']
assert all(e['performanceNowMs'] < ready['performanceNowMs'] for e in resize_events)
clusters = []
for e in resize_events:
    if not clusters or e['performanceNowMs'] - clusters[-1][-1]['performanceNowMs'] > 1000:
        clusters.append([])
    clusters[-1].append(e)
reload_origins = sorted(set(e['timeOriginMs'] for e in reloaded['browserEvents']))
assert len(reload_origins) == 2 and reload_origins[0] == origin
assert any(e.get('label') == 'Open original report' and e['isTrusted'] is True and e['timeOriginMs'] == reload_origins[1] for e in reloaded['browserEvents'])
# Numeric AX indexes and direct-report navigation controls differ, but report text must match.
def report_text(name):
    text = (ROOT/name).read_text()
    text = text[text.index('container Your Stop practice result'):text.index('text Original preparation exercises.')]
    import re
    return re.findall(r'\btext (.*)', text)
assert report_text('report-before-reload.txt') == report_text('report-after-reload.txt')

write('browser-events.json', reloaded['browserEvents'])
write('stop-journal.json', journal)
write('saved-record.json', r)
write('reopened-record.json', r2)
write('exposure-state.json', {label:{k:raw['installation'][k] for k in ['installationId','exposures','reservations']} for label,raw in [('before',before),('pause',pause),('saved',saved),('reloaded',reloaded)]})
write('viewport-during-run.json', run_window)
write('preparation-resizes.json', resize_events)
write('RECONCILIATION.json', {
 'scope':'One native warm-up interruption, restart, pause, valid completion, save and reload; not physical timing or browser certification',
 'sessionId':sid,'formId':form_id,'browserTimeOrigins':reload_origins,
 'trustedWarmupHide':hidden[0],'journalInterruption':interruption,'journalRestart':restart,
 'interruptionLocation':'Live warm-up initial fixation, before trial 0 was scheduled',
 'freshWarmupIndices':list(range(8)),'warmupCompletion':finish_warmup,
 'pauseHide':pause_hides[0],'pauseExposureUnchanged':True,'acceptedScoredStart':protection,
 'scoredScheduledPresentedRemovedResolved':80,'firstScoredPresentation':presented[0],
 'completion':completion,'journalCount':len(journal),'exposure':exposure,
 'viewport':{'inner':[1512,827],'outer':[1512,948],'screenPosition':[0,34],
  'runObservations':len(run_window),'protectedSamples':len(samples),'maxProtectedSampleGapMs':max_sample_gap,'liveResizeEvents':0,
  'preparationResizeClusters':[{'firstUtc':g[0]['utc'],'lastUtc':g[-1]['utc'],'count':len(g),'firstWidth':g[0]['innerWidth'],'lastWidth':g[-1]['innerWidth'],'minimumWidth':min(e['innerWidth'] for e in g)} for g in clusters]},
 'reloadComparison':{'sameResult':True,'sameJournal':True,'sameExposure':True,'sameVisibleReportText':True,'canonicalResultSha256':digest(r),'canonicalJournalSha256':digest(journal)},
 'limits':['Native app-bridge actions; not independently calibrated physical input.', 'No scored responses; no reaction-time or performance claim.', 'QA observer overhead unmeasured.', 'Pre-live guide window resizing retained; initiating actor unknown, maximization restored before warm-up.', 'No pre/post-onset cases repeated; no wider matrix, Chrome certification, M6-C completion or release claim.']})
print('PASS: trusted warm-up hide; fresh eight; pause preserved; all 80 scored; valid saved result; identical reopened record/journal/exposure/report text; 1512x827 throughout live journey.')
