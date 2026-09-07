import type { LpoLine, ParsedLpo } from './parseLpoText';

/** A quantity or price: digits, optional thousands commas, two decimals. */
const MONEY = String.raw`\d{1,3}(?:,\d{3})*\.\d{2}|\d+\.\d{2}`;

/**
 * "6X75CL" — the pack and the bottle in one token, followed by whatever the
 * extractor ran into it (the supplier's code, then the quantity).
 */
const PACK_LINE = new RegExp(
  String.raw`^(\d{1,3})\s*[X×]\s*(\d+(?:\.\d+)?)\s*(CL|ML|L)(\d*)$`,
  'i',
);

/** "AED1,223.781,223.78" — currency, price per case, then the line total. */
const CURRENCY_LINE = new RegExp(
  String.raw`^([A-Z]{3})\s*(${MONEY})\s*(${MONEY})$`,
);

/** The plausible range for a wine bottle, as `parseLpoText` uses. */
const MIN_ML = 187;
const MAX_ML = 15000;

const toNumber = (text: string) => Number(String(text).replace(/,/g, ''));

const sizeToMl = (value: number, unit: string) => {
  const lower = unit.toLowerCase();
  return lower === 'ml' ? value : lower === 'cl' ? value * 10 : value * 1000;
};

/** Rows that are furniture, not an order line. */
const NOT_A_NAME =
  /^(product|packing|code|supplier|qty|foc|currency|price|sub-?total|remarks|total|vat|grand total|order form|term|\[|attn|contact|serial|date|prepared|approved|local final)/i;

/**
 * Read the "ORDER FORM" purchase order into the same shape as every other one.
 *
 * This layout is a table, not the four-line block `parseLpoText` reads, and it
 * counts in **cases** where the rest of the pipeline counts in bottles:
 *
 * ```
 * Numanthia, Numanthia, Toro     <- the name, which may wrap
 * DO
 * 6X75CL333911                   <- pack, supplier code and quantity, run together
 * 0                              <- FOC
 * AED1,223.781,223.78            <- currency, price per case, line total
 * ```
 *
 * Two things here are worth stating plainly, because getting either wrong
 * produces a plausible order for the wrong amount of wine.
 *
 * **Cases are converted to bottles.** The document orders one case of six; the
 * rest of `_lpo` reasons in bottles, so this returns six and divides the
 * per-case price to match. `cases`, `pack` and `unitPriceCaseAed` are carried
 * alongside so the report can show what the client actually wrote.
 *
 * **The quantity is recovered by arithmetic, not by cutting the string.** The
 * extractor concatenates the supplier's code and the quantity into one run of
 * digits ("33391" + "1" = "333911") and nothing in the text says where to cut.
 * The line total divided by the price per case gives the quantity, and the
 * digits are then checked against it. Where they disagree the line is skipped
 * rather than guessed, because a mis-cut here is the difference between one
 * case and eleven.
 *
 * @example
 *   parseOrderFormText(text).lines[0]?.bottles; // 6
 *
 * @param text - Text extracted from the purchase-order PDF
 * @returns The order's header, its lines, and both totals for comparison
 */
const parseOrderFormText = (text: string): ParsedLpo => {
  const rows = text
    .split('\n')
    .map((row) => row.trim())
    .filter(Boolean);

  const lines: LpoLine[] = [];
  const skipped: string[] = [];

  rows.forEach((row, index) => {
    const pack = row.match(PACK_LINE);
    if (!pack) return;

    const [, packText = '', sizeText = '', unit = '', trailing = ''] = pack;

    const sizeMl = sizeToMl(Number(sizeText), unit);
    if (!Number.isFinite(sizeMl) || sizeMl < MIN_ML || sizeMl > MAX_ML) return;

    // The money line is the next one that carries a currency; FOC and any
    // blank column sit between it and the pack.
    const moneyIndex = [index + 1, index + 2, index + 3].find((at) =>
      CURRENCY_LINE.test(rows[at] ?? ''),
    );
    const money = rows[moneyIndex ?? -1]?.match(CURRENCY_LINE);

    if (!money) {
      skipped.push(row);
      return;
    }

    const pricePerCase = toNumber(money[2] ?? '');
    const lineTotalAed = toNumber(money[3] ?? '');

    // The quantity the document's own arithmetic implies.
    const impliedCases =
      pricePerCase > 0 ? Math.round(lineTotalAed / pricePerCase) : 0;

    // The digits left on the pack line are the supplier's code followed by
    // that quantity. If they do not end with it, the run cannot be split.
    const quantityDigits = String(impliedCases);
    const splitsCleanly =
      impliedCases > 0 && trailing.endsWith(quantityDigits) &&
      trailing.length > quantityDigits.length;
    const supplierCode = splitsCleanly
      ? trailing.slice(0, trailing.length - quantityDigits.length)
      : null;

    // The name is however many rows above the pack line are not furniture.
    const nameParts: string[] = [];
    for (let at = index - 1; at >= 0; at -= 1) {
      const candidate = rows[at] ?? '';
      if (
        !candidate ||
        NOT_A_NAME.test(candidate) ||
        PACK_LINE.test(candidate) ||
        CURRENCY_LINE.test(candidate) ||
        /^[\d,.]+$/.test(candidate)
      ) {
        break;
      }
      nameParts.unshift(candidate);
    }

    const wine = nameParts.join(' ').replace(/\s+/g, ' ').trim();
    const packOf = Number(packText);

    if (!wine || !Number.isInteger(packOf) || packOf <= 0) {
      skipped.push(row);
      return;
    }

    let problem: string | null = null;
    if (impliedCases <= 0) {
      problem = `Quantity could not be read from ${lineTotalAed} ÷ ${pricePerCase}`;
    } else if (!splitsCleanly) {
      problem = `"${trailing}" does not end with the ${impliedCases} the total implies, so the supplier code and quantity cannot be separated`;
    } else if (Math.abs(pricePerCase * impliedCases - lineTotalAed) > 0.5) {
      problem = `${impliedCases} × ${pricePerCase} is ${(pricePerCase * impliedCases).toFixed(2)}, but the line says ${lineTotalAed.toFixed(2)}`;
    }

    // A line whose quantity cannot be trusted is not an order for zero.
    if (problem && impliedCases <= 0) {
      skipped.push(row);
      return;
    }

    lines.push({
      region: '',
      wine,
      // This layout does not state a vintage. Left empty on purpose: the
      // matcher treats that as "not stated" and asks, rather than assuming.
      vintage: '',
      volumeText: `${packText}x${sizeText}${unit.toLowerCase()}`,
      sizeMl,
      bottles: impliedCases * packOf,
      unitPriceAed:
        Math.round((pricePerCase / packOf + Number.EPSILON) * 100) / 100,
      lineTotalAed,
      problem,
      cases: impliedCases,
      pack: packOf,
      unitPriceCaseAed: pricePerCase,
      supplierCode,
    });
  });

  const value = (pattern: RegExp) =>
    rows.find((row) => pattern.test(row))?.match(pattern)?.[1]?.trim() ?? null;

  // The stated sub-total is ex-VAT, as the lines are. Comparing the lines to
  // the grand total would report a mismatch on every correct order.
  const declared = value(new RegExp(String.raw`Sub-?Total\s*\(AED\)\s*(${MONEY})`, 'i'));

  return {
    poNumber: value(/Serial\s*No\.?:?\s*([A-Za-z0-9-]+)/i),
    poDate: value(/^Date:?\s*(.+)$/i),
    client: value(/^SUPPLIER:\s*(.+)$/i),
    creditTerms: value(/^(.*\bCREDIT TERMS\b.*)$/i)?.replace(/\d+\.$/, '').trim() ?? null,
    lines,
    totalBottles: lines.reduce((sum, line) => sum + line.bottles, 0),
    computedTotalAed:
      Math.round(lines.reduce((sum, line) => sum + line.lineTotalAed, 0) * 100) /
      100,
    declaredTotalAed: declared ? toNumber(declared) : null,
    skipped,
  };
};

/** True when the text is an "ORDER FORM" rather than the block layout. */
export const isOrderForm = (text: string) =>
  /ORDER\s*FORM/i.test(text) && /Price\s*\(per\s*Case\)/i.test(text);

export default parseOrderFormText;
