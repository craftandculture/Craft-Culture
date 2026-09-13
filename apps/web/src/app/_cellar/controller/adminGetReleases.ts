import { desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import {
  cellarReleaseRequestItems,
  cellarReleaseRequests,
  partners,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Release requests across every member
 *
 * Drafts are excluded unless asked for: a member part-way through choosing
 * wines has not asked us for anything, and a queue that shows unfinished
 * baskets trains people to ignore it.
 */
const adminGetReleases = adminProcedure
  .input(
    z
      .object({
        status: z
          .enum([
            'all',
            'open',
            'submitted',
            'under_review',
            'revision_requested',
            'confirmed',
            'cancelled',
          ])
          .default('open'),
      })
      .optional(),
  )
  .query(async ({ input }) => {
    const status = input?.status ?? 'open';

    const rows = await db
      .select({
        request: cellarReleaseRequests,
        partnerName: partners.businessName,
        partnerType: partners.type,
      })
      .from(cellarReleaseRequests)
      .leftJoin(partners, eq(partners.id, cellarReleaseRequests.partnerId))
      .where(
        status === 'all'
          ? undefined
          : status === 'open'
            ? inArray(cellarReleaseRequests.status, [
                'submitted',
                'under_review',
                'revision_requested',
              ])
            : eq(cellarReleaseRequests.status, status),
      )
      .orderBy(desc(cellarReleaseRequests.submittedAt))
      .limit(100);

    if (rows.length === 0) return { requests: [] };

    const items = await db
      .select()
      .from(cellarReleaseRequestItems)
      .where(
        inArray(
          cellarReleaseRequestItems.requestId,
          rows.map((row) => row.request.id),
        ),
      )
      .orderBy(cellarReleaseRequestItems.productName);

    const byRequest = new Map<string, typeof items>();

    for (const item of items) {
      byRequest.set(item.requestId, [
        ...(byRequest.get(item.requestId) ?? []),
        item,
      ]);
    }

    return {
      requests: rows.map((row) => ({
        ...row.request,
        partnerName: row.partnerName,
        partnerType: row.partnerType,
        items: byRequest.get(row.request.id) ?? [],
      })),
    };
  });

export default adminGetReleases;
