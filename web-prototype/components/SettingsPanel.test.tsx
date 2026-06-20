import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PomodoroApp from './PomodoroApp';
import { playAlert } from '@/lib/audio/playAlert';
import { DEFAULT_SETTINGS, STORAGE_KEY } from '@/lib/timer';
import type { TimerSettings } from '@/lib/timer';

jest.mock('@/lib/audio/playAlert', () => ({
  playAlert: jest.fn(),
  unlockAudio: jest.fn(),
}));

const mockedPlayAlert = playAlert as jest.MockedFunction<typeof playAlert>;

function setup() {
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  const view = render(<PomodoroApp />);
  return { user, ...view };
}

function getClock(): HTMLElement {
  return screen.getByRole('timer');
}

async function expandSettings(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /settings/i }));
}

function focusInput(): HTMLInputElement {
  return screen.getByLabelText(/focus \(minutes\)/i) as HTMLInputElement;
}

function readStoredSettings(): TimerSettings | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw === null ? null : (JSON.parse(raw) as TimerSettings);
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

describe('SettingsPanel — settings & persistence', () => {
  it('changing focus minutes in settings updates the display and writes to localStorage', async () => {
    const { user } = setup();
    await expandSettings(user);

    const input = focusInput();
    await user.clear(input);
    await user.type(input, '10');

    expect(getClock()).toHaveTextContent('10:00');
    expect(readStoredSettings()?.focusMinutes).toBe(10);
  });

  it('rejects an out-of-range / empty duration input without writing NaN to localStorage', async () => {
    const { user } = setup();
    await expandSettings(user);

    const input = focusInput();

    // Clearing the field must not persist NaN; setting stays valid.
    await user.clear(input);
    expect(localStorage.getItem(STORAGE_KEY) ?? '').not.toMatch(/NaN/);
    // Clock still shows a valid duration (last valid = default 25:00).
    expect(getClock()).toHaveTextContent('25:00');

    // Blur reverts the empty draft back to the canonical value.
    await user.tab();
    expect(focusInput().value).toBe('25');

    // Out-of-range value clamps to max (180) — never NaN, never out of bounds.
    await user.clear(input);
    await user.type(input, '500');
    await user.tab();
    expect(localStorage.getItem(STORAGE_KEY) ?? '').not.toMatch(/NaN/);
    expect(focusInput().value).toBe('180');
    expect(readStoredSettings()?.focusMinutes).toBe(180);
  });

  it('falls back to defaults when localStorage holds malformed JSON', () => {
    localStorage.setItem(STORAGE_KEY, '{not valid json');
    expect(() => setup()).not.toThrow();
    expect(getClock()).toHaveTextContent('25:00');
  });

  it('restores persisted settings on mount', async () => {
    const persisted: TimerSettings = {
      ...DEFAULT_SETTINGS,
      focusMinutes: 42,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));

    const { user } = setup();
    expect(getClock()).toHaveTextContent('42:00');

    await expandSettings(user);
    expect(focusInput().value).toBe('42');
  });
});

describe('SessionCounter & auto-start', () => {
  it('increments the completed-focus counter after a focus session completes', async () => {
    const { user } = setup();
    await expandSettings(user);

    // Shrink the focus duration so we can drive it to completion quickly.
    const input = focusInput();
    await user.clear(input);
    await user.type(input, '1');
    expect(getClock()).toHaveTextContent('01:00');

    await user.click(screen.getByRole('button', { name: 'Start' }));
    act(() => {
      jest.advanceTimersByTime(60_000);
    });

    expect(
      screen.getByText(/completed focus sessions:/i)
    ).toHaveTextContent('1');
  });

  it('auto-start off: the next session is loaded but not running after completion', async () => {
    const { user } = setup();
    await expandSettings(user);

    const input = focusInput();
    await user.clear(input);
    await user.type(input, '1');

    await user.click(screen.getByRole('button', { name: 'Start' }));
    act(() => {
      jest.advanceTimersByTime(60_000);
    });

    // Next session is the 5-minute short break, loaded at full duration.
    expect(getClock()).toHaveTextContent('05:00');
    // Not running: the toggle reads "Start" (atFullDuration & stopped).
    expect(
      screen.getByRole('button', { name: 'Start' })
    ).toBeInTheDocument();

    // Confirm it does not tick on its own.
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(getClock()).toHaveTextContent('05:00');
  });

  it('auto-start on: the next session starts running automatically', async () => {
    const { user } = setup();
    await expandSettings(user);

    // Enable auto-start, then shrink focus duration.
    await user.click(screen.getByLabelText(/auto-start next session/i));
    const input = focusInput();
    await user.clear(input);
    await user.type(input, '1');

    await user.click(screen.getByRole('button', { name: 'Start' }));
    act(() => {
      jest.advanceTimersByTime(60_000);
    });

    // Short break (05:00) loaded AND already running.
    expect(getClock()).toHaveTextContent('05:00');
    expect(
      screen.getByRole('button', { name: 'Pause' })
    ).toBeInTheDocument();

    // Countdown continues without pressing Start.
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(getClock()).toHaveTextContent('04:57');
  });
});
