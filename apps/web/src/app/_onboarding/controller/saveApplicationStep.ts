import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { cellarApplications, cellarIntakes } from '@/database/schema';
import { protectedProcedure } from '@/lib/trpc/procedures';

import { WINE_SOURCE_VALUES } from '../constants/wineSources';
import assertApplicationHolder from '../data/assertApplicationHolder';
import assertNotTradeAccount from '../data/assertNotTradeAccount';
import getApplicationView from '../data/getApplicationView';
import getOrCreateApplication from '../data/getOrCreateApplication';
import syncApplicantProfile from '../data/syncApplicantProfile';

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : null));

const stepSchema = z.discriminatedUnion('step', [
  z.object({
    step: z.literal('about'),
    next: z.enum(['identity', 'wine', 'membership']),
    fullName: z.string().trim().min(2, 'Please tell us your name').max(120),
    phone: optionalText(40),
    deliveryAddress: optionalText(500),
  }),
  z.object({
    step: z.literal('identity'),
    next: z.enum(['about', 'wine', 'membership']),
    eidNumber: optionalText(40),
    eidExpiry: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .transform((value) => value ?? null),
  }),
  z.object({
    step: z.literal('wine'),
    next: z.enum(['about', 'identity', 'membership']),
    sources: z
      .array(
        z.object({
          source: z.enum(WINE_SOURCE_VALUES),
          holderName: optionalText(200),
          holderAccountRef: optionalText(100),
          approxCases: z.number().int().min(0).max(100_000).optional(),
          note: optionalText(2000),
          tastes: optionalText(500),
        }),
      )
      .max(10),
  }),
  /** Skipping or going back: only the resume point moves */
  z.object({
    step: z.literal('move'),
    next: z.enum(['about', 'identity', 'wine', 'membership']),
  }),
]);

/**
 * Save one step of the application and say where to resume
 *
 * Every step but the name is optional — "Complete later" saves nothing and
 * moves on. A submitted application can still have its details filled in from
 * here, which is how the profile card finishes what was skipped.
 */
const saveApplicationStep = protectedProcedure
  .input(stepSchema)
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

    const fields =
      input.step === 'about'
        ? {
            fullName: input.fullName,
            phone: input.phone,
            deliveryAddress: input.deliveryAddress,
          }
        : input.step === 'identity'
          ? { eidNumber: input.eidNumber, eidExpiry: input.eidExpiry }
          : {};

    if (input.step === 'wine') {
      /*
        The answer is replaced as a whole — the form shows every source, so
        what comes back is the complete current answer. Only intakes nobody
        has started work on are replaced; one already in progress stays.
      */
      await db.transaction(async (tx) => {
        await tx
          .delete(cellarIntakes)
          .where(
            and(
              eq(cellarIntakes.applicationId, application.id),
              eq(cellarIntakes.stage, 'requested'),
            ),
          );

        if (input.sources.length > 0) {
          await tx.insert(cellarIntakes).values(
            input.sources.map((source) => ({
              applicationId: application.id,
              partnerId: application.partnerId,
              source: source.source,
              holderName: source.holderName,
              holderAccountRef: source.holderAccountRef,
              approxCases: source.approxCases ?? null,
              note: source.note,
              tastes: source.tastes,
            })),
          );
        }
      });
    }

    const [updated] = await db
      .update(cellarApplications)
      .set({ ...fields, step: input.next })
      .where(eq(cellarApplications.id, application.id))
      .returning();

    await syncApplicantProfile(updated!);

    return getApplicationView(updated!);
  });

export default saveApplicationStep;
