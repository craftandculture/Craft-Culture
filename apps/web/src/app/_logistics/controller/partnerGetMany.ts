import { desc, eq, inArray, or } from 'drizzle-orm';

import db from '@/database/client';
import { logisticsShipmentItems, logisticsShipments } from '@/database/schema';
import { winePartnerProcedure } from '@/lib/trpc/procedures';

import isPartnerShipmentItem from '../utils/isPartnerShipmentItem';
import toPartnerShipment from '../utils/toPartnerShipment';
import toPartnerShipmentItem from '../utils/toPartnerShipmentItem';

/**
 * Shipments carrying the current partner's wine, showing only their lines
 *
 * A shipment is theirs when it is for them, or when it carries a line marked
 * as theirs. Lines belonging to other owners are left out, and so is every
 * cost, price and internal note (see toPartnerShipment / toPartnerShipmentItem).
 */
const partnerGetMany = winePartnerProcedure.query(async ({ ctx: { partner } }) => {
  const shipments = await db
    .select()
    .from(logisticsShipments)
    .where(
      or(
        eq(logisticsShipments.partnerId, partner.id),
        inArray(
          logisticsShipments.id,
          db
            .select({ id: logisticsShipmentItems.shipmentId })
            .from(logisticsShipmentItems)
            .where(eq(logisticsShipmentItems.overrideOwnerId, partner.id)),
        ),
      ),
    )
    .orderBy(desc(logisticsShipments.createdAt));

  if (shipments.length === 0) {
    return [];
  }

  const items = await db
    .select()
    .from(logisticsShipmentItems)
    .where(
      inArray(
        logisticsShipmentItems.shipmentId,
        shipments.map((s) => s.id),
      ),
    );

  const partnerOf = new Map(shipments.map((s) => [s.id, s.partnerId]));
  const itemsByShipment = new Map<string, (typeof items)[number][]>();
  for (const item of items) {
    if (!isPartnerShipmentItem(item, partnerOf.get(item.shipmentId) ?? null, partner.id)) continue;
    const existing = itemsByShipment.get(item.shipmentId) ?? [];
    existing.push(item);
    itemsByShipment.set(item.shipmentId, existing);
  }

  return shipments.map((shipment) => {
    const own = itemsByShipment.get(shipment.id) ?? [];
    return { ...toPartnerShipment(shipment, own), items: own.map(toPartnerShipmentItem) };
  });
});

export default partnerGetMany;
