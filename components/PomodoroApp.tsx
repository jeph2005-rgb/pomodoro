'use client';

import { useTimer } from '@/hooks/useTimer';
import Controls from './Controls';
import ModeTabs from './ModeTabs';
import ProgressRing from './ProgressRing';
import SessionCounter from './SessionCounter';
import SettingsPanel from './SettingsPanel';
import TimerDisplay from './TimerDisplay';
import styles from './PomodoroApp.module.css';

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
  } = state;

  const atFullDuration = remainingSeconds === totalSeconds;

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
    </div>
  );
}
