import XCTest

final class TimerFlowUITests: XCTestCase {
    override func setUp() { continueAfterFailure = false }

    private func launch() -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments += ["-uiTestMode"]
        app.launch()
        return app
    }

    // The clock is a SwiftUI Text that surfaces its time string via the accessibility
    // `value` attribute (label is empty), so read `value` rather than `label`.
    private func clockValue(_ app: XCUIApplication) -> String {
        (app.staticTexts["clock"].value as? String) ?? ""
    }

    func testDefaultStateShowsFocusAndThreeTabs() {
        let app = launch()
        XCTAssertTrue(app.staticTexts["clock"].waitForExistence(timeout: 10))
        XCTAssertEqual(clockValue(app), "25:00")
        XCTAssertTrue(app.buttons["mode-tab-focus"].exists)
        XCTAssertTrue(app.buttons["mode-tab-shortBreak"].exists)
        XCTAssertTrue(app.buttons["mode-tab-longBreak"].exists)
        XCTAssertTrue(app.buttons["start-button"].exists)
    }

    func testStartCountsDownThenPauseHaltsThenResume() {
        let app = launch()
        _ = app.staticTexts["clock"].waitForExistence(timeout: 10)
        app.buttons["start-button"].click()
        // Accelerated clock (60x): value should drop within ~1s.
        let dropped = NSPredicate(format: "value != %@", "25:00")
        expectation(for: dropped, evaluatedWith: app.staticTexts["clock"])
        waitForExpectations(timeout: 5)
        // Pause and confirm it stops changing.
        app.buttons["start-button"].click() // now labelled "Pause"
        let frozen = clockValue(app)
        Thread.sleep(forTimeInterval: 1.0)
        XCTAssertEqual(clockValue(app), frozen)
        // Resume and confirm the countdown continues (value drops below the frozen snapshot).
        app.buttons["start-button"].click() // now labelled "Resume"
        let resumedAndDropped = NSPredicate(format: "value != %@", frozen)
        expectation(for: resumedAndDropped, evaluatedWith: app.staticTexts["clock"])
        waitForExpectations(timeout: 5)
    }

    func testResetReturnsToFullAndStops() {
        let app = launch()
        _ = app.staticTexts["clock"].waitForExistence(timeout: 10)
        app.buttons["start-button"].click()
        Thread.sleep(forTimeInterval: 0.5)
        app.buttons["reset-button"].click()
        XCTAssertEqual(clockValue(app), "25:00")
        XCTAssertEqual(app.buttons["start-button"].label, "Start")
    }

    func testSelectingShortBreakTabSwitchesAndStops() {
        let app = launch()
        _ = app.staticTexts["clock"].waitForExistence(timeout: 10)
        app.buttons["mode-tab-shortBreak"].click()
        XCTAssertEqual(clockValue(app), "05:00")
    }
}
