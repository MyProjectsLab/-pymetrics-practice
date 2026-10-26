# Stop V1.2 experience — developer verification

Date: 2026-10-02. Base: clean `1f834dbd7c9c5b54f879997dab3b91145c9099c9` on `main`. Candidate: the local commit containing this record. This is an implementation handoff for a separate exact-SHA independent audit, not founder acceptance or M6-C qualification. The [changed-path and acceptance plan](PLAN.md) was written before product edits.

## Authority and scope

Read `AGENTS.md`, the complete Master Strategy, Stop V1.1, the approved Stop V1.2 addendum, the complete tracker, and relevant M6-C qualification evidence before implementation. The governing files were not edited. Their SHA-256 values in this checkout are:

| Governing document | SHA-256 |
|---|---|
| Master Strategy | `c046fd1776c179799422893985229743bd495ed8d23c9388046f4424162c46f3` |
| Stop V1.1 | `d6389db51b3767764d7e4d71c8a6c84a3719581225165fd42d86c76a4ab2c843` |
| Stop V1.2 addendum | `a3e5f9f23c55f1ddfb6bdd33f0a689fe510bd471d197d305d7e324c687a92f9c` |

The V1.2 changes are limited to Stop preparation, warm-up, scored-start admission/protection and explanatory UI. Existing result specification, scoring, form, timing, routing, report, retest and analytics activation versions remain unchanged. The V1.2 experience and rule identifiers are attached to the new preparation evidence and shortcut event; this does not relabel historical scored results.

## Implementation and acceptance evidence

| Addendum area | Implemented behavior | Verification |
|---|---|---|
| Returning shortcut | The local store accepts only a current-version understanding pass with a valid SHA-256 checksum, session/event sequence and three correct answers. It rechecks before offering and using the optional shortcut. Source session and skipped stages are journaled once, without synthetic examples or answers. Deleting source evidence, clearing the installation or changing version invalidates eligibility, including a delayed save racing deletion. Full setup, new input check, readiness and retest compatibility still apply. | `preparation.test.ts`, `storage.test.ts`, `Journey.test.tsx`; production browser showed a prior pass, optional shortcut, rule reminder and mandatory setup. |
| Untimed screens and reservation | Untimed guide, examples, understanding, setup, readiness and Warm-up complete have no elapsed-wait validity timer. The handoff survives waiting or tab change. Retest's existing 30-minute reservation is checked before warm-up and scored start and again through presentation; expiry before confirmed onset releases it and requires reopening the explanation without an invalid scored result or silent substitution. | Deterministic handoff hour-long wait and expiry/race tests in `run.test.ts`; production browser completed warm-up and retained the pause screen after a tab change. |
| Live warm-up | Hidden/pagehide/freeze, long blur, undersized viewport or setting change during live warm-up records the interruption and restarts eight trials at trial 1. A first warm-up timing or initial-frame failure restarts; a second ends preparation technically. A held response-key release is accepted on the restart and pause screens. No scored form is consumed by interrupted preparation. | `run.test.ts`, `engine/interruption.test.ts`, `browser.test.ts`, `LiveRun.test.tsx` include interruption, a complete valid run after restart, first/second anomaly, bad clock, late-frame and paused-key cases. The production browser reached Warm-up complete after eight trials. |
| Scored start | At accepted Start scored task, the app rechecks page visibility/focus, released key, viewport, physical input/profile and reservation, then starts protection before assignment and initial fixation. Before first scored onset, invalidation retains an invalid draft but releases unexposed form; confirmed onset consumes it even if immediately invalidated. Ordered journals and existing scored invalidation rules remain. | Deterministic admission, initial fixation, lifecycle, pre/post-onset, reservation and full 8+80 result checks in `run.test.ts` and engine tests. Production browser entered scored task from the pause screen. |
| Candidate UI | Selected key appears across Stop instructions, comprehension, setup, readiness and timed reminder. Remapping focuses capture; Tab/browser shortcuts retain their normal action. The input check uses one visible/announced status and each disabled gate explains the next step. Assistive latency selection blocks timed entry while preserving untimed access; standard users see only the general explanation. | `Preflight.test.tsx`, `preparation.test.ts`, `App.test.tsx`, `LiveRun.test.tsx`; browser accessibility tree showed F remapping and detection, disabled reasons, assistive notice, readiness and approved handoff copy. |

## Commands and browser boundary

- `npm test`: **650/650**, 36 files. Deterministic fixtures exercise Stop's timing and storage logic; they do not establish browser frame accuracy.
- `npm run typecheck`: pass.
- `npm run lint`: pass with two pre-existing warnings in `docs/qa/m5/repair-f1-f3/cross-tab.mjs` and `src/App.tsx`.
- `npm run build`: pass. Final client JavaScript `dist/assets/index-C-cTv6mB.js` SHA-256 `f405e7345a41eb1afbf7b241859f9e58255d9c3917b9700f98ce9258428086d8`; CSS `dist/assets/index-BFu-PDJW.css` SHA-256 `632bae8949a5d7ad0be3116fac1bbea5bb4e797dc9eedb8a92f480e2cd98b7c9`.
- `git diff --check`: pass before this record and tracker update; repeat at commit.
- Production Vite preview at loopback `127.0.0.1:5588` in Codex in-app Chromium, desktop viewport 1280 × 720. A fresh candidate completed all three understanding answers, stored a pass, and a second visit showed the optional shortcut. The browser also showed setup gating, F remapping and detection, assistive-input blocking, readiness, eight warm-up trials, the Warm-up complete pause, and scored task entry. The final bundle was identified in the browser by its `index-C-cTv6mB.js` script URL; a fresh tab repeated shortcut → setup → Space input check → readiness → eight warm-up trials → approved pause copy → scored entry. The IAB tab-change probe at the pause did not invalidate. A small viewport (914 × 571) showed explicit disabled input-check and readiness reasons.

The browser actions were tool-dispatched and physical keyboard/display timing was not attested. This bounded browser pass did not certify native hidden/blur/freeze delivery, pre/post-onset lifecycle behavior, screen-reader announcements, the approved browser/device matrix, or full retest/training paths. Those remain M6-C and independent-audit work. Earlier M6-C native lifecycle evidence remains a separate packet and is not inherited as a V1.2 verdict. No push, deployment, release or analytics activation occurred.
