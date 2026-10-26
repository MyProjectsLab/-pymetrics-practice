"""Original, deterministic Easy or Hard V1 draft forms and simple audit fixtures."""

import hashlib
import json
from pathlib import Path

OUT = Path('/private/tmp')
FORM_PATH = OUT / 'ASSESSMENT_PRACTICE_EASY_HARD_FORMS_V1_0_DRAFT.json'
FIXTURE_PATH = OUT / 'ASSESSMENT_PRACTICE_EASY_HARD_FIXTURES_V1_0_DRAFT.json'
PROBABILITIES = (12, 50, 88)
HARD_REWARDS = (124, 277, 430)


def draw(form_id: str, index: int, field: str) -> int:
    payload = f'Assessment Practice|Easy or Hard|V1.0|{form_id}|{index}|{field}'
    return int.from_bytes(hashlib.sha256(payload.encode('utf-8')).digest()[:8], 'big')


def entries(form_id: str):
    result = []
    for i in range(512):
        offer = {
            'index': i + 1,
            'probabilityPercent': PROBABILITIES[draw(form_id, i, 'probability') % 3],
            'hardOfferCents': HARD_REWARDS[draw(form_id, i, 'hard-reward') % 3],
            'fallbackTask': 'easy' if draw(form_id, i, 'fallback') % 2 == 0 else 'hard',
            'lotteryDrawBasisPoints': draw(form_id, i, 'lottery') % 10000,
        }
        if form_id == 'EH1' and i == 0:
            # Visible opening offer observed in the founder's saved practice run.
            # The hidden fallback and lottery draw remain original.
            offer['hardOfferCents'] = 124
        result.append(offer)
    return result


forms = {
    'schemaVersion': 'easy-hard-forms-v1.0-draft',
    'meaning': 'Original training offers and outcome draws; no provider distribution claim',
    'forms': [{'formId': f'EH{i}', 'entries': entries(f'EH{i}')} for i in range(1, 5)],
}
FORM_PATH.write_text(json.dumps(forms, separators=(',', ':'), ensure_ascii=False) + '\n')

fixtures = {'schemaVersion': 'easy-hard-fixtures-v1.0-draft', 'scenarios': []}
for form in forms['forms']:
    e = form['entries']
    for policy in ('always-easy', 'always-hard', 'alternate'):
        outcomes = []
        for j, offer in enumerate(e[:12]):
            choice = ('easy' if j % 2 == 0 else 'hard') if policy == 'alternate' else policy[7:]
            threshold = offer['probabilityPercent'] * 100
            won = offer['lotteryDrawBasisPoints'] < threshold
            earned = (100 if choice == 'easy' else offer['hardOfferCents']) if won else 0
            outcomes.append({
                'offerIndex': offer['index'], 'choice': choice, 'completedOnTime': True,
                'lotteryWon': won, 'earnedCents': earned,
            })
        fixtures['scenarios'].append({
            'formId': form['formId'], 'policy': policy,
            'sampleOnly': 'first 12 completed tasks, not a full timed game',
            'attempts': len(outcomes),
            'easyChoices': sum(o['choice'] == 'easy' for o in outcomes),
            'hardChoices': sum(o['choice'] == 'hard' for o in outcomes),
            'earnedCents': sum(o['earnedCents'] for o in outcomes),
            'outcomes': outcomes,
        })


def timed_session(form):
    """A complete, illustrative 120-second trace with choice, task and feedback time."""
    offers = form['entries']
    rows = []
    choice_onset = 0
    terminal_phase = ''
    while True:
        offer = offers[len(rows)]
        automatic = offer['index'] % 4 == 0
        choice_time = choice_onset + (5000 if automatic else 500)
        if choice_time >= 120000:
            terminal_phase = 'choice'
            break
        choice = offer['fallbackTask'] if automatic else ('easy' if offer['index'] % 2 else 'hard')
        task_onset = choice_time + 50
        if task_onset >= 120000:
            terminal_phase = 'choice_selected_before_global_expiry'
            break
        task_deadline = task_onset + (3000 if choice == 'easy' else 12000)
        forced_timeout = offer['index'] % 5 == 0
        planned_resolution = task_deadline if forced_timeout else task_onset + (500 if choice == 'easy' else 10000)
        global_timeout = planned_resolution >= 120000
        resolution = 120000 if global_timeout else planned_resolution
        complete = not (forced_timeout or global_timeout)
        won = offer['lotteryDrawBasisPoints'] < offer['probabilityPercent'] * 100 if complete else None
        earned = (100 if choice == 'easy' else offer['hardOfferCents']) if won else 0
        row = {
            'offerIndex': offer['index'], 'choiceOnsetMs': choice_onset,
            'choiceAtMs': choice_time, 'automaticChoice': automatic,
            'choice': choice, 'taskOnsetMs': task_onset,
            'taskDeadlineMs': task_deadline, 'resolutionMs': resolution,
            'durationMs': resolution - task_onset, 'completedOnTime': complete,
            'acceptedPresses': (5 if choice == 'easy' else 60) if complete else (0 if global_timeout else (4 if choice == 'easy' else 59)),
            'lotteryWon': won, 'earnedCents': earned,
            'reason': 'global_expiry' if global_timeout else ('task_timeout' if forced_timeout else ('won' if won else 'lottery_loss')),
        }
        rows.append(row)
        if global_timeout:
            terminal_phase = 'task'
            break
        feedback_end = resolution + 4000
        if feedback_end >= 120000:
            terminal_phase = 'feedback'
            break
        choice_onset = feedback_end
    summary = {
        'attempts': len(rows), 'completedOnTime': sum(r['completedOnTime'] for r in rows),
        'easyChoices': sum(r['choice'] == 'easy' for r in rows),
        'hardChoices': sum(r['choice'] == 'hard' for r in rows),
        'easyAttempts': sum(r['choice'] == 'easy' for r in rows),
        'hardAttempts': sum(r['choice'] == 'hard' for r in rows),
        'easyCompleted': sum(r['choice'] == 'easy' and r['completedOnTime'] for r in rows),
        'hardCompleted': sum(r['choice'] == 'hard' and r['completedOnTime'] for r in rows),
        'automaticChoices': sum(r['automaticChoice'] for r in rows),
        'earnedCents': sum(r['earnedCents'] for r in rows),
        'terminalElapsedMs': 120000, 'terminalPhase': terminal_phase,
    }
    return {'formId': form['formId'], 'scenario': 'complete_120_second_mixed', 'rows': rows, 'expectedReport': summary}


fixtures['timedScenarios'] = [timed_session(form) for form in forms['forms']]


def replayable_session(timed):
    """Native input events and expected ordered journal for one full timed run."""
    input_events = []
    journal = []
    form = next(f for f in forms['forms'] if f['formId'] == timed['formId'])
    form_hash = hashlib.sha256(json.dumps(form, separators=(',', ':'), ensure_ascii=False).encode('utf-8')).hexdigest()

    def add(kind, at, offer_index=None, **fields):
        phase = ('choice' if kind in ('offer_onset', 'choice_selected') else
                 'task' if kind in ('task_onset', 'press_accepted') else
                 'feedback' if kind in ('task_resolved', 'feedback_end') else 'complete')
        source = ('keyboard' if kind == 'press_accepted' else
                  'pointer' if kind == 'choice_selected' and not fields.get('automatic') else 'system')
        event = {
            'eventVersion': 'easy-hard-events-v1.0-draft',
            'attemptId': 'fixture-EH1-full', 'formId': timed['formId'],
            'formHash': form_hash, 'ownershipGeneration': 1,
            'sequence': len(journal) + 1, 'kind': kind, 'phase': phase,
            'elapsedMs': at, 'wallTimestampMs': 1767225600000 + at,
            'inputSource': source,
        }
        if offer_index is not None:
            event['offerIndex'] = offer_index
        event.update(fields)
        journal.append(event)

    for row in timed['rows']:
        index = row['offerIndex']
        offer = form['entries'][index - 1]
        selected_reward = 100 if row['choice'] == 'easy' else offer['hardOfferCents']
        add('offer_onset', row['choiceOnsetMs'], index,
            probabilityPercent=offer['probabilityPercent'], easyOfferCents=100,
            hardOfferCents=offer['hardOfferCents'],
            choiceDeadlineMs=row['choiceOnsetMs'] + 5000)
        if not row['automaticChoice']:
            input_events.append({'kind': 'choice_click', 'offerIndex': index,
                                 'handlerCaptureMs': row['choiceAtMs'], 'choice': row['choice']})
        add('choice_selected', row['choiceAtMs'], index,
            actionId=f'{index}:choice', choice=row['choice'],
            automatic=row['automaticChoice'])
        add('task_onset', row['taskOnsetMs'], index,
            choice=row['choice'], automatic=row['automaticChoice'],
            probabilityPercent=offer['probabilityPercent'],
            selectedRewardCents=selected_reward,
            taskOnsetMs=row['taskOnsetMs'], taskDeadlineMs=row['taskDeadlineMs'],
            acceptedPresses=0)
        count = row['acceptedPresses']
        for n in range(1, count + 1):
            # Complete rows end with the decisive release at the recorded
            # resolution. Failed rows leave the next press outside the window.
            span = row['durationMs'] if row['completedOnTime'] else row['durationMs'] - 100
            offset = span * n // (count if row['completedOnTime'] else count + 1)
            up = row['taskOnsetMs'] + offset
            down = up - 30
            assert down >= row['taskOnsetMs'] and up < row['taskDeadlineMs'] + int(row['completedOnTime'])
            press_id = f'{index}:{n}'
            input_events.append({'kind': 'space_keydown', 'offerIndex': index,
                                 'pressId': press_id, 'handlerCaptureMs': down, 'repeat': False})
            input_events.append({'kind': 'space_keyup', 'offerIndex': index,
                                 'pressId': press_id, 'handlerCaptureMs': up})
            add('press_accepted', up, index,
                actionId=press_id, pressId=press_id,
                choice=row['choice'], taskOnsetMs=row['taskOnsetMs'],
                taskDeadlineMs=row['taskDeadlineMs'], acceptedPresses=n)
        add('task_resolved', row['resolutionMs'], index,
            choice=row['choice'], probabilityPercent=offer['probabilityPercent'],
            selectedRewardCents=selected_reward,
            taskOnsetMs=row['taskOnsetMs'], taskDeadlineMs=row['taskDeadlineMs'],
            acceptedPresses=row['acceptedPresses'],
            reason=row['reason'], completedOnTime=row['completedOnTime'],
            lotteryWon=row['lotteryWon'],
            earnedCents=row['earnedCents'])
        if row['resolutionMs'] + 4000 < 120000:
            add('feedback_end', row['resolutionMs'] + 4000, index)
    if timed['expectedReport']['terminalPhase'] == 'choice':
        index = len(timed['rows']) + 1
        offer = form['entries'][index - 1]
        onset = timed['rows'][-1]['resolutionMs'] + 4000
        add('offer_onset', onset, index,
            probabilityPercent=offer['probabilityPercent'], easyOfferCents=100,
            hardOfferCents=offer['hardOfferCents'], choiceDeadlineMs=onset + 5000)
    add('global_expired', 120000, phase=timed['expectedReport']['terminalPhase'])
    input_events.sort(key=lambda e: (e['handlerCaptureMs'], 0 if e['kind'] == 'space_keydown' else 1))
    assert all(journal[i]['elapsedMs'] <= journal[i + 1]['elapsedMs'] for i in range(len(journal) - 1))
    return {
        'formId': timed['formId'], 'scenario': 'full_session_native_action_replay',
        'timingModel': 'Ideal durable confirmations at captured event time; task onset 50 ms after choice; feedback visible at resolution for 4000 ms. Deadline cases separately cover delayed writes.',
        'inputEvents': input_events, 'expectedJournal': journal,
        'expectedReport': dict(timed['expectedReport'], formId=timed['formId'],
                               formHash=form_hash, status='complete',
                               inputContext='standard_keyboard'),
    }


fixtures['replayableSessions'] = [replayable_session(fixtures['timedScenarios'][0])]
fixtures['deadlineScenarios'] = [
    {'id': 'choice_eligible_write_after_deadline', 'formId': 'EH1', 'offerIndex': 2,
     'choiceOnsetMs': 0, 'handlerCaptureMs': 4999, 'writeConfirmedMs': 5001,
     'callbackOrders': ['timeout_before_write_confirmation', 'write_confirmation_before_timeout'],
     'chosenTask': 'hard', 'automaticChoice': False},
    {'id': 'choice_exact_deadline', 'formId': 'EH1', 'offerIndex': 2,
     'choiceOnsetMs': 0, 'handlerCaptureMs': 5000, 'writeConfirmedMs': 5001,
     'callbackOrders': ['timeout_before_write_confirmation', 'write_confirmation_before_timeout'],
     'chosenTask': 'easy', 'automaticChoice': True},
    {'id': 'fifth_release_eligible_write_after_deadline', 'formId': 'EH1', 'offerIndex': 1,
     'taskOnsetMs': 0, 'fifthKeyupHandlerCaptureMs': 2999, 'writeConfirmedMs': 3001,
     'callbackOrders': ['timeout_before_write_confirmation', 'write_confirmation_before_timeout'],
     'completedOnTime': True, 'earnedCents': 100},
    {'id': 'fifth_release_exact_deadline', 'formId': 'EH1', 'offerIndex': 1,
     'taskOnsetMs': 0, 'fifthKeyupHandlerCaptureMs': 3000, 'writeConfirmedMs': 3001,
     'callbackOrders': ['timeout_before_write_confirmation', 'write_confirmation_before_timeout'],
     'completedOnTime': False, 'earnedCents': 0},
    {'id': 'global_expiry_during_choice', 'formId': 'EH1', 'offerIndex': 1,
     'choiceOnsetMs': 118000, 'globalDeadlineMs': 120000,
     'attemptsAdded': 0, 'earnedCentsAdded': 0},
    {'id': 'global_expiry_during_task', 'formId': 'EH1', 'offerIndex': 1,
     'taskOnsetMs': 119000, 'globalDeadlineMs': 120000, 'acceptedPresses': 4,
     'attemptsAdded': 1, 'completedOnTime': False, 'earnedCentsAdded': 0},
    {'id': 'choice_commits_after_global_before_task_onset', 'formId': 'EH1', 'offerIndex': 2,
     'choiceOnsetMs': 117000, 'handlerCaptureMs': 119999, 'writeConfirmedMs': 120001,
     'callbackOrders': ['global_timer_before_write_confirmation', 'write_confirmation_before_global_timer'],
     'chosenTask': 'hard', 'choicesAdded': 1, 'attemptsAdded': 0,
     'terminalReason': 'global_expired_after_choice', 'earnedCentsAdded': 0},
    {'id': 'choice_write_absent_after_global', 'formId': 'EH1', 'offerIndex': 2,
     'choiceOnsetMs': 117000, 'handlerCaptureMs': 119999,
     'readbackAtMs': 120001, 'readbackFoundChoice': False,
     'callbackOrders': ['global_timer_before_readback', 'readback_before_global_timer'],
     'choicesAdded': 0, 'attemptsAdded': 0,
     'terminalReason': 'global_expired_in_choice', 'earnedCentsAdded': 0},
]
for case in fixtures['deadlineScenarios']:
    case_id = case['id']
    if case_id.startswith('choice_') and 'handlerCaptureMs' in case:
        case['inputEvents'] = [{'kind': 'choice_click', 'handlerCaptureMs': case['handlerCaptureMs'],
                                'choice': 'hard'}]
        case['expectedJournalFragment'] = [
            {'kind': 'choice_selected', 'elapsedMs': 5000 if case_id == 'choice_exact_deadline' else case['handlerCaptureMs'],
             'choice': case.get('chosenTask', 'hard'), 'automatic': case_id == 'choice_exact_deadline'},
        ] if case_id not in ('choice_write_absent_after_global', 'choice_commits_after_global_before_task_onset') else [
            {'kind': 'choice_selected', 'elapsedMs': case['handlerCaptureMs'], 'choice': 'hard', 'automatic': False},
            {'kind': case['terminalReason'], 'elapsedMs': 120000},
        ] if case_id == 'choice_commits_after_global_before_task_onset' else [
            {'kind': 'global_expired_in_choice', 'elapsedMs': 120000},
        ]
    elif case_id.startswith('fifth_release'):
        ups = [500, 1000, 1500, 2000, case['fifthKeyupHandlerCaptureMs']]
        case['inputEvents'] = [item for n, up in enumerate(ups, 1) for item in (
            {'kind': 'space_keydown', 'pressId': n, 'handlerCaptureMs': up - 30, 'repeat': False},
            {'kind': 'space_keyup', 'pressId': n, 'handlerCaptureMs': up},
        )]
        accepted = 5 if case['completedOnTime'] else 4
        case['expectedJournalFragment'] = [
            {'kind': 'press_accepted', 'elapsedMs': up, 'acceptedPresses': n}
            for n, up in enumerate(ups[:accepted], 1)
        ] + [{'kind': 'task_resolved', 'elapsedMs': 2999 if case['completedOnTime'] else 3000,
              'completedOnTime': case['completedOnTime'], 'earnedCents': case['earnedCents']}]
    elif case_id == 'global_expiry_during_choice':
        case['inputEvents'] = []
        case['expectedJournalFragment'] = [{'kind': 'global_expired_in_choice', 'elapsedMs': 120000}]
    elif case_id == 'global_expiry_during_task':
        ups = [119200, 119400, 119600, 119800]
        case['inputEvents'] = [item for n, up in enumerate(ups, 1) for item in (
            {'kind': 'space_keydown', 'pressId': n, 'handlerCaptureMs': up - 30, 'repeat': False},
            {'kind': 'space_keyup', 'pressId': n, 'handlerCaptureMs': up},
        )]
        case['expectedJournalFragment'] = [
            {'kind': 'press_accepted', 'elapsedMs': up, 'acceptedPresses': n}
            for n, up in enumerate(ups, 1)
        ] + [{'kind': 'task_resolved', 'elapsedMs': 120000,
              'completedOnTime': False, 'earnedCents': 0, 'reason': 'global_expiry'}]
FIXTURE_PATH.write_text(json.dumps(fixtures, separators=(',', ':'), ensure_ascii=False) + '\n')

for p in (FORM_PATH, FIXTURE_PATH):
    print(p.name, hashlib.sha256(p.read_bytes()).hexdigest(), p.stat().st_size)
for form in forms['forms']:
    e = form['entries']
    print(form['formId'],
          {p: sum(o['probabilityPercent'] == p for o in e) for p in PROBABILITIES},
          {r: sum(o['hardOfferCents'] == r for o in e) for r in HARD_REWARDS},
          {t: sum(o['fallbackTask'] == t for o in e) for t in ('easy', 'hard')},
          'all-pairs-each-quarter', all(
              len({(o['probabilityPercent'], o['hardOfferCents']) for o in e[q:q + 128]}) == 9
              for q in (0, 128, 256, 384)))
