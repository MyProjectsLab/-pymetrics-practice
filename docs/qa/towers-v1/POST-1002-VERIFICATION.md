# Towers V1.0 post-1002 corrupt-root repair — developer verification

Base product SHA: `1002eb911742b4dddca8a3119763ddea177a24d5`. This record is developer evidence only. The independent whole-game audit at that base failed E3 while closing E1/E2: [AUDIT](/private/tmp/towers-v1-post22d-independent/AUDIT-1002eb9.md). A separate read-only design challenge gave a bounded GO: `/private/tmp/towers-v1-architecture/POST-1002-REVIEW.md`.

## Before edit and change

I reproduced E3 against the unchanged base production build: an existing `null` or `false` root was replaced with revision-zero new installation data, and Start became enabled; existing truthy invalid roots remained unavailable. The baseline is also preserved in the independent audit's `corrupt-root-shapes-results.json`.

The grouped repair uses an exact-key IndexedDB cursor in the same initialization transaction. Only a genuinely absent key on cold acquisition permits `add(newRoot())`; a present falsey, undefined or malformed value is never overwritten. Reopening an already adopted installation passes a no-initialize purpose. Root version inspection now guards non-objects, and transaction reads distinguish present falsey records from missing records so validation reports an unavailable invalid root. Pending-settlement copy has its own status state and clears on settlement without clearing newer unrelated errors. Frozen forms, report schema, timing and versioned root bytes were not changed.

## Bounded checks

| Gate | Developer result |
|---|---|
| I1 first install | Native Chromium: fresh database, existing empty object store, and two concurrent cold tabs converge on one valid root. |
| I2 malformed present roots | Native Chromium: `null`, `false`, `0`, empty string, present `undefined`, `NaN`, empty object, array and unsupported version remain present and unchanged through open/retry; Start stays disabled and no board appears. Exact key presence and type tags are recorded separately from JSON value. |
| I3 migration/current | Native Chromium v1.0 reserved, active and complete migrations preserve saved state; current valid roots are adopted. `e3-migration-current.cjs`. |
| I4 known installation | Native Chromium deletion of the root after adoption leaves the key absent and Start produces no board; corruption after a valid Delete all replacement remains present and no board appears. Runtime unit test checks cold initialization allowed and replacement reopen denied. |
| I5/I6 replacement/deletion orders | Native Chromium same-document terminal versus individual/Delete all in both orders preserves retirement, activity withdrawal and subsequent new Start. Two replacements before late delivery adopt latest authority. |
| I7 held opening | Native Chromium initial-open watchdog and two allocated-read timeout controls pass; late callbacks remain harmless. Existing bounded abort semantics are unchanged. |
| I8 settlement copy | Native Chromium four terminal/deletion orders clear obsolete pending text; newer installation-replaced error is retained, no old root/activity remains, next Start works. |

Evidence scripts and JSON are under `/private/tmp/towers-v1-runtime-evidence/` (`e3-matrix`, `e3-terminal-delete`, `e3-migration-current`, `e3-ready-replacement-recovery`, `e3-two-replacements`, `e3-e2-repaired`, `e3-initial-open-watchdog`). The production browser tests use real IndexedDB/Web Locks and fresh disposable browser contexts. Cases with external corruption injections are explicit test controls; the app is not claimed to have caused those corrupt values. No physical-device or assistive-technology qualification is claimed.

Focused storage/runtime tests: 34 passed. TypeScript production build and lint passed (existing unrelated lint warnings only). The prior exact-SHA whole-game audit independently passed the unchanged E1/E2, gameplay, report arithmetic and 25 regression cases; a fresh independent exact-SHA verdict is required for this changed candidate.
