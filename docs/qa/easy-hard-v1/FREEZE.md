# Easy or Hard V1.0 exact-byte packet freeze

The agent-authored packet passed separate read-only gameplay-fidelity, numerical and implementation-specification review on 2026-10-09. The [audit](/private/tmp/easy-hard-v1-postfix-audit.md) inspected these exact bytes. The authoring-time `DRAFT` names and pre-freeze status line are retained to preserve the audited bytes; this record freezes their identity for implementation. The founder has not personally accepted this specific packet.

| Frozen file | SHA-256 |
|---|---|
| `docs/specifications/ASSESSMENT_PRACTICE_EASY_HARD_SPECIFICATION_V1_0_DRAFT.md` | `6d100e6450aa64815feaa218bcf90ef721f3013b5d10abf59928108c3033a99e` |
| `docs/specifications/ASSESSMENT_PRACTICE_EASY_HARD_FORMS_V1_0_DRAFT.json` | `3c7dc22089651eaa14d91999405f03533a1b44c4eec2590b10cafb1b05a7d2cf` |
| `docs/specifications/ASSESSMENT_PRACTICE_EASY_HARD_FIXTURES_V1_0_DRAFT.json` | `25c8022f02f0e5780e37669494e25e4b4a280c9a3df592ec1b60af520b75b22f` |
| `docs/specifications/generate_easy_hard_v1.py` | `ee12a27822fa122d2fbc4696ab21307a4d93979a89844028e316b3e21b35085f` |
| `docs/specifications/easy-hard-reference-start-2026-10-09.md` | `ab46d1a6908155566460acc7472ef6376f4ccbf65bf5782d6e96c02848bea8dd` |

The generator is retained as a reviewed source artifact; it writes to `/private/tmp` by design, so do not run it as an in-repository update command. The four forms and acceptance fixtures are immutable for V1.0. A substantive change requires a new version and independent review. This freezes the packet only; implementation, code audit, founder acceptance, device/accessibility qualification, mock integration, deployment and release remain open.
