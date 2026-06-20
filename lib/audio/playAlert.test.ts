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
      jest.resetModules();
    });

    it('plays a tone via a single shared context', async () => {
      // Re-import so the module-level shared context is fresh for this mock.
      jest.resetModules();
      const mod = await import('./playAlert');
      mod.unlockAudio();
      mod.playAlert();
      mod.playAlert();
      expect(createdContexts).toBe(1);
      expect(resumeCalls).toBeGreaterThanOrEqual(1);
      expect(startCalls).toBe(2);
    });
  });
});
