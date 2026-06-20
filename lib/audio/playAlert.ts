// FR-7: short beep via the Web Audio API. No audio asset file.
//
// All access to the Web Audio API is wrapped so this module never throws and
// never logs, even where AudioContext is missing (e.g. jsdom) or autoplay
// policy blocks playback.

const BEEP_DURATION_SECONDS = 0.18; // ~180ms
const BEEP_FREQUENCY_HZ = 880; // A5

type AudioContextCtor = new () => AudioContext;

function getAudioContextCtor(): AudioContextCtor | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }
  const w = window as Window &
    typeof globalThis & { webkitAudioContext?: AudioContextCtor };
  return w.AudioContext ?? w.webkitAudioContext;
}

let sharedContext: AudioContext | null = null;

/** Lazily creates (or reuses) the single shared AudioContext. */
function getContext(): AudioContext | null {
  if (sharedContext) {
    return sharedContext;
  }
  try {
    const Ctor = getAudioContextCtor();
    if (!Ctor) {
      return null;
    }
    sharedContext = new Ctor();
    return sharedContext;
  } catch {
    return null;
  }
}

/**
 * Create + resume the shared AudioContext from within a user gesture so that a
 * later alert (including one auto-fired under autoStartNext) is not blocked by
 * the browser autoplay policy. The consuming hook calls this on the first
 * Start. Safe to call repeatedly. Never throws.
 */
export function unlockAudio(): void {
  try {
    const ctx = getContext();
    if (ctx && ctx.state === 'suspended') {
      void ctx.resume();
    }
  } catch {
    // Fail silently.
  }
}

/** Play a short beep. Never throws, never logs. */
export function playAlert(): void {
  try {
    const ctx = getContext();
    if (!ctx) {
      return;
    }
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }

    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.value = BEEP_FREQUENCY_HZ;

    const now = ctx.currentTime;
    const end = now + BEEP_DURATION_SECONDS;
    // Brief envelope so the beep doesn't click on/off.
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.2, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    oscillator.start(now);
    oscillator.stop(end);
  } catch {
    // Fail silently.
  }
}
