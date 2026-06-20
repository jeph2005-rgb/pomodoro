'use client';

import { useEffect, useRef, useState } from 'react';
import { useTimer } from '@/hooks/useTimer';
import type { SessionType } from '@/lib/timer';
import Controls from './Controls';
import ModeTabs from './ModeTabs';
import ProgressRing from './ProgressRing';
import SessionCounter from './SessionCounter';
import SettingsPanel from './SettingsPanel';
import TimerDisplay from './TimerDisplay';
import styles from './PomodoroApp.module.css';

const SESSION_LABELS: Record<SessionType, string> = {
  focus: 'Focus',
  shortBreak: 'Short break',
  longBreak: 'Long break',
};

/**
 * Top-level client component: owns the timer hook and composes the UI.
 * Kept thin — presentation lives in the child components.
 */
export default function PomodoroApp() {
  const { state, start, pause, resume, reset, skip, changeMode, updateSettings } =
    useTimer();
  const {
    settings,
    currentSession,
    remainingSeconds,
    totalSeconds,
    isRunning,
    completedFocusSessions,
    cyclePosition,
    completionSignal,
  } = state;

  const atFullDuration = remainingSeconds === totalSeconds;

  // Accessible, audio-free equivalent of the FR-7 alert: a polite live region
  // that announces session transitions for screen-reader users.
  const [announcement, setAnnouncement] = useState('');
  const prevSession = useRef<SessionType>(currentSession);
  const lastSignal = useRef(completionSignal);

  useEffect(() => {
    const sessionChanged = prevSession.current !== currentSession;
    const completed = completionSignal !== lastSignal.current;
    const completedLabel = SESSION_LABELS[prevSession.current];
    const newLabel = SESSION_LABELS[currentSession];

    if (completed) {
      // A session finished and the next one was loaded.
      setAnnouncement(`${completedLabel} complete. ${newLabel} started.`);
    } else if (sessionChanged) {
      // Manual mode switch.
      setAnnouncement(`${newLabel} selected.`);
    }

    lastSignal.current = completionSignal;
    prevSession.current = currentSession;
  }, [completionSignal, currentSession]);

  return (
    <div className={styles.app} data-mode={currentSession}>
      <h1 className={styles.title}>Pomodoro Timer</h1>
      <section className={styles.card} aria-label="Pomodoro timer">
        <ModeTabs current={currentSession} onSelect={changeMode} />
        <ProgressRing totalSeconds={totalSeconds} remainingSeconds={remainingSeconds}>
          <TimerDisplay remainingSeconds={remainingSeconds} />
        </ProgressRing>
        <Controls
          isRunning={isRunning}
          atFullDuration={atFullDuration}
          onStart={start}
          onPause={pause}
          onResume={resume}
          onReset={reset}
          onSkip={skip}
        />
        <SessionCounter
          completedFocusSessions={completedFocusSessions}
          cyclePosition={cyclePosition}
          sessionsUntilLongBreak={settings.sessionsUntilLongBreak}
        />
        <SettingsPanel settings={settings} updateSettings={updateSettings} />
      </section>
      <div className="sr-only" role="status" aria-live="polite">
        {announcement}
      </div>
    </div>
  );
}
