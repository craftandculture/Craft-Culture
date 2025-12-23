import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { partners, users } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import createPartnerSchema from '../schemas/createPartnerSchema';

/**
 * Create a new partner profile
 *
 * Admin-only endpoint to create a partner for an existing user
 */
const partnersCreate = adminProcedure
  .input(createPartnerSchema)
  .mutation(async ({ input }) => {
    const {
      userId,
      type,
      businessName,
      businessAddress,
      businessPhone,
      businessEmail,
      taxId,
      commissionRate,
      notes,
    } = input;

    // Verify user exists
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId));

    if (!user) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'User not found',
      });
    }

    // Check if partner already exists for this user
    const [existingPartner] = await db
      .select({ id: partners.id })
      .from(partners)
      .where(eq(partners.userId, userId));

    if (existingPartner) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'Partner profile already exists for this user',
      });
    }

    // Create partner profile
    const [partner] = await db
      .insert(partners)
      .values({
        userId,
        type,
        businessName,
        businessAddress: businessAddress ?? null,
        businessPhone: businessPhone ?? null,
        businessEmail: businessEmail ?? null,
        taxId: taxId ?? null,
        commissionRate,
        notes: notes ?? null,
      })
      .returning();

    // Update user's isRetailPartner flag
    await db
      .update(users)
      .set({ isRetailPartner: true })
      .where(eq(users.id, userId));

    return partner;
  });

export default partnersCreate;
