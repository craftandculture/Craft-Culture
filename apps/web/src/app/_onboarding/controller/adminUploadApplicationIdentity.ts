import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import storeIdentityDocument from '@/app/_cellar/data/storeIdentityDocument';
import db from '@/database/client';
import { cellarApplications, users } from '@/database/schema';
import { staffAdminProcedure } from '@/lib/trpc/procedures';

import ensureApplicantCellar from '../data/ensureApplicantCellar';

/**
 * Add an applicant's Emirates ID photo for them
 *
 * For a photo sent on WhatsApp. Stored exactly as the applicant's own upload
 * is — encrypted, on their cellar, which is created (inactive) if they have
 * not got that far yet.
 */
const adminUploadApplicationIdentity = staffAdminProcedure
  .input(
    z.object({
      applicationId: z.string().uuid(),
      documentType: z.enum(['emirates_id_front', 'emirates_id_back']),
      file: z.string().max(14_000_000),
      filename: z
        .string()
        .max(255)
        .regex(/^[^\u0000-\u001f\u007f]+$/, 'That filename is not valid'),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const [row] = await db
      .select({ application: cellarApplications, user: users })
      .from(cellarApplications)
      .innerJoin(users, eq(users.id, cellarApplications.userId))
      .where(eq(cellarApplications.id, input.applicationId))
      .limit(1);

    if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'Application not found' });

    const partnerId = await ensureApplicantCellar({
      application: row.application,
      userId: row.user.id,
      email: row.user.email,
      status: row.user.approvalStatus === 'approved' ? 'active' : 'inactive',
    });

    await storeIdentityDocument({
      partnerId,
      uploadedBy: ctx.user.id,
      documentType: input.documentType,
      file: input.file,
      filename: input.filename,
    });

    return { saved: true };
  });

export default adminUploadApplicationIdentity;
