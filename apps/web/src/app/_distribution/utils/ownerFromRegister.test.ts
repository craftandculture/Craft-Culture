import { describe, expect, it } from 'vitest';

import ownerFromRegister from './ownerFromRegister';
import type { RegisterEntry } from './ownerFromRegister';

const ENTRIES: RegisterEntry[] = [
  { docRef: 'INV-000176', wineName: 'San Polo Brunello di Montalcino 2019', ownerId: 'crurated' },
  { docRef: 'INV-000176', wineName: 'Giuseppe Cortese Barbaresco 2020', ownerId: 'crurated' },
  { docRef: 'INV-000236', wineName: 'Petrus 2019', ownerId: 'cc' },
  { docRef: 'INV-000236', wineName: 'Bollinger La Grande Annee 2014', ownerId: 'rare' },
  { docRef: 'INV-000236', wineName: 'Sassicaia, Tenuta San Guido, Bolgheri 2019', ownerId: 'cru' },
];

describe('ownerFromRegister', () => {
  it('takes the single owner of an invoice for any line on it', () => {
    expect(
      ownerFromRegister(ENTRIES, 'INV-000176', 'Thienpont Les Fillottes 2019'),
    ).toBe('crurated');
  });

  it('matches a mixed invoice line by name', () => {
    expect(
      ownerFromRegister(
        ENTRIES,
        'INV-000236',
        'Bollinger, La Grande Année, Champagne 2014 3x150cl',
      ),
    ).toBe('rare');
  });

  it('will not guess on a mixed invoice', () => {
    expect(
      ownerFromRegister(ENTRIES, 'INV-000236', 'Dom Perignon P2 2002'),
    ).toBeNull();
  });

  it('says nothing about an invoice it does not list', () => {
    expect(ownerFromRegister(ENTRIES, 'INV-000402', 'Petrus 2019')).toBeNull();
  });
});
