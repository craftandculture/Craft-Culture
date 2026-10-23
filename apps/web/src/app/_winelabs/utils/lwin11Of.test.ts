import { describe, expect, it } from 'vitest';

import lwin11Of from './lwin11Of';

describe('lwin11Of', () => {
  it('reads a dashed LWIN18', () => {
    expect(lwin11Of('1012781-2015-06-00750')).toEqual({
      lwin7: '1012781',
      vintage: '2015',
      lwin11: '10127812015',
    });
  });

  it('reads a compact LWIN18 the same way', () => {
    expect(lwin11Of('101278120150600750')?.lwin11).toBe('10127812015');
  });

  it('gives one LWIN11 for every pack of a vintage', () => {
    expect(lwin11Of('1012781-2015-12-00750')?.lwin11).toBe(lwin11Of('1012781-2015-06-01500')?.lwin11);
  });

  it('reads a 0000 vintage as non-vintage', () => {
    expect(lwin11Of('2360072-0000-06-00750')).toEqual({ lwin7: '2360072', vintage: '1000', lwin11: '23600721000' });
  });

  it('refuses codes that are not LWIN18s', () => {
    expect(lwin11Of('GINLANG700-0000-06-00700')).toBeNull();
    expect(lwin11Of(null)).toBeNull();
  });
});
