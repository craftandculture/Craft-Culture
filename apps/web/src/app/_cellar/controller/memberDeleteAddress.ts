import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { cellarDeliveryAddresses } from '@/database/schema';
import { stockOwnerProcedure } from '@/lib/trpc/procedures';

/**
 * Remove a saved delivery address
 *
 * The default cannot be removed: another address has to be made the default
 * first, otherwise the member's record would keep pointing at a place they
 * have just said they no longer use. Deliveries already requested keep the
 * address they were sent with — each request holds its own copy.
 */
const memberDeleteAddress = stockOwnerProcedure
  .input(z.object({ id: z.string().uuid() }))
  .mutation(async ({ ctx, input }) => {
    const [address] = await db
      .select({ isDefault: cellarDeliveryAddresses.isDefault })
      .from(cellarDeliveryAddresses)
      .where(
        and(
          eq(cellarDeliveryAddresses.id, input.id),
          eq(cellarDeliveryAddresses.partnerId, ctx.partner.id),
        ),
      )
      .limit(1);

    if (!address) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'That address is not one of yours.',
      });
    }

    if (address.isDefault) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message:
          'This is your main address. Make another one your main address first.',
      });
    }

    await db
      .delete(cellarDeliveryAddresses)
      .where(
        and(
          eq(cellarDeliveryAddresses.id, input.id),
          eq(cellarDeliveryAddresses.partnerId, ctx.partner.id),
          eq(cellarDeliveryAddresses.isDefault, false),
        ),
      );

    return { removed: true };
  });

export default memberDeleteAddress;
