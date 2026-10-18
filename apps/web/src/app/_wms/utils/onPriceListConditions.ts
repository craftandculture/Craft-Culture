import { eq, gt } from 'drizzle-orm';

import { wmsStock } from '@/database/schema';

import inOurWarehouse from './inOurWarehouse';

/**
 * The stock rows that are on our price lists
 *
 * One definition for every surface that sells from the shelf: the trade sheet,
 * the private-client portal and Private Cellar's Available now all read the
 * catalogue, and the parcels a member's order is filled from must be exactly
 * the rows that catalogue counted. Written in two places, a wine could be on
 * Available now with no parcel allowed to fill it, or filled from wine no
 * price list ever showed.
 *
 * - **Available**, so nothing already promised is offered again
 * - **Not held for its owner**, so a client's wine in storage never prices
 * - **In our warehouse**, so wine placed with a distributor is not sold twice
 *
 * Whoever owns the row does not matter: C&C's stock, a partner's consignment
 * and a member's accepted offer are all supply, settled differently.
 *
 * @example
 *   db.select().from(wmsStock).where(and(...onPriceListConditions()));
 *
 * @returns Drizzle conditions on `wms_stock`
 */
const onPriceListConditions = () => [
  gt(wmsStock.availableCases, 0),
  eq(wmsStock.notForSale, false),
  inOurWarehouse(),
];

export default onPriceListConditions;
