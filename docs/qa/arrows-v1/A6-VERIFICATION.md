# Arrows A6 — browser-confirmed timing adapter

**Base:** `bc073f39b1ae7194fd76ec01ae37be16d026f7f7`, whose focused A5 F1 repair independently passed. A6 is a developer-tested browser adapter, not a candidate-facing Arrows game or a saved result.

## Implemented

- `ArrowsBrowserRun` accepts an A5 durable arm and retains a synchronous immutable headless journal. It writes fixation, the visible cue/five symbols, and removal to DOM, then confirms each in an animation-frame callback using `performance.now()`. Stage timers use due times, not event timestamps; the 2,000-ms display watchdog runs independently.
- Selected keyboard and pointer actions are handed to the existing engine without awaiting storage. Held/repeat keys, selected-key scrolling, primary pointer source, first-response precedence and click non-duplication use the frozen profile. The response bindings remain available for setup; unrelated raw key codes are not journaled.
- Foreground frame gaps, hiding, blur, freeze, page exit, viewport/occlusion failure, settings change and technical callbacks invalidate the protected block. Timers and late frames are fenced on cancellation; the Web Lock releases on invalidation or completion. An actual late stimulus confirmed in the same frame as a severe gap records onset before invalidation. Untimed breaks stop protection but retain ownership until continuation or exit.
- Continue at an untimed break rereads the original arm under the retained owner and rejects changed installation/session evidence. A missing or replaced arm invalidates with ownership loss; a transient read failure withholds Continue so it can be retried. Canceled reads cannot revive a stopped controller.
- A selected key released after the last trial's confirmed offset is recorded at the untimed break, clearing headless held state before Continue. A canceled break closes this controller, so it cannot later continue without ownership.
- The symbol row is hidden from accessibility speech and the cue has a concise status role. Native screen-reader behavior was not measured.

## Checks and retained evidence

- **45 Arrows tests across six files passed** (including continuation authority and a 24-trial held-key release at break); TypeScript, lint, production build, frozen-form regeneration and diff hygiene passed. Lint retains two inherited warnings in untouched files. The three frozen Arrows SHA-256 values still match [FREEZE.md](FREEZE.md).
- [Bounded Chromium harness](A6-browser.mjs) and [raw results](A6-browser.json): **six scenarios passed** on headless Chromium `145.0.7632.6`. They cover a confirmed visible first onset, selected key response and actual offset followed by blur; a key held across onset requiring release/new press; withheld initial frames and a single watchdog invalidation with late callbacks fenced; primary mouse pointer response with no duplicate click and later extra action; a severe late frame that retains confirmed onset; and an injected rendering callback failure that retains onset, invalidates and releases ownership.
- The late-onset probe initially observed the lock before its release microtask settled. The harness now waits for bounded lock release; the product result did not change. Input, frame delays and browser faults in this packet are scripted/injected, not physical hardware observations.

## Explicit limits and next work

The browser harness directly imports source modules; the adapter is **not yet wired into the library, guide, comprehension, setup or report UI**. It has no durable between-block checkpoint, invalidation/completion write, deletion/history integration or `report_viewed` activity. The current armed-record read is a break-time check; future deletion must coordinate its transaction with continuation/first presentation. No 120-trial production journey, native lifecycle/device timing, screen-reader speech, zoom support matrix, founder personal acceptance, deployment or release is claimed. A future stage must also verify the full five-block browser journey, break continuation and saved evidence before whole-game acceptance.

A separate read-only exact-SHA audit should challenge frame confirmation and withholding, actual-onset retention under severe timing, selected-input boundaries, lifecycle cancellation, ownership release, viewport admission, untimed breaks and any unsupported completion claim. Preserve all evidence outside the repository during audit.
