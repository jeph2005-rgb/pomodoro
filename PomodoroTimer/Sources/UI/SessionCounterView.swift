import SwiftUI

struct SessionCounterView: View {
    let completedFocusSessions: Int
    let cyclePosition: Int
    let sessionsUntilLongBreak: Int

    var body: some View {
        VStack(spacing: 2) {
            Text("Completed focus sessions: \(completedFocusSessions)")
            Text("\(cyclePosition) / \(sessionsUntilLongBreak) until long break")
                .foregroundStyle(.secondary)
        }
        .font(.callout)
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier(A11y.sessionCounter)
    }
}
