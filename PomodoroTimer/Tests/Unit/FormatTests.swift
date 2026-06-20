import XCTest
@testable import PomodoroTimer

final class FormatTests: XCTestCase {
    func testFormatsZero() { XCTAssertEqual(formatTime(0), "00:00") }
    func testZeroPadsSeconds() { XCTAssertEqual(formatTime(5), "00:05") }
    func testFormatsMinutesAndSeconds() { XCTAssertEqual(formatTime(65), "01:05") }
    func testFormats1500() { XCTAssertEqual(formatTime(1500), "25:00") }
    func testClampsNegatives() { XCTAssertEqual(formatTime(-10), "00:00") }
    func testMinutesMayExceedTwoDigits() { XCTAssertEqual(formatTime(10800), "180:00") }
}
