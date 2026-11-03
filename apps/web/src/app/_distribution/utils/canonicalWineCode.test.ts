import { describe, expect, it } from 'vitest';

import canonicalWineCode, { isLwin18 } from './canonicalWineCode';
import wineKey from './wineKey';

describe('canonicalWineCode', () => {
  it('puts back the dashes a LWIN18 lost', () => {
    expect(canonicalWineCode('140688720106600750', new Map()).code).toBe(
      '1406887-2010-66-00750',
    );
  });

  it('files a merged code under the wine it was merged into', () => {
    const aliases = new Map([
      [wineKey('W28500124'), { lwin18: '3051757-2019-06-00750' }],
    ]);

    expect(canonicalWineCode('W28500124', aliases)).toEqual({
      code: '3051757-2019-06-00750',
      merged: true,
    });
  });

  it('follows a chain of merges and stops on a loop', () => {
    const aliases = new Map([
      [wineKey('A1'), { lwin18: 'B1' }],
      [wineKey('B1'), { lwin18: 'A1' }],
    ]);

    expect(canonicalWineCode('A1', aliases).merged).toBe(true);
  });

  it('leaves a code with no merge alone', () => {
    expect(canonicalWineCode('CC-TOR-BDL-2019-0750-3PK', new Map())).toEqual({
      code: 'CC-TOR-BDL-2019-0750-3PK',
      merged: false,
    });
  });
});

describe('isLwin18', () => {
  it('accepts only the dashed canonical form', () => {
    expect(isLwin18('1406887-2010-66-00750')).toBe(true);
    expect(isLwin18('140688720106600750')).toBe(false);
    expect(isLwin18('W28500124')).toBe(false);
  });
});
