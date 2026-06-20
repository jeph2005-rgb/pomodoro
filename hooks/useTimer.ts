'use client';

import { useCallback, useEffect, useReducer, useRef } from 'react';
import { playAlert, unlockAudio } from '@/lib/audio/playAlert';
import {
  STORAGE_KEY,
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

/** Read persisted settings, hydration-safe. Returns null if unavailable/bad. */
function readPersistedSettings(): Partial<TimerSettings> | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      return null;
    }
    return JSON.parse(raw) as Partial<TimerSettings>;
  } catch {
    return null;
  }
}

function persistSettings(settings: TimerSettings): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Unavailable or quota: settings remain in memory only.
  }
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

  // --- Hydrate persisted settings once on mount. ---
  useEffect(() => {
    const persisted = readPersistedSettings();
    if (persisted) {
      dispatch({ type: 'HYDRATE', settings: persisted });
    }
  }, []);

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

  const updateSettings = useCallback(
    (partial: Partial<TimerSettings>) =>
      dispatch({ type: 'UPDATE_SETTINGS', settings: partial }),
    []
  );

  // Persist only on genuine settings changes. The ref is seeded with the
  // initial settings reference, so the initial no-op render (same reference)
  // is skipped and HYDRATE no longer echoes back to storage.
  const prevSettings = useRef(state.settings);
  useEffect(() => {
    if (prevSettings.current === state.settings) return;
    prevSettings.current = state.settings;
    persistSettings(state.settings);
  }, [state.settings]);

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
