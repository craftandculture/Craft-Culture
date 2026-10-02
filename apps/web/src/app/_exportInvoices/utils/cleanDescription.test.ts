import { describe, expect, it } from 'vitest';

import cleanDescription from './cleanDescription';

describe('cleanDescription', () => {
  it.each([
    ['Chateau Potensac, Medoc 2021 (1x75cl)', 'Chateau Potensac, Medoc 2021'],
    ['Sassicaia 2016 (3x)', 'Sassicaia 2016'],
    ['Brane-Cantenac 2016 (6pk)', 'Brane-Cantenac 2016'],
    ['Pierre Girardin, Meursault, Le Limozin 2022 0.75L', 'Pierre Girardin, Meursault, Le Limozin 2022'],
    ['Domaine Fourrier Premier Cru Gevrey-Chambertin Vieille Vigne 2021 0.75L 13.5%abv (2x75cl)', 'Domaine Fourrier Premier Cru Gevrey-Chambertin Vieille Vigne 2021'],
    ['Masseto 2017', 'Masseto 2017'],
  ])('%s', (input, expected) => {
    expect(cleanDescription(input)).toBe(expected);
  });
});
