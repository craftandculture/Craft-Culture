import { describe, expect, it } from 'vitest';

import wineKey from './wineKey';

describe('wineKey', () => {
  /*
    The Guidalberto case: five bottles invoiced as singles and twelve as
    sixes, one wine on the distributor's shelf.
  */
  it('reads two packs of one wine as one wine', () => {
    expect(wineKey('1104653-2020-01-00750')).toBe(
      wineKey('1104653-2020-06-00750'),
    );
  });

  it('keeps a magnum apart from a bottle', () => {
    expect(wineKey('1104653-2020-01-00750')).not.toBe(
      wineKey('1104653-2020-01-01500'),
    );
  });

  it('keeps vintages apart', () => {
    expect(wineKey('1104653-2020-06-00750')).not.toBe(
      wineKey('1104653-2019-06-00750'),
    );
  });

  it('is unbothered by how the code was punctuated', () => {
    expect(wineKey('1104653-2020-06-00750')).toBe(wineKey('110465320200600750'));
  });

  /* Anything that is not a LWIN is squashed and left alone */
  it('passes a name through as a key of last resort', () => {
    expect(wineKey('Chateau Margaux 2017')).toBe('CHATEAUMARGAUX2017');
  });
});
