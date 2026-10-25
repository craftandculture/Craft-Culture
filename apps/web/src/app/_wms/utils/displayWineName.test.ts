import { describe, expect, it } from 'vitest';

import displayWineName from './displayWineName';

describe('displayWineName', () => {
  it.each([
    ['Dom Pérignon P2 2006 0.75L 12.5%abv', 'Dom Pérignon P2'],
    ['Domaine Fourrier Gevrey-Chambertin Vieille Vigne 2023 0.75L 13%abv', 'Domaine Fourrier Gevrey-Chambertin Vieille Vigne'],
    ['Hospice de Beaune 2023 - Savigny les Beaune 1er Cru Cuvée Arthur Girard 1.5L 14%', 'Hospice de Beaune 2023 - Savigny les Beaune 1er Cru Cuvée Arthur Girard'],
    ["Anne Gros Chambolle Musigny 'Combe D’Orveaux' (1x)", "Anne Gros Chambolle Musigny 'Combe D’Orveaux'"],
    ['Agrapart & Fils Champagne Grand Cru Terroirs NV', 'Agrapart & Fils Champagne Grand Cru Terroirs NV'],
    ['Pierre Girardin Grand Cru Echezeaux 2023 0.75L 13.5%abv (1x75cl)', 'Pierre Girardin Grand Cru Echezeaux'],
    ['Domaine Bruno Clair Marsannay Rouge 2021 0.75L 13%abv (2x)', 'Domaine Bruno Clair Marsannay Rouge'],
  ])('shows %s as %s', (raw, shown) => {
    expect(displayWineName(raw)).toBe(shown);
  });
});
