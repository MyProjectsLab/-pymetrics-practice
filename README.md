# Assessment Practice

Repository foundation for the Assessment Practice candidate-preparation web application.

## Current status

Stop M1, M2A, M2B-1, and M2B-2 are implemented and tested within their recorded scope. Preparation now leads through the fixed warm-up and an 80-trial baseline-family timed run to an explicitly development-only draft. Scoring and reports arrive in M3. Exposure and records survive only in the active tab; refresh resets both. No product session is completed or saved yet. Persistence, training, analytics, deployment, independent audit, and founder implementation approval remain open. See `IMPLEMENTATION_TRACKER.md` and `docs/qa/m2b2/VERIFICATION.md`.

The binding local specifications are:

- `docs/specifications/ASSESSMENT_PRACTICE_MASTER_STRATEGY.md`
- `docs/specifications/ASSESSMENT_PRACTICE_STOP_SPECIFICATION_V1_1.md`

The copied files are intentionally unchanged from the founder-approved source documents.

## Selected foundation

- React with TypeScript for component-based, accessible interfaces.
- Vite for a small client-rendered build that can be served as static files.
- Browser Web APIs for high-resolution timing, animation-frame coordination, visibility/lifecycle detection, and local-first storage. Storage infrastructure is not implemented yet.
- Vitest, Testing Library, and jsdom for fast component and behavior tests.
- Oxlint and TypeScript project builds for static checks.
- npm with a committed lockfile for reproducible dependency installation.

This is deliberately a client-only foundation. It keeps the timing-sensitive game loop in the browser, permits free static deployment, and does not introduce accounts or server storage that Public Beta 0.1 does not require. Analytics, payments, and server functions can be added behind explicit interfaces later without putting them in the game timing path.

## Requirements fit

| Requirement | Foundation decision |
|---|---|
| Twelve browser games | React composition with shared engines and game adapters, to be designed during shared-infrastructure work |
| Timing-sensitive interaction | Direct browser timing and lifecycle APIs; no server round trips in a trial loop |
| Local history and storage | IndexedDB is the recommended persistence layer; schema, retention, deletion, and migration behavior remain implementation work |
| Responsive and accessible UI | Semantic React components, CSS, keyboard-first testing, and the binding accessibility requirements |
| Future analytics and payments | Optional consented analytics and payment/server endpoints can be added later; neither is installed or enabled |
| Free initial deployment | Vite emits static assets suitable for Cloudflare Pages Free; no host has been approved or linked |

Cloudflare Pages Free is the recommended initial host because the application is static at launch and the current free-plan limits are ample for an early beta. Vercel is technically compatible, but its Hobby plan is restricted to personal, non-commercial use, so it is not the default recommendation for a product that may later charge users.

## Commands

```sh
npm install
npm run dev
npm run build
npm run lint
npm test
npm run typecheck
npm run check
```

`npm run check` runs lint, tests, deterministic form regeneration verification, and the production build.

## Repository map

```text
.
├── AGENTS.md
├── IMPLEMENTATION_TRACKER.md
├── docs/
│   └── specifications/
├── public/
├── src/
│   ├── test/
│   ├── App.tsx
│   ├── App.css
│   ├── index.css
│   └── main.tsx
├── index.html
├── package.json
├── tsconfig*.json
└── vite.config.ts
```

`src/core/` contains the reusable shell, registry, and in-memory recorder. `src/stop/` contains frozen forms/contracts, preparation, the headless engine, browser adapters, live flow, and memory-only development drafts. Prior evidence remains in `docs/qa/m2a/VERIFICATION.md` and `docs/qa/m2b1/VERIFICATION.md`; current browser evidence is in `docs/qa/m2b2/VERIFICATION.md`.

## Before feature implementation

Read `AGENTS.md`, both binding specifications, and `IMPLEMENTATION_TRACKER.md`. Do not infer mechanics from the scaffold. Every game requires a founder-approved specification packet, and Stop requires a separate explicit implementation instruction even though its V1.1 decisions are approved.

## Still requiring founder approval

The tracker records open gates. The main setup-level choices still open are the supported browser/device matrix, approval of Cloudflare Pages or another deployment host, visual direction, product-wide local-data policy, product-wide analytics launch decision, and the remaining game specification packets.
