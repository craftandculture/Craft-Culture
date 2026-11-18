import { and, eq, isNotNull } from 'drizzle-orm';

import readOwnerTag from '@/app/_distribution/utils/readOwnerTag';
import { consOwners } from '@/database/schema';

/**
 * Whose stock a sales order must be filled from, when its reference names one
 *
 * A consignment order carries its owner in the Zoho reference:
 * `CONSIGNMENT_CRURATED` is Crurated's wine going to City Drinks, and nobody
 * else's. Nothing read it. Holds, release and the pick all took the best bay
 * of the wine, whoever owned it, so on 18 Nov SO-00268 (CONSIGNMENT_CRURATED)
 * held Michael Humphreys-Davies' two cases of Gravida Primogenita and Alain
 * Brahamcha's Corton-Charlemagne, with Crurated's own cases free in the next
 * aisle, and the picker was sent to them.
 *
 * The tag is resolved through the consignment owners' table, the one place
 * a tag is tied to a partner, so a stock row's owner can be compared with it.
 * `CONSIGNMENT_MIX`, an unknown tag, or no tag names nobody, and the order is
 * filled as before.
 *
 * @example
 *   const owner = await getOrderStockOwner({ db, referenceNumber: 'CONSIGNMENT_CRURATED' });
 *   owner?.ownerId; // Crurated's partner id, as on wms_stock.owner_id
 *
 * @param params.db - Drizzle handle (app, transaction or Trigger.dev)
 * @param params.referenceNumber - The sales order's Zoho reference
 * @returns The owner's partner id and name, or null when the order names none
 */
const getOrderStockOwner = async ({
  db,
  referenceNumber,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any;
  referenceNumber: string | null | undefined;
}) => {
  // Only a consignment reference names an owner; a PCO number or free text does not
  if (!referenceNumber || !/consignment/i.test(referenceNumber)) return null;

  const owners: { tag: string; ownerId: string; name: string }[] = await db
    .select({ tag: consOwners.consignmentTag, ownerId: consOwners.partnerId, name: consOwners.name })
    .from(consOwners)
    .where(
      and(
        isNotNull(consOwners.consignmentTag),
        isNotNull(consOwners.partnerId),
        eq(consOwners.isActive, true),
      ),
    );

  const tag = readOwnerTag(
    referenceNumber,
    owners.map((o) => o.tag),
  );
  if (!tag) return null;

  const owner = owners.find((o) => o.tag.toUpperCase() === tag);
  return owner ? { ownerId: owner.ownerId, name: owner.name, tag } : null;
};

export default getOrderStockOwner;
