# Stop M5 F1–F3 repair — developer verification

**Subsequent audit:** independent audit of `881b60f04b0c4633eec3f797610bbb07ddd22c14` returned **FAIL** for F2 after-arming deletion/presentation ordering and identified D1 save disclosure. The implementation claims below are historical. See [F2/D1 continuation](../repair-f2/VERIFICATION.md) for the new developer evidence; separate exact-SHA audit and founder acceptance remain pending.

30 September 2026. **Implemented and developer-tested; separate exact-SHA independent audit and founder M5 acceptance remain pending.** No push, deployment or release.

## Authority and starting state

Starting HEAD was `499deb4ee02fb8ec9cd8c90e2ae95673dd0e10c6`, immediate parent `88b7ec53228d258f0048b27c1ca98d7cb76bf092`, with a clean index and working tree. Read AGENTS.md, the complete Master Strategy and Stop V1.1, IMPLEMENTATION_TRACKER.md, all three M5 verification records, and the complete [independent FAIL report](/private/tmp/stop-m5-audit-499deb4/AUDIT.md). No agents were delegated.

The repair's immediate parent is `499deb4ee02fb8ec9cd8c90e2ae95673dd0e10c6`. The final handoff names the new commit. Earlier audits remain bound to their own SHAs.

[Integrity evidence](integrity.json) identifies the tested product/test source and production build. Both frozen specifications byte-match HEAD, its parent and founder-verified continuation `36a5ef718602ff2c49fa60aaafc59a67d57eedd0`:

| Document | SHA-256 |
|---|---|
| Master Strategy | `c046fd1776c179799422893985229743bd495ed8d23c9388046f4424162c46f3` |
| Stop V1.1 | `d6389db51b3767764d7e4d71c8a6c84a3719581225165fd42d86c76a4ab2c843` |

## Reproduced before product edits

The audit's three drivers were copied into `/private/tmp/stop-m5-f123-before/` and run against the unchanged checkout on port 5227. Its complete JSON outputs and original seeded fixtures remain there; concise outputs are committed here.

| Finding | Observed failure |
|---|---|
| F1 | Actual Resume → assigned drill → Start → browser Back → Restart produced a five-event invalid attempt. After tab B deleted its baseline and tab A retried, the journal disappeared from memory and storage while status became `saved`. [Output](audit-native-buffer-log.txt). The seeded complete-journal case also lost another attempt after saved-drill or baseline deletion. |
| F2 | A pre-onset draft with only a queued chain relationship left a saved eligible chain and visible Start retest; delete-all left the failed in-memory chain able to reserve and offer Start retest. [Output](audit-cross-tab-log.txt). |
| F3 | Both baseline and retest admitted three premature or five wrong-key presses in initial scored fixation without invalidation. Two/four controls also admitted. [Output](audit-integrity-probes-log.txt). Independently authored unit fixtures failed for baseline and retest before the repair: [failure log](before-f3-independent-tests.txt). |

## Repair

### F1: retain journals without restoring eligibility

The active chain and its retained review journals now have separate persistence paths. A deletion rejection converts affected queued snapshots into retirement writes, removes the deliberately deleted drill, and clears active eligibility. Nondeleted journals remain available through **Stop history → Review drill attempt → Review event journal** while retirement writes fail. The UI labels these attempts unsaved and keeps the exact failure/retry disclosure. `saved` is reported only after the remaining writes commit, or when nothing undeleted remains to save.

Retirement writes merge other immutable drill attempts into retired history inside the installation transaction. Conflicting replacements of an already retained drill are rejected. The recovery buffer carries relationship IDs and drill journals; it does not keep deleted baseline/retest result snapshots. History refresh and late write rejection cannot cancel unrelated retained work. A drill being unmounted by deletion may still retain its final invalid journal without reactivating its chain.

### F2: authoritative deletion and installation boundaries

The existing versioned installation receives two additive optional maps: deleted session IDs and draft-to-chain IDs. A draft's chain ID saves atomically with its journal, before a separate chain write can fail. Deletion can therefore retire that chain even when its retest-attempt relationship has not saved. Deletion identities retain no deleted event record and do not consume a known-unexposed form. Delete-all clears both maps along with all other records and creates a fresh installation identity.

A store instance is bound to the installation it opened. An old tab cannot write, reserve, or arm a retest against a replacement installation. The reserve and arm transactions enforce dependency deletion; Resume, explanation and Start retest recheck the chain. A local BroadcastChannel sends only deletion identities, allowing open tabs to revoke displayed eligibility and stop a protected retest before onset. The canvas guard also checks the received deletion state. Timed trial scheduling and response resolution still do not await storage or network calls.

Generic write failures retain their recovery behavior. Intentional deletion retires the affected chain; delete-all cancels the old installation's work. No abandoned-tab lease, timeout or reclamation rule was added.

### F3: count the full scored interval

Completed-result admission counts premature and wrong-key evidence from the scored initial fixation through the scored batch completion. The three/five limits match the unchanged live engine. The two/four controls and warm-up exclusions remain admissible. Admission remains read-only: rejected records, summaries and exposure markers are unchanged.

## Tests and browser evidence

[Repository check](check.txt): lint, **433 tests across 27 files**, deterministic regeneration of **14 standard forms and five drills**, TypeScript and production build pass. `git diff --check` passes. Test count is execution evidence, not full specification acceptance.

| Evidence | Explicit outcomes |
|---|---|
| [Cross-tab driver](cross-tab.mjs), [results](cross-tab.json) | Six F1 combinations: baseline/saved-drill deletion × failed/delayed/delayed-then-rejected writes. Native five/six-event and complete 522-event journals remain byte-identical, reviewable during injected retirement-write failure, absent from a separate tab before saving, and present after retry/reload. Deleted records remain absent and no chain reactivates. |
| Same cross-tab results | Pre-onset draft deletion with and without the new atomic draft relationship; delete-all with a failed queue; unrelated deletion control. No stale Resume/Start retest or reservation after reconciliation. The unrelated queue still saves. |
| Same cross-tab results | Four transaction-boundary cases with BroadcastChannel disabled: saved-drill/delete-all × reservation/arming. All reject without exposure. Two actual guide/preflight/warm-up journeys delete during scored initial fixation: zero scored onsets, no retained exposure or reservation, no active chain. |
| [Independent unit regressions](../../../../src/stop/training.test.ts) | Notification and typed write-rejection paths retain the exact nondeleted event-array identity through failed retirement writes and retry; no active chain or false saved disclosure. |
| [Independent integrity fixtures](../../../../src/stop/run.test.ts) | Baseline/retest × premature 2/3 and wrong 4/5 × scored/warm-up initial fixation. Explicit admission expectations, immutable bytes and exposure checks. |
| [Initial-fixation load driver](initial-fixation-load.mjs), [results](initial-fixation-load.json) | 24 real IndexedDB reload cases adapted from the auditor's probes. The four F3 contradictions reject; permitted controls admit. Original-report, active-chain and comparison counts follow explicit expected outcomes. Raw records/exposure remain unchanged. |
| [Same-tab deletion](deletion-races.json), [edges](deletion-edges.json) | All 36 R1 failure/order/dependency combinations and two unsaved-link/retired-history cases pass again. |
| [R2 reload matrix](reload-evidence.json) | All 76 baseline/retest lifecycle, settings, blur, viewport, input and timing cases retain their prior expected admission results. |
| [B1–B5/N1 regressions](regressions.json), [supplement](supplement.json) | Six exposed/unexposed family cases, setup/exposure mutations, all five drills and corruption/note controls, canonical profile grouping, actual start IDs, ordered failure/retry and durable-only reload pass. N2 remains observable. Retest inventory probes now supply an intact chain, as required by the guarded reservation API. |
| [Ordinary pre-onset Back](pre-onset-browser.json) | Real guide, keyboard preflight and warm-up; Back before scored onset then reload. Reviewable draft, zero scored presentations, no marker, all four baseline forms available. |
| [Production completion](completion-browser.json), [raw result](completion-result.json) | Ordinary browser guide → eight warm-up trials → 80 scored trials → original report → reload → individual deletion. Byte-identical report recovery, local `report_viewed`, and retained minimal exposure marker. Exact counts and measured intervals are recorded in the JSON. |

### Evidence provenance

- **Injected faults:** active/retired write rejection, held promises and late rejection. These run through real IndexedDB and visible UI. They do not simulate natural quota/disk failure.
- **Synthetic records:** deterministic complete baseline/drill/retest fixtures, inserted contradictory journals and direct transaction-boundary probes. Initial-fixture generation reuses the earlier independent deterministic scheduler around production engines. The new queue and load unit assertions and cross-tab driver were authored for this repair, not copied from the audit or implementation's expected results.
- **Ordinary browser use:** guide, examples, comprehension, keyboard preflight, real frame timing, browser Back, completion, report viewing, reload and deletion confirmations. The F1 native journal is created by actual UI navigation; its storage failures are injected. The two retest fixation-deletion journeys seed the prior baseline/drill only, then use the actual candidate journey.
- Chromium **145.0.7632.6**, headless macOS, **1200 × 800** CSS pixels. Final passing drivers report no page errors. This is bounded development evidence, not physical input/display latency or device certification.

Harness corrections: seeded old-schema fixture comparisons initially omitted the two additive metadata maps; the drivers now include them and still compare immutable task/exposure bytes. One retest inventory probe needed its newly required chain argument. Async state polling was changed to await each evaluated predicate before testing it; the initial fixation probe had read before the draft write finished. Earlier partial runs are not counted as passing evidence. No expected product outcome was relaxed.

## Acceptance mapping and limits

| Acceptance | Developer-verification disposition |
|---|---|
| S25/S26/S50/S51 | Known-unexposed availability, uncertain/exposed consumption and deletion boundaries covered. No native crash/power-loss certification. |
| S41 | F3 baseline/retest load contradictions reject; two/four and warm-up controls pass; live thresholds unchanged. |
| S49/S53/S54 | Drill validity, deletion-broken eligibility, profile compatibility and existing comparisons regress. No scoring/router change. |
| S55/S56/S59 | Nondeleted journals retained, truthfully disclosed, reviewable, retried and restored; intentional deletion wins across tabs and late writes. |
| S57/S60 | Old-installation queues/retests cannot write or reserve after delete-all; reload starts fresh. |
| S35–S40/S42/S66/S68/S72/S73 | Prior R2 admission controls regress; full-scored-interval input checks added; immutable recovery and normal completion checked. |
| S58 | Existing temporary-mode tests pass; no new broad temporary-mode or native eviction certification. |
| N1 | Actual per-attempt start identity regression passes. |
| N2 | **Open:** abandoned other-tab unarmed claims may remain indefinitely. No lease/reclamation policy. |
| S46 | **Open:** precision issue unchanged. |

Initial-frame recovery, pre-start screen-reader disclosure, supported browser/minimum-version/device matrix, native lifecycle/physical timing, full accessibility and visual certification, M6, deployment and release remain open. Other games and the twelve-game scope are unchanged. This is evidence-consistency validation, not cryptographic protection against coordinated record rewriting. Closing/reloading the only tab containing failed unsaved work still loses that work; the UI discloses that limit.

**No independent audit PASS or founder M5 acceptance is claimed. The new exact SHA requires a separate read-only audit.**

## Reproduce

From the repository root, with the installed dependencies and Chromium path recorded in each driver:

```sh
npm run check
node docs/qa/m5/repair-r1-r2/fixtures.mjs
npm run dev -- --host 127.0.0.1 --port 5227 --strictPort
# Separate terminal, after fixture generation and a fresh dev-server start:
node docs/qa/m5/repair-f1-f3/cross-tab.mjs
node docs/qa/m5/repair-f1-f3/deletion-races.mjs
node docs/qa/m5/repair-f1-f3/deletion-edges.mjs
node docs/qa/m5/repair-f1-f3/initial-fixation-load.mjs
node docs/qa/m5/repair-f1-f3/reload-evidence.mjs
node docs/qa/m5/repair-f1-f3/regressions.mjs
node docs/qa/m5/repair-f1-f3/supplement.mjs
M5_PREVIEW_URL=http://127.0.0.1:5227/ node docs/qa/m5/repair-f1-f3/pre-onset-browser.mjs
npm run preview -- --host 127.0.0.1 --port 5228 --strictPort
# Separate terminal:
M5_PREVIEW_URL=http://127.0.0.1:5228/ node docs/qa/m5/repair-f1-f3/completion-browser.mjs
```

Each driver uses isolated browser contexts and closes them. Reruns overwrite their evidence files. Fixture generation writes `/private/tmp/stop-m5-r1-r2-fixtures.json`, overridable with `M5_FIXTURES`.

## Changed-file inventory

Product: `src/App.tsx`, `src/stop/History.tsx`, `src/stop/TrainingFlow.tsx`, `src/stop/run.ts`, `src/stop/storage.ts`, `src/stop/training.ts`.

Tests: `src/stop/run.test.ts`, `src/stop/training.test.ts`.

Status/evidence: `IMPLEMENTATION_TRACKER.md`, the historical-status note in `docs/qa/m5/repair-r1-r2/VERIFICATION.md`, and the drivers, before/after outputs, check log, integrity record, screenshots and this report under `docs/qa/m5/repair-f1-f3/`. [Complete inventory](FILES.txt).
