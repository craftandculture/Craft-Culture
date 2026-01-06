import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { sourceRfqs } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import updateRfqSchema from '../schemas/updateRfqSchema';

/**
 * Update a SOURCE RFQ metadata
 *
 * @example
 *   await trpcClient.source.admin.update.mutate({
 *     rfqId: "uuid-here",
 *     name: "Updated Name",
 *     responseDeadline: new Date("2026-02-01")
 *   });
 */
const adminUpdateRfq = adminProcedure
  .input(updateRfqSchema)
  .mutation(async ({ input }) => {
    const { rfqId, ...updateData } = input;

    // Verify RFQ exists
    const [existing] = await db
      .select({ id: sourceRfqs.id })
      .from(sourceRfqs)
      .where(eq(sourceRfqs.id, rfqId));

    if (!existing) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'RFQ not found',
      });
    }

    // Build update object (only include defined values)
    const updates: Record<string, unknown> = {};

    if (updateData.name !== undefined) updates.name = updateData.name;
    if (updateData.description !== undefined)
      updates.description = updateData.description;
    if (updateData.distributorName !== undefined)
      updates.distributorName = updateData.distributorName;
    if (updateData.distributorEmail !== undefined)
      updates.distributorEmail = updateData.distributorEmail || null;
    if (updateData.distributorCompany !== undefined)
      updates.distributorCompany = updateData.distributorCompany;
    if (updateData.distributorNotes !== undefined)
      updates.distributorNotes = updateData.distributorNotes;
    if (updateData.responseDeadline !== undefined)
      updates.responseDeadline = updateData.responseDeadline;

    if (Object.keys(updates).length === 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'No fields to update',
      });
    }

    const [rfq] = await db
      .update(sourceRfqs)
      .set(updates)
      .where(eq(sourceRfqs.id, rfqId))
      .returning();

    return rfq;
  });

export default adminUpdateRfq;
