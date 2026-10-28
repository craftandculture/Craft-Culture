import { and, desc, eq, ilike, inArray, isNull, notInArray, or, sql } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import type { PrivateClientOrder } from '@/database/schema';
import { privateClientContacts, privateClientOrders } from '@/database/schema';
import { distributorProcedure } from '@/lib/trpc/procedures';

import {
  DISTRIBUTOR_QUEUES,
  DISTRIBUTOR_SKU_LOCKED_STATUSES,
  DISTRIBUTOR_STAGES,
  DISTRIBUTOR_VISIBLE_STATUSES,
} from '../constants';
import getOrdersSchema from '../schemas/getOrdersSchema';
import distributorOrderView from '../utils/distributorOrderView';
import distributorPartnerView from '../utils/distributorPartnerView';
import getCraftCulturePartnerId from '../utils/getCraftCulturePartnerId';

const distributorGetOrdersSchema = getOrdersSchema.extend({
  /** A pipeline stage: a group of statuses (see DISTRIBUTOR_STAGES) */
  stage: z.enum(['verification', 'payment', 'inbound', 'delivery', 'delivered']).optional(),
  /** A task waiting on the distributor (see DISTRIBUTOR_QUEUES) */
  queue: z.enum(['verify', 'clientPayment', 'payCc', 'receive', 'deliver']).optional(),
  /** Orders with no change in 7 days */
  idle: z.boolean().optional(),
  /** Orders still waiting for this distributor's bundle SKU */
  skuMissing: z.boolean().optional(),
});

/**
 * Get list of private client orders assigned to the current distributor
 *
 * Results are filtered by distributorId (data isolation) and support
 * pagination, search, and status filters.
 */
const distributorGetMany = distributorProcedure
  .input(distributorGetOrdersSchema)
  .query(async ({ input, ctx: { partnerId, partner } }) => {
    const { limit, cursor, search, status, stage, queue, idle, skuMissing } = input;

    // Always this distributor's orders, and only once C&C has approved them
    const conditions = [
      eq(privateClientOrders.distributorId, partnerId),
      inArray(privateClientOrders.status, [...DISTRIBUTOR_VISIBLE_STATUSES]),
    ];

    if (status) {
      conditions.push(eq(privateClientOrders.status, status));
    }

    // Stage and queue filter server-side, so a dashboard count and the list
    // it opens are the same orders — not just those on the first page.
    if (stage) {
      conditions.push(inArray(privateClientOrders.status, [...DISTRIBUTOR_STAGES[stage]]));
    }

    if (queue) {
      conditions.push(
        inArray(privateClientOrders.status, [...DISTRIBUTOR_QUEUES[queue].statuses]),
      );
    }

    if (idle) {
      conditions.push(sql`${privateClientOrders.updatedAt} < now() - interval '7 days'`);
    }

    if (skuMissing && partner.requiresOrderSku) {
      conditions.push(
        isNull(privateClientOrders.distributorSku),
        notInArray(
          privateClientOrders.status,
          DISTRIBUTOR_SKU_LOCKED_STATUSES as PrivateClientOrder['status'][],
        ),
      );
    }

    if (search) {
      conditions.push(
        or(
          ilike(privateClientOrders.orderNumber, `%${search}%`),
          ilike(privateClientOrders.clientName, `%${search}%`),
          ilike(privateClientOrders.clientPhone, `%${search}%`),
        )!,
      );
    }

    // Get total count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(privateClientOrders)
      .where(and(...conditions));

    const totalCount = Number(countResult?.count ?? 0);

    // Get orders with partner and client info
    const ordersList = await db
      .select({
        order: privateClientOrders,
        // Bottles, not the stored case count, which adds singles to cases
        bottleCount: sql<number>`(
          SELECT coalesce(sum(i.quantity * coalesce(i.case_config, 1)), 0)::int
            FROM private_client_order_items i
           WHERE i.order_id = ${privateClientOrders.id}
        )`,
        client: {
          id: privateClientContacts.id,
          cityDrinksVerifiedAt: privateClientContacts.cityDrinksVerifiedAt,
        },
      })
      .from(privateClientOrders)
      .leftJoin(privateClientContacts, eq(privateClientOrders.clientId, privateClientContacts.id))
      .where(and(...conditions))
      .orderBy(desc(privateClientOrders.createdAt))
      .limit(limit)
      .offset(cursor);

    // The wine partner is never named to the distributor
    const craftCulturePartnerId = await getCraftCulturePartnerId();

    // Flatten the response
    const ordersWithPartner = ordersList.map((row) => ({
      ...distributorOrderView(row.order),
      bottleCount: Number(row.bottleCount ?? 0),
      partner: distributorPartnerView(row.order.partnerId, craftCulturePartnerId),
      client: row.client,
    }));

    const nextCursor = cursor + limit < totalCount ? cursor + limit : null;

    return {
      data: ordersWithPartner,
      meta: {
        totalCount,
        nextCursor,
        hasMore: nextCursor !== null,
        // Whether this distributor records a bundle SKU on each order
        requiresOrderSku: partner.requiresOrderSku,
      },
    };
  });

export default distributorGetMany;
