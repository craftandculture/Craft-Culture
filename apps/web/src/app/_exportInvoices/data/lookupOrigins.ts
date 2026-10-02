import { inArray } from 'drizzle-orm';

import db from '@/database/client';
import { logisticsShipmentItems, lwinWines, products } from '@/database/schema';

/**
 * Country of origin for each wine on an export
 *
 * Read from the catalogue by LWIN-18, then from the LWIN register by the
 * 7-digit wine code. A wine found in neither is left blank and flagged for
 * the operator rather than guessed from its name.
 *
 * @param lwin18s - LWIN-18 codes on the invoice lines
 * @returns Country keyed by LWIN-18 and by LWIN-7
 */
const lookupOrigins = async (lwin18s: string[]) => {
  const origins = new Map<string, string>();
  const codes = [...new Set(lwin18s.filter(Boolean))];
  if (codes.length === 0) return origins;

  const catalogue = await db
    .select({ lwin18: products.lwin18, country: products.country })
    .from(products)
    .where(inArray(products.lwin18, codes));
  for (const row of catalogue) {
    if (row.country) origins.set(row.lwin18, row.country);
  }

  const lwin7s = [...new Set(codes.map((c) => c.slice(0, 7)))];
  const register = await db
    .select({ lwin: lwinWines.lwin, country: lwinWines.country })
    .from(lwinWines)
    .where(inArray(lwinWines.lwin, lwin7s));
  for (const row of register) {
    if (row.country) origins.set(row.lwin, row.country);
  }

  // Codes the catalogue does not know (Crurated's alphanumeric ones) take the
  // origin declared on the shipment they arrived on
  const missing = codes.filter((c) => !origins.has(c) && !origins.has(c.slice(0, 7)));
  if (missing.length > 0) {
    const shipped = await db
      .select({ lwin: logisticsShipmentItems.lwin, country: logisticsShipmentItems.countryOfOrigin })
      .from(logisticsShipmentItems)
      .where(inArray(logisticsShipmentItems.lwin, missing));
    for (const row of shipped) {
      if (row.lwin && row.country && !origins.has(row.lwin)) origins.set(row.lwin, row.country);
    }
  }

  return origins;
};

export default lookupOrigins;
