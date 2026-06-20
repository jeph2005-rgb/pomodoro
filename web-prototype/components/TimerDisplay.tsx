import { formatTime } from '@/lib/timer';
import styles from './TimerDisplay.module.css';

interface TimerDisplayProps {
  remainingSeconds: number;
}

/** Renders the remaining time as a zero-padded MM:SS clock. */
export default function TimerDisplay({ remainingSeconds }: TimerDisplayProps) {
  const label = formatTime(remainingSeconds);
  return (
    <time className={styles.clock} role="timer" aria-label={`Time remaining ${label}`}>
      {label}
    </time>
  );
}
