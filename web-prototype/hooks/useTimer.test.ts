import { act, renderHook } from '@testing-library/react';
import { playAlert, unlockAudio } from '@/lib/audio/playAlert';
import { DEFAULT_SETTINGS, STORAGE_KEY } from '@/lib/timer';
import { useTimer } from './useTimer';

jest.mock('@/lib/audio/playAlert', () => ({
  playAlert: jest.fn(),
  unlockAudio: jest.fn(),
}));

const mockPlayAlert = playAlert as jest.Mock;
const mockUnlockAudio = unlockAudio as jest.Mock;

// Advance fake timers by `seconds` whole 1s ticks, wrapped in act.
function tickSeconds(seconds: number): void {
  act(() => {
    jest.advanceTimersByTime(seconds * 1000);
  });
}

describe('useTimer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    window.localStorage.clear();
    mockPlayAlert.mockClear();
    mockUnlockAudio.mockClear();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('starts at a full focus session, not running', () => {
    const { result } = renderHook(() => useTimer());
    expect(result.current.state.currentSession).toBe('focus');
    expect(result.current.state.isRunning).toBe(false);
    expect(result.current.state.remainingSeconds).toBe(
      DEFAULT_SETTINGS.focusMinutes * 60
    );
  });

  it('does not beep on mount', () => {
    renderHook(() => useTimer());
    expect(mockPlayAlert).not.toHaveBeenCalled();
  });

  it('start unlocks audio and ticks the countdown down', () => {
    const { result } = renderHook(() => useTimer());
    const full = result.current.state.remainingSeconds;

    act(() => result.current.start());
    expect(mockUnlockAudio).toHaveBeenCalledTimes(1);
    expect(result.current.state.isRunning).toBe(true);

    tickSeconds(3);
    expect(result.current.state.remainingSeconds).toBe(full - 3);
  });

  it('pause stops ticking and resume continues', () => {
    const { result } = renderHook(() => useTimer());
    const full = result.current.state.remainingSeconds;

    act(() => result.current.start());
    tickSeconds(2);
    expect(result.current.state.remainingSeconds).toBe(full - 2);

    act(() => result.current.pause());
    expect(result.current.state.isRunning).toBe(false);
    tickSeconds(5);
    // No further countdown while paused.
    expect(result.current.state.remainingSeconds).toBe(full - 2);

    act(() => result.current.resume());
    tickSeconds(2);
    expect(result.current.state.remainingSeconds).toBe(full - 4);
  });

  it('fires the alert exactly once when a session completes', () => {
    // Hydrate a tiny focus duration so completion is quick.
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...DEFAULT_SETTINGS, focusMinutes: 1 })
    );
    const { result } = renderHook(() => useTimer());
    // HYDRATE applied on mount.
    expect(result.current.state.remainingSeconds).toBe(60);

    act(() => result.current.start());
    tickSeconds(60); // run to completion

    expect(mockPlayAlert).toHaveBeenCalledTimes(1);
    // autoStartNext defaults false -> stopped on the next session.
    expect(result.current.state.currentSession).toBe('shortBreak');
    expect(result.current.state.isRunning).toBe(false);
    expect(result.current.state.completedFocusSessions).toBe(1);
  });

  it('auto-starts the next session when autoStartNext is enabled', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...DEFAULT_SETTINGS,
        focusMinutes: 1,
        autoStartNext: true,
      })
    );
    const { result } = renderHook(() => useTimer());
    expect(result.current.state.remainingSeconds).toBe(60);

    act(() => result.current.start());
    tickSeconds(60);

    expect(mockPlayAlert).toHaveBeenCalledTimes(1);
    expect(result.current.state.currentSession).toBe('shortBreak');
    expect(result.current.state.isRunning).toBe(true);
  });

  it('HYDRATE applies persisted settings on mount', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...DEFAULT_SETTINGS, focusMinutes: 10 })
    );
    const { result } = renderHook(() => useTimer());
    expect(result.current.state.settings.focusMinutes).toBe(10);
    expect(result.current.state.remainingSeconds).toBe(600);
  });

  it('persists settings to localStorage when updated via the UI', () => {
    const { result } = renderHook(() => useTimer());
    act(() => result.current.updateSettings({ focusMinutes: 30 }));

    expect(result.current.state.settings.focusMinutes).toBe(30);
    const raw = window.localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string).focusMinutes).toBe(30);
  });

  it('does not write to localStorage on a no-op mount', () => {
    renderHook(() => useTimer());
    // No stored data and no user change: the persist effect must not echo
    // the initial settings reference back to storage.
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('stops ticking on unmount (no leaked interval)', () => {
    const { result, unmount } = renderHook(() => useTimer());
    act(() => result.current.start());
    expect(() => {
      unmount();
      jest.advanceTimersByTime(5000);
    }).not.toThrow();
  });
});
