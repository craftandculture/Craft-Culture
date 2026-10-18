import { describe, expect, it } from 'vitest';

import findClientCode from './findClientCode';

describe('findClientCode', () => {
  it('reads the reference however it was typed', () => {
    expect(findClientCode('PC-1001')).toBe('PC-1001');
    expect(findClientCode('pc 1001')).toBe('PC-1001');
    expect(findClientCode('PC1001/2')).toBe('PC-1001');
    expect(findClientCode('Smith PC-1042-003')).toBe('PC-1042');
  });

  it('does not find one inside another code', () => {
    expect(findClientCode('EPC-1001')).toBeNull();
    expect(findClientCode('PC-12')).toBeNull();
    expect(findClientCode('')).toBeNull();
    expect(findClientCode(null)).toBeNull();
  });
});
