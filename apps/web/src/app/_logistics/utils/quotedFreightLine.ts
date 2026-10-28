import { and, eq } from 'drizzle-orm';

import db from '@/database/client';
import { logisticsShipmentCostLines } from '@/database/schema';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** What an accepted quote's freight line is stamped with on the ledger */
export const QUOTED_FREIGHT_SOURCE = 'Accepted freight quote';

/**
 * Remove a shipment's accepted-quote freight line once real freight lands
 *
 * Accepting a quote books its total as freight so the shipment has a cost
 * before the forwarder bills. When the invoice arrives its freight is booked as
 * well, and the ledger sums every line — so the same freight was counted twice
 * in the freight figure and in every bottle's landed cost. The quote was only
 * ever standing in for the invoice, so the invoice replaces it.
 *
 * Call in the same write that adds the real freight line, so there is never a
 * moment where both count.
 *
 * @param shipmentId - The shipment receiving real freight
 * @param conn - A transaction to run inside, or the database
 * @returns How many quote lines were removed
 */
const supersedeQuotedFreight = async (
  shipmentId: string,
  conn: Tx | typeof db = db,
) => {
  const removed = await conn
    .delete(logisticsShipmentCostLines)
    .where(
      and(
        eq(logisticsShipmentCostLines.shipmentId, shipmentId),
        eq(logisticsShipmentCostLines.category, 'freight'),
        eq(logisticsShipmentCostLines.sourceDocument, QUOTED_FREIGHT_SOURCE),
      ),
    )
    .returning({ id: logisticsShipmentCostLines.id });

  return removed.length;
};

export default supersedeQuotedFreight;
