export interface LedgerDiff {
  lwin18: string;
  productName: string;
  /** Physical stock minus what the movements account for. */
  diff: number;
  locationId: string | null;
}

export interface ReconcilePlan {
  /** One wine re-designated from one pack to another: out of A, into B. */
  repacks: { from: LedgerDiff; to: LedgerDiff; cases: number }[];
  /** Stock the ledger never saw arrive — record the arrival, keep the stock. */
  topUps: { row: LedgerDiff; cases: number; fromCrackedCase: boolean }[];
  /** Ledger claims more than the bay holds — a person has to count these. */
  needsCount: LedgerDiff[];
}

/** Same wine, vintage and bottle size — only the pack segment differs. */
const wineKey = (lwin18: string) => {
  const parts = String(lwin18).split('-');
  return parts.length === 4 ? `${parts[0]}-${parts[1]}-${parts[3]}` : String(lwin18);
};

const packOf = (lwin18: string) => {
  const parts = String(lwin18).split('-');
  return parts.length === 4 ? Number(parts[2]) || 0 : 0;
};

/**
 * Decide what to write so the ledger matches the wine on the shelf.
 *
 * The bay is the truth. Every entry below records something that physically
 * happened but was never written down; none of them changes a stock quantity.
 *
 * - A wine over on one pack code and under by the SAME amount on another is one
 *   event — its pack was re-designated — so it is recorded as a repack pair.
 *   Treating the over-count alone as an arrival would leave the old code short
 *   for good.
 * - Anything still over gets its arrival recorded, for the size of the GAP, not
 *   the size of the stock: bottles from a cracked case may since have been
 *   picked, leaving a row at zero with a negative ledger. Sizing by stock would
 *   never close that.
 * - Anything under is left alone. "The ledger says 18 and the bay says 0" can
 *   mean wine left unrecorded or that it was never there, and only a count can
 *   tell.
 *
 * @example
 *   planLedgerReconcile([
 *     { lwin18: '1103034-2019-03-00750', productName: 'San Polo', diff: 18, locationId: 'a' },
 *     { lwin18: '1103034-2019-06-00750', productName: 'San Polo', diff: -18, locationId: null },
 *   ]);
 *   // one repack: 18 cases from …-06-… into …-03-…
 *
 * @param rows - Every wine whose ledger and stock disagree
 * @returns What to record, split by kind
 */
const planLedgerReconcile = (rows: LedgerDiff[]): ReconcilePlan => {
  const plan: ReconcilePlan = { repacks: [], topUps: [], needsCount: [] };

  // Group EVERY row, including ones that balance: a 6-pack row that agrees with
  // its ledger is still the evidence that the matching single-bottle row came
  // from a cracked case.
  const byWine = new Map<string, LedgerDiff[]>();
  for (const row of rows) {
    const key = wineKey(row.lwin18);
    byWine.set(key, [...(byWine.get(key) ?? []), row]);
  }

  for (const wineRows of byWine.values()) {
    const paired = new Set<string>();
    const over = wineRows.filter((r) => r.diff > 0);
    const under = wineRows.filter((r) => r.diff < 0);
    if (over.length === 0 && under.length === 0) continue;

    for (const gained of over) {
      const lost = under.find(
        (u) => Math.abs(u.diff) === gained.diff && !paired.has(u.lwin18),
      );
      if (!lost) continue;
      paired.add(gained.lwin18);
      paired.add(lost.lwin18);
      plan.repacks.push({ from: lost, to: gained, cases: gained.diff });
    }

    for (const row of wineRows) {
      if (paired.has(row.lwin18) || row.diff === 0) continue;
      if (row.diff > 0) {
        plan.topUps.push({
          row,
          cases: row.diff,
          // A single-bottle code alongside a larger pack of the same wine is
          // what a cracked case leaves behind.
          fromCrackedCase:
            packOf(row.lwin18) === 1 &&
            wineRows.some((other) => packOf(other.lwin18) > 1),
        });
      } else {
        plan.needsCount.push(row);
      }
    }
  }

  return plan;
};

export default planLedgerReconcile;
