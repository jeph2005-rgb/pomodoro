import Foundation

struct SettingsStore {
    static let key = "pomodoro.settings"
    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) { self.defaults = defaults }

    func load() -> TimerSettings {
        guard let data = defaults.data(forKey: Self.key),
              let decoded = try? JSONDecoder().decode(TimerSettings.self, from: data) else {
            return .default
        }
        return clampSettings(decoded)
    }

    func save(_ settings: TimerSettings) {
        if let data = try? JSONEncoder().encode(settings) {
            defaults.set(data, forKey: Self.key)
        }
    }
}
