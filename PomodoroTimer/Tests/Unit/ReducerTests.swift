import XCTest
@testable import PomodoroTimer

final class ReducerTests: XCTestCase {
    private func running(remaining: Int = 1500, settings: TimerSettings = .default,
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
        var s = running(remaining: 1, session: .focus, cyclePosition: 3)
        s = reduce(s, .tick(remaining: 0))
        XCTAssertEqual(s.currentSession, .longBreak)
    }

    func testCompletingLongBreakResetsCycle() {
        var s = running(remaining: 1, session: .longBreak, cyclePosition: 4)
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

    func testSkipAtThresholdGoesToShortBreakNotLongBreak() {
        // cyclePosition 3, threshold 4 — a completion here would give longBreak,
        // but a skip must not.
        var s = running(remaining: 100, session: .focus, cyclePosition: 3)
        s = reduce(s, .skip)
        XCTAssertEqual(s.currentSession, .shortBreak)
    }
}
