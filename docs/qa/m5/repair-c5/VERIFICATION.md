# Stop M5 C5 repair — developer verification

Starting commit: `c0fdc8e2f0800a22f536c6f053715e459967b1d2`, clean. The complete independent M5 audit at `/private/tmp/stop-m5-full-audit-c0fdc8e-20261001/AUDIT.md` failed C5. Its REQUIREMENTS.md maps the complete M5 scope. This repair addresses only the post-completion-save-failure loss of dependency authority. It does not constitute a whole-M5 audit or founder acceptance.

## Reproduction before edits

On unchanged starting source, a Chromium candidate completed all eight warm-up and 80 scored retest trials with real browser timers. Both completion writes were injected to fail. The candidate opened comparison, returned to the library, and another tab deleted the baseline using the history confirmation. Normal notifications delivered. Resume still showed a 25% → 25% comparison, despite the baseline tombstone and retired durable chain. Reload removed the stale chain.

The retained retest has 643 immutable events, 60 GO misses, 20 correct NO-GO withholds and 25% accuracy. `pre-edit/REPRODUCTION.json` was reconciled from raw UI, result, chain and IndexedDB captures before any product edit. The screenshot was reopened and inspected.

## Repair

- Training captures the original store and installation identity separately from the active writer. Removing the writer after two failures does not erase the chain's deletion authority.
- Eligibility rereads durable installation identity, deletion/retirement records, baseline bytes and previously persisted drill bytes. A deletion-revision read on each side of the state read rejects a stale delivery across deletion. No write is needed to check eligibility, and notifications cannot grant it.
- Unknown/read-failing authority suppresses comparison without changing immutable task validity or journals. Missing previously durable dependencies also fail closed. Temporary buffered drills remain permitted when intact; chains created wholly in temporary memory retain their approved same-tab behavior.
- Chain-object and authority identity fence late read deliveries. The App also fences an outstanding Resume against later candidate navigation. Old checks cannot select or clear a replacement chain.
- Comparison renders only after checking its current chain. Focus/visibility resume clears cached eligibility, and untimed periodic checks detect deletion or authority loss while comparison is open even without notifications.
- Library review keeps retained temporary retests accessible without a comparison action. Storage-status copy distinguishes ordinary failed saving from temporary review.

No timing engine, run, storage transaction, persisted schema, form, scoring, router, frozen specification, or other game implementation changed. N2, S46 and M6 remain outside scope.

## Evidence

All new raw evidence and drivers are under `/private/tmp/stop-m5-c5-repair/` and are retained in `raw-evidence.tar.xz`. Driver fixtures are explicitly labeled:

- `pre-edit/`: full real-timer failing reproduction at the starting SHA.
- `full-after/`: full real-timer C5 regression after the repair.
- `resume-matrix`: 12 seeded post-fallback browser cases: baseline, required drill, Delete all and unrelated deletion × normal, delayed and unavailable notifications. Uses the actual pre-edit immutable retest journal plus verified prerequisite records, then actual App, training, IndexedDB, history controls, Resume, report review and reload. These are boundary tests, not twelve additional timed completions or save-retry tests.
- `extra-boundaries`: unavailable authority read/recovery and removal of an already-open comparison without notifications.
- `retry-control`, `c2-drill`, `c4-all`: full real-timer completion controls with injected delivery/write boundaries, exact save-call counts, durable state, immutable journals, replacement work and reload.
- Focused deterministic tests cover missing baseline/drill, blocked reads and recovery, delayed pre-deletion reads, store rebinding, replacement-chain callbacks, temporary buffers, comparison display admission and resumed focus, and navigation ownership. Existing completion/ownership tests cover affected C2–C4 behavior.

The final evidence summary and command results are recorded beside this document. Earlier captures and any harness failures remain labeled; no failed or incomplete capture is counted as passing.

## Integrity and limits

Both frozen documents match approved source commit `36a5ef718602ff2c49fa60aaafc59a67d57eedd0`:

- Master Strategy: `c046fd1776c179799422893985229743bd495ed8d23c9388046f4424162c46f3`
- Stop V1.1: `d6389db51b3767764d7e4d71c8a6c84a3719581225165fd42d86c76a4ab2c843`

Browser evidence uses Chromium headless shell 145.0.7632.6 on macOS at 1200×800, real IndexedDB and Web Locks, with explicit injected failures/delivery delay where stated. Synthetic validated prerequisites do not establish a complete physical baseline→drill→retest study. These checks do not establish physical display/input timing, native lifecycle, browser/device matrix, mixed-version operation, screen-reader, accessibility or release qualification. A fully stalled browser or database cannot provide a wall-clock liveness guarantee; resumed comparison remains suppressed while its check is outstanding.

The fresh exact-SHA whole-M5 independent audit and founder M5 acceptance remain open. N2, S46, initial-frame handling, pre-start screen-reader disclosure, browser/device/accessibility qualification, M6, deployment and release remain open. This is a local repair commit only.

## Repository checks

Node.js 24.13.1; npm 11.8.0; dependencies unchanged.

| Check | Result |
|---|---|
| `npm run check` on final product source | Passed: lint, 479 tests across 31 files, 14 standard and five drill manifest regeneration checks, TypeScript and production build |
| Added review-status tests after the full check | Focused App completion file passed all six cases, including the two added cases. This brings the distinct tested cases to 481; it is not a claim of a second 481-case full-suite run. |
| Lint warnings | Two inherited warnings: old QA unused parameter and App refreshHistory effect dependency; no new warnings |
| Governing documents | Both byte-compared against the approved source and SHA-256 hashes above |

`CORE-TESTED-SOURCE.json` binds the initial repaired full runs. After those runs, only the App's resumed-review warning selection and its focused tests changed. `FINAL-TESTED-SOURCE.json` records the exact difference. Final-source full C5 and C2 runs and the 12-case seeded matrix recheck the affected review UI. The retry-success and C4 captures exercise identical authority, run, training and storage code; their pre-copy-adjustment App hash is disclosed rather than described as a final-source rerun.

C4's browser replacement work is another tab's new reservation and activity. Same-tab replacement active results/chains and stale callbacks are covered by the deterministic run/App/training fixtures. This turn does not claim a fresh full timed replacement-baseline browser journey or a repeat of unrelated onset/cancellation matrices.
