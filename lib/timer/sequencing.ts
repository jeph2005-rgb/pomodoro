import type { SessionType, TimerSettings, TimerState } from './types';

/** Returns the duration in seconds for the given session type. */
export function durationFor(session: SessionType, settings: TimerSettings): number {
  switch (session) {
    case 'focus':
      return settings.focusMinutes * 60;
    case 'shortBreak':
      return settings.shortBreakMinutes * 60;
    case 'longBreak':
      return settings.longBreakMinutes * 60;
  }
}

/**
 * Determines the next session type (FR-3).
 *
 * - From `shortBreak` or `longBreak`: always returns `focus`.
 * - From `focus`:
 *   - `counted: true` (genuine completion via TICK): returns `longBreak` if
 *     `cyclePosition + 1 >= sessionsUntilLongBreak`, else `shortBreak`.
 *   - `counted: false` (a SKIP, which does NOT advance the cycle): returns
 *     `longBreak` only if `cyclePosition >= sessionsUntilLongBreak` (normally
 *     never true mid-cycle), so a skipped focus advances to `shortBreak`. This
 *     prevents skipping the would-be-Nth focus from jumping to an unearned long
 *     break.
 */
export function getNextSession(
  state: TimerState,
  opts: { counted: boolean }
): SessionType {
  if (state.currentSession !== 'focus') {
    return 'focus';
  }

  const { cyclePosition, settings } = state;
  const threshold = settings.sessionsUntilLongBreak;

  if (opts.counted) {
    return cyclePosition + 1 >= threshold ? 'longBreak' : 'shortBreak';
  }

  return cyclePosition >= threshold ? 'longBreak' : 'shortBreak';
}
