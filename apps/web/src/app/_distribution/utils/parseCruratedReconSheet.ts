import * as XLSX from 'xlsx';

export interface OwnerCostRow {
  /** Crurated's W code (W33100124), or null where the sheet gives none */
  wCode: string | null;
  productName: string;
  vintage: number | null;
  costPerBottle: number;
  /** Which tab the price came from, shown on the statement line */
  tab: string;
}

/**
 * The rate the recon workbook converts its AED prices at.
 *
 * Not the 3.6725 peg: the workbook divides by 3.67, and the September run it
 * reproduces ($21,446.84, 397 bottles) is only matched to the cent at 3.67.
 */
export const RECON_AED_PER_USD = 3.67;

interface TabRule {
  /** Recognises the tab by name */
  name: RegExp;
  label: string;
}

/*
  Ocean first: Sophie, 2 Nov 2026. The airfreight tabs price only wines that
  never came by sea, and between the two air shipments the older goes first.
*/
const TABS: TabRule[] = [
  { name: /^ocean/i, label: 'Ocean freight' },
  { name: /^airfreight\s*1\b/i, label: 'Airfreight 1' },
  { name: /^airfreight\s*2\b/i, label: 'Airfreight 2' },
];

const text = (value: unknown) =>
  value === null || value === undefined ? '' : String(value).trim();

const number = (value: unknown) => {
  const parsed = typeof value === 'number' ? value : Number(text(value).replace(/[, ]/g, ''));

  return Number.isFinite(parsed) ? parsed : null;
};

const VINTAGE = /\b(19|20)\d{2}\b/;

/**
 * Read what C&C owes Crurated per bottle, from the payment-run workbook
 *
 * Each freight tab prices the wines that came on that shipment. The price
 * owed is Crurated's own — the EUR in-bond price on Ocean, the DAP price on
 * Airfreight 1, both in AED a bottle; the DAP price per case on Airfreight 2,
 * in USD — never the duty-free price C&C sells on at, which sits beside it and
 * is easy to take by mistake.
 *
 * Columns are found by heading, because the tabs differ in layout and each
 * has been edited by hand.
 *
 * @example
 *   parseCruratedReconSheet(base64).rows.find((row) => row.wCode === 'W11600324');
 *   // { costPerBottle: 58.58, tab: 'Ocean freight', … }
 *
 * @param file - The workbook, base64
 * @returns One row per W code, from the first tab that prices it
 */
const parseCruratedReconSheet = (file: string) => {
  const workbook = XLSX.read(file, { type: 'base64' });
  const rows: OwnerCostRow[] = [];
  const seen = new Set<string>();
  const tabsRead: string[] = [];

  for (const rule of TABS) {
    const sheetName = workbook.SheetNames.find((name) => rule.name.test(name.trim()));

    if (!sheetName) continue;

    const grid = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName]!, {
      header: 1,
      blankrows: false,
      raw: true,
    });
    const headerIndex = grid.findIndex((row) => /^sku$/i.test(text(row[0])));

    if (headerIndex < 0) continue;

    const headings = grid[headerIndex]!.map((cell) => text(cell).toLowerCase());
    const at = (test: RegExp) => headings.findIndex((cell) => test.test(cell));

    const name = at(/^bottle name$/);
    const aedPerBottle = at(/^(eur ib|dap) price aed$/);
    const usdPerCase = at(/^dap \(usd per case\)$/);
    const casePack = at(/^case config$/);

    if (name < 0 || (aedPerBottle < 0 && (usdPerCase < 0 || casePack < 0))) {
      continue;
    }

    tabsRead.push(sheetName);

    for (const row of grid.slice(headerIndex + 1)) {
      const wCode = text(row[0]).toUpperCase() || null;
      const productName = text(row[name]);

      if (!productName) continue;

      let cost: number | null = null;

      if (aedPerBottle >= 0) {
        const aed = number(row[aedPerBottle]);

        cost = aed && aed > 0 ? aed / RECON_AED_PER_USD : null;
      } else {
        const perCase = number(row[usdPerCase]);
        const pack = number(row[casePack]);

        cost = perCase && pack && pack > 0 ? perCase / pack : null;
      }

      if (cost === null) continue;

      const key = wCode ?? productName.toUpperCase();

      if (seen.has(key)) continue;

      seen.add(key);
      rows.push({
        wCode,
        productName,
        vintage: Number(VINTAGE.exec(productName)?.[0]) || null,
        costPerBottle: Math.round(cost * 100) / 100,
        tab: rule.label,
      });
    }
  }

  if (tabsRead.length === 0) {
    throw new Error(
      'No Ocean freight or Airfreight tab found. Upload the Crurated x C&C Payment Run and Recon workbook.',
    );
  }

  return { rows, tabsRead };
};

export default parseCruratedReconSheet;
