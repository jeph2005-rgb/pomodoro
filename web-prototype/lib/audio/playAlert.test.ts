import { playAlert, unlockAudio } from './playAlert';

describe('playAlert', () => {
  // jsdom does not implement the Web Audio API, so AudioContext is absent here.
  it('does not throw when the Web Audio API is unavailable', () => {
    expect(
      (window as unknown as { AudioContext?: unknown }).AudioContext
    ).toBeUndefined();
    expect(() => playAlert()).not.toThrow();
  });

  it('is safe to call repeatedly', () => {
    expect(() => {
      playAlert();
      playAlert();
      playAlert();
    }).not.toThrow();
  });

  it('unlockAudio does not throw when the API is unavailable', () => {
    expect(() => unlockAudio()).not.toThrow();
  });

  it('does not log on failure', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    playAlert();
    unlockAudio();
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  describe('with a mock AudioContext', () => {
    let createdContexts: number;
    let resumeCalls: number;
    let startCalls: number;

    beforeEach(() => {
      // Reset the module registry first so each test starts with a clean
      // module-level shared context (sharedContext = null) before the mock is
      // installed and before any dynamic import.
      jest.resetModules();

      createdContexts = 0;
      resumeCalls = 0;
      startCalls = 0;

      class MockAudioContext {
        state: 'suspended' | 'running' = 'suspended';
        currentTime = 0;
        destination = {};
        constructor() {
          createdContexts += 1;
        }
        resume() {
          resumeCalls += 1;
          this.state = 'running';
          return Promise.resolve();
        }
        createOscillator() {
          return {
            type: 'sine',
            frequency: { value: 0 },
            connect: () => {},
            start: () => {
              startCalls += 1;
            },
            stop: () => {},
          };
        }
        createGain() {
          return {
            gain: {
              setValueAtTime: () => {},
              exponentialRampToValueAtTime: () => {},
            },
            connect: () => {},
          };
        }
      }

      (window as unknown as { AudioContext: unknown }).AudioContext =
        MockAudioContext;
    });

    afterEach(() => {
      delete (window as unknown as { AudioContext?: unknown }).AudioContext;
    });

    it('plays the two-note chime via a single shared context', async () => {
      const mod = await import('./playAlert');
      mod.unlockAudio(); // resumes -> running
      mod.playAlert();
      mod.playAlert();
      expect(createdContexts).toBe(1);
      expect(resumeCalls).toBeGreaterThanOrEqual(1);
      // Two notes per chime, two chimes => four oscillators.
      expect(startCalls).toBe(4);
    });

    it('on a suspended context, schedules the tones only AFTER resume resolves', async () => {
      const mod = await import('./playAlert');
      // Context is created suspended (no prior unlock). This is the long /
      // backgrounded-session case. The tones must NOT be scheduled against the
      // frozen pre-resume clock.
      mod.playAlert();
      expect(resumeCalls).toBe(1);
      // Nothing scheduled synchronously — we are still waiting on resume().
      expect(startCalls).toBe(0);
      // Flush the resume() microtask; now the chime is scheduled on the running clock.
      await Promise.resolve();
      await Promise.resolve();
      expect(startCalls).toBe(2);
    });
  });
});
