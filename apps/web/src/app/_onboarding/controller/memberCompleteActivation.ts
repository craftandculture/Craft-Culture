import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { cellarMemberships } from '@/database/schema';
import { cellarHolderProcedure } from '@/lib/trpc/procedures';
import { getHostedPage } from '@/lib/zoho/billing';

import applyZohoSubscription from '../data/applyZohoSubscription';

/**
 * Confirm the membership after Zoho's payment page returns
 *
 * The hosted page id in the address is not trusted on its own: it must be
 * the one this member's activation opened, and Zoho is asked what it
 * produced. A page that has not completed leaves the status as it was.
 */
const memberCompleteActivation = cellarHolderProcedure
  .input(z.object({ hostedPageId: z.string().max(100) }))
  .mutation(async ({ ctx, input }) => {
    const [membership] = await db
      .select()
      .from(cellarMemberships)
      .where(eq(cellarMemberships.partnerId, ctx.partner.id))
      .limit(1);

    if (!membership) return { status: 'active' as const };
    if (membership.status === 'active') return { status: membership.status };

    if (membership.zohoHostedPageId !== input.hostedPageId) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'That payment page does not belong to your cellar.' });
    }

    const page = await getHostedPage(input.hostedPageId);
    if (!page.subscription) return { status: membership.status };

    const status = await applyZohoSubscription(membership.id, page.subscription);

    return { status };
  });

export default memberCompleteActivation;
