import { TRPCError } from '@trpc/server';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import {
  logisticsDocuments,
  logisticsShipmentActivityLogs,
  logisticsShipmentItems,
  logisticsShipments,
} from '@/database/schema';
import { winePartnerProcedure } from '@/lib/trpc/procedures';

/**
 * Get a single shipment for the current partner
 */
const partnerGetOne = winePartnerProcedure
  .input(z.object({ id: z.string().uuid() }))
  .query(async ({ input, ctx: { partner } }) => {
    // Get the shipment
    const [shipment] = await db
      .select()
      .from(logisticsShipments)
      .where(
        and(
          eq(logisticsShipments.id, input.id),
          eq(logisticsShipments.partnerId, partner.id),
        ),
      );

    if (!shipment) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Shipment not found',
      });
    }

    // Get items
    const items = await db
      .select()
      .from(logisticsShipmentItems)
      .where(eq(logisticsShipmentItems.shipmentId, input.id))
      .orderBy(logisticsShipmentItems.sortOrder);

    // Get documents
    const documents = await db
      .select()
      .from(logisticsDocuments)
      .where(eq(logisticsDocuments.shipmentId, input.id))
      .orderBy(logisticsDocuments.uploadedAt);

    // Get activity logs (limited to 20 most recent)
    const activityLogs = await db
      .select()
      .from(logisticsShipmentActivityLogs)
      .where(eq(logisticsShipmentActivityLogs.shipmentId, input.id))
      .orderBy(desc(logisticsShipmentActivityLogs.createdAt))
      .limit(20);

    return {
      ...shipment,
      items,
      documents,
      activityLogs,
    };
  });

export default partnerGetOne;
