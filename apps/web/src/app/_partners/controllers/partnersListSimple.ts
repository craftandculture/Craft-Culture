import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { partners } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Get a simple list of all active partners for dropdowns
 *
 * Returns only id and name for each partner, suitable for select/dropdown components.
 * Only returns active partners (excludes inactive and suspended).
 * Optionally filter by partner type.
 */
const partnersListSimple = adminProcedure
  .input(
    z
      .object({
        type: z.enum(['distributor', 'wine_partner', 'supplier', 'private_client']).optional(),
      })
      .optional(),
  )
  .query(async ({ input }) => {
    const conditions = [eq(partners.status, 'active')];

    if (input?.type) {
      conditions.push(eq(partners.type, input.type));
    }

    const partnersList = await db
      .select({
        id: partners.id,
        name: partners.businessName,
        type: partners.type,
      })
      .from(partners)
      .where(and(...conditions))
      .orderBy(partners.businessName);

    return partnersList;
  });

export default partnersListSimple;
