import { formatTime } from './format';

describe('formatTime', () => {
  it('formats 0 as 00:00', () => {
    expect(formatTime(0)).toBe('00:00');
  });

  it('zero-pads seconds: 5 -> 00:05', () => {
    expect(formatTime(5)).toBe('00:05');
  });

  it('formats 65 -> 01:05', () => {
    expect(formatTime(65)).toBe('01:05');
  });

  it('formats 1500 -> 25:00', () => {
    expect(formatTime(1500)).toBe('25:00');
  });

  it('clamps negatives to 00:00', () => {
    expect(formatTime(-1)).toBe('00:00');
    expect(formatTime(-3600)).toBe('00:00');
  });

  it('formats 10800 -> 180:00 (minutes may exceed two digits)', () => {
    expect(formatTime(10800)).toBe('180:00');
  });

  it('floors non-integer input', () => {
    expect(formatTime(65.9)).toBe('01:05');
  });

  it('clamps non-finite input (NaN, Infinity) to 00:00', () => {
    expect(formatTime(NaN)).toBe('00:00');
    expect(formatTime(Infinity)).toBe('00:00');
    expect(formatTime(-Infinity)).toBe('00:00');
  });
});
