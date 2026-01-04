import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { pricingConfig } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

const inputSchema = z.object({
  module: z.enum(['b2b', 'pco', 'pocket_cellar']),
  key: z.string(),
  value: z.number(),
  description: z.string().optional(),
});

/**
 * Update a pricing configuration value
 *
 * Admin-only endpoint that upserts a pricing variable.
 */
const configUpdate = adminProcedure.input(inputSchema).mutation(async ({ input, ctx }) => {
  const { module, key, value, description } = input;
  const { user } = ctx;

  // Check if config exists
  const existing = await db.query.pricingConfig.findFirst({
    where: { module, key },
  });

  if (existing) {
    // Update existing
    const [updated] = await db
      .update(pricingConfig)
      .set({
        value,
        description: description ?? existing.description,
        updatedBy: user.id,
        updatedAt: new Date(),
      })
      .where(eq(pricingConfig.id, existing.id))
      .returning();

    return updated;
  }

  // Insert new
  const [created] = await db
    .insert(pricingConfig)
    .values({
      module,
      key,
      value,
      description,
      updatedBy: user.id,
    })
    .returning();

  return created;
});

export default configUpdate;
