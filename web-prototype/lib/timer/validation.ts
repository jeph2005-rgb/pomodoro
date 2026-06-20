import {
  MAX_DURATION_MINUTES,
  MAX_SESSIONS_UNTIL_LONG_BREAK,
  MIN_DURATION_MINUTES,
  MIN_SESSIONS_UNTIL_LONG_BREAK,
} from './constants';
import type { TimerSettings } from './types';

const NUMERIC_BOUNDS: Record<
  keyof Omit<TimerSettings, 'autoStartNext'>,
  { min: number; max: number }
> = {
  focusMinutes: { min: MIN_DURATION_MINUTES, max: MAX_DURATION_MINUTES },
  shortBreakMinutes: { min: MIN_DURATION_MINUTES, max: MAX_DURATION_MINUTES },
  longBreakMinutes: { min: MIN_DURATION_MINUTES, max: MAX_DURATION_MINUTES },
  sessionsUntilLongBreak: {
    min: MIN_SESSIONS_UNTIL_LONG_BREAK,
    max: MAX_SESSIONS_UNTIL_LONG_BREAK,
  },
};

function toNumber(rawValue: unknown): number | null {
  if (typeof rawValue === 'number') {
    return Number.isFinite(rawValue) ? rawValue : null;
  }
  if (typeof rawValue === 'string') {
    const trimmed = rawValue.trim();
    if (trimmed === '') {
      return null;
    }
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Coerces a single setting value to a valid one (FR-5).
 *
 * - Booleans (`autoStartNext`) pass through unchanged.
 * - Numeric settings: non-integer input is rounded; out-of-range values are
 *   clamped to the nearest bound.
 * - Empty / NaN / non-numeric input is rejected and the `fallback` is returned.
 */
export function coerceSetting<K extends keyof TimerSettings>(
  key: K,
  rawValue: unknown,
  fallback: TimerSettings[K]
): TimerSettings[K] {
  if (key === 'autoStartNext') {
    return (
      typeof rawValue === 'boolean' ? rawValue : fallback
    ) as TimerSettings[K];
  }

  const numericKey = key as keyof typeof NUMERIC_BOUNDS;
  const parsed = toNumber(rawValue);
  if (parsed === null) {
    return fallback;
  }

  const { min, max } = NUMERIC_BOUNDS[numericKey];
  const rounded = Math.round(parsed);
  const clamped = Math.min(max, Math.max(min, rounded));
  return clamped as TimerSettings[K];
}

/**
 * Merges only validated values from `partial` onto `current`, keeping the prior
 * valid value for any rejected entry. Never produces NaN or out-of-range
 * durations.
 */
export function clampSettings(
  partial: Partial<TimerSettings>,
  current: TimerSettings
): TimerSettings {
  const result: TimerSettings = { ...current };
  (Object.keys(partial) as (keyof TimerSettings)[]).forEach((key) => {
    const rawValue = partial[key];
    if (rawValue === undefined) {
      return;
    }
    result[key] = coerceSetting(key, rawValue, current[key]) as never;
  });
  return result;
}
