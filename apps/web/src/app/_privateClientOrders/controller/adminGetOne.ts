import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import {
  partners,
  privateClientContacts,
  privateClientOrderItems,
  privateClientOrders,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Get a single private client order by ID for admin view
 *
 * Returns the full order with all line items and related data.
 * Admins can view any order regardless of partner ownership.
 */
const adminGetOne = adminProcedure
  .input(z.object({ id: z.string().uuid() }))
  .query(async ({ input }) => {
    // Get the order with partner info
    const [orderResult] = await db
      .select({
        order: privateClientOrders,
        partner: {
          id: partners.id,
          businessName: partners.businessName,
          contactEmail: partners.businessEmail,
          logoUrl: partners.logoUrl,
          brandColor: partners.brandColor,
        },
        client: {
          id: privateClientContacts.id,
          name: privateClientContacts.name,
          email: privateClientContacts.email,
          phone: privateClientContacts.phone,
        },
      })
      .from(privateClientOrders)
      .leftJoin(partners, eq(privateClientOrders.partnerId, partners.id))
      .leftJoin(
        privateClientContacts,
        eq(privateClientOrders.clientId, privateClientContacts.id),
      )
      .where(eq(privateClientOrders.id, input.id));

    if (!orderResult) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Order not found',
      });
    }

    // Get all line items for this order
    const items = await db
      .select()
      .from(privateClientOrderItems)
      .where(eq(privateClientOrderItems.orderId, input.id))
      .orderBy(privateClientOrderItems.createdAt);

    // Get distributor info if set
    let distributor = null;
    if (orderResult.order.distributorId) {
      const [distResult] = await db
        .select({
          id: partners.id,
          businessName: partners.businessName,
          logoUrl: partners.logoUrl,
          brandColor: partners.brandColor,
        })
        .from(partners)
        .where(eq(partners.id, orderResult.order.distributorId));
      distributor = distResult ?? null;
    }

    return {
      ...orderResult.order,
      partner: orderResult.partner,
      distributor,
      client: orderResult.client,
      items,
    };
  });

export default adminGetOne;
