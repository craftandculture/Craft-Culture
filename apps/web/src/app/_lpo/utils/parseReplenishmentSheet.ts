import * as XLSX from 'xlsx';

import type { ParsedLpo } from './parseLpoText';

/** "Send 4 case", "Send 2 Cases", "send 1 case next shipment" */
const SEND = /send\s+(\d+)\s*(case|cs|btl|bottle)/i;

/**
 * Read a replenishment sheet as an order
 *
 * A client's replenishment sheet is a purchase order written as a spreadsheet:
 * a list of wines, what they hold, and an instruction per row. It goes through
 * exactly the same reading as a PDF order — matched against our catalogue,
 * checked for availability and repacks, priced and turned into a draft — so it
 * is parsed into the same shape rather than given a pipeline of its own.
 *
 * Rows are only taken when they say to send something. "OOS" and "Stock Ok" are
 * a status the client is reporting, not an instruction, and reading them as an
 * order would ship wine nobody asked for.
 *
 * Prices are deliberately left at zero here: a replenishment sheet does not
 * state them, and they are filled from our own in-bond pricing rather than
 * guessed. That is why the reconciliation cannot be run against a stated total
 * — there isn't one, and the preview says so rather than inventing agreement.
 *
 * @param base64 - The uploaded workbook
 * @param sourceFilter - Only rows whose Remarks column says this, e.g. "OpenCellar"
 * @returns The sheet in the same shape a parsed PDF order takes
 */
const parseReplenishmentSheet = (
  base64: string,
  sourceFilter?: string,
): ParsedLpo => {
  const payload = base64.includes(',')
    ? base64.slice(base64.indexOf(',') + 1)
    : base64;

  const workbook = XLSX.read(Buffer.from(payload, 'base64'), { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = sheetName ? workbook.Sheets[sheetName] : undefined;

  if (!sheet) throw new Error('That workbook has no sheets');

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
  });

  const text = (value: unknown) => String(value ?? '').trim();
  const skipped: string[] = [];
  const lines: ParsedLpo['lines'] = [];

  for (const row of rows) {
    const wine = text(row['Product Name']);

    if (!wine) continue;

    // The consignor, which is what "the OpenCellar lines" means
    const source = text(row['Remarks']);

    if (
      sourceFilter &&
      !source.toLowerCase().includes(sourceFilter.toLowerCase())
    ) {
      continue;
    }

    /*
      The instruction sits in the last column as free text. Only a row that
      asks for something becomes a line; "OOS" is the client telling us they
      have none, which is the reason for the sheet, not an order.
    */
    const instruction = Object.values(row)
      .map(text)
      .find((value) => SEND.test(value));

    if (!instruction) {
      if (/oos|stock ok/i.test(Object.values(row).map(text).join(' '))) continue;

      skipped.push(`${wine} — no quantity in "${Object.values(row).map(text).join(' ')}"`);
      continue;
    }

    const asked = SEND.exec(instruction);
    const count = Number(asked?.[1] ?? 0);
    const unit = (asked?.[2] ?? 'case').toLowerCase();

    if (!count) continue;

    // A vintage on the end of the name is the only one the sheet states
    const vintage = /\b(19|20)\d{2}\b/.exec(wine)?.[0] ?? 'NV';

    lines.push({
      region: source || 'Replenishment',
      wine,
      vintage,
      volumeText: unit.startsWith('case') || unit === 'cs' ? `${count} case` : `${count} btl`,
      // The sheet never states a format; the catalogue match settles it
      sizeMl: 750,
      /*
        Cases are turned into bottles at six, and corrected by the match.
        Guessing is unavoidable — the sheet says "4 case" and not of what — so
        it is the common pack, and the preview shows what we actually hold
        beside it for someone to check before anything is created.
      */
      bottles: unit.startsWith('case') || unit === 'cs' ? count * 6 : count,
      unitPriceAed: 0,
      lineTotalAed: 0,
      problem: null,
    });
  }

  return {
    poNumber: null,
    poDate: null,
    client: null,
    creditTerms: null,
    lines,
    totalBottles: lines.reduce((sum, line) => sum + line.bottles, 0),
    computedTotalAed: 0,
    // A replenishment sheet states no total, so there is nothing to agree with
    declaredTotalAed: null,
    skipped,
  };
};

export default parseReplenishmentSheet;
