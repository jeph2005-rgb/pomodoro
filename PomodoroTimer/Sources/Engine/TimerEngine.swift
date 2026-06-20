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
        let t = Timer(timeInterval: 0.25, repeats: true) { [weak self] _ in
            self?.refresh()
        }
        RunLoop.main.add(t, forMode: .common)
        timer = t
    }

    private func stopDisplayTimer() { timer?.invalidate(); timer = nil }
    private func stopTimer() { stopDisplayTimer(); endDate = nil }

    // MARK: Test hooks
    func reloadPersistedForTesting() -> TimerSettings { store.load() }
}
