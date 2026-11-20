import wineKey from './wineKey';

/** More than this apart, a price is a question rather than a rounding */
const TOLERANCE = 0.02;

export interface PricedLine {
  /** wineKey of the line's wine */
  key: string;
  outletCode: string | null;
  productName: string;
  ownerName: string;
  docRef: string | null;
  /** The invoice price per bottle, before any dated cut */
  pricePerBottle: number;
  /** What the owner is paid per bottle, where known */
  ownerCostPerBottle: number | null;
  /** False for C&C's own wine and City Drinks' own stock: owed to nobody */
  payOwner: boolean;
}

export interface RecentPrice {
  lwin18: string | null;
  productName: string;
  docRef: string | null;
  docDate: string;
  perBottle: number;
}

/**
 * The billed lines whose price needs a person before the month is approved
 *
 * Sophie's check (20 Nov 2026): a line is flagged where the invoice price per
 * bottle is more than 2% from what City Drinks were last billed for the same
 * wine in the previous three months, or where we bill less than we pay the
 * owner. October would flag Montille Chassagne 2022, Cristal Rosé and Mouton
 * 1993. A flag is a question, not a block: the invoice may simply be right.
 *
 * @param lines - The month's billed lines
 * @param recent - Prices billed in the three months before, latest first
 * @returns One flag per wine and invoice that needs looking at
 */
const checkSettlementPrices = (lines: PricedLine[], recent: RecentPrice[]) => {
  const latest = new Map<string, RecentPrice>();

  for (const row of recent) {
    const key = wineKey(row.lwin18 || row.productName);

    if (key && !latest.has(key) && row.perBottle > 0) latest.set(key, row);
  }

  const flags: { outletCode: string | null; productName: string; detail: string }[] = [];
  const seen = new Set<string>();
  const money = (value: number) => `$${value.toFixed(2)}`;

  for (const line of lines) {
    const id = `${line.key}|${line.docRef}`;

    if (!line.key || seen.has(id)) continue;
    seen.add(id);

    const reasons: string[] = [];
    const before = latest.get(line.key);

    if (before && before.docRef !== line.docRef) {
      const gap = (line.pricePerBottle - before.perBottle) / before.perBottle;

      if (Math.abs(gap) > TOLERANCE) {
        reasons.push(
          `${line.docRef ?? 'invoice'} bills ${money(line.pricePerBottle)}/btl, ${(gap * 100).toFixed(1)}% from ${money(before.perBottle)} on ${before.docRef ?? 'an invoice'} (${before.docDate})`,
        );
      }
    }

    if (
      line.payOwner &&
      line.ownerCostPerBottle !== null &&
      line.pricePerBottle < line.ownerCostPerBottle - 0.005
    ) {
      reasons.push(
        `billed ${money(line.pricePerBottle)}/btl, below the ${money(line.ownerCostPerBottle)} paid to ${line.ownerName}`,
      );
    }

    if (reasons.length) {
      flags.push({
        outletCode: line.outletCode,
        productName: line.productName,
        detail: `Price check: ${reasons.join('; ')}`,
      });
    }
  }

  return flags;
};

export default checkSettlementPrices;
