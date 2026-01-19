import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { partners } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import updatePartnerSchema from '../schemas/updatePartnerSchema';

/**
 * Update a partner profile
 *
 * Admin-only endpoint for managing partner details
 */
const partnersUpdate = adminProcedure
  .input(updatePartnerSchema)
  .mutation(async ({ input }) => {
    const { partnerId, ...updateData } = input;

    // Check if partner exists
    const [existingPartner] = await db
      .select({ id: partners.id })
      .from(partners)
      .where(eq(partners.id, partnerId));

    if (!existingPartner) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Partner not found',
      });
    }

    // Build update object with only provided fields
    const updates: Partial<typeof partners.$inferInsert> = {};

    if (updateData.type !== undefined) updates.type = updateData.type;
    if (updateData.status !== undefined) updates.status = updateData.status;
    if (updateData.businessName !== undefined)
      updates.businessName = updateData.businessName;
    if (updateData.businessAddress !== undefined)
      updates.businessAddress = updateData.businessAddress;
    if (updateData.businessPhone !== undefined)
      updates.businessPhone = updateData.businessPhone;
    if (updateData.businessEmail !== undefined)
      updates.businessEmail = updateData.businessEmail || null;
    if (updateData.taxId !== undefined) updates.taxId = updateData.taxId;
    if (updateData.commissionRate !== undefined)
      updates.commissionRate = updateData.commissionRate;
    if (updateData.notes !== undefined) updates.notes = updateData.notes;
    if (updateData.logoUrl !== undefined)
      updates.logoUrl = updateData.logoUrl || null;
    if (updateData.paymentDetails !== undefined)
      updates.paymentDetails = updateData.paymentDetails;
    if (updateData.logisticsCostPerCase !== undefined)
      updates.logisticsCostPerCase = updateData.logisticsCostPerCase;
    if (updateData.pcoDutyRate !== undefined)
      updates.pcoDutyRate = updateData.pcoDutyRate;
    if (updateData.pcoVatRate !== undefined)
      updates.pcoVatRate = updateData.pcoVatRate;
    if (updateData.financeEmail !== undefined)
      updates.financeEmail = updateData.financeEmail || null;

    if (Object.keys(updates).length === 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'No fields to update',
      });
    }

    const [updatedPartner] = await db
      .update(partners)
      .set(updates)
      .where(eq(partners.id, partnerId))
      .returning();

    return updatedPartner;
  });

export default partnersUpdate;
