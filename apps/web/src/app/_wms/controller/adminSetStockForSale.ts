import { TRPCError } from '@trpc/server';
import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import { SELLABLE_STATUSES } from '@/app/_consignment/utils/mandateStatuses';
import db from '@/database/client';
import {
  partners,
  saleMandateLots,
  saleMandates,
  wmsStock,
} from '@/database/schema';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

/**
 * Put a received stock line on sale, or hold it for its owner
 *
 * A line held for its owner never reaches a price list or an order, however it
 * is priced or released. Until now the hold could only be cleared on the way
 * in (Logistics) or as part of an ownership transfer, so a line received held
 * and later bought by C&C stayed invisible with no way to fix it on screen.
 *
 * A member's own wine is not cleared here: accepting their sale offer does
 * that, because it also records the price they agreed. Holding a line that a
 * live offer is listed against is refused for the same reason — withdraw the
 * offer instead.
 *
 * @example
 *   await trpcClient.wms.admin.ownership.setForSale.mutate({
 *     stockId: 'uuid',
 *     forSale: true,
 *   });
 */
const adminSetStockForSale = wmsOperatorProcedure
  .input(
    z.object({
      stockId: z.string().uuid(),
      forSale: z.boolean(),
    }),
  )
  .mutation(async ({ input }) => {
    const [stock] = await db
      .select({
        id: wmsStock.id,
        productName: wmsStock.productName,
        ownerName: wmsStock.ownerName,
        ownerType: partners.type,
      })
      .from(wmsStock)
      .leftJoin(partners, eq(partners.id, wmsStock.ownerId))
      .where(eq(wmsStock.id, input.stockId))
      .limit(1);

    if (!stock) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Stock line not found' });
    }

    if (input.forSale && stock.ownerType === 'private_collector') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `${stock.ownerName}'s wine goes on sale through a sale offer. Ask them to offer it, or transfer it to Craft & Culture first.`,
      });
    }

    if (!input.forSale) {
      const [listed] = await db
        .select({ mandateNumber: saleMandates.mandateNumber })
        .from(saleMandateLots)
        .innerJoin(saleMandates, eq(saleMandates.id, saleMandateLots.mandateId))
        .where(
          and(
            eq(saleMandateLots.stockId, input.stockId),
            inArray(saleMandates.status, [...SELLABLE_STATUSES]),
          ),
        )
        .limit(1);

      if (listed) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: `This line is listed under ${listed.mandateNumber}. Withdraw that offer to hold it.`,
        });
      }
    }

    await db
      .update(wmsStock)
      .set({ notForSale: !input.forSale, updatedAt: new Date() })
      .where(eq(wmsStock.id, input.stockId));

    return {
      forSale: input.forSale,
      message: input.forSale
        ? `${stock.productName} is on sale`
        : `${stock.productName} is held for ${stock.ownerName}`,
    };
  });

export default adminSetStockForSale;
