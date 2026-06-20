import styles from './SessionCounter.module.css';

interface SessionCounterProps {
  /** Lifetime completed focus sessions for this page session. */
  completedFocusSessions: number;
  /** Completed focus sessions since the last long break. */
  cyclePosition: number;
  /** Focus sessions per cycle before a long break. */
  sessionsUntilLongBreak: number;
}

/**
 * FR-6: shows total completed focus sessions plus progress within the current
 * cycle toward the next long break. Purely presentational — the reducer owns
 * the counting.
 */
export default function SessionCounter({
  completedFocusSessions,
  cyclePosition,
  sessionsUntilLongBreak,
}: SessionCounterProps) {
  return (
    <div className={styles.counter}>
      <p className={styles.line}>
        Completed focus sessions: <strong>{completedFocusSessions}</strong>
      </p>
      <p className={styles.line}>
        <strong>
          {cyclePosition} / {sessionsUntilLongBreak}
        </strong>{' '}
        until long break
      </p>
    </div>
  );
}
