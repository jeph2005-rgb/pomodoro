/**
 * Formats a number of seconds as zero-padded `MM:SS`.
 *
 * - Negatives clamp to `"00:00"`.
 * - Non-integer input is floored.
 * - Minutes are zero-padded to at least two digits but may exceed two when
 *   needed (180 min -> `"180:00"`).
 */
export function formatTime(totalSeconds: number): string {
  const safe = Number.isFinite(totalSeconds) ? totalSeconds : 0;
  const clamped = Math.max(0, Math.floor(safe));
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return `${mm}:${ss}`;
}
