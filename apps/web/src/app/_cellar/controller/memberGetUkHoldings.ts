import { eq, inArray, sql } from 'drizzle-orm';

import resolveFxToUsd from '@/app/_logistics/utils/resolveFxToUsd';
import { lwinPakKeyOf } from '@/app/_wms/utils/lwinPakKey';
import db from '@/database/client';
import { cellarUkHoldings, cellarUkRotations, lwinWines } from '@/database/schema';
import { stockOwnerProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';


import getListPricePerBottle from '../data/getListPricePerBottle';
import hasUkSupplierColumn from '../data/hasUkSupplierColumn';

/**
 * The member's wine at C&C's UK bond, LCB Burton
 *
 * Only rotations the team has placed with this member, as LCB last reported
 * them. The wine is named from the LWIN record where there is one: LCB's
 * descriptions are typed by whoever booked the goods in ("2014 75CL Lynch
 * Bages", "Gloria\t 2018") and are not fit to show a collector. LCB's rates
 * are never sent. The indicative value follows the cellar's rule: our in-bond
 * list price where we list the wine, otherwise what it was declared at when
 * it came in (the sender's value on LCB's report, converted from GBP), which
 * is usually what the member paid.
 *
 * Never throws: if the tables are missing the cellar simply shows no UK wine.
 */
const memberGetUkHoldings = stockOwnerProcedure.query(async ({ ctx }) => {
  try {
    const withSupplier = await hasUkSupplierColumn();
    const rows = await db
      .select({
        /* Who sent it in, where the report says; read only once the column is there */
        supplierName: withSupplier ? cellarUkHoldings.supplierName : sql<string | null>`NULL`,
        rotationNotes: withSupplier ? cellarUkHoldings.rotationNotes : sql<string | null>`NULL`,
        gbpValue: withSupplier ? cellarUkHoldings.gbpValue : sql<number | null>`NULL`,
        packaging: cellarUkHoldings.packaging,
        id: cellarUkHoldings.id,
        /* Stable across LCB imports, so a move can be matched to its line */
        rotation: cellarUkHoldings.rotation,
        line: cellarUkHoldings.line,
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
          .select({
            lwin: lwinWines.lwin,
            displayName: lwinWines.displayName,
            producerTitle: lwinWines.producerTitle,
            producerName: lwinWines.producerName,
            wine: lwinWines.wine,
          })
          .from(lwinWines)
          .where(inArray(lwinWines.lwin, lwin7s))
      : [];

    const nameByLwin = new Map(names.map((row) => [row.lwin, row.displayName]));
    const recordByLwin = new Map(names.map((row) => [row.lwin, row]));
    const gbp = rows.some((row) => row.gbpValue)
      ? await resolveFxToUsd('GBP').catch(() => ({ rate: 1, source: 'unresolved' as const }))
      : null;
    const gbpToUsd = gbp && gbp.source !== 'unresolved' ? gbp.rate : null;

    /* A guide only. If the list cannot be read, the wine still shows, without it. */
    const listed = await getListPricePerBottle(rows.map((row) => row.lwin18)).catch((error: unknown) => {
      logger.error('Could not read list prices for UK holdings', { partnerId: ctx.partner.id, error });
      return new Map<string, number>();
    });

    return {
      holdings: rows.map(({ reportedAt: _reportedAt, ...row }) => ({
        ...row,
        name:
          nameByLwin.get(row.lwin18.slice(0, 7)) ??
          (row.brand && row.brand !== 'NA' ? row.brand : row.description) ??
          'Wine',
        /* The wine and its producer apart, as the UAE cellar shows them */
        wineName: recordByLwin.get(row.lwin18.slice(0, 7))?.wine ?? null,
        producer:
          [
            recordByLwin.get(row.lwin18.slice(0, 7))?.producerTitle,
            recordByLwin.get(row.lwin18.slice(0, 7))?.producerName,
          ]
            .filter(Boolean)
            .join(' ') || (row.brand && row.brand !== 'NA' ? row.brand : null),
        ...(() => {
          const list = listed.get(lwinPakKeyOf(row.lwin18)) ?? null;
          const paid =
            row.gbpValue && gbpToUsd && row.totalBottles > 0
              ? Math.round(((row.gbpValue * gbpToUsd) / row.totalBottles) * 100) / 100
              : null;
          return {
            indicativePerBottle: list ?? paid,
            valueSource: list ? ('list' as const) : paid ? ('declared' as const) : null,
          };
        })(),
        gbpValue: undefined,
      })),
      reportedAt: rows[0]?.reportedAt ?? null,
    };
  } catch (error) {
    logger.error('Could not read a member’s UK holdings', { partnerId: ctx.partner.id, error });
    return { holdings: [], reportedAt: null };
  }
});

export default memberGetUkHoldings;
