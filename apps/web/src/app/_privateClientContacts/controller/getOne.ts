import { TRPCError } from '@trpc/server';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { privateClientOrders } from '@/database/schema';
import { winePartnerProcedure } from '@/lib/trpc/procedures';

const getOneSchema = z.object({
  id: z.string().uuid(),
});

/**
 * Get a single client contact with order history
 */
const getOne = winePartnerProcedure.input(getOneSchema).query(async ({ input, ctx }) => {
  const { id } = input;
  const { partnerId } = ctx;

  // Get the contact with data isolation
  const contact = await db.query.privateClientContacts.findFirst({
    where: { id, partnerId },
  });

  if (!contact) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Client contact not found',
    });
  }

  // Get recent orders for this client
  const recentOrders = await db
    .select({
      id: privateClientOrders.id,
      orderNumber: privateClientOrders.orderNumber,
      status: privateClientOrders.status,
      caseCount: privateClientOrders.caseCount,
      totalUsd: privateClientOrders.totalUsd,
      createdAt: privateClientOrders.createdAt,
    })
    .from(privateClientOrders)
    .where(
      and(eq(privateClientOrders.partnerId, partnerId), eq(privateClientOrders.clientId, contact.id)),
    )
    .orderBy(desc(privateClientOrders.createdAt))
    .limit(10);

  return {
    ...contact,
    recentOrders,
  };
});

export default getOne;
