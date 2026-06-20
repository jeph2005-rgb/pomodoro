import { DEFAULT_SETTINGS } from './constants';
import { durationFor } from './sequencing';
import type { TimerSettings, TimerState } from './types';

/** Builds the initial timer state for a fresh focus session. */
export function createInitialState(
  settings: TimerSettings = DEFAULT_SETTINGS
): TimerState {
  const totalSeconds = durationFor('focus', settings);
  return {
    settings,
    currentSession: 'focus',
    remainingSeconds: totalSeconds,
    totalSeconds,
    isRunning: false,
    completedFocusSessions: 0,
    cyclePosition: 0,
    completionSignal: 0,
  };
}
