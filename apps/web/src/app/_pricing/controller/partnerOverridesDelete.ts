import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { partnerPricingOverrides } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

const inputSchema = z.object({
  partnerId: z.string().uuid(),
});

/**
 * Delete a partner pricing override
 *
 * Removes bespoke PCO pricing for a partner, reverting them to global defaults.
 */
const partnerOverridesDelete = adminProcedure.input(inputSchema).mutation(async ({ input }) => {
  const { partnerId } = input;

  await db
    .delete(partnerPricingOverrides)
    .where(eq(partnerPricingOverrides.partnerId, partnerId));

  return { success: true };
});

export default partnerOverridesDelete;
