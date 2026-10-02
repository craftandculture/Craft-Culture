import { describe, expect, it } from 'vitest';

import classifyHsCode from './classifyHsCode';

describe('classifyHsCode', () => {
  it.each([
    'Taittinger, Comtes de Champagne Blanc de Blancs 2011',
    'Bereche et Fils Grand Cru Ambonnay 2015',
    "Bereche et Fils Reflet d'Antan",
    'Louis Roederer Cristal Rose 2013',
  ])('declares %s as sparkling', (name) => {
    expect(classifyHsCode(name, '22042100')).toBe('22041000');
  });

  it('declares bourbon as a spirit', () => {
    expect(classifyHsCode('BROTHERS BOND - STRAIGHT BOURBON Whiskey', '22083000000')).toBe('22083000');
  });

  it('ignores supplier codes on still wine', () => {
    expect(classifyHsCode('Chateau Talbot 4eme Cru Classe, Saint-Julien 2018', '2204214290')).toBe('22042100');
  });

  it('believes Zoho when it says sparkling', () => {
    expect(classifyHsCode('Bel Air Brut Reserve NV', '2204101100')).toBe('22041000');
  });
});
