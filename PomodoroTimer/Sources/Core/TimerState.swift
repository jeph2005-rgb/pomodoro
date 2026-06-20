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
