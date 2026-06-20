import { render, screen, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PomodoroApp from './PomodoroApp';
import { playAlert } from '@/lib/audio/playAlert';

// FR-7 alert is a side effect; assert it fires without making real sound.
jest.mock('@/lib/audio/playAlert', () => ({
  playAlert: jest.fn(),
  unlockAudio: jest.fn(),
}));

const mockedPlayAlert = playAlert as jest.MockedFunction<typeof playAlert>;

/** user-event configured to drive jest fake timers. */
function setup() {
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  const { container } = render(<PomodoroApp />);
  return { user, container };
}

function getClock(): HTMLElement {
  return screen.getByRole('timer');
}

beforeEach(() => {
  jest.useFakeTimers();
  localStorage.clear();
  mockedPlayAlert.mockClear();
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

describe('PomodoroApp', () => {
  it('renders the default focus session at 25:00 with three mode buttons', () => {
    setup();
    expect(getClock()).toHaveTextContent('25:00');
    const group = screen.getByRole('group', { name: /timer mode/i });
    expect(within(group).getAllByRole('button')).toHaveLength(3);
    expect(
      screen.getByRole('button', { name: /^focus$/i })
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('counts down after Start: 1s from start -> 24:59, 60s from start -> 24:00', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Start' }));

    // 1s total elapsed.
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(getClock()).toHaveTextContent('24:59');

    // 60s total elapsed (59 more seconds).
    act(() => {
      jest.advanceTimersByTime(59_000);
    });
    expect(getClock()).toHaveTextContent('24:00');
  });

  it('Pause halts the countdown and Resume continues it', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Start' }));

    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(getClock()).toHaveTextContent('24:55');

    await user.click(screen.getByRole('button', { name: 'Pause' }));
    act(() => {
      jest.advanceTimersByTime(10_000);
    });
    // Still frozen while paused.
    expect(getClock()).toHaveTextContent('24:55');

    await user.click(screen.getByRole('button', { name: 'Resume' }));
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(getClock()).toHaveTextContent('24:50');
  });

  it('Reset returns to 25:00 and stops', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Start' }));
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(getClock()).toHaveTextContent('24:55');

    await user.click(screen.getByRole('button', { name: 'Reset' }));
    expect(getClock()).toHaveTextContent('25:00');
    // Stopped: the toggle is back to Start.
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();
  });

  it('selecting the Short Break mode shows 05:00 and stops', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /short break/i }));
    expect(getClock()).toHaveTextContent('05:00');
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /short break/i })
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('announces mode change and session completion via the polite live region', async () => {
    const { user } = setup();
    const status = screen.getByRole('status');

    // Manual mode switch announces the new mode.
    await user.click(screen.getByRole('button', { name: /short break/i }));
    expect(status).toHaveTextContent(/short break selected/i);

    // Completing a session announces the transition to the next.
    await user.click(screen.getByRole('button', { name: 'Start' }));
    act(() => {
      jest.advanceTimersByTime(300_000);
    });
    // Short break complete -> focus started.
    expect(status).toHaveTextContent(/short break complete\. focus started\./i);
  });

  it('plays the alert when a session completes', async () => {
    const { user } = setup();
    // Short Break is 5 minutes = 300s; run it down to zero.
    await user.click(screen.getByRole('button', { name: /short break/i }));
    await user.click(screen.getByRole('button', { name: 'Start' }));

    act(() => {
      jest.advanceTimersByTime(300_000);
    });

    expect(mockedPlayAlert).toHaveBeenCalledTimes(1);
  });

  it('the progress ring reflects elapsed proportion', async () => {
    const { user, container } = setup();

    const ring = () => container.querySelector('[data-progress]') as HTMLElement;
    expect(ring()).toHaveAttribute('data-progress', '0.0000');

    await user.click(screen.getByRole('button', { name: 'Start' }));
    // 150s of a 1500s focus session = 0.1 elapsed.
    act(() => {
      jest.advanceTimersByTime(150_000);
    });
    expect(ring()).toHaveAttribute('data-progress', '0.1000');
  });
});
