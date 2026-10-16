import { describe, expect, it } from 'vitest';

import bottleName from './bottleName';

describe('bottleName', () => {
  it('names the classic formats', () => {
    expect(bottleName('150cl')).toBe('Magnum');
    expect(bottleName('1.5L')).toBe('Magnum');
    expect(bottleName('37.5cl')).toBe('Half bottle');
    expect(bottleName('600cl')).toBe('Imperial');
  });

  it('keeps standard and unusual sizes as sizes', () => {
    expect(bottleName('75cl')).toBe('75cl');
    expect(bottleName('70cl')).toBe('70cl');
    expect(bottleName('100cl')).toBe('1L');
  });
});
