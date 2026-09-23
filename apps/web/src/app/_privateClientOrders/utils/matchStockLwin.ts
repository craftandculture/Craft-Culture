import { client } from '@/database/client';

import saleLwin18Of from './saleLwin18Of';

export interface StockLwinMatch {
  /** The line's code: the held stock's LWIN18 with the line's own pack */
  lwin18: string;
  /** The code of the stock it was matched to */
  stockLwin18: string;
  stockName: string;
  producer: string | null;
}

/**
 * Parse a bottle size as written on an order line into millilitres
 *
 * @example
 *   toMl('750ml'); // 750
 *   toMl('1.5L'); // 1500
 *
 * @param size - "750ml", "75cl", "1.5L" or a bare number of ml
 * @returns Millilitres, or 750 when it cannot be read
 */
const toMl = (size: string | null) => {
  const match = /^\s*([\d.]+)\s*(ml|cl|l)?\s*$/i.exec(size ?? '');
  if (!match) return 750;
  const value = Number(match[1]);
  const unit = (match[2] ?? 'ml').toLowerCase();
  const ml = unit === 'l' ? value * 1000 : unit === 'cl' ? value * 10 : value;
  return Number.isFinite(ml) && ml > 0 ? Math.round(ml) : 750;
};

/**
 * Find the LWIN of the stock an order line will be picked from
 *
 * The warehouse is the one place every wine we hold already carries a code, and
 * the code a line is sold under must be the code it is picked from — anything
 * else is a second Zoho item and a pick that finds nothing. So a line that
 * arrives without a real LWIN (a partner ordering from the local inventory
 * sheet) takes it from stock rather than from a lookup somebody makes by hand.
 *
 * Matched on vintage and bottle size exactly, pack ignored — the line keeps its
 * own pack, as picking does (a bottle sold out of a six). The name is matched by
 * trigram similarity both ways, since the sheet writes "Chateau Potensac, Medoc"
 * where stock says "Chateau Potensac". Only a single clear winner is returned:
 * two wines that both fit is a question for a person, not a guess.
 *
 * @example
 *   await matchStockLwin({ productName: 'Chateau Potensac, Medoc',
 *     vintage: '2021', bottleSize: '750ml', caseConfig: 1 });
 *   // { lwin18: '1014323-2021-01-00750', stockLwin18: '1014323-2021-06-00750', ... }
 *
 * @param line - The order line's name, vintage, bottle size and pack
 * @returns The match, or null when there is none or more than one
 */
const matchStockLwin = async (line: {
  productName: string;
  vintage: string | null;
  bottleSize: string | null;
  caseConfig: number | null;
}) => {
  const vintage = /^\d{4}$/.test(line.vintage ?? '') ? line.vintage! : '0000';
  const size = String(toMl(line.bottleSize)).padStart(5, '0');
  const name = line.productName.toLowerCase();

  const candidates = await client<
    {
      lwin7: string;
      lwin18: string;
      name: string;
      producer: string | null;
      score: number;
    }[]
  >`
    SELECT DISTINCT ON (LEFT(lwin18, 7))
           LEFT(lwin18, 7) AS lwin7,
           lwin18,
           product_name AS name,
           producer,
           GREATEST(
             word_similarity(${name}, LOWER(product_name)),
             word_similarity(LOWER(product_name), ${name})
           )::float8 AS score
    FROM wms_stock
    WHERE lwin18 ~ '^[0-9A-Za-z]+-[0-9]{4}-[0-9]{2}-[0-9]{5}$'
      AND SPLIT_PART(lwin18, '-', 2) = ${vintage}
      AND SPLIT_PART(lwin18, '-', 4) = ${size}
      AND (quantity_cases > 0 OR open_bottles > 0)
    ORDER BY LEFT(lwin18, 7), score DESC, quantity_cases DESC
  `;

  const ranked = candidates
    .filter((row) => row.score >= 0.5)
    .sort((a, b) => b.score - a.score);

  const [best, runnerUp] = ranked;

  /* A close second means the name does not decide it */
  if (!best || (runnerUp && best.score - runnerUp.score < 0.15)) return null;

  return {
    lwin18: saleLwin18Of(best.lwin18, line.caseConfig),
    stockLwin18: best.lwin18,
    stockName: best.name,
    producer: best.producer,
  } satisfies StockLwinMatch;
};

export default matchStockLwin;
