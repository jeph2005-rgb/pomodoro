# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

> ⚠️ Per `AGENTS.md` above: this is Next.js **16.2.9**, which diverges from training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing code, and heed deprecation notices.

## Commands

- `npm run dev` — start the dev server at http://localhost:3000
- `npm run build` — production build
- `npm run start` — serve the production build
- `npm run lint` — ESLint (flat config, `eslint-config-next` core-web-vitals + typescript)
- `npx jest` — run tests (see caveat below)
- `npx jest path/to/file.test.ts` — run a single test file; `npx jest -t "name"` to filter by test name

## Stack & architecture

- **Next.js 16 App Router** — routes live under `app/`. `layout.tsx` is the root layout; `page.tsx` is the home route. Server Components by default; add `"use client"` for client interactivity.
- **React 19**, **TypeScript** (strict), **Tailwind CSS v4** (via `@tailwindcss/postcss`, configured in `postcss.config.mjs`; global styles in `app/globals.css`).
- Path alias **`@/*` → `./*`** (see `tsconfig.json`).
- The app is currently the unmodified `create-next-app` starter — `app/page.tsx` still shows the template content. The Pomodoro timer feature has not been built yet.

## Testing caveat

Jest 30 + `ts-jest` + `jest-environment-jsdom` are installed as devDependencies, but **not yet configured**: there is no `test` script in `package.json` and no `jest.config.*`. Before relying on tests, add a `jest.config.ts` (ts-jest preset, `jsdom` environment) and a `"test": "jest"` script.
