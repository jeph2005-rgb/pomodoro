import SwiftUI

@main
struct PomodoroTimerApp: App {
    @State private var engine = PomodoroTimerApp.makeEngine()

    var body: some Scene {
        Window("Pomodoro", id: "main") {
            TimerWindowView(engine: engine)
        }
        .windowResizability(.contentSize)
    }

    /// Builds the engine, honoring the `-uiTestMode` launch argument (accelerated clock
    /// + reset settings) so UI tests can run completion flows fast.
    static func makeEngine() -> TimerEngine {
        let args = ProcessInfo.processInfo.arguments
        if args.contains("-uiTestMode") {
            let suite = "uitest.\(UUID().uuidString)"
            let defaults = UserDefaults(suiteName: suite)!
            defaults.removePersistentDomain(forName: suite)
            return TimerEngine(
                store: SettingsStore(defaults: defaults),
                clock: .accelerated(factor: 60),
                onSessionComplete: { _, _ in }    // sound/notifications wired in Phase 5
            )
        }
        return TimerEngine()
    }
}
