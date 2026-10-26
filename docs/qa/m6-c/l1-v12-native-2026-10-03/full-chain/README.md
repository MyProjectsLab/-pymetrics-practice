# Native Chrome full-chain QA packet

Read [RESULT.md](RESULT.md) for the bounded finding, [IDENTITY.json](IDENTITY.json) for source/build/browser/OS/display identity, [VISIBLE-SCREENS.md](VISIBLE-SCREENS.md) for observed UI, [RECONCILIATION.json](RECONCILIATION.json) for independently computed values, and [EVIDENCE-SHA256.json](EVIDENCE-SHA256.json) for file digests.

## Capture method

1. Started from clean `70c7286f0d8059b352d9a1ab9baecd476945fc92` on `main`. The product files were unchanged from `f6b8ae05ab024e603ebe3fc8e1a42f71dd4b14b1`. `npm run build` passed.
2. Reused the earlier read-only QA observer and exporter by inserting the observer before the unchanged bundle in ignored `dist/index.html`. The original index was backed up. The observer wrote only the QA `stop-v12-recovery-browser-events-v1` localStorage key. The exporter read the `assessment-practice-stop` IndexedDB installation object in a readonly transaction and downloaded JSON; it wrote no product data.
3. Served the production build on loopback `127.0.0.1:5593`. Used a dedicated native Google Chrome window through the macOS app accessibility bridge, with no DevTools/CDP attachment. The initial origin snapshot was empty: no results, drafts, chains, exposures, or reservations. The window remained 1512 × 827 CSS pixels during all three timed runs.
4. Completed the full first-time preparation, a valid 8+80 baseline, the assigned three-block detection drill, a reserved unexposed retest with returning-user reminder and full current-session setup, a valid 8+80 retest, comparison, history, native `Cmd+R` reload, reopened history, and resumed comparison.
5. Downloaded snapshots at `before`, `pause`, `baseline`, `drill`, `reserved`, `retest`, `pre-reload`, and `reloaded`. Files with those names are the unedited browser exports, stored as deterministic gzip without changing their decompressed bytes. The hash manifest records both compressed and original JSON hashes. The extracted individual journals and records are byte-equivalent JSON values from the `reloaded` snapshot.
6. Ran `python3 docs/qa/m6-c/l1-v12-native-2026-10-03/full-chain/reconcile.py`. It imports only Python standard-library modules, not product code. It checks event order, sequence/form linkage, counts, rates, quartiles, four report blocks, drill blocks, assignment, reservation, exposures, chain identity, visible-viewport samples, comparison arithmetic, and exact pre/post-reload installation equality.

The input-check checkbox is a product self-declaration. Scored input in this run was dispatched through the native app bridge. A browser `isTrusted` event cannot distinguish bridge input from a person pressing the hardware keyboard. No physical input latency, display scanout, or refresh rate was measured. The QA observer's overhead was not calibrated.

No attempt in this new journey became invalid. Raw snapshots include the empty draft sets and all completed journals. Earlier invalid attempts from other origins/runs remain in their own packets and were not cleared or used in this journey.
