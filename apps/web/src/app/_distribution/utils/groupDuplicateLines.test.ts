import { describe, expect, it } from 'vitest';

import groupDuplicateLines from './groupDuplicateLines';
import type { LineCode } from './groupDuplicateLines';
import wineKey from './wineKey';

const line = (code: string, name: string, outBottles = 0, soldBottles = 0): LineCode => ({
  key: wineKey(code),
  code,
  name,
  outBottles,
  soldBottles,
});

describe('groupDuplicateLines', () => {
  it('groups one wine held under a LWIN and a W code, keeping the LWIN', () => {
    const groups = groupDuplicateLines([
      line('W28500124', 'Bambinuto Greco di Tufo DOCG Riserva Rafilù 2019', 6, 4),
      line('3051757-2019-06-00750', 'Bambinuto Greco di Tufo Riserva Rafilu 2019', 12),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.main.code).toBe('3051757-2019-06-00750');
    expect(groups[0]?.duplicates.map((d) => d.code)).toEqual(['W28500124']);
  });

  it('keeps different vintages apart', () => {
    expect(
      groupDuplicateLines([
        line('1234567-2020-06-00750', 'Guidalberto Tenuta San Guido 2020', 12),
        line('1234567-2021-06-00750', 'Guidalberto Tenuta San Guido 2021', 12),
      ]),
    ).toEqual([]);
  });

  it('keeps different wines apart', () => {
    expect(
      groupDuplicateLines([
        line('1111111-2023-06-00750', 'Domaine Fourrier Gevrey-Chambertin 2023', 12),
        line('2222222-2022-06-00750', 'Domaine Lafouge Meursault Clos de Rougeot 2022', 12),
      ]),
    ).toEqual([]);
  });
});
