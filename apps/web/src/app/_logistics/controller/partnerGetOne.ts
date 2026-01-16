import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { logisticsShipments } from '@/database/schema';
import { winePartnerProcedure } from '@/lib/trpc/procedures';

/**
 * Get a single shipment for the current partner
 */
const partnerGetOne = winePartnerProcedure
  .input(z.object({ id: z.string().uuid() }))
  .query(async ({ input, ctx: { partner } }) => {
    const shipment = await db.query.logisticsShipments.findFirst({
      where: and(
        eq(logisticsShipments.id, input.id),
        eq(logisticsShipments.partnerId, partner.id),
      ),
      with: {
        items: true,
        documents: true,
        activityLogs: {
          orderBy: (logs, { desc }) => [desc(logs.createdAt)],
          limit: 20,
        },
      },
    });

    if (!shipment) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Shipment not found',
      });
    }

    return shipment;
  });

export default partnerGetOne;
