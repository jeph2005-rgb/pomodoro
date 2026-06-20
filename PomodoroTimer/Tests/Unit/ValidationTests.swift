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
