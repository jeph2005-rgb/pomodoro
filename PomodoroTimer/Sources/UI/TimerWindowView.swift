import SwiftUI

struct TimerWindowView: View {
    @Bindable var engine: TimerEngine

    private var atFullDuration: Bool {
        engine.state.remainingSeconds == engine.state.totalSeconds
    }

    var body: some View {
        VStack(spacing: 20) {
            ModeTabsView(current: engine.state.currentSession) { engine.changeMode($0) }
            ProgressRingView(
                remainingSeconds: engine.state.remainingSeconds,
                totalSeconds: engine.state.totalSeconds,
                accent: engine.state.currentSession.accent
            )
            ControlsView(
                isRunning: engine.state.isRunning,
                atFullDuration: atFullDuration,
                onPrimary: {
                    if engine.state.isRunning { engine.pause() }
                    else if atFullDuration { engine.start() }
                    else { engine.resume() }
                },
                onReset: { engine.reset() },
                onSkip: { engine.skip() }
            )
            SessionCounterView(
                completedFocusSessions: engine.state.completedFocusSessions,
                cyclePosition: engine.state.cyclePosition,
                sessionsUntilLongBreak: engine.state.settings.sessionsUntilLongBreak
            )
        }
        .padding(28)
        .frame(minWidth: 380, minHeight: 560)
    }
}
