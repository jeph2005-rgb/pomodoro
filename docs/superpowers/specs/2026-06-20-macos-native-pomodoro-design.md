# Design Spec — Pomodoro Timer as a native macOS app (SwiftUI)

**Owner:** Jason
**Author:** Claude (software engineer/architect)
**Date:** 2026-06-20
**Status:** Approved design — ready to turn into an implementation plan
**Supersedes (UI/runtime):** the Next.js web prototype. Functional behavior continues to be governed by `pomodoro-timer-prd.md` (FR-1…FR-10), which both apps share.

---

## 1. Overview

Convert the working Next.js/React Pomodoro prototype into a standalone native **macOS app written in Swift/SwiftUI**. The rewrite keeps the prototype's clean layering (pure logic ↔ side effects ↔ UI) but re-homes each layer onto native technology. This eliminates the browser-timer **drift** (background-tab throttling) by moving timing to wall-clock timestamps, and makes the **audio alert (FR-7)** trivially reliable via native sound.

### 1.1 Why native (decision record)
Selected **native SwiftUI** over Tauri (web UI in a Rust shell) and Electron (Chromium). Given the confirmed constraints — personal use, **menu-bar + window**, **replacing** the web app, optimize for **best result** — native wins decisively: drift-free timing, a true menu-bar countdown, reliable native sound/notifications, tiny footprint, best battery, no bundled runtime. Tauri/Electron's main advantage (reusing the React UI / keeping a web build) is explicitly not needed here.

### 1.2 Confirmed decisions
- **Distribution:** personal only — runs locally from Xcode or as an exported `.app`. **No notarization / Developer ID / App Store** required.
- **Form factor:** **both** — a menu-bar countdown (`MenuBarExtra`) *and* a full app window.
- **Web app:** **replaced.** The Next.js prototype is moved aside (retained in git history), not actively maintained.
- **Language:** Swift. Only the small, well-specified logic core is "ported"; the UI is reimplemented in SwiftUI.
- **Repo layout:** the Xcode project lives under `/PomodoroTimer` in this repo; the web prototype is moved to `/web-prototype` (or removed, relying on git history).
- **macOS target:** **14+** (`MenuBarExtra` and `SMAppService` require 13+; the dev Mac is current).
- **Launch-at-login:** included as an optional user toggle.
- **Build tool:** **Xcode** (SwiftUI previews, entitlements, signing). The spec and implementation plan can be authored in VS Code; Xcode is only needed once Phase 1 scaffolds the project.

### 1.3 Goals
- Full parity with FR-1…FR-10 of the PRD.
- **Drift-free timing** via timestamp reconciliation (accurate through background, sleep, and wake).
- **Reliable completion alert**: native sound + a system notification.
- Keep the genuinely valuable, tested logic (session sequencing, counters, settings validation) intact and unit-tested.

### 1.4 Non-goals (unchanged from PRD, YAGNI)
Stats/history/charts; custom themes; ambient sound; global hotkeys; accounts/cloud sync. (All remain easy to add later.)

---

## 2. Architecture — three layers

The prototype's separation is preserved one-to-one.

### Layer 1 — `TimerCore` (pure Swift; no UI, no real timers, no I/O)
A direct port of `lib/timer/`. Deterministic value types + pure functions. This is the part that carries the proven rules and the test coverage.

```swift
enum SessionType { case focus, shortBreak, longBreak }

struct TimerSettings: Codable, Equatable {
    var focusMinutes: Int          // default 25
    var shortBreakMinutes: Int     // default 5
    var longBreakMinutes: Int      // default 15
    var sessionsUntilLongBreak: Int // default 4
    var autoStartNext: Bool        // default false
}

struct TimerState: Equatable {
    var settings: TimerSettings
    var currentSession: SessionType
    var remainingSeconds: Int      // authoritative display value (fed by the engine from timestamps while running)
    var totalSeconds: Int          // full duration of the current session (progress-ring denominator)
    var isRunning: Bool
    var completedFocusSessions: Int
    var cyclePosition: Int         // completed focus sessions since last long break (0..N)
    var completionCount: Int       // increments on ANY session completion; the engine observes it to fire sound/notification
}

enum TimerAction {
    case hydrate(TimerSettings)
    case start, pause, resume, reset, skip
    case tick(remaining: Int)      // timestamp-fed update; performs the completion transition when remaining <= 0
    case changeMode(SessionType)
    case updateSettings(SettingsPatch)   // SettingsPatch = optional fields, validated via clampSettings
}
```

Pure functions (mirror the web core exactly):
- `durationFor(_ session: SessionType, _ settings: TimerSettings) -> Int` (minutes × 60)
- `nextSession(_ state: TimerState, counted: Bool) -> SessionType` — FR-3; `counted:false` (skip) must not earn a long break at the threshold; leaving a `longBreak` (complete *or* skip) resets the cycle.
- `clampSettings(_ patch: SettingsPatch, current: TimerSettings) -> TimerSettings` — durations 1…180, `sessionsUntilLongBreak` 1…12, round non-integers, reject NaN/empty (keep prior).
- `formatTime(_ seconds: Int) -> String` — zero-padded `MM:SS`, clamps negatives, minutes may exceed two digits.
- `reduce(_ state: TimerState, _ action: TimerAction) -> TimerState` — pure; never plays sound, touches persistence, or starts timers.

**Key change from the web core — timing leaves the reducer.** Instead of a `TICK` that decrements by one, the engine computes the remaining seconds from a wall-clock timestamp and feeds it in via `.tick(remaining:)`. The reducer's `.tick` sets `remainingSeconds` and, **when `remaining <= 0`, performs the same completion transition we already built and tested**: increment `completionCount`; if the completing session was `focus`, increment `completedFocusSessions` and `cyclePosition`; if it was `longBreak`, reset `cyclePosition`; set `currentSession = nextSession(state, counted: true)`; set `remainingSeconds = totalSeconds = durationFor(next)`; set `isRunning = settings.autoStartNext`. All other actions behave as in the web reducer (start/resume set running; pause stops; reset/changeMode/skip set the session to full duration and stop, with skip's no-counter / cycle-reset-on-longBreak rule; `updateSettings` clamps and, when idle, refreshes `remaining`/`total`, while running leaves them).

### Layer 2 — `TimerEngine` (the side-effecting store; `@Observable` / `ObservableObject`)
The single impure orchestrator. Holds the current `TimerState`, exposes intent methods to the UI (`start/pause/resume/reset/skip/changeMode/updateSettings`), and owns:

- **Timing (the drift fix):**
  - On `start`/`resume`: set `endDate = now() + remainingSeconds`; start a display timer.
  - Display timer (~every 0.25–1 s) **and** on app-activate / wake-from-sleep: compute `remaining = max(0, Int(ceil(endDate − now())))` and dispatch `.tick(remaining:)`. Because remaining is always recomputed from `endDate`, late or coalesced timer fires never accumulate error — accurate through background and sleep.
  - On completion (detected via `completionCount` change): fire sound + notification; if the new state `isRunning` (auto-start), set the next `endDate = now() + remainingSeconds`; otherwise stop the display timer.
  - On `pause`: stop the display timer; `remainingSeconds` already holds the frozen value (no `endDate`).
  - On `reset`/`skip`/`changeMode`: stop the display timer; clear `endDate`.
- **Sound (FR-7):** play a short native sound (`NSSound` with a system sound or a small bundled asset) on completion. No autoplay/suspend issues.
- **Notifications:** post a `UNUserNotificationCenter` banner on completion (e.g. "Focus complete — short break started"), valuable when the window is hidden. Request authorization on first run.
- **Persistence (FR-10):** load/save `TimerSettings` to `UserDefaults` (Codable). Running timer state stays in-memory (resets on relaunch), matching the PRD. *(Optional, noted not built: persisting `endDate` to survive relaunch.)*
- **Launch-at-login:** optional toggle via `SMAppService.mainApp`.
- **Injectable clock:** the engine takes a `now: () -> Date` dependency so all timing is deterministically unit-testable (the native analog of the web app's fake timers).

### Layer 3 — UI (SwiftUI)
Two surfaces, both reading the same `TimerEngine` state:
- **`MenuBarExtra`** — a live `MM:SS` label in the menu bar (+ optional small mode glyph) and a compact menu: Start/Pause-Resume, Skip, Reset, mode switch, "Open window".
- **Main `Window`** — full UI mirroring the web app.

---

## 3. UI components (SwiftUI) — mapping from the web app

| Web component | SwiftUI equivalent | Notes |
|---|---|---|
| `PomodoroApp` | `TimerWindowView` + `@main App` | Composes the window; the app wires `MenuBarExtra` + `Window`. |
| `TimerDisplay` | `TimerDisplayView` | `formatTime(remaining)`, monospaced font. |
| `ProgressRing` | `ProgressRingView` | `Circle().trim(from: 0, to: elapsedFraction)`; fraction = `(total − remaining) / total`, clamped [0,1], using `totalSeconds`. |
| `Controls` | `ControlsView` | Start / Pause-Resume toggle / Reset / Skip. |
| `ModeTabs` | `ModeTabsView` | Segmented `Picker` or button group → `changeMode`. |
| `SettingsPanel` | `SettingsView` | `Stepper`/`TextField` durations + N, `Toggle` auto-start, `Toggle` launch-at-login; values validated via `clampSettings`. |
| `SessionCounter` | `SessionCounterView` | Completed focus count + "x / N until long break". |
| design tokens (`globals.css`) | `Theme.swift` / Asset Catalog colors | Per-mode accent derived from `currentSession`. |
| menu bar (new) | `MenuBarLabel`, `MenuContent` | Live countdown + quick actions. |

Accessibility: SwiftUI controls are accessible by default; preserve clear labels, the timer's value, and full keyboard operability (parity with the web app's a11y intent).

---

## 4. Functional requirements → native mapping

All FR-1…FR-10 carry over; only the *mechanism* changes where noted.

- **FR-1/FR-3/FR-6 (session types, sequencing, counters):** unchanged — live in `TimerCore`, identical rules.
- **FR-2 (controls):** native buttons in window + menu bar.
- **FR-4 (auto-start):** reducer sets `isRunning` on completion; engine sets the next `endDate` when auto-starting.
- **FR-5 (settings + validation):** `SettingsView` → `updateSettings` → `clampSettings`; controlled values revert invalid input to the last valid value.
- **FR-7 (audio):** native sound + notification on completion. **This is the concrete fix for the alert that didn't work in the browser.**
- **FR-8 (MM:SS + ring):** `TimerDisplayView` + `ProgressRingView` using `totalSeconds` denominator.
- **FR-9 (manual mode switch):** `changeMode` (stops, full duration, counters untouched).
- **FR-10 (persistence):** settings in `UserDefaults`; running state in-memory.
- **Non-functional — accuracy:** the PRD's §5 "known drift" is now *solved*, not deferred, via timestamp reconciliation.

---

## 5. Project structure

```
PomodoroTimer/                       # Xcode macOS app target (Swift, SwiftUI)
  PomodoroTimerApp.swift             # @main App: MenuBarExtra + Window scenes
  Core/                              # TimerCore — pure; ideally its own local Swift Package for isolation/testability
    SessionType.swift
    TimerSettings.swift
    TimerState.swift
    Sequencing.swift                 # durationFor, nextSession(counted:)
    Validation.swift                 # clampSettings, SettingsPatch
    Format.swift                     # formatTime
    Reducer.swift                    # reduce(state, action)
  App/
    TimerEngine.swift                # @Observable store: timestamps, sound, notifications, persistence, login item; injectable clock
    Sound.swift
    Notifications.swift
    SettingsStore.swift              # UserDefaults read/write
    LoginItem.swift                  # SMAppService (optional)
  UI/
    MenuBarLabel.swift
    MenuContent.swift
    TimerWindowView.swift
    ModeTabsView.swift
    ProgressRingView.swift
    TimerDisplayView.swift
    ControlsView.swift
    SettingsView.swift
    SessionCounterView.swift
    Theme.swift
  Resources/                         # sound asset, AppIcon, Info.plist, entitlements
PomodoroTimerTests/                  # XCTest
  Core tests (port the 92 web cases)
  Engine timing tests (clock-injected)
```

---

## 6. Testing strategy

- **`TimerCore`:** port the existing **92 test cases** to XCTest — `formatTime`, sequencing (incl. the skip-at-threshold rule), validation (clamp/round/reject), and the reducer (completion increments counters/`completionCount`, long-break resets `cyclePosition`, skip rules, `updateSettings` idle-vs-running, `totalSeconds` invariants). Hold the core to ≥90% coverage.
- **`TimerEngine`:** inject a fake clock; advance `Date` to assert: countdown reaches 0 and completes; auto-start sets the next `endDate`; pause/resume preserve remaining; wake/recompute yields correct remaining after a simulated jump (the drift regression test). No real waiting.
- **UI:** light SwiftUI smoke tests / previews; the heavy logic lives below the UI by design.

---

## 7. Build phases (gated; mirrors how the web app was built)

Each phase gate: builds clean, all tests green.

- **Phase 1 — Scaffold + `TimerCore` (TDD).** Create the Xcode project (macOS app, SwiftUI, target 14+). Implement `TimerCore` and port the 92 logic tests. *(First point that requires Xcode.)* **Gate.**
- **Phase 2 — `TimerEngine`.** Timestamp timing with injectable clock; settings persistence (`UserDefaults`). Clock-injected timing tests, including the drift/wake regression test. **Gate.**
- **Phase 3 — Main window UI.** `TimerWindowView` with mode tabs, progress ring, clock, controls, session counter, wired to the engine. **Gate.**
- **Phase 4 — Menu-bar app.** `MenuBarExtra` live countdown + menu; window/menu-bar integration; app lifecycle (activate/wake recompute). **Gate.**
- **Phase 5 — Settings, sound, notifications, polish.** `SettingsView`; native sound + completion notification; optional launch-at-login; app icon; accessibility pass. **Gate.**

---

## 8. Risks & mitigations

- **`MenuBarExtra` label refreshing each second:** works via observed state; if a rendering quirk appears, fall back to AppKit `NSStatusItem` (rock-solid). Low risk.
- **Notification permission:** first-run authorization prompt is expected; the app must behave fine if denied (sound still plays).
- **Toolchain shift:** Xcode is required from Phase 1 onward — a change from the current VS Code web workflow. (User is installing Xcode.)
- **Sleep/space edge cases:** covered by recomputing `remaining` from `endDate` on activate/wake rather than trusting timer ticks.

---

## 9. Definition of done

- FR-1…FR-10 implemented natively; behavior matches the PRD and the web app's worked sequencing example.
- Timing is accurate across background, sleep, and wake (no drift); verified by the clock-injected regression test.
- Completion plays an audible native sound **and** posts a notification.
- Menu-bar countdown and the main window both reflect live state and controls work from each.
- Settings validate to bounds and persist across relaunch; running state is in-memory.
- `TimerCore` tests (ported 92 cases) and engine timing tests pass; core coverage ≥90%.
- App builds and runs locally on the dev Mac (no signing/notarization needed).
- Web prototype retired to `/web-prototype` (or removed; preserved in git history).
