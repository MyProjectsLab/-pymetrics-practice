# Stop V1.2 native Chrome lifecycle boundary — preparation blocked

**Target product SHA:** clean `f6b8ae05ab024e603ebe3fc8e1a42f71dd4b14b1` on `main`. **Outcome:** the requested physical native cases were **not run**. This record is a preparation and environment-limit note, not browser/device qualification or a Stop V1.2 verdict.

## Exact preparation

- `npm run build` passed from the target SHA. Generated application JavaScript: `dist/assets/index-D8pj7mZZ.js`, SHA-256 `883608dd9dd37db873b013259c93995870ef2995959ebe46e4e560aad5ef3acd`; CSS: `dist/assets/index-BFu-PDJW.css`, SHA-256 `632bae8949a5d7ad0be3116fac1bbea5bb4e797dc9eedb8a92f480e2cd98b7c9`.
- Installed native Chrome app metadata reported `154.0.8037.95` / build `8037.95`; `sw_vers` reported macOS `26.6.2` build `25G83`; `system_profiler` identified a MacBook Pro `Mac17,2` with Apple M5. These are local application/OS/device metadata, not an observed active browser session. The earlier [physical L1 packet](../l1-physical-2026-10-02/RESULT.md) contains a user attestation of the built-in physical keyboard and a 60 Hz setting screenshot. Neither was freshly verified during this attempted run.
- The existing L1 event recorder and export helper were installed in ignored `dist` ahead of the unchanged production bundle. A loopback preview started at `127.0.0.1:5592`. No DevTools, CDP, browser debugger attachment, synthetic lifecycle event, or injected product control was used.
- Native computer inventory twice returned: “The Mac is locked and automatic unlock could not unlock it.” A request to unlock and perform the physical library tab-switch control produced no export during this turn. Therefore no browser event, ordered Stop journal, form exposure state, visible recovery screenshot, or raw record was obtained for this target SHA.
- The preview was stopped. The ignored probe files were removed and `dist/index.html` restored byte-for-byte to its pre-probe SHA-256 `cc294dfd86ea30ff845f452f0bc7d6e0ef2dbc2ed285d3ae2bcef03b185246c5`. The product bundle hash stayed unchanged.

| Required native case | Observation |
|---|---|
| Switch away during live warm-up; fresh eight-trial restart; no scored form consumption | Not run; no trusted browser event or Stop record. |
| Switch away at Warm-up complete; retain pause; fresh scored-entry checks | Not run; no trusted browser event or Stop record. |
| Switch away after accepted scored start but before confirmed onset; invalid draft and unconsumed form | Not run; no trusted browser event or Stop record. |
| Switch away after confirmed onset; retained presentation and consumed form | Not run; no trusted browser event or Stop record. |

The V1.2 addendum and deterministic developer checks specify these boundaries, but they are not substitutes for the requested native physical observations. The Chrome support row, physical timing accuracy, accessibility, M6-C, Stop completion, analytics activation, deployment and release remain open. Resume with an unlocked Mac, a fresh native Chrome control export, and separate raw captures for each case; if Chrome fails to deliver an event, retain and report that limit instead of certifying the row.

## Resumed after unlock

The subsequent [native resumption packet](resumed/RESULT.md), starting from QA commit `09f4bfa84379f9bceb48fba76b6ede382f808ada` and unchanged product `f6b8ae05ab024e603ebe3fc8e1a42f71dd4b14b1`, records a trusted library control and all four tab-hide boundaries. The original locked-Mac observation above remains historical. Cases 1/2 share an attempt; later viewport invalidation means completed valid native recovery remains open. Chrome, M6-C, deployment and release are not certified.
