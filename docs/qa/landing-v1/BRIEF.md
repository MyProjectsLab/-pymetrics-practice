# L1 — editorial design system and landing page

Base: `9ab5816bf07d35dcb06f4f41f2860a9efcd54d7a` (2026-10-09).
Pre-existing uncommitted founder edits: AGENTS.md and docs/qa/DELIVERY_WORKFLOW.md; preserve and exclude from this milestone commit.

## Authority and outcome

Founder request: implement the attached visual brief as a design system, apply it to the landing page, then stop for landing approval. Read the full Master Strategy, implementation tracker and current delivery workflow. Visual sources: `/Users/renzo/Downloads/pymetrics-design-brief.pdf` (two pages) and `/Users/renzo/Downloads/Game-Based Behavioral Assessments | pymetrics.pdf` (one screenshot). These are design inputs, not authority to change mechanics or reporting claims.

Create an original editorial landing page: Newsreader display, Inter UI, paper #FAFAF8, ink #0A0A0B, vermilion accent #B43E2B, 4/8/16/32/64 spacing, 8px radius, Lucide icons and original typographic wordmark/favicon. Motif: a practice notebook with inset photo frames, margin marks and numbered sections. No Harver slashes, masks, logo, copy or assets. Local licensed photo/font assets; no runtime third-party requests.

## Done criteria

- Define scoped reusable typography/color/spacing/focus/button/icon/wordmark foundations before landing composition.
- Responsive editorial landing with real licensed photography, left-aligned serif headline, concise explanation, real availability, links to the existing practice library, privacy and independence statements.
- Six implemented games are described as a private preview; twelve-game scope/full mock are explicitly future availability. No invented total duration, testimonials, outcomes, percentile/trait claims or training availability promises.
- Preserve all existing App, game, library, report, history, storage and timing behavior/styles. Mount the landing only at the normal home entry; `/practice` and explicit existing app entry retain the original app.
- Keyboard skip, focus, native links, readable contrast; no horizontal overflow at 320/390/768/1440 CSS px or equivalent 200% zoom layout; photo failure retains a designed composition.
- Lint, relevant existing tests, production build; bounded real-browser visual/keyboard/navigation checks; provenance/license and frozen-byte checks.
- Local coherent commit then separate read-only exact-SHA independent audit. Founder visual acceptance remains pending. Stop here; no game-screen rollout, deployment or unrelated work.

## Exclusions / applicable failure matrix

No game packet revision, scoring, persistence, analytics, reports, full mock or new game. Stateful deletion/authority races and timed play are not changed; inspect byte identity rather than claiming new qualification. Check landing-to-existing-app navigation, reload/back, asset failure and keyboard behavior. Full browser/device/screen-reader qualification remains separate.
