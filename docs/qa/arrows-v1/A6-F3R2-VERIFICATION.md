# Arrows A6 F3-R2 focused repair — developer verification

**Base:** clean `0da5e89b7ca13385807007b10fda0e7db36fb379`. The [independent F3-R1 audit](/private/tmp/arrows-a6-f3r1-audit-0da5e89-qi2075ux/AUDIT.md) is FAIL at that SHA. This repair is not an independent PASS.

## Change

`src/arrows/browser.ts` no longer writes to a candidate element's inline style to make `pointer-events:none` paint hit-testable. It temporarily adopts a constructable stylesheet that changes only pointer hit eligibility, measures the hit order, and restores a snapshot of the original adopted stylesheet contents synchronously. The unchanged element attributes keep `[style]` selectors from changing the paint order being measured. An intermediate probe caught that retaining the browser's live array reference would leave the override applied; the final code copies its contents before adoption. If the browser cannot apply the hit-test override, the visibility predicate conservatively fails. Timed input, due times, journals and form assignment are unchanged.

## Results

- The retained [Chromium probe](A6-F3R2-browser.mjs) and [raw result](A6-F3R2-browser.json) pass three native-clock cases: a fully covered cue invalidates and releases ownership; an identically placed underlay stays valid; and a stylesheet-only element retains an absent `style` attribute. The cases also assert that adopted sheet contents and computed pointer behavior return to their original values. The first probe invocation used its old default port and captured connection errors; the corrected `ARROWS_QA_ORIGIN=http://127.0.0.1:4193` invocation passed.
- The unchanged F3-R1 browser regression script passes 8/8 cases on this source, including ordinary overlays, an underlying non-interactive sibling, pre-Start admission and publication cleanup. Its rerun result is retained outside the repository at `/private/tmp/arrows-a6-f3r2-local/A6-F3R1-browser.json`; the original historical QA result was not overwritten.
- `npm test -- src/arrows`: 51/51 tests across six files. `npm run lint`: pass with two inherited warnings. `npm run arrows:check`: canonical form digest unchanged. `npm run build`: TypeScript and production builds pass.
- Frozen Arrows specification, six-form JSON and constructor hashes remain `ae7360d4b81d28b23c12e265e0707934f6659fdf183c65ddac782745ad305836`, `a87abdaa25fbddd9b08b49e97fa0fa2fbc25e2c4bf32bc59be7dca6b46cfef3f`, and `5c317a02f5b2c953fcf692ce9467dc506197c64d9ca07900caff16c23cc1df27`.

## Limits and handoff

These are bounded Chromium `145.0.7632.6` functional checks, not physical timing, native lifecycle, accessibility or other-browser qualification. Constructable stylesheet support is required to admit a non-interactive overlapping element; unsupported or overriding CSS configurations fail closed. No whole-game, candidate UI, durable checkpoint/result/history, mock, deployment, analytics or release claim follows. Request a fresh separate read-only exact-SHA audit before marking A6 PASS.
