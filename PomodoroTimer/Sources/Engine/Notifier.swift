import UserNotifications

enum Notifier {
    static func requestAuthorization() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { _, _ in }
    }

    static func notifyCompletion(completed: SessionType, next: SessionType) {
        let content = UNMutableNotificationContent()
        content.title = "\(completed.title) complete"
        content.body = "\(next.title) is up next."
        let request = UNNotificationRequest(identifier: UUID().uuidString, content: content, trigger: nil)
        UNUserNotificationCenter.current().add(request)
    }
}
