import AppKit

enum AlertSound {
    /// Reliable native completion sound (no Web Audio gymnastics).
    static func play() { NSSound(named: NSSound.Name("Glass"))?.play() }
}
