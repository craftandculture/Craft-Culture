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
  // Note: Transfers need special handling - each transfer creates TWO effects:
  //   -quantity at from_location_id, +quantity at to_location_id
  // We use UNION ALL to treat each transfer as two separate rows
  const netStockFromMovements = await db.execute(sql`
    WITH movement_effects AS (
      -- Receives: add stock at to_location
      SELECT lwin18, product_name, to_location_id as location_id, shipment_id, quantity_cases as effect
      FROM wms_stock_movements
      WHERE movement_type = 'receive' AND to_location_id IS NOT NULL

      UNION ALL

      -- Picks: remove stock from from_location
      SELECT lwin18, product_name, from_location_id as location_id, shipment_id, -quantity_cases as effect
      FROM wms_stock_movements
      WHERE movement_type = 'pick' AND from_location_id IS NOT NULL

      UNION ALL

      -- Transfers: add stock at to_location
      SELECT lwin18, product_name, to_location_id as location_id, shipment_id, quantity_cases as effect
      FROM wms_stock_movements
      WHERE movement_type = 'transfer' AND to_location_id IS NOT NULL

      UNION ALL

      -- Transfers: remove stock from from_location
      SELECT lwin18, product_name, from_location_id as location_id, shipment_id, -quantity_cases as effect
      FROM wms_stock_movements
      WHERE movement_type = 'transfer' AND from_location_id IS NOT NULL

      UNION ALL

      -- Adjustments (excluding stock corrections): add/subtract at from_location
      SELECT lwin18, product_name, COALESCE(to_location_id, from_location_id) as location_id, shipment_id, quantity_cases as effect
      FROM wms_stock_movements
      WHERE movement_type = 'adjust' AND reason_code != 'stock_correction'
    )
    SELECT
      lwin18,
      product_name,
      location_id,
      shipment_id,
      SUM(effect) as net_cases
    FROM movement_effects
    WHERE location_id IS NOT NULL
    GROUP BY lwin18, product_name, location_id, shipment_id
    HAVING SUM(effect) > 0
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
