# Balloons V1.0 specification freeze

Date: 2026-10-03. Started from clean HEAD `c43bc2b29e734041c3dec2cb7c355e41b4522d9d`. This is a documentation freeze of the founder-approved five-file working packet. The founder supplied the focused independent specification PASS and approved the exact source hashes below. This record does not claim a new independent audit of the frozen commit.

Source directory: `/Users/renzo/.codex/.chatgpt-projects/g-p-6ab94825dcd88191b8071a5ab3b98d24/`. Every source hash was verified before copying. The source files were left unchanged.

| Source file | Source SHA-256 | Frozen file under `docs/specifications/` | Frozen SHA-256 |
|---|---|---|---|
| `BALLOONS_SPECIFICATION_DRAFT.md` | `8b4a8145a74421590fcf75b5f92ce790cc10a395ea864618855b8e47f8d35692` | `ASSESSMENT_PRACTICE_BALLOONS_SPECIFICATION_V1_0.md` | `58ada52a7b25f2328f6ccd86026a55f6f2faa3dedcdbc7a9fdcd9680d06ce324` |
| `BALLOONS_FIXED_MANIFESTS_DRAFT.json` | `a207284cfb5332d5814a8e3d5e85a24114bbfe93f8d27b9b55f21d0a37d9dd70` | `ASSESSMENT_PRACTICE_BALLOONS_FIXED_MANIFESTS_V1_0.json` | `9b110c4a9ca7ad2d8c6e0cbe3afdc79803edeaa98a7095ebeb5fc69d3341b7e0` |
| `BALLOONS_FORM_REVIEW_DRAFT.md` | `f0d6fa48236d7a5e41d19613d0824154838e2c74f55beb0fe25daf02bc5f45a4` | `ASSESSMENT_PRACTICE_BALLOONS_FORM_REVIEW_V1_0.md` | `c6b551c256e18c3bbc1a69f1ad082e52f571c504a8fc0275ada2ef2023aea66b` |
| `BALLOONS_ROUTER_FIXTURES_DRAFT.json` | `fbd1727798831af0e761dd38edffb40fc27610622a2bede3b221e2806b136d30` | `ASSESSMENT_PRACTICE_BALLOONS_ROUTER_FIXTURES_V1_0.json` | `fbd1727798831af0e761dd38edffb40fc27610622a2bede3b221e2806b136d30` |
| `BALLOONS_ROUTER_FIXTURE_REVIEW_DRAFT.md` | `ffcef5aa6ae81c038a65bd5a3e370c3f2ae11ff226e9381ef50fdced599023cf` | `ASSESSMENT_PRACTICE_BALLOONS_ROUTER_FIXTURE_REVIEW_V1_0.md` | `ce4d777870a7c60c84ece8e989af30896942e7caad73c99a9c0a79c2a6b607be` |

## Non-substantive freeze changes

- Specification: changed draft/pending-review and proposed-status wording to V1.0 approval and focused PASS; accepted the exact fixed forms with the existing uncalibrated difficulty limitation; retained the separate implementation and qualification gates. Updated the four relative packet links to the frozen filenames. No mechanics, values, event/persistence rules, acceptance cases or claims changed.
- Fixed manifests JSON: changed only top-level `status` and `drawAlgorithm` description strings from working-packet to frozen-packet wording. Every manifest object and its embedded hash is unchanged.
- Form review: changed title and approval-status wording, including acceptance of the existing payout spread. All form/drill rows, hashes, amounts and comparison limits are unchanged.
- Router fixtures JSON: byte-identical copy; no fixture, expected value or policy changed.
- Fixture review: changed title and seven-fixture review-status wording. The fixture table, its source JSON hash and behavioral descriptions are unchanged.
- Tracker: added the Balloons freeze status and five-file links, changed its Stage 0 row to founder-approved for development, and reduced the remaining packet count from eleven to ten.

## Freeze checks

- Both frozen JSON files parse. The router fixtures JSON is byte-identical to its source. The fixed-manifest JSON differs only in the two top-level description strings; all manifest objects and embedded hashes match the source.
- All ten SHA-256 values in the register were recomputed and matched. The five source hashes still match after copying.
- All 47 local Markdown links checked in the tracker and new Markdown files resolve.
- Staged `git diff --check` passed before the local documentation commit.

Balloons implementation, developer checks, browser/device/accessibility qualification, deployment and release remain open. No game code, existing governing specification, source packet, push or deployment was changed by this freeze.
