import SwiftUI

struct ModeTabsView: View {
    let current: SessionType
    let onSelect: (SessionType) -> Void

    var body: some View {
        HStack(spacing: 8) {
            ForEach(SessionType.allCases, id: \.self) { session in
                Button(session.title) { onSelect(session) }
                    .buttonStyle(.bordered)
                    .tint(session == current ? session.accent : .secondary)
                    .accessibilityIdentifier(A11y.modeTab(session))
                    .accessibilityAddTraits(session == current ? [.isSelected] : [])
            }
        }
    }
}
