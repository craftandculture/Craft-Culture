import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import type { z } from 'zod';

import db from '@/database/client';
import { privateClientOrders } from '@/database/schema';

import type subscriptionBoxSchema from '../schemas/subscriptionBoxSchema';

/**
 * Tag an order as a subscription box, or clear the tag
 *
 * A label, not a status: it can be set or changed at any point in the order's
 * life, and it changes nothing about how the order is priced or fulfilled.
 *
 * @param input - The order and its box (null to clear)
 * @param scope - A partner id limits this to that partner's orders
 * @returns The order's saved box fields
 */
const setSubscriptionBox = async (
  input: z.infer<typeof subscriptionBoxSchema>,
  scope: { partnerId?: string } = {},
) => {
  const [order] = await db
    .update(privateClientOrders)
    .set({
      subscriptionTier: input.box?.tier ?? null,
      subscriptionCaseSize: input.box?.caseSize ?? null,
      subscriptionVariant: input.box?.variant || null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(privateClientOrders.id, input.orderId),
        scope.partnerId ? eq(privateClientOrders.partnerId, scope.partnerId) : undefined,
      ),
    )
    .returning({
      id: privateClientOrders.id,
      subscriptionTier: privateClientOrders.subscriptionTier,
      subscriptionCaseSize: privateClientOrders.subscriptionCaseSize,
      subscriptionVariant: privateClientOrders.subscriptionVariant,
    });

  if (!order) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Order not found' });
  }

  return order;
};

export default setSubscriptionBox;
