import SwiftUI

enum A11y {
    static let clock = "clock"
    static let progressRing = "progress-ring"
    static let startButton = "start-button"
    static let resetButton = "reset-button"
    static let skipButton = "skip-button"
    static let sessionCounter = "session-counter"
    static let settingsDisclosure = "settings-disclosure"
    static let focusField = "focus-minutes-field"
    static let shortField = "short-minutes-field"
    static let longField = "long-minutes-field"
    static let sessionsField = "sessions-field"
    static let autoStartToggle = "auto-start-toggle"
    static func modeTab(_ s: SessionType) -> String { "mode-tab-\(s.rawValue)" }
}

extension SessionType {
    var accent: Color {
        switch self {
        case .focus: return .red
        case .shortBreak: return .teal
        case .longBreak: return .indigo
        }
    }
    var title: String {
        switch self {
        case .focus: return "Focus"
        case .shortBreak: return "Short Break"
        case .longBreak: return "Long Break"
        }
    }
}
