import { z } from 'zod';

import db from '@/database/client';
import { cellarPaymentSettings } from '@/database/schema';
import { staffAdminProcedure } from '@/lib/trpc/procedures';

const field = z
  .string()
  .trim()
  .max(200)
  .transform((value) => value || undefined)
  .optional();

/**
 * Set the bank details members pay C&C into
 *
 * Shown on every reserved purchase, with the purchase number as the payment
 * reference. An IBAN or an account number is required, since without one the
 * panel would tell a member where to pay without saying where.
 *
 * @example
 *   await trpcClient.cellar.admin.setPaymentDetails.mutate({ accountName, bankName, iban, swiftBic });
 */
const adminSetPaymentDetails = staffAdminProcedure
  .input(
    z
      .object({
        accountName: field,
        bankName: field,
        iban: field,
        swiftBic: field,
        accountNumber: field,
        currency: field,
        note: field,
        /** The dirham account, optional; members paying in AED see it */
        aed: z
          .object({
            accountName: field,
            bankName: field,
            iban: field,
            swiftBic: field,
            accountNumber: field,
          })
          .optional()
          .transform((value) => (value && (value.iban || value.accountNumber) ? value : undefined)),
      })
      .refine((value) => Boolean(value.iban || value.accountNumber), {
        message: 'Add an IBAN or an account number',
      }),
  )
  .mutation(async ({ ctx, input }) => {
    await db
      .insert(cellarPaymentSettings)
      .values({ id: 'house', details: input, updatedBy: ctx.user.id })
      .onConflictDoUpdate({
        target: cellarPaymentSettings.id,
        set: { details: input, updatedBy: ctx.user.id, updatedAt: new Date() },
      });

    return { saved: true };
  });

export default adminSetPaymentDetails;
