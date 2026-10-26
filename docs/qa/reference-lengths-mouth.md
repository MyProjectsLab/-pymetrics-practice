# Lengths Mouth visual reference record — 2026-10-09

Status: **gap recorded, not a completed visual-fidelity audit or approval to alter the frozen V1.1 packet**. The existing standalone development verdict remains scoped to its tested SHA. Original artwork and an independently reviewed versioned presentation revision are required for any material change.

Source locators and the evidence sampled for this record:

- Saved JobTestPrep gameplay recording: `private-research/Pymetric /Lengths /Lengths Game/lengts screen recording .mov`, especially 00:00 (instructions), 00:16 (scored face), 00:38 (fixation) and 02:23 (result). The source is outside this repository.
- Saved JobTestPrep instructions and result images in the same `Lengths Game` folder were checked. Additional guide images in `private-research/Pymetric /Lengths /Lengths Guide/` remain for the full visual inventory.
- Current implementation: `src/lengths-mouth/browser.ts` (`faceSvg`), `mouth.css`, `Journey.tsx`, and the frozen `ASSESSMENT_PRACTICE_LENGTHS_MOUTH_SPECIFICATION_V1_1.md`.
- [Harver's public pymetrics overview](https://harver.com/gamified-assessments/) describes game-based assessments but does not establish the current provider's exact Lengths artwork, dimensions or stimulus timing.

| Item | Saved JobTestPrep observation | Current V1.1 | Disposition |
|---|---|---|---|
| Scored presentation | One face at a time, separated by a blank/fixation display (recording 00:16, 00:38). The instructions show the two labeled faces together (00:00). | Scored faces are sequential; the untimed guide shows labeled examples together. | No established sequence mismatch. Do not mistake the guide comparison for scored play. |
| Face color and fill | Filled turquoise/green circular face; light eyes and mouth (00:16). Exact source color value is unmeasured. | Unfilled circle with dark outline, dark eyes and dark mouth on a light background. | **Open material visual mismatch.** Use original colored artwork after a versioned packet review; do not copy reference pixels or asset. |
| Face and feature size | Scored face is roughly 200 captured-video pixels across at the recorded viewport; two relatively large light circular eyes and a horizontal light mouth. This is an estimate, not a CSS measurement. | SVG is 240 CSS pixels; face circle diameter is 192 CSS pixels. Eyes are 16 CSS pixels in diameter; standard mouth lines are 44/60 CSS pixels. | Overall diameter may be close, but feature proportions differ visibly. Compare at equal viewport/zoom before choosing replacement dimensions. |
| Short/long difficulty | Mouth lengths appear very similar in the recording and are judged across separate scored flashes. Exact lengths and perceptual threshold are not established by the footage. | Standard lines are 22/30 SVG units; visual accommodation is 18/38. | **Open perceptual check.** Do not assume equal numerical difference means equal difficulty after changing fill and feature proportions. Keep any accommodation separately labeled. |
| Reward/result appearance | Running simulated money is visible during play; the saved result shows $7.60 and Short/Long category counts plus “Correct After Reward.” | Current fixed eligible rewards are 50¢ each; report fields differ. | Separate gameplay/report fidelity gap; one recorded result does not reveal the hidden reward schedule. No reward redesign authorized by this visual record. |

**Founder-reported first-person evidence:** Pietro reported that the real Pymetrics Lengths exercise felt almost identical to JobTestPrep's version: the short and long mouths were hard to distinguish and scored faces were not side by side. This is important experiential evidence for the target difficulty. It is not independent verification of exact provider colors, pixel dimensions, timings, reward odds or scoring.

Before changing the game, inspect every saved Lengths screenshot and the complete recording for distinct stimulus and feedback states; compare original candidate artwork at the same viewport; document measured/estimated dimensions and visible transitions; review a versioned presentation change independently; and test the resulting perceptual distinction with both labeled examples and sequential scored play. Preserve historical V1.1 result bytes and qualification limits.
