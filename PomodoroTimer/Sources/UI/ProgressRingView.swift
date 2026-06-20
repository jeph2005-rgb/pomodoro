import SwiftUI

struct ProgressRingView: View {
    let remainingSeconds: Int
    let totalSeconds: Int
    let accent: Color

    private var elapsedFraction: Double {
        guard totalSeconds > 0 else { return 0 }
        let f = Double(totalSeconds - remainingSeconds) / Double(totalSeconds)
        return min(1, max(0, f))
    }

    var body: some View {
        ZStack {
            ZStack {
                Circle().stroke(Color.secondary.opacity(0.2), lineWidth: 14)
                Circle()
                    .trim(from: 0, to: elapsedFraction)
                    .stroke(accent, style: StrokeStyle(lineWidth: 14, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                    .animation(.linear(duration: 0.25), value: elapsedFraction)
            }
            .accessibilityElement()
            .accessibilityIdentifier(A11y.progressRing)
            TimerDisplayView(remainingSeconds: remainingSeconds)
        }
        // Keep the clock Text individually queryable: putting the ring identifier on
        // the outer ZStack made SwiftUI merge the inner clock Text into the ring
        // element, so `clock` was unreachable. Scope the ring id to the ring shapes
        // and let the container expose its children so `clock` surfaces on its own.
        .accessibilityElement(children: .contain)
        .frame(width: 240, height: 240)
        .padding()
    }
}
