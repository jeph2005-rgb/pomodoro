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
        let wasLongBreak = s.currentSession == .longBreak
        let next = nextSession(s, counted: false)
        if wasLongBreak { s.cyclePosition = 0 }
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
        let wasLongBreak = s.currentSession == .longBreak
        let next = nextSession(s, counted: true)
        s.completionCount += 1
        if wasFocus {
            s.completedFocusSessions += 1
            s.cyclePosition += 1
        }
        if wasLongBreak {
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
