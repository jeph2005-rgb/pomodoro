import type { SessionType } from '@/lib/timer';
import styles from './ModeTabs.module.css';

interface ModeTabsProps {
  current: SessionType;
  onSelect: (session: SessionType) => void;
}

const TABS: { session: SessionType; label: string }[] = [
  { session: 'focus', label: 'Focus' },
  { session: 'shortBreak', label: 'Short Break' },
  { session: 'longBreak', label: 'Long Break' },
];

/** Direct mode switch (FR): focus / shortBreak / longBreak. */
export default function ModeTabs({ current, onSelect }: ModeTabsProps) {
  return (
    <div className={styles.tabs} role="tablist" aria-label="Session mode">
      {TABS.map(({ session, label }) => {
        const active = session === current;
        return (
          <button
            key={session}
            type="button"
            role="tab"
            aria-selected={active}
            className={`${styles.tab} ${active ? styles.active : ''}`}
            onClick={() => onSelect(session)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
