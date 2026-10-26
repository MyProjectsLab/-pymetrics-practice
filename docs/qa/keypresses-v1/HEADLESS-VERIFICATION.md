# Keypresses V1.0 headless foundation

## Authority and packet identity

The founder delegated the full product delivery workflow on 2026-10-05. Repository `AGENTS.md` records that delegation at commit `c357901`. The working Keypresses packet was created from the private reference inventory and original implementation choices, then copied into `docs/specifications/` with status and approval-boundary wording adjusted for the delegated workflow. The founder did not individually review each Keypresses rule. The packet is an agent-authored implementation contract, not a calibrated competitor replica.

| Artifact | SHA-256 |
|---|---|
| Working packet `KEYPRESSES_SPECIFICATION_DRAFT.md` in the Assessment Practice ChatGPT project mirror | `f5d6d1a12c38588372ebd266968aeef000b1c9f8c862fbcefda8afdab1ecdc30` |
| Frozen repository packet `ASSESSMENT_PRACTICE_KEYPRESSES_SPECIFICATION_V1_0.md` | `47ededa969ed46c56c21abf976ff54c65d4f8d4b975257db712723d85c4b4749` |

The versioned packet covers purpose, original mechanics, delay and press boundaries, input profiles, events, reports, persistence expectations, accessibility and acceptance cases. Its 40-press/15-second target and eight pre-GO delays are product choices, not known JobTestPrep or Pymetrics parameters. No Stop or Balloons frozen packet changed.

## Implemented in this milestone

- A pure, immutable, versioned Keypresses state machine with the eight recorded delay choices, confirmed GO/END boundaries, 40 accepted keydowns, a 15-second scored window, a 1-second late observation and protected invalidation.
- Keydown-cycle admission distinguishes early, accepted, boundary, late, held and autorepeated input. Commands and ordered events are retained separately. Journal verification reconstructs the complete state from primitive commands before report generation.
- A descriptive report derives accepted count, first and target times, repetition rate, interval median/IQR and distinct early/boundary/late counts from the verified journal. Sparse data suppresses unsupported metrics.

## Checks and limits

Focused Vitest: **7/7 passed**. `npm run typecheck`: **passed**. Full `npm run check`: **1,106/1,106 tests across 54 files**, lint with two inherited warnings, 14 Stop form checks, five Stop drill checks, TypeScript and production builds passed. `npm run balloons:check` passed all nine scored-form and seven drill-inventory validations. A binding-tamper case initially failed because the armed event did not carry the selected binding; the setup is now included in that event, and the case passes. Tests cover all delay indices, GO/deadline/END boundaries, 40 presses, late input, held/repeat suppression, delayed callbacks, event ordering and altered snapshots.

This is **headless only**. It does not present browser pixels, connect DOM keyboard events, persist completed results, provide the candidate journey/history, integrate the mock, or establish physical timing or device/accessibility qualification. A later production-browser milestone must check actual GO/END presentation and native input semantics. An independent exact-SHA audit is required before this milestone receives an independent PASS. Founder personal acceptance, deployment and release are separate.
