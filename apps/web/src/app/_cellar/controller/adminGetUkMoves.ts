import { inArray } from 'drizzle-orm';

import db from '@/database/client';
import { logisticsShipments } from '@/database/schema';
import { staffAdminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import getUkMoves from '../data/getUkMoves';

/**
 * Every member's requests to bring UK wine to the UAE, for the team
 *
 * Itemised, with the shipment each accepted move travels on, and the open
 * inbound shipments one can be linked to instead of creating a new one.
 * Never throws: a missing table shows an empty queue.
 *
 * @example
 *   const { moves, shipments } = await trpcClient.cellar.admin.getUkMoves.query();
 */
const adminGetUkMoves = staffAdminProcedure.query(async () => {
  try {
    const [moves, shipments] = await Promise.all([
      getUkMoves(),
      db
        .select({
          id: logisticsShipments.id,
          shipmentNumber: logisticsShipments.shipmentNumber,
          name: logisticsShipments.name,
          status: logisticsShipments.status,
          originCountry: logisticsShipments.originCountry,
        })
        .from(logisticsShipments)
        .where(
          inArray(logisticsShipments.status, [
            'draft',
            'booked',
            'picked_up',
            'in_transit',
          ]),
        )
        .orderBy(logisticsShipments.shipmentNumber),
    ]);

    return { moves, shipments };
  } catch (error) {
    logger.error('Could not read UK moves', { error });
    return { moves: [], shipments: [] };
  }
});

export default adminGetUkMoves;
