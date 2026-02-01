import { eq, sql } from 'drizzle-orm';

import db from '@/database/client';
import { wmsStock } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Rebuild stock records from movement history
 * This is a recovery tool for when stock records are accidentally deleted
 * It recreates stock based on receive movements minus picks/adjustments
 *
 * @example
 *   await trpcClient.wms.admin.stock.rebuildFromMovements.mutate();
 */
const adminRebuildStockFromMovements = adminProcedure.mutation(async () => {
  // Calculate net stock per product/location/shipment from all movements
  // This is the source of truth
  const netStockFromMovements = await db.execute(sql`
    SELECT
      m.lwin18,
      m.product_name,
      COALESCE(m.to_location_id, m.from_location_id) as location_id,
      m.shipment_id,
      SUM(
        CASE
          WHEN m.movement_type = 'receive' THEN m.quantity_cases
          WHEN m.movement_type = 'pick' THEN -m.quantity_cases
          WHEN m.movement_type = 'transfer' AND m.to_location_id IS NOT NULL THEN m.quantity_cases
          WHEN m.movement_type = 'transfer' AND m.from_location_id IS NOT NULL THEN -m.quantity_cases
          WHEN m.movement_type = 'adjust' AND m.reason_code != 'stock_correction' THEN m.quantity_cases
          ELSE 0
        END
      ) as net_cases
    FROM wms_stock_movements m
    WHERE m.movement_type IN ('receive', 'pick', 'transfer', 'adjust')
    GROUP BY m.lwin18, m.product_name, COALESCE(m.to_location_id, m.from_location_id), m.shipment_id
    HAVING SUM(
      CASE
        WHEN m.movement_type = 'receive' THEN m.quantity_cases
        WHEN m.movement_type = 'pick' THEN -m.quantity_cases
        WHEN m.movement_type = 'transfer' AND m.to_location_id IS NOT NULL THEN m.quantity_cases
        WHEN m.movement_type = 'transfer' AND m.from_location_id IS NOT NULL THEN -m.quantity_cases
        WHEN m.movement_type = 'adjust' AND m.reason_code != 'stock_correction' THEN m.quantity_cases
        ELSE 0
      END
    ) > 0
  `);

  const stockToCreate = Array.isArray(netStockFromMovements)
    ? netStockFromMovements
    : netStockFromMovements.rows ?? [];

  if (stockToCreate.length === 0) {
    return {
      success: true,
      message: 'No stock to rebuild - movements show zero net stock',
      created: 0,
      updated: 0,
    };
  }

  // Get owner info from receive movements (first receive movement for each shipment)
  const ownersByShipment = await db.execute(sql`
    SELECT DISTINCT ON (shipment_id)
      shipment_id,
      (
        SELECT s.partner_id FROM logistics_shipments s WHERE s.id = m.shipment_id
      ) as owner_id,
      (
        SELECT p.business_name FROM partners p
        JOIN logistics_shipments s ON s.partner_id = p.id
        WHERE s.id = m.shipment_id
      ) as owner_name
    FROM wms_stock_movements m
    WHERE m.movement_type = 'receive' AND m.shipment_id IS NOT NULL
  `);

  const ownerMap = new Map<string, { ownerId: string; ownerName: string }>();
  const ownerRows = Array.isArray(ownersByShipment)
    ? ownersByShipment
    : ownersByShipment.rows ?? [];
  for (const row of ownerRows) {
    if (row.shipment_id && row.owner_id) {
      ownerMap.set(row.shipment_id as string, {
        ownerId: row.owner_id as string,
        ownerName: (row.owner_name as string) ?? 'Unknown',
      });
    }
  }

  // Get a default owner (first partner) for stock without shipment
  const [defaultPartner] = await db.execute(sql`
    SELECT id, business_name FROM partners LIMIT 1
  `);
  const defaultOwner = defaultPartner
    ? { ownerId: defaultPartner.id as string, ownerName: defaultPartner.business_name as string }
    : null;

  let created = 0;
  let updated = 0;
  const errors: string[] = [];

  for (const row of stockToCreate) {
    const lwin18 = row.lwin18 as string;
    const productName = row.product_name as string;
    const locationId = row.location_id as string;
    const shipmentId = row.shipment_id as string | null;
    const netCases = Number(row.net_cases);

    if (!locationId) {
      errors.push(`No location for ${productName} - skipped`);
      continue;
    }

    // Get owner
    const owner = shipmentId
      ? ownerMap.get(shipmentId) ?? defaultOwner
      : defaultOwner;

    if (!owner) {
      errors.push(`No owner found for ${productName} - skipped`);
      continue;
    }

    // Check if stock record already exists
    const [existingStock] = await db
      .select()
      .from(wmsStock)
      .where(
        sql`${wmsStock.lwin18} = ${lwin18}
            AND ${wmsStock.locationId} = ${locationId}
            AND (${wmsStock.shipmentId} = ${shipmentId} OR (${wmsStock.shipmentId} IS NULL AND ${shipmentId} IS NULL))`,
      );

    if (existingStock) {
      // Update existing
      if (existingStock.quantityCases !== netCases) {
        await db
          .update(wmsStock)
          .set({
            quantityCases: netCases,
            availableCases: netCases - existingStock.reservedCases,
            updatedAt: new Date(),
          })
          .where(eq(wmsStock.id, existingStock.id));
        updated++;
      }
    } else {
      // Create new stock record
      await db.insert(wmsStock).values({
        locationId,
        ownerId: owner.ownerId,
        ownerName: owner.ownerName,
        lwin18,
        productName,
        quantityCases: netCases,
        reservedCases: 0,
        availableCases: netCases,
        shipmentId,
        receivedAt: new Date(),
        salesArrangement: 'consignment',
      });
      created++;
    }
  }

  // Log the recovery
  console.log('[WMS] Stock rebuild completed:', { created, updated, errors });

  return {
    success: true,
    message: `Rebuilt stock from movements: ${created} created, ${updated} updated`,
    created,
    updated,
    errors: errors.length > 0 ? errors : undefined,
  };
});

export default adminRebuildStockFromMovements;
