# Towers V1.0 grouped repair — developer verification

Parent product: `29775d52857ab5469b5fb0dc1a9d18ec97f1f6a9`.
Independent blocker record: `/private/tmp/towers-v1-independent/AUDIT.md`.
This is developer evidence for one grouped repair; it is not an independent PASS or qualification.

| Finding | Repair and bounded evidence |
| --- | --- |
| F1 stale board after deletion | Reservation inspection, DOM publication, two confirmed frames, onset write and final inspection now share the cross-tab data-order lock. The parent's held-Start/deletion reproduction was rerun against the production build: `boardAfterDelete=false`, zero durable runs and a tombstone. A live board deleted from a second tab withdrew for both individual deletion and Delete all. |
| F2 missed interruption | Pagehide/hidden/owner loss now latch through a busy or pending save. The injected pagehide inside a nonfinal IndexedDB move ended with a durable `interrupted` event and no visible playable board. A late or unconfirmed write retains a disabled board and a saved-move retry action until authority is resolved. |
| F3 split solved write | The store appends the final placement, `solved` event, terminal report and snapshot in one transaction. A failed final root write left the prior eight-move active board; no target-matched active board or false report appeared. A successful nine-move production journey saved and reopened a 9/9 solved report. |
| F4 synthetic/source attribution | Synthetic DOM clicks appended no event. Trusted Enter on board buttons recorded `keyboard`; ordinary pointer presses on the explicit source/destination route recorded `pointer`. Repeated keydowns are suppressed; touch/assistive physical behavior remains for qualification. |
| F5 teaching example | The untimed guide now shows Gold, Leaf and Cobalt before and after one top-disk move. |
| F6 familiarity | A Restart same-form attempt is labeled `Familiar puzzle` during play and in the saved report/history. The retained run carries a familiarity flag; older local Towers runs without the new field remain readable. |

The matched 1403×852 production screenshot is `/private/tmp/towers-v1-repair/board.png`; source reference is `/private/tmp/towers-frames/frame-006.0.png`. Live disks are about 72×35 px, controls end around y=826 at that viewport, and the target remains above the live board. The source's broad structure and disk proportions are matched with original labels, patterns and colors.

Browser scripts and machine-readable output are in `/private/tmp/towers-v1-repair/` (`more.cjs`, `check.cjs`, `cross-tab.cjs` and results). These are injected browser controls and automated input checks, not physical timing, touch or screen-reader qualification. Frozen specification, forms, fixtures, generator and source reference were not edited.

Precommit gates: 18 focused tests, 1,646 repository tests, TypeScript check, lint (three preexisting warnings), production build, and `git diff --check` passed. At 320 px the document width remained 320 px, with a 288 px board and no horizontal overflow; `/private/tmp/towers-v1-repair/mobile.png` is the sampled view.

Final placement at controlled monotonic 119999 ms saved `solved` with 9 moves and 01:59. At 120000 and 120001 ms it saved incomplete timeout with 8 moves and no solve time. This uses injected clocks and trusted browser pointer input, not physical timer qualification.
