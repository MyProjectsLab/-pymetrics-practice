# Lengths L1 headless foundation — developer verification

**Date:** 2026-10-07. **Base:** frozen packet commit `0da999ebc2680a84a3abda713a465de94281403d` in isolated `/private/tmp/lengths-v1-spec`. The separate read-only specification audit passed at `549cbed39cc5d46b495c3b9eddb578a3089817c7`; [FREEZE.md](FREEZE.md) binds its exact implementation identity. The packet is agent-authored under founder delegation, not founder-personally reviewed.

The frozen source hashes were checked before implementation: specification `88a3938ce356b71115dd275fac057ca3f3adf27e824d88eb326cf87963040bd4`, forms file `f3e2865ab023e60f20bdd25b7fd2cc6f6fb618fc67b9d57d8e9d89bf82f88efc`, and fixture file `bdde5c7b2c6b58743dab02b827bfdd797b6d4b579907f8a909ea469916d1a31b`. Their bytes were not edited.

## Implemented boundary

- `src/lengths/manifests.ts` loads the fixed twelve-form inventory only after a SHA-256 digest and independent structural checks for identity, geometry, block balance, run/switch constraints, paired standard/accommodation orders and pairwise numbered-order variety. Returned forms are immutable and marked as verified; forged forms cannot arm the engine.
- `src/lengths/engine.ts` supplies a pure 96-trial four-block command reducer with one monotonic domain, ordered versioned events and three reconciled 24-trial break summaries, fixed 600-ms fixation and 1,400-ms response deadline, first-response precedence, selected-key/pointer handling, timing notes/severe invalidation, frame gaps and required-stage watchdogs. It labels all evidence `headless_unconfirmed`; the browser still must confirm actual display and input.
- `src/lengths/report.ts` replays the exact command/event state before reconciling presented, closed, unresolved and unpresented trials. Only a complete, non-invalidated journal yields descriptive counts, response-side distribution and clean correct-time medians/IQRs. Invalid/incomplete states suppress aggregates. It makes no saved or browser-valid claim.

## Focused evidence

`src/lengths/manifests.test.ts` covers fixed inventory, immutability, changed bytes, unsupported versions, forged forms and caller mutation during an asynchronous digest. `src/lengths/engine.test.ts` drives primitive observations through all 96 LS1 trials and checks the frozen all-correct, first-wrong/second-omitted, 80-ms, 1,399/1,400-ms, 50/51/250/251-ms stage-lateness and five/eight-time fixtures. It also covers 50/51/250/251-ms protected frame gaps, held and modified keys, unrelated-key minimization, multi-pointer suppression, pointer-source change, watchdog, untimed break hide, partial review and event/field tampering. Expected values are checked against the fixed fixture file; action streams are built from primitive trial records, not from its expected outputs.

**Checks passed:** Lengths test files 2/2, 22 tests; app, node and analytics TypeScript projects with `--noEmit --incremental false`; repository lint (five existing warnings outside Lengths); deterministic Lengths manifest/fixture byte check; production client bundle; analytics bundle; `git diff --check`. The worktree reads an existing dependency installation through a local ignored symlink, so TypeScript was checked without writing build metadata through that link. The client build retained the repository's large-chunk advisory.

## Open limits

L1 has no candidate UI, DOM/frame confirmation, browser timing adapter, IndexedDB arm/checkpoint/result/activity storage, local history, deletion, cross-tab ownership, mock adapter or real-device accessibility evidence. Form geometry is fixed but its visible CSS layout has not been qualified. A separate read-only exact-SHA audit of this implementation is required. Developer tests do not establish founder personal acceptance, whole-game completion, browser/device/accessibility qualification, deployment or release.
