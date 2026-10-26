# Arrows A12 F1/F2 focused developer repair

## Identity and status

The independent whole-game audit **FAILED** at `0b9b1e1b82ab0d0b6982ebac3063362f7e3730d1` on F1 and F2. Its read-only report is `/private/tmp/arrows-whole-audit-0b9b1e1/AUDIT.md`. This repair starts from that clean SHA and is confined to the candidate journey, its component regressions, and this QA/status record. The frozen Arrows specification, form inventory, and freeze record remain unchanged (SHA-256: `ae7360d4b81d28b23c12e265e0707934f6659fdf183c65ddac782745ad305836`, `a87abdaa25fbddd9b08b49e97fa0fa2fbc25e2c4bf32bc59be7dca6b46cfef3f`, `316cbc07f43014b0f2bfac712693323ea61ebfd6c50a03a14a9ae8c1192a2254`). This is developer verification; a new exact-SHA independent audit is required.

## Reproduction before repair

- A focused component/storage fault committed AR1, rejected its confirmation read, then pressed Start again. The unchanged journey generated a second request/session/clock identity and committed AR2. The new regression failed because the two Start requests differed.
- A saved Invalid journal containing an observed trial-1 Left response was opened from history. The expanded event review rendered `response · trial 1 · 1100.0 ms` with no direction. The new assertion requiring Left failed.

## Repair

- The readiness journey retains the exact Start request when admission/arm confirmation is unresolved, and retries it with the same request, session, clock, profile and timestamps. It clears that request after an accepted or deliberately retired start, Replay, Delete all, or exit. The readiness button then says “Verify or retry same Start” and explains that a form may already be reserved. Reviewing or changing setup is distinct: a changed input profile presents “Start with changed setup” and warns that a new request may use the next form. The failure copy says Start could not be confirmed and does not claim a form or begin timing.
- Invalid/Incomplete event review now renders observed Left/Right and source for response events, including extras, without classifying an unresolved trial as correct or wrong.
- The report also displays the fixed-form inventory version, one decimal place on percentages, and an explicit plus sign on positive time contrasts, as the frozen report contract requires.

## Checks and limits

- The new readback-fault regression passed: the retry used the identical request and retained AR1 with arm count 1. A changed-profile regression required a different request. The partial-response and report-format regressions passed.
- Affected Arrows and app tests: 8 files, 128 tests passed. Arrows fixed-form regeneration passed with canonical digest `228b0e10405a80830c73e4b69e12950482967dec717f156c789e19fa11b1150b`.
- App, node and analytics TypeScript configurations passed. The ordinary `tsc -b` command could not write incremental cache files because this isolated worktree links `node_modules` to a read-only external directory; each configuration was checked with its build-info file redirected to `/private/tmp`. Lint passed with two inherited warnings in untouched files. The production client and analytics bundles built; the client retains the existing large-chunk advisory. `git diff --check` passed.
- The new fault test uses a controlled in-memory backend and a mocked browser entry point. The independent audit's parent production-browser reproduction remains evidence for the original defect; this repair has not yet received a new independent production-browser audit. Native physical timing, device/accessibility qualification, founder acceptance, full mock, deployment and release remain open. The A11 indefinitely withheld deletion-delivery observation remains open.
