import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { cellarMemberships } from '@/database/schema';
import { staffAdminProcedure } from '@/lib/trpc/procedures';

/**
 * Pause, resume or cancel a membership billed by invoice
 *
 * Billed by card, Zoho Billing owns the status and its webhook would undo a
 * change made here, so those memberships are managed in Zoho. Billed by
 * invoice, nothing tells Index a member has stopped paying — this is how the
 * team says so. Paused ('past_due') stops buying, releasing and selling until
 * resumed; the cellar stays visible.
 *
 * @example
 *   await trpcClient.onboarding.admin.setMembershipStatus.mutate({ membershipId, status: 'past_due' });
 */
const adminSetMembershipStatus = staffAdminProcedure
  .input(
    z.object({
      membershipId: z.string().uuid(),
      status: z.enum(['active', 'past_due', 'cancelled']),
    }),
  )
  .mutation(async ({ input }) => {
    const [membership] = await db
      .select()
      .from(cellarMemberships)
      .where(eq(cellarMemberships.id, input.membershipId))
      .limit(1);

    if (!membership) throw new TRPCError({ code: 'NOT_FOUND', message: 'Membership not found' });

    if (membership.zohoSubscriptionId) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'This member pays by card — change their subscription in Zoho Billing.',
      });
    }

    await db
      .update(cellarMemberships)
      .set({
        status: input.status,
        ...(input.status === 'active' && !membership.activatedAt && { activatedAt: new Date() }),
        cancelledAt: input.status === 'cancelled' ? new Date() : null,
      })
      .where(eq(cellarMemberships.id, membership.id));

    return { status: input.status };
  });

export default adminSetMembershipStatus;
