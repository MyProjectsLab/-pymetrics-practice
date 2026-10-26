# Arrows A6 F3-R4 stacking fallback — developer verification

**Base:** clean `a432ec042f9b00054ecc8a9d9cc7cfbd2cbc4699`. The [independent F3-R3 audit](/private/tmp/arrows-a6-f3r3-audit-a432ec0-tuwkmraz/AUDIT.md) failed at that SHA on two P1 false-visible cases: a nested top-layer popover and a host wrapper with an intervening stacking context. Both permitted scored play under a fully covered cue.

## Change

`src/arrows/browser.ts` now uses the important-rule fallback only when the candidate branch and host branch are direct siblings under their nearest common DOM ancestor and both have explicit numeric stacking layers. It never scans past a branch to compare z-index values from different contexts. It also scans the candidate's complete branch path for dialog, popover and fullscreen elements before accepting any lower layer. Unknown arrangements remain a failed visibility check. The ordinary temporary stylesheet probe, frozen timing and input mechanics, journals, forms and storage are unchanged.

## Focused browser evidence

The independent auditor's native-clock reproducer, copied outside the repository and run against this repair, now passes **22/22** stacking challenges: nested/direct popovers, all eight host-context variants before Start and during protected play, and their paint controls. A separate prior important-rule matrix passes **10/10** direct/nested lower-layer and healthy-app cases; both healthy runs reached three onsets without invalidation or timing notes. The original attribute-sensitive front-overlay, inverse underlay and absent-style restoration cases remain **3/3** passing. [Case summary](A6-F3R4-browser-summary.json) links these groups; full raw results and scripts are in `/private/tmp/arrows-a6-f3r4-local/`, `/private/tmp/arrows-a6-f3r3-local/`, and `/private/tmp/arrows-a6-f3r2-local/`.

`npm run lint` passes with two inherited warnings. `npm test -- src/arrows` passes 51/51 tests across six files. `npm run arrows:check` retains canonical digest `228b0e10405a80830c73e4b69e12950482967dec717f156c789e19fa11b1150b`; `npm run build` passes TypeScript and both production bundles. The three frozen Arrows SHA-256 values remain recorded in [FREEZE.md](FREEZE.md); no governing document was edited.

## Limits

The fallback deliberately handles only provably ordered explicit sibling layers; it does not claim a complete CSS paint-order algorithm. Unknown layouts fail closed. The browser evidence is bounded headless Chromium `145.0.7632.6` with constructed overlays, not physical timing, native lifecycle, accessibility or browser/device qualification. A6 is still a source adapter without candidate navigation, durable checkpoints/results/history or mock integration. This is developer verification only; a new exact-SHA independent audit, founder personal acceptance and all product/release gates remain open.
