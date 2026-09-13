import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { partners } from '@/database/schema';
import { stockOwnerProcedure } from '@/lib/trpc/procedures';

/**
 * Set where a member's wine is delivered
 *
 * Writes to the member's own partner record and nowhere else — the id comes
 * from the session rather than the request, so a member cannot change an
 * address that is not theirs.
 *
 * Only the delivery address is touched. The billing address on the same
 * record is left alone, because a member updating where a case should arrive
 * has not told us anything about where their invoices go.
 */
const memberSaveDeliveryAddress = stockOwnerProcedure
  .input(
    z.object({
      deliveryAddress: z.string().max(500).nullable(),
      deliveryInstructions: z.string().max(500).nullable().optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const trimmed = input.deliveryAddress?.trim();

    await db
      .update(partners)
      .set({
        deliveryAddress: trimmed ? trimmed : null,
        ...(input.deliveryInstructions !== undefined
          ? {
              deliveryInstructions:
                input.deliveryInstructions?.trim() || null,
            }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(partners.id, ctx.partner.id));

    return { saved: true };
  });

export default memberSaveDeliveryAddress;
