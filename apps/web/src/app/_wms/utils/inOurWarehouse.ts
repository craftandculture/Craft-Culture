import { eq, notInArray } from 'drizzle-orm';

import db from '@/database/client';
import { wmsLocations, wmsStock } from '@/database/schema';

/**
 * Stock that is physically ours to sell, pick and count
 *
 * A `consignment` location is somebody else's premises — a distributor holding
 * a member's wine, out of bond and out of the building. The stock row still
 * exists, because the wine is still owned and still unsold and decrementing it
 * to nothing is what left the triangulation spreadsheets as the only record of
 * where it went. But it is no longer ours to offer.
 *
 * **The catalogue is the one that matters.** Wine placed with City Drinks is
 * theirs to sell; leaving it on our price list means the same bottles are
 * offered twice by two sellers, and one of those sales cannot be honoured.
 *
 * Written as a subquery rather than a join so it drops into any query already
 * selecting from `wms_stock` without disturbing its grouping — several of these
 * aggregate, and an extra join would silently multiply rows.
 *
 * `locationId` is NOT NULL, so there is no third state to think about here.
 *
 * @example
 *   const where = [gt(wmsStock.availableCases, 0), inOurWarehouse()];
 *
 * @returns A Drizzle condition excluding stock held off-site
 */
const inOurWarehouse = () =>
  notInArray(
    wmsStock.locationId,
    db
      .select({ id: wmsLocations.id })
      .from(wmsLocations)
      .where(eq(wmsLocations.locationType, 'consignment')),
  );

export default inOurWarehouse;
