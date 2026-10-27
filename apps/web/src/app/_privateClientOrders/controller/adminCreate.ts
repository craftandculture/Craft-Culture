import { sql } from 'drizzle-orm';
import { z } from 'zod';

import resolveOrderPartnerId from '@/app/_partners/data/resolveOrderPartnerId';
import findOrCreateClientForPartner from '@/app/_privateClientContacts/utils/findOrCreateClientForPartner';
import db from '@/database/client';
import { privateClientOrders } from '@/database/schema';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';


import generateOrderNumber from '../utils/generateOrderNumber';

/**
 * Admin create a new private client order
 *
 * Admins can create orders, optionally on behalf of a partner.
 */
const adminCreate = wmsOperatorProcedure
  .input(
    z.object({
      partnerId: z.string().uuid({ message: 'Partner is required' }),
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
    // A Private Cellar member's order is raised under C&C, not under the member
    const partnerId = await resolveOrderPartnerId(input.partnerId);

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

    /*
      Keep the client, exactly as the partner-side create does. An admin can
      type the details straight in too, and an order without a client record
      cannot be corrected or marked verified afterwards.
    */
    // A client picked from the member's own list belongs to them, not to C&C
    let clientId = partnerId === input.partnerId ? (input.clientId ?? null) : null;

    if (!clientId && input.clientName?.trim()) {
      const resolved = await findOrCreateClientForPartner(partnerId, {
        name: input.clientName,
        email: input.clientEmail,
        phone: input.clientPhone,
        address: input.clientAddress,
      });
      clientId = resolved?.clientId ?? null;
    }

    const orderNumber = generateOrderNumber(nextSequence);

    // Create the order
    const [order] = await db
      .insert(privateClientOrders)
      .values({
        orderNumber,
        partnerId,
        clientId,
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
