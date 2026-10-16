import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { cellarApplications } from '@/database/schema';
import { staffAdminProcedure } from '@/lib/trpc/procedures';

import syncApplicantProfile from '../data/syncApplicantProfile';

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null);

/**
 * Fill in an applicant's details for them
 *
 * Members often send their mobile, address or ID number on WhatsApp rather
 * than finishing the form. What is typed here is saved exactly as given —
 * an emptied field is cleared — and copied onto their cellar.
 */
const adminUpdateApplication = staffAdminProcedure
  .input(
    z.object({
      applicationId: z.string().uuid(),
      fullName: z.string().trim().min(2).max(120),
      phone: optionalText(40),
      deliveryAddress: optionalText(500),
      eidNumber: optionalText(40),
      eidExpiry: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .nullable(),
    }),
  )
  .mutation(async ({ input }) => {
    const { applicationId, ...fields } = input;

    const [updated] = await db
      .update(cellarApplications)
      .set(fields)
      .where(eq(cellarApplications.id, applicationId))
      .returning();

    if (!updated) throw new TRPCError({ code: 'NOT_FOUND', message: 'Application not found' });

    await syncApplicantProfile(updated);

    return { saved: true };
  });

export default adminUpdateApplication;
