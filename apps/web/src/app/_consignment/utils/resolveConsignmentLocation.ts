import { and, eq } from 'drizzle-orm';

import type db from '@/database/client';
import { wmsLocations } from '@/database/schema';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * The bay that stands for a distributor's premises
 *
 * Wine placed with a distributor has to land somewhere. Decrementing it to zero
 * is what the warehouse does today, and it is why the only record of a member's
 * unsold wine at City Drinks is five spreadsheets reconciled by hand.
 *
 * One location per distributor, created the first time something is placed with
 * them. The `aisle/bay/level = '-'` shape is the existing idiom for a location
 * that is not a physical rack, borrowed from `adminCreateSpecialLocation`.
 *
 * @param tx - The transaction doing the placement
 * @param partnerId - The distributor
 * @param partnerName - Used to build a readable location code
 * @returns The location id to move stock into
 */
const resolveConsignmentLocation = async (
  tx: Tx,
  partnerId: string,
  partnerName: string,
) => {
  const [existing] = await tx
    .select({ id: wmsLocations.id })
    .from(wmsLocations)
    .where(
      and(
        eq(wmsLocations.partnerId, partnerId),
        eq(wmsLocations.locationType, 'consignment'),
      ),
    )
    .limit(1);

  if (existing) return existing.id;

  /*
    Derived from the name so a person reading a movement log sees where wine
    went, but suffixed with the partner id so two distributors with similar
    names cannot collide on the unique code.
  */
  const slug = partnerName
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 20);

  const locationCode = `CONSIGN-${slug}-${partnerId.slice(0, 8)}`;

  const [created] = await tx
    .insert(wmsLocations)
    .values({
      locationCode,
      aisle: '-',
      bay: '-',
      level: '-',
      locationType: 'consignment',
      partnerId,
      barcode: `LOC-${locationCode}`,
    })
    .returning({ id: wmsLocations.id });

  if (!created) throw new Error('Could not create the consignment location');

  return created.id;
};

export default resolveConsignmentLocation;
