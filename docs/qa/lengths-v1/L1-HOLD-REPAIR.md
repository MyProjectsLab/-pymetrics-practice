# Lengths L1 rejected-key hold repair

**Basis:** the independent L1 audit of `4928e911fe30df395f6f3a2110704d6a696c9e08` reproduced a selected-key press with modifier, composition or repeat evidence being rejected without marking that physical key held. A following unmodified keydown could then score without an intervening keyup. This is a focused repair in an isolated checkout; its final commit requires a new read-only exact-SHA audit.

Before the product change, three new acceptance cases failed: after each rejected selected-key press, `heldCodes` was empty rather than containing the key. The repair marks the selected key held for these rejected keydowns, keeps the ignored-action event and requires keyup before a later press can score. The existing replay verifier replays the same commands, so the new journal remains verifiable.

After repair, 27 focused Lengths tests passed across both files. Three full 96-trial cases now reconcile as 95 correct and one omission, with 95 response events, after modified, composing or repeat first presses followed by an unmodified press without keyup. TypeScript app check, lint, client production build and `git diff --check` passed. Lint retained five warnings outside Lengths; the build retained a chunk-size advisory. The specification, fixed-form and fixture SHA-256 values match the freeze record.

This is headless verification. Browser event delivery, physical key behavior, persistence, two-tab ownership, accessibility, founder personal acceptance and whole-game qualification remain open.
