# Cards V1.1 playable candidate — developer verification

Base: `38709af5708bdfd84139ddc1cc5df82df90f5531`. This record covers the isolated implementation checkout; it is not an independent audit or qualification.

## Scope

The original six fixed forms drive four persistent decks and 80 untimed draws from a simulated $2,000 balance. The candidate includes a guide, example, comprehension check, ready/Next start, signed feedback without between-draw Next, a descriptive report, local history, replay and deletion. IndexedDB stores guarded journals and snapshots; Web Locks admit one playing tab. The frozen form/specification bytes were not edited.

## Developer evidence

- Focused Cards tests: eight passing. They cover all six form digests and all 24 single-deck arithmetic paths, 80-draw durable completion, missing feedback/terminal, changed duplicate requests, failed-write byte conservation, lifecycle closure, individual deletion, installation replacement and versioned report/history activity. The updated app/library test also passed all 13 cases.
- Full repository run before its library-count adjustment: 1,608 passing, one expected failure because the library had gained a seventh card. The affected app test was updated and its 13 tests passed. The full repository suite has not been rerun after that edit.
- Typecheck, lint and production build passed. Lint reported three warnings in inherited code. Existing Stop, Arrows, Lengths and Digits form checks passed; Cards packet generation was independently audited before this implementation.
- Production Chromium on the final isolated source build completed CD1 with 80 Deck A draws: $5,600 gains, $2,400 losses, $5,200 ending balance; the saved result reopened after reload with the same bytes and was withdrawn when another tab deleted all Cards data. An earlier intermediate build completed 80 Deck B draws: $7,200 gains, $8,800 losses, $400 ending balance. Both reconciled with the manifest.
- Production browser checks also observed keyboard Enter admission, an incomplete one-draw Exit, a second-tab owner rejection followed by successful ownership transfer, Delete all clearing local history and withdrawing a live run in another tab, and a four-deck board visible together at the normal desktop viewport.

## Boundaries still open

The final source build passed focused tests, typecheck and production-browser completion/reload/deletion. Delayed/undelivered transaction and callback injection, touch and assistive activation, native lifecycle, 320-pixel/200% zoom, physical devices and spoken screen-reader behavior are not certified by the bounded browser runs. An independent exact-SHA functional audit is required before a development PASS.

No full mock integration, analytics activation, push, deployment or release is claimed.
