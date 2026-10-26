# Arrows A1 — fixed form and stimulus foundation

**Stage:** headless Arrows V1.0 form admission and candidate-visible stimulus projection. This stage does **not** implement a timed run, event journal, scoring, browser interface, persistence, history, mock integration or qualification.

## Frozen authority

The agent-authored [V1.0 packet](../../specifications/ASSESSMENT_PRACTICE_ARROWS_SPECIFICATION_V1_0.md) and [six forms](../../specifications/ASSESSMENT_PRACTICE_ARROWS_FORMS_V1_0.json) were independently reviewed for implementation readiness at `5203b182da412ce286073a45242863fc9fc6d302` and bound in [FREEZE.md](FREEZE.md). Their file bytes and the constructor remain unchanged. No founder personal review of this packet is claimed.

## Work in this stage

- Load the committed forms, validate exact root/form/trial identities, per-block tuple balance, run/switch constraints, pairwise order distances and the frozen canonical SHA-256.
- Snapshot caller-provided data before the asynchronous digest and return deeply frozen form objects with a verified-form authority marker. Detached or edited objects cannot produce a stimulus.
- Project each verified trial to a five-symbol, text-and-shape cue and marked target positions without placing the answer direction, condition or future sequence in the candidate-facing projection.
- Add an explicit `arrows:check` command and include it in the repository check script.

## Developer checks

- Focused Arrows tests: **11 passed**, covering immutable admission, several tamper classes, all 720 stimulus mappings and pairwise distinctness.
- Full repository check: **1,126 tests across 56 files passed**; 14 Stop form checks, five Stop drill checks, Arrows canonical form regeneration, TypeScript and production build passed.
- Lint: passed with two inherited warnings in untouched files.
- `git diff --check`: passed. Frozen Arrows packet, JSON and constructor file hashes match [FREEZE.md](FREEZE.md).

The numerical audit's independent 720-trial regeneration is packet evidence, not a test of this new loader. This A1 implementation needs a separate read-only exact-SHA code audit. Browser timing, input, event replay, report integrity, storage, accessibility and device qualification remain later stages. No deployment or release is claimed.
