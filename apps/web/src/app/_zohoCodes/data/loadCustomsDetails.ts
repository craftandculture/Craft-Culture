import { isNotNull, sql } from 'drizzle-orm';

import lookupOrigins from '@/app/_exportInvoices/data/lookupOrigins';
import toMenuHsCode from '@/app/_logistics/utils/toMenuHsCode';
import { lwinPakKeyOf } from '@/app/_wms/utils/lwinPakKey';
import normalizeLwin18 from '@/app/_wms/utils/normalizeLwin18';
import db from '@/database/client';
import { logisticsShipmentItems } from '@/database/schema';

export interface CustomsDetails {
  hsCode: string | null;
  country: string | null;
}

/**
 * HS code and country of origin per Stock Explorer code, from our own records
 *
 * The shipment a wine arrived on is believed first — its HS code was chosen
 * from the menu on the shipment page, its origin read off the supplier
 * invoice — matched on wine, vintage and size so a repack inherits it. Origin
 * then falls back to the catalogue and the LWIN register. A code with no HS
 * on any shipment is left null here and classified from its name.
 *
 * @param lwin18s - Dashed LWIN-18 codes
 * @returns Details keyed by the same codes
 */
const loadCustomsDetails = async (lwin18s: string[]) => {
  const codes = [...new Set(lwin18s)];
  const details = new Map<string, CustomsDetails>();
  if (!codes.length) return details;

  const [shipped, origins] = await Promise.all([
    db
      .select({
        lwin: logisticsShipmentItems.lwin,
        hsCode: sql<string | null>`max(${logisticsShipmentItems.hsCode})`,
        country: sql<string | null>`max(${logisticsShipmentItems.countryOfOrigin})`,
      })
      .from(logisticsShipmentItems)
      .where(isNotNull(logisticsShipmentItems.lwin))
      .groupBy(logisticsShipmentItems.lwin),
    lookupOrigins(codes),
  ]);

  const byKey = new Map<string, CustomsDetails>();
  for (const row of shipped) {
    const key = lwinPakKeyOf(normalizeLwin18(row.lwin!.trim().toUpperCase()));
    const prev = byKey.get(key);
    byKey.set(key, {
      hsCode: prev?.hsCode ?? toMenuHsCode(row.hsCode),
      country: prev?.country ?? (row.country?.trim() || null),
    });
  }

  for (const code of codes) {
    const fromShipment = byKey.get(lwinPakKeyOf(code));
    details.set(code, {
      hsCode: fromShipment?.hsCode ?? null,
      country: fromShipment?.country ?? origins.get(code) ?? origins.get(code.slice(0, 7)) ?? null,
    });
  }

  return details;
};

export default loadCustomsDetails;
