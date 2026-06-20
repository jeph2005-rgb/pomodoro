// FR-7: short alert chime via the Web Audio API. No audio asset file.
//
// All access to the Web Audio API is wrapped so this module never throws and
// never logs, even where AudioContext is missing (e.g. jsdom) or autoplay
// policy blocks playback.

// A short two-note chime (rising) so a completed session is clearly audible —
// a single brief blip is easy to miss across a long session. Offsets/durations
// are relative to the context clock at schedule time.
const TONES: ReadonlyArray<{ freq: number; start: number; duration: number }> = [
  { freq: 880, start: 0, duration: 0.15 }, // A5
  { freq: 1318.5, start: 0.16, duration: 0.22 }, // E6
];
const PEAK_GAIN = 0.3;

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
 * Schedule the chime relative to the context's CURRENT clock. Must only be
 * called once the context is running — scheduling against a suspended context's
 * frozen `currentTime` can place the (short) tones in the past once it resumes,
 * which is silent. Never throws.
 */
function scheduleChime(ctx: AudioContext): void {
  try {
    const t0 = ctx.currentTime;
    for (const tone of TONES) {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.value = tone.freq;

      const start = t0 + tone.start;
      const end = start + tone.duration;
      // Brief envelope so each note doesn't click on/off.
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(PEAK_GAIN, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);

      oscillator.connect(gain);
      gain.connect(ctx.destination);

      oscillator.start(start);
      oscillator.stop(end);
    }
  } catch {
    // Fail silently.
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

/**
 * Play the alert chime. Never throws, never logs.
 *
 * If the context is suspended (common when the tab has been backgrounded during
 * a long session), we resume FIRST and schedule the tones only once resume
 * resolves — otherwise the short tones get scheduled against the frozen,
 * pre-resume clock and play in the past (silently).
 */
export function playAlert(): void {
  try {
    const ctx = getContext();
    if (!ctx) {
      return;
    }
    if (ctx.state === 'suspended') {
      void ctx
        .resume()
        .then(() => scheduleChime(ctx))
        .catch(() => {
          // Fail silently.
        });
      return;
    }
    scheduleChime(ctx);
  } catch {
    // Fail silently.
  }
}
