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
        XCTAssertEqual(nextSession(state(.focus, cyclePosition: 3), counted: true), .longBreak)
    }

    func testShortBreakToFocus() {
        XCTAssertEqual(nextSession(state(.shortBreak, cyclePosition: 2), counted: true), .focus)
    }

    func testLongBreakToFocus() {
        XCTAssertEqual(nextSession(state(.longBreak, cyclePosition: 0), counted: true), .focus)
    }

    func testSkipDoesNotAdvanceFocusToLongBreakAtThreshold() {
        XCTAssertEqual(nextSession(state(.focus, cyclePosition: 3), counted: false), .shortBreak)
    }
}
