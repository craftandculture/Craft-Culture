/** One ordered line, exactly as the client's purchase order states it. */
export interface LpoLine {
  /** The heading the client filed it under — "Bordeaux", "Tuscany". */
  region: string;
  /** The client's own wording for the wine, which is not our product name. */
  wine: string;
  /** Four digits, or "NV". */
  vintage: string;
  /** The order's own words for the format — "75cl", "1.5L Magnum". */
  volumeText: string;
  sizeMl: number;
  bottles: number;
  unitPriceAed: number;
  lineTotalAed: number;
  /** Set when the line's own arithmetic disagrees; never silently corrected. */
  problem: string | null;
}

export interface ParsedLpo {
  poNumber: string | null;
  poDate: string | null;
  client: string | null;
  creditTerms: string | null;
  lines: LpoLine[];
  totalBottles: number;
  /** What the lines add up to. */
  computedTotalAed: number;
  /** What the document says it adds up to; null when it does not say. */
  declaredTotalAed: number | null;
  /** Blocks that looked like lines but could not be read as one. */
  skipped: string[];
}

/** A quantity or price: digits, optional thousands commas, two decimals. */
const MONEY = String.raw`\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\d+(?:\.\d{2})?`;

/**
 * Vintage, format and quantity arrive as one run of characters
 * ("201775cl6.00"), so the split is only unambiguous because the format always
 * carries a unit and the quantity always ends the line.
 */
const QTY_LINE = new RegExp(String.raw`^(\d{4}|NV)(.*?[a-zA-Z].*?)(\d+(?:\.\d{2})?)$`);

const PRICE_LINE = new RegExp(String.raw`^(${MONEY})\s+(${MONEY})$`);

/** The plausible range for a wine bottle, as `_logistics` uses. */
const MIN_ML = 187;
const MAX_ML = 15000;

const toNumber = (text: string) => Number(text.replace(/,/g, ''));

/**
 * Read a format into millilitres.
 *
 * The order writes formats as people say them — "75cl", "1.5L Magnum",
 * "6L Imperial" — so the number and its unit are what carry the meaning and the
 * name after them is decoration.
 */
const parseSizeMl = (text: string) => {
  const match = text.match(/([\d.]+)\s*(cl|ml|l)\b/i);
  if (!match?.[1] || !match[2]) return null;

  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return null;

  const unit = match[2].toLowerCase();
  const ml = unit === 'ml' ? value : unit === 'cl' ? value * 10 : value * 1000;

  return ml >= MIN_ML && ml <= MAX_ML ? ml : null;
};

/**
 * Read a client's purchase order into ordered lines.
 *
 * The PDF flattens each item into a fixed four-line block — region, the
 * client's own name for the wine, a run holding vintage/format/quantity, then
 * unit price and line total:
 *
 * ```
 * Bordeaux
 * Alter Ego, Margaux
 * 201775cl6.00
 * 405.00        2,430.00
 * ```
 *
 * Nothing here is inferred by a model. The document states every figure twice
 * over — unit × quantity against the line total, and the lines against the
 * stated grand total — and both checks are reported rather than repaired,
 * because an order that does not add up is a question for the client, not
 * something to quietly round. A block that does not parse is listed in
 * `skipped` rather than dropped, so a silent under-read cannot look like a
 * short order.
 *
 * @example
 *   parseLpoText(text).totalBottles; // 113
 *
 * @param text - Text extracted from the purchase order PDF
 * @returns The order's header, its lines, and both totals for comparison
 */
const parseLpoText = (text: string): ParsedLpo => {
  const rows = text
    .split('\n')
    .map((row) => row.trim())
    .filter(Boolean);

  const lines: LpoLine[] = [];
  const skipped: string[] = [];

  rows.forEach((row, index) => {
    const match = row.match(QTY_LINE);
    if (!match) return;

    const [, vintage = '', volumeText = '', qtyText = ''] = match;

    // A four-digit year is the only thing that starts a line; a stray figure
    // that happens to match must not become an order for 9,999 bottles.
    if (vintage !== 'NV') {
      const year = Number(vintage);
      if (year < 1900 || year > 2100) return;
    }

    const sizeMl = parseSizeMl(volumeText);
    const bottles = toNumber(qtyText);
    const priceMatch = rows[index + 1]?.match(PRICE_LINE);
    const wine = rows[index - 1] ?? '';
    const region = rows[index - 2] ?? '';

    if (sizeMl === null || !priceMatch || !wine) {
      skipped.push(row);
      return;
    }

    const unitPriceAed = toNumber(priceMatch[1] ?? '');
    const lineTotalAed = toNumber(priceMatch[2] ?? '');

    let problem: string | null = null;
    if (!Number.isInteger(bottles) || bottles <= 0) {
      problem = `Quantity reads "${qtyText}"`;
    } else if (Math.abs(unitPriceAed * bottles - lineTotalAed) > 0.5) {
      problem = `${bottles} × ${unitPriceAed} is ${(unitPriceAed * bottles).toFixed(2)}, but the line says ${lineTotalAed.toFixed(2)}`;
    }

    lines.push({
      region,
      wine,
      vintage,
      volumeText: volumeText.trim(),
      sizeMl,
      bottles,
      unitPriceAed,
      lineTotalAed,
      problem,
    });
  });

  const grandTotal = rows
    .find((row) => /grand\s*total/i.test(row))
    ?.match(new RegExp(`(${MONEY})\\s*$`));

  const header = (pattern: RegExp) =>
    rows.find((row) => pattern.test(row))?.match(pattern)?.[1]?.trim() ?? null;

  return {
    poNumber: header(/PO\s*NO\.?\s*(.+)/i),
    poDate: header(/DATE:\s*(.+)/i),
    client: rows[0] ?? null,
    creditTerms: header(/Credit\s*Terms\s*[-–]?\s*(.+)/i),
    lines,
    totalBottles: lines.reduce((sum, line) => sum + line.bottles, 0),
    computedTotalAed:
      Math.round(lines.reduce((sum, line) => sum + line.lineTotalAed, 0) * 100) /
      100,
    declaredTotalAed: grandTotal?.[1] ? toNumber(grandTotal[1]) : null,
    skipped,
  };
};

export default parseLpoText;
