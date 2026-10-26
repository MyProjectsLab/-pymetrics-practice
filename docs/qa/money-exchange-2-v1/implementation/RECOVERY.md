# Money Exchange 2 candidate recovery — 2026-10-12

Recovery only. No gameplay changes, fresh functional tests, new independent audit, deployment, or main-checkout edits.

The original candidate `f8ea2f6b1a3f93bc85525538841cb1b8e2eedca0` and temporary evidence directory were lost. This is a new recovery commit based on `dc32d890338d6321ccfb4195eafaa3cc0c27e0d2`; it does not recreate the original commit or its complete evidence tree.

## Integrity result

All **13/13 source/test/integration files match the original recorded SHA-256 manifest exactly**. The manifest was recovered verbatim from root session line 87588. All 12 frozen companion files match their recorded FREEZE.md identities. The frozen-identities JSON was regenerated from that retained freeze record during recovery.

Source, tests, browser drivers, and DEVELOPER-QA.md were reconstructed by selectively replaying reviewed file-writing payloads from implementation session `01a130b8-a054-7692-bb11-5247ab715371`. Shell commands, tests, network operations and historical Git operations were not replayed. QA and driver contents have no retained original hash manifest and therefore are transcript-reconstructed, rather than independently hash-proven against the lost Git object.

DEVELOPER-QA.md is recovered historical text: its PASS statements and evidence links describe the original developer run. Missing links listed below are LOST and cannot substantiate a current qualification. The recovered independent audit retains its original target and verdict; it is not an audit of this new commit. Historical command-output excerpts are retained as transcript evidence, not replacement log files or rerun results.

## Recovered original files

- `src/App.tsx`
- `vite.config.ts`
- `docs/qa/money-exchange-2-v1/implementation/DEVELOPER-QA.md`
- `docs/qa/money-exchange-2-v1/implementation/browser-accessibility.mjs`
- `docs/qa/money-exchange-2-v1/implementation/browser-deletion.mjs`
- `docs/qa/money-exchange-2-v1/implementation/browser-matrix.mjs`
- `docs/qa/money-exchange-2-v1/implementation/browser-storage.mjs`
- `docs/qa/money-exchange-2-v1/implementation/browser-support.mjs`
- `docs/qa/money-exchange-2-v1/implementation/browser.mjs`
- `docs/qa/money-exchange-2-v1/implementation/evidence/candidate-source-sha256.json`
- `docs/qa/money-exchange-2-v1/implementation/evidence/frozen-identities.json`
- `money2.html`
- `src/money-exchange-2/art.ts`
- `src/money-exchange-2/controller.test.ts`
- `src/money-exchange-2/controller.ts`
- `src/money-exchange-2/core.test.ts`
- `src/money-exchange-2/core.ts`
- `src/money-exchange-2/entry.ts`
- `src/money-exchange-2/forms.json`
- `src/money-exchange-2/owned-document.ts`
- `src/money-exchange-2/storage.test.ts`
- `src/money-exchange-2/storage.ts`

## LOST original evidence files

- **LOST** `docs/qa/money-exchange-2-v1/implementation/evidence/accessibility-results.json`
- **LOST** `docs/qa/money-exchange-2-v1/implementation/evidence/accessibility.log`
- **LOST** `docs/qa/money-exchange-2-v1/implementation/evidence/build.log`
- **LOST** `docs/qa/money-exchange-2-v1/implementation/evidence/deletion.log`
- **LOST** `docs/qa/money-exchange-2-v1/implementation/evidence/deletion/results.json`
- **LOST** `docs/qa/money-exchange-2-v1/implementation/evidence/filmed.log`
- **LOST** `docs/qa/money-exchange-2-v1/implementation/evidence/filmed/filmed-root.json`
- **LOST** `docs/qa/money-exchange-2-v1/implementation/evidence/filmed/reload.png`
- **LOST** `docs/qa/money-exchange-2-v1/implementation/evidence/filmed/report-1.png`
- **LOST** `docs/qa/money-exchange-2-v1/implementation/evidence/filmed/report-2.png`
- **LOST** `docs/qa/money-exchange-2-v1/implementation/evidence/lint.log`
- **LOST** `docs/qa/money-exchange-2-v1/implementation/evidence/matrix.log`
- **LOST** `docs/qa/money-exchange-2-v1/implementation/evidence/matrix/320px-choice.png`
- **LOST** `docs/qa/money-exchange-2-v1/implementation/evidence/matrix/320px-report.png`
- **LOST** `docs/qa/money-exchange-2-v1/implementation/evidence/matrix/320px-result.png`
- **LOST** `docs/qa/money-exchange-2-v1/implementation/evidence/matrix/amount-root.json`
- **LOST** `docs/qa/money-exchange-2-v1/implementation/evidence/matrix/closed-root-root.json`
- **LOST** `docs/qa/money-exchange-2-v1/implementation/evidence/matrix/direction-root.json`
- **LOST** `docs/qa/money-exchange-2-v1/implementation/evidence/matrix/hidden-root.json`
- **LOST** `docs/qa/money-exchange-2-v1/implementation/evidence/matrix/occluded-root.json`
- **LOST** `docs/qa/money-exchange-2-v1/implementation/evidence/matrix/results.json`
- **LOST** `docs/qa/money-exchange-2-v1/implementation/evidence/matrix/six-forms-root.json`
- **LOST** `docs/qa/money-exchange-2-v1/implementation/evidence/matrix/source-size-choice.png`
- **LOST** `docs/qa/money-exchange-2-v1/implementation/evidence/matrix/source-size-report.png`
- **LOST** `docs/qa/money-exchange-2-v1/implementation/evidence/matrix/source-size-result.png`
- **LOST** `docs/qa/money-exchange-2-v1/implementation/evidence/matrix/top-layer-root.json`
- **LOST** `docs/qa/money-exchange-2-v1/implementation/evidence/matrix/transparent-root.json`
- **LOST** `docs/qa/money-exchange-2-v1/implementation/evidence/matrix/zoom-report.png`
- **LOST** `docs/qa/money-exchange-2-v1/implementation/evidence/storage.log`
- **LOST** `docs/qa/money-exchange-2-v1/implementation/evidence/storage/ready-Close-arm.json`
- **LOST** `docs/qa/money-exchange-2-v1/implementation/evidence/storage/ready-Close-exit.json`
- **LOST** `docs/qa/money-exchange-2-v1/implementation/evidence/storage/ready-Restart-arm.json`
- **LOST** `docs/qa/money-exchange-2-v1/implementation/evidence/storage/ready-Restart-exit.json`
- **LOST** `docs/qa/money-exchange-2-v1/implementation/evidence/storage/results.json`
- **LOST** `docs/qa/money-exchange-2-v1/implementation/evidence/storage/terminal-terminal.json`
- **LOST** `docs/qa/money-exchange-2-v1/implementation/evidence/storage/terminal-withdrawal.json`
- **LOST** `docs/qa/money-exchange-2-v1/implementation/evidence/tests.log`

No replacement screenshots, durable roots, result JSON files, or full logs have been fabricated. The original commit object/tree is not recovered. Existing main-checkout changes were untouched.
