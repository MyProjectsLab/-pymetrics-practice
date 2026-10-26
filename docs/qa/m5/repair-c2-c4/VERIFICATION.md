# Stop M5 — focused C2/C3/C4 repair

Developer implementation and verification record, 2026-10-01. Independent audit and founder M5 acceptance remain pending. This record applies to the local commit containing it; its parent is `4c0929cbae702672d3373f76e936a11d1b16cc42`.

## Authority and initial state

Started at exact clean HEAD `4c0929cbae702672d3373f76e936a11d1b16cc42`, parent `555288d6d19916d4092fa093498aa849ed142391`. Read AGENTS.md, the complete Master Strategy and Stop V1.1, IMPLEMENTATION_TRACKER.md, all seven existing M5 verification records, and `/private/tmp/stop-m5-audit-4c0929c-edgTKz/AUDIT.md` before product edits. The acceptance matrix was written before product edits in [ACCEPTANCE.md](ACCEPTANCE.md).

Both frozen specifications match the approved source at `36a5ef718602ff2c49fa60aaafc59a67d57eedd0`:

| Document | SHA-256 |
|---|---|
| Master Strategy | `c046fd1776c179799422893985229743bd495ed8d23c9388046f4424162c46f3` |
| Stop V1.1 | `d6389db51b3767764d7e4d71c8a6c84a3719581225165fd42d86c76a4ab2c843` |

Historical audit and QA files were preserved. All new raw evidence was written under `/private/tmp/stop-m5-c234-repair-20261001/` and archived in this directory for handoff.

## Pre-edit reproductions

All three findings were reproduced against the untouched starting source, using real IndexedDB and full candidate preparation, eight warm-up trials and 80 scored trials. `before/independent-review.json` independently checks captured relationships, actual durable state, visible copy/navigation and the full journals.

| Finding | Captured failure before edits |
|---|---|
| C2 | Delete the baseline while a completed retest write is held before its transaction. The typed rejection causes two save calls; memory becomes a complete chain and the actual baseline comparison opens, although the result and eligible chain are absent from durable storage. |
| C3 | Exit the pending first completion, start and complete a second retest, then release the first save. Both journals survive, but memory and storage select the older retest; the newer report's comparison control stops navigating. |
| C4 | Commit the completion, delete that result through the other tab's history, then deliver the old success. The result remains absent from IndexedDB while the report claims it is saved and offers an inert comparison control. |

Each reproduced no-response candidate journal has 643 events, 60 misses, 20 correct withholds and 25% overall accuracy. The verifier checks sequence/session IDs, monotonic times, all trial identities and stimuli, confirmed onsets/offsets, exact response deadlines and trigger links, all four block summaries, final interval, completion count and protected-journal tail. Screenshots were reopened to inspect the reported UI failures.

## Repair

- Completion saving distinguishes typed intentional deletion from ordinary storage failure. Deletion is reconciled from authoritative state, without retrying it as a disk failure or invoking a callback that restores a broken chain. Undeleted task journals remain reviewable only within the deletion scope.
- Ordinary write failure retains the approved single retry and exact §21.5 temporary-memory warning.
- A completed retest reserves its chain slot immediately, before storage delivery. Admission checks the pending slot and durable completed relationship. Completion ownership includes chain, session and generation; stale callbacks cannot replace the current relationship.
- The result transaction records its selected relationship and attempt metadata atomically. Older queued chain snapshots merge immutable attempt history and preserve the selected completed retest.
- Success delivery rereads actual storage before claiming durability. It checks the original installation identity, result bytes, deletion records and chain dependencies. Completed reports continue deletion observation when notifications are lost. Observed deletion cannot be undone by old success delivery.
- Writes carry the installation identity captured when the run began. An old completion cannot enter a replacement installation. Cleanup also respects installation ownership, preserving newer active-tab records and chains after same-tab Delete all.
- Deleted pending results remove their reservation and retain only the permitted exposure marker. A known completed journal can settle its consumed exposure without retaining presentation ownership.

No timing constants, forms, scoring, router rules, candidate interpretation claims, other games, mock or frozen specifications changed. Report copy changes concern storage/deletion state only.

## Evidence method and separation

The focused cases run the candidate preparation and complete timed task in Chromium with real IndexedDB. They hold confirmation and completion delivery separately before the native transaction or after its commit. Delayed and unavailable BroadcastChannel variants are explicit injections. Required-drill, baseline, saved-result and Delete all deletion use candidate history UI. Deleting an unsaved session before its transaction is a separately labeled storage API boundary because there is no saved history row yet.

The overlap probe first proves that ordinary pending-completion UI offers no second retest. It then explicitly supplies an earlier attempt snapshot/ownership to construct an already-overlapping callback. Both attempts still complete real 8+80 candidate journeys. This construction is evidence about stale callback ordering, not evidence that normal UI can admit a second attempt.

Replacement tests cover separate-tab reserve/activity work and same-tab fresh baseline completion plus a new training chain. Late delivery must preserve replacement state, activity, active-tab result and chain. The unrelated-result deletion control must preserve normal saving and comparison.

Ordinary baseline and retest completion/reload run separately against the production build without injected delivery stalls. Synthetic validated prerequisite fixtures support the retest setup; they do not stand in for the full candidate retest journal.

`verify-before.py`, `verify-focused.py`, `verify-regressions.py` and the additional raw-state verifier examine captured data rather than accepting driver pass flags. [CASES.md](CASES.md) records case-level outcomes. Raw JSON contains complete event journals, current/durable chains, result envelopes, locks, claims, exposure markers, visible text and late effects. `TESTED-SOURCE.json` binds the browser run to source/build hashes.

## Checks and limits

Final case results and command checks are recorded in CASES.md and the evidence index.

This is developer evidence in Chromium headless on macOS at 1200×800. It is not browser/device/accessibility qualification or timing certification. No screen-reader certification is claimed. Injected delivery stalls are not ordinary browser behavior.

N2, S46, initial-frame handling, screen-reader disclosure, browser/device/accessibility qualification, M6, deployment and release remain open. The changed SHA requires a fresh read-only independent audit. No independent audit PASS or founder M5 acceptance is claimed. The commit is local only; no push or deployment was performed.

## Reproduction and evidence layout

Extract the archive into an empty directory. Before running a driver, change its absolute evidence root to a new directory and inspect its output paths; never reuse historical audit destinations. The scripts specify the Playwright runtime and Chromium executable used. The final development server ran at `127.0.0.1:5407`; ordinary production controls used preview at `127.0.0.1:5408`.

- `INITIAL.json` records the exact clean starting checkout and frozen hashes.
- `before/` holds all three untouched-parent reproductions and separate journal/state checks.
- `focused/completion.mjs` covers the completion/deletion matrix; environment variables select `STAGE`, `DELIVERY`, `DELETION`, `ACTION`, `SAVE_MODE` and `DELETE_TAB`.
- `overlap/probe.mjs` separates the blocked ordinary admission from the constructed overlapping callback probe.
- `regressions/` holds freshly rerun legacy drivers, raw records and ordinary production controls. Nested historical names identify driver provenance only.
- `fences/` holds native atomic abort/idempotence and deletion write-fence fixtures.
- `*-independent-review.json` records separate checks of the captured data, performed by this implementation run. These are not a separate agent's independent audit.
- `preliminary*/`, `harness-failures/` and the intermediate failing test logs preserve excluded or superseded runs. Final case tables identify only final-source evidence.

The browser evidence uses cooperating same-version application tabs. It does not qualify native suspension, crash, power loss, eviction, mixed application versions, arbitrary external database edits, physical scanout or keyboard latency. A wholly stalled event loop or database service has no application-level wall-clock liveness guarantee. The full candidate retests use validated synthetic prerequisite journals, so no complete physical baseline→drill→retest study is claimed.
