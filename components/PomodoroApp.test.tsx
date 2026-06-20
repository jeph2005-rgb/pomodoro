import { render, screen, act } from '@testing-library/react';
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
  render(<PomodoroApp />);
  return user;
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
  it('renders the default focus session at 25:00 with three mode tabs', () => {
    setup();
    expect(getClock()).toHaveTextContent('25:00');
    expect(screen.getAllByRole('tab')).toHaveLength(3);
    expect(screen.getByRole('tab', { name: /focus/i })).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  it('counts down after Start: +1s -> 24:59, +60s -> 24:00', async () => {
    const user = setup();
    await user.click(screen.getByRole('button', { name: 'Start' }));

    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(getClock()).toHaveTextContent('24:59');

    act(() => {
      jest.advanceTimersByTime(60_000);
    });
    expect(getClock()).toHaveTextContent('23:59');
  });

  it('Pause halts the countdown and Resume continues it', async () => {
    const user = setup();
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
    const user = setup();
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

  it('selecting the Short Break tab shows 05:00 and stops', async () => {
    const user = setup();
    await user.click(screen.getByRole('tab', { name: /short break/i }));
    expect(getClock()).toHaveTextContent('05:00');
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /short break/i })).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  it('plays the alert when a session completes', async () => {
    const user = setup();
    // Short Break is 5 minutes = 300s; run it down to zero.
    await user.click(screen.getByRole('tab', { name: /short break/i }));
    await user.click(screen.getByRole('button', { name: 'Start' }));

    act(() => {
      jest.advanceTimersByTime(300_000);
    });

    expect(mockedPlayAlert).toHaveBeenCalledTimes(1);
  });

  it('the progress ring reflects elapsed proportion', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const { container } = render(<PomodoroApp />);

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
