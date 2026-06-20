import Foundation

struct TimerSettings: Codable, Equatable {
    var focusMinutes: Int
    var shortBreakMinutes: Int
    var longBreakMinutes: Int
    var sessionsUntilLongBreak: Int
    var autoStartNext: Bool

    static let `default` = TimerSettings(
        focusMinutes: 25,
        shortBreakMinutes: 5,
        longBreakMinutes: 15,
        sessionsUntilLongBreak: 4,
        autoStartNext: false
    )
}

enum SettingsBounds {
    static let minMinutes = 1
    static let maxMinutes = 180
    static let minSessions = 1
    static let maxSessions = 12
}

/// Optional fields for a partial settings update. A `nil` field means "leave unchanged".
/// The UI passes `nil` for empty/invalid input, so the core never receives NaN.
struct SettingsPatch: Equatable {
    var focusMinutes: Int? = nil
    var shortBreakMinutes: Int? = nil
    var longBreakMinutes: Int? = nil
    var sessionsUntilLongBreak: Int? = nil
    var autoStartNext: Bool? = nil
}
