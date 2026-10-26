# Lengths Mouth V1.2 owned display — developer verification

This grouped candidate replaces the style-property scanner that failed three independent audits. The scored display now uses a fresh same-tab document with an owned closed body root and an exact task stylesheet/tree. Untimed guide, report and history live in the retained UI root. No V1.1 or earlier save family, form, timing, scoring or SVG geometry was changed.

The [independent design review](/private/tmp/lengths-v12-design-challenge/REVIEW.md) accepted this architecture conditionally; the [external feasibility probe](/private/tmp/lengths-v12-feasibility/RESULT.md) covered ownership, style, clipping, overlay and same-action input cases in bounded browsers. Neither is a product audit.

Developer checks on the final source:

- V1.2 focused tests: 5/5; TypeScript check, oxlint and production Vite build pass; `git diff --check` passes. The build retains the repository's chunk-size advisory.
- Native Chrome production preview: two all-omitted standard runs completed with **90 presented, 90 closed, zero unresolved and Valid**. The first saved report reopened from V1.2 history after reload with the same counts. The second run kept the full visual check on every protected frame. A subsequent small in-flight continuation guard was added before commit; this guard and the complete candidate passed the focused checks/build, but the two complete browser runs preceded that guard.
- The first browser pass exposed an automatic block-continuation bug: a new protected root had not been entered before the runner checked layout. Continuation now owns that transition, and both later 90-trial Chrome runs crossed the block boundaries without intervention.
- At Chrome 200% zoom on a 1473×805 CSS-pixel ordinary viewport, the face and controls did not all fit, so Start was disabled with a visible explanation. Returning to 100% automatically restored readiness. This is a fail-closed zoom/layout check, not a claim that 200% is playable at that viewport.
- On the final candidate, Chrome accepted a mouse-pointer, visual-accommodation, light-on-dark run; a native Short click was processed and deliberate exit produced a saved factual prefix with four presented trials, the declared profile, and `page_exit` rather than a valid aggregate.
- Native Safari exposed the closed-root controls and progressed through trials, but two timed runs invalidated when a stage was more than 250 ms late. The retained journal showed repeated roughly 67 ms protected frame gaps and a 258 ms face-onset lateness. The candidate did not change the frozen timing threshold to accommodate this test environment. Safari/device timing qualification remains open.
- Temporary local diagnostic requests were removed from source and their server stopped before this handoff.

This is **developer-tested only**. A separate read-only exact-SHA audit must challenge the complete owned surface and authority boundaries, including clipping, hidden/altered SVG paint, CSSOM, closed roots, same-action mutation, selected input, cancellation, checkpoint/terminal saves, deletion/replacement and historical V1.1 preservation. Founder personal acceptance, native 200% fit on a suitable viewport, physical devices, screen-reader speech, full mock, deployment and release remain open.
