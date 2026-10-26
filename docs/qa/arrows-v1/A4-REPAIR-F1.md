# Arrows A4 F1 repair — stored dictionary shape

**Parent:** [independent A4 FAIL at `d0733355d5b3c819fed9aa14e3d74003a970d24d`](/private/tmp/arrows-a4-audit-d073335-14t3zkm8/AUDIT.md). This record is developer evidence only; a changed SHA needs its own separate read-only audit.

F1 was reproduced before editing: the new `storage.test.ts` fixture expected a structured-cloned Map attempt dictionary to reject, but `inspectArrowsRoot` returned successfully. The independent audit also demonstrated the same flaw in real IndexedDB, including counter consumption without a retained arm and hidden tombstones.

The root validator now admits only ordinary string-keyed records with `Object.prototype` or a null prototype for the root, attempts and tombstones. It rejects Map, Set, Date and other special objects before enumeration, request matching or any mutation. Existing arm, readback, identity and frozen form checks remain unchanged.

**Verification:** eight focused storage tests passed after repair; the new case covers attempts as Map/Set/Date, a nonempty tombstone Map, unchanged counter and repeated request rejection. All **26** affected Arrows storage/engine/report tests passed. The [real-Chromium script](A4-repair-f1-browser.mjs) and [raw result](A4-repair-f1-browser.json) exercised four malformed roots using IndexedDB structured clones. All four rejected admission and two Start calls, retained counter/revision zero and preserved the malformed container bytes. The original two-tab ordinary arm/reload browser control also passed on repaired source; its historical raw file was restored unchanged after that rerun. Chromium was `145.0.7632.6` headless; injected malformed roots do not establish native device qualification. TypeScript, lint, frozen Arrows form regeneration, production build and `git diff --check` passed. Lint retained two inherited warnings in untouched files.

The audit's N1 and N2 are deferred to the browser adapter: canonical-form rehydration and freezing must precede engine handoff; a canceled invocation must not be retried as a new live Start. This repair does not implement visible timing, completion persistence, history or qualification.
