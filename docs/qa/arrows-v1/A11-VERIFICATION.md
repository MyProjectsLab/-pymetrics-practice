# Arrows A11 — history retirement foundation

This bounded stage adds store operations for verified history listing, individual deletion and Arrows-only Delete all. It does not expose a candidate screen yet. The frozen Arrows specification and forms are unchanged.

## Behavior

- History listing validates the current installation and every retained arm/snapshot before returning attempts in descending arm order. Armed/checkpoint-only records remain review-only after reload.
- Individual deletion removes one attempt and writes its tombstone in the same transaction. The scored form counter does not roll back. A late checkpoint or terminal save using that arm is rejected.
- Delete all replaces the Arrows installation identity and resets its counter. A previous store and its delayed callbacks cannot write into the replacement. The operation affects the Arrows database only.
- A failed transaction is reported as uncertain unless authoritative readback proves that the exact requested deletion committed. A committed Delete all with lost callback returns a store bound to the verified replacement.

## Developer checks

Focused storage cases exercise listing, counter retention, late-save rejection, replacement, lost delivery and pre-commit failure. See `src/arrows/storage.test.ts`. `npm test -- src/arrows/storage.test.ts` passed 22 tests. TypeScript, lint, `arrows:check` and production/analytics builds passed. Lint retained two warnings in untouched files; the build retained its pre-existing bundle-size warning. This stage did not rerun the unrelated full test suite.

## Limits

No candidate UI, report-view activity journal, cross-tab notification or physical device behavior is claimed. This is developer verification only until a separate read-only exact-SHA audit. Arrows whole-game acceptance, full mock, qualification, deployment and release remain open.
