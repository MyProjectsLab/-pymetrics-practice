# R8–R10 preaudit gate

Base: `2edd61613288934b123de9cf71fa928d5818873f`. This record covers the grouped isolated candidate before its independent audit.

- The static preflight's retry-action gap was closed: an owned report session keeps its retry control visible after a successful integrity check followed by a failed recovery or publication read. The control sits outside the report-data branch, while counts and saved claims remain hidden. Focused tests cover released prefix, live break, protected withdrawal, live terminal, history, and loss of visibility.
- Five focused test files passed: 78 tests. App, Node, and analytics TypeScript checks passed with build-info files under `/private/tmp`; lint passed with two inherited warnings outside Arrows. The final Vite production build succeeded.
- The final-bundle Chromium cases passed: live terminal integrity conflict → failed Delete all → recovery with the same saved record; live break integrity conflict → recovered prefix and one report-view activity event; obsolete canceled write → new owner preserved. Browser input and faults were automated or injected; these cases do not qualify physical timing or lifecycle delivery.
- No page errors were recorded in those Chromium cases. The captured raw roots, DOM state, lock events, and screenshots are under `/private/tmp/arrows-r8-r10-qa/`. The full repository suite was not rerun for this grouped repair.

Source SHA-256: `Journey.tsx` `537d030c652ed31a40bc15183c0bead0d440cd6e28bbbe293a2fdfc70a8da97a`; `browser.ts` `5853bae312e2b703b7dd85790cc4e9a20e73f78d26c01cd108fbe2911f60f38a`; `storage.ts` `5930b99c3137622588f623838ed96622a7c00836f2efa5d7e600956aae3a1c47`; `report-session.ts` `5fbb8c7f3500aeeb981339ea896933da62e5bb025d373000ade267b54a8ca298`. Production JS SHA-256: `d23600dc6592a482e36bb02c698f09fb6710441b973d69982b8feb4ce109a285`.

Developer verification only. A separate read-only exact-SHA functional audit is required before integrating the candidate or updating Arrows acceptance.
