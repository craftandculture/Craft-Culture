import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { supplierWines } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * List active supplier wines, optionally filtered by partner name
 */
const getSupplierWines = adminProcedure
  .input(
    z.object({
      partnerName: z.string().optional(),
      limit: z.number().min(1).max(500).default(100),
      offset: z.number().min(0).default(0),
    }),
  )
  .query(async ({ input }) => {
    const { partnerName, limit, offset } = input;

    if (partnerName) {
      return db
        .select()
        .from(supplierWines)
        .where(
          and(
            eq(supplierWines.partnerName, partnerName),
            eq(supplierWines.isActive, true),
          ),
        )
        .orderBy(desc(supplierWines.uploadedAt))
        .limit(limit)
        .offset(offset);
    }

    return db
      .select()
      .from(supplierWines)
      .where(eq(supplierWines.isActive, true))
      .orderBy(desc(supplierWines.uploadedAt))
      .limit(limit)
      .offset(offset);
  });

export default getSupplierWines;
