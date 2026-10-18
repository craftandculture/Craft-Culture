import { TRPCError } from '@trpc/server';
import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { cellarApplications, cellarMemberships, users } from '@/database/schema';
import { cellarHolderProcedure } from '@/lib/trpc/procedures';
import { createSubscriptionHostedPage, findOrCreateBillingCustomer, isBillingConfigured } from '@/lib/zoho/billing';
import serverConfig from '@/server.config';

import { PRIVATE_CELLAR_TERMS_VERSION } from '../constants/privateCellarTerms';
import getActivationState from '../data/getActivationState';
import getMembershipTerms from '../data/getMembershipTerms';
import getTermsAcceptance from '../data/getTermsAcceptance';
import openMembershipInvoiceTask from '../data/openMembershipInvoiceTask';

/**
 * Start the membership: by invoice, or on Zoho's card page
 *
 * Billed by invoice (CELLAR_BILLING_MODE=invoice, the default) the cellar is
 * active as soon as the ID is on file, and the team is given a job to set up
 * the member's monthly invoice in Zoho Books. Billed by card, the member is
 * sent to Zoho Billing's payment page instead.
 *
 * The ID must be on file first — it is the cheaper step to fix and the one
 * we cannot do for them. The page returns to /platform/cellar/activated,
 * which confirms the subscription and sends the member back to what they
 * were doing.
 */
const memberStartActivation = cellarHolderProcedure
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
      /** Ticked on the sheet when the current terms were not accepted at sign-up */
      acceptTerms: z.boolean().optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const state = await getActivationState(ctx.partner.id);

    if (!state.isGated || !state.membership) return { url: null, alreadyActive: true };
    if (state.missing.includes('identity')) {
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Please add your Emirates ID first.' });
    }
    if (!state.missing.includes('payment')) return { url: null, alreadyActive: true };

    /*
      Billing starts here, so the current terms must be on record — checked on
      the server, not only by the checkbox. Accepted at sign-up on this version
      is enough; otherwise the member ticks them now and it is recorded.
    */
    const { applicationId, acceptedCurrent } = await getTermsAcceptance(ctx.partner.id);

    if (!acceptedCurrent) {
      if (!input.acceptTerms) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Please read and accept the Private Cellar terms first.',
        });
      }

      const acceptedAt = new Date();

      if (applicationId) {
        await db
          .update(cellarApplications)
          .set({ termsVersion: PRIVATE_CELLAR_TERMS_VERSION, termsAcceptedAt: acceptedAt })
          .where(eq(cellarApplications.id, applicationId));
      }

      await db.update(users).set({ termsAcceptedAt: acceptedAt }).where(eq(users.id, ctx.user.id));
    }

    if (serverConfig.cellarBillingMode === 'invoice') {
      /*
        Only a cellar that has never started can start itself. A paused or
        cancelled membership is the team's decision (usually an unpaid
        invoice), and pressing "Start membership" must not undo it.
      */
      if (state.membership.status === 'past_due' || state.membership.status === 'cancelled') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Your membership is paused. Please contact us and we will arrange the next step with you.',
        });
      }

      const terms = await getMembershipTerms(ctx.partner.id);

      /*
        Only from a state that has never started. A double click finds the
        membership already active and opens no second invoice job, and a
        pause the team applied a moment ago is not undone.
      */
      const [started] = await db
        .update(cellarMemberships)
        .set({ status: 'active', activatedAt: new Date(), activatedBy: input.action })
        .where(
          and(
            eq(cellarMemberships.id, state.membership.id),
            inArray(cellarMemberships.status, ['not_activated', 'pending_payment']),
          ),
        )
        .returning({ id: cellarMemberships.id });

      if (!started) return { url: null, alreadyActive: true };

      await openMembershipInvoiceTask({
        memberName: ctx.partner.businessName,
        partnerId: ctx.partner.id,
        membershipFeeAed: terms.membershipFeeAed,
      });

      return { url: null, alreadyActive: false };
    }

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
