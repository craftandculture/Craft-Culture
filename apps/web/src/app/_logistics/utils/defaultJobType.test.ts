import { describe, expect, it } from 'vitest';

import defaultJobType from './defaultJobType';

describe('defaultJobType', () => {
  it('reads the job from the route', () => {
    expect(defaultJobType('United Kingdom', 'United Arab Emirates')).toBe(
      'inbound',
    );
    expect(defaultJobType('United Arab Emirates', 'Oman')).toBe('re_export');
    expect(defaultJobType('UAE', 'United Arab Emirates')).toBe(
      'mainland_transfer',
    );
    expect(defaultJobType('France', 'United Kingdom')).toBe('outbound');
  });
});
