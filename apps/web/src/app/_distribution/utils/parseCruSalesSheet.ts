import * as XLSX from 'xlsx';

import type { OwnerCostRow } from './parseCruratedReconSheet';

const text = (value: unknown) =>
  value === null || value === undefined ? '' : String(value).trim();

const number = (value: unknown) => {
  const parsed =
    typeof value === 'number' ? value : Number(text(value).replace(/[, ]/g, ''));

  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * Read what C&C owes Cru Wine per bottle, from the "Cru Sales UAE" list
 *
 * The price owed is the column Cru invoice C&C at — US dollars per case —
 * divided by bottles per case. The AED columns beside it are Cru's retail
 * prices to UAE clients and must not be taken.
 *
 * Cru's wines carry no code here, so each row keeps its name and vintage, and
 * is matched to our invoice lines on both — never the name alone: Guidalberto
 * is $37.12 in 2020 and $46.11 in 2021.
 *
 * @example
 *   parseCruSalesSheet(base64).rows[0];
 *   // { productName: 'Guidalberto, Tenuta San Guido, Toscana', vintage: 2020, costPerBottle: 37.12, … }
 *
 * @param file - The workbook, base64
 * @returns One row per wine and vintage
 */
const parseCruSalesSheet = (file: string) => {
  const workbook = XLSX.read(file, { type: 'base64' });
  const rows: OwnerCostRow[] = [];
  const tabsRead: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const grid = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName]!, {
      header: 1,
      blankrows: false,
      raw: true,
    });
    const headerIndex = grid.findIndex((row) =>
      row.some((cell) => /price per case us\$ invoiced to c&c/i.test(text(cell))),
    );

    if (headerIndex < 0) continue;

    const headings = grid[headerIndex]!.map((cell) => text(cell).toLowerCase());
    const at = (test: RegExp) => headings.findIndex((cell) => test.test(cell));

    const name = at(/^description/);
    const year = at(/^year$/);
    const pack = at(/^bottles \/ case$/);
    const price = at(/price per case us\$ invoiced to c&c/);

    if (name < 0 || pack < 0 || price < 0) continue;

    tabsRead.push(sheetName);

    for (const row of grid.slice(headerIndex + 1)) {
      const productName = text(row[name]);
      const perCase = number(row[price]);
      const bottles = number(row[pack]);

      if (!productName || !perCase || !bottles || bottles <= 0) continue;

      const vintage = year >= 0 ? number(row[year]) : null;

      rows.push({
        wCode: null,
        productName,
        vintage: vintage && vintage > 1800 ? vintage : null,
        costPerBottle: Math.round((perCase / bottles) * 100) / 100,
        tab: sheetName,
      });
    }

    /* The first tab that carries prices is the price list; later tabs are sales */
    break;
  }

  if (tabsRead.length === 0) {
    throw new Error(
      'No "Price per case US$ invoiced to C&C" column found. Upload the Cru Sales UAE workbook.',
    );
  }

  return { rows, tabsRead };
};

export default parseCruSalesSheet;
