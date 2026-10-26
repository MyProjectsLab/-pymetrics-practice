# F4-R11 publication failure repair

Parent: `b083eebaba5cbff6bf39565db7200cfa46179753`. The independent FAIL and raw reproduction are at `/private/tmp/arrows-r8-r10-independent/AUDIT.md`.

The failure was reproduced on the parent before editing: a history report remained visibly Saved with its 120-trial table after a post-render marker rejection, and no retry action remained. The report publication gate now delivers a synchronous publication failure to its original withdrawal callback even if rendering starts a newer background check. Canceled reads that have not begun publication retain the existing stale-callback fence. Both history entry and recovery callbacks clear selected data, saved copy and visible numbers on failure; the captured report session keeps the retry action available.

Verification on this candidate:

- Seven focused test files: **85 passed**. The copied independent history/live reproduction now passes, with an added initial-history-opening case and a direct reentrant gate test.
- TypeScript app check and production Vite build passed. Lint passed with two inherited warnings outside Arrows.
- Five final-bundle Chromium scenarios passed: rejected history publication and retry; rejected live publication and retry; failed Delete all followed by integrity recovery; 24-trial break recovery with one durable report-view event; obsolete canceled write while a new run owns the UI. Each paired DOM state with native IndexedDB and checked page errors. Raw captures and drivers are in `/private/tmp/arrows-r11-browser/` and `/private/tmp/arrows-r11-*.mjs`.
- Production JS SHA-256: `db2ab3c3a3234ad3d9772741f59c0da357e9ce65879ea21f0b13d69bc428e8b3` (`dist/assets/index-CMirb-f3.js`). Frozen specifications and forms were not changed.

These are developer checks with controlled faults and automated input. They do not certify natural lifecycle delivery, physical timing, device or accessibility behavior. A separate read-only exact-SHA functional audit is required before integration or any acceptance claim.
