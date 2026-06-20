import type { TimerSettings } from './types';

export const DEFAULT_SETTINGS: TimerSettings = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  sessionsUntilLongBreak: 4,
  autoStartNext: false,
};

export const STORAGE_KEY = 'pomodoro.settings';

/** FR-5 bounds. */
export const MIN_DURATION_MINUTES = 1;
export const MAX_DURATION_MINUTES = 180;
export const MIN_SESSIONS_UNTIL_LONG_BREAK = 1;
export const MAX_SESSIONS_UNTIL_LONG_BREAK = 12;
