'use client';

import { useCallback, useEffect, useReducer, useRef } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { playAlert, unlockAudio } from '@/lib/audio/playAlert';
import {
  DEFAULT_SETTINGS,
  STORAGE_KEY,
  clampSettings,
  createInitialState,
  timerReducer,
} from '@/lib/timer';
import type {
  SessionType,
  TimerSettings,
  TimerState,
} from '@/lib/timer';

/** Public API exposed to the Phase 3 UI. */
export interface UseTimerResult {
  state: TimerState;
  start: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  skip: () => void;
  changeMode: (session: SessionType) => void;
  updateSettings: (partial: Partial<TimerSettings>) => void;
}

/** Shallow value-equality for two settings objects. */
function settingsEqual(a: TimerSettings, b: TimerSettings): boolean {
  return (
    a.focusMinutes === b.focusMinutes &&
    a.shortBreakMinutes === b.shortBreakMinutes &&
    a.longBreakMinutes === b.longBreakMinutes &&
    a.sessionsUntilLongBreak === b.sessionsUntilLongBreak &&
    a.autoStartNext === b.autoStartNext
  );
}

/**
 * The single impure orchestrator: owns the 1s interval, fires the audio alert
 * on session completion, and wires settings persistence. The reducer stays
 * pure; all side effects live here.
 */
export function useTimer(): UseTimerResult {
  const [state, dispatch] = useReducer(
    timerReducer,
    undefined,
    () => createInitialState()
  );

  // Persistence goes exclusively through the generic, hydration-safe
  // localStorage hook. `storedSettings` is DEFAULT_SETTINGS on the first render
  // (server + first client render) and becomes the persisted value after mount;
  // `setStoredSettings` is the only writer to localStorage.
  const [storedSettings, setStoredSettings] = useLocalStorage<TimerSettings>(
    STORAGE_KEY,
    DEFAULT_SETTINGS
  );

  // --- Interval: tick once per second only while running. ---
  useEffect(() => {
    if (!state.isRunning) {
      return;
    }
    const id = setInterval(() => dispatch({ type: 'TICK' }), 1000);
    return () => clearInterval(id);
  }, [state.isRunning]);

  // --- Audio: beep whenever completionSignal increments (skip initial). ---
  const lastSignal = useRef(state.completionSignal);
  useEffect(() => {
    if (state.completionSignal !== lastSignal.current) {
      lastSignal.current = state.completionSignal;
      playAlert();
    }
  }, [state.completionSignal]);

  // --- Hydrate persisted settings on initial load, before any user edit.
  // useLocalStorage returns DEFAULT_SETTINGS during render and only resolves the
  // persisted value in its own post-mount effect (a second render), so we react
  // to `storedSettings` rather than reading once on mount. Until the user edits,
  // we mirror storedSettings into the reducer via HYDRATE (clamped, so a
  // tampered/partial payload can't inject bad durations). Each dispatch is
  // value-guarded, so once the live settings match storedSettings no further
  // HYDRATE fires. Crucially, the persist effect below never writes while
  // `userHasEdited` is false, so storedSettings cannot change underneath us
  // here — that combination is what prevents a HYDRATE/persist ping-pong.
  const userHasEdited = useRef(false);
  useEffect(() => {
    if (userHasEdited.current) {
      return;
    }
    const next = clampSettings(storedSettings, DEFAULT_SETTINGS);
    if (settingsEqual(state.settings, next)) {
      return;
    }
    dispatch({ type: 'HYDRATE', settings: next });
  }, [storedSettings, state.settings]);

  // First user-initiated start unlocks audio so later (possibly auto-fired)
  // alerts are not blocked by autoplay policy.
  const start = useCallback(() => {
    unlockAudio();
    dispatch({ type: 'START' });
  }, []);

  const pause = useCallback(() => dispatch({ type: 'PAUSE' }), []);
  const resume = useCallback(() => dispatch({ type: 'RESUME' }), []);
  const reset = useCallback(() => dispatch({ type: 'RESET' }), []);
  const skip = useCallback(() => dispatch({ type: 'SKIP' }), []);
  const changeMode = useCallback(
    (session: SessionType) => dispatch({ type: 'CHANGE_MODE', session }),
    []
  );

  const updateSettings = useCallback((partial: Partial<TimerSettings>) => {
    // Latch so subsequent storage write-backs can't re-HYDRATE the live timer.
    userHasEdited.current = true;
    dispatch({ type: 'UPDATE_SETTINGS', settings: partial });
  }, []);

  // Persist genuine, user-initiated settings changes only. We deliberately do
  // NOT write while `userHasEdited` is false: on mount the only settings change
  // is the HYDRATE that mirrors the just-read stored value, and echoing that
  // back would (a) be a redundant write on every mount and (b) feed storedSettings
  // back into the HYDRATE effect above, causing a ping-pong. The `userHasEdited`
  // latch (set in updateSettings) means the first write can only originate from
  // a real user edit, and the value guard then makes repeat writes of the same
  // value no-ops. No mount echo-back, no loop.
  useEffect(() => {
    if (!userHasEdited.current) {
      return;
    }
    if (settingsEqual(state.settings, storedSettings)) {
      return;
    }
    setStoredSettings(state.settings);
  }, [state.settings, storedSettings, setStoredSettings]);

  return {
    state,
    start,
    pause,
    resume,
    reset,
    skip,
    changeMode,
    updateSettings,
  };
}
