# Native macOS Pomodoro (SwiftUI) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Pomodoro timer as a standalone native macOS app (menu-bar countdown + window) that is drift-free and has a reliable completion alert.

**Architecture:** Three layers mirroring the retired web app — a pure `TimerCore` (value types + reducer), a side-effecting `TimerEngine` (`@Observable`; wall-clock timestamp timing, sound, notifications, persistence; injectable clock), and a SwiftUI UI (`MenuBarExtra` + `Window`). Timing uses a stored `endDate` recomputed from `Date()` so it stays exact through background/sleep. Full design: `docs/superpowers/specs/2026-06-20-macos-native-pomodoro-design.md`; shared functional requirements: `pomodoro-timer-prd.md` (FR-1…FR-10).

**Tech Stack:** Swift 5.9+, SwiftUI, Observation (`@Observable`), XCTest + XCUITest, XcodeGen (project generation), `xcodebuild` (build/test), macOS 14+ target.

---

## Prerequisites & environment

- **Phases 0 is doable in VS Code.** **Phase 1 onward requires Xcode + Command Line Tools** (`xcode-select --install`) and **XcodeGen** (`brew install xcodegen`).
- All paths below are relative to the git repo root (`.../Pomodoro_Timer/pomodoro`).
- Build: `xcodebuild -project PomodoroTimer/PomodoroTimer.xcodeproj -scheme PomodoroTimer -destination 'platform=macOS' build`
- Test (all): `xcodebuild -project PomodoroTimer/PomodoroTimer.xcodeproj -scheme PomodoroTimer -destination 'platform=macOS' test`
- Test (single): append `-only-testing:PomodoroTimerTests/<Suite>/<testMethod>`
- Regenerate project after editing `project.yml`: `cd PomodoroTimer && xcodegen generate`
- First UI-test run may prompt to grant the test runner Accessibility/Automation permission — approve it.

## File structure (created across the plan)

```
web-prototype/                         # the retired Next.js app (moved in Phase 0)
PomodoroTimer/
  project.yml                          # XcodeGen project definition
  PomodoroTimer.xcodeproj              # generated (gitignored or committed; we commit it)
  Sources/
    App/
      PomodoroTimerApp.swift           # @main: Window + MenuBarExtra; builds the engine (uiTestMode-aware)
      MenuBarLabel.swift
      MenuContent.swift
    Core/                              # pure TimerCore
      SessionType.swift
      TimerSettings.swift              # TimerSettings, SettingsBounds, SettingsPatch
      TimerState.swift                 # TimerState (+ initial), TimerAction
      Sequencing.swift                 # durationFor, nextSession
      Validation.swift                 # clampSettings
      Format.swift                     # formatTime
      Reducer.swift                    # reduce
    Engine/
      TimerEngine.swift                # @Observable store
      SettingsStore.swift              # UserDefaults persistence
      AlertSound.swift                 # NSSound
      Notifier.swift                   # UNUserNotificationCenter
      LoginItem.swift                  # SMAppService
      Clock.swift                      # real + accelerated (uiTestMode) clocks
    UI/
      Theme.swift                      # colors, per-mode accent, a11y identifiers
      TimerWindowView.swift
      ModeTabsView.swift
      ProgressRingView.swift
      TimerDisplayView.swift
      ControlsView.swift
      SettingsView.swift
      SessionCounterView.swift
  Tests/
    Unit/                              # XCTest target PomodoroTimerTests
      FormatTests.swift
      SequencingTests.swift
      ValidationTests.swift
      ReducerTests.swift
      EngineTests.swift
      SettingsStoreTests.swift
    UI/                                # XCUITest target PomodoroTimerUITests
      TimerFlowUITests.swift
  Resources/
    Info.plist
    PomodoroTimer.entitlements
    Assets.xcassets/                   # AppIcon
```

---

## Phase 0 — Repo restructure (no Xcode needed)

### Task 1: Retire the web prototype, make room for the macOS app

**Files:**
- Move: everything that is the Next.js app → `web-prototype/`
- Keep at root: `.git/`, `docs/`, `.gitignore`, `pomodoro-timer-prd.md`, `AGENTS.md`, `CLAUDE.md`

- [ ] **Step 1: Move the web app into `web-prototype/`**

```bash
cd /Users/jason_phillips/Vibe_Code/Pomodoro_Timer/pomodoro
mkdir -p web-prototype
# Move web app sources/configs (NOT docs, NOT the PRD/AGENTS/CLAUDE, NOT .git)
git mv app components hooks lib __tests__ public \
       package.json package-lock.json next.config.ts next-env.d.ts \
       tsconfig.json eslint.config.mjs jest.config.ts jest.setup.ts \
       web-prototype/ 2>/dev/null || true
# node_modules and .next are gitignored; move them too so the root is clean (ignore errors)
[ -d node_modules ] && mv node_modules web-prototype/ || true
[ -d .next ] && mv .next web-prototype/ || true
[ -d coverage ] && mv coverage web-prototype/ || true
ls -la
```

- [ ] **Step 2: Add a short note to web-prototype**

Create `web-prototype/README.md`:

```markdown
# Web prototype (retired)

The original Next.js/React Pomodoro prototype. Superseded by the native macOS app
in `/PomodoroTimer` (see `docs/superpowers/specs/2026-06-20-macos-native-pomodoro-design.md`).
Kept for reference; not actively maintained.
```

- [ ] **Step 3: Update root .gitignore for the macOS app**

Append to `.gitignore`:

```gitignore
# macOS / Xcode
PomodoroTimer/build/
PomodoroTimer/DerivedData/
*.xcuserstate
.DS_Store
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: retire web prototype to /web-prototype; prep for native macOS app"
```

---

## Phase 1 — Xcode project + TimerCore (TDD)

> Requires Xcode + `brew install xcodegen`.

### Task 2: XcodeGen project definition + app entry + app builds

**Files:**
- Create: `PomodoroTimer/project.yml`
- Create: `PomodoroTimer/Sources/App/PomodoroTimerApp.swift`
- Create: `PomodoroTimer/Resources/Info.plist`, `PomodoroTimer/Resources/PomodoroTimer.entitlements`

- [ ] **Step 1: Create `PomodoroTimer/project.yml`**

```yaml
name: PomodoroTimer
options:
  bundleIdPrefix: com.jason.pomodoro
  deploymentTarget:
    macOS: "14.0"
  createIntermediateGroups: true
settings:
  base:
    SWIFT_VERSION: "5.9"
    MARKETING_VERSION: "0.1.0"
    CURRENT_PROJECT_VERSION: "1"
targets:
  PomodoroTimer:
    type: application
    platform: macOS
    sources:
      - path: Sources
    resources:
      - path: Resources/Assets.xcassets
    settings:
      base:
        PRODUCT_BUNDLE_IDENTIFIER: com.jason.pomodoro.PomodoroTimer
        INFOPLIST_FILE: Resources/Info.plist
        CODE_SIGN_ENTITLEMENTS: Resources/PomodoroTimer.entitlements
        CODE_SIGN_STYLE: Automatic
        GENERATE_INFOPLIST_FILE: NO
        ENABLE_HARDENED_RUNTIME: YES
  PomodoroTimerTests:
    type: bundle.unit-test
    platform: macOS
    sources:
      - path: Tests/Unit
    dependencies:
      - target: PomodoroTimer
  PomodoroTimerUITests:
    type: bundle.ui-testing
    platform: macOS
    sources:
      - path: Tests/UI
    dependencies:
      - target: PomodoroTimer
schemes:
  PomodoroTimer:
    build:
      targets:
        PomodoroTimer: all
    test:
      targets:
        - PomodoroTimerTests
        - PomodoroTimerUITests
```

- [ ] **Step 2: Create `PomodoroTimer/Resources/Info.plist`**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>Pomodoro Timer</string>
  <key>CFBundleIdentifier</key><string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
  <key>CFBundleShortVersionString</key><string>$(MARKETING_VERSION)</string>
  <key>CFBundleVersion</key><string>$(CURRENT_PROJECT_VERSION)</string>
  <key>LSMinimumSystemVersion</key><string>$(MACOSX_DEPLOYMENT_TARGET)</string>
  <key>LSUIElement</key><false/>
</dict>
</plist>
```

- [ ] **Step 3: Create `PomodoroTimer/Resources/PomodoroTimer.entitlements`**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.app-sandbox</key><false/>
</dict>
</plist>
```

- [ ] **Step 4: Create a minimal `PomodoroTimer/Sources/App/PomodoroTimerApp.swift`**

```swift
import SwiftUI

@main
struct PomodoroTimerApp: App {
    var body: some Scene {
        Window("Pomodoro", id: "main") {
            Text("Pomodoro")
                .frame(minWidth: 360, minHeight: 480)
        }
    }
}
```

- [ ] **Step 5: Create an empty Assets catalog so resources resolve**

```bash
mkdir -p PomodoroTimer/Resources/Assets.xcassets
cat > PomodoroTimer/Resources/Assets.xcassets/Contents.json <<'JSON'
{ "info": { "author": "xcode", "version": 1 } }
JSON
```

- [ ] **Step 6: Generate the project and build**

Run:
```bash
cd PomodoroTimer && xcodegen generate && \
xcodebuild -project PomodoroTimer.xcodeproj -scheme PomodoroTimer -destination 'platform=macOS' build
```
Expected: `** BUILD SUCCEEDED **`

- [ ] **Step 7: Commit**

```bash
cd /Users/jason_phillips/Vibe_Code/Pomodoro_Timer/pomodoro
git add PomodoroTimer
git commit -m "feat(macos): scaffold SwiftUI app via XcodeGen; builds"
```

---

### Task 3: TimerCore value types

**Files:**
- Create: `PomodoroTimer/Sources/Core/SessionType.swift`
- Create: `PomodoroTimer/Sources/Core/TimerSettings.swift`
- Create: `PomodoroTimer/Sources/Core/TimerState.swift`

- [ ] **Step 1: Create `SessionType.swift`**

```swift
import Foundation

enum SessionType: String, CaseIterable, Equatable {
    case focus, shortBreak, longBreak
}
```

- [ ] **Step 2: Create `TimerSettings.swift`**

```swift
import Foundation

struct TimerSettings: Codable, Equatable {
    var focusMinutes: Int
    var shortBreakMinutes: Int
    var longBreakMinutes: Int
    var sessionsUntilLongBreak: Int
    var autoStartNext: Bool

    static let `default` = TimerSettings(
        focusMinutes: 25,
        shortBreakMinutes: 5,
        longBreakMinutes: 15,
        sessionsUntilLongBreak: 4,
        autoStartNext: false
    )
}

enum SettingsBounds {
    static let minMinutes = 1
    static let maxMinutes = 180
    static let minSessions = 1
    static let maxSessions = 12
}

/// Optional fields for a partial settings update. A `nil` field means "leave unchanged".
/// The UI passes `nil` for empty/invalid input, so the core never receives NaN.
struct SettingsPatch: Equatable {
    var focusMinutes: Int? = nil
    var shortBreakMinutes: Int? = nil
    var longBreakMinutes: Int? = nil
    var sessionsUntilLongBreak: Int? = nil
    var autoStartNext: Bool? = nil
}
```

- [ ] **Step 3: Create `TimerState.swift`**

```swift
import Foundation

struct TimerState: Equatable {
    var settings: TimerSettings
    var currentSession: SessionType
    var remainingSeconds: Int
    var totalSeconds: Int           // full duration of current session (ring denominator)
    var isRunning: Bool
    var completedFocusSessions: Int
    var cyclePosition: Int          // completed focus sessions since last long break (0..N)
    var completionCount: Int        // increments on ANY completion; engine observes it

    static func initial(_ settings: TimerSettings = .default) -> TimerState {
        let total = durationFor(.focus, settings)
        return TimerState(
            settings: settings,
            currentSession: .focus,
            remainingSeconds: total,
            totalSeconds: total,
            isRunning: false,
            completedFocusSessions: 0,
            cyclePosition: 0,
            completionCount: 0
        )
    }
}

enum TimerAction: Equatable {
    case hydrate(TimerSettings)
    case start
    case pause
    case resume
    case reset
    case skip
    case tick(remaining: Int)
    case changeMode(SessionType)
    case updateSettings(SettingsPatch)
}
```

- [ ] **Step 4: Regenerate + build**

Run: `cd PomodoroTimer && xcodegen generate && xcodebuild -project PomodoroTimer.xcodeproj -scheme PomodoroTimer -destination 'platform=macOS' build`
Expected: `** BUILD SUCCEEDED **` (note: `durationFor` is referenced but defined in Task 5; if building this task in isolation, proceed to Task 4/5 first — recommended to add Tasks 3–7 then build once. If executing strictly task-by-task, temporarily stub `func durationFor(_:_:) -> Int { 0 }` and remove it in Task 5.)

- [ ] **Step 5: Commit**

```bash
git add PomodoroTimer/Sources/Core
git commit -m "feat(core): timer value types (SessionType, TimerSettings, TimerState, actions)"
```

---

### Task 4: `formatTime` (TDD)

**Files:**
- Create: `PomodoroTimer/Sources/Core/Format.swift`
- Test: `PomodoroTimer/Tests/Unit/FormatTests.swift`

- [ ] **Step 1: Write the failing test**

```swift
import XCTest
@testable import PomodoroTimer

final class FormatTests: XCTestCase {
    func testFormatsZero() { XCTAssertEqual(formatTime(0), "00:00") }
    func testZeroPadsSeconds() { XCTAssertEqual(formatTime(5), "00:05") }
    func testFormatsMinutesAndSeconds() { XCTAssertEqual(formatTime(65), "01:05") }
    func testFormats1500() { XCTAssertEqual(formatTime(1500), "25:00") }
    func testClampsNegatives() { XCTAssertEqual(formatTime(-10), "00:00") }
    func testMinutesMayExceedTwoDigits() { XCTAssertEqual(formatTime(10800), "180:00") }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `xcodebuild -project PomodoroTimer/PomodoroTimer.xcodeproj -scheme PomodoroTimer -destination 'platform=macOS' test -only-testing:PomodoroTimerTests/FormatTests`
Expected: FAIL — `formatTime` not found.

- [ ] **Step 3: Implement `Format.swift`**

```swift
import Foundation

/// Zero-padded MM:SS. Negatives clamp to "00:00". Minutes may exceed two digits.
func formatTime(_ totalSeconds: Int) -> String {
    let clamped = max(0, totalSeconds)
    return String(format: "%02d:%02d", clamped / 60, clamped % 60)
}
```

- [ ] **Step 4: Regenerate, run tests, verify pass**

Run: `cd PomodoroTimer && xcodegen generate && cd .. && xcodebuild -project PomodoroTimer/PomodoroTimer.xcodeproj -scheme PomodoroTimer -destination 'platform=macOS' test -only-testing:PomodoroTimerTests/FormatTests`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add PomodoroTimer/Sources/Core/Format.swift PomodoroTimer/Tests/Unit/FormatTests.swift PomodoroTimer/project.yml
git commit -m "feat(core): formatTime with tests"
```

---

### Task 5: `Sequencing` — durationFor + nextSession (TDD)

**Files:**
- Create: `PomodoroTimer/Sources/Core/Sequencing.swift`
- Test: `PomodoroTimer/Tests/Unit/SequencingTests.swift`

- [ ] **Step 1: Write the failing test**

```swift
import XCTest
@testable import PomodoroTimer

final class SequencingTests: XCTestCase {
    private func state(_ session: SessionType, cyclePosition: Int,
                       settings: TimerSettings = .default) -> TimerState {
        var s = TimerState.initial(settings)
        s.currentSession = session
        s.cyclePosition = cyclePosition
        return s
    }

    func testDurationForEachType() {
        let s = TimerSettings.default
        XCTAssertEqual(durationFor(.focus, s), 1500)
        XCTAssertEqual(durationFor(.shortBreak, s), 300)
        XCTAssertEqual(durationFor(.longBreak, s), 900)
    }

    func testDurationReadsFromArgument() {
        var s = TimerSettings.default; s.focusMinutes = 50
        XCTAssertEqual(durationFor(.focus, s), 3000)
    }

    func testFocusToShortBreakBeforeThreshold() {
        XCTAssertEqual(nextSession(state(.focus, cyclePosition: 0), counted: true), .shortBreak)
    }

    func testFocusToLongBreakOnNthFocus() {
        // N=4, cyclePosition 3 -> completing the 4th focus reaches threshold
        XCTAssertEqual(nextSession(state(.focus, cyclePosition: 3), counted: true), .longBreak)
    }

    func testShortBreakToFocus() {
        XCTAssertEqual(nextSession(state(.shortBreak, cyclePosition: 2), counted: true), .focus)
    }

    func testLongBreakToFocus() {
        XCTAssertEqual(nextSession(state(.longBreak, cyclePosition: 0), counted: true), .focus)
    }

    func testSkipDoesNotAdvanceFocusToLongBreakAtThreshold() {
        // counted:false (skip) at cyclePosition 3 must NOT jump to longBreak
        XCTAssertEqual(nextSession(state(.focus, cyclePosition: 3), counted: false), .shortBreak)
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `xcodebuild ... test -only-testing:PomodoroTimerTests/SequencingTests`
Expected: FAIL — `durationFor`/`nextSession` not found.

- [ ] **Step 3: Implement `Sequencing.swift`**

```swift
import Foundation

func durationFor(_ session: SessionType, _ settings: TimerSettings) -> Int {
    switch session {
    case .focus: return settings.focusMinutes * 60
    case .shortBreak: return settings.shortBreakMinutes * 60
    case .longBreak: return settings.longBreakMinutes * 60
    }
}

/// FR-3. `counted: true` is a genuine completion (the just-finished focus counts toward
/// the long-break threshold); `counted: false` is a skip (does NOT count), so a skipped
/// Nth focus advances to shortBreak, not an unearned longBreak.
func nextSession(_ state: TimerState, counted: Bool) -> SessionType {
    switch state.currentSession {
    case .shortBreak, .longBreak:
        return .focus
    case .focus:
        let threshold = state.settings.sessionsUntilLongBreak
        let reached = counted
            ? (state.cyclePosition + 1 >= threshold)
            : (state.cyclePosition >= threshold)
        return reached ? .longBreak : .shortBreak
    }
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `cd PomodoroTimer && xcodegen generate && cd .. && xcodebuild ... test -only-testing:PomodoroTimerTests/SequencingTests`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add PomodoroTimer/Sources/Core/Sequencing.swift PomodoroTimer/Tests/Unit/SequencingTests.swift PomodoroTimer/project.yml
git commit -m "feat(core): durationFor + nextSession (counted/skip rules) with tests"
```

---

### Task 6: `clampSettings` validation (TDD)

**Files:**
- Create: `PomodoroTimer/Sources/Core/Validation.swift`
- Test: `PomodoroTimer/Tests/Unit/ValidationTests.swift`

- [ ] **Step 1: Write the failing test**

```swift
import XCTest
@testable import PomodoroTimer

final class ValidationTests: XCTestCase {
    func testClampsDurationBelowMin() {
        let r = clampSettings(SettingsPatch(focusMinutes: 0), current: .default)
        XCTAssertEqual(r.focusMinutes, 1)
    }
    func testClampsDurationAboveMax() {
        let r = clampSettings(SettingsPatch(focusMinutes: 500), current: .default)
        XCTAssertEqual(r.focusMinutes, 180)
    }
    func testClampsSessionsRange() {
        XCTAssertEqual(clampSettings(SettingsPatch(sessionsUntilLongBreak: 0), current: .default).sessionsUntilLongBreak, 1)
        XCTAssertEqual(clampSettings(SettingsPatch(sessionsUntilLongBreak: 99), current: .default).sessionsUntilLongBreak, 12)
    }
    func testNilFieldsLeaveCurrentUnchanged() {
        let r = clampSettings(SettingsPatch(focusMinutes: 30), current: .default)
        XCTAssertEqual(r.focusMinutes, 30)
        XCTAssertEqual(r.shortBreakMinutes, 5)   // unchanged
        XCTAssertEqual(r.autoStartNext, false)   // unchanged
    }
    func testTogglesAutoStart() {
        XCTAssertTrue(clampSettings(SettingsPatch(autoStartNext: true), current: .default).autoStartNext)
    }
    func testFullClampValidatesEveryField() {
        let bad = TimerSettings(focusMinutes: 0, shortBreakMinutes: 999,
                                longBreakMinutes: -5, sessionsUntilLongBreak: 100, autoStartNext: true)
        let r = clampSettings(bad)
        XCTAssertEqual(r.focusMinutes, 1)
        XCTAssertEqual(r.shortBreakMinutes, 180)
        XCTAssertEqual(r.longBreakMinutes, 1)
        XCTAssertEqual(r.sessionsUntilLongBreak, 12)
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `xcodebuild ... test -only-testing:PomodoroTimerTests/ValidationTests`
Expected: FAIL — `clampSettings` not found.

- [ ] **Step 3: Implement `Validation.swift`**

```swift
import Foundation

private func clamp(_ v: Int, _ lo: Int, _ hi: Int) -> Int { min(max(v, lo), hi) }

/// Merge a partial update into current settings, clamping each provided field to bounds.
func clampSettings(_ patch: SettingsPatch, current: TimerSettings) -> TimerSettings {
    var s = current
    if let v = patch.focusMinutes { s.focusMinutes = clamp(v, SettingsBounds.minMinutes, SettingsBounds.maxMinutes) }
    if let v = patch.shortBreakMinutes { s.shortBreakMinutes = clamp(v, SettingsBounds.minMinutes, SettingsBounds.maxMinutes) }
    if let v = patch.longBreakMinutes { s.longBreakMinutes = clamp(v, SettingsBounds.minMinutes, SettingsBounds.maxMinutes) }
    if let v = patch.sessionsUntilLongBreak { s.sessionsUntilLongBreak = clamp(v, SettingsBounds.minSessions, SettingsBounds.maxSessions) }
    if let v = patch.autoStartNext { s.autoStartNext = v }
    return s
}

/// Validate a full settings object (used on hydrate from persisted/possibly-tampered data).
func clampSettings(_ settings: TimerSettings) -> TimerSettings {
    clampSettings(SettingsPatch(
        focusMinutes: settings.focusMinutes,
        shortBreakMinutes: settings.shortBreakMinutes,
        longBreakMinutes: settings.longBreakMinutes,
        sessionsUntilLongBreak: settings.sessionsUntilLongBreak,
        autoStartNext: settings.autoStartNext
    ), current: settings)
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `cd PomodoroTimer && xcodegen generate && cd .. && xcodebuild ... test -only-testing:PomodoroTimerTests/ValidationTests`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add PomodoroTimer/Sources/Core/Validation.swift PomodoroTimer/Tests/Unit/ValidationTests.swift PomodoroTimer/project.yml
git commit -m "feat(core): clampSettings validation with tests"
```

---

### Task 7: `reduce` reducer (TDD)

**Files:**
- Create: `PomodoroTimer/Sources/Core/Reducer.swift`
- Test: `PomodoroTimer/Tests/Unit/ReducerTests.swift`

- [ ] **Step 1: Write the failing test**

```swift
import XCTest
@testable import PomodoroTimer

final class ReducerTests: XCTestCase {
    private func running(_ remaining: Int = 1500, settings: TimerSettings = .default,
                         session: SessionType = .focus, cyclePosition: Int = 0) -> TimerState {
        var s = TimerState.initial(settings)
        s.currentSession = session
        s.totalSeconds = durationFor(session, settings)
        s.remainingSeconds = remaining
        s.isRunning = true
        s.cyclePosition = cyclePosition
        return s
    }

    func testStartResumeSetRunning_PauseClears() {
        var s = TimerState.initial()
        s = reduce(s, .start); XCTAssertTrue(s.isRunning)
        s = reduce(s, .pause); XCTAssertFalse(s.isRunning)
        s = reduce(s, .resume); XCTAssertTrue(s.isRunning)
    }

    func testResetRestoresFullAndStops() {
        var s = running(remaining: 10)
        s = reduce(s, .reset)
        XCTAssertEqual(s.remainingSeconds, 1500)
        XCTAssertEqual(s.totalSeconds, 1500)
        XCTAssertFalse(s.isRunning)
    }

    func testTickUpdatesRemainingWhileRunning() {
        var s = running(remaining: 1500)
        s = reduce(s, .tick(remaining: 1499))
        XCTAssertEqual(s.remainingSeconds, 1499)
    }

    func testTickIsNoOpWhenPaused() {
        var s = running(remaining: 1500); s.isRunning = false
        let r = reduce(s, .tick(remaining: 1))
        XCTAssertEqual(r, s)
    }

    func testCompletingFocusIncrementsCountersAndSignal() {
        var s = running(remaining: 1, session: .focus, cyclePosition: 0)
        s = reduce(s, .tick(remaining: 0))
        XCTAssertEqual(s.completedFocusSessions, 1)
        XCTAssertEqual(s.cyclePosition, 1)
        XCTAssertEqual(s.completionCount, 1)
        XCTAssertEqual(s.currentSession, .shortBreak)
        XCTAssertEqual(s.remainingSeconds, 300)
        XCTAssertEqual(s.totalSeconds, 300)
    }

    func testCompletingFourthFocusGoesToLongBreak() {
        var s = running(remaining: 0, session: .focus, cyclePosition: 3)
        s = reduce(s, .tick(remaining: 0))
        XCTAssertEqual(s.currentSession, .longBreak)
    }

    func testCompletingLongBreakResetsCycle() {
        var s = running(remaining: 0, session: .longBreak, cyclePosition: 4)
        s = reduce(s, .tick(remaining: 0))
        XCTAssertEqual(s.cyclePosition, 0)
        XCTAssertEqual(s.currentSession, .focus)
    }

    func testAutoStartNextControlsRunningAfterCompletion() {
        var on = TimerSettings.default; on.autoStartNext = true
        var s = running(remaining: 0, settings: on); s = reduce(s, .tick(remaining: 0))
        XCTAssertTrue(s.isRunning)
        var off = TimerSettings.default; off.autoStartNext = false
        var s2 = running(remaining: 0, settings: off); s2 = reduce(s2, .tick(remaining: 0))
        XCTAssertFalse(s2.isRunning)
    }

    func testChangeModeSwitchesResetsStopsKeepsCounters() {
        var s = running(remaining: 100, session: .focus, cyclePosition: 2)
        s.completedFocusSessions = 5
        s = reduce(s, .changeMode(.longBreak))
        XCTAssertEqual(s.currentSession, .longBreak)
        XCTAssertEqual(s.remainingSeconds, 900)
        XCTAssertEqual(s.totalSeconds, 900)
        XCTAssertFalse(s.isRunning)
        XCTAssertEqual(s.cyclePosition, 2)
        XCTAssertEqual(s.completedFocusSessions, 5)
    }

    func testSkipAdvancesWithoutCountersOrSignal() {
        var s = running(remaining: 100, session: .focus, cyclePosition: 1)
        s = reduce(s, .skip)
        XCTAssertEqual(s.currentSession, .shortBreak)
        XCTAssertEqual(s.completedFocusSessions, 0)
        XCTAssertEqual(s.completionCount, 0)
        XCTAssertFalse(s.isRunning)
    }

    func testSkipFromLongBreakResetsCycle() {
        var s = running(remaining: 100, session: .longBreak, cyclePosition: 4)
        s = reduce(s, .skip)
        XCTAssertEqual(s.cyclePosition, 0)
        XCTAssertEqual(s.currentSession, .focus)
    }

    func testUpdateSettingsMergesAndRefreshesWhenIdle() {
        var s = TimerState.initial() // idle focus 1500
        s = reduce(s, .updateSettings(SettingsPatch(focusMinutes: 10)))
        XCTAssertEqual(s.settings.focusMinutes, 10)
        XCTAssertEqual(s.remainingSeconds, 600)
        XCTAssertEqual(s.totalSeconds, 600)
    }

    func testUpdateSettingsDoesNotChangeRemainingOrTotalWhileRunning() {
        var s = running(remaining: 1200) // running focus, total 1500
        s = reduce(s, .updateSettings(SettingsPatch(focusMinutes: 10)))
        XCTAssertEqual(s.remainingSeconds, 1200)
        XCTAssertEqual(s.totalSeconds, 1500)
        XCTAssertEqual(s.settings.focusMinutes, 10)
    }

    func testHydrateAppliesValidatedSettingsAndResets() {
        var s = TimerState.initial()
        let incoming = TimerSettings(focusMinutes: 0, shortBreakMinutes: 5, longBreakMinutes: 15,
                                     sessionsUntilLongBreak: 4, autoStartNext: false)
        s = reduce(s, .hydrate(incoming))
        XCTAssertEqual(s.settings.focusMinutes, 1)      // clamped
        XCTAssertEqual(s.remainingSeconds, 60)
        XCTAssertEqual(s.totalSeconds, 60)
        XCTAssertFalse(s.isRunning)
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `xcodebuild ... test -only-testing:PomodoroTimerTests/ReducerTests`
Expected: FAIL — `reduce` not found.

- [ ] **Step 3: Implement `Reducer.swift`**

```swift
import Foundation

func reduce(_ state: TimerState, _ action: TimerAction) -> TimerState {
    var s = state
    switch action {
    case .hydrate(let incoming):
        let validated = clampSettings(incoming)
        s.settings = validated
        let total = durationFor(s.currentSession, validated)
        s.remainingSeconds = total
        s.totalSeconds = total
        s.isRunning = false

    case .start, .resume:
        s.isRunning = true

    case .pause:
        s.isRunning = false

    case .reset:
        let total = durationFor(s.currentSession, s.settings)
        s.remainingSeconds = total
        s.totalSeconds = total
        s.isRunning = false

    case .changeMode(let session):
        s.currentSession = session
        let total = durationFor(session, s.settings)
        s.remainingSeconds = total
        s.totalSeconds = total
        s.isRunning = false

    case .skip:
        let next = nextSession(s, counted: false)
        if s.currentSession == .longBreak { s.cyclePosition = 0 }
        s.currentSession = next
        let total = durationFor(next, s.settings)
        s.remainingSeconds = total
        s.totalSeconds = total
        s.isRunning = false

    case .updateSettings(let patch):
        let merged = clampSettings(patch, current: s.settings)
        s.settings = merged
        if !s.isRunning {
            let total = durationFor(s.currentSession, merged)
            s.remainingSeconds = total
            s.totalSeconds = total
        }

    case .tick(let remaining):
        guard s.isRunning else { return s }
        if remaining > 0 {
            s.remainingSeconds = remaining
            return s
        }
        // Completion.
        let wasFocus = s.currentSession == .focus
        let next = nextSession(s, counted: true)
        s.completionCount += 1
        if wasFocus {
            s.completedFocusSessions += 1
            s.cyclePosition += 1
        }
        if s.currentSession == .longBreak {
            s.cyclePosition = 0
        }
        s.currentSession = next
        let total = durationFor(next, s.settings)
        s.remainingSeconds = total
        s.totalSeconds = total
        s.isRunning = s.settings.autoStartNext
    }
    return s
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `cd PomodoroTimer && xcodegen generate && cd .. && xcodebuild ... test -only-testing:PomodoroTimerTests/ReducerTests`
Expected: PASS (13 tests).

- [ ] **Step 5: Run the full unit suite + commit**

Run: `xcodebuild -project PomodoroTimer/PomodoroTimer.xcodeproj -scheme PomodoroTimer -destination 'platform=macOS' test -only-testing:PomodoroTimerTests`
Expected: PASS (all Core suites green). **Phase 1 gate.**

```bash
git add PomodoroTimer/Sources/Core/Reducer.swift PomodoroTimer/Tests/Unit/ReducerTests.swift PomodoroTimer/project.yml
git commit -m "feat(core): pure reducer with full tests (Phase 1 gate green)"
```

---

## Phase 2 — TimerEngine (timestamps + persistence)

### Task 8: `Clock` abstraction + accelerated UI-test clock

**Files:**
- Create: `PomodoroTimer/Sources/Engine/Clock.swift`

- [ ] **Step 1: Create `Clock.swift`**

```swift
import Foundation

/// A source of "now". Production uses the real clock; UI tests use an accelerated one
/// so sessions complete in ~1s of wall time without weakening validation.
struct Clock {
    let now: () -> Date

    static let real = Clock(now: Date.init)

    /// Accelerates wall time by `factor` from the moment it is created.
    /// e.g. factor 60 => a 1-minute (60s) session elapses in ~1 real second.
    static func accelerated(factor: Double, start: Date = Date()) -> Clock {
        Clock(now: { start.addingTimeInterval(Date().timeIntervalSince(start) * factor) })
    }
}
```

- [ ] **Step 2: Build + commit**

```bash
cd PomodoroTimer && xcodegen generate && cd .. && xcodebuild -project PomodoroTimer/PomodoroTimer.xcodeproj -scheme PomodoroTimer -destination 'platform=macOS' build
git add PomodoroTimer/Sources/Engine/Clock.swift PomodoroTimer/project.yml
git commit -m "feat(engine): Clock abstraction (real + accelerated)"
```

---

### Task 9: `SettingsStore` persistence (TDD)

**Files:**
- Create: `PomodoroTimer/Sources/Engine/SettingsStore.swift`
- Test: `PomodoroTimer/Tests/Unit/SettingsStoreTests.swift`

- [ ] **Step 1: Write the failing test**

```swift
import XCTest
@testable import PomodoroTimer

final class SettingsStoreTests: XCTestCase {
    private func freshDefaults() -> UserDefaults {
        let suite = "test.\(UUID().uuidString)"
        let d = UserDefaults(suiteName: suite)!
        d.removePersistentDomain(forName: suite)
        return d
    }

    func testLoadReturnsDefaultWhenEmpty() {
        let store = SettingsStore(defaults: freshDefaults())
        XCTAssertEqual(store.load(), .default)
    }

    func testSaveThenLoadRoundTrips() {
        let store = SettingsStore(defaults: freshDefaults())
        var s = TimerSettings.default; s.focusMinutes = 42
        store.save(s)
        XCTAssertEqual(store.load().focusMinutes, 42)
    }

    func testLoadValidatesTamperedData() {
        let defaults = freshDefaults()
        let store = SettingsStore(defaults: defaults)
        let bad = TimerSettings(focusMinutes: 9999, shortBreakMinutes: 5, longBreakMinutes: 15,
                                sessionsUntilLongBreak: 4, autoStartNext: false)
        store.save(bad)
        XCTAssertEqual(store.load().focusMinutes, 180) // clamped on load
    }

    func testLoadFallsBackOnMalformedJSON() {
        let defaults = freshDefaults()
        defaults.set(Data("not json".utf8), forKey: "pomodoro.settings")
        let store = SettingsStore(defaults: defaults)
        XCTAssertEqual(store.load(), .default)
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `xcodebuild ... test -only-testing:PomodoroTimerTests/SettingsStoreTests`
Expected: FAIL — `SettingsStore` not found.

- [ ] **Step 3: Implement `SettingsStore.swift`**

```swift
import Foundation

struct SettingsStore {
    static let key = "pomodoro.settings"
    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) { self.defaults = defaults }

    func load() -> TimerSettings {
        guard let data = defaults.data(forKey: Self.key),
              let decoded = try? JSONDecoder().decode(TimerSettings.self, from: data) else {
            return .default
        }
        return clampSettings(decoded)
    }

    func save(_ settings: TimerSettings) {
        if let data = try? JSONEncoder().encode(settings) {
            defaults.set(data, forKey: Self.key)
        }
    }
}
```

- [ ] **Step 4: Run tests, verify pass; commit**

Run: `cd PomodoroTimer && xcodegen generate && cd .. && xcodebuild ... test -only-testing:PomodoroTimerTests/SettingsStoreTests`
Expected: PASS (4 tests).

```bash
git add PomodoroTimer/Sources/Engine/SettingsStore.swift PomodoroTimer/Tests/Unit/SettingsStoreTests.swift PomodoroTimer/project.yml
git commit -m "feat(engine): SettingsStore (UserDefaults) with tests"
```

---

### Task 10: `TimerEngine` (TDD with injected clock)

**Files:**
- Create: `PomodoroTimer/Sources/Engine/TimerEngine.swift`
- Test: `PomodoroTimer/Tests/Unit/EngineTests.swift`

- [ ] **Step 1: Write the failing test**

```swift
import XCTest
@testable import PomodoroTimer

final class EngineTests: XCTestCase {
    /// Controllable clock for deterministic timing tests.
    private final class FakeClock {
        var current = Date(timeIntervalSinceReferenceDate: 0)
        func clock() -> Clock { Clock(now: { self.current }) }
        func advance(_ seconds: TimeInterval) { current.addingTimeInterval(seconds); current = current.addingTimeInterval(seconds) }
    }

    private func makeEngine(_ fake: FakeClock, settings: TimerSettings = .default)
        -> (TimerEngine, completions: () -> Int) {
        var completions = 0
        let suite = "test.\(UUID().uuidString)"
        let store = SettingsStore(defaults: UserDefaults(suiteName: suite)!)
        store.save(settings)
        let engine = TimerEngine(
            store: store,
            clock: fake.clock(),
            autoStartTimer: false,            // tests drive refresh() manually
            onSessionComplete: { _, _ in completions += 1 }
        )
        return (engine, { completions })
    }

    func testStartsAtFocusFullDuration() {
        let fake = FakeClock(); let (e, _) = makeEngine(fake)
        XCTAssertEqual(e.state.currentSession, .focus)
        XCTAssertEqual(e.state.remainingSeconds, 1500)
        XCTAssertFalse(e.state.isRunning)
    }

    func testStartThenRefreshCountsDownFromTimestamp() {
        let fake = FakeClock(); let (e, _) = makeEngine(fake)
        e.start()
        fake.advance(1); e.refresh()
        XCTAssertEqual(e.state.remainingSeconds, 1499)
        fake.advance(59); e.refresh()
        XCTAssertEqual(e.state.remainingSeconds, 1440)
    }

    func testCompletionFiresCallbackAndAdvances() {
        var short = TimerSettings.default; short.focusMinutes = 1 // 60s
        let fake = FakeClock(); let (e, completions) = makeEngine(fake, settings: short)
        e.start()
        fake.advance(60); e.refresh()
        XCTAssertEqual(e.state.completedFocusSessions, 1)
        XCTAssertEqual(e.state.currentSession, .shortBreak)
        XCTAssertFalse(e.state.isRunning)             // autoStart off
        XCTAssertEqual(completions(), 1)
    }

    func testPausePreservesRemaining_ResumeContinues() {
        let fake = FakeClock(); let (e, _) = makeEngine(fake)
        e.start(); fake.advance(100); e.refresh()
        XCTAssertEqual(e.state.remainingSeconds, 1400)
        e.pause()
        fake.advance(50); e.refresh()                 // paused: no change
        XCTAssertEqual(e.state.remainingSeconds, 1400)
        e.resume(); fake.advance(10); e.refresh()
        XCTAssertEqual(e.state.remainingSeconds, 1390)
    }

    func testWakeRecomputesFromTimestampNoDrift() {
        // Simulate a long jump (e.g. system sleep) — remaining tracks wall clock, not tick count.
        let fake = FakeClock(); let (e, _) = makeEngine(fake)
        e.start()
        fake.advance(1000); e.refresh()               // single big jump
        XCTAssertEqual(e.state.remainingSeconds, 500)
    }

    func testUpdateSettingsPersists() {
        let fake = FakeClock(); let (e, _) = makeEngine(fake)
        e.updateSettings(SettingsPatch(focusMinutes: 42))
        XCTAssertEqual(e.state.settings.focusMinutes, 42)
        XCTAssertEqual(e.reloadPersistedForTesting().focusMinutes, 42)
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `xcodebuild ... test -only-testing:PomodoroTimerTests/EngineTests`
Expected: FAIL — `TimerEngine` not found.

- [ ] **Step 3: Implement `TimerEngine.swift`**

```swift
import Foundation
import Observation

@Observable
final class TimerEngine {
    private(set) var state: TimerState

    @ObservationIgnored private let store: SettingsStore
    @ObservationIgnored private let clock: Clock
    @ObservationIgnored private let onSessionComplete: (_ completed: SessionType, _ next: SessionType) -> Void
    @ObservationIgnored private let autoStartTimer: Bool
    @ObservationIgnored private var endDate: Date?
    @ObservationIgnored private var timer: Timer?

    init(store: SettingsStore = SettingsStore(),
         clock: Clock = .real,
         autoStartTimer: Bool = true,
         onSessionComplete: @escaping (_ completed: SessionType, _ next: SessionType) -> Void = { _, _ in }) {
        self.store = store
        self.clock = clock
        self.autoStartTimer = autoStartTimer
        self.onSessionComplete = onSessionComplete
        self.state = TimerState.initial(store.load())
    }

    // MARK: Intents
    func start()  { state = reduce(state, .start);  beginCountdown() }
    func resume() { state = reduce(state, .resume); beginCountdown() }
    func pause()  { state = reduce(state, .pause);  stopTimer() }
    func reset()  { state = reduce(state, .reset);  stopTimer() }
    func skip()   { state = reduce(state, .skip);   stopTimer() }
    func changeMode(_ s: SessionType) { state = reduce(state, .changeMode(s)); stopTimer() }

    func updateSettings(_ patch: SettingsPatch) {
        state = reduce(state, .updateSettings(patch))
        store.save(state.settings)
    }

    /// Recompute remaining from the wall clock. Call on each timer tick AND on app activate/wake.
    func refresh() {
        guard state.isRunning, let end = endDate else { return }
        let remaining = max(0, Int(ceil(end.timeIntervalSince(clock.now()))))
        let before = state
        state = reduce(state, .tick(remaining: remaining))
        if state.completionCount != before.completionCount {
            onSessionComplete(before.currentSession, state.currentSession)
            if state.isRunning {
                endDate = clock.now().addingTimeInterval(TimeInterval(state.remainingSeconds))
            } else {
                stopTimer()
            }
        }
    }

    // MARK: Timing
    private func beginCountdown() {
        endDate = clock.now().addingTimeInterval(TimeInterval(state.remainingSeconds))
        if autoStartTimer { startDisplayTimer() }
        refresh()
    }

    private func startDisplayTimer() {
        stopDisplayTimer()
        timer = Timer.scheduledTimer(withTimeInterval: 0.25, repeats: true) { [weak self] _ in
            self?.refresh()
        }
        timer.map { RunLoop.main.add($0, forMode: .common) }
    }

    private func stopDisplayTimer() { timer?.invalidate(); timer = nil }
    private func stopTimer() { stopDisplayTimer(); endDate = nil }

    // MARK: Test hooks
    func reloadPersistedForTesting() -> TimerSettings { store.load() }
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `cd PomodoroTimer && xcodegen generate && cd .. && xcodebuild ... test -only-testing:PomodoroTimerTests/EngineTests`
Expected: PASS (6 tests).

- [ ] **Step 5: Full unit suite + commit (Phase 2 gate)**

Run: `xcodebuild ... test -only-testing:PomodoroTimerTests`
Expected: PASS (all unit suites).

```bash
git add PomodoroTimer/Sources/Engine/TimerEngine.swift PomodoroTimer/Tests/Unit/EngineTests.swift PomodoroTimer/project.yml
git commit -m "feat(engine): TimerEngine timestamp timing + persistence; tests (Phase 2 gate)"
```

---

## Phase 3 — Window UI + first XCUITests

### Task 11: Theme + accessibility identifiers

**Files:**
- Create: `PomodoroTimer/Sources/UI/Theme.swift`

- [ ] **Step 1: Create `Theme.swift`**

```swift
import SwiftUI

enum A11y {
    static let clock = "clock"
    static let progressRing = "progress-ring"
    static let startButton = "start-button"
    static let resetButton = "reset-button"
    static let skipButton = "skip-button"
    static let sessionCounter = "session-counter"
    static let settingsDisclosure = "settings-disclosure"
    static let focusField = "focus-minutes-field"
    static let shortField = "short-minutes-field"
    static let longField = "long-minutes-field"
    static let sessionsField = "sessions-field"
    static let autoStartToggle = "auto-start-toggle"
    static func modeTab(_ s: SessionType) -> String { "mode-tab-\(s.rawValue)" }
}

extension SessionType {
    var accent: Color {
        switch self {
        case .focus: return .red
        case .shortBreak: return .teal
        case .longBreak: return .indigo
        }
    }
    var title: String {
        switch self {
        case .focus: return "Focus"
        case .shortBreak: return "Short Break"
        case .longBreak: return "Long Break"
        }
    }
}
```

- [ ] **Step 2: Build + commit**

```bash
cd PomodoroTimer && xcodegen generate && cd .. && xcodebuild ... build
git add PomodoroTimer/Sources/UI/Theme.swift PomodoroTimer/project.yml
git commit -m "feat(ui): theme + accessibility identifiers"
```

---

### Task 12: Display + ProgressRing + Controls + ModeTabs + SessionCounter views

**Files:**
- Create: `PomodoroTimer/Sources/UI/TimerDisplayView.swift`
- Create: `PomodoroTimer/Sources/UI/ProgressRingView.swift`
- Create: `PomodoroTimer/Sources/UI/ControlsView.swift`
- Create: `PomodoroTimer/Sources/UI/ModeTabsView.swift`
- Create: `PomodoroTimer/Sources/UI/SessionCounterView.swift`

- [ ] **Step 1: Create `TimerDisplayView.swift`**

```swift
import SwiftUI

struct TimerDisplayView: View {
    let remainingSeconds: Int
    var body: some View {
        Text(formatTime(remainingSeconds))
            .font(.system(size: 56, weight: .semibold, design: .monospaced))
            .monospacedDigit()
            .accessibilityIdentifier(A11y.clock)
    }
}
```

- [ ] **Step 2: Create `ProgressRingView.swift`**

```swift
import SwiftUI

struct ProgressRingView: View {
    let remainingSeconds: Int
    let totalSeconds: Int
    let accent: Color

    private var elapsedFraction: Double {
        guard totalSeconds > 0 else { return 0 }
        let f = Double(totalSeconds - remainingSeconds) / Double(totalSeconds)
        return min(1, max(0, f))
    }

    var body: some View {
        ZStack {
            Circle().stroke(Color.secondary.opacity(0.2), lineWidth: 14)
            Circle()
                .trim(from: 0, to: elapsedFraction)
                .stroke(accent, style: StrokeStyle(lineWidth: 14, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .animation(.linear(duration: 0.25), value: elapsedFraction)
            TimerDisplayView(remainingSeconds: remainingSeconds)
        }
        .frame(width: 240, height: 240)
        .padding()
        .accessibilityIdentifier(A11y.progressRing)
    }
}
```

- [ ] **Step 3: Create `ControlsView.swift`**

```swift
import SwiftUI

struct ControlsView: View {
    let isRunning: Bool
    let atFullDuration: Bool
    let onPrimary: () -> Void      // start OR resume OR pause
    let onReset: () -> Void
    let onSkip: () -> Void

    private var primaryTitle: String {
        if isRunning { return "Pause" }
        return atFullDuration ? "Start" : "Resume"
    }

    var body: some View {
        HStack(spacing: 12) {
            Button(primaryTitle, action: onPrimary)
                .keyboardShortcut(.space, modifiers: [])
                .accessibilityIdentifier(A11y.startButton)
            Button("Reset", action: onReset)
                .accessibilityIdentifier(A11y.resetButton)
            Button("Skip", action: onSkip)
                .accessibilityIdentifier(A11y.skipButton)
        }
        .buttonStyle(.borderedProminent)
    }
}
```

- [ ] **Step 4: Create `ModeTabsView.swift`**

```swift
import SwiftUI

struct ModeTabsView: View {
    let current: SessionType
    let onSelect: (SessionType) -> Void

    var body: some View {
        HStack(spacing: 8) {
            ForEach(SessionType.allCases, id: \.self) { session in
                Button(session.title) { onSelect(session) }
                    .buttonStyle(.bordered)
                    .tint(session == current ? session.accent : .secondary)
                    .accessibilityIdentifier(A11y.modeTab(session))
                    .accessibilityAddTraits(session == current ? [.isSelected] : [])
            }
        }
    }
}
```

- [ ] **Step 5: Create `SessionCounterView.swift`**

```swift
import SwiftUI

struct SessionCounterView: View {
    let completedFocusSessions: Int
    let cyclePosition: Int
    let sessionsUntilLongBreak: Int

    var body: some View {
        VStack(spacing: 2) {
            Text("Completed focus sessions: \(completedFocusSessions)")
            Text("\(cyclePosition) / \(sessionsUntilLongBreak) until long break")
                .foregroundStyle(.secondary)
        }
        .font(.callout)
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier(A11y.sessionCounter)
    }
}
```

- [ ] **Step 6: Build + commit**

```bash
cd PomodoroTimer && xcodegen generate && cd .. && xcodebuild ... build
git add PomodoroTimer/Sources/UI
git commit -m "feat(ui): display, progress ring, controls, mode tabs, session counter"
```

---

### Task 13: Window composition + app wiring + `-uiTestMode`

**Files:**
- Create: `PomodoroTimer/Sources/UI/TimerWindowView.swift`
- Modify: `PomodoroTimer/Sources/App/PomodoroTimerApp.swift`

- [ ] **Step 1: Create `TimerWindowView.swift`**

```swift
import SwiftUI

struct TimerWindowView: View {
    @Bindable var engine: TimerEngine

    private var atFullDuration: Bool {
        engine.state.remainingSeconds == engine.state.totalSeconds
    }

    var body: some View {
        VStack(spacing: 20) {
            ModeTabsView(current: engine.state.currentSession) { engine.changeMode($0) }
            ProgressRingView(
                remainingSeconds: engine.state.remainingSeconds,
                totalSeconds: engine.state.totalSeconds,
                accent: engine.state.currentSession.accent
            )
            ControlsView(
                isRunning: engine.state.isRunning,
                atFullDuration: atFullDuration,
                onPrimary: {
                    if engine.state.isRunning { engine.pause() }
                    else if atFullDuration { engine.start() }
                    else { engine.resume() }
                },
                onReset: { engine.reset() },
                onSkip: { engine.skip() }
            )
            SessionCounterView(
                completedFocusSessions: engine.state.completedFocusSessions,
                cyclePosition: engine.state.cyclePosition,
                sessionsUntilLongBreak: engine.state.settings.sessionsUntilLongBreak
            )
        }
        .padding(28)
        .frame(minWidth: 380, minHeight: 560)
    }
}
```

- [ ] **Step 2: Replace `PomodoroTimerApp.swift`**

```swift
import SwiftUI

@main
struct PomodoroTimerApp: App {
    @State private var engine = PomodoroTimerApp.makeEngine()

    var body: some Scene {
        Window("Pomodoro", id: "main") {
            TimerWindowView(engine: engine)
        }
        .windowResizability(.contentSize)
    }

    /// Builds the engine, honoring the `-uiTestMode` launch argument (accelerated clock
    /// + reset settings) so UI tests can run completion flows fast.
    static func makeEngine() -> TimerEngine {
        let args = ProcessInfo.processInfo.arguments
        if args.contains("-uiTestMode") {
            let suite = "uitest.\(UUID().uuidString)"
            let defaults = UserDefaults(suiteName: suite)!
            defaults.removePersistentDomain(forName: suite)
            return TimerEngine(
                store: SettingsStore(defaults: defaults),
                clock: .accelerated(factor: 60),
                onSessionComplete: { _, _ in }    // sound/notifications wired in Phase 5
            )
        }
        return TimerEngine()
    }
}
```

- [ ] **Step 3: Build + commit**

```bash
cd PomodoroTimer && xcodegen generate && cd .. && xcodebuild ... build
git add PomodoroTimer/Sources/UI/TimerWindowView.swift PomodoroTimer/Sources/App/PomodoroTimerApp.swift
git commit -m "feat(ui): window composition wired to engine; -uiTestMode launch hook"
```

---

### Task 14: First XCUITests (default state, start/pause/resume, reset, mode switch)

**Files:**
- Create: `PomodoroTimer/Tests/UI/TimerFlowUITests.swift`

- [ ] **Step 1: Write the UI tests**

```swift
import XCTest

final class TimerFlowUITests: XCTestCase {
    override func setUp() { continueAfterFailure = false }

    private func launch() -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments += ["-uiTestMode"]
        app.launch()
        return app
    }

    private func clockValue(_ app: XCUIApplication) -> String {
        app.staticTexts["clock"].label
    }

    func testDefaultStateShowsFocusAndThreeTabs() {
        let app = launch()
        XCTAssertTrue(app.staticTexts["clock"].waitForExistence(timeout: 10))
        XCTAssertEqual(clockValue(app), "25:00")
        XCTAssertTrue(app.buttons["mode-tab-focus"].exists)
        XCTAssertTrue(app.buttons["mode-tab-shortBreak"].exists)
        XCTAssertTrue(app.buttons["mode-tab-longBreak"].exists)
        XCTAssertTrue(app.buttons["start-button"].exists)
    }

    func testStartCountsDownThenPauseHaltsThenResume() {
        let app = launch()
        _ = app.staticTexts["clock"].waitForExistence(timeout: 10)
        app.buttons["start-button"].click()
        // Accelerated clock (60x): value should drop within ~1s.
        let dropped = NSPredicate(format: "label != %@", "25:00")
        expectation(for: dropped, evaluatedWith: app.staticTexts["clock"])
        waitForExpectations(timeout: 5)
        // Pause and confirm it stops changing.
        app.buttons["start-button"].click() // now labelled "Pause"
        let frozen = clockValue(app)
        Thread.sleep(forTimeInterval: 1.0)
        XCTAssertEqual(clockValue(app), frozen)
    }

    func testResetReturnsToFullAndStops() {
        let app = launch()
        _ = app.staticTexts["clock"].waitForExistence(timeout: 10)
        app.buttons["start-button"].click()
        Thread.sleep(forTimeInterval: 0.5)
        app.buttons["reset-button"].click()
        XCTAssertEqual(clockValue(app), "25:00")
        XCTAssertTrue(app.buttons["start-button"].exists) // back to "Start"
    }

    func testSelectingShortBreakTabSwitchesAndStops() {
        let app = launch()
        _ = app.staticTexts["clock"].waitForExistence(timeout: 10)
        app.buttons["mode-tab-shortBreak"].click()
        XCTAssertEqual(clockValue(app), "05:00")
    }
}
```

- [ ] **Step 2: Run the UI tests, verify pass**

Run: `cd PomodoroTimer && xcodegen generate && cd .. && xcodebuild -project PomodoroTimer/PomodoroTimer.xcodeproj -scheme PomodoroTimer -destination 'platform=macOS' test -only-testing:PomodoroTimerUITests/TimerFlowUITests`
Expected: PASS (4 tests). (Approve the Accessibility/Automation permission prompt on first run.)

- [ ] **Step 3: Commit (Phase 3 gate)**

```bash
git add PomodoroTimer/Tests/UI/TimerFlowUITests.swift PomodoroTimer/project.yml
git commit -m "test(ui): XCUITest smoke suite for window flows (Phase 3 gate)"
```

---

## Phase 4 — Menu-bar app

### Task 15: `MenuBarExtra` live countdown + menu, with lifecycle refresh

**Files:**
- Create: `PomodoroTimer/Sources/App/MenuBarLabel.swift`
- Create: `PomodoroTimer/Sources/App/MenuContent.swift`
- Modify: `PomodoroTimer/Sources/App/PomodoroTimerApp.swift`

- [ ] **Step 1: Create `MenuBarLabel.swift`**

```swift
import SwiftUI

struct MenuBarLabel: View {
    @Bindable var engine: TimerEngine
    var body: some View {
        Text(formatTime(engine.state.remainingSeconds))
            .monospacedDigit()
    }
}
```

- [ ] **Step 2: Create `MenuContent.swift`**

```swift
import SwiftUI

struct MenuContent: View {
    @Bindable var engine: TimerEngine
    @Environment(\.openWindow) private var openWindow

    private var atFullDuration: Bool {
        engine.state.remainingSeconds == engine.state.totalSeconds
    }

    var body: some View {
        Text("\(engine.state.currentSession.title) — \(formatTime(engine.state.remainingSeconds))")
        Divider()
        if engine.state.isRunning {
            Button("Pause") { engine.pause() }
        } else {
            Button(atFullDuration ? "Start" : "Resume") {
                atFullDuration ? engine.start() : engine.resume()
            }
        }
        Button("Skip") { engine.skip() }
        Button("Reset") { engine.reset() }
        Divider()
        Button("Open Window") { openWindow(id: "main") }
        Button("Quit") { NSApplication.shared.terminate(nil) }
    }
}
```

- [ ] **Step 3: Add the `MenuBarExtra` scene + wake/activate refresh to the App**

Replace the `body` in `PomodoroTimerApp.swift` with:

```swift
    var body: some Scene {
        Window("Pomodoro", id: "main") {
            TimerWindowView(engine: engine)
                .onReceive(NotificationCenter.default.publisher(
                    for: NSApplication.didBecomeActiveNotification)) { _ in engine.refresh() }
        }
        .windowResizability(.contentSize)

        MenuBarExtra {
            MenuContent(engine: engine)
        } label: {
            MenuBarLabel(engine: engine)
        }
        .menuBarExtraStyle(.menu)
    }
```

Also add wake-from-sleep handling: in `makeEngine()`’s caller is fine, but add an observer in `TimerWindowView`’s `.onReceive` above (covers activate). For sleep/wake, add to `MenuContent` or App init an observer on `NSWorkspace.didWakeNotification` that calls `engine.refresh()`:

```swift
// In PomodoroTimerApp init (add an initializer):
init() {
    let e = PomodoroTimerApp.makeEngine()
    _engine = State(initialValue: e)
    NSWorkspace.shared.notificationCenter.addObserver(
        forName: NSWorkspace.didWakeNotification, object: nil, queue: .main) { _ in e.refresh() }
}
```

- [ ] **Step 4: Build + commit**

```bash
cd PomodoroTimer && xcodegen generate && cd .. && xcodebuild ... build
git add PomodoroTimer/Sources/App
git commit -m "feat(macos): MenuBarExtra live countdown + menu; activate/wake refresh (Phase 4 gate)"
```

- [ ] **Step 5: Manual check + full test run (Phase 4 gate)**

Run the app (`xcodebuild ... build` then open the product, or run from Xcode). Confirm the menu-bar shows a live countdown after Start and the menu controls work. Then:
Run: `xcodebuild ... test`
Expected: all unit + UI suites PASS.

---

## Phase 5 — Settings, sound, notifications, login item, polish

### Task 16: `SettingsView` + window integration

**Files:**
- Create: `PomodoroTimer/Sources/UI/SettingsView.swift`
- Modify: `PomodoroTimer/Sources/UI/TimerWindowView.swift`

- [ ] **Step 1: Create `SettingsView.swift`**

```swift
import SwiftUI

struct SettingsView: View {
    @Bindable var engine: TimerEngine
    @State private var expanded = false

    var body: some View {
        DisclosureGroup("Settings", isExpanded: $expanded) {
            Form {
                stepper("Focus (min)", value: engine.state.settings.focusMinutes,
                        id: A11y.focusField, range: SettingsBounds.minMinutes...SettingsBounds.maxMinutes) {
                    engine.updateSettings(SettingsPatch(focusMinutes: $0))
                }
                stepper("Short break (min)", value: engine.state.settings.shortBreakMinutes,
                        id: A11y.shortField, range: SettingsBounds.minMinutes...SettingsBounds.maxMinutes) {
                    engine.updateSettings(SettingsPatch(shortBreakMinutes: $0))
                }
                stepper("Long break (min)", value: engine.state.settings.longBreakMinutes,
                        id: A11y.longField, range: SettingsBounds.minMinutes...SettingsBounds.maxMinutes) {
                    engine.updateSettings(SettingsPatch(longBreakMinutes: $0))
                }
                stepper("Sessions until long break", value: engine.state.settings.sessionsUntilLongBreak,
                        id: A11y.sessionsField, range: SettingsBounds.minSessions...SettingsBounds.maxSessions) {
                    engine.updateSettings(SettingsPatch(sessionsUntilLongBreak: $0))
                }
                Toggle("Auto-start next session", isOn: Binding(
                    get: { engine.state.settings.autoStartNext },
                    set: { engine.updateSettings(SettingsPatch(autoStartNext: $0)) }
                ))
                .accessibilityIdentifier(A11y.autoStartToggle)

                Toggle("Launch at login", isOn: Binding(
                    get: { LoginItem.isEnabled },
                    set: { LoginItem.setEnabled($0) }
                ))
            }
        }
        .accessibilityIdentifier(A11y.settingsDisclosure)
    }

    @ViewBuilder
    private func stepper(_ title: String, value: Int, id: String,
                         range: ClosedRange<Int>, onChange: @escaping (Int) -> Void) -> some View {
        Stepper(value: Binding(get: { value }, set: { onChange($0) }), in: range) {
            Text("\(title): \(value)")
        }
        .accessibilityIdentifier(id)
    }
}
```

- [ ] **Step 2: Add `SettingsView` to the window**

In `TimerWindowView.swift`, add after `SessionCounterView(...)`:

```swift
            SettingsView(engine: engine)
```

- [ ] **Step 3: Build + commit**

```bash
cd PomodoroTimer && xcodegen generate && cd .. && xcodebuild ... build
git add PomodoroTimer/Sources/UI/SettingsView.swift PomodoroTimer/Sources/UI/TimerWindowView.swift
git commit -m "feat(ui): settings panel (durations, N, auto-start, launch-at-login)"
```

> **Note on `Stepper`:** it cannot produce out-of-range or NaN values, so it satisfies FR-5's "never persist invalid" by construction. If a free-text field is added later, route it through `Int?` (nil on empty/non-numeric) so the core still never sees NaN.

---

### Task 17: Sound + Notifications on completion

**Files:**
- Create: `PomodoroTimer/Sources/Engine/AlertSound.swift`
- Create: `PomodoroTimer/Sources/Engine/Notifier.swift`
- Modify: `PomodoroTimer/Sources/App/PomodoroTimerApp.swift`

- [ ] **Step 1: Create `AlertSound.swift`**

```swift
import AppKit

enum AlertSound {
    /// Reliable native completion sound (no Web Audio gymnastics).
    static func play() { NSSound(named: NSSound.Name("Glass"))?.play() }
}
```

- [ ] **Step 2: Create `Notifier.swift`**

```swift
import UserNotifications

enum Notifier {
    static func requestAuthorization() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { _, _ in }
    }

    static func notifyCompletion(completed: SessionType, next: SessionType) {
        let content = UNMutableNotificationContent()
        content.title = "\(completed.title) complete"
        content.body = "\(next.title) is up next."
        let request = UNNotificationRequest(identifier: UUID().uuidString, content: content, trigger: nil)
        UNUserNotificationCenter.current().add(request)
    }
}
```

- [ ] **Step 3: Wire effects into the real engine (production `makeEngine`)**

In `PomodoroTimerApp.swift`, update the production branch of `makeEngine()` and request notification permission. Replace `makeEngine()` with:

```swift
    static func makeEngine() -> TimerEngine {
        let args = ProcessInfo.processInfo.arguments
        if args.contains("-uiTestMode") {
            let suite = "uitest.\(UUID().uuidString)"
            let defaults = UserDefaults(suiteName: suite)!
            defaults.removePersistentDomain(forName: suite)
            return TimerEngine(
                store: SettingsStore(defaults: defaults),
                clock: .accelerated(factor: 60),
                onSessionComplete: { _, _ in }     // silent in UI tests
            )
        }
        Notifier.requestAuthorization()
        return TimerEngine(onSessionComplete: { completed, next in
            AlertSound.play()
            Notifier.notifyCompletion(completed: completed, next: next)
        })
    }
```

- [ ] **Step 4: Build + commit**

```bash
cd PomodoroTimer && xcodegen generate && cd .. && xcodebuild ... build
git add PomodoroTimer/Sources/Engine/AlertSound.swift PomodoroTimer/Sources/Engine/Notifier.swift PomodoroTimer/Sources/App/PomodoroTimerApp.swift
git commit -m "feat(engine): native completion sound + notification (FR-7)"
```

---

### Task 18: Launch-at-login helper

**Files:**
- Create: `PomodoroTimer/Sources/Engine/LoginItem.swift`

- [ ] **Step 1: Create `LoginItem.swift`**

```swift
import ServiceManagement

enum LoginItem {
    static var isEnabled: Bool { SMAppService.mainApp.status == .enabled }

    static func setEnabled(_ on: Bool) {
        do {
            if on { try SMAppService.mainApp.register() }
            else { try SMAppService.mainApp.unregister() }
        } catch {
            // Non-fatal: ignore (e.g. running unsigned from DerivedData may restrict this).
        }
    }
}
```

- [ ] **Step 2: Build + commit**

```bash
cd PomodoroTimer && xcodegen generate && cd .. && xcodebuild ... build
git add PomodoroTimer/Sources/Engine/LoginItem.swift
git commit -m "feat(engine): launch-at-login via SMAppService"
```

---

### Task 19: Extend XCUITests — settings edit + fast completion flow

**Files:**
- Modify: `PomodoroTimer/Tests/UI/TimerFlowUITests.swift`

- [ ] **Step 1: Add the settings + completion UI tests**

Append these methods to `TimerFlowUITests`:

```swift
    func testEditingFocusMinutesUpdatesClockWhenIdle() {
        let app = launch()
        _ = app.staticTexts["clock"].waitForExistence(timeout: 10)
        app.disclosureTriangles["settings-disclosure"].firstMatch.click()
        // Increment focus from 25 -> 26 via the stepper's increment.
        let focus = app.steppers["focus-minutes-field"]
        XCTAssertTrue(focus.waitForExistence(timeout: 5))
        focus.incrementArrows.firstMatch.click()
        XCTAssertEqual(app.staticTexts["clock"].label, "26:00")
    }

    func testCompletionAdvancesToBreakAndIncrementsCounter() {
        // Set focus to 1 minute, then with the 60x test clock it completes in ~1s.
        let app = launch()
        _ = app.staticTexts["clock"].waitForExistence(timeout: 10)
        app.disclosureTriangles["settings-disclosure"].firstMatch.click()
        let focus = app.steppers["focus-minutes-field"]
        XCTAssertTrue(focus.waitForExistence(timeout: 5))
        // 25 -> 1 : click decrement 24 times.
        for _ in 0..<24 { focus.decrementArrows.firstMatch.click() }
        XCTAssertEqual(app.staticTexts["clock"].label, "01:00")
        app.buttons["start-button"].click()
        // Expect the break to load (05:00) within a few seconds.
        let breakLoaded = NSPredicate(format: "label == %@", "05:00")
        expectation(for: breakLoaded, evaluatedWith: app.staticTexts["clock"])
        waitForExpectations(timeout: 8)
        XCTAssertTrue(app.otherElements["session-counter"].label.contains("1")
                      || app.staticTexts.containing(NSPredicate(format: "label CONTAINS 'Completed focus sessions: 1'")).count > 0)
    }
```

- [ ] **Step 2: Run the full UI suite, verify pass**

Run: `cd PomodoroTimer && xcodegen generate && cd .. && xcodebuild ... test -only-testing:PomodoroTimerUITests`
Expected: PASS (6 tests). If the settings stepper element type differs at runtime (macOS renders `Stepper` as a `stepper` with `incrementArrows`/`decrementArrows`), adjust the query to the reported element — verify via `xcrun xctrace`/the test failure's element tree and pick the stable identifier.

- [ ] **Step 3: Commit**

```bash
git add PomodoroTimer/Tests/UI/TimerFlowUITests.swift
git commit -m "test(ui): settings-edit + fast completion->break->counter flows"
```

---

### Task 20: App icon, accessibility pass, final gate

**Files:**
- Modify: `PomodoroTimer/Resources/Assets.xcassets` (AppIcon)
- Review: all `UI/` views

- [ ] **Step 1: Add an AppIcon set**

Add an `AppIcon` image set to `Assets.xcassets` (a simple tomato/clock glyph at the required sizes; a placeholder PNG is fine for personal use). In `project.yml` ensure `ASSETCATALOG_COMPILER_APPICON_NAME: AppIcon` under the app target `settings.base`, then regenerate.

- [ ] **Step 2: Accessibility pass**

Verify every interactive control has an `accessibilityIdentifier` and a sensible label (buttons already have text; steppers/toggles labelled). Confirm keyboard operability: Tab cycles controls; Space triggers the primary button (set via `.keyboardShortcut(.space, modifiers: [])`).

- [ ] **Step 3: Full build + full test suite (Phase 5 / final gate)**

Run: `xcodebuild -project PomodoroTimer/PomodoroTimer.xcodeproj -scheme PomodoroTimer -destination 'platform=macOS' clean test`
Expected: `** TEST SUCCEEDED **` — all unit + UI suites pass.

- [ ] **Step 4: Manual smoke + commit**

Launch the app; verify: menu-bar countdown, window controls, a real focus session completes with an audible sound + notification, settings persist across relaunch. Then:

```bash
git add PomodoroTimer
git commit -m "feat(macos): app icon + a11y pass; final gate green"
```

---

## Definition of Done (maps to spec §9)

- [ ] FR-1…FR-10 implemented natively; behavior matches the PRD and the worked sequencing example.
- [ ] Timing accurate across background/sleep/wake (no drift) — proven by `EngineTests.testWakeRecomputesFromTimestampNoDrift`.
- [ ] Completion plays an audible native sound AND posts a notification.
- [ ] Menu-bar countdown + window both reflect live state; controls work from each.
- [ ] Settings validate to bounds and persist across relaunch; running state in-memory.
- [ ] `TimerCore` + engine unit tests pass; core coverage ≥90%; `PomodoroTimerUITests` smoke suite passes via `xcodebuild test`.
- [ ] App builds and runs locally (no signing/notarization needed).
- [ ] Web prototype retired to `/web-prototype`.

---

## Self-review notes (author)

- **Spec coverage:** project/restructure (spec §1.2, §7) → Tasks 1–2; TimerCore (§2 L1, §6.1) → Tasks 3–7; engine timing + persistence + drift (§2 L2, §6.2) → Tasks 8–10; window UI + a11y ids + `-uiTestMode` (§2 L3, §3) → Tasks 11–13; XCUITest (§6.3) → Tasks 14, 19; menu bar (§2 L3) → Task 15; settings/sound/notifications/login (§4, FR-5/FR-7, §2 L2) → Tasks 16–18; icon/a11y/gate (§7, §9) → Task 20.
- **Type consistency:** `reduce`, `durationFor`, `nextSession`, `clampSettings`, `formatTime`, `TimerState.initial`, `SettingsPatch`, `TimerEngine(store:clock:autoStartTimer:onSessionComplete:)`, `A11y.*` identifiers are used consistently across tasks and tests.
- **Known execution caveat:** XCUITest element queries for SwiftUI `Stepper`/`DisclosureGroup` occasionally surface under a different element type at runtime; Task 19 Step 2 calls this out and says to adjust to the reported element. This is the one place that may need a small runtime tweak.
