import { and, desc, eq } from 'drizzle-orm';

import db from '@/database/client';
import { logisticsShipments } from '@/database/schema';
import { winePartnerProcedure } from '@/lib/trpc/procedures';

/**
 * Get shipments for the current partner
 */
const partnerGetMany = winePartnerProcedure.query(async ({ ctx: { partner } }) => {
  const shipments = await db.query.logisticsShipments.findMany({
    where: and(
      eq(logisticsShipments.partnerId, partner.id),
    ),
    orderBy: [desc(logisticsShipments.createdAt)],
    with: {
      items: true,
    },
  });

  return shipments;
});

export default partnerGetMany;
