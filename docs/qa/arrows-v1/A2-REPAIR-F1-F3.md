# Arrows A2 focused F1–F3 repair

**Parent independent audit:** [FAIL at `6bcae18eb4377b4fdbecbea55958942f50c8c142`](/private/tmp/arrows-a2-audit-6bcae18-tbag68fv/AUDIT.md). This repair is implemented and developer-tested only; a changed exact SHA needs a separate read-only audit. A1's scoped PASS remains attached to its own unchanged parent.

The audit's `defects.mjs` and `additional.mjs` reproduced all three findings before editing: an array-valued binding completed a verified 120-trial trace, a late unsupported command verified against unchanged events, and a severe resolution lacked its measured stage event.

## Changes

- F1: enforce primitive nonempty identity strings, primitive distinct allowlisted key strings and an exact profile shape before arming. Pointer profiles receive the same exact-field and primitive-source checks.
- F2: validate every command kind, exact payload fields and runtime primitive values before any late-deadline shortcut or journal append. The shortcut now applies only to late input/frame-gap observations; stage commands retain their own phase and timing validation.
- F3: a severely late `resolve` now passes through the common stage observation path. The journal records `deadline_resolved` with original due time, actual handler time and lateness **before** `invalidated`; it records no omission, offset or closure.

## Developer checks and limits

- **13/13 focused A2 tests passed**, including three new adversarial regression cases; the unchanged 11 A1 tests passed at the parent SHA and are not counted as new repair evidence.
- TypeScript, lint, Arrows form regeneration and production build passed. Lint retains two inherited warnings in untouched files. The prior full 1,136-test repository check belongs to the A2 parent; it was not repeated for this focused repair.
- Frozen Arrows specification, six-form JSON and constructor hashes remain those in [FREEZE.md](FREEZE.md). `git diff --check` must pass at commit handoff.

No browser adapter, durable arming, result report, history, device qualification, founder personal acceptance, deployment or release is claimed. Headless events remain `headless_unconfirmed`.
