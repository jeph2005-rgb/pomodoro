import type { ReactNode } from 'react';
import styles from './ProgressRing.module.css';

interface ProgressRingProps {
  totalSeconds: number;
  remainingSeconds: number;
  /** Centered content (the MM:SS clock). */
  children: ReactNode;
}

// Layout-only geometry (pixel values are allowed for ring geometry).
const SIZE = 240;
const STROKE = 12;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * SVG circular progress indicator.
 *
 * Elapsed proportion = (totalSeconds - remainingSeconds) / totalSeconds,
 * clamped to [0, 1], using totalSeconds from state as the denominator (never
 * recomputed from settings).
 *
 * TESTABILITY: the elapsed proportion is exposed as `data-progress` on the root
 * element (rounded to 4 decimals). Tests should read that attribute. The
 * stroke-dashoffset is derived deterministically from the same proportion.
 */
export default function ProgressRing({
  totalSeconds,
  remainingSeconds,
  children,
}: ProgressRingProps) {
  const raw = totalSeconds > 0 ? (totalSeconds - remainingSeconds) / totalSeconds : 0;
  const progress = Math.min(1, Math.max(0, raw));
  const dashOffset = CIRCUMFERENCE * (1 - progress);

  return (
    <div className={styles.wrapper} data-progress={progress.toFixed(4)}>
      <svg
        className={styles.svg}
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="presentation"
        aria-hidden="true"
      >
        <circle
          className={styles.track}
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          strokeWidth={STROKE}
          fill="none"
        />
        <circle
          className={styles.indicator}
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          strokeWidth={STROKE}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
      </svg>
      <div className={styles.center}>{children}</div>
    </div>
  );
}
