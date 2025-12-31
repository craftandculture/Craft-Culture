import { sql } from 'drizzle-orm';

import db from '@/database/client';
import { privateClientOrders } from '@/database/schema';
import { winePartnerProcedure } from '@/lib/trpc/procedures';

import createOrderSchema from '../schemas/createOrderSchema';
import generateOrderNumber from '../utils/generateOrderNumber';

/**
 * Create a new private client order
 *
 * Only wine partners can create orders. The order is created in 'draft' status.
 */
const ordersCreate = winePartnerProcedure
  .input(createOrderSchema)
  .mutation(async ({ input, ctx: { partnerId } }) => {
    // Get the next sequence number for this year
    const year = new Date().getFullYear();
    const yearStart = `PCO-${year}-`;

    const [lastOrder] = await db
      .select({ orderNumber: privateClientOrders.orderNumber })
      .from(privateClientOrders)
      .where(sql`${privateClientOrders.orderNumber} LIKE ${yearStart + '%'}`)
      .orderBy(sql`${privateClientOrders.orderNumber} DESC`)
      .limit(1);

    let nextSequence = 1;
    if (lastOrder?.orderNumber) {
      const lastSequence = parseInt(lastOrder.orderNumber.split('-')[2] ?? '0', 10);
      nextSequence = lastSequence + 1;
    }

    const orderNumber = generateOrderNumber(nextSequence);

    // Create the order
    const [order] = await db
      .insert(privateClientOrders)
      .values({
        orderNumber,
        partnerId,
        clientId: input.clientId,
        clientName: input.clientName,
        clientEmail: input.clientEmail || null,
        clientPhone: input.clientPhone || null,
        clientAddress: input.clientAddress || null,
        deliveryNotes: input.deliveryNotes || null,
        partnerNotes: input.partnerNotes || null,
        status: 'draft',
      })
      .returning();

    return order;
  });

export default ordersCreate;
