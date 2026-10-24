import { describe, expect, it } from 'vitest';

import omitEmptyFields from './omitEmptyFields';

describe('omitEmptyFields', () => {
  it('drops fields the feed did not send', () => {
    const eta = new Date('2026-11-02T00:00:00Z');

    expect(
      omitEmptyFields({
        etd: null,
        eta,
        blNumber: null,
        containerNumber: undefined,
        hillebrandReference: '  ',
      }),
    ).toEqual({ eta });
  });

  it('keeps zero, false and real values', () => {
    expect(
      omitEmptyFields({ totalWeightKg: 0, flagged: false, blNumber: 'MSCU1' }),
    ).toEqual({ totalWeightKg: 0, flagged: false, blNumber: 'MSCU1' });
  });
});
