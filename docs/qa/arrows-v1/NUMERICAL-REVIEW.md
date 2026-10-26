# Arrows V1.0 form review — developer numerical evidence

The packet and six manifests are agent-authored under the founder's 2026-10-05 delegation. This is a reproducible construction review, not an independent specification audit, calibration study, implementation test or browser qualification. No Arrows product code was implemented for this packet.

## Fixed identity

- Source: `docs/specifications/ASSESSMENT_PRACTICE_ARROWS_SPECIFICATION_V1_0.md`.
- Constructor: `scripts/generate-arrows-forms.mjs`; `node scripts/generate-arrows-forms.mjs --check` confirms exact stored bytes.
- Manifests: `docs/specifications/ASSESSMENT_PRACTICE_ARROWS_FORMS_V1_0.json`.
- Canonical compact-object SHA-256: `228b0e10405a80830c73e4b69e12950482967dec717f156c789e19fa11b1150b`.
- Seed progression: decimal `2720006145`–`2720006150` (`0xA2200001` through `0xA2200006`). First acceptance attempts: **10, 11, 10, 2, 5, 5**.

## Checks

A separate Python checker read the generated JSON and independently checked its canonical digest, 720 indexed trials, 30 blocks, 12 rule/condition/direction cells per block with two copies each, all 8–15 within-block switch counts, complete-sequence rule/direction run caps, and at least five switch and five stay observations per rule-condition cell. All pass. Pairwise playable sequence distances across the 15 form pairs are **101–115 of 120**. This is ordering diversity only; the forms have not been calibrated as equivalent.

Every form contains 60 CENTER and 60 OUTER targets, 40 aligned/40 opposed/40 neutral conditions, 20 trials per rule-condition, 60 Left/60 Right answers and five 24-trial blocks. The original private JobTestPrep inventory records a 135-trial five-arrow/color-rule task; Assessment Practice uses its own text-and-shape cue, 120-trial mix and order constructor without a fidelity or employer-equivalence claim.

The packet still needs a **separate read-only specification and numerical audit** before freezing or coding. In particular, independently challenge timing boundary semantics, supported input classes, partial-attempt reconciliation, report denominators, accessibility disclosure, saved-result authority, form generation and the claimed limits. No founder personal review, Arrows implementation, qualification, deployment or release is claimed.
