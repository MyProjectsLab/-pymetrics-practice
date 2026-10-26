# Arrows A2 — headless timed engine

**Stage:** pure, headless five-block timing/input transition engine on the frozen Arrows V1.0 form authority. No React display, IndexedDB, candidate report, history, mock or device qualification is implemented by this stage.

The separate [A1 audit](/private/tmp/arrows-a1-audit-b19f60b-MjYlD2/AUDIT.md) PASSED only fixed-form admission and stimulus projection at `b19f60b7359886b58e1246a4ec8fc2cfaab98f2d`. A2 starts from that clean parent. Existing frozen Arrows packet/form/constructor bytes are unchanged.

## Engine contract

- `armHeadless` accepts only a verified fixed form, versioned identity and frozen input profile. Its `headless_unconfirmed` label explicitly does not claim durable arming or real DOM exposure.
- Pure `advance` processes actual timestamp commands for block start, confirmed fixation/onset, selected response/release, deadline resolution, confirmed offset, frame gap, watchdog and invalidation. It never awaits storage or a browser callback.
- Each block starts with an 800-ms first fixation; later trials use 700 ms. A trial remains visible through the onset+1,500-ms deadline. Offset lateness is measured from that original deadline. The engine retains a confirmed presentation before immediate severe invalidation.
- A >50–250-ms stage/frame deviation marks the affected trial's time; >250 ms invalidates. A missing required frame can trigger the due+2,000-ms watchdog. Selected keys/pointers must release before a new response; boundary actions cannot replace the first response.
- `verifyHeadless` replays commands and compares the immutable journal/state. This is an internal headless consistency check, not proof that browser frames or storage writes happened.

## Developer evidence and open limits

Focused tests cover a complete **120-trial/5-block** command/event journey, severe and mild timing boundaries, offset anchoring, watchdog gating, held/repeated/extra/boundary input, pointer release and multiple pointers, untimed break, status and journal-tamper rejection. Ten A2 tests passed. The full `npm run check` passed: **1,136 tests in 57 files**, lint with two inherited warnings, 14 Stop form checks, five Stop drill checks, six Arrows form regeneration checks and production build. TypeScript passed. `git diff --check` and frozen-file hash verification are required at commit handoff.

The browser adapter must independently confirm connected visible frames and supply handler-observed monotonic times. Durable start, authoritative readback, checkpoint, terminal save, report reconciliation, UI semantics and browser/device/accessibility qualification remain later stages. A pure command trace cannot certify physical timing or native lifecycle delivery. No full-game, founder personal acceptance, deployment or release claim is made.
