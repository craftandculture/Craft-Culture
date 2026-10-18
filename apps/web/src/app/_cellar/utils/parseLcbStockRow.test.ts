import { describe, expect, it } from 'vitest';

import parseLcbStockRow from './parseLcbStockRow';

describe('parseLcbStockRow', () => {
  it('reads a line of singles from the Rotation Stock report', () => {
    const holding = parseLcbStockRow({
      Rotation: '26/D014659',
      Ln: '0',
      Code: '1122750-2014-06-00750',
      Brand: 'Dominus',
      Description: 'DOMINUS 2014',
      Year: '2014',
      SPC: '6',
      SS: '0.75000',
      Packaging: '(RPK) Repacked Carton',
      Cases: '0',
      Singles: '3',
      TSingles: '3',
      Received: '30/09/2026 00:00:00',
    });

    expect(holding).toMatchObject({
      rotation: '26/D014659',
      lwin18: '1122750-2014-06-00750',
      vintage: 2014,
      bottlesPerCase: 6,
      bottleSizeLitres: 0.75,
      cases: 0,
      singles: 3,
      totalBottles: 3,
    });
    expect(holding?.receivedAt?.toISOString()).toBe('2026-09-30T00:00:00.000Z');
  });

  it('counts whole cases when TSingles is missing', () => {
    expect(
      parseLcbStockRow({ Rotation: 'R1', Code: '1340521-2022-06-00750', SPC: '6', Cases: '127', Singles: '0' })
        ?.totalBottles,
    ).toBe(762);
  });

  it('turns a compact LWIN into the dashed form', () => {
    expect(parseLcbStockRow({ Rotation: 'R1', Code: '101278120140600750', Cases: '1', Singles: '0', SPC: '6' })?.lwin18).toBe(
      '1012781-2014-06-00750',
    );
  });

  it('skips lines that are not holdings', () => {
    expect(parseLcbStockRow({ Rotation: '', Code: 'X', Cases: '1', Singles: '0' })).toBeNull();
    expect(parseLcbStockRow({ Rotation: 'R1', Code: '1-2-3-4', Cases: '0', Singles: '0' })).toBeNull();
  });
});
