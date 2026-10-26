"""Independent arithmetic and storage reconciliation for the native Chrome chain.

Reads captured JSON only. It imports no Assessment Practice implementation code.
"""

import hashlib
import gzip
import json
import math
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parent
STAGES = ("before", "pause", "baseline", "drill", "reserved", "retest", "pre-reload", "reloaded")


def read(stage):
    with gzip.open(ROOT / f"{stage}.raw.json.gz", "rt") as stream:
        return json.load(stream)


def write(name, value):
    (ROOT / name).write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n")


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()


def digest(value):
    return hashlib.sha256(canonical(value)).hexdigest()


def same_number(actual, expected):
    if expected is None:
        assert actual is None, (actual, expected)
    else:
        assert math.isclose(actual, expected, rel_tol=0, abs_tol=1e-8), (actual, expected)


def quartile(numbers, p):
    if not numbers:
        return None
    ordered = sorted(numbers)
    position = (len(ordered) - 1) * p
    lower = math.floor(position)
    upper = math.ceil(position)
    return ordered[lower] + (ordered[upper] - ordered[lower]) * (position - lower)


def timing(outcomes, anomalies, deadline):
    clean = [e["payload"]["outcome"]["responseTimeMs"] for e in outcomes
             if e["payload"]["outcome"]["kind"] == "hit"
             and e["payload"]["trialIndex"] not in anomalies
             and 100 <= e["payload"]["outcome"]["responseTimeMs"] <= deadline]
    q1, median, q3 = (quartile(clean, p) for p in (0.25, 0.5, 0.75))
    return {"count": len(clean), "q1": q1, "median": median,
            "q3": q3, "iqr": None if q1 is None else q3 - q1}


def counts(outcomes):
    kinds = Counter(e["payload"]["outcome"]["kind"] for e in outcomes)
    return {"hits": kinds["hit"], "misses": kinds["miss"],
            "withholds": kinds["correct_withhold"], "falseAlarms": kinds["false_alarm"]}


def ordered(events, session_id):
    assert [e["sequenceNumber"] for e in events] == list(range(1, len(events) + 1))
    assert all(e["sessionId"] == session_id and e["schemaVersion"] in ("stop_event_v1", "stop_engine_event_v1") for e in events)
    assert all(a["timestampMs"] <= b["timestampMs"] for a, b in zip(events, events[1:]))
    assert len([e for e in events if e["type"] == "session_invalidated"]) == 0


def score_result(result):
    events = result["events"]
    ordered(events, result["sessionId"])
    assert result["validity"] == "valid" and result["storageMode"] == "persistent_local"
    assert len([e for e in events if e["type"] == "session_completed"]) == 1
    protection = next(e for e in events if e["type"] == "protection_started")
    scored = [e for e in events if e["sequenceNumber"] > protection["sequenceNumber"]]
    warmup = [e for e in events if e["sequenceNumber"] < protection["sequenceNumber"]]
    schedules = [e for e in events if e["type"] == "trial_scheduled"]
    assert [e["payload"]["trial"]["index"] for e in schedules if e["payload"]["trial"]["phase"] == "warmup"] == list(range(8))
    scored_schedules = [e for e in schedules if e["payload"]["trial"]["phase"] == "scored"]
    assert [e["payload"]["trial"]["index"] for e in scored_schedules] == list(range(80))
    assert [e["payload"]["trial"]["stimulus"] for e in scored_schedules] == result["form"]["sequence"]
    assert len([e for e in warmup if e["type"] == "trial_resolved"]) == 8
    outcomes = [e for e in scored if e["type"] == "trial_resolved"]
    assert [e["payload"]["trialIndex"] for e in outcomes] == list(range(80))
    assert [e["payload"]["outcome"]["stimulus"] for e in outcomes] == result["form"]["sequence"]
    assert len([e for e in scored if e["type"] == "stimulus_presented"]) == 80
    assert len([e for e in scored if e["type"] == "stimulus_removed"]) == 80
    c = counts(outcomes)
    assert c == result["summarySnapshot"]["counts"]
    assert c["hits"] + c["misses"] == 60 and c["withholds"] + c["falseAlarms"] == 20
    rates = {"hit": c["hits"] / 60, "miss": c["misses"] / 60,
             "withhold": c["withholds"] / 20, "falseAlarm": c["falseAlarms"] / 20,
             "overall": (c["hits"] + c["withholds"]) / 80}
    for key, value in rates.items():
        same_number(result["summarySnapshot"]["rates"][key], value)
    anomalies = {e["payload"]["trialIndex"] for e in scored if e["type"] == "timing_anomaly"}
    all_timing = timing(outcomes, anomalies, 1000)
    for key, value in all_timing.items():
        same_number(result["summarySnapshot"]["timing"][key], value)
    blocks = []
    for number in range(4):
        subset = outcomes[number * 20:(number + 1) * 20]
        block = result["summarySnapshot"]["blocks"][number]
        bc = counts(subset)
        assert block["number"] == number + 1 and block["counts"] == bc
        assert bc["hits"] + bc["misses"] == 15 and bc["withholds"] + bc["falseAlarms"] == 5
        bt = timing(subset, anomalies, 1000)
        for key, value in bt.items():
            same_number(block["timing"][key], value)
        same_number(block["accuracy"], (bc["hits"] + bc["withholds"]) / 20)
        blocks.append({"number": number + 1, "counts": bc, "timing": bt})
    return {"sessionId": result["sessionId"], "mode": result["mode"], "formId": result["form"]["id"],
            "validity": result["validity"], "eventCount": len(events), "counts": c,
            "rates": rates, "timing": all_timing, "blocks": blocks,
            "inputEvents": [{"sequenceNumber": e["sequenceNumber"], "type": e["type"], "payload": e["payload"]}
                            for e in scored if e["type"] in ("response_accepted", "response_ignored")],
            "protectionStartMs": protection["timestampMs"],
            "completionMs": next(e for e in events if e["type"] == "session_completed")["timestampMs"],
            "recordSha256": digest(result), "journalSha256": digest(events)}


def score_drill(attempt):
    events = attempt["events"]
    ordered(events, attempt["id"])
    assert attempt["valid"] and attempt["drillId"] == "detection" and attempt["completedBlocks"] == 3
    schedules = [e for e in events if e["type"] == "trial_scheduled"]
    outcomes = [e for e in events if e["type"] == "trial_resolved"]
    assert [e["payload"]["trial"]["index"] for e in schedules] == list(range(72))
    assert [e["payload"]["trialIndex"] for e in outcomes] == list(range(72))
    assert [e["payload"]["trial"]["stimulus"] for e in schedules] == [e["payload"]["outcome"]["stimulus"] for e in outcomes]
    blocks = []
    for index, deadline in enumerate((1200, 1100, 1000)):
        subset = outcomes[index * 24:(index + 1) * 24]
        c = counts(subset)
        assert c["hits"] + c["misses"] == 18 and c["withholds"] + c["falseAlarms"] == 6
        anomalies = {e["payload"]["trialIndex"] for e in events if e["type"] == "timing_anomaly"}
        blocks.append({"number": index + 1, "counts": c, "timing": timing(subset, anomalies, deadline)})
    assert [b["counts"]["hits"] for b in blocks] == [1, 1, 0]
    assert [b["counts"]["withholds"] for b in blocks] == [6, 6, 5]
    assert len([e for e in events if e["type"] == "batch_finished"]) == 3
    assert len([e for e in events if e["type"] == "session_completed"]) == 1
    return {"id": attempt["id"], "drillId": attempt["drillId"], "valid": True,
            "eventCount": len(events), "blocks": blocks, "counts": counts(outcomes),
            "protectionStartMs": next(e for e in events if e["type"] == "protection_started")["timestampMs"],
            "completionMs": next(e for e in events if e["type"] == "session_completed")["timestampMs"],
            "attemptSha256": digest(attempt), "journalSha256": digest(events)}


raw = {name: read(name) for name in STAGES}
state = {name: raw[name]["installation"] for name in STAGES}
assert all(not state["before"][key] for key in ("results", "drafts", "chains", "exposures", "reservations"))
assert state["before"]["installationId"] == state["reloaded"]["installationId"]
assert all(not state["pause"][key] for key in ("results", "drafts", "chains", "exposures", "reservations"))
assert len(state["baseline"]["results"]) == 1
assert len(state["drill"]["chains"]) == 1
assert len(state["reserved"]["reservations"]) == 1
assert len(state["retest"]["results"]) == 2
assert state["pre-reload"] == state["reloaded"]
assert not state["reloaded"]["drafts"] and not state["reloaded"]["retiredChains"]

baseline = next(r for r in state["reloaded"]["results"].values() if r["mode"] == "baseline")
retest = next(r for r in state["reloaded"]["results"].values() if r["mode"] == "retest")
assert state["baseline"]["results"][baseline["sessionId"]] == baseline
assert state["drill"]["results"][baseline["sessionId"]] == baseline
assert state["reserved"]["results"][baseline["sessionId"]] == baseline
bs, rs = score_result(baseline), score_result(retest)

chain_id, chain = next(iter(state["reloaded"]["chains"].items()))
assert state["reloaded"]["activeChainId"] == chain_id
assert chain["id"] == chain_id and chain["status"] == "complete"
assert chain["baseline"] == baseline and chain["retest"] == retest
assert len(chain["drillAttempts"]) == 1 and not chain["retestAttempts"][:-1]
assert chain["retestAttempts"] == [{"sessionId": retest["sessionId"], "formId": retest["form"]["id"], "valid": True}]
assert state["drill"]["chains"][chain_id]["drillAttempts"][0] == chain["drillAttempts"][0]
assert chain["recommendation"]["version"] == "stop_drill_router_v2"
assert chain["recommendation"]["drillId"] == "detection"
assert bs["counts"] == {"hits": 0, "misses": 60, "withholds": 20, "falseAlarms": 0}
assert chain["recommendation"]["candidates"][1]["metrics"]["missRate"] == 1
ds = score_drill(chain["drillAttempts"][0])

reservation = next(iter(state["reserved"]["reservations"].values()))
assert reservation["sessionId"] == retest["sessionId"]
assert reservation["formId"] == retest["form"]["id"] and reservation["chainId"] == chain_id
assert reservation["armed"] is False and reservation["formId"] not in state["reserved"]["exposures"]
assert not state["reloaded"]["reservations"]
assert set(state["reloaded"]["exposures"]) == {baseline["form"]["id"], retest["form"]["id"]}
for result in (baseline, retest):
    marker = state["reloaded"]["exposures"][result["form"]["id"]]
    assert marker["sessionId"] == result["sessionId"] and marker["certainty"] == "confirmed"
assert baseline["form"]["id"] != retest["form"]["id"]
for key in ("specificationVersion", "scoringVersion"):
    assert baseline[key] == retest[key]
for key in ("binding", "visualProfile", "physicalKeyboard"):
    assert baseline["setup"][key] == retest["setup"][key]

origin = next(e["timeOriginMs"] for e in raw["before"]["browserEvents"] if e["type"] == "probe_loaded")
browser = raw["reloaded"]["browserEvents"]
viewport = {}
for label, summary in (("baseline", bs), ("drill", ds), ("retest", rs)):
    sample = [e for e in browser if e["timeOriginMs"] == origin and e["href"] == "http://127.0.0.1:5593/"
              and summary["protectionStartMs"] <= e["performanceNowMs"] <= summary["completionMs"]]
    assert sample and all((e["innerWidth"], e["innerHeight"]) == (1512, 827) for e in sample)
    assert all(e["visibilityState"] == "visible" and e["hasFocus"] for e in sample)
    assert not [e for e in sample if e["type"] in ("resize", "visualViewport.resize", "visibilitychange", "pagehide", "freeze")]
    viewport[label] = {"sampleCount": len(sample), "cssPixels": [1512, 827],
                       "firstUtc": sample[0]["utc"], "lastUtc": sample[-1]["utc"]}
assert len({e["timeOriginMs"] for e in browser if e["type"] == "probe_loaded"}) == 2

comparison = {"baselineOverallExact": bs["rates"]["overall"],
              "retestOverallExact": rs["rates"]["overall"],
              "deltaPercentagePointsExact": (rs["rates"]["overall"] - bs["rates"]["overall"]) * 100,
              "baselineHitRateExact": bs["rates"]["hit"], "retestHitRateExact": rs["rates"]["hit"],
              "baselineWithholdRateExact": bs["rates"]["withhold"], "retestWithholdRateExact": rs["rates"]["withhold"],
              "visibleRounded": {"overall": "25% to 26% (+1 percentage points)",
                                 "go": "0% to 2%", "noGo": "100% to 100%"},
              "timingComparisonSuppressed": bs["timing"]["median"] is None}
assert math.isclose(comparison["deltaPercentagePointsExact"], 1.25)
assert comparison["timingComparisonSuppressed"]

for name, value in (("baseline-journal.json", baseline["events"]), ("drill-journal.json", chain["drillAttempts"][0]["events"]),
                    ("retest-journal.json", retest["events"]), ("baseline-record.json", baseline),
                    ("drill-attempt.json", chain["drillAttempts"][0]), ("retest-record.json", retest)):
    write(name, value)
write("RECONCILIATION.json", {"scope": "One native Mac Chrome tool-dispatched guide-baseline-drill-retest-comparison-history-reload journey",
                              "startingQaHead": "70c7286f0d8059b352d9a1ab9baecd476945fc92",
                              "productHead": "f6b8ae05ab024e603ebe3fc8e1a42f71dd4b14b1",
                              "installationId": state["reloaded"]["installationId"],
                              "baseline": bs, "drill": ds, "retest": rs, "chainId": chain_id,
                              "recommendation": chain["recommendation"], "reservationBeforeExposure": reservation,
                              "exposuresAfterCompletion": state["reloaded"]["exposures"],
                              "comparison": comparison, "viewportObserved": viewport,
                              "prePostReloadInstallationIdentical": True,
                              "installationSha256": digest(state["reloaded"]),
                              "limitations": ["Tool-dispatched scored key input; no human physical-keyboard response attestation.",
                                              "Browser/journal times do not measure physical input latency or display scanout.",
                                              "One Chrome/Mac/display journey; no browser/device certification.",
                                              "QA observer capture and localStorage overhead were not calibrated."]})
print("PASS: independent journal, scoring, drill, reservation, exposure, chain, viewport, comparison, and reload reconciliation")
