import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { orderPricingOverrides } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

const inputSchema = z.object({
  orderId: z.string().uuid(),
  ccMarginPercent: z.number().optional(),
  importDutyPercent: z.number().optional(),
  transferCostPercent: z.number().optional(),
  distributorMarginPercent: z.number().optional(),
  vatPercent: z.number().optional(),
  notes: z.string().optional(),
});

/**
 * Create or update order-level bespoke pricing overrides
 *
 * Used when admin approves an order with "Bespoke" pricing selected.
 */
const orderOverrideCreate = adminProcedure.input(inputSchema).mutation(async ({ input, ctx }) => {
  const { orderId, notes, ...variables } = input;
  const { user } = ctx;

  // Check if override already exists
  const existing = await db.query.orderPricingOverrides.findFirst({
    where: eq(orderPricingOverrides.orderId, orderId),
  });

  if (existing) {
    // Update existing
    const [updated] = await db
      .update(orderPricingOverrides)
      .set({
        ...variables,
        notes: notes ?? existing.notes,
      })
      .where(eq(orderPricingOverrides.id, existing.id))
      .returning();

    return updated;
  }

  // Insert new
  const [created] = await db
    .insert(orderPricingOverrides)
    .values({
      orderId,
      ...variables,
      createdBy: user.id,
      notes,
    })
    .returning();

  return created;
});

export default orderOverrideCreate;
