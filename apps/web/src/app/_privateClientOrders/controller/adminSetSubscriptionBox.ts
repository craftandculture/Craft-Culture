import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { privateClientOrders } from '@/database/schema';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import { SUBSCRIPTION_CASE_SIZES, SUBSCRIPTION_TIERS } from '../constants';

const tierValues = SUBSCRIPTION_TIERS.map((t) => t.value) as [string, ...string[]];

/**
 * Tag an order as a subscription box, or clear the tag
 *
 * A label, not a status: it can be set or changed at any point in the order's
 * life, and it changes nothing about how the order is priced or fulfilled.
 * Tier and case size are required together; the variant is optional.
 */
const adminSetSubscriptionBox = wmsOperatorProcedure
  .input(
    z.object({
      orderId: z.string().uuid(),
      box: z
        .object({
          tier: z.enum(tierValues),
          caseSize: z
            .number()
            .int()
            .refine((n) => (SUBSCRIPTION_CASE_SIZES as readonly number[]).includes(n), {
              message: 'Case size must be 3 or 6',
            }),
          variant: z.string().trim().max(60).optional(),
        })
        .nullable(),
    }),
  )
  .mutation(async ({ input }) => {
    const [order] = await db
      .update(privateClientOrders)
      .set({
        subscriptionTier: input.box?.tier ?? null,
        subscriptionCaseSize: input.box?.caseSize ?? null,
        subscriptionVariant: input.box?.variant || null,
        updatedAt: new Date(),
      })
      .where(eq(privateClientOrders.id, input.orderId))
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
  });

export default adminSetSubscriptionBox;
