import { DEFAULT_SETTINGS } from './constants';
import { durationFor, getNextSession } from './sequencing';
import type { SessionType, TimerState } from './types';

function stateWith(
  currentSession: SessionType,
  cyclePosition: number
): TimerState {
  return {
    settings: DEFAULT_SETTINGS,
    currentSession,
    remainingSeconds: 0,
    totalSeconds: 0,
    isRunning: false,
    completedFocusSessions: 0,
    cyclePosition,
    completionSignal: 0,
  };
}

describe('durationFor', () => {
  it('returns configured duration in seconds for each session type', () => {
    expect(durationFor('focus', DEFAULT_SETTINGS)).toBe(25 * 60);
    expect(durationFor('shortBreak', DEFAULT_SETTINGS)).toBe(5 * 60);
    expect(durationFor('longBreak', DEFAULT_SETTINGS)).toBe(15 * 60);
  });

  it('reads durations from its settings argument, not defaults', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      focusMinutes: 50,
      shortBreakMinutes: 8,
      longBreakMinutes: 30,
    };
    expect(durationFor('focus', settings)).toBe(3000);
    expect(durationFor('shortBreak', settings)).toBe(8 * 60);
    expect(durationFor('longBreak', settings)).toBe(30 * 60);
  });
});

describe('getNextSession', () => {
  it('advances focus -> shortBreak before the threshold', () => {
    // cyclePosition 0 -> completing gives 1, below threshold 4.
    expect(getNextSession(stateWith('focus', 0), { counted: true })).toBe(
      'shortBreak'
    );
  });

  it('advances focus -> longBreak on the Nth focus (N=4, counted:true)', () => {
    // cyclePosition 3 -> completing gives 4 === threshold.
    expect(getNextSession(stateWith('focus', 3), { counted: true })).toBe(
      'longBreak'
    );
  });

  it('advances shortBreak -> focus', () => {
    expect(getNextSession(stateWith('shortBreak', 2), { counted: true })).toBe(
      'focus'
    );
  });

  it('advances longBreak -> focus', () => {
    expect(getNextSession(stateWith('longBreak', 4), { counted: true })).toBe(
      'focus'
    );
  });

  it('with counted:false (skip) does NOT advance focus to longBreak at the threshold', () => {
    // cyclePosition 3 would be the would-be-Nth focus, but a skip must not earn
    // a long break.
    expect(getNextSession(stateWith('focus', 3), { counted: false })).toBe(
      'shortBreak'
    );
  });
});
