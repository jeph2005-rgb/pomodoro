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

    // Expands the Settings section. Its header is an explicit Button (the app uses a
    // hand-rolled collapsible rather than SwiftUI's DisclosureGroup, whose triangle
    // does not toggle from XCUITest's synthesized clicks on macOS), so it clicks
    // reliably. Clicking once reveals the Form with the steppers.
    private func expandSettings(_ app: XCUIApplication) {
        let header = app.buttons[A11yIDs.settingsDisclosure]
        XCTAssertTrue(header.waitForExistence(timeout: 5), "settings-disclosure header not found")
        let focus = app.steppers[A11yIDs.focusField]
        if focus.exists { return }
        header.click()
        XCTAssertTrue(focus.waitForExistence(timeout: 5), "stepper did not appear after expanding settings")
    }

    // Resolves a Stepper's increment/decrement controls, tolerating either the
    // incrementArrows/decrementArrows accessors or two child buttons.
    private func stepperArrow(_ app: XCUIApplication, id: String, increment: Bool) -> XCUIElement {
        let stepper = app.steppers[id]
        let arrow = increment ? stepper.incrementArrows.firstMatch : stepper.decrementArrows.firstMatch
        if arrow.exists { return arrow }
        let buttons = stepper.buttons
        // AppKit renders the up arrow first, the down arrow second.
        return increment ? buttons.element(boundBy: 0) : buttons.element(boundBy: 1)
    }

    func testEditingFocusMinutesUpdatesClockWhenIdle() {
        let app = launch()
        _ = app.staticTexts["clock"].waitForExistence(timeout: 10)
        expandSettings(app)
        let focus = app.steppers[A11yIDs.focusField]
        XCTAssertTrue(focus.waitForExistence(timeout: 5))
        // Increment focus from 25 -> 26 via the stepper's increment arrow.
        stepperArrow(app, id: A11yIDs.focusField, increment: true).click()
        let updated = NSPredicate(format: "value == %@", "26:00")
        expectation(for: updated, evaluatedWith: app.staticTexts["clock"])
        waitForExpectations(timeout: 5)
    }

    func testCompletionAdvancesToBreakAndIncrementsCounter() {
        // Set focus to 1 minute, then with the 60x test clock it completes in ~1s.
        let app = launch()
        _ = app.staticTexts["clock"].waitForExistence(timeout: 10)
        expandSettings(app)
        let focus = app.steppers[A11yIDs.focusField]
        XCTAssertTrue(focus.waitForExistence(timeout: 5))
        // 25 -> 1 : click decrement 24 times.
        let dec = stepperArrow(app, id: A11yIDs.focusField, increment: false)
        for _ in 0..<24 { dec.click() }
        let oneMinute = NSPredicate(format: "value == %@", "01:00")
        expectation(for: oneMinute, evaluatedWith: app.staticTexts["clock"])
        waitForExpectations(timeout: 5)
        app.buttons["start-button"].click()
        // Expect the break to load (05:00) within a few seconds (60x clock).
        let breakLoaded = NSPredicate(format: "value == %@", "05:00")
        expectation(for: breakLoaded, evaluatedWith: app.staticTexts["clock"])
        waitForExpectations(timeout: 8)
        // The session counter combines its text; assert it reflects 1 completed
        // focus session in whichever attribute carries the combined string.
        let counter = app.descendants(matching: .any)[A11yIDs.sessionCounter].firstMatch
        XCTAssertTrue(counter.waitForExistence(timeout: 3))
        let counterText = ((counter.value as? String) ?? "") + " " + counter.label
        XCTAssertTrue(counterText.contains("Completed focus sessions: 1"),
                      "session-counter did not report 1 completed focus session; got: \(counterText)")
    }
}

private enum A11yIDs {
    static let settingsDisclosure = "settings-disclosure"
    static let focusField = "focus-minutes-field"
    static let shortField = "short-minutes-field"
    static let longField = "long-minutes-field"
    static let sessionsField = "sessions-field"
    static let sessionCounter = "session-counter"
}
