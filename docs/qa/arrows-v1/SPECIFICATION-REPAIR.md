# Arrows V1.0 proposed packet repair

This is an agent-authored specification correction under the founder's full-product delegation. It is **not** an implementation, founder personal review, freeze, browser qualification, deployment or release.

## Review basis

The independent review of proposed commit `272a76250e3bc197e6af9116dd4dc157b5256e37` passed numerical regeneration of all six fixed forms and found six implementation-contract blockers. Its read-only report is `/private/tmp/arrows-spec-audit-272a762-m3axiubg/AUDIT.md`. No form JSON, constructor, trial mix or frozen pre-existing game contract changed in this repair.

## Corrections made to the proposed Arrows packet

1. Freeze the full input/accommodation profile from accepted arm through all five blocks. A break-time change invalidates the attempt; zoom is separately subject to visible-layout admission. This avoids mixed-binding timing and report cohorts.
2. Define monotonic due-time anchors for first and subsequent fixations, onset, resolution and offset. The original resolution deadline anchors offset lateness. `>50` through `250` ms is a timing note excluding the affected trial time; `>250` ms invalidates. The 2,000-ms unconfirmed-frame watchdog is a fallback, not a wall-clock guarantee.
3. Reconcile `presented = closed + unresolvedPresented` and `120 = presented + unpresented`. Invalid and incomplete attempts retain factual known-prefix review but suppress aggregate accuracy/timing. A crashed mid-block suffix is labeled unknown.
4. Define atomic start allocation/counter, authoritative readback, checkpoint and completion writes, canceled/undelivered callbacks, deletion tombstones, installation replacement and separate idempotent report-view activity. Timed input and resolution stay independent of storage.
5. Fix median-of-halves to exclude the central value for odd samples. Show median at five clean times and IQR at eight. Calculate signed contrasts from raw medians before one display rounding.
6. Enumerate physical key codes, modifier and repeat exclusions, pointer admission, alternative-input limits, held-input rearming and a measurable viewport predicate with 200% zoom checks.

The specification's §8 now contains exact boundary and conservation fixtures for these policies. They are acceptance requirements for later code and the next independent specification review. The fixed forms remain **uncalibrated**; none of this is a claim about employer assessment fidelity or physical timing accuracy.

## Checks for this documentation-only change

- `node scripts/generate-arrows-forms.mjs --check`: canonical digest and all six forms unchanged.
- `git diff --check`: no whitespace errors.
- No product tests or browser runs were needed for a proposed-contract edit. Implementation and exact-SHA independent review are pending.
