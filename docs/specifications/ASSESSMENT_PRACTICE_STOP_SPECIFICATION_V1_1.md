# ASSESSMENT PRACTICE — STOP GAME SPECIFICATION V1.1

**Document type:** Founder-approval game specification and Codex implementation handoff  
**Product release:** Public Beta 0.1  
**Specification version:** Stop v1.1  
**Date:** 28 September 2026  
**Status:** Founder decisions F01–F08 approved as modified; implementation has not begun and requires a separate explicit instruction

This document is the complete standalone specification for the Assessment Practice Stop game. It governs the guide, examples, standard simulation, scoring, reporting, Advanced Training, unseen retest, local history, accessibility, error handling, analytics boundaries, acceptance tests, and implementation handoff. It implements the binding Assessment Practice master strategy while preserving the distinction between directly observed reference evidence, public go/no-go convention, and original Public Beta 0.1 product decisions.

The product is a candidate-preparation exercise. It may describe behavior inside Assessment Practice tasks. It must not diagnose personality, label impulse control or attention as a stable trait, predict employer fit, reproduce proprietary scoring, infer a hiring outcome, or promise workplace-performance transfer.

## 1. Product purpose and release boundary

### 1.1 Purpose

Stop gives candidates a realistic, original go/no-go practice experience in which they learn one response rule, perform it under time pressure, see transparent task-level evidence, receive a deterministic focused drill when the data supports one, and compare a valid baseline with a new Assessment Practice sequence.

The candidate should leave able to answer four questions:

1. Did I understand and follow the response rule?
2. How often did I respond to GO and withhold on NO-GO?
3. How did my response speed, variability, and accuracy change during the task?
4. What focused exercise should I try next, and what happened on a new sequence afterward?

### 1.2 Included in Public Beta 0.1

- An original Stop guide, controls page, worked examples, and comprehension check.
- An eight-trial unscored warm-up.
- An 80-trial standard simulation.
- Event-level local recording and reproducible descriptive scoring.
- A basic report with accuracy, errors, response time, variability, blocks, speed–accuracy interpretation, post-error behavior when supported, data quality, and limitations.
- Deterministic Advanced Training routing into one of four focused drills or a balanced-maintenance exercise.
- A valid unseen-sequence retest and baseline comparison.
- Local history, replay, deletion, accommodation labeling, and failure recovery.

### 1.3 Excluded

- Proprietary Pymetrics or JobTestPrep scoring, wording, artwork, layouts, sequences, reports, or employer models.
- Employer pass thresholds, candidate rankings, percentiles, composite personality scores, hiring predictions, or claims of validated trait measurement.
- Claims that a lower false-alarm rate proves improved impulse control, that a higher hit rate proves improved attention, or that task improvement transfers to work.
- Touch-only standard gameplay, accounts, cross-device sync, payments, and server-side storage.
- Calibrated alternate-form equivalence. Standard forms share design parameters but are not represented as psychometrically equivalent.

## 2. Authority, terminology, and claims rules

### 2.1 Source authority

This specification integrates, in descending order of authority for this game:

1. The binding `ASSESSMENT_PRACTICE_MASTER_STRATEGY.md` in this project.
2. The authoritative Work recording-analysis addendum stated in the source conversation.
3. `sources/ASSESSMENT_PRACTICE_REFERENCE_INVENTORY.md`.
4. `sources/ASSESSMENT_PRACTICE_WORK_PLANNING_BRIEF.md`.
5. The supplied factor-trait report only as evidence of why Assessment Practice must not reproduce opaque trait or employer-fit conclusions.
6. Original Public Beta 0.1 decisions in this document where evidence does not determine a mechanic.

If implementation discovers a conflict with the master strategy, implementation stops and the founder resolves it. Competitor material never authorizes copying protected expression.

### 2.2 Terms

- **GO:** the respond stimulus. In the standard form, this is a red circle with a redundant GO marker.
- **NO-GO:** the withhold stimulus. In the standard form, this is a green circle with a redundant NO-GO marker.
- **Hit:** one accepted response to a GO stimulus during its response window.
- **Miss:** no accepted response to a GO stimulus during its response window.
- **False alarm:** one accepted response to a NO-GO stimulus during its response window.
- **Correct withhold:** no accepted response to a NO-GO stimulus during its response window.
- **Resolution:** the accepted first response or expiry of the response deadline.
- **Standard form:** the standard color-plus-marker, physical-keyboard form with the timings in Section 7.
- **Accommodated form:** a separately labeled form that changes the visual cue, response binding, or time limit.
- **Valid baseline:** a completed standard or accommodated session that passes every applicable rule in Section 14.
- **Unseen:** not previously started on the current local installation and not exposed earlier in the active in-memory chain. It does not mean globally unique.

### 2.3 Candidate-facing claims rule

Every interpretation must start with an observable task result. Use “on this Assessment Practice task,” “on this sequence,” and “in this session.” Never turn one result into a stable psychological or workplace conclusion. A change across forms is a difference across two Assessment Practice sessions, not proof that training caused the change.

## 3. Evidence register and treatment

| Item | Status | What it supports | Product treatment |
|---|---|---|---|
| 80 trials | Directly observed in two reference recordings and reference inventory | Familiar reference length | Adopted for the standard simulation |
| Red circle means press Space | Directly observed | Familiar GO mapping | Adopted, with an original redundant visual marker |
| Green circle means withhold | Directly observed | Familiar NO-GO mapping | Adopted, with an original redundant visual marker |
| Stimulus visible for approximately 200 ms | Directly observed estimate | Brief stimulus presentation | Set to exactly 200 ms as a reversible beta decision |
| Fixation cross between stimuli | Directly observed | Inter-trial focus target | Adopted using original styling |
| Responses accepted after the stimulus disappears | Directly observed | Response window outlasts visibility | Adopted through the exact 1,000 ms window |
| Trial progression depends on response or timeout | Directly observed | Variable onset-to-onset rhythm | Adopted |
| No live correctness feedback | Directly observed | Assessment-style flow | Adopted for warm-up, baseline, practice, and retest; drills may give block-level coaching only |
| No score or trial counter during gameplay | Directly observed | Minimal live canvas | Adopted for standard sessions and retests |
| Different sequences and different red/green counts in the two recordings | Directly observed | The reference was not one fixed copied sequence | Assessment Practice uses original, versioned sequences; observed counts and sequences are not copied |
| Long same-color runs | Directly observed | Runs must not be artificially alternating | Original forms permit bounded same-color runs |
| Accuracy-only report separated by red and green | Directly observed | Minimum reference reporting pattern | Assessment Practice materially expands the report without copying it |
| Instructions → Start → readiness → fixation → trials → completion → report | Directly observed | End-to-end reference flow | Preserved as a familiar flow with original screens and copy |
| Approximately 1,000 ms response deadline | Provisional estimate | Plausible response window | Set to 1,000 ms as an original reversible beta decision, not a confirmed competitor fact |
| Approximately 1,200 ms delay after response or timeout | Provisional estimate | Plausible inter-trial delay | Set to 1,200 ms as an original reversible beta decision |
| Exact onset-to-onset decomposition | Unknown | Nothing reliable | Defined independently in Section 7 |
| Red/green probability | Unknown | Nothing reliable | Defined independently as 60 GO and 20 NO-GO |
| Random generation versus stored reference forms | Unknown | Nothing reliable | Assessment Practice uses stored, seeded, versioned original forms |
| Go/no-go response inhibition paradigm | Public task convention | General task structure and descriptive measures | Used only at task level; no clinical or trait inference |
| Pietro found the preparation similar to his employer assessment | Firsthand representativeness evidence | Candidate familiarity value | Does not prove universal employer equivalence or exact current timing |

### 3.1 Protected material that must not be copied

Do not copy either observed 80-trial sequence, competitor wording, layouts, visual design, report, artwork, source code, proprietary formulas, the typo “Total Correct Trails,” or the advice that green becomes likely after several reds. The generator must not make or teach a gambler’s-fallacy prediction. A run of red stimuli does not tell the candidate what comes next.

## 4. Founder-approved Public Beta 0.1 decisions

These are the consolidated decisions approved as modified in Section 25.

| Decision | Recommended value | Basis | Practical reason | Reversible without architectural rework |
|---|---|---|---|---|
| Scored trials | 80 | Direct observation | Familiar session length | Yes |
| Distribution | 60 GO, 20 NO-GO; exactly 15/5 in each hidden 20-trial block | Original beta decision | Stable denominators without claiming competitor probability | Yes |
| Warm-up | 8 unscored trials: 6 GO, 2 NO-GO | Original beta decision | Lets the candidate settle into the rhythm without contaminating the score | Yes |
| Blocks | Four hidden blocks of 20 | Original beta decision | Supports early/late and consistency analysis | Yes |
| Stimulus visibility | 200 ms | Observation-informed beta decision | Matches the observed brief presentation | Yes |
| Response deadline | 1,000 ms from stimulus onset | Observation-informed beta decision | Allows responses after disappearance while preserving time pressure | Yes |
| Post-resolution fixation | 1,200 ms | Observation-informed beta decision | Implements response-dependent progression and a stable reset interval | Yes |
| Initial fixation | 1,000 ms before the first warm-up and 1,000 ms before the first scored trial | Original beta decision | Provides a clear visual and timing reset | Yes |
| Maximum run | 8 GO or 8 NO-GO | Original beta decision, founder-corrected | Permits long realistic runs without forced alternation while bounding extreme stretches | Yes |
| Standard form inventory | 4 baseline forms, 6 replay/practice forms, 4 retest forms | Original beta decision | Supports several fresh chains without pretending to offer unlimited unseen forms | Yes; form identities and exposure rules must migrate safely |
| Drill inventory | 4 targeted drill definitions plus 1 balanced-maintenance exercise, each versioned | Original beta decision | Covers the supported routing outcomes | Yes |
| Standard input | Physical keyboard Space; remappable single key before start | Direct observation plus accessibility decision | Preserves familiarity and supports motor accommodations | Yes |
| Live feedback | None in standard sessions/retests; only instruction and drill block summaries | Direct observation plus product decision | Avoids changing strategy trial by trial | Yes |
| Mobile | Guide, report, and history responsive; standard game disabled on touch-only/no-physical-keyboard devices | Original beta decision | Timing and physical-input comparability are not defensible on touch-only devices | Yes |
| Minimal analytics | Consent-based first-party beta analytics using an ephemeral session identifier; proposed 90-day retention | Founder-approved beta decision | Measures coarse funnel and technical outcomes without collecting task performance or personal data | Yes |

No original threshold in this document is described as scientifically validated.

## 5. Screen-by-screen journey and exact copy

Dynamic render fields are named in double brackets and have a defined source in Sections 10–12. They are not undecided content.

### 5.1 Library card

**Title:** “Stop”  
**Description:** “Respond to GO. Withhold on NO-GO. Review your accuracy, response timing, and consistency on this Assessment Practice task.”  
**Metadata:** “About 4 minutes · Physical keyboard recommended”  
**Badge:** “Advanced training available”  
**Primary action:** “Open Stop”

### 5.2 Guide introduction

**Heading:** “Learn the Stop task”  
**Body:** “A symbol will appear briefly. Press your response key when you see GO. Do nothing when you see NO-GO. The symbol disappears quickly, but you can still respond until the response window closes.”  
**Independence note:** “This is an original Assessment Practice exercise. Real assessment details can vary. Follow the instructions in your invitation.”  
**Action:** “See the rule”

### 5.3 Rule screen

**Heading:** “One rule, two actions”  
**GO label:** “GO — press Space”  
**GO explanation:** “The red GO symbol means press Space once.”  
**NO-GO label:** “NO-GO — do nothing”  
**NO-GO explanation:** “The green NO-GO symbol means do not press.”  
**Mistake explanation:** “No response to GO is a miss. A response to NO-GO is a false alarm. These names describe what happened in the task; they are not personality labels.”  
**Action:** “Try examples”

### 5.4 Coached examples

There are four original examples in the fixed order GO, NO-GO, GO, NO-GO. They are not part of a scored or exposed form.

Before example 1: “Press Space for GO.”  
After a correct example response: “Correct. You responded to GO.”  
After a missed GO example: “This was GO. Press Space when it appears.”  
Before a NO-GO example: “Do nothing for NO-GO.”  
After a correct withhold: “Correct. You withheld your response.”  
After a false alarm: “This was NO-GO. Do not press when it appears.”  
Final action: “Check my understanding”

### 5.5 Comprehension check

Present three questions in randomized order. All three must be answered correctly in one pass.

1. “What should you do when GO appears?” Correct answer: “Press Space once.”
2. “What should you do when NO-GO appears?” Correct answer: “Do nothing.”
3. “Can you respond after the symbol disappears?” Correct answer: “Yes, until the response window closes.”

Incorrect-pass copy: “Review the rule and try again. This check is not scored.”  
Correct-pass copy: “You have the rule. Next, check your device and begin the warm-up.”

### 5.6 Device and accessibility check

**Heading:** “Check your setup”  
**Body:** “Use a laptop or desktop with a physical keyboard. Close distractions and keep this tab visible until the game ends. Choose any accessibility setting before you start; changing it during the game ends the session.”  
**Response-key control:** “Response key: Space” / “Change key”  
**Visual control:** “Standard color-plus-marker symbols” / “High-distinction shape form”  
**Timing:** “Standard timing. Extended-time mode is planned after Public Beta 0.1 and is not available in this release.”  
**Storage line:** “Results stay in this browser unless you delete site data.”  
**Action:** “Run input check”

The input check asks: “Press your response key once.” Success copy: “Input detected.” Failure copy is defined in Section 23.

### 5.7 Readiness confirmation

**Heading:** “Ready to begin?”  
**Body:** “You will complete 8 warm-up trials, then 80 scored trials. There is no pause, score, trial counter, or correctness feedback during the game. Respond quickly, but do not sacrifice control for speed.”  
**Run warning:** “Do not switch tabs or windows. If this page becomes hidden, the session cannot be used as a valid baseline or retest.”  
**Action:** “I’m ready”

After activation, the page takes game focus, prevents Space from scrolling, waits for any held response key to be released, and shows the fixation cross for 1,000 ms.

### 5.8 Warm-up transition

No correctness feedback appears during the eight warm-up trials. After warm-up:

**Heading:** “Warm-up complete”  
**Body:** “The scored task starts next. The rule and timing stay the same.”  
**Action:** “Start scored task”

Activation begins a 1,000 ms initial fixation, then the 80 scored trials. No trial count, progress bar, live score, correctness icon, or performance message appears.

### 5.9 Completion

**Heading:** “Stop complete”  
**Valid body:** “Your result is ready. Review what happened on this Assessment Practice sequence.”  
**Invalid body:** “The task ended, but an interruption or data-quality issue means this session cannot be used as a valid baseline or retest.”  
**Action:** “View my result”

### 5.10 Navigation flow

The complete flow is:

`Library → Guide → Rule → Coached examples → Comprehension check → Device and accessibility check → Readiness confirmation → Initial fixation → Warm-up → Warm-up transition → Initial fixation → 80 scored trials → Completion → Basic report → Advanced Training → Drill → Unseen retest → Comparison → History`

Back navigation is permitted before readiness confirmation. Once warm-up starts, browser back, refresh, route change, page hide, or unsupported focus loss invokes the interruption rules in Section 14.

## 6. Controls and gameplay mechanics

### 6.1 Standard controls

- Default response key: Space.
- The candidate may select one alternative single keyboard key before readiness. Modifier-only keys, Escape, Tab, browser-reserved shortcuts, and multi-key chords are not permitted.
- Only a `keydown` transition can be a response. Key release never scores.
- The first eligible non-repeated keydown during a trial response window is the accepted response. Additional keydowns in the same trial are logged but ignored for scoring.
- A response key held when a state begins cannot trigger that state. Input remains armed only after a recorded keyup. The readiness action is unavailable while the response key is held.
- Key-repeat events are never accepted responses. They are logged with the repeated-key flag and ignored.
- A keydown during fixation is a premature input. It is not carried into the next trial and does not shorten fixation.
- Non-response keys are logged as wrong-key events and ignored. They do not become hits or false alarms.
- While the game canvas is active, the application prevents the response key’s browser default action, including Space-bar page scrolling. This prevention applies during readiness, fixation, stimulus, response window, and completion transition; it does not trap Space elsewhere on the site.

### 6.2 Stimuli

Standard GO is an original red filled circle containing a high-contrast white vertical marker. Standard NO-GO is an original green filled circle containing a high-contrast white horizontal marker. Color is therefore not the only available signal. Both are centered in the same bounding box and have matched apparent size. The fixation is an original high-contrast plus sign centered in the same location.

The interface must not label a live stimulus with text that changes the response demand. The guide may show labels beside static examples.

### 6.3 Gameplay canvas

- Neutral, distraction-free background with no competitor resemblance.
- One centered stimulus or fixation at a time.
- No report data, score, countdown, elapsed time, trial number, progress bar, animation, sound, or live correctness feedback.
- A persistent small instruction above or below the stimulus is allowed: “GO: press [[RESPONSE_KEY]] · NO-GO: do nothing.” It must not change by trial.
- Reduced-motion mode removes nonessential transitions; trial timing remains unchanged.

## 7. Trial structure and timing

### 7.1 Clock and rendering basis

All trial timestamps use one monotonic high-resolution browser clock. Wall-clock time may be stored separately for history but never used to compute response time. Stimulus onset is the first confirmed rendered frame, not the scheduling request. Durations are assessed against confirmed presentation times where the browser permits frame confirmation.

### 7.2 Standard trial

1. **Stimulus onset at 0 ms.** Start the response window and render GO or NO-GO.
2. **Stimulus offset at 200 ms.** Replace the stimulus with fixation. The response window remains open.
3. **Resolution.** The trial resolves on the first accepted response or at exactly 1,000 ms after onset if no response occurs.
4. **Post-resolution fixation.** Keep fixation visible for exactly 1,200 ms from resolution.
5. **Next trial.** Present the next stimulus on the first eligible rendered frame after the post-resolution interval.

The designed onset-to-onset interval is therefore response-dependent. For a response at 350 ms, the next requested onset is 1,550 ms after the current onset. For a timeout, it is 2,200 ms. These are Assessment Practice decisions, not claims about the reference product’s exact decomposition.

### 7.3 Initial and transition timing

- Initial fixation before warm-up trial 1: 1,000 ms.
- Warm-up: 8 trials using the standard timing.
- Warm-up-complete screen: untimed; requires activation.
- Initial fixation before scored trial 1: 1,000 ms.
- Scored task: 80 trials without a break.
- Completion screen appears after the final trial’s 1,200 ms post-resolution fixation.

### 7.4 Accepted response times

An accepted response has a response time from 0 through 1,000 ms inclusive, measured from confirmed stimulus onset. A response after the deadline is late, is not assigned to that trial or the next trial, and is logged. A response below 100 ms is classified as anticipatory for data quality: it still determines hit or false alarm, but it is excluded from response-time summaries.

## 8. Original sequence generation and form management

### 8.1 Form families

| Family | Initial count | Purpose | Standard parameters |
|---|---:|---|---|
| Baseline | 4 | First valid Advanced Training baselines and full-mock Stop slot | 80 trials, 60 GO/20 NO-GO, 4 hidden blocks |
| Replay/practice | 6 | Standalone replays that are not reserved as retests | Same |
| Retest | 4 | New-sequence comparison after a completed drill | Same |

Coached examples, comprehension items, warm-ups, and drills are separate from these form families.

### 8.2 Generator constraints

Each stored form is generated before release from a documented seed and immutable generator version, then reviewed and committed as a form manifest. Runtime gameplay reads the manifest; it does not generate a new unreviewed sequence.

Every standard form must satisfy all of the following:

- 80 scored trials.
- Four hidden blocks of 20.
- Exactly 15 GO and 5 NO-GO in every block; 60 GO and 20 NO-GO overall.
- No GO run longer than 8.
- No NO-GO run longer than 8.
- No forced alternation rule.
- At least one GO run of length 4 or more somewhere in the form.
- At least 4 NO-GO trials preceded by 3 or more consecutive GO trials, to permit descriptive sequence-context analysis when denominators remain sufficient.
- The first and last two trials cannot both be NO-GO.
- For every pair of released standard forms, at least 24 of the 80 positions must differ. Equivalently, no more than 56 positions may contain the same stimulus identity. This is a pairwise comparison across all baseline, replay/practice, and retest forms.
- Baseline, replay, and retest families use distinct seeds and form identifiers.
- The realized sequence, form identifier, form version, generator version, seed identifier, and manifest checksum are stored with each session.

The generator must not make NO-GO increasingly probable after GO runs, and candidate copy must not imply that it does. The exact 15/5 block composition is not shown during gameplay.

**Constraint-feasibility verification:** A constructive audit produced a full 14-form candidate set satisfying the 60/20 total, four 15/5 blocks, endpoint rule, required sequence contexts, both run caps, and every pairwise difference rule. The minimum pairwise difference was 24 positions and the maximum identical-position count was 56. This verifies that the combined mathematical constraints are achievable; it does not designate those audit candidates as release forms.

### 8.3 Form assignment

Choose the least recently exposed eligible form in the requested family; break an equal-exposure tie using a locally generated random choice. A form becomes exposed when its first scored stimulus is confirmed onscreen. Starting only the guide, examples, warm-up, or readiness screen does not consume a standard form.

Forms do not reset merely because a result is deleted. Clearing all local site data removes exposure history; Section 21 defines the resulting limitation.

### 8.4 Comparability statement

Shared design parameters support cautious within-product comparison, but Public Beta 0.1 forms are not calibrated as equivalent. Reports must say “new Assessment Practice sequence,” not “equivalent form.”

## 9. State machine and interruption behavior

### 9.1 Primary states

| State | Permitted transition | Prohibited behavior |
|---|---|---|
| Library | Guide | No form allocation |
| Guide/rule | Examples or back | No scoring |
| Examples | Comprehension | No standard-form exposure |
| Comprehension failed | Rule/retry | Cannot proceed to readiness |
| Comprehension passed | Device check | No gameplay until input passes |
| Device check | Readiness | Settings may change here |
| Readiness | Initial warm-up fixation or back | Cannot start while response key is held |
| Warm-up fixation | Warm-up trial | No pause or settings change |
| Warm-up trial | Post-resolution fixation/next warm-up | First keydown only |
| Warm-up complete | Initial scored fixation or exit | Standard form not exposed until first scored onset |
| Scored fixation | Scored trial | Premature input logged, never carried forward |
| Scored trial | Post-resolution fixation | First eligible keydown or timeout resolves |
| Post-resolution fixation | Next trial/completion | Inputs do not affect the next trial |
| Completion | Report | Scoring snapshot becomes immutable |
| Report | Replay, Advanced Training, history, or library | No silent rescore under a new version |
| Drill | Drill report | Separate drill rules and scoring |
| Retest | Comparison | Same standard state rules |
| Invalidated | Recovery screen | Cannot become a valid baseline through continuation |

### 9.2 Interruption transition

An invalidating interruption immediately freezes the trial engine, records the reason and last complete event sequence number, marks the session invalid, and shows the recovery screen. The application does not silently resume a partially completed game. Restart uses a fresh eligible form when available; the interrupted form remains exposed.

### 9.3 Completion atomicity

A session becomes complete only after all 80 scored trial-resolution events and the final post-resolution interval are recorded, the scoring snapshot is produced from those events, and the result write either succeeds locally or is retained in the active tab’s in-memory recovery buffer. A report must never be assembled from an incomplete event list without an explicit incomplete label.

## 10. Event and data schema

This section defines fields and meanings, not application code.

### 10.1 Session record

| Field | Required meaning |
|---|---|
| session_id | Locally unique identifier |
| chain_id | Links baseline, assigned drill, and retest |
| mode | baseline, replay, mock, drill, or retest |
| form_family / form_id / form_version | Exact source manifest identity |
| generator_version / seed_id / manifest_checksum | Sequence provenance |
| scoring_version / specification_version | Reproducibility |
| started_at_wall / completed_at_wall | Local-history timestamps |
| monotonic_origin | Reference for relative timing |
| input_binding / input_device_class | Response setup |
| visual_profile / timing_profile / accommodation_id | Standard or accommodated context |
| viewport_class / browser_family / browser_version | QA context without fingerprinting |
| storage_mode | persistent_local or temporary_memory |
| validity_status / validity_reasons | valid, invalid, incomplete, or valid_with_note |
| realized_sequence | Ordered GO/NO-GO identity for all exposed trials |
| summary_snapshot | Immutable result under the recorded scoring version |

### 10.2 Required events

| Event | Minimum fields |
|---|---|
| guide_opened | session context, timestamp |
| example_presented / example_resolved | example id, expected action, observed action |
| comprehension_answered | item id, answer id, correct flag, attempt |
| device_check_completed | input binding, detected device class, visual/timing profile |
| readiness_confirmed | timestamp, focus and visibility state |
| fixation_started / fixation_ended | phase, expected and actual timestamps |
| trial_scheduled | phase, trial index, planned stimulus, planned timing |
| stimulus_presented | trial index, identity, confirmed onset, frame delay |
| stimulus_removed | trial index, confirmed offset, visible duration |
| input_received | key class, keydown timestamp, repeat flag, held-state flag, focus/visibility state |
| response_accepted | trial index, response time, stimulus identity |
| response_ignored | reason: repeat, extra, wrong key, late, held, or fixation |
| trial_timed_out | trial index, actual deadline time, deadline lateness |
| trial_resolved | outcome, resolution source, anomaly flags |
| visibility_changed | new state, timestamp |
| focus_changed | focus state, timestamp, duration when restored |
| page_lifecycle_changed | pagehide, freeze, resume, or pageshow |
| timing_anomaly | anomaly type, expected, actual, severity |
| session_invalidated | exact rule id and trigger event |
| session_completed | event count, validity, checksum |
| report_viewed | session id, report version |
| drill_recommended / drill_started / drill_completed | rule version, drill id, reason metrics |
| retest_reserved / retest_exposed / retest_completed | form id, chain id, status |
| history_deleted / storage_failure | local-only diagnostic context |

### 10.3 Event integrity

Events receive a monotonically increasing per-session sequence number. Required events cannot be overwritten. A corrected scoring version creates a new derived summary linked to the immutable raw record; it does not rewrite original events or the original displayed-summary snapshot.

Trial-level key values and response/non-response classifications remain local task data and are never sent in beta analytics. Raw free text, name, employer, email, full IP address retained as data, and cross-site identifiers are not part of the Stop analytics record.

## 11. Scoring formulas

Let GO count equal 60 and NO-GO count equal 20 for a complete standard form.

### 11.1 Outcomes

- **Hits:** GO trials with an accepted response from 0 through 1,000 ms.
- **Misses:** GO trials without an accepted response by 1,000 ms.
- **False alarms:** NO-GO trials with an accepted response from 0 through 1,000 ms.
- **Correct withholds:** NO-GO trials without an accepted response by 1,000 ms.

These identities must hold for a complete standard session:

- hits + misses = 60.
- correct withholds + false alarms = 20.
- hits + misses + correct withholds + false alarms = 80.

### 11.2 Rates

- GO hit rate = hits ÷ 60.
- GO miss rate = misses ÷ 60.
- NO-GO correct-withhold rate = correct withholds ÷ 20.
- NO-GO false-alarm rate = false alarms ÷ 20.
- Overall accuracy = (hits + correct withholds) ÷ 80.

Rates are displayed as counts and whole percentages, with the percentage rounded half away from zero. Threshold decisions use unrounded rates.

### 11.3 Response time

- Response-time summaries include only correct GO hits at or above 100 ms and at or below 1,000 ms on timing-clean trials.
- Primary response time = median eligible correct-GO response time, rounded to the nearest millisecond.
- Response-time variability = interquartile range of eligible correct-GO response times, using the inclusive quartile method defined in the scoring specification fixture and rounded to the nearest millisecond.
- Mean and standard deviation may be retained for QA but are not primary candidate metrics.
- False-alarm response times may be shown only in an expandable evidence table when there are at least 5; they are not mixed into the primary median.

### 11.4 Anticipatory, late, wrong, and repeated inputs

- A response below 100 ms determines the trial outcome but is excluded from response-time summaries and counted as anticipatory.
- A response after 1,000 ms is late and does not change the resolved outcome.
- Wrong keys, repeated-key events, a response inherited from a held key, and inputs during fixation never determine an outcome.
- Multiple eligible keydowns on one trial produce one outcome from the first and an extra-input count from the remainder.

### 11.5 No composite trait score

There is no impulse-control score, attention score, employer-fit score, pass mark, percentile, or cross-game composite. No signal-detection statistic is candidate-facing in Public Beta 0.1 because its interpretation would add complexity without changing the practical report.

## 12. Blocks, sequence context, and derived measures

### 12.1 Hidden blocks

Scored trials 1–20, 21–40, 41–60, and 61–80 form Blocks 1–4. Each contains 15 GO and 5 NO-GO. Blocks are hidden during gameplay and displayed only in the report.

### 12.2 Minimum denominators

An individual block may be included in:

- GO-rate comparison only with at least 12 eligible GO outcomes.
- NO-GO-rate comparison only with at least 4 eligible NO-GO outcomes.
- Overall-accuracy comparison only with at least 16 eligible outcomes, including both stimulus types.
- Response-time comparison only with at least 10 timing-clean correct GO hits.
- Response-time variability comparison only with at least 12 timing-clean correct GO hits.

The first-versus-last block narrative requires both blocks to meet the relevant denominator. Otherwise the report says: “There was not enough clean data for a reliable block comparison.”

### 12.3 Half-session consistency comparison for training routing

For consistency routing only, compare trials 1–40 with trials 41–80. Each half contains 30 GO and 10 NO-GO trials by construction.

- Overall-accuracy routing requires at least 32 eligible outcomes in each half, including both stimulus types.
- Hit-rate routing requires at least 24 eligible GO outcomes in each half.
- False-alarm routing requires at least 8 eligible NO-GO outcomes in each half.
- Response-time evidence accompanying the route requires at least 20 timing-clean correct GO hits in each half.

Store the exact first-half and second-half hit, miss, correct-withhold, and false-alarm counts. Training must not be routed from Blocks 1 and 4 alone. Those blocks may support a descriptive report observation under Section 12.4, but the consistency router always uses the full first half and full second half.

### 12.4 First-versus-last block description

Compute Block 4 minus Block 1 for overall accuracy, hit rate, false-alarm rate, median correct-GO response time, and response-time IQR. A higher false-alarm rate is worse; a higher hit rate or overall accuracy is better. Report numerical differences without causal language.

### 12.5 Post-error behavior

An error is a miss or false alarm. For each error, select the next timing-clean correct GO hit within the next three trials, provided no other error occurs first. Compare its response time with the candidate’s median timing-clean correct-GO response time on trials not within three trials after an error.

Post-error analysis requires at least 4 qualifying post-error hits and at least 12 comparison hits. If supported, report the median post-error difference. If not, use the exact copy: “There were not enough qualifying trials to describe your response speed after errors.”

### 12.6 Sequence-context evidence

For descriptive evidence only, compare the false-alarm rate on NO-GO trials preceded by at least 3 consecutive GO trials with other NO-GO trials. Show this only with at least 4 long-run NO-GO trials and at least 8 comparison NO-GO trials. Never tell the candidate that NO-GO becomes more likely after a GO run.

### 12.7 Interpretation hierarchy

The report prioritizes counts, then rates, then timing, then supported within-session comparisons. If a derived narrative conflicts with a validity rule, validity wins and the narrative is suppressed.

## 13. Speed–accuracy and post-error interpretation rules

### 13.1 First-versus-last block rules

All percentage-point changes use unrounded underlying rates. All timing changes use rounded millisecond medians only after the comparison is calculated.

- If response time becomes at least 50 ms faster and the relevant accuracy measure changes by less than 5 percentage points, report “faster with similar accuracy.”
- If response time becomes at least 50 ms faster and the relevant accuracy measure worsens by at least 10 percentage points, report “faster with lower accuracy.”
- If response time changes by less than 50 ms and the relevant accuracy measure improves by at least 10 percentage points, report “more accurate with similar speed.”
- If response time becomes ≥50 ms slower and accuracy improves ≥10 percentage points on the relevant measure, report “slower and more accurate.” Do not call the change an unqualified improvement.
- If response time becomes at least 50 ms slower and the relevant accuracy measure changes by less than 5 percentage points, report “slower with similar accuracy.”
- If response time and accuracy both worsen beyond those thresholds, report “both speed and accuracy were lower in the final block.”
- If neither timing changes by 50 ms nor accuracy changes by 10 percentage points, report “speed and accuracy were broadly stable across the first and final blocks.”
- If accuracy changes by 5 to less than 10 percentage points, state the numbers without assigning a directional label.

The relevant accuracy measure is overall accuracy by default. When the change is concentrated in one response category, name that category: GO hit rate or NO-GO correct-withhold rate. Never average a hit-rate improvement and a false-alarm deterioration into a flattering single label.

### 13.2 Within-session evidence priority

When several changes occur, the candidate-facing observation follows this order:

1. A validity or sufficiency limitation.
2. A speed–accuracy trade-off meeting the thresholds above.
3. A change of at least 15 percentage points in false-alarm rate.
4. A change of at least 10 percentage points in hit rate.
5. A response-time change of at least 75 ms without a material accuracy change.
6. Broad stability.

Only one primary narrative appears above the block table. Secondary numbers remain visible in the table.

### 13.3 Post-error rules

- A median post-error increase of at least 50 ms, with accuracy on the qualifying post-error trials no worse by 10 percentage points, is described as “slower responses after errors.”
- A median post-error decrease of at least 50 ms, with accuracy no worse by 10 percentage points, is described as “faster responses after errors.”
- A timing difference under 50 ms is described as “similar response speed after errors.”
- When qualifying post-error accuracy is worse by at least 10 percentage points, state the accuracy difference and avoid a timing-only conclusion.
- Post-error behavior is never called learning, caution, overcorrection, or recovery in Public Beta 0.1.

### 13.4 Sequence-context rule

When Section 12.6 denominators are met, report the two false-alarm rates and say either “higher,” “lower,” or “similar” using a 10-percentage-point threshold. The report must add: “This describes your responses in this sequence. It does not mean a NO-GO symbol becomes more likely after a run of GO symbols.”

## 14. Session validity and data-quality rules

### 14.1 Validity statuses

- **Valid:** Complete, no invalidating event, and all quality thresholds met.
- **Valid with timing note:** Complete with exactly one non-severe timing anomaly; accuracy is reportable, the affected trial is excluded from timing measures, and every minimum denominator still holds.
- **Invalid:** Complete or interrupted, but at least one invalidating rule fired. The result may be reviewed for familiarization but cannot be a baseline, drill-routing source, retest, or progress comparison.
- **Incomplete:** Fewer than 80 scored trials resolved for a non-invalidating voluntary exit before form exposure can be completed. Once a scored form has been exposed, an exit also makes the attempt invalid and consumes the form.

### 14.2 Exact focus, tab, and page-lifecycle rules

The protected interval begins when the candidate activates “I’m ready” before warm-up and ends after the completion record is created.

- Any `visibilityState` change from visible to hidden during the protected interval invalidates the session immediately. A tab switch, browser minimization, screen lock, or navigation that hides the document is therefore invalid even if brief.
- Any `pagehide` or browser `freeze` event invalidates immediately. A later `pageshow` or `resume` does not restore validity.
- A window blur while the document remains visible is logged. If focus returns within 1,000 ms, the blur alone does not invalidate. Blur lasting more than 1,000 ms invalidates.
- Repeated brief blurs of 1,000 ms or less do not invalidate by count alone. A separate hidden-page, lifecycle, timing, input, or long-blur rule may still invalidate the session.
- Opening an in-page accessibility panel or changing zoom through a product control during gameplay is not supported; the action invalidates and stops the session. Browser zoom is detected where possible and otherwise captured only as QA context.
- An operating-system notification that does not hide or blur the page is not an invalidating event.

### 14.3 Timing-anomaly definitions

A scored trial has a non-severe timing anomaly if any of these occurs:

- Confirmed stimulus visibility is below 150 ms or above 250 ms.
- The 1,000 ms deadline resolves more than 100 ms but no more than 500 ms late.
- The 1,200 ms post-resolution interval is below 1,100 ms or above 1,300 ms.
- Confirmed stimulus onset occurs more than 100 ms but no more than 500 ms after the eligible scheduled frame while the page remains visible.

A severe timing anomaly occurs if any of these occurs:

- A deadline, onset, or scheduled transition is more than 500 ms late.
- Stimulus visibility is below 100 ms or above 500 ms.
- A timestamp is missing, non-monotonic, negative relative to onset, or incompatible with the event order.
- A required stimulus, resolution, or response event is missing or duplicated.
- The browser reports suspension, freeze, or lifecycle restoration.

One non-severe timing anomaly permits “valid with timing note” if all other rules pass. Two or more non-severe anomalies, or one severe anomaly, invalidates the session. Warm-up anomalies trigger a warning and restart the warm-up once; a second warm-up timing anomaly invalidates the attempt before the scored form is exposed.

### 14.4 Input-quality rules

- Three or more anticipatory accepted responses below 100 ms invalidate the session for baseline/retest use.
- Three or more premature response-key inputs during scored fixation invalidate.
- Five or more wrong-key inputs during the scored task invalidate as a likely input or comprehension problem.
- Ten or more ignored repeated-key events do not by themselves invalidate, because one held key can generate repeats; instead the result is invalid only if held-key protection failed or an ignored repeat affected an outcome.
- Any evidence that a held response key generated a hit or false alarm is a severe implementation/data-integrity failure and invalidates.
- Extra eligible keydowns after a trial has resolved are recorded. Five or more produce an input-quality note; ten or more invalidate.
- A mid-session response-key, visual-profile, timing-profile, input-device-class, or accessibility-setting change invalidates immediately.

### 14.5 Completion and denominator rules

A valid standard session requires exactly 80 resolved scored trials, 60 GO and 20 NO-GO, the manifest checksum to match, and all outcome identities in Section 11 to reconcile. A mismatch is a severe integrity failure.

A session can remain valid when one timing trial is excluded from response-time analysis, but a specific block or derived analysis is suppressed when its denominator falls below Section 12. No missing or anomalous trial may be silently imputed.

### 14.6 Device and environment validity

Standard results require a physical keyboard, supported browser, stable visible page, and minimum 768 × 600 CSS-pixel game viewport at readiness. Resizing below that minimum during the protected interval invalidates. A standard form attempted on a touch-only device cannot start. Approved alternative-key and visual modes are accommodated forms and follow the comparison rules in Sections 20 and 22.

### 14.7 Invalid-result treatment

Invalid attempts remain visible locally with the exact reason, event time, and “Not eligible for comparison” label. They do not update the latest valid result, trigger a drill, consume an existing valid baseline, or appear as progress improvements. The exposed form remains consumed.

## 15. Basic report and exact candidate-facing copy

### 15.1 Report structure

The report order is fixed:

1. Status and context.
2. Outcome counts.
3. Response timing.
4. Block evidence.
5. Speed–accuracy observation.
6. Post-error and sequence-context evidence when sufficient.
7. Data quality.
8. What this result can and cannot establish.
9. Next action.

### 15.2 Dynamic fields

The double-bracket names below are fully defined render fields, not undecided text. Every field must resolve from immutable events and the recorded scoring version, or its entire sentence is replaced by the specified insufficient-data copy.

| Render field | Exact source |
|---|---|
| `[[RESPONSE_KEY]]` | Approved pre-start response-key label |
| `[[HITS]]`, `[[MISSES]]`, `[[CORRECT_WITHHOLDS]]`, `[[FALSE_ALARMS]]` | Section 11 outcome counts |
| `[[CORRECT_TOTAL]]` | Hits plus correct withholds |
| `[[GO_PERCENT]]`, `[[NOGO_PERCENT]]`, `[[OVERALL_PERCENT]]` | Section 11 rounded display rates |
| `[[MEDIAN_RT]]`, `[[RT_IQR]]` | Section 11 timing-clean correct-GO measures |
| `[[FORM_ID]]`, `[[SCORING_VERSION]]`, `[[PROFILE_LABEL]]`, `[[VALIDITY_LABEL]]` | Immutable session context |
| `[[SPEED_ACCURACY_NARRATIVE]]` | The single applicable Section 13 within-session rule |
| `[[POST_ERROR_DELTA]]`, `[[POST_ERROR_DIRECTION]]` | Absolute median difference and “faster” or “slower” under Section 13.3 |
| `[[LONG_RUN_FA]]`, `[[OTHER_FA]]` | Section 12.6 whole-percentage display rates |
| `[[INVALID_REASON_SENTENCE]]` | The single matching exact reason sentence in Section 15.4 |
| `[[BLOCK_GO]]`, `[[BLOCK_NOGO]]`, `[[BLOCK_HITS]]`, `[[BLOCK_WITHHOLDS]]`, `[[BLOCK_ACCURACY]]` | The named completed drill-block counts or rate under Section 18 |
| `[[BASE_ACCURACY]]`, `[[RETEST_ACCURACY]]`, `[[ACCURACY_DELTA]]` | Eligible baseline and retest overall rates and signed percentage-point difference |
| `[[BASE_HIT_RATE]]`, `[[RETEST_HIT_RATE]]`, `[[BASE_WITHHOLD_RATE]]`, `[[RETEST_WITHHOLD_RATE]]` | Eligible baseline and retest category rates |
| `[[BASE_RT]]`, `[[RETEST_RT]]`, `[[RT_DELTA]]`, `[[BASE_IQR]]`, `[[RETEST_IQR]]` | Eligible baseline and retest timing measures; delta is retest minus baseline |
| `[[CROSS_SESSION_SPEED_ACCURACY_NARRATIVE]]` | The single applicable Section 20.4 comparison rule |

### 15.3 Valid-report copy

**Heading:** “Your Stop practice result”  
**Status:** “[[VALIDITY_LABEL]] · [[PROFILE_LABEL]] · Form [[FORM_ID]]”  
**Intro:** “This report describes what happened on this Assessment Practice sequence. It is not an employer score or a personality assessment.”

**Outcome heading:** “Your responses”  
**GO line:** “You responded to [[HITS]] of 60 GO symbols ([[GO_PERCENT]]%). You missed [[MISSES]].”  
**NO-GO line:** “You withheld your response to [[CORRECT_WITHHOLDS]] of 20 NO-GO symbols ([[NOGO_PERCENT]]%). You made [[FALSE_ALARMS]] false alarms.”  
**Overall line:** “Overall, [[CORRECT_TOTAL]] of 80 trials were correct ([[OVERALL_PERCENT]]%).”

**Timing heading:** “Your response timing”  
**Timing line:** “Your median response time on correct GO trials was [[MEDIAN_RT]] ms. The middle half of those responses spanned [[RT_IQR]] ms.”  
**Timing note:** “Response-time results exclude anticipatory responses and trials with timing anomalies.”

**Block heading:** “What happened over the task”  
**Table columns:** “Block,” “GO correct,” “NO-GO correct,” “Median GO response time,” and “Data note.”  
**Narrative lead:** “[[SPEED_ACCURACY_NARRATIVE]]”

**Post-error heading:** “After errors”  
**Supported copy:** “On qualifying correct GO trials after an error, your median response time was [[POST_ERROR_DELTA]] ms [[POST_ERROR_DIRECTION]] than on comparison trials. This is a task-level pattern from this session.”  
**Insufficient copy:** “There were not enough qualifying trials to describe your response speed after errors.”

**Sequence heading:** “After GO runs”  
**Supported copy:** “Your false-alarm rate was [[LONG_RUN_FA]]% when NO-GO followed at least three GO symbols and [[OTHER_FA]]% on other qualifying NO-GO trials. This describes your responses in this sequence. It does not mean a NO-GO symbol becomes more likely after a run of GO symbols.”  
**Insufficient copy:** “There were not enough NO-GO trials in both sequence contexts to make this comparison.”

**Quality heading:** “Data quality”  
**Valid copy:** “This session met the completion, focus, input, and timing rules for a valid result.”  
**Valid-with-note copy:** “This session was complete. One timing anomaly was excluded from response-time analysis; accuracy outcomes remain available.”

**Limitations heading:** “What this result means”  
**Body:** “It shows your accuracy, response timing, and consistency on one Assessment Practice Stop sequence. It cannot establish a stable attention or impulse-control trait, reproduce a proprietary assessment score, predict employer fit, or tell you whether you will be selected. Device, sequence, familiarity, fatigue, and ordinary variation can affect results.”

**Primary Advanced Training action:** “Start recommended training”  
**Secondary actions:** “Practise another sequence” and “Back to library”

### 15.4 Invalid-report copy

**Heading:** “Stop session not valid for comparison”  
**Body:** “[[INVALID_REASON_SENTENCE]] The attempt is saved for review, but it will not be used as a baseline, retest, or progress result.”  
**Evidence note:** “Available counts may help you review the task, but timing and change conclusions are suppressed.”  
**Primary action:** “Restart with a new form”  
**Secondary action:** “Review the guide”

Exact reason sentences are:

- Hidden page: “This page became hidden during the timed task.”
- Focus loss: “The game window was out of focus for more than one second.”
- Timing failure: “Browser timing moved outside the allowed range.”
- Input quality: “The input record did not meet the session-quality rules.”
- Settings change: “An input or accessibility setting changed during the timed task.”
- Incomplete record: “The task ended before all 80 scored trials were recorded.”
- Unsupported device: “The timed task did not run in the supported physical-keyboard setup.”
- Integrity mismatch: “The recorded trials did not match the assigned form.”

### 15.5 Example completed report language

An example with resolved values may be used in QA and product explanation:

“You responded to 57 of 60 GO symbols (95%). You missed 3. You withheld your response to 17 of 20 NO-GO symbols (85%). You made 3 false alarms. Your median response time on correct GO trials was 438 ms. The middle half of those responses spanned 96 ms. You were faster in the final block, while NO-GO accuracy was lower. This is a speed–accuracy trade-off on this sequence, not a personality conclusion.”

## 16. Advanced Training evidence and boundaries

### 16.1 Eligibility

Advanced Training needs a valid baseline with:

- 80 reconciled standard trials or an approved accommodated counterpart.
- At least 50 eligible GO outcomes and 16 eligible NO-GO outcomes overall.
- At least 40 timing-clean correct GO hits for timing-based rules.
- Sufficient half-session denominators for consistency routing and sufficient block denominators only for descriptive block reporting.
- No invalidity under Section 14.

If no routing rule has sufficient data, the product offers replay/practice, not a pseudo-personalized conclusion.

### 16.2 Evidence card

Every recommendation displays:

- **Observed:** exact counts, rates, timing, or block change that fired the rule.
- **Possible task advantage:** a narrow description of where the pattern helped inside this task.
- **Possible trade-off:** the corresponding task cost.
- **Next exercise:** the deterministically selected drill.
- **Limitation:** “This recommendation is based only on your Assessment Practice task data. It is not a diagnosis or employer profile.”

### 16.3 Allowed and prohibited language

Allowed: “False alarms rose from 1 in trials 1–40 to 3 in trials 41–80 (10% to 30%).”  
Allowed: “The response-withholding drill focuses on keeping the response rule stable when GO responses become frequent.”  
Prohibited: “You are impulsive.”  
Prohibited: “Your attention is weak.”  
Prohibited: “This will improve your job performance.”  
Prohibited: “Employers want a lower score here.”

### 16.4 No causal training claim

A baseline-to-retest difference may reflect practice, sequence difficulty, device conditions, fatigue, random variation, or the drill. Public Beta 0.1 can show the difference but cannot attribute it to training without a suitable study.

## 17. Deterministic drill-selection rules

### 17.1 Rule version

Initial rule set: `stop_drill_router_v1`. The session stores the rule version, all candidate trigger values, exclusions, chosen rule, normalized severity, and tie-break result.

### 17.2 Candidate triggers

| Rule | Minimum data | Trigger | Exclusion | Normalized severity |
|---|---|---|---|---|
| Response withholding | 20 eligible NO-GO outcomes | False-alarm rate at least 20% | None beyond validity | false-alarm rate ÷ 0.20 |
| Detection | 50 eligible GO outcomes and 16 eligible NO-GO outcomes | Miss rate at least 10% and false-alarm rate below 20% | Do not select if response-withholding severity is eligible and higher | miss rate ÷ 0.10 |
| Consistency | Trials 1–40 and trials 41–80 meet the applicable Section 12.3 denominators | From the first half to the second half: overall accuracy falls at least 10 percentage points; or hit rate falls at least 10 points; or false-alarm rate rises at least 20 points **and** the second half contains at least 2 more false alarms than the first half | Never route from Blocks 1 and 4 alone; suppress any component without its half-session denominator | Maximum of accuracy drop ÷ 0.10, hit-rate drop ÷ 0.10, or—only when both false-alarm conditions pass—false-alarm increase ÷ 0.20 |
| Response stability | At least 40 timing-clean correct GO hits; hit rate at least 90%; false-alarm rate below 20% | Overall correct-GO response-time IQR at least 150 ms | Not eligible when timing note or anomaly materially produces the spread | IQR ÷ 150 ms |
| Balanced maintenance | Valid baseline | No targeted rule reaches 1.0 | None | 1.0 |

### 17.3 Selection and tie-breaking

1. Remove rules that fail validity, denominator, or exclusion conditions.
2. Calculate each remaining normalized severity using unrounded values.
3. Select the highest severity.
4. If two severities differ by less than 0.001, use this fixed priority: response withholding, detection, consistency, response stability, balanced maintenance.
5. Assign exactly one primary drill. Show other supported patterns as secondary evidence only; do not assign multiple simultaneous drills in Public Beta 0.1.
6. If the balanced-maintenance exercise is selected, say: “No targeted threshold was reached. Use a mixed exercise to maintain the rule under a new sequence.”

These thresholds are transparent original beta routing rules, not clinical cutoffs or scientifically validated norms.

## 18. Complete initial drills

### 18.1 Shared drill rules

- Every drill begins with the exact rule and one GO/NO-GO example.
- Drill data is never substituted for a baseline or retest.
- Drill stimuli use original sequences and the candidate’s preselected visual and input profile.
- Trial-level correctness feedback is not shown. A brief block summary is allowed so the exercise can coach a specific behavior.
- A drill is complete only when every required block is finished without an invalidating interruption. An invalid drill may be restarted without consuming a retest form.
- Drill reports show only the targeted behavior and the same limitations language.

### 18.2 Response-withholding drill

**Purpose:** Practise maintaining the withhold rule when frequent GO responses create a response habit.  
**Structure:** 72 trials in three blocks of 24. Block distributions are 12 GO/12 NO-GO, 16 GO/8 NO-GO, and 18 GO/6 NO-GO.  
**Timing:** 200 ms stimulus, 1,100 ms response deadline, 1,000 ms post-resolution fixation.  
**Sequence constraints:** Maximum 6 GO and 8 NO-GO in a run; at least 3 NO-GO trials in Blocks 2 and 3 follow at least 3 GO trials. The conditional position is not disclosed and does not make NO-GO predictable.  
**Between-block summary:** “Block complete. GO correct: [[BLOCK_GO]]. NO-GO correct: [[BLOCK_NOGO]]. Keep using the symbol, not the preceding run, to decide.”  
**Completion evidence:** False-alarm rate by block and median correct-GO response time.  
**Candidate introduction:** “This exercise gives you more chances to practise withholding. A run of GO symbols does not predict the next symbol.”

### 18.3 Detection drill

**Purpose:** Practise responding reliably to GO without encouraging guesses on NO-GO.  
**Structure:** 72 trials in three blocks of 24, each with 18 GO and 6 NO-GO.  
**Timing:** Block 1 uses a 1,200 ms deadline; Block 2 uses 1,100 ms; Block 3 uses the standard 1,000 ms. Stimulus visibility remains 200 ms and post-resolution fixation is 1,000 ms.  
**Sequence constraints:** Maximum 8 GO and 8 NO-GO; no predictable alternation.  
**Between-block summary:** “Block complete. You responded to [[BLOCK_HITS]] of 18 GO symbols and withheld on [[BLOCK_WITHHOLDS]] of 6 NO-GO symbols.”  
**Completion evidence:** Miss rate by deadline block, false-alarm rate, and median correct-GO response time.  
**Candidate introduction:** “This exercise narrows the response window across three blocks. Respond to each GO symbol; do not press for NO-GO.”

### 18.4 Consistency drill

**Purpose:** Practise maintaining the same rule across a longer sequence.  
**Structure:** 120 trials in four blocks of 30, each with 22 GO and 8 NO-GO except Block 4 with 24 GO and 6 NO-GO; total 90 GO and 30 NO-GO.  
**Timing:** Standard 200/1,000/1,200 ms timing.  
**Breaks:** A mandatory 15-second neutral reset appears between drill blocks. It is part of the drill and is not used in standard-form comparison.  
**Sequence constraints:** Maximum 8 GO and 8 NO-GO; each block includes at least one GO run of 4 or more.  
**Between-block summary:** “Block complete. Accuracy: [[BLOCK_ACCURACY]]%. When the next block begins, keep the same response rule.”  
**Completion evidence:** Block hit rate, false-alarm rate, median response time, and IQR.  
**Candidate introduction:** “This longer exercise focuses on keeping your responses consistent from the first block to the last.”

### 18.5 Response-stability drill

**Purpose:** Practise a repeatable response rhythm without rewarding indiscriminate speed.  
**Structure:** 72 trials in three blocks of 24, each with 18 GO and 6 NO-GO.  
**Timing:** Standard 200 ms stimulus and 1,000 ms deadline; post-resolution fixation is fixed at 1,200 ms.  
**Feedback:** Between blocks, show median correct-GO response time and IQR, plus both GO and NO-GO accuracy. Do not display a target millisecond band.  
**Sequence constraints:** Maximum 8 GO and 8 NO-GO.  
**Completion evidence:** IQR change across blocks, median response time, hit rate, and false-alarm rate.  
**Candidate introduction:** “This exercise focuses on repeatable timing while preserving both GO and NO-GO accuracy. There is no ideal reaction time to chase.”

### 18.6 Balanced-maintenance exercise

**Purpose:** Provide useful continued practice when no targeted threshold is reached.  
**Structure:** 60 trials in three blocks of 20, each with 15 GO and 5 NO-GO.  
**Timing:** Standard timing.  
**Sequence constraints:** Standard-form run constraints with a new drill-only seed.  
**Between-block summary:** Counts and median correct-GO response time without evaluative labels.  
**Candidate introduction:** “No targeted threshold was reached in your valid baseline. This mixed exercise lets you practise the full rule on a new sequence.”

## 19. Unseen retest

### 19.1 Eligibility

A candidate becomes eligible for one retest in a chain when:

- The chain contains one valid baseline.
- The assigned drill under the recorded router version is complete and valid.
- The baseline and planned retest use the same visual profile, timing profile, input binding, and input-device class.
- At least one unexposed retest form remains locally.
- No local-data deletion or storage-mode change has broken the chain.

There is no mandatory waiting period in Public Beta 0.1. The candidate may retest immediately, but history records elapsed time from baseline and drill so the report can state it.

### 19.2 Candidate-facing retest copy

**Heading:** “Try a new Stop sequence”  
**Body:** “This retest uses the same rules and timing with a sequence you have not started on this browser. Sequence differences and ordinary variation can affect the result, so the comparison does not prove that the drill caused a change.”  
**Action:** “Start unseen retest”

### 19.3 Reservation and consumption

- Opening the retest explanation reserves the least recently exposed eligible retest form for 30 minutes but does not consume it.
- Leaving before the first scored stimulus releases the reservation and does not consume the form.
- The first confirmed scored stimulus marks the form exposed and consumed, even if the session later becomes invalid, incomplete, or is deleted.
- An invalid consumed retest cannot be restarted with the same form. Use the next unexposed retest form if available.
- One valid retest completes the chain. Further practice requires a new valid baseline and new chain.
- If no unexposed retest form remains, show: “You have used the available retest sequences on this browser. You can still practise, but another result cannot be labeled an unseen retest in this version.”

### 19.4 Retest integrity

Retests use the exact standard state machine, timing, scoring, data quality, interruption, and reporting rules. They never use drill timing. A retest is not silently downgraded to replay if it becomes invalid; it remains an invalid retest attempt and consumes the form.

## 20. Baseline-versus-retest comparison

### 20.1 Comparison eligibility

Show a metric-level comparison only when both sessions are valid, use the same specification and compatible scoring rules, and share the same visual profile, timing profile, response binding, and input-device class. A scoring migration may enable comparison only if it deterministically rescored both immutable event sets under one approved version and preserves the original summaries.

Standard and accommodated forms must never be compared with each other. Two sessions using the same accommodated profile may be compared, labeled “within this accommodation,” but not described as equivalent to or ranked against standard performance. Different accommodation profiles are side-by-side history only.

### 20.2 Metrics

Compare:

- Hits and hit rate.
- Misses and miss rate.
- Correct withholds and correct-withhold rate.
- False alarms and false-alarm rate.
- Overall accuracy.
- Median timing-clean correct-GO response time.
- Correct-GO response-time IQR.
- First-to-last block changes when both sessions meet block denominators.
- Post-error difference only when both sessions independently meet Section 12.5 denominators.

### 20.3 Exact comparison copy

**Heading:** “Baseline and new-sequence retest”  
**Intro:** “This compares two valid Assessment Practice sessions with the same settings. The retest used a sequence not previously started on this browser.”  
**Accuracy sentence:** “Overall accuracy changed from [[BASE_ACCURACY]]% to [[RETEST_ACCURACY]]% ([[ACCURACY_DELTA]] percentage points).”  
**GO sentence:** “GO hit rate changed from [[BASE_HIT_RATE]]% to [[RETEST_HIT_RATE]]%.”  
**NO-GO sentence:** “NO-GO correct-withhold rate changed from [[BASE_WITHHOLD_RATE]]% to [[RETEST_WITHHOLD_RATE]]%.”  
**Timing sentence:** “Median correct-GO response time changed from [[BASE_RT]] ms to [[RETEST_RT]] ms ([[RT_DELTA]] ms).”  
**Variability sentence:** “Response-time variability changed from an IQR of [[BASE_IQR]] ms to [[RETEST_IQR]] ms.”  
**Interpretation:** “[[CROSS_SESSION_SPEED_ACCURACY_NARRATIVE]]”  
**Limitation:** “This is a descriptive difference between two Assessment Practice sequences. It does not prove that the drill caused the change, that a stable trait changed, or that workplace performance will change.”

### 20.4 Cross-session speed–accuracy rules

Apply the same 50 ms and 10-percentage-point thresholds in Section 13 to overall accuracy first, then disclose category-specific changes. If accuracy improves by at least 10 points while response time slows at least 50 ms, say “The retest was more accurate and slower.” If accuracy declines by at least 10 points while response time improves at least 50 ms, say “The retest was faster and less accurate.” Never reduce the result to a single “improvement percentage.”

### 20.5 Form-difficulty warning

Every comparison displays: “Assessment Practice forms share the same design rules but have not yet been calibrated as equivalent. Some change may reflect sequence difficulty or ordinary variation.”

## 21. Local storage, deletion, and history

### 21.1 Stored locally

The browser stores:

- Consent and accessibility settings.
- Input binding and device-check result.
- Immutable completed or invalid session events and summary snapshots.
- Form exposure and reservation history.
- Baseline, drill, retest, and chain relationships.
- Scoring, router, form, generator, storage-schema, and specification versions.
- Mock-assessment link when Stop was played in the mock.
- Local-only history presentation preferences.

The browser does not need an account, email address, name, employer, proprietary employer result, or server copy.

### 21.2 Retention and deletion

Retain local records until the candidate deletes individual history items, uses “Delete all Assessment Practice data,” clears browser/site data, or the browser evicts storage. Deleting one displayed result removes that result and its event record, but retains a minimal local form-exposure marker containing the form identity, exposure date, accommodation profile, and deletion flag so the product does not falsely relabel the form as unseen.

Before individual deletion, show:

**Heading:** “Delete this Stop result?”  
**Body:** “This removes the result and its event record from your history. A minimal form-exposure marker will remain so this browser does not describe a sequence you already started as unseen. To remove that marker too, use Delete all Assessment Practice data.”  
**Destructive action:** “Delete this result”  
**Cancel:** “Keep this result”

“Delete all Assessment Practice data” removes results, event records, settings, training chains, and all form-exposure markers after explicit confirmation.

Exact confirmation copy:

**Heading:** “Delete all local Assessment Practice data?”  
**Body:** “This removes results, events, settings, training chains, and form-exposure history from this browser. It cannot be undone. If you return later, the product will not know which forms you previously saw and cannot guarantee that a sequence is new relative to your earlier use.”  
**Destructive action:** “Delete all local data”  
**Cancel:** “Keep my data”

### 21.3 History screen

Each record shows date, mode, validity, form, profile label, overall accuracy, GO hit rate, NO-GO correct-withhold rate, median response time when available, and chain status. Invalid attempts are visible but visually distinct and never plotted as progress. The candidate can open the original versioned report, delete an individual record, or start eligible practice.

Progress charts include only valid sessions with the same accommodation and input profile. Standard and accommodated histories are separated into labeled series. The interface never draws a trend line across incompatible profiles.

### 21.4 Storage unavailable at preflight

If persistent local storage is blocked or unavailable, show:

**Heading:** “Results cannot be saved in this browser”  
**Body:** “You can complete Stop in this tab, but closing or refreshing the page will erase the result. History will be unavailable. A baseline, drill, and retest can stay linked only while this tab remains open.”  
**Primary action:** “Continue without saving”  
**Secondary action:** “Try storage check again”

Temporary-memory mode permits practice and one same-tab Advanced Training chain. It may call a retest unseen only relative to forms exposed in that active in-memory chain. It must not claim that a form is unseen relative to earlier visits.

### 21.5 Storage failure after start

The active tab keeps an in-memory event buffer and retries the local write once at completion. If persistence still fails, the task result can remain valid for the active tab, but it receives `temporary_memory` storage status, is not promised in future history, and shows:

“Your task data were recorded in this tab but could not be saved in this browser. Keep this tab open to review the result or continue the current training chain.”

A storage failure alone does not change task accuracy or timing validity. Reloading or closing the tab ends the temporary chain.

### 21.6 Cleared or evicted storage

On a later visit with no installation record, treat the browser as a fresh local installation. Do not attempt to reconstruct prior results. Show the disclosure during the first new device check. Any previous retest chain is gone. A new baseline is required, and “unseen” means unseen within the new installation only. The product must never imply that clearing data restores globally fresh forms.

## 22. Accessibility and responsive behavior

### 22.1 Core access

- All guide, settings, report, history, error, and training-selection screens meet WCAG 2.2 AA for keyboard navigation, focus visibility, semantics, contrast, zoom/reflow, and screen-reader labeling within the product’s declared support boundary.
- Color is not the sole stimulus cue. The standard red and green circles include distinct high-contrast internal markers.
- Instructions state the rule in words and show static examples.
- The response key is remappable before a run.
- Reduced-motion mode removes nonessential motion without altering trial timing.
- Focus is programmatically moved only at screen transitions and is never trapped outside the active timed canvas.
- Live trial stimuli have concise accessible names only when the selected assistive profile can present them without adding asynchronous timing distortion. Unsupported screen-reader-timed gameplay is disclosed rather than misrepresented.

### 22.2 High-distinction visual accommodation

For a candidate who cannot reliably discriminate the standard red/green presentation even with the redundant markers, offer `shape_accommodation_v1` before readiness:

- GO becomes a high-contrast solid diamond with a vertical marker.
- NO-GO becomes a high-contrast outlined circle with a horizontal marker.
- Text instructions use GO and NO-GO rather than color names.
- Trial counts, distribution, and standard timing stay the same.
- The report label is “High-distinction shape accommodation.”
- The result is never compared with a standard color-plus-marker form. It may be compared only with another valid session using the same accommodation and input profile, labeled “within this accommodation.”

Exact disclosure: “This version uses more distinct shapes so the rule does not depend on red–green discrimination. It is an accommodated Assessment Practice form and is not treated as equivalent to the standard visual form.”

### 22.3 Extended-time mode after Public Beta 0.1

Extended-time mode is postponed until after Public Beta 0.1. The beta must not display an extended-time selector, create an extended-time form, route an extended-time result, or compare extended-time and standard results. A later release requires a separately founder-approved specification covering timing, labeling, drill thresholds, validation, input/device effects, and comparison boundaries. The high-distinction visual accommodation in Section 22.2 remains included in Public Beta 0.1.

### 22.4 Physical-input limitation

The timed task depends on a rapid intentional response. If a screen reader, switch device, voice input, virtual keyboard, or other assistive input adds uncontrolled latency, the product allows guide access and may allow a separately labeled familiarization run, but does not present standard response-time comparisons. Candidate copy:

“This input method can change response timing. You can use it to learn the rule, but this beta will not compare the timing result with the standard physical-keyboard form.”

### 22.5 Responsive support

- Guide, examples, settings, reports, history, and explanations support widths from 320 CSS pixels upward and zoom to 200% without loss of content.
- The standard timed game requires a viewport of at least 768 × 600 CSS pixels and a physical keyboard.
- At supported game sizes, the centered stimulus remains fully visible without scrolling, and the response key never scrolls the page.
- Orientation change or resizing below the minimum during a timed run invalidates under Section 14.

### 22.6 Unsupported mobile and touch-only devices

On a phone, touch-only tablet, or any setup that fails the physical-key input check, the standard Start action is disabled. The guide, examples, reports, and history remain usable. Exact copy:

**Heading:** “Use a physical keyboard for the timed Stop game”  
**Body:** “This beta does not treat touch responses as comparable with the keyboard task. Open this game on a laptop or desktop with a physical keyboard. You can still review the guide on this device.”  
**Action:** “Review the guide”

The product must not silently substitute tapping for Space in a standard form. A future touch accommodation requires its own specification, label, thresholds, and comparison rules.

## 23. Errors, recovery, and analytics

### 23.1 Recoverable pre-start errors

| Error | Exact candidate copy | Recovery |
|---|---|---|
| Response key not detected | “We did not detect the selected response key. Check your keyboard or choose another key.” | Retry input check or remap |
| Response key held | “Release the response key before starting.” | Enable action after keyup |
| Viewport too small | “The timed game needs a larger visible area. Enlarge the window or use a larger screen.” | Recheck automatically |
| Unsupported browser feature | “This browser cannot provide the timing or storage checks required for a valid session.” | Offer supported-browser guidance and guide-only access |
| Storage blocked | Use Section 21.4 copy | Retry or temporary-memory mode |
| No unused family form | “No unused form is available for this activity in the current beta.” | Offer replay if appropriate; never relabel an exposed form unseen |

### 23.2 Mid-run invalidation screen

**Heading:** “This run cannot continue as a valid session”  
**Body:** “[[INVALID_REASON_SENTENCE]] Your completed events are preserved locally for review. Restarting will use another available form.”  
**Primary action:** “Restart with a new form”  
**Secondary action:** “Return to the guide”

The engine stops immediately. It does not ask the candidate to continue a known-invalid timed run.

### 23.3 Unexpected application failure

If the game detects an unhandled state or record-integrity failure:

**Heading:** “Stop could not finish this session”  
**Body:** “A technical problem interrupted the task. This attempt will not be used as a baseline or retest. You can restart with a new form.”  
**Actions:** “Restart with a new form” and “Return to library”

Store a local diagnostic containing the error class, state, form/version, event sequence number, browser family/version, and timing context. Do not store raw stack traces in optional external analytics.

### 23.4 Scoring recovery

If all immutable events are present but report rendering fails, do not consume another form. On reload, reproduce the summary using the recorded scoring version and show the report. If event integrity cannot be verified, mark invalid rather than estimating outcomes.

### 23.5 Approved minimal beta analytics

Public Beta 0.1 includes minimal first-party analytics only after the candidate gives separate, informed consent. Before consent, no analytics event is sent. Declining or withdrawing consent never blocks or degrades the guide, game, report, drill, retest, or local history.

Each consented browser session uses a random ephemeral first-party session identifier. It exists only for that browser session, is not written to persistent browser storage, is not reused on a later session, cannot be joined to an account or advertising identifier, and is not shared with another site. No cookie or identifier may support cross-site tracking.

The allowed event set is limited to coarse funnel and technical events:

- stop_guide_opened.
- stop_device_check_completed with pass/fail and a coarse technical reason.
- stop_session_started with mode only.
- stop_session_ended with completed, invalid, or technical-failure status only.
- stop_report_viewed.
- stop_training_recommendation_shown, without drill identity or triggering metrics.
- stop_drill_started and stop_drill_completed, without drill identity or performance data.
- stop_retest_started and stop_retest_completed.
- coarse storage-failure or technical-error class.

Analytics payloads must not contain raw or realized sequences, trial identities, reaction times, response-time summaries, accuracy values, outcome counts, scores, key values, input bindings, personal information, free text, employer or invitation information, accommodation selections, trait labels, drill identities, local-history identifiers, persistent device identifiers, or full IP addresses retained as data. Operational infrastructure must avoid persisting full IP addresses and must not enrich events with geolocation or third-party identity data.

The proposed retention period is 90 days from collection, followed by deletion. The consent notice must state that period. Any longer retention, aggregation that could preserve session-level records, new event, or new field requires founder and privacy approval before collection.

### 23.6 Operational diagnostics

Release QA must monitor aggregate technical completion, invalidity reasons, timing-anomaly frequency, storage-failure frequency, and report-calculation discrepancies in controlled testing. Candidate performance distributions are not normative benchmarks and must not be used to create pass thresholds.

## 24. Acceptance-test matrix, required assets, and risks

### 24.1 Acceptance-test matrix

Every test uses the released form manifests and a deterministic synthetic event fixture where applicable. “Pass” means both visible behavior and stored events match this specification.

| ID | Area | Test | Required result |
|---|---|---|---|
| S01 | Journey | Complete guide through report | Exact Section 5 order; no missing screen |
| S02 | Copy | Compare rendered copy with Sections 5, 15, 19–23 | Exact approved meaning; no competitor wording, placeholder, trait, employer-fit, or pass claim |
| S03 | Comprehension | Miss one of three questions | Cannot proceed; rule review offered |
| S04 | Comprehension | Answer all three correctly | Device check becomes available |
| S05 | Device | Physical response key succeeds | Correct binding stored before readiness |
| S06 | Device | Touch-only/no physical key | Standard Start disabled; exact mobile copy shown |
| S07 | Space | Press Space throughout active canvas | No page scroll; eligible first keydown alone can score |
| S08 | Space scope | Press Space on ordinary non-game page | Normal page behavior remains available |
| S09 | Held key | Hold response key before readiness | Start disabled until keyup; no inherited response |
| S10 | Repeat | Hold key during a trial | First eligible keydown accepted; repeated keydowns logged and ignored |
| S11 | Extra input | Press response key twice in one trial | One outcome; extra input logged |
| S12 | Wrong key | Press non-response key | Ignored and logged; response window remains open |
| S13 | Fixation input | Press during fixation | Premature event; not carried to next trial |
| S14 | Late input | Press after 1,000 ms | Resolved outcome unchanged; late event logged |
| S15 | Stimulus timing | Inspect frame-confirmed presentation | Target 200 ms; anomaly bands match Section 14 |
| S16 | Initial fixation | Start warm-up and scored task | 1,000 ms fixation before each first trial |
| S17 | Response window | Respond after 200 ms but by 1,000 ms | Response accepted after stimulus disappearance |
| S18 | Progression | Respond at 350 ms and compare timeout | Next requested onset follows resolution + 1,200 ms; timeout path follows 1,000 + 1,200 ms |
| S19 | Warm-up | Finish 8 warm-up trials | Not included in score or form exposure; transition copy shown |
| S20 | Live canvas | Observe full scored run | No score, trial counter, progress, or correctness feedback |
| S21 | Form count | Validate every standard manifest | Exactly 80 trials, 60 GO/20 NO-GO, four 15/5 blocks |
| S22 | Runs | Validate every standard and drill manifest | No GO run over 8, no NO-GO run over 8; every standard form includes at least one GO run of 4+ |
| S23 | Sequence context | Validate every standard manifest | At least four NO-GO trials after 3+ GO; no gambler’s-fallacy rule |
| S24 | Form difference and originality | Compare every pair across all 14 released standard manifests | At least 24 of 80 positions differ and no more than 56 are identical; all other count/run/context constraints remain achievable; different seeds/families; no observed reference sequence copied |
| S25 | Exposure | Leave before first scored stimulus | Form not consumed |
| S26 | Exposure | Exit after first scored stimulus | Form consumed and attempt invalid/incomplete as applicable |
| S27 | Scoring | Feed known 57/3/17/3 fixture | Counts reconcile and rates display 95%, 5%, 85%, 15%, 93% overall |
| S28 | RT | Include correct GO hits at 99, 100, 1,000, and 1,001 ms | 99 scores outcome but excluded from RT; 100 and 1,000 included; 1,001 late |
| S29 | Quartiles | Feed fixed eligible RT series | Median and inclusive IQR match approved scoring fixture |
| S30 | Blocks | Use complete form | Four hidden 20-trial blocks with defined denominators and report rows |
| S31 | Insufficient block | Remove eligible RTs below 10 in one block | RT block comparison suppressed with exact copy |
| S32 | Speed–accuracy | Test every threshold boundary at 49/50 ms and 9/10 points | Narrative follows Section 13 exactly |
| S33 | Post-error | Test 3 and 4 qualifying pairs | 3 suppressed; 4 reported with 12+ controls |
| S34 | Sequence analysis | Test below and at both denominators | Copy appears only at 4 long-run and 8 comparison NO-GO trials |
| S35 | Visibility | Hide page for any duration during protected interval | Immediate invalidation and stop |
| S36 | Blur | Blur 999 ms once with no anomaly | Logged, not invalid |
| S37 | Blur | Test one blur over 1,000 ms and repeated blurs of 1,000 ms or less | Long blur invalidates; repeated brief blurs alone are logged and do not invalidate |
| S38 | Lifecycle | Trigger pagehide/freeze/resume | Invalid; never silently resumed |
| S39 | Timing note | Inject one non-severe anomaly | Valid with timing note; affected RT excluded |
| S40 | Timing invalid | Inject two non-severe or one severe anomaly | Invalid; no baseline/retest use |
| S41 | Input quality | Test 3 anticipatory, 3 premature, 5 wrong, and 10 extra inputs | Each respective boundary invalidates |
| S42 | Settings | Change key, visual, timing, device class, or accessibility during run | Immediate invalidation |
| S43 | Completion integrity | Remove or duplicate a required trial event | Invalid integrity mismatch; no estimated result |
| S44 | Report | Render valid, valid-with-note, invalid, and insufficient-data fixtures | Correct sections, copy, fields, and suppressed narratives |
| S45 | Router | Test every trigger at below/equal/above threshold, including different Block 1/4 patterns with identical half-session totals | Exact eligible drill and severity recorded; consistency uses trials 1–40 versus 41–80 and never Blocks 1 and 4 alone; false-alarm consistency requires both a rise of at least 20 points and at least 2 additional false alarms |
| S46 | Tie break | Create severities within 0.001 | Fixed priority order applied |
| S47 | Balanced routing | Keep all targeted severities below 1.0 | Balanced-maintenance exercise assigned |
| S48 | Drills | Validate each drill manifest and timing | Counts, block distributions, feedback, and constraints match Section 18 |
| S49 | Drill validity | Interrupt drill | No retest eligibility; drill can restart without consuming retest |
| S50 | Retest reservation | Leave explanation before first scored onset | Reservation released; form unconsumed |
| S51 | Retest consumption | Interrupt after first scored onset | Retest form consumed; next unused form offered |
| S52 | Retest exhaustion | Consume four retest forms | Exact exhaustion copy; no unseen label on replay |
| S53 | Comparison compatibility | Pair standard with accommodated or different profiles | No change comparison; side-by-side history only |
| S54 | Comparison copy | Pair two valid compatible sessions | All metric changes, trade-off rule, causal limitation, and form warning shown |
| S55 | Storage normal | Complete and reload | Immutable events, summary, exposure, and chain restored |
| S56 | Individual delete | Delete one result | Exact warning explains that result/events are removed and a minimal form-exposure marker remains; marker is retained |
| S57 | Delete all | Confirm local deletion | Records and all form-exposure markers removed; exact warning shown first |
| S58 | Storage unavailable | Block persistent storage | Temporary-memory copy; same-tab chain only; no persistent-history claim |
| S59 | Storage fails at completion | Force write failure | In-memory report remains; exact warning; validity not changed solely by storage |
| S60 | Fresh install | Clear all storage and revisit | New baseline required; no globally-unseen claim |
| S61 | Visual access | Inspect standard stimuli without color | Internal markers distinguish GO/NO-GO; instructions match |
| S62 | Shape accommodation | Complete high-distinction form | Profile labeled; comparison only within same accommodation |
| S63 | Extended time | Inspect every Public Beta 0.1 entry point, form registry, router, report, and test fixture | No extended-time selector, form, route, comparison, or beta claim exists; feature is explicitly postponed |
| S64 | Keyboard access | Navigate all non-timed screens and remap input | Logical order, visible focus, semantic labels |
| S65 | Responsive | Test 320 px content screens and 768 × 600 game | Content reflows; game has no scroll and stimulus remains visible |
| S66 | Resize | Drop below minimum during run | Invalidated with recoverable path |
| S67 | Reduced motion | Enable before run | Nonessential motion removed; timings unchanged |
| S68 | Error recovery | Fail report render with intact events | Same form result recovered under recorded scoring version |
| S69 | Technical failure | Inject unhandled state | Invalid technical message; no partial valid report |
| S70 | Analytics consent | Decline or withdraw consent, then use the full product | No analytics request; guide, gameplay, report, training, retest, and local history remain fully available |
| S71 | Analytics payload and retention | Consent, inspect all events and identifiers, end the browser session, and verify expiry policy | Only approved coarse events; ephemeral first-party session id is not persisted or reused; no cross-site tracking; no sequences, reaction times, scores, keys, personal/employer information, accommodation or trait labels; proposed deletion at 90 days |
| S72 | Reproducibility | Recompute every fixture from stored events | Displayed outcomes exactly reproducible under recorded version |
| S73 | History | Mix valid, invalid, standard, and accommodated records | Invalid excluded from progress; incompatible profiles separated |
| S74 | Claims | Search all Stop copy | No personality, diagnosis, employer-fit, prediction, pass, guarantee, or proprietary-equivalence claim |
| S75 | Originality | Rights/provenance review | Every visual, string, form, and asset original or rights-cleared; no competitor layout/report copied |

### 24.2 Required assets and content

Before implementation is complete, the Stop package must contain:

- Original standard GO, standard NO-GO, fixation, and high-distinction accommodated stimulus assets in scalable form.
- Light and dark/high-contrast verified color tokens with documented contrast.
- Approved static guide illustrations distinct from live assets where needed.
- Four baseline, six replay/practice, and four retest manifests with ids, seeds, versions, checksums, distribution/run/context audit, full pairwise difference audit, and originality review.
- Versioned manifests for four targeted drills and the balanced-maintenance exercise.
- Three comprehension items and four coached examples with approved copy.
- Exact report, invalidity, storage, mobile, accessibility, exhaustion, and error copy from this document.
- Synthetic event fixtures covering scoring, thresholds, timing anomalies, routing, invalidity, storage, and comparison.
- Asset-provenance record and an explicit declaration that observed competitor sequences, wording, visual design, and report were not copied.
- Browser/device support matrix and timing-QA results for each supported environment.
- Accessibility review record, including keyboard, screen reader for content screens, contrast, zoom/reflow, reduced motion, and accommodated-form labeling.

### 24.3 Material risks and mitigations

| Risk | Consequence | Required mitigation / release gate |
|---|---|---|
| Browser scheduling variance | Misleading RT or comparison | Frame-confirmed timing, exact anomaly thresholds, supported-browser QA, invalidation rules |
| False equivalence to employer assessment | Candidate misunderstanding or legal risk | Invitation-first and independence copy; no exact-replica claim |
| Competitor-expression copying | IP/passing-off risk | Original assets, copy, layout, manifests, report, provenance review, proportionate legal review |
| Trait overreach | Harmful or unsupported conclusions | Task-level language only; claims search and founder review |
| Uncalibrated forms | Apparent change caused by sequence | New-sequence wording, fixed parameters, no equivalence claim, later calibration |
| Drill threshold overinterpretation | Pseudo-scientific personalization | Publish thresholds as original beta rules; deterministic evidence card; no validated-cutoff claim |
| Color-vision exclusion | Rule inaccessible | Redundant markers and separately labeled high-distinction form |
| Assistive-input latency | Invalid timing comparison | Familiarization-only or separately specified accommodation; no standard comparison |
| Touch/mobile substitution | Non-comparable input | Disable standard timed game; responsive guide/report only |
| Local data loss | Lost history and exposure tracking | Plain disclosure, delete confirmation, temporary-memory behavior, no global-unseen claim |
| Form exhaustion | Reuse falsely called unseen | Exposure tracking, consumption rules, exact exhaustion copy |
| Tab/focus interruptions | Invalid continuous task | Immediate, exact invalidation and recoverable restart |
| Space-bar scrolling or repeat | Corrupted responses | Scoped default prevention, key transition rules, held/repeat acceptance tests |
| Minimal beta analytics | Privacy and trust risk | Separate opt-in consent, ephemeral first-party session id, no cross-site tracking, strict prohibited-field list, proposed 90-day deletion, and no loss of functionality when declined |
| Small beta sample | Temptation to create norms | No percentiles or pass thresholds; distributions only for technical QA |

### 24.4 Release-blocking verification

Stop is not complete until all applicable tests S01–S75 pass, all released forms and assets have provenance, displayed results reproduce from event fixtures, serious accessibility blockers are resolved, supported-browser timing evidence passes the thresholds, no placeholder or prohibited claim remains, and the approved founder decisions in Section 25 have been incorporated into a frozen version.

## 25. Founder Approval Table and final Codex implementation handoff

### 25.1 Founder Approval Table

Only material product decisions are listed. Ordinary implementation details are intentionally excluded. The founder dispositions below incorporate the correction message and supersede the pending dispositions in V1.

| Approval ID | Material decision | Approved disposition | Why the decision is material | Founder disposition |
|---|---|---|---|---|
| F01 | Standard simulation design | 80 trials; 60 GO/20 NO-GO; four hidden 15/5 blocks; 8-trial warm-up; 200 ms stimulus; 1,000 ms deadline; 1,200 ms post-resolution fixation; 1,000 ms initial fixation; maximum runs of 8 GO and 8 NO-GO | Defines the candidate experience, task length, and downstream metrics | **Approved as modified** |
| F02 | Form inventory, difference, and exposure | 4 baseline, 6 replay/practice, and 4 retest forms; every pair differs at 24 or more positions and matches at no more than 56; stored seeded manifests; consume at first scored onset; invalid exposed forms remain consumed | Governs “new” and “unseen” claims and makes the form constraint achievable | **Approved as modified** |
| F03 | Validity and comparison policy | Hidden page, pagehide, or freeze invalidates; blur longer than 1 second invalidates; one or repeated brief blurs alone do not invalidate; exact timing/input thresholds and same-profile-only comparison remain | Determines which candidate results are accepted or rejected | **Approved as modified** |
| F04 | Advanced Training rules | Four transparent triggers, normalized-severity routing, tie order, four drills, balanced maintenance, and one primary drill; consistency uses trials 1–40 versus 41–80; its false-alarm route needs a 20-point rise and at least 2 additional false alarms | Controls the product’s main differentiation without routing from two edge blocks | **Approved as modified** |
| F05 | Retest and claims policy | Immediate retest eligibility after one valid drill; one valid retest per chain; no reuse of invalid consumed forms; descriptive comparison with no causal or calibrated-equivalence claim | Governs the baseline-to-retest promise and scientific boundary | **Approved as modified** |
| F06 | Accessibility and device boundary | Redundant standard markers; high-distinction accommodation; same-accommodation-only comparison; physical-keyboard minimum; no touch-only standard game; extended-time mode postponed until after Public Beta 0.1 | Defines beta access, accommodation labeling, and comparison boundaries | **Approved as modified** |
| F07 | Local data and deletion policy | Browser-local retention until deletion/eviction; individual deletion explicitly leaves a minimal form-exposure marker; delete-all removes the marker; temporary same-tab mode when storage is unavailable | Material privacy, trust, and unseen-form implications | **Approved as modified** |
| F08 | Minimal beta analytics | Consent-based first-party coarse events; ephemeral per-session identifier; no cross-site tracking or prohibited performance/personal fields; proposed 90-day retention; declining never blocks use | Defines the beta measurement and privacy architecture | **Approved as modified** |

F01–F08 are settled for specification V1.1. These approvals do not begin implementation. Codex must wait for a separate explicit founder instruction before writing application code or changing the product.

### 25.2 Final Codex implementation handoff

When the founder separately instructs Codex to begin implementation, Codex must implement the smallest complete Stop slice described here. Until that instruction, this section is a handoff plan only. Codex must not reinterpret settled decisions, borrow competitor expression, or add personality/employer scoring.

Implementation order:

1. Freeze the approved specification, content strings, form schema, scoring version, validity rule ids, router version, and accommodation profiles.
2. Produce and audit original stimuli, standard/replay/retest manifests, drill manifests, and provenance records.
3. Implement the shared timed-response engine functions needed by Stop: monotonic timing, frame confirmation, input arming, Space-scroll prevention, held/repeat filtering, visibility/focus/lifecycle detection, immutable events, and local persistence.
4. Implement the guide, examples, comprehension check, device/accessibility preflight, readiness, warm-up, standard run, invalidation, completion, and report flow.
5. Implement scoring and fixture-based reproduction before building interpretation copy.
6. Implement deterministic drill routing, all five exercises, retest reservation/consumption, compatible-profile comparison, and local history.
7. Complete accessibility, responsive, browser/device, storage-failure, and interruption QA.
8. Run every applicable S01–S75 acceptance test and retain evidence linked to the frozen specification version.
9. Conduct originality, claims, privacy, and proportionate legal review before public release.

Codex may choose internal component names, file locations, rendering libraries, and other ordinary engineering details consistent with the shared architecture. Codex must return to the founder before changing any approved trial count, timing, form distribution, validity threshold, drill trigger, accommodation boundary, data-retention rule, claims boundary, or candidate-facing meaning.

### 25.3 Definition of done

The Stop slice is implemented only when:

- The implementation matches the founder-approved-as-modified F01–F08 dispositions.
- The complete guide-to-history path works on supported environments.
- All counts, rates, timings, blocks, narratives, routing decisions, and comparisons reproduce from immutable events.
- Invalid and interrupted sessions can never become baselines or retests.
- Standard and accommodated results never enter the same comparison series.
- Form exposure and retest consumption behave exactly as specified, including deletion and storage failure.
- Candidate copy contains no placeholder, competitor wording, unsupported advice, personality conclusion, employer-fit claim, pass threshold, or guaranteed-improvement claim.
- All applicable acceptance tests pass with retained evidence.
- Assets, sequences, wording, layouts, reports, and code are original or rights-cleared with provenance.
- The implementation is reviewed against the binding master strategy and this frozen specification.

At that point, Codex reports the exact implemented version and test evidence. “Implemented,” “tested,” “founder approved,” and “released” remain separate statuses. No deployment or public-release claim is made merely because implementation is complete.

---

**End of ASSESSMENT PRACTICE — STOP GAME SPECIFICATION V1.1**
