# Assessment Practice — Keypresses Specification V1.0

**Status:** agent-authored implementation packet under the founder's 2026-10-05 full-product delegation, recorded in `AGENTS.md`. The founder did not individually review every rule in this packet. This version is frozen for implementation; later rule changes require a new version and review.

## 1. Purpose and evidence boundary

Keypresses is a short, original, browser-based response task. The candidate waits for **GO**, repeatedly presses a chosen physical keyboard key, and stops when **END** appears. The basic report describes what the browser recorded in this session: first-response latency, accepted presses, time to a fixed press target when reached, and presses before GO or after END. It does **not** diagnose processing speed, impulse control, personality, workplace performance, or employer results. It has no Advanced Training route in Public Beta 0.1.

The private JobTestPrep inventory records dominant-hand selection, a GO signal, repeated Space presses, a threshold-time report, early presses, and after-end presses. Its captured run lasts under one minute. The supplied screenshots also show a guide, attention check, sparse play area, report and retry. These observations establish a familiar task pattern, not the current mechanics of every employer assessment. The JobTestPrep claim that mistimed presses reveal a personal trait, and its claimed average threshold time, are excluded from Assessment Practice copy. No proprietary text, artwork, code, or benchmark is reused.

## 2. V1.0 product decisions

| ID | Proposed rule | Why it matters |
|---|---|---|
| K1 | Target **40 accepted presses** within **15,000 ms** of confirmed GO. END follows the 40th press or the deadline, whichever comes first. | Gives one finite, reproducible task. If 40 is not reached, report the actual count rather than inventing a threshold time. |
| K2 | Choose one pre-GO wait uniformly from **1,800, 1,950, 2,100, 2,250, 2,400, 2,550, 2,700, 2,850 ms** using a recorded random index. | Reduces anticipation. The delay is a presentation setting, not an “unseen” scored form. |
| K3 | Space is the standard key. Permit a different non-modifier key after an input check; label that run **modified key** and record the exact binding. Ask which hand will be used but never score or infer dominance from that answer. Offer a self-declared **alternative input** profile with separate labeling. | Keeps the task usable while preventing unlike bindings and input methods from being silently compared. |
| K4 | Observe presses for **1,000 ms after confirmed END**. Count only fresh keydown cycles of the selected key as early, accepted or late. Held-key autorepeat is never a new press. | Makes early/late counts tied to visible signals rather than timer intent. |
| K5 | Practice and basic descriptive reports/history only. No percentile, norm, composite score, causal training claim, or employer prediction. | Matches the approved Public Beta claim boundary and gets a third game playable without inventing training science. |

## 3. Candidate journey and controls

Library → short rule → untimed three-press example → one understanding question → hand/key choice → one-press input check → readiness → scored run → report/history. The example and setup have no idle timeout. The understanding question asks when pressing begins and ends; an incorrect answer shows the rule again and permits retry. A previously verified understanding check may later permit a shortcut, but V1.0 does not require a historical shortcut.

Readiness states the target, 15-second maximum, selected key, and that the result reflects browser-recorded input. Require release of the selected key, a visible focused page, and a successful input check before Start. Space and Enter retain normal activation on untimed buttons; the scored-run key listener is installed only while the live task is protected. A user may leave an untimed stage without an invalid run.

The live area shows **Wait for GO**, then **GO**, then **END** as text with a non-color visual distinction. It does not display a live press count, normative pace, score, or distracting animation. A selected key press during the waiting phase is early; it neither starts the timer nor contributes to the 40. An early held key must be released and pressed again after GO. END remains visible during the one-second observation period; the result follows afterward. Leaving, hiding, or navigating away during the protected run produces an invalid, reviewable attempt and requires a full restart. Mock resume is between games only.

Setup asks whether the candidate uses a standard physical keyboard, a self-declared alternative or assistive input method, or is unsure. This is a declaration, not a browser capability detector. All three may attempt the task if the selected key passes the input check. Alternative and unknown profiles receive a plain pre-start timing limitation and distinctly labeled descriptive reports; they never enter the standard-keyboard progress series. A modified key is labeled separately as well. Browser/device support and the alternative-input experience require real-device and accessibility qualification before release.

## 4. Timing and input contract

Use one `performance.now()` clock from readiness acceptance through the observation period. On Start, atomically save the run identity and selected presentation-delay index before arming. At the scheduled delay, write GO to a mounted visible element and confirm its connected/visible state in an animation-frame callback. That confirmation timestamp is `goOnsetMs` and starts the 15,000-ms window. If GO cannot be confirmed within 2,000 ms of its scheduled time, preserve the technical draft and allow a fresh restart; do not claim a scored exposure.

A selected-key `keydown` counts only when `event.repeat` is false, the key was previously up, the page is visible/focused, and the run owns its active session. Use handler-observed monotonic time for all key events and store their ordered sequence numbers. A keydown at `goOnsetMs` is eligible; one at or after `goOnsetMs + 15,000` is not. Keyup re-arms the next keydown cycle. Focus loss clears held-key admission but invalidates a protected attempt. Other keys do not count; do not persist their raw codes. Native Space on guide/report buttons must still activate those buttons normally.

The first 40 eligible keydowns are accepted. The 40th resolves the scored window at its timestamp. If the deadline arrives first, the scored window resolves at the deadline; a delivered deadline callback more than **250 ms** late marks the draft timing-invalid. Record `logicalEndMs`, write END, and confirm its visible state on the next frame as `endOnsetMs`. A selected-key press between logical end and confirmed END is a **boundary press**, not an accepted or late press. If END confirmation is delayed more than 250 ms, invalidate timing rather than assign a misleading late count. The 1,000-ms late observation starts at confirmed END. A press at `endOnsetMs` is late; one at or after `endOnsetMs + 1,000` is outside the observation and is not reported.

During GO, monitor animation-frame gaps. A gap over **250 ms** while the page claims to remain visible/focused marks timing invalid, retaining the journal. Page hide, blur, freeze, unsupported resize that removes the task, input binding/profile change, missing GO/END confirmation, lost ownership, or reload before completion also invalidates. Quality events cannot be erased to manufacture a valid result. This is browser timing, not physical keyboard/display latency calibration.

## 5. Events, storage and recovery

Use versioned specification, scoring, input-profile, presentation-plan and event-schema identifiers. Retain immutable preparation, GO/END confirmation, accepted/early/boundary/late keydown, keyup/admission, interruption, invalidation, completion, and report-view events in one ordered journal. Store the selected key and declared hand; do not record other raw key codes, account identity, or employer data. The candidate-facing report is derived from reconciled events, not trusted mutable summary fields.

Keep the small press journal in memory during the live window; storage must never block key admission or resolution. Persist the armed identity before GO and commit the completed journal/result after the protected observation ends. A failed completion write shows a truthful unsaved state and offers one retry, with durable verification before claiming “saved.” On reload, never resume the 15-second window; retain the known incomplete attempt as review-only and restart from readiness. Completed reports may reopen only after integrity and version checks. Individual and Delete all behavior must not resurrect deleted records or falsely label a sequence new. This game has no scarce scored form inventory; retries may reuse a delay without an “unseen” claim.

Multiple tabs must not both control one live run. Installation replacement and deletion fence late writes and callbacks. History labels valid, invalid, unsaved and modified-key attempts distinctly. A result from Keypresses does not become a Stop/Balloons training baseline. Full-mock integration comes after the twelve Practice games; an interrupted mock Keypresses game restarts, with mock resume only between games.

## 6. Scoring and report

Reconcile accepted count `0..40`, keydown-cycle uniqueness, strict monotonic event order, GO/END onset, early/boundary/late counts, and completion or invalidation. No invalid result appears as a valid baseline. Report only observed measures:

- **Accepted presses:** `n/40` and whether the target was reached before the deadline.
- **Time to first accepted press:** first accepted timestamp minus confirmed GO; unavailable when `n=0`.
- **Time to 40 presses:** 40th accepted timestamp minus confirmed GO; otherwise “Target not reached within 15 seconds.”
- **Press rate after the first response:** for at least two accepted presses, `(n − 1) × 1,000 / (last accepted time − first accepted time)` presses per second. Suppress it if the duration is zero or `n < 2`; show its numerator and time window. This separates start latency from repetition rate.
- **Press rhythm:** median of consecutive accepted-press intervals if at least five intervals exist; IQR if at least eight intervals exist. Use median-of-halves quartiles; show the interval count. No extrapolated rhythm from sparse data.
- **Early, boundary and late presses:** separate counts with their exact observation windows. Boundary presses have no behavioral label.

Keep millisecond precision in stored data; round displayed times to the nearest whole millisecond using half-up rounding and displayed rate to one decimal place using half-up rounding. Count equality and all derived values must be reproducible from the immutable journal. The report says: **“These are key presses recorded by this browser during this Assessment Practice task. Keyboard, device and display behavior can affect timing. This result does not measure a stable trait or predict a hiring outcome.”** Alternative/unknown input reports also state that their timing may include input-method delay. Different bindings, hand declarations, device classes or versioned profiles are not silently combined into one progress series. V1.0 need not show a cross-session improvement claim.

## 7. Acceptance evidence before development acceptance

1. Pure-clock fixtures: every delay index; early/GO/deadline/END/late boundaries; 0, 1, 2, 39 and 40 accepted presses; 40th-press versus deadline callback order; delayed GO/END frames; held key and autorepeat; rate/median/IQR and rounding.
2. Integrity fixtures: missing/reordered/duplicated keydowns, impossible 40th time, summary tampering, changed binding/version, inserted invalidation, incomplete late window, deleted installation, and repeated save delivery.
3. Production-browser checks: physical-keyboard-class Space and modified-key paths, normal untimed button activation, focus and visibility interruption, withheld frames, late callbacks, rapid presses, reload, report reopen, deletion and second-tab ownership. Scripted input must be labeled separately from human physical input.
4. Basic accessibility and candidate-copy checks: keyboard focus, non-color GO/END, spoken state changes, quiet live region during rapid tapping, reduced motion, zoom/reflow, alternative/unknown input admission, separate report labels and pre-start limitation. Browser/device qualification remains a separate gate.

## 8. Implementation boundary

K1–K5 and the operational contract above are agent-authored decisions under the founder's delegated workflow. The numerical choices are original, **not** copied or calibrated JobTestPrep/Pymetrics settings. Implement Practice/report/history in bounded code milestones, run the checks, seek separate exact-SHA audits, and record the founder's personal acceptance separately from this delegated implementation. The twelve-game Public Beta scope and later real-user full-session test remain unchanged.
