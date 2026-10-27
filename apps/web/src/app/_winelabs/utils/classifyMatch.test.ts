import { describe, expect, it } from 'vitest';

import classifyMatch from './classifyMatch';

describe('classifyMatch', () => {
  it('agrees when the LWIN7s are the same', () => {
    expect(classifyMatch('1012781', '1012781')).toBe('agrees');
  });

  it('flags a different wine, the same-producer trap', () => {
    expect(classifyMatch('1200802', '1200811')).toBe('different');
  });

  it('marks an internal code Wine Labs can name', () => {
    expect(classifyMatch('9000012', '1012781')).toBe('internal_known');
  });

  it('is not found when Wine Labs has no match', () => {
    expect(classifyMatch('1012781', null)).toBe('not_found');
  });
});
