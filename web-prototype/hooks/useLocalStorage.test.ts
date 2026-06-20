import { act, renderHook } from '@testing-library/react';
import { useLocalStorage } from './useLocalStorage';

const KEY = 'test.key';

describe('useLocalStorage', () => {
  afterEach(() => {
    window.localStorage.clear();
    jest.restoreAllMocks();
  });

  it('returns the default when the key is absent', () => {
    const { result } = renderHook(() => useLocalStorage(KEY, 'fallback'));
    expect(result.current[0]).toBe('fallback');
  });

  it('reads back a previously persisted value after mount', () => {
    window.localStorage.setItem(KEY, JSON.stringify('stored'));
    const { result } = renderHook(() => useLocalStorage(KEY, 'fallback'));
    // Effect runs synchronously inside renderHook's act wrapper.
    expect(result.current[0]).toBe('stored');
  });

  it('persists a value and reflects it in state', () => {
    const { result } = renderHook(() =>
      useLocalStorage(KEY, { count: 0 })
    );
    act(() => {
      result.current[1]({ count: 5 });
    });
    expect(result.current[0]).toEqual({ count: 5 });
    expect(window.localStorage.getItem(KEY)).toBe(JSON.stringify({ count: 5 }));
  });

  it('falls back to default when getItem throws', () => {
    jest
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw new Error('blocked');
      });
    expect(() => {
      const { result } = renderHook(() => useLocalStorage(KEY, 'fallback'));
      expect(result.current[0]).toBe('fallback');
    }).not.toThrow();
  });

  it('does not throw when setItem throws (e.g. quota)', () => {
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    const { result } = renderHook(() => useLocalStorage(KEY, 'a'));
    expect(() => {
      act(() => {
        result.current[1]('b');
      });
    }).not.toThrow();
    // In-memory state still updates.
    expect(result.current[0]).toBe('b');
  });

  it('falls back to default when stored JSON is malformed', () => {
    window.localStorage.setItem(KEY, '{not valid json');
    const { result } = renderHook(() => useLocalStorage(KEY, 'fallback'));
    expect(result.current[0]).toBe('fallback');
  });
});
