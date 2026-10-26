# Arrows A6 F3-R3 important-rule underlay repair — developer verification

**Base:** clean `936952806f95fafdbdf3ebc7af2c613381cd21ff`. The [independent F3-R2 audit](/private/tmp/arrows-a6-f3r2-audit-9369528-4cukg9j3/AUDIT.md) failed at that SHA because a fully unobscured underlay using `pointer-events:none !important` could prevent Start or invalidate an active run. The parent admitted the same actual display.

## Change

The constructed stylesheet still probes ordinary `pointer-events:none` elements without modifying their attributes. If an important rule prevents the override, `src/arrows/browser.ts` admits the element only when explicit stacking levels in the candidate and host ancestry prove that the candidate is behind the host. An unknown stacking relation fails the visibility check. Nested layers compare their first separate stacking contexts, so an inner high `z-index` cannot escape a lower parent layer. Dialog, popover and fullscreen top-layer paths are not admitted by this fallback. No timed input, form, journal or storage behavior changed.

## Evidence

- The auditor's exact failing native-clock harness, rerun against this uncommitted repair, passes **10/10** important-rule underlay/admission/nested/healthy-app cases. The expanded important-rule overlay matrix passes **14/14**, and stylesheet-only absent/empty/formatted-style cases pass **6/6**. [Summary](A6-F3R3-browser-summary.json) retains each case's outcome; full raw results and harness are at `/private/tmp/arrows-a6-f3r3-local/`. The healthy keyboard/pointer runs reached three onsets without invalidation or timing notes; sampled visibility checks stayed at or below 1 ms in that Chromium environment.
- The original attribute-sensitive front-overlay, inverse underlay and absent-style cases remain **3/3 passing** in a separate final-source rerun at `/private/tmp/arrows-a6-f3r2-local/f3r3-probes.json`.
- `npm run lint` passes with the same two inherited warnings. `npm test -- src/arrows` passes 51/51 tests across six files. `npm run arrows:check` retains the canonical `228b0e10405a80830c73e4b69e12950482967dec717f156c789e19fa11b1150b` digest. `npm run build` passes TypeScript and both production bundles. No independent PASS is claimed here.
- The three frozen Arrows hashes remain `ae7360d4b81d28b23c12e265e0707934f6659fdf183c65ddac782745ad305836`, `a87abdaa25fbddd9b08b49e97fa0fa2fbc25e2c4bf32bc59be7dca6b46cfef3f`, and `5c317a02f5b2c953fcf692ce9467dc506197c64d9ca07900caff16c23cc1df27`.

## Limits

The stacking fallback deliberately recognizes only explicit numeric layers. It does not claim to model every CSS paint rule or browser top layer. It fails closed when the relationship cannot be established. These are bounded headless Chromium `145.0.7632.6` functional checks with injected fixtures, not physical timing, native lifecycle, accessibility or browser/device qualification. A6 remains a source adapter without candidate navigation, checkpoints, saved result/report/history or mock integration. Separate exact-SHA read-only audit, personal founder acceptance, qualification, deployment and release remain open.
