# Towers V1.0 standalone developer verification

Product scope: one five-disk, three-tower, 120-second Practice puzzle with guide, untimed teaching example, rule check, Ready, original fixed forms, Undo, Clear All, Restart, completion, descriptive report, local history and reload. The source-to-design comparison is in `docs/qa/reference-towers.md`. This is developer evidence for the candidate, not an independent audit or device qualification.

## Fixed packet

- Specification SHA-256 `a6fa1830f90e592287df303819c3a583986697c3c054eab6288ff090e04fb92c`
- Forms SHA-256 `b34652b2c50d782ae5fc2e5992dc96052086dcf5833cc829f5ae6510d413a268`
- Fixtures SHA-256 `60aeaa10c72bc2b64b673fe9e860d8a45c12f9f105d6070e6c794a785ed95fc9`

The product loader verifies each of the six form hashes. Pure-engine tests replay every fixed nine-move solution against the packet fixtures and test Undo, timeout tie and post-terminal rejection.

## Checks

- Final repository run: 106 files and 1,646 tests passed. TypeScript build, lint, all existing form/drill manifest checks and production build passed. Lint emitted only existing warnings outside Towers.
- Production Chromium at fresh local origins: solved a full nine-placement TW1 path and a TW2 path after a retained prior attempt; checked report counts (9 moves, 9 minimum, 0 excess), Next, report-view save, reload/history, keyboard source/destination, Undo, Restart and natural 120-second timeout. A ten-placement route after Undo reported 10 moves and one excess move. The timeout report showed `02:00` time used and no solve claim.
- Two-tab production Chromium: second-tab Start was denied while the first owned play; after first-tab exit, second-tab Start opened TW2. Healthy local persistence and report reopening were observed after reload.
- Focused storage tests cover six-form allocation, individual/Delete all retirement, stale append rejection, unseen cancellation and same-request retries after a write committed but its delivery failed.
- Matched browser screenshot inspection checked target above board, larger live board, equal-size colored/patterned disks, pads, countdown and focusable controls. A sampled 320-pixel browser viewport kept the board and controls distinguishable without horizontal overflow; physical/device review remains open.

## Limits and next gate

Failed and undelivered writes, deletion races and exact deadline ties are covered by focused simulation and source review, not a complete native browser fault-injection matrix. Physical touch/keyboard, screen-reader speech, mobile layout and lifecycle qualification remain open. This candidate requires a separate read-only exact-SHA standalone audit. Founder acceptance, Towers Advanced Training, full mock, deployment and release are separate gates.
