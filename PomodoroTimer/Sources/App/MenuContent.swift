import SwiftUI

struct MenuContent: View {
    @Bindable var engine: TimerEngine
    @Environment(\.openWindow) private var openWindow

    private var atFullDuration: Bool {
        engine.state.remainingSeconds == engine.state.totalSeconds
    }

    var body: some View {
        Text("\(engine.state.currentSession.title) — \(formatTime(engine.state.remainingSeconds))")
        Divider()
        if engine.state.isRunning {
            Button("Pause") { engine.pause() }
        } else {
            Button(atFullDuration ? "Start" : "Resume") {
                atFullDuration ? engine.start() : engine.resume()
            }
        }
        Button("Skip") { engine.skip() }
        Button("Reset") { engine.reset() }
        Divider()
        Button("Open Window") { openWindow(id: "main") }
        Button("Quit") { NSApplication.shared.terminate(nil) }
    }
}
