import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { pricingConfig } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

const inputSchema = z
  .object({
    module: z.enum(['b2b', 'pco', 'pocket_cellar', 'exchange_rates']),
    key: z.string().regex(/^[a-z0-9_]{1,64}$/, 'Unknown pricing setting'),
    value: z.number().finite(),
    description: z.string().optional(),
  })
  .superRefine(({ module, key, value }, ctx) => {
    // Margins divide by (1 - margin/100): 100 is a divide by zero and anything
    // above it prices every wine negative
    if (key.endsWith('_percent')) {
      const isMargin = key.includes('margin');

      if (value < 0 || (isMargin ? value >= 100 : value > 100)) {
        ctx.addIssue({
          code: 'custom',
          path: ['value'],
          message: isMargin
            ? 'A margin must be at least 0% and below 100%'
            : 'A percentage must be between 0 and 100',
        });
      }

      return;
    }

    if (module === 'exchange_rates' ? value <= 0 : value < 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['value'],
        message:
          module === 'exchange_rates'
            ? 'An exchange rate must be above 0'
            : 'This value cannot be negative',
      });
    }
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
