import SwiftUI

struct ControlsView: View {
    let isRunning: Bool
    let atFullDuration: Bool
    let onPrimary: () -> Void      // start OR resume OR pause
    let onReset: () -> Void
    let onSkip: () -> Void

    private var primaryTitle: String {
        if isRunning { return "Pause" }
        return atFullDuration ? "Start" : "Resume"
    }

    var body: some View {
        HStack(spacing: 12) {
            Button(primaryTitle, action: onPrimary)
                .keyboardShortcut(.space, modifiers: [])
                .accessibilityIdentifier(A11y.startButton)
            Button("Reset", action: onReset)
                .accessibilityIdentifier(A11y.resetButton)
            Button("Skip", action: onSkip)
                .accessibilityIdentifier(A11y.skipButton)
        }
        .buttonStyle(.borderedProminent)
    }
}
