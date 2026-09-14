import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { privateClientContacts } from '@/database/schema';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

/**
 * Mark a client as verified with the distributor network, or withdraw it.
 *
 * This is the flag `ordersAssignDistributor` already reads. When it is set,
 * assigning a distributor skips both verification steps and goes straight to
 * `awaiting_client_payment`; when it is not, the order waits for the partner
 * and then the distributor to confirm the client, which is where orders sit.
 *
 * Until now nothing could set it by hand — it was written only when a
 * distributor completed a verification — so a client everyone already knows
 * still had to go round the loop.
 *
 * Two things worth knowing about the field:
 *
 * - It is stored as `cityDrinksVerifiedAt`, named after the first distributor
 *   to require verification, but it is read as the general gate. A client
 *   verified here is verified for **every** distributor.
 * - Withdrawing it does not move orders that have already passed verification.
 *   It only affects distributor assignments made from here on.
 *
 * @param input - The client, and whether they are verified
 * @returns The updated client
 */
const adminSetVerified = wmsOperatorProcedure
  .input(
    z.object({
      id: z.string().uuid(),
      verified: z.boolean(),
      /** Their account name with the distributor, where it differs. */
      accountName: z.string().optional(),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    const existing = await db.query.privateClientContacts.findFirst({
      where: { id: input.id },
      columns: { id: true, cityDrinksVerifiedAt: true },
    });

    if (!existing) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Client contact not found',
      });
    }

    const [updated] = await db
      .update(privateClientContacts)
      .set({
        // Who and when, not just a boolean — a verification is a person's act
        // and the distributor will ask who made it.
        cityDrinksVerifiedAt: input.verified ? new Date() : null,
        cityDrinksVerifiedBy: input.verified ? ctx.user.id : null,
        ...(input.accountName !== undefined && {
          cityDrinksAccountName: input.accountName || null,
        }),
        updatedAt: new Date(),
      })
      .where(eq(privateClientContacts.id, input.id))
      .returning();

    // The row was read a moment ago, so this cannot normally happen — but
    // returning it as possibly-absent would push the uncertainty into every
    // caller, and a verification that silently did nothing is worth an error.
    if (!updated) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Verification was not saved',
      });
    }

    return updated;
  });

export default adminSetVerified;
