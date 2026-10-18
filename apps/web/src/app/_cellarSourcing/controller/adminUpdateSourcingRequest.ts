import { TRPCError } from '@trpc/server';
import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { cellarSourcingRequests, partners } from '@/database/schema';
import { staffAdminProcedure } from '@/lib/trpc/procedures';

import notifySourcingUpdate from '../data/notifySourcingUpdate';

/**
 * The team marks a request as being looked for, or closes it
 *
 * Closing tells the member, with the note if one is given. Only open requests
 * move: an accepted one is being bought and is closed through its Team Tasks
 * job, not here.
 *
 * @example
 *   await trpcClient.cellarSourcing.admin.updateRequest.mutate({ requestId, status: 'searching' });
 */
const adminUpdateSourcingRequest = staffAdminProcedure
  .input(
    z.object({
      requestId: z.string().uuid(),
      status: z.enum(['searching', 'closed']),
      staffNote: z.string().trim().max(1000).optional(),
    }),
  )
  .mutation(async ({ input }) => {
    const [row] = await db
      .update(cellarSourcingRequests)
      .set({
        status: input.status,
        staffNote: input.staffNote || null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(cellarSourcingRequests.id, input.requestId),
          inArray(cellarSourcingRequests.status, [
            'requested',
            'searching',
            'offer_sent',
            'declined',
          ]),
        ),
      )
      .returning();

    if (!row) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'This request has already been accepted, withdrawn or closed.',
      });
    }

    if (input.status === 'closed') {
      const [partner] = await db
        .select({ name: partners.businessName })
        .from(partners)
        .where(eq(partners.id, row.partnerId))
        .limit(1);

      await notifySourcingUpdate({
        event: 'closed',
        requestId: row.id,
        requestNumber: row.requestNumber,
        partnerId: row.partnerId,
        memberName: partner?.name ?? 'Member',
        wineName: row.wineName,
        note: input.staffNote,
      });
    }

    return { requestNumber: row.requestNumber, status: row.status };
  });

export default adminUpdateSourcingRequest;
