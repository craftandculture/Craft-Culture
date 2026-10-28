import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { cellarMemberships } from '@/database/schema';
import { staffAdminProcedure } from '@/lib/trpc/procedures';

import notifyMembershipChange from '../data/notifyMembershipChange';

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
        message: 'This member pays by card. Change their subscription in Zoho Billing.',
      });
    }

    /*
      A membership that never started is started by the member, which is what
      opens the invoice job. Resuming it here would make it active with nobody
      asked to bill it.
    */
    if (input.status === 'active' && membership.status === 'not_activated') {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message:
          'This membership has not started yet. The member starts it from their cellar, which also opens the invoice job.',
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

    if (input.status === 'past_due' && membership.status === 'active') {
      await notifyMembershipChange(membership.partnerId, 'paused');
    }

    if (input.status === 'active' && membership.status === 'past_due') {
      await notifyMembershipChange(membership.partnerId, 'resumed');
    }

    return { status: input.status };
  });

export default adminSetMembershipStatus;
