# Arrows V1.1 packet handoff

**Base:** `e1d47b5fa25db541c6fd8dca12a813d657e38854`.

**Scope:** versioned, agent-authored specification and six fixed 135-trial forms only. No product source, historical V1.0 file, browser qualification, founder personal acceptance, mock integration or release change.

## Reference hierarchy

The public [Harver/Pymetrics overview](https://harver.com/gamified-assessments/) does not give per-Arrows counts or color rules. The saved JobTestPrep practice video, six guide screenshots and four game/report screenshots are the mechanics reference here; [read-only observation record](/private/tmp/arrows-v11-reference/REPORT.md). They establish 135 trials in the captured practice, five positions, red side-direction and blue/black middle-direction rules, fixation, and one result with 62 aligned, 54 opposed and 19 neutral denominators. They do not establish exact provider timing, form distribution across runs or break policy. The guide's Q/P keys conflict with the game's Left/Right start screen, so our default uses Left/Right. This packet avoids a claim of current real-test equivalence.

## New files and review target

- `docs/specifications/ASSESSMENT_PRACTICE_ARROWS_SPECIFICATION_V1_1.md`
- `docs/specifications/ASSESSMENT_PRACTICE_ARROWS_FORMS_V1_1.json`
- `scripts/generate-arrows-forms-v11.mjs`

The form constructor accepts seeds `0xA2210001` through `0xA2210006` after 80, 178, 31, 502, 1,459 and 57 candidate shuffles. The canonical form-object digest is `bedfa8c58fd9bde20cf7b9408b6ac5909c6bae45d025bff9c3de8041f8ae6855`. Pairwise playable differences span 117–128 of 135 positions. Each form has 68 Left, 67 Right, 58 red, 58 blue, 19 black, 62 aligned, 54 opposed and 19 neutral trials. These are construction outputs for independent verification, not calibrated difficulty results.

## Independent review request

At the exact packet SHA, re-read the full V1.1 packet and reference record; independently regenerate all forms and compare exact bytes/digest; verify five legal stimulus cells, four-side red rule, neutral black marks, per-form/per-block counts, run and switch constraints, pairwise distances and version boundaries. Challenge whether V1.0-to-V2 migration, same-installation deletion authority, historical report preservation, 27-trial breaks and all visible copy have enough detail for implementation. Treat the six forms as uncalibrated order variants. Do not modify the repository in the audit. A packet PASS permits bounded implementation; it does not qualify a browser or accept a game.
