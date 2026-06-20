import Foundation

/// A source of "now". Production uses the real clock; UI tests use an accelerated one
/// so sessions complete in ~1s of wall time without weakening validation.
struct Clock {
    let now: () -> Date

    static let real = Clock(now: Date.init)

    /// Accelerates wall time by `factor` from the moment it is created.
    /// e.g. factor 60 => a 1-minute (60s) session elapses in ~1 real second.
    static func accelerated(factor: Double, start: Date = Date()) -> Clock {
        Clock(now: { start.addingTimeInterval(Date().timeIntervalSince(start) * factor) })
    }
}
