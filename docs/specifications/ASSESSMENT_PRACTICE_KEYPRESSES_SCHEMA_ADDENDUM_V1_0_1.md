# Keypresses V1.0.1 schema and admission addendum

**Status:** agent-authored under the founder's full-product delegation. This addendum preserves the V1.0 task mechanics and all recorded numerical boundaries. It resolves the independent headless audit findings at `2c8fec902191bb6a396f4804f8393108883c5767`. The original V1.0 packet remains unchanged; this addendum and that packet together govern implementation.

## Recorded identifiers

Every armed run records these exact identifiers in its immutable state, and replay checks them before producing a report:

| Meaning | Identifier |
|---|---|
| Specification plus this addendum | `keypresses_spec_v1_0_1` |
| Scoring and report interpretation | `keypresses_scoring_v1_0_1` |
| Event schema | `keypresses_event_v1` |
| Self-declared input-profile contract | `keypresses_input_profile_v1` |
| Eight-delay presentation plan | `keypresses_presentation_plan_v1` |

An absent or unsupported identifier is not upgraded silently to the current version. Historical records require their recorded semantics or remain review-only.

## Admission clarifications

- The selected physical key code is `Space` or an unmodified printable letter, digit, or punctuation code in the supported input-check set. Modifier, navigation, function, and shortcut keys are rejected at setup and headless arming. Alternative or unknown **input method** is still permitted with its separate label; that profile does not permit an unsafe key binding.
- A decoded command must have a recognized kind, exactly its required fields with the correct runtime types, an allowed reason where applicable, and nondecreasing command timestamps. Unknown or malformed commands cannot disappear during replay. Event timestamps remain ordered separately.
- Reaching 40 accepted presses before the deadline is an observed fact even if a later visibility or technical event invalidates completion. Report `targetReached` and observed `targetTimeMs` consistently; session validity remains a separate status and invalid results never become valid progress or training evidence.

This addendum does not approve physical timing accuracy, a browser/device support row, persistence, mock integration, or release claims.
