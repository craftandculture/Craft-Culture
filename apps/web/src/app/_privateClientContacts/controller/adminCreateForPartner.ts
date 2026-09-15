import { TRPCError } from '@trpc/server';
import { and, eq, ilike } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { privateClientContacts } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Add a client to a partner's book, optionally already verified
 *
 * `create` reads the partner from the session, so an admin — who belongs to
 * none — could not use it. The only way a client reached the database was as a
 * side effect of submitting an order, which meant no record until the order was
 * placed, and never a verified one.
 *
 * Verification is the distributor's word that this person may be sold to, so it
 * is recorded with who set it and when, exactly as the verification screen
 * does. An admin ticking it here is saying they have that word.
 */
const adminCreateForPartner = adminProcedure
  .input(
    z.object({
      partnerId: z.string().uuid(),
      name: z.string().min(1, 'Name is required'),
      email: z.string().email().optional().or(z.literal('')),
      phone: z.string().optional(),
      addressLine1: z.string().optional(),
      city: z.string().optional(),
      notes: z.string().optional(),
      /** Tick when the distributor has already cleared them */
      verified: z.boolean().default(false),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    const name = input.name.trim();

    // The same person under two spellings is the problem this screen exists to
    // stop, so an exact name already on that partner's book is refused rather
    // than quietly added beside it.
    const [clash] = await db
      .select({ id: privateClientContacts.id })
      .from(privateClientContacts)
      .where(
        and(
          eq(privateClientContacts.partnerId, input.partnerId),
          ilike(privateClientContacts.name, name),
        ),
      )
      .limit(1);

    if (clash) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: `${name} is already a client of that partner — search for them rather than adding a second record`,
      });
    }

    const [created] = await db
      .insert(privateClientContacts)
      .values({
        partnerId: input.partnerId,
        name,
        email: input.email || null,
        phone: input.phone || null,
        addressLine1: input.addressLine1 || null,
        city: input.city || null,
        notes: input.notes || null,
        cityDrinksVerifiedAt: input.verified ? new Date() : null,
        cityDrinksVerifiedBy: input.verified ? ctx.user.id : null,
      })
      .returning({
        id: privateClientContacts.id,
        name: privateClientContacts.name,
      });

    if (!created) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Could not create that client',
      });
    }

    return { ...created, verified: input.verified };
  });

export default adminCreateForPartner;
