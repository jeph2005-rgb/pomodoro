import XCTest
@testable import PomodoroTimer

final class EngineTests: XCTestCase {
    /// Controllable clock for deterministic timing tests.
    private final class FakeClock {
        var current = Date(timeIntervalSinceReferenceDate: 0)
        func clock() -> Clock { Clock(now: { self.current }) }
        func advance(_ seconds: TimeInterval) { current = current.addingTimeInterval(seconds) }
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

    func testCompletionCallbackReceivesCompletedAndNextSessions() {
        var short = TimerSettings.default; short.focusMinutes = 1 // 60s
        let fake = FakeClock()
        let suite = "test.\(UUID().uuidString)"
        let store = SettingsStore(defaults: UserDefaults(suiteName: suite)!)
        store.save(short)
        var captured: (completed: SessionType, next: SessionType)?
        let engine = TimerEngine(
            store: store,
            clock: fake.clock(),
            autoStartTimer: false,
            onSessionComplete: { completed, next in captured = (completed, next) }
        )
        engine.start()
        fake.advance(60); engine.refresh()
        XCTAssertEqual(captured?.completed, .focus)
        XCTAssertEqual(captured?.next, .shortBreak)
    }

    func testUpdateSettingsPersists() {
        let fake = FakeClock(); let (e, _) = makeEngine(fake)
        e.updateSettings(SettingsPatch(focusMinutes: 42))
        XCTAssertEqual(e.state.settings.focusMinutes, 42)
        XCTAssertEqual(e.reloadPersistedForTesting().focusMinutes, 42)
    }
}
