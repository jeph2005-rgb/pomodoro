import { durationFor, getNextSession } from './sequencing';
import type { TimerAction, TimerState } from './types';
import { clampSettings } from './validation';

/** Pure reducer for the Pomodoro timer. Always returns a new state object. */
export function timerReducer(state: TimerState, action: TimerAction): TimerState {
  switch (action.type) {
    case 'HYDRATE': {
      const settings = clampSettings(action.settings, state.settings);
      const total = durationFor(state.currentSession, settings);
      return {
        ...state,
        settings,
        remainingSeconds: total,
        totalSeconds: total,
        isRunning: false,
      };
    }

    case 'START':
    case 'RESUME':
      return { ...state, isRunning: true };

    case 'PAUSE':
      return { ...state, isRunning: false };

    case 'RESET': {
      const total = durationFor(state.currentSession, state.settings);
      return {
        ...state,
        remainingSeconds: total,
        totalSeconds: total,
        isRunning: false,
      };
    }

    case 'CHANGE_MODE': {
      const total = durationFor(action.session, state.settings);
      return {
        ...state,
        currentSession: action.session,
        remainingSeconds: total,
        totalSeconds: total,
        isRunning: false,
      };
    }

    case 'SKIP': {
      const next = getNextSession(state, { counted: false });
      const total = durationFor(next, state.settings);
      return {
        ...state,
        currentSession: next,
        remainingSeconds: total,
        totalSeconds: total,
        isRunning: false,
      };
    }

    case 'UPDATE_SETTINGS': {
      const settings = clampSettings(action.settings, state.settings);
      if (state.isRunning) {
        return { ...state, settings };
      }
      const total = durationFor(state.currentSession, settings);
      return {
        ...state,
        settings,
        remainingSeconds: total,
        totalSeconds: total,
      };
    }

    case 'TICK': {
      if (!state.isRunning) {
        return state;
      }

      if (state.remainingSeconds > 1) {
        return { ...state, remainingSeconds: state.remainingSeconds - 1 };
      }

      // This tick completes the session: clock reaches 00:00, then the next
      // session loads in the same transition.
      const wasFocus = state.currentSession === 'focus';
      const wasLongBreak = state.currentSession === 'longBreak';
      const next = getNextSession(state, { counted: true });
      const total = durationFor(next, state.settings);

      let cyclePosition = state.cyclePosition;
      let completedFocusSessions = state.completedFocusSessions;
      if (wasFocus) {
        completedFocusSessions += 1;
        cyclePosition += 1;
      }
      if (wasLongBreak) {
        cyclePosition = 0;
      }

      return {
        ...state,
        currentSession: next,
        remainingSeconds: total,
        totalSeconds: total,
        isRunning: state.settings.autoStartNext,
        completedFocusSessions,
        cyclePosition,
        completionSignal: state.completionSignal + 1,
      };
    }
  }
}
