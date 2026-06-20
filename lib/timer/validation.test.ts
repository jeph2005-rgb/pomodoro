import { DEFAULT_SETTINGS } from './constants';
import { clampSettings, coerceSetting } from './validation';

describe('clampSettings', () => {
  it('clamps durations below 1 and above 180 to the nearest bound', () => {
    expect(
      clampSettings({ focusMinutes: 0 }, DEFAULT_SETTINGS).focusMinutes
    ).toBe(1);
    expect(
      clampSettings({ focusMinutes: -50 }, DEFAULT_SETTINGS).focusMinutes
    ).toBe(1);
    expect(
      clampSettings({ shortBreakMinutes: 1000 }, DEFAULT_SETTINGS)
        .shortBreakMinutes
    ).toBe(180);
  });

  it('clamps sessionsUntilLongBreak to 1..12', () => {
    expect(
      clampSettings({ sessionsUntilLongBreak: 0 }, DEFAULT_SETTINGS)
        .sessionsUntilLongBreak
    ).toBe(1);
    expect(
      clampSettings({ sessionsUntilLongBreak: 99 }, DEFAULT_SETTINGS)
        .sessionsUntilLongBreak
    ).toBe(12);
  });

  it('rounds non-integer input to the nearest integer', () => {
    expect(
      clampSettings({ focusMinutes: 25.4 }, DEFAULT_SETTINGS).focusMinutes
    ).toBe(25);
    expect(
      clampSettings({ focusMinutes: 25.6 }, DEFAULT_SETTINGS).focusMinutes
    ).toBe(26);
  });

  it('rejects NaN/empty/non-numeric input, leaving the prior value unchanged', () => {
    expect(
      clampSettings({ focusMinutes: NaN }, DEFAULT_SETTINGS).focusMinutes
    ).toBe(DEFAULT_SETTINGS.focusMinutes);
    expect(
      clampSettings(
        { focusMinutes: '' as unknown as number },
        DEFAULT_SETTINGS
      ).focusMinutes
    ).toBe(DEFAULT_SETTINGS.focusMinutes);
    expect(
      clampSettings(
        { focusMinutes: 'abc' as unknown as number },
        DEFAULT_SETTINGS
      ).focusMinutes
    ).toBe(DEFAULT_SETTINGS.focusMinutes);
  });

  it('skips keys present but explicitly undefined, keeping the prior value', () => {
    const merged = clampSettings(
      { focusMinutes: undefined },
      DEFAULT_SETTINGS
    );
    expect(merged.focusMinutes).toBe(DEFAULT_SETTINGS.focusMinutes);
  });

  it('merges only provided keys and passes autoStartNext through', () => {
    const merged = clampSettings(
      { autoStartNext: true, focusMinutes: 30 },
      DEFAULT_SETTINGS
    );
    expect(merged.autoStartNext).toBe(true);
    expect(merged.focusMinutes).toBe(30);
    expect(merged.shortBreakMinutes).toBe(DEFAULT_SETTINGS.shortBreakMinutes);
  });
});

describe('coerceSetting', () => {
  it('parses numeric strings then clamps/rounds', () => {
    expect(coerceSetting('focusMinutes', '25', 25)).toBe(25);
    expect(coerceSetting('focusMinutes', '200', 25)).toBe(180);
  });

  it('returns the fallback for invalid numeric input', () => {
    expect(coerceSetting('focusMinutes', '', 25)).toBe(25);
    expect(coerceSetting('focusMinutes', NaN, 25)).toBe(25);
  });

  it('returns the fallback for a non-string, non-number numeric input', () => {
    // e.g. a boolean/object sneaking into a numeric field (malformed storage).
    expect(coerceSetting('focusMinutes', true as unknown as number, 25)).toBe(25);
    expect(coerceSetting('focusMinutes', null as unknown as number, 25)).toBe(25);
  });

  it('passes booleans through and falls back on invalid boolean input', () => {
    expect(coerceSetting('autoStartNext', true, false)).toBe(true);
    expect(coerceSetting('autoStartNext', 'nope' as unknown as boolean, false)).toBe(
      false
    );
  });
});
