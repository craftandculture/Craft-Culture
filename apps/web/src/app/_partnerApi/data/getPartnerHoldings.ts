import { and, asc, eq, gt, or, sql } from 'drizzle-orm';

import db from '@/database/client';
import { wmsLocations, wmsStock } from '@/database/schema';

import wineFromLwin from '../utils/wineFromLwin';

/**
 * What a partner holds right now, one row per wine and place
 *
 * Read straight from `wms_stock` on the owner, the same source as the portal's
 * stock page. Bays are not published (they are how we run the warehouse), but
 * where the wine is is: in our bonded warehouse, or placed with a distributor
 * on consignment (never which one).
 *
 * @example
 *   const { data, totals } = await getPartnerHoldings(partnerId);
 *
 * @param partnerId - The key holder
 * @returns Holdings and totals
 */
const getPartnerHoldings = async (partnerId: string) => {
  const heldAt = sql<'warehouse' | 'distributor'>`CASE WHEN ${wmsLocations.locationType} = 'consignment' THEN 'distributor' ELSE 'warehouse' END`;

  const rows = await db
    .select({
      lwin18: wmsStock.lwin18,
      productName: wmsStock.productName,
      producer: wmsStock.producer,
      caseConfig: wmsStock.caseConfig,
      heldAt,
      cases: sql<number>`SUM(${wmsStock.quantityCases})::int`,
      openBottles: sql<number>`COALESCE(SUM(${wmsStock.openBottles}), 0)::int`,
      reservedCases: sql<number>`SUM(${wmsStock.reservedCases})::int`,
      availableCases: sql<number>`SUM(${wmsStock.availableCases})::int`,
      notForSale: sql<boolean>`BOOL_OR(${wmsStock.notForSale})`,
      salesArrangement: sql<string | null>`MIN(${wmsStock.salesArrangement})`,
      firstReceivedAt: sql<Date | null>`MIN(${wmsStock.receivedAt})`,
      updatedAt: sql<Date>`MAX(${wmsStock.updatedAt})`,
    })
    .from(wmsStock)
    .innerJoin(wmsLocations, eq(wmsStock.locationId, wmsLocations.id))
    .where(
      and(
        eq(wmsStock.ownerId, partnerId),
        or(gt(wmsStock.quantityCases, 0), gt(wmsStock.openBottles, 0)),
      ),
    )
    .groupBy(
      wmsStock.lwin18,
      wmsStock.productName,
      wmsStock.producer,
      wmsStock.caseConfig,
      heldAt,
    )
    .orderBy(asc(wmsStock.productName), asc(wmsStock.lwin18));

  const data = rows.map((row) => {
    const wine = wineFromLwin(row.lwin18, row.productName);
    const caseSize = row.caseConfig ?? wine.caseSize ?? 1;

    return {
      wine: { ...wine, producer: row.producer, caseSize },
      heldAt: row.heldAt,
      cases: row.cases,
      openBottles: row.openBottles,
      totalBottles: row.cases * caseSize + row.openBottles,
      reservedCases: row.reservedCases,
      availableCases: row.availableCases,
      notForSale: row.notForSale,
      salesArrangement: row.salesArrangement,
      firstReceivedAt: row.firstReceivedAt ? new Date(row.firstReceivedAt).toISOString() : null,
      updatedAt: new Date(row.updatedAt).toISOString(),
    };
  });

  return {
    data,
    totals: {
      wines: new Set(data.map((row) => row.wine.lwin18)).size,
      cases: data.reduce((sum, row) => sum + row.cases, 0),
      bottles: data.reduce((sum, row) => sum + row.totalBottles, 0),
      reservedCases: data.reduce((sum, row) => sum + row.reservedCases, 0),
    },
    asOf: new Date().toISOString(),
  };
};

export default getPartnerHoldings;
