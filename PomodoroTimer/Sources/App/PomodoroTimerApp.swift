import SwiftUI

@main
struct PomodoroTimerApp: App {
    @State private var engine: TimerEngine

    init() {
        let e = PomodoroTimerApp.makeEngine()
        _engine = State(initialValue: e)
        NSWorkspace.shared.notificationCenter.addObserver(
            forName: NSWorkspace.didWakeNotification, object: nil, queue: .main) { _ in e.refresh() }
    }

    var body: some Scene {
        Window("Pomodoro", id: "main") {
            TimerWindowView(engine: engine)
                .onReceive(NotificationCenter.default.publisher(
                    for: NSApplication.didBecomeActiveNotification)) { _ in engine.refresh() }
        }
        .windowResizability(.contentSize)

        MenuBarExtra {
            MenuContent(engine: engine)
        } label: {
            MenuBarLabel(engine: engine)
        }
        .menuBarExtraStyle(.menu)
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
        Notifier.requestAuthorization()
        return TimerEngine(onSessionComplete: { completed, next in
            AlertSound.play()
            Notifier.notifyCompletion(completed: completed, next: next)
        })
    }
}
