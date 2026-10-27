import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import storeIdentityDocument from '@/app/_cellar/data/storeIdentityDocument';
import { protectedProcedure } from '@/lib/trpc/procedures';

import assertApplicationHolder from '../data/assertApplicationHolder';
import assertNotTradeAccount from '../data/assertNotTradeAccount';
import ensureApplicantCellar from '../data/ensureApplicantCellar';
import getApplicationView from '../data/getApplicationView';
import getOrCreateApplication from '../data/getOrCreateApplication';
import isInvitedApplicant from '../data/isInvitedApplicant';

/**
 * Upload a side of the applicant's Emirates ID
 *
 * Documents belong to a cellar, so the first upload is the point the cellar is
 * created (or found — see `ensureApplicantCellar`). Someone who has got as far
 * as photographing their ID is applying in earnest, so that is no longer an
 * abandoned form. It stays inactive until approval unless they were invited
 * (the same rule as `submitApplication`).
 */
const uploadApplicationIdentity = protectedProcedure
  .input(
    z.object({
      documentType: z.enum(['emirates_id_front', 'emirates_id_back']),
      // Bounded before decoding — see memberUploadIdentityDocument
      file: z.string().max(14_000_000),
      filename: z
        .string()
        .max(255)
        .regex(/^[^\u0000-\u001f\u007f]+$/, 'That filename is not valid'),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    await assertNotTradeAccount(ctx.user.id);
    const application = await getOrCreateApplication(ctx.user.id, ctx.user.name);
    // A delegate of someone else's cellar can never write the holder's details
    await assertApplicationHolder(application, ctx.user.id);

    if (application.status === 'declined') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'This application has been closed. Please contact us.',
      });
    }

    /*
      The same rule as submitting: a cellar opens straight away only for an
      invited applicant or an application the team has approved. An approved
      login is not enough — that is also how trade and staff logins get in —
      and uploading a photo of an ID must not open an active cellar unreviewed.
    */
    const isApproved =
      application.status === 'approved' ||
      (await isInvitedApplicant(application, ctx.user.id));

    const partnerId = await ensureApplicantCellar({
      application,
      userId: ctx.user.id,
      email: ctx.user.email,
      status: isApproved ? 'active' : 'inactive',
    });

    await storeIdentityDocument({
      partnerId,
      uploadedBy: ctx.user.id,
      documentType: input.documentType,
      file: input.file,
      filename: input.filename,
    });

    return getApplicationView({ ...application, partnerId });
  });

export default uploadApplicationIdentity;
