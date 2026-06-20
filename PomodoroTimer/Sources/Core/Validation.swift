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
