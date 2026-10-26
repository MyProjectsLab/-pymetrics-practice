# Balloons Q1 and N1 focused developer repair

Date: 2026-10-05. Base: clean `b71783abdcae163424e2e057150eb949a33586f2` (parent `8e4d754b8253356c1a3006d842abc3f5244227ea`). Local implementation and developer verification only; hand off the resulting commit SHA for a **separate read-only audit**. This record grants neither independent PASS nor founder acceptance nor B3 qualification.

Read AGENTS.md, the complete master strategy, Balloons V1.0 specification and companion reviews, parsed both complete JSON companions, checked all five frozen packet hashes against the freeze register, and read the tracker before product edits. Read the supplied [B3 report](/Users/renzo/.codex/visualizations/2026/10/05/01a10a25-db63-7f20-9840-e147fa98ccc8/balloons-b3-b71783a/RESULT.md) and [acceptance map](/Users/renzo/.codex/visualizations/2026/10/05/01a10a25-db63-7f20-9840-e147fa98ccc8/balloons-b3-b71783a/ACCEPTANCE-MAP.md). Their exact bytes are retained in the evidence archive. The report records B2-C2 founder acceptance at the base within its independent audit scope; it does not accept this repair.

## Reproduction before product edits

A fresh build of the clean base was served on `http://127.0.0.1:4256`. Disposable browser contexts used isolated IndexedDB roots; no real candidate data were deleted.

- **Q1:** the supplied access driver reproduced BODY focus twice after individual deletion with one remaining record and twice after Delete all. The data changed correctly. New coverage also observed the same lack of restored focus/outcome status after Space and Enter for individual remaining/empty history, Delete all, and injected failed individual/all deletion. The latter ten cases used the same unchanged base build. The first four supplied-driver reproductions and all 16 N1 reproductions finished before product edits; the extended Q1 base-build checks ran while edits were being prepared, before rebuilding.
- **N1:** **16/16** supplied injected cases failed replacement-byte invariance: assignment/arm/confirm/action delivery × individual/Delete all × deletion-first/delivery-first. Old transaction callbacks preserved the full replacement root; old application notifications then paused confirmed RP1 and cleared its view. No harness errors occurred in this matrix. **8/8** native/absent-notification controls passed on the base.
- Original source identity: archive `initial.json`; original build log: `pre/build.log`; original N1 matrix: `pre/n1/notification-results.json`; controls: `pre/n1-controls/notification-results.json`; original Q1 captures: `pre/delete-focus-*.{json,png,ax.txt}`. Extended Q1 base results: `pre/focus-results.json`.

## Focused implementation

`src/balloons/Journey.tsx`:

- A deletion captures the mounted history heading. A one-use focus request is fulfilled only after replacement history has rendered, including empty history and the replacement installation after Delete all. It is discarded if that heading has unmounted. Subsequent background history reads do not steal focus.
- A mounted atomic status region retains the deletion outcome. Failed/uncertain completion says deletion could not be confirmed, then asks the candidate to check saved history. It does not assert that a timed-out transaction necessarily failed. Failed deletion refreshes history so its controls and orientation can recover.
- A notification registration captures its controller and is scoped by store/installation, step, comparison, and controller replacement. Cleanup invalidates the closure before closing the channel. Delivery checks both its lifetime and current controller identity before touching any state. Pending deletion IDs belong to the same registration, preventing an abandoned begin notice from blocking later polling.
- Creating a controller publishes that identity for subscription renewal even when resume/replacement stays on the same `run` step. A current registration still withdraws immediately on begin; durable authority checks, mutation gates and controller write fences are unchanged.

`src/balloons/TrainingJourney.tsx`: its separate notification handler has an explicit cleanup lifetime and is scoped to the installation and baseline. A held handler after leaving that exercise cannot operate a replacement journey.

No storage transaction, schema, exposure rule, ownership mechanism, controller persistence fence, mechanics, forms, scoring, routing, comparison formula, Stop product/test, or frozen specification was changed. No mock implementation, analytics activation, push or deployment.

## Final checks and evidence

[RESULTS.json](RESULTS.json) lists case outcomes and complete-root SHA-256 comparisons. [IDENTITY.json](IDENTITY.json) binds all application source, package/configuration files, frozen specifications and served production assets to their exact hashes. Raw data, screenshots, AX snapshots, traces, scripts and logs are in [evidence.tar.gz](evidence.tar.gz); `final/evidence-hashes.json` inventories its raw files. `pre/` is original-build evidence, `post/` is the first repair build, and `final/` is the final source/build, including the more accurate failure announcement. No first-build result substitutes for a final-build result.

| Check on final source/build | Result and exact boundary |
|---|---|
| `npm test` | **1,099 tests / 53 files PASS**, exit 0; `final/test.log`, `final/test.exit` |
| `npm run lint` | PASS, two inherited warnings in `src/App.tsx` and the older Stop QA driver; `final/lint.log` |
| `npm run build` | TypeScript, Vite and disabled analytics build PASS; `final/build.log` |
| Stop forms/drills and Balloons manifests/drills | PASS; `final/forms.log`, `drills.log`, `manifests.log` |
| Q1 keyboard deletion | **10/10 PASS** in installed Chrome 154.0.8037.95, headless, 390×844: Space/Enter × remaining/empty/ all/failed-individual/failed-all. Heading is active and `:focus-visible`, with a visible outline; status persists. Failed roots are byte-identical; retained records and individual exposure/chain/form tombstones reconcile; Delete all matches the complete expected replacement root. `final/focus-results.json`, `focus-*.json/png/ax.txt` |
| N1 injected callback matrix | **16/16 PASS**; exact original four held boundaries, two deletion kinds and two orderings. New RP1 is durably confirmed before old transaction/notification release. Full roots are equal after old transaction callbacks, after stale notices, and again before reload; Pump remains enabled and RP1 visible. `final/n1/notification-results.json` and per-case captures |
| Native/absent-notification controls | **8/8 PASS**; assignment/action × individual/all × native/absent, deletion-first. Same full-root and visible-state checks; transaction delivery is still instrumented. `final/n1-controls/notification-results.json` |
| Current deletion withdrawal | **4/4 PASS**, Practice/exercise × individual/all. Periodic 1,000/1,500 ms observers deliberately disabled to isolate notification handling. Hold genuine received notices until deletion commits, release the current handler, verify controls disappear within the 500 ms assertion bound and root remains exactly the deleted root. `final/withdrawal/notification-results.json` |
| Held exercise notifications across replacement | **2/2 PASS**, individual/all. Fresh BL completion → exercise → cross-tab deletion → library → new confirmed RP1 in the same document → release old exercise and journey handlers. Complete root and visible text unchanged, Pump enabled after 1.2 seconds. `final/training-stale/notification-results.json` |
| B1 native-default controls | PASS: Enter collection; Next/Pump focus; held Space across focus transfer; touch emulation; unknown click; Enter repeat across focus transfer; mixed input remains eligible. `final/access-results.json`, `input-semantics.json` |
| Fresh B1/B2 production journey | PASS: unseeded preparation → BL1 39 → maintenance 18 → RT1 39 → report/comparison → reload/history → cross-tab baseline deletion and comparison withdrawal. `final/journey/results.json` |
| Independent arithmetic method | **78 scored rounds** replayed from primitive actions and frozen manifests; IDs/revisions, event totals, presentation, mapping, conservation, visible total deltas and closure agree. `final/journey/arithmetic-independent.json`, `reconcile.log`. This is developer-run independent calculation, not a separate audit. The 18 drill rounds are outside that arithmetic count. |
| Focus/lifetime component tests | Six new held-commit/held-history cases cover remaining/empty/all, two failures and navigation; three mocked-controller cases cover navigation, same-step controller replacement, unmount, and immediate current notification withdrawal. Existing history and comparison tests remain passing. Native key behavior is checked in the browser, not claimed from jsdom. |
| Scope/integrity | All five frozen Balloons hashes match their approved freeze register; Stop/specification diff is empty; no dependency change; `git diff --check` PASS. |

Environment: macOS 26.6.2 (25G83), arm64, Node 24.13.1, npm 11.8.0. Q1/input use installed Chrome headless; N1, controls, withdrawal, exercise callbacks and the full journey use Chromium headless 145.0.7632.6. The successful build retains the inherited bundle-size warning; tests retain the experimental SQLite warning.

## OBS-1 and retained unsuccessful runs

**OBS-1 remains open and recurred here.** The first `npm run check` failed at the unchanged `src/stop/Journey.test.tsx:25`: BODY had focus instead of “Remember the Stop rule.” Its result was **1 failed / 1,098 passed, 53 files**, exit 1 (`post/check.log`). The check consequently did not proceed to its later manifest/build stages. Those commands were run separately on final source and passed. A later complete `npm test` passed 1,099/1,099, and an isolated unchanged Stop Journey run passed 2/2 (`final/obs1-isolated.log`). No Stop code or test was changed, and the failure is not dismissed as proven flakiness. No causal instrumentation establishes why this failing assertion preceded focus; the final green run does not close it.

Retained harness/development corrections:

- Extended Q1's first failure cases waited for a transient alert that the existing background history refresh cleared; four waits timed out. The corrected driver observes its injected failed put and restored controls, then checks persistent outcome status. Both versions' logs/raw errors remain; all final cases pass without discarded errors.
- The first new component fixture changed a record ID without rebuilding its journal and was rejected by existing durable integrity. It was replaced with a fully constructed record. A `beforeAll` callback was wrapped for Vitest's fixture API; TypeScript parameter properties and a Testing Library `exact` option were corrected in the test double. These were test-code errors, retained in `component-first.log`, `notification-unit.log`, and `post/build-first.log`.
- The first repair announced “could not be completed”; final copy uses “could not be confirmed” so an uncertain delivery cannot imply a proven failed transaction. Final production-browser and repository tests were rerun against that source/build. The earlier build evidence remains under `post/`.
- Some independent checks and browser cases ran concurrently. The first post-edit aggregate check rebuilt only if tests passed (they did not); the final build completed before final browser work. No final product edits occurred during final browser execution.

## Reproduction and separate audit handoff

1. Check out the handoff SHA, verify its parent is the authorized base, and verify a clean tree. Recompute `IDENTITY.json` source hashes. Build using the retained dependency lockfile; compare served `dist/` hashes.
2. Extract the archive into a new local directory. The scripts require the installed Playwright/runtime/browser paths shown in their source; adjust those paths only if your environment differs and record that adjustment. Serve the production build at `127.0.0.1:4256`.
3. Set `BALLOONS_REPAIR_OUT` to a fresh existing directory per driver. Run `post-n1.mjs` and `post-n1-controls.mjs`, then `withdrawal.mjs` and `training-stale.mjs`. Each writes a `notification-results.json`; keep directories distinct. The `n1.mjs`/`n1-controls.mjs` copies retain the original assertions for base reproduction.
4. For `focus.mjs`, copy the archive's `pre/fresh-pair.json` to the new output directory. This is an actual B3 browser-generated BL1/RT1 pair, reused solely as a seeded deletion fixture. Run `input.mjs` separately. Run the repository `docs/qa/balloons-b2-c2/browser.mjs` with `BASE_URL=http://127.0.0.1:4256` and `EVIDENCE_DIR` pointing to a separate output directory; reconcile it using that directory and `docs/qa/balloons-b2-c2/reconcile.py`.
5. Run repository checks. Preserve any OBS-1 failure and its exact environment, separately from the Q1/N1 verdict. Audit the exact new commit; these developer checks are not its audit.

## Limits and open gates

N1 is repaired under the specified **held application-handler-after-native-receipt** injection. This does not establish natural delivery from a closed native BroadcastChannel or estimate its frequency. Native/absent controls still contain transaction-delivery instrumentation. Current-deletion timing is an automated functional bound with polling suppressed, not a physical latency measurement.

Automated browser-native Space/Enter defaults are not physical keyboard attestation. DOM/AX status and focus-visible evidence are not audible screen-reader verification. No Safari, Windows, real mobile/touch, screen-reader, physical timing, native lifecycle, true zoom, OS-preference, complete accessibility or full device-matrix qualification was performed. The B3 acceptance map's unchecked cells remain unchecked. Full mock is still an open dependency. OBS-1, independent repair audit, founder repair acceptance, B3/whole-Balloons qualification, deployment and release remain open. Analytics remains disabled. Local commit only.
