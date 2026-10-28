import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { competitorWines } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * List active competitor wines, optionally filtered by competitor name
 */
const getCompetitorWines = adminProcedure
  .input(
    z.object({
      competitorName: z.string().optional(),
      limit: z.number().min(1).max(500).default(100),
      offset: z.number().min(0).default(0),
    }),
  )
  .query(async ({ input }) => {
    const { competitorName, limit, offset } = input;

    // Active wines only, with or without a competitor filter (the filtered
    // branch used to drop the active check and show withdrawn lists)
    return db
      .select()
      .from(competitorWines)
      .where(
        competitorName
          ? and(
              eq(competitorWines.isActive, true),
              eq(competitorWines.competitorName, competitorName),
            )
          : eq(competitorWines.isActive, true),
      )
      .orderBy(desc(competitorWines.uploadedAt))
      .limit(limit)
      .offset(offset);
  });

export default getCompetitorWines;
