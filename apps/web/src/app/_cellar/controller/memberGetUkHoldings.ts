import { eq, inArray } from 'drizzle-orm';

import db from '@/database/client';
import { cellarUkHoldings, cellarUkRotations, lwinWines } from '@/database/schema';
import { stockOwnerProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

/**
 * The member's wine at C&C's UK bond, LCB Burton
 *
 * Only rotations the team has placed with this member, as LCB last reported
 * them. The wine is named from the LWIN record where there is one: LCB's
 * descriptions are typed by whoever booked the goods in ("2014 75CL Lynch
 * Bages", "Gloria\t 2018") and are not fit to show a collector. No values or
 * rates are sent.
 *
 * Never throws: if the tables are missing the cellar simply shows no UK wine.
 */
const memberGetUkHoldings = stockOwnerProcedure.query(async ({ ctx }) => {
  try {
    const rows = await db
      .select({
        id: cellarUkHoldings.id,
        lwin18: cellarUkHoldings.lwin18,
        brand: cellarUkHoldings.brand,
        description: cellarUkHoldings.description,
        vintage: cellarUkHoldings.vintage,
        bottlesPerCase: cellarUkHoldings.bottlesPerCase,
        bottleSizeLitres: cellarUkHoldings.bottleSizeLitres,
        cases: cellarUkHoldings.cases,
        singles: cellarUkHoldings.singles,
        totalBottles: cellarUkHoldings.totalBottles,
        receivedAt: cellarUkHoldings.receivedAt,
        reportedAt: cellarUkHoldings.createdAt,
      })
      .from(cellarUkHoldings)
      .innerJoin(cellarUkRotations, eq(cellarUkHoldings.rotation, cellarUkRotations.rotation))
      .where(eq(cellarUkRotations.partnerId, ctx.partner.id))
      .orderBy(cellarUkHoldings.description);

    if (rows.length === 0) return { holdings: [], reportedAt: null };

    const lwin7s = [...new Set(rows.map((row) => row.lwin18.slice(0, 7)).filter((code) => /^\d{7}$/.test(code)))];

    const names = lwin7s.length
      ? await db
          .select({ lwin: lwinWines.lwin, displayName: lwinWines.displayName })
          .from(lwinWines)
          .where(inArray(lwinWines.lwin, lwin7s))
      : [];

    const nameByLwin = new Map(names.map((row) => [row.lwin, row.displayName]));

    return {
      holdings: rows.map(({ reportedAt: _reportedAt, ...row }) => ({
        ...row,
        name:
          nameByLwin.get(row.lwin18.slice(0, 7)) ??
          (row.brand && row.brand !== 'NA' ? row.brand : row.description) ??
          'Wine',
      })),
      reportedAt: rows[0]?.reportedAt ?? null,
    };
  } catch (error) {
    logger.error('Could not read a member’s UK holdings', { partnerId: ctx.partner.id, error });
    return { holdings: [], reportedAt: null };
  }
});

export default memberGetUkHoldings;
