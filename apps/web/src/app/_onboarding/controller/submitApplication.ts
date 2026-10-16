import { TRPCError } from '@trpc/server';
import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { cellarApplications, cellarInvites, users } from '@/database/schema';
import { protectedProcedure } from '@/lib/trpc/procedures';
import serverConfig from '@/server.config';

import { PRIVATE_CELLAR_TERMS_VERSION } from '../constants/privateCellarTerms';
import wineSources from '../constants/wineSources';
import assertNotTradeAccount from '../data/assertNotTradeAccount';
import ensureApplicantCellar from '../data/ensureApplicantCellar';
import getApplicationView from '../data/getApplicationView';
import getOrCreateApplication from '../data/getOrCreateApplication';
import notifyCellarTeamOfApplication from '../data/notifyCellarTeamOfApplication';
import syncApplicantProfile from '../data/syncApplicantProfile';
import sendOnboardingEmail from '../utils/sendOnboardingEmail';

/**
 * Submit a Private Cellar application
 *
 * Only a name and accepting the terms are required — everything else can be
 * added later, and nothing about the person's wine can hold this up.
 *
 * Submitting makes the account a private client with a collector cellar (found
 * or created without duplicates), marks onboarding done so `/welcome` never
 * asks them to pick a trade role, and tells the team. An invited member is
 * already approved, so their cellar opens straight away; anyone else waits for
 * an admin to approve.
 */
const submitApplication = protectedProcedure
  .input(z.object({ acceptTerms: z.literal(true) }))
  .mutation(async ({ ctx }) => {
    await assertNotTradeAccount(ctx.user.id);
    const application = await getOrCreateApplication(ctx.user.id, ctx.user.name);

    if (application.status === 'declined') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'This application has been closed. Please contact us.',
      });
    }

    if (!application.fullName || application.fullName.trim().length < 2) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Please tell us your name first.',
      });
    }

    /*
      Invited means one of our live invitations names this login — not merely
      that the login is approved. Approval is also how a trade or staff login
      gets in, and treating that as an invitation opened a cellar for anyone
      approved, with no review.
    */
    const [invite] = application.inviteId
      ? await db
          .select({ id: cellarInvites.id })
          .from(cellarInvites)
          .where(
            and(
              eq(cellarInvites.id, application.inviteId),
              /* Sent counts too: they may sign in without opening the link. */
              inArray(cellarInvites.status, ['sent', 'accepted']),
              eq(cellarInvites.userId, ctx.user.id),
            ),
          )
          .limit(1)
      : [];

    const isInvited = Boolean(invite);
    const isApproved = isInvited || application.status === 'approved';

    const partnerId = await ensureApplicantCellar({
      application,
      userId: ctx.user.id,
      email: ctx.user.email,
      status: isApproved ? 'active' : 'inactive',
    });

    const now = new Date();
    const alreadySubmitted = application.status !== 'draft';

    /*
      Accepted once. A re-save keeps the original moment of acceptance, and
      only a new version of the terms records a new one.
    */
    const termsAcceptedAt =
      application.termsAcceptedAt &&
      application.termsVersion === PRIVATE_CELLAR_TERMS_VERSION
        ? application.termsAcceptedAt
        : now;

    await db
      .update(users)
      .set({
        customerType: 'private_clients',
        name: application.fullName.trim(),
        onboardingCompletedAt: ctx.user.onboardingCompletedAt ?? now,
        termsAcceptedAt,
      })
      .where(eq(users.id, ctx.user.id));

    const [updated] = await db
      .update(cellarApplications)
      .set({
        partnerId,
        status: isInvited ? 'approved' : alreadySubmitted ? application.status : 'submitted',
        termsVersion: PRIVATE_CELLAR_TERMS_VERSION,
        termsAcceptedAt,
        submittedAt: application.submittedAt ?? now,
        ...(isInvited && !application.decidedAt && { decidedAt: now }),
        step: 'membership',
      })
      .where(eq(cellarApplications.id, application.id))
      .returning();

    await syncApplicantProfile(updated!);

    const view = await getApplicationView(updated!);

    // Told once, on the first submission — not again on a re-save
    if (!alreadySubmitted) {
      const sourceLabels = view.intakes.map(
        (intake) =>
          wineSources.find((source) => source.value === intake.source)?.label ??
          intake.source,
      );

      await notifyCellarTeamOfApplication({
        applicationId: application.id,
        applicantName: updated!.fullName ?? ctx.user.email,
        applicantEmail: ctx.user.email,
        phone: updated!.phone,
        missing: view.missing,
        wineSources: sourceLabels,
        isInvited,
      });

      await (isInvited
        ? sendOnboardingEmail('cellarReady', ctx.user.email, {
            name: updated!.fullName ?? '',
            cellarUrl: `${serverConfig.appUrl}/platform/cellar`,
          })
        : sendOnboardingEmail('applicationReceived', ctx.user.email, {
            name: updated!.fullName ?? '',
            statusUrl: `${serverConfig.appUrl}/join/status`,
          }));
    }

    return { ...view, isApproved };
  });

export default submitApplication;
