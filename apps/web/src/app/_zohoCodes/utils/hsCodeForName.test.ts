import { describe, expect, it } from 'vitest';

import hsCodeForName from './hsCodeForName';

describe('hsCodeForName', () => {
  it('puts each spirit under its own heading', () => {
    expect(hsCodeForName('Bandida, Mezcal - Blanco')).toBe('22089090');
    expect(hsCodeForName('Altamura Distilleries Vodka')).toBe('22086000');
    expect(hsCodeForName('Langleys Old Tom 47%')).toBe('22085000');
    expect(hsCodeForName('HAMA RUM - Signature')).toBe('22084000');
    expect(hsCodeForName('Compass Box, THE PEAT MONSTER Blended Malt Scottish Whiskey')).toBe('22083000');
  });

  it('classifies still and sparkling wine', () => {
    expect(hsCodeForName('Chateau Beauregard, Pomerol 2020')).toBe('22042100');
    expect(hsCodeForName('Louis Roederer Cristal Rose 2012')).toBe('22041000');
  });
});
