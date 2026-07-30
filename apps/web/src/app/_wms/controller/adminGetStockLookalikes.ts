import db from '@/database/client';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import findStockLookalikes from '../utils/findStockLookalikes';

/**
 * List confusingly-similar wines currently in stock (different wines, same
 * vintage, near-identical names) — the picking-error trap. Powers the pick-screen
 * warning, the Stock Explorer lookalike badge/filter, and a dashboard count.
 *
 * @example
 *   await trpcClient.wms.admin.stock.lookalikes.query();
 */
const adminGetStockLookalikes = wmsOperatorProcedure.query(async () => {
  const { byLwin18, pairs } = await findStockLookalikes(db);

  // De-duplicate pairs (a↔b and b↔a) for the flat list shown on the audit view.
  const seen = new Set<string>();
  const uniquePairs = pairs.filter((p) => {
    const key = [p.a.lwin18, p.b.lwin18].sort().join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    byLwin18,
    pairs: uniquePairs,
    count: uniquePairs.length,
    affectedLwin18s: Object.keys(byLwin18),
  };
});

export default adminGetStockLookalikes;
