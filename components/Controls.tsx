import { cx } from '@/lib/cx';
import styles from './Controls.module.css';

interface ControlsProps {
  isRunning: boolean;
  /** True when stopped at the full session duration (nothing elapsed yet). */
  atFullDuration: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
  onSkip: () => void;
}

/**
 * Transport controls: a single primary Start/Pause/Resume toggle (FR-2) plus
 * Reset and Skip.
 *
 * Toggle label logic:
 * - running                       -> "Pause"  (onPause)
 * - stopped at full duration      -> "Start"  (onStart)
 * - stopped mid-session (paused)  -> "Resume" (onResume)
 */
export default function Controls({
  isRunning,
  atFullDuration,
  onStart,
  onPause,
  onResume,
  onReset,
  onSkip,
}: ControlsProps) {
  let toggleLabel: string;
  let onToggle: () => void;
  if (isRunning) {
    toggleLabel = 'Pause';
    onToggle = onPause;
  } else if (atFullDuration) {
    toggleLabel = 'Start';
    onToggle = onStart;
  } else {
    toggleLabel = 'Resume';
    onToggle = onResume;
  }

  return (
    <div className={styles.controls}>
      <button
        type="button"
        className={cx(styles.button, styles.primary)}
        onClick={onToggle}
      >
        {toggleLabel}
      </button>
      <button type="button" className={styles.button} onClick={onReset}>
        Reset
      </button>
      <button type="button" className={styles.button} onClick={onSkip}>
        Skip
      </button>
    </div>
  );
}
