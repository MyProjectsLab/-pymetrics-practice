# Stop V1.3 variable-mix addendum — working draft

**Status:** Agent-authored packet under founder delegation; pending independent specification and numerical review. No product code or frozen V1.1/V1.2 document changes. 9 October 2026.

## 1. Evidence and authority

The saved JobTestPrep Stop recordings show two 80-trial red/green practice runs with different sequences. The retained reference analysis records 45 GO / 35 NO-GO in the visible-report run and 28 GO / 52 NO-GO in the other full-video tally. These observations support varying our own mix. They do not establish a Pymetrics distribution, randomization algorithm, or universal current employer format. [Harver's current official overview](https://harver.com/gamified-assessments/) describes pymetrics game-based assessments but does not publish Stop trial counts or GO/NO-GO probabilities.

This addendum is a versioned change to the 80 scored-trial standard Stop forms and dependent denominators, routing, report, and comparison. It supersedes the V1.1 F01 **distribution** decision under the founder's later explicit instruction to vary each game's mix; the other F01 timing and trial-count decisions remain. Within that narrow scope it supersedes V1.1 §§4, 8, 11–13, 14.5, 15–17, 19–20, 21.3 and 24 wherever those provisions assume 60 GO / 20 NO-GO, 15/5 per block, fixed minimum samples or same-mix overall comparisons. Section 5 below expressly replaces the V1.1 §18.2 withholding-drill introduction while preserving its mechanics. All other V1.1 provisions remain in force. The original 14 V1.1 manifests, completed records, report snapshots, V1.2 preparation flow, warm-up, stimuli, key handling, timing, validity triggers, drills, privacy rules, accessibility, and claims limits remain unchanged unless this document expressly says otherwise. No live performance-adaptive trial selection is introduced.

## 2. New form inventory

V1.3 adds 14 original scored manifests under new IDs: four baseline, six replay, four retest. Each has 80 trials in four hidden 20-trial blocks. The exact GO quotas by block are:

| Form | Block 1 | Block 2 | Block 3 | Block 4 | Total GO | Total NO-GO |
|---|---:|---:|---:|---:|---:|---:|
| baseline-01 | 7 | 7 | 7 | 7 | 28 | 52 |
| baseline-02 | 8 | 9 | 8 | 9 | 34 | 46 |
| baseline-03 | 10 | 10 | 10 | 10 | 40 | 40 |
| baseline-04 | 11 | 11 | 11 | 12 | 45 | 35 |
| replay-01 | 7 | 8 | 7 | 8 | 30 | 50 |
| replay-02 | 8 | 8 | 8 | 9 | 33 | 47 |
| replay-03 | 9 | 9 | 9 | 9 | 36 | 44 |
| replay-04 | 10 | 9 | 10 | 10 | 39 | 41 |
| replay-05 | 10 | 11 | 10 | 11 | 42 | 38 |
| replay-06 | 11 | 12 | 11 | 11 | 45 | 35 |
| retest-01 | 7 | 7 | 7 | 7 | 28 | 52 |
| retest-02 | 9 | 8 | 9 | 8 | 34 | 46 |
| retest-03 | 10 | 10 | 10 | 10 | 40 | 40 |
| retest-04 | 12 | 11 | 11 | 11 | 45 | 35 |

The selected counts span, but do not copy, the two observed mixes. They are original exercise-design choices and are not claimed to be calibrated. The selected form ID and checksum, not the family name alone, identify the exact sequence and denominators.

The packet generator is [generate-stop-forms-v13.mjs](../../scripts/generate-stop-forms-v13.mjs), and its exact output is [ASSESSMENT_PRACTICE_STOP_V1_3_FORMS.json](ASSESSMENT_PRACTICE_STOP_V1_3_FORMS.json). It visits the table in order. For each form, candidates start at attempt 1 and increment by one; the seed is `ap-stop-v1.3-<family>-<two-digit number>-candidate-<five-digit attempt>`. It SHA-256 hashes the UTF-8 seed, takes the first four digest bytes as a little-endian unsigned integer, and uses the exact 32-bit generator in the linked script. It shuffles each 20-trial block with descending-index Fisher–Yates. Accept the first candidate satisfying: 80 symbols, the table quotas, runs of at most eight, at least one GO run of four, at least four NO-GO trials immediately after a run of at least three GO, neither endpoint pair both NO-GO, and at least 24 differing positions from every earlier V1.3 form **and every preserved V1.1 form**. Reject and advance the seed otherwise. All 14 forms use distinct IDs and seeds.

The manifest schema is `stop_form_manifest_v2`, form version `2`, specification version `1.3`, and generator version `stop_variable_mix_generator_v1`. The SHA-256 checksum covers a newline-joined canonical list in this order: schema version, ID, family, form version, specification version, generator version, seed ID, block count, block size, comma-separated block GO counts, 80-character `G`/`N` sequence, then a final newline. Accepted positions are conditioned on whole-form constraints, not independent draws. This generator runs during packet construction only; runtime loads checked immutable manifests. It never changes a trial because of the candidate's performance or the previous symbol. Do not teach a run-based prediction. The [numerical review](../qa/stop-v1-3/NUMERICAL-REVIEW.md) records feasibility and difficulty limits before the packet is frozen.

## 3. Assignment and migration

New baseline, replay and mock standard starts use V1.3 manifests only. A V1.1 retest for an eligible pre-migration V1.1 baseline is the sole exception: it uses the original V1.1 manifest, rules, scoring and exposure path. V1.1 exposure markers and completed records remain intact. V1.1 reports reopen from their recorded immutable events, specification, form and scoring versions; a V1.3 renderer must not rewrite the original displayed snapshot or label an old form as V1.3. V1.1 and V1.3 results never form one baseline–retest chain or one progress trend. No new V1.1 baseline is allocated after migration.

An eligible legacy baseline is a saved, integrity-checked, valid V1.1 baseline with no completed chain and no deletion. It may begin one legacy training chain after migration, using the V1.1-compatible `stop_drill_router_v2` to create a new recommendation; a previously saved legacy chain keeps its recorded router version (`stop_drill_router_v1` or `stop_drill_router_v2`), original recommendation and valid completed drill attempt. An interrupted drill attempt is invalid and restarts from its beginning under V1.1 §18.1; it never resumes mid-block or from a stored partial block. A still-valid old retest reservation remains attached to that chain until its original expiry. Expiry releases the reservation and returns the candidate to the retest explanation; opening that explanation again may reserve another unseen V1.1 retest or show the existing exhaustion explanation. Do not silently allocate a replacement. V1.1 and V1.3 form pools, exposures and reservations never substitute for one another. If old-chain continuation cannot be preserved safely, freeze a separate versioned migration decision and candidate notice before implementation; do not silently drop it.

| Legacy V1.1 state at migration or reload | Required disposition |
|---|---|
| Valid baseline only, no chain | May start its one V1.1 training chain under router v2 after authority and preparation checks. |
| Assigned drill or interrupted drill | Retain the recorded recommendation and router version; restart the invalid drill from its beginning under V1.1 §18.1. No partial-block resumption or retest entitlement. |
| Valid completed drill | Preserve the recorded completed attempt; keep its retest entitlement subject to current authority. |
| Drill complete, retest not reserved | Allocate an unseen V1.1 retest under the original V1.1 rule. |
| Valid reserved retest | Retain its exact V1.1 reservation until expiry; then release it and return to the explanation. A new deliberate opening may reserve an unseen V1.1 retest or show exhaustion. |
| Retest started or interrupted | Apply the V1.1 first-display, exposure, recovery and validity rules; never substitute a V1.3 form. |
| Completed chain | Reopen original reports/comparison read-only; no new entitlement. |
| Individually deleted source or retired chain | Withdraw chain eligibility and comparison under the existing authority rule; keep minimal exposure markers. |
| Delete all, cleared site data or evicted installation | Remove local chains, reservations and exposure markers; treat a later visit as a fresh installation with the existing seen-form limitation. |

Every row must survive reload with the same disposition. Recorded V1.1 scoring/report identities and router v1/v2 are immutable; only a genuinely new V1.1 legacy recommendation uses router v2. No V1.3 scoring or router is applied to an old record.

V1.2's optional introduction shortcut requires a verified understanding pass for the **chosen branch's** specification and unchanged rule. A V1.1 pass permits only a V1.1 legacy retest shortcut. A V1.3 pass permits only V1.3 starts. If matching evidence is absent, the candidate can complete the full guide, examples and understanding check for that branch. No evidence is inferred or upgraded across versions. Any compatible saved evidence retains its integrity check; the selected physical-key/device/readiness checks still run each attempt.

Within each V1.3 family, retain the V1.1 least-recently-exposed assignment and tie rule. A first confirmed scored display consumes the exact V1.3 form. For a retest, first filter unseen V1.3 retests to those with the baseline's total GO count and apply the existing least-recently-exposed/tie rule. If none remain, apply that rule across all unseen V1.3 retests and label a different mix in the comparison. An individual result deletion retains its minimal exposure marker and cannot make that form unseen. Delete all, site-data clearing and browser eviction remove installation knowledge as defined in V1.1 §§21.2/21.6: discard chains and reservations, start a new local installation and show the existing limitation on previously seen forms. Do not retain a hidden marker after Delete all. Reservation, expiry and first-display consumption otherwise retain V1.2 behavior.

## 4. Scoring and reports

New V1.3 records use scoring identity `stop_scoring_v13`, report identity `stop_report_v13`, and the V1.3 manifest identity in Section 2. Legacy V1.1 identities are never rewritten. For a complete form, derive `GO_total` and `NO_GO_total` from the checked manifest. Require `hits + misses = GO_total`, `correct_withholds + false_alarms = NO_GO_total`, and both totals to sum to 80. Rates divide by their actual category count, not 60/20. Overall accuracy remains `(hits + correct_withholds)/80`, displayed as an observation for that one sequence with both category counts beside it. No overall accuracy comparison or overall-only progress claim is made across different mixes.

V1.3 report copy, in this order: “Correct on [[CORRECT_TOTAL]] of 80 trials ([[OVERALL_PERCENT]]%).” “GO: you responded to [[HITS]] of [[GO_TOTAL]] ([[GO_PERCENT]]%); [[MISSES]] misses.” “NO-GO: you withheld on [[WITHHOLDS]] of [[NOGO_TOTAL]] ([[NOGO_PERCENT]]%); [[FALSE_ALARMS]] false alarms.” These sentences replace only V1.1's hardcoded 60/20 outcome sentences. Counts are primary; percentages use V1.1 rounding. An invalid partial run uses observed counts only and never borrows the completed-form denominator. Response-time inclusion, timing notes, post-error rules and local event integrity remain V1.1.

The report's four hidden blocks display each block's actual GO/NO-GO count and category rates. First-versus-last descriptions compare GO hit rates and NO-GO withhold rates independently when each block has at least five reconciled GO and six reconciled NO-GO outcomes. Response-time median requires at least five timing-clean correct GO hits in each compared block; IQR requires seven. V1.3 never compares raw block overall accuracy or uses it for a speed–accuracy label. The V1.3 `SPEED_ACCURACY_NARRATIVE` is the following supported sentences joined in order, with unsupported ones omitted: “GO hit rate: [[FIRST_GO]]% to [[LAST_GO]]%.” “NO-GO correct-withhold rate: [[FIRST_NOGO]]% to [[LAST_NOGO]]%.” “Median correct-GO response time: [[FIRST_RT]] ms to [[LAST_RT]] ms.” “Correct-GO response-time IQR: [[FIRST_IQR]] ms to [[LAST_IQR]] ms.” If none is supported, use: “There was not enough clean data for a reliable block comparison.” This numeric-only narrative replaces V1.1 §§13.1–13.2's prioritized speed–accuracy labels for V1.3; it does not remove separately supported post-error or sequence-context evidence. The post-error and long-run context minimums remain four qualifying and 12 controls, and four long-run versus eight other NO-GO outcomes, respectively.

## 5. Training router

Advanced Training routing requires a valid, completed, reconciled V1.3 baseline with at least 24 GO and 28 NO-GO outcomes. Reconciled outcome counts include a trial with a nonsevere timing note; timing-clean response counts are separately filtered. A valid complete V1.3 form meets these category minimums by construction. Baseline validity itself does not depend on whether a timing-based route has sufficient evidence. If integrity or future accommodation rules leave insufficient category outcomes, offer ordinary replay with an insufficient-evidence explanation; do not invent a targeted route.

Preserve the V1.1 drill inventory, rule priority, trigger percentages and deterministic tie rules. Replace only the sample gates:

| Rule | V1.3 sample gate | Trigger and severity |
|---|---|---|
| Response withholding | At least 28 reconciled NO-GO outcomes | V1.1 false-alarm-rate trigger and severity |
| Detection | At least 24 reconciled GO and 28 reconciled NO-GO outcomes | V1.1 miss/false-alarm trigger and severity |
| Consistency | At least 12 reconciled GO in each half for hit-rate change; at least 14 reconciled NO-GO in each half for false-alarm change | V1.1 category-rate triggers and severity. Do not use raw overall-accuracy change as a trigger. A false-alarm rise still needs at least two more second-half false alarms. |
| Response stability | At least 20 timing-clean correct GO hits overall, with hit and false-alarm rates supported by their overall category gates | V1.1 IQR/hit/false-alarm triggers and severity |

Unsupported components never compete in routing. The V1.1 §16.1 overall 40-clean-hit timing gate is replaced by V1.3's 20-clean-hit gate for the response-stability route. Accompanying correct-GO timing evidence for a consistency recommendation requires at least eight timing-clean correct GO hits **in each half** for V1.3, replacing V1.1 §12.3's 20 in each half; it is suppressed when unsupported but does not remove a supported accuracy route. Keep the same unrounded threshold calculations, normalized severity, `<0.001` tie and fixed priority as V1.1; only the sample gates and removal of the mixed-weight overall-accuracy consistency component change. If sufficient category evidence exists but no targeted rule fires, route to balanced maintenance. If no route has the required evidence, offer replay rather than claiming maintenance from missing data. Keep all V1.1 drill manifests and their independent block distributions unchanged. Record `stop_drill_router_v3` and actual count/evidence that selected the route.

The V1.3 response-withholding drill uses the same original 72-trial manifest and block feedback, but its introduction replaces V1.1 §18.2 with: “Practise withholding while GO symbols become more frequent across this exercise.” Do not say this drill has more NO-GO chances than the baseline. Review inherited examples, drill evidence cards and completion copy against each new mix; no other drill copy is changed by this addendum.

## 6. Retest and history

A V1.3 comparison requires two valid V1.3 sessions with the same compatible visual, timing, response-key and input profiles, completed assigned drill, preserved chain authority, and an unseen V1.3 retest. Show GO hit rate, NO-GO correct-withhold rate and eligible correct-GO median separately with each session's own counts. Show the overall-accuracy delta and the existing V1.1 §20.4 overall speed–accuracy label only if the baseline and retest have the same GO/NO-GO totals; otherwise say: “These sequences had different GO/NO-GO mixes, so compare the GO and NO-GO results separately.” In that different-mix case, display each session's hits, misses, correct withholds and false alarms with its own category denominator, but make no directional **raw-count** claim for any of the four. Directional comparisons use the two category rates and supported timing only. Apply this rule to comparison cards, summaries and history. Equal totals still do not make forms calibrated equivalent. Never compare V1.1 with V1.3 as an Advanced Training result. Split overall-accuracy progress charts by specification, profile and total GO count; omit category-rate trend charts from V1.3 beta rather than mixing unlike denominators silently.

The same-mix baseline/retest pair should be selected when available, but its presence does not guarantee equivalent difficulty or a causal training effect. On a different-mix retest, a factual overall result may appear in each original report, while the comparison omits an overall delta. All old reports and chains retain their recorded meaning.

## 6.1 Exact override map

| V1.1 rule or assertion | V1.3 rule |
|---|---|
| §§4, 8, 11 and S21: 60/20, 15/5 | The checked form's 80-symbol sequence and its four Section 2 quotas govern. |
| §12.2 and S31: block GO/NO-GO/RT minimums of 12/4/10/12 | First/last category-rate minimums are 5 GO and 6 NO-GO outcomes per block; median requires 5 and IQR 7 timing-clean correct GO hits in each block. Overall block accuracy is not compared. |
| §12.3: 24 GO/8 NO-GO outcome gates and 20 clean hits per half | Consistency uses 12 GO/14 NO-GO outcomes per half for its respective category component; accompanying timing uses 8 clean correct GO hits per half. The overall-accuracy component is removed. |
| §§12.4, 13.1–13.2, 15.2–15.3 and `SPEED_ACCURACY_NARRATIVE` | Section 4's supported, ordered numeric category/timing sentences replace the prioritized mixed-accuracy narrative; no unsupported sentence or overall block difference appears. |
| §§16.1–17.3: 40 clean hits and original route sample gates | Section 5's 20-clean-hit stability gate and all listed category/half gates govern; thresholds, unrounded severity and tie order otherwise remain. |
| §§20.2–20.4 and S54: overall delta, four raw outcome changes and cross-session speed–accuracy label | Section 6 governs: same-total overall delta/label are descriptive; differing totals suppress them and all four directional raw-count changes. Both original reports retain their own observed counts. |
| S27: 57/3 GO and 17/3 NO-GO fixture | Retain it for V1.1 only; V1.3 fixtures use actual form counts. S45/S47 retain route priority and maintenance logic under Section 5's new gates. |

## 7. Acceptance before implementation

1. Independently regenerate all 14 V1.3 manifests from a frozen generator and seed progression; verify counts, four block quotas, run/context/endpoints, pairwise differences, IDs and checksums. Keep the original 14 V1.1 manifest bytes unchanged.
2. Test perfect, all-GO-response, no-response and mixed 80-trial fixtures for low, middle and high mixes; reconcile outcomes and visible denominators.
3. Retain exact boundary fixtures with these expected outcomes: perfect `baseline-01` with ordinary tight clean response times routes to balanced maintenance, with 28/28 GO and 52/52 NO-GO; always responding on it routes to response withholding (52/52 false alarms); never responding routes to detection (28/28 misses); two misses confined to its second half route to consistency (14/14 then 12/14 GO hits, a 14.2857-point fall, below the overall detection trigger). Make a separate stability fixture with at least 20 clean hits and an IQR of exactly 150 ms; 19 clean hits cannot select stability. At exactly eight clean hits per half, accompanying consistency timing may appear; at seven in either half it must be suppressed while the supported consistency route remains. For block comparison, four versus five timing-clean hits must suppress versus enable median, and six versus seven must suppress versus enable IQR; unsupported numeric sentences are omitted in `SPEED_ACCURACY_NARRATIVE`. Check false-alarm rise at the 20-point and two-additional-alarm boundary, severity ties and no-evidence replay. A designed form with fewer than 50 GO is still eligible when its actual evidence reconciles.
4. Pair always-respond `baseline-01` (28 hits, 52 false alarms, 35% overall) with `retest-04` (45 hits, 35 false alarms, 56.25% overall): suppress overall delta, cross-session speed–accuracy label and every raw-count direction; show GO 100% and NO-GO 0% for each with its own counts. Pair never-respond versions (52 versus 35 withholds, 65% versus 43.75% overall): apply the same suppression, with GO 0% and NO-GO 100% for each. A same-total baseline/retest may show an overall delta, labeled descriptive and uncalibrated. Test same-mix allocation, different-mix fallback, exhaustion, reservation expiry and cross-version rejection.
5. For every row of the Section 3 legacy-state table, test authoritative reload, individual deletion, Delete all and replacement where relevant. Interrupted drills restart from their beginning with no retest entitlement; expired reservations release and require a new retest-explanation opening, not silent reallocation. Preserve old result/report bytes and recorded router v1/v2, never promote preparation evidence between versions, and withdraw open/reserved comparisons after deletion.
6. Check inherited V1.1 drill introduction, examples, evidence cards and completion copy against every V1.3 mix; the withholding drill must use Section 5's new sentence and make no comparative opportunity claim. Test V1.3 save/reload, history grouping, valid/invalid exposure, one physical-keyboard run, and production-browser lifecycle/accessibility boundaries. Browser/device qualification remains separate.

## 8. Limits

This variation is for practice realism, not a claim of identical Pymetrics odds, validated alternate forms, improved hiring outcomes, or calibrated difficulty. Product support, privacy, mock integration and release still require their own gates.
