# Digits V1.1 — playable standalone developer verification

**Scope:** One complete standalone adaptive Practice milestone, from short guide/example/check and input setup through visual or admitted local-auditory playback, per-trial durable checkpoints, report, history, deletion and exact-byte reload. Developer evidence only; independent implementation audit remains open.

**Base:** `a0956e971330651f1d9729169ff237af2b333254`. The earlier uncommitted V1.0 candidate was converted in this isolated clone. The independent V1.1 specification reaudit PASS is `/private/tmp/digits-v11-spec-audit/REAUDIT-a0956e9.md`; it is a specification verdict, not an implementation verdict. Product and tests were not integrated into the main checkout. The candidate is the commit containing this record; obtain its exact SHA with `git rev-parse HEAD`.

## Delivered behavior

- Starts at length 4. An on-time exact Submit increases length by one; every Wrong, Skip or timeout decreases it by one, with floor 2 and ceiling 16. The third **cumulative** mistake ends immediately; otherwise trial 40 ends distinctly as `practice_limit_reached`. Correct answers do not reset mistakes.
- Each target comes from the verified V1.1 seed/generator and the actually presented prior targets. Repeated digits and zero remain literal. All V1.1 events have `block: 0`. There are no scored blocks or fixed trial denominators. Replay validates every command, generated target, event and derived snapshot.
- Each closed nonterminal trial enters feedback. Next remains unavailable until its immutable prefix is committed and read back. Start/Next and competing deletion share the same browser data lock through the first confirmed digit. Feedback retains lifecycle protection and the original layout baseline. End/blur during feedback captures an Invalid terminal and releases the owner.
- A pending checkpoint is reconciled against its exact durable bytes before a lifecycle terminal extends it. UI delivery timeouts do not imply failed writes. Same-byte retry/readback, original installation identity, tombstones, root revisions and immutable prefixes prevent rewind or resurrection. Terminal Saved copy is published only inside the ordered fresh result/activity/readback boundary.
- V1.1 has explicit specification, form, generator, event, scoring and storage versions and a new `assessment-practice-digits-v11` database. The never-shipped V1.0 candidate is not migrated or silently interpreted under V1.1. Hypothetical older databases are untouched; mixed/unsupported roots are rejected.
- The candidate UI defaults to visual keyboard entry, one example, one understanding question, an untimed input check and optional setup details. It presents one digit at a time, hides targets from accessibility text, accepts only the selected entry path, suppresses held-key repeats, and rejects untrusted scored response events. The report leads its numerical results with maximum correctly recalled length; by-length and serial-position denominators come from actual closed targets. Invalid/Incomplete reviews suppress aggregates. Auditory, extended and assisted entry are labeled.

## Checks and evidence

**Final result:** the repository gate passed **85 test files / 1,467 tests**, lint with two inherited warnings, all included form/reviewer checks, TypeScript and production build. Digits contributes **47 focused tests**. The final production matrix passed **17/17 cases**.

`checks-final.txt` records the final repository gate; `build-browser.txt` records the production build used by browser checks. `source-hashes.json` binds changed sources, unchanged Digits packets and the built artifact. `browser-development.mjs` is the reproducible Chromium harness; `browser-development.json` is the final production matrix. The separate 200% diagnostic and ordering traces remain in `browser-200-percent.json` and `browser-shared-Next.json`.

The pure/controller/storage fixtures cover the five frozen complete paths plus a sixth independent generation path on every seed, whole answer/length arrays, cumulative mistakes, floor/ceiling/cap, third mistake on trial 40, exact deadline, Skip and matching timed-out draft, mutation rejection, variable denominators, partial exposure, timing thresholds, severe-gap observation order, first-frame watchdog, local speech start/end watchdogs and late canceled callbacks, checkpoint failure/readback/retry, committed-but-held delivery, lifecycle extension, immutable terminal bytes, tombstones/replacement, historical checkpoint-view activity and second-owner cancellation.

The production matrix exercises:

1. C/W/C/W/C/W with observed lengths 4/5/4/5/4/5, native Start Space and response Enter, saved report and exact-byte reload/history. `visual-terminal-root.json` and `visual-reloaded-root.json` retain the raw roots; `visual-play.png` and `visual-report.png` show the candidate view.
2. Trusted keypad input, held keypad Enter, feedback blur and saved Invalid with the factual closed trial.
3. Untrusted edit/composition/Submit rejection and a held physical key producing one accepted digit.
4. Committed arm with held delivery, retry of the same request, late original callback and exactly one rotation position.
5. Genuine rejected checkpoint write, disabled Next and successful same-byte retry.
6. Committed-but-held checkpoint followed by End, exact-prefix terminal extension, and late checkpoint delivery unable to replace the terminal.
7. Held terminal delivery retaining an explicitly unsaved draft; same-byte retry confirms the identical snapshot.
8. Individual deletion and Delete all, in both Next/deletion orders with notifications absent. Captured data-lock acquisition/release and digit-write traces show zero successor digits when deletion wins and one confirmed first digit before deletion when Next wins. Individual rotation is retained; replacement resets it.
9. Eligible **callback-injected** local auditory setup and complete W/W/W journey, saved and reopened with identical bytes. `auditory-terminal-root.json` and `auditory-reloaded-root.json` retain the raw roots. No acoustic audibility is established by this fixture.
10. Declared auditory unavailability, with visual selectable and usable.
11. 200% CSS zoom at 1280×800, native Start Enter, entry controls inside the viewport, no horizontal overflow, and report heading focus. This is bounded reflow evidence, not native browser zoom/device qualification.
12. Missing first required frame, zero confirmed exposure, saved Invalid and late callback ignored.
13. Held saved-report authority read withholding numbers until current root verification.
14. Held terminal delivery followed by other-tab deletion, retry retirement and no late Saved copy or resurrection.

## Preliminary findings and limits

The preliminary captures are retained, not presented as the final PASS matrix:

- `browser-preliminary.json`: the peer deletion harness used the wrong data-lock name; its Next-first probes bypassed the contract. The corrected matrix uses the exported production lock name and captures causal ordering.
- `browser-before-zoom-repair.json`: inherited `main` minimum height preserved readiness scroll at 200% zoom, leaving the first stimulus outside the viewport. The Digits layout now removes that minimum height before admission. The settled diagnostic captures stimulus y203–331 and full entry controls y331–607 within the 800-pixel viewport, scrollY 0, with no overflow.
- The earlier transient arm-only “Start record saved” copy during terminal publication was corrected. Verified snapshots are passed to the report, and terminal Saved publication waits for ordered authority/activity readback. Blur checks compare a settled terminal root, while separate held-delivery checks verify the pending state.
- `checks-preliminary.txt`: the library regression expected five cards before Digits added the sixth. Only that scope assertion and the explicit Digits card expectation were updated.

The ending rule implements the founder's saved JobTestPrep footage and the frozen V1.1 contract. The coordinator's live online recheck found conflicting descriptions: JobTestPrep states three wrong answers without specifying cumulative/consecutive, another preparation site says consecutive, and Harver does not publish a Digits ending rule. This implementation makes no verified real-Pymetrics/employer-mechanics claim.

Headless Chromium, synthetic lifecycle events, injected transaction callback faults, callback-injected speech and CSS zoom are bounded developer evidence. Physical keyboard/touch timing, native page suspension/exit, acoustic output, screen-reader coexistence, supported browser/device qualification and full accessibility remain separate gates. Full mock integration, independent exact-SHA functional audit, founder personal acceptance, analytics activation, deployment and release are open. No other game mechanics, frozen specification/form/fixture bytes, mock or analytics product code changed.

**Next:** Read-only independent whole-milestone functional audit of this candidate's exact SHA, then group any demonstrated blockers into one repair. Do not treat these developer checks as an independent PASS.
