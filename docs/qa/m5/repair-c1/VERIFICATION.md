# Stop M5 C1 repair — developer verification

Local implementation and developer testing only. Parent: `555288d6d19916d4092fa093498aa849ed142391`. The final handoff supplies the repair SHA. The independent audit FAIL remains bound to the parent; the changed SHA needs a new read-only audit and founder M5 acceptance. No push, deployment or release. Work began 30 September and finished 1 October 2026 (America/New_York).

## Authority and pre-edit reproduction

Started from the exact requested clean HEAD. Read AGENTS.md, both complete frozen specifications, the complete tracker, all six M5 verification records and `/private/tmp/stop-m5-audit-555288d/AUDIT.md`. No agents were delegated.

Fresh evidence root: `/private/tmp/stop-m5-c1-repair-20260930/`. Copied drivers were inspected and their output paths redirected before execution. Historical audit artifacts were not used as output destinations. The pre-edit acceptance matrix and failing tests are retained in the raw archive.

Both full candidate retests on the unmodified parent reproduced C1. Each created a valid 643-event result with 80 scored outcomes and `session_completed` / `protection_ended`. With confirmation held before its transaction or after native commit, the screen remained live, its header was hidden, and actual Web Lock queries showed a held presentation lock plus another tab's queued Delete all. The result had no durable result record. The before-transaction reproduction required reload to escape, losing its unsaved result; the after-commit reproduction completed only when delivery resumed. The screenshots were reopened. New deterministic acceptance tests failed on `screen === live` and missing pending/saved disclosure before product edits.

## Repair and ordering

- Completion exposes the immutable active-tab result immediately after the validated completion and protection-ending records. The timed overlay closes and heading focus reaches the approved completion and report action.
- Presentation ownership ends automatically at that boundary. Aborting the existing run-owned signal cancels an outstanding confirmation transaction and settles the acquired Web Lock callback even if promise delivery stays held. No candidate action or new timeout is needed.
- Completion saving proceeds independently of superseded confirmation delivery. Its atomic transaction validates the full result, retains confirmed exposure, clears the reservation, records the retest relationship and idempotent exposure activity, and enforces deletion/installation fences. A late canceled confirmation cannot reopen a transaction; an already committed confirmation has no further write to perform.
- Pending saving is explicitly labeled and never called saved or failed. Only successful completion-write delivery changes the result's storage envelope to `persistent_local`. The immutable event array and summary stay identical. A first write failure gets exactly one retry; final failure leaves a valid `temporary_memory` copy with the exact §21.5 warning on completion and report.
- Opening the report during saving does not get reversed by later save delivery. Completed retest notification belongs to the run's save completion, so leaving the component cannot lose that callback. Training/comparison actions wait for that save outcome; result review remains available immediately.
- Completion callbacks check the original chain identity and merge the current attempt list. A late callback cannot attach its old retest to a replacement chain or discard newer retained attempt history. Two failing application tests and a full browser control caught this during repair review before the guard was added.
- Baseline completion also no longer waits for exposure-confirmation delivery. A late confirmation rejection cannot undo a successful completion write. Existing invalid-baseline failure handling remains covered.

No frozen specification, timing tolerance, initial-frame behavior, manifest, form-reclamation policy, scoring, routing, other game or mock changed.

## Focused acceptance evidence

The full browser driver seeds only valid baseline/drill prerequisites, then performs the real guide, examples, comprehension, keyboard setup, eight warm-up and 80 scored trials. It injects confirmation delivery stalls and briefly holds completion-write delivery to inspect the pending UI. Trial timing and outcome resolution use the ordinary production browser engine.

| Case | Observations while confirmation remains held |
|---|---|
| Before transaction / required drill / keyboard exit | Completion visible; pending label; Tab/Enter opens report and returns to library; cleanup preserves the journal; save and chain completion survive component exit; other-tab deletion finishes. |
| After commit / Delete all / no candidate action | Completion visible; actual presentation locks empty; deletion finishes; replacement installation and activity unchanged after late delivery. |
| Before transaction / Delete all / no candidate action | Same automatic liveness and replacement protection, including refusal of the late not-yet-started confirmation transaction. |
| After commit / required drill / keyboard report | Report opens while pending; saved label appears only after the write; deletion retires eligibility; late confirmation leaves bytes unchanged. |
| Before transaction / final write failure | Exactly two writes; valid temporary result and full journal remain reviewable; exact §21.5 warning; second-tab reload has no unsaved retest. |
| After commit / first write failure | Exactly two writes; second succeeds; report remains open; original report and complete chain reload from durable data. |

Every full result has 643 events, 0 hits / 60 misses / 20 correct withholds / 0 false alarms, and no timing anomalies. Separate Python checks recompute all scored presentation/offset/timeout/resolution links, counts, block totals, summary rates and final interval from raw journals. They also compare original and late-delivery journals, actual locks, reservations, markers and replacement state/activity bytes.

Five additional real IndexedDB completion-write cases cover ordinary atomic exposure/relationship retention and refusal after required-drill, baseline, result or installation deletion. Rejected writes leave state and activity byte-identical. These are constructed transaction fixtures, separate from the full candidate journeys.

## Regressions and checks

`npm run check` passed on the final code: lint (two inherited warnings), **453 tests / 29 files**, **14 standard manifests**, **five drill manifests**, TypeScript and the production Vite build. `git diff --check` passed. The inherited warnings are the App effect’s `refreshHistory` dependency and the older F1–F3 driver’s unused parameter. Final results and source hashes are recorded alongside this file. The raw archive includes all drivers, fixture inputs, full journals, storage states, screenshots, logs and preliminary harness failures. The index hashes every archived entry. The raw ordering, cancellation and F1 journals were reconciled again separately from driver pass flags. The last code change was the completion callback guard and removal of its obsolete component prop; the 45 onset/deletion cases never execute that callback. Both completion boundaries, candidate exit, the replacement-chain control and ordinary baseline/retest were rerun after the guard.

Fresh passing regression coverage: the three F2-C read/confirmation/watchdog cancellation cases; all 45 deletion/onset rows across delivered/delayed/unavailable BroadcastChannel; 13 presentation/timing protocol cases; D1/F1's seven journal/disclosure cases; 36 R1 deletion/retry cases and two edges; six draft/install boundaries; five admission edges and eight original onset cases; F3's 24 cases; R2's 76 cases; affected B1–B5/N1 paths; ordinary baseline/retest completion and pre-onset Back.

Ordinary production-bundle baseline and retest controls inject no responses, storage stalls or timing faults. Both traverse preparation, 8+80 trials, report and byte-identical reload. Baseline deletion retains the minimal exposure marker; retest reload restores its completed chain. Retest prerequisites alone are seeded.

## Acceptance mapping

| Requirement | Bounded evidence |
|---|---|
| C1 / S01 / §5.9 / §9.3 / §21.5 | Immediate visible completion, keyboard report/recovery, truthful pending/durable/failure status and immutable valid recovery copy. |
| S55/S56/S59 | Ordinary persistence/reload, one completion retry, temporary failure copy, individual deletion and late-write rejection. |
| S57/S60 | No-action and user-exit deletion liveness while delivery is held; replacement installation bytes protected. |
| S25/S26/S50/S51 | Existing deletion/onset order, confirmed-onset consumption and known-unexposed cancellation regress. |
| S49/S53/S54/S68/S72/S73 | Chain retirement, compatibility, immutable report recovery and history/load regressions. |
| S35–S43/S66; B1–B5/N1; D1/F1/F3 | Named timing/input/lifecycle, journal retention, save disclosure and eligibility regressions only. |

## Limits and open gates

Chromium 145.0.7632.6, headless macOS, 1200 × 800 CSS pixels; isolated contexts with actual IndexedDB and Web Locks. Several suites run concurrently. Held/rejected promise delivery and injected transaction/record fixtures are fault probes; they do not establish natural disk-hang prevalence. DOM/rAF and automated keyboard evidence do not certify physical scanout or native keyboard latency.

No native OS suspension/crash/power-loss/eviction study, supported-browser/minimum-version/device matrix, full accessibility qualification or complete physical baseline→drill→retest study is claimed. A fully stalled browser event loop or database service has no application-level wall-clock liveness guarantee. Mixed application versions and arbitrary external database edits remain outside the cooperating-tab protocol.

**Open:** N2 abandoned claims, S46 precision, initial-frame handling, pre-start screen-reader disclosure, browser/device/accessibility qualification, M6, founder M5 acceptance, deployment and release. No independent audit PASS is claimed.


## Evidence and reproduction

- [Acceptance matrix](ACCEPTANCE.md), [check output](check.txt), [summary](SUMMARY.json), [governing/source identity](INTEGRITY.json), [changed files](FILES.txt).
- [Raw archive](raw-evidence.tar.gz) and [entry hashes](raw-evidence-index.json). Extract into an empty directory. The archive retains the fresh fixture inputs, before/focused/final drivers, all storage/journal outputs and verification scripts.
- Browser driver dependencies and Chromium path are explicit in the scripts. Development probes require a fresh dev server on 5387; ordinary completion uses production preview on 5388. `M5_FIXTURES` overrides the fixture input; `AUDIT_URL` or `M5_PREVIEW_URL` overrides the applicable server.
- **Before rerunning copied drivers, replace their absolute fresh-evidence root with another new directory and inspect every output path.** Never run archived drivers with historical output destinations. `path-rewrites.json` records the adaptations made for this run.

Harness limits: the first ordinary baseline probe started before preview was listening; it was rerun after readiness. One protocol copy needed its new output subdirectory created. The pre-onset driver imports development modules and was initially pointed at preview; its corrected run uses dev. A verification-script path was corrected from `reruns` to `regressions`. These preliminary failures are retained and excluded from passing evidence; no product expectation was relaxed. The callback test's pre-guard failure is a real intermediate implementation defect, retained separately from those harness issues.
