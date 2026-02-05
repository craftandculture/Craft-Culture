import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { wmsPartnerRequests } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { resolvePartnerRequestSchema } from '../schemas/ownershipSchema';

/**
 * Resolve a partner request (approve or reject)
 * Admin reviews and takes action on partner requests
 *
 * @example
 *   await trpcClient.wms.admin.ownership.resolve.mutate({
 *     requestId: "uuid",
 *     status: "approved",
 *     adminNotes: "Approved for transfer"
 *   });
 */
const adminResolvePartnerRequest = adminProcedure
  .input(resolvePartnerRequestSchema)
  .mutation(async ({ input, ctx }) => {
    const { requestId, status, adminNotes } = input;

    // Get the request
    const [request] = await db
      .select()
      .from(wmsPartnerRequests)
      .where(eq(wmsPartnerRequests.id, requestId));

    if (!request) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Request not found',
      });
    }

    if (request.status !== 'pending') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Request has already been ${request.status}`,
      });
    }

    // Update the request
    const [updated] = await db
      .update(wmsPartnerRequests)
      .set({
        status,
        adminNotes,
        resolvedBy: ctx.user.id,
        resolvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(wmsPartnerRequests.id, requestId))
      .returning();

    // TODO: If approved, execute the actual operation based on requestType
    // For now, we just mark it as approved and the admin can manually execute
    // In the future, this could automatically:
    // - Transfer stock to another location
    // - Mark stock as for sale
    // - Process withdrawal

    return {
      success: true,
      request: updated,
      message: `Request ${status}`,
    };
  });

export default adminResolvePartnerRequest;
