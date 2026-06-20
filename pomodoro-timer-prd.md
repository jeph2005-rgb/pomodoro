# Product Requirements Document — Pomodoro Timer (Next.js)

**Owner:** Jason
**Build agent:** Claude Code
**Status:** Ready to build (MVP)
**Last updated:** 2026-06-20

---

## 0. How to use this document

This PRD is written to be handed directly to Claude Code. The recommended flow is to build **phase by phase** (see §11), stopping at each phase gate to confirm that the tests pass, types check, and lint is clean before moving on. Feed Claude Code the whole document, then instruct it to begin at **Phase 0** and not advance past a gate without your confirmation.

This is a learning project (a GitHub Copilot / VS Code course exercise). There is no grading. The priorities, in order, are: (1) clean separation of logic from UI so the core is easily unit-tested, and (2) all visual decisions centralized as design tokens so a custom style can be applied after MVP as a near config-only change.

---

## 1. Overview

Build a single-page Pomodoro timer web application. The Pomodoro technique alternates focused work intervals ("focus" sessions, 25 minutes by default) with short breaks, inserting a longer break after every fourth focus session. The MVP delivers the standard, well-established feature set with a deliberately plain visual design that is structured for easy re-theming later.

### 1.1 Goals
- Implement the standard Pomodoro feature set (§4) correctly and accessibly.
- Keep all timer state-transition logic in pure, framework-agnostic functions so it is trivially unit-testable with Jest.
- Centralize every visual value (color, spacing, typography, radius) as a CSS custom property so a later theme is a token swap, not a component rewrite.
- Ship a passing test suite that satisfies the acceptance checklist in §9.

### 1.2 Non-goals (deferred to post-MVP)
Task list / to-do integration; browser or desktop notifications; statistics, history, or charts; dark mode and custom themes (the later styling pass); ambient sound / ticking / white noise; keyboard shortcuts; user accounts or cloud sync.

---

## 2. Tech stack & conventions

| Concern | Choice |
|---|---|
| Framework | Next.js (App Router) |
| Language | TypeScript (strict) |
| UI library | React (function components + hooks) |
| Styling | CSS Modules + CSS custom properties (design tokens). **No Tailwind, no CSS-in-JS.** |
| Test runner | Jest (configured via `next/jest`) |
| Component testing | React Testing Library + `@testing-library/jest-dom` + `@testing-library/user-event` |
| Test environment | `jest-environment-jsdom` |
| Package manager | npm |
| Import alias | `@/*` mapped to project root |
| `src/` directory | Not used (paths in §7 assume root-level `app/`, `components/`, etc.) |

Conventions:
- TypeScript `strict: true`. No `any` in committed code; prefer explicit types.
- Function components only. No class components.
- Interactive logic lives in **client components** (`'use client'`). Keep `app/page.tsx` as thin as possible and push interactivity down into a single client component (`PomodoroApp`).
- Co-locate component tests next to components, and logic tests next to logic modules, using `*.test.ts` / `*.test.tsx`.

---

## 3. Architecture principles (read first)

These three principles are the point of the exercise; do not deviate without flagging it.

### 3.1 Separate logic from UI
All timer state transitions live in a **pure reducer** plus **pure helper functions** in `lib/timer/`. These modules import no React, no DOM, no browser timers. They are deterministic: given a state and an action, they return the next state. This makes the meaningful logic (session sequencing, counters, long-break cadence, settings application) testable in plain Jest with no rendering and no fake timers.

The React layer (`hooks/useTimer.ts`) owns the impure concerns: the `setInterval`, playing the alert sound, and reading/writing `localStorage`. It dispatches actions into the pure reducer.

### 3.2 Centralize all visual decisions as design tokens
Every color, spacing value, font, radius, shadow, and transition is declared once as a CSS custom property in a single token block (`app/globals.css` `:root`). Component `*.module.css` files reference **only** `var(--token)` for these properties — no literal hex colors, no ad-hoc font sizes. A later custom theme is then applied by changing token values (and optionally adding a theme class), without touching component markup. See §10.

### 3.3 Client/server boundary
The root layout and page are server components. A single `'use client'` component (`PomodoroApp`) hosts the timer. This keeps the interactive surface explicit and small.

---

## 4. Functional requirements

Each requirement lists acceptance criteria. All are MVP.

**FR-1 — Session types & defaults.** Three session types: `focus` (default 25 min), `shortBreak` (default 5 min), `longBreak` (default 15 min). The app opens in `focus` at the configured focus duration, stopped.

**FR-2 — Controls.** Provide Start, Pause/Resume (one toggle control), Reset, and Skip.
- Start begins the countdown for the current session.
- Pause halts it without losing remaining time; Resume continues.
- Reset returns the current session to its full configured duration and stops.
- Skip ends the current session immediately and advances to the next session in sequence (per FR-3) **without** counting it as completed and **without** playing the alert.

**FR-3 — Session sequencing.** After a `focus` session completes, the next session is `shortBreak`, **except** that after every Nth completed focus session (N = `sessionsUntilLongBreak`, default 4) the next session is `longBreak`. After any break completes, the next session is `focus`. Completing a `longBreak` resets the cycle counter. A worked example with N=4: focus → short → focus → short → focus → short → focus → **long** → focus → …

**FR-4 — Auto-start next.** A toggle (`autoStartNext`, default off). When on, the next session begins running automatically upon completion of the current one. When off, the next session is loaded but stopped, awaiting Start.

**FR-5 — Settings panel.** The user can edit: focus / short break / long break durations (in minutes), `sessionsUntilLongBreak`, and the `autoStartNext` toggle. Settings persist (FR-10). Editing a duration updates the current session's remaining time immediately **only when the timer is idle/paused**; if running, the change applies to subsequent sessions.

- **Validation & bounds.** All numeric inputs are positive integers. Durations (minutes): min `1`, max `180`. `sessionsUntilLongBreak`: min `1`, max `12`. Validation lives in a pure helper (`lib/timer/validation.ts`, e.g. `clampSettings` / `coerceSetting`) so it is unit-testable and reused by both the reducer (`UPDATE_SETTINGS` merges only validated values) and the `SettingsPanel`. Rules: non-integer input is rounded to the nearest integer; out-of-range values are clamped to the nearest bound; empty / `NaN` / non-numeric input is **rejected** (the field falls back to the last valid value and the stored setting is left unchanged — never written as `NaN`). The reducer must never produce a `remainingSeconds`/`totalSeconds` of `0` or `NaN` from settings. Because the minimum duration is 1 minute (60 s), there is no instant-completion edge case.

**FR-6 — Session counter.** Display the number of completed focus sessions, and the position within the current cycle (e.g., "3 / 4 until long break"). Counters increment on genuine completion (FR-3), not on Skip or manual mode switches.

**FR-7 — Audio alert.** When a session completes (reaches zero), play a short alert tone. Generate the tone with the Web Audio API (a brief oscillator beep) rather than depending on an audio asset file — this keeps the repo asset-free and the alert easy to mock in tests. The alert must be triggered from the React layer, never from the pure reducer.
- **Autoplay unlock.** Browsers create an `AudioContext` in a `suspended` state until a user gesture occurs. Lazily create a single shared `AudioContext` and call `resume()` on the first user interaction (e.g. the first `Start` click) so a later alert — including one fired automatically under `autoStartNext` — is not blocked. If the context cannot be created/resumed (or the API is unavailable), fail silently: never throw and never log an error.
- **Testability.** The beep lives in `lib/audio/playAlert.ts` and is `jest.mock`-ed in tests; jsdom has no Web Audio API, so the module must guard for its absence.

**FR-8 — Countdown display & progress ring.** Show remaining time as `MM:SS` (zero-padded). Show a circular progress ring that depletes (or fills) in proportion to elapsed time within the current session. The ring's elapsed proportion is `(totalSeconds - remainingSeconds) / totalSeconds`, using the snapshotted `totalSeconds` (see §6) — never `durationFor(currentSession, settings)` — so a mid-session settings change cannot push the proportion below 0 or above 1.

**FR-9 — Manual mode switching.** Provide tabs/buttons to switch directly to `focus`, `shortBreak`, or `longBreak`. Switching sets the current session to the selected type at its full configured duration and stops the timer. It does not affect counters.

**FR-10 — Persistence.** `TimerSettings` (FR-5) persist to `localStorage` and are restored on load. The running timer state (current session, remaining seconds, run status, counters) is **in-memory only** and resets on refresh — this is intentional for the MVP.
- **Failure & corruption handling.** `useLocalStorage` must wrap every `localStorage` access in `try/catch`: if storage is unavailable (SSR, private mode, disabled, quota exceeded) or the stored JSON is missing/malformed, fall back to `DEFAULT_SETTINGS` without throwing or logging an error. Parsed settings are run through the FR-5 validator before use, so a tampered/partial payload can never inject `NaN` or out-of-range values.
- **Hydration safety.** `localStorage` is unavailable during server render, so the server and first client render **must** use `DEFAULT_SETTINGS` to avoid a React hydration mismatch (a hard gate per §5 — "no console warnings"). Persisted settings are read **after mount** (in an effect) and applied via a `HYDRATE` dispatch; do not read `localStorage` during render or in `useReducer`/`useState` initializers that run on the server.

---

## 5. Non-functional requirements

- **Accuracy / known limitation.** The MVP uses a 1-second `setInterval` driving `TICK` actions. Browser tabs throttle timers when backgrounded, so a backgrounded timer may drift or pause. This is acceptable for the MVP. A timestamp-reconciliation enhancement (recompute remaining time from a stored end-timestamp) is noted as optional Phase 5 polish.
- **Accessibility.** Use semantic HTML (`<button>` for controls, real labels for inputs). The countdown region uses `aria-live="polite"` (or `"off"` during continuous ticking with a sensible update cadence — Claude Code may choose, but the current session type and state changes must be announced). All controls are keyboard-operable and have accessible names.
- **Responsiveness.** A single centered card layout that works on mobile and desktop widths.
- **Quality gates.** No TypeScript errors (`tsc --noEmit`), no ESLint errors, no console errors/warnings during normal use, full test suite green.
- **README.** Include run/test instructions (`npm run dev`, `npm test`).

---

## 6. Data model

```ts
// lib/timer/types.ts
export type SessionType = 'focus' | 'shortBreak' | 'longBreak';

export interface TimerSettings {
  focusMinutes: number;          // default 25
  shortBreakMinutes: number;     // default 5
  longBreakMinutes: number;      // default 15
  sessionsUntilLongBreak: number; // default 4
  autoStartNext: boolean;        // default false
}

export interface TimerState {
  settings: TimerSettings;
  currentSession: SessionType;
  remainingSeconds: number;
  totalSeconds: number;           // full duration of the CURRENT session, snapshotted
                                  // when the session is loaded. The progress ring uses
                                  // (totalSeconds - remainingSeconds) / totalSeconds so
                                  // it stays correct even if settings change mid-session.
  isRunning: boolean;
  completedFocusSessions: number; // lifetime count for this page session
  cyclePosition: number;          // completed focus sessions since last long break (0..N)
  completionSignal: number;       // increments whenever ANY session completes; the
                                  // React layer watches this to fire the audio alert
}

// Initial state (before HYDRATE), built from DEFAULT_SETTINGS:
//   currentSession: 'focus', remainingSeconds = totalSeconds = durationFor('focus', DEFAULT_SETTINGS),
//   isRunning: false, completedFocusSessions: 0, cyclePosition: 0, completionSignal: 0.

export type TimerAction =
  | { type: 'HYDRATE'; settings: TimerSettings }
  | { type: 'START' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'RESET' }
  | { type: 'SKIP' }
  | { type: 'TICK' }
  | { type: 'CHANGE_MODE'; session: SessionType }
  | { type: 'UPDATE_SETTINGS'; settings: Partial<TimerSettings> };
```

Notes:
- `completionSignal` is the clean way to keep the reducer pure while still letting the hook play a sound exactly once per completion (the hook runs an effect keyed on this number).
- Helper `durationFor(session, settings): number` returns seconds for a session type.

---

## 7. Proposed file structure

```
app/
  layout.tsx
  page.tsx                 // server component; renders <PomodoroApp />
  globals.css              // design tokens (:root) + base reset
components/
  PomodoroApp.tsx          // 'use client'; composes UI, calls useTimer()
  PomodoroApp.module.css
  TimerDisplay.tsx         // MM:SS text
  TimerDisplay.module.css
  ProgressRing.tsx         // SVG circular progress
  ProgressRing.module.css
  Controls.tsx             // Start / Pause-Resume / Reset / Skip
  Controls.module.css
  ModeTabs.tsx             // focus / shortBreak / longBreak switch
  ModeTabs.module.css
  SettingsPanel.tsx        // duration + N + autoStart inputs
  SettingsPanel.module.css
hooks/
  useTimer.ts              // interval, dispatch, audio effect, persistence wiring
  useLocalStorage.ts       // generic typed localStorage hook
lib/
  timer/
    types.ts
    constants.ts           // DEFAULT_SETTINGS, storage key, min/max bounds
    format.ts              // formatTime()
    sequencing.ts          // getNextSession(), durationFor()
    validation.ts          // clampSettings()/coerceSetting() (FR-5 bounds)
    reducer.ts             // pure timerReducer()
    index.ts               // re-exports
  audio/
    playAlert.ts           // Web Audio API beep (mockable)
jest.config.ts
jest.setup.ts              // imports '@testing-library/jest-dom'
README.md
```

---

## 8. Pure timer logic spec (`lib/timer/`)

### 8.1 `format.ts`
`formatTime(totalSeconds: number): string` → zero-padded `MM:SS`. Negatives clamp to `"00:00"`. Non-integer input is floored. Minutes are zero-padded to **at least** two digits but may exceed two when needed (the 180-minute max yields `"180:00"`). Examples: `0 → "00:00"`, `5 → "00:05"`, `65 → "01:05"`, `1500 → "25:00"`, `10800 → "180:00"`.

### 8.2 `sequencing.ts`
- `durationFor(session, settings): number` → seconds for the given session type.
- `getNextSession(state, opts: { counted: boolean }): SessionType` → applies FR-3. From `shortBreak` or `longBreak`: returns `focus`. From `focus`:
  - When `counted: true` (a genuine completion via TICK): return `longBreak` if this completion brings the cycle to the threshold — i.e. `cyclePosition + 1 >= sessionsUntilLongBreak` — else `shortBreak`.
  - When `counted: false` (a SKIP, which does **not** advance the cycle per FR-3): the long-break decision must **not** be based on a phantom increment. Use the current `cyclePosition` only — i.e. return `longBreak` only if `cyclePosition >= sessionsUntilLongBreak` (normally never true mid-cycle, so a skipped focus advances to `shortBreak`). This prevents skipping the would-be-Nth focus from jumping to a long break that was never earned.

### 8.3 `reducer.ts` — `timerReducer(state, action): TimerState`

Whenever an action loads a new session (or restores the current one to full), it sets **both** `remainingSeconds` and `totalSeconds` to `durationFor(...)`. `totalSeconds` is the ring's stable denominator and only changes when a fresh session is loaded — never on a plain `TICK`.

Behavior per action:

- **HYDRATE** — replace `settings`; set `remainingSeconds = totalSeconds = durationFor(currentSession, newSettings)`; `isRunning = false`. Used to apply persisted settings on mount.
- **START / RESUME** — `isRunning = true` (no other changes).
- **PAUSE** — `isRunning = false`.
- **RESET** — `remainingSeconds = totalSeconds = durationFor(currentSession, settings)`; `isRunning = false`. Counters unchanged.
- **CHANGE_MODE** — set `currentSession = action.session`; `remainingSeconds = totalSeconds = durationFor(action.session, settings)`; `isRunning = false`. Counters unchanged.
- **SKIP** — compute `next = getNextSession(state, { counted: false })` (see §8.2: a skip never counts toward the long-break threshold); set `currentSession = next`; `remainingSeconds = totalSeconds = durationFor(next, settings)`; `isRunning = false`. **No** counter changes, **no** `completionSignal` change.
- **UPDATE_SETTINGS** — merge `action.settings` into `settings` (after validation — see FR-5). If `isRunning` is false, also set `remainingSeconds = totalSeconds = durationFor(currentSession, mergedSettings)` so an idle/paused timer reflects the new duration immediately. If running, leave `remainingSeconds` **and** `totalSeconds` alone (the in-progress session keeps its original total, so the ring stays consistent; the new duration applies to subsequent sessions).
- **TICK** — the core transition. Guard: if `!isRunning`, return state unchanged.
  - If `remainingSeconds > 1`: `remainingSeconds -= 1` (`totalSeconds` unchanged).
  - If `remainingSeconds <= 1` (this tick completes the session — the clock reaches `00:00` and then the next session is loaded in the same transition; the display never holds a stalled `00:00`):
    - Determine `wasFocus = currentSession === 'focus'`.
    - Compute `next = getNextSession(state, { counted: true })`.
    - Increment `completionSignal`.
    - If `wasFocus`: `completedFocusSessions += 1`; `cyclePosition += 1`.
    - If the completing session is `longBreak`: reset `cyclePosition = 0`.
    - Set `currentSession = next`; `remainingSeconds = totalSeconds = durationFor(next, settings)`.
    - Set `isRunning = settings.autoStartNext`.

The reducer is pure: it never plays sound, never touches `localStorage`, never starts a timer.

---

## 9. Acceptance test checklist

Implement Jest tests covering every item below. Group 9.1 is pure-logic (no React, no fake timers). Group 9.2 uses React Testing Library with `jest.useFakeTimers()` and mocks for audio and `localStorage`. Use the `it(...)` descriptions as the spec; Claude Code writes the implementations.

### 9.1 Pure logic (`lib/timer/*.test.ts`)

`formatTime`:
- `it('formats 0 as 00:00')`
- `it('zero-pads seconds: 5 → 00:05')`
- `it('formats 65 as 01:05')`
- `it('formats 1500 as 25:00')`
- `it('clamps negatives to 00:00')`

`sequencing`:
- `it('returns the configured duration in seconds for each session type')`
- `it('goes focus → shortBreak before the long-break threshold')`
- `it('goes focus → longBreak on the Nth focus session (N=4)')`
- `it('goes shortBreak → focus')`
- `it('goes longBreak → focus')`
- `it('with counted:false (skip), does NOT advance focus to longBreak at the threshold')`

`validation` (`lib/timer/validation.test.ts`):
- `it('clamps durations below 1 and above 180 to the nearest bound')`
- `it('clamps sessionsUntilLongBreak to the 1..12 range')`
- `it('rounds non-integer input to the nearest integer')`
- `it('rejects NaN/empty/non-numeric input, leaving the prior value unchanged')`

`reducer`:
- `it('START and RESUME set isRunning true; PAUSE sets it false')`
- `it('RESET restores remaining to the full session duration and stops')`
- `it('TICK decrements remainingSeconds by one')`
- `it('completing a focus session increments completedFocusSessions and cyclePosition')`
- `it('completing a session increments completionSignal')`
- `it('completing the 4th focus session transitions to longBreak')`
- `it('completing a longBreak resets cyclePosition to 0')`
- `it('respects autoStartNext: isRunning is true after completion when enabled, false when disabled')`
- `it('CHANGE_MODE switches type, resets remaining, and stops without touching counters')`
- `it('SKIP advances to the next session without incrementing counters or completionSignal')`
- `it('UPDATE_SETTINGS merges settings and updates current remaining when idle')`
- `it('UPDATE_SETTINGS does not change remaining or totalSeconds while running')`
- `it('loading a session sets totalSeconds equal to its full duration')`
- `it('TICK does not change totalSeconds (ring denominator stays stable)')`
- `it('TICK is a no-op when isRunning is false')`
- `it('SKIP at the long-break threshold advances to shortBreak, not longBreak')`
- `it('HYDRATE applies persisted settings and resets remaining for the current session')`

### 9.2 Components / integration (`components/*.test.tsx`)

Setup: `jest.useFakeTimers()`; mock `lib/audio/playAlert`; ensure `localStorage` is cleared between tests.

- `it('renders the default focus session at 25:00 with three mode tabs')`
- `it('counts down after Start: +1s → 24:59, +60s → 24:00')` (advance fake timers)
- `it('Pause halts the countdown and Resume continues it')`
- `it('Reset returns to 25:00 and stops')`
- `it('selecting the Short Break tab shows 05:00 and stops')`
- `it('plays the alert when a session completes')` (set a short duration, advance to zero, assert the audio mock was called once)
- `it('auto-start off: the next session is loaded but not running after completion')`
- `it('auto-start on: the next session starts running automatically')`
- `it('changing focus minutes in settings updates the display and writes to localStorage')`
- `it('rejects an out-of-range / empty duration input without writing NaN to localStorage')`
- `it('falls back to defaults when localStorage is unavailable or holds malformed JSON')` (mock `getItem` to throw / return bad data)
- `it('restores persisted settings on mount')` (seed localStorage, mount, assert)
- `it('increments the completed-focus counter after a focus session completes')`
- `it('the progress ring reflects elapsed proportion')` (assert via the SVG attribute/style the component uses)

### 9.3 Jest configuration expectations
- Configure Jest through `next/jest`.
- `testEnvironment: 'jest-environment-jsdom'`.
- `jest.setup.ts` imports `@testing-library/jest-dom`; reference it via `setupFilesAfterEnv`.
- Audio is mockable because the alert lives in its own module (`lib/audio/playAlert.ts`); tests `jest.mock` it.
- Use fake timers for any test that advances the countdown; restore real timers in teardown.

---

## 10. Styling & design-token requirements

### 10.1 Token source of truth
Declare all tokens once in `app/globals.css` under `:root`. Component `*.module.css` files reference these tokens via `var(--…)` for color, spacing, typography, radius, shadow, and transition. **No literal hex values and no hard-coded font sizes in component CSS.** Layout-specific pixel values (e.g., ring dimensions) are allowed but prefer spacing tokens where reasonable.

### 10.2 Required token categories (names are a baseline; expand as needed)
- **Color:** `--color-bg`, `--color-surface`, `--color-text`, `--color-text-muted`, `--color-border`, `--color-primary`, `--color-primary-contrast`, `--color-success`, `--color-danger`, plus per-mode accents `--color-focus`, `--color-short-break`, `--color-long-break`.
- **Per-mode theming hook:** the app's root container carries `data-mode="focus|shortBreak|longBreak"`. In CSS, `[data-mode="focus"] { --accent: var(--color-focus); }` (and so on), and components use `var(--accent)` for the active accent. This lets a later theme re-skin per-mode color in one place.
- **Spacing:** a numeric scale, e.g. `--space-1 … --space-8`.
- **Typography:** `--font-sans`, `--font-mono` (use mono for the countdown), and a size scale `--text-sm … --text-xl` plus `--text-timer` for the large clock.
- **Radius:** `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-full`.
- **Shadow:** `--shadow-sm`, `--shadow-md`.
- **Transition:** `--transition-fast`, `--transition-base`.

### 10.3 MVP visual intent
Plain, clean, and deliberately minimal: a single centered card containing the mode tabs, the progress ring with the `MM:SS` clock inside it, the control buttons, the cycle counter, and an expand/collapse settings panel. The goal is correct structure and clear hierarchy, not visual flourish — the custom style comes later and should require only token edits plus, at most, light markup additions.

---

## 11. Build phases (gated)

Advance only when the phase gate passes. Gate for every phase: `tsc --noEmit` clean, ESLint clean, `npm test` green.

- **Phase 0 — Scaffold. ✅ COMPLETE (2026-06-20).** The Next.js app (App Router, TypeScript, ESLint, `@/*` alias, no `src/`) is scaffolded and was reconciled to this PRD: Tailwind removed (no `postcss.config.mjs`; `globals.css` is a plain reset), `ts-jest` replaced by `next/jest`, and RTL + `@testing-library/jest-dom` + `@testing-library/dom` + `user-event` + `ts-node` installed. `jest.config.ts` (next/jest, jsdom, `@/*` mapper) and `jest.setup.ts` exist; a trivial `__tests__/page.test.tsx` passes. Gate verified green: `tsc --noEmit` clean, ESLint clean, `npm test` green. **Begin work at Phase 1.**
- **Phase 1 — Pure logic (TDD).** Implement `types.ts`, `constants.ts`, `format.ts`, `sequencing.ts`, `reducer.ts`. Write the §9.1 tests first (or alongside) and make them all pass. No React yet. **Gate.**
- **Phase 2 — Hooks.** Implement `useLocalStorage`, `lib/audio/playAlert.ts`, and `useTimer` (owns the `setInterval` dispatching `TICK`, fires the audio effect keyed on `completionSignal`, hydrates settings from storage and persists changes). **Gate.**
- **Phase 3 — Core UI.** Implement `TimerDisplay`, `ProgressRing`, `Controls`, `ModeTabs`, and `PomodoroApp` wired to `useTimer`. Add the §9.2 tests for countdown, pause/resume, reset, mode switching, and the alert. **Gate.**
- **Phase 4 — Settings & persistence.** Implement `SettingsPanel`; wire duration / N / auto-start edits through `UPDATE_SETTINGS` and persistence. Add the §9.2 settings, persistence, auto-start, and counter tests. **Gate.**
- **Phase 5 — Tokens, a11y, polish.** Extract/confirm all design tokens in `globals.css`; ensure components reference tokens only; add the per-mode `data-mode` accent hook; address accessibility (labels, `aria-live`, keyboard). Optional: timestamp-reconciliation for background-tab accuracy. Final full test run and a coverage check (target: **≥ 90 %** statements/branches for `lib/timer/**`, which is pure and fully testable; the React/UI layers are exercised by the §9.2 suite but not held to a hard number). Write `README.md`. **Gate.**

---

## 12. Definition of done
- All FR-1 … FR-10 implemented.
- Every acceptance test in §9 implemented and passing; `lib/timer/**` meets the §11 Phase 5 coverage target.
- No TypeScript or ESLint errors; no console errors **or warnings** (including React hydration warnings) in normal use.
- Settings are validated to FR-5 bounds; `localStorage` never stores `NaN`/out-of-range values and never throws on read/write failure.
- The progress ring stays within `[0, 1]` even when settings change mid-session (driven by `totalSeconds`, §6).
- Settings persist across refresh; running timer is in-memory per §FR-10.
- All design tokens centralized in `app/globals.css`; no literal colors/font sizes in component CSS.
- `README.md` documents `npm run dev` and `npm test`.
- App runs locally and behaves per the worked sequencing example in FR-3.
