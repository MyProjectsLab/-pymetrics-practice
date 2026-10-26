"""Independent reconciliation of captured native Chrome baseline evidence.

Reads the downloaded JSON exports only; imports no product implementation code.
Browser and journal clock comparisons are internal trace alignment, not physical
input-latency or display-scanout measurements.
"""

from collections import Counter
import gzip
import hashlib
import json
import math
from pathlib import Path


ROOT = Path(__file__).resolve().parent


def read(name):
    with gzip.open(ROOT / name, "rt") as stream:
        return json.load(stream)


def write(name, value):
    (ROOT / name).write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n")


def sha(value):
    data = json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()
    return hashlib.sha256(data).hexdigest()


def equal_number(actual, expected):
    assert math.isclose(actual, expected, rel_tol=0, abs_tol=1e-8), (actual, expected)


def quartile(numbers, proportion):
    ordered = sorted(numbers)
    if not ordered:
        return None
    position = (len(ordered) - 1) * proportion
    lower = math.floor(position)
    upper = math.ceil(position)
    return ordered[lower] + (ordered[upper] - ordered[lower]) * (position - lower)


def timing(outcomes, anomalies):
    clean = [event["payload"]["outcome"]["responseTimeMs"] for event in outcomes
             if event["payload"]["outcome"]["kind"] == "hit"
             and event["payload"]["trialIndex"] not in anomalies
             and 100 <= event["payload"]["outcome"]["responseTimeMs"] <= 1000]
    q1, median, q3 = (quartile(clean, p) for p in (0.25, 0.5, 0.75))
    return {"count": len(clean), "q1": q1, "median": median,
            "q3": q3, "iqr": None if q1 is None else q3 - q1}


def counts(outcomes):
    kinds = Counter(event["payload"]["outcome"]["kind"] for event in outcomes)
    return {"hits": kinds["hit"], "misses": kinds["miss"],
            "withholds": kinds["correct_withhold"], "falseAlarms": kinds["false_alarm"]}


before = read("before.raw.json.gz")
interrupted = read("interrupted.raw.json.gz")
complete = read("complete.raw.json.gz")
reloaded = read("reloaded.raw.json.gz")
states = [stage["installation"] for stage in (before, interrupted, complete, reloaded)]
assert all(states[0][key] == {} for key in ("results", "drafts", "chains", "exposures", "reservations"))
assert all(states[1][key] == {} for key in ("results", "drafts", "chains", "exposures", "reservations"))
assert states[1]["preparationEvidence"]
assert states[2] == states[3]
assert len(states[2]["results"]) == 1 and not states[2]["drafts"]
assert not states[2]["chains"] and not states[2]["reservations"]

result = next(iter(states[2]["results"].values()))
assert result["mode"] == "baseline" and result["validity"] == "valid"
assert result["storageMode"] == "persistent_local"
assert result["setup"]["binding"]["code"] == "Space"
assert result["setup"]["visualProfile"] == "standard"
assert result["setup"]["physicalKeyboard"] is True
events = result["events"]
assert len(events) == 766
assert [event["sequenceNumber"] for event in events] == list(range(1, len(events) + 1))
assert all(event["sessionId"] == result["sessionId"] for event in events)
assert all(a["timestampMs"] <= b["timestampMs"] for a, b in zip(events, events[1:]))
assert not [event for event in events if event["type"] in ("session_invalidated", "timing_anomaly")]
assert len([event for event in events if event["type"] == "session_completed"]) == 1
protection = next(event for event in events if event["type"] == "protection_started")
completion = next(event for event in events if event["type"] == "session_completed")
warmup = [event for event in events if event["sequenceNumber"] < protection["sequenceNumber"]]
scored = [event for event in events if event["sequenceNumber"] > protection["sequenceNumber"]]
schedules = [event for event in events if event["type"] == "trial_scheduled"]
warmup_schedules = [event for event in schedules if event["payload"]["trial"]["phase"] == "warmup"]
scored_schedules = [event for event in schedules if event["payload"]["trial"]["phase"] == "scored"]
assert [event["payload"]["trial"]["index"] for event in warmup_schedules] == list(range(8))
assert [event["payload"]["trial"]["index"] for event in scored_schedules] == list(range(80))
assert [event["payload"]["trial"]["stimulus"] for event in scored_schedules] == result["form"]["sequence"]
assert len([event for event in warmup if event["type"] == "trial_resolved"]) == 8
outcomes = [event for event in scored if event["type"] == "trial_resolved"]
assert [event["payload"]["trialIndex"] for event in outcomes] == list(range(80))
assert [event["payload"]["outcome"]["stimulus"] for event in outcomes] == result["form"]["sequence"]
assert len([event for event in scored if event["type"] == "stimulus_presented"]) == 80
assert len([event for event in scored if event["type"] == "stimulus_removed"]) == 80

summary = result["summarySnapshot"]
overall = counts(outcomes)
assert overall == summary["counts"] == {"hits": 60, "misses": 0, "withholds": 19, "falseAlarms": 1}
rates = {"hit": overall["hits"] / 60, "miss": overall["misses"] / 60,
         "withhold": overall["withholds"] / 20, "falseAlarm": overall["falseAlarms"] / 20,
         "overall": (overall["hits"] + overall["withholds"]) / 80}
for key, value in rates.items():
    equal_number(summary["rates"][key], value)
anomalies = {event["payload"]["trialIndex"] for event in scored if event["type"] == "timing_anomaly"}
all_timing = timing(outcomes, anomalies)
for key, value in all_timing.items():
    equal_number(summary["timing"][key], value)
blocks = []
for index in range(4):
    subset = outcomes[index * 20:(index + 1) * 20]
    block = summary["blocks"][index]
    block_counts = counts(subset)
    block_timing = timing(subset, anomalies)
    assert block["number"] == index + 1 and block["counts"] == block_counts
    assert block_counts["hits"] + block_counts["misses"] == 15
    assert block_counts["withholds"] + block_counts["falseAlarms"] == 5
    for key, value in block_timing.items():
        equal_number(block["timing"][key], value)
    equal_number(block["accuracy"], (block_counts["hits"] + block_counts["withholds"]) / 20)
    blocks.append({"number": index + 1, "counts": block_counts, "timing": block_timing})
halves = [counts(outcomes[:40]), counts(outcomes[40:])]
assert halves == summary["halves"]
assert summary["anticipatoryCount"] == 0
assert blocks[0]["counts"] == blocks[3]["counts"]
assert 0 <= blocks[3]["timing"]["median"] - blocks[0]["timing"]["median"] < 50
assert summary["speedAccuracy"] == "speed and accuracy were broadly stable across the first and final blocks."

kinds = [event["payload"]["outcome"]["kind"] for event in outcomes]
is_correct = lambda kind: kind in ("hit", "correct_withhold")
post_flags = [any(not is_correct(kinds[prior]) for prior in range(max(0, index - 3), index))
              for index in range(80)]
post = [index for index, flag in enumerate(post_flags) if flag]
comparison = [index for index, flag in enumerate(post_flags) if not flag]
post_accuracy = sum(is_correct(kinds[index]) for index in post) / len(post)
comparison_accuracy = sum(is_correct(kinds[index]) for index in comparison) / len(comparison)
selected_after_error = []
for index, kind in enumerate(kinds):
    if is_correct(kind):
        continue
    for following in range(index + 1, min(index + 4, 80)):
        if not is_correct(kinds[following]):
            break
        if kinds[following] == "hit" and following not in anomalies:
            selected_after_error.append(following)
            break
comparison_eligible = [index for index in comparison if kinds[index] == "hit" and index not in anomalies]
assert len(selected_after_error) == summary["postError"]["selected"] == 1
assert len(comparison_eligible) == summary["postError"]["comparison"] == 57
equal_number(summary["postError"]["postAccuracy"], post_accuracy)
equal_number(summary["postError"]["comparisonAccuracy"], comparison_accuracy)
equal_number(summary["postError"]["differencePoints"], (post_accuracy - comparison_accuracy) * 100)
assert summary["postError"]["deltaMs"] is None
assert summary["postError"]["narrative"] == "There were not enough qualifying trials to describe your response speed after errors."

long_run = [index for index, stimulus in enumerate(result["form"]["sequence"])
            if stimulus == "NO_GO" and index >= 3
            and result["form"]["sequence"][index - 3:index] == ["GO", "GO", "GO"]]
other_no_go = [index for index, stimulus in enumerate(result["form"]["sequence"])
               if stimulus == "NO_GO" and index not in long_run]
long_false_alarms = sum(kinds[index] == "false_alarm" for index in long_run)
other_false_alarms = sum(kinds[index] == "false_alarm" for index in other_no_go)
assert (len(long_run), len(other_no_go), long_false_alarms, other_false_alarms) == (10, 10, 0, 1)
assert (summary["sequence"]["longRunCount"], summary["sequence"]["otherCount"],
        summary["sequence"]["longRunFalseAlarms"], summary["sequence"]["otherFalseAlarms"]) == (10, 10, 0, 1)

inputs = [event for event in scored if event["type"] == "input_received"]
accepted = [event for event in scored if event["type"] == "response_accepted"]
releases = [event for event in scored if event["type"] == "key_released"]
assert len(inputs) == len(accepted) == len(releases) == 61
assert not [event for event in scored if event["type"] == "response_ignored"]
assert all(event["payload"]["key"] == "Space" and not event["payload"]["repeated"]
           and not event["payload"]["held"] and event["payload"]["focused"] for event in inputs)
assert all(not event["payload"]["anticipatory"] for event in accepted)
assert all(event["payload"]["inputSequenceNumber"] == input_event["sequenceNumber"]
           for input_event, event in zip(inputs, accepted))

browser = complete["browserEvents"]
origin = [event["timeOriginMs"] for event in browser if event["type"] == "probe_loaded"][-1]
protected = [event for event in browser if event["timeOriginMs"] == origin
             and event["href"] == "http://127.0.0.1:5595/"
             and protection["timestampMs"] <= event["performanceNowMs"] <= completion["timestampMs"]]
assert protected
assert all((event["innerWidth"], event["innerHeight"]) == (1509, 827) for event in protected)
assert all((event["screen"]["width"], event["screen"]["height"], event["devicePixelRatio"]) == (1512, 982, 2)
           for event in protected)
assert all(event["visibilityState"] == "visible" and event["hasFocus"] for event in protected)
assert not [event for event in protected if event["type"] in
            ("resize", "visibilitychange", "pagehide", "freeze")]
downs = [event for event in protected if event["type"] == "keydown" and event.get("code") == "Space"]
ups = [event for event in protected if event["type"] == "keyup" and event.get("code") == "Space"]
assert len(downs) == len(ups) == 61
assert all(event["isTrusted"] is True and not event["repeat"] for event in downs)
assert all(event["isTrusted"] is True for event in ups)
assert len([event for event in protected if event["type"] in ("keydown", "keyup")]) == 122
alignment = [input_event["timestampMs"] - key_event["performanceNowMs"]
             for key_event, input_event in zip(downs, inputs)]
assert all(abs(delta) <= 1 for delta in alignment)

exposure = states[2]["exposures"][result["form"]["id"]]
assert len(states[2]["exposures"]) == 1
assert exposure["sessionId"] == result["sessionId"] and exposure["certainty"] == "confirmed"
assert states[0]["installationId"] == states[1]["installationId"] == states[2]["installationId"]

write("baseline-record.json", result)
write("baseline-journal.json", events)
write("RECONCILIATION.json", {
    "qaHeadAtResumption": "75bf96d9ce602550dc93b2d83e6c8c6b96459df3",
    "productHead": "f6b8ae05ab024e603ebe3fc8e1a42f71dd4b14b1",
    "installationId": states[2]["installationId"],
    "sessionId": result["sessionId"], "formId": result["form"]["id"],
    "validity": result["validity"], "eventCount": len(events),
    "warmupTrials": 8, "scoredTrials": 80,
    "counts": overall, "rates": rates, "timing": all_timing, "blocks": blocks,
    "halves": halves,
    "postError": {"selected": len(selected_after_error), "comparison": len(comparison_eligible),
                  "postAccuracy": post_accuracy, "comparisonAccuracy": comparison_accuracy,
                  "differencePoints": (post_accuracy - comparison_accuracy) * 100,
                  "timingNarrativeSuppressed": True},
    "sequenceContexts": {"longRunNoGo": len(long_run), "otherNoGo": len(other_no_go),
                         "longRunFalseAlarms": long_false_alarms, "otherFalseAlarms": other_false_alarms},
    "inputQuality": {"scoredReceived": len(inputs), "scoredAccepted": len(accepted),
                     "scoredIgnored": 0, "scoredKeyReleases": len(releases),
                     "anticipatoryAccepted": 0, "timingAnomalies": 0,
                     "browserTrustedScoredSpaceDowns": len(downs),
                     "browserTrustedScoredSpaceUps": len(ups),
                     "browserRepeatKeydowns": 0,
                     "observerVsJournalHandlerClockDifferenceMs": {
                         "minimum": min(alignment), "maximum": max(alignment)}},
    "protectedBrowserObservations": {
        "count": len(protected), "viewportCssPixels": [1509, 827],
        "screenCssPixels": [1512, 982], "devicePixelRatio": 2,
        "visibleAndFocused": True, "noObservedResizeHidePagehideFreeze": True,
        "browserBlurFocusAtStart": [event["type"] for event in protected
                                    if event["type"] in ("blur", "focus")],
        "firstUtc": protected[0]["utc"], "lastUtc": protected[-1]["utc"]},
    "preScoredRefresh": {"browserEventCountAtInterruptedExport": len(interrupted["browserEvents"]),
                         "savedResults": 0, "drafts": 0, "exposures": 0,
                         "preparationEvidenceRetained": True},
    "exposure": exposure,
    "prePostReloadInstallationIdentical": True,
    "installationSha256": sha(states[2]), "recordSha256": sha(result), "journalSha256": sha(events),
    "limits": ["Human built-in-keyboard use is self-attested; isTrusted does not sense hardware.",
               "Browser and journal timestamps do not measure physical input latency or display scanout.",
               "One valid native Mac Chrome baseline does not certify the Chrome support row.",
               "QA observer overhead was not calibrated; the 60 Hertz OS setting is not a physical refresh or scanout measurement."]})
print("PASS: independent form, ordered journal, outcome, timing, key trace, exposure, and reload reconciliation")
