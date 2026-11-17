import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import isCellarMemberPartner from '@/app/_privateClientOrders/data/isCellarMemberPartner';
import db from '@/database/client';
import { partnerPricingOverrides } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

const inputSchema = z.object({
  partnerId: z.string().uuid(),
  ccMarginPercent: z.number().min(0).lt(100).optional().nullable(),
  importDutyPercent: z.number().min(0).max(100).optional().nullable(),
  transferCostPercent: z.number().min(0).max(100).optional().nullable(),
  distributorMarginPercent: z.number().min(0).lt(100).optional().nullable(),
  vatPercent: z.number().min(0).max(100).optional().nullable(),
  effectiveFrom: z.date().optional().nullable(),
  effectiveUntil: z.date().optional().nullable(),
  notes: z.string().optional().nullable(),
});

/**
 * Create or update a partner pricing override
 *
 * Upserts bespoke PCO pricing for a partner.
 * Uses partnerId as the unique key for upsert.
 */
const partnerOverridesUpsert = adminProcedure.input(inputSchema).mutation(async ({ input, ctx }) => {
  /*
    A Private Cellar member is priced at their cellar rate card, set in the
    Rates section of their cellar. A row here would never be read.
  */
  if (await isCellarMemberPartner(input.partnerId)) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message:
        "Private Cellar members are priced at their cellar rates. Change them in the Rates section of the member's cellar.",
    });
  }

  const { partnerId, ...values } = input;
  const { user } = ctx;

  // Check if override exists for this partner
  const existing = await db.query.partnerPricingOverrides.findFirst({
    where: { partnerId },
  });

  if (existing) {
    // Update existing override
    const [updated] = await db
      .update(partnerPricingOverrides)
      .set({
        ccMarginPercent: values.ccMarginPercent ?? null,
        importDutyPercent: values.importDutyPercent ?? null,
        transferCostPercent: values.transferCostPercent ?? null,
        distributorMarginPercent: values.distributorMarginPercent ?? null,
        vatPercent: values.vatPercent ?? null,
        effectiveFrom: values.effectiveFrom ?? null,
        effectiveUntil: values.effectiveUntil ?? null,
        notes: values.notes ?? null,
      })
      .where(eq(partnerPricingOverrides.id, existing.id))
      .returning();

    return updated;
  }

  // Insert new override
  const [created] = await db
    .insert(partnerPricingOverrides)
    .values({
      partnerId,
      ccMarginPercent: values.ccMarginPercent ?? null,
      importDutyPercent: values.importDutyPercent ?? null,
      transferCostPercent: values.transferCostPercent ?? null,
      distributorMarginPercent: values.distributorMarginPercent ?? null,
      vatPercent: values.vatPercent ?? null,
      effectiveFrom: values.effectiveFrom ?? null,
      effectiveUntil: values.effectiveUntil ?? null,
      notes: values.notes ?? null,
      createdBy: user.id,
    })
    .returning();

  return created;
});

export default partnerOverridesUpsert;
