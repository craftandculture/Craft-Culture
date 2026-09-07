import type { LpoLine, ParsedLpo } from './parseLpoText';

/** Money as this template writes it: "605.20", "2,409.34". */
const AMOUNT = /^\d{1,3}(?:,\d{3})*\.\d{2}$/;

/**
 * The whole of a line's figures, run together by the extractor.
 *
 * "6×750ml22042100France6100.87" is pack, bottle size, HS code, country of
 * origin, quantity and rate, with nothing between any of them.
 */
const DATA_LINE = new RegExp(
  String.raw`^(\d{1,3})\s*[×xX]\s*(\d+(?:\.\d+)?)\s*(ml|cl|l)\s*(\d{6,10})?\s*([A-Za-z][A-Za-z .'\-]*?)?(\d[\d.]*)$`,
  'i',
);

/** The plausible range for a wine bottle, as the other parsers use. */
const MIN_ML = 187;
const MAX_ML = 15000;

/** USD per AED. The dirham is pegged, so the conversion is exact arithmetic. */
const USD_PER_AED = 0.2723;

const toNumber = (text: string) => Number(String(text).replace(/,/g, ''));

const sizeToMl = (value: number, unit: string) => {
  const lower = unit.toLowerCase();

  return lower === 'ml' ? value : lower === 'cl' ? value * 10 : value * 1000;
};

/**
 * Split a run of digits into the quantity and the rate that produced the amount
 *
 * "1265.01" is twelve bottles at 65.01, and also one at 265.01 and a hundred
 * and twenty-six at 5.01. Nothing in the text says which. The line's own amount
 * does: only one cut multiplies back to it.
 *
 * The tolerance is the rounding the document already did — a rate is printed to
 * two decimals but the amount is computed from the unrounded one, so twelve at
 * 65.0142 prints as 65.01 and 780.17 rather than 780.12. Half a cent per
 * bottle covers that and nothing else.
 *
 * A run that splits two ways is not resolved by preferring one; it is returned
 * unresolved, because a wrong cut here orders the wrong number of bottles.
 *
 * @param run - The digits after the country of origin
 * @param amount - What the line says it comes to
 * @returns The one split that multiplies back, or null
 */
const splitQuantityAndRate = (run: string, amount: number) => {
  const found: { quantity: number; rate: number }[] = [];

  for (let cut = 1; cut < run.length; cut += 1) {
    const left = run.slice(0, cut);
    const right = run.slice(cut);

    if (!/^\d+$/.test(left) || !/^\d+\.\d{2}$/.test(right)) continue;

    const quantity = Number(left);
    const rate = Number(right);

    if (quantity <= 0 || rate <= 0) continue;

    if (Math.abs(quantity * rate - amount) <= quantity * 0.005 + 0.02) {
      found.push({ quantity, rate });
    }
  }

  return found.length === 1 ? found[0] : null;
};

/**
 * Read a Craft & Culture proforma invoice into the same shape as a client's LPO
 *
 * A proforma we issued is an order as much as one we receive — the wines, the
 * quantities and the prices are all agreed — so it is read here rather than
 * keyed again.
 *
 * Three things about this layout need saying, because each of them silently
 * produces a wrong order:
 *
 * **It is priced in dollars.** Everything downstream is named `...Aed` and
 * treated as dirhams, so the figures are converted at the peg on the way in
 * rather than left to be converted a second time on the way out. `currency`
 * records what the document actually said.
 *
 * **The quantity is in bottles, and it is fused to the rate.** See
 * `splitQuantityAndRate`: the amount is what separates them.
 *
 * **An amount can arrive split across lines.** "605.20" comes back as "605.2"
 * then "0", and "2,409.34" as "2,409." then "34", so the rows after the figures
 * are joined until they read as money.
 *
 * @example
 *   parseProformaText(text).lines[0]?.bottles; // 6
 *
 * @param text - Text extracted from the proforma PDF
 * @returns The header, the lines, and the stated total, all in AED
 */
const parseProformaText = (text: string): ParsedLpo => {
  const rows = text
    .split('\n')
    .map((row) => row.trim())
    .filter(Boolean);

  /*
    Dollars unless the document says otherwise. The template prints "Total$" and
    banks in USD; a dirham version would say so.
  */
  const isUsd = rows.some(
    (row) => /\$/.test(row) || /US\s*Dollar/i.test(row),
  );
  const toAed = (value: number) =>
    isUsd ? Math.round((value / USD_PER_AED) * 100) / 100 : value;

  const lines: LpoLine[] = [];
  const skipped: string[] = [];

  rows.forEach((row, index) => {
    const data = row.match(DATA_LINE);
    if (!data) return;

    const [, packText = '', sizeText = '', unit = '', , , run = ''] = data;

    const sizeMl = sizeToMl(Number(sizeText), unit);
    if (!Number.isFinite(sizeMl) || sizeMl < MIN_ML || sizeMl > MAX_ML) return;

    const packOf = Number(packText);
    if (!Number.isInteger(packOf) || packOf <= 0) return;

    // The amount follows, and may be broken over two or three rows.
    let joined = '';
    let amount: number | null = null;

    for (let at = index + 1; at <= index + 3 && at < rows.length; at += 1) {
      joined += rows[at] ?? '';

      if (AMOUNT.test(joined)) {
        amount = toNumber(joined);
        break;
      }
    }

    if (amount === null) {
      skipped.push(row);
      return;
    }

    // The description is whatever sits between this line's row number and it.
    const nameParts: string[] = [];

    for (let at = index - 1; at >= 0; at -= 1) {
      const candidate = rows[at] ?? '';

      if (!candidate || /^\d+$/.test(candidate) || DATA_LINE.test(candidate)) {
        break;
      }

      nameParts.unshift(candidate);
    }

    const description = nameParts.join(' ').replace(/\s+/g, ' ').trim();

    if (!description) {
      skipped.push(row);
      return;
    }

    /*
      The year is inside the name — "Hospice de Beaune 2023 - Savigny les
      Beaune". Taken out of the name as well as read off it, because the
      catalogue holds the vintage as its own field and a year left in the name
      is a token that matches nothing.
    */
    const year = /\b(?:19|20)\d{2}\b/.exec(description)?.[0] ?? '';
    const wine = description
      .replace(year, '')
      .replace(/\s*[-–]\s*/g, ' - ')
      .replace(/^[\s-–]+|[\s-–]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    const split = splitQuantityAndRate(run, amount);

    if (!split) {
      lines.push({
        region: '',
        wine: wine || description,
        vintage: year,
        volumeText: `${packText}x${sizeText}${unit.toLowerCase()}`,
        sizeMl,
        bottles: 0,
        unitPriceAed: 0,
        lineTotalAed: toAed(amount),
        problem: `"${run}" does not divide into a quantity and a rate that come to ${amount.toFixed(2)}`,
        pack: packOf,
      });

      return;
    }

    lines.push({
      region: '',
      wine: wine || description,
      vintage: year,
      volumeText: `${packText}x${sizeText}${unit.toLowerCase()}`,
      sizeMl,
      // This template counts bottles, not cases: six of a six is one case.
      bottles: split.quantity,
      unitPriceAed: toAed(split.rate),
      lineTotalAed: toAed(amount),
      problem: null,
      cases: split.quantity / packOf,
      pack: packOf,
    });
  });

  const value = (pattern: RegExp) =>
    rows.find((row) => pattern.test(row))?.match(pattern)?.[1]?.trim() ?? null;

  /*
    Who it is billed to, which runs over as many rows as the name needs before
    the address starts.
  */
  const billToAt = rows.findIndex((row) => /^Bill\s*To\s*:?/i.test(row));
  const clientParts: string[] = [];

  for (let at = billToAt + 1; billToAt >= 0 && at < rows.length; at += 1) {
    const candidate = rows[at] ?? '';

    // The address begins at the first row carrying a number or a comma.
    if (!candidate || /\d/.test(candidate) || candidate.includes(',')) break;

    clientParts.push(candidate);

    if (!/[–—-]$/.test(candidate)) break;
  }

  const declared =
    value(/Sub\s*Total[^\d]*(\d[\d,]*\.\d{2})/i) ??
    value(/^Total\s*\$?\s*(\d[\d,]*\.\d{2})$/i);

  return {
    poNumber: value(/^Ref#\s*(.+)$/i),
    poDate: value(/Invoice\s*Date\s*:?\s*(.+)$/i),
    client:
      clientParts
        .join(' ')
        .replace(/\s*[–—-]\s*$/, '')
        .replace(/\s+/g, ' ')
        .trim() || null,
    creditTerms: null,
    lines,
    totalBottles: lines.reduce((sum, line) => sum + line.bottles, 0),
    computedTotalAed:
      Math.round(lines.reduce((sum, line) => sum + line.lineTotalAed, 0) * 100) /
      100,
    declaredTotalAed: declared ? toAed(toNumber(declared)) : null,
    skipped,
  };
};

/** True when the text is a Craft & Culture proforma rather than a client's LPO. */
export const isProforma = (text: string) =>
  /Proforma\s*Invoice/i.test(text) && /Bill\s*To/i.test(text);

export default parseProformaText;
