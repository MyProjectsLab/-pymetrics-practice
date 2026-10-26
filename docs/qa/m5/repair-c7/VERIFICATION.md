# M5 focused C7 repair — developer verification

Date: 2026-10-01. Started at clean `c604c0546a7a9e9f0e2f7e28a30f31042a776a79`.

The supplied independent whole-M5 audit at `/private/tmp/stop-m5-audit-c604c05-20261001/AUDIT.md` remains **FAIL C7 at that SHA**. Its requirement map and open gates remain authoritative inputs. This record describes a local developer repair, not independent acceptance, founder acceptance, deployment, or release.

## Reproduction before edits

Copied the audit's compositor probe into `/private/tmp/stop-c7-repair-c604c05/before/` and ran against the clean checkout on port 5547. Five ordinary successful authority reads (3.3–4.0 ms) produced **five unavailable live-status insertions and five hidden-frame transitions** in 5.1 seconds. Real compositor images show the comparison collapsing to the unavailable message and restoring. Evidence: `before/fast-visual.json`, its exact driver and `before/frame-*.png`.

## Authority and display transitions

The transition design and its refinement were stated before their respective code changes. Authority checking, failure, and replacement ownership remain distinct:

| State / event | Display and transition |
|---|---|
| Initial checking | No numerical comparison. Passive “Checking comparison availability” copy; library exit stays reachable. |
| Verified | Numbers belong to the exact current chain object, with successful verification of the original installation and required dependencies. |
| Ordinary periodic check | Start the read when the periodic poll fires. Use two animation-frame callbacks: the first aligns with rendering, the second ends one complete rendering cycle. A success before that second callback keeps the same comparison DOM. If still pending, synchronously remove numbers in the second callback, before paint. Only one authority read runs at a time. |
| Focus or visibility event | Immediately request suppression and invalidate the prior request generation. An old success cannot restore numbers. This path does not wait for the periodic frame schedule. |
| Checking remains unresolved | Numbers remain absent for the entire held interval, including after delivery of a stale snapshot and throughout a subsequent fresh held read. Only a current successful check can restore them. |
| Unavailable / revoked | A failed or rejected check shows the unavailable live status. Repeated failed/held recovery checks keep that status mounted. The existing training authority implementation owns permanent retirement for deletion or installation replacement. |
| Replacement / exit | Exact chain identity guards rendering; effect cleanup cancels the currently scheduled frame and the timer. Request generation and live-effect guards reject stale delivery. Original-store and deletion-revision checks remain unchanged. |

This changes C6's immediate React state commit on every ordinary periodic check into a commit after one complete rendering cycle (two rAF callbacks from the poll). **It does not claim that cached numbers disappear at Promise creation.** The presentation allowance ends at the second animation-frame callback, with no wall-clock grace timeout. A read still pending at that boundary intentionally hides the comparison even if it later succeeds. Background rendering can be throttled; visibility/focus events separately suppress and invalidate authority. No new reservation expiry, reclamation, storage deadline, or notification dependency is introduced.

Only `src/stop/TrainingFlow.tsx` changes product behavior. Checking has passive copy; “Comparison unavailable” is reserved for a failed check. Timed gameplay, completion retry, storage, schema, scoring, forms, routing, retained reports, and callback ownership are unchanged.

## Discarded first approach

The first approach waited until a frame callback to start the read, then suppressed at the following callback. The ordinary rAF observer reported zero hidden frames, but DOM observations showed four transient withdrawals in 36 source checks and three in the production C3 display. A longer CDP compositor run caught an actual checking frame. That attempt was rejected. Its captures and drivers are retained under `first-attempt/`; they do not verify the final product. This exposed the sampling-order limitation of a rAF observer registered before the suppression callback. Final healthy probes additionally assert **no numerical DOM withdrawal**, and use longer compositor captures.

The final approach starts the read at the poll instead, allowing one complete rendering cycle before unresolved suppression. This retains a bounded held-read withdrawal without shortening the read's opportunity to settle by first waiting for rAF.

## Fresh checks

All raw evidence and exact browser drivers are under `/private/tmp/stop-c7-repair-c604c05/`. Hashes are recorded in `EVIDENCE-SHA256.json`. Chromium headless shell **145.0.7632.6**, macOS, 1200×800; actual IndexedDB, DOM mutation observations, rAF and (for the visual probe) CDP compositor frames.

| Check | Result / evidence |
|---|---|
| Healthy periodic checks, three independent 12.1-second runs | 36 reads, 1.8–8.7 ms; **zero numerical DOM withdrawals, zero unavailable insertions, zero hidden-frame transitions, constant layout height**. Actual compositor output remained unchanged in each run (one identical frame per run). `long-visual.json`, `long-frame-*.png`. |
| Final compositor check, 5.1 seconds | Five checks; zero unavailable insertions and zero hidden-frame transitions. `fast-visual.json`, `frame-*.png`. Before/after images also inspected directly. |
| Held first authority operation | Numbers absent at the second rAF observer, 16.9 ms after the blocked deletion-revision read started, and throughout a further 2.2-second hold. Recovery only after release; durable state and retained journals unchanged. `frame-boundary.json`. This is an observed bound for this run, not a universal timing guarantee. |
| C6 already-open comparison matrix | **12 cases:** baseline / required drill / Delete all / unrelated deletion × delivered / delayed / unavailable notifications. Hold captured read 3.2 seconds through real other-tab UI deletion, deliver it, then hold the fresh read 1.1 seconds where authority is not already permanently revoked. No numerical DOM or observed frame in held/late/fresh-held stages. Only unrelated deletion recovers after current success. One read pending. Retained immutable retest unchanged. `open-stalled-matrix.json`. |
| C5 Resume matrix | **12 cases**, same deletion/notification combinations, actual Resume/review/reload boundaries. `resume-matrix.json`. |
| Authority ownership | **Six cases:** late read, replacement chain and installation, original store after writer rebinding, missing baseline, missing drill, navigation during held Resume. `authority-probes.json`. |
| Open comparison recovery and controls | **Five cases:** rejected/recovered read; focus, visibility and periodic holds; keyboard-only exit and retained immutable report review after late delivery. `open-authority-keyboard-visibility.json`. Focus/visibility events are explicitly dispatched, not OS-native lifecycle claims. |
| Production C3 / successful-retry displays | Two normal production startups from previously audited durable completion states. Six seconds each: **zero unavailable insertions and zero hidden frames**, durable bytes unchanged. `production-boundaries.json`. Production asset `dist/assets/index-BOiNcR3P.js`. |
| Deterministic fixtures | Nine comparison authority tests cover initial/focus suppression, failure/recovery, held periodic reads, stale pre-focus success, replacement success, fast-check DOM continuity, render-cycle suppression, unmount, stable unavailable status and frame cancellation on replacement/exit. Full suite includes existing C2–C5/retry fixtures. |
| Repository checks | `npm run check`: lint, **487 tests / 31 files**, 14 standard-form and five drill manifest checks, TypeScript and production build pass. Two pre-existing lint warnings: unused parameter in `repair-f1-f3/cross-tab.mjs`, and App `refreshHistory` effect dependency. `check-final.log`. |

The browser boundary probes seed previously audited valid immutable journals and prerequisites, then exercise actual application, training and storage code. They are **not newly completed timed sessions**. Fault injection, delayed notifications, blocked reads and replacement setup are deliberate harness operations. The fresh production probes run the ordinary built App startup and completed-comparison flow.

## Reused evidence and verification

`reuse.json` rechecks all **79 unchanged source/test files** from the preceding audit's reuse list against c604c05. Only TrainingFlow and its authority test differ among tracked source files. It rehashes nine selected prior evidence files. `reconciliation.json`, generated by `reconcile.py`, reasserts the raw C2/C3/C4/retry boundaries:

- C2: one typed rejection, immutable temporary report, no retired chain/result resurrection.
- C3: newer retest selected, both original journals/summaries and exposures preserved.
- C4: replacement installation/state/activity unchanged after late completion.
- Successful retry: exactly two writes, identical durable journal/summary through reload, comparison admitted.

These full timed completion journals come from `/private/tmp/stop-m5-full-audit-5e6b372-20261001/`; their mechanics are unchanged. They are reused evidence, not fresh full runs. The changed C3/retry comparison display was separately exercised in the new production build. Current C5/C6 matrices and controls are fresh runs. This avoids claiming that prior display behavior establishes the new rendering behavior.

Both frozen specification files were byte-compared to approved source commit `36a5ef718602ff2c49fa60aaafc59a67d57eedd0` and remain unchanged:

- Master strategy: `c046fd1776c179799422893985229743bd495ed8d23c9388046f4424162c46f3`.
- Stop V1.1: `d6389db51b3767764d7e4d71c8a6c84a3719581225165fd42d86c76a4ab2c843`.

## Reproduce / limits

Run `npm run dev -- --host 127.0.0.1 --port 5547 --strictPort`, then the `.mjs` drivers named above in the evidence directory with Node. The production driver requires `npm run build`; it serves the built HTML/assets through the local Vite server. Run `python3 /private/tmp/stop-c7-repair-c604c05/reconcile.py` for the raw-boundary assertions. Drivers use the explicitly recorded local Playwright/Chromium paths and prior fixtures. Outputs overwrite their own repair evidence, so copy the directory before rerunning if preserving these captures.

This is bounded Chromium developer evidence. No native screen-reader speech, high-refresh display matrix, Safari/Firefox, physical timing, OS-native lifecycle, or complete accessibility/visual certification was measured. Slow checks that cross a rendering boundary are intentionally hidden; this repair does not promise an uninterrupted display during unresolved authority. Native speech qualification remains open despite eliminating the measured healthy-check status insertions.

A **fresh exact-SHA independent whole-M5 audit** is required. Founder M5 acceptance, N2 abandoned unarmed reservations, S46 precision, initial-frame handling, pre-start screen-reader disclosure, browser/device/accessibility qualification, M6, deployment and release remain open. No push or deployment is authorized by this record.
