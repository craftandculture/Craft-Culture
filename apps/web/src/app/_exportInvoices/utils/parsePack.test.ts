import { describe, expect, it } from 'vitest';

import parsePack from './parsePack';

describe('parsePack', () => {
  it.each([
    ['6x75cl', 6, 75],
    ['06x75cl', 6, 75],
    ['3 x 75cl', 3, 75],
    ['1x600cl', 1, 600],
    ['3x150cl', 3, 150],
    ['Sassicaia 2016 (3x)', 3, 75],
    ['Brane-Cantenac 2016 (6pk)', 6, 75],
    ['Figeac 2016 (3 Pk)', 3, 75],
    ['Pierre Girardin, Meursault, Le Limozin 2022 0.75L', 1, 75],
    ['75cl - 40% ABV', 1, 75],
  ])('reads %s', (text, packBottles, bottleSizeCl) => {
    expect(parsePack(text)).toEqual({ packBottles, bottleSizeCl });
  });

  it('returns null when nothing says the pack', () => {
    expect(parsePack('Masseto 2017')).toBeNull();
  });
});
