# Arrows A6 F3-R1 paint-order repair

**Parent:** `68aa7173a7ea8c57ae09ff924a6506f60570bc42`. The [independent F3 audit](/private/tmp/arrows-a6-f3-audit-68aa717-a8vju_9j/AUDIT.md) confirmed painted-overlay detection but reproduced a false viewport rejection when an opaque, non-interactive sibling was entirely **behind** the visible stimulus.

The overlapping-element check now establishes paint order before rejecting a `pointer-events: none` element. It temporarily makes that one candidate hit-testable, samples the overlap through `elementFromPoint`, and restores its exact original inline style synchronously. A front overlay still blocks the display; a lower layer does not. The existing full-footprint and cue/symbol/control checks remain. No form, timing, response, scoring or specification rule changed.

## Developer checks

- [Focused Chromium driver](A6-F3R1-browser.mjs) and [raw results](A6-F3R1-browser.json): **8/8 pass** in headless Chromium `145.0.7632.6`. Full, partial, non-interactive and stage-child overlays invalidate; the zero-opacity ancestor invalidates; an underlying `pointer-events: none` sibling remains valid both before Start and during scored display. The candidate element's inline style is byte-identical after the check.
- [Six original source-browser cases](A6-F3R1-regression.json) pass against this source. Historical QA JSON files were preserved.
- The focused Arrows suite, lint, TypeScript/production build, frozen-form regeneration and diff hygiene pass. Lint retains two warnings in untouched files. Frozen Arrows hashes remain unchanged.

These are bounded scripted browser checks. Native devices, screen readers, 200% zoom, candidate UI, durable checkpoint/result/history integration and the full mock remain unqualified or unimplemented. A separate read-only audit of the exact repair SHA is required. Founder personal acceptance, deployment and release remain open.
