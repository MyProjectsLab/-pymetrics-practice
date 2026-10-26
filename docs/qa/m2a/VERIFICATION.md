# Stop M2A verification

Date: 2026-09-28. Scope: preparation through the development-only readiness handoff, under Stop V1.1 and Founder clarification M2A-01 in `IMPLEMENTATION_TRACKER.md`.

This record does not certify timed gameplay, the complete S01 journey, browser timing accuracy, release accessibility, deployment, or public release.

## Automated checks

Environment: Node.js 24.13.1, npm 11.8.0, committed dependency lockfile. All four requested commands were run independently, followed by the combined check:

- `npm run lint`: passed, no warnings.
- `npm test`: passed, 10 files and 74 tests.
- `npm run build`: passed, TypeScript project build and Vite production build.
- `npm run check`: passed; includes lint, the same tests, byte-for-byte deterministic regeneration of all 14 M1 forms, and production build.

### Test responsibilities

| File | Evidence |
|---|---|
| `src/App.test.tsx` | Complete M2A path in React StrictMode; exact preparation-event order; failed and successful whole-pass comprehension; required answers and stable answer choices; profile/remapping/input gate; setting changes; held-key carryover from input check to readiness; repeat/blur/visibility gating; minimum viewport boundaries; new in-memory session after returning to library; ordinary-page Space behavior |
| `src/core/events.test.ts` | Stable captured session/schema/clock, per-session sequence numbers, monotonic non-negative finite time, clone isolation, deeply frozen payloads, immutable historical snapshots, and no consumed sequence numbers on rejected events |
| `src/core/Shell.test.tsx` | Main landmark, skip link, reusable library entries, and stable game identity on navigation |
| `src/stop/Examples.test.tsx` | All four outcome combinations and exact feedback; neutral pre-check confirmation; first response cannot be undone; modifier/repeat/composition/wrong/held input filtering; Space default prevention; Enter remains available; remapped key and shape profile on revisiting examples |
| `src/stop/Guide.test.tsx` | Approved guide/rule copy, invitation-first boundary, non-color stimulus labels, and original accommodation asset |
| `src/stop/Preflight.test.tsx` | Prohibited key rejection through rendered controls; no binding change on rejection; Tab remains navigation |
| `src/stop/preparation.test.ts` | Safe key-binding parser, prohibited modifiers/chords/repeats/composition, deterministic question-order shuffle fixtures |
| `src/stop/useResponseKey.test.tsx` | Held state survives blur and unrelated keyup; only matching keyup releases; viewport updates |
| Existing `src/core/registry.test.ts` and `src/stop/forms/validate.test.ts` | M1 regression coverage unchanged |

The test total includes existing M1 fixtures. The former scaffold-only App test was replaced by journey coverage. jsdom does not establish real browser timing accuracy.

## Real-browser smoke evidence

Tested the local Vite app in the Codex in-app browser on this Mac. Exact browser engine/version was not captured; this is one development environment, not the founder-approved support matrix.

Observed:

1. Library, guide, rule, and fixed GO / NO-GO / GO / NO-GO example sequence rendered.
2. With Check example focused, Space showed only “Response recorded. Select Check example.” The button did not activate. Enter then revealed the approved feedback.
3. All four exact feedback cases were observed: correct GO, correct withhold, missed GO, and false alarm.
4. Comprehension initially disabled submission; one wrong answer produced the approved failure message and rule-review action. A fresh all-correct retry opened setup.
5. Without the physical-keyboard self-confirmation, input check/readiness were disabled.
6. Escape was rejected as a response binding. F was accepted; the key check succeeded with F and restored focus to Continue to readiness.
7. High-distinction shape assets and the exact accommodation disclosure appeared. Readiness showed the selected F binding and accommodation label.
8. Tab reached I’m ready with a computed solid 3px focus outline. Enter reached only the exact development checkpoint.
9. Console error/warning log was empty at the checkpoint.
10. At 320 CSS pixels, DOM measurements found content width equal to viewport width on library, guide, rule, examples, comprehension, and preflight. At 768 × 600, preflight and readiness were usable. Temporary viewport overrides were reset after checks.
11. The final rule screen was inspected and captured in `rule-screen.png`.

## Acceptance status and limits

The authoritative per-ID mapping is in `IMPLEMENTATION_TRACKER.md`.

- **Passed:** S03, S04, S08; S05 passed for the founder-approved M2A self-confirmation/input-check boundary.
- **Partially covered:** S01, S02, S06, S07, S09, S61–S65, S67, S74, S75.
- **Prior M1 evidence retained:** S21–S24 within the limits already recorded for M1.
- **Not yet applicable to M2A:** S10–S20, S25–S60, S66, S68–S73.

Held-key behavior is covered by deterministic component fixtures, including carrying a key from preflight to readiness. No sustained physical-key hold test or browser timing/device-matrix certification is claimed. Screen-reader use, 200% zoom, final contrast/visual approval, and OS reduced-motion preference coverage remain open. The implementation has no animations and includes reduced-motion CSS; it has no trial timing to test.

The physical keyboard gate combines a user assertion with a key input. It cannot prove physical hardware identity. Browser/OS shortcut behavior requires later matrix QA. The initial binding set deliberately accepts safe unmodified printable letter, digit, punctuation, and Space keys; it rejects navigation/function/modifier keys and chords.

M2A-01 resolves the blocking product ambiguities for this milestone. The final release must replace all development-only messages, replace the readiness handoff with M2B, and show availability/storage promises only when those capabilities exist.

## Scope and provenance

New code, layout, and neutral preview copy were authored for Assessment Practice. Approved Stop copy and M2A-01 text were transcribed from the founder-controlled documents/clarification. Existing stimulus SVGs reuse the M1 provenance recorded in `docs/STOP_ASSET_PROVENANCE.md`. No competitor expression, external imagery, fonts, or third-party assets were added. No new dependency was installed.

Source review found no timers, animation-frame engine, network requests, analytics, browser storage, or form exposure writes in the new preparation implementation. No M1 form or manifest was changed.

## Governing-document integrity

SHA-256 was compared against the authoritative repository continuation at `36a5ef718602ff2c49fa60aaafc59a67d57eedd0`, not against an unverified external mirror:

| File | SHA-256 |
|---|---|
| `docs/specifications/ASSESSMENT_PRACTICE_MASTER_STRATEGY.md` | `c046fd1776c179799422893985229743bd495ed8d23c9388046f4424162c46f3` |
| `docs/specifications/ASSESSMENT_PRACTICE_STOP_SPECIFICATION_V1_1.md` | `d6389db51b3767764d7e4d71c8a6c84a3719581225165fd42d86c76a4ab2c843` |

Both match byte for byte and remain unchanged.

## Changed files

- `IMPLEMENTATION_TRACKER.md`: M2 split, Founder clarification M2A-01, milestone status and acceptance evidence.
- `README.md`: current milestone status and verification pointer.
- `src/App.tsx`, `src/App.test.tsx`: library-to-readiness composition and integrated component tests.
- `src/App.css`, `src/index.css`: provisional responsive visual system, focus styling, and reduced motion.
- `src/core/Shell.tsx`, `src/core/Shell.test.tsx`: reusable shell and library.
- `src/core/events.ts`, `src/core/events.test.ts`: memory-only event recorder and integrity fixtures.
- `src/stop/Guide.tsx`, `src/stop/Guide.test.tsx`: introduction and rule screens.
- `src/stop/Stimulus.tsx`: reusable accessible static stimulus presentation.
- `src/stop/Examples.tsx`, `src/stop/Examples.test.tsx`: untimed coached examples.
- `src/stop/Comprehension.tsx`: whole-pass comprehension and review actions.
- `src/stop/Preflight.tsx`, `src/stop/Preflight.test.tsx`: device, key, visual, and viewport checks.
- `src/stop/Journey.tsx`: preparation navigation and development-only warm-up handoff.
- `src/stop/preparation.ts`, `src/stop/preparation.test.ts`: versioned recorder adapter, example order, approved choices, shuffle, and key-binding helpers.
- `src/stop/useResponseKey.ts`, `src/stop/useResponseKey.test.tsx`: held-key, focus, visibility, and viewport state before any timed run.
- `docs/qa/m2a/VERIFICATION.md`, `docs/qa/m2a/rule-screen.png`: this evidence and browser screenshot.
