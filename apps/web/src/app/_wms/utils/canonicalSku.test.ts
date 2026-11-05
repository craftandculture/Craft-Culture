import { describe, expect, it } from 'vitest';

import canonicalSku from './canonicalSku';

describe('canonicalSku', () => {
  it('re-dashes a mis-dashed LWIN18', () => {
    expect(canonicalSku('1358261-2021-0100-750')).toBe('1358261-2021-01-00750');
  });

  it('dashes a compact 18-digit LWIN', () => {
    expect(canonicalSku('135826120210100750')).toBe('1358261-2021-01-00750');
  });

  it('leaves a correctly dashed LWIN18 alone', () => {
    expect(canonicalSku('1358261-2021-01-00750')).toBe('1358261-2021-01-00750');
  });

  it('keeps the dashes of a non-LWIN SKU', () => {
    expect(canonicalSku(' GIN-001 ')).toBe('GIN-001');
    expect(canonicalSku('1358261-2021-01-750')).toBe('1358261-2021-01-750');
  });

  it('passes null and undefined through as null', () => {
    expect(canonicalSku(null)).toBeNull();
    expect(canonicalSku(undefined)).toBeNull();
  });
});
