import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { cellarMemberships } from '@/database/schema';
import { stockOwnerProcedure } from '@/lib/trpc/procedures';
import { createSubscriptionHostedPage, findOrCreateBillingCustomer, isBillingConfigured } from '@/lib/zoho/billing';
import serverConfig from '@/server.config';

import getActivationState from '../data/getActivationState';

/**
 * Open Zoho's payment page to start the membership
 *
 * The ID must be on file first — it is the cheaper step to fix and the one
 * we cannot do for them. The page returns to /platform/cellar/activated,
 * which confirms the subscription and sends the member back to what they
 * were doing.
 */
const memberStartActivation = stockOwnerProcedure
  .input(
    z.object({
      /** The action that prompted activation, kept for the record */
      action: z.enum(['purchase', 'release', 'offer_for_sale', 'transfer_in', 'other']),
      /** Where to return the member afterwards, within the cellar */
      returnTo: z
        .string()
        .max(300)
        .regex(/^\/platform\/cellar[\w\-/?=&%.]*$/)
        .default('/platform/cellar'),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const state = await getActivationState(ctx.partner.id);

    if (!state.isGated || !state.membership) return { url: null, alreadyActive: true };
    if (state.missing.includes('identity')) {
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Please add your Emirates ID first.' });
    }
    if (!state.missing.includes('payment')) return { url: null, alreadyActive: true };

    if (!isBillingConfigured()) {
      throw new TRPCError({
        code: 'SERVICE_UNAVAILABLE',
        message: 'Card payments are not switched on yet. Please contact us and we will activate your cellar.',
      });
    }

    const customerId =
      state.membership.zohoCustomerId ??
      (await findOrCreateBillingCustomer({
        email: ctx.user.email,
        name: ctx.partner.businessName,
        phone: ctx.partner.businessPhone,
      }));

    const redirectUrl = `${serverConfig.appUrl}/platform/cellar/activated?return=${encodeURIComponent(input.returnTo)}`;
    const page = await createSubscriptionHostedPage({
      customerId,
      redirectUrl,
      referenceId: state.membership.id,
    });

    await db
      .update(cellarMemberships)
      .set({
        status: 'pending_payment',
        zohoCustomerId: customerId,
        zohoHostedPageId: page.hostedPageId,
        activatedBy: input.action,
      })
      .where(eq(cellarMemberships.id, state.membership.id));

    return { url: page.url, alreadyActive: false };
  });

export default memberStartActivation;
