# Stop V1.3 variable-mix implementation verification

**Base:** `58332acd91a2573bc4fb38f417d702c7626dcdcb`. **Scope:** Standalone Stop Practice, report/history, and versioned Advanced Training compatibility. Independent product-code audit, founder personal acceptance, physical/browser/device/accessibility qualification, full mock, deployment and release remain open.

## Changes

- Load the 14 reviewed V1.3 fixed forms for new baseline/replay/retest attempts. Preserve the original 14 V1.1 forms and permit V1.1 retests only within eligible legacy chains.
- Reconcile and display each form's actual GO and NO-GO counts. V1.3 uses separate scoring, report and router identities. Block and training evidence use the V1.3 sample gates. Unlike-mix comparisons omit overall change and directional raw-count claims.
- Keep version-specific understanding evidence, same-mix-first retest assignment, legacy reservation expiry, and history progress separated by mix. Existing V1.1 result/event/scoring paths remain versioned and readable.

## Developer checks

- `npm run check`: 1,597/1,597 tests across 96 files, manifest checks, lint, TypeScript and production build passed. Three inherited lint warnings and the existing large-chunk/import warnings remain. An earlier full run failed two shallow legacy History fixtures when grouping read unavailable fixture counts; the scoped correction passed and the final full run is green.
- V1.3 focused cases check all frozen form checksums, actual 28/52 and 45/35 scoring, complete 80-trial journal verification, route selection and timing/sample boundaries, unlike- and same-mix comparisons, retest allocation/fallback, and separate old/new understanding evidence.
- Frozen addendum, V1.3 manifest and generator hashes match `docs/qa/stop-v1-3/FREEZE.md`; the original V1.1 form manifest is byte unchanged. `git diff --check` passed.

## Production-browser evidence and limits

At the pre-final build, a browser journey completed 8 warm-up and 80 scored trials without scored key input. The valid report displayed `stop-v13-baseline-03`, 40 GO misses, 40 NO-GO withholds, 50% overall and four 10/10 blocks. That browser session crossed a development bundle rebuild: the old running bundle reported a saved V1.3 result, but the newer reloaded bundle rejected its earlier record because it lacked the newly added report identity. This mixed-build session is excluded from final-build save/reload acceptance.

On the final build, the candidate completed guide, examples, understanding check, setup, input check and warm-up. The scored run invalidated after 28 stimuli on a viewport-quality event, with 27 resolved trials. Its browser record correctly remained ineligible. The browser had been given a 1280 × 800 test viewport, but this observation does not establish why the validity event occurred. A continuous final-build browser completion and save/reload check remains for the independent audit. The deterministic complete-run test serializes a V1.3 result and confirms the same record passes history admission; removing `reportVersion` rejects it. The browser interactions were tool-dispatched; no physical input or device timing is qualified.

The reference basis remains [the separate source check](REFERENCE-CHECK.md). Official Harver material does not publish an exact Stop mix. The two saved JobTestPrep practice videos show varying mixes; forum comments are anecdotal. These original forms are uncalibrated and do not claim provider equivalence.
