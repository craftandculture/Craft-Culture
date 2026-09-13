import { desc, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import {
  cellarReleaseRequestItems,
  cellarReleaseRequests,
  logisticsShipmentItems,
  partners,
  wmsProductPricing,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import computeReleaseQuote from '../utils/computeReleaseQuote';

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

    /*
      Duty is a percentage of what the goods are worth, so the quote needs a
      value per bottle. Resolved the way the Pricing Manager resolves it —
      the pricing record first, the most recent shipment line behind it — so a
      release is valued the same way everything else in the platform is.
    */
    const lwins = [...new Set(items.map((item) => item.lwin18))];

    const costRows = lwins.length
      ? await db
          .select({
            lwin18: wmsProductPricing.lwin18,
            cost: sql<number | null>`COALESCE(
              NULLIF(MAX(${wmsProductPricing.importPricePerBottle}), 0),
              MAX(${logisticsShipmentItems.productCostPerBottle})
            )`,
          })
          .from(wmsProductPricing)
          .leftJoin(
            logisticsShipmentItems,
            eq(logisticsShipmentItems.lwin, wmsProductPricing.lwin18),
          )
          .where(inArray(wmsProductPricing.lwin18, lwins))
          .groupBy(wmsProductPricing.lwin18)
      : [];

    const costByLwin = new Map(
      costRows.map((row) => [row.lwin18, Number(row.cost ?? 0)]),
    );

    /*
      Each request arrives with the figures its member's own rate card
      produces, so pricing is a review rather than an act of arithmetic — and
      two people quoting the same basket cannot reach different numbers.
    */
    const requests = await Promise.all(
      rows.map(async (row) => {
        const items = byRequest.get(row.request.id) ?? [];

        const suggested = await computeReleaseQuote(
          row.request.partnerId,
          items.map((item) => ({
            bottles: item.bottles,
            caseConfig: item.caseConfig,
            costPerBottle: costByLwin.get(item.lwin18) ?? null,
          })),
        );

        return {
          ...row.request,
          partnerName: row.partnerName,
          partnerType: row.partnerType,
          items,
          suggested,
        };
      }),
    );

    return { requests };
  });

export default adminGetReleases;
