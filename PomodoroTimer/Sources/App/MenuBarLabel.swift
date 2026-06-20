import SwiftUI

struct MenuBarLabel: View {
    @Bindable var engine: TimerEngine
    var body: some View {
        Text(formatTime(engine.state.remainingSeconds))
            .monospacedDigit()
    }
}
