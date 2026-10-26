# Balloons B1-B R1 repair — developer verification

Date: 2026-10-04 (America/New_York). Started from clean HEAD `31d8bd60914fa487a68082c743d6501538dc3127`. The [independent FAIL](AUDIT-31d8bd6.md) is retained byte-for-byte and remains bound to that SHA. Scope is R1 only. These are implementation-agent checks, not a fresh independent audit or founder acceptance.

## Reproduction before product edits

The audit's final-action repeat driver ran against a fresh production build of the clean requested HEAD. Both final-round delivery boundaries were exercised through full 39-round BL1 journeys, with one successful pump worth five cents in round 39:

- Final action committed, completion callback held: the candidate was warned definitively ineligible while durable storage already held an intact, eligible 39-round completion. Reload/report called that same five-cent result a saved baseline. The audit expectation failed.
- Final intent committed, callback held before the action transaction: only 38 rounds were resolved. Recovery retained the five-cent pump prefix and finished review-only. This control passed.

`pre-evidence.tar.gz` retains complete before/committed/timeout records, candidate copy, screenshots and outcomes. [pre-reproduction.mjs](pre-reproduction.mjs) is the original driver with only an unused helper removed. Its exit 1 is expected for the original committed-action contradiction. Initial sandbox-denied browser/server launches and a browser launch before the server was ready are execution setup failures, not product findings; subsequent approved local execution produced both reproductions before edits.

## Repair and authority boundary

Only `src/balloons/storage.ts`, `controller.ts`, `Journey.tsx` and `controller.test.ts` change product/test behavior.

- A delivered IndexedDB transaction **abort** is a proven `WriteFailure`. An error event alone is not treated as final abort evidence. The existing 2,000 ms gate watchdog now yields `DeliveryUncertain`: transaction completion may already be durable.
- Controller `write_failed` and `uncertain` states pause controls and say **“Save status needs checking.”** A proven abort additionally says a local write failed. Neither state declares baseline eligibility or ineligibility from the old view. The candidate may check again or open history.
- Under the existing bounded mutation gate, read the current installation, verify owner ID/session/generation, absence of deletion, immutable header and journal prefix, and replay the full durable journal/snapshot and completed result. No missing callback is treated as missing durable bytes.
- An intact completed record produces `verified_completion` and **“Saved completion verified: all 39 rounds.”** No cleanup write changes that completion. The report is reopened through history's existing authority path. A fresh observation lifetime supports periodic checks while the original mutation and its callbacks remain canceled.
- An incomplete attempt retains F1's conservative `write_failed` checkpoint policy. Only after the checkpoint is durably reverified does the UI state that this attempt is review-only. Intent is never replayed as an action. Persistent write-plus-cleanup failure remains visibly unresolved; F1's existing fresh-owner recovery still invalidates an attempt without a clean checkpoint. Genuine committed actions, form, mapping and exposure survive.
- Unavailable, stale, replaced, deleted or inconsistent authority leaves controls paused without a saved/eligibility verdict. Late mutation/read callbacks are fenced. Superseded cleanup is canceled. Owner and mutation locks release; this delivery bound is not a gameplay deadline or suspended-OS timing guarantee.

No durable schema, scoring version, form, mechanics, B1-A reconciliation/arithmetic, F1 recovery policy, F2 deletion protocol, F3 history protocol or F4 input classifier was changed. The three presentation additions are save-state copy, an explicit save-status check and access to verified completion in history.

## Checks and bounded browser evidence

- **821 tests / 44 files pass**, including nine additional controller cases: the two final-action/intent cases and seven unavailable/held/corrupt-snapshot/corrupt-journal/changed-header/owner/installation authority cases. They check nonzero results, exact bytes, conservative recovery, late callbacks and periodic completion observation.
- Lint passes with the same two inherited warnings. TypeScript and client/disabled-analytics production builds pass. Nine Balloons scored forms, 14 Stop forms and five Stop drills pass their checks. `git diff --check` passes.
- Final production-browser results are recorded in `browser-summary.json`; raw records, traces and screenshots are in `post-evidence.tar.gz`. Runtime: Node 24.13.1 / npm 11.8.0, headless Chromium 145.0.7632.6, isolated contexts, localhost port 4197. No user browser profile was used.
- [r1-browser.mjs](r1-browser.mjs) checks zero and nonzero committed final actions, final intent, unavailable authority, held authority delivery, persistent intent-plus-cleanup failure and persistent action-plus-cleanup failure. It asserts candidate copy, paused controls, durable bytes at each boundary, lock release, late-callback invariance, reload, report wording and preserved snapshot/journal prefix. Each nonzero journey ends with five cents; committed completions retain baseline status, incomplete/failed attempts finish review-only.
- The retained regression drivers cover ordinary varied BL1 and full RP1, F1 recovery, 32 deletion delivery schedules, selected history checks, Space/Enter/repeat/focus-change ordering, pointer/touch/unknown inputs, report timeout recovery, and a separate nonzero RP1 direct reload. Drivers are inherited from the independent audit, but their execution here is developer evidence. Harness adaptations change output/seed paths and persistent-failure copy expectations to the new truthful “Save status needs checking” state.
- The standalone Python arithmetic oracle imports no production scoring or transition code. It checks all committed events, snapshot, 39 resolved/confirmed rounds, 13 per type, conservation and visible BL tables. The ordinary BL1 has 455 banked / 470 lost cents, 198 attempts / 185 successes, 26 collected / 13 burst. Ordinary zero-pump RP1 has 39 collections; the separate odd-round-pump RP1 has 100 banked cents and retains its report after reload.

Preliminary repair testing found a canceled observation lifetime after verified completion; it was corrected before the final build, with periodic checks added to the regression. A preliminary parallel supplemental run attempted to load the seed before the full journey had written it; that ENOENT is a harness dependency error. Final seeded drivers start only after the full root exists. The evidence archive retains preliminary logs separately; no preliminary failure is counted as a final pass.

`identity.json` binds the product/test files, final build, frozen authority and evidence archives. Unchanged product boundaries were checked against the requested base. Both packet JSON files were parsed fully; the five frozen packet hashes and Master Strategy match the approved freeze/audit register. The retained audit hash matches its supplied source.

## N1 — separate disposition, still open

N1 is **not repaired or closed** here. The prior audit demonstrated a conservative pause and one extra pause event in a populated replacement under an injected callback held across effect cleanup/channel closure. It did not establish native BroadcastChannel delivery after close. This R1 patch does not bind notifications to an installation/session/effect lifetime and supplies no native reachability evidence. Retain N1 as a non-blocking, scoped robustness observation; do not claim all delayed notifications preserve replacement bytes. Old transaction callback fences and the original F2 deletion boundaries are distinct from that notification observation.

## Audit request and remaining gates

Request a **fresh, separate, read-only audit of the exact local repair commit reported at handoff**, with this directory's containing commit as target. Independently reproduce R1 at both final delivery boundaries, verify uncertain/proven-failure/verified-completion copy against durable bytes, test nonzero results, persistent F1 failures, authority loss, late callbacks and released locks, ordinary BL/RP/reload/report behavior, and preservation of F2–F4. Keep N1 separate unless new native evidence changes its disposition. Report a verdict tied only to the audited SHA; do not edit the repository.

Founder B1-B acceptance, whole B1 (still partial), B2 Advanced Training, mock integration, B3 browser/device/accessibility qualification, complete Balloons acceptance, deployment and release remain open. No push, deployment, release or analytics activation. Browser fault injection and automated native-button input do not qualify physical timing, OS lifecycle, assistive devices or the supported browser/device matrix.

## Reproduction commands

Build without changing source, then serve on localhost:

```sh
npm run build
npm run preview -- --host 127.0.0.1 --port 4197 --strictPort
```

Run the new R1 cases in a fresh output directory (the driver uses the explicit locally installed Playwright/Chromium paths):

```sh
mkdir -p /private/tmp/balloons-r1-audit
BALLOONS_REPAIR_OUT=/private/tmp/balloons-r1-audit node docs/qa/balloons-b1-b/repair-r1/r1-browser.mjs
```

`post-evidence.tar.gz` includes `drivers/` for the inherited regressions and oracle. Run `independent-browser.mjs` first, with the same output directory, before any seeded driver. Then run `supplemental-browser.mjs`, `repair-boundaries.mjs`, `repair-controls.mjs`, `native-order.mjs`, `report-timeout.mjs` and `rp-direct-reload.mjs`; run `reconcile.py` last. Adjust the oracle's repository path if auditing an external archive. Inspect every result's `pass`/`harnessError`, not merely exit status: some inherited drivers record failures only in JSON. Do not rebuild while browser runs are active. All injections affect isolated test contexts only.
