import { describe, expect, it } from 'vitest';

import quoteStatusAfterEdit from './quoteStatusAfterEdit';

const now = new Date('2026-10-22T10:00:00Z');

describe('quoteStatusAfterEdit', () => {
  it('makes a quote live again when its validity is moved forward', () =>
    expect(quoteStatusAfterEdit(new Date('2026-11-15T00:00:00Z'), now)).toBe('pending'));

  it('keeps a quote with no validity live', () => expect(quoteStatusAfterEdit(null, now)).toBe('pending'));

  it('leaves a quote whose validity has passed expired', () =>
    expect(quoteStatusAfterEdit(new Date('2026-10-21T00:00:00Z'), now)).toBe('expired'));
});
