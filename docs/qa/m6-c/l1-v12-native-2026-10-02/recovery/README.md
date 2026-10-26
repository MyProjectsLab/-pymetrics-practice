# Native recovery evidence — one journey

Read [RESULT.md](RESULT.md) for the outcome and boundaries. This packet extends the preceding `resumed` packet at clean QA HEAD `8f3c9736e8c34fedbc8c188fd0bfc310365820f1`. Product source is unchanged at `f6b8ae05ab024e603ebe3fc8e1a42f71dd4b14b1`.

## Method

1. Verify clean main and all 119 paths in IDENTITY.json against f6b8ae0. Build production output. Hash the bundle, CSS and original index.
2. Install `viewport-recorder.js` before the unchanged production bundle in ignored `dist/index.html`. The observer writes a separate QA localStorage key, `stop-v12-recovery-browser-events-v1`. It never changes product storage, rendering, event handlers, clocks or viewport values. It uses sparse two-second observation plus native lifecycle/resize capture. Its overhead is unmeasured.
3. Serve only on `127.0.0.1:5592`. Select **Google Chrome as a native app**, create a dedicated regular window, maximize via the native zoom action, dismiss the default-browser banner. Do not select/bind a browser tab via DevTools/CDP or an extension. The Chrome version page later showed the normal command line with no remote-debugging flags. No DevTools was opened.
4. Open the product in tab 1 and the read-only `recovery-export.html?case=before` in tab 2. Download the initial snapshot. This existing test origin retains earlier invalid drafts and verified understanding evidence; do not clear them or mistake them for this run. Skip introduction through the visible verified shortcut, read the reminder, confirm setup and run the native Space check.
5. Start live warm-up, switch to tab 2 using native Ctrl+Tab, return, observe restart required. The actual hide in this run was in the live initial fixation before warm-up trial 0. Select Restart warm-up and allow all eight trials to finish. Export the pause state from tab 2 using `?case=pause`, return and confirm the pause remains.
6. Select Start scored task and leave the maximized app tab active through all 80 trials. No scored responses were made. Capture the saved-completion UI, open its valid report, export with `?case=saved` in tab 2.
7. Return to tab 1, native Cmd+R, Stop history, Open original report. Capture the visible report and export with `?case=reloaded`. Capture the running Chrome identity, close only the dedicated window, stop the local preview and restore the original index.
8. Copy downloads unchanged into the packet, reconcile without importing product code, record hashes, and update QA/tracker only.

Native actions were dispatched through the app bridge. Browser `isTrusted` denotes browser-delivered events, not a human physical-keyboard calibration. There were no injected lifecycle controls in this journey. The window reduction before warm-up and the native restoration are retained in RESULT.md and raw viewport records.

## Reproduction tools

From the repository root after `npm run build`:

```sh
python3 docs/qa/m6-c/l1-v12-native-2026-10-02/recovery/install-probe.py install
npm run preview -- --host 127.0.0.1 --port 5592 --strictPort
```

After stopping the preview:

```sh
python3 docs/qa/m6-c/l1-v12-native-2026-10-02/recovery/install-probe.py restore
python3 docs/qa/m6-c/l1-v12-native-2026-10-02/recovery/reconcile.py
```

The exporter reads the `assessment-practice-stop` IndexedDB installation object in a readonly transaction, downloads a JSON Blob, and writes no product record. It makes no analytics/network upload. Its snapshot is loaded once; navigate to the new labeled URL for each capture. The original app document must stay alive until saved, because warm-up diagnostics are initially held in memory.

Screenshots and native accessibility text demonstrate visible state only. No DOM, rAF or screenshot timestamp is treated as physical display/input accuracy. No broader browser/device support row is certified.

The native accessibility dumps retain their captured bytes. `git diff --check` reports two trailing spaces in `reloaded-library.txt` (lines 57 and 62); these are intentionally preserved. The check passes for the remaining packet and tracker files.
