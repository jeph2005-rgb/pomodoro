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
