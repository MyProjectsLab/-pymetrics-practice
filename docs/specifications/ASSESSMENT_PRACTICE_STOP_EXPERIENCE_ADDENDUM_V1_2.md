# Stop V1.2 experience addendum

**Status:** Founder-approved specification decision, 2 October 2026. The founder approved the experience decisions and this review draft in the Assessment Practice coordinator conversation. Implementation requires a separate bounded instruction. Until implementation and its independent acceptance, the existing Stop V1.1 behavior remains operative. The V1.1 source is preserved unchanged.

## 1. Scope and precedence

This addendum changes only Stop's preparation flow, pre-scored interruption treatment, the start of the protected interval, and explanatory copy. It applies to standard baseline, replay, and retest attempts. Drill-specific preparation and validity rules remain unchanged unless separately revised. All trial counts, stimuli, form families, scored timing, scoring, routing, exposure consumption, record-integrity rules, comparison limits, analytics gates, and claims boundaries remain in force. In any conflict within this narrow scope, this addendum supersedes Stop V1.1 §§5.4–5.10 and 14.2–14.3; all other V1.1 provisions continue to apply.

**Master Strategy resolution:** Its individual Practice Mode guide, examples, and comprehension-check flow remains the default and all three components remain available at launch. For a returning Stop candidate, the founder-approved exception treats an integrity-checked prior pass under the current rule/specification as satisfying the comprehension requirement. It does not waive the requirement for a new or unverified candidate, nor any current-session device or readiness check. The approved twelve-game Practice Mode, full mock, basic-report, and three-game Advanced Training release scope is unchanged.

## 2. Returning-user preparation

Offer an optional **Skip introduction** path only when locally retained, integrity-checked preparation evidence proves that the candidate passed Stop's understanding check under the current rule and specification version. A past valid score is not required if the verified understanding-check evidence survives. Deleting that evidence, clearing site data, or changing the relevant rule/specification removes shortcut eligibility. Do not infer knowledge from an unverified browser flag or another device.

The shortcut may omit the full guide, coached examples, and three-question understanding check. It must present a short Stop rule reminder and then the complete device/accessibility setup, response-key input check, and readiness confirmation. The candidate can choose to review the full rule and examples. Record that the shortcut was chosen and the evidence on which eligibility relied; do not fabricate example or question events. Retest profile compatibility requirements remain mandatory.

## 3. Untimed preparation and reservations

Elapsed waiting time alone on the guide, examples, understanding check, setup, readiness, or **Warm-up complete** screen must not invalidate an attempt. A page may be hidden on these untimed screens; before timed play begins, the app must check that the page is visible and focused. A partially active worked example may be reset on return without being recorded as completed.

The existing 30-minute retest reservation remains distinct from validity. If it expires before confirmed scored exposure, release it, explain that the retest explanation must be reopened, and do not silently substitute a form. Waiting at an untimed screen must not convert reservation expiry into a scored invalid result. A reload or closed page need not resume a partially completed warm-up; any resumed attempt must start a fresh warm-up and satisfy current setup and reservation checks.

## 4. Warm-up and start of scored protection

The eight warm-up trials retain their existing timings and are never scored or treated as standard-form exposure. During live warm-up, record browser timing and interruption evidence. If the page becomes hidden, a pagehide/freeze occurs, or focus is lost long enough to compromise the warm-up, stop the warm-up and require a fresh eight-trial warm-up from trial 1 after the candidate returns. Do not resume a partially interrupted trial. A brief visible blur may continue only if the existing timing checks remain satisfied. These pre-scored events must not make a later, properly restarted scored session invalid or consume its form.

Keep the existing one-restart limit for a warm-up timing anomaly. A second warm-up timing anomaly ends preparation with a technical explanation; no scored task begins, no scored form is consumed, and no valid baseline or retest is produced. Preserve the diagnostic events. The candidate may start a new attempt after correcting the environment.

After a completed warm-up, **Warm-up complete** is an untimed pause point. Switching tabs or waiting there does not invalidate the future scored task. The candidate must explicitly choose **Start scored task**.

The protected interval starts immediately when **Start scored task** is accepted, including its initial fixation, and ends after the completion record is created. Before accepting it, verify visible/focused page, released response key, supported viewport and input profile, intact form reservation, and all other existing admission conditions. If a condition fails, remain in preparation or show the applicable recovery; do not begin scored presentation. From that accepted action onward, apply all existing hidden-page, focus, lifecycle, input, and timing invalidation rules. A pre-onset invalidation does not consume an unexposed form. The first confirmed scored presentation still consumes the form even if invalidation immediately follows. Preserve the ordered events and invalid draft.

## 5. Candidate-facing instructions

Use the selected response key in Stop's rule, examples, understanding check, setup, readiness, and timed reminder. Say **“Space is the default key for this Stop exercise. You can choose another physical key.”** Do not imply that another game or a third-party assessment uses the same control.

**Change key:** Explain that the candidate will press one new physical key for GO. On activation, reveal and focus the key-capture prompt. Preserve Tab navigation and browser shortcuts. Display the selected key after capture and require a fresh input check.

**Run input check:** Explain **“Press [selected key] once to confirm that this browser receives your response key.”** On success, say **“[Selected key] detected.”** On failure, say which key was expected and offer keyboard or key-selection guidance. The visible message and accessible announcement must agree.

**Disabled controls:** Give a nearby, current reason and next step whenever **Run input check** or **Continue to readiness** is disabled: physical-keyboard confirmation missing, input check not yet passed, key-capture prompt still open, viewport too small, incompatible retest profile, unsupported browser ordering, or latency-affected input selected. Do not instruct someone to falsely deselect an accommodation merely to unlock timed play.

**Assistive input:** Explain before the checkbox that a response method that adds timing delay cannot be used for timed Stop in this beta. Selecting it still permits the guide, untimed examples, and response-key selection; it disables timed entry. Do not show “this input method can change response timing” as a personal warning to a standard-keyboard user who has not selected the option. Preserve the broader accessibility disclosure where it provides general context without misidentifying the user's setup.

**Readiness:** Explain that leaving during live warm-up restarts warm-up, that the next screen can be used as a pause, and that scored-task protection begins with **Start scored task**. Show **“Response key: [selected key]”** and the chosen visual profile.

**Warm-up complete:** Use: **“You can pause here. When you select ‘Start scored task,’ keep this tab active until Stop ends. Switching away during the scored task makes the attempt invalid.”**

Until this addendum is implemented and accepted, the current V1.1 protection boundary at **I'm ready** remains binding; the existing readiness and handoff copy must not describe this future behavior as live.

## 6. Acceptance checks for implementation

1. Verified prior understanding pass offers the shortcut; deleted, corrupt, incompatible-version, or absent evidence does not. Shortcut journals show what was skipped and never contain invented example/question events. Setup, input check, readiness, and retest compatibility still gate entry.
2. Wait on each untimed screen without interaction; waiting alone does not invalidate. Separately test a retest reservation expiring at 30 minutes and the required reopen path.
3. Hide/blur/freeze during live warm-up; preserve diagnostic events, restart all eight warm-up trials, and confirm no scored presentation or form consumption. Test one and two warm-up timing anomalies.
4. Hide or wait on **Warm-up complete**; later scored start remains possible only after fresh admission checks. Test reservation expiry during the pause.
5. Hide or lose required focus after **Start scored task** but before first scored onset: invalid draft, no form consumption. Repeat immediately after confirmed onset: invalid draft, retained presentation, consumed form.
6. Test key remapping and prompt focus with keyboard and screen reader, the selected-key text and detected-key message, each disabled-control reason, assistive-input selection, and standard-keyboard readiness copy. Test the understanding check after a key change so it never gives contradictory Space-specific instructions.
7. Regress ordinary 8+80 timing, form exposure, M3 scoring, M4 training/retests, M5 persistence, M6-A lifecycle handling, and unchanged claims. Real-browser checks remain distinct from physical-device certification.

## 7. Open gates

This addendum does not certify any browser/device row, accessibility path, physical timing, reference originality, S70–S71 analytics, privacy/provider controls, or Public Beta release. The approved twelve-game Practice Mode, full mock, basic reports, and Advanced Training for Stop/Balloons/Towers remain the launch scope. Specification approval, implementation, tests, independent exact-SHA audit, founder acceptance, deployment, and release remain separate states.
