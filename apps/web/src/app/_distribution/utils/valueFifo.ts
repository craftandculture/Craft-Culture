export interface OutLayer {
  /** When we invoiced it out — layers are consumed oldest first */
  docDate: string | null;
  /** Breaks ties on the same date, so the answer never depends on row order */
  docRef: string | null;
  bottles: number;
  /** What we billed the outlet, per bottle */
  pricePerBottle: number;
  currency: string | null;
}

export interface FifoResult {
  /** Bottles actually valued — less than asked for when the layers run out */
  bottles: number;
  value: number;
  /** Bottles that sold with no layer left to draw from */
  shortBottles: number;
  currency: string | null;
  /** Which invoices the value came from, for the drill-down */
  drawnFrom: { docRef: string | null; bottles: number; value: number }[];
}

/**
 * Value bottles sold against the invoices that put them there, oldest first
 *
 * Sophie specified first-in-first-out and nothing has ever implemented it. It
 * matters because our price for a wine moves between shipments: valuing this
 * month's sales at the latest price would overstate a month that actually sold
 * older, cheaper stock, and the owner would be billed for the difference.
 *
 * Layers are ordered by document date and then by reference, so two invoices
 * raised on one day cannot value the same month differently between runs. That
 * non-determinism is the exact fault an unordered `LIMIT 1` produced elsewhere
 * in this codebase.
 *
 * Running short is reported rather than absorbed. More sold than we ever sent
 * means a missing invoice, a wrong pack, or wine the outlet got another way —
 * all worth knowing, and none worth valuing at a price we invented.
 *
 * @param layers - What we invoiced out, in any order
 * @param bottlesSold - Bottles to value
 * @param alreadyConsumed - Bottles drawn from these layers by earlier months
 * @returns The value, what it was drawn from, and any shortfall
 */
const valueFifo = (
  layers: OutLayer[],
  bottlesSold: number,
  alreadyConsumed = 0,
): FifoResult => {
  const ordered = [...layers].sort((a, b) => {
    const byDate = (a.docDate ?? '').localeCompare(b.docDate ?? '');

    if (byDate !== 0) return byDate;

    return (a.docRef ?? '').localeCompare(b.docRef ?? '');
  });

  let toSkip = alreadyConsumed;
  let remaining = bottlesSold;
  let value = 0;
  let bottles = 0;
  const drawnFrom: FifoResult['drawnFrom'] = [];

  for (const layer of ordered) {
    if (remaining <= 0) break;

    let available = layer.bottles;

    // Months already settled have eaten into the oldest layers first
    if (toSkip > 0) {
      const skipped = Math.min(toSkip, available);

      toSkip -= skipped;
      available -= skipped;
    }

    if (available <= 0) continue;

    const take = Math.min(available, remaining);
    const drawn = take * layer.pricePerBottle;

    value += drawn;
    bottles += take;
    remaining -= take;
    drawnFrom.push({ docRef: layer.docRef, bottles: take, value: drawn });
  }

  return {
    bottles,
    value,
    shortBottles: remaining,
    /*
      Only one currency is reported, and only when every layer drawn from
      agrees. Two currencies added together make a number that looks like money
      and is not.
    */
    currency:
      ordered.length > 0 &&
      ordered.every((layer) => layer.currency === ordered[0]!.currency)
        ? (ordered[0]!.currency ?? null)
        : null,
    drawnFrom,
  };
};

export default valueFifo;
