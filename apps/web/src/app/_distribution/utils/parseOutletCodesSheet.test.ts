import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';

import parseOutletCodesSheet from './parseOutletCodesSheet';

const HEADINGS = [
  'Wine', 'Owner', 'Invoice Number', 'Invoice Date', 'CD Code', 'Case Config',
  'Qty (Cases)', 'Price per Case (USD)', 'Price per Bottle (USD)',
  'Payment Status', 'Owner', 'Consignment (Zoho tagged)', 'Bottles',
  'Sold Dec–Aug (btl)', 'Sold Sep (btl)', 'Left (btl)',
];

const toFile = (rows: unknown[][], sheetName = 'Codes') => {
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(rows),
    sheetName,
  );

  return XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' }) as string;
};

describe('parseOutletCodesSheet', () => {
  it('reads a row of the Codes tab', () => {
    const parsed = parseOutletCodesSheet(
      toFile([
        HEADINGS,
        [
          'San Polo Brunello di Montalcino 2019', 'Crurated', 'INV-000176',
          '17 Dec 2025', 'CDR8413460587', '3x75cl', '2', '622.05', '207.35',
          'Partially Paid', 'Crurated', 'Yes', '6', '3', '1', '2',
        ],
      ]),
    );

    expect(parsed.rows).toEqual([
      {
        outletCode: 'CDR8413460587',
        wineName: 'San Polo Brunello di Montalcino 2019',
        ownerLabel: 'Crurated',
        docRef: 'INV-000176',
        docDate: '2025-12-17',
        caseConfig: '3x75cl',
        isConsignment: true,
        bottles: 6,
        leftBottles: 2,
      },
    ]);
  });

  /* Many C&C lines on INV-000312 carry no CDR code; the owner still counts */
  it('keeps a row with no code', () => {
    const parsed = parseOutletCodesSheet(
      toFile([
        HEADINGS,
        ['Petrus, Pomerol 1995', 'C&C', 'INV-000312', '01 Sep 2026', '', '1x75cl'],
      ]),
    );

    expect(parsed.rows[0]?.outletCode).toBeNull();
    expect(parsed.rows[0]?.ownerLabel).toBe('C&C');
  });

  it('finds the headings below a title row and the Codes tab among others', () => {
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([['October']]),
      'October',
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ['CD x C&C codes'],
        HEADINGS,
        ['Latour 1990', 'RARE', 'inv 248', '30 Apr 2026', 'CDR0649213600'],
      ]),
      'Codes',
    );

    const parsed = parseOutletCodesSheet(
      XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' }) as string,
    );

    expect(parsed.sheetName).toBe('Codes');
    expect(parsed.rows[0]?.docRef).toBe('INV-000248');
  });

  it('refuses a sheet that is not the Codes tab', () => {
    expect(() => parseOutletCodesSheet(toFile([['Product', 'Qty']]))).toThrow(
      /CD Code/,
    );
  });

  it('skips the blank and totals rows at the foot', () => {
    const parsed = parseOutletCodesSheet(
      toFile([
        HEADINGS,
        ['Latour 1993', 'C&C', 'INV-000248', '30 Apr 2026', 'CDR9288266897'],
        [],
        ['', '', '', '', '', '', '', '', '', '', '', 'Total (consignment)'],
      ]),
    );

    expect(parsed.rows).toHaveLength(1);
  });

  it('reads accents in a CSV as written', () => {
    const csv = [
      HEADINGS.join(','),
      '"Château Figeac 1990",C&C,INV-000312,01 Sep 2026,,1x75cl,1,1,1,Open,C&C,Yes,3,0,0,3',
    ].join('\n');
    const parsed = parseOutletCodesSheet(Buffer.from(csv, 'utf8').toString('base64'));

    expect(parsed.rows[0]?.wineName).toBe('Château Figeac 1990');
    expect(parsed.rows[0]?.leftBottles).toBe(3);
  });
});
