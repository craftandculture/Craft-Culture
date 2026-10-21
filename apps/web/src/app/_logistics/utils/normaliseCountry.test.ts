import { describe, expect, it } from 'vitest';

import normaliseCountry from './normaliseCountry';

describe('normaliseCountry', () => {
  it('expands the short forms people type', () => {
    expect(normaliseCountry(' uk ')).toBe('United Kingdom');
    expect(normaliseCountry('U.A.E.')).toBe('United Arab Emirates');
  });

  it('leaves a full name as typed, trimmed', () => expect(normaliseCountry(' France ')).toBe('France'));
});
