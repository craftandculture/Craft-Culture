import getCatalogueInboundRows from '@/app/_wms/data/getCatalogueInboundRows';
import getCatalogueRows from '@/app/_wms/data/getCatalogueRows';
import { adminProcedure } from '@/lib/trpc/procedures';

import { selectableLinesSchema } from '../schemas/salesQuoteSchemas';

/**
 * Lines a quote can be built from.
 *
 * Deliberately reuses the catalogue data layer that backs /price-list-beta, so
 * a quote is priced from the same numbers the client sees on the price list —
 * In Bond per bottle for trade, with the private-client price alongside for
 * reference. No pricing maths is duplicated here.
 */
const adminGetSelectableLines = adminProcedure
  .input(selectableLinesSchema)
  .query(async ({ input }) => {
    const { search, category, ownerId, stock } = input;

    // the inbound feed has no owner dimension — shipments are not split by owner
    const rows =
      stock === 'inbound'
        ? await getCatalogueInboundRows({ search, category })
        : await getCatalogueRows({ search, category, ownerId });

    return rows
      .filter((row) => row.availableBottles > 0)
      .map((row) => ({ ...row, inbound: stock === 'inbound' }));
  });

export default adminGetSelectableLines;
