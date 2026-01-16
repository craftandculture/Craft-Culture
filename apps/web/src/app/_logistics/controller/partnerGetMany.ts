import { desc, eq, inArray } from 'drizzle-orm';

import db from '@/database/client';
import { logisticsShipmentItems, logisticsShipments } from '@/database/schema';
import { winePartnerProcedure } from '@/lib/trpc/procedures';

/**
 * Get shipments for the current partner
 */
const partnerGetMany = winePartnerProcedure.query(async ({ ctx: { partner } }) => {
  // Get all shipments for this partner
  const shipments = await db
    .select()
    .from(logisticsShipments)
    .where(eq(logisticsShipments.partnerId, partner.id))
    .orderBy(desc(logisticsShipments.createdAt));

  if (shipments.length === 0) {
    return [];
  }

  // Batch fetch items for all shipments
  const shipmentIds = shipments.map((s) => s.id);
  const items = await db
    .select()
    .from(logisticsShipmentItems)
    .where(inArray(logisticsShipmentItems.shipmentId, shipmentIds));

  // Group items by shipment
  const itemsByShipment = new Map<string, (typeof items)[number][]>();
  for (const item of items) {
    const existing = itemsByShipment.get(item.shipmentId) ?? [];
    existing.push(item);
    itemsByShipment.set(item.shipmentId, existing);
  }

  // Attach items to shipments
  return shipments.map((shipment) => ({
    ...shipment,
    items: itemsByShipment.get(shipment.id) ?? [],
  }));
});

export default partnerGetMany;
