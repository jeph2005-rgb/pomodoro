# Pomodoro Timer

A minimal, accessible Pomodoro timer built with Next.js 16 (App Router) and React 19. It runs focus / short-break / long-break sessions with a circular progress ring, a session counter, configurable durations, optional auto-start of the next session, and an audio alert (plus a screen-reader announcement) on each completion. Settings persist to `localStorage`.

## Run

```bash
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Test

```bash
npm test          # run the Jest suite once
npm run test:watch # watch mode
```

Run a single file or filter by name:

```bash
npx jest path/to/file.test.ts
npx jest -t "name"
```

## Build

```bash
npm run build   # production build
npm run start   # serve the production build
npm run lint    # ESLint (eslint-config-next)
```

## Architecture

- **`lib/timer/`** — the pure core. A reducer (`reducer.ts`) plus pure helpers for session sequencing, time formatting, and settings validation/clamping. No side effects, no React; fully unit-tested (100% statements, ~99% branches).
- **`hooks/useTimer.ts`** — the single impure orchestrator. Owns the 1-second interval, fires the audio alert on completion, and reads/writes `localStorage`. The reducer stays pure; all effects live here.
- **`components/`** — presentational React components (`PomodoroApp` composes the rest). Each ships a co-located `*.module.css`.
- **`app/globals.css`** — design tokens (color, spacing, typography, radius, shadow, transition) defined once as CSS custom properties on `:root`, plus a per-mode `[data-mode]` `--accent` hook. Component CSS Modules reference only `var(--token)` for these values.

**Styling:** CSS Modules + design tokens. No Tailwind, no CSS-in-JS. A future theme is a token swap, not a component rewrite.

**Accessibility:** semantic HTML throughout (native buttons/inputs with associated labels), a visible `:focus-visible` ring on all interactive elements, a labelled segmented control for mode switching (`aria-pressed`), and a polite `role="status"` live region that announces session transitions for screen-reader users.
