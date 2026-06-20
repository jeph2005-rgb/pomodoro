import { useEffect, useId, useRef, useState } from 'react';
import {
  MAX_DURATION_MINUTES,
  MAX_SESSIONS_UNTIL_LONG_BREAK,
  MIN_DURATION_MINUTES,
  MIN_SESSIONS_UNTIL_LONG_BREAK,
} from '@/lib/timer';
import type { TimerSettings } from '@/lib/timer';
import { cx } from '@/lib/cx';
import styles from './SettingsPanel.module.css';

interface SettingsPanelProps {
  settings: TimerSettings;
  updateSettings: (partial: Partial<TimerSettings>) => void;
}

type NumericKey = Exclude<keyof TimerSettings, 'autoStartNext'>;

const DURATION_FIELDS: { key: NumericKey; label: string }[] = [
  { key: 'focusMinutes', label: 'Focus (minutes)' },
  { key: 'shortBreakMinutes', label: 'Short break (minutes)' },
  { key: 'longBreakMinutes', label: 'Long break (minutes)' },
];

/**
 * FR-5 / FR-4: edit durations, sessions-until-long-break, and the auto-start
 * toggle. Validation, clamping and persistence all live in the reducer +
 * useTimer; this panel only reflects `settings` and emits `updateSettings`.
 *
 * Numeric inputs use a local draft string so the user can transiently clear or
 * mistype a field. We only emit when the draft parses to a finite number (so we
 * never dispatch NaN); on blur the draft is re-synced to the canonical setting,
 * which reverts rejected input and shows the clamped/rounded value.
 */
export default function SettingsPanel({
  settings,
  updateSettings,
}: SettingsPanelProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  // Local editing buffers keyed by field, so typing "" doesn't dispatch NaN.
  const [drafts, setDrafts] = useState<Record<NumericKey, string>>({
    focusMinutes: String(settings.focusMinutes),
    shortBreakMinutes: String(settings.shortBreakMinutes),
    longBreakMinutes: String(settings.longBreakMinutes),
    sessionsUntilLongBreak: String(settings.sessionsUntilLongBreak),
  });

  // Mark our own edits so the external-sync effect below doesn't fight typing.
  const selfEdit = useRef(false);

  function handleNumericChange(key: NumericKey, raw: string) {
    setDrafts((prev) => ({ ...prev, [key]: raw }));
    const parsed = Number(raw);
    // Skip empty / non-numeric so the reducer never sees NaN.
    if (raw.trim() !== '' && Number.isFinite(parsed)) {
      selfEdit.current = true;
      updateSettings({ [key]: parsed });
    }
  }

  // Resync drafts when settings change from outside this panel (hydrate from
  // localStorage on mount, reset, etc.) but not from our own keystrokes.
  useEffect(() => {
    if (selfEdit.current) {
      selfEdit.current = false;
      return;
    }
    setDrafts({
      focusMinutes: String(settings.focusMinutes),
      shortBreakMinutes: String(settings.shortBreakMinutes),
      longBreakMinutes: String(settings.longBreakMinutes),
      sessionsUntilLongBreak: String(settings.sessionsUntilLongBreak),
    });
  }, [settings]);

  function handleNumericBlur(key: NumericKey) {
    // Re-sync the draft to the canonical (clamped/rounded/reverted) value.
    setDrafts((prev) => ({ ...prev, [key]: String(settings[key]) }));
  }

  return (
    <div className={styles.wrapper}>
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((prev) => !prev)}
      >
        Settings
      </button>

      <div
        id={panelId}
        className={cx(styles.panel, !open && styles.hidden)}
        hidden={!open}
      >
        {DURATION_FIELDS.map(({ key, label }) => (
          <label key={key} className={styles.field}>
            <span className={styles.label}>{label}</span>
            <input
              type="number"
              className={styles.input}
              min={MIN_DURATION_MINUTES}
              max={MAX_DURATION_MINUTES}
              step={1}
              value={drafts[key]}
              onChange={(event) => handleNumericChange(key, event.target.value)}
              onBlur={() => handleNumericBlur(key)}
            />
          </label>
        ))}

        <label className={styles.field}>
          <span className={styles.label}>Sessions until long break</span>
          <input
            type="number"
            className={styles.input}
            min={MIN_SESSIONS_UNTIL_LONG_BREAK}
            max={MAX_SESSIONS_UNTIL_LONG_BREAK}
            step={1}
            value={drafts.sessionsUntilLongBreak}
            onChange={(event) =>
              handleNumericChange('sessionsUntilLongBreak', event.target.value)
            }
            onBlur={() => handleNumericBlur('sessionsUntilLongBreak')}
          />
        </label>

        <label className={cx(styles.field, styles.checkboxField)}>
          <input
            type="checkbox"
            className={styles.checkbox}
            checked={settings.autoStartNext}
            onChange={(event) =>
              updateSettings({ autoStartNext: event.target.checked })
            }
          />
          <span className={styles.label}>Auto-start next session</span>
        </label>
      </div>
    </div>
  );
}
