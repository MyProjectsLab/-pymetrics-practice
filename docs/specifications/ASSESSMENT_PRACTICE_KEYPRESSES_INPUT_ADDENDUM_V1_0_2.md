# Keypresses V1.0.2 input validity addendum

**Status:** Proposed for independent review under the founder's 2026-10-24 direct request, item 4. This addendum changes only Keypresses input admission and attempt validity. The frozen V1.0 and V1.0.1 documents remain byte-identical. No claim about a person's physiological tapping limit is made.

## Recorded identity and older results

New attempts record `keypresses_spec_v1_0_2`, `keypresses_scoring_v1_0_2`, and `keypresses_event_v2`. The selected-key profile, eight-delay presentation plan, 40-press target, 15-second window, GO/END confirmation, interruption, local-storage and report-view rules remain as in V1.0/V1.0.1. A V1.0.1 result is replayed and reported only with its original down-count semantics and visible prior-version label. It is never silently rescored as V1.0.2 or used as a V1.0.2 comparison baseline. Missing or unknown identities stay review-only.

## Selected-key admission

Only trusted (`isTrusted === true`) selected-key keyboard events are considered. Untrusted events do not change the pressed-key state, count or validity; interleaving them with genuine presses cannot invalidate those genuine presses. A trusted `keydown` with `repeat === true` cannot count as a press; it records repeat/held evidence. One fresh trusted down followed by its matching trusted up constitutes one press. Other keys, chords and extra downs before release do not create presses. A release with no admitted down does not create a press. The journal records ordered down/up admission and repeat evidence so replay reconstructs the same counts.

A pair belongs to the signal window in which its down began and its up completed. Both must occur at or after confirmed GO and strictly before `goOnsetMs + 15,000` to count as accepted. A down before GO released after GO is unaccepted; retain its early-down evidence. A down during GO released at or after the deadline cannot be accepted. The completed press timestamp is the observed matching keyup time. The fortieth accepted keyup resolves the target; the existing deadline and END timing checks still govern. Early, boundary and late counts likewise require a completed pair in their respective confirmed windows. A down held at the logical deadline remains invalid even if released during the late window; a down still held at final resolution and any observed selected-key OS repeat during the protected run also make the attempt invalid even though repeated downs are ignored as presses.

## Speed validity

For `n >= 2` accepted completed presses, calculate all `n - 1` adjacent intervals from their keyup timestamps. At final completion, an attempt is invalid when the median of **all** intervals is **strictly below 40 ms**, or when **more than three** intervals anywhere in the run are **strictly below 20 ms**. The latter intervals need not be consecutive. An early partial median cannot fail an otherwise ordinary completed run. Exactly 40 ms and exactly 20 ms do not meet the respective rejection condition. With zero or one accepted press there is no median and neither interval rule fires; repeat/held or existing technical invalidation rules still apply. Evaluation occurs before saving a valid completion. An invalid speed/held attempt remains saved for review, never as a valid progress point or mock completion.

The candidate-facing invalid message is: “Not a valid attempt — presses were faster than a person can tap. Try again without holding the key.” This is the site's input-quality rule, not a measured human capability threshold. Normal rapid tapping around 6–10 completed presses per second remains eligible when other validity rules pass.

## Acceptance boundary

Pure transitions cover trusted/untrusted events, missing/mismatched release, auto-repeat, down/up crossing GO/deadline/END, forty-keyup resolution, strict 20/40 ms boundaries, four separated sub-20 ms intervals, two-tap 2 ms median, and invalid-before-save. Actual-browser checks cover trusted physical Space hold, normal 6–10 Hz taps, scripted untrusted flood, local save/reload, historical V1.0.1 reopen, and mock source classification. Scripted input remains labeled scripted; browser automation does not prove physical device timing.
