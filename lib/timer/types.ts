export type SessionType = 'focus' | 'shortBreak' | 'longBreak';

export interface TimerSettings {
  focusMinutes: number; // default 25
  shortBreakMinutes: number; // default 5
  longBreakMinutes: number; // default 15
  sessionsUntilLongBreak: number; // default 4
  autoStartNext: boolean; // default false
}

export interface TimerState {
  settings: TimerSettings;
  currentSession: SessionType;
  remainingSeconds: number;
  /**
   * Full duration of the CURRENT session, snapshotted when the session is
   * loaded. The progress ring uses (totalSeconds - remainingSeconds) /
   * totalSeconds so it stays correct even if settings change mid-session.
   */
  totalSeconds: number;
  isRunning: boolean;
  /** Lifetime count for this page session. */
  completedFocusSessions: number;
  /** Completed focus sessions since last long break (0..N). */
  cyclePosition: number;
  /**
   * Increments whenever ANY session completes; the React layer watches this to
   * fire the audio alert.
   */
  completionSignal: number;
}

export type TimerAction =
  | { type: 'HYDRATE'; settings: Partial<TimerSettings> }
  | { type: 'START' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'RESET' }
  | { type: 'SKIP' }
  | { type: 'TICK' }
  | { type: 'CHANGE_MODE'; session: SessionType }
  | { type: 'UPDATE_SETTINGS'; settings: Partial<TimerSettings> };
