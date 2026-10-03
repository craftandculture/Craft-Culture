import { describe, expect, it } from 'vitest';

import classifyDrink from './classifyDrink';

/* Names taken from City Drinks' October replenishment sheet */
describe('classifyDrink', () => {
  it.each([
    ['Funkin Piña Colada Nitro (12-pack)', 'rtd'],
    ['Funkin Passion Fruit Martini Nitro (12-pack)', 'rtd'],
    ['Funkin Peach On The Beach Nitro (12-pack)', 'rtd'],
    ["Brother's Bond Hand Selected Batch Bourbon", 'spirits'],
    ['Langley’s Old Tom', 'spirits'],
    ['Krug Champagne Grande Cuvée 173ème Édition Brut', 'sparkling'],
    ['Dom Pérignon Champagne Plénitude 2 Brut 2002', 'sparkling'],
    ['Vilmart & Cie Champagne Grand Cellier 1er Cru Brut', 'sparkling'],
    ['Taittinger Comtes de Champagne Blanc de Blancs 2006', 'sparkling'],
    ['Elio Grasso Barolo Ginestra Casa Mate 2020', 'wine'],
    ['Château Mouton Rothschild Pauillac 1986', 'wine'],
    ['Tignanello 2019', 'wine'],
    ['Seña Aconcagua Valley 2019', 'wine'],
  ])('%s is %s', (name, expected) => {
    expect(classifyDrink(name)).toBe(expected);
  });
});
