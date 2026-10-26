# Exact-SHA reuse review

[BEFORE-IDENTITY.json](BEFORE-IDENTITY.json) retains changed source/dependency paths from each anchor to 702. [AFTER-IDENTITY.json](AFTER-IDENTITY.json) records the final source/build hashes and candidate delta. The lockfile is unchanged across the anchors; [DEPENDENCY-IDENTITY.json](DEPENDENCY-IDENTITY.json) records the installed versions. This supports narrowly scoped reuse; it does not renew any historical verdict.

| Anchor | Reuse and delta limit |
|---|---|
| F: `36a5ef718602ff2c49fa60aaafc59a67d57eedd0` | Standard manifests, generator, versions and original public SVGs remain unchanged. Reuse the 14-form/91-pair mathematical evidence in `docs/STOP_FORM_PROVENANCE.md`. The unperformed observed-reference comparison remains open. |
| T: `9127249f49ab51f84c5e59cd560cecdcfc7ede31` | Keep original input/default-action and timing-adapter evidence. Later engine/browser/integrity paths changed; T alone cannot attest the current composition. R/D/P/A and B cover later bounded changes. Native and physical measurement limits persist. |
| R: `d386d5b54ed5873a43f515080b81f728ffc6a1c1` | `scoring.ts` is unchanged from R; reuse independent scoring oracles and correction evidence. Later run/storage/UI changes are governed by P/A/B. Newly captured journals are independently reconciled rather than rerunning all scoring boundaries. |
| D: `0c5f984048721a8dfd25a6a75e67bf594c83b206` | Drill manifests/generator and established routing fixtures retained. Later comparison/integrity/training paths changed; reuse only with P/A, including A's corrected strict S46 comparator. D's verdict does not override later fixes or qualify devices. |
| P: `33400f5e7ab79590381bd46ad6da3db14410932d` | Whole-M5 persistence/deletion/recovery/authority evidence retained. Later claim-lease, initial-frame and preflight changes are covered by A. Preserve C6/C7's rendering-cycle boundary and no wall-clock guarantee. |
| A: `1c716a544520309cc814062baf83078870fc2d98` | Engine, browser adapter, scoring, comparison arithmetic, run/storage/training, forms and dependencies remain unchanged from A. M6-B adds UI analytics composition and infrastructure; B independently inspected this composition. This run does not repeat A's precision, lease or watchdog fixtures. |
| B: `f85018ce9c06d98a8813110a4079a0034bfc25b4` | Preserve the historical FAIL solely on collector F1 and its sound client/UI checks. Only collector implementation/test changed from B to 702. |
| B-F1: `702a0fb956de2d76113f3a58c3474c9b24af3946` | Focused collector F1 PASS, not whole-M6-B certification. The initial build here matches the accepted audit's exact output hashes. Analytics paths/configuration remain unchanged throughout M6-C. |

The final M6-C product delta is restricted to History.tsx, its regression test, a history-SVG CSS selector and the public license notice. History focus/ARIA and responsive presentation therefore require fresh checks; their old UI evidence cannot simply be inherited. No arithmetic, result, form, compatibility, persistence, event, policy or analytics path was edited.

The accepted audit reports are retained byte-for-byte with SHA-256 in `accepted-audits/INDEX.json`. Their linked temporary raw evidence remains at its original path and is not represented as newly captured or reverified. New M6-C raw data is retained in this directory and bound by `EVIDENCE-SHA256.json`.
