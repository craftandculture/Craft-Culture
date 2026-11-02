import type { OwnerCostRow } from './parseCruratedReconSheet';
import scoreWineMatch from './scoreWineMatch';
import wineKey from './wineKey';

export interface CostCandidate {
  lwin18: string | null;
  productName: string;
}

export interface MatchedCostRow extends OwnerCostRow {
  wineKey: string | null;
  lwin18: string | null;
  matchedBy: string | null;
}

/** A name this close, with nothing else as close, is the same wine */
const ENOUGH = 0.6;
const CLEAR_OF_NEXT = 0.1;

const VINTAGE = /\b(19|20)\d{2}\b/;

/**
 * Tie a partner's price-sheet rows to the wines we invoiced for them
 *
 * By code where the sheet has one (Crurated's W codes, through the warehouse
 * and the triangulation register), otherwise by name and vintage against the
 * owner's own invoice lines. A name match must be clear of the next best:
 * Elio Grasso's Ginestra Casa Mate and Gavarini Chiniera share a producer,
 * appellation and vintage, and a near tie between them is reported, not
 * guessed.
 *
 * @example
 *   matchCostRows(rows, candidates, new Map([['W11600324', '1160032-2022-06-00750']]));
 *
 * @param rows - The sheet's rows
 * @param candidates - The owner's invoice lines at the outlet
 * @param lwinByWCode - W code (upper case) to LWIN18
 * @returns Each row with the wine it prices, or null where none is clear
 */
const matchCostRows = (
  rows: OwnerCostRow[],
  candidates: CostCandidate[],
  lwinByWCode: ReadonlyMap<string, string>,
) =>
  rows.map((row): MatchedCostRow => {
    const byCode = row.wCode ? lwinByWCode.get(row.wCode.toUpperCase()) : undefined;

    if (byCode) {
      return {
        ...row,
        wineKey: wineKey(byCode),
        lwin18: byCode,
        matchedBy: `code ${row.wCode}`,
      };
    }

    const named =
      row.vintage && !VINTAGE.test(row.productName)
        ? `${row.productName} ${row.vintage}`
        : row.productName;

    const scored = candidates
      .filter((candidate) => candidate.lwin18)
      .map((candidate) => ({
        candidate,
        score: scoreWineMatch(candidate.productName, named).score,
      }))
      .filter((hit) => hit.score >= ENOUGH)
      .sort((a, b) => b.score - a.score);

    const best = scored[0];
    const rival = scored.find(
      (hit) =>
        hit !== best &&
        wineKey(hit.candidate.lwin18) !== wineKey(best?.candidate.lwin18),
    );

    if (!best || (rival && best.score - rival.score < CLEAR_OF_NEXT)) {
      return { ...row, wineKey: null, lwin18: null, matchedBy: null };
    }

    return {
      ...row,
      wineKey: wineKey(best.candidate.lwin18),
      lwin18: best.candidate.lwin18,
      matchedBy: `name: ${best.candidate.productName}`,
    };
  });

export default matchCostRows;
