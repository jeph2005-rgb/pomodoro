import Foundation

/// Zero-padded MM:SS. Negatives clamp to "00:00". Minutes may exceed two digits.
func formatTime(_ totalSeconds: Int) -> String {
    let clamped = max(0, totalSeconds)
    return String(format: "%02d:%02d", clamped / 60, clamped % 60)
}
