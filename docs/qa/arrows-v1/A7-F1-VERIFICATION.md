# Arrows A7 F1 — first-snapshot provenance repair

**Parent:** `34285d99d9d2eaa55ae949a4d962e428a08269ea`. The [independent A7 audit](/private/tmp/arrows-a7-audit-34285d9/AUDIT.md) found that a replay-valid first checkpoint with a changed arm time or canonical form was committed before readback rejected it, making the installation unreadable.

`saveSnapshot` now compares every proposed snapshot with the retained arm's exact form, arm time and initial journal prefix **inside the authoritative write transaction**, including the first snapshot. It also validates the resulting root before the transaction can commit. The prior checkpoint append and terminal immutability checks remain.

Four new focused cases cover a changed arm time or form in either a first checkpoint or a first terminal write. Each rejects while raw durable bytes remain unchanged, and the correct retry then succeeds. The independent browser reproducer was rerun on the repair using real IndexedDB: the changed-time case kept root revision **1**, allowed reopening and a correct retry; the changed-form case kept AR1 and allowed reopening. Other reproduced storage cases continued to pass. Its repaired result is at `/private/tmp/arrows-a7-f1-dev/results.json`. Arrows tests **55/55**, lint with two inherited warnings, frozen form check and production build passed.

**Audit-artifact correction:** the copied reproducer retained a hard-coded output path and accidentally overwrote the prior audit's external `results.json` during the repair rerun. I then reran that same reproducer against an exact `34285d9` Git archive and replaced the affected file with the reconstructed original-SHA failure evidence. The original raw bytes were not recoverable; the audit report itself and repository were untouched. The reconstruction and its log are retained at `/private/tmp/arrows-a7-original-replay/`. The separate auditor must treat that external result as a reconstruction, not the original capture.

This repair is developer-verified only. A new exact-SHA read-only audit is required. A7 remains a storage API foundation, without live-browser checkpoint integration or a candidate-facing saved report.
