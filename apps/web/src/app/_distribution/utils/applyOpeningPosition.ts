import type { SaleLayer } from './allocateSale';
import { layerOrder } from './allocateSale';
import scoreWineMatch from './scoreWineMatch';
import wineKey from './wineKey';

export interface OpeningLine {
  docRef: string | null;
  /** City Drinks' code, squashed; null where the tab gave none */
  outletCode: string | null;
  wineName: string;
  leftBottles: number;
}

export interface OpeningPlacement {
  /** Bottles each invoice line held at the opening, for every line on a covered invoice */
  available: Map<string, number>;
  /** Invoices the opening position speaks for */
  coveredDocs: Set<string>;
  /** Rows whose bottles reached no line of ours, with the reason */
  unplaced: (OpeningLine & { reason: string })[];
}

const NAME_MATCH = 0.5;

const keyOfLayer = (layer: SaleLayer) =>
  wineKey(layer.lwin18 ?? layer.productName);

/**
 * Turn the payment run's "bottles left" into what each invoice line held at
 * the opening date
 *
 * The run counts left bottles per invoice line, by City Drinks' code. Each row
 * is found on our side by its invoice and its code's wine, or — where the tab
 * has no code — by its invoice and the closest wine name on it. A wine on two
 * lines of one invoice keeps its left bottles on the lines drawn last, since
 * the run used the others up first.
 *
 * Every line of an invoice the opening speaks for is set, to zero where the run
 * left nothing: a line it lists nothing left on was sold out. Invoices it does
 * not mention (prepaid, outright) are not touched and keep their own count.
 *
 * @example
 *   applyOpeningPosition(layers, [{ docRef: 'INV-000212', outletCode: 'CDR1', wineName: 'Talbot 2019', leftBottles: 4 }], keyOfCode, '2026-09-30');
 *
 * @param layers - Every invoice line of ours at the outlet, each with an id
 * @param opening - The run's rows
 * @param keyOfCode - The wine key a City Drinks code stands for, if known
 * @param openingAt - The date the counts are at (YYYY-MM-DD)
 * @returns Bottles per line at the opening, and the rows that placed nowhere
 */
const applyOpeningPosition = (
  layers: (SaleLayer & { id: string })[],
  opening: OpeningLine[],
  keyOfCode: (code: string) => string | null,
  openingAt: string,
): OpeningPlacement => {
  const coveredDocs = new Set(
    opening.map((row) => row.docRef).filter((ref): ref is string => Boolean(ref)),
  );
  const onCovered = layers.filter(
    (layer) =>
      layer.docRef &&
      coveredDocs.has(layer.docRef) &&
      (layer.docDate ?? '') <= openingAt,
  );

  const available = new Map<string, number>(
    onCovered.map((layer) => [layer.id, 0]),
  );
  const leftByGroup = new Map<string, number>();
  const unplaced: OpeningPlacement['unplaced'] = [];

  for (const row of opening) {
    if (row.leftBottles <= 0) continue;

    if (!row.docRef) {
      unplaced.push({ ...row, reason: 'No invoice number on the row' });
      continue;
    }

    const onDoc = onCovered.filter((layer) => layer.docRef === row.docRef);

    if (onDoc.length === 0) {
      unplaced.push({ ...row, reason: `${row.docRef} has no lines of ours at this outlet` });
      continue;
    }

    let key = row.outletCode ? keyOfCode(row.outletCode) : null;

    if (!key || !onDoc.some((layer) => keyOfLayer(layer) === key)) {
      const best = onDoc
        .map((layer) => ({
          layer,
          score: scoreWineMatch(layer.productName, row.wineName).score,
        }))
        .sort((a, b) => b.score - a.score)[0];

      key = best && best.score >= NAME_MATCH ? keyOfLayer(best.layer) : null;
    }

    if (!key) {
      unplaced.push({
        ...row,
        reason: `No line of ${row.docRef} is this wine`,
      });
      continue;
    }

    const group = `${row.docRef}|${key}`;

    leftByGroup.set(group, (leftByGroup.get(group) ?? 0) + row.leftBottles);
  }

  for (const [group, left] of leftByGroup) {
    const [docRef, key] = group.split('|');
    /* Drawn last keeps its bottles longest */
    const lines = onCovered
      .filter((layer) => layer.docRef === docRef && keyOfLayer(layer) === key)
      .sort(layerOrder)
      .reverse();
    let remaining = left;

    for (const line of lines) {
      const keep = Math.min(line.bottles, remaining);

      available.set(line.id, keep);
      remaining -= keep;
    }

    if (remaining > 0) {
      unplaced.push({
        docRef: docRef ?? null,
        outletCode: null,
        wineName: lines[0]?.productName ?? key ?? '',
        leftBottles: remaining,
        reason: 'More bottles left than the invoice line carried',
      });
    }
  }

  return { available, coveredDocs, unplaced };
};

export default applyOpeningPosition;
