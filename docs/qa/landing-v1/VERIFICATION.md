# L1 developer verification — 2026-10-09

Base: `9ab5816bf07d35dcb06f4f41f2860a9efcd54d7a`. Scope and acceptance: [BRIEF.md](BRIEF.md). Visual sources and licenses: [PROVENANCE.md](PROVENANCE.md).

Implemented: scoped Newsreader/Inter design system, paper/ink/vermilion palette, 4/8/16/32/64 spacing, 8px radius, original margin-frame wordmark/favicon, Lucide icons and editorial landing. Existing App loads at `/practice`; `/index.html` still opens the original App. Homepage does not mount app storage, session or analytics modules. All existing game/library/report/history CSS and TypeScript remain byte-identical to the base. The favicon/document description are shared branding metadata only.

## Developer checks

- `npm run lint`: PASS, three inherited warnings (existing cross-tab harness, lengths-mouth generator and App effect dependency); no new warning.
- Focused existing tests: `npx vitest run src/core/Shell.test.tsx src/App.test.tsx src/App.completion.test.tsx`: 3 files / 21 tests PASS.
- `npm run build`: PASS (existing large App bundle warning). Fonts and page CSS are local landing-only chunks; existing game CSS is not fetched by home and landing CSS is not fetched by `/practice`.
- Production Chrome browser checks: [browser-results.json](browser-results.json), reproducible [driver](browser-check.mjs). 1440/1024/768/390/320 widths, photo/font loading, no third-party requests, no landing IndexedDB creation, keyboard Skip/Enter focus, section anchors, CTA to practice, practice reload, Stop guide, browser Back, legacy index entry and photo-failure fallback passed. Reduced-motion fallback checked. Narrow widths include the reflow equivalent of a desktop zoomed to 200%; not a physical OS/browser zoom certification.
- Desktop and mobile screenshots visually inspected: clear hierarchy, no clipped text or overlapping elements. Fallback and unchanged practice screenshot retained. Headless Chrome is bounded browser evidence, not screen-reader or device qualification.
- `git diff --check`: PASS. Existing frozen specification files, App.tsx, App.css, index.css, core, games and game modules are unchanged.
- npm install reported one high-severity advisory in inherited development transitive `source-map-js` 1.2.1. The base lockfile contains that same version; none of the three added design dependencies caused it. Recorded, not expanded into an unrelated dependency repair.

## Evidence limits and final review gate

The initial browser harness expected Playwright's absent bundled Chromium, then used installed Chrome successfully. This is a harness environment issue, not a product verdict.

Founder added a requirement during implementation for 6–10 credited stock-photo options covering students and other adult age ranges. Eight options are available in the [credited photo shortlist](PHOTO-OPTIONS.md), with full-image thumbnails in a separate local review gallery. The implemented hero photo is **provisional**; founder chooses the final photography. No final asset choice or landing acceptance is claimed.

Independent exact-SHA audit is required after the local commit. Founder visual acceptance, broader qualification, deployment and release remain distinct and pending. Stop after this landing milestone. Do not apply its styles to game screens until the founder approves the landing.

## Independent milestone verdict

The separate read-only audit **PASSED the bounded landing/design-system scope at `ad6e4d8a65bcfb3de8b529275a54944eb18b53f2`**, parent `9ab5816bf07d35dcb06f4f41f2860a9efcd54d7a`. [Audit and raw evidence](/private/tmp/ap-landing-independent/AUDIT-ad6e4d8.md). It independently built a clean detached checkout, reran 21 tests and lint, checked 12 responsive widths, keyboard focus, navigation, failed assets and scoped CSS, and verified 283 pre-existing source/governing files unchanged. No blocking findings. Audit full-page captures tiled incorrectly; use its fresh `viewport-*.png` captures for independent visual evidence. This is a bounded Chrome development PASS; founder visual/photo acceptance, device/accessibility qualification, deployment and release remain separate. The subsequent documentation-only status/shortlist commit changes no audited product bytes.
