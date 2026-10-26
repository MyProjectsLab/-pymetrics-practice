# Lengths Mouth V1.1 exact-byte freeze

This agent-authored packet was reviewed read-only at `ad8e632f79f987d7b861c9f802a2bfb4439a82ff` and, after grouped clarification of F1–F3, at `2f9ea397fdb9d8ec4b625d89f24d07fad94095db`. The [focused re-audit](/private/tmp/lengths-v11-spec-audit/REAUDIT-2f9ea39.md) passed implementation-specification readiness at the latter SHA. The authoring-time word “candidate” in retained QA files does not alter this frozen identity. This packet was authored under the founder's full-product delegation; it was not personally reviewed by the founder.

| Frozen file | SHA-256 |
|---|---|
| `docs/specifications/ASSESSMENT_PRACTICE_LENGTHS_MOUTH_SPECIFICATION_V1_1.md` | `7681ae69b3e1fa2afaf760dceaa05644e7d030a44a615fc4a52e67d1d4eee7ca` |
| `docs/specifications/ASSESSMENT_PRACTICE_LENGTHS_MOUTH_FORMS_V1_1.json` | `1718fd76608130a2d2939e40dfb9133ad2dfa1c5efab22de46f2876770c5ed7b` |
| `docs/specifications/ASSESSMENT_PRACTICE_LENGTHS_MOUTH_FIXTURES_V1_1.json` | `bf831a32d43fbdb9b22da90ed36031f8470af4842120a7c08ab8276fda2ded5e` |
| `scripts/generate-lengths-mouth-forms.mjs` | `0d2bd426643e30415b2b4143e28a44a63379ac02b0e9173a456b83a85df34f76` |
| `scripts/check-lengths-mouth-forms.mjs` | `5a6c6192891b3d75b17c5e72e96946ca90127c90eff548f8bbd697cdde8d3dda` |
| `docs/qa/lengths-v11/PACKET_CANDIDATE.md` | `e1749c0f7586fd6d6226375357c9452bf7216e872b4104ae0928726a3806b07d` |
| `docs/qa/lengths-v11/SPEC_REPAIR_F1_F3.md` | `87749cf28ef6d0ee5cb945c4a5ae7b2e0bca43cbf0f308b9ea7dcb8988ba5271` |

The compact JSON payload SHA-256 values are `ae92d69cffeb20cac02d3be5648ee8e162e575583c55b03dfe3cd2301c0846e9` for the six forms and `5f5656bc35cff5b776075968b88ab369a4820af8233c741801044d42f28b50a8` for the 19 fixtures. The checker pins both. The independent reviewer regenerated the forms and derived the fixture expectations; the checker alone verifies identity and structure, not application behavior.

V1.0 Lengths remains a separate frozen bar-comparison version with separate historical results. Implement V1.1 in a separate module and storage schema; do not reinterpret V1.0 results or compare versions. A substantive change to this packet requires a new version and independent review. This freeze establishes specification readiness only. Product implementation, independent code audit, founder personal acceptance, browser/device/accessibility qualification, mock integration, deployment and release remain open.
