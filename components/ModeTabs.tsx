import type { SessionType } from '@/lib/timer';
import { cx } from '@/lib/cx';
import styles from './ModeTabs.module.css';

interface ModeTabsProps {
  current: SessionType;
  onSelect: (session: SessionType) => void;
}

const MODES: { session: SessionType; label: string }[] = [
  { session: 'focus', label: 'Focus' },
  { session: 'shortBreak', label: 'Short Break' },
  { session: 'longBreak', label: 'Long Break' },
];

/**
 * Direct mode switch (FR): focus / shortBreak / longBreak.
 *
 * A11y: mode switching updates the timer content in place rather than swapping
 * panels, so this is a segmented control, not a tablist. We use a labelled
 * `role="group"` of toggle buttons that expose `aria-pressed` to indicate the
 * active mode — an honest contract that avoids the incomplete tab pattern.
 */
export default function ModeTabs({ current, onSelect }: ModeTabsProps) {
  return (
    <div className={styles.tabs} role="group" aria-label="Timer mode">
      {MODES.map(({ session, label }) => {
        const active = session === current;
        return (
          <button
            key={session}
            type="button"
            aria-pressed={active}
            className={cx(styles.tab, active && styles.active)}
            onClick={() => onSelect(session)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
