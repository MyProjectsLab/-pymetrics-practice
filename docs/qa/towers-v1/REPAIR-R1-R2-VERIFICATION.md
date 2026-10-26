# Towers V1.0 grouped R1–R2 repair — developer verification

Parent product: main `eb28700734340e649e45b3a282b841e438d88dea` (content-equivalent isolated parent `95a8869062b896f513fde724f9303f0b404361c2`). Independent failure: `/private/tmp/towers-v1-repair-independent/AUDIT-eb28700.md`. This is a second grouped developer submission, not an independent PASS or environment qualification.

Both findings were reproduced against the parent production bundle before editing, using copies of the independent scripts under `/private/tmp/towers-v1-repair2/`:

- Held committed nonfinal move, then pagehide at 120000 and 120001 ms: both produced a fabricated 119999 ms interruption. A predeadline 2000 ms control and late-delivered 119999 ms solved move behaved correctly.
- After a 320 px onset, resizing to 64 px left a 34 px board active and accepted a trusted keyboard move.

The repair retains the real lifecycle/display invalidation time. After the pending move settles, a predeadline invalidation appends `interrupted`; a tie or later invalidation appends `expired(120000)`. A timely target-matching placement remains solved if its callback arrives later. A shared display predicate checks the onset, active timer, scored inputs, retry and exit. A 64 px viewport interrupts rather than continuing scored play; restoration does not resume the attempt. If the board is invalid before onset, its unseen reservation is canceled.

Bounded production-browser results after repair:

| Case | Durable and visible result |
| --- | --- |
| Held nonfinal move + pagehide at 2000 | `interrupted(2000)`, board withdrawn |
| Held nonfinal move + pagehide at 120000 or 120001 | `expired(120000)`, timeout review; no invented predeadline interruption |
| Held final move captured at 119999 + pagehide at 120001 | `solved(119999)` wins |
| Held nonfinal callback beyond the 2500 ms watchdog + deadline pagehide + same-request retry | One move followed by `expired(120000)`; Time is up screen, no duplicate |
| Resize active 320 px board to 64 px and restore | Durable `interrupted`, board withdrawn, no scored resume |
| Resize during a committed held move, then restore and release | Move followed by `interrupted`; board withdrawn |
| Start directly at invalid 64 px width | No retained run or scored onset; reservation tombstoned |

The original six repair findings remained closed in the prior independent reaudit. Frozen forms, fixtures, specification and source reference are unchanged. These browser probes use controlled clocks and viewport/lifecycle injection, not physical timing, touch or screen-reader qualification.
