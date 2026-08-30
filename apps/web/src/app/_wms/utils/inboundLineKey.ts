import { sql } from 'drizzle-orm';

import { logisticsShipmentItems } from '@/database/schema';

import lwinPakKey from './lwinPakKey';

/**
 * The key an in-transit line is known by, everywhere
 *
 * An inbound row identifies itself as its LWIN, or — where the wine has not
 * been mapped yet — as its product name. Releases are written under that, so
 * anything reading them has to ask the same way.
 *
 * It did not. The filters and the price list's gate keyed on the LWIN column
 * alone, which is null on an unmapped line, so `lwin_key = NULL` matched
 * nothing: every unmapped wine showed its released badge and was absent from
 * "On price list" and from the price list itself. Most in-transit stock arrives
 * from a supplier's spreadsheet with no LWIN, so that was most of it.
 *
 * @returns SQL for the pack-agnostic key of an in-transit line
 */
const inboundLineKey = () =>
  lwinPakKey(
    sql`COALESCE(${logisticsShipmentItems.lwin}, ${logisticsShipmentItems.productName})`,
  );

export default inboundLineKey;
