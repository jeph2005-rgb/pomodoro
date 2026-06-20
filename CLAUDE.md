# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

> ⚠️ Per `AGENTS.md` above: this is Next.js **16.2.9**, which diverges from training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing code, and heed deprecation notices.

## Commands

- `npm run dev` — start the dev server at http://localhost:3000
- `npm run build` — production build
- `npm run start` — serve the production build
- `npm run lint` — ESLint (flat config, `eslint-config-next` core-web-vitals + typescript)
- `npm test` / `npx jest` — run the Jest suite; `npm run test:watch` for watch mode
- `npx jest path/to/file.test.ts` — run a single test file; `npx jest -t "name"` to filter by test name

## Stack & architecture

- **Next.js 16 App Router** — routes live under `app/`. `layout.tsx` is the root layout; `page.tsx` is the home route. Server Components by default; add `"use client"` for client interactivity.
- **React 19**, **TypeScript** (strict). Path alias **`@/*` → `./*`** (see `tsconfig.json`).
- **Styling: CSS Modules + design tokens — no Tailwind, no CSS-in-JS.** All visual values (color, spacing, typography, radius, shadow, transition) are defined once as CSS custom properties on `:root` in `app/globals.css`, with a per-mode `[data-mode]` `--accent` hook. Component `*.module.css` files reference **only** `var(--token)` for these values (1px borders and layout geometry like the ring are the allowed exceptions).
- **Layering:**
  - `lib/timer/` — the pure core: reducer + helpers (sequencing, time formatting, settings validation/clamping). No React, no side effects; fully unit-tested.
  - `hooks/useTimer.ts` — the single impure orchestrator: owns the 1s interval, fires the audio alert on completion, and persists settings to `localStorage`.
  - `components/` — presentational React, each with a co-located `*.module.css`; `PomodoroApp` composes the rest.

## Testing

Jest is configured via **`next/jest`** (see `jest.config.ts` / `jest.setup.ts`) with the jsdom environment, React Testing Library, jest-dom, and user-event. Run with `npm test`. Keep the pure `lib/timer/**` at ≥90% statements/branches; don't chase a hard coverage number in the React/UI layers.
