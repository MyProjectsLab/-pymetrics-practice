# Easy or Hard V1.0 grouped R1–R2 repair

Base: `882ccac88f987a8f761e3293df9571834750b81a`.
Independent source: `/private/tmp/easy-hard-v1-independent/REAUDIT-882ccac.md`.

## Reproduction before repair

- A feedback deadline later than global expiry produced `feedback_end(121650)` instead of `global_expired(120000)`.
- After EH1–EH4 and a retained EH1 replay, deleting original EH1 let a new attempt reuse ordinal 1 and display `New form`.
- Both added focused tests failed on the base source before editing.

## Repair

- The fixed-deadline planner emits feedback end only when its deadline is strictly before global expiry. Global expiry wins a tie.
- Form selection first chooses the lowest original form absent from retained local history. Once all four are retained, it allocates a replay ordinal above four even if a lower original ordinal has been deleted. Existing run and report bytes are unchanged.

## Developer checks

- Focused Easy or Hard suite: 18 tests passed across four files.
- Lint and production build passed. Lint reported only pre-existing warnings outside changed files.
- Production Chromium late-callback replay: the final task resolved before global expiry, the callback was stalled four seconds across the deadline, the root ended `complete` with `global_expired(120000)`, and the screen showed Test Complete.
- Production Chromium exposure replay: after EH1–EH4, EH1 replay and deletion of original EH1, the next attempt received ordinal 6/EH2 and the report said `Familiar form`. Retained ordinal-5 EH1 remained in the root.
- Browser evidence: `/private/tmp/easy-hard-r1-r2-evidence/`.
- No frozen packet, form, fixture, generator, or historical result file changed.

This is developer verification only. Separate read-only exact-SHA audit remains required. Founder acceptance, device/accessibility qualification, mock integration, deployment and release remain open.
