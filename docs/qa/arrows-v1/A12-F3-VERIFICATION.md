# Arrows A12 F3 focused developer repair

## Identity and status

The independent whole-Arrows repair audit **FAILED at `e25046d8ba69fa6c604d83aec71ca6e6a16b09d0`** on F3: a delayed positive Start confirmation could be delivered after another tab deleted its attempt or replaced the installation, then begin scored play from the retired arm. The read-only report is `/private/tmp/arrows-repair-audit-e25046d/AUDIT.md`. This isolated repair starts from `b72753bb1d0346d7a4dfd4f2dec24e644d41efe7`, whose product content is equivalent to that audited main SHA. F1/F2 remain passing at the audited SHA. This record is developer verification only; a new exact-SHA independent audit is required.

The later independent audit **FAILED at `e28003f4bc811ba9794b0f5ca6115e850c05cbe4`**: the added read itself could deliver stale authority. This record is historical developer evidence, not closure of F3. See [the ordering repair](A12-F3-ORDERING-VERIFICATION.md).

## Reproduction before repair

An entry test held delivery of a committed Start result, simulated a fresh authoritative lookup after individual deletion or Delete all replacement, and expected entry to reject before returning the arm. Both variants failed before the product edit: `ArrowsEntry.begin` resolved the old arm without calling `loadArmed`. The independent audit also reproduced both variants in the production browser, including the repaired F1 same-request retry path, with no durable resurrection or false saved claim.

## Repair

After the storage Start result arrives, entry performs a fresh `loadArmed` under the current owner and abort signal. It requires the same installation, attempt identity and arm state, with no terminal snapshot, before it returns the arm to the browser. The browser's remaining layout check and scored Start are synchronous, so a stale confirmation callback cannot publish fixation or stimulus without this later authority read. Failed or canceled confirmation releases ownership; an operational read failure leaves the request eligible for the same-request retry.

## Checks and limits

- Focused regressions cover individual deletion, installation replacement, a different returned attempt, a late positive read after cancellation, and same-request retry after a temporary authority-read error. In the deletion/replacement cases, the actual browser adapter remains without a state or published scored event.
- All Arrows and App tests: 8 files, 133 passed. App, node and analytics TypeScript configurations passed with incremental cache redirected to `/private/tmp` because this worktree's `node_modules` symlink is read-only. Lint passed with two inherited warnings outside the changed files. Arrows fixed-form generation passed with canonical digest `228b0e10405a80830c73e4b69e12950482967dec717f156c789e19fa11b1150b`. Production client and analytics bundles built; the client retains the existing large-chunk advisory. `git diff --check` passed.
- These are controlled entry/browser component regressions, not a repeat of the independent production-browser fault sequence. The previous exact-SHA FAIL remains in force until a separate audit of the changed main SHA. Native physical timing, device/accessibility qualification, founder acceptance, full mock, deployment and release remain open. The A11 indefinitely withheld deletion-delivery observation remains open.
