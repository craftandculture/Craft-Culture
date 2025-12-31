import { sql } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { privateClientOrders } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import generateOrderNumber from '../utils/generateOrderNumber';

/**
 * Admin create a new private client order
 *
 * Admins can create orders, optionally on behalf of a partner.
 */
const adminCreate = adminProcedure
  .input(
    z.object({
      partnerId: z.string().uuid().optional(),
      clientId: z.string().uuid().optional(),
      clientName: z.string().min(1, 'Client name is required'),
      clientEmail: z.string().email().optional().or(z.literal('')),
      clientPhone: z.string().optional(),
      clientAddress: z.string().optional(),
      deliveryNotes: z.string().optional(),
      partnerNotes: z.string().optional(),
    }),
  )
  .mutation(async ({ input }) => {
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
        partnerId: input.partnerId || null,
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

export default adminCreate;
