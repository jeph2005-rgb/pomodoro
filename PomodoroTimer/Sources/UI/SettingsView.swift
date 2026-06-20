import SwiftUI

struct SettingsView: View {
    @Bindable var engine: TimerEngine
    @State private var expanded = false

    var body: some View {
        // A hand-rolled collapsible section instead of SwiftUI's DisclosureGroup:
        // the latter only exposes a single DisclosureTriangle accessibility element
        // that does not toggle from XCUITest's synthesized clicks on macOS. An
        // explicit header Button is reliably hittable for both users and UI tests.
        VStack(alignment: .leading, spacing: 8) {
            Button {
                withAnimation { expanded.toggle() }
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "chevron.right")
                        .rotationEffect(.degrees(expanded ? 90 : 0))
                        .font(.caption.weight(.semibold))
                    Text("Settings")
                    Spacer()
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier(A11y.settingsDisclosure)

            if expanded {
                Form {
                stepper("Focus (min)", value: engine.state.settings.focusMinutes,
                        id: A11y.focusField, range: SettingsBounds.minMinutes...SettingsBounds.maxMinutes) {
                    engine.updateSettings(SettingsPatch(focusMinutes: $0))
                }
                stepper("Short break (min)", value: engine.state.settings.shortBreakMinutes,
                        id: A11y.shortField, range: SettingsBounds.minMinutes...SettingsBounds.maxMinutes) {
                    engine.updateSettings(SettingsPatch(shortBreakMinutes: $0))
                }
                stepper("Long break (min)", value: engine.state.settings.longBreakMinutes,
                        id: A11y.longField, range: SettingsBounds.minMinutes...SettingsBounds.maxMinutes) {
                    engine.updateSettings(SettingsPatch(longBreakMinutes: $0))
                }
                stepper("Sessions until long break", value: engine.state.settings.sessionsUntilLongBreak,
                        id: A11y.sessionsField, range: SettingsBounds.minSessions...SettingsBounds.maxSessions) {
                    engine.updateSettings(SettingsPatch(sessionsUntilLongBreak: $0))
                }
                Toggle("Auto-start next session", isOn: Binding(
                    get: { engine.state.settings.autoStartNext },
                    set: { engine.updateSettings(SettingsPatch(autoStartNext: $0)) }
                ))
                .accessibilityIdentifier(A11y.autoStartToggle)

                Toggle("Launch at login", isOn: Binding(
                    get: { LoginItem.isEnabled },
                    set: { LoginItem.setEnabled($0) }
                ))
                }
            }
        }
    }

    @ViewBuilder
    private func stepper(_ title: String, value: Int, id: String,
                         range: ClosedRange<Int>, onChange: @escaping (Int) -> Void) -> some View {
        Stepper(value: Binding(get: { value }, set: { onChange($0) }), in: range) {
            Text("\(title): \(value)")
        }
        .accessibilityIdentifier(id)
    }
}
