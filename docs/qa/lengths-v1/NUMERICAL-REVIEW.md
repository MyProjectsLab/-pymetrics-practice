# Lengths V1.0 deterministic packet — author-side numerical review

**Date:** 2026-10-07. **Worktree:** `/private/tmp/lengths-v1-spec`, based on clean main `185a00ae81a199567a55dad327d0718a19e839ba`. **Status:** agent-authored draft under founder delegation. This review is author-side verification, **not** the required separate independent specification audit or packet freeze.

## Artifacts and exact identities

- `docs/specifications/ASSESSMENT_PRACTICE_LENGTHS_SPECIFICATION_V1_0.md`: original implementation contract; draft file SHA-256 `88a3938ce356b71115dd275fac057ca3f3adf27e824d88eb326cf87963040bd4`. No prior frozen game packet was edited.
- `docs/specifications/ASSESSMENT_PRACTICE_LENGTHS_FORMS_V1_0.json`: twelve fixed forms, six standard `LS1`–`LS6` and six separately labeled visual-accommodation `LA1`–`LA6`; compact payload SHA-256 `671b48c20e32daa886ce79e25a6265f4577a5dc069af8d5417328fd1ae0b39e7`.
- `docs/specifications/ASSESSMENT_PRACTICE_LENGTHS_FIXTURES_V1_0.json`: primitive action/timing scenarios and expected outcomes; compact payload SHA-256 `84d38be93fa2a53674c1eb2ca0cfa2c40228a9f37a9892e7f12a84ee1794488d`.
- `scripts/generate-lengths-forms.mjs`: deterministic specification-artifact constructor and byte-for-byte `--check` mode; it is not product/runtime code.

## Reproduction and independent arithmetic

`node scripts/generate-lengths-forms.mjs --check` matched both saved files byte-for-byte. A separate Python standard-library calculation, without importing the JavaScript constructor, recomputed both SHA-256 payload digests, reconstructed all six xorshift/Fisher–Yates categorical orders from the declared seeds, and matched every saved trial and candidate-attempt count: **24, 58, 24, 22, 35, 28**.

Each of the twelve forms has exactly 96 trials in four blocks of 24. In every block, all 24 `category × longer side × base length` tuples occur once: eight per gap category, twelve per longer side. Each complete form has 32 small/medium/large trials and 48 Left/Right correct-side opportunities. Every block has 8–16 internal side switches; no full-order run of the same side or gap category exceeds three. Both variants of a numbered form share exactly the same categorical order while using their separately recorded geometry. All bar lengths are within the 240-unit bay; standard maximum is 204, accommodation maximum is 200. Pairwise numbered-order positional differences were **91, 95, 90, 96, 93, 94, 93, 95, 93, 88, 92, 90, 91, 89, 91** out of 96, with minimum 88 and maximum 96.

The first LS1 trial is large-gap/Left-longer, 108 versus 156 units; the second is large-gap/Right-longer, 124 versus 172. Therefore the first-wrong/second-omitted fixture has 94 correct, one wrong, one omitted, and category correct counts small 32, medium 32, large 30. In the all-correct fixture, the balanced manifest yields 48 Left and 48 Right selections, 24 correct per block, 32 correct per gap category and 96 clean 200-ms times. For the five-time fixture `[100,200,300,400,500]`, median is 300 and variability is suppressed by the packet's eight-value threshold. For the eight-time fixture `[100,200,300,400,500,600,700,800]`, median is 450, Q1 250, Q3 650, IQR 400. Boundary fixtures distinguish response at 1,399 ms (eligible) from 1,400 ms (boundary extra/omission), note thresholds 50/51/250 ms and severe threshold 251 ms.

## Limits and next gate

The forms are order variations and accommodation changes geometry; no measured difficulty equivalence, psychometric calibration, employer fidelity or improvement inference is claimed. These checks validate deterministic construction and arithmetic, not browser presentation, human usability, real-device timing, accessibility, persistence or mock integration. A different reviewer must inspect the exact committed packet and fixtures read-only, challenge the mechanics/events/scoring/accessibility and independently verify the numbers before any code uses this packet. Only after a passing audit should its exact identity be frozen. Founder personal review, developer tests, code audit, qualification, deployment and release remain separate.
