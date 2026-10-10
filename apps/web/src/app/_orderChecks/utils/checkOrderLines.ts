import isUsableLwin18 from '@/app/_lwin/utils/isUsableLwin18';
import normalizeLwin18 from '@/app/_lwin/utils/normalizeLwin18';
import { lwinPakKeyOf } from '@/app/_wms/utils/lwinPakKey';

export type IssueLevel = 'error' | 'warning' | 'info';

export interface Issue {
  level: IssueLevel;
  code: string;
  message: string;
}

export interface CheckLine {
  name: string;
  description?: string | null;
  sku?: string | null;
  /** Price per unit, in the document's currency */
  rate: number;
  quantity: number;
  /** 'Case', 'Cases', 'Bottle' … as Zoho records it */
  unit?: string | null;
  itemTotal?: number | null;
  /** A heading row ("CONSIGNMENT_CC"), not a wine */
  isHeader?: boolean;
}

export interface CheckContext {
  currency: string;
  /** Multiply the document's amounts by this to get USD */
  toUsd: number | null;
  /** In-bond list price per bottle in USD, by lwinPakKey (wine-vintage-size) */
  listPerBottle: Map<string, number>;
  /** Bottles on hand or on the water, by lwinPakKey */
  stockBottles: Map<string, number>;
  /** Compare prices with the in-bond list (trade documents); off for PCO cost lines */
  comparePrices: boolean;
}

export interface LineResult {
  index: number;
  name: string;
  sku: string | null;
  quantity: number;
  rate: number;
  perBottleUsd: number | null;
  listPerBottleUsd: number | null;
  issues: Issue[];
}

const YEAR = /\b(19[5-9]\d|20[0-4]\d)\b/g;
const PACK_SIZE = /(\d{1,2})\s*[x×]\s*(\d{1,4}(?:\.\d+)?)\s*(cl|ml|l)\b/i;
const SIZE_ONLY = /\b(\d{1,4}(?:\.\d+)?)\s*(cl|ml|l)\b/i;

const toMl = (amount: number, unit: string) =>
  Math.round(unit.toLowerCase() === 'l' ? amount * 1000 : unit.toLowerCase() === 'cl' ? amount * 10 : amount);

/** Pack and size stated in a line's name or description, e.g. "(3x75cl)" */
export const statedPackAndSize = (text: string) => {
  const both = PACK_SIZE.exec(text);
  if (both) return { pack: Number(both[1]), sizeMl: toMl(Number(both[2]), both[3]!) };
  const size = SIZE_ONLY.exec(text);
  return { pack: null, sizeMl: size ? toMl(Number(size[1]), size[2]!) : null };
};

const money = (n: number) => `$${n.toFixed(2)}`;

/**
 * Check an order or invoice line by line before it goes to a client
 *
 * The errors that keep reaching invoices, in order of how much they cost:
 * a wrong or missing code (the wrong wine is picked or billed), a code whose
 * pack, size or vintage disagrees with the name the client reads, a missing
 * price, a price below the in-bond list, a currency mix-up (AED figures on a
 * USD invoice), a line total that does not add up, the same wine twice, and
 * wine we do not hold. Nothing is changed; each line gets a list of issues.
 *
 * @example
 *   const { lines, documentIssues } = checkOrderLines([{ name: 'Talbot 2016 (6x75cl)', sku: '1012781-2016-06-00750', rate: 300, quantity: 2 }], ctx);
 *
 * @param input - The document's lines, in order
 * @param ctx - Currency, the price list and stock to check against
 * @returns Issues per line, and for the document as a whole
 */
const checkOrderLines = (input: CheckLine[], ctx: CheckContext) => {
  const seen = new Map<string, number>();
  const ratios: number[] = [];

  const lines: LineResult[] = input.map((line, index) => {
    const issues: Issue[] = [];
    const add = (level: IssueLevel, code: string, message: string) => issues.push({ level, code, message });
    const text = `${line.name} ${line.description ?? ''}`;
    const result: LineResult = {
      index,
      name: line.name,
      sku: line.sku ?? null,
      quantity: line.quantity,
      rate: line.rate,
      perBottleUsd: null,
      listPerBottleUsd: null,
      issues,
    };

    if (line.isHeader || (!line.sku && !(line.quantity > 0))) return result;

    // Code
    const code = line.sku ? normalizeLwin18(line.sku.trim()) : null;
    const parts = code && isUsableLwin18(code) ? code.split('-') : null;

    if (!code) add('error', 'NO_CODE', 'No product code — the line cannot be matched to stock or picked');
    else if (!parts) add('error', 'BAD_CODE', `"${line.sku}" is not a full LWIN18 code (wine-vintage-pack-size)`);

    const codePack = parts ? Number(parts[2]) : null;
    const codeSizeMl = parts ? Number(parts[3]) : null;
    const codeVintage = parts ? Number(parts[1]) : null;

    // Code against what the client reads
    const stated = statedPackAndSize(text);
    if (parts && stated.pack && codePack && stated.pack !== codePack) {
      add('error', 'PACK_MISMATCH', `Name says ${stated.pack}-pack, code says ${codePack}-pack`);
    }
    if (parts && stated.sizeMl && codeSizeMl && stated.sizeMl !== codeSizeMl) {
      add('error', 'SIZE_MISMATCH', `Name says ${stated.sizeMl}ml, code says ${codeSizeMl}ml`);
    }
    const years = [...new Set([...line.name.matchAll(YEAR)].map((m) => Number(m[1])))];
    if (parts && codeVintage && codeVintage !== 1000 && years.length === 1 && years[0] !== codeVintage) {
      add('error', 'VINTAGE_MISMATCH', `Name says ${years[0]}, code says ${codeVintage}`);
    }

    // Same wine twice
    if (code) {
      const first = seen.get(code);
      if (first !== undefined) add('warning', 'DUPLICATE', `Same code as line ${first + 1}`);
      else seen.set(code, index);
    }

    // Stock
    const key = parts ? lwinPakKeyOf(code!) : null;
    if (key && !(ctx.stockBottles.get(key) ?? 0)) {
      add('warning', 'NOT_HELD', 'Not in our warehouse or on the water');
    }

    // Price
    if (!(line.rate > 0)) {
      add('error', 'NO_PRICE', 'No price on this line');
    } else {
      const isBottleUnit = /^bottle/i.test((line.unit ?? '').trim());
      const pack = isBottleUnit ? 1 : (stated.pack ?? codePack ?? null);
      const perBottle = pack ? line.rate / pack : null;
      const perBottleUsd = perBottle !== null && ctx.toUsd ? perBottle * ctx.toUsd : null;
      result.perBottleUsd = perBottleUsd;

      const list = key ? (ctx.listPerBottle.get(key) ?? null) : null;
      result.listPerBottleUsd = list;

      if (ctx.comparePrices && list && perBottleUsd !== null) {
        ratios.push(perBottleUsd / list);
        if (perBottleUsd < list * 0.98) {
          add('warning', 'BELOW_LIST', `${money(perBottleUsd)}/btl is below the in-bond list ${money(list)}/btl`);
        } else if (perBottleUsd > list * 3) {
          add('info', 'FAR_ABOVE_LIST', `${money(perBottleUsd)}/btl is over 3× the in-bond list ${money(list)}/btl — check the pack or currency`);
        }
      }
    }

    // Arithmetic
    if (line.itemTotal != null && line.rate > 0 && line.quantity > 0) {
      const expected = line.rate * line.quantity;
      // Discounts only ever lower a line, so only a total above rate × qty is wrong
      if (line.itemTotal - expected > 0.05) {
        add('error', 'TOTAL_MISMATCH', `Line total ${line.itemTotal.toFixed(2)} is more than rate × quantity (${expected.toFixed(2)})`);
      }
    }

    return result;
  });

  // Document-level: a whole document priced in the wrong currency
  const documentIssues: Issue[] = [];
  if (!['USD', 'AED'].includes(ctx.currency)) {
    documentIssues.push({ level: 'warning', code: 'CURRENCY', message: `Document is in ${ctx.currency}; C&C bills in USD or AED` });
  }
  if (ratios.length >= 2) {
    const median = [...ratios].sort((a, b) => a - b)[Math.floor(ratios.length / 2)]!;
    if (ctx.currency === 'AED' && median > 0.2 && median < 0.33) {
      documentIssues.push({ level: 'error', code: 'CURRENCY_MIXUP', message: 'Prices look like USD figures entered on an AED document (about 3.67× too low)' });
    }
    if (ctx.currency === 'USD' && median > 3 && median < 4.5) {
      documentIssues.push({ level: 'error', code: 'CURRENCY_MIXUP', message: 'Prices look like AED figures entered on a USD document (about 3.67× too high)' });
    }
  }

  const all = [...documentIssues, ...lines.flatMap((l) => l.issues)];

  return {
    lines,
    documentIssues,
    counts: {
      error: all.filter((i) => i.level === 'error').length,
      warning: all.filter((i) => i.level === 'warning').length,
      info: all.filter((i) => i.level === 'info').length,
    },
  };
};

export default checkOrderLines;
