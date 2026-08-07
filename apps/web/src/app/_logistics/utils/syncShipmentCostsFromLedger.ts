import { eq } from 'drizzle-orm';

import db from '@/database/client';
import {
  logisticsShipmentCostLines,
  logisticsShipmentItems,
  logisticsShipments,
} from '@/database/schema';

import calculateLandedCost from './calculateLandedCost';

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Recompute a shipment's 8 cost fields as the sum of its cost-ledger lines by
 * category, then re-run landed-cost allocation. Call after any ledger change so
 * the breakdown, per-item landed cost and pricing stay in sync with the ledger.
 */
const syncShipmentCostsFromLedger = async (shipmentId: string) => {
  const lines = await db
    .select()
    .from(logisticsShipmentCostLines)
    .where(eq(logisticsShipmentCostLines.shipmentId, shipmentId));

  const b = {
    freight: 0,
    insurance: 0,
    origin_handling: 0,
    destination_handling: 0,
    customs: 0,
    gov_fees: 0,
    delivery: 0,
    other: 0,
  };
  type BKey = keyof typeof b;
  for (const l of lines) {
    const k: BKey = l.category in b ? (l.category as BKey) : 'other';
    b[k] += l.amountUsd;
  }

  await db
    .update(logisticsShipments)
    .set({
      freightCostUsd: round2(b.freight),
      insuranceCostUsd: round2(b.insurance),
      originHandlingUsd: round2(b.origin_handling),
      destinationHandlingUsd: round2(b.destination_handling),
      customsClearanceUsd: round2(b.customs),
      govFeesUsd: round2(b.gov_fees),
      deliveryCostUsd: round2(b.delivery),
      otherCostsUsd: round2(b.other),
      updatedAt: new Date(),
    })
    .where(eq(logisticsShipments.id, shipmentId));

  const [shipment] = await db
    .select()
    .from(logisticsShipments)
    .where(eq(logisticsShipments.id, shipmentId));
  const items = await db
    .select()
    .from(logisticsShipmentItems)
    .where(eq(logisticsShipmentItems.shipmentId, shipmentId));

  if (shipment && items.length > 0) {
    const result = calculateLandedCost(shipment, items);
    await db
      .update(logisticsShipments)
      .set({ totalLandedCostUsd: result.totalLandedCost, updatedAt: new Date() })
      .where(eq(logisticsShipments.id, shipmentId));
    for (const it of result.items) {
      await db
        .update(logisticsShipmentItems)
        .set({
          freightAllocated: it.freightAllocated,
          landedCostTotal: it.landedCostTotal,
          landedCostPerBottle: it.landedCostPerBottle,
          updatedAt: new Date(),
        })
        .where(eq(logisticsShipmentItems.id, it.itemId));
    }
  }
};

export default syncShipmentCostsFromLedger;
