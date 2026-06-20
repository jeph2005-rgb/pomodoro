import SwiftUI

struct TimerDisplayView: View {
    let remainingSeconds: Int
    var body: some View {
        Text(formatTime(remainingSeconds))
            .font(.system(size: 56, weight: .semibold, design: .monospaced))
            .monospacedDigit()
            .accessibilityIdentifier(A11y.clock)
    }
}
