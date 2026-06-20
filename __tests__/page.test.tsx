import { render, screen } from "@testing-library/react";
import Home from "@/app/page";

// Phase 0 smoke test: proves the next/jest + RTL + jest-dom harness works.
describe("Home", () => {
  it("renders the Pomodoro Timer heading", () => {
    render(<Home />);
    expect(
      screen.getByRole("heading", { level: 1, name: /pomodoro timer/i }),
    ).toBeInTheDocument();
  });
});
