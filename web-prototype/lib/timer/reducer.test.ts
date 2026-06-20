import { DEFAULT_SETTINGS } from './constants';
import { createInitialState } from './state';
import { durationFor } from './sequencing';
import { timerReducer } from './reducer';
import type { TimerSettings, TimerState } from './types';

function baseState(overrides: Partial<TimerState> = {}): TimerState {
  return { ...createInitialState(), ...overrides };
}

describe('timerReducer', () => {
  describe('run controls', () => {
    it('START sets isRunning true', () => {
      expect(timerReducer(baseState(), { type: 'START' }).isRunning).toBe(true);
    });

    it('RESUME sets isRunning true', () => {
      expect(timerReducer(baseState(), { type: 'RESUME' }).isRunning).toBe(true);
    });

    it('PAUSE sets isRunning false', () => {
      const running = baseState({ isRunning: true });
      expect(timerReducer(running, { type: 'PAUSE' }).isRunning).toBe(false);
    });
  });

  describe('RESET', () => {
    it('restores remaining to full and stops without touching counters', () => {
      const state = baseState({
        remainingSeconds: 10,
        isRunning: true,
        completedFocusSessions: 3,
        cyclePosition: 2,
      });
      const next = timerReducer(state, { type: 'RESET' });
      expect(next.remainingSeconds).toBe(durationFor('focus', DEFAULT_SETTINGS));
      expect(next.totalSeconds).toBe(durationFor('focus', DEFAULT_SETTINGS));
      expect(next.isRunning).toBe(false);
      expect(next.completedFocusSessions).toBe(3);
      expect(next.cyclePosition).toBe(2);
    });
  });

  describe('TICK', () => {
    it('decrements remainingSeconds by one', () => {
      const state = baseState({ remainingSeconds: 100, isRunning: true });
      expect(timerReducer(state, { type: 'TICK' }).remainingSeconds).toBe(99);
    });

    it('does not change totalSeconds on a plain tick', () => {
      const state = baseState({ remainingSeconds: 100, isRunning: true });
      const next = timerReducer(state, { type: 'TICK' });
      expect(next.totalSeconds).toBe(state.totalSeconds);
    });

    it('is a no-op when isRunning is false', () => {
      const state = baseState({ remainingSeconds: 100, isRunning: false });
      expect(timerReducer(state, { type: 'TICK' })).toBe(state);
    });

    it('TICK at remainingSeconds 0 is a no-op', () => {
      const state = baseState({
        currentSession: 'focus',
        remainingSeconds: 0,
        isRunning: true,
        completedFocusSessions: 2,
        cyclePosition: 2,
      });
      const next = timerReducer(state, { type: 'TICK' });
      expect(next).toBe(state);
      expect(next.completionSignal).toBe(state.completionSignal);
      expect(next.completedFocusSessions).toBe(2);
    });

    it('completing a focus session increments completedFocusSessions and cyclePosition', () => {
      const state = baseState({
        currentSession: 'focus',
        remainingSeconds: 1,
        isRunning: true,
        completedFocusSessions: 0,
        cyclePosition: 0,
      });
      const next = timerReducer(state, { type: 'TICK' });
      expect(next.completedFocusSessions).toBe(1);
      expect(next.cyclePosition).toBe(1);
    });

    it('completing any session increments completionSignal', () => {
      const state = baseState({
        currentSession: 'shortBreak',
        remainingSeconds: 1,
        isRunning: true,
      });
      const next = timerReducer(state, { type: 'TICK' });
      expect(next.completionSignal).toBe(state.completionSignal + 1);
    });

    it('completing the 4th focus transitions to longBreak', () => {
      const state = baseState({
        currentSession: 'focus',
        remainingSeconds: 1,
        isRunning: true,
        cyclePosition: 3, // completing makes 4 === threshold
      });
      const next = timerReducer(state, { type: 'TICK' });
      expect(next.currentSession).toBe('longBreak');
      expect(next.remainingSeconds).toBe(durationFor('longBreak', DEFAULT_SETTINGS));
    });

    it('completing a longBreak resets cyclePosition to 0', () => {
      const state = baseState({
        currentSession: 'longBreak',
        remainingSeconds: 1,
        isRunning: true,
        cyclePosition: 4,
      });
      const next = timerReducer(state, { type: 'TICK' });
      expect(next.cyclePosition).toBe(0);
      expect(next.currentSession).toBe('focus');
    });

    it('respects autoStartNext: false after completion stops the timer', () => {
      const state = baseState({
        settings: { ...DEFAULT_SETTINGS, autoStartNext: false },
        currentSession: 'focus',
        remainingSeconds: 1,
        isRunning: true,
      });
      expect(timerReducer(state, { type: 'TICK' }).isRunning).toBe(false);
    });

    it('respects autoStartNext: true after completion keeps running', () => {
      const settings: TimerSettings = { ...DEFAULT_SETTINGS, autoStartNext: true };
      const state = baseState({
        settings,
        currentSession: 'focus',
        remainingSeconds: 1,
        isRunning: true,
      });
      expect(timerReducer(state, { type: 'TICK' }).isRunning).toBe(true);
    });

    it('sets totalSeconds equal to the full duration of the loaded session', () => {
      const state = baseState({
        currentSession: 'focus',
        remainingSeconds: 1,
        isRunning: true,
        cyclePosition: 0,
      });
      const next = timerReducer(state, { type: 'TICK' });
      // Next session is shortBreak.
      expect(next.totalSeconds).toBe(durationFor('shortBreak', DEFAULT_SETTINGS));
      expect(next.remainingSeconds).toBe(next.totalSeconds);
    });
  });

  describe('CHANGE_MODE', () => {
    it('switches type, resets remaining, stops, and leaves counters alone', () => {
      const state = baseState({
        isRunning: true,
        completedFocusSessions: 2,
        cyclePosition: 1,
      });
      const next = timerReducer(state, {
        type: 'CHANGE_MODE',
        session: 'longBreak',
      });
      expect(next.currentSession).toBe('longBreak');
      expect(next.remainingSeconds).toBe(durationFor('longBreak', DEFAULT_SETTINGS));
      expect(next.totalSeconds).toBe(durationFor('longBreak', DEFAULT_SETTINGS));
      expect(next.isRunning).toBe(false);
      expect(next.completedFocusSessions).toBe(2);
      expect(next.cyclePosition).toBe(1);
    });
  });

  describe('SKIP', () => {
    it('advances without incrementing counters or completionSignal', () => {
      const state = baseState({
        currentSession: 'focus',
        isRunning: true,
        completedFocusSessions: 1,
        cyclePosition: 1,
      });
      const next = timerReducer(state, { type: 'SKIP' });
      expect(next.currentSession).toBe('shortBreak');
      expect(next.completedFocusSessions).toBe(1);
      expect(next.cyclePosition).toBe(1);
      expect(next.completionSignal).toBe(state.completionSignal);
      expect(next.isRunning).toBe(false);
    });

    it('at the long-break threshold advances to shortBreak not longBreak', () => {
      const state = baseState({
        currentSession: 'focus',
        cyclePosition: 3, // would-be 4th focus
      });
      const next = timerReducer(state, { type: 'SKIP' });
      expect(next.currentSession).toBe('shortBreak');
    });

    it('SKIP from longBreak resets cyclePosition to 0', () => {
      const state = baseState({
        currentSession: 'longBreak',
        cyclePosition: 4,
        completedFocusSessions: 4,
      });
      const next = timerReducer(state, { type: 'SKIP' });
      expect(next.currentSession).toBe('focus');
      expect(next.cyclePosition).toBe(0);
      // SKIP must not touch these.
      expect(next.completedFocusSessions).toBe(4);
      expect(next.completionSignal).toBe(state.completionSignal);
    });

    it('SKIP from shortBreak leaves cyclePosition unchanged', () => {
      const state = baseState({
        currentSession: 'shortBreak',
        cyclePosition: 2,
      });
      const next = timerReducer(state, { type: 'SKIP' });
      expect(next.currentSession).toBe('focus');
      expect(next.cyclePosition).toBe(2);
    });
  });

  describe('UPDATE_SETTINGS', () => {
    it('merges and updates current remaining when idle', () => {
      const state = baseState({ isRunning: false });
      const next = timerReducer(state, {
        type: 'UPDATE_SETTINGS',
        settings: { focusMinutes: 30 },
      });
      expect(next.settings.focusMinutes).toBe(30);
      expect(next.remainingSeconds).toBe(30 * 60);
      expect(next.totalSeconds).toBe(30 * 60);
    });

    it('does not change remaining OR totalSeconds while running', () => {
      const state = baseState({ isRunning: true, remainingSeconds: 600 });
      const next = timerReducer(state, {
        type: 'UPDATE_SETTINGS',
        settings: { focusMinutes: 30 },
      });
      expect(next.settings.focusMinutes).toBe(30);
      expect(next.remainingSeconds).toBe(600);
      expect(next.totalSeconds).toBe(state.totalSeconds);
    });

    it('never produces a NaN/0 duration from invalid input', () => {
      const state = baseState({ isRunning: false });
      const next = timerReducer(state, {
        type: 'UPDATE_SETTINGS',
        settings: { focusMinutes: NaN },
      });
      expect(next.settings.focusMinutes).toBe(DEFAULT_SETTINGS.focusMinutes);
      expect(next.remainingSeconds).toBe(durationFor('focus', DEFAULT_SETTINGS));
    });
  });

  describe('HYDRATE', () => {
    it('applies persisted settings and resets remaining for the current session', () => {
      const state = baseState({
        currentSession: 'shortBreak',
        remainingSeconds: 10,
        isRunning: true,
      });
      const persisted: TimerSettings = {
        focusMinutes: 50,
        shortBreakMinutes: 10,
        longBreakMinutes: 20,
        sessionsUntilLongBreak: 3,
        autoStartNext: true,
      };
      const next = timerReducer(state, { type: 'HYDRATE', settings: persisted });
      expect(next.settings).toEqual(persisted);
      expect(next.remainingSeconds).toBe(10 * 60);
      expect(next.totalSeconds).toBe(10 * 60);
      expect(next.isRunning).toBe(false);
    });
  });

  it('returns a new state object (no mutation)', () => {
    const state = baseState({ remainingSeconds: 100, isRunning: true });
    const next = timerReducer(state, { type: 'TICK' });
    expect(next).not.toBe(state);
    expect(state.remainingSeconds).toBe(100);
  });
});
