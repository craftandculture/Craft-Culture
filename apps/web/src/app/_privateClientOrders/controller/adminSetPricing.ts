import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import {
  orderPricingOverrides,
  privateClientOrderActivityLogs,
  privateClientOrders,
} from '@/database/schema';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import recalculateOrderTotals from '../utils/recalculateOrderTotals';

const percent = z.number().min(0).max(100);

/** Marks an override set by hand, so approval does not replace it with standard rates */
export const MANUAL_PRICING_NOTE = 'Set on the order';

/**
 * Override one order's margins and tax rates, or put it back on standard rates
 *
 * The pricing variables in admin stay the default; this is for the order that
 * needs different figures — a negotiated margin, a duty rate that does not
 * apply. The order keeps its override until it is reset, and its totals are
 * recalculated from the new figures straight away. The figures before the
 * change go into the activity log.
 */
const adminSetPricing = wmsOperatorProcedure
  .input(
    z.discriminatedUnion('mode', [
      z.object({
        mode: z.literal('override'),
        orderId: z.string().uuid(),
        ccMarginPercent: percent,
        importDutyPercent: percent,
        transferCostPercent: percent,
        distributorMarginPercent: percent,
        vatPercent: percent,
      }),
      z.object({ mode: z.literal('standard'), orderId: z.string().uuid() }),
    ]),
  )
  .mutation(async ({ ctx, input }) => {
    const [order] = await db
      .select({ id: privateClientOrders.id })
      .from(privateClientOrders)
      .where(eq(privateClientOrders.id, input.orderId))
      .limit(1);

    if (!order) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Order not found' });
    }

    const [before] = await db
      .select()
      .from(orderPricingOverrides)
      .where(eq(orderPricingOverrides.orderId, input.orderId))
      .limit(1);

    if (input.mode === 'standard') {
      await db
        .delete(orderPricingOverrides)
        .where(eq(orderPricingOverrides.orderId, input.orderId));
    } else {
      const { mode: _mode, orderId, ...variables } = input;

      await db
        .insert(orderPricingOverrides)
        .values({
          orderId,
          ...variables,
          createdBy: ctx.user.id,
          notes: MANUAL_PRICING_NOTE,
        })
        .onConflictDoUpdate({
          target: orderPricingOverrides.orderId,
          set: { ...variables, notes: MANUAL_PRICING_NOTE },
        });
    }

    await recalculateOrderTotals(input.orderId);

    await db.insert(privateClientOrderActivityLogs).values({
      orderId: input.orderId,
      userId: ctx.user.id,
      action: 'pricing_updated',
      notes:
        input.mode === 'standard'
          ? 'Pricing put back on standard rates'
          : `Pricing overridden: C&C ${input.ccMarginPercent}%, duty ${input.importDutyPercent}%, transfer ${input.transferCostPercent}%, distributor ${input.distributorMarginPercent}%, VAT ${input.vatPercent}%`,
      metadata: {
        before: before
          ? {
              ccMarginPercent: before.ccMarginPercent,
              importDutyPercent: before.importDutyPercent,
              transferCostPercent: before.transferCostPercent,
              distributorMarginPercent: before.distributorMarginPercent,
              vatPercent: before.vatPercent,
            }
          : null,
      },
    });

    return { mode: input.mode };
  });

export default adminSetPricing;
