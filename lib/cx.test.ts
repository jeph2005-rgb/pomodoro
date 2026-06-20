import { cx } from './cx';

describe('cx', () => {
  it('joins truthy class names with single spaces', () => {
    expect(cx('a', 'b', 'c')).toBe('a b c');
  });

  it('filters out falsy values', () => {
    expect(cx('a', false, null, undefined, '', 'b')).toBe('a b');
  });

  it('returns an empty string when nothing is truthy', () => {
    expect(cx(false, null, undefined, '')).toBe('');
  });

  it('handles a conditional active class without a trailing space', () => {
    const active = false;
    expect(cx('tab', active && 'active')).toBe('tab');
  });
});
