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
