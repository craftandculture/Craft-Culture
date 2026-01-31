import { desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { supplierShipmentItems, supplierShipments } from '@/database/schema';
import { supplierProcedure } from '@/lib/trpc/procedures';

const inputSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
  status: z
    .enum(['draft', 'submitted', 'in_transit', 'arrived', 'checked_in', 'issues'])
    .optional(),
});

/**
 * Get supplier inbound shipments list
 *
 * Returns paginated list of shipments from supplier to RAK warehouse,
 * including tracking info and item counts.
 *
 * @example
 *   const shipments = await api.exchange.supplier.shipmentsList.query({
 *     page: 1,
 *     status: 'in_transit',
 *   });
 */
const supplierShipmentsList = supplierProcedure
  .input(inputSchema)
  .query(async ({ ctx, input }) => {
    const { partnerId } = ctx;
    const { page, limit, status } = input;
    const offset = (page - 1) * limit;

    // Get total count
    const countQuery = db
      .select({ count: sql<number>`count(*)::int` })
      .from(supplierShipments)
      .where(eq(supplierShipments.supplierId, partnerId));

    const [countResult] = status
      ? await countQuery.where(eq(supplierShipments.status, status))
      : await countQuery;

    const total = countResult?.count ?? 0;

    // Get shipments with item counts
    const shipments = await db
      .select({
        id: supplierShipments.id,
        reference: supplierShipments.reference,
        status: supplierShipments.status,
        trackingNumber: supplierShipments.trackingNumber,
        carrier: supplierShipments.carrier,
        totalCases: supplierShipments.totalCases,
        estimatedArrival: supplierShipments.estimatedArrival,
        actualArrival: supplierShipments.actualArrival,
        notes: supplierShipments.notes,
        createdAt: supplierShipments.createdAt,
        updatedAt: supplierShipments.updatedAt,
        itemCount: sql<number>`(
          select count(*) from ${supplierShipmentItems}
          where ${supplierShipmentItems.shipmentId} = ${supplierShipments.id}
        )::int`,
      })
      .from(supplierShipments)
      .where(
        status
          ? sql`${supplierShipments.supplierId} = ${partnerId} and ${supplierShipments.status} = ${status}`
          : eq(supplierShipments.supplierId, partnerId),
      )
      .orderBy(desc(supplierShipments.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      items: shipments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  });

export default supplierShipmentsList;
