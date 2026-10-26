"""Independent semantic checks for the Money Exchange 1 packet fixtures.

This oracle reads generated JSON only. It does not import the generator or derive
exposure expectations from its operationFacts table.
"""
import hashlib
import json
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / 'docs/specifications'
forms = json.loads((ROOT / 'ASSESSMENT_PRACTICE_MONEY_EXCHANGE_1_FORMS_V1_0_DRAFT.json').read_text())
packet = json.loads((ROOT / 'ASSESSMENT_PRACTICE_MONEY_EXCHANGE_1_FIXTURES_V1_0_DRAFT.json').read_text())
for item in (forms, packet):
    payload = {k: v for k, v in item.items() if k != 'payloadSha256'}
    encoded = json.dumps(payload, separators=(',', ':'), ensure_ascii=False).encode()
    assert hashlib.sha256(encoded).hexdigest() == item['payloadSha256']
assert forms['payloadSha256'] == 'cf4c07b085e883bce0ddcaea98fd4a5e4571ebf968a9ad1f440d81da40461cb0'
assert len(packet['cases']) == 36
for row in packet['cases']:
    sent = row['sentCents']
    pot = sent * 3
    returned = int((Decimal(pot) * Decimal(row['returnBps']) / Decimal(10000)).quantize(Decimal(1), rounding=ROUND_HALF_UP))
    assert (row['potCents'], row['returnedCents'], row['selfCents'], row['partnerCents']) == (pot, returned, 1000 - sent + returned, pot - returned)
assert (packet['filmedExample']['sentCents'], packet['filmedExample']['returnedCents'], packet['filmedExample']['selfCents'], packet['filmedExample']['partnerCents']) == (500, 615, 1115, 885)

a = packet['authority']
assert a['exposureOrder'] == ['not_revealed', 'possibly_revealed', 'captured_visible']
rank = {value: i for i, value in enumerate(a['exposureOrder'])}
points = a['returnExposurePoints']
assert len(points) == 6
expected_exposure = ['not_revealed', 'possibly_revealed', 'captured_visible', 'captured_visible', 'captured_visible', 'captured_visible']
expected_events = [False, False, False, False, True, True]
assert [row['exposure'] for row in points] == expected_exposure
assert [row['event'] for row in points] == expected_events
assert all(rank[right['exposure']] >= rank[left['exposure']] for left, right in zip(points, points[1:]))
for branch in ('positive', 'zero'):
    for intent in ('restart', 'close'):
        rows = [row for row in a['returnExposureCases'] if row['intent'] == intent]
        assert len(rows) == 6
        for row, exposure, event in zip(rows, expected_exposure, expected_events):
            assert row['exposure'] == exposure and row['event'] == event
            assert row['formConsumed'] and not row['retryAfterWithdrawal']
            assert row['terminal'] == 'ended_incomplete'
            assert row['routeAfterSettlement'] == ('ready' if intent == 'restart' else 'library')
            assert ('return_presented' in row['journalIncludes']) == event
            assert 'completed' not in row['journalIncludes']
return_cases = [row for row in a['cancellationCases'] if row['operation'] == 'return']
assert len(return_cases) == 18
for branch in ('positive', 'zero'):
    for row in return_cases:
        assert row['exposure'] == 'captured_visible' and row['formConsumed']
        assert row['terminal'] == 'ended_incomplete' and not row['oldCallbackMayRestorePlay']
        assert ('return_presented' in row['expectedJournal']) == (row['durableOrder'] == 'commit_first')
        assert not {'fairness_committed', 'fairness_not_applicable', 'completed'} & set(row['expectedJournal'])
        assert row['route'] == {'restart': 'ready', 'close': 'library', 'technical': 'review'}[row['intent']]
abort = {row['point']: row for row in a['returnAbortCases']}
assert not abort['capture_failed']['returnWriteAdmissible']
assert abort['capture_failed']['retryKind'] == 'presentation_check_same_view'
assert abort['capture_succeeded_write_definitively_aborted']['exposure'] == 'captured_visible'
assert abort['capture_succeeded_write_definitively_aborted']['retryKind'] == 'exact_return_request'
assert abort['capture_succeeded_write_definitively_aborted_then_withdrawn']['exposure'] == 'captured_visible'
assert not abort['capture_succeeded_write_definitively_aborted_then_withdrawn']['mayRetrySameRequest']
assert len(a['exposureRecoveryCases']) == 4
assert all(row['exposure'] == 'captured_visible' for row in a['exposureRecoveryCases'])
termination = {row['point']: row for row in a['terminationExposureCases']}
assert termination['captured_metadata_persisted']['reloadExposure'] == 'captured_visible'
assert termination['captured_only_in_lost_document_memory']['reloadExposure'] == 'possibly_revealed'
assert all(row['consumedForm'] and not row['scoredResume'] for row in termination.values())
assert len(a['routeCases']) == 28 and len(a['deletionCases']) == 28
for outcome in ('incomplete_confirmed', 'completed_confirmed'):
    routes = {row['intent']: row for row in a['routeCases'] if row['outcome'] == outcome}
    assert routes['restart']['view'] == 'ready' and routes['close']['view'] == 'library'
assert len(a['cancellationCases']) == 90
for row in a['cancellationCases']:
    if row['operation'] == 'terminal' and row['terminal'] == 'completed':
        journal = row['expectedJournal']
        assert ('fairness_committed' in journal) != ('fairness_not_applicable' in journal)
print('PASS: 36 Decimal cases, 24 reveal projections, 36 return cancellation projections, monotone exposure, recovery, routes and deletion')
